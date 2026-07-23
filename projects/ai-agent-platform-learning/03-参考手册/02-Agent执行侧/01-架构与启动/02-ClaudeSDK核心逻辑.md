# Claude SDK Wrapper 核心逻辑详解

深入理解 `claude_agent_sdk_wrapper.py` 的设计和执行流程。

---

## 一、整体架构

### 1.1 核心职责

```
ClaudeAgentSDKService (单例)
    │
    ├─ Session 管理      ← task_id ↔ session_id 映射，支持多轮对话
    ├─ MCP 工具集成      ← 连接外部工具（DEP/AI24/Figma等）
    ├─ Hook 系统         ← 拦截 Claude 操作（路径安全/Git/TDD等）
    ├─ 消息渲染/上报     ← 本地日志 + 远程平台双渲染
    └─ Token 管理        ← 自动监控使用率，超85%自动compact
```

**设计原则：**
- **单例模式** — 全局唯一实例，避免重复初始化
- **异步优先** — 核心方法都是 `async`，高效处理 I/O
- **资源自动管理** — 用 `async with` 确保连接正确释放
- **任务隔离** — 每个 task_id 有独立的锁，避免并发冲突

---

## 二、核心数据结构

### 2.1 Session 映射机制

**问题：** 多轮对话怎么知道"这次请求和上次是同一个任务"？

**解决：** 维护 `task_id ↔ session_id` 双向映射（通过 `TaskSessionMapper`）

```python
# 第一次查询（task_id=123, prompt="需求分析"）
TaskSessionMapper.get_session_id("123")  # 返回 None（还没建立映射）
  ↓
调用 Claude SDK（session_id=None）
  ↓
Claude 返回 ResultMessage（包含新生成的 session_id="abc"）
  ↓
TaskSessionMapper.set_mapping("123", "abc")  # 建立映射并持久化

# 第二次查询（task_id=123, prompt="开始编码"）
TaskSessionMapper.get_session_id("123")  # 返回 "abc"（找到了！）
  ↓
调用 Claude SDK（session_id="abc"）← 继续之前的对话
  ↓
Claude 能看到上次的"需求分析"上下文
```

**持久化路径：** `tmp/data/task_session_mapping.json`

**好处：**
- 用户无需关心 session_id，只传 task_id
- 支持跨请求的上下文连续性
- 机器重启后能恢复映射关系

### 2.2 活跃客户端管理

```python
self._active_clients = {}      # {task_id: ClaudeSDKClient 实例}
self._client_loops = {}        # {task_id: asyncio.EventLoop}
self._task_locks = {}          # {task_id: threading.Lock}
self._interrupt_flags = {}     # {task_id: bool}  ← 打断标识
```

**用途：**
- `_active_clients` — 跨线程中断任务时，能找到对应的 client 实例调用 `client.interrupt()`
- `_client_loops` — 从 Flask 同步线程调用异步方法时，需要知道任务运行在哪个事件循环
- `_task_locks` — 同一个 task_id 不能同时执行两次查询（防止并发覆盖 session）
- `_interrupt_flags` — 打断请求到达时先设标识，执行线程检查到后主动退出

---

## 三、核心流程详解

### 3.1 初始化流程 (`__init__`)

```
实例化 ClaudeAgentSDKService()
    ↓
【单例检查】已存在？→ 跳过初始化
    ↓
【获取 API Key】
    ├─ 优先级1: 从 AI24 接口拉取 (CLAUDE_API_MAPS)
    ├─ 优先级2: 构造函数参数 api_key
    └─ 优先级3: 环境变量 ANTHROPIC_API_KEY
    ↓
【配置默认参数】
    ├─ model: 默认 "claude-opus-4-8"
    ├─ cwd: 默认当前目录
    ├─ permission_mode: 默认 "default"
    ├─ output_format: "cli" | "openhands" | "event"
    └─ mcp_servers: 动态配置本地与远程 MCP（含 code-agent-report-tools、Zeus、Zeus-CI 等）
    ↓
【初始化映射器】
    ├─ TaskSessionMapper（持久化 task↔session 映射）
    ├─ 活跃客户端字典 (_active_clients)
    └─ 任务锁字典 (_task_locks)
    ↓
标记 _initialized = True
```

**关键代码位置：** `claude_agent_sdk_wrapper.py:325-550`

**重点：**
- **只初始化一次** — 单例模式，即使多次调用 `ClaudeAgentSDKService()` 也共享同一实例
- **API Key 动态获取** — 从 AI24 平台拉取最新的 Key，支持动态轮换

---

