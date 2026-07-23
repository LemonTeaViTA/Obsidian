# AI24 综合实战 - 阶段5：一个任务的完整生命周期

> 学习时间：2026-07-09
> 目标：把 stage1-4 的静态分层，变成一个"活"的请求，跨越 ai24(Java) 和 code-agent(Python) 两个系统，从前端点击一直追到任务结束。

---

## 🗺️ 全景：这其实是两个系统在对话

前四阶段学的 Controller→Service→Manager→Mapper 都在 **ai24 (Java)** 一个系统里。
但真实的���务执行涉及**两个系统**：

```
┌─────────┐  HTTP   ┌──────────────────┐  HTTP   ┌──────────────────┐
│  前端    │ ──────> │  ai24 (Java后端)  │ ──────> │ code-agent(Python)│
│ (浏览器) │ <────── │  Spring Boot      │ <────── │  Flask + AI Agent │
└─────────┘         │  管理任务/存库     │  回调    │  真正干活的AI      │
                    └──────────────────┘         └──────────────────┘
                            ↓
                        ┌───────┐
                        │ MySQL │  task_info / task_record ...
                        └───────┘
```

- **ai24** = 任务的管理者和账本：建任务、存库、记状态，但**自己不写代码**
- **code-agent** = 真正的打工人：AI Agent，接到任务后拉代码、跑模型、写代码
- 两者靠 **HTTP** 通信，而且**双向**：ai24 下发任务，code-agent 干活时不断回调 ai24 上报状态

> 记住这张图。下面跟着一个真实请求走完八站。

---

## 站点 1️⃣：前端发起 —— 一个 HTTP POST

用户从工厂页面手工点击"创建任务"，浏览器发出：

```javascript
fetch('https://ai24域名/api/taskInfo/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        taskName: "开发登录功能",
        input: '{"depUrl":"http://dep.vdian.net/#/taskDetail?id=235459","flowType":"backend","model":"claude-opus-4-8"}',
        multiModel: false, models: [], domain: null
    })
})
```

⚠️ **关键**：`input` 不是一句话，而是一个 **JSON 字符串**，里面塞了 depUrl/flowType/model/testerName 等。
（这个 input 的五要素，单独在 stage6 详解。）

对应 Java 的 `CreateTaskRequest`（ai24-core/dto/CreateTaskRequest.java）。

---

## 站点 2️⃣：Web 层 —— Controller 接住请求

`TaskInfoController.createTask` 负责六件事：

1. 参数校验：request/input 非空，多模型必须带 models
2. 拿用户：`SSOUtil.getUser().getName()`（从单点登录取当前登录人）
3. 环境权限：日常/预发环境只有白名单能建任务
4. 手工创建保护：普通用户命中 PRD 自动流程迭代时默认拒绝；需求白名单命中时豁免
5. 创建路由：`orchestrationNo > 0` 走编排任务，否则走普通任务
6. 调用下层创建，**status 写死 null**，拿回 taskId

第 4 步会从 `input.depUrl` 提取 DEP ID并查询 DEP 详情。系统先取第一个关联需求的 `requirementId`：如果命中 `MANUAL_CREATE_REQUIREMENT_ID_WHITELIST`，直接放行；否则再用 `iterationId` 匹配 `PRD_ITERATION_ID_WHITELIST`。管理员保留应急入口；解析失败、DEP 查询失败或名单为空时仍按原来的 fail-open 规则放行。

> 这次改动后，Controller 不再只是纯参数转发：它承载了一个轻量的入口业务策略。真正的任务落库、节点推进和 code-agent 下发仍然在 Service/Orchestrator 中。

### ⭐ 工程细节：status 强制置 null

Controller 注释（124-127行）明确写：任务创建落库为 0(初始化中)，等 code-agent 初始化完成后上报 100。**不用前端传的 status**，避免任务一创建就是"已完成"绕过初始化。

> 思想：**不信任前端**。前端可篡改，后端强制掌控状态机。

