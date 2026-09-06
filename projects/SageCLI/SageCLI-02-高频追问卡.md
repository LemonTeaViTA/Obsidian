---
module: SageCLI
type: project
status: source-study
tags: [SageCLI, PaiCLI, 面试题, Agent, Tool-Calling, 安全]
last_reviewed: 2026-09-05
---

# SageCLI 高频追问卡

> [!tip] 出题依据
> 题目只从当前简历四条主线及其一跳追问产生：Agent 控制编排、流式 Tool Calling、上下文与工具扩展、安全与可靠性。项目其他模块继续完整学习，但不抢占正式面试主线。

## 零、分级与推荐顺序

| 顺序 | 级别 / 知识点 | 触发它的简历原句 | 源码入口 | 最容易答错 |
| ---: | --- | --- | --- | --- |
| 1 | P0-01 Agent Host | 项目定位“上下文组装、Tool Calling、工具执行、结果回填、多轮终止” | `Agent`、`ToolRegistry` | 只讲聊天或 Prompt，不讲 Host 的状态与副作用责任 |
| 2 | P0-02 三类控制路径 | “ReAct、Plan-and-Execute 与 Planner-Worker-Reviewer” | `Agent`、`PlanExecuteAgent`、`AgentOrchestrator` | 说成三选一，或把 Reviewer 拒绝说成 Plan 重规划 |
| 3 | P0-03 SSE / Tool Calling | “SSE 文本、Reasoning、分片 Tool Call 及 Token / Cache Usage” | `LlmClient`、`AbstractOpenAiCompatibleClient` | 收到半截 arguments 就解析执行，或虚构透明故障转移 |
| 4 | P0-04 并行与回填 | “同轮 Tool Call 批量并行、原序回填和超时取消” | `ToolRegistry.executeTools()`、`Agent` | 把原序当身份配对机制，或把读并行写串行说成当前实现 |
| 5 | P0-05 Context / Memory / Skill | “组合项目上下文、Memory 与按需加载的 Skill 指令” | Prompt、Memory、Skill 包 | 把长期 Memory 说成异步落盘，或把 Skill buffer 说成角色隔离 |
| 6 | P0-06 ToolRegistry / MCP | “统一文件、搜索、Shell、Web 及 MCP 动态工具” | `ToolRegistry`、`McpServerManager` | 把 MCP 当安全边界或自动保证外部结果正确 |
| 7 | P0-07 预算与安全 | “AgentBudget、取消上下文……Guard、HITL、AuditLog” | Budget、Runtime、Policy、HITL 包 | 把 Guard 说成 OS 沙箱，或忘记 HITL 默认关闭 |
| 8 | P0-08 SQLite 后台能力 | “后台 Agent Task 状态持久化及独立 Runtime Thread / Event 存储” | `DurableTaskManager`、`RuntimeThreadStore` | 把两套表说成一个带事件日志的任务系统 |
| 9 | P1-01 Plan 故障与 Replan | P0-02 的依赖、失败和计划过时一跳 | `Planner`、`ExecutionPlan`、`PlanExecuteAgent` | 声称未知依赖会报错或重规划最多两次 |
| 10 | P1-02 副作用调度 | P0-04 的并发写冲突一跳 | `ToolRegistry.executeTools()` | 把优化方案说成已实现 |
| 11 | P1-03 Worker 最小权限 | P0-02 / P0-06 的多 Agent 权限一跳 | `SubAgent.shouldUseTools()`、`AgentOrchestrator` | 声称所有角色都能调用完整工具，或当前已最小权限 |
| 12 | P1-04 Coding Agent 评测 | 四条 Bullet 的验证一跳 | 测试目录与可扩展 Trace | 把模型自评或“测试文件存在”当运行结果 |

## 一、P0：简历直接追问

### P0-01 请介绍一下 SageCLI，它和普通聊天应用有什么不同？

#### 面试官为什么问

检查能否先说清项目价值和 Agent Host 的职责。

#### 30 秒回答

SageCLI 是 Java 实现的终端编程 Agent。普通聊天应用主要生成文本，它还要把模型给出的 Tool Call 变成真实的文件、搜索、Shell、Web 或 MCP 操作，再把结果回填给模型继续决策。Host 负责上下文、协议、权限、执行状态和终止条件，模型主要负责选择下一步 Action，因此项目重点是可控执行而不只是 Prompt。

