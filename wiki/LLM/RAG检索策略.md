---
module: LLM
tags: [RAG, 检索, BM25, 混合检索, Rerank, 查询理解, 多轮对话, ColBERT]
difficulty: hard
last_reviewed: 2026-05-18
---

# RAG 检索策略

> 本文覆盖 RAG 在线阶段的全链路：查询理解 → 检索优化 → 混合检索 → 重排。离线阶段（文档解析、分块）见 [[RAG基础与架构]]，向量数据库与 Embedding 见 [[RAG向量与Embedding]]。

## 一、查询理解与意图识别

### 为什么需要查询理解

传统 RAG 系统的典型问题：所有用户查询无差别地走向量检索流程（query → 向量化 → 检索 → 拼 Prompt → 生成）。这导致：
- 计算型查询（"保额 50 万、免赔额 1 万、花费 8 万能赔多少？"）被送去搜索知识库，LLM 试图从文档中"推理"出数值结果，而非直接调用计算模块
- 数据查询型（"我的理赔申请进度"）去搜通用知识，返回"一般需要 5-15 个工作日"而非用户的具体记录
- 闲聊型查询触发不必要的检索，浪费资源

**核心问题：该精确的变成了模糊的，该确定的变成了概率的。**

正确做法：在检索前加入 **Query 理解层**，先识别用户意图，再路由到对应的处理链路。

### 意图分类体系

最基本的意图分类至少包含四种类型：

| 意图类型 | 典型场景 | 处理链路 | 示例 |
|---------|---------|---------|------|
| **知识问答类** | 查询概念、规则、流程 | 向量检索 + LLM 生成 | "重疾险的等待期是多少天？" |
| **计算求解类** | 包含明确数值参数的计算 | 计算模块（公式/代码） | "保额 50 万、免赔 1 万、花费 8 万能赔多少？" |
| **数据查询类** | 查询个人业务数据 | NL2SQL / 结构化查询 | "我上个月的理赔申请进度？" |
| **闲聊类** | 寒暄、感谢、无关话题 | 直接 LLM 回复或引导 | "你好""谢谢""今天天气不错" |

### 意图识别实现方案

#### 方案一：规则匹配（Rule-based）

维护关键词映射表，通过正则表达式或关键词匹配判断意图。

```python
def classify_intent_rule(query: str) -> str:
    if any(kw in query for kw in ["多少钱", "怎么算", "赔付金额", "计算"]):
        return "calculation"
    if any(kw in query for kw in ["进度", "状态", "我的申请", "我的订单"]):
        return "data_query"
    if any(kw in query for kw in ["你好", "谢谢", "再见", "天气"]):
        return "chitchat"
    return "knowledge_qa"
```

优点：零延迟，可控性强，无需训练数据。缺点：覆盖面有限，用户换个说法就匹配不上。

#### 方案二：机器学习分类模型（ML-based）

使用 BERT 或轻量级文本分类模型训练四分类器。

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

class IntentClassifier:
    def __init__(self, model_path):
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_path)
        self.labels = ["knowledge_qa", "calculation", "data_query", "chitchat"]

    def classify(self, query: str) -> tuple[str, float]:
        inputs = self.tokenizer(query, return_tensors="pt", truncation=True, max_length=128)
        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1)
            confidence, pred_idx = torch.max(probs, dim=-1)
        return self.labels[pred_idx.item()], confidence.item()
```

优点：识别同义表达，鲁棒性强。缺点：需要几百条标注数据训练，有推理延迟（10-30ms）。

#### 方案三：LLM 零样本分类（LLM-based）

用 LLM 做 Few-shot 分类，无需训练。

```python
def classify_intent_llm(query: str, llm_client) -> str:
    prompt = f"""你是一个意图分类助手。请判断用户问题属于以下哪一类：
1. knowledge_qa - 知识问答（查询概念、规则、流程）
2. calculation - 计算求解（包含数值参数需要计算）
3. data_query - 数据查询（查询个人业务数据）
4. chitchat - 闲聊（寒暄、感谢等）

用户问题：{query}

只返回类别名称，不要解释。"""
    response = llm_client.generate(prompt, max_tokens=20)
    return response.strip()
```

优点：无需训练，泛化能力强。缺点：延迟较高（100-500ms），成本较高。

**实践建议：三种方案组合使用**
1. 先用规则匹配处理高置信度的明显 case
2. 规则无法覆盖时，调用 ML 分类器
3. ML 分类器置信度 < 0.6 时，回退到 LLM 分类或默认走知识问答链路

### 实体提取

意图识别后，需要提取查询中的关键约束条件，辅助后续处理。

**提取目标：**
- **时间实体：** "上个月""2023 年 Q2""最近一周"
- **数值实体：** "保额 50 万""免赔额 1 万""花费 8 万"
- **业务实体：** "重疾险""理赔申请""订单号 12345"

**实现方式：**

1. **正则表达式：** 提取结构化数值和时间
```python
import re
from datetime import datetime, timedelta