如果请求被 PRD 自动流程规则拦截，系统会直接返回错误，不写 `task_info`，也不会调用 code-agent。只有通过入口检查的请求，才会拿到 taskId 并继续下发。

---

## 站点 3️⃣：业务层 —— Service 只转发，真正大脑是 Orchestrator

下面先沿着“普通任务”路径继续。`TaskInfoServiceImpl.createTask`：

```java
@Override
@Transactional(rollbackFor = Exception.class)   // ← 整个方法是一个数据库事务
public String createTask(...) {
    return taskCreateOrchestrator.createTask(...);  // 又转发给编排器!
}
```

**为什么多一层 Orchestrator(编排器)？** 创建任务太复杂(校验DEP、生成ID、解析input、存库、发消息、调code-agent、建子任务)。
Service 只做"事务边界 + 入口"，Orchestrator 做"步骤编排"，避免 ServiceImpl 变成几千行怪物。

如果请求带有大于 0 的 `orchestrationNo`，Controller 不走上面的普通任务路径，而是调用 `RequirementFlowService.processOneRequirementPublic` 创建编排主任务并推进首节点。编排主任务本身不直接调用 code-agent，真正执行的是节点任务。

`@Transactional`：任何一步抛异常，前面的 DB 操作**全部回滚**。

---

## 站点 4️⃣：编排核心 —— 请求在这里被拆解

`TaskCreateOrchestrator.createTask`（ai24-core/service/TaskCreateOrchestrator.java:119），核心步骤(148-186行)：

```java
String taskId = "t-" + taskIdGenerator.generateTaskId();      // 3. 生成ID  "t-1024xxxx"
TaskInfoDO taskInfoDO = buildTaskInfoDO(taskId, input, ...);   // 4. 解析input→结构化对象
if (isRequirementDailyLimitExceeded(...)) { return taskId; }   // 4.1 当日上限拦截
boolean result = taskInfoManager.save(taskInfoDO);             // 5. 存库
createUserMessageRecord(taskId, input);                        // 6. 写用户消息记录
if (!isMultiModelTask(multiModel)) {
    callTaskPerformService(taskInfoDO, input, ...);            // 7. ★飞向code-agent★
}
// 8. 多模型任务:为每个模型建子任务
```

### buildTaskInfoDO：input 那坨 JSON 怎么变成数据库字段（272行）

```java
taskInfoDO.setInput(input);                        // 原始input整个存下来
taskInfoDO.setStatus(status != null ? status : 0); // ← "初始化中=0"
taskInfoDO.setDepId(issueDetail.getIssueId()...);   // 从DEP需求单查到

// 从input里"抠"出各种字段:
String flowType = TaskInputParser.extractFlowType(input);
List<String> pageUrls = TaskInputParser.extractPageUrls(input);
// 零碎字段塞进一个 extend JSON 字段
taskInfoDO.setExtend(extend.toJSONString());
```

> 设计模式：**input 原文完整保留**(以后复现) + **常用字段解析出来单独存列**(以后查询)。
> `extend` 是"杂物抽屉"，不值得单独建列的都塞成 JSON。企业级项目里到处是 `extend`/`ext_info`。

---

## 站点 5️⃣：持久层 —— 数据落进 MySQL

`TaskInfoManager.save`（ai24-core/manager/TaskInfoManager.java:59）：

```java
public boolean save(TaskInfoDO taskInfoDO) {
    taskInfoDO.setGmtCreate(LocalDateTime.now());  // 创建时间
    taskInfoDO.setGmtUpdate(LocalDateTime.now());  // 更新时间
    taskInfoDO.setIsDelete(IS_DELETE_VALID);        // 逻辑删除标记=1(有效)
    return taskInfoMapper.insert(taskInfoDO) > 0;   // MyBatis Plus 自动生成 INSERT
}
```

### 三个每张表都有的通用字段

| 字段 | 含义 |
|------|------|
| `gmt_create`/`gmt_update` | 创建/更新时间，阿里系命名规范 |
| `is_delete` | **逻辑删除**：删任务不是真 DELETE，而是改标记为 -1。数据永远可追溯、可恢复。查询处处 `.eq(is_delete,1)` |

