---
module: LLM
tags: [LLM, Agent, Plan-and-Execute, Task Decomposition, Replan, LangGraph]
difficulty: hard
last_reviewed: 2026-05-25
---

# Plan-and-Execute 实现

> 与 [[ReAct 与 Harness 实现]] 配对的"另一种推理框架"实现文档——==80 行 Python 看清 Plan-and-Execute 的完整流程==。
>
> 推理模式概念见 [[Agent 核心概念#2.1 三种推理框架]]；与 ReAct 的功能对比见 [[Agent 核心概念#2.3 三种框架对比]]；Claude Code 的 Plan Mode 是 ReAct + Plan-and-Execute 混合（详见 §五）。

---

## 一、核心思想：规划与执行分离

### 与 ReAct 的对比

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

==核心差别==：

| 维度 | ReAct | Plan-and-Execute |
|------|-------|-----------------|
| LLM 调用次数 | N 步 = N 次 | 1 次 Plan + N 次 Execute（如果 Execute 步骤本身用 LLM） |
| 全局视野 | 弱（只看下一步） | 强（一次性看完所有步骤） |
| 中途调整 | 天然支持（每步都重新决策） | 需要显式 Replan |
| 适合 | 探索性任务 | 步骤明确、有依赖、流水线 |

### 为什么分两阶段

==两个独立动机==：

==① 全局规划比局部贪心更优==
ReAct 容易陷入局部最优——比如要写一个项目，搜到一个相关库就开始用，忘了还有更好的方案。Planner 一次性看完任务全貌，==能合理分配资源、避免重复劳动==。

==② Plan 是显式的人工可审查产物==
LLM 输出的 Plan 是一个 Python 列表/JSON，==可以打印出来给用户看==——这就是 Claude Code 的 Plan Mode 的基础。==ReAct 没有这种"全局快照"==——每一步分散在循环里。

### 适用场景

- ==数据处理流水线==：抽数 → 清洗 → 转换 → 入库
- ==报告生成==：搜索 → 整理 → 分析 → 撰写 → 校对
- ==多步骤部署==：备份 → 停服务 → 升级 → 启动 → 验证
- ==代码重构==：识别重复 → 抽取函数 → 替换调用点 → 跑测试

==共性==：步骤之间==有清晰依赖==，==中途不需要大幅调整方向==。

==不适合==：探索性任务（比如"帮我研究一下这个 bug 的根因"）——这种你不知道下一步该干什么，==必须看了上一步结果才能决定==。这是 ReAct 的主场。

---

## 二、完整 80 行 Python 实现

==没有任何"魔法"==，全是手写代码。复用 [[ReAct 与 Harness 实现]] 的工具定义，只换控制流：

```python
import json

# ============ 第 1 部分：定义工具（与 ReAct 实现完全一样） ============

def read_file(path: str) -> str:
    with open(path, 'r') as f:
        return f.read()

def execute_command(cmd: str) -> str:
    import subprocess
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    return result.stdout + result.stderr

TOOLS = {
    "read_file": read_file,
    "execute_command": execute_command,
}

# ============ 第 2 部分:Planner Prompt（关键差异 vs ReAct） ============

PLANNER_PROMPT = """你是一个任务规划助手。给定用户任务,输出一个完整的执行计划。

可用工具:
- read_file(path: str) -> str
- execute_command(cmd: str) -> str

==必须==以 JSON 数组格式输出,每个元素是一个步骤:
[
  {"step": 1, "action": "工具名", "args": {...}, "purpose": "这一步的目的"},
  {"step": 2, "action": "工具名", "args": {...}, "purpose": "..."},
  ...
]

==规则==:
1. 列出所有需要的步骤,不要遗漏
2. 步骤必须按依赖顺序排列
3. 每步必须能用上面的工具完成
4. ==只输出 JSON==,不要解释
"""

# ============ 第 3 部分:Planner——一次性产出完整计划 ============

def make_plan(user_task: str) -> list:
    messages = [
        {"role": "system", "content": PLANNER_PROMPT},
        {"role": "user", "content": user_task}
    ]
    response_text = llm.invoke(messages)
    plan = json.loads(response_text)
    print(f"==生成计划==:")
    for step in plan:
        print(f"  Step {step['step']}: {step['purpose']}")
    return plan

# ============ 第 4 部分:Executor——按顺序执行计划 ============

def execute_plan(plan: list) -> dict:
    results = {}  # 存每一步的结果,后续步骤可能需要用到

    for step in plan:
        step_id = step["step"]
        tool_name = step["action"]
        tool_args = step["args"]

        print(f"\n==执行 Step {step_id}==: {step['purpose']}")

        try:
            result = TOOLS[tool_name](**tool_args)
            results[step_id] = result
            print(f"  ✓ 成功(输出 {len(str(result))} 字符)")
        except Exception as e:
            print(f"  ✗ 失败:{e}")
            return {"status": "failed", "step": step_id, "error": str(e), "results": results}

    return {"status": "success", "results": results}

# ============ 第 5 部分:主入口 ============

def plan_and_execute(user_task: str):
    plan = make_plan(user_task)        # 阶段 1:一次性规划
    return execute_plan(plan)            # 阶段 2:按计划执行
```

==整个 Plan-and-Execute 框架的核心就这 80 行==。生产级框架（LangGraph）只是在这个基础上加了:Replan、并行执行、状态持久化、可视化——==核心两阶段不变==。

### 运行示例

```python
plan_and_execute("帮我看看 main.py 文件,然后跑一下 pytest")

# 输出:
# ==生成计划==:
#   Step 1: 读取 main.py 看代码内容
#   Step 2: 跑 pytest 验证测试是否通过
#
# ==执行 Step 1==: 读取 main.py 看代码内容
#   ✓ 成功(输出 1234 字符)
#
# ==执行 Step 2==: 跑 pytest 验证测试是否通过
#   ✓ 成功(输出 567 字符)
```

---

## 三、Plan 的 schema 三种递进设计

### 3.0 前置认知:DAG 是什么、为什么 Plan 需要它

==DAG = Directed Acyclic Graph(有向无环图)==——三个要素:

| 词 | 含义 |
|---|------|
| ==Directed==(有向) | 边有方向,==`A → B`== 表示"A 必须在 B 之前完成" |
| ==Acyclic==(无环) | 不能出现 ==`A → B → A`==(死循环) |
| ==Graph==(图) | 节点 + 边的网状结构,==不是简单的线性列表== |

==一句话==:==用网状图表示步骤之间的依赖关系==——某些步骤可以并行,某些必须等前面完成。

#### 为什么 Plan 需要升级到 DAG

具体例子——任务"==写一份 Cursor / Claude Code / Aider 的竞品分析报告=="

==线性 Plan==(原始版本):
```
Step 1: 搜索 Cursor → Step 2: 搜索 Claude Code → Step 3: 搜索 Aider
                              ↓
                       Step 4: 整理对比表 → Step 5: 写报告
```
Step 1/2/3 ==互相不依赖==,但==被强制串行==。每个搜索 30 秒 → ==线性总共 90 秒==。

==DAG Plan==(升级版):
```
   [Step 1]      [Step 2]      [Step 3]
  搜索 Cursor  搜索 ClaudeCode  搜索 Aider     ← 三个并行
       ↘          ↓          ↙
            [Step 4 整理对比表]                 ← 等三个都完成
                  ↓
            [Step 5 写报告]
```
==Step 1/2/3 并行==(30 秒)+ Step 4 + Step 5 = ==30+N 秒,快 3 倍==。

#### DAG 的四个工程价值

==① 并行执行==(性能)
识别==无依赖关系的步骤==同时跑。==DAG 越宽,并行度越高==。

==② 循环依赖检测==(正确性)
==Acyclic== 是 DAG 的硬约束。Planner 输出后==执行前用拓扑排序检查无环==:
```
Step 1: depends_on: [3]
Step 3: depends_on: [1]   ⚠️ 循环依赖!
```
==这种 LLM 偶尔会犯==,执行前立刻能查出来,直接 Replan。

==③ 进度可视化==(可观测)
DAG 可以==渲染成图==给用户看进度——一眼看出哪些步骤在并行跑、哪些已完成、哪些卡住。

==④ 失败影响范围==(鲁棒性)
某步失败时,==DAG 知道哪些下游受影响==。Step 3 失败 → Step 4、5 受影响,==但 Step 1、2 已成功的结果保留==,Replan 只重做 Step 3 及下游。==线性 Plan 失败可能要全部重做==。

#### DAG vs StateGraph 的关系

==StateGraph 是 DAG 的超集==——LangGraph 用 StateGraph,允许 ==DAG 不允许的==:

| 维度 | DAG | StateGraph |
|------|-----|-----------|
| 有向 | ✓ | ✓ |
| 无环 | ✓(==必须==) | ✗(==允许循环==) |
| 条件分支 | ✗ | ✓(条件边) |
| 状态传递 | 弱 | ✓(显式 State) |

==StateGraph 允许循环==——Replan 节点可以回到 Planner(执行失败 → 回去重新规划),==这在严格 DAG 里不允许==。所以:
- ==简单 Plan==:DAG 够用(无 Replan / 单向流)
- ==复杂 Plan==:升级到 StateGraph(支持 Replan / 条件分支 / 多次循环)

详见 §六 与 LangGraph 的关系。

#### DAG 不是 Plan-and-Execute 独有

==DAG 是计算机工程里的老概念==,到处都是:

| 系统 | DAG 用途 |
|------|---------|
| ==Airflow / Prefect== | 数据管道用 DAG 描述任务依赖 |
| ==Make / Bazel== | 构建系统用 DAG 描述编译依赖 |
| ==Git== | Commit 历史是 DAG(merge 让它有分支但无环) |
| ==Spark== | DAG Scheduler 把 RDD 转换链编排成执行图 |
| ==Plan-and-Execute Agent== | 子任务依赖关系编排 |

==Plan-and-Execute 用 DAG 不是新概念==——只是把数据管道编排的成熟方法==搬到 Agent 任务编排上==。本质和 Airflow 是一回事,==只不过节点变成"LLM 调用 + 工具调用"==。

---

### 3.1 V1 简单线性(上面的版本)

```json
[
  {"step": 1, "action": "read_file", "args": {"path": "a.py"}, "purpose": "..."},
  {"step": 2, "action": "execute_command", "args": {"cmd": "pytest"}, "purpose": "..."}
]
```

==只能严格顺序执行==,不支持并行,不支持依赖判断。

### 3.2 V2 加依赖(DAG 形式)

```json
[
  {"step": 1, "action": "read_file", "args": {"path": "a.py"}, "depends_on": []},
  {"step": 2, "action": "read_file", "args": {"path": "b.py"}, "depends_on": []},
  {"step": 3, "action": "execute_command", "args": {"cmd": "pytest"}, "depends_on": [1, 2]}
]
```

==Step 1 和 Step 2 没有依赖,可以并行==(==asyncio.gather==),Step 3 等前两个都完成才执行。

```python
# Executor 升级版:支持 DAG 并发
import asyncio

async def execute_plan_dag(plan):
    results = {}
    completed = set()

    while len(completed) < len(plan):
        # 找出所有依赖都完成的步骤
        ready = [
            s for s in plan
            if s["step"] not in completed
            and all(d in completed for d in s.get("depends_on", []))
        ]
        if not ready:
            raise RuntimeError("循环依赖或卡死")

        # ==并发执行==所有 ready 的步骤
        tasks = [run_step(s, results) for s in ready]
        outputs = await asyncio.gather(*tasks)

        for s, output in zip(ready, outputs):
            results[s["step"]] = output
            completed.add(s["step"])

    return results
```

### 3.3 V3 加输入输出绑定

```json
[
  {"step": 1, "action": "read_file", "args": {"path": "config.yaml"}, "outputs": "config"},
  {"step": 2, "action": "execute_command",
   "args": {"cmd": "deploy --env={{config.env}}"},   ← 引用 Step 1 的输出
   "depends_on": [1]}
]
```

==Step 2 的参数引用 Step 1 的结果==——这是 LangGraph 的 ==State 传递机制==的简化版。Plan 从"指令列表"升级为"==数据流图=="。

==继续往复杂走==,你就在重新发明 LangGraph 的 StateGraph 了——见 §六。

---

## 四、Replan 机制:让计划可调整

==Plan-and-Execute 最大的弱点==:计划生成后就==锁死==了,如果中途某步失败、或发现计划本身有问题,==整个推翻很贵==。==Replan==是补丁。

### 4.1 触发 Replan 的三种信号

| 信号 | 来源 | 例子 |
|------|------|------|
| ==执行失败== | Executor 抛异常 | API 挂了、文件不存在 |
| ==中间结果异常== | Step 输出不符合预期 | 搜索返回 0 结果 / 数据库为空 |
| ==质量评估不达标== | Reflection 判定 | 生成代码跑不通测试 |

### 4.2 简化版 Replan 代码

```python
def plan_and_execute_with_replan(user_task: str, max_replans: int = 3):
    plan = make_plan(user_task)
    history = []

    for attempt in range(max_replans):
        result = execute_plan(plan)

        if result["status"] == "success":
            return result

        # ==失败 → 让 LLM 看着错误重新规划==
        history.append({
            "failed_plan": plan,
            "failed_step": result["step"],
            "error": result["error"],
            "partial_results": result["results"]
        })

        plan = make_plan_with_history(user_task, history)
        print(f"\n==Replan 第 {attempt + 1} 次==(原 Step {result['step']} 失败)")

    return {"status": "exhausted", "history": history}


def make_plan_with_history(user_task: str, history: list) -> list:
    """带失败历史的 Replan"""
    context = "\n".join([
        f"先前尝试 #{i+1}: 在 Step {h['failed_step']} 失败,原因: {h['error']}"
        for i, h in enumerate(history)
    ])
    messages = [
        {"role": "system", "content": PLANNER_PROMPT},
        {"role": "user", "content": f"任务: {user_task}\n\n==避免之前失败的路径==:\n{context}"}
    ]
    return json.loads(llm.invoke(messages))
```

### 4.3 Replan 的工程要点

- ==Replan 上限==:通常 2-3 次,超过就上报失败,==避免无限重试==
- ==Replan 不是从零开始==:把已成功的步骤保留在 results 里,只重做失败的部分
- ==Replan 提示要给 LLM 看==失败上下文(错误类型、错误消息、partial 结果)
- ==Replan vs ReAct 区别==:Replan 是"==重新规划=="(整个 Plan 重生成),ReAct 的纠错是"==下一步换条路=="(单步调整)

==LangGraph 的 Plan-and-Execute 实现==就内置 Replan 节点——状态图里加一条边"if execute_failed → planner",自动循环。

### 4.4 Replan 上下文裁剪策略:两层 context 分离

==Replan 最容易爆炸的地方==:某个 Step 拉了 5000 行文章 / 大 SQL 查询结果 / 完整文件——==如果原样塞进 Replan prompt,几次 replan 就炸了 context==。

#### 核心认知:两层 context 分离

```
┌───────────────────────────────────────────┐
│ Replan Prompt (==Planner LLM 看到的==)    │
│ → 只看 metadata / 摘要                    │
│ → "Step 1 拉到了 5000 字文章,主题 X"     │
│ → ==2-5k tokens== (无论中间产物多大)      │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│ Execution State (==Executor LLM 看到的==) │
│ → 完整 artifact 都存着                    │
│ → step_1.output = <5000 字全文>           │
│ → 通过引用 {{step_1.output}} 注入         │
└───────────────────────────────────────────┘
```

==关键==:
- ==Planner 不看原始内容==——只看元信息,足以重新规划下游
- ==Executor 看原始内容==——执行时从 state 加载,通过 `{{step_X.output}}` 引用注入
- ==两个 context 完全独立==——Planner 始终没看过 5000 字原文

#### 输出大小三档处理

| 输出大小 | 例子 | Replan 时怎么传 |
|---------|------|---------------|
| ==小（< 200 tokens）== | HTTP 状态码 / 错误消息 / 简单 JSON / 3 条 DB 记录 | ==直接 inline 全文== |
| ==中（200-2000 tokens）== | 短文章 / 函数代码 / 一段日志 | ==inline 摘要 + 关键属性== |
| ==大（> 2000 tokens）== | 5000 行文章 / 完整文件 / 大量 SQL 结果 | ==只传 metadata==,内容存 state |

#### Metadata 怎么来:两种生成方法

**方法一:确定性提取**(轻量,优先用)

==Step 跑完 Harness 自动从输出里提取==——零成本,纯代码:

```python
def make_metadata(step, output) -> dict:
    return {
        "type": detect_type(output),         # text / json / binary / code
        "size_tokens": estimate_tokens(output),
        "preview": output[:200] + "...",     # 前 200 字符
        "key_attrs": extract_attrs(output),  # 类型相关:文章看标题/字数;代码看函数名/语言
    }

# 例子: 拉到一篇 5000 字文章
metadata = {
    "type": "text/html",
    "size_tokens": 6500,
    "preview": "AI 安全前沿:本文从 alignment 视角讨论...",
    "key_attrs": {
        "title": "AI 安全前沿",
        "word_count": 5000,
        "code_blocks": 12,
        "lang": "zh-CN"
    }
}
```

**方法二:LLM 摘要**(成本高,只对大输出用)

==输出 > 2000 tokens 时==,让==便宜小模型==(Haiku / Flash / GLM-Flash)生成一句话摘要:

```python
async def add_summary_if_large(metadata: dict, output: str) -> dict:
    if metadata["size_tokens"] > 2000:
        # ★ 用便宜模型,不用主 LLM
        metadata["summary"] = await haiku.invoke(
            f"用一句话总结这段内容(<50 字): {output[:5000]}"
        )
    return metadata
```

==成本经济学==:Haiku 调用 ~$0.001——==1 次便宜调用换后续 N 次 Replan prompt 省几千 token==,完全划算。

#### 完整 metadata 生成流程

```python
async def execute_step_with_metadata(step, state):
    output = await execute(step, state)         # 1. 执行 step

    # 2. 自动生成 metadata
    metadata = make_metadata(step, output)
    metadata = await add_summary_if_large(metadata, output)

    # 3. 双层存储
    state.artifacts[step.id] = output           # ★ 完整内容,Executor 用
    state.metadata[step.id] = metadata          # ★ 元信息,Planner 用

    return {"status": "success", "step_id": step.id}
```

==存储位置==(看实现):内存(单进程 Agent)/ Redis(多进程)/ 文件(长任务持久化)。==关键==:===artifact 和 metadata 分开存===,Replan 只读 metadata,Executor 读 artifact。

#### 完整 Replan prompt 示例

==场景==:Step 1 拉文章 → Step 2 总结 → Step 3 写 DB(失败)

```
原始任务: 抓取这篇文章并存入 DB

==上次的计划==:
Step 1: fetch_url("...") → ✓ 完成
        artifact: HTML 文章, 5000 字, 主题 "AI 安全", 含 12 个代码块
        摘要: "本文从 alignment 视角讨论 AI 安全前沿..."
        (full content stored in state as step_1.output)

Step 2: summarize(step_1.output) → ✓ 完成
        artifact: 300 字摘要, 提取了 5 个关键点
        (full content stored as step_2.output)

Step 3: insert_db(step_2.output) → ✗ 失败
        ERROR: TableNotFound 'articles_v2'

==请基于已有 artifacts 重新规划剩余步骤==
```

==Planner LLM 看不到==那 5000 字原文,只看 metadata。==新 Plan 引用 `{{step_2.output}}`==——Executor 跑到那一步时,==从 state 加载 step_2 的 300 字摘要==塞进新工具调用。

#### Token 量级对比

| 策略 | 一次 Replan 的 prompt 大小 |
|------|------------------------|
| ==精简策略==(本节方案) | ==2-5k tokens== |
| 全量历史(每 Step 完整 trace) | ==20-50k tokens==,几次 replan 就炸 |
| 只传错误,丢失成功 Step 信息 | <2k 但==Planner 不知道做过什么,容易重做== |

==生产推荐==:本节的精简策略——==每个成功 Step 只留 metadata + 引用 ID==,失败 Step 留完整错误。这与 [[长上下文工程]] 的 context budget 思路一致。

#### 关键原则

| 原则 | 说明 |
|------|------|
| ==Planner 看元信息== | metadata + 摘要,不看原始 artifact |
| ==Executor 看完整内容== | 通过 `{{step_X.output}}` 引用从 state 加载 |
| ==小输出原样传== | < 200 tokens 直接 inline,不值得做 metadata |
| ==大输出强制 metadata== | > 2000 tokens 必须用 metadata,否则 prompt 爆炸 |
| ==metadata 自动生成== | 确定性提取 + 大输出用便宜 LLM 摘要 |
| ==artifact 和 metadata 分开存== | 双层 state,各取所需 |

==面试时讲清==:"==Replan 不爆炸的关键是两层 context 分离==——Planner 只看 metadata 重新规划,Executor 通过引用从 state 加载完整 artifact。==大输出走 metadata + 便宜 LLM 摘要==,1 次 Haiku 调用换后续多次 Replan 省几千 token。"

---

## 五、与 ReAct 的混合(生产级架构)

==成熟生产 Agent 系统==基本不用纯 Plan-and-Execute——==都是混合==:

```
顶层:Plan-and-Execute(全局规划)
   ├── Step 1
   │   └── 内部:ReAct 循环(自由探索完成这步)
   ├── Step 2
   │   └── 内部:ReAct 循环
   ├── Step 3
   │   └── 内部:ReAct 循环
   └── ...
```

==这就是 Claude Code 的 Plan Mode==:
- 用户敲 `/plan` 进入 Plan Mode
- LLM 生成完整 Plan 写到临时文件
- 弹窗给用户审批(==Human-in-the-Loop==)
- 通过后==每个 Step 内部用默认的 ReAct 模式执行==
- 失败可以触发 Replan

```python
def hybrid_agent(user_task: str):
    plan = make_plan(user_task)

    # 用户审批 Plan
    if not user_approve(plan):
        return {"status": "rejected"}

    results = {}
    for step in plan:
        # ==每个 Step 内部用 ReAct 完成==
        # ReAct 可以自己决定调几个工具、要不要重试
        step_result = react_loop(
            user_query=step["purpose"],
            max_steps=10,
            context=results  # 传递前面步骤的结果
        )
        results[step["step"]] = step_result

    return results
```

==混合的好处==:
- ==顶层 Plan==给全局视野,避免局部最优
- ==底层 ReAct==给每步的灵活性,允许探索
- ==两层都可以失败重试==,鲁棒性更强

==这就是 [[Agent 核心概念#2.2 三种核心能力]] 末尾说的"==混合使用三种能力=="==。

---

## 六、与 LangGraph 的关系

当 Plan 复杂度超过一定阈值(==条件分支多、依赖关系网络化、需要状态机==),手写 list 维护成本爆炸,==升级到 LangGraph StateGraph==:

```python
# LangGraph Plan-and-Execute 简化示例
from langgraph.graph import StateGraph, END

graph = StateGraph(AgentState)
graph.add_node("planner", planner_node)
graph.add_node("executor", executor_node)
graph.add_node("replanner", replanner_node)

graph.set_entry_point("planner")
graph.add_edge("planner", "executor")
graph.add_conditional_edges(
    "executor",
    should_continue,    # 函数判断:成功 → END / 失败 → replanner / 还有步骤 → executor
    {"replan": "replanner", "continue": "executor", "done": END}
)
graph.add_edge("replanner", "executor")

app = graph.compile()
```

==LangGraph 是 Plan-and-Execute 的"工程化版本"==:
- ==Plan 不再是一个 list==,而是==状态图的节点和边==
- ==Replan 是图里的一个节点==,不是 if-else 嵌套
- ==状态可视化、可序列化、可持久化==

==选择标准==:
- ==Plan ≤ 10 步,线性,稳定== → 手写 list 就够
- ==Plan 复杂、有分支、需要 Replan== → 升级到 LangGraph

详见 [[Agent 框架#2.2 LangGraph]]。

---

## 七、其他规划模式(Plan 家族)

Plan-and-Execute 是最经典的,但学术界 + 生产中还有几种重要变体——==都是给"==让 LLM 怎么规划复杂任务=="提供不同思路==。理解这些能让你对"==Plan 是什么==有更全面的认知"。

### 7.1 ReWOO(Reasoning WithOut Observation)

==2023 年由 USC + Microsoft 提出==。和 Plan-and-Execute 类似但==更彻底前向==。

==核心区别==:
- ==Plan-and-Execute==:Plan 一次性生成,但==执行每步还会让 LLM 看上下文==(每步可能再调 LLM 决策细节)
- ==ReWOO==:Plan 里==直接用占位符==`#E1` `#E2` 引用前步结果,==Executor 阶段完全不调 LLM==,只跑工具

```
Plan(LLM 一次调用):
  Step 1: search("Python tutorial") → #E1
  Step 2: search(==#E1== 中提到的最受欢迎库) → #E2
  Step 3: summarize(==#E1==, ==#E2==) → answer

Executor(==零 LLM 调用==,只跑工具):
  执行 Step 1 → 把结果替换 #E1
  执行 Step 2 → 把结果替换 #E2(==Step 2 的参数=="#E1 中..."==文本替换==)
  执行 Step 3 → 输出
```

==优点==:==省 5x LLM 调用==(论文实测),适合 Plan 步骤简单清晰的场景。
==缺点==:对 Plan 质量要求==极高==——一次错全错,完全没有中途调整能力。

==生产中很少独立用 ReWOO==,但思想被吸收到 LLMCompiler 里。

### 7.2 LLMCompiler

==2023 年 UC Berkeley 提出==,可以理解为==ReWOO 的工程化升级版==。

==核心思想==:==把 Plan 编译成可并行执行图==,类似编程语言编译器把代码编译成 IR。

```
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

### 7.3 Tree of Thoughts(ToT)

==2023 年 Princeton + Google 提出==。==不是单条 Plan,是 N 条 Plan 的搜索树==。

==核心思想==:每步生成==多个候选思路==,搜索==树状探索==,最后选最好的:

```
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

### 7.4 LATS(Language Agent Tree Search)

==2024 年 UIUC 提出==,把 ==MCTS(蒙特卡洛树搜索)+ ReAct== 混合。

==核心思想==:每步用 MCTS 决定最优动作:
- 从当前状态出发,模拟 K 个可能动作
- 每个动作执行后用 LLM 评估"==离目标多近=="
- 反向传播打分,选最高分动作执行

==与 ToT 的区别==:ToT 是 BFS/DFS 搜索,LATS 是==MCTS==(类似 AlphaGo)——==更聪明的搜索算法==。

==适用==:编码 Agent、复杂 Web 操作、多步推理任务。

==代价==:==极慢且贵==——单步要跑 K 次 LLM 评估。==生产中用 LATS 的主要是研究项目==,实际产品很少。

### 7.5 Hierarchical / 递归 Plan

==经典 AI 规划==(HTN, Hierarchical Task Network)的 LLM 时代版本。

==核心思想==:==大任务拆子任务,子任务再拆子子任务==,树状层级:

```
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

==生产中的体现==:Anthropic 的 Multi-Agent Research(2024)就是 Hierarchical 模式——==Lead Agent 拆任务,Sub-Agent 各自执行子任务==。

### 7.6 Plan 模式选型

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
| ==90% 的实际场景== | ==Plan-and-Execute + ReAct 混合==(详见 §五) |

==关键认知==:
- ==绝大多数生产场景==,Plan-and-Execute(线性或 DAG) + ReAct 混合就够
- ==ToT / LATS 是研究产物==,生产价值有限(贵 + 慢)
- ==Hierarchical 在长任务场景==(写书、深度研究)有真实价值
- ==LLMCompiler / ReWOO 在性能敏感场景==(高吞吐 Agent 服务)有价值

==面试时讲清"==90% 用 Plan-and-Execute,5% 用 Hierarchical,4% 用 LLMCompiler,1% 用 ToT/LATS=="==,比死记所有模式更有判断力。

---

## 八、关键认知:Plan ≠ 更聪明

==很多人觉得"Plan-and-Execute 比 ReAct 高级"==——==错==。两者各有适用场景:

| 场景 | 用什么 |
|------|------|
| 任务边界清晰、步骤明确 | ==Plan-and-Execute== |
| 任务开放、需要边走边看 | ==ReAct== |
| 复杂生产任务、要求质量稳定 | ==混合(顶层 Plan + 底层 ReAct)== |
| 简单单步任务 | ==都不要,直接 LLM 一次回答== |

==Plan-and-Execute 的代价==:
- ==失去灵活性==:计划锁死,中途意外重做整个 Plan 很贵
- ==Planner 是单点==:Plan 生成质量差就全错
- ==成本可能更高==:Replan 一次 = 1 次 Planner LLM + N 次 Executor LLM

==选 Plan-and-Execute 的真正理由==是:==你需要让人审批整体方案==(Plan Mode 给用户看),==或者== ==你需要可追溯的执行记录==(Plan 是显式产物,可以审计)。==不是因为它"更聪明"==。

---

## 相关链接

- [[ReAct 与 Harness 实现]] — 配对的另一种推理框架完整实现(60 行 Python)
- [[Agent 核心概念#二、推理模式与 Harness 控制流]] — 三种推理框架的概念对比
- [[Agent 框架#2.2 LangGraph]] — Plan-and-Execute 的工程化版本
- [[Harness Engineering#控制流模式（六大组件之外的"第七维"）]] — 控制流是 Harness 的第七维
- [[Agent 工程实践#二、Multi-Agent 架构]] — 多 Agent 协作中的任务分发
- [[AI 编程工具#7.1 Commands（命令）]] — Claude Code 的 /plan 命令
