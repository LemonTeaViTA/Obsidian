# RAG 管道设计：分片、解析、向量化、检索

> 问题：RAG 项目里的分片是怎么设计的？内容解析和向量化怎么做的？检索召回怎么做的？
> 理论基础：[[RAG基础与架构]]（架构与分块策略） · [[检索召回与优化]]（混合检索与评估）

---

## 一、文档解析

**核心类：** `ParseService.java`

### PDF 解析
- 使用 **Apache PDFBox**，逐页提取文本（`PDFTextStripper.setStartPage/setEndPage`）
- 自动检测并过滤页眉/页脚：扫描每页前后 3 行，跨页重复出现 ≥2 次则删除
- 每页文本独立进入分片流程，`pageNumber` 字段记录页码，方便后续引用时标注来源页

### 非 PDF（Word、TXT 等）
- 使用 **Apache Tika** `AutoDetectParser`，流式驱动
- Tika 的 `characters()` 回调驱动，内部缓冲区达到 `parentChunkSize`（配置项 `file.parsing.parent-chunk-size`，默认 1MB）时触发一次父块处理

### 为什么这样设计？
- PDF 按页处理是为了保留页码信息，方便用户定位原文
- Tika 流式处理是为了避免大文件一次性加载进内存

---

## 二、分片策略

**核心方法：** `ParseService.splitTextIntoChunksWithSemantics()`

### 三级降级策略（无 overlap）

| 级别 | 触发条件 | 切割单位 |
|------|----------|----------|
| 1 | 段落 ≤ chunkSize | 按 `\n\n` 段落边界合并 |
| 2 | 段落 > chunkSize | 按句子边界（`。！？；.!?;`）切割 |
| 3 | 单句 > chunkSize | HanLP `StandardTokenizer` 分词后按词切割；失败则按字符硬切 |

```java
// 句子切割正则
String[] sentences = paragraph.split("(?<=[。！？；])|(?<=[.!?;])\\s+");
```

**chunk size：** 512 个字符（配置项 `file.parsing.chunk-size`），单位是字符数而非 token，超过则按句子或分词降级切割

**无 overlap：** 每个 chunk 独立存储，没有滑动窗口重叠。

### 为什么这样设计？
- 优先按语义边界（段落→句子）切割，保证每个 chunk 语义完整
- HanLP 分词兜底是为了处理中文长句（中文没有空格，不能直接按空格切词）
- 无 overlap 简化了存储和去重，代价是跨 chunk 的语义可能断裂

---

## 三、向量化

**核心类：** `VectorizationService.java` + `EmbeddingClient.java`

### Embedding 模型
- **本地部署**：Qwen3-Embedding-0.6B，通过 vLLM 提供 OpenAI 兼容接口（端口 6666，GPU 5）
- 0.6B 参数量，非常轻量，单卡 24G 只占 40% 显存即可运行
- 向量维度：**1024**（`word_embedding_dimension`）
- Pooling 策略：**last token pooling** + L2 normalize
- 相似度函数：**cosine**
- 最大输入长度：8192 tokens（启动参数 `MAX_MODEL_LEN`，模型上限 32768）

### 批处理
```java
// batch size 默认 100，配置项 embedding.api.batch-size
for (int start = 0; start < texts.size(); start += batchSize) {
    int end = Math.min(start + batchSize, texts.size());
    List<String> sub = texts.subList(start, end);
    String response = callApiOnce(sub);
}
```

### API 请求格式
- POST `/embeddings`，body：`model`、`input`（文本数组）、`dimension`、`encoding_format: "float"`
- 重试 3 次，超时 30 秒

### 为什么这样设计？
- 本地部署 embedding 模型避免了对外部 API 的依赖，降低延迟和成本
- 0.6B 模型资源占用极低，和 LLM 共存于同一台机器毫无压力
- batch=100 平衡吞吐和单次请求大小

---

## 四、检索召回

**核心类：** `HybridSearchService.java`

### 混合检索：KNN 向量 + BM25 rescore

**第一阶段 — KNN 向量召回：**
```java
int recallK = topK * 30;  // 召回窗口 = topK × 30（宽召回）
s.knn(kn -> kn
    .field("vector")
    .queryVector(queryVector)
    .k(recallK)
    .numCandidates(recallK)
);
// 同时要求 BM25 must 过滤：KNN 结果必须包含关键词
.must(mst -> mst.match(m -> m.field("textContent").query(query)))
```

