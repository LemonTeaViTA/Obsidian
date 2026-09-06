---
module: SageCLI
type: project
status: source-study
tags: [SageCLI, PaiCLI, Agent, ReAct, Plan-and-Execute, Multi-Agent, 面试]
last_reviewed: 2026-09-05
---

# SageCLI 项目主卡

> [!tip] 验收结论：strong fit
> 简历已改用当前项目真实存在且岗位价值最高的四条主线：Agent 控制编排、流式 Tool Calling 协议、Memory / Skill / MCP 上下文工具体系、安全与可靠性治理。项目其余模块继续完整学习，正式问题从这四条及其一跳追问展开。

## 一、项目定位与开场

### 一句话定位

SageCLI 是一个 Java 终端编程 Agent，通过 ReAct、Plan-and-Execute、Planner-Worker-Reviewer、Tool Calling、上下文与安全治理，把模型决策转化为受控的代码和命令操作。

### 30 秒介绍

> SageCLI 是一个 Java 终端编程 Agent。我重点复现并分析了从 Prompt、Memory 和 Skill 上下文组装，到模型流式 Tool Calling、工具执行、结果按调用 ID 回填和多轮终止的完整链路；复杂任务还可以切换到 Plan-and-Execute 或 Planner-Worker-Reviewer 编排。工程侧通过预算、取消、路径和命令防护、人工审批与审计约束 Agent 的真实副作用。

### 90 秒介绍

> 这个项目的核心不是聊天界面，而是 Agent Host 如何把模型输出变成受控执行。ReAct 路径每轮组装上下文，让模型返回文本或 Tool Call；Host 校验和执行工具，把结果以对应的 tool_call_id 回填，直到模型不再调用工具，或者命中 Token、轮次、重复调用和取消等预算边界。
>
> 对复杂任务，Plan-and-Execute 会先生成带依赖的任务图，经过人工计划确认后并行执行当前可运行节点；Multi-Agent 则使用 Planner、Worker、Reviewer 分工，独立步骤可并行，Reviewer 不通过时带反馈重试。三条路径复用 LlmClient、ToolRegistry、Memory 和渲染能力，但控制状态不同。
>
> 这套架构的关键取舍是：模型负责选择 Action，Host 必须负责协议、权限、状态和终止；Plan 与 ReAct 可以分层组合，Multi-Agent 则额外引入角色通信和共享资源冲突。当前同轮 Tool Call 默认批量并行；Multi-Agent 中 Planner / Reviewer 不拿工具 Schema，Worker 却拿完整工具集，仍缺任务级路径、工具和副作用裁剪。因此“副作用感知调度”和“Worker 最小权限”是优化方向，不是现有实现。

## 二、核心架构

```text
终端 / TUI 输入
→ PromptAssembler + 项目上下文 + Memory + Skill
→ LlmClient 统一模型调用
→ Agent 控制器
   ├─ Agent：ReAct
   ├─ PlanExecuteAgent：计划任务图
   └─ AgentOrchestrator：Planner / Worker / Reviewer
→ ToolRegistry
   ├─ 文件、搜索、Shell、Web 等内置工具
   └─ MCP 动态工具
→ PathGuard / CommandGuard / HITL / AuditLog
→ Tool Result 回填会话
→ 下一轮模型决策或结束
```

### 三条控制路径

| 路径 | 主要状态 | 适用任务 | 当前限制 |
| --- | --- | --- | --- |
| ReAct | Message、Tool Call、Observation、Budget | 目标明确、需要边做边判断 | 全局计划弱，错误可能在多轮后才暴露 |
| Plan-and-Execute | Task、Dependency、Status、Plan Review | 有明确依赖的多步任务 | 计划可能过时，每个 Task 内仍需 Agent 循环 |
| Multi-Agent | Planner、Worker、Reviewer、Retry | 可拆成独立子任务并需要复核 | 仅 Worker 调工具，但拿完整工具集；工作区与 Skill buffer 仍共享 |

这些模式不是互斥的理论阵营。Plan 负责任务级结构，每个步骤内部仍会用工具调用循环；Multi-Agent 又加入角色分工和 Reviewer 反馈。

