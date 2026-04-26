# Agent 工程实践

## 一、DSL+DAG 工作流编排

### 工作流编排的核心设计是什么？

#### 核心解析

PaiFlow 的核心是一个领域特定语言（DSL）的解析和执行引擎。用户在前端拖拽节点连线，实际上是在生成一段描述工作流拓扑结构和节点配置的 JSON（DSL）。后端工作流引擎负责解析这个 DSL，并根据依赖关系（DAG，有向无环图）调度执行。

关键设计：将 LLM 也封装成节点。运维人员可以将非结构化的告警日志输入给 LLM 分析节点，自动提取故障原因、影响范围等关键信息，再流转到后续处理节点，实现从"自动化流程"到"智能化流程"的升级。

### 双引擎路由（EngineSelector）

#### 核心解析

简单的线性工作流走 DAG 引擎（拓扑排序 + DFS 循环检测），有条件分支和循环的复杂工作流走 LangGraph 引擎。两个引擎共享同一套 NodeExecutor 执行器，通过 NodeAdapter 适配。

选型依据：
- DAG 引擎：可控、稳定、便于调试，适合步骤可枚举的任务
- LangGraph 引擎：支持条件边、循环、状态持久化，适合需要动态决策的任务

### 工作流状态管理

#### 核心解析

数据采集任务可能长时间运行（比如 10 分钟的脚本），期间如果服务宕机任务不能丢失。

方案：Redis 存储运行中的工作流实时状态和任务队列，每一步关键节点的执行结果和最终状态持久化到 PostgreSQL/MySQL。系统重启后从数据库恢复任务执行进度。

每个工作流实例都是一个状态机，状态（运行中、暂停、成功、失败）和上下文数据都会持久化存储。节点执行被抽象成异步任务，投递到消息队列由 Worker 消费，设计了幂等的节点执行逻辑和可配置的重试策略（指数退避）。

### 插件化架构

#### 核心解析

设计了一套标准的插件（工具）接入规范。任何功能——调用 REST API、执行 Shell 脚本、连接数据库——都可以封装成独立插件，由后端插件管理服务动态加载和执行。

插件本身可以用任何语言开发，只要暴露符合规范的接口（HTTP 或 MCP）。这允许将 Java 工具和 Python 采集脚本无缝集成到同一个平台。

---

## 二、Multi-Agent 架构

### 为什么需要 Multi-Agent？

#### 核心解析

三个原因：
1. **上下文窗口限制**：复杂任务信息量可能远超单个 LLM 的上下文窗口
2. **专业能力瓶颈**：一个 Agent 同时精通代码审查、数据分析和文案撰写，效果远不如三个专业 Agent 各司其职
3. **并行效率**：很多子任务之间没有依赖关系，完全可以并行跑

### 四种协作模式

| 模式 | 特点 | 适用场景 |
|------|------|----------|
| 流水线（Pipeline） | A 的输出是 B 的输入，一环扣一环 | 有明确先后顺序的任务 |
| 主从（Orchestrator-Workers） | 指挥官 Agent 负责任务分解和调度，执行 Agent 负责执行 | 最主流的多 Agent 架构 |
| 平行（Parallel） | 多个 Agent 同时处理不同子任务，最后汇总 | 无依赖关系的并发任务 |
| 辩论（Debate） | 多个 Agent 对同一问题给出不同角度回答，裁判 Agent 做决策 | 需要多视角验证的场景 |

### 编排者-执行者模式

#### 核心解析

编排者负责三件事：接收原始任务、拆解成子任务、分发给合适的执行者，最后汇总结果。执行者是一批专业化的 Agent，每个只干自己最擅长的那类任务。

关键点在于编排者的任务拆解质量：
- 粒度太粗→执行者拿到的任务依然复杂，失败率高
- 粒度太细→子任务太多，通信开销大，汇总麻烦

好的编排提示词应包含：任务目标、可用执行者列表及能力描述、任务拆解的格式要求（JSON）、汇总输出的格式要求。

在 LangGraph 里，编排者是中心节点，各执行者是叶子节点，通过带条件的边控制任务路由。

### 如何避免无限循环和通信冗余？

#### 核心解析

**防无限循环**三个手段：
1. 最大步数限制：超过就强制中止并报错
2. 状态哈希检测：发现重复状态就判定为循环并中断
3. 超时熔断：超过预设时间强制结束，返回当前最优解

