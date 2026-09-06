---
module: Baize
type: project
status: current
tags: [Baize, RAG, 检索, Embedding, ES, RRF, Reranker, 双索引]
difficulty: hard
last_reviewed: 2026-05-29
---

# RAG 管道设计：解析、清洗、分块、向量化、检索

> 问题：RAG 项目的离线/在线管道是怎么设计的？解析、分块、向量化、检索每一环为什么这么选？
> 理论基础：[[LLM/RAG基础与架构|RAG基础与架构]]（架构与分块策略） · [[LLM/RAG检索策略|RAG检索策略]]（混合检索与评估）
> 本笔记是 Baize RAG 管道的总览，检索细节见 [[混合搜索与检索]]，评测数据见 [[评测体系与性能基线]]。

> [!tip] 一句话定位
> Baize 是一个**企业级 RAG 知识库系统的工程实践 + 算法研究项目**。最大的差异化不是某个算法，而是**建立了可量化的评测闭环**（RAGAS 三指标 + retrieval-only 指标 + 消融实验），每个组件的改动都有数据支撑。当前基线：中文自造集 F=0.9261 / AR=0.8735 / CP=0.8850；RAGBench 公开集 NDCG@5=0.814。

---

## 管道全景

```
离线（文档入库）                            在线（查询应答）
─────────────                              ─────────────
解析（多路由）                              查询改写（指代消解）
  ↓                                          ↓
文本清洗（7 步）                            RRF 融合（KNN + BM25）
  ↓                                          ↓
分块（结构感知 / 语义）                     Reranker 重排
  ↓                                          ↓
向量化（双索引输入）                        Window 扩展（±1 chunk）
  ↓                                          ↓
ES 索引（textContent + contentEnhanced）   拒答 / 引用 / 置信度
                                             ↓
                                           LLM 流式生成
```

---

## 一、文档解析：多路由策略

**核心类：** `ParseService.java`，按文件类型分发解析器，每条路由都有降级链。

| 文件类型 | 主解析器 | 降级链 |
|---------|--------|--------|
| PDF | MinerU（port 8765） | → PDFBox → VLM OCR |
| DOCX / PPTX / XLSX | MinerU | → MarkItDown → Tika |
| CSV / HTML | MarkItDown | → Tika |
| 图片 | Qwen3-VL-8B（port 3599，独立 vLLM） | — |
| TXT / RTF / MD / XML / JSON | Apache Tika（流式） | — |

### 为什么这样分

- **MinerU 负责 PDF/Office**：内置版面分析（RT-DETR）+ 表格结构识别，输出结构化 Markdown，能正确还原双栏阅读顺序与表格。实测 AnswerRelevancy +10%。
- **MarkItDown 负责 CSV/HTML**：输出 Markdown 表格保留列名 + 数据绑定，比 Tika 的"逗号分隔纯文本"语义完整。
- **VLM 负责图片**：跳过传统 OCR pipeline，对图表/流程图理解更好。
- **图片 VLM（Qwen3-VL-8B, port 3599）是独立服务**，跟主 LLM（Qwen3.5-9B, port 3598）分开部署，不同模型不同实例。

> [!note] 2026-05-19 工具横向对比
> 3 个 PDF（多栏政策报告 + 学术论文 ×2）对比 MinerU / Docling / MarkItDown / Dolphin-v2：
> - **MinerU**：速度快（6-11s）、公式识别最强（LaTeX）、标题层级准确 → 主力
> - Docling：慢（17s）、无公式 → 降级备选
> - MarkItDown：最快但无标题识别、噪声多 → 不适合 PDF，适合 CSV/HTML
> - Dolphin-v2：数字 PDF 输出量只有 1-2% → 不适合数字原生 PDF

> [!warning] 与旧版的区别
> 早期笔记记录的是「PDFBox 逐页 + Tika 流式」，那是 MinerU 接入前的方案。现在 PDFBox 退为 PDF 降级链的第二级。