## 三、五条核心执行链路

### ReAct

```text
用户输入
→ 每个用户任务重建 system prompt，加载 Project Context 与相关长期 Memory
→ 将本次已加载 Skill buffer 一次性注入 user message
→ 调用支持流式和 Tool Calling 的 LlmClient
→ 返回 content / reasoning / tool_calls / usage
   ├─ 无 tool_calls：结束并保存回答
   └─ 有 tool_calls：转成 ToolInvocation
→ ToolRegistry 执行工具并保留原调用顺序
→ 以 tool_call_id 将结果回填 conversationHistory
→ 下一轮，直到完成 / 取消 / 预算退出
```

终止条件不能只依赖模型说“完成”。`AgentBudget` 还检查 Token、硬轮次和重复 Tool Call；不过默认 Token 硬预算近似无限，当前主要兜底是连续 3 轮完全相同调用和 50 轮硬上限。

### Plan-and-Execute

```text
用户任务 → Planner 生成 Task 与 dependency → 两遍解析并重编号
→ 拓扑检查 → 人工 Review（执行 / 取消 / 补充后重规划）
→ 选择依赖已完成的可运行节点 → 最多 4 个一批执行
→ 更新 COMPLETED / FAILED / SKIPPED → 汇总，或早期失败后重规划
```

环依赖会被拒绝；不存在的依赖当前会被静默忽略。任务在进度低于 50% 时失败会递归重规划，源码没有显式重规划次数上限。

### Multi-Agent

```text
Planner 生成步骤 → 识别当前独立步骤 → 最多 2 个 Worker 并行
→ Reviewer 审核 → 拒绝时携带 issues 重试，最多 2 次
→ 聚合结果，或因失败依赖而终止
```

Planner / Reviewer 当前不调用工具，Worker 使用完整工具集。Reviewer 调用失败会 fail-open；明确拒绝重试耗尽后，步骤仍保留最后结果并标记完成。

### 工具

```text
内置 / MCP 注册 → Schema 暴露 → Tool Call → HITL（默认关闭，可会话开启）
→ 批准后仍进入参数解析与 Guard → 最多 4 个同轮调用批量并行
→ 90 秒批次超时 / 取消 → AuditLog → 按输入顺序和 tool_call_id 回填
```

HITL 包装器当前先询问危险调用，再进入父类的参数解析和 Path / Command Guard；因此人工批准不能绕过后续策略拒绝，但非法参数可能先触发一次审批。

### 后台任务

```text
Durable Task：创建 → SQLite runtime_tasks → Worker 执行 → 状态查询 / 取消 / 结果
Runtime API：创建 Thread → SQLite runtime_threads / runtime_events → Turn 执行 → SSE 查询事件
```

这是两套独立机制：前者没有事件表，后者不负责 Durable Task 的领取与恢复。重启时前者把 `running` 重置为 `enqueued`，可能重复已有副作用。

## 四、完整能力地图

| 知识模块 | 解决的问题 | 输入 / 输出 | 关键状态 | 当前主要限制 |
| --- | --- | --- | --- | --- |
| Agent Host / ReAct | 将模型决策变成可控执行 | 用户任务 / 文本或副作用结果 | 会话、Budget、取消令牌 | 语义循环检测弱 |
| Plan | 显式管理多步依赖 | 目标 / Task 状态与汇总 | `ExecutionPlan` | 未知依赖静默忽略，重规划无显式上限 |
| Multi-Agent | 角色分工、并行与复核 | 步骤 / 聚合结果 | Step、Worker 池、Review issues | Reviewer 有 fail-open，Worker 权限未裁剪 |
| LLM / SSE | 兼容流式文本、推理和工具协议 | Message + Schema / Response + Usage | 按 index 的 Tool Call accumulator | 缺专门的 arguments 分片回归测试 |
| Context / Memory / Skill | 控制不同生命周期的上下文 | 项目规则、事实、指令 / Prompt | `PAI.md`、内存、JSON、Skill buffer | 无 Freshness Guard；Skill buffer 跨路径共享 |
| Tool / MCP | 统一工具发现与执行 | Schema + arguments / Tool Result | ToolRegistry、MCP Server 状态 | 不识别副作用；Server 失败无自动重启 |
| 安全与治理 | 限制循环和真实副作用 | 调用、路径、命令 / allow、deny、error | Budget、Guard、HITL、Audit | HITL 默认关闭，无 OS 沙箱 |
| 后台运行时 | 单机保存长任务或 API 事件 | Prompt / Task 状态或 Event | 两套 SQLite 表 | Durable Task 恢复可能重复执行 |

