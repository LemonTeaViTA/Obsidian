---
module: PaiAgent
type: project
tags: [PaiAgent, Agent, Workflow, ReAct, LangGraph, 源码研习, 面试]
last_reviewed: 2026-09-05
---

# PaiAgent 项目主卡

> [!tip] 当前结论
> PaiAgent 适合作为一周内建立 Agent 工程全景的源码研习项目，但当前没有个人实现或运行证据。面试可以说“基于源码静态分析梳理”，不能说“我设计并实现了平台”。作为学习材料是 `strong fit`，作为个人项目经历目前是 `weak fit`。

## 一、先建立正确心智模型

### 一句话定位

PaiAgent 是一个可视化 AI 工作流平台：前端用 ReactFlow 编辑节点和边，后端把工作流定义交给 DAG 或 LangGraph4j 引擎，再通过可扩展的 `NodeExecutor` 执行 LLM、ReAct、Knowledge、Memory、MCP 等能力，并用执行记录、节点快照和 SSE 展示运行过程。

### 最重要的职责边界

```text
Workflow：根据预先定义的节点和依赖，决定“哪些节点按什么结构执行”
Agent 节点：在一个节点内部，让模型根据 Observation 决定“下一步调用哪个工具或结束”
```

因此，有 LLM 节点的工作流不一定是 Agent；只有节点内部存在“模型决策 -> 工具执行 -> Observation 回填 -> 再决策”的闭环，才构成当前项目里的 ReAct Agent。

### 90 秒安全介绍

> 我最近用 PaiAgent 做 Agent 工作流平台的源码研习，重点不是运行 Demo，而是沿代码梳理定义、调度、执行和状态四层职责。前端把 ReactFlow 的 nodes 和 edges 序列化成 `flowData`，后端保存工作流定义并依据 `engineType` 选择 DAG 或 LangGraph 引擎。DAG 引擎先做环检测和拓扑排序，再由 `NodeExecutorFactory` 按节点类型分发执行器，节点输出按 ID 保存并沿入边合并给下游。
>
> Agent 能力位于工作流节点内部。ReAct 执行器每轮让模型返回结构化 JSON，只允许“调用一个工具”或“给最终答案”；Host 执行工具，把 Observation 和简短行动摘要写入 Trace，再进入下一轮，并用 1 到 20 步上限兜底。Knowledge、Memory、Skill 和 MCP 都是可选上下文或工具能力，不应混成一个概念。
>
> 工程状态分成工作流定义、整次执行记录、DAG 节点快照和修改变量；SSE 只负责实时通知，不负责调度，也不是持久化状态。源码审计还发现几条重要边界：DAG 当前按拓扑序串行执行；断点恢复只支持 DAG；LangGraph 当前只添加普通边，注释所说的条件路由和恢复没有完整落地；ReAct 的工具白名单还需要后端二次校验。这些是我学习时重点记录的设计取舍和 Failure Case。

## 二、全景架构

```text
React / ReactFlow / Zustand
  ├─ EditorPage：编辑、配置、保存、执行
  ├─ FlowCanvas：节点与边
  └─ DebugDrawer：SSE 进度、结果、快照与恢复入口
                    ↓ REST / SSE
Spring Boot
  ├─ WorkflowController / WorkflowService：工作流定义 CRUD
  ├─ ExecutionController：普通执行、SSE、快照、变量、恢复
  ├─ EngineSelector：dag / langgraph 选择
  ├─ WorkflowEngine：自研 DAG 执行与恢复
  ├─ LangGraphWorkflowEngine：LangGraph4j 图执行
  └─ NodeExecutorFactory：节点类型 -> 执行器
                    ↓
能力层
  ├─ 普通 LLM / ReAct Agent
  ├─ Knowledge / Memory / Skill
  ├─ Web Search MCP / Web Fetch
  └─ TTS / Image / Video 等节点
                    ↓
MySQL
  ├─ workflow：定义
  ├─ execution_record：整次执行
  ├─ execution_snapshot：DAG 每节点快照
  └─ execution_variable：恢复时修改的变量
```

## 三、五条核心链路

### 1. 工作流保存链

```text
ReactFlow nodes / edges
-> Zustand workflowStore
-> serializeWorkflowNodes()
-> JSON.stringify({nodes, edges})
-> POST / PUT /api/workflows
-> WorkflowController
-> WorkflowService
-> workflow.flow_data + engine_type
```

关键点：ReactFlow 展示层统一使用 `type=workflow`，真实业务节点类型放在 `data.type`；保存时再恢复为后端可识别的 `input`、`llm`、`condition` 等类型。

### 2. DAG 执行链

