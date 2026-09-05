---
module: SageCLI
type: project
tags: [SageCLI, PaiCLI, 简历验收, 技术核对, Agent, Tool-Calling]
last_reviewed: 2026-09-05
---

# SageCLI 当前实现与简历核对

> [!tip] 结论：strong fit
> 收紧后的简历四条内容均能映射到当前源码中的真实模块。本文只负责区分“当前机制、可选优化和结果结论”，不把代码仓库来源作为正式面试题，也不限制完整项目学习。

## 一、使用方式

```text
完整代码库
→ 选择最有岗位价值的四条简历主线
→ 核对当前机制与异常分支
→ 从简历生成直接题和一跳题
```

- 项目中的 Runtime API、代码检索、浏览器、微信端、Provider 等模块继续学习。
- 高频题只围绕当前简历，避免把所有源码模块都做成面试问题。
- 优化方案可以深入讨论，但回答时要先说当前行为，再说怎样改。

## 二、新简历逐 Bullet 核对

### Bullet 1：Agent 控制与任务编排

> 梳理 ReAct、Plan-and-Execute 与 Planner-Worker-Reviewer 三类控制路径；Plan 模式以任务依赖推进可运行节点，Multi-Agent 对独立步骤并行执行，并在 Reviewer 拒绝后携带反馈重试。

| 核对项 | 当前实现 |
| --- | --- |
| ReAct | `Agent` 组装消息、调用模型、执行 Tool Call、回填结果并迭代 |
| Plan | `Planner` 生成 Task 与 dependency，`PlanExecuteAgent` 选择可运行节点 |
| 并行 | Plan 独立节点使用有限线程批量执行 |
| Multi-Agent | `AgentOrchestrator` 组织 Planner、Worker 和 Reviewer |
| Review | Reviewer 拒绝时把反馈带回 Worker，并受重试上限约束 |
| 面试主问题 | 三种模式怎样组合、计划怎样推进依赖、什么时候需要 Replan |

**核对结论：**与当前实现一致。Plan 环依赖会被拒绝，但未知依赖会静默忽略，早期失败重规划没有显式次数上限；Multi-Agent 中 Reviewer 调用失败会 fail-open，明确拒绝重试耗尽后仍保留最后结果并标记完成。不要扩展成“已经完整解决 Replanning 和多 Agent 写冲突”。

### Bullet 2：模型与 Tool Calling 协议

> 分析统一 `LlmClient` 对 OpenAI 兼容模型的适配，覆盖 SSE 文本、Reasoning、分片 Tool Call 及 Token / Cache Usage 解析；通过 `tool_call_id` 将工具结果稳定回填会话，支持运行时模型选择。

| 核对项 | 当前实现 |
| --- | --- |
| 统一接口 | `LlmClient` 描述模型请求、流式响应、Tool Call 与 Usage |
| SSE | `AbstractOpenAiCompatibleClient` 解析增量事件 |
| Tool Call | 名称和 arguments 可跨 chunk 累积，结束后形成完整调用 |
| Usage | 解析 input、output 与 cached token |
| 结果回填 | Tool Message 使用原 `tool_call_id` 对应模型调用 |
| 模型选择 | 支持配置与运行时选择 Provider / Model |
| 面试主问题 | 半截 JSON 怎样处理、SSE 断开怎么办、ID 与顺序分别解决什么 |

**核对结论：**与当前实现一致。当前不把透明自动故障转移和不存在的差异注册表写入简历。

### Bullet 3：上下文与工具扩展

> 组合项目上下文、Memory 与按需加载的 Skill 指令，通过 `ToolRegistry` 统一文件、搜索、Shell、Web 及 MCP 动态工具；分析同轮 Tool Call 批量并行、原序回填和超时取消机制。

| 核对项 | 当前实现 |
| --- | --- |
| Project Context | `PromptAssembler`、`ProjectMemoryLoader` 装配项目规则和上下文 |
| Memory | 短期状态在内存；长期事实按作用域同步保存到 JSON |
| Skill | `SkillRegistry` 提供三层覆盖索引，`load_skill` 加载正文后由 buffer 一次性注入 |
| 内置工具 | 文件、搜索、Shell、Web、Memory 和 Skill 等注册到 `ToolRegistry` |
| MCP | 外部工具转换成统一描述和执行入口 |
| 并发 | 同轮 Tool Call 进入固定线程池，最后按输入下标组织结果 |
| 面试主问题 | 三种上下文的生命周期、MCP 价值、并行完成后的协议一致性 |

