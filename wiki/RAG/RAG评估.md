---
module: RAG
tags: [RAG, 评估, RAGAS, A/B测试, 监控, 召回率, 忠实度]
difficulty: hard
last_reviewed: 2026-05-25
---

# RAG 评估

> [!info] 速览
> RAG 系统的"压舱石"——没有评估的 RAG 等于盲飞。本文系统讲清楚四件事：评估什么、用什么指标、怎么构建数据集、怎么做生产监控。
>
> 算法原理（HNSW/Embedding/Rerank）见 [[RAG向量与Embedding]]、[[RAG检索策略]]，本文只讲==质量评估==。

---

## 一、评估的两个维度

==RAG 评估必须分两段==——光看最终答案对不对会错过很多问题：

```
查询 → [检索阶段] → 相关 chunk → [生成阶段] → 答案
        │                          │
        ↓                          ↓
   检索质量评估                 生成质量评估
   （Recall@K / MRR）          （Faithfulness / Relevancy）
```

==检索失败==：根本召回不到正确文档 → 不管 LLM 多强都答不对
==生成失败==：召回了正确文档但 LLM 没用好或胡编了

==必须分别评估，定位问题才知道改哪==。

### 离线评估 vs 在线评估

| 维度 | 离线评估 | 在线评估 |
|------|---------|---------|
| 数据源 | 标注好的测试集 | 真实用户日志 |
| 频率 | 每次发版前 | 持续 7×24 |
| 指标 | 精确指标（Recall@K、Faithfulness） | 业务指标（用户点赞率、追问率、放弃率） |
| 用途 | 模型选型、参数调优、回归测试 | 持续质量监控、drift 检测 |
| 限制 | 数据集偏差，可能与生产分布不一致 | 噪声大，单次评估方差大 |

==生产 RAG 两套都要==：离线保证发版质量，在线监控线上质量。

---

## 二、检索质量指标

### 2.1 核心指标

| 指标 | 公式 | 含义 | 适用 |
|------|------|------|------|
| ==Recall@K== | TP / (TP + FN) | Top-K 中是否包含正确文档 | RAG 最重要——召不回来后面全废 |
| Precision@K | TP / (TP + FP) | Top-K 里有多少是相关的 | 上下文窗口紧张时关注 |
| ==MRR== | 1/rank（正确答案首次出现的位置倒数） | 正确文档排第几 | 关注"第一个对的"位置 |
| ==NDCG@K== | 累积归一化折损增益 | 多相关性等级（高/中/低）排序质量 | 多个相关文档时用 |
| Hit Rate | 至少有一个相关文档命中 | 二元判定，最简单 | 快速 sanity check |

### 2.2 实操：Python 实现

```python
def recall_at_k(retrieved_ids: list, relevant_ids: set, k: int) -> float:
    top_k = set(retrieved_ids[:k])
    return len(top_k & relevant_ids) / len(relevant_ids)

def mrr(retrieved_ids: list, relevant_ids: set) -> float:
    for rank, doc_id in enumerate(retrieved_ids, start=1):
        if doc_id in relevant_ids:
            return 1.0 / rank
    return 0.0

def ndcg_at_k(retrieved_ids: list, relevance: dict, k: int) -> float:
    """relevance: {doc_id: 0/1/2/3} 多级相关性"""
    import math
    dcg = sum(
        relevance.get(doc_id, 0) / math.log2(rank + 1)
        for rank, doc_id in enumerate(retrieved_ids[:k], start=1)
    )
    ideal = sorted(relevance.values(), reverse=True)[:k]
    idcg = sum(rel / math.log2(rank + 1) for rank, rel in enumerate(ideal, start=1))
    return dcg / idcg if idcg > 0 else 0.0
```

