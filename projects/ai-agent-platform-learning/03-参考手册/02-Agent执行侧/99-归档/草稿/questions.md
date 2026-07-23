# 关于"Claude 工具使用"的重大误解澄清

## 你的疑惑（核心问题）

> "在用 Claude Code 开发时，Claude 有很多工具可以使用，但在这个项目里感觉都没用上？Claude 自由发挥真的是最好的吗？我们用不了内部的工具不是很不方便吗？"

---

## 重大误解澄清 ❌→✅

### 误解：项目里的 Claude 用不了工具

**真相：项目里的 Claude **完全可以用**所有工具！而且配置的工具比你直接用 Claude Code 还要多！**

---

## 实际情况：工具配置全景

### 1. 内置工具（Claude Agent SDK 自带）

```python
default_allowed_tools = [
    # 文件操作
    "Read",        # 读文件
    "Write",       # 写文件
    "Edit",        # 编辑文件（精确替换）
    "MultiEdit",   # 批量编辑多个文件
    
    # 代码搜索
    "Glob",        # 文件名搜索（支持通配符）
    "Grep",        # 内容搜索
    "LS",          # 列出目录
    "LSP",         # 语言服务器协议（代码跳转/补全）
    
    # 命令执行
    "Bash",        # 执行 shell 命令
    
    # 任务管理
    "Task",        # 子任务管理
    "TodoWrite",   # 待办事项
    "Skill",       # 技能调用
    
    # 网络
    "WebFetch",    # 抓取网页内容
    
    # MCP 工具（动态加载）
    "mcp__figma__*",      # Figma 所有工具
    "mcp__mastergo-magic-mcp__*"  # MasterGo 所有工具
]
```

**这些工具和你直接用 Claude Code 时是一样的！**

### 2. MCP 外部工具（项目特有，比 Claude Code 还多）

```python
mcp_servers = {
    # 1. 任务报告工具（本地 stdio）
    "code-agent-report-tools": {
        "type": "stdio",
        "command": "python",
        "args": ["mcp_server/server.py"]
    },
    
    # 2. 设计工具
    "figma": {
        "type": "http",
        "url": "https://mcp.figma.com/mcp",
        "headers": {"Authorization": "Bearer xxx"}
    },
    "mastergo": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@mastergo/magic-mcp"]
    },
    
    # 3. 公司内部系统集成（这些是你直接用 Claude Code 没有的！）
    "ai24": {  # AI24 平台工具
        "type": "sse",
        "url": "http://higress.idcvdian.com/mcp-servers/ai24/sse"
    },
    "mcp-service-link-confluence": {  # Confluence 文档
        "type": "sse",
        "url": "http://higress.idcvdian.com/mcp-servers/mcp-service-link-confluence/sse"
    },
    "context1": {  # 中间件文档
        "type": "sse",
        "url": "http://middleware-mcp.daily.idcvdian.com/sse"
    },
    "data-factory-daily": {  # 数据工厂
        "type": "sse",
        "url": "http://higress.idcvdian.com/mcp-servers/data-factory-daily/sse"
    },
    "memmachine": {  # 记忆机器
        "type": "stdio",
        "command": "mcp-remote",
        "args": ["http://10.33.140.21:8080/mcp/"]
    },
    "vimg": {  # 图片上传
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "-p", "@vdian/mcp-vimg@1.0.4", "mcp-vimg"]
    },
    "ui-test-automation": {  # UI 自动化测试
        "type": "http",
        "url": "https://ui-test.daily.vdian.net/mcp"
    }
}
```

**代码位置：** `claude_agent_sdk_wrapper.py:2213-2387`

---

## 关键澄清

### Q1: Claude 能用这些工具吗？

**能！完全能！而且自动使用！**