### 3.2 任务执行流程 (`query` 方法)

这是整个 SDK 最核心的方法，完整流程如下：

```
ClaudeAgentSDKService.query(prompt="实现登录功能", task_id="123")
    ↓
┌────────────────────────────────────────────────────────────┐
│ 阶段1: 获取任务锁（防止并发）                                │
└────────────────────────────────────────────────────────────┘
    self._get_task_lock(task_id).acquire()  ← 同一 task_id 串行执行
    ↓
    检查打断标识 → 如果被打断，直接返回
    ↓
┌────────────────────────────────────────────────────────────┐
│ 阶段2: Session 恢复/创建                                     │
└────────────────────────────────────────────────────────────┘
    if keep_session=True:
        session_id = TaskSessionMapper.get_session_id(task_id)
        ↓
        找到了？→ 继续旧会话（多轮对话）
        没找到？→ session_id=None（创建新会话）
    else:
        session_id = None  ← 每次都是新会话（不保存映射）
    ↓
┌────────────────────────────────────────────────────────────┐
│ 阶段3: 构建 Options（配置 Claude SDK）                       │
└────────────────────────────────────────────────────────────┘
    options = ClaudeAgentOptions(
        cwd=cwd,                      ← 工作目录
        model=model,                  ← 模型选择
        permission_mode=permission_mode,  ← 权限模式
        mcp_servers=mcp_servers,      ← MCP 工具配置
        hooks=hooks,                  ← Hook 配置（路径安全/Git等）
        session_id=session_id,        ← 恢复的 session_id（或 None）
        env={"ANTHROPIC_API_KEY": "...", "ANTHROPIC_BASE_URL": "..."}
    )
    ↓
┌────────────────────────────────────────────────────────────┐
│ 阶段4: 创建 Claude SDK 客户端（资源自动管理）                │
└────────────────────────────────────────────────────────────┘
    async with ClaudeSDKClient(options=options) as client:
        ↓
        【注册到活跃映射】
        self._active_clients[task_id] = client  ← 供中断时查找
        self._client_loops[task_id] = asyncio.get_running_loop()
        ↓
┌────────────────────────────────────────────────────────────┐
│ 阶段5: 发送查询到 Claude                                     │
└────────────────────────────────────────────────────────────┘
        if image_urls:  ← 多模态支持（图片+文本）
            await client.query(_build_multimodal_prompt(...))
        else:
            await client.query(prompt, session_id=session_id)
        ↓
┌────────────────────────────────────────────────────────────┐
│ 阶段6: 处理响应流（边收边渲染）                              │
└────────────────────────────────────────────────────────────┘
        await self._process_response_messages(client, session_id, task_id)
            ↓
            【消息类型】
            ├─ UserMessage        → 渲染用户输入
            ├─ AssistantMessage   → 渲染 Claude 回复（文本/思考/工具调用）
            ├─ ToolResultBlock    → 渲染工具执行结果
            └─ ResultMessage      → 最终结果（提取 session_id 建立映射）
            ↓
            【双渲染器】
            ├─ 本地渲染 → logs/claude_messages/
            └─ 远程上报 → 管理平台 API
            ↓
            【Token 检查】
            if token_usage > 85%:
                needs_compact = True  ← 标记需要压缩
        ↓
┌────────────────────────────────────────────────────────────┐
│ 阶段7: 清理资源                                              │
└────────────────────────────────────────────────────────────┘
        【移除活跃映射】
        self._active_clients.pop(task_id)
        self._client_loops.pop(task_id)
        ↓
    # async with 块结束，client 自动关闭
    ↓
┌────────────────────────────────────────────────────────────┐
│ 阶段8: 释放任务锁                                            │
└────────────────────────────────────────────────────────────┘
    finally:
        task_lock.release()
        self._clear_interrupt_flag(task_id)
        self._task_locks.pop(task_id)  ← 清理锁对象
```

**关键代码位置：** `claude_agent_sdk_wrapper.py:1157-1443`

---

### 3.3 消息处理流程 (`_process_response_messages`)

这是响应处理的核心，负责：
1. 从 Claude SDK 接收消息流
2. 渲染到本地日志和远程平台
3. 提取 session_id 建立映射
4. 监控 Token 使用率

