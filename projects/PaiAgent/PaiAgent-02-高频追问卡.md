---
module: PaiAgent
type: project
tags: [PaiAgent, Agent, Workflow, ReAct, 面试题, 源码研习]
last_reviewed: 2026-09-05
---

# PaiAgent 高频追问卡

> [!tip] 使用方式
> 按 P0 顺序突击。每题先独立说 30 秒，再看参考答案；能连续承受两个自然追问才算通过。所有回答都以静态源码分析为边界。

## 一、题目索引

| 顺序 | 级别 | 主题 | 最容易答错 |
| ---: | --- | --- | --- |
| 1 | P0-01 | 项目全景 | 把工作流平台说成一个大 Agent |
| 2 | P0-02 | 保存与执行 | 只讲 ReactFlow，不讲后端定义和引擎 |
| 3 | P0-03 | DAG | 声称拓扑无依赖节点会自动并行 |
| 4 | P0-04 | 输入与条件 | 忽略多前驱字段覆盖和汇合点规则 |
| 5 | P0-05 | ReAct | 误说成原生 Function Calling 或无限循环 |
| 6 | P0-06 | Tool | 把 UI 勾选当后端强白名单 |
| 7 | P0-07 | Context | 混淆 Memory、Knowledge、Skill |
| 8 | P0-08 | 状态与恢复 | 把 SSE 当持久状态，或说 LangGraph 可恢复 |
| 9 | P1-01 | 双引擎 | 用框架名称代替当前代码能力 |
| 10 | P1-02 | 安全 | 忽略 Web Fetch SSRF 与 Tool 越权风险 |
| 11 | P1-03 | 可扩展性 | 只说工厂模式，不讲契约与前后端同步 |
| 12 | P1-04 | 验证设计 | 把“代码存在”说成“功能已验证” |

## 二、P0：必须会答

### P0-01 请从全景介绍 PaiAgent，它和普通聊天应用有什么不同？

#### 30 秒参考答案

PaiAgent 是可视化 AI 工作流平台。前端用 ReactFlow 编辑节点和边，后端保存工作流定义，由 DAG 或 LangGraph 引擎调度，再通过节点执行器接入 LLM、ReAct、Knowledge、Memory 和 MCP。普通聊天主要生成文本，这个平台还要管理图结构、节点输入输出、执行记录、实时事件和恢复。工作流决定节点怎么走，ReAct Agent 只在一个节点内部动态选择工具，因此不能把整个工作流自动等同于 Agent。

#### 自然追问

为什么一个带 LLM 节点的 DAG 不一定是 Agent？

#### 回答边界

只说源码研习，不说本人设计或上线。

### P0-02 从画布保存到后端执行，完整链路是什么？

#### 30 秒参考答案

编辑阶段，Zustand 保存 ReactFlow 的节点和边；保存时将真实节点类型从 `data.type` 序列化出来，形成 `flowData` JSON，并连同 `engineType` 调用工作流 API。后端把它保存到 `workflow` 表。执行时根据 ID 读取定义，`EngineSelector` 选择引擎，`WorkflowConfigParser` 还原节点和边，再由 DAG 或 LangGraph 引擎交给 `NodeExecutorFactory` 分发具体节点执行器。

#### 自然追问

为什么前端节点 `type` 和后端节点类型不是一直相同？

#### 强回答补充

ReactFlow 需要统一的渲染组件类型 `workflow`，业务类型放在 `data.type`；保存和后端解析都有兼容逻辑，避免展示层类型污染业务执行类型。

### P0-03 DAG 引擎怎样保证顺序？它会并行吗？

#### 30 秒参考答案

`DAGParser` 先用 DFS 检测环，再用 Kahn 算法按入度生成拓扑序，保证每个节点在前驱之后出现。当前执行器随后用普通 `for` 循环按拓扑序逐个执行，所以即使两个节点互不依赖，也没有自动并行。若要并行，需要维护入度、就绪队列、线程池、节点完成回调和共享状态并发安全，不能只靠拓扑排序。

#### 自然追问

为什么不能把拓扑序直接切成多个线程跑？

#### 回答要点

- 并行必须尊重依赖完成时机。
- 多前驱合并要等所有需要的输入。
- 条件分支会动态标记跳过集合。
- 快照和 SSE 事件也需要定义一致顺序。

### P0-04 节点输入怎样传播？条件分支如何跳过？

