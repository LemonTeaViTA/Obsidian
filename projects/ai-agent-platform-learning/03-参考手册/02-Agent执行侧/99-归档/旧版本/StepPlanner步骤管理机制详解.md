# StepPlanner 步骤管理机制详解

> 归档说明：本文与主详解重复，并包含旧的 `get_task_status()` 返回结构。当前实现请阅读 [step_planner详解.md](../../03-业务流程/step_planner详解.md)。

> 本文档详细解答 StepPlanner 如何记录步骤、如何区分步骤、如何判断完成的核心机制。

---

## 一、三个关键问题的答案

### 问题1：步骤是如何记录的？

**答案**：通过 `current_index`（当前索引）记录，**不是 Claude 提供序号！**

```python
# StepPlanner 的数据结构
{
  "task_id": "task_123",
  "steps": [
    {"name": "步骤1", ...},  # 索引 0
    {"name": "步骤2", ...},  # 索引 1
    {"name": "步骤3", ...},  # 索引 2
    {"name": "步骤4", ...}   # 索引 3
  ],
  "current_index": 2  # ⭐️ 就是这个！表示当前在索引2（第3步）
}

关键点：
  - current_index 是 StepPlanner 自己维护的
  - 从 0 开始（0 = 第1步，1 = 第2步...）
  - 每次调用 next() 时，current_index += 1
  - 保存到云端（COS），服务重启不丢失
```

### 问题2：如何区分步骤？

**答案**：通过数组索引（0, 1, 2, 3...）区分

```python
# cur() 方法返回当前步骤
def cur(self, task_id):
    data = self._load_task_data(task_id)
    
    # 通过 current_index 作为数组索引
    return data.steps[data.current_index]
    #              ↑
    #     steps[0] → 第1步
    #     steps[1] → 第2步
    #     steps[2] → 第3步
```

### 问题3：如何判断当前步骤完成？

**答案**：比较 `current_index` 和步骤总数

```python
# 判断是否完成所有步骤
if current_index >= len(steps):
    return None  # 已完成

# 示例：
# steps = [步骤1, 步骤2, 步骤3]
# len(steps) = 3

# current_index = 0 → 0 < 3 → 还有步骤
# current_index = 1 → 1 < 3 → 还有步骤
# current_index = 2 → 2 < 3 → 还有步骤
# current_index = 3 → 3 >= 3 → 全部完成 ✅
```

---

## 二、完整的步骤推进机制

### 核心代码：next() 方法