def extract_entities(query: str) -> dict:
    entities = {}
    amount_pattern = r'(\d+(?:\.\d+)?)\s*万'
    amounts = re.findall(amount_pattern, query)
    if amounts:
        entities['amounts'] = [float(a) * 10000 for a in amounts]
    if "上个月" in query:
        last_month = datetime.now() - timedelta(days=30)
        entities['time_range'] = ('start', last_month.strftime('%Y-%m-%d'))
    return entities
```

2. **NER 模型：** 使用命名实体识别模型提取业务实体
```python
from transformers import pipeline
ner = pipeline("ner", model="hfl/chinese-roberta-wwm-ext-large")
entities = ner("我的重疾险理赔申请进度")
```

### 查询路由（Query Routing）

根据意图分类结果，将查询路由到不同的处理链路：

```python
def route_query(query: str, intent: str, confidence: float, entities: dict):
    if confidence < 0.6:
        return retrieval_pipeline(query)
    if intent == "knowledge_qa":
        return retrieval_pipeline(query, filters=entities)
    elif intent == "calculation":
        return calculation_module(entities.get('amounts', []))
    elif intent == "data_query":
        return database_query(nl2sql_generator(query, entities))
    elif intent == "chitchat":
        return llm_chat(query)
```

**多索引路由：** 如果知识库按主题分成多个索引（如"理赔制度""产品信息""投保指南"），可根据查询主题选择最相关的索引检索，提高精度并减少计算量。

### 容错与回退机制

意图分类器不是 100% 准确，需要设计容错策略：

1. **置信度阈值：** ML 分类器预测概率 < 0.6 时，回退到默认检索链路
2. **多路径并行：** 对于模糊 case，同时走两条路径（如既做检索又做计算），取结果更好的一个
3. **异常回退：** 计算模块返回异常结果或 NL2SQL 执行报错时，自动回退到检索链路

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

#### 核心矛盾：检索粒度 vs 上下文完整性

一个 chunk 需要同时完成两个任务：
1. **检索时被找到：** 要求向量语义聚焦，需要小粒度 chunk（如 150 token）
2. **被 LLM 读懂：** 要求上下文完整，需要大粒度 chunk（如 500 token）

小 chunk 检索准但内容太碎，大 chunk 内容完整但检索时语义稀释。

#### 方案一：Parent-Child Chunking（父子分块）

把文档切成两个版本：
- **子 chunk（Child）：** 细粒度（150 token），用于建立向量索引
- **父 chunk（Parent）：** 粗粒度（500 token），用于提供给 LLM

```python
child_chunk = {
    "id": "child_001",
    "parent_id": "parent_001",
    "content": "重疾险的等待期是指...",  # 150 token
    "embedding": [0.12, 0.34, ...]
}

parent_chunk = {
    "id": "parent_001",
    "content": "保险产品介绍：重疾险是一种...[完整上下文 500 token]",
    "children": ["child_001", "child_002", "child_003"]
}

def retrieve_with_parent_child(query):
    child_results = vector_search(query, index="child_chunks", top_k=10)
    parent_ids = [child["parent_id"] for child in child_results]
    parent_chunks = fetch_parents(parent_ids)
    return deduplicate(parent_chunks)
```

适用场景：通用场景，效果稳定。

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

**原��：** 假设答案和文档都是陈述性文字，风格更接近，向量距离更近。注意：如果 LLM 生成的假设答案方向错了，反而会把检索带偏。适合知识库领域明确的场景。

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

### 四层优化组合策略

实际落地时不需要全部都上，按业务场景和问题症状来选：

**典型生产级搭配：**
```
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
```
final_score = dense_score × 0.6 + sparse_score × 0.4
```
密集权重 0.6、稀疏权重 0.4 是通用场景最优组合；关键词查询占比高的场景可提升稀疏权重至 0.5-0.7。

---

## 四、多轮对话检索去重

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

**意图识别联动**：当用户说"再给我看看刚才那个"时，需临时关闭去重逻辑。通过意图识别区分"要新信息"和"要回顾旧信息"两种模式。

### 是否需要做去重

不是所有场景都需要：
- 知识库很小（< 1000 条）：重复概率低
- 单轮为主：没有跨轮重复问题
- 对话很少超过三轮：收益不明显

当多轮对话占比高、知识库大、用户反馈"总是重复回答"时，优先上工程方案（成本低、见效快）。

---

## 相关链接

- [[RAG基础与架构]] — 离线管道：文档解析、文本清洗、分块策略
- [[RAG向量与Embedding]] — 向量数据库选型与 Embedding 模型
- [[RAG高级技术]] — Agentic RAG、GraphRAG、自反思 RAG
- [[LLM基础与训练]] — Transformer 与 Embedding 原理基础
- [[Agent核心概念]] — Agent 架构中的 RAG 定位
