# service.query() 内部实现详解

> 深入 `claude_agent_sdk_wrapper.py`，彻底打通从 task_id 到 Claude SDK 的完整链路。
> 这是整个 code-agent 最核心的方法，也是 TaskSessionMapper 真正被调用的地方。

---

## 一、这个方法解决了什么问题？

上一节我们知道 `execute_query_task()` 最终调用了 `service.query()`。现在我们要回答几个关键问题：

1. 用户只传了 `task_id`，Claude SDK 需要的 `session_id` 是从哪来的？
2. 多轮对话是如何做到"记得上次的对话"的？
3. 中断是如何在 SDK 层真正生效的？
4. 同一个任务的并发请求如何隔离？

---

## 二、query() 方法的完整生命周期

```
service.query(task_id="task_123", prompt="继续实现...")
    │
    ├─ 【1. 加锁】_get_task_lock(task_id).acquire()
    │      同一任务串行，不同任务并发
    │
    ├─ 【2. 查 session_id】TaskSessionMapper.get_session_id(task_id)
    │      task_id → session_id（可能为 None）
    │
    ├─ 【3. 构建 options】把 session_id 作为 resume 参数
    │      resume = session_id
    │
    ├─ 【4. 创建 ClaudeSDKClient】并发送 prompt
    │      client.query(prompt, session_id=session_id)
    │
    ├─ 【5. 处理响应流】_process_response_messages()
    │      ├─ 收到 SystemMessage → 提取真实 session_id
    │      ├─ 首次调用 → set_mapping(task_id, session_id)  ⭐ 建立映射
    │      └─ 循环检查中断标识
    │
    └─ 【6. 释放锁】finally: task_lock.release() + 清除中断标识
```

---

## 三、关键点1：任务锁（并发隔离）

**位置**：query() 开头（第 1248-1257 行）

```python
task_lock = None
if task_id:
    task_lock = self._get_task_lock(task_id)

try:
    if task_lock:
        task_lock.acquire()   # 阻塞直到拿到锁
        logger.info(f"[Task {task_id}] 已获取任务锁")

        # 拿到锁后立刻检查中断标识
        if self._get_interrupt_flag(task_id):
            self._clear_interrupt_flag(task_id)
            return
```

**锁的存储结构**：
```python
self._task_locks: Dict[str, threading.Lock] = {}  # task_id -> Lock

def _get_task_lock(self, task_id):
    with self._client_lock:      # 用一把全局锁保护"锁字典"本身
        if task_id not in self._task_locks:
            self._task_locks[task_id] = threading.Lock()
        return self._task_locks[task_id]
```

**为什么需要这把锁？**

```
场景：用户快速连续发了两条消息
  请求A: "实现登录"     (线程1)
  请求B: "再加个注册"   (线程2)

如果没有锁：
  ❌ 两个线程同时操作同一个 session
  ❌ 对话历史错乱
  ❌ Claude 分不清先后顺序

有锁：
  ✅ 请求A 先拿到锁，执行完释放
  ✅ 请求B 等待，然后接着执行
  ✅ 同一任务严格串行

关键设计：锁的粒度是 task_id
  → 同一任务串行（保证对话顺序）
  → 不同任务并发（提高吞吐量）
```

---

## 四、关键点2：session_id 的获取（承接上一节的疑问）

**位置**：第 1265-1279 行

```python
# new_session=True 时强制创建新会话（用于一次性对话，如 design.md 评分）
if new_session:
    keep_session = False

session_id = None
if task_id and keep_session:
    session_id = TaskSessionMapper.get_session_id(task_id)   # ⭐ 这里！
    if session_id:
        logger.info(f"[Task {task_id}] 从映射关系中找到 session_id: {session_id}")
    else:
        logger.info(f"[Task {task_id}] 映射关系中不存在 session_id，将使用空 session_id")
elif task_id and not keep_session:
    logger.info(f"[Task {task_id}] keep_session=False，将创建新会话")
```

**这就完全印证了你之前的观察**：

```
用户请求只带 task_id
    ↓
query() 内部调用 TaskSessionMapper.get_session_id(task_id)
    ↓
两种情况：
  情况A：找到了 session_id（第2、3...次对话）
    → 传给 SDK 作为 resume，Claude 恢复上次对话
  情况B：没找到（第1次对话）
    → session_id = None，SDK 会生成一个新的
```

**session_id 如何传给 SDK？**（第 1144-1145 行，构建 options 时）

```python
options = ClaudeAgentOptions(
    ...
    resume = session_id,   # ⭐ session_id 作为 resume 参数
    ...
)
```

`resume` 是 Claude SDK 的"恢复会话"参数：
- `resume=None` → 开新会话
- `resume="sess_abc"` → 恢复 sess_abc 会话的历史上下文

---

## 五、关键点3：映射的建立（多轮对话的核心）