#### 展开要点

- 输入是任务，输出可能包括文本、文件修改和命令结果。
- 一轮由模型决策、工具执行和 Observation 回填组成。
- 复杂任务还能用 Plan 或 Multi-Agent 编排。

#### 自然追问

一次完整的 ReAct 循环是什么？

#### 回答边界

不要把“模型能调用工具”等同于任务一定成功，成功需要外部验证。

#### 证据

`Agent`、`ToolRegistry`、`AgentBudget`。

### P0-02 ReAct、Plan-and-Execute 和 Planner-Worker-Reviewer 如何组合？

#### 面试官为什么问

简历直接写了三类控制路径，需要说明状态和适用场景。

#### 30 秒回答

ReAct 负责根据最新 Observation 动态选择下一步，适合目标明确但执行过程需要反馈的任务；Plan-and-Execute 先生成带依赖的 Task，再分批执行当前可运行节点；Planner-Worker-Reviewer 在计划和执行之外加入角色分工与复核。它们可以分层组合：计划或步骤负责全局结构，每个 Task / Worker 内部仍通过工具循环执行。当前 Multi-Agent 的 Reviewer 拒绝会携带反馈重试；Plan 的重规划是另一条失败处理路径。

#### 展开要点

- Plan 提供全局可见性，但可能随新信息过时。
- Multi-Agent 提高分工能力，也增加通信和共享资源冲突。
- Reviewer 是质量门，不是事实正确性的绝对保证。

#### 自然追问

什么情况下直接 ReAct，什么情况下值得使用 Multi-Agent？

#### 回答边界

不要把三种模式说成互斥选项，也不要说复杂任务一定需要多 Agent。

#### 证据

`Agent`、`PlanExecuteAgent`、`AgentOrchestrator`。

### P0-03 流式 Tool Calling 是怎样解析和回填的？

#### 面试官为什么问

检查是否真正理解模型协议，而不仅知道 Function Calling 名称。

#### 30 秒回答

OpenAI 兼容接口通过 SSE 返回增量事件，文本、Reasoning 和 Tool Call 的名称或 arguments 都可能被拆到多个 chunk。客户端要按 choice 和 tool-call index 累积字段，流结束后再形成完整调用；Host 执行工具后，用原 `tool_call_id` 构造 Tool Message 回填会话。下一轮模型才能把 Observation 对应到正确 Action，同时 Usage 解析 input、output 和 cached token。

#### 展开要点

- 半截 JSON 不能在每个 SSE chunk 到达时直接执行。
- arguments 解析失败应成为可见错误，而不是静默丢弃。
- Usage 位置和缓存字段可能随 Provider 不同。

#### 自然追问

如果 SSE 中途断开，已经收到半个 Tool Call 怎么处理？

#### 回答边界

运行时模型选择存在，但不要扩展成当前具有透明自动故障转移。

#### 证据

`LlmClient`、`AbstractOpenAiCompatibleClient` 及流式 accumulator。

### P0-04 为什么工具并行完成后还要按原调用顺序回填？

#### 面试官为什么问

简历写了批量并行和原序回填，面试官会追问一致性。

#### 30 秒回答

并行可以降低多个独立 I/O 工具的总耗时，但完成顺序不稳定。正确配对主要依赖 `tool_call_id`，原序回填则让消息转录稳定，并兼容部分 Provider 对 Tool Message 排列的约束。当前实现按输入下标持有 Future，统一等待后按原顺序生成结果；超时或失败也必须返回对应调用的可见状态，让模型决定重试或换方案。

#### 展开要点

- ID 解决身份，顺序解决稳定性和协议兼容。
- 批量超时不能让已完成结果丢失身份。
- 当前同轮工具不区分读写副作用。

#### 自然追问

两个工具同时写同一个文件怎么办？

#### 回答边界

“读并行、写串行”是合理改进方案，不是当前调度器已有机制。

#### 证据

`ToolRegistry.executeTools()` 及其并行和顺序测试。

