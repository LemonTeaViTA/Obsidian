---
module: RAG
tags: [RAG, MOC]
last_reviewed: 2026-06-25
---

# RAG 体系 MOC

## 文档导航

- [[RAG基础与架构]] — RAG 核心架构、离线+在线流程
- [[分块策略]] — 四级分块体系与工程参数
- [[分块策略前沿]] — Contextual Retrieval / Late Chunking 前沿方案
- [[RAG向量与Embedding]] — Embedding 原理、模型选型、向量数据库
- [[RAG检索策略]] — 混合检索、RRF、Rerank
- [[RAG查询理解]] — 查询改写、多路召回
- [[RAG高级技术]] — Agentic RAG、Self-RAG、GraphRAG
- [[RAG评估]] — RAGAS 框架、检索质量指标
- [[幻觉与置信度]] — 幻觉检测、置信度评分、拒绝回答
- [[多轮对话]] — 上下文管理、指代消解
- [[对话压缩与记忆提取]] — 长对话压缩策略
- [[全文检索与分块教程]] — FTS5 + sqlite-vec 落地
- [[文档解析综述]] — OCR、表格识别、VLM 方案
- [[RAG安全]] — 越权、注入、隐私防护
- [[Code RAG]] — 代码库检索



---

## 面试考点

- RAG 是什么？解决了什么问题？
- RAG 和微调的区别？
- RAG 系统的架构是怎样的？
- AIGC、RAG、Agent 三者的区别和联系？
- PDF 多栏排版解析错乱怎么处理？
- OCR 把表格和代码全毁了怎么办？
- PPT 里的图片信息怎么提取？
- 固定 512 token 切分有什么问题？
- Overlap 设多少合适？怎么验证？
- chunk_size 应该怎么确定？
- 固定长度分块和语义分块的优缺点？
- 如何处理跨 chunk 的信息完整性问题？
- 多模态内容（图像、表格）如何在 RAG 中处理？
- embedding 维度选择对系统性能有什么影响？
- 如何解决向量检索中的语义漂移问题？
- 如何设计置信度评分机制来判断检索结果的可靠性？
- Embedding 模型怎么选？看哪些维度？
- 如何选择合适的向量数据库？Milvus、ES、Qdrant、pgvector 各自适用什么场景？
- 为什么需要混合检索？
- BM25 和向量检索的区别是什么？
- 混合检索结果怎么融合？RRF 是什么？
- 什么是重排（Rerank）？为什么需要？
- 用户 query 很短很模糊，检索效果差怎么办？
- 什么是 Contextual Retrieval？
- 智能体 RAG（Agentic RAG）是什么？什么时候用？
- 多文档场景下单 Agent 不够用怎么办？（SPD-RAG）
- 自反思 RAG（Self-Reflection RAG）是什么？
- GraphRAG 是什么？解决了传统 RAG 的什么问题？
- GraphRAG 的核心机制（社区检测 + 层次摘要）是怎么工作的？
- RAG 系统怎么评估效果？
- 向量数据库能用 MySQL 代替吗？
- RAG 系统的主要性能瓶颈在哪里？如何优化？
- RAG 检索到的知识与 LLM 预训练知识冲突时如何处理？
- 什么是 RAG 中的幻觉问题？如何预防？
- 多轮对话中如何处理指代消解（它、这个等）？
- Agent 的基本架构是什么？
- Agent 和传统 LLM Chain 的区别？
- ReAct 模式是怎么工作的？
- Agent 的规划能力（Planning）是如何实现的？
- Agent 如何处理工具调用失败的情况？
- Function Calling 是什么？怎么保证可靠性？
- MCP 协议是什么？解决了什么问题？
- Skills 是什么？和 Prompt 有什么区别？
- 为什么 Skills 不直接把所有内容都加载进去？
- Skills 的渐进式披露原理是什么？
- 怎么知道该调用哪个 Skill？（语义匹配机制）
- SKILL.md 是怎么被读进去的？
- 如何创建一个 Skill？六步流程了解吗？
- 创建 Skill 有哪些注意事项？
- Skills 和 GPTs、Rules 有什么区别？
- 如何写出一个高质量的 Skill？
- Agent 读取 Skill 时有哪些性能优化措施？
- Agent 执行 Skills 时有哪些安全机制？
- 在实际项目中，如何管理大量的 Skills？
- 如何设计安全的工具权限控制机制？
- Agent 的长期记忆怎么实现？
- Memory 和 RAG 有什么区别？
- 短期记忆、长期记忆、工作记忆分别对应什么技术实现？
- 为什么需要 Multi-Agent？
- Multi-Agent 的协作模式有哪些？
- A2A（Agent-to-Agent）是什么？和单 Agent 有什么区别？
- Agent 的可观测性怎么做？如何 debug 复杂的推理链？
- Agent 的成本控制策略有哪些？如何避免无限循环调用？
- 如何评估 Agent 的效果？有哪些 benchmark？
- Agent 在生产环境中的安全风险有哪些？如何防护？
- Agent 陷入死循环（反复调用同一工具或在两个状态间震荡）怎么检测和处理？
- 如何设计 Agent 的 Fallback 策略？所有工具都调用失败时怎么优雅降级？
- Agent 在多步推理中如何防止错误累积？（一步错步步错的问题）
- Prompt Injection 攻击有哪些类型？Agent 场景下如何防御？
- Context Engineering 是什么？和 Prompt Engineering 有什么区别？
- Computer Use / Browser Use 是什么？解决了什么问题？
- SWE-bench 和 GAIA 分别评估 Agent 的什么能力？
- LangChain 的三层架构是什么？六大核心模块分别是什么？
- LangChain 和 LangGraph 有什么区别？
- Agent 开发有哪四种方式？各自适用什么场景？
- Harness Engineering 是什么？和 Prompt Engineering 有什么区别？
- Harness 的四大原则是什么？
- 为什么说 Harness 比模型本身更重要？
- Generator-Evaluator 架构是什么？
- 企业级 Agent 有哪些实战经验？（Codex/Stripe/Cursor）
- AI 编程工具和传统 IDE 有什么本质区别？
- Claude Code、Codex、Cursor 各自的核心特点是什么？
- Cursor 五代架构演进说明了什么？
- OpenClaw 和 Hermes 框架各自的核心特点是什么？
- Hermes 的自进化机制是怎么工作的？ ➡️ 👉 Hermes框架
- 什么场景选 OpenClaw，什么场景选 Hermes？ ➡️ 👉 Hermes框架
