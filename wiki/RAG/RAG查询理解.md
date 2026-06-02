---
module: RAG
tags: [RAG, 查询理解, 意图识别, Function Calling, Agentic RAG, 查询改写, 反问澄清, 实体提取, 查询路由]
difficulty: hard
last_reviewed: 2026-06-01
---

# RAG 查询理解与意图识别

> RAG 在线阶段的第一步：在检索前理解用户到底想要什么。本文覆盖现代查询理解的主线（Function Calling / Agentic RAG / 查询改写 / 反问澄清）、传统意图分类的局限、实体提取、查询路由与容错回退。
>
> 检索优化四层框架、混合检索、重排见 [[RAG检索策略]]；离线管道（文档解析、分块）见 [[RAG基础与架构]]。

> [!info] 速览
> - **§一 为什么需要查询理解**：不做查询理解时"该精确的变模糊、该确定的变概率"。
> - **§二 现代主流模式**：Function Calling（事实标准）→ Agentic RAG → 查询改写 → 反问澄清，让 LLM 自己路由。
> - **§三 传统意图分类**：为什么"4 分类映射表"靠不住，以及少数仍需显式分类的场景。
> - **§四~六 实体提取 / 查询路由 / 容错回退**：把上面的判断落到工程实现。

## 一、为什么需要查询理解

直接走 RAG 的典型问题：所有用户查询无差别地走向量检索流程（query → 向量化 → 检索 → 拼 Prompt → 生成）。这导致：
- 计算型查询（"保额 50 万、免赔额 1 万、花费 8 万能赔多少？"）被送去搜索知识库，LLM 试图从文档中"推理"出数值结果，而非直接调用计算模块
- 数据查询型（"我的理赔申请进度"）去搜通用知识，返回"一般需要 5-15 个工作日"而非用户的具体记录
- 闲聊型查询触发不必要的检索，浪费资源

**核心问题：该精确的变成了模糊的，该确定的变成了概率的。**

正确做法：在检索前加入 **Query 理解层**，但"理解"不等于"分类到 4 个固定标签"。下面先讲现代主流模式，再讨论传统意图分类的局限。

> [!warning] 传统"意图分类 → 路由"架构在 LLM 时代意义减弱
> 关键词表 + BERT 四分类的写法已经过时——意图边界模糊、同义表达爆炸、复合意图被强行二选一、维护成本高。2024 年起生产系统更多用 Function Calling、Agentic RAG、查询改写取代显式分类。本文以这三个现代模式为主线，把传统分类降为"少数性能/合规场景才需要"。

## 二、现代主流模式：让 LLM 自己路由

