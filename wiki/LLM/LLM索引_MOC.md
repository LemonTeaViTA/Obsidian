---
module: LLM
tags: [LLM, MOC, Agent, RAG]
difficulty: hard
last_reviewed: 2026-05-25
---

# LLM 与 Agent MOC (Map of Content)

大模型（LLM）、检索增强生成（RAG）、智能体（Agent）是当前 AI 工程的三大核心支柱。本目录覆盖从模型原理到工程框架到产品工具的完整知识体系。

> RAG 体系已独立到 [[wiki/RAG/]] 目录；数据/文档解析基础见 [[wiki/数据格式/]] 和 [[wiki/文档解析/]]。

---

## 🗺️ 知识体系导航

### 1. 基础理论

 LLM 基础与训练
Transformer 架构、Self-Attention、训练三阶段（预训练 → SFT → RLHF/DPO）、LoRA/QLoRA 微调、推理优化（KV Cache / PagedAttention / 量化）、MoE 架构、Token 经济学。
👉 **[[LLM基础与训练]]**

### 2. 工程框架（==给 LLM 套笼子==）

 Prompt Engineering
Prompt 核心技术（Few-shot / CoT / ToT）、Fine-tuning vs RAG vs Prompting 决策框架。
👉 **[[Prompt Engineering]]**

 Harness Engineering
==LLM 工程的统一框架==。从 Prompt → Context → Harness 的三代进化、四大原则、六大核心组件、控制流模式（ReAct/Plan-and-Execute/Reflection）、Generator-Evaluator 架构、企业级实战经验。
👉 **[[Harness Engineering]]**

### 3. Agent 体系

 Agent 核心概念
==聚合入口==——Agent 架构、推理模式（ReAct/Plan-and-Execute/Reflection）、四个核心模块、分层架构总览。具体实现/协议/方法论拆到下面四个独立文档。
👉 **[[Agent核心概念]]**

 ReAct 与 Harness 实现
==最底层认知==——LLM 的本质（无状态纯函数）、谁干了什么完整分工对照、屋里写纸条 + 屋外秘书类比、60 行极简 ReAct 实现、工具识别两种方式（传统 prompt vs Function Calling）。
👉 **[[ReAct 与 Harness 实现]]**

 Plan-and-Execute 实现
==与 ReAct 配对的另一种推理框架==——80 行 Python 完整实现、Plan schema 三种递进设计（线性/DAG/输入输出绑定）、Replan 机制、与 ReAct 的混合架构（Claude Code Plan Mode）、与 LangGraph 的关系。
👉 **[[Plan-and-Execute 实现]]**

 Function Calling 协议
==工具调用协议详解==——请求结构（tools schema 怎么写）、四种消息角色（system/user/assistant/tool）、响应结构（tool_calls 字段）、多轮拼接、并行调用、厂商差异（OpenAI/Anthropic/Qwen）、协议层可靠性。
👉 **[[Function Calling]]**

 MCP 协议
==工具标准化接入协议==（Anthropic 推，2026 事实标准）——Host/Client/Server 三层架构、JSON-RPC 通信、写一个最简 MCP Server、主流 Server 生态（GitHub/Postgres/Slack/Puppeteer 等）、安全模型、与 A2A 协议的区别。
👉 **[[MCP 协议]]**

 Coding Agent 工具集
Claude Code / Cursor / Aider 等==实际提供的工具集==——文件操作 / 代码搜索 / 命令执行 / 项目操作 / 联网类的内置工具分类、MCP 动态工具的接入、工具设计原则、主流产品工具集对比。
👉 **[[Coding Agent 工具集]]**

 Agent Skills 体系
Skills 定义、渐进式披露原理、语义匹配机制、SKILL.md 加载机制、创建流程。
👉 **[[Agent Skills体系]]**

 Agent Memory 系统
==Agent 跨会话记住事的核心==——三层架构（L1/L2/L3）、JSONL 会话日志、MEMORY.md + SQLite 双层存储设计、==L2 → L3 转换机制==（触发条件 / 转换 prompt / 重要性判断 / 两个常见陷阱）、Agent 使用 Memory 的三个工具（memory_search / memory_get / save_memory）、生产实现对比（Claude Code / Cursor / OpenClaw / Hermes）。
👉 **[[Agent Memory 系统]]**

 Agent 工程实践
DSL+DAG 工作流编排、Multi-Agent 架构、CLI 设计、LangChain 使用、微服务与可观测性、Agent 可靠性设计、2026 新趋势。
👉 **[[Agent工程实践]]**

 Agent 框架
==国际主流==（LangChain / LangGraph / CrewAI / AutoGen / LlamaIndex）+ ==Java 生态==（Spring AI）+ ==国产框架==（OpenClaw / Hermes）的完整对比与选型决策树。
👉 **[[Agent框架]]**

### 4. RAG 体系（已独立到 wiki/RAG/）

> [!info] RAG 文件位置
> RAG 完整体系已迁出到 `wiki/RAG/` 独立目录。wikilink 不依赖路径，引用仍然有效。

 RAG 基础与架构
RAG 是什么、离线+在线两阶段架构、文档解析、分片策略、Embedding 选型。
👉 **[[RAG基础与架构]]**

 RAG 检索策略
