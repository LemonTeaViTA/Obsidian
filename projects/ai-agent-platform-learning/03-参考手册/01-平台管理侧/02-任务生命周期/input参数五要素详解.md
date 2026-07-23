# AI24 综合实战 - 阶段6：创建任务第一环，input 五要素

> 学习时间：2026-07-09
> 目标：搞懂前端"创建任务"表单的每一项，是怎么变成 input JSON、又被后端怎么消费的。
> 前置：stage5(完整链路)。本篇聚焦链路的**第一环**——input 的构成与解析。

---

## 📋 前端表单 = 一个 input JSON 字符串

你在创建任务界面填的 5 项，拼起来就是那个 `input` 字段（真实样例来自 PromotionDynConfig.java:1034）：

```json
{
  "depUrl":     "http://dep.vdian.net/#/taskDetail?id=262225",   ← dep地址(需求单)
  "flowType":   "backend",                                        ← 任务类型
  "templateId": "12345",                                          ← 工作流(模板ID)
  "model":      "claude-opus-4-8",                                ← 模型选择
  "testerName": "张三",                                           ← 测试人员
  "content":    "请实现登录功能",
  "gitUrl":"...", "branchName":"...", "projectName":"..."
}
```

### 谁来拆它？—— TaskInputParser（input 的"解剖刀"）

文件：ai24-core/src/main/java/com/vdian/ai24/core/utils/TaskInputParser.java

| 前端表单项 | input 的 key | 解析方法 |
|-----------|-------------|---------|
| 任务类型 | `flowType` | `extractFlowType()` :60 |
| 工作流 | `templateId` | `extractTemplateId()` :53 |
| 模型选择 | `model` | `extractModel()` :74 |
| 测试人员 | `testerName` | `extractTesterName()` :67 |
| dep地址 | `depUrl` | `extractDepUrl()` :49 |

它们底层都调同一个 `extractStringValue`(:183)，本质就一行：

```java
JSON.parseObject(input).getString(key);   // 解析JSON,按key取值。极其朴素,但这就是真相
```

---

## 1️⃣ dep 地址

### 格式：一条严格正则（TaskInputParser.java:221 isValidDepUrl）

```java
String regex = "^http://dep\\.vdian\\.net/#/(taskDetail|bugDetail)\\?id=\\d+$";
```

合法的 dep 地址只有两种：

```
http://dep.vdian.net/#/taskDetail?id=262225    ← 开发任务单
http://dep.vdian.net/#/bugDetail?id=262225     ← Bug 单
```

`dep.vdian.net` = 公司内部需求/任务管理平台(DEP)。`id=262225` = 需求单编号。

### dep 地址是一把"钥匙"（不是信息本身）

```
depUrl "...taskDetail?id=262225"
   │ 解析出 id → 262225
   ▼
ai24 拿 id 调 DEP 内部接口 (DepApiProxy.java:44):
   GET http://dep.vdian.net/innerApi/issue/issue/262225
   ▼
拿回 DepIssueDTO(需求详情):
   name(需求名) / creator(创建人) / gitUrl(仓库) / branch / projectName / PRD / 技术方案链接
```

> 这就是 stage5 里 buildTaskInfoDO 用的 `issueDetail` 的来源！
> ai24 用 depUrl 换来需求详情，再把 depId/projectName/requirementName 填进 TaskInfoDO。
> **又是 RestTemplate** —— ai24 作为"中间协调者"，到处主动调别的系统(DEP拿需求、code-agent执行)。

### depUrl 现在会在创建入口先用一次

手工调用 `/api/taskInfo/create` 时，`TaskInfoController` 会在真正创建任务前先使用一次 `depUrl`：

```text
request.input（必须是 JSON 字符串）
   ↓ TaskInputParser.extractDepId(input)
读取 input.depUrl 并提取 DEP ID
   ↓ depApiProxy.getIssueDetail(depId)
获取 iterationId
   ↓
读取第一个 requirementInfo.requirementId
   ├─ 命中 MANUAL_CREATE_REQUIREMENT_ID_WHITELIST：允许继续创建
   └─ 未命中：匹配 PRD_ITERATION_ID_WHITELIST
          ├─ 普通用户命中：拒绝手工创建，要求走 PRD 自动流程
          └─ 未命中或管理员：继续原创建流程
```

