---
module: Agent
tags: [Agent, Plan-and-Execute, Task Decomposition, Reasoning Pattern]
difficulty: medium
last_reviewed: 2026-06-01
---

# Plan-and-Execute 模式

> Plan-and-Execute 是一种 Agent 推理模式，先一次性生成完整任务计划，再按计划逐步执行——与 ReAct 的"边想边做"形成对比。

## 一、核心思想：规划与执行分离

### 基本流程

```
==ReAct==（边想边做）：
  Thought → Action → Observation → Thought → Action → ...
  ↑ 每步独立决策，不知道全局多远

==Plan-and-Execute==（先想后做）：
  Plan: [Step 1, Step 2, Step 3, Step 4, Step 5]    ← 一次性产出
            ↓
  Executor: 按顺序逐个执行
  Step 1 → Step 2 → ... → Step 5
```

### 为什么分两阶段

==两个独立动机==：

==① 全局规划比局部贪心更优==
ReAct 容易陷入局部最优——比如要写一个项目，搜到一个相关库就开始用，忘了还有更好的方案。Planner 一次性看完任务全貌，==能合理分配资源、避免重复劳动==。

==② Plan 是显式的人工可审查产物==
LLM 输出的 Plan 是一个 Python 列表/JSON，==可以打印出来给用户看==——这就是 Claude Code 的 Plan Mode 的基础。==ReAct 没有这种"全局快照"==——每一步分散在循环里。

## 二、与 ReAct 的对比

==核心差别==：

| 维度 | ReAct | Plan-and-Execute |
|------|-------|-----------------|
| LLM 调用次数 | N 步 = N 次 | 1 次 Plan + N 次 Execute（如果 Execute 步骤本身用 LLM） |
| 全局视野 | 弱（只看下一步） | 强（一次性看完所有步骤） |
| 中途调整 | 天然支持（每步都重新决策） | 需要显式 Replan |
| 适合 | 探索性任务 | 步骤明确、有依赖、流水线 |

## 三、适用场景

### 适合 Plan-and-Execute

- ==数据处���流水线==：抽数 → 清洗 → 转换 → 入库
- ==报告生成==：搜索 → 整理 → 分析 → 撰写 → 校对
- ==多步骤部署==：备份 → 停服务 → 升级 → 启动 → 验证
- ==代码重构==：识别重复 → 抽取函数 → 替换调用点 → 跑测试

==共性==：步骤之间==有清晰依赖==，==中途不需要大幅调整方向==。

### 不适合 Plan-and-Execute

==探索性任务==（比如"帮我研究一下这个 bug 的根因"）——这种你不知道下一步该干什么，==必须看了上一步结果才能决定==。这是 ReAct 的主场。

## 四、Plan 的三种设计层次

### 4.1 V1 简单线性

```json
[
  {"step": 1, "action": "read_file", "args": {"path": "a.py"}, "purpose": "..."},
  {"step": 2, "action": "execute_command", "args": {"cmd": "pytest"}, "purpose": "..."}
]
```

==只能严格顺序执行==，不支持并行，不支持依赖判断。

### 4.2 V2 加依赖（DAG 形式）

```json
[
  {"step": 1, "action": "read_file", "args": {"path": "a.py"}, "depends_on": []},
  {"step": 2, "action": "read_file", "args": {"path": "b.py"}, "depends_on": []},
  {"step": 3, "action": "execute_command", "args": {"cmd": "pytest"}, "depends_on": [1, 2]}
]
```

==Step 1 和 Step 2 没有依赖，可以并行==，Step 3 等前两个都完成才执行。

==DAG = Directed Acyclic Graph（有向无环图）==——用网状图表示步骤之间的依赖关系，某些步骤可以并行，某些必须等前面完成。

#### 为什么需要 DAG

具体例子——任务"==写一份 Cursor / Claude Code / Aider 的竞品分析报告=="

==线性 Plan==（原始版本）：
```
Step 1: 搜索 Cursor → Step 2: 搜索 Claude Code → Step 3: 搜索 Aider
                              ↓
                       Step 4: 整理对比表 → Step 5: 写报告
```
Step 1/2/3 ==互相不依赖==，但==被强制串行==。每个搜索 30 秒 → ==线性总共 90 秒==。

==DAG Plan==（升级版）：
```
   [Step 1]      [Step 2]      [Step 3]
  搜索 Cursor  搜索 ClaudeCode  搜索 Aider     ← 三个并行
       ↘          ↓          ↙
            [Step 4 整理对比表]                 ← 等三个都完成
                  ↓
            [Step 5 写报告]
```
==Step 1/2/3 并行==（30 秒）+ Step 4 + Step 5 = ==30+N 秒，快 3 倍==。

#### DAG 的四个工程价值

==① 并行执行==（性能）
识别==无依赖关系的步骤==同时跑。==DAG 越宽，并行度越高==。

==② 循环依赖检测==（正确性）
==Acyclic== 是 DAG 的硬约束。Planner 输出后==执行前用拓扑排序检查无环==：
```
Step 1: depends_on: [3]
Step 3: depends_on: [1]   ⚠️ 循环依赖!
```
==这种 LLM 偶尔会犯==，执行前立刻能查出来，直接 Replan。

==③ 进度可视化==（可观测）
DAG 可以==渲染成图==给用户看进度——一眼看出哪些步骤在并行跑、哪些已完成、哪些卡住。

==④ 失败影响范围==（鲁棒性）
某步失败时，==DAG 知道哪些下游受影响==。Step 3 失败 → Step 4、5 受影响，==但 Step 1、2 已成功的结果保留==，Replan 只重做 Step 3 及下游。==线性 Plan 失败可能要全部重做==。

