---
module: Agent
tags: [Agent, Plan-and-Execute, LangGraph, AutoGPT, BabyAGI, Framework Comparison]
difficulty: medium
last_reviewed: 2026-06-01
---

# Plan-and-Execute 实现对比

> 生产级 Plan-and-Execute 框架对比——LangGraph / AutoGPT / BabyAGI 的设计权衡与选型决策。

## 一、三种主流实现

### 1.1 手写实现（80 行 Python）

见 [[Plan-and-Execute 实现教程#完整 80 行 Python 实现]]。

==特点==：
- 零依赖，完全可控
- 适合快速原型、学习理解
- 需要自己实现并行、Replan、状态持久化

### 1.2 LangGraph

LangGraph 用 StateGraph 实现 Plan-and-Execute：

```python
from langgraph.graph import StateGraph, END

graph = StateGraph(AgentState)
graph.add_node("planner", planner_node)
graph.add_node("executor", executor_node)
graph.add_node("replanner", replanner_node)

graph.set_entry_point("planner")
graph.add_edge("planner", "executor")
graph.add_conditional_edges(
    "executor",
    should_continue,
    {"replan": "replanner", "continue": "executor", "done": END}
)
graph.add_edge("replanner", "executor")

app = graph.compile()
```

==特点==：
- ==Plan 不再是一个 list==，而是==状态图的节点和边==
- ==Replan 是图里的一个节点==，不是 if-else 嵌套
- ==状态可视化、可序列化、可持久化==
- 支持复杂控制流（条件分支、循环、并行）

### 1.3 AutoGPT / BabyAGI

早期开源 Agent 项目，内置 Plan-and-Execute 模式：

==AutoGPT==：
- Task → Goal → Sub-goals → Actions
- 强调自主性，最小化人工干预
- 内置文件读写、浏览器、代码执行

==BabyAGI==：
- Task list + Priority queue
- 持续从队列取任务执行、生成新任务
- 更像"任务管理器"而非纯 Plan-and-Execute

## 二、对比矩阵

| 维度 | 手写实现 | LangGraph | AutoGPT | BabyAGI |
|------|---------|-----------|---------|---------|
| ==学习曲线== | 低（80 行代码） | 中（需要理解 StateGraph） | 中（框架约定多） | 低（概念简单） |
| ==控制流复杂度== | 简单（线性/DAG） | 高（状态机/条件分支/循环） | 中（固定流程） | 中（队列驱动） |
| ==并行执行== | 需要自己写 | 内置支持 | 不支持 | 不支持 |
| ==Replan== | 需要自己写 | 内置节点 | 有（但不灵活） | 动态任务生成 |
| ==状态持久化== | 需要自己写 | 内置（checkpointer） | 文件系统 | 内存/Redis |
| ==可视化== | 无 | LangSmith / 图渲染 | 日志 | 日志 |
| ==生产级特性== | 无 | 完整（重试/超时/监控） | 中（缺监控） | 低（原型为主） |
| ==适用场景== | 学习、原型 | 生产级 Agent | 自主 Agent 研究 | 任务队列场景 |

## 三、选型决策树

```
你的需求是什么？

├─ 学习理解 Plan-and-Execute 原理
│  └─ 手写实现（80 行）
│
├─ 快速原型验证想法
│  └─ 手写实现 / BabyAGI
│
├─ 生产级 Agent 系统
│  ├─ 需要复杂控制流（条件分支/循环/Replan）
│  │  └─ LangGraph
│  │
│  └─ 简单线性任务（≤10 步，稳定）
│     └─ 手写实现（加状态持久化）
│
└─ 研究自主 Agent
   └─ AutoGPT（fork 后定制）
```

## 四、LangGraph vs 手写：何时升级

==选择标准==：
- ==Plan ≤ 10 步，线性，稳定== → 手写 list 就够
- ==Plan 复杂、有分支、需要 Replan== → 升级到 LangGraph

==升级信号==（出现以下任一条）：
1. ==条件分支多==："如果 A 失败就走 B 分支，否则走 C"
2. ==循环依赖==：某些步骤需要重复执行直到满足条件
3. ==状态复杂==：步骤之间需要传递多个变量、有复杂数据流
4. ==可观测需求==：需要看到执行图、每步状态、回溯历史
5. ==生产环境==：需要持久化、重试、超时、监控

==不升级信号==（手写足够）：
- 任务是固定流水线（数据抽取 → 清洗 → 入库）
- 步骤少（≤10）且依赖关系简单
- 原型阶段，还在快速迭代想法
- 团队不想引入额外依赖

## 五、DAG vs StateGraph

==StateGraph 是 DAG 的超集==——LangGraph 用 StateGraph，允许 ==DAG 不允许的==：

| 维度 | DAG | StateGraph |
|------|-----|-----------|
| 有向 | ✓ | ✓ |
| 无环 | ✓（==必须==） | ✗（==允许循环==） |
| 条件分支 | ✗ | ✓（条件边） |
| 状态传递 | 弱 | ✓（显式 State） |

==StateGraph 允许循环==——Replan 节点可以回到 Planner（执行失败 → 回去重新规划），==这在严格 DAG 里不允许==。所以：
- ==简单 Plan==：DAG 够用（无 Replan / 单向流）
- ==复杂 Plan==：升级到 StateGraph（支持 Replan / 条件分支 / 多次循环）

## 六、AutoGPT / BabyAGI 为何没流行

==历史定位==：2023 年初 LLM Agent 热潮的早期尝试，验证了"LLM 可以自主规划执行任务"。

==为何没成为主流==：

==① 自主性过强，可控性差==
AutoGPT 强调"最小化人工干预"，但生产环境需要 Human-in-the-Loop。==纯自主 Agent 容易跑偏、浪费 token==。

==② 框架约定太多，不够灵活==
内置了文件系统、浏览器、固定工具集。==改工具、换流程都要改框架代码==。不如 LangGraph 的"节点自定义"灵活。

==③ 工程化不足==
缺少监控、可视化、状态持久化、重试机制。==停留在原型阶段==。

==④ LangGraph 后来居上==
LangChain 生态完善、文档好、社区大，LangGraph 成为 Plan-and-Execute 的事实标准。

==当前价值==：
- ==学习参考==：代码简单，适合理解 Plan-and-Execute 思路
- ==Fork 定制==：研究自主 Agent、做学术实验可以 fork 改

==生产不推荐==——选 LangGraph 或手写。

---

## 相关链接

- [[Plan-and-Execute 模式]] — 核心概念与适用场景
- [[Plan-and-Execute 实现教程]] — 80 行 Python 完整实现
- [[Agent 框架#2.2 LangGraph]] — LangGraph 详细介绍
- [[ReAct 与 Harness 实现]] — 另一种推理框架的实现对比
