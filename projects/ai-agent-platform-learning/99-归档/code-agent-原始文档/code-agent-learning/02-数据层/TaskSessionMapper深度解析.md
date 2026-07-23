# TaskSessionMapper 深度解析

> 管理 task_id 和 session_id 双向映射的核心模块，实现多轮对话的关键。

---

## 🎯 核心理解：用户视角 vs 系统内部

### 用户只需要知道 task_id

```
用户在 AI24 平台上的工作流：
1. 创建任务 → 获得 task_id（如：task_123）
2. 查看任务进度 → 使用 task_id
3. 继续对话 → 使用 task_id
4. 查看结果 → 使用 task_id

用户永远不需要知道 session_id 是什么！
```

### TaskSessionMapper 的真正作用

**session_id 是 Claude SDK 的内部需求**：
- Claude SDK 需要 session_id 来维护对话历史
- 用户的 task_id 需要映射到 Claude 的 session_id
- Claude 的回调（只有 session_id）需要映射回 task_id

**形象比喻**：
- task_id = 房间号（用户知道的）
- session_id = 钥匙编号（酒店内部管理的）
- TaskSessionMapper = 前台登记表（记录映射关系）

用户说"我要进123号房"，前台通过登记表找到对应的钥匙。用户不需要知道钥匙编号。

---

## 一、核心职责

TaskSessionMapper 是会话映射的**唯一管理者**，负责：

1. ✅ **维护 task_id ↔ session_id 的双向映射**
2. ✅ **支持多轮对话**（同一任务复用会话）
3. ✅ **云端持久化**（多机共享）
4. ✅ **内存缓存优化**（减少云端查询）
5. ✅ **线程安全**（使用类级别锁）

---

## 二、为什么需要会话映射？

### 2.1 问题场景

```
用户第一次查询：
  POST /task/query
  {
    "task_id": "task_123",
    "input": "请帮我实现用户登录功能"
  }
  
  → Claude 创建新会话: session_id = "sess_abc123"
  → 执行任务，生成代码

用户第二次查询（多轮对话）：
  POST /task/query
  {
    "task_id": "task_123",  ← 同一个任务
    "input": "请添加记住密码功能"  ← 续接之前的对话
  }
  
  问题：如何找到之前的会话？
  答案：通过 TaskSessionMapper 查找！
```

### 2.2 没有映射的后果

```
❌ 没有映射：
  - 每次查询都创建新会话
  - Claude 不记得之前的对话
  - 用户需要重复说明背景
  - 无法实现增量开发

✅ 有映射：
  - 复用之前的会话
  - Claude 记得所有历史对话
  - 自然的多轮交互
  - 支持增量开发和迭代
```

---

## 三、双向映射设计

### 3.1 为什么需要双向映射？

```
场景1：用户发起查询（有 task_id）
  → 需要查找：task_id → session_id
  → 用于复用会话

场景2：Claude SDK 回调（有 session_id）
  → 需要查找：session_id → task_id
  → 用于关联任务信息
```

### 3.2 双向映射的数据结构

```
云端存储（两个表）：

┌─────────────────────────────────────┐
│  agentTaskData 表                   │
│  (以 task_id 为索引)                │
├─────────────────────────────────────┤
│  taskId: "task_123"                 │
│  type: "session_mapping"            │
│  data: "sess_abc123"                │
└─────────────────────────────────────┘
           ↕ 双向映射
┌─────────────────────────────────────┐
│  agentClaudeData 表                 │
│  (以 session_id 为索引)             │
├─────────────────────────────────────┤
│  sessionId: "sess_abc123"           │
│  type: "session_config"             │
│  data: "task_123"                   │
└─────────────────────────────────────┘

内存缓存（单向）：
_session_to_task_cache = {
    "sess_abc123": "task_123",
    "sess_def456": "task_456",
    ...
}
```

### 3.3 为什么只缓存一个方向？

```python
# ✅ 有缓存：session_id -> task_id
_session_to_task_cache: Dict[str, str] = {}

# ❌ 没有缓存：task_id -> session_id
# （为什么？）
```

**原因分析**：

1. **查询频率不同**：
   - `session_id → task_id`：每次 Claude 回调都要查（高频）
   - `task_id → session_id`：只在用户查询时查（低频）