因此 `input` 不能只传一个裸 URL。正确格式是：

```json
{"depUrl":"http://dep.vdian.net/#/taskDetail?id=262225"}
```

入口解析失败、DEP 查询异常、查不到 `iterationId` 或迭代名单为空时采用“放行”策略；后续创建流程仍会按原有规则校验 input 和 DEP 数据。需求白名单只提供手工入口豁免，不会改变任务实际归属的需求，也不会跳过其他业务校验。

---

## 2️⃣ 测试人员

⚠️ 不只是存个名字，它驱动了一整套"自动创建测试任务"机制。
核心：ai24-core/src/main/java/com/vdian/ai24/core/listener/TestTaskAutoCreateListener.java

### 触发条件（:49）

```java
// 开发任务状态变成这些时,自动创建测试任务
TRIGGER_STATUS_SET = {310, 320, 410, 420, 500}
//                    开发  CR  单测 集成测试 完成
```

### 新机制：@EventListener + @Async（事件监听 + 异步）

```java
@Async          // 异步:单开线程,不阻塞主流程
@EventListener  // 监听:有人发布"任务状态变更事件"时自动被调用
public void handleTaskStatusChanged(TaskStatusChangedEvent event) { ... }
```

> **为什么用事件而不直接调？** 解耦。更新任务状态的代码不需要知道"还要建测试任务"，
> 它只管发"状态变了"事件，谁关心谁自己监听。以后加通知/日志只需加新监听器，不动原代码。这是 Spring 的**事件驱动**模式。

### 完整处理链路

```
开发任务状态→310  发布 TaskStatusChangedEvent
   ▼
TestTaskAutoCreateListener 触发
   ├ 检查1: flow_type 必须="backend"           :98
   ├ 检查2: templateId≠"0"(自由任务不建)        :106
   ├ 检查3: 防重复(已建过就跳过)                 :82
   ├ 从input抠出 testerName="张三"              :112
   ├ getTesterUsername("张三")→调VosManager查工号:265
   │     "张三"(真实姓名) → "zhangsan"(用户名)
   ├ createTestTask: taskName="原名_测试", templateId换成测试工作流, userName=测试人员
   ├ 建关联 TaskRelation(devTaskId ←→ testTaskId) :133
   ├ performInit: 调code-agent初始化测试任务      :144
   └ sendWeworkNotification: 企微通知张三          :149
```

### 3 个关键点

1. **真实姓名 → 用户名转换**：前端填"张三"，系统内部用"zhangsan"。靠 VosManager 查 VOS 系统(Dubbo调用)。
2. **测试任务 = 特殊的普通任务**：复用创建任务整套机制，只是换 templateId/userName + 建 TaskRelation 关联。
3. **测试任务同样 performInit 调 code-agent** —— 又回到 stage5 的 Java→Python 链路。

> 本质：创建开发任务时指定测试人员 → 开发任务跑到特定阶段 → 系统自动为测试人员开配套测试任务并通知。

### ⚠️ 澄清一：测试人员怎么定的？——手填，不是按方向映射

系统里**没有**"方向/领域 → 测试人员"的映射表，也**不是**"谁创建谁测试"。
真相是：**创建者在前端表单手动填一个测试人员的名字**，存进 input.testerName，系统只是读出来。

唯一的"映射"是**查询翻译，不是分配**（getTesterUsername :265）：

```java
VosUserDO vosUser = vosManager.getVosUserInfoByUserName(realName); // "张三"
return vosUser.getUsername();   // → "zhangsan"(工号)
```

VosManager 调 VOS 组织架构系统，只做"姓名→工号/企微ID"的翻译，用来建任务、发通知，**不做分配决策**。domain/flowType 不参与测试人员的选择。

### ⚠️ 澄清二："建立关联"是什么？——任务↔任务，跟机器号无关

容易混的两个"关联"，彻底分开记：