**核对结论：**与当前实现一致。当前调度器不区分读写副作用，三条控制路径在 Main wiring 中还共享同一个 Skill buffer；必须把“批量并行”与“副作用感知调度”、当前共享 buffer 与角色隔离方案区分开。

### Bullet 4：执行安全与可靠性

> 分析 `AgentBudget`、取消上下文和重复调用检测的循环治理，以及 `PathGuard`、`CommandGuard`、HITL、AuditLog 组成的执行安全边界；复现 SQLite 后台 Agent Task 状态持久化及独立 Runtime Thread / Event 存储链路。

| 核对项 | 当前实现 |
| --- | --- |
| 循环治理 | Token、硬轮次和重复 Tool Call 预算 |
| 取消 | `CancellationContext` 将取消传播到执行路径 |
| 路径防护 | `PathGuard` 处理绝对路径、`..`、符号链接与未创建目标 |
| 命令防护 | `CommandGuard` 拒绝明显危险模式 |
| 人工审批 | 高风险操作进入 HITL |
| 审计 | `AuditLog` 记录 allow、deny 和 error |
| Durable Task | `runtime_tasks` 保存任务状态、结果与错误；重启时 `running` 重置为 `enqueued` |
| Runtime API | 独立的 `runtime_threads` / `runtime_events` 保存 Thread 与 Turn 事件 |
| 面试主问题 | 黑名单为何不是沙箱、取消竞态、任务崩溃恢复 |

**核对结论：**收紧简历后与当前实现一致。HITL 在 CLI 默认关闭；两套 SQLite 机制不能回答成一个“带事件日志的后台任务系统”，也都不是完整后台 Shell 进程管理。

## 三、当前实现证据入口

| 能力 | 主要入口 | 核对重点 |
| --- | --- | --- |
| ReAct | `src/main/java/com/paicli/agent/Agent.java` | 一轮消息和 Tool Result 状态流 |
| Plan | `Planner`、`ExecutionPlan`、`PlanExecuteAgent` | dependency、可运行节点和 Review |
| Multi-Agent | `AgentOrchestrator`、`SubAgent` | 角色、并行、Reviewer 反馈重试 |
| 模型协议 | `LlmClient`、`AbstractOpenAiCompatibleClient` | SSE、Tool Call accumulator、Usage |
| 上下文 | Prompt、Memory、Skill 包 | 来源、作用域和按需加载 |
| 工具 | `ToolRegistry.executeTools()` | 并行、超时、原序结果和 MCP 动态注册 |
| 安全 | policy、HITL、Audit 包 | 每层能防什么、不能防什么 |
| 后台任务 | `runtime/task` 与 `runtime/api` 包 | 两套 SQLite 状态、事件与恢复边界 |

## 四、核心模块审计矩阵

