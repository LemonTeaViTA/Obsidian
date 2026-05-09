---
module: LLM
tags: [RAG, 检索, BM25, 混合检索, Rerank, 查询理解]
difficulty: hard
last_reviewed: 2026-05-09
---

# RAG 检索策略

## 〇、查询理解与意图识别

### 为什么需要查询理解

传统 RAG 系统的典型问题：所有用户查询无差别地走向量检索流程（query → 向量化 → 检索 → 拼 Prompt → 生成）。这导致：
- 计算型查询（"保额 50 万、免赔额 1 万、花费 8 万能赔多少？"）被送去搜索知识库，LLM 试图从文档中"推理"出数值结果，而非直接调用计算模块
- 数据查询型（"我的理赔申请进度"）去搜通用知识，返回"一般需要 5-15 个工作日"而非用户的具体记录
- 闲聊型查询触发不必要的检索，浪费资源

**核心问题：该精确的变成了模糊的，该确定的变成了概率的。**

> [!tip] 查询理解是区分度最高的面试题
> 大多数候选人只会回答"RAG = 检索 + 生成"，能讲清楚查询理解层（意图识别 → 路由 → 分类处理）的人很少。面试中主动提到这一层，展示你对 RAG 工程化的深度理解。

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

**实现：** 维护关键词映射表，通过正则表达式或关键词匹配判断意图。

```python
def classify_intent_rule(query: str) -> str:
    # 计算类关键词
    if any(kw in query for kw in ["多少钱", "怎么算", "赔付金额", "计算"]):
        return "calculation"
    # 数据查询类关键词
    if any(kw in query for kw in ["进度", "状态", "我的申请", "我的订单"]):
        return "data_query"
    # 闲聊类关键词
    if any(kw in query for kw in ["你好", "谢谢", "再见", "天气"]):
        return "chitchat"
    # 默认为知识问答
    return "knowledge_qa"
```

**优点：** 零延迟，可控性强，无需训练数据
**缺点：** 覆盖面有限，用户换个说法就匹配不上

#### 方案二：机器学习分类模型（ML-based）

**实现：** 使用 BERT 或轻量级文本分类模型训练四分类器。

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

**优点：** 识别同义表达，鲁棒性强
**缺点：** 需要几百条标注数据训练，有推理延迟（10-30ms）

**训练数据示例：**
```
"重疾险等待期多久？" → knowledge_qa
"帮我看看能拿到多少补偿" → calculation
"我的理赔单到哪一步了" → data_query
"今天天气真好" → chitchat
```

#### 方案三：LLM 零样本分类（LLM-based）

**实现：** 用 LLM 做 Few-shot 分类，无需训练。

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

**优点：** 无需训练，泛化能力强，能处理边界 case
**缺点：** 延迟较高（100-500ms），成本较高

**实践建议：** 三种方案组合使用
1. 先用规则匹配处理高置信度的明显 case（如包含"多少钱"直接判定为计算类）
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
    
    # 提取金额（支持"万"单位）
    amount_pattern = r'(\d+(?:\.\d+)?)\s*万'
    amounts = re.findall(amount_pattern, query)
    if amounts:
        entities['amounts'] = [float(a) * 10000 for a in amounts]
    
    # 提取时间
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
# 输出：[{'entity': 'B-PRODUCT', 'word': '重疾险'}, ...]
```

### 查询路由（Query Routing）

根据意图分类结果，将查询路由到不同的处理链路：

```python
def route_query(query: str, intent: str, confidence: float, entities: dict):
    # 置信度不足时回退到默认检索
    if confidence < 0.6:
        return retrieval_pipeline(query)
    
    if intent == "knowledge_qa":
        # 走向量检索链路
        return retrieval_pipeline(query, filters=entities)
    
    elif intent == "calculation":
        # 走计算模块
        params = entities.get('amounts', [])
        return calculation_module(params)
    
    elif intent == "data_query":
        # 走 NL2SQL
        sql = nl2sql_generator(query, entities)
        return database_query(sql)
    
    elif intent == "chitchat":
        # 直接 LLM 回复
        return llm_chat(query)
