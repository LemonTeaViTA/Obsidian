---
module: Agent
tags: [LLM, Agent, 框架, LangGraph, CrewAI, AutoGen, Hermes, OpenClaw]
difficulty: medium
last_reviewed: 2026-07-22
---

# Agent 框架

> 主流 Agent 框架的对比与选型，从国际大厂（LangChain/LangGraph/CrewAI/AutoGen/LlamaIndex）到国产框架（Hermes/OpenClaw/Spring AI）的完整画像。
>
> Agent 通用概念（ReAct/Function Calling/Memory）见 [[Agent 核心概念]]；通用 Harness 框架见 [[Harness Engineering]]。

> [!tip] 速览（一分钟读完）
> - **最本质差异**：不是功能，是"谁控制控制流"——LangGraph 你画图、CrewAI LLM 分配、AutoGen 对话决定
> - **生产首选**：Java → Spring AI；Python 复杂 Agent → LangGraph；快速 PoC → LangChain（但别用于生产）
> - **最反直觉**：CrewAI 写起来最简单，生产最容易出问题（可控性最差）；LangGraph 最繁琐，出了问题最好查
> - **选型核心问题**：任务边界清晰→LangGraph；模糊→CrewAI；Java→Spring AI；重RAG→LlamaIndex
> - **框架 ≠ 银弹**：5 个工具以内、无 Multi-Agent、不需要可观测 → 直接用 LLM SDK 更清晰

---

## 一、为什么需要 Agent 框架

直接用 LLM API 构建 Agent 需要自己处理：循环控制、工具调用、上下文管理、错误处理、状态持久化、安全隔离、可观测性……==每个都是工程难题==。

Agent 框架把这些通用能力封装好，让开发者专注业务逻辑：

| 不用框架 | 用框架 |
|---------|--------|
| 自己写 ReAct 循环 | 框架内置 |
| 手动拼接对话历史 | 框架管理 Memory |
| 工具调用失败要自己重试 | 框架统一异常兜底 |
| Multi-Agent 协调要手写 | 框架内置 Multi-Agent 协调 |
| 调试困难 | 框架内置 trace / 日志 |

==但框架不是银弹==——简单 Agent 直接用 SDK 反而更清晰。==有 5+ 工具、Multi-Agent、需要观测==时框架价值才显现。

### 各框架最本质的差异：谁控制控制流

框架的核心差异**不是功能列表，而是"谁决定执行顺序"**——这直接决定可控性、调试难度、适用场景：

| 框架 | 控制流由谁决定 | 可控性 | 调试难度 | 适合场景 |
|------|-------------|--------|---------|---------|
| **LangChain** | 开发者写死（A→B→C） | 高（但灵活性低） | 高（抽象层多） | 快速 PoC |
| **LangGraph** | 开发者画图（节点+条件边） | 最高 | 中（状态图可视化） | 生产复杂 Agent |
| **CrewAI** | 角色/任务声明后 LLM 分配 | 低 | 高（LLM 行为难预测） | Demo、明确协作场景 |
| **AutoGen** | Agent 之间对话决定 | 最低 | 最高 | 研究、代码生成实验 |
| **Spring AI** | 开发者写 Java 代码 | 最高 | 低（普通 Spring 调试） | Java 后端集成 LLM |

==关键认知==：**控制流越模糊（LangChain→CrewAI→AutoGen），写起来越简单，调试起来越困难，生产可靠性越低。**

---

## 二、国际主流框架

### 2.1 LangChain（生态最大，但生产慎用）

==开创者==。把 LLM 应用拆成 Chain + Agent + Memory + Tool 等组件，用 Python 拼装。

| 维度 | 说明 |
|------|------|
| 语言 | Python / TypeScript |
| 核心抽象 | Chain / Agent / Tool / Memory |
| 强项 | ==300+ 集成==（向量库、LLM、API、数据库），生态最大，学习资料多 |
| 弱项 | 见下方 |
| 适用 | 快速 PoC、需要丰富集成、==学概念用，生产建议迁 LangGraph== |

**真实弱项（不只是"抽象层级多"）**：

1. **API 不稳定，一年改三次**：旧 API（`LLMChain`）→ LCEL（`RunnablePassthrough`）→ 再改，老代码半年就跑不了。这是 LangChain 最被诟病的问题，无数团队踩坑。
2. **调试困难**：抽象层级太深，报错信息指向框架内部，不知道是你的代码问题还是框架问题。
3. **"魔法代码"**：`initialize_agent(tools, llm, agent_type="zero-shot-react")` 看着简单，但底层发生了什么完全不透明。
4. **Chain 是线性的**，不支持循环——而 Agent 天然需要循环（ReAct 循环，失败重试）。这是 LangGraph 诞生的直接原因。