```python
async def _process_response_messages(
    client, session_id, task_id, keep_session, options
) -> bool:  # 返回 needs_compact
    
    async for message in client.messages():  ← 流式接收消息
        
        # 1. 根据消息类型分别处理
        if isinstance(message, UserMessage):
            # 用户输入消息（回显）
            await renderer.render_user_message(...)
        
        elif isinstance(message, AssistantMessage):
            # Claude 的回复消息（可能包含多种 block）
            for block in message.content:
                if isinstance(block, TextBlock):
                    # 普通文本输出
                    await renderer.render_assistant_text(block.text)
                
                elif isinstance(block, ThinkingBlock):
                    # 思考过程（Extended Thinking）
                    await renderer.render_thinking(block.thinking)
                
                elif isinstance(block, ToolUseBlock):
                    # Claude 调用工具（如 Read/Write/Bash）
                    await renderer.render_tool_use(
                        tool_name=block.name,
                        tool_input=block.input
                    )
        
        elif isinstance(message, ToolResultBlock):
            # 工具执行结果
            await renderer.render_tool_result(
                tool_name=message.tool_name,
                result=message.content
            )
        
        elif isinstance(message, ResultMessage):
            # 最终结果消息（包含 session_id 和 token 统计）
            
            # 2. 提取 session_id 并建立映射
            if keep_session and message.session_id:
                TaskSessionMapper.set_mapping(task_id, message.session_id)
                logger.info(f"已建立映射: {task_id} ↔ {message.session_id}")
            
            # 3. Token 使用率检查
            if message.usage:
                total = message.usage.cache_creation_input_tokens + \
                        message.usage.cache_read_input_tokens + \
                        message.usage.input_tokens
                
                context_window = 200000  # Claude Opus 4.8 的上下文窗口
                usage_rate = (total / context_window) * 100
                
                if usage_rate > TOKEN_USAGE_THRESHOLD:  # 85%
                    logger.warning(f"Token 使用率 {usage_rate:.1f}% 超过阈值")
                    return True  # 需要 compact
            
            # 4. 渲染最终结果
            await renderer.render_result(message.result)
    
    return False  # 不需要 compact
```

**关键要点：**
- **流式处理** — 消息一条条到达，边收边渲染，不是等全部完成才显示
- **双渲染器** — 同一条消息渲染两次（本地文件 + 远程API），互不干扰
- **Session 绑定时机** — 在收到 `ResultMessage` 时才建立映射，因为这时才拿到 `session_id`

---

## 四、关键子系统

### 4.1 MCP 工具集成

**MCP (Model Context Protocol)** — 让 Claude 能调用外部工具的协议。

```python
def create_claude_service():
    """
    创建 Claude 服务实例，配置 MCP 服务器
    """
    
    # 1. 内置 MCP（stdio 方式，本地进程）
    mcp_servers = {
        "code-agent-report-tools": {
            "command": "python",
            "args": ["-m", "mcp_server.server"],
            "cwd": PROJECT_ROOT,
        },
        "mastergo": {  # MasterGo 设计稿工具
            "command": "npx",
            "args": ["-y", "@mastergo/magic-mcp"],
        }
    }
    
    # 2. 外部 MCP（SSE 方式，远程HTTP接口）
    if enable_dep_mcp:
        mcp_servers["dep"] = {
            "url": f"{AI24_MCP_URL}?key=dep&env={env}",
            "transport": "sse",
        }
    
    if enable_ai24_mcp:
        mcp_servers["ai24"] = {
            "url": f"{AI24_MCP_URL}?key=ai24&env={env}",
            "transport": "sse",
        }

    # Zeus CI 与 Zeus 现在是两个独立 SSE 服务
    mcp_servers["zeus-ci"] = {
        "type": "sse",
        "url": "http://higress.idcvdian.com/mcp-servers/zeus-ci/sse",
    }
    mcp_servers["zeus"] = {
        "type": "sse",
        "url": "http://higress.idcvdian.com/mcp-servers/zeus/sse",
    }
    
    return ClaudeAgentSDKService(
        mcp_servers=mcp_servers,
        ...
    )
```

**Claude 调用 MCP 工具的流程：**
```
Claude 决定调用工具 → 生成 ToolUseBlock
    ↓
SDK 根据工具名查找 MCP Server 配置
    ↓
stdio MCP: 启动本地子进程 → JSON-RPC 调用
SSE MCP: HTTP POST 到远程接口 → 等待 SSE 流返回
    ↓
工具返回结果 → 包装成 ToolResultBlock
    ↓
Claude 继续推理（可能再次调用工具）
```

**代码位置：** `claude_agent_sdk_wrapper.py:1323-1387`

MCP 数量不是固定常量：Figma、memmachine、环境版 AI24 等会受环境变量和运行配置影响。学习时应以 `create_claude_service()` 当前实际组装的 `mcp_servers` 为准，不要死记“固定 24 个”。