### P0-05 Project Context、Memory 和 Skill 有什么区别？

#### 面试官为什么问

简历写了多种上下文来源，需要说明生命周期和污染风险。

#### 30 秒回答

Project Context 从用户级和项目级 `PAI.md` 加载仓库规则，每个用户任务重建 system prompt 时会重新读取；Memory 的短期部分在内存，长期事实同步保存到 JSON，并按 global / 当前项目相关性注入；Skill 按 builtin、user、project 三层覆盖，启动只放索引，`load_skill` 把正文放入 buffer，在下一次 user message 前注入并 drain。三者来源、生命周期和加载时机不同。

#### 展开要点

- Memory 不是完整聊天记录，应保存稳定事实而不是临时噪声。
- 当前短期会话不会再作为“历史 Memory”重复注入。
- ReAct、Plan、Multi-Agent 在 Main wiring 中共享同一个 Skill buffer，尚无角色级隔离。
- 上下文越多不一定越好，会增加 Token 和指令冲突。

#### 自然追问

如果项目规则和 Skill 指令冲突，应该听谁的？

#### 回答边界

按系统设定的指令层级处理，不能让低优先级工具结果覆盖高优先级安全规则。

#### 证据

`PromptAssembler`、`ProjectMemoryLoader`、`MemoryManager`、`SkillRegistry`。

### P0-06 ToolRegistry 如何统一内置工具和 MCP 工具？

#### 面试官为什么问

检查工具抽象、动态扩展和安全边界。

#### 30 秒回答

ToolRegistry 向模型暴露统一的工具名称、描述和参数 Schema，并把调用路由到文件、搜索、Shell、Web 等内置实现；MCP Server 发现的工具也会转换为同一描述和执行入口。这样 Agent 控制循环不需要为每种工具改协议，但动态工具仍要经过参数校验、超时、HITL 和审计，不能因为走 MCP 就绕开本地安全策略。

#### 展开要点

- Schema 决定模型能看到什么参数和约束。
- 执行错误要转换成 Tool Result 回给模型。
- MCP 解决标准化接入，不自动保证数据准确和工具安全。

#### 自然追问

为什么不直接为每个外部服务写 HTTP 客户端？

#### 回答边界

MCP 的优势是 Agent 工具发现和协议统一，不应回答成 MCP 天生比 HTTP 更准确。

#### 证据

`ToolRegistry` 的内置注册和 MCP 动态注册入口。

### P0-07 怎样防止 Agent 失控循环或执行危险操作？

#### 面试官为什么问

简历直接写了预算、取消、Guard、HITL 和审计。

#### 30 秒回答

控制循环通过 AgentBudget 检查 Token、硬轮次和重复 Tool Call，并用 CancellationContext 让用户取消传播到模型和工具执行；默认 Token 硬预算近似无限，主要兜底是连续 3 轮精确重复和 50 轮。真实副作用采用纵深防御：PathGuard 约束文件路径，CommandGuard 拒绝明显危险命令，HITL 开启时审批高风险工具，AuditLog 记录 allow、deny 和 error。它们能降低风险但不是完整沙箱，Shell 仍需要容器、最小权限和环境变量隔离。

#### 展开要点

- 终止条件不能只依赖模型说“完成”。
- HITL 默认关闭；审批通过后仍可能被 PathGuard / CommandGuard 拒绝。
- 黑名单无法枚举所有间接 Shell 风险。
- 审计要包含调用、策略结果和错误原因。

#### 自然追问

PathGuard 为什么挡不住所有 Shell 风险？

#### 回答边界

不要声称 CommandGuard 等价于 OS 级隔离。

#### 证据

`AgentBudget`、`CancellationContext`、`PathGuard`、`CommandGuard`、`AuditLog`。

### P0-08 SQLite 后台 Agent Task 解决了什么问题？

#### 面试官为什么问

检查对长任务状态、恢复和事件持久化的理解。

#### 30 秒回答

这里有两套独立 SQLite 机制。`DurableTaskManager` 的 `runtime_tasks` 保存 prompt、状态、结果、错误和时间，由 Worker 执行，状态为 `enqueued -> running -> completed / failed / canceled`；`RuntimeThreadStore` 另存 thread 和 `thread.created`、`turn.started`、`message.delta`、`turn.completed / failed` 等事件，供本地 Runtime API 查询。前者没有事件表，后者也不负责 Durable Task 的领取与恢复。