```python
from langchain.agents import initialize_agent, Tool

tools = [Tool(name="search", func=search_fn, description="...")]
agent = initialize_agent(tools, llm, agent_type="zero-shot-react")
result = agent.run("帮我查一下...")
```

---

### 2.2 LangGraph（==2024 生产推荐==）

**LangChain 团队承认 Chain 不够用后的重写**。核心洞察：==Agent 不是链，是状态图==——节点是步骤、边是条件流转、支持循环。

| 维度 | 说明 |
|------|------|
| 核心抽象 | StateGraph（状态图）+ Node（节点）+ Edge（条件边） |
| 强项 | ==显式控制流==（你画图、框架按图走）、支持循环和条件分支、状态可持久化（中断续跑）、可视化调试 |
| 弱项 | 见下方 |
| 适用 | ==复杂 Agent==（多步推理、Multi-Agent、需要可观测的生产系统） |

**为什么 LangGraph 比 LangChain 好**：

| 问题 | LangChain 怎么做 | LangGraph 怎么做 |
|------|----------------|----------------|
| 循环执行 | ❌ 不支持 | ✅ 状态图原生支持 |
| 条件分支 | ❌ 要绕很多层 | ✅ conditional_edge 直接写 |
| 调试 | ❌ 黑盒，不知道走到哪一步 | ✅ 可视化状态图，知道当前节点 |
| 状态持久化 | ❌ 靠 Memory 凑 | ✅ Checkpoint 原生支持，中断可续 |
| 控制感 | ❌ 框架决定执行顺序 | ✅ 开发者完全控制 |

**真实弱项**：
- **学习曲线陡**：要先想清楚业务流程，把它转化成"节点+边"的图。思维方式不同。
- **探索性任务不适合**：任务边界模糊时，你没法画出确定的状态图。

```python
from langgraph.graph import StateGraph

graph = StateGraph(AgentState)
graph.add_node("retrieve", retrieve_node)
graph.add_node("generate", generate_node)
graph.add_edge("retrieve", "generate")
graph.add_conditional_edges("generate", should_retry,
                            {"retry": "retrieve", "done": END})
```

> [!tip] LangChain 用户迁移建议
> 如果你有 LangChain 代码，不建议直接重写。新功能用 LangGraph 开发，旧代码等有重构需求时再迁移。LangGraph 可以调用 LangChain 的 Tool，生态兼容。

---

### 2.3 CrewAI（Multi-Agent 友好，但可控性弱）

==专为 Multi-Agent 设计==。每个 Agent 有 role / goal / backstory，用自然语言声明，LLM 负责协调。

| 维度 | 说明 |
|------|------|
| 核心抽象 | Agent（角色）+ Task（任务）+ Crew（团队） |
| 强项 | 代码最少，==role-based 声明最自然==，Multi-Agent 场景上手快 |
| 弱项 | 见下方 |
| 适用 | 明确的 Multi-Agent 协作（研究员+写手+编辑），PoC 和 Demo |

**真实弱项（为什么生产慎用）**：

1. **控制流不可预测**：LLM 决定谁做什么、做多少轮，每次结果可能不同。同一个请求跑两次，执行顺序可能不一样。
2. **调试噩梦**：出问题了，不知道是 LLM 理解任务偏差、还是某个 Agent 工具调用失败、还是任务分配有问题。
3. **"看起来能跑"≠"可靠"**：Demo 时 Agent 之间的协作看起来很神奇，生产环境跑几百次后失败率高。
4. **API 不稳定**：相对年轻，迭代快。

```python
researcher = Agent(role="Researcher", goal="...", tools=[search_tool])
writer = Agent(role="Writer", goal="...")
crew = Crew(agents=[researcher, writer], tasks=[task1, task2])
result = crew.kickoff()
```

---

### 2.4 AutoGen（Microsoft，研究场景优先）

==对话式 Multi-Agent==。Agent 之间通过对话协作——不是结构化调度，而是真的在"开会"。

| 维度 | 说明 |
|------|------|
| 核心抽象 | ConversableAgent + GroupChat |
| 强项 | ==代码生成场景强==（Agent 生成代码，另一个 Agent 直接执行并反馈）、探索性问题效果好 |
| 弱项 | 对话式协作可控性最差、长对话容易跑偏、生产部署复杂、护栏难加 |
| 适用 | 研究、代码生成实验、复杂推理讨论——==不适合对外产品== |

**什么时候选 AutoGen**：你做研究，需要多个 Agent 相互质疑、反驳、讨论，最终收敛到答案。或者你做内部代码助手，容忍一定不确定性。