**位置**：`_process_response_messages()` 第 1744-1761 行

这是**最精妙**的地方 —— 映射不是在发送请求时建立的，而是在**收到第一条 SystemMessage 时**建立的。

```python
mapping_saved = False

async for message in client.receive_response():
    # 仅在首次收到 SystemMessage 时提取 session_id 并建立映射
    if isinstance(message, SystemMessage):
        if not mapping_saved and hasattr(message, 'data') and isinstance(message.data, dict):
            msg_session_id = message.data.get('session_id')   # ⭐ SDK 返回的真实 session_id
            if msg_session_id and keep_session and task_id:
                TaskSessionMapper.set_mapping(task_id, msg_session_id)   # ⭐ 建立映射
                mapping_saved = True
                logger.info(
                    f"[Task {task_id}] 首次建立映射关系: "
                    f"task_id={task_id} <-> session_id={msg_session_id}"
                )
```

**为什么要从 SystemMessage 里取 session_id？**

```
第1次对话流程：
  1. query() 查映射 → 没找到 → session_id = None
  2. 发送请求给 SDK（resume=None）
  3. SDK 生成新会话，分配 session_id = "sess_new_xyz"
  4. SDK 返回的第一条消息是 SystemMessage
     其 data 字段里带着这个新的 session_id
  5. 我们从这里提取 "sess_new_xyz"，建立映射：
     task_123 <-> sess_new_xyz

第2次对话流程：
  1. query() 查映射 → 找到 "sess_new_xyz"
  2. 发送请求给 SDK（resume="sess_new_xyz"）
  3. SDK 恢复该会话的历史，Claude "记得"上次的对话 ✅
```

**为什么用 `mapping_saved` 标志位？**

一次查询会收到很多条消息（SystemMessage、AssistantMessage、ResultMessage...），
可能有多条 SystemMessage。用标志位保证映射**只建立一次**，避免重复写云端。

---

## 六、关键点4：双层中断的 SDK 层实现

你之前学过"双层中断机制"。现在我们看到了 SDK 层（第2层）的真实实现。

### 6.1 第1层：中断标识（在消息循环里检测）

**位置**：`_process_response_messages()` 第 1763-1768 行

```python
async for message in client.receive_response():
    ...
    # 在消息处理循环中检查打断标识
    if task_id and self._get_interrupt_flag(task_id):
        self._clear_interrupt_flag(task_id)
        logger.warning(f"[Task {task_id}] 检测到打断标识，中断消息处理")
        raise InterruptedError(f"任务 {task_id} 在消息处理过程中被打断")
```

每收到一条消息就检查一次中断标识，能快速跳出循环。

### 6.2 第2层：client.interrupt()（真正中断 SDK）

**位置**：`interrupt_task()` 第 2146 行起

```python
def interrupt_task(self, task_id: str) -> tuple[bool, str]:
    # 1. 清除该任务的步骤规划
    self._global_planner.clear(task_id=task_id)

    # 2. 立即设置 was_interrupted 标识
    with self._client_lock:
        self._was_interrupted[task_id] = True

    # 3. 检查任务锁是否存在、是否被占用
    task_lock = self._task_locks.get(task_id)
    if not task_lock:
        return True, "任务锁不存在，任务可能尚未启动"
    if not task_lock.locked():
        return True, "任务锁未被占用，任务可能已完成"

    # 4. 设置打断标识（第1层）
    self._set_interrupt_flag(task_id, True)

    # 5. 查找所有相关客户端（主会话 + 辅助会话）
    clients_to_interrupt = {}
    with self._client_lock:
        # 主会话客户端（key 就是 task_id）
        if task_id in self._active_clients:
            clients_to_interrupt[task_id] = self._active_clients[task_id]
        # 辅助会话客户端（key 是 "task_id:xxx"）
        for client_key in list(self._active_clients.keys()):
            if client_key.startswith(f"{task_id}:"):
                clients_to_interrupt[client_key] = self._active_clients[client_key]

    # 6. 跨线程调用 client.interrupt()（第2层）
    for client_key, client in clients_to_interrupt.items():
        loop = self._client_loops.get(client_key)   # 找到该客户端的事件循环
        # 用 run_coroutine_threadsafe 在原始事件循环里执行 interrupt()
        ...
```

**中断的精妙之处**：

```
1. 不竞争锁，只检查锁状态
   → 如果锁没被占用，说明任务没在跑，直接返回成功
   → 避免中断请求被正在执行的任务阻塞

2. 中断"主会话 + 所有辅助会话"
   → 一个任务可能有多个 client：
     - task_123          (主会话)
     - task_123:step     (步骤检查辅助会话)
   → 全部一起中断，不留残留

3. 跨线程调用
   → interrupt_task() 在 HTTP 请求线程里被调用
   → 但 client 在另一个线程的事件循环里跑
   → 用 run_coroutine_threadsafe 安全跨线程唤醒
```

