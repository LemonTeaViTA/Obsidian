---
module: Agent
tags: [Agent, MCP, Server, Implementation]
difficulty: hard
last_reviewed: 2026-06-01
---

# MCP 服务端开发

> 本文聚焦 ==MCP Server 的实现细节==：如何注册工具、处理调用、管理生命周期。架构概念见 [[MCP 协议概述]]，生态与主流 Server 见 [[MCP Server 生态]]，安全模型见 [[MCP 安全模型]]。

---

## 一、写一个最简 MCP Server

==用 Python SDK 几十行就能写一个==。下面是个完整的"hello world"——暴露一个 `read_file` 工具：

```python
# server.py
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

app = Server("my-file-server")

# 1. 注册工具
@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="read_file",
            description="读取文件内容",
            inputSchema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件路径"}
                },
                "required": ["path"]
            }
        )
    ]

# 2. 实现工具调用
@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "read_file":
        with open(arguments["path"]) as f:
            return [TextContent(type="text", text=f.read())]
    raise ValueError(f"未知工具：{name}")

# 3. 启动 stdio 服务
if __name__ == "__main__":
    import asyncio

    async def main():
        # stdio_server() 是 async context manager，返回 (read, write) 流
        async with stdio_server() as (read, write):
            await app.run(read, write, app.create_initialization_options())

    asyncio.run(main())
```

> [!note] ==启动写法==：MCP Python SDK 的 `stdio_server()` 是 async context manager，要 `async with ... as (read, write)` 拿到读写流，再 `await app.run(read, write, app.create_initialization_options())`。不能直接 `asyncio.run(stdio_server(app))`——那不是 SDK 的真实签名。

### 给 Claude Desktop 挂载

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "my-file-server": {
      "command": "python",
      "args": ["/path/to/server.py"]
    }
  }
}
```

重启 Claude Desktop，==`read_file` 工具就出现在 LLM 可用工具列表里==。

### 整个链路

```
Claude Desktop 启动
   ↓ 读 config 发现 my-file-server
   ↓ 启动 Python 子进程，stdio 连接
   ↓ 发 list_tools 请求 → Server 返回工具 schema
   ↓ Claude Desktop 把 schema 塞进 LLM 的 tools 参数
LLM 输出 tool_calls: read_file({"path": "..."})
   ↓ Claude Desktop 通过 Client → JSON-RPC 转发到 Server
   ↓ Server 执行 open() 读文件
   ↓ 结果回传给 LLM 作为 tool 消息
```

---

## 二、Server 生命周期与 initialize 握手

==Server 不是说挂就能用==——MCP 协议规定了==`initialize` 握手==流程，且 server 启动可能很慢（chrome-devtools 启动 Chromium 要 1-3s，远程 server 还要握手 + TLS）。

### initialize 握手协议

==stdio server 启动后第一条消息==：

```
1. Host → Server:
   { "jsonrpc": "2.0", "id": 1, "method": "initialize",
     "params": {
       "protocolVersion": "2025-06-18",
       "capabilities": { "roots": {...}, "sampling": {...} },
       "clientInfo": { "name": "paicli", "version": "1.0" }
     } }

2. Server → Host:
   { "jsonrpc": "2.0", "id": 1, "result": {
       "protocolVersion": "2025-06-18",
       "capabilities": {
         "tools": { "listChanged": true },     # ← 声明支持哪些 capability
         "resources": { "listChanged": true, "subscribe": true },
         "prompts": {}
       },
       "serverInfo": { "name": "chrome-devtools-mcp", "version": "1.2.0" }
     } }

3. Host → Server:
   { "jsonrpc": "2.0", "method": "notifications/initialized" }  # ★ 完成握手
```

==握手完成后才能调 list_tools==——==没握手就调用是协议违规==，server 行为未定义。

### Server 状态机

```
[init] ──spawn─→ [starting] ──握手成功─→ [ready] ──crash─→ [failed]
                     │                       │             ↑
                     └──60s 超时──→ [failed] │             │
                                              └──disconnect─┘