| 概念 | 是什么 | 谁↔谁 |
|------|--------|-------|
| **机器路由** | `agentMachineService.getTaskMachineIp(taskId)` | 任务 ↔ 机器(哪台code-agent跑) |
| **TaskRelation(建立关联)** | `task_relation` 表插一行 | 开发任务 ↔ 测试任务 |

TaskRelation 实体(ai24-persist/TaskRelationDO.java，表 `task_relation`)：

```java
private String devTaskId;      // 开发任务ID
private String testTaskId;     // 测试任务ID
private String relationType;   // "DEV_TEST"
private Integer status;        // 1-有效 0-无效
```

建立关联(:133)就是插一行，记住"开发任务 t-A 和测试任务 t-B 是一对"。
因为它俩是**两个独立任务**(各有taskId、各自被code-agent执行)，有了这行系统才能回答"这个开发任务对应哪个测试任务"、防重复创建(existsByDevTaskId)。

> **关联 = 给两个任务牵一根线，不涉及机器或人。**

---

## 3️⃣ 工作流

### 前端"工作流下拉列表"调的接口

Controller：ai24-web/.../controller/WorkflowManageController.java:27，基础路径 `/api/workflowManage`

```
GET  /api/workflowManage/page                分页查工作流列表(下拉数据来源)
GET  /api/workflowManage/detail/{workflowNo} 查工作流详情
GET  /api/workflowManage/systemTemplates     查系统提示词模板列表
POST /api/workflowManage/createComplete      创建完整工作流
```

Swagger 可视化 + 试调：`http://localhost:8080/swagger-ui/`

### 工作流的三层结构

```
SpecWorkflow(工作流) → SpecStage(阶段) + SpecConvention(约定)
```

- **SpecWorkflow**：一套完整研发流程模板(标准后端/TDD/PRD审核...)，有唯一 `workflowNo`
- **SpecStage**：工作流里的步骤(技术方案→编码→单测→CR)
- **SpecConvention**：每个阶段绑定的**指令+提示词**(SpecConventionVO.java 真实字段)：
  ```java
  conventionName    "技术方案"
  conventionCommand "@tech-design"   ← 下发给code-agent的指令
  templateId        关联的提示词模板ID
  ```

> **工作流本质 = 一串有序阶段，每阶段带一条指令+一个提示词。**
> 前端选工作流其实是选它的 templateId，塞进 input 传给 code-agent，
> code-agent 就知道"按哪套流程、用哪些提示词干活"。

### 请求模板 ID 和实际生效模板 ID

现在不能简单认为“`input.templateId` 永远决定运行版本”。系统增加了 `GET_TEMPLATE_LATEST_WORKFLOW_NOS`：

```text
input.templateId（任务创建时保存的请求版本）
   ↓ spec_workflow_template.workflow_no
workflowNo 命中 GET_TEMPLATE_LATEST_WORKFLOW_NOS？
   ├─ 否：继续使用 input.templateId
   └─ 是：读取 spec_workflow.workflow_template_id 指向的当前最新版本
```

需要记住：

- `input.templateId` 不会被改写，它仍记录任务创建时选择的模板版本。
- 真正查询 Stage、Convention 和 Prompt 时，命中白名单的工作流使用“实际生效模板 ID”。
- 任务详情返回的工作流元数据和阶段树也会统一切换到这个实际生效版本。
- 旧 UUID 格式的提示词模板不参与这套工作流版本解析。
- 命中白名单但最新模板指针或模板记录异常时直接解析失败，不偷偷回退旧版本。
- Convention 的任务级 `customSpecSetting` 自定义提示词仍然优先保留。

### 为什么工作流那么多？不同类型走不同流程，各有专门处理器

| 工作流 | 处理器/标志 |
|--------|-----------|
| PRD审核 | PrdAuditEscalateHandler.java(审核打回时企微通知) |
| 应用拆分 | AppSplitEscalateHandler.java |
| TDD | callTaskPerformService 里 `request.setEnableTdd(true)` |
| 测试 | 测试人员那节的 `test_workflow` |

workflowNo 白名单配在 `PromotionDynConfig`(如 `PRD_AUDIT_WORKFLOW_NO`)，命中不同 workflowNo 走不同分支。