**第二阶段 — BM25 rescore：**
```java
s.rescore(r -> r
    .windowSize(recallK)
    .query(rq -> rq
        .queryWeight(0.2d)         // KNN 分权重 20%
        .rescoreQueryWeight(1.0d)  // BM25 分权重 100%
        .query(rqq -> rqq.match(m -> m
            .field("textContent")
            .query(query)
            .operator(Operator.And)  // 要求所有词都命中
        ))
    )
);
```

**最终 score 公式：**
```
final_score = KNN_score × 0.2 + BM25_score × 1.0
```
BM25 主导，KNN 作为辅助。

### 降级策略
- 向量生成失败 → 自动降级为纯 BM25 文本搜索
- 纯文本搜索设有 `minScore(0.3)` 阈值过滤

### 权限过滤
每次检索都附带 filter：自己的文档（userId）OR 公开文档（public=true）OR 所属组织文档（orgTag 匹配）

### 结果标记
- 混合检索结果：`retrievalMode = "HYBRID"`
- 纯文本降级结果：`retrievalMode = "TEXT_ONLY"`

### 为什么这样设计？
- **为什么混合检索？** 纯向量检索对关键词匹配弱（比如专有名词、代码），纯 BM25 对语义理解弱。混合检索取两者之长。
- **为什么 BM25 权重更高（1.0 vs 0.2）？** 知识库场景下，用户通常在找具体内容，关键词精确匹配比语义相似更重要。
- **为什么 topK×30 宽召回？** 先用向量粗筛出候选集，再用 BM25 精排，宽召回保证好结果不被向量阶段漏掉。

### 关键字检索和语义检索的维度是一样的吗？

不一样，两者在完全不同的空间上做匹配。

**关键字检索（BM25/倒排索引）** 在**词频维度**上匹配——统计查询词在文档中出现的频率和分布。维度是离散的词汇空间，每个词是一个独立维度。优点是精确、可解释；缺点是"苹果手机"搜不到"iPhone"，同义词全部失效。

**语义检索（向量检索）** 在**语义嵌入维度**上匹配——把文本用 Embedding 模型编码成高维稠密向量（如 768 或 1536 维），在向量空间里计算余弦相似度。语义相近的词在空间中距离近。优点是能理解同义词、上下文；缺点是对精确词汇（专有名词、代码片段）不如关键字检索准确。

**Baize 项目的做法**：两路并行，向量召回做宽召回（topK×30），BM25 做精排 rescore，权重 1.0 vs 0.2，最终合并结果。

---

## 附：本地部署模型参数

### LLM — Qwen3.5-9B
- 架构：`Qwen3_5ForConditionalGeneration`（多模态，支持视觉）
- 混合注意力：linear attention + full attention 交替（每 4 层一次 full attention）
- 上下文长度：**262144 tokens（256K）**
- hidden_size：4096，num_layers：32，num_heads：16
- 精度：bfloat16
- 部署：vLLM，GPU 6+7（双卡 tensor parallel），端口 3598

### Embedding — Qwen3-Embedding-0.6B
- 架构：`Qwen3ForCausalLM` + sentence_transformers Pooling + Normalize
- 向量维度：**1024**
- Pooling：last token pooling
- 相似度：cosine
- 最大输入：8192 tokens（模型上限 32768）
- 精度：bfloat16
- 部署：vLLM，GPU 5（单卡，显存占用 40%），端口 6666

---

## 总结

| 维度 | 实现 |
|------|------|
| 解析库 | PDF: PDFBox 按页；其他: Tika 流式 |
| 分片单位 | 段落 → 句子 → HanLP 词 → 字符（三级降级） |
| chunk size | 512（配置项 `file.parsing.chunk-size`） |
| overlap | 无 |
| Embedding | 本地 Qwen3-Embedding-0.6B（vLLM，端口 6666），维度=1024，cosine |
| 检索方式 | KNN 宽召回（topK×30）+ BM25 rescore |
| Score 公式 | `KNN×0.2 + BM25×1.0` |
| 降级 | 向量失败 → 纯 BM25，minScore=0.3 |
