---
module: RAG
tags: [RAG, 检索, BM25, 混合检索, Rerank, 多轮对话, ColBERT, 父子分块, 句子窗口]
difficulty: hard
last_reviewed: 2026-06-01
---

# RAG 检索策略

> 本文覆盖 RAG 在线阶段的检索链路：检索优化四层 → 混合检索 → 多轮去重 → 检索时上下文扩展。查询理解与意图识别（Function Calling / Agentic RAG / 查询改写）已独立为 [[RAG查询理解]]；离线阶段（文档解析、分块）见 [[RAG基础与架构]]，向量数据库与 Embedding 见 [[RAG向量与Embedding]]。

> [!info] 速览
> - **§一 查询理解**：已拆分到 [[RAG查询理解]]，本节仅留导航。
> - **§二 检索优化四层框架**：索引层 / 查询层 / 召回层 / 重排序层，是全文主干。
> - **§三 混合检索原理**：BM25 公式、RRF 融合、加权求和。
> - **§四 多轮对话检索去重**：`expr not in` / `group_by_field` 与 HNSW 降级风险。
> - **§五 检索时上下文扩展**：父子分块 vs 句子窗口，与离线分块结构的配套关系。

## 一、查询理解与意图识别

> [!info] 本节已独立成篇，见 [[RAG查询理解]]
> 查询理解是在线阶段的第一步——在检索前理解用户到底想要什么。现代主线是 **Function Calling（事实标准）→ Agentic RAG → 查询改写 → 反问澄清**，让 LLM 自己路由，而不是"分类到 4 个固定标签"。实体提取、查询路由、容错回退也一并归入该文。

一句话定位：现代 RAG 不做显式意图分类，而是把检索/计算/查库都暴露为工具，让 LLM/Agent 自己决定怎么调；只有性能敏感、多租户硬路由、合规分流等少数场景才保留显式规则分类。完整模式、代码与设计原则详见 [[RAG查询理解]]。

---

## 二、检索优化四层框架

RAG 检索优化可以从四个层次来理解，每一层解决的问题不同：

| 层次 | 核心问题 | 关键技术 |
|------|---------|---------|
| **索引层** | 知识怎么「存」 | Small-to-Big、Parent-Child、摘要索引 |
| **查询层** | 问题怎么「转」 | Query 改写、Multi-Query、HyDE、Step-back |
| **召回层** | 从哪里「找」 | 多路召回（向量 + BM25）、元数据过滤 |
| **重排序层** | 谁「最相关」 | Cross-Encoder Rerank |

**层次关系：** 索引层决定「仓库里放了什么」，查询层决定「用什么钥匙开门」，召回层决定「从哪几扇门进去找」，重排序层决定「把找到的东西里最好的几件带出来」。

### 2.1 索引优化（Small-to-Big）