2. **数据稳定性**：
   - `session_id → task_id`：映射一旦建立就不变（稳定）
   - `task_id → session_id`：可能被重置（不稳定）

3. **缓存一致性**：
   - 只缓存稳定的映射，避免缓存失效问题

---

## 四、核心实现详解

### 4.1 类设计：静态工具类

```python
class TaskSessionMapper:
    """
    Task Session 映射管理器（静态工具类）
    
    所有方法都是类方法，无需实例化
    """
    
    # 类级别的锁，保护线程安全
    _lock = threading.Lock()
    
    # 内存缓存：session_id -> task_id（永久保留）
    _session_to_task_cache: Dict[str, str] = {}
    
    def __init__(self):
        """禁止实例化，这是一个工具类"""
        raise RuntimeError("TaskSessionMapper 是工具类，不应该被实例化")
```

**设计要点**：
- ✅ 静态工具类，不需要实例化
- ✅ 类级别的锁和缓存，所有线程共享
- ✅ 禁止实例化，避免误用

### 4.2 核心方法1：get_session_id()

```python
@classmethod
def get_session_id(cls, task_id: str) -> Optional[str]:
    """
    根据 task_id 获取 session_id（从云端读取，无缓存）
    
    使用场景：用户发起查询时，查找是否有已存在的会话
    """
    with cls._lock:
        try:
            # 直接从云端读取（无缓存）
            session_id = task_data_api.get_data_content(
                task_id, 
                TaskDataType.SESSION_MAPPING
            )
            
            if session_id:
                logger.info(f"从云端找到映射: task_id={task_id} -> session_id={session_id}")
            else:
                logger.info(f"未找到映射: task_id={task_id}")
            
            return session_id
            
        except Exception as e:
            logger.error(f"读取 session_id 失败 (task_id={task_id}): {e}", exc_info=True)
            return None
```

**流程图**：
```
用户查询
    ↓
get_session_id(task_id)
    ↓
查询云端 agentTaskData 表
    ↓
┌─────────────┬─────────────┐
│ 找到了      │ 没找到      │
├─────────────┼─────────────┤
│ 返回session_id │ 返回None   │
│ 复用会话    │ 创建新会话  │
└─────────────┴─────────────┘
```

### 4.3 核心方法2：get_task_id()

```python
@classmethod
def get_task_id(cls, session_id: str) -> Optional[str]:
    """
    根据 session_id 获取 task_id（优先从缓存读取）
    
    使用场景：Claude SDK 回调时，通过 session_id 找到对应的 task_id
    """
    with cls._lock:
        try:
            # 1. 先检查缓存（快速路径）
            if session_id in cls._session_to_task_cache:
                task_id = cls._session_to_task_cache[session_id]
                logger.info(f"从缓存找到映射: session_id={session_id} -> task_id={task_id}")
                return task_id
            
            # 2. 缓存未命中，从云端读取（慢速路径）
            task_id = claude_data_api.get_data_content(
                session_id, 
                ClaudeDataType.SESSION_CONFIG
            )
            
            if task_id:
                # 更新缓存，下次直接命中
                cls._session_to_task_cache[session_id] = task_id
                logger.info(f"从云端找到映射并缓存: session_id={session_id} -> task_id={task_id}")
            else:
                logger.info(f"未找到映射: session_id={session_id}")
            
            return task_id
            
        except Exception as e:
            logger.error(f"读取 task_id 失败 (session_id={session_id}): {e}", exc_info=True)
            return None
```

**性能优化**：
```
第一次查询：
  缓存未命中 → 查云端 → 更新缓存 → 返回
  耗时：~100ms

第二次查询（同一 session_id）：
  缓存命中 → 直接返回
  耗时：<1ms

性能提升：100倍+
```

### 4.4 核心方法3：set_mapping()

