# AI24 ↔ code-agent 端到端流程全景图

> 记录时间：2026-07-09
> 场景：一个允许创建的工厂任务，从前端点击到 code-agent 初始化完成
> 用途：代码导航图 - 每个节点都可以直接跳到对应文件和行号

---

## 🎯 场景设定

**用户操作**: 在前端点击"创建任务",填写表单:
- 任务名: "开发订单系统"
- 任务类型: backend
- 工作流: 领域划分工作流
- 模型: claude-opus-4-8
- DEP 地址: http://dep.vdian.net/#/taskDetail?id=12345
- 测试人员: 张三

**目标**: 追踪这个请求从前端到 code-agent 初始化完成、上报状态的完整链路。

---

## 📊 完整流程概览（鸟瞰图）

```
【前端浏览器】
    │ POST /api/taskInfo/create
    ▼
┌─────────────── ai24 (Java / Spring Boot) ──────────────┐
│  ① Controller   参数、用户、环境权限、PRD迭代入口保护       │
│      ├─ 管理员或需求白名单命中：允许继续创建              │
│      ├─ 其余普通用户命中自动迭代：拒绝，不进入code-agent    │
│      └─ 放行后按 orchestrationNo 路由普通/编排任务          │
│      ↓                                                  │
│  ② Service      开事务(@Transactional)                  │
│      ↓                                                  │
│  ③ Orchestrator 生成ID、解析input、存库、下发            │
│      ├─ task_info 表 (status=0)                        │
│      ├─ task_record 表                                 │
│      └─ TaskPerformService 发HTTP                      │
└──────────────────┼──────────────────────────────────────┘
                   │ POST /task/perform {taskId,depUrl,model...}
                   ▼
┌─────────────── code-agent (Python / Flask) ─────────────┐
│  ④ TaskPerformResource.post  接收、解析参数              │
│      ├─ 同步三套知识库                                   │
│      ├─ 解析 depUrl → dep_id                           │
│      ├─ 保存 MetaContainer、登记机器和版本                │
│      └─ 启动新线程，HTTP 返回 202                         │
│          ↓                                             │
│  ⑤ Claude SDK 调用 init-project Skill                  │
│      └─ 执行 project_initialization.py                 │
│          ↓                                             │
│  ⑥ DEP初始化  查询需求/gitUrl/branch/PRD               │
│      └─ 补充 MetaContainer，保存并上报相关文档            │
│      ↓                                                 │
│  ⑦ 环境初始化  克隆代码、准备CLAUDE.md/OpenSpec          │
│      ↓                                                 │
│  ⑧ 上报完成 POST /api/task/notify/taskStatus (100)     │
└───────────────────────────────────────────────────────┘
```

---

## 📋 详细流程表(可跳转的代码地图)

### 阶段A: 前端 → ai24 Controller

| 步骤 | 位置 | 动作 | 关键代码/数据 |
|-----|------|------|--------------|
| 0️⃣ 前端发起 | 浏览器 | POST `/api/taskInfo/create` | `{taskName, input, multiModel}` |
| | | input 内容 | `'{"depUrl":"...","flowType":"backend","templateId":"...","model":"opus"}'` |
| 1️⃣ Controller接收 | `TaskInfoController.createTask` | 参数校验 | `if (request == null)` 返回错误 |
| | | | `if (!hasText(input))` 返回错误 |
| | | | `if (multiModel && models为空)` 返回错误 |
| | | 获取用户 | `SSOUtil.getUser().getName()` → username |
| | | | `SSOUtil.getUser().getNick()` → realName |
| | | 管理员判断 | `ALLOWED_USERS_NAME` → `isAdmin` |
| | | 环境权限校验 | 日常/预发环境仅管理员可创建 |
| | | PRD 自动迭代拦截 | 普通用户：解析 `input.depUrl` → 查 DEP 详情 |
| | | 需求豁免 | 第一个关联 `requirementId` 命中 `MANUAL_CREATE_REQUIREMENT_ID_WHITELIST` 时直接放行 |
| | | 迭代判断 | 需求未豁免时，再用 `iterationId` 匹配 `PRD_ITERATION_ID_WHITELIST` |
| | | 拦截结果 | 普通用户命中则返回“不支持手动创建”，不落库、不调用 code-agent |
| | | 管理员例外 | 管理员可跳过整个迭代拦截，保留应急创建入口 |
| | | 创建路由 | `orchestrationNo > 0` 走编排任务；否则走普通任务 |
| | | **普通任务status强制null** | 落库为0，等 code-agent 初始化后上报100 |