#### 30 秒参考答案

无入边节点使用全局输入；有入边节点读取各前驱的 `nodeOutputs` 并合并成 Map。Condition 节点输出一个运行时字段 `__selectedBranch__`，引擎按边上的 `sourceHandle` 区分活跃和非活跃目标，再递归标记不可达下游。汇合点只有在所有入边来源都已跳过时才跳过，仍有活跃路径时会保留。

#### 自然追问

多个前驱输出同名字段怎么办？

#### 强回答补充

当前是依次 `putAll`，后写覆盖前写，缺少显式端口映射和冲突检测。这是实现边界；可改为命名空间、边映射表达式或编译期 Schema 校验。

### P0-05 一轮 ReAct 到底发生了什么？怎样停止？

#### 30 秒参考答案

执行器先构建目标 Prompt、工具描述和 JSON 输出协议。每一轮把原目标、当前输入和历史 Trace 发给模型；模型只能返回 `tool_call` 或 `final_answer`。前者由 Host 执行一个工具，把 Observation 写入 Trace 后进入下一轮；后者直接结束。默认最多 5 步、允许配置 1 到 20 步；非法 JSON 会按普通最终内容降级，工具异常会成为可恢复 Observation，达到步数上限则返回明确停止原因。

#### 自然追问

这和模型原生 Function Calling 有什么区别？

#### 强回答补充

这里是 Prompt 约束的 JSON 决策协议，Host 自己解析文本并调工具；没有使用 Provider 返回的结构化 Tool Call。优点是供应商适配简单，缺点是 Schema 约束、解析可靠性和工具授权需要 Host 自己保证。

### P0-06 AgentToolRegistry 如何扩展工具？当前授权边界可靠吗？

#### 30 秒参考答案

每个工具实现统一接口，声明 name、description、inputSchema 和 execute；Spring 注入所有实现后，Registry 按名称注册，ReAct 把选中工具的描述写入 System Prompt。新增工具主要是实现接口并注册组件。但当前白名单不完整：空选择会返回全部工具，而且执行模型请求时直接从全局 Registry 取工具，没有再次检查是否属于本节点候选集合，所以不能把 UI 勾选说成后端强授权。

#### 自然追问

怎样做最小修改修复？

#### 强回答补充

把空选择定义为拒绝或显式默认集；执行前用本轮 `availableTools` 建 Map，只允许从局部 Map 取工具。若工具有不同风险，再增加 per-tool policy 和审计，而不是扩大成完整权限平台。

### P0-07 Memory、Knowledge、Skill、MCP 有什么区别？

#### 30 秒参考答案

Memory 保存偏好、背景和稳定结论，面向跨轮复用；Knowledge 保存文档 Chunk，面向基于问题检索证据；Skill 是指导模型如何完成某类任务的 Markdown 指令；MCP 是外部工具调用协议。当前普通 LLM 会自动召回 Memory 和 Knowledge，并把 Skill 主指南与全部 references 注入。ReAct 执行器支持用工具按需获取上下文，但 UI 会过滤 `memory_retrieve`，也不暴露 Skill 加载工具，所以配置链还没闭合。Memory 实际是进程内 List，Knowledge 在 MySQL 中候选全扫后由 Java 计算分数，MCP 运行时只真正接通 web_search。

#### 自然追问

为什么不能只看到 `load_skill_reference` 类存在，就说渐进式 Skill 链路已完整可用？

#### 回答边界

不能说所有能力都是向量数据库，也不能把 Schema 里的 Memory 表当已接入持久化。

### P0-08 `execution_record`、snapshot、variable 和 SSE 分别是什么？

#### 30 秒参考答案

`execution_record` 保存一次完整运行；DAG 每执行一个节点还更新 `execution_snapshot`，保存节点输入、输出、状态和重试次数；恢复请求中的人工覆盖项写入 `execution_variable`。SSE 是把开始、进度、成功、失败和完成事件实时推给前端，只负责通知。恢复时 DAG 读取旧快照，找失败或未完成节点，恢复此前成功节点输出，再从起点继续；LangGraph 引擎当前不支持这个恢复接口。

#### 自然追问

恢复时修改变量会如何影响下游？

#### 强回答补充

修改变量被合并进恢复起点的当前输入，并在之后每个节点的解析输入中再次覆盖同名字段，同时持久化为 execution variable。`useSnapshotVariables` 字段当前没有在执行代码中生效，不能说它可控制是否加载快照变量。

