---
module: Agent
tags: [Agent, Plan-and-Execute, Tutorial, Implementation, Python, Replan]
difficulty: hard
last_reviewed: 2026-06-01
---

# Plan-and-Execute 实现教程

> ==80 行 Python 看清 Plan-and-Execute 的完整流程==——从零实现、代码示例、Replan 机制。

> [!tip] 前置阅读
> - 核心概念见 [[Plan-and-Execute 模式]]
> - 框架对比见 [[Plan-and-Execute 实现对比]]

## 一、完整 80 行 Python 实现

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

# ============ 第 2 部分：Planner Prompt（关键差异 vs ReAct） ============

PLANNER_PROMPT = """你是一个任务规划助手。给定用户任务，输出一个完整的执行计划。

可用工具：
- read_file(path: str) -> str
- execute_command(cmd: str) -> str

==必须==以 JSON 数组格式输出，每个元素是一个步骤：
[
  {"step": 1, "action": "工具名", "args": {...}, "purpose": "这一步的目的"},
  {"step": 2, "action": "工具名", "args": {...}, "purpose": "..."},
  ...
]

==规则==：
1. 列出所有需要的步骤，不要遗漏
2. 步骤必须按依赖顺序排列
3. 每步必须能用上面的工具完成
4. ==只输出 JSON==，不要解释
"""

# ============ 第 3 部分：Planner——一次性产出完整计划 ============

def make_plan(user_task: str) -> list:
    messages = [
        {"role": "system", "content": PLANNER_PROMPT},
        {"role": "user", "content": user_task}
    ]
    response_text = llm.invoke(messages)
    plan = json.loads(response_text)
    print(f"==生成计划==：")
    for step in plan:
        print(f"  Step {step['step']}: {step['purpose']}")
    return plan

# ============ 第 4 部分：Executor——按顺序执行计划 ============

def execute_plan(plan: list) -> dict:
    results = {}  # 存每一步的结果，后续步骤可能需要用到

    for step in plan:
        step_id = step["step"]
        tool_name = step["action"]
        tool_args = step["args"]

        print(f"\n==执行 Step {step_id}==：{step['purpose']}")

        try:
            result = TOOLS[tool_name](**tool_args)
            results[step_id] = result
            print(f"  ✓ 成功（输出 {len(str(result))} 字符）")
        except Exception as e:
            print(f"  ✗ 失败：{e}")
            return {"status": "failed", "step": step_id, "error": str(e), "results": results}

    return {"status": "success", "results": results}

# ============ 第 5 部分：主入口 ============

def plan_and_execute(user_task: str):
    plan = make_plan(user_task)        # 阶段 1：一次性规划
    return execute_plan(plan)            # 阶段 2：按计划执行
```

==整个 Plan-and-Execute 框架的核心就这 80 行==。生产级框架（LangGraph）只是在这个基础上加了：Replan、并行执行、状态持久化、可视化——==核心两阶段不变==。

### 运行示例

```python
plan_and_execute("帮我看看 main.py 文件，然后跑一下 pytest")

# 输出：
# ==生成计划==：
#   Step 1: 读取 main.py 看代码内容
#   Step 2: 跑 pytest 验证测试是否通过
#
# ==执行 Step 1==：读取 main.py 看代码内容
#   ✓ 成功（输出 1234 字符）
#
# ==执行 Step 2==：跑 pytest 验证测试是否通过
#   ✓ 成功（输出 567 字符）
```

---

## 二、支持 DAG 并发的升级版

基础版本只能串行执行，升级支持 DAG（有向无环图）并发：

```python
# Executor 升级版：支持 DAG 并发
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


async def run_step(step, results):
    """执行单个步骤"""
    tool_name = step["action"]
    tool_args = step["args"]
    
    # 如果参数引用之前的结果，替换引用
    resolved_args = resolve_references(tool_args, results)
    
    return TOOLS[tool_name](**resolved_args)


def resolve_references(args, results):
    """解析 {{step_X.output}} 形式的引用"""
    # 简化实现，生产环境需要递归处理嵌套
    import re
    args_str = json.dumps(args)
    for match in re.finditer(r'\{\{step_(\d+)\.output\}\}', args_str):
        step_id = int(match.group(1))
        args_str = args_str.replace(match.group(0), results[step_id])
    return json.loads(args_str)