==生产 K 值常用 5、10、20==。Recall@5 < 0.7 时就要考虑 [[RAG向量与Embedding#六、Embedding 微调|微调 Embedding]]。

### 2.3 检索失败归因

光知道 Recall@5=0.6 还不够，要==归因==：

| 失败原因 | 表现 | 解决方向 |
|---------|------|---------|
| 文档没切好 | 答案被切到不同 chunk 里 | 调分块策略 [[分块策略]] |
| Embedding 不行 | 同义查询召回率差异大 | 换模型或微调 |
| Query 模糊 | 短 query 召回乱 | [[RAG检索策略#1.3 查询改写（Query Rewriting）|查询改写]] |
| 文档不全 | 测试集里有的查询知识库根本没收录 | 补文档、降低期望 |

---

## 三、生成质量指标（==RAGAS 框架==）

==RAGAS==（Retrieval-Augmented Generation Assessment）是当前最主流的 RAG 评估框架，提供四个核心指标。

### 3.1 四个核心指标

#### Faithfulness（忠实度）

==生成的答案是否能从检索到的 context 里推出来==——直接对应"幻觉"。

```
做法：
1. 把 answer 拆成原子陈述（claims）
2. 对每个 claim，让 LLM 判断"能否从 context 推出"
3. Faithfulness = 可推出的 claims / 总 claims

例：
Answer: "重疾险等待期是 90 天，理赔时无需医院开具诊断证明。"
拆分：
  - claim_1: "重疾险等待期是 90 天"  → context 中有 → ✅
  - claim_2: "理赔时无需医院开具诊断证明" → context 中没有 → ❌
Faithfulness = 1/2 = 0.5
```

==Faithfulness < 0.8==就要警觉，==生产标准应该 > 0.95==。

> [!note] 检测落地见姊妹篇
> 本节定义 Faithfulness **指标**；把它做成"拆 claim → 逐条判定 → 实时拦截"的**工程流水线**（含 NLI 句对核查、Verify-Then-Answer）见 [[幻觉与置信度#2.1 引用对齐（==最常用==）|幻觉与置信度]]。

#### Answer Relevancy（答案相关性）

==答案是否真的回答了问题==（不是答非所问）。

```
做法（反向生成）：
1. 给定 answer，让 LLM 生成 N 个可能的 question
2. 计算原 question 与生成 questions 的平均相似度
3. 相似度高 → answer 与 question 强相关

为什么反向生成：直接判断"answer 是否回答 question"是个生成任务，
反向生成转换为更稳定的相似度计算。
```

#### Context Precision（上下文精度）

==检索到的 context 中，与回答问题相关的比例==。决定上下文窗口的"信噪比"。

```
做法：对每个检索到的 chunk，让 LLM 判断是否对回答问题有用
Context Precision = 有用的 chunk 数 / 总 chunk 数

低精度 → Top-K 拉了太多无关文档，挤占了 LLM 的注意力
解决：上 Reranker、降 K、改 query
```

#### Context Recall（上下文召回）

==正确答案所需的所有信息，是否都在 context 中==。==这是检索阶段 Recall 的细粒度版==。

```
做法：
1. 把 ground truth answer 拆成 claims
2. 对每个 claim 判断"context 中是否有支撑"
3. Context Recall = 有支撑的 claims / 总 claims
```

低 Recall → 检索没召回到全部所需信息 → ==答案天然不可能完整正确==。

### 3.2 RAGAS 实操代码

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from datasets import Dataset

# 准备评估数据
data = {
    "question": ["重疾险等待期多久？", ...],
    "answer": ["90 天", ...],                          # RAG 系统生成的
    "contexts": [["chunk_1 内容", "chunk_2 内容"], ...], # 检索到的 chunk
    "ground_truth": ["重疾险等待期通常是 90 天", ...]    # 标注的标准答案
}
dataset = Dataset.from_dict(data)

results = evaluate(
    dataset,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall]
)

print(results)
# {'faithfulness': 0.94, 'answer_relevancy': 0.89,
#  'context_precision': 0.76, 'context_recall': 0.91}
```

### 3.3 四指标的诊断价值

| 指标组合 | 诊断 |
|---------|------|
| Context Recall 高 + Faithfulness 高 + Answer Relevancy 高 | ✅ 一切正常 |
| Context Recall 低 | ❌ 检索没召回足够信息（改检索） |
| Context Recall 高 + Faithfulness 低 | ❌ 召回了但 LLM 胡编（改生成 prompt 或换 LLM） |
| Faithfulness 高 + Answer Relevancy 低 | ❌ 答案对但答非所问（改 prompt 强调"回答问题"） |
| Context Precision 低 + Faithfulness 高 | ⚠️ 浪费 token（精排 + 降 K） |

==四指标联合诊断==才能定位问题，单看一个会误导。

---

## 四、评估数据集构建

==没有好数据集就没有评估==。三个来源：

### 4.1 真实日志采样

```
生产日志 → 采样 → 人工标注（去 PII） → 评估集
```

- ✅ 分布最真实
- ❌ PII 处理麻烦、采样需要分层（高频 / 长尾 / 失败 case）

### 4.2 LLM 合成数据（==推荐==）

==用 LLM 自动从知识库生成 (query, doc, answer) 三元组==：

```python
SYNTH_PROMPT = """基于以下文档，生成 3 个用户可能问的问题及对应答案。

文档：{chunk}

要求：
- 问题应该让用户在搜索时会输入（不要"根据上文"这种表述）
- 涵盖事实型、推理型、对比型三种
- 答案必须能从文档直接得出

输出 JSON:
[{{"question": "...", "answer": "...", "type": "factual/reasoning/comparison"}}]
"""

def synth_eval_set(chunks, llm):
    eval_data = []
    for chunk in chunks:
        items = llm.invoke(SYNTH_PROMPT.format(chunk=chunk)).parse_json()
        for item in items:
            eval_data.append({
                "question": item["question"],
                "ground_truth_doc_id": chunk.id,
                "ground_truth_answer": item["answer"],
                "type": item["type"]
            })
    return eval_data
```

==优点==：成本低、覆盖广、可批量
==缺点==：分布与真实用户可能差异大，==必须搭配少量真实日志==

### 4.3 难负例挖掘

==训练 / 评估不能只用"明显的对/错"==——要找"看起来对其实不对"的难负例：

```python
def mine_hard_negatives(query, true_doc_id, all_docs, retriever):
    candidates = retriever.search(query, top_k=20)
    hard_negs = []
    for c in candidates:
        if c.id == true_doc_id:
            continue
        if c.score > 0.5:        # 相似度高
            hard_negs.append(c)  # 但其实是错的 → 难负例
    return hard_negs[:5]
```

### 4.4 标注规范

无论真实日志还是合成数据，==标注规范==是评估质量的根基：

| 字段 | 说明 |
|------|------|
| question | 用户原始问题 |
| ground_truth_doc_ids | 标准答案所在的所有文档 ID（可多个） |
| ground_truth_answer | 标准答案文本 |
| relevance_grade | 0=无关 / 1=部分相关 / 2=高度相关 / 3=完全匹配 |
| difficulty | easy / medium / hard（用于分层评估） |
| domain | 业务领域标签 |

==每条数据让 ≥2 个标注员独立标==，用 Cohen's Kappa 检查一致性，==Kappa < 0.6 就要重新培训标注员==。

---

## 五、人工评估

LLM-as-Judge 不能完全替代人工——==高价值场景仍需人工==。

### 5.1 评估员选择

| 评估员类型 | 适用 |
|-----------|------|
| 业务专家（医生/律师/客服） | 领域专业性强的场景 |
| 普通用户 | 通用问答、客户体验 |
| 标注员（培训过） | 大批量评估 |

==混合用==：业务专家定标准，标注员批量执行。

### 5.2 评分量表

```
方案 A：Likert 5 分量表（细粒度）
  1 - 完全错误 / 2 - 大部分错误 / 3 - 部分正确 / 4 - 大部分正确 / 5 - 完全正确

方案 B：二元（更可靠）
  对 / 错（不允许"部分对"——逼标注员做明确判断）

方案 C：维度拆分
  - 事实正确性（0-5）
  - 完整性（0-5）
  - 简洁性（0-5）
  - 引用规范（0-5）
```

==实践推荐 B==——二元判断标注员一致性最高，五分量表很容易"中间分"扎堆。

### 5.3 标注一致性

```python
from sklearn.metrics import cohen_kappa_score

# 两个标注员对同一批数据的标注
labels_a = [1, 0, 1, 1, 0, ...]
labels_b = [1, 1, 1, 1, 0, ...]

kappa = cohen_kappa_score(labels_a, labels_b)
# > 0.8 优秀
# 0.6-0.8 良好
# 0.4-0.6 中等（需要培训）
# < 0.4 差（标注规范有问题）
```

### 5.4 标注工具

- ==Label Studio==（开源、免费）
- Prodigy（Spacy 出品，轻量）
- 自建（特化场景）

---

## 六、A/B 测试

==线下评估 ≠ 线上效果==。最终要靠 A/B 测试定胜负。

### 6.1 流程

```
1. 设计变体：A（baseline）vs B（新策略）
2. 流量分配：A 50%、B 50%（或 A 90%、B 10% 灰度）
3. 跑 N 天积累样本（≥1 周覆盖周末波动）
4. 对比指标 + 显著性检验
5. 决策：B 显著更好 → 全量 / B 不显著 → 保 A / B 显著更差 → 回滚
```

### 6.2 关键指标

| 类型 | 指标 | 含义 |
|------|------|------|
| 业务指标 | 用户点赞率 / 追问率 / 放弃率 / 满意度 | ==最终判定标准== |
| 技术指标 | Recall / Faithfulness / 延迟 | 诊断用 |
| 成本指标 | 每次查询 token 成本 / 检索 RT | 上线前需要看 |

### 6.3 显著性检验

点赞率是二元（0/1 伯努利）指标，==比例对比应优先用两比例 z 检验 / 卡方检验==，而不是为连续数据设计的 t 检验：

```python
from statsmodels.stats.proportion import proportions_ztest

# A、B 两组的点赞数与样本量
likes  = [a_likes, b_likes]        # 各组点赞次数
totals = [a_total, b_total]        # 各组样本量

z_stat, p_value = proportions_ztest(count=likes, nobs=totals)
# p_value < 0.05 → 显著差异
# p_value >= 0.05 → 没看出差异
```

> [!note] 为什么不用 t 检验
> `ttest_ind` 假设数据近似正态、比较的是均值；点赞是 0/1 比例，样本量很大时 t 检验作为近似勉强可用，但二元比例对比的标准做法是两比例 z 检验或卡方检验。延迟、满意度评分这类连续指标才用 t 检验。

### 6.4 灰度发布

```
1% → 5% → 20% → 50% → 100%

每升一档观察 24-48 小时：
  - 关键指标无回退？
  - 错误率正常？
  - P99 延迟没飙升？
有问题立即回滚，不要硬扛
```

---

## 七、生产监控

### 7.1 实时监控指标

| 指标 | 阈值参考 | 含义 |
|------|---------|------|
| 检索 RT P99 | < 200ms | 向量数据库性能 |
| 端到端 RT P99 | < 3s | 用户体验底线 |
| QPS | 业务峰值 | 容量规划 |
| ==0 命中率== | < 5% | 检索失败比例（query 没召回任何文档） |
| LLM 错误率 | < 0.1% | API 失败、超时、限流 |

### 7.2 离线周期监控

```
每天/每周自动跑：
  ├─ 取过去 24h 的用户 query 采样 100 条
  ├─ 跑离线评估指标（Recall@5、Faithfulness）
  ├─ 与上周对比，看是否 drift
  └─ 阈值告警：Faithfulness 周环比下降 > 5%
```

### 7.3 用户反馈循环

```
答案末尾加 👍 / 👎 按钮
├─ 👎 → 弹窗收集原因（事实错 / 答非所问 / 看不懂）
├─ 自动回流到评估集
└─ 周期性人工审查（每周抽 50 条 👎 复核）
```

==feedback loop 是 RAG 持续改进的命脉==——没有 feedback 永远不知道用户实际感受。

### 7.4 Drift 检测

==数据分布会变==，模型/索引不变效果也会衰减：

| Drift 类型 | 检测方法 |
|-----------|---------|
| 用户 query drift | 监测 query 嵌入聚类的分布变化（KS 检验） |
| 文档 drift | 监测知识库新增 / 修改频率 |
| 模型 drift | 周期跑评估集，比较与上次结果 |

发现 drift → ==重新评估、可能需要重训 Embedding==。

---

## 八、评估的常见错误

| 错误 | 表现 | 后果 |
|------|------|------|
| ==测试集污染== | 测试集出现在 Embedding 训练数据里 | 离线 Recall 虚高，线上崩溃 |
| 单一指标 | 只看 Recall@5 | 漏掉 Faithfulness 问题 |
| 离线/线上不一致 | 离线评估全绿，线上用户骂街 | 数据集分布偏差（合成数据 vs 真实查询） |
| 人工评估偏见 | 标注员看到来源就给高分 | 双盲标注 / 答案匿名化 |
| ==没有降级路径== | 评估失败但仍然全量上线 | 应有自动回滚机制 |
| 忽视长尾 | 只评估高频 query | 长尾 query 占总流量 30%+ 但效果可能很差 |

---

## 相关链接

- [[RAG向量与Embedding#八、召回率评估体系]] — 检索阶段评估的算法细节
- [[RAG基础与架构]] — 整体架构（评估在哪个环节）
- [[幻觉与置信度]] — Faithfulness 失败时的应对（==姊妹篇==）
- [[RAG检索策略]] — 评估反馈用于调优检索
- [[多轮对话]] — 多轮场景的评估特殊性（指代消解准确率）
