---
module: LLM
tags: [LLM, Agent, Reflection, Critic Model, Self-Reflection, 质量保障]
difficulty: medium
last_reviewed: 2026-05-27
---

# Reflection 实现

> 与 [[ReAct 与 Harness 实现]] 和 [[Plan-and-Execute 实现]] 配对的第三种推理框架实现文档。
>
> ==Reflection 不是独立的执行框架==——它是==质量保障层==，可以叠加在 ReAct 或 Plan-and-Execute 之上。推理模式概念见 [[Agent 核心概念#2.1 三种推理框架]]。

---

## 一、核心思想：生成 → 评估 → 改进

```
Generate（生成）
    ↓
Evaluate（评估）—— 通过？
    ├── 是 → 输出
    └── 否 → Refine（改进）→ 回到 Evaluate
                              （最多 N 轮）
```

==与 ReAct 的本质区别==：

| 维度 | ReAct | Reflection |
|------|-------|-----------|
| 目标 | 完成任务（调工具、获取信息） | 提升输出质量（评估、改进） |
| 循环驱动 | 工具返回的 Observation | 评估结果（通过/不通过 + 反馈） |
| 适合 | 探索性任务、信息检索 | 代码生成、长文写作、高精度场景 |
| 独立性 | 可独立运行 | ==通常叠加在 ReAct 或 Plan-and-Execute 之上== |

---

## 二、完整 Python 实现（~50 行）

```python
# ============ 第 1 部分：生成 prompt ============

GENERATE_PROMPT = """你是一个代码生成助手。
根据用户需求生成 Python 代码。只输出代码，不要解释。

需求：{task}
"""

EVALUATE_PROMPT = """你是一个代码审查专家。
评估以下代码是否满足需求，输出 JSON：
{{"passed": true/false, "issues": ["问题1", "问题2"], "suggestions": ["建议1"]}}

需求：{task}
代码：
{code}
"""

REFINE_PROMPT = """你是一个代码修复专家。
根据审查反馈修复代码。只输出修复后的代码，不要解释。

原始需求：{task}
当前代码：
{code}
审查问题：{issues}
改进建议：{suggestions}
"""

# ============ 第 2 部分：Reflection 循环 ============

def reflection_loop(task: str, max_rounds: int = 3) -> dict:
    # 第一步：生成初始结果
    output = llm.invoke(GENERATE_PROMPT.format(task=task))

    for round_idx in range(max_rounds):
        # 第二步：评估
        review_text = llm.invoke(EVALUATE_PROMPT.format(task=task, code=output))
        review = json.loads(review_text)

        if review["passed"]:
            return {"output": output, "rounds": round_idx + 1, "status": "passed"}

        # 第三步：改进（带上评估反馈）
        output = llm.invoke(REFINE_PROMPT.format(
            task=task,
            code=output,
            issues=review["issues"],
            suggestions=review["suggestions"]
        ))

    # 超过最大轮数仍未通过
    return {"output": output, "rounds": max_rounds, "status": "max_rounds_reached"}
```

==整个 Reflection 框架就这 50 行==。生产级框架（LangGraph）只是在这个基础上加了：状态持久化、可视化、并行评估——==核心循环不变==。

---

## 三、两种变体：Self-Reflection vs Critic Model

### 3.1 Self-Reflection（自我反思）

==同一个 LLM 既当生成者又当评审者==——只是 prompt 不同：

```python
# 生成时：角色是"代码生成助手"
output = llm.invoke(GENERATE_PROMPT.format(task=task))

# 评估时：同一个 LLM，角色换成"代码审查专家"
review = llm.invoke(EVALUATE_PROMPT.format(task=task, code=output))
```

==优点==：成本低、延迟小、实现简单。

==缺点==：==存在盲点==——模型容易对自己的错误"视而不见"，因为生成和评估用的是同一套知识和偏见。

==典型盲点==：
- 生成了有逻辑错误的代码 → 评估时也认为逻辑正确
- 生成了有安全漏洞的代码 → 评估时也没发现

### 3.2 Critic Model（对等评审）

==用一个独立的 Critic 模型评估==——可以是不同的 LLM，或同一模型的不同微调版本：

```python
# 生成：用 Worker 模型（如 Claude Sonnet）
output = worker_llm.invoke(GENERATE_PROMPT.format(task=task))

# 评估：用 Critic 模型（如 Claude Opus 或 GPT-4）
review = critic_llm.invoke(EVALUATE_PROMPT.format(task=task, code=output))
```

==优点==：质量更高，能发现 Self-Reflection 发现不了的问题。

==缺点==：成本翻倍（两个 LLM 调用），延迟增加。

==生产推荐==：
- ==日常代码生成、文案撰写== → Self-Reflection（成本敏感）
- ==合同审核、医疗建议、金融报告== → Critic Model（质量优先）

### 3.3 外部验证器（最可靠）

==不用 LLM 评估，用确定性工具验证==：

```python
def evaluate_with_tools(task: str, code: str) -> dict:
    issues = []

    # 运行测试用例（确定性）
    test_result = run_tests(code)
    if not test_result.passed:
        issues.extend(test_result.failures)

    # 运行 lint（确定性）
    lint_result = run_lint(code)
    if lint_result.errors:
        issues.extend(lint_result.errors)

    return {"passed": len(issues) == 0, "issues": issues}
```

==优点==：==最可靠==——测试通过就是通过，没有 LLM 的概率性误判。

==缺点==：需要预先写好测试用例；只能验证"对不对"，不能评估"好不好"（代码风格、可读性）。

==最佳实践==：==外部验证器 + Self-Reflection 组合==——先跑测试（确定性），再让 LLM 评估代码质量（主观性）。

> [!info] Coding Agent 中外部验证器的具体落地形式
> ==Post-Edit 诊断回注模式==——`write_file` 后异步触发 LSP 诊断,缓存到 pending 队列,下一轮 LLM 请求前注入。详见 [[LSP 与代码诊断#五、coding-agent-的诊断回注模式]]。

---

## 四、Reflection 在 Multi-Agent 中的角色

==Reviewer Agent = Critic Model 的 Multi-Agent 版本==。

在 [[Agent 工程实践#经典三角色组合：Planner + Worker + Reviewer]] 中：

```
Planner → Worker → Reviewer
                      ↑
              这就是 Reflection 的 Evaluate 步骤
              只不过 Reviewer 是独立的 Agent，不是同一个 LLM
```

==Reviewer Agent 的实现==：

```python
async def reviewer_agent(task: str, worker_output: str) -> dict:
    # Reviewer 就是一个专门做评估的 Agent
    review_text = await critic_llm.invoke(
        EVALUATE_PROMPT.format(task=task, code=worker_output)
    )
    return json.loads(review_text)
```

==关键认知==：
- ==单 Agent Reflection== = 同一个 LLM 自己评估自己（Self-Reflection）
- ==Multi-Agent Reflection== = 独立的 Reviewer Agent 评估 Worker 的输出（Critic Model）
- ==两者是同一个模式的不同规模==，不是两个不同的概念

---

## 五、与 ReAct / Plan-and-Execute 的叠加

==Reflection 是质量保障层，不是独立框架==——叠加方式：

### 5.1 叠加在 ReAct 上

```python
def react_with_reflection(task: str) -> str:
    # 外层：ReAct 完成任务
    output = react_loop(task)

    # 内层：Reflection 提升质量
    return reflection_loop(task, initial_output=output)
```

==适合==：ReAct 完成了任务但输出质量不稳定的场景（如代码生成、报告撰写）。

### 5.2 叠加在 Plan-and-Execute 上

```python
def plan_execute_with_reflection(task: str) -> str:
    plan = make_plan(task)

    for step in plan:
        # 每个 Step 执行后加 Reflection
        output = execute_step(step)
        output = reflection_loop(step.purpose, initial_output=output)
        # 通过才进入下一步
```

==适合==：Plan-and-Execute 的每个子任务都需要高质量输出的场景（如多步骤报告生成）。

### 5.3 Claude Code 的 Plan Mode 就是这个组合

```
Plan-and-Execute（顶层规划）
   + Reflection（每个 Step 的质量保障）
   + Human-in-the-Loop（Plan 审批 + 危险操作确认）
```

==这就是 Claude Code Plan Mode 的完整架构==——三种模式的组合，不是单一模式。

---

## 六、关键认知：Reflection 的代价

==Reflection 不是"越多越好"==——每轮 Reflection 都有成本：

| 代价 | 说明 |
|------|------|
| ==Token 成本== | 每轮 Evaluate + Refine = 2 次 LLM 调用，N 轮 = 2N 次 |
| ==延迟== | 串行执行，每轮增加 1-2 秒 |
| ==收益递减== | 第 1 轮改进最大，第 2 轮次之，第 3 轮往往微乎其微 |

==生产建议==：
- ==最大轮数设 2-3 次==——超过收益递减明显
- ==有外部验证器时优先用==（测试/lint），比 LLM 自评更可靠
- ==高风险场景才上 Critic Model==——日常任务 Self-Reflection 够用

==面试时讲清==："==Reflection 是质量保障层，不是独立推理框架==，叠加在 ReAct 或 Plan-and-Execute 之上，代价是 2N 次额外 LLM 调用"——比只会说"Reflection 是生成-评估-改进循环"有深度。

---

## 相关链接

- [[ReAct 与 Harness 实现]] — 配对的第一种推理框架（60 行 Python）
- [[Plan-and-Execute 实现]] — 配对的第二种推理框架（80 行 Python）
- [[Agent 核心概念#2.1 三种推理框架]] — 三种框架的概念对比
- [[Agent 工程实践#经典三角色组合：Planner + Worker + Reviewer]] — Reflection 在 Multi-Agent 中的应用
- [[Function Calling]] — Reflection 循环中工具调用的协议
