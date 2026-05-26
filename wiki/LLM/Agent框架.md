---
module: LLM
tags: [LLM, Agent, 框架, LangGraph, CrewAI, AutoGen, Hermes, OpenClaw]
difficulty: medium
last_reviewed: 2026-05-25
---

# Agent 框架

> 主流 Agent 框架的对比与选型，从国际大厂（LangChain/LangGraph/CrewAI/AutoGen/LlamaIndex）到国产框架（Hermes/OpenClaw/Spring AI）的完整画像。
>
> Agent 通用概念（ReAct/Function Calling/Memory）见 [[Agent核心概念]]；通用 Harness 框架见 [[Harness Engineering]]。

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

---

## 二、国际主流框架

### 2.1 LangChain（生态最大）

==开创者==。把 LLM 应用拆成 Chain（链式调用）+ Agent（决策循环）+ Memory + Tool 等组件，用 Python 拼装。

| 维度 | 说明 |
|------|------|
| 语言 | Python / TypeScript |
| 核心抽象 | Chain / Agent / Tool / Memory |
| 强项 | ==300+ 集成==（向量库、LLM、API、数据库），生态最大 |
| 弱项 | 抽象层级多、版本变化快、==代码看着像"魔法"==、调试难 |
| 适用 | 快速 PoC、需要丰富集成、不在乎"优雅度" |

```python
from langchain.agents import initialize_agent, Tool

tools = [Tool(name="search", func=search_fn, description="...")]
agent = initialize_agent(tools, llm, agent_type="zero-shot-react")
result = agent.run("帮我查一下...")
```

### 2.2 LangGraph（==2024 推荐==）

==LangChain 团队的"重新出发"==。承认 Agent 不是简单 Chain，而是==状态图==——节点是步骤、边是条件流转。

| 维度 | 说明 |
|------|------|
| 核心抽象 | StateGraph（状态图）+ Node（节点）+ Edge（边） |
| 强项 | ==显式控制流==、支持循环和条件分支、可视化调试好 |
| 弱项 | 学习曲线陡（要思考状态图） |
| 适用 | ==复杂 Agent==（多步推理、Multi-Agent、需要可观测的生产系统） |

```python
from langgraph.graph import StateGraph

graph = StateGraph(AgentState)
graph.add_node("retrieve", retrieve_node)
graph.add_node("generate", generate_node)
graph.add_edge("retrieve", "generate")
graph.add_conditional_edges("generate", should_retry,
                            {"retry": "retrieve", "done": END})
```

==生产首推==：LangGraph 的状态图比 LangChain 的 Chain 更适合复杂 Agent。

### 2.3 CrewAI（Multi-Agent 友好）

==专为 Multi-Agent 设计==。每个 Agent 有 role / goal / backstory，组成 "Crew"（团队）协作。

| 维度 | 说明 |
|------|------|
| 核心抽象 | Agent + Task + Crew |
| 强项 | ==Multi-Agent 编排最友好==、role-based 设计自然 |
| 弱项 | 单 Agent 场景过度设计、灵活性弱于 LangGraph |
| 适用 | 明确的 Multi-Agent 场景（如"研究员 + 写手 + 编辑"协作） |

```python
researcher = Agent(role="Researcher", goal="...", tools=[search_tool])
writer = Agent(role="Writer", goal="...")
crew = Crew(agents=[researcher, writer], tasks=[task1, task2])
result = crew.kickoff()
```

### 2.4 AutoGen（Microsoft）

==对话式 Multi-Agent==。Agent 之间通过对话协作（不是结构化调度）。

| 维度 | 说明 |
|------|------|
| 核心抽象 | ConversableAgent + GroupChat |
| 强项 | ==代码生成场景强==（CodeBlock 自动执行）、研究友好 |
| 弱项 | 对话式协作可控性弱、生产部署复杂 |
| 适用 | 研究、代码生成、复杂讨论 |

### 2.5 LlamaIndex（数据/RAG 优先）

==以数据为中心==的 Agent 框架。强项是文档处理和 RAG。

| 维度 | 说明 |
|------|------|
| 核心抽象 | Index / QueryEngine / Agent |
| 强项 | ==RAG 索引建设丰富==（Tree / Knowledge Graph / Vector），文档解析强 |
| 弱项 | Agent 能力相对弱（不如 LangGraph） |
| 适用 | 重 RAG 的 Agent 应用（详见 [[RAG基础与架构]]） |

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

OpenClaw 用 ==SQLite + FTS5 + sqlite-vec==（向量检索）实现 Memory（详见 [[Agent核心概念#五、Memory 系统]]）。

### 4.2 Hermes（自进化）

==Nous Research 出品==的自进化 Agent 框架，核心理念"用得越多越聪明"。

#### 核心特点

**自进化机制**：任务完成后自动评估"是否值得沉淀为 Skill"——
1. 任务复杂度超阈值（步骤多、多工具组合）
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
你的场景？

├── Java 后端集成 LLM
│   └→ ==Spring AI==（生态唯一选择）
│
├── Python 复杂 Agent / Multi-Agent
│   ├── 需要状态图、显式控制流
│   │   └→ ==LangGraph==（推荐）
│   ├── 明确的 role-based 协作（研究员+写手）
│   │   └→ ==CrewAI==
│   └── 代码生成、研究场景
│       └→ AutoGen
│
├── Python 重 RAG 应用
│   └→ ==LlamaIndex==（数据为中心）
│
├── Python 快速 PoC、丰富集成
│   └→ LangChain（==但生产建议升级到 LangGraph==）
│
└── 中文 / 企业 IM 场景
    ├── 飞书 / 企微部署、需精确权限控制
    │   └→ ==OpenClaw==
    └── Telegram / Discord、个人自适应
        └→ ==Hermes==
```

---

## 六、Java 工程师的实战建议

==如果你的求职方向是 Java + Agent==：

1. **必学**：==Spring AI==（Java 集成的事实标准）
2. **了解**：LangGraph 的状态图思想（复杂 Agent 通用范式，跨语言）
3. **关注**：MCP 协议（[[Agent核心概念#四、MCP 协议]]）—— Spring AI 已支持
4. **加分**：能讲清 LangChain → LangGraph 的演进、Spring AI 的 RAG 实现、Multi-Agent 编排

==面试常见误区==：直接背 LangChain 的 API 没用，==重要的是讲清楚 Agent 框架解决了什么工程难题==（循环控制、工具调用、Memory、可观测性）——本质和 [[Harness Engineering]] 是一回事。

---

## 相关链接

- [[Agent核心概念]] — Agent 通用概念（ReAct / Function Calling / Memory）
- [[Agent工程实践]] — Agent 工程编排（DSL+DAG / Multi-Agent / 可观测性）
- [[Agent Skills体系]] — Skills 渐进式披露原理
- [[Harness Engineering]] — 框架背后的通用 Harness 思想
- [[AI编程工具]] — Claude Code / Cursor 等的"Agent 即产品"形态