```python
@classmethod
def set_mapping(cls, task_id: str, session_id: str) -> bool:
    """
    设置 task_id 和 session_id 的双向映射关系
    
    操作：
    1. 更新内存缓存
    2. 双写到云端（两个表）
    """
    with cls._lock:
        try:
            # 1. 更新内存缓存
            cls._session_to_task_cache[session_id] = task_id
            
            # 2. 双写到云端 API
            
            # 写入 agentClaudeData 表（以 session_id 为索引）
            try:
                claude_data_api.save_or_update(
                    session_id=session_id,
                    data_type=ClaudeDataType.SESSION_CONFIG,
                    data=task_id
                )
                logger.info(f"保存映射关系到云端成功（以session_id为索引）")
            except Exception as e:
                logger.warning(f"保存映射关系到云端失败（以session_id为索引）: {e}")
            
            # 写入 agentTaskData 表（以 task_id 为索引）
            try:
                task_data_api.save_or_update(
                    task_id=task_id,
                    data_type=TaskDataType.SESSION_MAPPING,
                    data=session_id
                )
                logger.info(f"保存映射关系到云端成功（以task_id为索引）")
            except Exception as e:
                logger.warning(f"保存映射关系到云端失败（以task_id为索引）: {e}")
            
            logger.info(f"建立映射关系: task_id={task_id} <-> session_id={session_id}")
            return True
            
        except Exception as e:
            logger.error(f"保存映射关系失败: {e}", exc_info=True)
            return False
```

**双写机制**：
```
set_mapping(task_id, session_id)
    ↓
┌─────────────────────────────────────┐
│ 1. 更新内存缓存                      │
│    _session_to_task_cache[session_id] = task_id │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. 写入 agentClaudeData 表           │
│    索引：session_id                  │
│    数据：task_id                     │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. 写入 agentTaskData 表             │
│    索引：task_id                     │
│    数据：session_id                  │
└─────────────────────────────────────┘
```

**容错设计**：
- ✅ 两次云端写入相互独立
- ✅ 一个失败不影响另一个
- ✅ 只记录警告，不抛出异常

### 4.5 核心方法4：remove_task_to_session_only()

```python
@classmethod
def remove_task_to_session_only(cls, task_id: str) -> bool:
    """
    只删除 task_id -> session_id 的映射，保留 session_id -> task_id 的映射
    
    使用场景：环境重新初始化时
    - 需要清除 task_id 到 session_id 的映射（任务重置）
    - 但保留 session_id 到 task_id 的映射（Claude SDK 仍需要）
    
    注意：缓存不变，只更新云端
    """
    with cls._lock:
        try:
            # 先从云端读取 session_id（用于日志记录）
            session_id = task_data_api.get_data_content(
                task_id, 
                TaskDataType.SESSION_MAPPING
            )
            if not session_id:
                logger.warning(f"未找到 task_id={task_id} 的映射关系")
                return False
            
            logger.info(f"删除单向映射: task_id={task_id} -> session_id={session_id}（保留反向映射和缓存）")
            
            # 只删除云端以 task_id 为索引的数据
            # 注意：保留 claude_data_api 中以 session_id 为索引的数据
            try:
                task_data_api.delete(
                    task_id=task_id,
                    data_type=TaskDataType.SESSION_MAPPING
                )
                logger.info(f"删除单向映射到云端成功（以task_id为索引）")
            except Exception as e:
                logger.warning(f"删除单向映射到云端失败: {e}")
            
            return True
            
        except Exception as e:
            logger.error(f"删除单向映射关系失败: {e}", exc_info=True)
            return False
```

**单向删除场景**：
```
场景：环境重新初始化（git reset --hard）

问题：
  - 用户想重新开始任务（清除历史）
  - 但 Claude SDK 还在使用旧 session_id

解决方案：
  - 删除：task_id → session_id（用户下次查询创建新会话）
  - 保留：session_id → task_id（Claude SDK 回调仍能找到任务）
  - 保留：内存缓存（避免缓存失效）

结果：
  ✅ 用户查询时创建新会话
  ✅ 旧会话的回调仍然有效
  ✅ 不影响正在进行的操作
```

---

## 五、完整使用流程

### 5.1 首次查询流程

```
用户第一次查询：
POST /task/query {"task_id": "task_123", "input": "实现登录功能"}
    ↓
main.py: TaskQueryResource.post()
    ↓
1. TaskSessionMapper.get_session_id("task_123")
   → 查云端 agentTaskData 表
   → 返回 None（首次查询，映射不存在）
    ↓
2. ClaudeAgentSDKService.query()
   - 创建新会话：session_id = "sess_abc123"
   - 执行任务
    ↓
3. TaskSessionMapper.set_mapping("task_123", "sess_abc123")
   - 更新缓存：_session_to_task_cache["sess_abc123"] = "task_123"
   - 写云端 agentClaudeData：sessionId="sess_abc123", data="task_123"
   - 写云端 agentTaskData：taskId="task_123", data="sess_abc123"
    ↓
4. 返回结果给用户
```

