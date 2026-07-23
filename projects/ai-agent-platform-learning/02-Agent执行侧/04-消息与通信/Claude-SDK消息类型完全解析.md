# Claude SDK 消息类型完全解析

> Claude SDK 到底会发出哪些消息？每种消息包含什么内容？

---

## 一、消息类型总览（4 种核心类型）

```
Claude SDK 消息流：
┌──────────────────────────────────────────────────────────┐
│ 1. SystemMessage      （系统控制信令）                    │
│ 2. AssistantMessage   （Claude 的输出）⭐ 最重要          │
│ 3. UserMessage        （工具执行结果反馈给 Claude）       │
│ 4. ResultMessage      （任务完成总结）                    │
└──────────────────────────────────────────────────────────┘
```

**import 路径**：
```python
from claude_agent_sdk import (
    Message,           # 基类
    SystemMessage,     # 系统信令
    AssistantMessage,  # Claude 输出
    UserMessage,       # 工具结果
    ResultMessage,     # 完成总结
    # Block 类型
    TextBlock,         # 文本内容
    ThinkingBlock,     # 思考过程
    ToolUseBlock,      # 工具调用
    ToolResultBlock,   # 工具结果
)
```

---

## 二、类型1：SystemMessage（系统信令）

### 作用

**SDK 发给 code-agent 的"握手信号"，告知会话状态。**

### 结构

```python
SystemMessage(
    data: Dict[str, Any]  # 包含 session_id 等元信息
)
```

### 真实示例

```python
SystemMessage(
    data={
        "session_id": "sess_abc123",      # ⭐ 真实的会话ID
        "status": "started",               # 会话状态
        "timestamp": 1234567890
    }
)
```

### 用途

```python
# code-agent 从这里提取 session_id，建立映射
if isinstance(message, SystemMessage):
    msg_session_id = message.data.get('session_id')
    TaskSessionMapper.set_mapping(task_id, msg_session_id)
```

### 何时出现

- **第一条消息**：每次查询开始时，SDK 先发一条 SystemMessage
- **只有一次**：一次查询只会在开头发一条

### 是否上报给用户

❌ **跳过**（用户看不懂技术细节）

---

## 三、类型2：AssistantMessage（Claude 的输出）⭐ 核心

### 作用

**Claude 生成的所有内容，包括文字、思考、工具调用。**

### 结构

```python
AssistantMessage(
    content: List[Block]  # 包含多个 Block
)
```

**Block 有 4 种类型**：

```python
content: [
    TextBlock,         # 文本内容
    ThinkingBlock,     # 思考过程（extended thinking）
    ToolUseBlock,      # 调用工具
    ToolResultBlock,   # 工具结果（少见，通常在 UserMessage 里）
]
```

---

### Block 类型详解

#### (1) TextBlock - 文本内容

Claude 说的话、代码解释、回复等。

```python
TextBlock(
    text: str  # 文本内容
)
```

**示例**：
```python
AssistantMessage(
    content=[
        TextBlock(text="好的，我来帮你实现用户登录功能。"),
        TextBlock(text="首先，我需要查看现有的代码结构。")
    ]
)
```

**用户看到**：
```
好的，我来帮你实现用户登录功能。
首先，我需要查看现有的代码结构。
```

---

#### (2) ThinkingBlock - 思考过程

Claude Opus 的 extended thinking 功能，展示推理过程。

```python
ThinkingBlock(
    thinking: str  # 思考内容
)
```

**示例**：
```python
AssistantMessage(
    content=[
        ThinkingBlock(thinking="用户想要登录功能，我需要考虑：\n1. 数据库设计\n2. 密码加密\n3. Session 管理"),
        TextBlock(text="我会分三步实现这个功能...")
    ]
)
```

**用户看到**：
```
[思考过程]
用户想要登录功能，我需要考虑：
1. 数据库设计
2. 密码加密
3. Session 管理

我会分三步实现这个功能...
```

---

#### (3) ToolUseBlock - 调用工具

Claude 决定使用某个工具（Read、Write、Edit、Bash 等）。

```python
ToolUseBlock(
    id: str,           # 工具调用的唯一ID
    name: str,         # 工具名称（Read、Write、Bash...）
    input: Dict        # 工具参数
)
```

**示例**：
```python
AssistantMessage(
    content=[
        TextBlock(text="让我先读取现有的登录文件"),
        ToolUseBlock(
            id="toolu_abc123",
            name="Read",
            input={
                "file_path": "/app/login.py"
            }
        )
    ]
)
```

**用户看到**：
```
让我先读取现有的登录文件
[工具调用] Read: /app/login.py
```

---

#### (4) ToolResultBlock - 工具结果（罕见）

通常工具结果在 `UserMessage` 里，但偶尔也会出现在 `AssistantMessage`。

```python
ToolResultBlock(
    tool_use_id: str,    # 对应的 ToolUseBlock 的 id
    content: str,        # 工具执行结果
    is_error: bool       # 是否出错
)
```

---

### AssistantMessage 的多样性

**一条 AssistantMessage 可以包含多个 Block：**

