---
module: LLM
tags: [LLM, MOC, Agent, RAG]
difficulty: hard
last_reviewed: 2026-05-09
---

# LLM 与 Agent MOC (Map of Content)

大模型（LLM）、检索增强生成（RAG）、智能体（Agent）是当前 AI 工程的三大核心支柱。本模块覆盖从模型原理到生产落地的完整知识体系。

---

## 🗺️ 知识体系导航

### 1. 模型基础

 LLM 基础与训练
Transformer 架构、Self-Attention、训练三阶段（预训练 → SFT → RLHF/DPO）、LoRA/QLoRA 微调、推理优化（KV Cache / PagedAttention / 量化）、MoE 架构。
👉 **[[LLM基础与训练]]**

 Prompt 与 Harness
Prompt Engineering 核心技术（Few-shot / CoT / ToT）、Fine-tuning vs RAG vs Prompting 决策框架。
👉 **[[Prompt与Harness]]**

 Harness Engineering
从 Prompt 到 Harness 的三代进化、四大原则、Generator-Evaluator 架构。
👉 **[[Harness Engineering]]**

### 2. RAG 技术体系

 RAG 基础与架构
RAG 是什么、离线+在线两阶段架构、文档解析、分片策略、Embedding 选型。
👉 **[[RAG基础与架构]]**

 RAG 检索策略
查询理解与意图识别、数据预处理、四层检索框架、BM25 原理、混合检索、RRF 融合、重排（Rerank）。
👉 **[[RAG检索策略]]**

 RAG 向量与 Embedding
向量数据库选型对比（Milvus / Pinecone / Qdrant / ES）、Embedding 模型选型（BGE / Jina / Qwen3）、召回率评估体系。
👉 **[[RAG向量与Embedding]]**

 RAG 高级技术
智能体 RAG（Agentic RAG）、自反思 RAG（Self-Reflection）、知识图谱增强（GraphRAG）、优化策略分类与组合、性能优化。
👉 **[[RAG高级技术]]**

### 3. Agent 技术体系

 Agent 核心概念
Agent 架构（感知→推理→行动）、ReAct 模式、Function Calling、MCP 协议、Memory 系统、Multi-Agent。
👉 **[[Agent核心概念]]**

 Agent Skills 体系
Skills 定义、渐进式披露原理、语义匹配机制、SKILL.md 加载机制、创建流程。
👉 **[[Agent Skills体系]]**

 Agent 工程实践
DSL+DAG 工作流编排、LangChain/LangGraph、可观测性、成本控制、安全防护、Agent 评估。
👉 **[[Agent工程实践]]**

### 4. 框架与工具

 框架选型
OpenClaw vs Hermes 对比与选型建议。
👉 **[[框架选型]]**

 OpenClaw 框架
多 Agent 路由、Gateway 网关、Memory 管理。
👉 **[[OpenClaw框架]]**

 Hermes 框架
自进化 Agent 框架、经验提炼机制。
👉 **[[Hermes框架]]**

 AI 编程工具
Claude Code / Codex / Cursor 对比、AI 编程工具与传统 IDE 的本质区别。
👉 **[[AI编程工具]]**

---

## 🛤️ 学习路径建议

### Stage 1 · 模型基础（理解 LLM 的能力边界）

1. **[[LLM基础与训练]]** — Transformer / 训练 / 推理优化
2. **[[Prompt与Harness]]** — 如何高效驾驭 LLM

### Stage 2 · RAG（让 LLM 用上外部知识）

3. **[[RAG基础与架构]]** — 整体架构和数据管道
4. **[[RAG检索策略]]** — 检索质量是 RAG 的生命线
5. **[[RAG向量与Embedding]]** — 向量数据库和 Embedding 选型
6. **[[RAG高级技术]]** — 进阶：Agentic RAG / GraphRAG

### Stage 3 · Agent（让 LLM 自主行动）

7. **[[Agent核心概念]]** — 理解 Agent 的架构和推理模式
8. **[[Agent工程实践]]** — 生产环境的工程化挑战
9. **[[Agent Skills体系]]** — 可复用的能力单元

### Stage 4 · 框架与工具（选型和工程效率）

10. **[[Harness Engineering]]** — 最新的 LLM 工程方法论
11. **[[框架选型]]** + **[[AI编程工具]]** — 实际项目的技术选型

---

> **学习笔记提示**：
> LLM 工程的核心不是"调参"，而是**理解模型能力边界后的系统设计**。RAG 解决知识时效性问题，Agent 解决多步推理问题，Harness 解决可靠性问题。三者组合才是生产级 AI 系统的完整答案。

## 相关链接

- [[Java基础索引_MOC]] — Java 后端是 LLM 应用的工程基础
- [[MySQL索引_MOC]] — 向量数据库 vs 关系数据库的选型
- [[Redis索引_MOC]] — 缓存在 RAG 系统中的作用
- [[Spring索引_MOC]] — Spring AI 集成 LLM