---

### 2.5 LlamaIndex（数据/RAG 优先）

==以数据为中心==的 Agent 框架。强项是文档处理和 RAG，Agent 能力是附加的。

| 维度 | 说明 |
|------|------|
| 核心抽象 | Index / QueryEngine / Agent |
| 强项 | ==RAG 索引建设丰富==（Tree / Knowledge Graph / Vector），文档解析管道成熟 |
| 弱项 | Agent 能力相对弱（不如 LangGraph），不擅长复杂编排 |
| 适用 | 重 RAG 的 Agent 应用（详见 [[RAG基础与架构]]）——"工具用知识库"而非"工具用外部系统" |

---

## 三、Java 生态：Spring AI（==Java 工程师重点==）

==Java 后端要做 AI 应用基本就是 Spring AI==。

| 维度 | 说明 |
|------|------|
| 语言 | Java |
| 核心抽象 | ChatClient / Tool / VectorStore / RAG |
| 强项 | ==与 Spring 生态无缝集成==、Spring Boot 风格、Java 工程师零门槛 |
| 弱项 | 相对 Python 生态成熟度低、尖端模式（CrewAI 风格的 Multi-Agent）较弱 |
| 适用 | ==Java 后端集成 LLM 能力==、企业级应用 |

```java
@Component
public class CustomerSupportService {
    private final ChatClient chatClient;

    public String chat(String userQuery) {
        return chatClient.prompt()
            .user(userQuery)
            .functions("searchKnowledge", "queryOrder")
            .call()
            .content();
    }
}
```

主要模块：
- `spring-ai-openai` / `spring-ai-anthropic` / `spring-ai-qwen`：LLM 客户端
- `spring-ai-rag`：RAG 流水线
- `spring-ai-vectorstore-*`：向量库适配（Milvus / pgvector / Redis 等）
- `spring-ai-mcp`：MCP 协议支持

==Spring AI 1.0 GA（2025 年 5 月）==开始，Java 工程师做 AI 应用首选这个。

---

## 四、国产框架（中文场景实例）

### 4.1 OpenClaw（龙虾）

==面向企业 IM 场景==的 Agent 框架，适合飞书/企微部署。

#### 核心特点

**多 Agent 路由（bindings）**：基于 `channel + accountId + peer` 三元组精准路由消息到不同 Agent，支持"最具体优先"原则。

```json
{
  "bindings": [{
    "agentId": "CodeReview",
    "match": {
      "channel": "feishu",
      "accountId": "cli_xxx",
      "peer": { "type": "group", "id": "oc_xxx" }
    }
  }]
}
```

**Gateway 网关架构**：飞书消息 → Gateway（WebSocket 长连接）→ Agent → LLM → 回复。WebSocket 而非轮询。

**8 个配置文件**：AGENTS.md（行为）/ SOUL.md（性格）/ TOOLS.json（工具）/ SKILLS.json（技能）/ MEMORY.json / SESSION.json / ROUTER.json / CONFIG.json。

**Agent 是 per-session 瞬态实例**：每对话完整加载-执行-销毁，==配置实时生效==。

**Session 优化**：
- ==Compaction==：接近 context 上限时提取重要信息写 Memory，持久化
- ==Pruning==：每次发 LLM 前临时裁剪旧 tool 结果，不持久化

**多 Agent 协作**：
- `sessions_send`：发消息给另一 Agent，同步等回复
- `sessions_spawn`：派生新 Agent 实例，异步独立运行

#### Memory 系统

