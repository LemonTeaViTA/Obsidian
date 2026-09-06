---
module: PaiAgent
type: project
status: source-study
tags: [PaiAgent, Agent, 证据, 事实边界, 源码研习, 简历验收]
last_reviewed: 2026-09-05
---

# PaiAgent 证据与事实边界

> [!warning] Fit Verdict
> 学习 Agent 工作流工程：`strong fit`。作为当前个人项目写入简历：`weak fit`。源码可以证明上游项目存在某种实现，不能证明本人实现、复现成功、运行效果或生产经验。

## 一、材料审计

| 材料 | 能证明什么 | 不能证明什么 | 证据等级 |
| --- | --- | --- | --- |
| PaiAgent 完整源码 | 当前代码结构、调用链、实现边界 | 本人贡献、运行成功、性能 | 中：学习证据 |
| Git 历史与仓库作者信息 | 上游演进线索 | 本人所有权 | 未发现个人证据 |
| README / AGENTS / docs | 设计意图和导航 | 当前真实行为 | 弱，需源码交叉核对 |
| Obsidian 三张卡 | 本人完成静态复盘和口述准备 | 功能验证或修改贡献 | 中：学习产物 |
| 个人 Diff / Commit | 当前没有 | 负责模块 | 缺失 |
| 静态分析报告 | 可证明源码阅读深度 | 运行正确性 | 中：需保留边界 |
| 测试、日志、截图、外部调用记录 | 用户明确不要求运行，本轮不采用 | 成功率、延迟、兼容性 | 不使用 |

## 二、声明验收

| 声明 | 等级 | 状态 | 安全口径 | 面试风险 |
| --- | --- | --- | --- | --- |
| 了解可视化工作流平台全景 | C0 | 可以写在学习材料 | 基于源码梳理 ReactFlow、双引擎和节点执行体系 | 低 |
| 分析工作流保存与 DAG 执行链 | C0 | 可以写在学习材料 | 静态追踪保存、解析、排序、分发和状态记录 | 低 |
| 分析 ReAct JSON 决策循环 | C0 | 可以写在学习材料 | 梳理工具调用、Observation、Trace 和步数终止 | 低 |
| 分析 Memory / Knowledge / Skill / MCP 边界 | C0 | 可以写在学习材料 | 对比普通 LLM 与 ReAct 的上下文策略 | 中 |
| 识别工具白名单和 Web Fetch 风险 | C0/C1 | 谨慎写 | 源码审计发现，尚未实现修复 | 中 |
| 复现 PaiAgent | C1 | 不能写 | 本轮没有运行、部署或行为记录 | 高 |
| 负责 PaiAgent 某模块 | C1 | 不能写 | 没有个人代码或任务证据 | 高 |
| 设计双引擎架构 | C2 | 不能写 | 属上游项目设计 | 极高 |
| 优化执行性能或准确率 | C2/C3 | 不能写 | 无改造、基线、指标或报告 | 极高 |
| 企业级、生产可用、上线 | C3 | 不能写 | 无部署、用户、流量和可靠性证据 | 极高 |

## 三、可直接使用的学习口径

### 简历不写项目时

> 基于 PaiAgent 源码梳理可视化工作流定义、DAG 调度、ReAct 工具循环、执行快照及 Memory / Knowledge / Skill / MCP 上下文机制，形成源码索引、Failure Case 与面试问答卡。

这句话只能放在补充材料、自我学习说明或面试追问中，不应冒充项目贡献 Bullet。

### 如果必须放进“项目经历”

标题必须显式标注归属：

```text
Agent 系统源码研习（PaiAgent / PaiCLI） | 开源源码分析 | 2026.08
```

安全 Bullet：

> 静态追踪 PaiAgent 从 ReactFlow 定义保存、DAG 环检测与拓扑执行，到 `NodeExecutor` 分发、SSE 事件及节点快照恢复的完整链路；对比工作流编排与 ReAct 节点的职责，并整理工具授权、Memory 持久化和 LangGraph 能力边界等 Failure Case。