此时数据库里已有一条 `task_info`，status=0。事务还没提交(方法结束才提交)。

### task_info vs task_record：身份证 vs 日记本

编排器第5步建 task_info、第6步建 task_record，这两张表关系是 **1 : N**：

| | task_info (任务信息表) | task_record (任务记录表) |
|---|---|---|
| 一个任务几行 | **1 行** | **N 行**(随任务推进不断新增) |
| 记什么 | 任务是**什么**(属性) | 任务**发生过什么**(流水/事件) |
| 关键字段 | taskId/userName/taskName/input/status/flowType/depId/gitUrl/workflowNo/extend | taskId(外键)/recordId/recordType/content/documentType |
| 生命周期 | 一直存在，status 字段被回调不断**更新** | 只增不改，每来一条消息/文档就 INSERT 一行 |

```
task_info (1条,身份证)          task_record (N条,日记本)
┌──────────────────┐          ┌────────────────────────────────┐
│ taskId: t-001     │◄─────────│ t-001 | 用户消息 | "请实现登录"  │
│ status: 0→100→500 │  taskId  │ t-001 | 系统消息 | "已初始化"    │
│ userName: 张三     │  关联    │ t-001 | AI回复  | "我来分析..."  │
│ input: {...}      │          │ t-001 | 文档    | "技术方案.md"  │
└──────────────────┘          │ t-001 | AI回复  | "代码写好了"    │
                              └────────────────────────────────┘
```

- **task_info = 身份证/档案封面**：一张，记属性，status 被不断更新。
- **task_record = 日记本/聊天记录**：随任务推进新增行，流水账，只增不改。
- 编排器第5步 `taskInfoManager.save()` = 建身份证；第6步 `createUserMessageRecord()` = 日记第一页"用户提交了需求"(recordType=用户消息)。

> code-agent 后面每回调一次(说了啥/写了啥/出了文档)，ai24 就往 task_record 加一行 + 更新 task_info 的 status。

---

## 站点 6️⃣：飞向 code-agent —— HTTP 出口 (Java → Python)

第一个跨系统接缝。`callTaskPerformService`（TaskCreateOrchestrator.java:410）把 TaskInfoDO+input 重组成 `TaskPerformRequest`，再交给 `performTask` 发出。

真正发 HTTP 在 `TaskPerformServiceImpl.performTask`（ai24-core/service/impl/TaskPerformServiceImpl.java:48），核心：

```java
@Value("${ai24.task.perform.url:https://codeagent.daily.vdian.net}")
private String taskPerformUrl;   // ← code-agent地址,从配置文件读

HttpHeaders headers = new HttpHeaders();
headers.setContentType(MediaType.APPLICATION_JSON);
HttpEntity<TaskPerformRequest> httpEntity = new HttpEntity<>(request, headers);

ResponseEntity<TaskPerformResponse> responseEntity = restTemplate.exchange(
        targetUrl + "/task/perform",   // POST https://codeagent.../task/perform
        HttpMethod.POST, httpEntity, TaskPerformResponse.class);
```

### ⭐ 本节最重要的知识点

1. **`RestTemplate`** = Spring 的 HTTP 客户端。Java 服务**主动**调另一个 HTTP 服务时用它。
   （Controller 是"被别人调"，这里是"ai24 主动去调 code-agent"，角色反过来。）
2. **`@Value("${...}")`**：code-agent 地址不写死，从配置文件读(filter.properties)。冒号后是默认值。
3. **序列化**：Java 对象 `TaskPerformRequest` 被自动转成 JSON 发出 → Python 解析成 dict。
   **跨语言通信本质 = 大家都认 JSON**。Java 的 `request.getTaskId()` ↔ Python 的 `data.get('taskId')`。