**位置**：[step_planner.py:132-153](../step_planner.py#L132-L153)

```python
def next(self, task_id: str) -> Optional[Step]:
    """进入下一个步骤并返回下一步的详细信息"""
    
    # 1. 从云端加载数据
    data = self._load_task_data(task_id)
    if data is None:
        return None  # 任务不存在
    
    # 2. 计算下一个索引 ⭐️ 关键逻辑！
    next_idx = data.current_index + 1
    # 例如：current_index = 1，next_idx = 2
    
    # 3. 先保存新索引到云端（重要！确保数据持久化）
    self._save_task_data(task_id, data.steps, next_idx)
    # 保存后云端的 current_index = 2
    
    # 4. 判断是否完成所有步骤 ⭐️ 完成判断！
    if next_idx >= len(data.steps):
        return None  # 已经没有下一步了
    
    # 5. 返回下一步的信息
    return data.steps[next_idx]
```

### 关键设计点

```python
为什么先保存再判断？

next_idx = current_index + 1
self._save_task_data(...)  # ← 先保存
if next_idx >= len(steps):  # ← 再判断
    return None

原因：
  1. 确保进度被记录
  2. 即使返回 None，current_index 也已经更新
  3. 下次调用 cur() 或 get_task_status() 能知道"已完成"
```

---

## 三、实际执行示例

### 示例：3个步骤的任务

```python
# ========== 初始化 ==========
steps = [
    {"name": "需求分析", "description": "...", "condition": "..."},
    {"name": "代码实现", "description": "...", "condition": "..."},
    {"name": "编写测试", "description": "...", "condition": "..."}
]
# len(steps) = 3

planner.set(task_id="task_123", steps=steps)

# 云端数据：
# {
#   "task_id": "task_123",
#   "steps": [步骤1, 步骤2, 步骤3],
#   "current_index": 0  ← 初始值
# }


# ========== 第1步 ==========
current = planner.cur(task_id="task_123")
# 逻辑：
#   data.current_index = 0
#   return data.steps[0]
# 返回：{"name": "需求分析", ...}

# Claude 执行需求分析...


# ========== 步骤1完成，调用 next() ==========
next_step = planner.next(task_id="task_123")

# next() 内部执行：
#   1. current_index = 0（从云端加载）
#   2. next_idx = 0 + 1 = 1
#   3. 保存 current_index = 1 到云端 ✅
#   4. 判断：1 >= 3? No
#   5. 返回 steps[1]

# 返回：{"name": "代码实现", ...}
# 云端 current_index = 1


# ========== 第2步 ==========
current = planner.cur(task_id="task_123")
# 逻辑：
#   data.current_index = 1（从云端加载）
#   return data.steps[1]
# 返回：{"name": "代码实现", ...}

# Claude 执行代码实现...


# ========== 步骤2完成，调用 next() ==========
next_step = planner.next(task_id="task_123")

# next() 内部执行：
#   1. current_index = 1
#   2. next_idx = 1 + 1 = 2
#   3. 保存 current_index = 2 到云端 ✅
#   4. 判断：2 >= 3? No
#   5. 返回 steps[2]

# 返回：{"name": "编写测试", ...}
# 云端 current_index = 2


# ========== 第3步 ==========
current = planner.cur(task_id="task_123")
# 逻辑：
#   data.current_index = 2
#   return data.steps[2]
# 返回：{"name": "编写测试", ...}

# Claude 执行编写测试...


# ========== 步骤3完成，尝试调用 next() ==========
next_step = planner.next(task_id="task_123")

# next() 内部执行：
#   1. current_index = 2
#   2. next_idx = 2 + 1 = 3
#   3. 保存 current_index = 3 到云端 ✅
#   4. 判断：3 >= 3? Yes ⭐️ 完成！
#   5. 返回 None

# 返回：None（没有下一步了）
# 云端 current_index = 3（表示已完成所有步骤）

if next_step is None:
    print("所有步骤已完成！")
    planner.clear(task_id="task_123")  # 清理数据
```

---

## 四、完成判断的三个位置

### 位置1：next() 方法

```python
# step_planner.py:150
def next(self, task_id):
    ...
    next_idx = data.current_index + 1
    self._save_task_data(task_id, data.steps, next_idx)
    
    if next_idx >= len(data.steps):
        return None  # ⭐️ 判断完成
    
    return data.steps[next_idx]
```

### 位置2：cur() 方法

```python
# step_planner.py:126
def cur(self, task_id):
    data = self._load_task_data(task_id)
    
    if data.current_index >= len(data.steps):
        return None  # ⭐️ 也有完成判断
    
    return data.steps[data.current_index]
```

### 位置3：get_task_status() 方法

```python
def get_task_status(self, task_id):
    data = self._load_task_data(task_id)
    
    return {
        "task_id": data.task_id,
        "total_steps": len(data.steps),
        "current_index": data.current_index,
        "completed": data.current_index >= len(data.steps),  # ⭐️ 完成标识
        "steps": data.steps,
        "current_step": ...
    }
```

---

## 五、谁来调用 next()？

### 答案：目前**没有自动调用**！

通过搜索代码发现：
```bash
$ grep -rn "planner.next\|\.next(" *.py

# 结果：只在 step_planner.py 自己内部有定义，
#       没有在其他模块找到调用！
```

**StepPlanner 在 claude_agent_sdk_wrapper.py 中的使用**：

```python
# claude_agent_sdk_wrapper.py:514
class ClaudeAgentSDKService:
    def __init__(self):
        self._global_planner = StepPlanner()  # 创建实例
        ...

# claude_agent_sdk_wrapper.py:2167
def interrupt_task(self, task_id):
    # 只在任务中断时清理
    self._global_planner.clear(task_id=task_id)
```

**目前的使用情况**：
- ✅ StepPlanner 已经被创建（实例化）
- ❌ 但没有看到 `set()`、`cur()`、`next()` 的调用
- ✅ 只有 `clear()` 在任务中断时被调用

---

## 六、推测的设计意图

### 可能的使用场景（未实现）

```python
# 可能在未来的代码中这样使用：

# 1. 任务初始化时设置步骤
def init_task(task_id, workflow_type):
    planner = get_planner()
    
    if workflow_type == "backend":
        steps = [
            {"name": "需求分析", ...},
            {"name": "数据库设计", ...},
            {"name": "API实现", ...},
            {"name": "测试", ...}
        ]
        planner.set(task_id, steps)

# 2. 每次 query 时获取当前步骤
def query(task_id, prompt):
    planner = get_planner()
    current_step = planner.cur(task_id)
    
    if current_step:
        # 在提示词中加入当前步骤
        full_prompt = f"""{prompt}

当前步骤：{current_step['name']}
描述：{current_step['description']}
完成条件：{current_step['condition']}

请专注于完成当前步骤。"""
    else:
        full_prompt = prompt
    
    result = await service.query(task_id, full_prompt)
    return result

# 3. Claude 完成步骤后调用 next()
def handle_step_completion(task_id):
    planner = get_planner()
    next_step = planner.next(task_id)
    
    if next_step:
        print(f"进入下一步：{next_step['name']}")
    else:
        print("所有步骤完成！")
```

### 为什么没有实现？

**可能的原因**：

1. **还在开发中**：StepPlanner 是预留的功能模块
2. **手动控制**：通过 MCP 或其他方式手动推进步骤
3. **简化流程**：当前版本选择更简单的方式（直接一次性执行）

---

## 七、如何手动测试 StepPlanner

你可以通过 Python 控制台测试：

```python
# 进入 code-agent 目录
cd /Users/dingshouqin/Documents/code-agent

# 启动 Python
python3

# 测试代码
from step_planner import get_planner

planner = get_planner()

# 设置步骤
steps = [
    {"name": "步骤1", "description": "第一步", "condition": "完成第一步"},
    {"name": "步骤2", "description": "第二步", "condition": "完成第二步"},
    {"name": "步骤3", "description": "第三步", "condition": "完成第三步"}
]
planner.set(task_id="test_123", steps=steps)

# 获取当前步骤
current = planner.cur(task_id="test_123")
print(f"当前步骤：{current}")

# 进入下一步
next_step = planner.next(task_id="test_123")
print(f"下一步：{next_step}")

# 再次进入下一步
next_step = planner.next(task_id="test_123")
print(f"下一步：{next_step}")

# 最后一步
next_step = planner.next(task_id="test_123")
print(f"下一步：{next_step}")  # 应该返回 None

# 查看状态
status = planner.get_task_status(task_id="test_123")
print(f"状态：{status}")

# 清理
planner.clear(task_id="test_123")
```

---

## 八、总结

### 核心机制

| 问题 | 答案 |
|------|------|
| **如何记录步骤？** | 通过 `current_index`（数组索引） |
| **如何区分步骤？** | steps[0]、steps[1]、steps[2]... |
| **如何判断完成？** | `current_index >= len(steps)` |
| **谁提供序号？** | StepPlanner 自己维护，不是 Claude |
| **谁调用 next()？** | 目前没有自动调用，可能是预留功能 |

### 关键代码位置

```python
# 步骤推进
next_idx = current_index + 1  # step_planner.py:145
self._save_task_data(...)      # step_planner.py:148

# 完成判断
if next_idx >= len(steps):    # step_planner.py:150
    return None

# 当前步骤
return steps[current_index]    # step_planner.py:129
```

### 设计亮点

1. ⭐️ **索引机制简单清晰**：0, 1, 2, 3...
2. ⭐️ **云端持久化**：服务重启不丢失进度
3. ⭐️ **多处完成判断**：cur()、next()、get_task_status() 都有
4. ⭐️ **预留扩展**：模块已完成，等待集成使用

### 当前状态

```
StepPlanner 模块：
  ✅ 代码完整
  ✅ 单元功能正常
  ❌ 暂未集成到主流程
  ❓ 可能是预留功能或正在开发中
```

---

**学习要点**：
- ✅ 理解了 current_index 的作用
- ✅ 理解了步骤推进机制
- ✅ 理解了完成判断逻辑
- ✅ 知道了当前的使用状态

**下一步**：可以看看实际在用的任务状态管理模块（如 task_status_checker.py）