> 后续阶段 B～F 主要跟踪“普通任务成功放行”后的链路。编排任务会先创建主任务和节点流水，真正的节点任务才会进入 code-agent。

---

### 阶段B: Service → Orchestrator (事务边界)

| 步骤 | 位置 | 动作 | 关键代码/数据 |
|-----|------|------|--------------|
| 2️⃣ Service开事务 | [TaskInfoServiceImpl.java:119](ai24-core/service/impl/TaskInfoServiceImpl.java#L119) | 开启数据库事务 | `@Transactional(rollbackFor = Exception.class)` |
| | :120 | 转发 | `return taskCreateOrchestrator.createTask(...)` |
| | | 作用 | 整个方法是一个事务,任何一步抛异常全部回滚 |

---

### 阶段C: Orchestrator 编排(核心八站)

| 步骤 | 位置 | 动作 | 关键代码/数据 |
|-----|------|------|--------------|
| 3️⃣ 编排器入口 | [TaskCreateOrchestrator.java:119](ai24-core/service/TaskCreateOrchestrator.java#L119) | 方法签名 | `createTask(taskName, input, status, username...)` |
| | :148 | **生成taskId** | `taskId = "t-" + taskIdGenerator.generateTaskId()` |
| | | | 示例: `"t-1720512345678"` |
| | :151 | **构建任务对象** | `buildTaskInfoDO(taskId, input, status, ...)` |
| | | 解析input | 调用 `TaskInputParser.extractDepUrl(input)` |
| | | | `TaskInputParser.extractFlowType(input)` |
| | | | `TaskInputParser.extractModel(input)` 等 |
| | | | 还会调DEP API: `depApiProxy.getIssueDetail(depId)` |
| | | 返回 | TaskInfoDO对象(含taskId/userName/input/status=0/depId/gitUrl...) |
| | :154-161 | 需求当日上限拦截 | `if (isRequirementDailyLimitExceeded(...))` |
| | | | 超限直接插TERMINATED记录返回 |
| | :165 | **存task_info表** | `taskInfoManager.save(taskInfoDO)` |
| | | | → TaskInfoManager.save:59 |
| | | | → 设置 gmtCreate/gmtUpdate/isDelete=1 |
| | | | → taskInfoMapper.insert(taskInfoDO) (MyBatis Plus) |
| | | 数据库变化 | `INSERT INTO task_info (...) VALUES (...)` |
| | | | status=0, taskId="t-xxx", input=原JSON |
| | :171 | **存task_record表** | `createUserMessageRecord(taskId, input)` |
| | | | 插入一条 recordType=用户消息 的记录 |
| | | 数据库变化 | `INSERT INTO task_record (task_id, content, record_type)` |
| | :174-179 | **调code-agent** | `if (!isMultiModelTask) callTaskPerformService(...)` |
| | | | 多模型跳过,用第8步 |
| | :182-184 | 创建子任务 | `if (isMultiModelTask) createSubTasksForMultiModel(...)` |
| | | | 多模型才执行 |

---

### 阶段D: 发HTTP给code-agent

| 步骤 | 位置 | 动作 | 关键代码/数据 |
|-----|------|------|--------------|
| 4️⃣ 组装请求 | [TaskCreateOrchestrator.java:410](ai24-core/service/TaskCreateOrchestrator.java#L410) | callTaskPerformService | 方法参数: TaskInfoDO, input, username |
| | :425-443 | 构建请求对象 | `TaskPerformRequest request = new TaskPerformRequest()` |
| | | 从input抠字段 | `request.setTaskId(taskId)` |
| | | | `request.setDepUrl(TaskInputParser.extractDepUrl(input))` |
| | | | `request.setGitUrl(extractGitUrl(input))` |
| | | | `request.setBranch(extractBranch(input))` |
| | | | `request.setModel(extractModel(input))` |
| | | | `request.setFlowType(extractFlowType(input))` |
| | | | `request.setTemplateId(processTemplateId(...))` |
| | :最后 | 调performTask | `taskPerformService.performTask(request)` |
| 5️⃣ 发HTTP | [TaskPerformServiceImpl.java:85](ai24-core/service/impl/TaskPerformServiceImpl.java#L85) | 组装HTTP | `HttpHeaders headers = new HttpHeaders()` |
| | | | `headers.setContentType(APPLICATION_JSON)` |
| | :86 | | `HttpEntity<TaskPerformRequest> httpEntity = ...` |
| | :88-92 | **发送POST** | `restTemplate.exchange(targetUrl + "/task/perform", POST, httpEntity, ...)` |
| | | 目标URL | `http://code-agent地址/task/perform` |
| | | 请求体 | TaskPerformRequest对象(自动序列化成JSON) |
| | | 返回 | TaskPerformResponse(success/message) |
| | :96-102 | 异常兜底 | catch住返回 success=false,不让整个创建失败 |

**🔄 跨系统边界: Java → Python**

---

### 阶段E: code-agent 接收与解析

| 步骤 | 位置 | 动作 | 关键代码/数据 |
|-----|------|------|--------------|
| 6️⃣ Flask接收 | [main.py:230](code-agent/main.py#L230) | TaskPerformResource.post | Flask Resource类,相当于Spring Controller |
| | :242 | 接收JSON | `data = request.get_json()` |
| | | | 拿到ai24发来的所有字段 |
| | :247-251 | 打印参数 | `logger.info(f"完整请求数据: {data}")` |
| | | | 调试用,记录所有参数 |
| | :254-267 | 拉知识库 | 依次 clone/pull `knowledge`、`knowledge-service`、`app-knowledge-v2` |
| | | | 三套仓库各自从管理平台读取目标分支，默认 `main` |
| | | | 同步失败只记日志，不阻断任务初始化 |
| | :268-271 | 提取参数 | `dep_url = data.get('depUrl')` |
| | | | `task_id = data.get('taskId')` |
| | | | `model = data.get('model')` |
| | :286-289 | 解析dep_id | `dep_id = parse_dep_id_from_url(dep_url)` |
| | | | 从URL抠出数字ID |
| | :295-310 | 提取更多参数 | `flow_type = data.get('flowType')` |
| | | | `template_id = data.get('templateId')` |
| | | | `enable_document_auto_upload = data.get(...)` |
| | | | `enable_tdd = data.get('enableTdd')` |
| | | | `dependent_git_urls = data.get(...)` |

**准备在新线程执行初始化流程...**

---

### 阶段F: code-agent 初始化(新线程异步执行)

| 步骤 | 位置 | 动作 | 关键代码/数据 |
|-----|------|------|--------------|
| 7️⃣ 启动后台线程 | [main.py:约420行](code-agent/main.py#L420) | threading.Thread | 创建新线程执行初始化，立刻返回 HTTP 202 |
| | | 为什么新线程 | 初始化要几分钟,不能让HTTP请求一直挂着 |
| | | 立刻返回 | 返回体带 `success=true`、`mode=dep_url_via_claude`、`task_id`、`dep_id` |
| 8️⃣ 初始化入口 | [main.py:2163](code-agent/main.py#L2163) | run_init_task_via_claude | 开启本次初始化的备份监听，上报会话进行中 |
| | | 初始化提示词 | 只要求 Claude 使用 `init-project` Skill，并传入 `task_id` |
| | | SDK参数 | `keep_session=True`、`system_prompt=""`、挂载 `InitStatusCheckHook` |
| 9️⃣ Skill脚本 | `.claude/skills/init-project/SKILL.md` | project_initialization.py | 固定执行 DEP 初始化，再执行环境初始化 |
| | | DEP初始化 | 获取需求详情、gitUrl、branch、PRD、设计稿/技术方案信息 |
| | | 元数据保存 | 通过 MetaContainer 写 AI24 `agentTaskData` 云端接口 |
| 🔟 环境初始化 | `environment_initialization.py` | init_task_project | 克隆主仓库及可选依赖仓库 |
| | | 项目准备 | 检查/生成 `CLAUDE.md`，初始化 `openspec/project.md` |
| | | 文件监听 | 只在本次初始化期间监听备份，收尾时等待同步并停止 |
| 1️⃣1️⃣ 上报完成 | `environment_initialization.py` | report_task_status_with_retry | 初始化全部完成 |
| | | 目标API | `POST /api/task/notify/taskStatus` |
| | | payload | `taskId + status=100`；Apply 模式跳过该状态上报 |
| | | ai24处理 | 更新 task_info.status=100 + WebSocket推前端 |
| | | 前端变化 | 进度条从"初始化中"变"初始化完成" |

**🎉 初始化完成,任务进入等待用户query阶段**

---

## 🔄 三条上报链路汇总(贯穿整个流程)

code-agent 在上面的流程中,不断通过这三条链路上报信息:

| 链路 | 目标API | 触发时机 | 上报内容 | ai24如何处理 |
|-----|---------|---------|---------|------------|
| ① 机器心跳 | `/api/agentMachine/heartbeat` | 定时(每N秒) | ip/hostname/tasks/进程数 | 存agent_machine表,给路由用 |
| ② 任务状态 | `/api/task/notify/taskStatus` | 任务推进时 | taskId + status码(0/100/215/500...) | UPDATE task_info.status + 推WebSocket |
| ③ 任务内容 | `/api/task/report/content` | 实时(流式) | taskId + content(对话/日志/产物) | INSERT task_record + 推WebSocket |

**初始化阶段用到的**:
- status=0 是 ai24 创建任务时写入的初始状态，不是 code-agent 再回调一次 status=0
- 阶段F步骤8～10: 初始化消息和过程内容 → 链路③(多次)
- 阶段F步骤11: 上报status=100(完成) → 链路②

---

## 📊 数据流动总览

### ai24 侧数据变化

| 时刻 | 表 | 操作 | 数据 |
|-----|---|------|------|
| 阶段C步骤5 | task_info | INSERT | taskId, status=0, input, userName, depId... |
| 阶段C步骤6 | task_record | INSERT | taskId, recordType=用户消息, content=input |
| 阶段F步骤9 | task_info | UPDATE | status=0 (确认,可能没变) |
| 阶段F步骤10 | task_record | INSERT多次 | 每次进度上报插一行 |
| 阶段F步骤11 | task_info | UPDATE | status=100 |

如果 Controller 在 PRD 自动迭代检查处拦截，请求在阶段A结束，上述数据库写入和 code-agent 调用都不会发生。

### code-agent 侧数据变化

| 时刻 | 存储位置 | 操作 | 数据 |
|-----|---------|------|------|
| 阶段F步骤8 | MetaContainer(云端API) | SAVE | task_id → {gitUrl, branch, prdContent...} |
| 阶段F步骤8 | OSS对象存储 | UPLOAD | PRD文档、会话文件 |
| 阶段F步骤10 | 本地磁盘 | git clone | 项目代码拉到本地 |

---

## ✅ 检查清单:你能回答这些问题吗?

- [ ] Controller/Service/Orchestrator/TaskPerformService 各自职责是什么?
- [ ] 哪些手工创建请求会被 PRD 自动流程规则拦截，管理员和需求白名单为什么例外?
- [ ] 普通任务和 `orchestrationNo > 0` 的编排任务从哪里开始分流?
- [ ] 为什么必须先存 task_info 再调 code-agent?
- [ ] task_info(身份证) vs task_record(日记本) 的区别和关系?
- [ ] ai24 是"推送参数"还是 code-agent "拉取参数"?
- [ ] code-agent 的三条上报链路分别上报什么、给谁用?
- [ ] status 从 0→100 分别在哪两个时刻上报?
- [ ] 为什么 code-agent 要用新线程执行初始化?
- [ ] 元数据保存到哪两个地方(ai24的表 + code-agent的云端)?

---

## 🔗 相关笔记交叉引用

- [ai24-stage5-full-flow.md](./ai24-stage5-full-flow.md) - 完整链路八站(宏观)
- [ai24-stage6-input-fields.md](./ai24-stage6-input-fields.md) - input五要素解析
- [ai24-stage7-database-schema.md](./ai24-stage7-database-schema.md) - 数据库表结构
- [code-agent-learning/00-导航/启动与任务流程-理解校对与澄清.md](../code-agent-learning/00-导航/启动与任务流程-理解校对与澄清.md)
- [code-agent-learning/04-消息与通信/上报机制与流式推送.md](../code-agent-learning/04-消息与通信/上报机制与流式推送.md)

**使用建议**:把这份当"代码导航地图"——想看某个环节的代码,直接点对应的文件位置跳过去。