不安全 Bullet：

> 设计并实现企业级可视化 Agent 平台，支持双引擎、高并发 DAG、持久化 Memory 和任意 MCP 工具。

## 四、源码可以证明的当前行为

| 结论 | 静态证据入口 | 置信度 |
| --- | --- | --- |
| 工作流以 nodes / edges JSON 保存 | `EditorPage.handleSave`、`WorkflowService`、`Workflow.flowData` | 高 |
| 引擎由 `engineType` 选择，未知值回退 DAG | `EngineSelector` | 高 |
| DAG 做环检测和拓扑排序 | `DAGParser` | 高 |
| DAG 当前串行执行节点 | `WorkflowEngine.executeNodes` 的 `for` 循环 | 高 |
| ReAct 每步一个 Tool 或 Final Answer | `ReActAgentNodeExecutor` JSON 协议 | 高 |
| ReAct 默认 5 步、最高 20 步 | `resolveMaxSteps` | 高 |
| 普通 LLM 自动召回 Memory / Knowledge | `AbstractLLMNodeExecutor.buildContextPrompt` | 高 |
| ReAct 不走普通 LLM 自动上下文链 | `LlmNodeExecutor` 委托独立 Executor | 高 |
| 普通 LLM 全量加载 Skill References | `loadAllReferences`、`getFullExecutionPrompt` | 高 |
| ReAct 注入完整 Skill 主指南；执行器有 reference 加载工具，但 UI 配置链未闭合 | `Skill.getSummary`、`buildSystemPrompt`、`EditorPage.agentToolOptions` | 高 |
| Memory 实际存 JVM List | `AgentMemoryService.memories` | 高 |
| Knowledge 候选从 MySQL 读取后在 Java 排序 | `KnowledgeBaseService.retrieve` | 高 |
| 运行时 MCP 只接通 web_search | `WebSearchTool`、`SearchInfinityMcpClient` | 高 |
| DAG 支持快照恢复，LangGraph 不支持 | `ExecutionController.resumeExecution` | 高 |
| LangGraph 当前没有条件边构建 | `GraphBuilder.addEdges` | 高 |

## 五、文档或注释不能单独证明的能力

| 上游表述 | 源码审计结果 | 安全结论 |
| --- | --- | --- |
| “企业级平台” | 缺少租户隔离、完整授权、生产证据等材料 | 只说平台源码定位 |
| “DAG 工作流” | 有拓扑排序，但当前逐节点串行 | 不说并行 DAG |
| “LangGraph 支持条件分支和循环” | GraphBuilder 只添加普通边 | 说设计意图，不能说落地 |
| “三层渐进 Skill 加载” | 普通 LLM 全量加载；ReAct 预加载主指南且有 reference 工具，但 UI 不暴露、后端不自动补入 | 只能说执行器具备按需接口，链路未闭合 |
| “长期 Memory” | 实际进程内 List，表未接入 Service | 不说持久化长期记忆 |
| “MCP 动态工具” | 配置可泛化，运行时只针对 web_search | 不说任意 MCP 自动发现 |
| “断点续执行” | 只在 DAG Engine 实现 | 不扩张到 LangGraph |
| “企业多租户权限” | 只有 JWT 认证，没有资源 owner / tenant 与 Controller 授权 | 不说已实现数据隔离 |

## 六、已识别但未修复的 Failure Case

### 1. 工具选择不是强白名单

- 证据：`AgentToolRegistry.getTools(empty)` 返回全部；执行使用 `getRequiredTool(toolName)`。
- 影响：空选择或模型输出未授权名称时，可能执行全局已注册工具。
- 当前状态：静态发现，未修改。
- 安全回答：应在执行时用节点局部工具 Map 二次授权。

### 2. ReAct Memory 开关名实不符