```

**多索引路由：** 如果知识库按主题分成多个索引（如"理赔制度""产品信息""投保指南"），可根据查询主题选择最相关的索引检索，提高精度并减少计算量。

### 容错与回退机制

意图分类器不是 100% 准确，需要设计容错策略：

**1. 置信度阈值：** ML 分类器预测概率 < 0.6 时，回退到默认检索链路
```python
intent, confidence = classifier.classify(query)
if confidence < 0.6:
    intent = "knowledge_qa"  # 保守策略
```

**2. 多路径并行：** 对于模糊 case，同时走两条路径（如既做检索又做计算），取结果更好的一个
```python
if 0.5 < confidence < 0.7:
    result_retrieval = retrieval_pipeline(query)
    result_calculation = calculation_module(query)
    return select_best_result(result_retrieval, result_calculation)
```

**3. 异常回退：** 计算模块返回异常结果（如负数赔付金额）或 NL2SQL 执行报错时，自动回退到检索链路
```python
try:
    result = calculation_module(params)
    if result < 0:  # 异常结果
        raise ValueError("Invalid calculation result")
    return result
except Exception:
    return retrieval_pipeline(query)  # 回退
```

### 实践效果

某保险问答系统引入意图识别后的效果对比：

| 指标 | 引入前 | 引入后 | 提升 |
|-----|-------|-------|------|
| 计算类查询准确率 | 43% | 89% | +107% |
| 数据查询类准确率 | 38% | 91% | +139% |
| 整体用户满意率 | 61% | 78% | +27.9% |
| 平均响应时间 | 1.2s | 1.1s | -8.3% |

**关键改进：** 计算类和数据查询类不再错误地走检索链路，准确率大幅提升；闲聊类不触发检索，响应时间反而下降。

---

## 一、数据预处理流程

数据预处理是 RAG 系统效果的基础，直接决定了检索召回率的上限。流程分四步：

**1. 文档解析**
针对不同格式采用适配的解析工具提取文本与元数据。PDF 采用布局感知解析，区分正文、标题、表格、页眉页脚，避免非核心内容干扰；Word 提取正文与层级标题；HTML 去除导航栏、广告等冗余内容，提取核心正文。

**2. 文本清洗**
去除多余空格、换行符、特殊符号，统一中英文标点格式，过滤长度过短的无效文本片段（如 < 50 字符），确保文本连贯性与规范性。

**3. 元数据提取**
为每段文本提取对应元数据：文档唯一 ID、文档类型、所属章节标题、更新时间、访问权限等级。这些元数据用于后续检索过滤（按权限、按时间范围缩小候选集）和来源追溯。

**4. 文本分块**
采用递归字符分块策略，按段落 → 句子 → 词语的优先级进行分割。基础分块大小 512 token，块间重叠 50 token，保证每个分块的语义完整性，避免语义单元被截断导致检索偏差。

> 数据来源：[动态知识库的RAG系统混合检索与性能优化研究：融合BM25与稠密向量及RRF重排序实证分析](https://mp.weixin.qq.com/s?__biz=MzU4NTA1MDk4MA==&mid=2247554659&idx=1&sn=707b40f835af03e25f0a40726996dcfc&chksm=fc3809685bf64eb6087cc78afca98bd42d5ff2f9b3caae6c4c1e5d13efe9ac9743383aa2488d&mpshare=1&scene=24&srcid=0405JGVoNVxFK2HT0sRclYvb&sharer_shareinfo=43114a4bb85b93457016cd36be027e4f&sharer_shareinfo_first=43114a4bb85b93457016cd36be027e4f#rd)，数据集：MS MARCO + DuReader。

### 判别式语义分块：超长文档分块新方案

> 内容来源：[RAG语义分块新范式！金山办公提出超长文档通用分块框架](https://mp.weixin.qq.com/s?__biz=MzYzMjE5MDkwOA==&mid=2247486910)
> 论文：https://arxiv.org/pdf/2602.23370

#### 现有分块方案的短板

| 方案 | 代表 | 短板 |
|------|------|------|
| 无监督规则方法 | TextTiling | 靠词汇相似度/LDA，严重依赖人工调参，对复杂文体鲁棒性差 |
| 传统监督式判别模型 | BERT 序列标注 | 受限于 Transformer 二次复杂度，只能处理短文本，超长文档强制截断丢失信息 |
| 生成式大模型分块 | Jina Qwen2 系列 | 逐 token 生成推理慢、成本高；超过数千 token 性能下降；对 prompt 敏感 |

#### 判别式框架：编码-聚合-融合-判别

核心思路：跳出"生成式分块"，将主题分割转化为"相邻句子间是否存在主题边界"的二分类问题。

**5 个核心阶段**：
1. **句子级细粒度建模**：将文档拆分为句子级基础文本块，句子是最小的语义完整单元，提供更细的候选边界粒度
2. **token 级语义编码**：用 Qwen3-0.6B 作为骨干网络，对全文本做 token 级编码
3. **块级语义聚合**：通过注意力池化聚合得到每个句子的块级语义表示
4. **跨块上下文建模**：新增轻量 Transformer 编码器，建模跨句子的上下文依赖关系，既捕捉局部语义变化，也参考全文篇章结构
5. **边界判别预测**：MLP 分类头直接输出相邻句子间的主题边界概率，无需复杂解码

#### 超长文档处理：重叠滑动窗口

- 超长文档按固定长度拆分窗口，相邻窗口保留 10% 重叠区域
- 重叠区域的边界概��取多个窗口预测结果的平均值
- 无需额外参数，支持任意长度文档

#### 启发式后处理：三阶段无参数策略

1. 按预设阈值做初始分块，生成高置信度的粗粒度语义块
2. 超长块递归选取块内边界概率最高的位置二次拆分，直到满足长度约束
3. 超短块对比左右边界语义连续性，自动合并到语义更连贯的一侧

#### 超长块检索适配：向量融合与标量校正（VFSC）

**解决问题**：分块后的超长块超出嵌入模型上下文窗口，截断会导致语义丢失

**方案**：用一个融合向量 + 一个标量因子，严格还原超长块所有子段的平均余弦相似度
- 存储复杂度：O(N) → O(1)
- 检索计算量：O(N) → O(1)
- 零语义损失，与现有 RAG 检索系统无缝衔接

#### 技术特点总结

- 基于 Qwen3-0.6B 轻量化模型，原生支持 13k+ token
- 判别式而非生成式，推理速度快两个数量级
- 适合企业级海量文档处理、超长文档、对推理速度和成本敏感的场景

### 分块策略实战：从固定 512 到语义感知，召回率 67% → 91%

> 内容来源：[阿里面试官怒了：RAG 你 chunk 还在用固定 512](https://mp.weixin.qq.com/s?__biz=MzkzMDIwMzg1Mw==&mid=2247490039)

#### 三代方案演进

| 版本 | 策略 | Recall@5 | 核心问题 |
|------|------|----------|---------|
| V1 | 固定长度 512 token，overlap 50 | 0.67 | 句子中间截断，章节标题丢失，语义残缺 |
| V2 | 句子级切分（按句号/问号等自然边界） | 0.74 | 不理解文档层级结构，表格和列表处理差 |
| V3 | 语义感知切分（层级识别 + 递归细切 + 特殊元素处理） | 0.91 | — |

关键结论：没换 Embedding 模型，没调检索策略，仅改切分方式就提升了 24 个百分点。

#### V3 核心设计

**1. 文档结构识别（多策略融合）**
- 用正则匹配识别多种编号体系（`第X章/条`、`X.X`、`（X）`、`（1）/a)` 等）
- 切分原则：同一章节内容尽量放在同一个 chunk，跨章节绝不合并

**2. 超长章节递归细切**
- 普通章节 max_size = 1024 token
- 关键条款（责任/免责/费率）max_size = 1536 token（这类内容任何截断都会导致语义丢失）
- 先按子小节边界切，没有子小节则按句子边界切

**3. 表格专项处理**
- 小表格（≤300 token）：整体作为一个 chunk
- 大表格（跨页/超 300 token）：按行切分，每个 chunk 复制表头
- 不复制表头的后果：LLM 收到没有表头的数据行，不知道字段含义，只能胡编（表格类问题正确率从 43% → 78%）

**4. 列表项前导句合并**
- 问题：`（1）核辐射` 单独成 chunk 后，向量里没有"不在承保范围"这个关键语义，LLM 会误判为承保
- 方案：识别列表结构，把前导句和所有列表项合并；超长则至少保留前导句到每个 chunk
- 效果：否定性查询召回率从 0.58 → 0.83

#### Overlap 量化实验

| Overlap 大小 | Recall@5 | 存储增加 |
|-------------|----------|---------|
| 0 token | 0.81 | 基准 |
| 50 token | 0.86 | +5% |
| 100 token | 0.89 | +10% |
| 200 token | 0.90 | +20% |
| 300 token | 0.90 | +30% |

100 token 是性价比最优点。在此基础上加"基于句子边界的智能 overlap"（向后扫描到最近句子结尾才截断），避免了 87% 的句子在重叠区域被截断问题，召回率从 0.89 → 0.91。

#### Chunk 元数据设计

```python
@dataclass
class ChunkMetadata:
    doc_id: str          # 文档ID
    chunk_id: str        # chunk唯一ID
    section_path: str    # 层级路径："第3条 保险责任 > 3.2 责任免除"
    chunk_type: str      # "text" | "table" | "list"
    is_key_clause: bool  # 是否关键条款（责任/免责/费率）
    prev_chunk_id: str   # 前一个chunk ID（用于上下文扩展）
    next_chunk_id: str   # 后一个chunk ID
    token_count: int
    page_range: str      # 来源页码范围
