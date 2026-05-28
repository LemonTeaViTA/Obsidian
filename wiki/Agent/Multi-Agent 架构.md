---
module: Agent
tags: [Agent, Multi-Agent, 编排, Planner, Worker, Reviewer, 冲突仲裁]
difficulty: hard
last_reviewed: 2026-05-28
---

# Multi-Agent 架构

> ==Multi-Agent 不是"更高级"，是"换一种代价"==——用 5-15 倍成本 + 复杂度换取上下文扩容和角色专业化。==80% 任务用不上，用了反而坏事==。
>
> 与 [[Agent 核心概念]] 单 Agent 推理模式正交——本文讲多 Agent 协作模式 / 三角色组合 / 冲突仲裁 / 何时该用何时不该用。

---

## 一、为什么需要 Multi-Agent

三个根本原因：

1. **上下文窗口限制**：复杂任务信息量可能远超单个 LLM 的上下文窗口
2. **专业能力瓶颈**：一个 Agent 同时精通代码审查、数据分析和文案撰写，效果远不如三个专业 Agent 各司其职
3. **并行效率**：很多子任务之间没有依赖关系，完全可以并行跑

==但 80% 任务用不上 Multi-Agent==——参见 §四 决策树。

---

## 二、四种协作模式

| 模式 | 特点 | 适用场景 |
|------|------|----------|
| ==流水线==（Pipeline） | A 的输出是 B 的输入，一环扣一环 | 有明确先后顺序的任务 |
| ==主从==（Orchestrator-Workers） | 指挥官 Agent 负责任务分解和调度，执行 Agent 负责执行 | ==最主流的多 Agent 架构== |
| ==平行==（Parallel） | 多个 Agent 同时处理不同子任务，最后汇总 | 无依赖关系的并发任务 |
| ==辩论==（Debate） | 多个 Agent 对同一问题给出不同角度回答，裁判 Agent 做决策 | 需要多视角验证的场景 |

### 编排者-执行者模式（最主流）

编排者负责三件事：接收原始任务、拆解成子任务、分发给合适的执行者，最后汇总结果。执行者是一批专业化的 Agent，每个只干自己最擅长的那类任务。

==关键点==在于编排者的任务拆解质量：
- ==粒度太粗== → 执行者拿到的任务依然复杂，失败率高
- ==粒度太细== → 子任务太多，通信开销大，汇总麻烦

好的编排提示词应包含：任务目标、可用执行者列表及能力描述、任务拆解的格式要求（JSON）、汇总输出的格式要求。

==在 LangGraph 里==，编排者是中心节点，各执行者是叶子节点，通过带条件的边控制任务路由。

### 防无限循环和通信冗余

**防无限循环三个手段**：
1. ==最大步数限制==：超过就强制中止并报错
2. ==状态哈希检测==：发现重复状态就判定为循环并中断
3. ==超时熔断==：超过预设时间强制结束，返回当前最优解

**防通信冗余**：设计清晰的消息协议，每条消息带 Agent ID、任务 ID、消息类型（中间状态 vs 最终结果），指挥官只处理「最终结果」类型的消息；用消息去重队列过滤重复消息。

---

## 三、经典三角色组合：Planner + Worker + Reviewer

==生产 Multi-Agent 系统最常用的标准模式==——CrewAI 的 `Crew`、Anthropic 的 Multi-Agent Research、AutoGen 的 GroupChat 都是这套。

### 三角色职责

| 角色 | 职责 | 实现来源 |
|------|------|---------|
| ==Planner== | 接收任务 → 拆解子任务 → 输出执行计划 | [[Plan-and-Execute 实现]] |
| ==Worker== | 接收单个子任务 → 用 ReAct 循环完成 | [[ReAct 与 Harness 实现]] |
| ==Reviewer== | 审查 Worker 输出 → 通过/打回 + 反馈 | [[Reflection 实现]]（Critic Model 变体） |

### 关键认知：三角色 ≠ 新概念

==三角色经典组合 = Plan-and-Execute + Reflection 的产品化封装==——拆开看每个都是已有模式：

```
Plan-and-Execute（顶层规划）
   ├── Planner: 输出 Plan
   └── Worker: 每个 Step 用 ReAct 完成
        ↓
Reflection（叠加质量层）
   └── Reviewer: 看 Worker 输出 → 评估 → 通过/反馈
```