### 5.2 第二次查询流程（多轮对话）

```
用户第二次查询（同一任务）：
POST /task/query {"task_id": "task_123", "input": "添加记住密码功能"}
    ↓
main.py: TaskQueryResource.post()
    ↓
1. TaskSessionMapper.get_session_id("task_123")
   → 查云端 agentTaskData 表
   → 返回 "sess_abc123"（找到了！）
    ↓
2. ClaudeAgentSDKService.query(session_id="sess_abc123")
   - 复用已有会话（包含所有历史对话）
   - Claude 记得之前实现的登录功能
   - 在此基础上添加记住密码功能
    ↓
3. 返回结果给用户（增量开发）
```

### 5.3 跨机器查询流程

```
机器A (10.0.1.100) - 首次查询：
    ↓
1. TaskSessionMapper.set_mapping("task_123", "sess_abc123")
   → 保存到云端
    ↓
映射写入 AI24 管理平台数据服务

机器B (10.0.1.200) - 第二次查询：
    ↓
1. TaskSessionMapper.get_session_id("task_123")
   → 从云端读取
   → 返回 "sess_abc123"
    ↓
2. 复用会话（多轮对话跨机器工作！）
```

---

## 六、关键设计要点

### 6.1 为什么是静态工具类？

```python
# ❌ 不好的设计：需要实例化
mapper = TaskSessionMapper()
mapper.get_session_id(task_id)

# ✅ 好的设计：直接使用类方法
TaskSessionMapper.get_session_id(task_id)
```

**优点**：
- ✅ 全局唯一，避免多实例导致的缓存不一致
- ✅ 使用简单，不需要传递实例
- ✅ 类级别的锁和缓存，所有线程共享

### 6.2 缓存策略对比

| 方向 | 是否缓存 | 原因 |
|-----|---------|------|
| session_id → task_id | ✅ 缓存 | 高频查询，数据稳定 |
| task_id → session_id | ❌ 不缓存 | 低频查询，可能被重置 |

### 6.3 双写的必要性

**问题**：为什么不只存一份？

**答案**：不同查询场景需要不同的索引

```
场景1：用户查询（有 task_id）
  → 需要索引：task_id
  → 查询表：agentTaskData
  → SQL: SELECT * FROM agentTaskData WHERE taskId=? AND type='session_mapping'

场景2：Claude 回调（有 session_id）
  → 需要索引：session_id
  → 查询表：agentClaudeData
  → SQL: SELECT * FROM agentClaudeData WHERE sessionId=? AND type='session_config'

如果只存一份：
  - 存在 agentTaskData：场景1快，场景2慢（需要全表扫描）
  - 存在 agentClaudeData：场景2快，场景1慢（需要全表扫描）

双写解决方案：
  - 两个表都存
  - 两种查询都快（索引查询）
  - 代价：多一次写入（可接受）
```

### 6.4 线程安全设计

```python
_lock = threading.Lock()  # 类级别锁

@classmethod
def get_session_id(cls, task_id: str):
    with cls._lock:  # 所有方法都加锁
        # ...

@classmethod
def set_mapping(cls, task_id: str, session_id: str):
    with cls._lock:  # 保护文件和缓存的读写
        # ...
```

**为什么需要锁**：
- 多个线程同时调用 `set_mapping()`
- 可能导致缓存和云端数据不一致
- 锁保证原子性操作

---

## 七、使用示例

### 7.1 首次查询时建立映射

```python
from task_session_mapper import TaskSessionMapper

# 1. 查询是否已有映射
session_id = TaskSessionMapper.get_session_id("task_123")

if session_id is None:
    # 2. 没有映射，创建新会话
    session_id = claude_sdk.create_session()
    
    # 3. 建立映射关系
    TaskSessionMapper.set_mapping("task_123", session_id)
    print(f"创建新会话: {session_id}")
else:
    # 4. 有映射，复用会话
    print(f"复用会话: {session_id}")

# 5. 使用 session_id 执行任务
result = claude_sdk.query(session_id, user_input)
```

### 7.2 Claude SDK 回调时查找任务