```

用途：section_path 用于答案溯源；is_key_clause 用于检索加权（1.5 倍）；prev/next_chunk_id 用于检索到半截信息时自动扩展上下文。

#### 前沿方向

- **语义切分（Semantic Chunking）**：用 Embedding 模型计算相邻句子向量相似度，相似度突变处即为切分边界。理论更精准，但计算成本高（一份文档 30-40 秒 vs 规则方案 2-3 秒），大规模场景暂不实用
- **Late Chunking**：先用长文本 Embedding 对整个文档编码，再在向量层面切分，每个 token 向量都带全文上下文。目前内存占用是传统方案 8-10 倍，处于研究阶段
- **动态 Chunk Size**：根据章节语义密度（用 LLM 打分 0-10）动态调整 size，对多跳推理类问题有 3-5 个百分点提升

---

## 一、RAG 检索优化的四层框架

### 为什么检索是 RAG 的命脉

LLM 只能根据送进去的 context 来回答，检索召回的内容就是整个系统的天花板。生成层做得再好，如果检索没把相关内容找回来，LLM 也是巧妇难为无米之炊。

**投入产出比：** 生成层的优化（调 prompt、换模型）是锦上添花，而检索层的优化是从根本上提升系统的能力上限。在 RAG 系统里，检索优化是投入产出比最高的环节。

### 四层优化全貌

RAG 检索优化可以从四个层次来理解，每一层解决的问题不同，优化手段也不同：

| 层次 | 核心问题 | 关键技术 | 优先级 |
|------|---------|---------|--------|
| **索引层** | 知识怎么「存」 | Small-to-Big、Parent-Child、摘要索引 | 推荐 |
| **查询层** | 问题怎么「转」 | Query 改写、Multi-Query、HyDE、Step-back | 视场景 |
| **召回层** | 从哪里「找」 | 多路召回（向量 + BM25）、元数据过滤 | 推荐 |
| **重排序层** | 谁「最相关」 | Cross-Encoder Rerank | 强烈推荐 |

**层次关系：** 索引层决定「仓库里放了什么」，查询层决定「用什么钥匙开门」，召回层决定「从哪几扇门进去找」，重排序层决定「把找到的东西里最好的几件带出来」。

### 第一层：索引优化（Small-to-Big）

#### 核心矛盾：检索粒度 vs 上下文完整性

一个 chunk 需要同时完成两个任务：
1. **检索时被找到：** 要求向量语义聚焦，需要小粒度 chunk（如 150 token）
2. **被 LLM 读懂：** 要求上下文完整，需要大粒度 chunk（如 500 token）

**问题：** 小 chunk 检索准但内容太碎，大 chunk 内容完整但检索时语义稀释。

#### 解决方案：Small-to-Big 策略

**核心思路：小块检索、大块使用。**

**方案一：Parent-Child Chunking（父子分块）**

把文档切成两个版本：
- **子 chunk（Child）：** 细粒度（150 token），用于建立向量索引
- **父 chunk（Parent）：** 粗粒度（500 token），用于提供给 LLM

```python
# 数据结构示例
child_chunk = {
    "id": "child_001",
    "parent_id": "parent_001",  # 关联父 chunk
    "content": "重疾险的等待期是指...",  # 150 token
    "embedding": [0.12, 0.34, ...]  # 向量索引
}

