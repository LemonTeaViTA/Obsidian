---
module: LLM
tags: [LLM, Agent, ReAct, Function Calling, MCP, Memory]
difficulty: hard
last_reviewed: 2026-05-25
---

# Agent 核心概念

> 本文是 Agent 知识体系的==聚合入口==——每个核心概念给"是什么 + 一句话定位"，详细的实现/协议/方法论拆到独立文档。
>
> - 想看具体代码（60 行 ReAct + 工具识别两种方式）→ [[ReAct 与 Harness 实现]]
> - 想看协议细节（请求/响应结构、四种角色、多轮拼接）→ [[Function Calling]]
> - 想看工程方法论（六大组件、控制流模式）→ [[Harness Engineering]]
> - 想看框架选型（LangGraph / Spring AI / OpenClaw / Hermes）→ [[Agent框架]]

---

## 一、Agent 定义与基本架构

### Agent 到底是什么？

Agent 不是某种更高级的模型，模型还是那个模型，参数没变，结构也没变，变的是外面那一圈工程系统。

Agent = LLM + Memory + Search + MCP + Skills

拆开来看每个都不新，拼起来看着就很新。就像早期的电脑，CPU、内存、硬盘都早就有了，但装进一个盒子里，你才觉得它是"一个完整机器"。

### Agent 的四个核心模块

| 模块 | 职责 | 类比 |
|------|------|------|
| LLM | 推理和决策，接收输入、理解意图、输出下一步计划 | Agent 的 CPU |
| Memory | 短期记忆（对话上下文）+ 长期记忆（跨会话持久化） | Agent 的内存+硬盘 |
| Tools | 外部能力：搜索、代码执行、数据库查询、API 调用 | Agent 的四肢 |
| Action Executor | 真正执行 LLM 决定的操作，把结果反馈回去 | Agent 的执行器 |

### Agent 和传统 LLM Chain 的区别

先搞清楚三个层次：

**普通 LLM 调用**：一问一答，你发一条消息，模型回一条，结束。流程完全由你控制，模型只负责生成文字。

**LLM Chain（链式调用）**：把多个 LLM 调用串成固定流水线，前一步的输出自动作为后一步的输入。比如"先翻译→再摘要→再润色"，每一步干什么、顺序怎么排，都是开发者写死的。LangChain 里的 SequentialChain 就是典型实现。

**Agent**：动态决策循环。模型不只是回答，还会主动决定"下一步该干什么"——调哪个工具、传什么参数、结果不满意要不要重试、要不要换个方向。整个过程是模型在驱动，而不是你在一步步指挥。

核心区别在于**谁控制流程**：

| 维度 | LLM Chain | Agent |
|------|-----------|-------|
| 流程控制 | 开发者预定义，固定的 DAG 或线性链 | 模型动态决策，每步根据上一步结果决定下一步 |
| 分支逻辑 | 需要开发者提前写好所有 if-else 分支 | 模型自主判断走哪条路，能处理预料之外的情况 |
| 工具调用 | 哪一步调什么工具是写死的 | 模型自己选工具、选参数、决定调不调 |
| 错误处理 | 开发者预设 retry/fallback 逻辑 | 模型观察到错误后自主调整策略 |
| 适用场景 | 步骤固定、边界清晰的流水线任务 | 任务开放、需要大量判断和探索的场景 |

一句话总结：LLM Chain 是你画好路线图让模型走，Agent 是你给模型一个目的地让它自己找路。

> [!tip] 面试区分度
> 很多候选人把 LangChain 和 Agent 混为一谈。关键区分：LangChain 是工具库（提供 Chain 和 Agent 的实现），Agent 是架构模式（模型驱动决策）。LangChain 里既能写固定的 Chain，也能写动态的 Agent。

选型原则：任务步骤固定、边界清晰，用 Chain；任务开放、需要动态判断，用 Agent。两者不是替代关系——Agent 内部的每个子任务执行，本质上也可以是一段 Chain。

### 各组件之间的关系

| 层次 | 机制 | 解决的问题 | 类比 |
|------|------|-----------|------|
| 基础能力层 | Function Call | 模型和函数之间如何沟通 | 嘴巴（说出指令） |
| 协议层 | MCP | 工具怎么标准化接入 | USB 接口（统一插口） |
| 经验层 | Skills | 如何复用过去的成功经验 | 使用说明书（肌肉记忆） |

一个完整的 Agent 系统通常三层都有：用 Function Call 触发工具、通过 MCP 管理工具注册、用 Skills 积累执行经验。

---

## 二、推理模式与 Harness 控制流

Agent 的核心差异在于"怎么思考、怎么行动"。目前主流有三种推理框架：ReAct、Plan-and-Execute、Reflection——==它们都是 Harness 层的"控制流模式"==，不是 LLM 内部能力。