```

### 生产环境：异步启动

==错误做法==（同步串行启动）：

```python
def start_all_servers():
    for cfg in mcp_configs:
        client = start_server(cfg)
        client.initialize()  # ← 阻塞等握手
        client.list_tools()  # ← 阻塞等工具列表
    # ★ 5 个 server,每个 2s,CLI 启动等 10s——用户劝退
```

==生产做法==（异步并发 + 首屏不阻塞）：

```python
async def start_all_servers_async():
    # 1. 同时启动所有 server,各自异步握手
    tasks = [asyncio.create_task(init_server(cfg)) for cfg in mcp_configs]

    # 2. CLI 首屏只等 8 秒——不等的 server 进 starting 状态
    done, pending = await asyncio.wait(tasks, timeout=8)

    for task in done:
        server = task.result()
        host.register_server(server)  # 已启动 → 注册到 LLM tools

    for task in pending:
        # ★ 没启动完的不取消,后台继续 + 标记 starting
        host.mark_pending(task)

    # 3. CLI 进入交互(用户能用已启动的 server)

async def init_server(cfg):
    # initialize 握手单独超时(60s)——比首屏 8s 长得多,慢 server 不会被错杀
    return await asyncio.wait_for(
        do_initialize(cfg), timeout=60
    )
```

==两层超时设计==：

| 超时 | 时长 | 作用 |
|------|------|------|
| ==CLI 首屏等待== | 8 秒 | 用户体验上限——超过就让用户先用 |
| ==Server initialize== | 60 秒 | 协议级超时——超过判定 server 故障 |

---

## 三、健康检查与自动重启

==生产 Host 必做==：

| 机制 | 实现 |
|------|------|
| ==心跳检查== | 每 30s 发 `ping` JSON-RPC（部分 server 支持），无响应判定挂掉 |
| ==自动重启== | 进程崩溃 / stdin 断开 → 自动 spawn 新进程，==指数退避==（1s / 5s / 30s / 5min） |
| ==重启次数上限== | 5 分钟内重启 ≥ 5 次 → 进入 `failed` 状态，==不再自动重启==（避免疯狂重启） |
| ==手动重启== | `/mcp restart <name>` 命令重置重启计数器 |

==失败 server 不阻塞其他 server==——独立进程是 MCP 的核心安全特性（参考 [[MCP 安全模型#一、三道安全关卡]]）。

### Host 状态展示示例

```
$ /mcp
filesystem        ready    24 tools, 2 resources    started 12s ago
github            ready    18 tools                 started 15s ago
chrome-devtools   starting (Chromium 启动中...)     waited 3s / 60s
slack             failed   ECONNREFUSED                 retry in 30s
```

---

## 四、Resources 与 Prompts 实现

除了 Tools，Server 还能暴露 Resources（只读数据）和 Prompts（模板）。

### 注册 Resources

```python
from mcp.types import Resource

@app.list_resources()
async def list_resources() -> list[Resource]:
    return [
        Resource(
            uri="file:///workspace/README.md",
            name="README",
            mimeType="text/markdown"
        ),
        Resource(
            uri="db://users/schema",
            name="Users Table Schema",
            mimeType="application/json"
        )
    ]

@app.read_resource()
async def read_resource(uri: str) -> str:
    if uri.startswith("file://"):
        path = uri[7:]  # 去掉 file://
        with open(path) as f:
            return f.read()
    elif uri == "db://users/schema":
        return json.dumps({"columns": ["id", "name", "email"]})
    raise ValueError(f"未知资源：{uri}")
```

### 注册 Prompts

```python
from mcp.types import Prompt, PromptArgument