### 4.3 V3 加输入输出绑定

```json
[
  {"step": 1, "action": "read_file", "args": {"path": "config.yaml"}, "outputs": "config"},
  {"step": 2, "action": "execute_command",
   "args": {"cmd": "deploy --env={{config.env}}"},   ← 引用 Step 1 的输出
   "depends_on": [1]}
]
```

==Step 2 的参数引用 Step 1 的结果==——这是 LangGraph 的 ==State 传递机制==的简化版。Plan 从"指令列表"升级为"==数据流图=="。

## 五、Replan 机制：让计划可调整

==Plan-and-Execute 最大的弱点==：计划生成后就==锁死==了，如果中途某步失败、或发现计划本身有问题，==整个推翻很贵==。==Replan==是补丁。

### 触发 Replan 的三种信号

| 信号 | 来源 | 例子 |
|------|------|------|
| ==执行失败== | Executor 抛异常 | API 挂了、文件不存在 |
| ==中间结果异常== | Step 输出不符合预期 | 搜索返回 0 结果 / 数据库为空 |
| ==质量评估不达标== | Reflection 判定 | 生成代码跑不通测试 |

### Replan 的工程要点

- ==Replan 上限==：通常 2-3 次，超过就上报失败，==避免无限重试==
- ==Replan 不是从零开始==：把已成功的步骤保留在 results 里，只重做失败的部分
- ==Replan 提示要给 LLM 看==失败上下文（错误类型、错误消息、partial 结果）
- ==Replan vs ReAct 区别==：Replan 是"==重新规划=="（整个 Plan 重生成），ReAct 的纠错是"==下一步换条路=="（单步调整）

### Replan 上下文裁剪策略：两层 context 分离

==Replan 最容易爆炸的地方==：某个 Step 拉了 5000 行文章 / 大 SQL 查询结果 / 完整文件——==如果原样塞进 Replan prompt，几次 replan 就炸了 context==。

#### 核心认知：两层 context 分离

```
┌───────────────────────────────────────────┐
│ Replan Prompt (==Planner LLM 看到的==)    │
│ → 只看 metadata / 摘要                    │
│ → "Step 1 拉到了 5000 字文章，主题 X"     │
│ → ==2-5k tokens== (无论中间产物多大)      │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│ Execution State (==Executor LLM 看到的==) │
│ → 完整 artifact 都存着                    │
│ → step_1.output = <5000 字全文>           │
│ → 通过引用 {{step_1.output}} 注入         │
└───────────────────────────────────────────┘
```

==关键==：
- ==Planner 不看原始内容==——只看元信息，足以重新规划下游
- ==Executor 看原始内容==——执行时从 state 加载，通过 `{{step_X.output}}` ��用注入
- ==两个 context 完全独立==——Planner 始终没看过 5000 字原文

详细实现见 [[Plan-and-Execute 实现教程#Replan 上下文裁剪]]。

## 六、与 ReAct 的混合（生产级架构）

==成熟生产 Agent 系统==基本不用纯 Plan-and-Execute——==都是混合==：

```
顶层：Plan-and-Execute（全局规划）
   ├── Step 1
   │   └── 内部：ReAct 循环（自由探索完成这步）
   ├── Step 2
   │   └── 内部：ReAct 循环
   ├── Step 3
   │   └── 内部：ReAct 循环
   └── ...
```

==这就是 Claude Code 的 Plan Mode==：
- 用户敲 `/plan` 进入 Plan Mode
- LLM 生成完整 Plan 写到临时文件
- 弹窗给用户审批（==Human-in-the-Loop==）
- 通过后==每个 Step 内部用默认的 ReAct 模式执行==
- 失败可以触发 Replan

==混合的好处==：
- ==顶层 Plan==给全局视野，避免局部最优
- ==底层 ReAct==给每步的灵活性，允许探索
- ==两层都可以失败重试==，鲁棒性更强

## 七、关键认知：Plan ≠ 更聪明

==很多人觉得"Plan-and-Execute 比 ReAct 高级"==——==错==。两者各有适用场景：

| 场景 | 用什么 |
|------|------|
| 任务边界清晰、步骤明确 | ==Plan-and-Execute== |
| 任务开放、需要边走边看 | ==ReAct== |
| 复杂生产任务、要求质量稳定 | ==混合（顶层 Plan + 底层 ReAct）== |
| 简单单步任务 | ==都不要，直接 LLM 一次回答== |

==Plan-and-Execute 的代价==：
- ==失去灵活性==：计划锁死，中途意外重做整个 Plan 很贵
- ==Planner 是单点==：Plan 生成质量差就全错
- ==成本可能更高==：Replan 一次 = 1 次 Planner LLM + N 次 Executor LLM

==选 Plan-and-Execute 的真正理由==是：==你需要让人审批整体方案==（Plan Mode 给用户看），==或者== ==你需要可追溯的执行记录==（Plan 是显式产物，可以审计）。==不是因为它"更聪明"==。

---

## 相关链接

- [[Plan-and-Execute 实现教程]] — 80 行 Python 完整实现 + Replan 机制
- [[Plan-and-Execute 实现对比]] — LangGraph / AutoGPT / BabyAGI 实现对比
- [[ReAct 与 Harness 实现]] — 配对的另一种推理框架完整实现
- [[Plan 模式家族对比]] — ReWOO / LLMCompiler / ToT / LATS / Hierarchical 对比
- [[Agent 核心概念#2.1 三种推理框架]] — 推理模式概念
- [[Agent 框架#2.2 LangGraph]] — Plan-and-Execute 的工程化版本