parent_chunk = {
    "id": "parent_001",
    "content": "保险产品介绍：重疾险是一种...[完整上下文 500 token]",
    "children": ["child_001", "child_002", "child_003"]
}

# 检索流程
def retrieve_with_parent_child(query):
    # 1. 用子 chunk 的向量检索
    child_results = vector_search(query, index="child_chunks", top_k=10)
    
    # 2. 根据 parent_id 取出对应的父 chunk
    parent_ids = [child["parent_id"] for child in child_results]
    parent_chunks = fetch_parents(parent_ids)
    
    # 3. 父 chunk 去重后返回给 LLM
    return deduplicate(parent_chunks)
```

**优点：** 检索精度高（小块语义聚焦），LLM 理解好（大块上下文完整）
**适用场景：** 通用场景，效果稳定

**方案二：摘要索引（Summary Index）**

为每段内容生成摘要，用摘要建向量索引，检索时用摘要匹配，命中后返回原文。

```python
# 数据结构
document_chunk = {
    "id": "doc_001",
    "summary": "本段介绍重疾险的等待期规则和计算方法",  # 用于检索
    "content": "重疾险等待期详细说明...[原文 500 token]",  # 用于 LLM
    "summary_embedding": [0.23, 0.45, ...]
}

# 检索流程
def retrieve_with_summary(query):
    # 1. 用摘要的向量检索
    summary_results = vector_search(query, index="summary_embeddings", top_k=5)
    
    # 2. 返回原文内容给 LLM
    return [doc["content"] for doc in summary_results]