@app.list_prompts()
async def list_prompts() -> list[Prompt]:
    return [
        Prompt(
            name="code_review",
            description="审查代码并给出改进建议",
            arguments=[
                PromptArgument(
                    name="code",
                    description="要审查的代码",
                    required=True
                )
            ]
        )
    ]

@app.get_prompt()
async def get_prompt(name: str, arguments: dict) -> str:
    if name == "code_review":
        code = arguments["code"]
        return f"请审查以下代码，给出改进建议：\n\n```\n{code}\n```"
    raise ValueError(f"未知 Prompt：{name}")
```

---

## 五、Streamable HTTP Server 实现

远程 Server 用 Streamable HTTP（单 endpoint `/mcp`）：

```python
from mcp.server.streamable_http import create_streamable_http_app
from starlette.applications import Starlette

app = Server("remote-mcp-server")

# ... 注册工具（同 stdio）

# 启动 HTTP server
http_app: Starlette = create_streamable_http_app(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(http_app, host="0.0.0.0", port=8000)
```

==Client 配置==：

```json
{
  "mcpServers": {
    "remote": {
      "url": "https://mcp.example.com/mcp",
      "headers": { "Authorization": "Bearer xxx" }
    }
  }
}
```

==单 endpoint `/mcp`==：不是老 SSE 方案的 `/sse`。Server 用 `Transfer-Encoding: chunked` 边算边推。

---

## 六、notifications：主动推送能力变更

Server 可以==主动向 Client 推送通知==——告诉 Host"==我的能力变了，需要重新拉一下=="。

### 三个标准 notification

| Notification | 触发场景 | Host 应该做什么 |
|--------------|---------|---------------|
| ==`notifications/tools/list_changed`== | Server 动态加/减工具 | 重新调 `tools/list` 拉最新工具列表，==更新 LLM 的 tools 参数== |
| ==`notifications/resources/list_changed`== | 文件系统/数据库 schema 变化 | 重新拉 resources 列�� |
| ==`notifications/resources/updated`== | 单个 resource 内容变了 | ==失效缓存==，下次读取重新拉 |

### Server 端发送示例

```python
# Server 动态加载了新工具后
await session.send_notification(
    "notifications/tools/list_changed",
    params={}
)

# 文件内容变化
await session.send_notification(
    "notifications/resources/updated",
    params={"uri": "file:///workspace/README.md"}
)
```

==典型应用场景==：
- ==插件热更==——Server 加了新工具，不重启 Host 就能让 LLM 用上
- ==权限动态调整==——用户授权了新 scope，Server 推送新工具
- ==chrome-devtools 这类==——浏览器 tab 变化时推送 `list_changed`，让 LLM 看到的可用 tab 列表实时更新

---

## 七、生产实战：配置文件结构

### Claude Desktop

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/Documents"]
    }
  }
}
```

### Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..." }
    }
  }
}
```

### Claude Code

```bash
# 命令行注册
claude mcp add github -- env GITHUB_TOKEN=$TOKEN npx -y @modelcontextprotocol/server-github
```

### 共同字段

| 字段 | 说明 |
|------|------|
| `command` | 启动 Server 的命令（python / node / npx） |
| `args` | 命令参数（脚本路径 / npm 包名 / 启动参数） |
| `env` | 环境变量（API key / 配置） |
| `cwd` | 工作目录（可选） |

==MCP 生态的运维特点==：用 ==npx==（免装依赖）或 ==Docker==（隔离）启动 Server 是主流做法。

---

## 相关链接

- [[MCP 协议概述]] — 架构、核心概念、与其他协议对比
- [[MCP 客户端集成]] — Host 集成层、Schema 清洗、命名空间
- [[MCP Server 生态]] — 主流 Server 清单 + 浏览器自动化 / CDP
- [[MCP 安全模型]] — 三道安全关卡 / 常见坑 / 审计日志
- [[Function Calling]] — LLM 协议层
- [[Coding Agent 工具集]] — 具体提供的工具集