#### 展开要点

- 进程重启会把所有 `running` Task 重置为 `enqueued`，可能重复已有副作用。
- 取消会更新状态并中断 Worker，但仍依赖任务协作响应中断。
- SQLite 适合单机持久化，多实例需更强协调机制。

#### 自然追问

进程在任务执行中崩溃，重启后怎么判断是否重跑？

#### 回答边界

按当前任务状态模型回答，未实现的 lease 或分布式锁作为改进方向。

#### 证据

`DurableTaskManager`、`RuntimeThreadStore`、`RuntimeApiServer` 和对应测试。

## 二、P1：一跳概念与场景追问

### P1-01 Plan 模式如何保证依赖正确，又怎样处理计划过时？

#### 面试官为什么问

从“有计划”继续追问 DAG 和 Replanning。

#### 30 秒回答

当前 Planner 两遍解析任务与依赖，`ExecutionPlan` 用拓扑排序拒绝环；执行器每轮只选择依赖已完成的可运行节点，独立节点才进入最多 4 个的并行批次。要注意不存在的依赖当前会被静默忽略；进度低于 50% 时遇到 Task 失败会递归调用 replan，但源码没有显式次数上限。更稳妥的方案应校验未知依赖，并给重规划次数、成本和已完成副作用设置边界。

#### 展开要点

- 计划执行前可以人工确认、修改或取消。
- 当前重规划会把原计划和失败原因交回 Planner，但不等于具备事务回滚。

#### 自然追问

怎样限制无限 Replanning？

#### 回答边界

不要声称当前“最多重规划两次”；也不要把建议的预算上限说成已经接入计划层。

#### 证据

`ExecutionPlan`、`PlanExecuteAgent`。

### P1-02 如何设计工具副作用感知调度？

#### 面试官为什么问

从当前全并行机制追问工程改进能力。

#### 30 秒回答

我会给工具描述增加 `READ / WRITE / EXECUTE` 及目标资源元数据，把调用序列切成连续只读批次和副作用屏障：只读批次并行，写和命令按输入顺序执行；不同资源的写是否并行要由显式冲突键决定。SubAgent 还应获取按角色裁剪的 ToolRegistry View，并用同文件双写、读后写、超时和取消场景做回归。

#### 展开要点

- 未声明副作用的动态工具默认按高风险处理。
- 文件路径只是冲突资源之一，命令可能影响整个工作区。

#### 自然追问

两个写操作目标不同就一定能并行吗？

#### 回答边界

这是当前实现的一跳优化方案，不回答成已完成特性。

#### 证据

当前 `ToolRegistry.executeTools()` 的全并行行为提供问题基线。

### P1-03 多 Agent 为什么需要角色级最小权限？

#### 面试官为什么问

从 Planner-Worker-Reviewer 继续追问权限和共享状态。

#### 30 秒回答

当前 `SubAgent.shouldUseTools()` 只向 Worker 暴露 Tool Schema，Planner 和 Reviewer 不调用工具；但 Worker 获得完整工具集，缺少任务级工具、路径和副作用裁剪，各角色还共享工作区、模型和 Skill buffer。优化时可用只读或受限 ToolRegistry View、任务级授权、Worktree 隔离和带 `agent_id` 的审计实现最小权限。

#### 展开要点

- 权限要按角色、任务和资源三层裁剪。
- Reviewer 的独立性还包括上下文与模型配置。

#### 自然追问

如果 Worker 临时需要新增权限怎么办？

#### 回答边界

通过显式授权或 HITL 升权，不默认共享所有工具。

#### 证据

`SubAgent.shouldUseTools()`、`AgentOrchestrator` 和 Main 的 Skill buffer wiring。

### P2 与 REF 查阅清单（完成 P1-04 后再看）