```

### DAG Plan 示例

```json
[
  {"step": 1, "action": "read_file", "args": {"path": "a.py"}, "depends_on": []},
  {"step": 2, "action": "read_file", "args": {"path": "b.py"}, "depends_on": []},
  {"step": 3, "action": "execute_command", "args": {"cmd": "pytest"}, "depends_on": [1, 2]}
]
```

==Step 1 和 Step 2 没有依赖，可以并行==（==asyncio.gather==），Step 3 等前两个都完成才执行。

---

## 三、Replan 机制实现

==Plan-and-Execute 最大的弱点==：计划生成后就==锁死==了，如果中途某步失败、或发现计划本身有问题，==整个推翻很贵==。==Replan==是补丁。

### 3.1 简化版 Replan 代码

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
        print(f"\n==Replan 第 {attempt + 1} 次==（原 Step {result['step']} 失败）")

    return {"status": "exhausted", "history": history}


def make_plan_with_history(user_task: str, history: list) -> list:
    """带失败历史的 Replan"""
    context = "\n".join([
        f"先前尝试 #{i+1}：在 Step {h['failed_step']} 失败，原因：{h['error']}"
        for i, h in enumerate(history)
    ])
    messages = [
        {"role": "system", "content": PLANNER_PROMPT},
        {"role": "user", "content": f"任务：{user_task}\n\n==避免之前失败的路径==：\n{context}"}
    ]
    return json.loads(llm.invoke(messages))
```

### 3.2 Replan 的工程要点

- ==Replan 上限==：通常 2-3 次，超过就上报失败，==避免无限重试==
- ==Replan 不是从零开始==：把已成功的步骤保留在 results 里，只重做失败的部分
- ==Replan 提示要给 LLM 看==失败上下文（错误类型、错误消息、partial 结果）
- ==Replan vs ReAct 区别==：Replan 是"==重新规划=="（整个 Plan 重生成），ReAct 的纠错是"==下一步换条路=="（单步调整）

---

## 四、Replan 上下文裁剪

==Replan 最容易爆炸的地方==：某个 Step 拉了 5000 行文章 / 大 SQL 查询结果 / 完整文件——==如果原样塞进 Replan prompt，几次 replan 就炸了 context==。

### 4.1 核心认知：两层 context 分离

```
┌───────────────────────────────────────────┐
│ Replan Prompt (==Planner LLM 看到的==)    │
│ → 只看 metadata / 摘要                    │
│ → "Step 1 拉到了 5000 字文章，主题 X"     │
│ → ==2-5k tokens== (无论中间产物多大)      │
└────────────────��──────────────────────────┘

┌───────────────────────────────────────────┐
│ Execution State (==Executor LLM 看到的==) │
│ → 完整 artifact 都存着                    │
│ → step_1.output = <5000 字全文>           │
│ → 通过引用 {{step_1.output}} 注入         │
└───────────────────────────────────────────┘
```

==关键==：
- ==Planner 不看原始内容==——只看元信息，足以重新规划下游
- ==Executor 看原始内容==——执行时从 state 加载，通过 `{{step_X.output}}` 引用注入
- ==两个 context 完全独立==——Planner 始终没看过 5000 字原文

### 4.2 输出大小三档处理

| 输出大小 | 例子 | Replan 时怎么传 |
|---------|------|---------------|
| ==小（< 200 tokens）== | HTTP 状态码 / 错误消息 / 简单 JSON / 3 条 DB 记录 | ==直接 inline 全文== |
| ==中（200-2000 tokens）== | 短文章 / 函数代码 / 一段日志 | ==inline 摘要 + 关键属性== |
| ==大（> 2000 tokens）== | 5000 行文章 / 完整文件 / 大量 SQL 结果 | ==只传 metadata==，内容存 state |

### 4.3 Metadata 生成：两种方法

**方法一：确定性提取**（轻量，优先用）

==Step 跑完 Harness 自动从输出里提取==——零成本，纯代码：

```python
def make_metadata(step, output) -> dict:
    return {
        "type": detect_type(output),         # text / json / binary / code
        "size_tokens": estimate_tokens(output),
        "preview": output[:200] + "...",     # 前 200 字符
        "key_attrs": extract_attrs(output),  # 类型相关：文章看标题/字数；代码看函数名/语言
    }

# 例子：拉到一篇 5000 字文章
metadata = {
    "type": "text/html",
    "size_tokens": 6500,
    "preview": "AI 安全前沿：本文从 alignment 视角讨论...",
    "key_attrs": {
        "title": "AI 安全前沿",
        "word_count": 5000,
        "code_blocks": 12,
        "lang": "zh-CN"
    }
}
```

**方法二：LLM 摘要**（成本高，只对大输出用）

==输出 > 2000 tokens 时==，让==便宜小模型==（Haiku / Flash / GLM-Flash）生成一句话摘要：