| 模块 | 问题 / 输入 / 输出 | 状态与正常链路 | 失败、取舍与限制 | 验证入口 |
| --- | --- | --- | --- | --- |
| ReAct | 用户任务 -> 文本或工具副作用 | 会话、Budget、取消令牌；模型 -> 工具 -> Result -> 再调用 | 灵活但全局计划弱；预算、取消、协议或工具失败退出 | `Agent`、`AgentBudgetTest` |
| Plan | 目标 -> Task 状态与汇总 | `ExecutionPlan`；解析依赖 -> 可运行批次 -> 更新 -> Review | DAG 易解释；未知依赖静默忽略，早期失败重规划无显式上限 | `ExecutionPlanTest`、`PlannerTest`、`PlanExecuteAgentTest` |
| Multi-Agent | 计划步骤 -> Reviewer 后的聚合结果 | Step、Worker 池、issues；独立步骤最多 2 个并行 | 分工换来通信和共享状态风险；Reviewer fail-open 或耗尽仍完成 | `AgentOrchestratorTest`、`SubAgentTest` |
| SSE / LLM | Message + Schema -> content / reasoning / calls / usage | 按 tool-call index 累积 id、name、arguments | 流断、缺 ID、非法 JSON；公共基类降低重复但 Provider 差异仍靠子类 | LLM image/reasoning/error 测试；分片 arguments 专测缺口 |
| Context | 项目路径 -> system prompt | 用户级和多层项目 `PAI.md`，24K 字符预算 | 深度、环、根目录和长度受控；无读后写 freshness 校验 | `ProjectMemoryLoaderTest`、`PromptAssemblerTest` |
| Memory | 任务事实 -> 相关长期上下文 | 短期内存、长期 JSON 同步落盘 | 简单可查，但并非 write-behind；只注入 global 与当前项目长期事实 | Memory 系列测试 |
| Skill | 索引 / 名称 -> 一次性任务指令 | builtin < user < project；正文约 5KB 进入共享 buffer 后 drain | 节省 Prompt，但当前角色级 buffer 隔离未实现 | Skill 系列测试 |
| Tool / MCP | Schema + arguments -> Tool Result | 内置和 `mcp__server__tool` 进入统一 Registry | MCP Server 失败进入 ERROR、无自动重启；外部副作用未知 | `ToolRegistryTest`、MCP 系列测试 |
| Budget / Cancel | Usage、调用签名、用户中断 -> 终止原因 | 默认 3 次完全相同调用、50 轮；全局引用 + `InheritableThreadLocal` | 检测不了交替/语义循环；中断不保证立即停止阻塞工具 | `AgentBudgetTest`、`CancellationContextTest` |
| Guard / HITL / Audit | 路径、命令、危险调用 -> allow / deny / error | 危险调用先可选 HITL，批准后仍进参数 / Guard -> 执行 -> Audit | HITL 默认关闭；非法参数可能先审批；Shell 不受 PathGuard 文件围栏；allow 不等于业务成功 | Policy、HITL、Audit 测试 |
| SQLite 后台能力 | Prompt / Turn -> Task 状态或 Event | Durable Task 与 Runtime API 各用独立表 | running 恢复可重复副作用；无 lease、幂等键或分布式协调 | `DurableTaskManagerTest`、`RuntimeApiServerTest` |

每个模块的替代方案应从问题出发：ReAct 可换显式 Plan，内置客户端可换 MCP，SSE 可在需要双向低延迟会话时换 WebSocket，SQLite 可在多实例领取场景换带 lease 的队列或数据库。替代不是天然升级，需要承担计划漂移、外部 Server 运维、长连接状态或分布式协调成本。

## 五、关键技术对比

| 对比 | 分别解决什么 | 当前为什么这样选 | 何时换另一种 | 成本与风险 |
| --- | --- | --- | --- | --- |
| Agent Host vs 聊天应用 | 受控执行 vs 文本生成 | Coding 任务需要工具、状态、权限和终止 | 只需问答时无需 Host 复杂度 | Host 引入副作用、恢复和安全责任 |
| ReAct vs Plan | 局部反馈决策 vs 全局依赖 | 两者分层复用，Task 内仍可工具循环 | 简单任务用 ReAct；稳定多步依赖用 Plan | 前者易循环，后者会计划漂移 |
| Plan vs Multi-Agent | Task DAG vs 角色分工与复核 | 需要独立步骤并行和 Reviewer 时用后者 | 不需角色隔离时优先 Plan | Multi-Agent 增加调用成本与共享状态冲突 |
| 同轮批量并行 vs 副作用调度 | 降低等待 vs 保证写顺序 | 当前实现简单且保持原序结果 | 有写、命令或未知 MCP 副作用时应切换 | 全并行会冲突；保守串行损失性能 |
| 内置工具 vs MCP | 本地深度集成 vs 标准化外部扩展 | 二者统一进入 ToolRegistry | 外部生态变化快用 MCP，强控制场景用内置 | MCP 多一层协议、Server 与 Schema 风险 |
| Context vs Memory vs Skill | 仓库规则 vs 稳定事实 vs 任务指令 | 按生命周期拆分，避免全量塞 Prompt | 规则变化、事实复用、流程复用分别选择 | 优先级冲突、污染和 Token 成本 |
| SSE vs WebSocket | 服务端流式响应 vs 全双工会话 | 模型响应以单向增量为主 | 高频双向事件或实时协同时用 WebSocket | SSE 简单；WebSocket 连接状态更复杂 |
| 超时 vs 取消 vs 预算 | 时间边界 vs 用户意图 vs 成本/循环边界 | 三者覆盖不同终止原因 | 不能互相替代 | 都依赖下游协作，终止不等于副作用回滚 |
| Guard / HITL / Audit vs OS 沙箱 | 应用策略与追责 vs 进程级隔离 | 当前先做应用层纵深 | 执行不可信 Shell 时必须补容器/权限隔离 | 黑名单可绕过；沙箱运维和兼容成本高 |
| 前台会话 vs SQLite 后台能力 | 当前交互状态 vs 跨连接可查询状态 | 本地单机用 SQLite 足够轻量 | 多实例、长租约或幂等要求高时换协调存储 | 恢复可能重复执行，两套状态可能漂移 |
| 精确重复检测 vs 语义循环检测 | 低成本拦截同调用 vs 识别停滞模式 | 当前签名法确定且便宜 | A/B 交替、参数微调时需窗口/进展判定 | 语义判定有误杀、额外 Token 和状态成本 |
| 当前 Worker 权限 vs 最小权限 | 完整执行能力 vs 限制爆炸半径 | 当前仅 Worker 拿工具但未任务裁剪 | 多 Worker 并行或不可信任务必须裁剪 | 授权流程、Registry View 与环境隔离更复杂 |
| 当前重载 vs Freshness Guard | 每任务重读规则 vs 写前检测内容变化 | 当前实现简单，尚无版本校验 | 长任务和协作编辑时加入 hash/version token | 需处理冲突、ABA 和重新规划 |