索引层的核心矛盾——**检索粒度 vs 上下文完整性**（小 chunk 检索准但内容碎，大 chunk 完整但语义稀释）——以及它最主流的解法"父子分块（Parent-Child）"，在 [[#5.1 父子分块（Small-to-Big Retrieval）|§5.1]] 有完整展开（核心矛盾、离线结构、在线检索逻辑、关键参数）。本节只补充索引层另外两种方案，避免与 §5.1 重复。

> [!note] 父子分块为什么同时出现在索引层和上下文扩展层
> 父子分块既是一种索引组织方式（子块建向量索引、父块存内容），也是检索时上下文扩展的主流实现。为避免重复，本文把它的完整机制与代码统一放在 [[#5.1 父子分块（Small-to-Big Retrieval）]]，本节只列它在索引层的定位：用小粒度子块保证检索精度，命中后返回大粒度父块保证上下文完整。

#### 方案二：摘要索引（Summary Index）

为每段内容生成摘要，用摘要建向量索引，检索时用摘要匹配，命中后返回原文。

```python
document_chunk = {
    "id": "doc_001",
    "summary": "本段介绍重疾险的等待期规则和计算方法",  # 用于检索
    "content": "重疾险等待期详细说明...[原文 500 token]",  # 用于 LLM
    "summary_embedding": [0.23, 0.45, ...]
}

def retrieve_with_summary(query):
    summary_results = vector_search(query, index="summary_embeddings", top_k=5)
    return [doc["content"] for doc in summary_results]
```

适用场景：文档表述散乱、需要提炼核心意思的场景。缺点：需要 LLM 生成摘要，离线处理成本高。

#### 方案三：多粒度分层索引

同时建立章节级、段落级、句子级三层索引，根据问题类型选择合适粒度。

```python
indexes = {
    "chapter": [...],   # 章节级（1000+ token）
    "paragraph": [...], # 段落级（500 token）
    "sentence": [...]   # 句子级（50-100 token）
}

def route_by_query_type(query):
    if is_conceptual_question(query):  # "什么是 RAG"
        return search(query, index="chapter")
    elif is_detail_question(query):    # "退款需要几个工作日"
        return search(query, index="sentence")
    else:
        return search(query, index="paragraph")
```

适用场景：问题类型多样、对精度要求极高的场景。缺点：索引存储成本高（3 倍），路由逻辑复杂。

### 2.2 查询优化

#### 核心问题：用户提问与知识库表述的鸿沟

用户的提问方式和知识库里的表述方式之间存在鸿沟。例如用户问"苹果手机咋截图"，知识库写的是"iPhone 截图操作方法"——意思一样，但向量相似度可能不高（口语 vs 书面语）。

> [!note] 查询改写在查询理解阶段也有定位
> 本节给 Query 改写 / Multi-Query / HyDE / Step-back 的**工程实现与代码**；它们作为"让 LLM 自己路由"的一环，在 [[RAG查询理解#2.3 查询改写（Query Rewriting）]] 有概念层定位。

#### Query 改写（Query Rewriting）

用 LLM 把口语化、有歧义的 query 转化成更正式、更精准的书面表达。

```python
def rewrite_query(query, llm_client, conversation_history=None):
    prompt = f"""将用户的口语化问题改写成正式、精准的书面表达。
如果问题中有指代不明的词（如"它""这个"），结合对话历史补全。

对话历史：{conversation_history}
用户问题：{query}

改写后的问题："""
    rewritten = llm_client.generate(prompt, max_tokens=100)
    return rewritten.strip()
```

适用场景：用户提问质量差、指代不清、口语化严重。

#### Multi-Query 扩展

把一个问题扩展成 3-5 个不同角度的问法，每种问法单独检索，最后合并去重。

```python
def multi_query_expansion(query, llm_client):
    prompt = f"""将下面的问题改写成 3 个不同角度的问法，每个问法一行。

原问题：{query}

改写后的问题："""
    response = llm_client.generate(prompt, max_tokens=200)
    queries = [query] + response.strip().split('\n')

    all_results = []
    for q in queries:
        results = vector_search(q, top_k=10)
        all_results.extend(results)
    return deduplicate_by_id(all_results)
```

关键点：原始问题必须保留，因为改写可能丢失细节。适用场景：用户提问角度和文档描述角度不对齐。

#### HyDE（假设文档嵌入）

先让 LLM 根据问题生成一段"假设的答案"，然后用假设答案的向量去检索，而不是用原始问题的向量。

```python
def hyde_retrieval(query, llm_client):
    prompt = f"""请根据问题生成一段假设的答案（100-200字）。
问题：{query}
假设答案："""
    hypothetical_answer = llm_client.generate(prompt, max_tokens=200)
    results = vector_search(hypothetical_answer, top_k=5)
    return results
```

**原理：** 假设答案和文档都是陈述性文字，风格更接近，向量距离更近。注意：如果 LLM 生成的假设答案方向错了，反而会把检索带偏。适合知识库领域明确的场景。

#### Step-back Prompting（后退提问）

把具体问题往上抽象一层，生成一个更通用的背景问题去检索，把背景知识检索回来，再结合背景知识回答具体问题。

```python
def step_back_retrieval(query, llm_client):
    prompt = f"""将具体问题抽象成一个更通用的背景问题。
具体问题：{query}
背景问题："""
    background_query = llm_client.generate(prompt, max_tokens=100)
    background_docs = vector_search(background_query, top_k=3)
    specific_docs = vector_search(query, top_k=3)
    return background_docs + specific_docs
```

适用场景：问题太具体，知识库只有通用背景的情况。例如"为什么 transformer attention 要除以 sqrt(d_k)" → 背景问题"transformer attention 机制的数学原理"。

### 2.3 多路召回

#### 核心问题：单一检索路径的盲区

- **向量检索：** 擅长语义相似，但对精确词语匹配效果差（如"M4 Pro 芯片"）
- **BM25 关键词检索：** 擅长精确匹配，但不理解语义（"怎么退货" vs "售后申请流程"）

#### 解决方案：向量 + BM25 并行召回 + RRF 融合

```python
def multi_path_retrieval(query, top_k=5):
    vector_results = vector_search(query, top_k=20)
    bm25_results = bm25_search(query, top_k=20)
    fused_results = rrf_fusion([vector_results, bm25_results], smooth_k=60)
    return fused_results[:top_k]
```

**元数据过滤：** 如果用户问题包含时间、类型等约束，可以先用元数据过滤缩小候选集再做向量检索：

```python
filters = {"year": 2023, "doc_type": "policy"}
results = vector_search(query, filters=filters, top_k=10)
```

### 2.4 重排序（Rerank）

#### 核心问题：粗召精度不足

向量相似度 ≠ 语义相关性。向量检索找到的是"在嵌入空间中接近"的文档，但可能实际上不回答问题。

#### 两阶段架构

1. **粗召（Recall）：** 向量检索 + BM25 快速召回 20-30 个候选（毫秒级）
2. **精排（Rerank）：** Cross-Encoder 对每个候选打精确相关性分数，取 top-3 到 top-5

#### Bi-encoder vs Cross-encoder

- **Bi-encoder**：query 和 chunk 分别独立编码，速度极快（毫秒级），适合粗召阶段
- **Cross-encoder**：query + chunk 拼接在一起编码，能捕捉两者之间的细粒度交互，精度高但慢（每对需单独推理），适合精排阶段

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

class Reranker:
    def __init__(self, model_name="BAAI/bge-reranker-v2-m3"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)

    def rerank(self, query: str, candidates: list, top_k=5):
        scores = []
        for chunk in candidates:
            inputs = self.tokenizer(
                query, chunk["content"],
                return_tensors="pt", truncation=True, max_length=512
            )
            with torch.no_grad():
                score = self.model(**inputs).logits.item()
            scores.append((chunk, score))
        ranked = sorted(scores, key=lambda x: x[1], reverse=True)
        return [chunk for chunk, score in ranked[:top_k]]
```

#### Rerank 模型选型

- `BAAI/bge-reranker-v2-m3`：中英双语，效果优异，轻量版本 CPU 快速推理
- `BAAI/bge-reranker-large`：精度更高，速度较慢
- `maidalun1020/bce-reranker-base_v1`：中文场景优化
- Cohere Rerank API / Jina Reranker API：云端服务，无需部署

#### Embedding + Rerank 搭配原则

核心原则：==尽量选同系列模型==，训练数据和语义空间一致时，粗召和精排的"语言"相通，效果最优。

| 场景 | Embedding | Rerank | 说明 |
|------|-----------|--------|------|
| 中文通用 | BGE-M3 | BGE-Reranker-base | 同系列，语义空间一致 |
| 多语言 | GTE-multilingual-base | GTE-multilingual-reranker | 达摩院全家桶 |
| 资源紧张 | E5-small (33M) | MiniLM-L6-cross-encoder | 轻量组合，CPU 可跑 |
| 长文档 | Jina-embeddings-v2 (8K) | Jina-ColBERT-v2 | 长上下文 + ColBERT 精排 |

#### ColBERT：Late Interaction 架构

ColBERT（arXiv:2004.12832, Khattab & Zaharia）是介于 Bi-Encoder 和 Cross-Encoder 之间的架构：

- **编码阶段**：query 和 document 仍然独立编码（类似 Bi-Encoder），document 可离线预计算
- **匹配阶段**：不是单向量点积，而是 query 的每个 token 向量与 document 的每个 token 向量做 MaxSim 运算（Late Interaction）
- **效果**：精度接近 Cross-Encoder，速度远快于 Cross-Encoder（document 向量可预存）

BGE-M3 的 ColBERT 模式即基于此架构，支持在单模型中同时输出 dense/sparse/ColBERT 三种表示。

#### 是否值得加重排

在企业级知识库场景，幻觉带来的业务风险远大于延迟开销。工程上可以做路由：简单 FAQ 查询跳过重排保证速度，复杂专业查询启用重排保证质量。

### 2.5 四层优化组合策略

实际落地时不需要全部都上，按业务场景和问题症状来选：

**典型生产级搭配：**
```text
Parent-Child 索引 + 向量 BM25 多路召回 + Rerank 精排
```

这三层组合基本能覆盖大多数场景的检索质量问题。如果用户提问质量比较差（口语化、指代不清），再额外加上 Query 改写。

**记忆口诀：**
- 索引层保证「存进去的知识可以被找到」
- 查询层保证「搜索的姿势是对的」
- 召回层保证「不漏掉该找到的内容」
- Rerank 层保证「送进 LLM 的是真正有用的内容」

---

## 三、混合检索原理

### BM25 与向量检索的互补性

| 检索方式 | 优势 | 短板 |
|----------|------|------|
| 纯向量检索 | 理解语义、同义词、上下文 | 专有名词、精确编号、关键词匹配弱 |
| 纯 BM25 | 精确关键词匹配，无需训练 | 无法捕捉语义相似性，同义改写全失效 |

混合检索取两者之长，互补盲区。

### BM25 核心原理

BM25 在词频维度上匹配——统计查询词在文档中出现的频率和分布。核心公式：

$$
\text{score}(q, d) = \sum_{i} \text{IDF}(q_i) \times \frac{tf(q_i, d) \times (k_1 + 1)}{tf(q_i, d) + k_1 \times \left(1 - b + b \times \frac{|d|}{\text{avgdl}}\right)}
$$

- `k1`（经典取值 1.2）：词频饱和调节参数，控制词频对分数的影响上限
- `b`（经典取值 0.75）：文档长度归一化参数，防止长文档因词频绝对值高而占优
- `IDF`：逆文档频率，越稀有的词权重越高

### RRF 融合算法

两路检索结果的分数量纲不同（向量是余弦相似度 0-1，BM25 是 TF-IDF 加权分），不能直接相加。

**RRF（Reciprocal Rank Fusion，倒数排名融合）** 只看排名不看分数，天然抗噪：

```python
def rrf_fusion(result_lists, smooth_k=60):
    doc_score_map = {}
    for single_result in result_lists:
        for rank, (doc_id, _) in enumerate(single_result):
            if doc_id not in doc_score_map:
                doc_score_map[doc_id] = 0
            doc_score_map[doc_id] += 1 / (rank + smooth_k)
    return sorted(doc_score_map.items(), key=lambda x: x[1], reverse=True)
```

`smooth_k=60` 是经典取值，防止排名第 1 的文档分数过高压制其他结果。

**为什么 RRF 比加权求和更稳健：** 加权求和需要对两路分数做 min-max 归一化，归一化对异常值敏感；RRF 只看排名不看分数。

**另一种方案：加权求和融合**
```text
final_score = dense_score × 0.6 + sparse_score × 0.4
```
密集权重 0.6、稀疏权重 0.4 是通用场景最优组合；关键词查询占比高的场景可提升稀疏权重至 0.5-0.7。

---

## 四、多轮对话检索去重

> [!info] 去重的前置：consumed_ids 怎么从对话历史提取
> 本节讲==去重的工程实现==（Milvus `expr not in` / `group_by_field`）。`consumed_ids` 列表如何从对话历史中提取、对话历史本身如何存储/截断/摘要、查询改写如何依赖历史等议题，详见 [[多轮对话]]。本节是它的工程子集。

### 问题本质

传统 RAG 检索系统没有"记忆"：每轮对话都当作第一次检索，导致相同文档被反复召回。后果：
- **Token 浪费**：传统方式平均每轮 15.8k tokens，选择性记忆后仅需 2.7k（差近 6 倍）
- **注意力稀释**：重复内容越多，LLM 对新信息的关注度越低，回答质量反而下降
- **用户体验差**：多轮对话中反复给出相同信息

### 模型层方案：VimRAG 的 GGPO

VimRAG（arXiv:2602.12735，阿里通义团队）提出用图结构建模多轮检索过程：

**核心发现**：传统历史拼接方式随轮次增加，无效检索急剧上升；每轮总结历史也不行（丢失细节）。

**GGPO（Graph-Guided Policy Optimization）**：
- 用 DAG 结构追踪每步检索对最终答案的贡献
- 训练时只奖励关键路径上的检索步骤，惩罚无效检索
- 解决传统 RL 的**信号污染**问题：正确答案路径中的废步骤不再获得奖励，错误路径中的有效检索不再被惩罚

### 工程层方案：Milvus 去重

#### 路径一：跨轮次历史排除（`expr not in`）

```python
consumed_ids = get_consumed_ids(session_id)  # 从 Redis 获取历史已用 chunk_id

results = collection.search(
    data=[query_embedding],
    anns_field="embedding",
    param={"metric_type": "COSINE", "params": {"nprobe": 10}},
    limit=10,
    expr=f"chunk_id not in {consumed_ids}"  # 排除已用
)
```

#### 路径二：单次检索内去重（`group_by_field`）

```python
results = collection.search(
    data=[query_embedding],
    anns_field="embedding",
    limit=10,
    group_by_field="doc_id"  # 每个文档最多返回一个 chunk
)
```

#### 路径三：组合方案

两者结合覆盖完整去重链路：`not in` 排除跨轮重复，`group_by_field` 排除单轮内同文档重复。

### 生产落地细节

| 决策点 | 选项 | 适用场景 |
|--------|------|---------|
| 去重粒度 | 记 doc_id（整篇排除） | 文档独立性强，一篇只需看一次 |
| | 记 chunk_id（只排除用过段落） | 长文档不同段落回答不同问题 |
| 状态存储 | Redis + session_id 隔离 + TTL | 生产环境标准方案 |
| 滑动窗口 | 只保留最近 N 轮的 consumed_ids | 防止列表过长导致 HNSW 降级为暴力扫描 |

> [!warning] HNSW 降级风险
> Milvus 内部用 bitset 标记 `not in` 的 ID，HNSW 图遍历时跳过这些节点。当过滤列表过长时，图上可达节点过少，Milvus 会自动降级为暴力扫描，延迟急剧上升。设置滑动窗口（如最近 5 轮）是必要的。

**意图识别联动**：当用户说"再给我看看刚才那个"时，需临时关闭去重逻辑。通过意图识别区分"要新信息"和"要回顾旧信息"两种模式（详见 [[RAG查询理解]]）。

### 是否需要做去重

不是所有场景都需要：
- 知识库很小（< 1000 条）：重复概率低
- 单轮为主：没有跨轮重复问题
- 对话很少超过三轮：收益不明显

当多轮对话占比高、知识库大、用户反馈"总是重复回答"时，优先上工程方案（成本低、见效快）。

---

## 五、检索时的上下文扩展

### 核心矛盾：检索粒度 vs 上下文完整性

分块策略中讨论过的一对矛盾，在检索阶段反过来出现：

- **chunk 越小**：向量越精准（语义单一）→ 检索匹配率高，但 ==chunk 给 LLM 的上下文太短，回答可能没头没尾==
- **chunk 越大**：上下文充足 → LLM 回答完整，但 ==向量被多个主题稀释，检索匹配率下降==

==解决方案：让"检索粒度"和"返回给 LLM 的内容"解耦==——用小粒度检索保证匹配精度，命中后扩展返回更大的上下文给 LLM。

这种"检索-返回"分离的策略有两个主流实现：父子分块和句子窗口检索。

> 注意：这两种方法的 chunk 结构是离线建立的（参见 [[分块策略#二、切分边界的四种方法学]]），但==核心逻辑在检索阶段==——本节聚焦在线检索时如何使用这些结构。

---

### 5.1 父子分块（Small-to-Big Retrieval）

#### 离线结构

创建父-子两级 chunk，==父块大、子块小==，子块通过 `parent_id` 关联到父块：

```text
父块 (parent_chunk):
  chunk_id: "P-001"
  text: "RAG 系统的检索阶段包括四个层次……（约 2000 字符的完整段落）"

子块 (child_chunks):
  - chunk_id: "C-001-1", text: "查询理解...", parent_id: "P-001", embedding: [...]
  - chunk_id: "C-001-2", text: "向量召回...", parent_id: "P-001", embedding: [...]
  - chunk_id: "C-001-3", text: "重排精筛...", parent_id: "P-001", embedding: [...]
```

==只有子块向量化和入向量库==，父块只存内容，可以放向量库的 metadata 字段或单独的 KV 存储。

#### 在线检索逻辑

```text
query → query_embedding
   ↓
向量库召回 top-K 子块（按子块向量相似度）
   ↓
提取每个子块的 parent_id
   ↓
去重：多个子块可能指向同一个父块
   ↓
按 parent_id 拉取父块内容
   ↓
父块作为最终上下文返回给 LLM
```

代码片段（基于 LangChain `ParentDocumentRetriever` 的等价实现）：

```python
def parent_child_retrieve(query, vector_store, doc_store, top_k=5):
    # 1. 子块向量召回
    child_results = vector_store.similarity_search(query, k=top_k)

    # 2. 提取 parent_id 并去重
    parent_ids = list({r.metadata["parent_id"] for r in child_results})

    # 3. 拉取父块（保留子块的命中顺序）
    parent_chunks = [doc_store.get(pid) for pid in parent_ids]

    return parent_chunks
```

#### 适用场景

==文档有清晰的层次结构==：技术手册的"章 → 节 → 段"、法律文件的"条 → 款 → 项"、API 文档的"模块 → 端点 → 参数"。父块对应自然的语义单元（一个完整的小节），子块对应内部的细粒度片段。

#### 关键参数

- 父块大小：1500-3000 字符（一个完整小节）
- 子块大小：300-600 字符（一个段落）
- 子块 overlap：50-100 字符（避免子块边界截断）
- 召回 top-K：子块 K 较大（10-20），去重后父块通常 3-5 个

---

### 5.2 句子窗口检索（Sentence Window Retrieval）

#### 离线结构

==以单句为粒度==存储和向量化，每个句子记录==前后 N 句的引用==：

```text
chunk_id: "S-042"
text: "查询理解层负责识别用户意图。"
prev_ids: ["S-040", "S-041"]
next_ids: ["S-043", "S-044"]
embedding: [...]
```

#### 在线检索逻辑

```text
query → query_embedding
   ↓
向量库召回 top-K 单句
   ↓
对每个命中的句子，从原文档动态拼接前后 N 句
   ↓
拼接后的窗口作为上下文返回给 LLM
```

代码片段：

```python
def sentence_window_retrieve(query, vector_store, doc_store, top_k=5, window=2):
    # 1. 单句向量召回
    hit_sentences = vector_store.similarity_search(query, k=top_k)

    # 2. 对每个命中句子，拼接前后窗口
    expanded_results = []
    for sent in hit_sentences:
        prev_sents = [doc_store.get(pid).text for pid in sent.metadata["prev_ids"][-window:]]
        next_sents = [doc_store.get(nid).text for nid in sent.metadata["next_ids"][:window]]
        window_text = " ".join(prev_sents + [sent.text] + next_sents)
        expanded_results.append(window_text)

    return expanded_results
```

#### 适用场景

==句子语义独立性强的文档==：法律条款（每条独立成义）、API 描述（每个参数说明独立）、问答对（每条 Q&A 独立）。检索时往往需要"命中点 + 紧邻上下文"，不需要整段。

#### 关键参数

- 窗口大小：前后各 2-3 句（5-7 句的总窗口）
- 召回 top-K：通常 5-10
- 存储成本：每句独立向量，存储量是普通分块的 5-10 倍

---

### 5.3 父子分块 vs 句子窗口检索

| 维度 | 父子分块 | 句子窗口检索 |
|------|---------|-------------|
| 上下文形态 | ==预定义==的固定父块 | 命中点为中心==动态==扩展窗口 |
| 灵活性 | 低（父块边界固定） | 高（命中哪里扩展哪里） |
| 实现复杂度 | 中（维护父子关系） | 低（线性序列+前后引用） |
| 存储开销 | 中等（父块单独存） | 大（每句独立向量） |
| 上下文连贯性 | 强（父块本身是完整语义单元） | 中（窗口可能横跨章节） |
| 跨章节风险 | 无（父块边界对齐章节） | 有（窗口可能跨越主题） |
| 适合场景 | 有清晰层次的结构化文档 | 句子独立性强的线性文档 |

#### 选型建议

- **优先父子分块**：技术手册、法规、API 文档、Wiki——文档有自然的层次单元
- **优先句子窗口**：法律条款、问答库、会议纪要——句子是独立语义单元
- **不要混用**：两套检索逻辑差异大，混用会让系统复杂度暴涨且收益不明

---

### 5.4 与离线分块策略的关系

本节的"检索时上下文扩展"建立在==离线 chunk 结构==之上：

| 离线（[[分块策略#二、切分边界的四种方法学]]） | 在线（本节） |
|--------------------------------------------------------|------------|
| L2 结构感知切分（识别章节层级） | 5.1 父子分块（取父块返回） |
| L1 规则切分到句子级 | 5.2 句子窗口检索（动态扩展） |
| chunk 内容增强（与 L1-L4 正交，Contextual Retrieval/Late Chunking） | 不需要在线扩展，向量本身已携带上下文 |

==离线决定 chunk 的形态，在线决定怎么用这些 chunk==——两边设计要配套。

---

## 六、生产环境检索延迟优化

> RAG 检索链路在生产环境的延迟优化手段，按"==检索链路本身==的优化"和"==与可观测 / 成本控制==交叉的兜底"分两类。

### 6.1 六条优化策略

| # | 策略 | 类别 | 关键做法 |
|---|------|------|--------|
| 1 | ==并行检索== | 检索链路 | 多知识源同时查询，整体延迟取最大值而非求和 |
| 2 | ==语义缓存== | 检索链路 | 语义相似的查询共享结果，==命中率 >30%== |
| 3 | ==两阶段检索== | 检索链路 | 低成本模型粗召回 Top-100，高精度 Reranker 精排 Top-10（见 §2.4） |
| 4 | ==超时降级== | 兜底 | 超时后返回==无检索==的 LLM 直接回答 |
| 5 | ==动态 Top-K== | 检索链路 | 简单查询检索少，复杂查询检索多 |
| 6 | ==模型降级== | 兜底 | 高峰时切换更便宜的模型 |

==前 4 类（并行 / 缓存 / 两阶段 / 动态 Top-K）==是检索链路本身的优化；==超时降级 / 模型降级==是与可观测 / 成本控制交叉的兜底手段（Agent 侧的成本控制见 [[Agent 可观测性#五、Agent 成本控制]]）。

### 6.2 两阶段检索与本文 §2.4 的关系

==两阶段检索==（粗召回 + Reranker 精排）就是 §2.4「重排序」的工程命名——本节强调它的==延迟收益==：

- Bi-encoder 粗召百毫秒级，Cross-encoder 精排只对 Top-N 候选打分
- 不做两阶段时，要么粗召召回率不够，要么 Cross-encoder 对全库打分延迟爆炸

### 6.3 语义缓存的命中率

==语义缓存== ≠ ==精确字符串缓存==——同一意思的不同表达（"怎么退货" / "退货流程" / "我要退货咋办"）==共享同一份检索结果==。

工程实现：query 向量化后在小型向量库里查 top-1，相似度 > 阈值（典型 0.92）则复用结果。==命中率 >30%== 是企业 FAQ 场景的常见水平。

> [!note] 文档来源
> 本节内容由 `wiki/Agent/Agent 可观测性.md` §六「生产环境延迟优化策略」迁出（原文属 RAG 检索性能主题，与「Agent 可观测性」主题关联弱，按内容边界归位到 RAG 域）。

---

## 相关链接

- [[RAG查询理解]] — 在线第一步：查询理解、Function Calling、Agentic RAG、查询改写
- [[RAG基础与架构]] — 离线管道：文档解析、文本清洗、分块策略
- [[RAG向量与Embedding]] — 向量数据库选型与 Embedding 模型
- [[RAG高级技术]] — Agentic RAG、GraphRAG、自反思 RAG
- [[LLM 基础与训练]] — Transformer 与 Embedding 原理基础
- [[Agent 核心概念]] — Agent 架构中的 RAG 定位