---

## 二、文本清洗：7 步预处理

**核心方法：** `ParseService.cleanMarkdownContent()`（2026-05-29 新增），仅对 MinerU/MarkItDown 的 Markdown 输出执行：

1. **图片占位符**：`![](...)\n图注` → 保留图注删占位符；无图注则整行删除
2. **不可见控制字符**：零宽空格、软连字符、BOM → 删除
3. **全角转半角**：全角字母/数字/空格 → 半角（保留全角标点）
4. **乱码过滤**：连续 2+ 非 ASCII、非中日韩字符 → 替换为空格（处理 MinerU 解析公式/符号产生的乱码）
5. **连续空格压缩**：多空格 → 单空格（保留换行）
6. **超长 URL 简化**：路径超 100 字符的 URL → 保留域名 + `/...`
7. **空白行压缩**：3+ 连续换行 → 2 换行

PDFBox 路径另有**页眉页脚过滤**（`extractCleanPdfPageTexts()`）：跨页重复 ≥2 次的边界行自动识别删除。

> [!tip] 为什么 URL 清洗值钱
> 诊断 RAGBench techqa 子集（IBM 技术文档）失败案例时发现，HTML→Markdown 后留下大量 `[http://www.ibm.com/...]` 引用碎片，召回时"全是 URL"的 chunk 排到 top-1。加正则清洗后 **techqa 子集 Recall@5 从 0.35 → 0.95，整体 NDCG +0.18**。

未实现（曾设想但没做）：MinHash+LSH 近似重复检测、缩写展开。当前策略偏保守，只处理解析噪声，不做语义增强。

---

## 三、分块策略：双路由

按解析输出类型走两套，**都带 overlap 和元数据**（旧版是 512 字符、无 overlap、无元数据）。

### 路径 A：Markdown 结构感知（`splitMarkdownIntoChunksWithMeta()`）

针对 MinerU/MarkItDown 输出，三阶段：
1. **结构分段**：识别 HEADING / TABLE / LIST / PARAGRAPH 四种 block
2. **按结构合并**：heading 开始新 chunk（不跨章节合并）；表格/列表用更大 size limit（1200）；超长 block 递归拆（表格按行+复制表头，列表按项+复制前导句）
3. **智能 overlap**：相邻 chunk 间加 ~100 字符重叠，在句子边界截断

### 路径 B：纯文本语义（`splitTextIntoChunksWithSemantics()`）

针对 Tika/PDFBox/VLM 输出：按 `\n\n` 分段 → 累积到 600 字符 → 超长按句子标点 → HanLP 分词 → 字符硬切兜底。

### 配置参数（`application.yml`）

```yaml
file.parsing:
  chunk-size: 600           # 纯文本路径
  md-chunk-size: 800        # Markdown 普通段落
  md-table-chunk-size: 1200 # 表格/列表（更大）
  md-overlap: 100           # overlap 字符数
```

### chunk 元数据

每个 chunk 同时记录：
- **`sectionPath`**：章节路径，如 `"第三章 > 3.2 线程池配置"`，用层级栈维护，遇同级标题自动回退（避免 `第一章 > 1.1 > 1.2` 这种错误）
- **`chunkType`**：text / table / list / code

存入 `DocumentVector` 表与 ES，供检索时元数据预过滤。

---

## 四、向量化：双索引输入

**核心类：** `VectorizationService.vectorizeWithUsage()` + `EmbeddingClient.java`

- **模型**：Qwen3-Embedding-0.6B（本地，port 6666）
- **维度**：1024（ES mapping `dims: 1024`）
- **批处理**：`batch-size: 10`
- **缓存**：`EmbeddingCacheService` 用 Redis 存 query embedding，TTL 24h，模型切换自动失效
- **Pooling**：last token pooling + L2 normalize，相似度 cosine

### 双索引下的 embedding 输入