4. **routeByWorkflowNo**：同套 code-agent 部署多台机器，按 workflowNo 决定发给哪台(负载均衡/任务路由)。
5. **异常兜底**：code-agent 挂了/超时，catch 住返回 success=false，**不让整个创建失败**。
   任务��存库，下发失败可后续重试 —— "存库"和"下发"解耦。

---

## 站点 7️⃣：code-agent 接住 —— HTTP 入口 (Python 侧)

请求落在 `main.py:230 TaskPerformResource.post`（Flask 框架）。思路和 Spring **一模一样**：

```python
class TaskPerformResource(Resource):
    def post(self):
        data = request.get_json()          # ← 相当于 @RequestBody
        # 先尝试同步 knowledge / knowledge-service / app-knowledge-v2
        dep_url = data.get('depUrl')       # 从JSON取字段
        task_id = data.get('taskId')
        model   = data.get('model')
        if dep_url:
            dep_id = parse_dep_id_from_url(dep_url)
            # 保存参数后，在新线程里通过 init-project Skill 执行初始化
```

### Flask vs Spring 对照表（同一思���的两种方言）

| 概念 | Java (Spring) | Python (Flask) |
|------|---------------|----------------|
| 路由注册 | `@PostMapping("/create")` | `api.add_resource(TaskPerformResource,'/task/perform')` |
| 接收JSON | `@RequestBody CreateTaskRequest` | `data = request.get_json()` |
| 取字段 | `request.getTaskId()` | `data.get('taskId')` |
| 返回 | `return ApiResponse.success(...)` | `return {...}, 202` |

当前 `master` 中 `/task/perform` 在 `main.py:3601` 注册；同一区域还注册了 `/task/query`（继续对话）、`/task/interrupt`（中断）等端点。

### ⭐ 关键设计：新线程执行 + 立刻返回

初始化可能耗时较长，不能让 HTTP 请求一直挂着。所以 code-agent 在保存参数并启动线程后返回 **HTTP 202（已接受）**，后台再通过 Claude 调用 `init-project` Skill。Skill 固定执行 `project_initialization.py`，依次完成 DEP 初始化和环境初始化，过程中通过**回调**告诉 ai24 进展。

当前 `code-agent master` 还有三个容易混淆的细节：

- 初始化外层 SDK 调用使用 `keep_session=True`，但完成后会清理任务到会话的映射。
- status=100 由 `environment_initialization.py` 上报；Apply 模式会跳过这次上报。
- 文件备份监听在本次初始化开始时启动，初始化收尾时等待最后一次同步并停止，不是永久运行。

---

## 站点 8️⃣：回调闭环 —— code-agent 反过来调 ai24 (Python → Java)

code-agent 干活时不断反向调用 ai24 的接口(见 code-agent/external_api_proxy.py)：

```python
/api/task/notify/taskStatus      # 上报任务状态(0→100→500)
/api/task/report/content         # 上报执行内容(AI说了啥做了啥)
/api/taskInfo/systemErrorAlert   # 上报错误告警
/api/task-document/upload        # 上传产出文档
```

最核心的状态上报打回 `TaskNotifyController.notify/taskStatus`（ai24-web/controller/TaskNotifyController.java:398）：

```java
@PostMapping("/notify/taskStatus")
public ... {
    TaskInfoDO task = taskInfoService
        .updateTaskStatusWithFinalStateProtectionAndReturn(taskId, status, consumeTime);
    // 更新DB status + WebSocket推给前端
}
```

⚠️ 方法名 **`FinalStateProtection`(终态保护)**：任务已是 500(完成)/999(终止)等终态时，不允许被改回"进行中"。防止乱序回调把已完成任务改活。

### 任务状态机（贯穿全程的主线）

```
status=0    初始化中    ← 站点4 save 时(Controller强制的初始值)
   ↓        (code-agent 拉代码、建项目)
status=100  初始化完成   ← code-agent 回调 taskStatus 上报
   ↓        (AI 真正写代码、跑流程；细分310开发/320CR/410单测/420集成测试...)
status=500  已完成      ← code-agent 干完活回调 COMPLETED
   或
status=999  已终止      ← 出错/被中断/超上限
```