==面试时讲清==："三角色 = Plan-and-Execute + Reflection 的组合"——比死记 CrewAI 的 API 有深度。

### Reviewer 反馈 → Worker 重试的协议

==审查未通过==时不是简单"重做"，要把 Reviewer 的具体反馈传给 Worker：

```python
# 简化版三角色协议
def three_role_loop(task, max_review_rounds=2):
    plan = planner.invoke(task)                    # Planner 拆任务

    for step in plan:
        feedback_history = []
        for round_idx in range(max_review_rounds + 1):
            # Worker 执行(带历史反馈)
            output = worker.invoke(
                step,
                feedback_history=feedback_history  # ← 第一次为空,后续带 Reviewer 反馈
            )

            # Reviewer 审查
            review = reviewer.invoke(step, output)
            if review.passed:
                break

            # 不通过 → 把反馈记录到历史
            feedback_history.append({
                "round": round_idx,
                "previous_output": output,
                "issues": review.issues,           # ← Reviewer 指出的具体问题
                "suggestions": review.suggestions  # ← 改进建议
            })

        if not review.passed:
            return {"status": "review_failed", "step": step, "history": feedback_history}

    return {"status": "success"}
```

==关键设计==：
- ==重试上限固定==（通常 2 次）——超过就上报失败，==别让 Worker 死磕==
- ==反馈结构化==（issues + suggestions）——比"再试一次"信号强
- ==历史保留==——Worker 看到自己之前哪里错了，避免反复犯同一错
- ==失败也要带上下文==上报——审计追踪用

### Reviewer 角色的两种实现选择

| 实现 | 实现方式 | 适合 |
|------|---------|------|
| ==同模型 Self-Reflection== | 同一个 LLM 用不同 prompt 当 Reviewer | 成本敏感、低风险任务（盲点风险大） |
| ==独立 Critic Model== | 用专门的 Critic 模型（不同 LLM 或同模型不同微调） | 高精度场景（合同审核、医疗、金融） |

==生产推荐==：==Worker 用 Sonnet，Reviewer 用 Opus 或 GPT-4==——成本翻倍但盲点显著降低（Worker 自己的错误盲点，Reviewer 用不同模型才能发现）。