---

### 4.2 Hook 系统

**Hook** — 拦截 Claude 的操作，在执行前/后插入自定义逻辑。

```python
hooks = {
    "Read": [  # 拦截读文件操作
        {
            "pattern": ".*",  # 匹配所有文件
            "handler": path_security_hook,  # 检查路径是否合法
        }
    ],
    "Write": [  # 拦截写文件操作
        {
            "pattern": ".*",
            "handler": path_security_hook,
        }
    ],
    "Bash": [  # 拦截 git commit 命令
        {
            "pattern": "git commit.*",
            "handler": git_commit_author_hook,  # 自动添加 Co-Author
        }
    ],
}
```

**Hook 执行流程：**
```
Claude 调用 Write("src/app.py", "...")
    ↓
SDK 检查 hooks["Write"]
    ↓
匹配到 pattern=".*" → 调用 path_security_hook
    ↓
Hook 检查：文件路径是否在 cwd 下？
    ├─ 是 → 返回 ALLOW → 继续执行
    └─ 否 → 返回 DENY → 抛出异常
    ↓
实际写入文件
```

**内置 Hook 类型：**
- `PathSecurityHook` — 防止访问 cwd 外的文件
- `GitCommitAuthorHook` — 自动添加 Co-Author 到 commit message
- `TddTestLockHook` — TDD 模式下锁定测试文件
- `TddStopGateHook` — 测试未通过时阻止继续

**代码位置：** `hooks/` 目录

---

### 4.3 Token 管理和自动 Compact

**问题：** Claude Opus 4.8 上下文窗口 200K tokens，用满了怎么办？

**解决：** 自动监控使用率，超过 85% 时触发 `/compact` 压缩上下文。

```python
TOKEN_USAGE_THRESHOLD = 85  # 百分比

async def _process_response_messages(...) -> bool:
    ...
    if isinstance(message, ResultMessage):
        # 计算 Token 使用率
        total_tokens = (
            message.usage.cache_creation_input_tokens +
            message.usage.cache_read_input_tokens +
            message.usage.input_tokens
        )
        context_window = 200000  # Claude Opus 4.8
        usage_rate = (total_tokens / context_window) * 100
        
        if usage_rate > TOKEN_USAGE_THRESHOLD:
            logger.warning(
                f"[Task {task_id}] Token 使用率 {usage_rate:.1f}% "
                f"超过阈值 {TOKEN_USAGE_THRESHOLD}%"
            )
            return True  # 标记需要 compact
    
    return False
```

**Compact 原理：**
- Claude SDK 内部会保留重要上下文（系统提示词、最近消息）
- 压缩中间的长对话历史，减少 token 占用
- 类似"总结之前的对话，忘掉细节"

**代码位置：** `claude_agent_sdk_wrapper.py:1504-1550`

---

### 4.4 任务中断机制

**问题：** 用户点击"停止"按钮，怎么让正在执行的 Claude 任务立即停下来？

**挑战：** Flask 的 `/task/stop` 请求在主线程，Claude 任务在 asyncio 事件循环，跨线程通信很麻烦。

**解决：** 三步走
1. 设置中断标识
2. 通过活跃客户端映射找到 client 实例
3. 在正确的事件循环里调用 `client.interrupt()`

```python
def interrupt_task(self, task_id: str) -> tuple[bool, str]:
    """
    中断指定任务（跨线程安全）
    
    Returns:
        (success, message)
    """
    with self._client_lock:
        # 1. 设置中断标识
        self._interrupt_flags[task_id] = True
        logger.info(f"[Task {task_id}] 已设置中断标识")
        
        # 2. 查找活跃的 client 实例
        client = self._active_clients.get(task_id)
        if not client:
            return False, f"任务 {task_id} 不在活跃列表"
        
        # 3. 获取任务所在的事件循环
        loop = self._client_loops.get(task_id)
        if not loop:
            return False, f"任务 {task_id} 事件循环不存在"
        
        # 4. 在正确的事件循环里调用 interrupt（跨线程）
        future = asyncio.run_coroutine_threadsafe(
            client.interrupt(),  # 异步方法
            loop                 # 目标事件循环
        )
        future.result(timeout=5)  # 等待完成
        
        logger.info(f"[Task {task_id}] 中断信号已发送")
        return True, "中断成功"
```

**为什么需要保存事件循环？**
- `client.interrupt()` 是异步方法，必须在事件循环里调用
- Flask 请求在主线程（没有事件循环）
- 通过 `asyncio.run_coroutine_threadsafe()` 把异步调用"塞"到正确的循环里