> [!warning] 进入推理模式之前必须搞清楚的认知：LLM 和 Harness 各干什么
> ==大部分人对 ReAct 的最大误解==：以为"思考是 LLM 干的，行动也是 LLM 干的"。==错==——LLM 在屋里只会写文字，Harness 在屋外做实际执行。具体例子+ 60 行代码 + 工具识别两种方式见 [[ReAct 与 Harness 实现]]。

### 2.1 三种推理框架

#### ReAct（Reasoning + Acting）

ReAct 的核心思想是**推理和行动交替进行**，每一步都是"想一下→做一下→看结果→再想"。

工作流程是不断循环的「思考-行动-观察」三步：

1. **Thought（思考）**：LLM 分析当前情况，决定下一步该干什么。这一步是内部推理，不对外输出
2. **Action（行动）**：LLM 决定调用哪个工具、传什么参数，以结构化 JSON 格式输出调用指令
3. **Observation（观察）**：外部系统执行 Action，把工具返回的结果注入上下文

LLM 拿到 Observation 后更新上下文，进入下一轮 Thought，判断任务是否完成。没完成继续循环，完成了输出 Final Answer。

**关键设计点**：
- LLM 每次只生成「下一步指令」，循环控制权在外部 Harness 程序，不在模型自身
- 每一步都能根据上一步的实际结果动态调整策略，天然具备纠错能力
- 缺点是**缺乏全局规划**，容易陷入局部最优