**防通信冗余**：设计清晰的消息协议，每条消息带 Agent ID、任务 ID、消息类型（中间状态 vs 最终结果），指挥官只处理「最终结果」类型的消息；用消息去重队列过滤重复消息。

---

## 三、CLI 设计

### 为什么 AI 时代大家都在做 CLI？

#### 核心解析

AI 就是文本进、文本出，它没有眼睛看不了图形界面。CLI 是纯文本的，和 AI 天然适配。

AI 的实际能力 = 它能调用的工具 + 它拿到的上下文。CLI 是当下效率最高的 AI 能力分发方式。

### 新一代 CLI vs 传统 CLI

| 维度 | 传统 CLI | 新一代 CLI |
|------|----------|-----------|
| 设计对象 | 给程序员用 | 假设调用者是 AI Agent |
| 交互方式 | 弹交互式菜单 | 所有操作通过参数一次性传入 |
| 输出格式 | 彩色文字给人看 | JSON 格式，AI 直接解析 |
| 说明书 | 靠 man page | 自带 Skills 文件 |
| 预览能力 | 无 | 支持 --dry-run |

### CLI 打包了 MCP + Skills + Plugin

一个 CLI 工具同时包含执行能力、通信协议和使用说明，就是一个完整的 AI 插件。跨平台，免审核，人和 AI 都能用。

CLI 还有管道优势，多个工具可以通过管道串联：
```
数据拉取 CLI | jq 处理 | AI 生成报告 | 飞书 CLI 发送
```

### 做 CLI 的五个关键点

1. **不要弹交互式菜单**：所有选项通过参数传入，提供 `--no-interactive`
2. **输出 JSON 格式**：默认 JSON 或提供 `--output json`
3. **提供 --dry-run 预览**：危险操作前让 AI 先看看会发生什么
4. **控制输出大小**：用 field masks 或 `--fields` 控制返回字段
5. **写好 Skills 说明书**：控制在 1.6KB 左右，只写 AI 需要知道的

### 让 AI 管理自己的工具

传统思路是写代码嗅探用户系统装了什么、写 UI 让用户管理工具、写逻辑检测更新——工作量巨大，每个工具情况不同，用代码写死安装逻辑写不完。

AI 时代的思路：既然产品里已经有 AI 了，让 AI 来管理。安装工具时 AI 读 `--help`，判断操作系统，处理权限错误，引导认证配置；报错了 AI 读错误信息自己判断要不要 sudo、先装依赖、换源。注册工具时给 AI 一个提示词模板，读完 `--help` 自动生成结构化描述。更新时 AI 定期检查版本，发现新版本提示用户确认，遇到问题自己读日志解决。

Karpathy 说得对：**每一个产品都应该有一个 CLI 工具。不要让开发者去访问、查看或点击。直接指示和赋能他们的 AI。**

---

## 四、LangChain 使用

### LangChain 的三层架构

#### 核心解析

**基础抽象层**：定义 LLM、ChatModel、Prompt、OutputParser 核心接口，换模型只要换实现类。

**能力层**：六个核心模块：
| 模块 | 职责 |
|------|------|
| Models | 对各家大模型的统一封装，上层调用接口都是 `ChatModel.call()` |
| Prompts | 提示词管理，支持模板变量、Few-Shot 示例、动态拼装 |
| Indexes | 文档索引（DocumentLoader、TextSplitter、VectorStore、Retriever） |
| Memory | 记忆管理，短期用 BufferMemory，长期接 VectorStore |
| Chains | 多步骤串联，最常用 LLMChain = Prompt + Model + OutputParser |
| Agents | 自主决策模块，模型根据目标自己选择调用哪个工具 |

**应用层**：LangServe 做部署，LangSmith 做调试和监控，LangGraph 做复杂状态图编排。

### LangChain vs LangGraph

#### 核心解析

LangChain 的 Chain 是线性的，A→B→C 一条路走到黑。真实 Agent 场景经常需要条件分支、循环、并行执行，Chain 搞不定。

LangGraph 把工作流从链式升级成图式——节点处理步骤，边可以带条件，还支持循环。底层是 StateGraph，用状态驱动整个执行流程。