（500=COMPLETED、999=TERMINATED，见 TaskInfoManager.java:1009 查"进行中任务"时正是排除这两个终态。）
每次状态变化，ai24 通过 **WebSocket**(`/ws/report`, ReportWebSocketHandler)实时推前端，进度条就动了。

---

## 🔄 完整链路一图流（八站串起来）

```
【用户点击"创建任务"】
     │ ① POST /api/taskInfo/create  {taskName, input, ...}
     ▼
┌──────────────────── ai24 (Java) ────────────────────┐
│ ② TaskInfoController.createTask                      │
│      参数 / SSO用户 / 环境权限                         │
│      需求ID命中手工白名单? ──是──►允许继续创建           │
│      否:普通用户命中PRD自动迭代? ──是──►拒绝手工创建     │
│      orchestrationNo>0? ──是──►编排主任务+节点流水      │
│      否: status强制null，进入普通任务路径               │
│ ③ TaskInfoServiceImpl (普通任务事务入口) → 转发         │
│ ④ TaskCreateOrchestrator.createTask  ★编排核心★      │
│      生成taskId → buildTaskInfoDO(解析input) → 上限拦截│
│ ⑤ TaskInfoManager.save → Mapper.insert ──► 【MySQL】 │
│      task_info落库 status=0 is_delete=1  task_info表 │
│ ⑥ callTaskPerformService → performTask               │
│      RestTemplate.exchange ──────┐                   │
└──────────────────────────────────┼───────────────────┘
     ⑦ POST /task/perform           │ (HTTP+JSON,跨语言)
     ▼                              │
┌──────────── code-agent (Python) ─┼───────────────────┐
│ TaskPerformResource.post          │                   │
│    data=request.get_json()→解析depUrl/taskId          │
│    同步三套知识库→保存元数据→返回202                    │
│    新线程: Claude→init-project Skill→初始化脚本         │
│    查DEP/存PRD→克隆代码→准备CLAUDE.md/OpenSpec          │
│    执行过程中不断回调 ↓                                 │
└───────┼───────────────────────────────────────────────┘
     ⑧ POST /api/task/notify/taskStatus  (Python反向调Java)
     ▼
┌──────────────────── ai24 (Java) ────────────────────┐
│ TaskNotifyController.notify/taskStatus               │
│    updateTaskStatus(终态保护) → 更新DB status         │
│    WebSocket 推送前端 ──► 【前端进度条更新】            │
└──────────────────────────────────────────────────────┘
     │
     ▼   status: 0 → 100 → 500(完成)   任务结束 ✅
```

---

## 🎯 5 个可迁移到任何项目的工程思想

1. **不信任前端**：status 强制置 null、input 后端重新解析、权限和 PRD 自动迭代规则都在后端校验。
2. **两个系统靠 JSON over HTTP 对话**：Java 或 Python 无所谓，都认 JSON。`RestTemplate`(主动调) 和 `Flask Resource`(接收) 是镜像关系。
3. **异步 + 回调**：耗时任务不能同步等，下发后立刻返回，靠状态回调追踪。
4. **状态机是主线**：0→100→500 贯穿两个系统。理解一个业务，先找它的状态机。
5. **解耦与兜底**：存库和下发分开(下发失败不影响建任务)；事务、终态保护、异常catch，都为出错时不崩不脏。

---

## 🧵 补充：多个任务同时来，编排器怎么扛？（并发模型）

结论：**编排器只有一个(单例)。多任务并发 = "一个编排器对象，被多个线程同时调用"。不是多个编排器，也不是排队，是多线程并发。**

### 证据一：编排器是单例 + 无状态（TaskCreateOrchestrator.java:44）

```java
@Component   // ← Spring组件,默认单例:全应用只 new 一个对象
public class TaskCreateOrchestrator {
    private final TaskInfoManager taskInfoManager;  // ← 11个字段清一色 private final
    private final DepApiProxy depApiProxy;          //    全是"依赖/工具",不是"请求数据"
}
```