```text
workflowId + inputData
-> EngineSelector 选择 dag
-> WorkflowConfigParser 解析 flowData
-> DAGParser：DFS 环检测 + Kahn 拓扑排序
-> WorkflowEngine 按拓扑序遍历
-> NodeExecutorFactory.getExecutor(node.type)
-> executor.execute(node, nodeInput, callback)
-> nodeOutputs[nodeId] = output
-> execution_snapshot / execution_record
```

当前 `for (WorkflowNode node : sortedNodes)` 是串行循环。拓扑图允许表达多个无依赖节点，但当前 DAG 引擎没有就绪队列线程池，因此不能说“自动并行执行 DAG”。

### 3. 输入传播与条件分支

- 无入边节点使用全局 `input` 或恢复后的最新输出。
- 有入边节点把所有已执行前驱的输出按入边顺序 `putAll` 合并；同名 Key 后写覆盖前写。
- 输出节点通过运行时字段 `__nodeOutputs__` 访问所有节点结果，该字段持久化前会被剥离。
- Condition 节点在原始输出写入 `__selectedBranch__`；DAG 引擎据此递归标记未选中下游。
- 汇合点只有在所有入边来源都已被跳过时才跳过，避免误伤仍可从活跃分支到达的节点。

### 4. ReAct 节点链

```text
LLM 节点 agentStrategy=react 或旧 react_agent 节点
-> ReActAgentNodeExecutor
-> 解析模型、Prompt、maxSteps、工具
-> system prompt 注入工具描述和 JSON 协议
-> 每轮发送 goal + currentInput + previousSteps
-> 模型返回：
   ├─ tool_call：执行一个 AgentTool，记录 Observation
   └─ final_answer：返回答案和完整 toolTrace
-> 非法 JSON：按普通最终答案降级
-> 工具异常：转成 recoverable observation，交给下一轮模型判断
-> 达到最大步数：返回 maxStepsReached=true
```

当前不是模型厂商原生 Function Calling，而是 Prompt 约束的 JSON 决策协议。每一步最多一个工具调用，默认 5 步，后端限制 1 到 20 步。

### 5. 执行状态与 SSE

| 状态对象 | 粒度 | 作用 | 边界 |
| --- | --- | --- | --- |
| `workflow` | 一份定义 | 保存节点、边和引擎类型 | 不表示某次运行 |
| `execution_record` | 一次运行 | 输入、最终输出、节点结果、状态、耗时 | DAG 和 LangGraph 都写 |
| `execution_snapshot` | DAG 的一个节点 | 输入、输出、状态、顺序、重试次数 | LangGraph 当前不写 |
| `execution_variable` | 一次恢复中的修改项 | 保存人工覆盖变量 | 仅恢复请求写入 |
| SSE event | 一次实时通知 | 开始、进度、成功、失败、完成 | 断线后不能代替数据库恢复 |

SSE Controller 用新线程执行工作流并把 callback 转为事件。它是表现通道，不是消息队列、调度器或可靠事件日志。

## 四、两种引擎的真实边界

| 维度 | DAG `WorkflowEngine` | `LangGraphWorkflowEngine` |
| --- | --- | --- |
| 图校验 | DFS 环检测 + Kahn 排序 | 交给 StateGraph 编译 |
| 输入传播 | 根据真实入边合并前驱输出 | 使用全局 `currentInput` 作为上一节点输出 |
| 条件分支 | `sourceHandle` + skipped 集合 | 当前只 `addEdge`，未添加 conditional edge |
| 执行快照 | 每节点写 `execution_snapshot` | 未写快照 |
| 断点续执行 | 支持 | Controller 明确拒绝 |
| 失败行为 | 节点异常后终止本次循环 | Adapter 把状态置为 FAILED 后返回状态，图是否继续取决于边 |

面试时不要因为使用了 LangGraph4j 就声称已经具备持久 Checkpoint、循环 Agent 图或 Human-in-the-loop；当前源码没有形成这些完整闭环。

## 五、Context、Memory、Knowledge、Skill、MCP

### 普通 LLM 节点

- `memoryEnabled=true` 时，调用 `AgentMemoryService.retrieve()`，将相关记忆自动拼进用户 Prompt。
- 配置 `knowledgeBaseId` 时，执行前自动检索知识库并拼接上下文。
- 配置 Skill 时，直接加载 Skill 主体和全部 references，一次性放入 System Prompt。

### ReAct 节点

- 不走普通 LLM 的 `buildContextPrompt()`，因此 `memoryEnabled` 不会自动召回；理论上可调用 `memory_retrieve`，但当前编辑器会过滤该工具，正常 UI 配置链并未闭合。
- 配置知识库时会自动把 `knowledge_retrieve` 加入候选工具，并在 System Prompt 要求相关问题先检索。
- 关联 Skill 时，名为 `getSummary()` 的载荷实际已经包含完整主指南和 reference 名单；执行器支持用 `load_skill_reference` 按需取正文，但编辑器不暴露 Skill 工具、后端也不因配置 Skill 自动补入，所以当前 UI 链路下不保证工具可用。