### 补充：按工作流查任务(Dubbo RPC，非 HTTP)

文档：docs/按工作流查询任务ID接口文档.md

```java
com.vdian.ai24.client.facade.TaskSystemFacade#queryTaskIdsByWorkflow
```

游标翻页(cursor)按工作流批量查任务ID，每页100条，只查当天。给其他系统批量拉数据用。
> 现在只需知道：**Dubbo 是系统间调用，和 HTTP 是两种不同通信方式**。

---

## 4️⃣ 任务类型 (flowType)

`flowType` 决定走哪条业务分支。已知取值示例：
- `backend` —— 后端任务(只有它会自动建测试任务，见第2节检查1)
- `frontend_common` —— 前端通用(会 require_figma，见 code-agent 侧)
- `frontend_logic` —— 前端逻辑(会拉依赖仓库 dependentGitUrls)

> flowType 是"分流开关"：同一个创建入口，靠它把任务导向不同处理逻辑。

---

## 5️⃣ 模型选择 (model)

- 普通任务：`model` 单个字符串，下发 code-agent 决定用哪个 AI。
- 多模型任务(`multiModel=true`)：`models` 是列表，为每个模型建一个**子任务**分别执行(stage5 站点4 第8步)。
- `TaskInputParser.updateModel()`(:81) 可动态改写 input 里的 model(重试/切模型场景)。

### 多模型的真相：不是分工，是"同题竞赛"(best-of-N)

关键理解：**不是"哪个模型干哪个任务"，而是"所有选中的模型并行干同一件事"，最后由人挑最优。**
核心代码：ai24-core/src/main/java/com/vdian/ai24/core/service/impl/SubTaskInfoServiceImpl.java

**谁选模型？** 你(前端)勾选多个 → `models` 列表如 `["opus","gemini","ccr"]`。校验"至少选一个"(:497)。

**一个模型 = 一个子任务**（多模型时主任务自己不调code-agent，stage5站点4第177行故意跳过）：

```java
// generateSubTasks :552 —— 遍历模型列表,每个模型造一个子任务
modelCodes.stream().map(modelCode -> {
    String subTaskId = generateSubTaskId(parentTaskId, sequence); // "st-{父id}-{序号}"
    return createFromParentTask(parentTask, subTaskId, subTaskType, modelCode, modelName);
})
// 3个模型 → st-xxx-1 / st-xxx-2 / st-xxx-3,各记一个 modelCode
```

**每个子任务各自调 code-agent，用不同 git 分支**（callCodeAgent :754）：

```java
performRequest.setInput(TaskInputParser.extractContent(parentTask.getInput())); // 同一个input
performRequest.setDepUrl(...);                              // 同一个需求
performRequest.setModel(modelCode);                        // 但用不同模型
performRequest.setBranch(originalBranch + "_" + sequence); // 不同分支 xxx_1/2/3
taskPerformService.performTask(performRequest);            // 各自飞向 code-agent
```

> 看清楚：input/depUrl/content 全一样(同一件事)，**唯一不同的是 model 和 git 分支**。

```
        主任务(多模型) t-xxx   ← 自己不干活,只当总控
   ┌──────────┼──────────┐
   ▼          ▼          ▼
st-xxx-1   st-xxx-2   st-xxx-3
opus       gemini     ccr
branch_1   branch_2   branch_3
   ▼          ▼          ▼
code-agent  code-agent  code-agent   (同需求,不同模型各写一版,互不干扰)
   └──────────┼──────────┘
              ▼  三份 proposal 都摆出来 → 人挑最好的
```

**谁决定赢家？人**（acceptProposal :388）：用户在页面看各模型产出，手动选一个 → 选中标记采纳，
其余标记 `rejected`(废弃)。这就是 AI 编程里的 "best-of-N" / 模型竞赛，用多样性提升产出质量。

### 父任务 vs 子任务：会有多个 taskId 吗？

会。一个多模型任务 = **1 个父任务 + N 个子任务**，ID 格式不同：