```python
async def add_summary_if_large(metadata: dict, output: str) -> dict:
    if metadata["size_tokens"] > 2000:
        # ★ 用便宜模型，不用主 LLM
        metadata["summary"] = await haiku.invoke(
            f"用一句话总结这段内容（<50 字）：{output[:5000]}"
        )
    return metadata
```

==成本经济学==：Haiku 调用 ~$0.001——==1 次便宜调用换后续 N 次 Replan prompt 省几千 token==，完全划算。

### 4.4 完整 metadata 生成流程

```python
async def execute_step_with_metadata(step, state):
    output = await execute(step, state)         # 1. 执行 step

    # 2. 自动生成 metadata
    metadata = make_metadata(step, output)
    metadata = await add_summary_if_large(metadata, output)

    # 3. 双层存储
    state.artifacts[step.id] = output           # ★ 完整内容，Executor 用
    state.metadata[step.id] = metadata          # ★ 元信息，Planner 用

    return {"status": "success", "step_id": step.id}
```

==存储位置==（看实现）：内存（单进程 Agent）/ Redis（多进程）/ 文件（长任务持久化）。==关键==：==artifact 和 metadata 分开存==，Replan 只读 metadata，Executor 读 artifact。

### 4.5 完整 Replan prompt 示例

==场景==：Step 1 拉文章 → Step 2 总结 → Step 3 写 DB（失败）

```
原始任务：抓取这篇文章并存入 DB

==上次的计划==：
Step 1: fetch_url("...") → ✓ 完成
        artifact: HTML 文章，5000 字，主题 "AI 安全"，含 12 个代码块
        摘要："本文从 alignment 视角讨论 AI 安全前沿..."
        (full content stored in state as step_1.output)

Step 2: summarize(step_1.output) → ✓ 完成
        artifact: 300 字摘要，提取了 5 个关键点
        (full content stored as step_2.output)

Step 3: insert_db(step_2.output) → ✗ 失败
        ERROR: TableNotFound 'articles_v2'

==请基于已有 artifacts 重新规划剩余步骤==
```

==Planner LLM 看不到==那 5000 字原文，只看 metadata。==新 Plan 引用 `{{step_2.output}}`==——Executor 跑到那一步时，==从 state 加载 step_2 的 300 字摘要==塞进新工具调用。

### 4.6 Token 量级对比

| 策略 | 一次 Replan 的 prompt 大小 |
|------|------------------------|
| ==精简策略==（本节方案） | ==2-5k tokens== |
| 全量历史（每 Step 完整 trace） | ==20-50k tokens==，几次 replan 就炸 |
| 只传错误，丢失成功 Step 信息 | <2k 但==Planner 不知道做过什么，容易重做== |

==生产推荐==：本节的精简策略——==每个成功 Step 只留 metadata + 引用 ID==，失败 Step 留完整错误。这与 [[长上下文工程]] 的 context budget 思路一致。

### 4.7 关键原则

| 原则 | 说明 |
|------|------|
| ==Planner 看元信息== | metadata + 摘要，不看原始 artifact |
| ==Executor 看完整内容== | 通过 `{{step_X.output}}` 引用从 state 加载 |
| ==小输出原样传== | < 200 tokens 直接 inline，不值得做 metadata |
| ==大输出强制 metadata== | > 2000 tokens 必须用 metadata，否则 prompt 爆炸 |
| ==metadata 自动生成== | 确定性提取 + 大输出用便宜 LLM 摘要 |
| ==artifact 和 metadata 分开存== | 双层 state，各取所需 |

==面试时讲清==："==Replan 不爆炸的关键是两层 context 分离==——Planner 只看 metadata 重新规划，Executor 通过引用从 state 加载完整 artifact。==大输出走 metadata + 便宜 LLM 摘要==，1 次 Haiku 调用换后续多次 Replan 省几千 token。"

---

## 五、与 ReAct 的混合实现

==成熟生产 Agent 系统==基本不用纯 Plan-and-Execute——==都是混合==：

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

==混合的好处==：
- ==顶层 Plan==给全局视野，避免局部最优
- ==底层 ReAct==给每步的灵活性，允许探索
- ==两层都可以失败重试==，鲁棒性更强

==这就是 Claude Code 的 Plan Mode==——详见 [[Plan-and-Execute 模式#与 ReAct 的混合]]。

---

## 相关链接

- [[Plan-and-Execute 模式]] — 核心概念与适用场景
- [[Plan-and-Execute 实现对比]] — LangGraph / AutoGPT / BabyAGI 对比
- [[ReAct 与 Harness 实现]] — ReAct 完整实现
- [[Agent 框架#2.2 LangGraph]] — Plan-and-Execute 的工程化版本
- [[长上下文工程]] — Context budget 管理思路