```python
# Claude SDK 回调场景
def on_claude_callback(session_id: str, event: dict):
    # 根据 session_id 查找对应的 task_id
    task_id = TaskSessionMapper.get_task_id(session_id)
    
    if task_id is None:
        logger.error(f"未找到 session_id={session_id} 对应的 task_id")
        return
    
    # 处理事件
    process_event(task_id, event)
```

### 7.3 环境重置时删除映射

```python
# 环境重新初始化
def reset_task_environment(task_id: str):
    # 只删除 task_id -> session_id 的映射
    # 保留 session_id -> task_id 的映射（让旧会话的回调仍能工作）
    TaskSessionMapper.remove_task_to_session_only(task_id)
    
    print(f"任务 {task_id} 的映射已清除，下次查询将创建新会话")
```

---

## 八、与其他模块的关系

```
TaskSessionMapper（会话映射）
    ↓ 依赖
┌─────────────────┬─────────────────┐
│ task_data_api   │ claude_data_api │
│ (任务数据API)   │ (会话数据API)   │
└─────────────────┴─────────────────┘
    ↓ 依赖
AI24 管理平台结构化数据服务

其他模块依赖 TaskSessionMapper：
    - main.py（查询时复用会话）
    - claude_agent_sdk_wrapper.py（回调时查找任务）
```

---

## 九、性能优化分析

### 9.1 缓存命中率分析

```
假设场景：
  - 100 个任务
  - 每个任务平均 10 次查询
  - 每次查询触发 2 次回调

总查询次数：
  - get_session_id(): 100 * 10 = 1000 次（无缓存）
  - get_task_id(): 100 * 10 * 2 = 2000 次（有缓存）

缓存效果：
  - get_task_id() 第一次：缓存未命中，查云端（2000 * 1 = 2000 次）
  - get_task_id() 后续：缓存命中，直接返回（0 次云端查询）
  
实际云端查询次数：
  - 无缓存：1000 + 2000 = 3000 次
  - 有缓存：1000 + 100 = 1100 次
  - 减少：63%

性能提升：
  - 查询延迟：从 100ms 降低到 1ms（100倍）
  - 云端压力：减少 63%
```

### 9.2 为什么不缓存 task_id → session_id？

```
1. 查询频率低：
   - 只在用户查询时调用
   - 每个任务每隔几分钟才查一次
   - 缓存收益不大

2. 数据可能变化：
   - 环境重置时会删除映射
   - 缓存可能失效
   - 需要缓存失效机制（复杂）

3. 简化设计：
   - 只缓存稳定的映射
   - 避免缓存一致性问题
   - 降低维护成本

结论：直接查云端，简单可靠
```

---

## 十、总结

### 核心价值

1. **多轮对话的基础**：通过映射复用会话，实现自然的对话交互
2. **多机协作支持**：通过云端存储，不同机器可以接力完成任务
3. **性能优化**：通过单向缓存，减少 63% 的云端查询

### 关键设计

- ✅ **双向映射**：支持两种查询场景
- ✅ **单向缓存**：只缓存高频且稳定的映射
- ✅ **静态工具类**：全局唯一，使用简单
- ✅ **线程安全**：类级别锁保护
- ✅ **双写机制**：两个表各自索引，查询高效
- ✅ **容错设计**：双写相互独立，一个失败不影响另一个

### 最佳实践

1. **首次查询**：先调用 `get_session_id()`，未找到则创建并 `set_mapping()`
2. **后续查询**：直接复用返回的 `session_id`
3. **回调场景**：调用 `get_task_id()` 查找对应任务
4. **环境重置**：使用 `remove_task_to_session_only()` 单向删除

### 与 MetaContainer 的对比

| 特性 | TaskSessionMapper | MetaContainer |
|-----|------------------|---------------|
| 职责 | 会话映射管理 | 任务元数据管理 |
| 数据量 | 小（1个映射关系） | 大（30+字段） |
| 缓存策略 | 单向缓存（session→task） | 无缓存（纯云端） |
| 查询频率 | 极高（每次回调） | 中等（初始化+查询） |
| 类型 | 静态工具类 | 普通类（单例使用） |
| 锁类型 | 普通锁（Lock） | 递归锁（RLock） |

---

**学习日期**：2026-07-08  
**模块重要度**：⭐⭐⭐⭐⭐（多轮对话核心）  
**代码行数**：226 行  
**理解程度**：95%+

TaskSessionMapper 是实现多轮对话的"记忆索引"，没有它就没有连续对话能力！🎯