LangGraph 的两个独特能力：
1. **循环支持**：传统 DAG 不允许循环，但 Agent 的推理循环天然需要循环
2. **状态持久化**：每一步状态快照存下来，支持 Human-in-the-Loop——关键节点暂停等待人工确认

条件边（Conditional Edge）：A → f(state) → B 或 C 或 D，下一步走哪里取决于当前状态的计算结果，让有向图具备动态路由能力。

### Agent 开发的四种方式

| 方式 | 特点 |
|------|------|
| ReAct 模式 | 交替推理和执行，LangChain Agent 的默认模式 |
| Plan-and-Execute | 先规划完整计划再逐步执行 |
| Multi-Agent 协作 | 多个 Agent 各司其职，通过消息传递协调 |
| 状态图编排 | LangGraph 方式，开发者画图定义节点、边和条件分支 |

---

## 五、Embedding 算法

> 完整内容已迁移至 [[检索召回与优化#题目：三代 Embedding 算法是怎么演进的？|检索召回与优化 — Embedding 算法演进]]，包含三代演进（Word2Vec → BERT → SBERT）、对比总结表和面试推荐选型。

---

## 六、RAG 2.0：Agentic RAG

### 传统 RAG 的三大瓶颈

#### 核心解析

1. **盲目检索**：固定检索策略，简单问题过度检索引入噪音，复杂问题检索不足信息不全
2. **缺乏质量评估**：检索到文档直接拼进 Prompt，不评估相关性、支撑性、可靠性，导致幻觉
3. **单一知识源**：只查一个向量数据库，无法整合 SQL、API、Web 搜索等多源信息

### Agentic RAG 的三个设计原则

#### 核心解析

**需求驱动的检索**：Agent 动态判断是否需要检索、检索什么、检索多少次。通过 Retrieval Tokens 实现——LLM 在生成过程中预测特殊 token（如 `[Retrieve]`）触发检索。

**多维度自我评估**：引入 Reflection Tokens：
- `[IsRel]`：检索到的文档是否相关？
- `[IsSup]`：生成的内容是否有文档支撑？
- `[IsUse]`：答案整体质量如何？

**多源协同知识整合**：Document Agents（每个文档专属 Agent）+ Meta-Agent（协调综合）+ Tool Agents（调用外部 API/数据库/Web 搜索）。

### Self-RAG 机制

#### 核心解析

训练 LLM 生成 Reflection Tokens，实现自主检索决策和质量评估。

训练流程：
1. 先训练 Critic Model，用于标注训练数据（相关性、支撑性、实用性）
2. 使用 Critic Model 标注的数据训练最终的 Self-RAG 模型

推理时通过预测 Reflection Tokens 实现自适应检索：模型自己决定是否检索、评估检索结果相关性、不相关则重新检索。

性能提升：事实核查准确率从 71% 提升到 81%，长文本引用准确率达 80%。

### RAG 框架选型决策树

```
是否需要复杂控制流（循环、分支、多Agent）？
├─ 是 → LangGraph
└─ 否
    ├─ 是否需要大量第三方集成？
    │   ├─ 是 → LangChain
    │   └─ 否
    │       ├─ 数据源复杂，需要高级索引？
    │       │   ├─ 是 → LlamaIndex
    │       │   └─ 否 → Haystack（企业级）或自研（极致性能）
```

> 参考：[[RAG管道设计]] 中有 Baize 项目的混合检索（BM25+KNN+Rerank）具体实现

---

## 七、Transformer 与模型训练

### Transformer 架构要点

#### 核心解析

整体分 Encoder（理解输入）和 Decoder（生成输出）。核心创新是 Self-Attention 机制，替代了 RNN/LSTM 的循环结构，每个位置都能直接"看到"序列里所有其他位置，且可以并行计算。

Self-Attention 计算：
```
Attention(Q, K, V) = softmax(Q·K^T / √d) · V
```
输入经过三个线性变换得到 Q、K、V，Q 和 K 做点积算相似度，除以 √d 防止数值太大，过 Softmax 得到注意力权重，用权重对 V 加权求和。

Multi-Head Attention：并行跑多组 Attention，每组用不同的投影矩阵，最后拼接。一个 Head 关注语法关系，另一个关注语义关系，多维度理解 token 关系。

其他关键组件：
- 位置编码（Positional Encoding）：给 token 加位置信息，现在多用 RoPE
- Layer Normalization：稳定训练过程
- Feed-Forward Network：两层全连接做非线性变换，模型大部分参数集中在这里

### 大模型训练三阶段

#### 核心解析

1. **预训练（Pre-training）**：海量文本自监督学习，目标是预测下一个 token，消耗算力最大
2. **SFT（Supervised Fine-Tuning）**：人工标注的指令-回答做有监督微调，让模型学会按指令做事
3. **RLHF**：训练奖励模型（Reward Model），用人类偏好数据告诉它什么回答是好的，再用 PPO 强化学习让主模型往高分方向靠

RLHF vs DPO：RLHF 要单独训奖励模型再用 PPO，流程重。DPO 把奖励模型这步砍掉，用偏好数据对直接优化策略模型，两步并一步，训练更简单稳定。

---

## 八、微服务与可观测性

### 分布式工作流的服务治理

#### 核心解析

系统由 Java、Python 等多种语言的微服务构成，服务间调用关系复杂。

方案：全面拥抱 OpenTelemetry 标准，所有微服务集成 Tracing SDK，为每个请求生成唯一 Trace ID 并在整个调用链中传递。一次 workflow 执行经过的每一个服务、每一次数据库调用、每一次 API 请求，都串联成完整的调用火焰图。

### 插件执行环境的安全隔离

#### 核心解析

允许运维人员执行自定义脚本带来安全风险。多层安全机制：
1. 所有插件定义必须经过 Schema 校验，明确声明需要的权限
2. 自定义代码节点在 Docker 容器中运行，利用容器技术实现资源和文件系统隔离
3. 对脚本执行时长、内存使用做严格限制，防止恶意消耗资源

### RAG 生产环境的可观测性三支柱

| 支柱 | 关键指标 |
|------|----------|
| 日志 | 每个阶段的请求 ID、检索文档数、耗时 |
| 指标 | P50/P99 延迟、召回率、错误率、成本 |
| 追踪 | 端到端延迟分解、检索质量、生成质量、GPU 利用率 |

### 延迟优化策略

1. **并行检索**：多知识源同时查询
2. **语义缓存**：语义相似的查询共享结果，命中率 >30%
3. **两阶段检索**：低成本模型粗召回 Top-100，高精度 Reranker 精排 Top-10
4. **超时降级**：超时后返回无检索的 LLM 直接回答
5. **动态 Top-K**：简单查询检索少，复杂查询检索多
6. **模型降级**：高峰时使用更便宜的模型

---

## 九、Harness Engineering

### 从 Prompt Engineering 到 Harness Engineering：三代进化

| 阶段 | 时间 | 核心关注 |
|------|------|---------|
| **Prompt Engineering** | 2022-2024 | 怎么写好一条指令（few-shot、CoT、角色扮演） |
| **Context Engineering** | 2025 | 为模型动态构建完整上下文（相关文件、历史对话、工具定义、知识库检索结果） |
| **Harness Engineering** | 2026 | 搭建整个运行环境——约束、反馈循环、架构规则、工具链、生命周期管理 |

类比：Prompt Engineering 是写好一封邮件。Context Engineering 是把相关附件都带上。Harness Engineering 是搭建整个工作环境，让 Agent 能持续、稳定、高质量地工作。

概念来源：Mitchell Hashimoto（HashiCorp 联合创始人、Terraform 缔造者），核心定义：

> 每当你发现 Agent 犯了一个错误，你就花时间去工程化一个解决方案，让它再也不会犯同样的错。

### Harness Engineering 的四大原则

Harness 的核心理念是**模型负责推理与决策，治理环境负责执行、约束与连接**：

1. **决策唯一性**：模型是决策的唯一来源，治理环境不介入逻辑分支，仅执行模型请求。
2. **工具接口化**：工具是模型与外部世界的唯一接口，所有动作必须通过类型化、Schema 验证的工具调用完成。
3. **上下文资源化**：对模型可见的上下文进行精细化管理、压缩和按需注入，而非把所有历史塞进 context window。
4. **权限声明化**：准入、拦截或审批逻辑定义在配置文件中，而非硬编码在程序里。

### Harness 的六大核心组件

一个完整的 Harness 包含六个部分，核心公式：**Agent = Model + Harness**

| 组件 | 职责 | 解决什么问题 |
|------|------|-------------|
| **标准化工具集成层** | 所有工具调用前加钩子，统一参数校验、权限检查、异常兜底 | 某个工具挂了不会让整个任务崩溃 |
| **上下文工程系统** | 用结构化状态替代聊天历史，每阶段有明确输入输出 | 长任务上下文越来越乱 |
| **状态持久化与任务调度** | 断点续传、Checkpoint 机制，任务状态全部持久化 | Agent 跑着跑着断了能恢复 |
| **子代理编排与隔离** | 复杂任务拆给多个子 Agent 并行，各自独立上下文 | 子 Agent 之间互相干扰 |
| **验证与安全防护层** | 生成前、调用前、输出前每道关口加校验 | 模型一抽风后果很严重 |
| **可观测性与审计** | 每一步有日志、追踪、告警 | 出问题能快速定位根因 |

一句话：让非确定性的模型，在确定性的框架里稳定运行。

#### 深入：三层上下文压缩机制

上下文工程系统的具体实现通常采用三层分层策略，平衡"即时精度"与"长期记忆"：

| 层级 | 策略 | 作用 |
|------|------|------|
| **第一层：逐字保留** | 保留最近 N 条消息（如 KEEP_RECENT = 6）不作任何处理 | 对当前讨论和刚发生的工具输出保持 100% 精确感知 |
| **第二层：智能摘要** | 超过字符阈值（如 40000 字符/10k Tokens）时，将较旧消息发给 LLM 压缩，要求提取"技术决策、文件路径、代码变更、待办事项"，剔除琐碎对话 | 节省 Token 的同时保留关键信息 |
| **第三层：持久化存储** | 将摘要写入磁盘文件（如 `.agent_memory.md`） | 实现"跨 Session 记忆"，程序重启后能找回之前的进度 |

### Harness 为什么比模型本身更重要？

同一个模型，什么都没换，只换模型外面的运行环境，效果天差地别：

| 来源 | 实验 | 结果 |
|------|------|------|
| Nate B Jones | 同一模型，只换 Harness | 编程成功率 42% → 78% |
| LangChain | 同一 gpt-5.2-codex，换 Harness | Terminal Bench 52.8% → 66.5%，排名从 30+ 进前 5 |
| Anthropic | Solo 模式 vs Harness 模式 | Solo：20 分钟/$9，功能全坏；Harness：6 小时/$200，游戏能玩 |
| Terminal Bench 2.0 | Claude Opus 4.6 换 Harness | 排名从第 33 跳到第 5 |
| Pi Research | 一个下午修改 Harness | 提升了 15 个不同 LLM 的编程能力 |

结论：在当前节点，优化模型外面的壳，回报率比等下一代模型更高。

### Anthropic 的 Generator-Evaluator 架构

**核心问题：** 模型不会评价自己的工作。让 Agent 自评，它会自信地说"写得很好"，即使质量明显不行。

**解法：** 借鉴 GAN 思路，把生成和评估拆成两个独立 Agent：
- **Generator**：负责写代码/实现功能
- **Evaluator**：不是看截图打分，而是用 Playwright 真机操作——点页面、查 API、看数据库状态，像真人 QA 一样验收

**关键发现：** 开箱即用的 Claude 是一个很差的 QA Agent——会发现问题然后说服自己这不是大问题，倾向于做表面测试。需要多轮校准 evaluator 的严苛程度。但让独立 evaluator 变严格，远比让 generator 学会自我批评容易得多。

**完整架构：** Planner（需求展开为产品规格）→ Generator（按 sprint 逐功能实现）→ Evaluator（每个 sprint 结束后真机验收）

### 企业级 Harness 实战经验

**OpenAI Codex 团队（5 个月，100 万行代码，全 Agent 生成）：**
- 仓库是 Agent 唯一的知识来源
- 代码不仅要对人类可读，更要对 Agent 可读
- 架构约束不靠 prompt，靠 linter
- 自主性得一步步给
- 如果 PR 需要大改才能合并，问题不在 Agent，在 Harness

**Stripe Minions（每周 1300+ PR，无人值守）：**
- Blueprint 编排：确定性节点（linter、推送）按固定路径执行不调模型，Agentic 节点（实现功能、修 CI）让模型判断
- CI 最多跑两轮，第一轮失败 Agent 自动修复再跑一次，还失败直接转人类
- 500 个 MCP 工具，但每个 Agent 只给精心筛选的子集——更多工具不等于更好表现

**Cursor 的教训（递归 Planner-Worker 模型）：**
- 第一版单 Agent → 复杂任务扛不住
- 第二版多 Agent 共享状态 → 锁竞争，Agent 互相打架
- 第三版结构化角色 → 太僵硬
- 第四版持续执行器 → 角色过载
- 最终版：递归 Planner-Worker
- 关键发现：约束解空间，反而让 Agent 更有生产力

### Harness 会被淘汰吗？

**反对观点（Noam Brown，OpenAI）：** Harness 是拐杖，统一模型终将超越。推理模型出来后，之前搭的复杂 Agentic 系统一夜之间不需要了。

**Anthropic 的判断：** Harness 的可能性空间不会缩小，只会平移。模型变强了，旧约束可以拆掉（如 Opus 4.6 不再需要 sprint + context reset），但新的更高阶约束空间打开了（如 4 小时自主开发任务需要新的反馈和验收机制）。

**事实佐证：** Manus 6 个月重构 5 次 Harness，LangChain 一年重新架构 3 次研究型 Agent，Vercel 砍掉 80% 的 Agent 工具。Harness 不是一次性工程，是持续演化的系统。

> 来源：[Anthropic说：不要在等下一代模型了，立刻马上做Harness！](https://mp.weixin.qq.com/s?__biz=MzkxNjcyNTk2NA==&mid=2247491751&idx=1&sn=a46776aeac4344bc9b82fedb8006a582&chksm=c0df4a5feae65afd3f1e6070d9b0ac6225b503e78c34b671bf7ec6e4c6c63cf1aa3d97fc40e5&mpshare=1&scene=24&srcid=0325NU2lUQ4h2TGFWqnHFCEB&sharer_shareinfo=04477679b266aa971df147192955c7df&sharer_shareinfo_first=04477679b266aa971df147192955c7df#rd)

### 字节 DeerFlow 2.0：开源 Harness 框架（54k Star）

字节开源的 Agent Harness 实现，三个核心特点：

1. **子代理沙箱隔离**：每个子 Agent 在独立沙箱运行（独立文件系统、网络隔离、资源限制），一个搞坏了不影响其他的，也不污染主环境。
2. **结构化任务状态**：不再把所有对话塞进 context，而是把任务状态抽象成清晰的数据结构（当前阶段、已完成步骤、待办事项、依赖关系），模型只读结构化数据。
3. **可插拔工具链**：工具调用封装成标准接口，支持热插拔，新增工具不需要改框架代码。

> 项目地址：https://github.com/bytedance/deer-flow

### Harness 落地三层路径

从性价比来看，建议从工具层开始，逐步演进：

| 层级 | 做什么 | 改造成本 | 解决什么 |
|------|--------|---------|---------|
| **工具层** | 工具调用前后加拦截器（参数校验、权限检查、日志记录） | 低 | "一着不慎满盘皆输" |
| **框架层** | 引入现成 Harness 框架（DeerFlow、Claude Code 执行框架） | 中 | 状态管理、断点续传、子代理编排 |
| **平台层** | 搭建统一 Agent 运行时平台（集中配置、调度、监控、审计） | 高 | 大量 Agent 的统一管理 |

> 来源：[字节开源的 Harness Agent 火爆全网，已狂飙 54k+ Star](https://mp.weixin.qq.com/s?__biz=MzUxNzAzMTU4OQ==&mid=2247486850&idx=1&sn=86f4faa1227e628656ddf808069b0a30&chksm=f8db67f9738b5f562da6ec42a406271ec3476d2b282631b809e57c40198caeea37695424e1be&mpshare=1&scene=24&srcid=040129NT9gcbbFwD27FHnzSz&sharer_shareinfo=b71982cf0d4b072881a01d2f67caf694&sharer_shareinfo_first=b71982cf0d4b072881a01d2f67caf694#rd)

### DESIGN.md：Harness 在 UI 层面的实践

AGENTS.md 告诉 Agent 怎么构建项目，**DESIGN.md** 告诉 Agent 项目应该长什么样——Google Stitch 提出的概念，专门给 AI Agent 读的纯文本设计系统文档。

**awesome-design-md** 项目从 Stripe、Vercel、Apple、Linear 等 31+ 真实网站提取设计系统（色彩体系、字体层级、组件样式、间距系统、Do's and Don'ts），转成约 300-400 行的 Markdown 文件。把文件丢进项目根目录，Agent 生成的 UI 就能严格遵循该设计规范。

本质上就是 Harness 的审美约束层——和上面 Stripe "给每个 Agent 精心筛选工具子集"、OpenAI "架构约束靠 linter 不靠 prompt" 一脉相承：**把约束写成规格书，比在 prompt 里反复描述有效得多。**

> 项目地址：https://github.com/VoltAgent/awesome-design-md

---

## 十、相关开源项目

### GitNexus：代码库知识图谱引擎

**解决的问题：** AI 编程工具（Claude Code、Cursor、Codex）在修改代码时缺乏对项目整体架构的理解，容易盲目修改导致连锁问题。

**核心方案：** 用 Tree-sitter AST 解析把整个代码库索引成知识图谱——映射所有函数调用、导入关系、类继承、接口实现，然后通过 MCP 协议暴露给 AI Agent，让 Agent 在修改代码前能"看懂"项目架构。

**关键能力：**
- 从入口点追踪完整调用链
- 修改任何一行代码前执行影响范围分析（哪些进程会受影响）
- 按内聚评分将相关代码分组为功能簇
- 自动从知识图谱生成代码库文档

**和 DeepWiki 的区别：** DeepWiki 帮你"理解"代码（生成描述），GitNexus 让你"分析"代码（记录所有关系）。知识图谱记录的是结构化关系，不仅仅是自然语言描述。

**本质：** 给 Agent 提供代码上下文的基础设施，让较小的模型也能获得大模型级别的架构理解能力。

> 项目地址：https://github.com/abhigyanpatwari/GitNexus
> 在线体验：https://gitnexus.vercel.app

### claude-code-from-scratch：23 阶段 Harness 实现

**解决的问题：** Harness Engineering 概念虽火，但缺乏从零到生产级的完整实现路径作为参考。

**核心方案：** 通过 23 个递进式 Session 脚本，逐步构建一个仿 Claude Code 的智能体系统，每个 Session 只新增一个核心概念，代码控制在 40-150 行：

| 阶段 | 关键特性 |
|------|---------|
| **基础层** | 感知-动作循环、工具调度映射、TodoWrite 规划 |
| **增强层** | 子智能体上下文隔离、按需技能加载、三层上下文压缩 |
| **协作层** | 基于文件的任务图（DAG）、后台任务、持久化邮箱的智能体团队 |
| **进阶层** | 自动任务认领、Git Worktree 隔离、实时 Token 流式传输 |
| **生产治理层** | YAML 权限管理、事件总线、会话持久化与分支、MCP 运行时集成 |
| **优化层** | 并行工具执行、中断注入、Anthropic Prompt Caching |

**亮点设计：**
- **DAG 任务图**：`.agent_tasks.json` 作为事实来源，支持 `depends_on` 字段定义任务依赖
- **Git Worktree 隔离**：每个并行任务在独立 Git 分支和工作目录中执行，避免文件冲突
- **YAML 权限治理**：always_deny / always_allow / ask_user 三级，支持对工具名和操作目标联合检查
- **Redis Pub/Sub 通信**：替代基于文件的轮询，实现毫秒级跨智能体消息传递

**适用场景：** 想自己实现一套生产级 Agent 系统、理解 Claude Code 内部机制、或者作为 Harness 学习路线图的参考实现。

> 项目地址：https://github.com/FareedKhan-dev/claude-code-from-scratch

> 来源：[小白剖析Claude Code：基于Harness Engineering 智能体系统](https://mp.weixin.qq.com/s?__biz=MzIwNDA5NDYzNA==&mid=2247511570&idx=1&sn=4de78a89b6b9793b0bfa29e9ad92426a&chksm=97f2689a75d3a9bc44d0ebc1316799103d121268cd198f2df2cca66f0acf245bbde70b7f2399&mpshare=1&scene=24&srcid=04086fH5u1mTMY9RpkP44I1O&sharer_shareinfo=699f02024605e87cc162c44a7b8ddfad&sharer_shareinfo_first=699f02024605e87cc162c44a7b8ddfad#rd)