## 六、一跳优化方案

这些内容都值得学习，也可以作为场景题回答，但不替换当前机制。

### 工具副作用感知调度

- 为工具声明 `READ / WRITE / EXECUTE` 和冲突资源。
- 连续只读批次并行，写和命令设置顺序屏障。
- 未声明副作用的 MCP 动态工具默认按高风险处理。
- 用同文件双写、读后写、命令、超时和取消做回归。

### Multi-Agent 最小权限

- 保持 Planner / Reviewer 当前无工具调用，Worker 改为按任务获得工具、路径和副作用能力。
- 使用 ToolRegistry View、路径范围、Worktree 或资源锁隔离。
- 审计增加 agent_id、tool_call_id 和目标资源。

### 文件 Freshness Guard

- 读取时保存规范路径、内容 Hash 或版本 Token。
- 写入前再次校验，冲突时要求重读并重新生成 Patch。
- 覆盖用户中途修改、删除、符号链接变化和 ABA 场景。

## 七、Failure Case 与验证设计

以下都是测试覆盖或由当前代码分支直接推导的风险，不冒充线上事故。

### FC-01 SSE Tool Call 分片、断流或缺 ID

- **现象：**arguments 只收到半段、最终 JSON 非法，或调用未进入工具执行。
- **根因：**SSE 可把名称和 arguments 拆到多个 delta；网络会中途断开；最终构建会跳过无 ID 的调用。
- **当前处理：**按 tool-call index 累积字段，流结束后组装；流错误和空响应可见报错。
- **如何定位：**保存脱敏 SSE Trace，检查 index、id、arguments 累积值和终止事件。
- **如何验证：**Mock Server 把一个 arguments JSON 拆成多个 chunk，再覆盖断流、乱序 index、缺 ID 和非法 JSON。
- **残余风险：**现有测试覆盖 Reasoning、空响应和错误 chunk，但未看到 arguments 分片的专门回归。
- **重新设计：**为 accumulator 建协议状态机和完整性校验，缺字段返回显式协议错误而非静默跳过。

### FC-02 `tool_call_id` 或原序回填错误

- **现象：**模型下一轮无法识别某个 Tool Result，Provider 拒绝消息，或 Trace 难以复现。
- **根因：**并发执行完成顺序不稳定；构造 Tool Message 时误用 ID 或按完成顺序写回。
- **当前处理：**Future 与输入同下标，结果按原调用顺序返回；Tool Message 携带原 `tool_call_id`。
- **如何定位：**对照 assistant tool calls 与后续 Tool Message 的 ID 集合、数量和排列。
- **如何验证：**让两个测试工具以相反顺序完成，断言输出仍按输入排序且 ID 一一配对。
- **残余风险：**ID 决定身份，原序主要保证稳定性和兼容性；不能声称换序必然把 A 认成 B。
- **重新设计：**以 ID Map 做身份校验、以原始调用序列做稳定输出，并拒绝缺失、重复或多余 Result。