```python
# 示例1：纯文本
AssistantMessage(content=[
    TextBlock("好的，我明白了")
])

# 示例2：文本 + 工具调用
AssistantMessage(content=[
    TextBlock("让我读取文件"),
    ToolUseBlock(name="Read", input={...})
])

# 示例3：思考 + 文本 + 工具调用
AssistantMessage(content=[
    ThinkingBlock("需要先了解现有代码..."),
    TextBlock("我先读取 login.py"),
    ToolUseBlock(name="Read", input={...})
])

# 示例4：多个工具调用
AssistantMessage(content=[
    TextBlock("我需要同时读取两个文件"),
    ToolUseBlock(name="Read", input={"file_path": "a.py"}),
    ToolUseBlock(name="Read", input={"file_path": "b.py"})
])

# 示例5：空消息（思考中）
AssistantMessage(content=[])  # ← 这个会被过滤
```

### 何时出现

- **整个对话过程中**：Claude 每次"说话"或"调用工具"都会发 AssistantMessage
- **数量最多**：一次查询可能有几十条 AssistantMessage

### 是否上报给用户

✅ **上报**（这是用户最想看的内容）  
⚠️ **除非内容为空**（过滤空消息）

---

## 四、类型3：UserMessage（工具执行结果）

### 作用

**SDK 把工具执行结果反馈给 Claude。**

### 结构

```python
UserMessage(
    content: List[ToolResultBlock] | str,  # 工具结果列表或字符串
    parent_tool_use_id: str                # 对应的 ToolUseBlock ID
)
```

### 真实示例

**场景**：Claude 调用 Read 工具 → SDK 执行 → 返回结果

```python
# 1. Claude 发出工具调用
AssistantMessage(content=[
    ToolUseBlock(
        id="toolu_abc123",
        name="Read",
        input={"file_path": "/app/login.py"}
    )
])

# 2. SDK 执行 Read 工具，返回结果
UserMessage(
    parent_tool_use_id="toolu_abc123",
    content=[
        ToolResultBlock(
            tool_use_id="toolu_abc123",
            content="""
def login(username, password):
    # 现有的登录代码
    ...
            """,
            is_error=False  # 成功
        )
    ]
)
```

### 错误场景

```python
# 工具执行失败
UserMessage(
    content=[
        ToolResultBlock(
            tool_use_id="toolu_abc123",
            content="FileNotFoundError: /app/login.py not found",
            is_error=True  # ⭐ 出错了
        )
    ]
)
```

**code-agent 会检测错误并记录到错误告警日志**：
```python
if isinstance(message, UserMessage):
    for block in message.content:
        if isinstance(block, ToolResultBlock) and block.is_error:
            log_error_alert(error_content=block.content, ...)
```

### 何时出现

- **Claude 每次调用工具后**：Read、Write、Edit、Bash 等
- **可能很多条**：Claude 可能连续调用多个工具

### 是否上报给用户

✅ **上报**（用户想看工具执行结果）

**用户看到**：
```
[工具结果] Read: /app/login.py
def login(username, password):
    ...
```

---

## 五、类型4：ResultMessage（任务完成总结）

### 作用

**SDK 告知任务完成，提供统计信息。**

### 结构

```python
ResultMessage(
    result: str,              # "success" 或错误信息
    session_id: str,          # 会话ID
    num_turns: int,           # 对话轮数
    duration_ms: int,         # 执行耗时（毫秒）
    usage: UsageInfo,         # Token 消耗
    total_cost_usd: float     # 费用（美元）
)
```

### 真实示例

```python
ResultMessage(
    result="success",
    session_id="sess_abc123",
    num_turns=12,              # 12 轮对话
    duration_ms=45678,         # 45.6 秒
    usage={
        "input_tokens": 8500,
        "output_tokens": 3200,
        "cache_read_tokens": 1200,
        "cache_creation_tokens": 500
    },
    total_cost_usd=0.15        # $0.15
)
```

### 特殊场景：错误信息

```python
# 上下文太长
ResultMessage(
    result="Prompt is too long",  # ⭐ 触发 /compact 压缩
    ...
)
```

**code-agent 的处理**：
```python
if isinstance(message, ResultMessage):
    if message.result == "Prompt is too long":
        # 自动执行 /compact 压缩上下文
        await client.query("/compact", session_id=session_id)
```

### 何时出现

- **最后一条消息**：每次查询结束时
- **只有一次**：标志任务完成

### 是否上报给用户

✅ **上报**（用户想看统计信息）

**用户看到**：
```
[任务完成]
- 对话轮数：12
- 执行时长：45.6 秒
- Token 消耗：11,700
- 费用：$0.15
```

---

## 六、完整的消息流示例

让我们看一个真实的查询过程会产生哪些消息：

