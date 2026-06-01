---
module: Agent
tags: [Agent, Plan-and-Execute, ReWOO, LLMCompiler, ToT, LATS, Hierarchical, 规划模式]
difficulty: hard
last_reviewed: 2026-06-01
---

# Plan 模式家族对比

> 从 [[Plan-and-Execute 实现]] 拆出的 ==Reference 文档==——把"==让 LLM 怎么规划复杂任务=="的几种主流变体放在一起对比。
>
> Plan-and-Execute 是最经典的一种（实现见 [[Plan-and-Execute 实现]]），本文讲它之外的 5 种：ReWOO / LLMCompiler / ToT / LATS / Hierarchical，以及==选型矩阵==。理解这些能让你对"==Plan 是什么=="有更全面的认知。

---

## 一、ReWOO(Reasoning WithOut Observation)

==2023 年由 USC + Microsoft 提出==。和 Plan-and-Execute 类似但==更彻底前向==。

==核心区别==:
- ==Plan-and-Execute==:Plan 一次性生成,但==执行每步还会让 LLM 看上下文==(每步可能再调 LLM 决策细节)
- ==ReWOO==:Plan 里==直接用占位符==`#E1` `#E2` 引用前步结果,==Executor 阶段不调 LLM 做决策==,只跑工具

```text
Plan(LLM 一次调用):
  Step 1: search("Python tutorial") → #E1
  Step 2: search(==#E1== 中提到的最受欢迎库) → #E2
  Step 3: summarize(==#E1==, ==#E2==) → answer

Executor(==不调 LLM 做决策==,只跑工具):
  执行 Step 1 → 把结果替换 #E1
  执行 Step 2 → 把结果替换 #E2(==Step 2 的参数 "#E1 中..." 文本替换==)
  执行 Step 3 → 输出
```

> [!note] 澄清:ReWOO 不是"零 LLM 调用"
> ReWOO 的核心是 ==Executor 阶段不再让 LLM 做决策==(不重复决策下一步)——工具调用照常,某些 Plan 的 `summarize` 步骤本身仍可能是一次 LLM 调用(只是它是 Plan 里写死的工具,不是现场决策)。

==优点==:==省 5x LLM 调用==(论文实测),适合 Plan 步骤简单清晰的场景。
==缺点==:对 Plan 质量要求==极高==——一次错全错,完全没有中途调整能力。

==生产中很少独立用 ReWOO==,但思想被吸收到 LLMCompiler 里。

## 二、LLMCompiler

==2023 年 UC Berkeley 提出==,可以理解为==ReWOO 的工程化升级版==。

==核心思想==:==把 Plan 编译成可并行执行图==,类似编程语言编译器把代码编译成 IR。

```text
LLM Planner 输出:
  $1 = search("Cursor 价格")
  $2 = search("Claude Code 价格")
  $3 = search("Aider 价格")
  $4 = compare($1, $2, $3)        ← Compiler 自动识别依赖
  $5 = summarize($4)

Compiler 自动构建 DAG:
   $1   $2   $3
    ↘   ↓   ↙
        $4
        ↓
        $5

Executor:
  $1‖$2‖$3 ==自动并行==          ← 不需要 LLM 显式声明 depends_on
  → $4 → $5
```

==vs Plan-and-Execute 加 DAG 的区别==:Plan-and-Execute 需要 ==LLM 自己声明 depends_on==(可能错);LLMCompiler ==自动从变量引用推断依赖==(==更可靠==)。

==优点==:极致性能,自动并行,延迟可降低 35%,成本降低 25%。
==缺点==:Plan 表达受限于 DSL(用变量引用而不是 JSON);中途 Replan 难。

==类比==:Plan-and-Execute 是手写 Makefile,LLMCompiler 是 Bazel 自动推依赖。

## 三、Tree of Thoughts(ToT)

==2023 年 Princeton + Google 提出==。==不是单条 Plan,是 N 条 Plan 的搜索树==。

==核心思想==:每步生成==多个候选思路==,搜索==树状探索==,最后选最好的:

```text
                   [根:用户任务]
            /        |        \
       思路 A     思路 B     思路 C       ← LLM 一次生成 3 个候选
        /   \      / \       / \
      A1    A2    B1  B2    C1  C2       ← 每个候选再展开
       ✓     ✗     ✓   ✓     ✗   ✓
       ↓
==选 A1 路径==(评估打分最高)
```