| 顺序 | 级别 / 知识点 | 触发来源 | 源码入口 | 最容易答错 |
| ---: | --- | --- | --- | --- |
| 13 | P2 SSE 与 WebSocket | P0-03 传输协议一跳 | `AbstractOpenAiCompatibleClient` | SSE 是单向 HTTP 流；不要把 Runtime Event 查询与模型流混为一谈 |
| 14 | P2 Java Future / interrupt | P0-04 / P0-07 | `ToolRegistry`、`CancellationContext` | `cancel(true)` 只是发中断，不保证副作用立即停止 |
| 15 | P2 DAG / 拓扑排序 | P0-02 | `ExecutionPlan` | 可运行不等于无依赖，而是依赖已完成 |
| 16 | P2 SQLite 状态机 | P0-08 | runtime task / api 包 | 单机持久化不自动提供 lease、幂等或多实例协调 |
| 17 | P2 Tool Calling / JSON Schema | P0-03 / P0-06 | LLM、MCP protocol 包 | Schema 暴露不等于运行时严格验证一切参数 |
| 18 | P2 MCP transport | P0-06 | MCP stdio / Streamable HTTP transport | MCP 标准化工具接入，不保证 Server 可用或安全 |
| 19 | P2 安全纵深 | P0-07 | policy、HITL 包 | PathGuard 只管文件工具；Shell 仍需 OS 隔离 |
| 20 | P2 Agent 评测 | P1-04 | `src/test`、任务 Trace | 测试用例数不是任务成功率，架构风险也不是线上事故 |
| 21 | REF 默认预算 | P0-07 | `AgentBudget` | 默认 Token 硬预算实际近似无限；主要兜底是 3 次精确重复与 50 轮 |
| 22 | REF 并发与超时参数 | P0-04 | `ToolRegistry` | 最多 4 并发、默认整批 90 秒；不是每工具独立 90 秒 |
| 23 | REF Worker / Reviewer 参数 | P0-02 | `AgentOrchestrator` | 最多 2 Worker；Reviewer 拒绝重试最多 2 次，失败语义另有边界 |
| 24 | REF Project Context 预算 | P0-05 | `ProjectMemoryLoader` | 24K 是字符预算，不是 Token 数 |
| 25 | REF Skill 加载 | P0-05 | `SkillRegistry`、`LoadSkillTool`、`SkillContextBuffer` | 三层覆盖与一次性 drain；不要背成所有角色独立 buffer |
| 26 | REF MCP 命名和状态 | P0-06 | `McpServerManager` | 名称为 `mcp__server__tool`；失败进入 ERROR，无自动重启 |
| 27 | REF HITL 默认值 | P0-07 | `Main`、`ApprovalPolicy` | CLI 默认关闭；开启后写、命令、创建、回滚和 MCP 才审批 |
| 28 | REF SQLite 表 | P0-08 | `DurableTaskManager`、`RuntimeThreadStore` | `runtime_tasks` 与 `runtime_threads / runtime_events` 属于两套链路 |

### P1-04 你会怎样评估一个 Coding Agent？

#### 面试官为什么问

把架构描述落到可重复验证。

#### 30 秒回答

我会建立固定任务集，用测试结果、文件 Diff 或外部 Verifier 判定成功，记录任务成功率、工具调用成功率、无效调用、策略拒绝、人工接管、轮次、延迟和 Token；安全集单独覆盖路径逃逸、危险命令、并发写冲突和取消。每次模型或 Harness 改动都跑同一版本任务集并保存 Trace，不能依赖模型自评“已经完成”。

#### 展开要点

- 区分模型决策、协议、工具和环境失败。
- 简单任务与复杂计划任务分层统计。

#### 自然追问

没有 SWE-bench 环境如何做最小评测？

#### 回答边界

先做 10-20 个固定本地任务，不编造大规模结论。

#### 证据

项目现有测试结构和可扩展的任务 Trace。

## 三、P2 / REF 使用原则

上表只用于补基础和查源码参数，不新增正式面试主问题；先完成 8 个 P0 和 4 个 P1，再按推荐顺序选择性复习。

## 相关链接

- [[SageCLI-01-项目主卡]] — 完整能力地图与核心链路
- [[SageCLI-03-证据与事实边界]] — 当前实现与改进方案核对
- [[SageCLI-03-证据与事实边界]] — 简历一跳出题规范与事实边界