```

**优点：** 摘要语义更聚焦，命中率更高
**缺点：** 需要 LLM 生成摘要，离线处理成本高
**适用场景：** 文档表述散乱、需要提炼核心意思的场景

**方案三：多粒度分层索引**

同时建立章节级、段落级、句子级三层索引，根据问题类型选择合适粒度。

```python
# 三层索引结构
indexes = {
    "chapter": [...],   # 章节级（1000+ token）
    "paragraph": [...], # 段落级（500 token）
    "sentence": [...]   # 句子级（50-100 token）
}

# 根据问题类型路由
def route_by_query_type(query):
    if is_conceptual_question(query):  # "什么是 RAG"
        return search(query, index="chapter")
    elif is_detail_question(query):    # "退款需要几个工作日"
        return search(query, index="sentence")
    else:
        return search(query, index="paragraph")
```

**优点：** 覆盖不同类型问题
**缺点：** 索引存储成本高（3 倍），路由逻辑复杂
**适用场景：** 问题类型多样、对精度要求极高的场景

### 第二层：查询优化

#### 核心问题：用户提问与知识库表述的鸿沟

即使索引建得再好，用户的提问方式和知识库里的表述方式之间还是会存在鸿沟。

**示例：** 用户问"苹果手机咋截图"，知识库写的是"iPhone 截图操作方法"。两句话意思一样，但向量相似度可能不高（口语 vs 书面语）。

#### 优化方法

**方法一：Query 改写（Query Rewriting）**

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

# 示例
# 输入："它为什么这么贵"
# 输出："iPhone 15 Pro Max 定价偏高的原因是什么"
```

**适用场景：** 用户提问质量差、指代不清、口语化严重

**方法二：Multi-Query 扩展**

把一个问题扩展成 3-5 个不同角度的问法，每种问法单独检索，最后合并去重。