### 扩展学习与工程边界

- **交互与开发辅助：**inline / Lanterna / plain 渲染、LSP 写后诊断、Side-Git 快照、图片输入和浏览器会话复用。
- **代码检索：**AST / 文本分块、Embedding、SQLite 向量与关系存储；默认依赖本机 Ollama，外部依赖未启动时单文件失败会被降级并可能得到空索引。
- **外部通道：**Runtime API 仅监听 `127.0.0.1` 且要求 API Key；微信通道有绑定用户、命令白名单和独立控制路径。
- **配置与部署：**Java 17 + Maven 构建可执行 fat jar；Provider、Memory、MCP、Skill、日志等由环境变量、系统属性和用户 / 项目配置组合。
- **测试约束：**POM 默认 `skipTests=true`，普通 `mvn package` 不能视为测试通过；回归必须显式使用 profile 或 `-DskipTests=false`。

### Tool Calling 和流式协议

`AbstractOpenAiCompatibleClient` 统一构造 OpenAI 兼容请求、解析 SSE、拼接被拆碎的 tool call，并读取 input/output/cached token。Provider 差异通过不同 Client 子类和少量 override 处理，而不是数据驱动的 `SeriesQuirks` 注册表。

Tool Call accumulator 按 `index` 累积 ID、名称和 arguments；最终缺 ID 的调用会被跳过。运行时模型选择是真实能力，但没有透明主备故障转移。

### 计划与并行

`PlanExecuteAgent` 从 Planner 获取任务和依赖，选择可执行节点并最多用四个线程并行；`AgentOrchestrator` 使用两个 Worker 执行独立步骤，Reviewer 拒绝后最多按反馈重试。并行成立的前提应是依赖和副作用可控，但当前 ToolRegistry 内同轮 Tool Call 不区分读写，属于待改进点。

### 安全纵深

- `PathGuard` 防绝对路径、`..` 和符号链接逃逸，并支持校验尚不存在的写入目标。
- `CommandGuard` 快速拒绝明显破坏性命令，但源码明确说明黑名单不是完整沙箱。
- HITL 在高风险工具执行前提供人工确认。
- `AuditLog` 记录 allow、deny 和 error，覆盖写文件、命令和 MCP 等工具。

### 后台任务

`DurableTaskManager` 使用 SQLite 持久化后台 Agent Task，并由 Worker 执行；`RuntimeThreadStore` 独立保存 Thread 与 Event。它们都不是完整的后台 Shell 进程生命周期管理，也不能合并成一套“Task 事件表”。

## 五、新简历 Bullet 映射

| 新简历主线 | 对应模块 | 面试价值 |
| --- | --- | --- |
| ReAct / Plan / Planner-Worker-Reviewer | `Agent`、`PlanExecuteAgent`、`AgentOrchestrator` | 控制流、任务依赖、并行与 Reviewer 重试 |
| SSE、分片 Tool Call、Usage 和结果回填 | `LlmClient`、`AbstractOpenAiCompatibleClient`、Tool Call accumulator | 模型协议、流式状态和消息一致性 |
| Project Context、Memory、Skill、MCP、ToolRegistry | Prompt / Memory / Skill / MCP / Tool 模块 | Harness 上下文工程与工具扩展 |
| Budget、Cancellation、Guard、HITL、Audit、两套 SQLite 机制 | `AgentBudget`、`CancellationContext`、Policy、Durable Task、Runtime API | 真实副作用、安全、终止与恢复 |

旧简历中不存在的类名和“读并行、写串行”完成态已删除；相关思想保留为架构改进题继续学习。

## 六、三个关键技术判断