==具体实现示例（60 行 Python）==见 [[ReAct 与 Harness 实现#五、从零写一个极简 ReAct——60 行 Python]]。

#### Plan-and-Execute（先规划后执行）

Plan-and-Execute 的核心思想是**规划和执行分离**：先让 LLM 一口气生成完整计划，再逐步执行每个子任务。

**规划阶段（Planner）**：LLM 接收任务 → 拆解为有序子任务列表 → 输出完整计划。

**执行阶段（Executor）**：按计划顺序逐步执行，前一步输出作为后一步输入。

**关键设计点**：
- 规划阶段有全局视野，避免 ReAct 的"走一步看一步"问题
- 缺点是**计划一旦生成就相对固定**，中间出意外可能需要推翻重来
- 改进方案：加入 ==Replan 机制==——执行中偏差超阈值就回 Planner 重新规划。LangGraph 的 Plan-and-Execute 实现支持动态重规划

**适用场景**：步骤明确、子任务依赖清晰、不需要中途大幅调整方向的任务。比如数据处理流水线、报告生成、多步骤部署。

==具体实现示例（80 行 Python + Plan schema 三种递进 + Replan 机制 + 与 ReAct 混合）==见 [[Plan-and-Execute 实现]]。

#### Reflection（反思 / 自我修正）

Reflection 的核心思想是**生成→评估→改进的迭代循环**，通过对自身输出的批判性审视来持续提升质量。

工作流程：
1. **Generate**：LLM 生成初始结果
2. **Evaluate**：质量评估（LLM 自评 / 外部工具如编译器、测试用例、lint）
3. **Refine**：根据反馈修正
4. **循环判断**：满足质量标准或达到最大迭代次数就输出，否则回 Evaluate

**两个主要变体**：
- ==自我反思（Self-Reflection）==：同一个 LLM 既当生成者又当评审者。成本低、延迟小，但存在盲点
- ==对等评审（Critic Model）==：用专门的 Critic 模型评估。质量更高，但成本翻倍

**关键设计点**：
- Reflection 不是独立的执行框架，更像==质量保障层==，可以叠加在 ReAct 或 Plan-and-Execute 之上
- 生产中一般用自我反思做快速迭代，高精度场景（合同审核、医疗、金融）才上专门 Critic
- 需要设置最大迭代次数（通常 3-5 次），防止无限循环

### 2.2 三种核心能力

三个框架看起来各不相同，但拆开来看，它们其实是三种核心能力的不同组合：

| 核心能力 | 含义 | 对应的工程实现 |
|---------|------|--------------|
| **执行（Acting）** | 调用工具、与外部世界交互、产生实际结果 | Function Call、MCP 工具调用 |
| **规划（Planning）** | 将复杂任务拆解为子任务，安排执行顺序和依赖 | Task Decomposition、DAG 编排 |
| **反思（Reflection）** | 对已有结果进行评估和改进 | Self-Critique、外部验证器 |

- **ReAct** 侧重执行，规划是隐式的（每步 Thought 只规划下一步），反思也是隐式的（通过 Observation 间接纠错）
- **Plan-and-Execute** 侧重规划，执行是按计划推进的，反思体现在 Replan 机制中
- **Reflection** 侧重反思，执行是生成结果的过程，规划体现在改进策略的制定上

实际生产中，成熟 Agent 系统往往==混合使用==：先用 Plan-and-Execute 全局规划，每个子任务用 ReAct 执行，关键节点加 Reflection 把关。

### 2.3 三种框架对比

| 维度 | ReAct | Plan-and-Execute | Reflection |
|------|-------|-----------------|------------|
| 核心思路 | 推理与行动交替，边想边做 | 先全局规划，再按计划执行 | 生成→评估→改进循环 |
| 规划能力 | 弱，只看下一步 | 强，有全局视野 | 无独立规划，依附于其他框架 |
| 纠错能力 | 中等，靠 Observation 间接纠错 | 弱，需要 Replan 补救 | 强，专门设计用于纠错 |
| 灵活性 | 高，每步都能动态调整 | 低，计划变更成本高 | 中等，在固定结构内迭代 |
| Token 消耗 | 中等，每轮都有 Thought 开销 | 规划阶段集中消耗，执行阶段较低 | 高，多轮迭代累积消耗 |
| 适用场景 | 探索性任务、信息检索、通用 Agent | 步骤明确的多步任务、流水线 | 代码生成、长文写作、高精度场景 |
| 典型实现 | LangChain ReAct Agent、Claude Code | LangGraph Plan-and-Execute | Reflexion、SELF-REFINE |

**选型建议**：
- 任务开放、需要大量探索 → ReAct
- 任务步骤清晰、子任务有明确依赖 → Plan-and-Execute
- 对输出质量要求极高、允许多轮迭代 → 在基础框架上叠加 Reflection
- 复杂生产系统 → 三者混合

### 2.4 在分层架构中的位置

```
┌─────────────────────────────────────────────────────────┐
│  Application 层（业务 Agent：Coding Agent / 客服 Agent）│
├─────────────────────────────────────────────────────────┤
│  ★ Harness Engineering 层 ★                            │
│  - 控制流模式：==ReAct / Plan-and-Execute / Reflection==│
│  - 标准化工具集成层（参数校验/权限/超时/重试）          │
│  - 上下文工程系统（Observation 拼回 prompt）            │
│  - 子代理编排 / 验证安全 / 可观测性                     │
├─────────────────────────────────────────────────────────┤
│  LLM 推理层（API/本地模型）                             │
│  - ==Function Calling 协议==（生成"调什么工具"的 JSON） │
│  - 推理能力（CoT / Long CoT）                           │
├─────────────────────────────────────────────────────────┤
│  基础设施层（GPU/网络）                                  │
└─────────────────────────────────────────────────────────┘
```

==ReAct 是控制流（Harness 层），Function Calling 是协议（LLM 层）==——两者属于不同层，配合工作。

#### ReAct vs Function Calling vs Agentic RAG 的关系

经常被混在一起，==其实是三个层级的概念==：

| 概念 | 层级 | 解决什么 |
|------|------|--------|
| ==Function Calling== | LLM 协议层 | "怎么让 LLM 表达想调工具" |
| ==ReAct== | Harness 控制流层 | "怎么把 LLM 的 Action 和工具执行串成循环" |
| ==Agentic RAG== | Application 层 | "怎么用 ReAct + 各种工具实现一个会自己检索的 Agent" |

```
Agentic RAG （应用：自己规划检索）
   └── 用 ReAct（控制流：想-做-看-想）
         └── 用 Function Calling（协议：LLM 输出工具调用 JSON）
```

==上层依赖下层==——但不必强制：早期没 Function Calling 也能做 ReAct（靠正则解析 LLM 输出文本），只是脆弱；==现代生产==都用 Function Calling 协议。

---

## 三、Function Calling

Function Calling 是模型的==原生能力==——通过专门训练，让 LLM 能输出符合 JSON Schema 的结构化工具调用指令，而不是在自然语言里"猜"工具。

它解决的核心问题：==如何让模型准确地触发工具调用==。对比传统做法（把工具描述写在 system prompt 里、让 LLM 输出 JSON 字符串、框架自己 `json.loads`），Function Calling 把工具描述放到 API 独立的 `tools` 参数里，LLM 输出独立的 `tool_calls` 字段，==解析失败率从"经常翻车"降到"极低"==，是 2024 年后的生产事实标准。

> [!info] 完整协议细节见 [[Function Calling]]
> 包括：请求结构（tools schema 怎么写）/ 四种消息角色（system/user/assistant/tool）/ 响应结构（tool_calls 字段）/ 多轮工具调用消息序列怎么拼 / 并行调用 / 厂商差异（OpenAI / Anthropic / Qwen）/ 可靠性三层 / 失败处理四层策略 / 工具权限控制（白名单 / 参数粒度 / Human-in-the-Loop）

---

## 四、MCP 协议

==MCP（Model Context Protocol）== 是工具接入的标准化协议，相当于 AI 世界的「USB 接口」。==2026 年已成为事实标准==——Claude、Cursor、Windsurf、VS Code、OpenAI、Gemini 都已原生支持。

**核心价值**：把 ==M 个模型 × N 个工具 = M×N== 个集成简化为 ==M+N==——工具只需实现一次 MCP 接口，所有支持 MCP 的模型都能调用。

**架构**:Host（AI 应用）/ Client（MCP 客户端）/ Server（工具服务），基于 JSON-RPC 2.0 通信。

**与 Function Call 的关系**:FC 解决"==模型怎么触发工具调用=="，MCP 解决"==工具怎么标准化暴露给模型=="——两者是不同层次的问题，配合工作。

> [!info] 完整内容见 [[MCP 协议]]
> 包括:Host/Client/Server 三层架构 + JSON-RPC 通信 / 写一个最简 MCP Server / 主流 Server 生态（GitHub / Postgres / Slack 等） / 安全模型 / 与 Function Calling 衔接 / 与 A2A 的区别 / 在 Claude Code/Cursor 里挂 MCP 的配置。

> [!tip] Coding Agent 的工具集长什么样？
> Claude Code/Cursor 实际提供的工具集（read_file / grep / execute_command / RAG 检索 / web_search / MCP 动态工具）见 [[Coding Agent 工具集]]——讲清楚==哪些是内置、哪些走 MCP、为什么这么分==。

---

## 五、Memory 系统

==Agent 的记忆系统分三层==,每层解决不同问题——这是 Agent 能"==跨会话记住事=="的核心:

| 层次 | 名称 | 生命周期 | 存储位置 | 类比 |
|------|------|---------|---------|------|
| ==L1== | 工作记忆(Working Memory) | 单次推理步骤内 | 内存,不持久化 | CPU 寄存器 |
| ==L2== | 短期记忆(Short-term Memory) | 当前会话 | JSONL 会话日志 | 内存 |
| ==L3== | 长期记忆(Long-term Memory) | 跨会话持久化 | Markdown + SQLite | 硬盘 |

==关键架构观点==:==Markdown 是记忆本体(source of truth),SQLite 只是加速层==——记忆数据是用户的资产,不能锁在不透明的数据库里。

> [!info] 完整内容见 [[Agent Memory 系统]]
> 包括:
> - L2 短期记忆详解(JSONL 格式 / 写入时机 / 上下文窗口管理)
> - L3 长期记忆详解(MEMORY.md 内容结构 / SQLite schema / 索引建立四步 / 写入触发三种方式)
> - ★ ==L2 → L3 转换机制==(三种触发条件 / 转换 prompt 实战 / 哪些保留哪些丢 / 两个常见陷阱)
> - Memory 怎么被 Agent 使用(memory_search / memory_get / save_memory 三个工具)
> - 与 RAG 的对比(数据来源 / 规模 / 存储 / 注入方式)
> - 生产实现对比(Claude Code / Cursor / OpenClaw / Hermes)

> [!tip] 多轮对话的存储 schema、token 预算、五种重要性判断方案
> 对话存储设计(双表 schema)、上下文窗口预算分配、检索衔接(consumed_ids / 指代消解 / 缓存)详见 [[多轮对话]]。

---

## 六、Skills

> Skills 完整内容见 [[Agent Skills体系]]，包含渐进式披露原理、语义匹配机制、六步创建流程、性能优化、安全机制、与 MCP 的关系等。

---

## 七、RAG 核心要点

Agent 需要外部知识支撑时，通常接入 RAG 系统。RAG 的核心是"召回质量决定生成质量"：混合检索（向量 + BM25 + RRF 融合）、语义分块、重排序三板斧缺一不可。

> 完整体系见 wiki/RAG/ 目录：
> - 整体架构 → [[RAG基础与架构]]
> - 检索策略 → [[RAG检索策略]]（混合检索、重排、Agentic RAG 路由）
> - 向量与 Embedding → [[RAG向量与Embedding]]
> - 高级技术 → [[RAG高级技术]]（GraphRAG、Self-RAG）
> - 评估与质量 → [[RAG评估]] + [[幻觉与置信度]]

---

## 相关链接

- [[ReAct 与 Harness 实现]] — 60 行 ReAct 代码 + 工具识别两种方式（最底层认知）
- [[Function Calling]] — 工具调用协议详解（请求/响应、四种角色、多轮拼接）
- [[Harness Engineering]] — 工程方法论（六大组件、控制流模式）
- [[Agent框架]] — 框架选型（LangChain / LangGraph / Spring AI / OpenClaw / Hermes）
- [[Agent工程实践]] — Agent 的工程化落地
- [[Agent Skills体系]] — Skills 是 Agent 的可复用能力单元
- [[LLM基础与训练]] — Agent 底层依赖 LLM 的推理能力
- [[RAG基础与架构]] — RAG 是 Agent 的知识检索工具