```python
def multi_query_expansion(query, llm_client):
    prompt = f"""将下面的问题改写成 3 个不同角度的问法，每个问法一行。

原问题：{query}

改写后的问题："""
    
    response = llm_client.generate(prompt, max_tokens=200)
    queries = [query] + response.strip().split('\n')  # 保留原问题
    
    # 每个问法单独检索
    all_results = []
    for q in queries:
        results = vector_search(q, top_k=10)
        all_results.extend(results)
    
    # 合并去重
    return deduplicate_by_id(all_results)

# 示例
# 原问题："怎么退货"
# 扩展为：
# 1. "退货流程是什么"
# 2. "如何申请售后退款"
# 3. "商品退换货政策"
```

**关键点：** 原始问题必须保留，因为改写可能丢失细节，原始问题反而最精准。

**适用场景：** 用户提问角度和文档描述角度不对齐

**方法三：HyDE（假设文档嵌入）**

先让 LLM 根据问题生成一段"假设的答案"，然后用假设答案的向量去检索，而不是用原始问题的向量。

```python
def hyde_retrieval(query, llm_client):
    # 1. 生成假设答案
    prompt = f"""请根据问题生成一段假设的答案（100-200字）。

问题：{query}

假设答案："""
    
    hypothetical_answer = llm_client.generate(prompt, max_tokens=200)
    
    # 2. 用假设答案的向量检索
    results = vector_search(hypothetical_answer, top_k=5)
    return results

# 示例
# 问题："重疾险的等待期是多少天"
# 假设答案："重疾险的等待期通常为 90 天或 180 天，具体取决于保险公司和产品类型..."
# 用假设答案的向量检索，和文档风格更接近
```

**原理：** 假设答案和文档都是陈述性文字，风格更接近，向量距离更近。

**注意：** 如果 LLM 生成的假设答案方向错了，反而会把检索带偏。适合知识库领域明确的场景。

**方法四：Step-back Prompting（后退提问）**

把具体问题往上抽象一层，生成一个更通用的背景问题去检索，把背景知识检索回来，再结合背景知识回答具体问题。

```python
def step_back_retrieval(query, llm_client):
    # 1. 生成背景问题
    prompt = f"""将具体问题抽象成一个更通用的背景问题。

具体问题：{query}

背景问题："""
    
    background_query = llm_client.generate(prompt, max_tokens=100)
    
    # 2. 检索背景知识
    background_docs = vector_search(background_query, top_k=3)
    
    # 3. 检索具体问题
    specific_docs = vector_search(query, top_k=3)
    
    # 4. 合并返回
    return background_docs + specific_docs

# 示例
# 具体问题："为什么 transformer attention 要除以 sqrt(d_k)"
# 背景问题："transformer attention 机制的数学原理"
# 先检索背景知识，再回答具体问题
```

**适用场景：** 问题太具体，知识库只有通用背景的情况

### 第三层：召回优化（多路召回）

#### 核心问题：单一检索路径的盲区

单一的向量检索有根本局限：
- **向量检索：** 擅长语义相似，但对精确词语匹配效果差（如"M4 Pro 芯片"）
- **BM25 关键词检索：** 擅长精确匹配，但不理解语义（"怎么退货" vs "售后申请流程"）

#### 解决方案：多路召回 + 融合

**实现：向量检索 + BM25 并行召回，用 RRF 融合**

```python
def multi_path_retrieval(query, top_k=5):
    # 路径 1：向量检索
    vector_results = vector_search(query, top_k=20)
    
    # 路径 2：BM25 关键词检索
    bm25_results = bm25_search(query, top_k=20)
    
    # 路径 3（可选）：元数据过滤
    # metadata_results = search_with_filters(query, filters={"type": "policy"})
    
    # RRF 融合
    fused_results = rrf_fusion([vector_results, bm25_results], smooth_k=60)
    
    return fused_results[:top_k]
```

**元数据过滤：** 如果用户问题包含时间、类型等约束，可以先用元数据过滤缩小候选集。

```python
# 示例：用户问"2023 年的理赔政策"
filters = {
    "year": 2023,
    "doc_type": "policy"
}
results = vector_search(query, filters=filters, top_k=10)
```