查询理解（Function Calling / Agentic RAG / 查询改写 / 反问澄清）、四层检索框架、BM25 原理、混合检索、RRF 融合、重排（Rerank）、多轮对话检索去重。
👉 **[[RAG检索策略]]**

 RAG 向量与 Embedding
向量数据库选型（Milvus / Pinecone / Qdrant / ES）、KNN vs ANN 算法细节、Embedding 模型选型（LLM-backbone 主导：Qwen3-Embedding / NV-Embed / BGE-M3）、元数据过滤、召回率评估。
👉 **[[RAG向量与Embedding]]**

 RAG 高级技术
智能体 RAG（Agentic RAG）、自反思 RAG（Self-Reflection）、知识图谱增强（GraphRAG）、多模态 RAG（ColPali）、优化策略分类与组合、性能优化。
👉 **[[RAG高级技术]]**

 多轮对话
对话存储设计（双表 schema）、上下文窗口管理（system + history + retrieval + query）、多轮检索衔接（consumed_ids / 指代消解 / 查询改写 / 重复缓存）。
👉 **[[多轮对话]]**

 RAG 评估
检索质量指标（Recall@K / MRR / NDCG）、生成质量（RAGAS）、评估数据集构建、人工评估、A/B 测试、生产监控、Drift 检测。
👉 **[[RAG评估]]**

 幻觉与置信度
RAG 幻觉三种类型、四种检测方法（引用对齐 / NLI / 自一致性 / LLM-as-Judge）、三层置信度评分、Verify-Then-Answer 流水线、拒绝回答策略、Citation 引用溯源。
👉 **[[幻觉与置信度]]**

 RAG 安全
攻击面（直接注入 / 间接注入 / 知识库投毒 / 多租户越权）、PII 三道关、多租户隔离三方案、GDPR/HIPAA 合规、Constitutional AI 在 RAG 的应用。
👉 **[[RAG安全]]**

 Code RAG
代码与文档 RAG 的差异、AST-aware 切分（tree-sitter）、Code Embedding（Qwen2.5-Coder / Voyage-code）、仓库级索引（Cursor / Continue）、调用图增强（LSP）、Claude Code 的"无索引"模式。
👉 **[[Code RAG]]**

### 5. AI 产品形态

 AI 编程工具
Claude Code / Codex / Cursor 对比、AI 编程工具与传统 IDE 的本质区别、Claude Code 概念体系（Commands / Skills / Rules / Hooks / Subagents / Plugins）、AI 辅助知识管理方法论。
👉 **[[AI编程工具]]**

---

## 🛤️ 学习路径建议

### Stage 1 · 模型基础

1. **[[LLM基础与训练]]** — Transformer / 训练 / 推理优化
2. **[[Prompt Engineering]]** — 如何驾驭 LLM
3. **[[Harness Engineering]]** — Agent 时代的工程方法论

### Stage 2 · RAG（让 LLM 用上外部知识）

4. **[[RAG基础与架构]]** — 整体架构和数据管道
5. **[[RAG检索策略]]** — 检索质量是 RAG 的生命线
6. **[[RAG向量与Embedding]]** — 向量数据库和 Embedding 选型
7. **[[RAG高级技术]]** — 进阶：Agentic RAG / GraphRAG / 多模态
8. **[[多轮对话]]** — 对话存储 + 上下文窗口 + 检索衔接
9. **[[RAG评估]] + [[幻觉与置信度]] + [[RAG安全]]** — 生产工程"压舱石"
10. **[[Code RAG]]** — 代码场景特化（Cursor/Claude Code 核心）

### Stage 3 · Agent（让 LLM 自主行动）

11. **[[Agent核心概念]]** — 理解 Agent 的架构和推理模式
12. **[[ReAct 与 Harness 实现]]** — 60 行 Python 看清 LLM/Harness 分工 + 工具识别
13. **[[Plan-and-Execute 实现]]** — 80 行 Python + Plan schema + Replan + 与 ReAct 混合
14. **[[Function Calling]]** — 工具调用协议详解
15. **[[MCP 协议]]** — 外部工具标准化接入（Host/Client/Server 三层 + 主流 Server 生态）
16. **[[Coding Agent 工具集]]** — Claude Code/Cursor 实际工具集（文件 / 搜索 / 执行 / RAG / Web / MCP）
17. **[[Agent Skills体系]]** — 可复用的能力单元
18. **[[Agent Memory 系统]]** — 三层记忆架构 + L2→L3 转换机制
19. **[[Agent工程实践]]** — 生产环境的工程化（含失败处理 / 权限控制 / 可靠性设计）
20. **[[Agent框架]]** — 框架选型（LangGraph / Spring AI / 等）

### Stage 4 · 产品形态

21. **[[AI编程工具]]** — Claude Code / Cursor 等的产品落地（CLI vs IDE 插件 vs 桌面应用）

---

> **学习笔记提示**：
> LLM 工程的核心不是"调参"，而是==理解模型能力边界后的系统设计==。==RAG 解决知识时效性，Agent 解决多步推理，Harness 解决可靠性==。三者组合才是生产级 AI 系统的完整答案。

## 相关链接

- [[Java基础索引_MOC]] — Java 后端是 LLM 应用的工程基础
- [[MySQL索引_MOC]] — 向量数据库 vs 关系数据库的选型
- [[Redis索引_MOC]] — 缓存在 RAG 系统中的作用
- [[Spring索引_MOC]] — Spring AI 集成 LLM