当 Claude 收到任务时：
```
用户: "实现登录功能"
    ↓
Claude 看到自己有这些工具:
    - Read/Write/Edit（文件操作）
    - Bash（运行命令）
    - Glob/Grep（搜索代码）
    - MCP: ai24（查询文档）
    - MCP: context1（中间件文档）
    ↓
Claude 自己决定:
    1. "我先 Glob 找找现有的登录相关文件"
    2. "再 Read 看看代码结构"
    3. "调用 ai24 MCP 查一下公司的登录规范"
    4. "然后 Write 新文件"
    5. "最后 Bash 运行测试"
    ↓
你看到的消息流:
    ToolUseBlock: Glob("**/login*")
    ToolResultBlock: "找到 3 个文件..."
    ToolUseBlock: mcp__ai24__query_doc(...)
    ToolResultBlock: "文档内容..."
    ToolUseBlock: Write("login.py", "...")
```

**你之前的误解：** 以为项目里的 Claude 用不了工具。
**真相：** Claude 不仅能用，而且比你直接用 Claude Code 能用的工具还多（多了公司内部的 MCP）。

### Q2: 为什么感觉"看不到工具调用"？

**因为工具调用在消息流里，你得看日志才能看到！**

示例（真实的消息流）：
```json
{
  "type": "assistant_message",
  "content": [
    {"type": "text", "text": "我先查看一下项目结构"},
    {"type": "tool_use", "name": "Glob", "input": {"pattern": "src/**/*.py"}},
  ]
}
{
  "type": "tool_result",
  "tool_name": "Glob",
  "content": "src/auth/login.py\nsrc/auth/register.py"
}
{
  "type": "assistant_message",
  "content": [
    {"type": "text", "text": "找到了认证模块，我来读取登录文件"},
    {"type": "tool_use", "name": "Read", "input": {"file_path": "src/auth/login.py"}},
  ]
}
```

**这些都是真实发生的！** 你的代码里的 `_process_response_messages` 就在处理这些。

### Q3: "自由发挥"是什么意思？

**"自由发挥"不是指"Claude 啥工具都没有，只能瞎猜"。**

**真正的意思是：**

| 项目 | 你控制的 | Claude 控制的 |
|------|---------|--------------|
| **工具列表** | ✅ 你配置哪些工具可用 | ❌ |
| **工具调用时机** | ❌ | ✅ Claude 自己决定什么时候调用 |
| **工具调用顺序** | ❌ | ✅ Claude 自己决定先调哪个 |
| **工具参数** | ❌ | ✅ Claude 自己决定传什么参数 |
| **任务分解** | ❌ | ✅ Claude 自己决定怎么拆子任务 |

**类比：**
```
你 = 老板，给员工配了工具箱
Claude = 员工，自己决定怎么用工具完成任务

工具箱（你配置的）：
    ✅ 锤子（Bash）
    ✅ 螺丝刀（Read/Write）
    ✅ 电钻（Grep/Glob）
    ✅ 设计软件（Figma MCP）
    ✅ 公司内部系统（AI24 MCP）

员工拿到任务："装一个柜子"
    ↓
员工自己决定：
    ❌ 你不能说"先用螺丝刀，再用锤子"
    ✅ 员工自己判断："先看说明书（Read），再打孔（Bash），再拧螺丝（Write）"
```

---

## 你能优化的地方

### 1. 通过 Prompt 引导工具使用

虽然你控制不了 Claude "具体怎么调工具"，但可以通过 **Prompt 工程** 引导它：

```python
# ❌ 不好的 prompt（Claude 可能乱来）
prompt = "实现登录功能"

# ✅ 好的 prompt（引导 Claude 用特定工具）
prompt = """
实现登录功能，要求：

1. 先用 Glob 找现有的认证相关文件
2. 用 Read 理解现有代码结构
3. 调用 ai24 MCP 的 query_tech_design 工具查询公司的登录规范
4. 参考规范编写代码
5. 用 Bash 运行 pytest 测试
6. 如果测试失败，用 Edit 修复
"""
```

**这就是 OpenSpec 做的事情！** `openspec/prompts/apply.md` 里有详细的步骤引导。

### 2. 通过 Hook 约束工具行为