### ReAct 与 Plan-and-Execute 的关系

ReAct 是单步循环：根据最新 Observation 决定下一 Action；Plan-and-Execute 先显式生成任务和依赖，再逐步执行。Plan 不会消灭 ReAct，每个计划节点仍可能需要多轮工具调用。简单任务直接 ReAct 更灵活，复杂依赖任务用 Plan 提高全局可见性，但需要重规划或人工确认防止计划漂移。

### 为什么 Tool Result 要按原调用顺序回填

并行完成顺序可能变化，但每个 Tool Result 必须用 tool_call_id 对应原调用。当前实现按输入下标读取 Future 并返回，保证消息历史顺序稳定。真正正确性依赖 ID 配对，不应声称“顺序不同一定会让模型把 A 当 B”；顺序主要影响可读性和部分 Provider 的消息约束。

### 黑名单为什么不是沙箱

CommandGuard 能拦住已知危险模式，却无法枚举所有 Shell 组合、间接脚本或业务级危险操作；PathGuard 也只约束文件工具，Shell 仍能产生更广泛副作用。因此需要 PathGuard、CommandGuard、HITL、审计和操作系统级隔离组合，不能把正则黑名单当最终安全边界。

## 七、真实源码 Failure Case

### 当前工具并行会把写操作一起并发

- 现象：同一轮模型返回多个 Tool Call 时，`executeTools` 将全部调用提交到固定线程池。
- 根因：工具描述与调度器没有副作用类型和资源冲突键。
- 当前保护：工具结果有超时和按原顺序回填，但这不解决副作用冲突。
- 定位与验证：用带栅栏的两个测试工具证明并发，再用同文件双写固定用例检查最终 Diff、回填 ID 和 Trace。
- 残余风险：两个写或命令可能覆盖同一资源；超时后不响应中断的工具仍可能继续产生副作用。
- 重新设计：给 Tool Descriptor 增加 `READ / WRITE / EXECUTE` 与冲突键；只读批次并行，写和命令建立顺序屏障。

## 八、建议的个人改造闭环

优先选择“工具副作用调度”作为个人改造，因为它同时覆盖 Agent、并发、安全和验证：

1. 定义工具副作用枚举和默认策略。
2. 将调用序列切成只读并行批次与写入屏障。
3. 让 SubAgent 按角色获得只读或受限 ToolRegistry View。
4. 建立同文件写、读后写、命令与取消的固定场景集。
5. 记录串行正确性、只读并行耗时和失败行为。

完成后可以新增一条更有区分度的并发与安全优化 Bullet。

## 九、最终复习顺序与自检

1. 先背 90 秒介绍与四条简历 Bullet。
2. 画 ReAct、Plan、Multi-Agent、工具和后台五条链路。
3. 复习 SSE / `tool_call_id`、Context / Memory / Skill、ToolRegistry / MCP。
4. 复习 Budget / Cancellation、安全纵深和两套 SQLite 机制。
5. 最后练 Failure Case、方案对比、评测集与三个一跳优化。

- 能完整画出 ReAct 一轮的 Message / Tool Call / Result 回填。
- 能解释 Plan、ReAct、Multi-Agent 如何组合，而不是互相替代。
- 能说明 ToolRegistry 当前全部并行的真实行为和风险。
- 能说明 Provider 子类架构，不再提不存在的 `SeriesQuirks`。
- 能解释 PathGuard、CommandGuard、HITL 各自不能解决什么。
- 能说明当前批量并行实现与副作用感知调度方案的区别。
- 能连续回答“为什么这样选、失败怎么办、如何验证”三个追问。
- 能讲一个选型、一个异常、一个验证和一个明确限制。
- 能区分当前 Worker 权限与最小权限方案、当前加载机制与 Freshness Guard。

## 相关链接

- [[SageCLI-02-高频追问卡]] — 当前安全口径下的 P0/P1 问题
- [[SageCLI-03-证据与事实边界]] — 简历冲突与个人补证计划
- [[SageCLI-03-证据与事实边界]] — 统一项目验收标准与个人证据边界
- [[00-项目总览与开场介绍]] — 完整架构历史笔记，仅作参考