```
你看到的"一个任务"  = 父任务(parent)  taskId: t-xxx      ← 只建了这一个,是"总控/壳子"
系统实际拆出来的     = N 个子任务       taskId: st-xxx-1(opus)
                                             st-xxx-2(gemini)
                                             st-xxx-3(ccr)
```

- **概念上**同一个任务(一个父)；**数据上**是 1父 + N子，共 N+1 个 taskId。
- **父任务本身不干活、不调 code-agent**(编排器第7步对多模型跳过)。真正干活的是 N 个子任务。

### ⚠️ 是 ai24 拆，不是 code-agent 拆

拆分逻辑全在 **ai24 侧**(createSubTasksForMultiModel)。code-agent **不知道"多模型"这回事**——
它收到的是 N 个各自独立的普通任务，每个带**一个**模型、在**独立 git 分支**、是**一次独立的 perform 调用**、一段独立对话。

```
   ai24编排器(多模型) → 自己拆成N个子任务
   ┌──────────┼──────────┐
st-xxx-1   st-xxx-2   st-xxx-3      ← ai24里就是3条独立记录
opus       gemini     ccr
   ▼          ▼          ▼
 perform    perform    perform      ← 3次独立HTTP调用
   ▼          ▼          ▼
code-agent code-agent code-agent    ← 对它来说是3个不相干的任务
```

### 前端怎么显示？——三个都显示，并排对比，选一个采纳

支撑显示的接口(SubTaskController / SubTaskInfoController)：

```
GET /api/subtask/list?parentTaskId=t-xxx           查父任务下所有子任务(画出N个面板)
GET /api/subTaskInfo/byTaskId/{taskId}/withSummary 查单个子任务详情
     ↑ 注释明确:"与主任务详情格式一致" → 前端复用普通任务详情组件,不用为多模型写新组件
POST /api/subtask/proposal/accept                  采纳选中的方案
```

```
┌────────── 父任务 t-xxx "开发登录功能" ──────────┐
│  ┌─ opus ─────┐ ┌─ gemini ───┐ ┌─ ccr ──────┐ │
│  │ st-xxx-1   │ │ st-xxx-2   │ │ st-xxx-3   │ │
│  │ (对话记录)  │ │ (对话记录)  │ │ (对话记录)  │ │
│  │ 分支_1      │ │ 分支_2      │ │ 分支_3      │ │
│  │ [采纳]      │ │ [采纳]      │ │ [采纳]      │ │
│  └────────────┘ └────────────┘ └────────────┘ │
└─────────────────────────────────────────────────┘
```

**"显示哪一个"——三个都显示并排让你对比。** 你点某个"采纳"→ acceptProposal：选中的标记 accepted、
其余标记 rejected；之后只有被采纳的子任务往下走(apply/开发阶段)，其余作废。

---

## 🗺️ 五要素接回 stage5 大图

```
前端表单            input JSON        去向
┌────────┐        ┌──────────┐
│dep地址  │────────│depUrl    │──► 换取DEP需求详情(RestTemplate调dep.vdian.net)
│任务类型  │────────│flowType  │──► 决定业务分支(backend才建测试任务)
│工作流   │────────│templateId│──► 决定流程+提示词,下发code-agent
│模型选择  │────────│model     │──► 下发code-agent,决定用哪个AI
│测试人员  │────────│testerName│──► 开发任务跑到310+阶段时自动派生测试任务
└────────┘        └──────────┘
                       │ TaskInputParser 逐个 extract
                       ▼  存入TaskInfoDO / 下发code-agent
```

---

## ✅ 阶段6 检查清单

- [x] 理解前端5个表单项 = input JSON 的5个key
- [x] 掌握 TaskInputParser 是 input 的解析工具，每个 extractXxx 对应一个字段
- [x] dep地址：格式正则 + 它是去DEP换需求详情的"钥匙"
- [x] 测试人员：@EventListener+@Async 自动派生测试任务 + 真实姓名→用户名转换
- [x] 工作流：三层结构(Workflow→Stage→Convention) + /api/workflowManage 接口 + 多种工作流分支
- [x] flowType 是分流开关，model 单/多模型区别

**关联笔记 → stage5(完整链路)：input 只是链路第一环，解析完就进入编排、存库、下发。**
