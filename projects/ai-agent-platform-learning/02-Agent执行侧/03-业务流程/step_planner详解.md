# step_planner.py 详解

> 本文档详细解析 `step_planner.py` 的实现，这是管理任务执行步骤、避免上下文漂移的核心模块。
> 
> **文件位置**：[step_planner.py](../../code-agent/step_planner.py)  
> **文件大小**：218 行  
> **核心功能**：跟踪任务步骤、保持执行顺序、云端持久化

> **当前接入状态（2026-07-15）**：`StepPlanner` 类仍存在，但主查询链路没有自动调用 `cur()` / `next()`；`step-planner` MCP 服务在 SDK 配置中被注释，MCP 的 `cur`、`next`、`clear` 工具也没有对外暴露。因此本文后半部分的“与 CommandsContainer 配合”属于设计示例，不是当前生产调用链。

---

## 一、模块概览

### 1.1 模块定位

```
StepPlanner = 任务步骤管理器

作用：
  - 记录任务的所有执行步骤
  - 跟踪当前执行到哪一步
  - 提供步骤切换功能（cur、next）
  - 通过 `agentTaskData` 管理平台接口持久化

解决的问题：
  ❌ 避免 Claude 忘记任务步骤（上下文漂移）
  ❌ 避免跳过某些步骤
  ❌ 避免重复执行某些步骤
```

### 1.2 什么是上下文漂移？

```
场景：实现一个完整的用户登录功能

计划步骤：
  1. 设计数据库表
  2. 实现登录 API
  3. 实现前端页面
  4. 编写单元测试
  5. 编写集成测试

没有 StepPlanner（容易漂移）：
  Claude 执行到第 3 步
    ↓
  上下文太长，Claude 忘记了第 4、5 步
    ↓
  任务提前结束 ❌

有了 StepPlanner（保持跟踪）：
  Claude 完成第 3 步
    ↓
  StepPlanner.next() → 返回第 4 步
    ↓
  Claude 继续执行第 4 步 ✅
```

---

## 二、核心数据结构

### 2.1 Step（步骤）

```python
class Step(TypedDict):
    """单个步骤的类型定义"""
    name: str          # 步骤名称
    description: str   # 步骤描述
    condition: str     # 完成条件
```

**示例**：

```python
step = {
    "name": "实现登录API",
    "description": "创建 /api/auth/login 端点，支持用户名密码登录",
    "condition": "API 能够正确验证用户凭证并返回 JWT token"
}
```

### 2.2 StepPlannerData（步骤规划数据）

```python
@dataclass
class StepPlannerData:
    """步骤规划器数据模型"""
    task_id: str           # 任务ID
    steps: List[Step]      # 步骤列表
    current_index: int     # 当前步骤索引（从 0 开始）
```

**示例**：

```python
data = StepPlannerData(
    task_id="task_123",
    steps=[
        {"name": "设计数据库", "description": "...", "condition": "..."},
        {"name": "实现API", "description": "...", "condition": "..."},
        {"name": "编写测试", "description": "...", "condition": "..."}
    ],
    current_index=1  # 当前在第 2 步（实现API）
)
```

---

## 三、核心方法详解

### 3.1 set() - 设置任务步骤

**作用**：初始化任务的所有步骤