==与 Plan-and-Execute 的区别==:
- Plan-and-Execute 是==单条线==——一次 Plan,顺序执行
- ToT 是==多分支==——同一步多个候选,==搜索 + 评估 + 剪枝==

==适用==:高难度推理(数学题、24 点游戏、逻辑谜题)——需要==探索多种解法==的场景。

==缺点==:==成本极高==——每步 N 倍 LLM 调用,深度 D 的树 = O(N^D) 调用。==生产中几乎不用纯 ToT==,但思想用在 Reflection 和 LATS 里。

## 四、LATS(Language Agent Tree Search)

==2024 年 UIUC 提出==,把 ==MCTS(蒙特卡洛树搜索)+ ReAct== 混合。

==核心思想==:每步用 MCTS 决定最优动作:
- 从当前状态出发,模拟 K 个可能动作
- 每个动作执行后用 LLM 评估"==离目标多近=="
- 反向传播打分,选最高分动作执行

==与 ToT 的区别==:ToT 是 BFS/DFS 搜索,LATS 是==MCTS==(类似 AlphaGo)——==更聪明的搜索算法==。

==适用==:编码 Agent、复杂 Web 操作、多步推理任务。

==代价==:==极慢且贵==——单步要跑 K 次 LLM 评估。==生产中用 LATS 的主要是研究项目==,实际产品很少。

## 五、Hierarchical / 递归 Plan

==经典 AI 规划==(HTN, Hierarchical Task Network)的 LLM 时代版本。

==核心思想==:==大任务拆子任务,子任务再拆子子任务==,树状层级:

```text
[写一本技术书]
   ├── [Ch 1: 基础概念]
   │     ├── 1.1 写大纲
   │     ├── 1.2 写正文
   │     │     ├── 1.2.1 写每一节
   │     │     └── ...
   │     └── 1.3 校对
   ├── [Ch 2: 进阶技术]
   │     └── ...
   └── [Ch 3: 实战]
```

==每一层都是一个 Plan==——顶层 Plan 是几个章节,二层 Plan 是每章节的小节,三层 Plan 是每小节的段落。

==适用==:超长任务、明显层级结构的任务(写书、重构整个项目、写一个完整系统)。

==代价==:层级过深难追踪;==每层都可能 Replan,失败传播复杂==。

==生产中的体现==:Anthropic 的 Multi-Agent Research(2024)就是 Hierarchical 模式——==Lead Agent 拆任务,Sub-Agent 各自执行子任务==。Multi-Agent 协作详见 [[Multi-Agent 架构]]。

## 六、Plan 模式选型矩阵

==现实生产中的选择==:

| 场景 | 推荐 |
|------|------|
| 简单流水线、步骤明确 | ==Plan-and-Execute(线性)== |
| 步骤之间有并行机会 | ==Plan-and-Execute + DAG== |
| 极致性能优化、Plan 简单 | ==LLMCompiler== |
| Plan 简单到不需要中途调整 | ==ReWOO== |
| 高难度数学/逻辑推理 | ==ToT==(贵) |
| 复杂 Web 操作、需要回溯 | ==LATS==(慢且贵) |
| 超长任务、明显层级结构 | ==Hierarchical== |
| 任务开放、需要边走边看 | ==ReAct==(==不要规划==) |
| ==90% 的实际场景== | ==Plan-and-Execute + ReAct 混合==(见 [[Plan-and-Execute 实现#五、与 ReAct 的混合(生产级架构)]]) |

## 七、关键认知

- ==绝大多数生产场景==,Plan-and-Execute(线性或 DAG) + ReAct 混合就够
- ==ToT / LATS 是研究产物==,生产价值有限(贵 + 慢)
- ==Hierarchical 在长任务场景==(写书、深度研究)有真实价值
- ==LLMCompiler / ReWOO 在性能敏感场景==(高吞吐 Agent 服务)有价值

==面试时讲清"==90% 用 Plan-and-Execute,5% 用 Hierarchical,4% 用 LLMCompiler,1% 用 ToT/LATS=="==,比死记所有模式更有判断力。

---

## 相关链接

- [[Plan-and-Execute 实现]] — 最经典的规划模式,完整实现 + Replan + 与 ReAct 的混合
- [[ReAct 与 Harness 实现]] — Plan 之外的另一种推理框架(边想边做)
- [[Multi-Agent 架构]] — Hierarchical 模式在多 Agent 协作中的落地
- [[Reflection 实现]] — ToT 的思想用在 Reflection 的评估剪枝里