**效果：** 多路召回互补盲区，召回率显著提升（详见下文混合检索章节的实验数据）。

### 第四层：重排序优化（Rerank）

#### 核心问题：粗召精度不足

向量相似度 ≠ 语义相关性。向量检索找到的是"在嵌入空间中接近"的文档，但可能实际上不回答问题。

#### 解决方案：Cross-Encoder 精排

**两阶段架构：**
1. **粗召（Recall）：** 向量检索 + BM25 快速召回 20-30 个候选（毫秒级）
2. **精排（Rerank）：** Cross-Encoder 对每个候选打精确相关性分数，取 top-3 到 top-5

**Bi-encoder vs Cross-encoder：**

| 模型类型 | 编码方式 | 精度 | 速度 | 适用阶段 |
|---------|---------|------|------|---------|
| **Bi-encoder** | query 和 chunk 分别编码 | 中等 | 极快（毫秒级） | 粗召 |
| **Cross-encoder** | query + chunk 拼接编码 | 高 | 慢（每对需单独推理） | 精排 |

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
            # 拼接 query 和 chunk
            inputs = self.tokenizer(
                query, chunk["content"],
                return_tensors="pt",
                truncation=True,
                max_length=512
            )
            with torch.no_grad():
                score = self.model(**inputs).logits.item()
            scores.append((chunk, score))
        
        # 按分数降序排列
        ranked = sorted(scores, key=lambda x: x[1], reverse=True)
        return [chunk for chunk, score in ranked[:top_k]]