**代码位置**：[step_planner.py:93-111](../../code-agent/step_planner.py#L93-L111)

```python
def set(self, task_id: str, steps: List[Step]) -> None:
    """设置任务的所有步骤"""
    
    # 1. 校验步骤列表不为空
    if not steps:
        raise ValueError("步骤列表不能为空")
    
    # 2. 验证每个步骤的结构
    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            raise ValueError(f"第{i+1}个步骤必须是字典类型")
        
        # 检查必需字段
        if "name" not in step or "description" not in step or "condition" not in step:
            raise ValueError(f"第{i+1}个步骤缺少必需字段（name, description, condition）")
    
    # 3. 保存到云端（初始 current_index = 0）
    self._save_task_data(task_id, steps, 0)
```

**使用示例**：

```python
planner = get_planner()

steps = [
    {
        "name": "需求分析",
        "description": "分析用户登录功能的需求",
        "condition": "输出需求分析文档"
    },
    {
        "name": "技术设计",
        "description": "设计登录功能的技术方案",
        "condition": "输出技术设计文档"
    },
    {
        "name": "代码实现",
        "description": "实现登录API和前端页面",
        "condition": "代码通过编译"
    },
    {
        "name": "测试验证",
        "description": "编写并运行测试用例",
        "condition": "所有测试通过"
    }
]

planner.set(task_id="task_123", steps=steps)
```

---

### 3.2 cur() - 获取当前步骤

**作用**：获取当前正在执行的步骤

**代码位置**：[step_planner.py:113-129](../../code-agent/step_planner.py#L113-L129)

```python
def cur(self, task_id: str) -> Optional[Step]:
    """获取当前步骤"""
    
    # 1. 从云端加载数据
    data = self._load_task_data(task_id)
    if data is None:
        return None  # 任务不存在
    
    # 2. 检查是否已完成所有步骤
    if data.current_index >= len(data.steps):
        return None  # 已完成
    
    # 3. 返回当前步骤
    return data.steps[data.current_index]
```

**使用示例**：

```python
planner = get_planner()

# 获取当前步骤
current_step = planner.cur(task_id="task_123")

if current_step:
    print(f"当前步骤：{current_step['name']}")
    print(f"描述：{current_step['description']}")
    print(f"完成条件：{current_step['condition']}")
else:
    print("任务已完成或不存在")
```

---

### 3.3 next() - 进入下一步

**作用**：标记当前步骤完成，进入下一步

**代码位置**：[step_planner.py:132-153](../../code-agent/step_planner.py#L132-L153)

```python
def next(self, task_id: str) -> Optional[Step]:
    """进入下一个步骤并返回下一步的详细信息"""
    
    # 1. 从云端加载数据
    data = self._load_task_data(task_id)
    if data is None:
        return None
    
    # 2. 计算下一个索引
    next_idx = data.current_index + 1
    
    # 3. 保存新的索引到云端
    self._save_task_data(task_id, data.steps, next_idx)
    
    # 4. 检查是否还有下一步
    if next_idx >= len(data.steps):
        return None  # 已经是最后一步
    
    # 5. 返回下一步的信息
    return data.steps[next_idx]
```

**使用示例**：

```python
planner = get_planner()

# 当前步骤完成，进入下一步
next_step = planner.next(task_id="task_123")

if next_step:
    print(f"进入下一步：{next_step['name']}")
    # Claude 开始执行下一步
else:
    print("所有步骤已完成！")
```

---

### 3.4 clear() - 清除任务数据

**作用**：删除任务的所有步骤数据

**代码位置**：[step_planner.py:155-175](../../code-agent/step_planner.py#L155-L175)

```python
def clear(self, task_id: str) -> bool:
    """删除任务的所有计划数据"""
    
    try:
        from task_data_api import delete, TaskDataType
        
        # 从云端删除
        delete(
            task_id=task_id,
            data_type=TaskDataType.STEP_PLANNER
        )
        
        print(f"[StepPlanner] Successfully deleted cloud data for task {task_id}")
        return True
        
    except Exception as e:
        print(f"[StepPlanner] 删除任务 {task_id} 的云端数据失败: {e}")
        return False
```

**使用场景**：

```python
# 场景1：任务完成，清理数据
if all_steps_completed:
    planner.clear(task_id="task_123")

# 场景2：任务被中断，清理数据
if task_interrupted:
    planner.clear(task_id="task_123")
```

---

### 3.5 get_task_status() - 获取任务状态

**作用**：读取任务的步骤列表。当前实现的返回值比 docstring 中描述的“完整状态”更少，使用时要以实际代码为准。

**代码位置**：[step_planner.py:177-209](../../code-agent/step_planner.py#L177-L209)

```python
def get_task_status(self, task_id: str) -> Optional[Dict]:
    """获取任务的完整状态信息"""
    
    # 1. 从云端加载数据
    data = self._load_task_data(task_id)
    if data is None:
        return None
    
    # 当前代码只返回以下三个字段
    return {
        "task_id": data.task_id,
        "total_steps": len(data.steps),
        "steps": data.steps
    }
```

**当前返回数据示例**：

```json
{
  "task_id": "task_123",
  "total_steps": 4,
  "steps": [
    {"name": "需求分析", "description": "...", "condition": "..."},
    {"name": "技术设计", "description": "...", "condition": "..."},
    {"name": "代码实现", "description": "...", "condition": "..."},
    {"name": "测试验证", "description": "...", "condition": "..."}
  ]
}
```

> 代码的 docstring 和 MCP 工具描述仍宣称会返回 `current_index`、`completed`、`current_step`，但当前函数没有返回这些字段。这属于待修复的代码契约问题，文档不再把预期结构当作实际结果。

---

## 四、云端持久化机制

### 4.1 为什么需要云端持久化？

```
场景：任务执行到第 3 步，服务重启

本地存储：
  ✅ 数据丢失
  ❌ 重启后不知道执行到第几步
  ❌ 需要重新开始

云端存储：
  ✅ 数据持久化
  ✅ 重启后继续第 3 步
  ✅ 多机共享
```

### 4.2 _save_task_data() - 保存到云端

**代码位置**：[step_planner.py:67-91](../../code-agent/step_planner.py#L67-L91)

```python
def _save_task_data(self, task_id: str, steps: List[Step], current_index: int) -> bool:
    """保存任务数据到云端"""
    
    # 1. 创建数据对象
    data = StepPlannerData(
        task_id=task_id,
        steps=steps,
        current_index=current_index
    )
    
    try:
        from task_data_api import save_or_update, TaskDataType
        
        # 2. 转换为字典保存
        save_or_update(
            task_id=task_id,
            data_type=TaskDataType.STEP_PLANNER,
            data=data.to_dict()
        )
        
        print(f"[StepPlanner] Saved data for task {task_id} to cloud")
        return True
        
    except Exception as e:
        print(f"[StepPlanner] 保存任务 {task_id} 到云端失败: {e}")
        return False
```

**存储位置**：

```
COS 云存储
  /code-agent/daily/
    ├── task_123/
    │   ├── step_planner.json  ← StepPlanner 数据
    │   ├── task_metadata.json
    │   └── session_mapping.json
    └── ...
```

### 4.3 _load_task_data() - 从云端加载

**代码位置**：[step_planner.py:44-65](../../code-agent/step_planner.py#L44-L65)

```python
def _load_task_data(self, task_id: str) -> Optional[StepPlannerData]:
    """从云端加载任务数据"""
    
    try:
        from task_data_api import get_data_content, TaskDataType
        
        # 从云端读取
        data_dict = get_data_content(
            task_id=task_id,
            data_type=TaskDataType.STEP_PLANNER
        )
        
        if data_dict is None:
            return None  # 任务不存在
        
        # 转换为数据对象
        return StepPlannerData.from_dict(data_dict)
        
    except Exception as e:
        print(f"[StepPlanner] 加载任务 {task_id} 失败: {e}")
        return None
```

---

## 五、完整的使用流程

### 场景：实现用户登录功能

```python
# ========== 1. 任务初始化：设置步骤 ==========
planner = get_planner()

steps = [
    {
        "name": "需求分析",
        "description": "分析用户登录功能的需求，包括登录方式、安全要求等",
        "condition": "输出需求分析文档"
    },
    {
        "name": "数据库设计",
        "description": "设计用户表结构，包括字段、索引、约束",
        "condition": "创建数据库迁移脚本"
    },
    {
        "name": "实现登录API",
        "description": "实现 /api/auth/login 端点，支持用户名密码登录",
        "condition": "API 能够正确验证用户凭证并返回 JWT token"
    },
    {
        "name": "实现前端页面",
        "description": "实现登录页面UI，包括表单验证和错误提示",
        "condition": "前端页面能够正常提交登录请求"
    },
    {
        "name": "编写测试",
        "description": "编写单元测试和集成测试",
        "condition": "所有测试通过"
    }
]

planner.set(task_id="task_123", steps=steps)
# → 保存到云端，current_index = 0


# ========== 2. 开始执行：获取当前步骤 ==========
current = planner.cur(task_id="task_123")
print(f"当前步骤：{current['name']}")  # "需求分析"

# Claude 执行需求分析...
# → 输出需求分析文档


# ========== 3. 进入下一步 ==========
next_step = planner.next(task_id="task_123")
print(f"下一步：{next_step['name']}")  # "数据库设计"
# → current_index = 1，保存到云端

# Claude 执行数据库设计...
# → 创建数据库迁移脚本


# ========== 4. 继续下一步 ==========
next_step = planner.next(task_id="task_123")
print(f"下一步：{next_step['name']}")  # "实现登录API"
# → current_index = 2

# Claude 实现登录API...


# ========== 5. 继续... ==========
planner.next(task_id="task_123")  # → "实现前端页面"
planner.next(task_id="task_123")  # → "编写测试"


# ========== 6. 所有步骤完成 ==========
next_step = planner.next(task_id="task_123")
if next_step is None:
    print("所有步骤已完成！")
    
    # 清理数据
    planner.clear(task_id="task_123")
```

---

## 六、与其他模块的关系与设计意图

### 6.1 在整体流程中的位置

```
main.py
  ↓
TaskQueryResource.post()
  ├─ 获取用户输入："/openspec:proposal"
  │
  ├─ CommandsContainer 处理
  │   └─ 返回完整提示词
  │
  ├─ StepPlanner 管理步骤 ⭐️
  │   ├─ 初始化步骤：set()
  │   ├─ 获取当前步骤：cur()
  │   └─ 进入下一步：next()
  │
  └─ claude_agent_sdk_wrapper
      └─ service.query(task_id, prompt + 当前步骤)
          └─ Claude 执行当前步骤
```

### 6.2 与 commands_container 的配合（设计示例，当前未自动接入）

```python
# 1. CommandsContainer 获取工作流提示词
is_cmd, base_prompt, cmd_type = await process_custom_command(...)
# base_prompt = "你是架构师...请分析需求..."

# 2. StepPlanner 获取当前步骤
planner = get_planner()
current_step = planner.cur(task_id)

# 3. 组合提示词
if current_step:
    full_prompt = f"""{base_prompt}

当前步骤：{current_step['name']}
步骤描述：{current_step['description']}
完成条件：{current_step['condition']}

请专注于完成当前步骤。"""
else:
    full_prompt = base_prompt

# 4. 调用 Claude
result = await service.query(task_id, full_prompt)

# 5. Claude 完成当前步骤后，进入下一步
if step_completed:
    next_step = planner.next(task_id)
```

---

## 七、关键设计亮点

### 1️⃣ 云端持久化

```python
优势：
  ✅ 数据不丢失（服务重启后继续）
  ✅ 多机共享（任务可以在不同机器执行）
  ✅ 可追溯（查看任务执行到哪一步）

实现：
  - 使用 task_data_api
  - 写入 AI24 管理平台的 agentTaskData 接口
  - 每次操作都同步到管理平台数据服务
```

### 2️⃣ 单例模式

```python
# 全局单例
_global_planner = StepPlanner()

def get_planner() -> StepPlanner:
    """获取全局StepPlanner实例"""
    return _global_planner

优势：
  ✅ 全局共享
  ✅ 避免重复创建
  ✅ 符合其他模块设计
```

### 3️⃣ 简洁的 API

```python
planner = get_planner()

# 设置步骤
planner.set(task_id, steps)

# 获取当前步骤
current = planner.cur(task_id)

# 进入下一步
next_step = planner.next(task_id)

# 清除数据
planner.clear(task_id)

# 只有 4 个核心方法，简单易用
```

### 4️⃣ 数据校验

```python
def set(self, task_id, steps):
    # 校验步骤列表不为空
    if not steps:
        raise ValueError("步骤列表不能为空")
    
    # 验证每个步骤的结构
    for step in steps:
        if "name" not in step:
            raise ValueError("缺少 name 字段")
        if "description" not in step:
            raise ValueError("缺少 description 字段")
        if "condition" not in step:
            raise ValueError("缺少 condition 字段")

优势：
  ✅ 防止脏数据
  ✅ 提前发现问题
  ✅ 错误信息清晰
```

---

## 八、使用场景

### 场景1：复杂任务分解

```python
# 任务：实现完整的电商订单系统

steps = [
    {"name": "需求分析", "description": "...", "condition": "..."},
    {"name": "数据库设计", "description": "...", "condition": "..."},
    {"name": "订单创建API", "description": "...", "condition": "..."},
    {"name": "订单查询API", "description": "...", "condition": "..."},
    {"name": "订单支付API", "description": "...", "condition": "..."},
    {"name": "前端页面", "description": "...", "condition": "..."},
    {"name": "单元测试", "description": "...", "condition": "..."},
    {"name": "集成测试", "description": "...", "condition": "..."}
]

planner.set(task_id, steps)
# → 将大任务分解成 8 个小步骤
# → 逐步执行，避免遗漏
```

### 场景2：任务恢复

```python
# 场景：任务执行到第 5 步，服务重启

# 重启前：current_index = 4（第5步）
# 数据已保存到云端 ✅

# 重启后：
planner = get_planner()
current = planner.cur(task_id)
# → 从云端加载
# → current_index = 4
# → 返回第 5 步的信息
# → 继续执行 ✅
```

### 场景3：进度追踪

```python
# 查看任务进度
status = planner.get_task_status(task_id)
current = planner.cur(task_id)

print(f"步骤总数：{status['total_steps']}")
print(f"当前步骤：{current['name'] if current else '无'}")
```

---

## 九、小结

| 维度 | 内容 |
|------|------|
| **核心职责** | 管理任务步骤、跟踪执行进度 |
| **主要方法** | set()、cur()、next()、clear()、get_task_status() |
| **存储方式** | 通过 `agentTaskData` 管理平台接口持久化 |
| **设计模式** | 单例模式 |
| **解决问题** | 避免上下文漂移、步骤遗漏 |
| **文件大小** | 218 行（简洁高效） |

**关键设计亮点**：
1. ⭐️ **云端持久化**：数据不丢失，多机共享
2. ⭐️ **简洁 API**：只有 4 个核心方法
3. ⭐️ **数据校验**：防止脏数据
4. ⭐️ **单例模式**：全局共享

**设计价值**：
- 可用于保持任务执行顺序
- 可降低 Claude 遗漏步骤的风险
- 状态持久化后可支持任务恢复
- 当前需重新启用 MCP 或在主流程显式调用后，才能形成完整的自动推进闭环

**关联阅读**：
- 命令处理 → [commands_container.py](../../code-agent/commands_container.py)
- 任务执行 → [claude_agent_sdk_wrapper.py](../../code-agent/claude_agent_sdk_wrapper.py)
- 云端存储 → [task_data_api.py](../../code-agent/task_data_api.py)