### FC-03 同轮并行写冲突

- **现象：**两个文件写或命令相互覆盖，最终状态随调度变化。
- **根因：**`executeTools()` 对同轮所有工具一视同仁并发，没有副作用标签或资源冲突键。
- **当前处理：**最多 4 并发、整批超时、结果原序回填；这些机制不解决写冲突。
- **如何定位：**结合 tool_call_id、目标资源、AuditLog 和最终 Diff 重放同轮调用。
- **如何验证：**固定同文件双写、读后写、命令修改同一资源三个用例，多次运行比较最终状态。
- **残余风险：**不同路径也可能通过 Shell、符号链接或外部服务指向同一资源。
- **重新设计：**工具声明 `READ / WRITE / EXECUTE` 与冲突键，只读批次并行，副作用调用建立屏障。

### FC-04 超时或取消后副作用继续

- **现象：**Host 已返回超时 / 取消，但文件、进程或远端操作稍后仍发生变化。
- **根因：**`invokeAll` 超时、`cancel(true)` 和 `shutdownNow()` 只发中断；不协作响应的工具不会被强制回滚。
- **当前处理：**批次默认 90 秒并取消 Future；Shell 工具有独立 60 秒超时并 `destroyForcibly`。
- **如何定位：**检查取消时间、线程状态、子进程和取消后 Audit / 文件时间线。
- **如何验证：**构造忽略中断的测试工具和长 Shell，断言 Host 返回时间，并继续观察副作用窗口。
- **残余风险：**外部 HTTP / MCP 请求可能已经在服务端提交，停止本地线程不等于撤销远端动作。
- **重新设计：**传递 deadline / cancellation token，工具实现协作取消；副作用操作增加幂等键、补偿或事务边界。

### FC-05 Plan 非法依赖或无限重规划

- **现象：**计划看似可执行却遗漏约束、无可运行节点，或早期失败反复递归规划。
- **根因：**环会被拓扑检查拒绝，但未知依赖当前被静默忽略；低于 50% 的失败重规划没有显式上限。
- **当前处理：**环返回非法计划；批次失败更新状态；无可运行节点时返回依赖未满足。
- **如何定位：**打印规范化 Task ID、依赖边、状态变更、进度和 replan 次数。
- **如何验证：**覆盖环、未知 ID、失败依赖、零可运行节点和 Planner 持续生成失败计划。
- **残余风险：**已完成步骤的真实副作用不会随 replan 自动回滚。
- **重新设计：**严格拒绝未知依赖，增加 replan / Token / 时间预算，并显式复用或补偿已完成步骤。

### FC-06 Reviewer 拒绝或服务失败

- **现象：**Reviewer 连续拒绝后步骤仍显示完成；Reviewer 调用异常时未经审核的结果被保留。
- **根因：**拒绝反馈最多重试 2 次，耗尽后仍标记 `COMPLETED`；Reviewer LLM 异常采用 fail-open。
- **当前处理：**解析拒绝 issues 并携带反馈重试；解析失败默认拒绝，调用失败则保留 Worker 结果。
- **如何定位：**检查每轮 review 原文、解析结果、issues、重试计数和最终 StepStatus。
- **如何验证：**Stub Reviewer 为持续拒绝、非法 JSON、先拒后批、直接抛错四种行为。
- **残余风险：**最终“完成”不等于通过质量门，聚合结果可能隐藏降级。
- **重新设计：**区分 `COMPLETED_APPROVED / COMPLETED_UNREVIEWED / REVIEW_EXHAUSTED`，并按任务风险选择 fail-open 或 fail-closed。

### FC-07 精确重复检测漏掉语义循环

- **现象：**Agent 在 A/B 两组调用间来回切换，或只微调参数却没有任务进展。
- **根因：**当前仅比较整轮“工具名 + 参数”精确签名，连续 3 次完全相同才判停滞。
- **当前处理：**精确重复和 50 轮硬上限兜底；默认 Token 硬预算近似无限。
- **如何定位：**查看最近调用签名、工具输出摘要、文件 Diff 和每轮进展信号。
- **如何验证：**覆盖完全重复、A/B 交替、参数微调和持续无 Diff 四类序列。
- **残余风险：**合法轮询可能被误判，语义循环也可能拖到硬轮次才结束。
- **重新设计：**滑动窗口检测调用图、Observation 相似度与外部进展，同时为轮询工具声明豁免和等待策略。