OpenClaw 用 ==SQLite + FTS5 + sqlite-vec==（向量检索）实现 Memory（详见 [[Agent 核心概念#五、Memory 系统]]）。

### 4.2 Hermes（自进化）

==Nous Research 出品==的自进化 Agent 框架，核心理念"用得越多越聪明"。

#### 核心特点

**自进化机制**：任务完成后自动评估"是否值得沉淀为 Skill"——
1. 任务复杂度超阈值（步骤多、多工具组合）——==具体阈值以项目实现为准,框架可配==
2. 执行路径与已有 Skill 相似度低（新路径）
3. 任务成功完成

满足条件就把 Thought/Action 序列==自动提炼为 Markdown Skill==，下次类似任务直接复用。

**与手动 Skills 的对比**：

| 维度 | OpenClaw（手动） | Hermes（自动） |
|------|----------------|--------------|
| Skill 来源 | 开发者编写 | 任务执行自动提炼 |
| 质量 | 高（精心设计） | 中（贴近实际但需审核） |
| 维护 | 持续更新 | 自动迭代 |

**三层记忆系统**：
- ==对话历史层==（SQLite conversations 表）—— 当前会话
- ==检索层==（FTS5 全文检索）—— 跨会话索引
- ==摘要层==（LLM 自动生成 Markdown）—— 长对话压缩

**安全机制（==框架强制==，不依赖 LLM 自判断）**：
1. 每个工具调用需用户预先授权
2. 危险命令（rm/Shell/付费 API）必须人工审批
3. 代码执行在 ==Docker 容器==隔离
4. 上下文扫描检测 Prompt 注入特征

**广泛兼容**：
- ==LiteLLM 200+ 模型==开箱即用
- 多端：Telegram / Discord / Slack / Web UI

### 4.3 OpenClaw vs Hermes 对比

| 维度 | OpenClaw | Hermes |
|------|---------|--------|
| 安全机制 | LLM 判断 | 框架强制 |
| Skills | 手动编写 | 自动提炼 |
| 记忆检索 | sqlite-vec 向量 | FTS5 关键词 + LLM 摘要 |
| 模型支持 | 手动配 | LiteLLM 200+ |
| 多端 | 飞书 / 企微 | TG / Discord / Slack |
| 路由 | 多 Agent bindings 精准 | 单 Agent 为主 |
| 适用 | 企业内部、需要精确控制 | 个人助手、自适应学习 |

==都支持 MCP 协议==——工具层可以复用，不存在生态锁定。

---

## 五、选型决策树

```
第一步：语言栈
├── Java → Spring AI（没得选，生态唯一成熟选择）
└── Python → 第二步

第二步：是做产品还是做实验/Demo？
├── 实验/Demo/PoC
│   ├── 需要 Multi-Agent 协作    → CrewAI（代码最少）
│   ├── 代码生成+自动执行        → AutoGen
│   └── 单 Agent + 丰富集成      → LangChain
└── 产品（要上线、要可靠）→ 第三步

第三步：主要挑战是什么？
├── 任务边界清晰，能画出流程图   → LangGraph（生产首选）
├── 主要挑战是 RAG/文档处理      → LlamaIndex
└── 任务边界模糊，需要 Agent 自己探索 → LangGraph + Reflection
    （不要选 CrewAI：可控性太差上不了生产）
```

**反向选型：什么情况千万别选**

| 情况 | 不要选 | 原因 |
|------|--------|------|
| 要上线到用户的产品 | AutoGen | 对话式，每次结果不同，护栏难加 |
| 要上线到用户的产品 | CrewAI（单独用） | 执行顺序不确定，生产失败率高 |
| Java 项目 | LangChain/LangGraph | Python only，集成痛苦 |
| 任务 < 5 个工具、无 Multi-Agent | 任何重框架 | 直接用 SDK 更清晰、更好调试 |
| 主要是 RAG 任务 | LangGraph（单独用） | 为了用 RAG 引入复杂状态图，杀鸡用牛刀 |

**各框架适合的项目规模**

| 框架 | PoC | 小项目 | 生产级 | 企业级 |
|------|:---:|:------:|:------:|:------:|
| LangChain | ✅ | ✅ | ⚠️ API 不稳定 | ❌ |
| LangGraph | ✅ | ✅ | ✅ | ✅ |
| CrewAI | ✅ | ⚠️ | ❌ | ❌ |
| AutoGen | ✅ | ⚠️ | ❌ | ❌ |
| LlamaIndex | ✅ | ✅ | ✅（RAG 场景） | ✅（RAG） |
| Spring AI | ✅ | ✅ | ✅ | ✅ |

---

## 六、Java 工程师的实战建议

==如果你的求职方向是 Java + Agent==：

1. **必学**：==Spring AI==（Java 集成的事实标准）
2. **了解**：LangGraph 的状态图思想（复杂 Agent 通用范式，跨语言）
3. **关注**：MCP 协议（[[Agent 核心概念#四、MCP 协议]]）—— Spring AI 已支持
4. **加分**：能讲清 LangChain → LangGraph 的演进、Spring AI 的 RAG 实现、Multi-Agent 编排

==面试常见误区==：直接背 LangChain 的 API 没用，==重要的是讲清楚 Agent 框架解决了什么工程难题==（循环控制、工具调用、Memory、可观测性）——本质和 [[Harness Engineering]] 是一回事。

---

## 相关链接

- [[Agent 核心概念]] — Agent 通用概念（ReAct / Function Calling / Memory）
- [[Agent 工程实践]] — Agent 工程编排（DSL+DAG / Multi-Agent / 可观测性）
- [[Agent Skills 体系]] — Skills 渐进式披露原理
- [[Harness Engineering]] — 框架背后的通用 Harness 思想
- [[AI 编程工具]] — Claude Code / Cursor 等的"Agent 即产品"形态
