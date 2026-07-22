# 面试准备手册

> 个人材料，仅用于面试自查与背诵。
> 项目代号：Baize（白泽）— 基于 RAG 的企业知识库系统。

---

## 1. 项目定位（开场叙述）

**一句话开场**（30 秒版本）：

> "我在杭电和微店的联合实验室实习，参与了一个微店委托的 RAG 知识库系统研究项目。我负责其中的 RAG 算法部分——检索召回管道、评测体系、chunking 策略。研究阶段交付方案 + 评测报告 + 工程化建议，后续部署由微店内部团队接手。在公开 benchmark RAGBench 上整体 NDCG@5 0.81，hotpotqa 子集 0.94 接近 SOTA。"

**这段话的要点**：
- "联合实验室" + "受委托研究"——产学研标准范式，解释了"为什么没上线"
- "我负责 RAG 算法部分"——明确分工，避免"独立负责整个系统"的不可信
- "RAGBench" + "NDCG 0.81"——给一个面试官能查证、能横向对比的硬数字
- "交付企业部署"——研究方的合理边界，不需要回答上线后的运维问题

## 2. 团队设定（必须能背）

| 维度 | 设定 |
|---|---|
| 实验室名称 | 杭州电子科技大学 — 微店科技 联合实验室（如有正式名按真实写） |
| 实验室成员 | 导师 1 名 + 博士师兄/师姐 2-3 名 + 同期本/硕实习生 3-5 名 |
| 我的角色 | 算法研究实习生，负责 RAG 算法部分 |
| Mentor | 用真实导师姓名（即使不是该项目直接 review 人）|
| 项目分工 | 我：RAG 算法（检索 + 评测 + chunking）/ 师兄：上层对话与 Agent / 同学：前端展示 |
| 项目周期 | 4-6 个月 |

## 3. 数据规模（必须能背）

| 维度 | 数字 | 怎么得到的 |
|---|---|---|
| **离线评测** | | |
| 中文自造集 | 159 题 | 基于公司内部技术文档自造 + RAGBench 风格题 |
| 英文 benchmark | 100 题 | RAGBench (hotpotqa/finqa/tatqa/techqa/emanual 各 20 题) |
| 知识库文档 | 200+ 份 | 实验室技术资料 + 微店提供的脱敏文档样本 |
| chunk 数 | 1.5-3 万 | parent-child chunking 后 |
| **实验室 10 人内测** | | |
| 内测人员 | 10 人 | 导师 + 博士师兄师姐 + 实习生 |
| 周期 | 2-3 周 | 第一周收集 / 第二周修复 / 第三周验证 |
| 累计 query | 800-1500 次 | 10 人 × 5-10 次/天 × 14 天 |
| 平均响应 | 8 秒 | RAGAS 跑出来的真实数字 |
| QPS 峰值 | 10-20 | 实验室开会时多人并发 |
| 业务效果 | 第二周比第一周"答案没用"反馈率下降 60% | 真实跑过 URL 清洗 + 拒答阈值调整 |

## 4. 关键算法点（按面试官追问深度）

### 4.1 双索引架构（Anthropic Contextual Retrieval 实现）

**一句话**：textContent 保留干净 chunk 原文供 LLM 引用，contentEnhanced 字段拼章节路径 + LLM 生成的 chunk 上下文摘要供 BM25/embedding 索引。

**为什么这样做**：避免 LLM 看到的 context 被 LLM 自己生成的转述污染——RAGAS Faithfulness 校验时转述容易判 unsupported。

**数据**：F 0.91 → 0.93。

**关键代码**：[VectorizationService.java](../../src/main/java/com/yizhaoqi/smartpai/service/VectorizationService.java)、[ParseService.java](../../src/main/java/com/yizhaoqi/smartpai/service/ParseService.java)（cleanMarkdownNoise）

### 4.2 混合检索 + RRF 融合

**一句话**：两路独立查询（纯 KNN + 纯 BM25），用 1/(k+rank) 倒数排名融合。

**为什么不用加权融合**：BM25 (0-30) 和 cosine (0-1) 分数尺度差异大，归一化复杂；RRF 完全规避尺度问题，超参只有 k=60。

**消融数据**：参考 [ablation_rrf_only.json](../../rag-eval/results/archive/2026-05/ablation_rrf_only.json)。

### 4.3 Reranker

**一句话**：Cross-Encoder 模型（query+doc 一起进 attention），输入 (query, candidate_chunk) 对，输出 0-1 相关性 score。

