---
module: LLM
tags: [LLM, MOC, Prompt, Harness, Function Calling]
difficulty: hard
last_reviewed: 2026-05-28
---

# LLM 索引 MOC (Map of Content)

大模型（LLM）基础层——模型原理、工程框架、工具调用协议。

> ==Agent 体系已独立到 [[wiki/Agent/]] 目录==，见 [[Agent索引_MOC]]。
> RAG 体系已独立到 [[wiki/RAG/]] 目录。

---

## 🗺️ 知识体系导航

### 1. 基础理论

 LLM 基础与训练
Transformer 架构、Self-Attention、训练三阶段（预训练 → SFT → RLHF/DPO）、LoRA/QLoRA 微调、推理优化（KV Cache / PagedAttention / 量化）、MoE 架构、Token 经济学。
👉 **[[LLM 基础与训练]]**

### 2. 工程框架

 Prompt Engineering
Prompt 核心技术（Few-shot / CoT / ToT）、Fine-tuning vs RAG vs Prompting 决策框架。
👉 **[[Prompt Engineering]]**

 Harness Engineering
==LLM 工程的统一框架==。从 Prompt → Context → Harness 的三代进化、四大原则、六大核心组件、控制流模式（ReAct/Plan-and-Execute/Reflection）、Generator-Evaluator 架构、==Prompt 分层架构==（PromptAssembler 组装顺序 / 三层文件覆盖）、企业级实战经验。
👉 **[[Harness Engineering]]**

### 3. 工具调用协议

 Function Calling
==工具调用协议详解==——请求结构（tools schema 怎么写）、四种消息角色（system/user/assistant/tool）、响应结构（tool_calls 字段）、多轮拼接、并行调用、==Image Tool Result（多模态返回）==、==用户输入图片 + 历史裁剪==、厂商差异（OpenAI/Anthropic/Qwen）、协议层可靠性。
👉 **[[Function Calling]]**

---

## 🛤️ 学习路径建议

### Stage 1 · 模型基础

1. **[[LLM 基础与训练]]** — Transformer / 训练 / 推理优化
2. **[[Prompt Engineering]]** — 如何驾驭 LLM
3. **[[Harness Engineering]]** — Agent 时代的工程方法论
4. **[[Function Calling]]** — 工具调用协议（进入 Agent 体系的桥梁）

### 继续学习

→ **[[Agent索引_MOC]]** — Agent 推理框架 / 工具协议 / Memory / Skills / 工程实践

---

> **学习笔记提示**：
> LLM 工程的核心不是"调参"，而是==理解模型能力边界后的系统设计==。
> ==RAG 解决知识时效性，Agent 解决多步推理，Harness 解决可靠性==。三者组合才是生产级 AI 系统的完整答案。

## 相关链接

- [[Agent索引_MOC]] — Agent 完整体系（推理框架 / 协议 / Memory / Skills / 工程实践）
- [[wiki/RAG/]] — RAG 完整体系
- [[Java基础索引_MOC]] — Java 后端是 LLM 应用的工程基础
- [[MySQL索引_MOC]] — 向量数据库 vs 关系数据库的选型
- [[Redis索引_MOC]] — 缓存在 RAG 系统中的作用
- [[Spring索引_MOC]] — Spring AI 集成 LLM