# 使用示例
reranker = Reranker()
recall_results = multi_path_retrieval(query, top_k=20)  # 粗召 20 个
final_results = reranker.rerank(query, recall_results, top_k=5)  # 精排取 5 个
```

**常用 Rerank 模型：**
- `BAAI/bge-reranker-v2-m3`：中英双语，效果优异
- `BAAI/bge-reranker-large`：精度更高，速度较慢
- `maidalun1020/bce-reranker-base_v1`：中文场景优化
- Cohere Rerank API / Jina Reranker API：云端服务，无需部署

### 四层优化组合策略

实际落地时不需要全部都上，按业务场景和问题症状来选：

| 层次 | 解决的核心问题 | 推荐程度 | 成本 |
|------|---------------|---------|------|
| 索引优化（Parent-Child） | 检索粒度 vs 上下文完整性 | ⭐⭐⭐⭐⭐ | 低 |
| 查询优化（Multi-Query / HyDE） | 用户提问和知识库表达不对齐 | ⭐⭐⭐ | 中（LLM 调用） |
| 多路召回（向量 + BM25） | 单路检索漏召 | ⭐⭐⭐⭐⭐ | 低 |
| Rerank 精排 | 粗召精度不足 | ⭐⭐⭐⭐⭐ | 中（推理成本） |

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

## 二、为什么需要混合检索

单一检索模式各有致命短板：

| 检索方式 | 优势 | 短板 |
|----------|------|------|
| 纯向量检索 | 理解语义、同义词、上下文 | 专有名词、精确编号、关键词匹配弱 |
| 纯 BM25 | 精确关键词匹配，无需训练 | 无法捕捉语义相似性，同义改写全失效 |

以下实验数据来自一篇 RAG 混合检索实证研究（数据集：MS MARCO + DuReader，环境：RTX 3090，每组实验重复 5 次取均值）：

| 检索策略 | Recall@5 | MRR | 端到端准确率 | 响应时间 |
|----------|----------|-----|-------------|----------|
| 纯向量检索 | 0.682 | 0.621 | 0.695 | 862ms |
| 纯 BM25 | 0.615 | 0.587 | 0.652 | 725ms |
| 混合检索（RRF） | 0.827 | 0.783 | 0.827 | 947ms |
| 混合检索 + 重排 | **0.896** | **0.875** | **0.903** | 1086ms |

混合检索 Recall@5 较纯向量提升 **21.3%**，较纯 BM25 提升 **34.5%**。加重排后端到端准确率较基准提升 **29.9%**，响应时间增幅仅 14.7%。

---

## 二、BM25 原理

### 题目：BM25 和向量检索的区别是什么？

#### 核心解析

两者在完全不同的空间上做匹配：

**BM25（稀疏检索）** 在词频维度上匹配——统计查询词在文档中出现的频率和分布。维度是离散的词汇空间，每个词是一个独立维度。

BM25 核心公式：

$$
\text{score}(q, d) = \sum_{i} \text{IDF}(q_i) \times \frac{tf(q_i, d) \times (k_1 + 1)}{tf(q_i, d) + k_1 \times \left(1 - b + b \times \frac{|d|}{\text{avgdl}}\right)}
$$
- `k1`：词频饱和调节参数，经典取值 1.2（控制词频对分数的影响上限）
- `b`：文档长度归一化参数，经典取值 0.75（防止长文档因词频绝对值高而占优）
- `IDF`：逆文档频率，越稀有的词权重越高

**向量检索（稠密检索）** 在语义嵌入维度上匹配——文本编码成高维稠密向量（768/1024/2048 维），计算余弦相似度。语义相近的词在空间中距离近。

**Baize 项目实现：** [[RAG管道设计#关键字检索和语义检索的维度是一样的吗？]]

---

## 三、RRF 融合算法

### 题目：混合检索结果怎么融合？RRF 是什么？

#### 核心解析

两路检索结果的分数量纲不同（向量是余弦相似度 0-1，BM25 是 TF-IDF 加权分），不能直接相加，需要归一化或用排名融合。

**RRF（Reciprocal Rank Fusion，倒数排名融合）** 是最稳健的方案：

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

**为什么 RRF 比加权求和更稳健：** 加权求和需要对两路分数做 min-max 归一化，归一化对异常值敏感；RRF 只看排名不看分数，天然抗噪。

**另一种方案：加权求和融合**
```
final_score = dense_score × 0.6 + sparse_score × 0.4
```
参数敏感性实验：密集权重 0.6、稀疏权重 0.4 是通用场景最优组合；关键词查询占比高的场景可提升稀疏权重至 0.5-0.7。

**Baize 项目实现：** [[RAG管道设计#混合检索：KNN 向量 + BM25 rescore]] — KNN 宽召回（topK×30）+ BM25 rescore，score 公式 `KNN×0.2 + BM25×1.0`，BM25 主导。

---

## 四、重排（Rerank）

### 题目：为什么要加重排？重排模型怎么选？

#### 核心解析

向量相似度 ≠ 语义相关性。向量检索找到的是"在嵌入空间中接近"的文档，但文档可能在空间中"接近"却实际上不回答问题。

**两阶段检索架构：**
1. 第一阶段：向量检索快速召回 20-50 个候选（毫秒级）
2. 第二阶段：Cross-Encoder 重排，对每个候选同时读取 query 和文档，输出精确相关性分数

Cross-Encoder 比 Bi-Encoder（向量检索用的）精度高的原因：Bi-Encoder 把 query 和文档分别编码，Cross-Encoder 把两者拼在一起编码，能捕捉 query 和文档之间的细粒度交互。

**重排模型选型：**
- `bge-reranker-v2-m3`：中文场景表现优异，轻量版本 CPU 快速推理，P95 延迟 50ms 以内
- `cross-encoder/ms-marco-MiniLM-L-6-v2`：英文场景经典选择

**实测效果：**
- 加重排后 Recall@5 从 0.827 提升到 0.896
- 端到端准确率从 0.827 提升到 0.903
- 响应时间从 947ms 增加到 1086ms（增幅 14.7%，完全值得）

**面试追问：重排增加了延迟，值得吗？**

在企业级知识库场景，幻觉带来的业务风险远大于 100ms 的延迟开销。工程上可以做路由：简单 FAQ 查询跳过重排保证速度，复杂专业查询启用重排保证质量。

---

## 相关链接

- [[RAG基础与架构]] — RAG 整体架构、文档解析与分片策略
- [[RAG向量与Embedding]] — 向量数据库选型与 Embedding 模型
- [[RAG高级技术]] — Agentic RAG、GraphRAG、自反思 RAG
- [[LLM基础与训练]] — Transformer 与 Embedding 原理基础
- [[Agent核心概念]] — Agent 架构中的 RAG 定位