**代码位置：** `claude_agent_sdk_wrapper.py:2146-2200`

---

## 五、消息渲染系统

### 5.1 三种输出格式

```python
output_format = "cli" | "openhands" | "event"
```

| 格式 | 用途 | 示例 |
|------|------|------|
| `cli` | 终端输出，人类可读 | `[Claude] 我将帮你实现登录功能...` |
| `openhands` | OpenHands 标准格式 | `{"type": "message", "role": "assistant", ...}` |
| `event` | 事件驱动格式（当前默认） | `{"event": "assistant_message", "data": {...}}` |

### 5.2 双渲染器架构

```
Claude 输出消息
    ↓
┌───────┴──────┐
│              │
▼              ▼
本地渲染器      远程上报器
│              │
▼              ▼
logs/          管理平台 API
claude_messages/  (HTTP POST)
```

**本地渲染器：** `claude_message_renderer.py`
- 保存到本地日志文件
- 按日期分文件存储
- 用于调试和审计

**远程上报器：** `message_reporter.py`
- HTTP POST 到管理平台
- 实时更新任务状态
- 供用户在 Web 界面查看

**代码位置：**
- 本地渲染：`claude_message_renderer.py`
- 远程上报：`message_reporter.py`

---

## 六、关键设计模式总结

### 6.1 单例模式

```python
class ClaudeAgentSDKService:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:  # 线程安全
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
```

**为什么用单例：**
- 避免重复初始化（加载 MCP、建立连接很耗时）
- 全局共享 Session 映射
- 统一管理活跃客户端

### 6.2 资源自动管理（Context Manager）

```python
async with ClaudeSDKClient(options) as client:
    await client.query(prompt)
    # client 使用完后自动关闭连接
```

**优点：**
- 即使异常退出，也能正确释放资源
- 避免连接泄漏

### 6.3 观察者模式（消息流）

```python
async for message in client.messages():
    # 每条消息到达时立即处理
    render(message)
```

**优点：**
- 边收边显示，用户体验好
- 不需要等全部完成才返回

---

## 七、常见问题

### Q1: 为什么 Session 要持久化到磁盘？
- **多轮对话需求** — 用户可能分多次请求完成一个任务
- **进程重启恢复** — 服务重启后能继续之前的对话
- **机器故障转移** — 任务可能从机器A转移到机器B（虽然当前架构不支持，但为未来扩展留接口）

### Q2: Token 检查为什么是 85% 而不是 90% 或 100%？
- **留安全余量** — 防止在检查和实际执行之间增长超出窗口
- **避免强制截断** — 超过 100% 会导致 SDK 抛异常，85% 时主动压缩更优雅

### Q3: 为什么需要任务锁？
- **防止并发覆盖** — 同一 task_id 的两次请求可能覆盖 session_id 映射
- **保证 Session 一致性** — 一个 task 同时只能有一个活跃对话

### Q4: MCP 的 stdio 和 SSE 有什么区别？
- **stdio** — 本地子进程，通过标准输入输出通信，适合本地工具（如 mastergo）
- **SSE (Server-Sent Events)** — 远程 HTTP 接口，适合云服务（如 DEP/AI24）

---

## 八、学习建议

### 第一步：理解核心流程
1. 从 `query()` 方法入手，跟踪一次完整的查询流程
2. 在关键位置加 `logger.info()` 观察执行顺序
3. 尝试发起一次查询，查看日志输出

### 第二步：理解 Session 管理
1. 阅读 `TaskSessionMapper` 的实现
2. 手动修改 `task_session_mapping.json`，观察多轮对话是否受影响
3. 尝试 `keep_session=False`，观察行为差异

### 第三步：理解 MCP 集成
1. 找一个 MCP 工具（如 `code-agent-report-tools`）
2. 阅读它的 `server.py`，理解如何暴露工具
3. 尝试让 Claude 调用这个工具，观察消息流

### 第四步：理解 Hook 系统
1. 阅读 `PathSecurityHook` 的实现
2. 尝试让 Claude 访问 cwd 外的文件，观察拦截效果
3. 自己写一个简单的 Hook（如记录所有读文件操作）

---

## 九、下一步

建议按顺序学习：
1. ✅ **Claude SDK Wrapper** — 你在这里
2. ⬜ **OpenSpec 工作流** — 理解 proposal/apply/archive 的代码实现
3. ⬜ **Redis 任务调度** — 理解多机协同的完整链路
4. ⬜ **前端工作流** — 理解 Figma/MasterGo MCP 的集成

有疑问随时记录到 `learning/questions.md`！