详见 [[Reflection 实现#3.2 Critic Model]]。

---

## 四、多 Agent 冲突仲裁

==Multi-Agent 系统避不开冲突==——多个 Agent 对同一问题给出不同结论时怎么办？==四种主流仲裁策略==：

| 策略 | 做法 | 适合 |
|------|------|------|
| ==多数投票== | N 个 Agent 各投一票，多数胜 | 简单事实题（数学/分类）；==N 通常 ≥ 3== |
| ==权威优先== | 按 Agent 角色权重排序，权威 Agent 直接拍板 | 角色明确（==专家 Agent 优先于普通 Agent==） |
| ==Meta-Agent 仲裁== | 一个独立 Agent 看所有冲突结论 → 综合判断 | 复杂场景，==允许多一次 LLM 调用成本== |
| ==辩论收敛==（Debate） | 冲突的 Agent 互相反驳 → 多轮辩论达成共识 / 仲裁 Agent 终判 | 高风险决策（医疗诊断、法律意见） |

### 冲突类型与对应策略

| 冲突类型 | 例子 | 推荐策略 |
|---------|------|---------|
| 事实冲突 | A 说"营收 5 亿"、B 说"营收 5.2 亿" | ==权威优先==（看哪个 Agent 引用的数据源更权威） |
| 推理冲突 | A 推荐方案 X、B 推荐方案 Y | ==Meta-Agent 仲裁== / 辩论 |
| 风格冲突 | A 写代码用函数式、B 用面向对象 | ==权威优先==（按项目风格规范定） |
| 评估冲突 | Reviewer A 说通过、Reviewer B 说不通过 | ==Meta-Agent 仲裁==（保守起见走严格的） |

### 工程要点

- ==默认走多数投票==（实现简单，2-3 票就够）
- ==允许 Meta-Agent 兜底==（投票打平时调 Meta-Agent 仲裁）
- ==记录每次仲裁过程==——审计追踪 + 后续优化 prompt 用
- ==辩论上限设 3 轮==——超过就强制 Meta-Agent 终判，==别让 Agent 互相打死循环==

==与单 Agent 失败处理的区别==：[[Agent 可靠性设计#工具调用失败的四层决策策略]] 讲的是==一个 Agent 内部出错怎么办==（L1 重试 / L4 换策略），==仲裁讲的是多个 Agent 给出不同结论谁赢==——两个互补维度。

---

## 五、Multi-Agent vs 单 Agent：何时该用、何时不该用

==关键认知==：==Multi-Agent 不是"更高级"，是"换一种代价"==。

### 七个真实代价

| 代价 | 说明 |
|------|------|
| ==成本 N 倍== | 每个 Agent 都调 LLM，N 个 Agent ≈ N 倍 token；==Anthropic Multi-Agent Research 实测 15 倍成本== |
| ==延迟增加== | 即使并行，最慢的 Agent 决定总延迟；编排开销额外加 |
| ==协调本身是新失败点== | Orchestrator 拆错任务、Reviewer 误判、消息丢失、仲裁死循环——N+1 个潜在失败点 |
| ==共享上下文困难== | Agent A 知道的 Agent B 不知道，==每次都要显式传递==，传错就出事 |
| ==错误累积== | 假设单 Agent 成功率 95%，N 个串联 = 0.95^N（5 个 = 77%，10 个 = 60%）——==Agent 越多整体成功率越低== |
| ==调试困难== | 单 Agent 是一条线，Multi-Agent 是网状交互，问题定位困难 |
| ==过度工程化== | 简单任务用 Multi-Agent 是杀鸡用牛刀 |

### 真正需要 Multi-Agent 的四个信号

| 信号 | 例子 |
|------|------|
| ==上下文爆炸== | 任务涉及百万 token 文档（如分析整个代码库） |
| ==跨领域专业化== | 一个任务需要"代码审查 + 数据分析 + 文案撰写"三个完全不同的能力 |
| ==并行加速价值大== | 10 个独立子任务，并行能省 10 倍时间 |
| ==隔离需求强== | 一个子任务挂了不能影响其他（如金融审计、合规分析） |

==四个都不满足？用单 Agent==。

### 反例：什么时候 Multi-Agent 反而坏事

| 场景 | 为什么不该用 |
|------|------------|
| 简单代码生成（写个排序函数） | 单 Agent 一次搞定 < 1 秒；Multi-Agent 拆→写→审 = 5-10 秒 + 5 倍成本 |
| 短对话回答 | 单 Agent 调 weather API 即可；Multi-Agent 是浪费 |
| 线性流程（数据清洗→转换→入库） | 单 Agent 串行调三个工具就行，==不需要==独立 Agent |
| 实时性要求高 | 用户等响应，Multi-Agent 协调延迟劝退 |

### 选型决策树

```
任务复杂度？
├── 简单（< 5 步） → 单 Agent ReAct
├── 中等（5-20 步，有依赖） → Plan-and-Execute（单 Agent）
├── 高（> 20 步 / 需要专业分工 / 上下文爆炸） → Multi-Agent
└── 高 + 质量要求极高 → Multi-Agent + Reflection（三角色）
```

==Anthropic 的工程实践==："==优先单 Agent==，只有当单 Agent 真的不够时才上 Multi-Agent。==90% 的任务用单 Agent + Reflection 就够==，Multi-Agent 是给剩下 10% 的复杂任务的。"

==面试时讲清==："==Multi-Agent 是单 Agent 真的扛不住时的解决方案，不是默认选项==，代价是 N 倍成本 + 错误累积 + 调试困难"——比死记 CrewAI 用法有判断力多了。

---

## 相关链接

- [[Agent 核心概念]] — 单 Agent 推理模式（ReAct / Plan-and-Execute / Reflection）
- [[ReAct 与 Harness 实现]] — Worker 的实现基础
- [[Plan-and-Execute 实现]] — Planner 的实现基础
- [[Reflection 实现]] — Reviewer 的实现基础
- [[Agent 可靠性设计]] — 单 Agent 失败处理（与多 Agent 仲裁互补）
- [[模型路由策略]] — Worker / Reviewer 用不同模型的成本经济学
- [[Agent 框架]] — CrewAI / AutoGen / LangGraph 的 Multi-Agent 实现