> [!info] 这些模式都属于 Harness Engineering 体系
> 下面讲的 Function Calling / Agentic RAG / 查询改写 / 反问澄清 / Web Search / 思维链不是 RAG 独立发明的概念——它们是 [[Harness Engineering]] 在 RAG 场景下的具体应用：给 LLM 配工具集（Function Calling）、控制流（Agentic RAG）、自我评估（CoT/Generator-Evaluator）、上下文管理（[[多轮对话#二、上下文窗口管理|历史压缩]]）。
>
> 本文只讲 RAG 场景下的具体工具清单和触发时机，通用 Harness 架构（六大核心组件、三层上下文压缩、Generator-Evaluator）见 [[Harness Engineering#三、六大核心组件]]。

### 2.1 Function Calling / Tool Use

Function Calling 是当前生产 RAG 系统的**事实标准**：不做显式意图分类，把"做向量检索"、"查数据库"、"调计算器"都暴露为工具给 LLM，让 LLM 自己决定调哪个、调几次。

```python
tools = [
    {
        "name": "search_knowledge",
        "description": "在知识库中搜索保险产品规则、条款、流程等知识",
        "parameters": {"query": {"type": "string", "description": "搜索关键词"}}
    },
    {
        "name": "calculate_claim",
        "description": "根据保额、免赔额、实际花费计算赔付金额",
        "parameters": {
            "insured_amount": {"type": "number"},
            "deductible": {"type": "number"},
            "actual_cost": {"type": "number"}
        }
    },
    {
        "name": "query_user_data",
        "description": "查询当前用户的订单、理赔、保单等业务数据",
        "parameters": {"data_type": {"type": "string"}, "time_range": {"type": "string"}}
    },
    {
        "name": "web_search",                      # ← 知识库未命中或时效要求高时
        "description": "在互联网搜索实时信息（如最新政策、市场行情、新闻）。"
                       "仅在知识库无相关内容或问题涉及当前时效时调用。",
        "parameters": {"query": {"type": "string"}}
    },
    {
        "name": "ask_clarification",                # ← 用户问题模糊时反问
        "description": "当用户问题模糊、有多种解读、或缺关键参数时反问用户。"
                       "不要每次都用——能从历史推断的就直接处理。",
        "parameters": {
            "question": {"type": "string", "description": "要问用户的问题"},
            "options": {"type": "array", "description": "2-4 个具体选项让用户选"}
        }
    },
    {
        "name": "self_reflect",                     # ← 思维链反思
        "description": "在生成答案前先反思'当前已有信息能否回答完整？还缺什么？'"
                       "复杂多步问题推荐先调用此工具规划。",
        "parameters": {"thought": {"type": "string"}}
    },
]

# 让 LLM 看用户问题 + 工具描述，自己决定调哪个
response = llm.invoke(query, tools=tools)
```

关键变化：
- 意图识别==隐式发生==——LLM 通过看 tool description 自动判断
- ==复合意图天然支持==：LLM 可一次调多个工具（先 search_knowledge 拿规则，再 calculate_claim 算金额）
- 加新意图==只需加新 tool 描述，无需训练==
- 用户换说法 LLM 自己理解（语义匹配 tool description）

Claude / GPT-4 / Qwen 都原生支持 Function Calling，==这是当前生产 RAG 系统的事实标准==。详见 [[Agent 核心概念#四、MCP 协议]]（MCP 是 Function Calling 的标准化协议）。

> [!tip] 不是所有 RAG 都需要全部工具
> 简单 RAG 只需 `search_knowledge`；多模态 RAG 加 `web_search`；交互式助手加 `ask_clarification`；复杂推理加 `self_reflect`。==按业务实际需要扩工具，不是越多越好==——工具太多会增加 LLM 决策负担和 token 成本，[[Harness Engineering#六、企业级实战经验|Stripe 经验是每个 Agent 只给精心筛选的子集]]。

### 2.2 Agentic RAG（更彻底的方案）

让 Agent 自主规划：要不要检索、检索什么、调什么工具、要不要根据中间结果改变策略。意图识别==彻底融入 Agent 的推理过程==。

```text
用户："保额 50 万的重疾险，花了 10 万能赔多少？"
   ↓
Agent 推理：
  "用户既要知道重疾险的赔付规则（需要检索）
   又要算具体金额（需要计算工具）
   计划：1. 检索重疾险赔付公式 → 2. 提取免赔额等参数 → 3. 调用计算器"
   ↓
执行：tool_call(search) → tool_call(calculate) → 综合回答
```

进阶模式：==RAG-Gym 的"先反思再检索"==——Agent 先生成初步答案，反思找出不确定点，针对不确定点检索补充。详见 [[RAG高级技术#一、Agentic RAG（智能体 RAG）]] 和 [[RAG高级技术#RAG-Gym：过程监督与策略优化]]。

### 2.3 查询改写（Query Rewriting）

==与其分类，不如直接让 LLM 把查询改写成更适合检索的形式==。

```text
原 query: "我那个上个月买的重疾险啥时候能用啊？"
   ↓ LLM 改写
改写后: "重疾险 等待期 多久 生效"  ← 提取核心检索意图
```

效果：
- ==不需要预定义意图分类==
- 处理代词、口语化、不完整表达
- 生成的检索词与文档表述对齐，提升召回

进阶变体：
- **Multi-Query**：LLM 生成多个不同表述的 query，多路检索后合并
- **HyDE**（Hypothetical Document Embeddings）：让 LLM 先生成"假设答案"，用假设答案的向量去检索（解决 query 和文档表述风格不匹配问题）
- **Step-back Prompting**：先抽象出更上位的问题，再回答原问题

> [!note] 改写三变体的工程实现见 [[RAG检索策略#2.2 查询优化]]
> Multi-Query / HyDE / Step-back 的完整代码与适用场景在 [[RAG检索策略]] 的检索优化四层框架"查询层"统一展开，本节只讲它们在查询理解阶段的定位。

### 2.4 反问澄清（Clarification）

==并非所有 query 都清晰==——直接强行检索常常给错答案，反而不如先反问。

| 用户原话 | 模糊点 | 强行检索后果 |
|---------|------|-------------|
| "保险" | 哪种险？ | 全库一锅端，给一堆无关条款 |
| "他什么时候说的" | "他"是谁？ | 检索错对象 |
| "便宜的那个" | 哪个？ | 错位匹配 |
| "我之前问的那个产品" | 哪个？ | 撞运气，对不上原意 |

#### 三种实现方式

**方法 1：让 LLM 判断模糊度并反问**

```python
def maybe_clarify(query, conversation_history):
    prompt = f"""判断用户问题是否模糊。如果模糊，给出 2-4 个具体选项。

历史：{conversation_history}
当前问题：{query}

清晰 → {{"clear": true}}
模糊 → {{"clear": false, "question": "你指的是？", "options": ["A", "B"]}}
"""
    return llm.invoke(prompt).parse_json()
```

**方法 2：Function Calling 加 ask_clarification 工具**（==生产推荐==）

把"反问"作为 Agent 的工具之一（已在 §2.1 工具列表展示），让 LLM 自己决定何时调。==这是 [[Harness Engineering#三、六大核心组件|Harness Engineering 工具集成层]]==的标准用法。

**方法 3：基于检索置信度触发**

```python
results = retrieve(query, top_k=5)

if results[0].score < 0.5:
    # 最高分都低 → query 太模糊
    return ask_clarification("这个问题没找到准确匹配，能更具体一点吗？")

elif results[0].score - results[2].score < 0.05:
    # 前 3 名分数差不多 → 多义性
    titles = [r.title for r in results[:3]]
    return ask_clarification("有几个相关结果，你想看哪个？", titles)
```

#### 四个设计原则

1. ==不要每次都反问==：用户会嫌烦，反问 1-2 次未澄清就==降级==走默认检索
2. ==给 2-4 个具体选项==而不是开放问题——选项让用户决策成本最低
3. ==基于历史推断优先==：能从对话历史推断的就直接用（如"刚才那个" + 历史里只有重疾险 → 直接用，详见 [[多轮对话#3.2 指代消解]]）
4. ==有"我也不知道"按钮==：用户不确定时不应该被卡住，应有降级路径

#### 学术参考

- **CLAM**（Clarification with Adaptive Question Mining）—— 主动澄清模型
- **Self-Ask Prompting**（CMU）—— LLM 先自问"为了回答这个我需要哪些子问题"

## 三、传统意图分类的局限与现代取舍

### 3.1 传统意图分类的根本局限

==这里专门解释为什么"4 分类映射表"靠不住==：

| 局限 | 表现 |
|------|------|
| 意图边界模糊 | "保额 50 万的重疾险等待期是多少？"既是知识问答又涉及实体（保额/险种），强行二选一就丢了一边 |
| 同义表达爆炸 | "等待期 / 等待时间 / 观察期 / 多久生效 / 啥时候能用" 等无穷变体 |
| 分类粒度难定 | 4 类太粗（产品咨询和理赔咨询同归"知识问答"）、20 类太细（标注成本爆炸 + 边界更模糊） |
| 维护成本高 | 业务变化加新意图就要重训分类器；误分类 case 修复要改规则改训练集，每次都要回归测试 |
| 复合意图被丢弃 | 分类器只输出一个标签，"先查规则再算金额"这种链路无法表达 |

==这就是为什么"意图识别 → 路由"在生产中常常形同虚设==——做了但收效甚微，最后还是把所有问题都走默认 RAG 流程。

### 3.2 什么场景仍需要显式分类

不是说显式分类完全没用，==少数场景==它仍是合理选择：

| 场景 | 为什么需要显式分类 |
|------|-----------------|
| 性能敏感 | 每个 query 都跑一次 LLM 太慢/贵，先用规则筛掉明显的闲聊 |
| 多租户硬路由 | 按用户身份/权限路由到不同知识库（静态规则） |
| 合规分流 | 金融/医疗等领域要求"投资建议查询"必须走专门审核链路 |
| 高并发兜底 | LLM 不可用时按规则保底服务 |

### 3.3 三种方案的现代取舍

| 方案 | 适用 |
|------|------|
| ==极简规则==（仅识别绝对明显的高置信度模式：纯闲聊、明显计算公式） | 性能敏感场景的快路径，覆盖率 < 30% 即可 |
| ==LLM-as-Classifier==（用 LLM 做 zero-shot/few-shot 分类） | 维护成本最低，泛化最强，==优于训练 BERT 分类器== |
| BERT 分类器 | 老业务遗留方案，新项目==不推荐== |

> [!tip] 极简规则的代码示例
> ```python
> def lightweight_routing(query):
>     # 只处理两类绝对明确的快路径
>     if is_pure_chitchat(query):       # 长度 < 5 字 + 全是寒暄词
>         return "chitchat"
>     if has_explicit_formula(query):    # 包含明显计算式如 "5000 + 3000"
>         return "calculation"
>     # 90% 查询走默认 RAG（让 LLM/Agent 自己处理）
>     return "default_rag"
> ```

## 四、实体提取

无论用 Function Calling 还是显式分类，==提取查询中的关键约束条件==都有用——可以作为元数据过滤的输入（详见 [[RAG向量与Embedding#元数据过滤与向量检索的结合]]）。

**提取目标：**
- **时间实体：** "上个月""2023 年 Q2""最近一周"
- **数值实体：** "保额 50 万""免赔额 1 万""花费 8 万"
- **业务实体：** "重疾险""理赔申请""订单号 12345"

**实现方式：**

1. **正则表达式**：提取结构化数值和时间（确定性强、零延迟）
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

2. **LLM 抽取**：业务实体（产品名、险种）泛化最强，==生产推荐==
```python
prompt = "从查询中提取产品名、时间范围、数值参数，返回 JSON：{query}"
entities = llm.invoke(prompt).parse_json()
```

3. **NER 模型**：传统方案，已被 LLM 抽取大量替代

## 五、查询路由（Query Routing）

现代实现：==让 LLM/Agent 通过 tool 调用决定路由==，而不是 if-else 链路：

```python
def route_query(query: str, user_context: dict):
    # 极简规则：先筛掉绝对明确的快路径（占查询 < 30%）
    if is_pure_chitchat(query):
        return llm_chat(query)

    # ==其他全部交给 LLM + Function Calling 自主路由==
    return llm.invoke(
        query,
        tools=[search_knowledge_tool, calculate_tool, query_data_tool],
        context=user_context
    )
```

**多索引路由：** 如果知识库按主题分成多个索引（如"理赔制度""产品信息""投保指南"），可在 `search_knowledge_tool` 内部根据 LLM 提取的实体路由到具体索引——==让模型自己输出索引名作为参数==，而不是预先分类。

## 六、容错与回退机制

意图判断不是 100% 准确，需要设计容错策略：

1. **Tool 调用失败回退**：Function Calling 调用工具报错时，自动回退到默认 RAG 检索
2. **Agent 推理超时**：Agentic RAG 多轮检索超时（如 > 5 步），返回当前最佳结果而非死等
3. **空结果兜底**：检索 0 结果或置信度极低时，==让 LLM 直接基于参数化知识回答== + 标注"未找到相关文档"
4. **多路径并行**：模糊 case 同时走两条路径（如同时检索 + 计算），取结果更好的（多 query 并行成本可控）

---

## 相关链接

- [[RAG检索策略]] — 检索优化四层框架、混合检索、重排（本文的下游）
- [[RAG基础与架构]] — RAG 离线 + 在线两阶段总览
- [[RAG向量与Embedding]] — 实体提取产出的过滤条件如何作用于向量检索
- [[Harness Engineering#三、六大核心组件]] — Function Calling / Agentic 模式的通用架构
- [[多轮对话]] — 对话历史、指代消解、历史压缩
- [[RAG高级技术#一、Agentic RAG（智能体 RAG）]] — Agentic RAG 与 Multi-Query / HyDE / Step-back 详解
