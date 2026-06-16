---
module: Agent
tags: [Agent, 工程实践, CLI, LangChain, LangGraph, 2026趋势, Context Engineering]
difficulty: medium
last_reviewed: 2026-06-12
---

# Agent 工程实践

> Agent 工程实践的导航枢纽——Multi-Agent / 可靠性 / 安全 / 可观测 / 部署五个主题已拆为独立文档。本页还收录两个跨文档话题：**Context Engineering 范式转变** 和 **2025-2026 技术趋势**。

---

## 一、导航：已拆分的独立文档

| 主题 | 文档 | 核心内容 |
|------|------|---------|
| ==Multi-Agent 协作== | [[Multi-Agent 架构]] | 四种协作模式 / 三角色组合 / 冲突仲裁 / 何时该用 |
| ==可靠性设计== | [[Agent 可靠性设计]] | 死循环检测 / Fallback 四层 / 工具失败四层决策 |
| ==安全模型== | [[Agent 安全模型]] | HITL 三档 / PathGuard / CommandGuard / Prompt Injection |
| ==可观测性== | [[Agent 可观测性]] | 三层追踪 / 审计日志 / 成本控制 |
| ==部署与服务化== | [[Agent 部署与服务化]] | Durable Task Queue / Runtime API / Worker Pool |
| ==框架选型== | [[Agent 框架]] | LangChain / LangGraph / Spring AI / 国产框架对比 |
| ==工具型 CLI 设计== | [[AI 编程工具#2.5 CLI 的设计原则（给"我也想做一个 CLI 工具"的人）]] | 给 AI 调用的 CLI 五个原则（非交互/JSON输出/dry-run…） |

---

## 二、Context Engineering（跨话题概念）

**范式转变**：从"怎么写好一条 Prompt"到"如何给 LLM 组装最优的完整上下文"。Shopify CEO Tobi Lütke 和 Andrej Karpathy 共同带火了这个概念。

Agent 每次 LLM 调用中，Prompt 文本本身只占 ~5%，剩下 95% 是动态组装的上下文（工具描述、检索结果、Memory、对话历史…）。==真正决定 Agent 质量的是上下文的选择、排列和压缩策略==。

| 层 | 内容 | 技术 |
|----|------|------|
| 指令层 | System Prompt + 任务约束 | Harness Engineering、CLAUDE.md |
| 知识层 | 外部知识注入 | RAG |
| 记忆层 | 历史交互 | Memory 系统、对话摘要 |
| 工具层 | 可用能力描述 | Function Calling、MCP |

> [!tip] 面试高频
> 被问 Prompt Engineering 时主动提 Context Engineering 的演进——核心论点：**单次 Prompt 优化天花板低，真正的杠杆在上下文管理系统的设计**。

---

## 三、2025-2026 技术趋势

1. **A2A 协议**：Google 提出，解决 Agent-to-Agent 发现与协作（MCP 解决 Agent-to-Tool，A2A 解决 Agent-to-Agent）
2. **Browser Use / Computer Use**：Agent 操作桌面 GUI，打通没有 API 的内部系统——详见 [[MCP 协议概述#与 A2A 协议的区别]]
3. **长期记忆与个性化**：Agent 从无状态工具进化为有记忆的助手
4. **端侧 Agent**：Apple Intelligence / Gemini Nano，隐私敏感场景本地运行

---

## 相关链接

- [[Harness Engineering]] — Context Engineering 的工程方法论
- [[长上下文工程]] — 上下文管理的具体实现（Prompt Caching / Context Mode）
- [[Agent 框架]] — LangChain / LangGraph / Spring AI 选型
- [[AI 编程工具]] — Claude Code / Cursor 等产品对比 + CLI 设计原则