- **@Component → 单例**：启动时只造一个，所有请求共用同一个对象。
- **字段全 final 的依赖 → 无状态**：类里没有 `private String currentTaskId` 这种存单请求数据的字段。

### 证据二：每请求一个线程，数据在方法参数/局部变量里

Spring Boot 内嵌 Tomcat 有线程池(没配 max-threads 时默认 **200**)：

```
任务A ─► 线程1 ─┐
任务B ─► 线程2 ─┼─► 都调用同一个 orchestrator.createTask(参数...)
任务C ─► 线程3 ─┘
```

方法里 `taskId`、`taskInfoDO` 全是**局部变量**，而 Java 铁律：**方法参数和局部变量每个线程各有独立一份(活在各自线程栈)**。所以线程1的 taskId 和线程2的 taskId 互不干扰。共享的只有单例里那些无状态依赖，多线程用同一个也安全。

> **单例 + 无状态 = 天然线程安全。** 一个对象，N个线程，各跑各的数据，谁也碰不到谁。

### ⚠️ 铁律：这种 Bean 里绝不能放"可变成员变量"存请求数据

```java
@Component
public class TaskCreateOrchestrator {
    private String currentTaskId;   // ❌❌ 灾难:线程1刚写,线程2立刻覆盖 → 串味
}
```

这就是为什么字段清一色 `final`——从设计上杜绝并发污染。
**规则：@Component/@Service/@Controller 默认单例，里面只放 final 依赖，请求数据只待在方法参数和局部变量里。**

### 三个常见猜测的对错

| 猜测 | 对错 |
|------|------|
| 编排器会有多个 | ❌ 永远一个(单例) |
| 按顺序排队编排 | ❌ 不排队 |
| 多线程同时编排 | ✅ 对，Tomcat每请求一线程，并发调同一编排器 |

> 补：stage6 的测试任务自动创建用 `@Async`，是**另一个线程池**(非Tomcat的200)。系统里多个线程池各司其职：Tomcat池处理HTTP，@Async池跑后台异步活。

---

## 📁 关键文件索引（想复习时直接翻）

| 站点 | 文件 |
|------|------|
| ② Controller | ai24-web/.../controller/TaskInfoController.java（`createTask` / `isManualCreationBlocked` / `routeTaskCreation`） |
| ③ Service | ai24-core/.../service/impl/TaskInfoServiceImpl.java:120 |
| ④ 编排核心 | ai24-core/.../service/TaskCreateOrchestrator.java:119 (buildTaskInfoDO:272, callTaskPerformService:410) |
| ⑤ 存库 | ai24-core/.../manager/TaskInfoManager.java:59 |
| ⑥ 发HTTP | ai24-core/.../service/impl/TaskPerformServiceImpl.java:48 |
| ⑦ Python入口 | code-agent/main.py:230 (端点注册 main.py:3598) |
| ⑧ 回调 | ai24-web/.../controller/TaskNotifyController.java:398 |
| input解析 | ai24-core/.../utils/TaskInputParser.java (详见 stage6) |

---

## ✅ 阶段5 检查清单

- [x] 理解 ai24 和 code-agent 是两个系统，靠 HTTP 双向通信
- [x] 追踪创建任务的完整八站
- [x] 理解 Controller→Service→Orchestrator→Manager→Mapper 的转发链
- [x] 理解 `RestTemplate` 是 Java 主动调外部服务的方式
- [x] 理解 Flask 和 Spring 是同一思想的两种方言
- [x] 理解异步+回调架构，及任务状态机 0→100→500/999
- [x] 理解终态保护、事务、异常兜底等防御式设计
- [x] 理解手工创建入口为什么要拦截 PRD 自动流程迭代，以及管理员为什么保留应急入口
- [x] 区分普通任务路径和 `orchestrationNo > 0` 的编排任务路径

**下一步 → stage6：拆解 input 五要素(dep地址/工作流/模型/测试人员/任务类型)**