```
用户："帮我实现用户登录功能"

┌─────────────────────────────────────────────────────────┐
│ 1. SystemMessage                                        │
│    data: {"session_id": "sess_abc", "status": "started"}│
│    ← SDK 告知：会话已启动                               │
└─────────────────────────────────────────────────────────┘
         ↓ ❌ 跳过（技术细节）

┌─────────────────────────────────────────────────────────┐
│ 2. AssistantMessage                                     │
│    content: [                                           │
│      ThinkingBlock("用户想要登录功能，需要..."),         │
│      TextBlock("好的，我来帮你实现登录功能")            │
│    ]                                                    │
└─────────────────────────────────────────────────────────┘
         ↓ ✅ 上报

┌─────────────────────────────────────────────────────────┐
│ 3. AssistantMessage                                     │
│    content: [                                           │
│      TextBlock("首先，让我读取现有代码"),               │
│      ToolUseBlock(name="Read", input={...})             │
│    ]                                                    │
└─────────────────────────────────────────────────────────┘
         ↓ ✅ 上报

┌─────────────────────────────────────────────────────────┐
│ 4. UserMessage                                          │
│    content: [                                           │
│      ToolResultBlock(content="[login.py 内容]")         │
│    ]                                                    │
│    ← SDK 执行 Read 工具，返回结果                       │
└─────────────────────────────────────────────────────────┘
         ↓ ✅ 上报

┌─────────────────────────────────────────────────────────┐
│ 5. AssistantMessage                                     │
│    content: []  ← 空的！Claude 在思考                   │
└─────────────────────────────────────────────────────────┘
         ↓ ❌ 跳过（空消息）

┌─────────────────────────────────────────────────────────┐
│ 6. AssistantMessage                                     │
│    content: [                                           │
│      TextBlock("我看到代码需要添加密码加密"),           │
│      ToolUseBlock(name="Edit", input={...})             │
│    ]                                                    │
└─────────────────────────────────────────────────────────┘
         ↓ ✅ 上报

┌─────────────────────────────────────────────────────────┐
│ 7. UserMessage                                          │
│    content: [                                           │
│      ToolResultBlock(content="File edited successfully")│
│    ]                                                    │
└─────────────────────────────────────────────────────────┘
         ↓ ✅ 上报

... （可能还有很多轮）

┌─────────────────────────────────────────────────────────┐
│ N. ResultMessage                                        │
│    result: "success"                                    │
│    num_turns: 12                                        │
│    duration_ms: 45678                                   │
│    usage: {...}                                         │
└─────────────────────────────────────────────────────────┘
         ↓ ✅ 上报（统计信息）
```

---

## 七、特殊类型：评分 Session

**评分 Session 不是一种新的消息类型，而是一个"临时会话"，里面包含的消息类型和正常会话一样。**

```
主会话：task_123
  └─ SystemMessage
  └─ AssistantMessage: "正在实现登录..."
  └─ ...

评分会话：task_123_scoring_xxx  ← 临时创建
  └─ SystemMessage              ← 同样的类型
  └─ AssistantMessage: "让我评估这两张图..."
  └─ AssistantMessage: "布局相似度 90%"
  └─ AssistantMessage: "综合评分 87 分"
  └─ ResultMessage              ← 同样的类型
  （评分完，整个会话丢弃）

继续主会话：task_123
  └─ AssistantMessage: "继续实现..."
```

**过滤逻辑**：
```python
# 检查 session_id 里有没有 "_scoring_"
if "_scoring_" in session_id:
    return False  # 跳过这个 Session 的所有消息
```

---

## 八、消息类型总结表

| 消息类型 | 作用 | 何时出现 | 包含什么 | 是否上报 |
|---------|------|---------|---------|---------|
| `SystemMessage` | SDK 控制信令 | 第一条 | session_id、状态 | ❌ 跳过 |
| `AssistantMessage` | Claude 输出 | 全程最多 | TextBlock、ThinkingBlock、ToolUseBlock | ✅ 上报（除非空） |
| `UserMessage` | 工具结果 | 每次工具调用后 | ToolResultBlock | ✅ 上报 |
| `ResultMessage` | 任务完成 | 最后一条 | 统计信息、Token、费用 | ✅ 上报 |

### Block 类型总结

| Block 类型 | 出现在 | 作用 |
|-----------|--------|------|
| `TextBlock` | AssistantMessage | Claude 说的话 |
| `ThinkingBlock` | AssistantMessage | Claude 的思考过程 |
| `ToolUseBlock` | AssistantMessage | Claude 调用工具 |
| `ToolResultBlock` | UserMessage | 工具执行结果 |

---

## 九、如何验证？（实战调试）

想看真实的消息流，可以查看日志：

```bash
# 消息渲染日志（完整消息流）
tail -f /path/to/claude_message_*.log

# 上报日志（过滤后发给用户的）
tail -f /path/to/main.log | grep "report_system_message"
```

或者在代码里加日志：

```python
async for message in client.receive_response():
    msg_type = type(message).__name__
    print(f"收到消息: {msg_type}")
    
    if isinstance(message, AssistantMessage):
        block_types = [type(b).__name__ for b in message.content]
        print(f"  包含 Block: {block_types}")
```

---

**学习日期**：2026-07-08  
**核心文件**：claude_agent_sdk_wrapper.py  
**关联文档**：[消息过滤规则详解](消息过滤规则详解.md)、[service.query内部实现详解](../03-业务流程/service.query内部实现详解.md)