### 三个常见混淆

1. Memory 是跨请求保存的事实或偏好；当前实现实际是 JVM 内存 `CopyOnWriteArrayList`，重启丢失，虽然 Schema 中存在表但 Service 未使用。
2. Knowledge 是持久化文档和 Chunk；当前在 MySQL 中全量读取候选，再在 Java 内算向量/文本分数，不是向量数据库近邻检索。
3. Skill 是指导模型如何做事的 Markdown 指令；普通 LLM 预加载主指南和全部 references，ReAct 虽有 reference 按需加载接口，但当前 UI 配置链未闭合。

### MCP 的当前范围

MCP 配置表可以保存 command、args、env 和工具名，但运行时真正接通的是 `web_search`：每次调用启动一个 stdio MCP Session，完成 initialize 和 callTool 后关闭。它不是任意 MCP 工具的动态发现与通用注册框架。

## 六、必须记住的源码 Failure Case

### FC-01 工具白名单没有执行时闭环

`getTools(empty)` 返回全部工具；模型返回工具名后，执行阶段又直接从全局 Registry 取工具，没有检查它是否属于本节点 `availableTools`。因此 UI 未选择或模型越权请求时，后端白名单语义不可靠。

### FC-02 ReAct 的 Memory 开关与实际行为不一致

前端提示“执行节点前召回相关记忆”，但 ReAct 委托到独立执行器后绕过普通 LLM 的自动上下文构建。若没把 `memory_retrieve` 选为工具，开关本身不产生召回。

### FC-03 Memory 不持久

Schema 有 `agent_memory` 表，实际 Service 使用进程内 List。重启、横向扩容和多实例之间都无法共享，不能写成长期持久记忆。

### FC-04 Skill Reference 工具配置链未闭合

ReAct System Prompt 会列出 references 并提示调用加载工具，但前端可选工具只有 `memory_write` 和所选 MCP 映射，后端也不会随 `skillName` 自动加入 `load_skill_detail / reference`。只有空工具集意外暴露全部工具或手工修改定义时才可能调用。

### FC-05 Web Fetch 有 SSRF 与资源边界风险

工具接受模型提供的 URL，直接 `URLConnection` 读取全部响应后才截取 8000 字符；没有协议、内网地址、重定向和响应体上限校验。超时只能限制时间，不能阻止访问内部地址或大响应占内存。

### FC-06 DAG 多前驱输出可能静默覆盖

多个前驱的 Map 直接 `putAll`，同名字段由后处理的入边覆盖，缺少命名空间、Schema 冲突检测和显式映射。

### FC-07 LangGraph 能力表述过强

当前 GraphBuilder 只找一个入口和一个出口并添加普通边；没有条件路由、快照和恢复。类注释中的“循环、条件分支”不能当当前功能证据。

### FC-08 认证不等于资源授权

`AuthInterceptor` 只校验 JWT 并写入 username；Workflow、Execution、Knowledge 和 MCP Controller 随后直接按 ID 查询，实体也没有 owner / tenant 字段。已认证用户之间缺少资源级隔离，不能据此声称具备企业多租户权限体系。

## 七、复习顺序

1. 背熟 90 秒介绍和 Workflow / Agent 职责边界。
2. 手画保存链和 DAG 执行链。
3. 说清输入合并、Condition skip 和快照恢复。
4. 手画一轮 ReAct 的 JSON、Tool、Observation、Trace。
5. 对比普通 LLM 与 ReAct 的 Memory / Knowledge / Skill 行为。
6. 最后练双引擎边界和 8 个 Failure Case。

## 八、源码入口

- 前端保存：`frontend/src/pages/EditorPage.tsx`、`frontend/src/utils/workflowNode.ts`、`frontend/src/store/workflowStore.ts`
- 工作流定义：`WorkflowController`、`WorkflowService`、`Workflow`、`WorkflowConfigParser`
- DAG：`WorkflowEngine`、`DAGParser`、`NodeExecutorFactory`
- ReAct：`LlmNodeExecutor`、`ReActAgentNodeExecutor`、`AgentToolRegistry`
- Context：`AbstractLLMNodeExecutor`、`AgentMemoryService`、`KnowledgeBaseService`、`SkillRegistry`
- MCP：`McpToolConfigService`、`SearchInfinityMcpClient`、`WebSearchTool`
- LangGraph：`LangGraphWorkflowEngine`、`GraphBuilder`、`NodeAdapter`、`StateManager`

## 相关链接

- [[PaiAgent-02-高频追问卡]]
- [[PaiAgent-03-证据与事实边界]]
- [[AGENT-7DAY-SPRINT]]