- 证据：普通 LLM 调 `buildContextPrompt()`；ReAct override 不调用它。
- 影响：UI 开启 Memory 并不自动为 ReAct 注入记忆。
- 当前状态：静态发现，未修改。
- 安全回答：要么自动召回，要么 UI 明确要求选择 `memory_retrieve`。

### 3. Schema 和 Service 对 Memory 的实现漂移

- 证据：Schema 有两张 Memory 表；Service 只用 `CopyOnWriteArrayList`。
- 影响：重启丢失、多实例不共享、无法可靠实现租户/用户作用域。
- 当前状态：静态发现，未修改。

### 4. ReAct 的 Memory / Skill 工具在 UI 配置链缺失

- 证据：`normalizeAgentToolSelection` 过滤 `memory_retrieve`，`agentToolOptions` 仅列 `memory_write`；配置 Skill 也不会自动加入加载工具。
- 影响：界面文案与执行器能力不能形成稳定的可配置闭环。
- 当前状态：静态发现，未修改。

### 5. `web_fetch` 可能访问内网并读取大响应

- 证据：直接 `URI.create(url).toURL().openConnection()`，`readAllBytes()` 后才截断。
- 影响：SSRF、内存占用和不受控重定向。
- 当前状态：高风险安全问题，仅报告，不在本轮扩大源码修改范围。

### 6. 恢复请求部分字段未生效

- 证据：`useSnapshotVariables` 存在于 DTO，但恢复执行路径未读取。
- 影响：API 表意与实际行为不一致。
- 当前状态：静态发现，未修改。

### 7. LangGraph 失败节点之后可能继续沿边执行

- 证据：NodeAdapter 捕获异常后返回 FAILED state，没有抛出或添加条件终止边。
- 影响：下游可能收到失败前的旧 `currentInput` 并继续。
- 当前状态：需用行为测试确认框架调度细节；只能标记风险，不能断言必然发生。

### 8. 已认证用户缺少资源级隔离

- 证据：Interceptor 只验证 Token；Workflow、Execution、Knowledge、MCP 实体和查询没有用户归属条件。
- 影响：若开放多个用户，可能按 ID 读取或修改其他用户资源。
- 当前状态：高风险安全问题，仅报告；是否引入 owner / tenant 数据模型需要单独确认范围。

## 七、升级为可写个人项目的最短路径

由于面试只剩一周，不建议重做整个平台。只选一个有差异化的最小闭环：

### 推荐改造：ReAct Tool Policy 闭环

1. 将空工具集定义为拒绝，或建立显式安全默认集。
2. 执行时只从节点局部 `availableTools` Map 取工具。
3. 为 `web_fetch` 增加协议、地址、重定向和响应体上限检查。
4. 写 6 个固定静态/单元场景：空白名单、越权工具、合法工具、loopback、重定向内网、大响应。
5. 保存 Diff、设计说明、失败前后对照和测试输出。

完成这些证据后，才能写：

> 为 ReAct 节点补齐运行时 Tool Policy，统一节点白名单二次校验，并为网页抓取增加 SSRF 与响应体边界，覆盖越权调用和内网访问等固定 Failure Case。

本轮用户只要求查看和分析代码，因此没有实施该改造，也没有运行测试。

## 八、最终红线

- 不说“我实现了 PaiAgent”。
- 不说“我复现成功”，因为本轮没有运行。
- 不说“高并发 DAG”，因为当前串行。
- 不说“LangGraph 已支持循环恢复”。
- 不说“Memory 已持久化”。
- 不说“支持任意 MCP 工具动态调用”。
- 不说“JWT 已实现多用户数据隔离”。
- 不使用延迟、吞吐、准确率、用户量或上线结果。

## 相关链接

- [[PaiAgent-01-项目主卡]]
- [[PaiAgent-02-高频追问卡]]
- [[AGENT-7DAY-SPRINT]]