```java
// embedding 输入携带章节信号 + Contextual 信号
String embeddingInput = "[" + sectionPath + "] " + ctxSummary + "\n\n" + chunk原文;
List<Float> vec = embeddingClient.embed(embeddingInput);
```

> [!note] 2026-05-20 Embedding 横向对比
> Qwen3-0.6B（区分度 0.251 / 延迟 6.4ms / 吞吐 1165）对比 Qwen3-4B（0.279 / 23.6ms）、BGE-M3、BGE-large-zh。结论：**0.6B + BGE-reranker-v2-m3 是最佳组合**。换 4B 区分度 +11% 但延迟 +270%，不划算。详见 [[模型选型]]。

---

## 五、索引存储：双索引架构（Contextual Retrieval）

**存储引擎**：Elasticsearch 8.10.0，单索引 `knowledge_base`。

> [!important] 2026-05-28 重大演进
> 原本的「父子分块」演化成了更彻底的**双索引架构**（参考 Anthropic Contextual Retrieval 论文）：
> - **`textContent` 字段**：纯净 chunk 原文，**仅供 LLM 看到的生成上下文**
> - **`contentEnhanced` 字段**：`[sectionPath] + ctxSummary（LLM 生成的上下文摘要）+ 原文`，用于 BM25 倒排索引 + embedding 输入

| 用途 | 内容 | 是否含 ctxSummary/sectionPath |
|---|---|:---:|
| KNN 向量索引 | embedding 输入 | ✅ |
| BM25 倒排索引 | contentEnhanced | ✅ |
| LLM 生成上下文 | textContent | ❌（干净原文） |

### 为什么这样分

召回阶段（embedding + BM25）需要更多信号让相关 chunk 排上来；但 LLM 生成时如果看到"LLM 转述"，会被 RAGAS Faithfulness 判 unsupported（转述内容不在 ground truth 文档里）。Anthropic 论文也明确建议 retrieval 后回查原文给 generator。

**演进路径**（数据见 [[评测体系与性能基线]]）：
- 之前：ctxSummary 拼进 textContent → F 0.91 / CP 0.91（数值最优但有污染）
- 现在：ctxSummary 拼进 contentEnhanced，textContent 干净 → F 0.93 / CP 0.89（架构最干净，长期可控）

### 为什么用 ES 而不是 Milvus
- 一个引擎解决两种需求：BM25 + KNN 原生支持
- 权限过滤天然支持：`filter` 子句检索时过滤 `userId`/`orgTag`/`public`
- 运维成本低：复用已有 ES

ES mapping 字段：

| 字段 | 类型 | 用途 |
|---|---|---|
| `textContent` | text (ik 分词) | LLM 看到的干净原文 |
| `contentEnhanced` | text (ik 分词) | BM25 倒排匹配 |
| `vector` | dense_vector (dims=1024) | KNN 语义召回 |
| `sectionPath` / `chunkType` | keyword | 元数据预过滤 |
| `userId` / `orgTag` / `public` | — | 多租户权限过滤 |

---

## 六、在线检索：RRF + Reranker + Window

`HybridSearchService.searchWithPermission()`，2026-05 演化为三层管道。**这是改动最大的部分**——旧版的 `KNN×0.2 + BM25×1.0 rescore` 已被取代。

```
查询 → (1) RRF 融合 → (2) Reranker rerank → (3) Window 扩展 → 最终 top-K
```

简述如下，完整深挖（含代码与消融）见 [[混合搜索与检索]]：

- **(1) RRF 融合**：纯 KNN + 纯 BM25 两次独立查询，`score = Σ 1/(k+rank)`，k=60。**回避 BM25(0-30) 与 cosine(0-1) 的尺度差异**，超参只有 k。失败回退旧版 KNN+rescore。
- **(2) Reranker**：BGE-reranker-v2-m3（独立 Python 服务，port 8767），candidate 20 → top 5。**logit 区分度比 embedding 高一个数量级（12.42 vs 0.27），是 ContextPrecision 0.21→0.61 的关键。**
- **(3) Window 扩展**：命中 chunk 取相邻前 1 + 后 1 拼接给 LLM，弥补分块边界切碎语义。