## 三、P1：拉开差距

### P1-01 为什么有 DAG 和 LangGraph 两个引擎？当前 LangGraph 真正多了什么？

#### 参考答案

设计意图是 DAG 负责稳定的预定义工作流，LangGraph 用状态图支持更复杂控制。但从当前源码看，LangGraph 的主要增量是把现有 `NodeExecutor` 适配为 `AsyncNodeAction`，并通过共享 `AgentState` 传递 `currentInput` 和 `nodeOutputs`。GraphBuilder 仍只添加普通边、单入口和单出口，没有条件边、Checkpoint 和断点恢复。因此应描述为“双引擎适配骨架”，而不是已经完整拥有循环和持久状态图能力。

#### 自然追问

如果只保留一个引擎，你会依据什么决策？

### P1-02 当前最值得优先修的安全问题是什么？

#### 参考答案

第一优先是资源授权和工具授权闭环：JWT 认证后仍要校验 workflow / knowledge / MCP 的 owner 或 tenant，模型也不能通过任意工具名绕过节点配置。第二是 `web_fetch` 的 SSRF 和响应体风险：要限制 http/https、拒绝 loopback/private/link-local 地址、校验重定向目的地、流式读取并设置字节上限。安全修复顺序应先阻止跨用户、跨工具和内网越权，再优化可用性。

#### 自然追问

只做 URL 正则够不够？

### P1-03 新增一个节点类型要改哪些地方？

#### 参考答案

后端实现 `NodeExecutor` 并返回唯一 supported type，让工厂自动注册；补节点定义的输入、输出和配置 Schema；前端节点面板、配置表单、默认值和输出参数列表要能认识新类型；若输出要给下游引用，还要保证字段契约稳定。真正的扩展点不是只有工厂模式，而是“节点定义、编辑器配置、执行器、数据传播、调试展示”共同遵守一个类型契约。

#### 自然追问

怎样避免前后端节点类型漂移？

### P1-04 不运行项目时，怎样对这些结论负责？

#### 参考答案

我把结论限制为静态可证明行为：沿 Controller、Service、Engine、Executor 和持久化实体追踪完整调用链；对同一能力交叉核对前端配置、后端分支和表结构；把注释、README 和未被调用的表降为线索；明确区分“代码存在”“静态路径闭合”和“运行通过”。对运行时并发、性能、外部 MCP 可用性和测试通过率不作结论，只给验证设计。

#### 自然追问

静态分析最容易漏掉什么？

## 四、危险答案纠正卡

### 问题：你实现了 PaiAgent 吗？

- 危险答案：我实现了可视化 Agent 平台和双引擎。
- 合格答案：这是开源源码研习，我没有个人实现证据；我静态梳理了保存、DAG、ReAct、上下文和恢复链路。
- 强答案：除架构链路外，我还记录了工具白名单、Memory 持久化和 LangGraph 能力边界；如果要把它升级为个人项目，我会先完成一个有 Diff 和回归用例的最小改造。

### 问题：LangGraph 是否支持循环和断点恢复？

- 危险答案：用了 LangGraph，所以都支持。
- 合格答案：框架可能支持，但当前项目代码只添加普通边，恢复接口也明确只接受 DAG 引擎。
- 强答案：我会分别检查 conditional edge、checkpointer、thread/state identity 和 resume API；当前四项没有形成项目级闭环，所以不写成已实现。

### 问题：Memory 是如何持久化的？

- 危险答案：写 MySQL 的 agent_memory 表。
- 合格答案：Schema 有表，但当前 `AgentMemoryService` 使用 JVM 内存列表，Service 没有 Mapper。
- 强答案：因此当前只适合单实例进程生命周期内复用；重启、扩容和租户隔离都需要重新设计持久化与作用域。

## 五、通过标准

- 8 道 P0 每道可在 30 到 60 秒内回答。
- 能准确说出至少 3 个“注释/界面与实际代码不一致”的例子。
- 不把 DAG 拓扑排序说成并行执行。
- 不把 JSON ReAct 说成原生 Function Calling。
- 不把 SSE、Snapshot 和 Execution Record 混在一起。
- 主动声明源码研习的归属边界。

## 相关链接

- [[PaiAgent-01-项目主卡]]
- [[PaiAgent-03-证据与事实边界]]
- [[AGENT-7DAY-SPRINT]]