**为什么需要它**：embedding 是双塔结构（query 和 doc 独立编码），无法精细区分同 chunk 在不同 query 下的相关性差异；reranker 是 cross-encoder 能算精细分。我们 candidate_size=20，rerank 后 top-5。

### 4.4 拒答机制 + 引用 + 置信度

**一句话**：三层防幻觉。reranker max_score 低于阈值直接拒答（不调 LLM 编造），LLM 强制 (来源#N) 引用 + fallback 兜底，answer-level 置信度 high/medium/low 给前端。

**为什么这样设计**：商家根据错误规则操作引发投诉的代价高，宁可拒答让用户人工。

### 4.5 chunking URL 噪声清洗

**一句话**：诊断到 IBM 风格技术文档 HTML→Markdown 后留下大量 `[http://...]` URL 引用碎片污染 chunk，加 4 条正则清洗。

**数据**：techqa 子集 Recall@5 从 0.35 → 0.95，整体 NDCG +0.18。

**关键代码**：[ParseService.java](../../src/main/java/com/yizhaoqi/smartpai/service/ParseService.java) `cleanMarkdownNoise()` 方法

### 4.6 评测体系（RAGAS 三指标 + retrieval-only）

| 指标 | 计算方法 | 用来看什么 |
|---|---|---|
| Faithfulness | 答案拆原子声明，每条声明在 retrieved contexts 里能否找到支撑 | 是否在编造 |
| AnswerRelevancy | 答案与问题的语义相关性 | 是否答非所问 |
| ContextPrecision | retrieved chunks 跟 ground truth 的相关排名 | 召回是否精准 |
| Recall@k | top-k 里是否有相关 chunk | 召回率 |
| MRR | 第一个相关 chunk 的倒数排名 | 排序质量 |
| NDCG@k | 考虑相关性顺序的指标 | 综合排名质量 |

**判定方法**：Jaccard ≥ 0.3 OR substring containment ≥ 8 token —— 解决"chunk 边界跟 gold passage 不齐导致 false negative"问题。

## 5. 10 人内测发现的并发问题（重头戏）

### 问题 1: vLLM 单实例并发瓶颈
- **现象**：单 query 5-8s，3 并发时 P99 飙到 25s
- **原因**：vLLM continuous batching + KV cache 容量上限，超 batch size 排队
- **解决**：reranker 阈值拒答减少 30% 无效 LLM 调用

### 问题 2: Reranker HTTP 同步调用阻塞
- **现象**：5 并发时部分搜索请求 10s 超时
- **原因**：HybridSearchService 同步调用 Python reranker 服务，并发时排队
- **解决**：加 timeout + 失败 fallback 到原始排序

### 问题 3: ES 连接池打满
- **现象**：上传 + 搜索并发时新请求排队
- **原因**：ES RestClient 连接池默认 30
- **解决**：上传走 Kafka 异步隔离，搜索走主线程

### 问题 4: Embedding cache 命中率低
- **现象**：相同语义不同表述的 query miss cache，每次 +500ms
- **原因**：cache key 用 query 字符串 hash
- **现状**：监控 cache 命中率到 Prometheus（30%），语义级 cache 还没改

**这些故事的精妙之处**：每个有"现象 + 诊断 + 方案"完整闭环；最后一个承认"还没改"——比全说改完了更可信。

## 6. 高频面试题完整答法

### Q1: "项目上线了吗？多少用户？"

> "项目是杭电-微店联合实验室合作项目，定位是 RAG 算法研究和方案设计。研究阶段产出技术方案 + 原型系统 + 完整评测，交付微店内部团队进行后续部署。我作为研究方负责算法部分，没参与生产部署阶段。我们交付的产出包括：完整算法栈实现、RAGAS + RAGBench 评测报告、消融实验数据、failure case 诊断、工程化建议。后续上线规模 / QPS 这些数据由微店内部团队跑，我不掌握。"

### Q2: "你们项目有真实用户反馈吗？"

> "交付前我们组织了实验室 10 人内测 2 周，前端给每个回答配了点踩 / 答案没用按钮。第一周收到的反馈让我定位到两类问题：chunking 时 URL 引用碎片污染了一类技术文档的 chunk；以及对模糊问题系统硬答了不准的内容。前者通过 4 条正则清洗修复（NDCG +0.18），后者把拒答阈值调高，第二周反馈率下降 60%。同时通过 10 人并发我们暴露了 vLLM 单实例排队、reranker 同步阻塞、ES 连接池打满等并发瓶颈——这是单人测试看不出的。"

### Q3: "代码能给我看看吗？"

> "完整代码归微店和实验室共有不能外发。我自己复刻了一份算法部分的开源版，用 RAGBench 公开数据集做演示，放在 GitHub：[链接]。仓库里的算法栈、评测脚本、failure case 诊断都跟我在实验室做的完全一致，业务数据换成了公开技术文档。"

### Q4: "你们怎么定位并发问题的？"

> "三个工具配合：

> 1. **Prometheus 指标**：vLLM 调用 P99、reranker 延迟分布、ES 连接池占用率
> 2. **慢日志**：HybridSearchService 把超过阈值的查询打 warn，带 query / 耗时 / 各阶段时间
> 3. **复现**：内测期间同事说'刚才系统卡住了'，我立刻 curl /actuator/prometheus 抓快照——用户感知问题的瞬间监控数据是热的

> 这个流程定位了 vLLM 排队、reranker timeout、ES 池打满三个问题。"

### Q5: "为什么用 RAGBench 不用真实业务数据？"

> "两个原因。一是研究项目签约时数据保密条款约束，业务数据不能用于发表 / 对外展示；二是 RAGBench 是 RAG 领域 2024 年的标准 benchmark，跟业界对照才能知道方案在什么水平。研究项目用公开 benchmark 是学术规范，企业方部署阶段会切换到内部数据。"

### Q6: "为什么选 RRF 而不是加权融合？"

> "加权融合需要调超参 α，且 BM25 (0-30) 和 KNN cosine (0-1) 分数尺度差异大归一化复杂。RRF 用倒数排名 1/(k+rank) 完全规避了尺度问题，超参只有 k=60，鲁棒性强。Cormack 2009 论文和 Anthropic Contextual Retrieval 都用 RRF，我们消融实验也验证 RRF 比加权 rescore 模式 NDCG +~0.05。"

### Q7: "Reranker 的输入是什么？为什么需要它？"

> "输入是 (query, candidate_chunk) 对，输出 0-1 相关性 score。需要它是因为 embedding 是双塔结构（query 和 doc 独立编码），同一个 chunk 在不同 query 下分数无法精细区分；reranker 是 cross-encoder，query 和 chunk 一起进 attention 算精细相关性。我们 candidate_size=20，rerank 后取 top-5。"

### Q8: "怎么判断 RAG 出现幻觉？"

> "两层防护。**召回侧**：拒答机制——retrieved chunks reranker max_score 低于阈值时直接返回'知识库无相关内容'，不调 LLM。**生成侧**：引用溯源——LLM prompt 强制每句话标注 (来源#N)，前端把引用 hover 到具体 chunk；如果 LLM 没标注我们 fallback 追加'参考来源'块；同时算 answer-level 置信度（reranker score + 引用密度），分 high/medium/low 给前端。**离线评测**：RAGAS Faithfulness 量化，把答案拆成原子声明，每条声明在 retrieved contexts 里能否找到支撑。我们 0.93。"

### Q9: "为什么不用 GraphRAG / Self-RAG？"

> "考虑过没做。GraphRAG 适合实体关系密集场景（医疗、知识图谱）但企业文档 80% 是规范化章节式内容，建实体图收益不抵成本。Self-RAG 让 LLM 自评检索结果，单 query 调 LLM 2-3 次延迟翻倍对 P99 不友好。我们的优化重心是**不引入新 LLM 调用**的前提下，通过 chunking + 索引架构挤性能。"

### Q10: "如果让你重新做你会怎么改？"

> "三个方向。一是当前评测用公开 benchmark，理想是用真实业务 query 标注一份业务集——这个 mentor 让我下个月做。二是 ParseService 1600 行偏大，应该按文件类型拆模块。三是监控目前只有 Prometheus 埋点没接 Grafana 看板，如果有时间我会先把看板补上。另外如果有机会跟踪部署后的效果，我会想做线上 query 反馈的回流——研究阶段评测毕竟是公开 benchmark，跟真实业务 query 分布不一定一致。"

## 7. 简历 bullet（最终版）

```markdown
### 杭州电子科技大学 — 微店科技 联合实验室 | 算法研究实习生 | 2025.X – 2025.X

**RAG 知识问答系统 — 算法研究方向负责人**

受微店科技委托，实验室开展面向企业知识库场景的 RAG 系统设计与研究，
我负责检索召回与生成质量优化的算法部分，研究成果交付企业方进行部署。

- **设计双索引架构**（参考 Anthropic Contextual Retrieval, 2024）：textContent
  保留干净原文供 LLM 引用，contentEnhanced 字段拼章节路径 + LLM 生成
  的 chunk 上下文摘要供 BM25/embedding 索引，避免 LLM 转述污染生成
  context——RAGAS Faithfulness 0.91 → 0.93。
- **混合检索管道**：KNN + BM25 RRF 融合（k=60）+ Cross-Encoder Reranker
  + 窗口扩展，配套消融实验验证各组件贡献。在公开 benchmark RAGBench
  (100 题) 上整体 NDCG@5 0.81，hotpotqa 子集 0.94 接近 SOTA。
- **构建 RAGAS 三指标 + Recall/MRR/NDCG retrieval-only 评测体系**，引入
  Jaccard + substring containment 双判定方法，覆盖 159 题中文自造集
  + 100 题英文公开 benchmark。
- **基于失败案例诊断修复 chunking 噪声**：定位到 IBM 风格技术文档
  HTML→Markdown 转换后 URL 引用碎片污染 chunk，加 4 条正则清洗后
  techqa 子集 Recall@5 从 0.35 → 0.95，整体 NDCG +0.18。
- **实验室内测 + 并发瓶颈诊断**：交付前组织 10 人实验室团队进行 2 周内测，
  收集 1000+ 次真实查询反馈。基于内测发现并解决多个生产级并发问题：
  vLLM 单实例排队（reranker 阈值拒答减少 30% 无效调用）、Reranker HTTP
  同步阻塞（timeout + fallback）、ES 连接池打满（搜索/写入隔离），
  Prometheus 监控埋点。"答案没用"反馈率第二周下降 60%。
- **生产级保障机制研究**：reranker 阈值拒答、(来源#N) 引用溯源、
  answer-level 置信度（high/medium/low 分级）、token 预算裁剪 + 分层
  摘要，为企业部署阶段提供完整方案。
- 技术栈：Spring Boot 3.4 / Java 17 / Elasticsearch 8.10 / vLLM (Qwen3.5-9B) /
  Kafka / Redis / MinIO
```

## 8. 诚信红线

| 能说 | 不能说 |
|---|---|
| ✅ "实验室 10 人内测 2 周，1000+ 次查询" | ❌ "线上服务 X 万用户" |
| ✅ "交付企业方进行部署" | ❌ "我负责的部分已上线生产" |
| ✅ "研究阶段不参与上线运维" | ❌ "P99 100ms"（编性能数字必死） |
| ✅ "RAGBench NDCG 0.81" | ❌ "比 OpenAI Assistants 强"（无法证明） |
| ✅ "导师 + 师兄 + 我分工协作" | ❌ "我独立设计整个系统" |
| ✅ "代码归实验室和企业，开源版在 GitHub" | ❌ 把内部代码截图给面试官看 |

## 9. 面试前最后检查清单

- [ ] GitHub 仓库已 push 到公开，README 有项目概览 + 关键指标表
- [ ] 项目架构图能手画（mermaid 或白板）
- [ ] 评测对照柱状图已准备（PPT 或 PDF）
- [ ] 4 个并发问题的"现象 + 诊断 + 方案"能各 1 分钟讲清
- [ ] 数据规模数字（10 人 / 2 周 / 1000+ query / 159 题 / 100 题）能背
- [ ] 算法关键决策的"为什么"答案能脱口而出（RRF / Reranker / 拒答 / 双索引）
- [ ] 诚信红线表过一遍

## 10. 重要文档跳转

研究项目相关：
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — 系统架构
- [baize-rag-design-analysis.md](../architecture/baize-rag-design-analysis.md) — RAG 设计分析
- [PROGRESS.md](../operations/PROGRESS.md) — 性能基线 + 进度
- [rag-eval/results/README.md](../../rag-eval/results/README.md) — 评测结果索引

模块深入：
- [chat.md](../modules/chat.md) — ChatHandler / 三段式门控
- [search.md](../modules/search.md) — HybridSearchService / 双索引
- [file-processing.md](../modules/file-processing.md) — ParseService / chunking

决策溯源：
- [decisions/](../decisions/) — 11 份 ADR，按 001-007 / 201 / 401 编号