---

## 七、关键点5：只有一条 ResultMessage 时删除会话

**位置**：第 2042-2044 行

```python
# 如果只收到一条 ResultMessage，则删除会话记录
if message_count == 1 and final_result is not None and task_id:
    logger.info(f"[Task {task_id}] 检测到只收到一条 ResultMessage，删除会话记录")
    TaskSessionMapper.remove_task_to_session_only(task_id)
```

**为什么？**

```
正常对话：SystemMessage → AssistantMessage(多条) → ResultMessage
异常情况：只有一条 ResultMessage（通常是出错了，如 "Prompt is too long"）

如果保留这个坏掉的 session：
  ❌ 下次对话 resume 这个坏 session，继续报错

删除它：
  ✅ 下次对话重新开新会话，避免坏状态传染
```

---

## 八、完整链路串联（把所有章节连起来）

```
┌────────────────────────────────────────────────────────────┐
│ AI24 平台：POST /task/query {"taskId": "task_123", ...}     │
└────────────────────────────┬───────────────────────────────┘
                             ↓
┌────────────────────────────────────────────────────────────┐
│ main.py                                                     │
│  TaskQueryResource.post()                                   │
│    → dispatch_task_query_message()   [创建线程，返回202]    │
│    → run_query_task_in_thread()      [命令处理、hooks]      │
│    → execute_query_task()            [flow_type 分流]       │
└────────────────────────────┬───────────────────────────────┘
                             ↓
┌────────────────────────────────────────────────────────────┐
│ claude_agent_sdk_wrapper.py                                 │
│  service.query()                                            │
│    ① 加任务锁（并发隔离）                                    │
│    ② TaskSessionMapper.get_session_id() [task→session]      │
│    ③ 构建 options（resume=session_id）                      │
│    ④ 创建 ClaudeSDKClient，发送 prompt                       │
│    ⑤ _process_response_messages()                           │
│         - SystemMessage → set_mapping() [建立映射]          │
│         - 循环检查中断标识                                    │
│    ⑥ finally: 释放锁                                        │
└────────────────────────────┬───────────────────────────────┘
                             ↓
┌────────────────────────────────────────────────────────────┐
│ Claude Agent SDK → Claude 大脑 + MCP 工具                    │
│  执行任务，流式返回消息                                       │
└────────────────────────────┬───────────────────────────────┘
                             ↓
              MessageReporter 实时上报进度 → AI24 平台
```

---

## 九、核心收获

### 1. 三个关键数据结构（都以 task_id 为 key）

| 结构 | 类型 | 作用 |
|------|------|------|
| `_task_locks` | `Dict[str, Lock]` | 任务锁，同任务串行 |
| `_active_clients` | `Dict[str, Client]` | 活跃客户端，用于中断 |
| `_client_loops` | `Dict[str, Loop]` | 事件循环，跨线程中断 |

### 2. session_id 的完整生命周期

```
获取：TaskSessionMapper.get_session_id(task_id)  → query 开头
使用：resume = session_id                         → 构建 options
建立：TaskSessionMapper.set_mapping()             → 收到 SystemMessage 时
清理：只收到一条 ResultMessage 时删除 task→session  → 出错时
```

### 3. 印证了之前的两个理解

- ✅ **用户只需要 task_id**：session_id 在 query() 内部通过映射查找，全程对用户透明
- ✅ **多轮对话原理**：靠 resume=session_id 恢复历史，靠 SystemMessage 回填映射

### 4. 设计亮点

- **锁粒度 = task_id**：平衡了"对话顺序"和"并发吞吐"
- **映射延迟建立**：等 SDK 分配真实 session_id 后才建立，保证准确
- **双层中断**：标识（快速跳出循环）+ client.interrupt()（彻底中断 SDK）
- **辅助会话一起中断**：主会话 + 已注册的辅助会话，无残留
- **坏会话自动清理**：只有一条 ResultMessage 时删除 `task_id → session_id` 单向映射；反向映射和缓存仍保留

---

## 十、待探索的问题

1. **_process_response_messages 如何渲染消息？**
   - 三种渲染器：message / openhands / event
   - 消息如何变成 AI24 能展示的格式？

2. **options 里还配置了什么？**
   - MCP 服务、hooks、权限模式、系统提示词
   - 这些如何影响 Claude 的行为？

---

**学习日期**：2026-07-08
**核心文件**：claude_agent_sdk_wrapper.py（2514 行）
**本次聚焦**：query() 方法及其调用链（约 400 行核心代码）
**关联文档**：[TaskSessionMapper深度解析](../02-数据层/TaskSessionMapper深度解析.md)、[main核心业务流程详解](main核心业务流程详解.md)、[MetaContainer深度解析](../02-数据层/MetaContainer深度解析.md)