```python
hooks = {
    "Bash": [
        {
            "pattern": "rm -rf.*",  # 禁止删除命令
            "handler": lambda: PermissionResultDeny("危险操作")
        }
    ],
    "Write": [
        {
            "pattern": "/etc/.*",  # 禁止写系统文件
            "handler": lambda: PermissionResultDeny("不许写系统目录")
        }
    ]
}
```

### 3. 通过 Permission Mode 控制审批流程

```python
permission_mode = "default"  # 危险操作需要批准
permission_mode = "acceptEdits"  # 文件编辑自动批准
permission_mode = "bypassPermissions"  # 全部自动批准（危险！）
```

### 4. 禁用某些工具

```python
disallowed_tools = ["WebSearch"]  # 禁止联网搜索
```

---

## 对比：Claude Code CLI vs 这个项目

| 特性 | Claude Code CLI（你直接用） | 这个项目 |
|------|---------------------------|---------|
| **基础工具** | Read/Write/Edit/Bash/Glob/Grep | ✅ 完全一样 |
| **MCP 支持** | 需要手动配置 ~/.mcp.json | ✅ 自动配置（更多！） |
| **公司内部工具** | ❌ 没有 | ✅ ai24/confluence/context1 等 |
| **Session 持久化** | ❌ CLI 重启就丢 | ✅ 持久化到磁盘 |
| **多机协同** | ❌ 不支持 | ✅ Redis Pub/Sub |
| **消息上报** | ❌ 只有本地日志 | ✅ 实时上报到管理平台 |
| **OpenSpec 集成** | ❌ 需要手动写 prompt | ✅ 内置模板 |
| **Token 管理** | ❌ 手动 /compact | ✅ 自动检测 85% 压缩 |

**结论：这个项目的 Claude 能力 >= Claude Code CLI，而不是更少！**

---

## 总结

### 你的三个误解

1. ❌ **误解：** "项目里的 Claude 用不了工具"  
   ✅ **真相：** 完全可以用，而且比直接用 CLI 工具还多

2. ❌ **误解：** "自由发挥就是瞎搞"  
   ✅ **真相：** 自由发挥是指"在你给的工具范围内，Claude 自己决定怎么完成任务"

3. ❌ **误解：** "看不到工具调用就是没调用"  
   ✅ **真相：** 工具调用在消息流里，要看日志才能看到

### 核心要点

```
你的代码（ClaudeAgentSDKService）
    ↓  配置
┌────────────────────────────────┐
│ Claude Agent SDK               │
│                                │
│ 工具箱:                         │
│ ✅ Read/Write/Edit/Bash        │
│ ✅ Glob/Grep/LSP               │
│ ✅ MCP: figma/mastergo         │
│ ✅ MCP: ai24/confluence        │
│ ✅ MCP: context1/data-factory  │
│                                │
│ Claude 自己决定:                │
│ - 什么时候调哪个工具            │
│ - 调用的顺序                   │
│ - 工具的参数                   │
└────────────────────────────────┘
    ↓  消息流
你的代码接收:
    ToolUseBlock: Glob(...)
    ToolResultBlock: "结果..."
    ToolUseBlock: mcp__ai24__query(...)
```

**所以：** 项目里的 Claude 不是"受限版"，而是"增强版"！

---

## 实际验证方法

想看 Claude 到底调了哪些工具？试试这个：

```bash
# 1. 启动服务
./start.sh

# 2. 发起一个任务
curl -X POST http://localhost:8080/task/perform \
  -H "Content-Type: application/json" \
  -d '{"dep_id": "xxx"}'

# 3. 查看日志（你会看到大量工具调用）
tail -f logs/event_messages/task_xxx.jsonl | grep "tool_use"
```

你会看到类似：
```json
{"event": "tool_use", "tool": "Glob", "input": {...}}
{"event": "tool_result", "tool": "Glob", "output": "..."}
{"event": "tool_use", "tool": "Read", "input": {...}}
{"event": "tool_use", "tool": "mcp__ai24__query_tech_design", ...}
```

**这就是 Claude 在"自由发挥"地使用工具！**
