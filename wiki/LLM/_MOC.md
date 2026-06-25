---
module: LLM
tags: [LLM, MOC, Prompt, Harness, Function Calling]
difficulty: hard
last_reviewed: 2026-06-01
---

# LLM 索引 MOC (Map of Content)

大模型（LLM）基础层——模型原理、工程框架、工具调用协议。

> ==Agent 体系已独立到 [[_MOC|Agent 体系]] 目录==，见 [[_MOC]]。
> RAG 体系已独立到 [[RAG基础与架构|RAG 体系]] 目录。

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
==工具调用协议详解==——请求结构、四种消息角色、响应结构、多轮拼接、并行调用、厂商差异、协议层可靠性，以及多模态图片进出模型（Image Tool Result / 用户输入图片 / 历史图片裁剪）。
👉 **[[Function Calling]]**

---

## 🛤️ 学习路径建议

### Stage 1 · 模型基础

1. **[[LLM 基础与训练]]** — Transformer / 训练 / 推理优化
2. **[[Prompt Engineering]]** — 如何驾驭 LLM
3. **[[Harness Engineering]]** — Agent 时代的工程方法论
4. **[[Function Calling]]** — 工具调用协议（含多模态图片场景）

### 继续学习

→ **[[_MOC]]** — Agent 推理框架 / 工具协议 / Memory / Skills / 工程实践

---

> **学习笔记提示**：
> LLM 工程的核心不是"调参"，而是==理解模型能力边界后的系统设计==。
> ==RAG 解决知识时效性，Agent 解决多步推理，Harness 解决可靠性==。三者组合才是生产级 AI 系统的完整答案。

## 相关链接

- [[_MOC]] — Agent 完整体系（推理框架 / 协议 / Memory / Skills / 工程实践）
- [[RAG基础与架构|RAG 体系]] — RAG 完整体系
- [[_MOC]] — Java 后端是 LLM 应用的工程基础
- [[_MOC]] — 向量数据库 vs 关系数据库的选型
- [[_MOC]] — 缓存在 RAG 系统中的作用
- [[_MOC]] — Spring AI 集成 LLM


---

## 面试考点

### LLM 基础

- Transformer 的 Self-Attention 是怎么计算的？为什么要除以 √dk？
- Decoder-only 架构为什么成为 LLM 主流？和 Encoder-Decoder 有什么区别？
- 大模型训练的三个阶段是什么？
- RLHF 和 DPO 有什么区别？
- LoRA 微调的核心思想是什么？为什么能用很少的参数达到接近全量微调的效果？
- QLoRA 和 LoRA 有什么区别？NF4 量化是怎么回事？
- 什么场景下需要微调？什么场景下 RAG + Prompt 就够了？
- KV Cache 是什么？PagedAttention 解决了什么问题？
- Speculative Decoding 的原理是什么？
- Flash Attention 的核心思想是什么？为什么能加速 Attention 计算？
- vLLM 和 SGLang 有什么区别？各自适用什么场景？
- 量化（Quantization）是什么？GPTQ 和 AWQ 有什么区别？
- MoE（Mixture of Experts）的稀疏激活原理是什么？
- Mamba/SSM 和 Transformer 有什么区别？线性复杂度优势在哪？
- 为什么 128k context 不等于真正能用 128k？
- Prompt Engineering 有哪些核心技术？（Few-shot、CoT、ToT）
- Fine-tuning、RAG、Prompting 三者如何选择？
- LLM 幻觉产生的根本原因是什么？在 Agent 场景下有哪些缓解方法？