### FC-08 SQLite 恢复造成重复副作用

- **现象：**进程崩溃后同一 Agent Task 被重跑，已有文件或外部操作执行两次。
- **根因：**启动恢复把所有 `running` 无条件更新为 `enqueued`，没有 lease、幂等键或副作用提交记录。
- **当前处理：**任务重新进入 Worker 队列；取消则写 `canceled` 并中断本机 Worker。
- **如何定位：**比对 Task ID、状态时间、进程重启点、AuditLog 与外部资源版本。
- **如何验证：**测试已覆盖 `running -> enqueued`；再做执行中崩溃并观察副作用是否重复的故障注入。
- **残余风险：**SQLite Task 表与独立 Runtime Event 表之间没有统一事务或恢复协议。
- **重新设计：**引入 lease / heartbeat、幂等执行键、步骤 checkpoint 和副作用提交日志；多实例时换支持原子领取的协调存储。

## 八、结果声明门槛

| 结果说法 | 当前状态 | 使用条件 |
| --- | --- | --- |
| 任务成功率提升 | 暂无固定任务集结果 | 固定任务、成功判定、基线和 Trace |
| 并行降低耗时 | 机制上合理，暂无正式对比 | 独立只读任务的串并行延迟对比 |
| 安全风险显著下降 | 暂无量化结果 | 攻击样例集、策略命中和绕过分析 |
| 支持生产级多 Agent | 当前不使用 | 多租户隔离、恢复、观测和规模验证 |

### 2026-08-12 本轮验证记录

- 聚焦集合显式使用 `-DskipTests=false`：239 个测试通过，0 失败、0 错误、0 跳过；覆盖 Plan / Multi-Agent、LLM 流错误、工具并发与原序、Context / Memory / Skill、MCP、Budget / Cancellation、Guard / HITL / Audit 和两套 SQLite。
- 全量单测：783 个中 781 通过、2 个失败、0 跳过。失败均来自 `CodeIndexTest`，默认 `EmbeddingClient` 依赖本机 Ollama，而 `127.0.0.1:11434` 当前不可连接；索引器将 embedding 异常降级后返回 0 个块，属于环境依赖与测试未隔离外部服务，不是本轮文档修改引入。
- 当前仍缺 SSE arguments 跨 chunk 的专门协议测试，以及 ReAct 中 `assistant tool call -> tool_call_id 对应 Tool Message -> 下一轮` 的直接断言；已有相关链路和局部测试不应冒充这两个点已被精准覆盖。

## 九、历史材料审计与面试前核对

- **内容缺失：**原三卡缺五条完整链路、分级总表、两套 SQLite 边界和成体系的 Failure Case。
- **重复：**三卡都重复解释 Tool Calling 与安全层，但缺少“主卡讲全景、题卡讲回答、证据卡讲边界”的职责分离。
- **偏离简历：**旧专题把多模型注册表、故障转移、会话恢复等历史说法放在开场，最终简历并未触发或源码不存在。
- **技术不准确：**不存在 `SeriesQuirks` / 透明 Fallback；长期 Memory 不是 write-behind；Plan 重规划不是最多 2 次；并非所有 SubAgent 都能调工具。
- **实现 / 优化混淆：**读并行写串行、Worker 最小权限、Freshness Guard 都是方案，不是当前完成态。
- **证据边界：**测试类存在只证明有验证入口；本轮运行结果应单独记录，架构推导风险不能说成线上事故。

- 能在白板上画出 ReAct 一轮和 Plan 任务推进。
- 能解释 Tool Call 分片累积、ID 配对和原序回填。
- 能区分 Project Context、Memory 与 Skill。
- 能解释内置工具和 MCP 工具如何统一，又为何都需要安全控制。
- 能说明当前同轮全并行的风险，并给出副作用调度方案。
- 能解释 Guard、HITL、Audit 和 OS 沙箱的边界。
- 不使用旧简历中已经移除的类名和机制。

## 相关链接

- [[SageCLI-01-项目主卡]] — 项目全景与完整能力地图
- [[SageCLI-02-高频追问卡]] — 新简历的八个 P0 与四个 P1
- [[SageCLI-02-高频追问卡]] — 完整学习与简历一跳出题规范
- [[13-源码索引]] — 源码定位入口