### 权限过滤
ES `filter` 子句叠加（详见 [[用户管理与权限]]）：
```
should: userId == userDbId
        OR public == true
        OR orgTag IN userEffectiveTags（含层级）
```

---

## 七、在线生成：远不止 prompt 拼接

`ChatHandler.processMessage()` + `LlmProviderRouter.streamResponse()` 构成 15 步管道，细节见 [[聊天助手模块]]。关键机制：

- **查询改写（指代消解）**：含"它/那个"等指代词或 < 15 字的 query，用 summary + 最近 3 轮历史还原成具体实体，Redis 缓存 12h。详见 [[对话上下文管理]]。
- **拒答机制**：`context.isBlank() || maxScore < MIN_ACCEPTANCE_SCORE` → 直接返回拒答语，不调 LLM，避免低相关 context 触发幻觉。
- **引用溯源**：prompt 强制每句标 `(来源#N)`，finalize 提取引用编号持久化，无引用时兜底追加"参考来源"块。
- **Answer-level 置信度**：reranker maxScore + 引用密度 → high/medium/low，前端渲染信心徽章。
- **token 预算裁剪**：`ai.context.max-input-tokens`（默认 16000），从最早历史丢弃但保护最近 N 轮，丢弃的异步压缩进 summary。

### LLM 生成参数
- 主 LLM：Qwen3.5-9B（本地 vLLM，port 3598）
- 参数：temperature=0.3, top_p=0.9, max_tokens=8000, **presence_penalty=1.5**（防重复循环）
- vLLM 启动：`--reasoning-parser qwen3`（**不要改 deepseek_r1，跟 Qwen3 不兼容**）
- 三段式门控历史方案当前 **thinking 硬编码关闭**，原因是 Qwen3 在低相关 RAG + 复杂 prompt 时触发无限 reasoning。详见 [[Qwen3接入排障]]。

---

## 总结对照表

| 维度 | 当前实现（2026-05-29） |
|------|------|
| 解析 | 多路由：MinerU(PDF/Office) / MarkItDown(CSV/HTML) / VLM(图片) / Tika(纯文本)，各有降级链 |
| 清洗 | 7 步 Markdown 预处理 + PDFBox 页眉页脚过滤 |
| 分块 | 双路由：Markdown 结构感知(800/1200) + 纯文本语义(600)，overlap=100，带 sectionPath/chunkType |
| 向量化 | Qwen3-Embedding-0.6B(port 6666)，dims=1024，输入含双索引信号，batch=10 |
| 索引 | ES 单索引，textContent(干净给 LLM) + contentEnhanced(召回信号) |
| 检索 | RRF 融合(k=60) + BGE-reranker-v2-m3(port 8767) + Window 扩展(±1) |
| 生成 | 15 步在线管道：查询改写 / 拒答 / 引用溯源 / 置信度 / token 预算 |
| 基线 | 中文自造 F=0.9261 / AR=0.8735 / CP=0.8850；RAGBench NDCG@5=0.814 |

## 相关链接

- [[系统架构总览]] — 7 大业务域与技术栈
- [[混合搜索与检索]] — RRF + Reranker + Window 深挖
- [[评测体系与性能基线]] — RAGAS 指标、消融历史、vLLM 压测
- [[文件上传机制]] — 解析入库的上游链路
- [[聊天助手模块]] — 在线生成管道
- [[对话上下文管理]] — 查询改写与 token 预算
- [[模型选型]] — Embedding / Reranker / LLM 选型
- [[百万级扩展方案]] — 大规模文档检索优化
- [[LLM/RAG基础与架构|RAG基础与架构]] · [[LLM/RAG检索策略|RAG检索策略]]
