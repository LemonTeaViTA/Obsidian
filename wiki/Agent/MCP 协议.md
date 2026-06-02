---
module: Agent
tags: [Agent, MCP, Tool Use, Anthropic, JSON-RPC]
difficulty: hard
last_reviewed: 2026-06-01
---

# MCP 协议（Model Context Protocol）

> MCP 是 Anthropic 2024 年 11 月推出的==工具接入标准协议==，相当于 AI 世界的"USB 接口"。==2026 年已成为事实标准==——Claude、Cursor、Windsurf、VS Code、OpenAI 都已原生支持。
>
> 协议层与 [[Function Calling]] 不同：FC 解决"LLM 怎么表达想调工具"，MCP 解决"工具怎么标准化暴露给 LLM"。两者配合工作。
>
> 与 A2A 协议的对比 + Agent-to-Agent 通信见 §五。

> [!tip] 速览（一分钟读完）
> - ==MCP 解决 M×N 困境==：工具实现一次 MCP 接口，所有支持 MCP 的模型都能调用（M+N）。
> - ==三层架构==：Host（AI 应用）→ Client（每连接一个）→ Server（独立进程，暴露 Tools/Resources/Prompts）。
> - ==三种 transport==：stdio（本地 80%+）/ Streamable HTTP（远程，单 endpoint `POST /mcp`）/ WebSocket（<5%）。老双 endpoint SSE 方案已废弃。
> - ==Host 集成层==是生产关键：`mcp__{server}__{tool}` 命名空间 + Schema 清洗（$ref 内联 / anyOf 简化 / description 截断）+ Resources 包装为虚拟工具 + notifications 热更。
> - ==与 FC 配合==：FC 是 LLM 协议层（怎么表达调用意图），MCP 是工具接入层（工具怎么暴露）；与 A2A 互补（MCP 是"手"，A2A 是"嘴"）。
>
> 本文聚焦协议核心。==生态与主流 Server==（含浏览器自动化 / CDP / isolated-shared）见 [[MCP Server 生态]]；==安全模型==（三道关卡 / 凭证脱敏）见 [[MCP 安全模型]]。

---

## 一、是什么 + 解决什么问题

### 没有 MCP 之前：M × N 困境

```
Claude  ↔ 文件系统适配
Claude  ↔ 数据库适配
Claude  ↔ Slack 适配
GPT-4   ↔ 文件系统适配（重写一遍）
GPT-4   ↔ 数据库适配（重写一遍）
GPT-4   ↔ Slack 适配（重写一遍）
Gemini  ↔ 文件系统适配（再重写）
...
```

==M 个模型 × N 个工具 = M × N 个集成==。==每个工具厂商要为每个 AI 工具单独写适配==，维护成本爆炸。

### MCP 之后：M + N

```
==MCP 协议==
   ↑↓
工具厂商写一次 MCP Server
   ↑↓
所有支持 MCP 的 AI 工具都能调用
   ↑↓
Claude / Cursor / VS Code / Windsurf / Continue ...
```

==M + N 个集成==。==工具只实现一次 MCP 接口==，所有支持 MCP 的模型都能调用。

### 类比：USB 之前 vs 之后

USB 出现前：键盘要配 PS/2 接口、鼠标要配 PS/2 接口、打印机要配并口、扫描仪要配 SCSI——每个外设都有自己的接口。==USB 出现后==：所有外设统一接口，任何电脑都能接入。==MCP 就是 AI 工具的 USB==。

---

## 二、Host / Client / Server 三层架构

MCP 基于 ==JSON-RPC 2.0== 通信，分三层角色：

```
┌──────────────────────────────────────────────────┐
│  Host（AI 应用）                                 │
│  Claude Desktop / Cursor / VS Code / Windsurf    │
│  ↓ 嵌入                                          │
│  MCP Client（每个连接一个）                      │
│  ↓ JSON-RPC over stdio / SSE / WebSocket         │
└──────────────────────────────────────────────────┘
         ↕                  ↕                ↕
   ┌─────────┐       ┌──────────┐      ┌──────────┐
   │ Server 1│       │ Server 2 │      │ Server 3 │
   │ GitHub  │       │ Postgres │      │ Slack    │
   └─────────┘       └──────────┘      └──────────┘
```

### 三个角色

| 角色 | 谁来做 | 干什么 |
|------|-------|-------|
| ==Host== | AI 应用（Claude Desktop / Cursor 等） | 启动 Client、管理用户授权、把工具喂给 LLM |
| ==Client== | Host 内部组件（每个 Server 一个 Client 实例） | 用 JSON-RPC 与 Server 通信 |
| ==Server== | 工具厂商写的独立进程 | 暴露具体能力（工具/资源/Prompt 模板） |

==关键设计==：每个 Server 是==独立进程==——挂了不影响 Host，权限隔离，不同 Server 互不感知。

### Server 提供的三种能力

| 能力 | 说明 | 例子 |
|------|------|------|
| ==Tools== | 可调用的函数（LLM 决定何时调） | `github.create_issue` / `postgres.query` |
| ==Resources== | 可读取的数据（类似只读 API） | `file://README.md` / `db://users/schema` |
| ==Prompts== | 预定义 Prompt 模板（用户主动调用） | `"重构这段代码"` / `"生成单元测试"` |

==Tools 是最常用的==——其他两种生态还在演化中。

### 通信方式：三种 transport

| Transport | 适用 | MCP 占比 |
|-----------|------|------|
| ==stdio==(标准输入输出) | ==本地 Server 进程==——Host 启动子进程 + pipe 通信 | ==80%+== |
| ==Streamable HTTP==（2025 新规范） | ==远程 Server==——单 endpoint POST + chunked 流式响应 | ~15% |
| ==WebSocket== | 远程双向实时通信 | <5%（防火墙问题） |

> [!info] ==stdio / Streamable HTTP / WebSocket 是什么？三者怎么选？==
> 这三个不是 MCP 特有概念——是==操作系统 IPC + 计算机网络协议==的基础知识。==MCP / LSP / gRPC 都用它们做底层传输==。
>
> 完整解释（==类比、消息边界、关键特征、对比表==）见 ==[[计算机网络#五Agent-时代的传输方式stdio--streamable-http--websocket]]==。
>
> ==简单说==：==stdio == 本机父子进程的"传话筒"==；==Streamable HTTP == 浏览器协议的"流式版"==；==WebSocket == 真正的"双向电话"==。

==生产中 stdio 占 80%+==——大部分 MCP Server 是本地工具（filesystem / git / postgres）。==远程 server 走 Streamable HTTP==——典型场景：托管在云端的 SaaS 工具（chrome-devtools 远程实例 / 团队共享的内网 API server）。

#### Streamable HTTP vs 老 SSE：协议演进

==2024 年初版 SSE 方案==（已废弃）：两个 endpoint——`POST /messages` 发请求 + `GET /sse` 接收响应流——==Client 要同时维持两条连接，状态不好对齐==。

==2025 Streamable HTTP==（当前规范）：==单 endpoint==——`POST /mcp` 同时承担请求和流式响应，Server 用 ==`Transfer-Encoding: chunked`== 边算边推。==简化为一条连接==，断线重连容易。

```
Client → POST /mcp { "method": "tools/call", ... }
   ↓
Server → 200 OK, Transfer-Encoding: chunked
         chunk 1: { "type": "progress", ... }
         chunk 2: { "type": "progress", ... }
         chunk N: { "type": "result", ... }
```

==生产实现==（Python SDK 已默认走 Streamable HTTP）：

```python
# 客户端（Host 内部 Client）
from mcp.client.streamable_http import streamablehttp_client

# ★ 单 endpoint /mcp——不是老 SSE 方案的 /sse
async with streamablehttp_client("https://mcp.example.com/mcp") as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tools = await session.list_tools()
```

#### Server 配置示例

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    },
    "chrome-devtools": {
      "url": "https://devtools.example.com/mcp",
      "headers": { "Authorization": "Bearer xxx" }
    }
  }
}
```

> [!note] 上例两个 Server 分别演示两种 transport：`filesystem` 用 `command`（stdio 本地子进程），`chrome-devtools` 用 `url`（Streamable HTTP 远程 server）。

==Host 看 `command` vs `url` 字段判断走哪种 transport==。

---

## 三、写一个最简 MCP Server

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

==给 Claude Desktop 挂载==：

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

==整个链路==：
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

### 3.5 Server 生命周期与异步启动

==Server 不是说挂就能用==——MCP 协议规定了==`initialize` 握手==流程，且 server 启动可能很慢（chrome-devtools 启动 Chromium 要 1-3s，远程 server 还要握手 + TLS）。==生产 Host 必须做异步启动==——否则一个慢 server 拖死整个 CLI 启动。

#### initialize 握手协议

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

#### 异步启动：避免一个慢 server 拖死 CLI

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

#### Server 状态机

```
[init] ──spawn─→ [starting] ──握手成功─→ [ready] ──crash─→ [failed]
                     │                       │             ↑
                     └──60s 超时──→ [failed] │             │
                                              └──disconnect─┘
```

==Host 必须暴露状态==——`/mcp` 命令显示每个 server 的状态：

```
$ /mcp
filesystem        ready    24 tools, 2 resources    started 12s ago
github            ready    18 tools                 started 15s ago
chrome-devtools   starting (Chromium 启动中...)     waited 3s / 60s
slack             failed   ECONNREFUSED                 retry in 30s
```

#### 健康检查 / 重启策略

==生产 Host 必做==：

| 机制 | 实现 |
|------|------|
| ==心跳检查== | 每 30s 发 `ping` JSON-RPC（部分 server 支持），无响应判定挂掉 |
| ==自动重启== | 进程崩溃 / stdin 断开 → 自动 spawn 新进程，==指数退避==（1s / 5s / 30s / 5min） |
| ==重启次数上限== | 5 分钟内重启 ≥ 5 次 → 进入 `failed` 状态，==不再自动重启==（避免疯狂重启） |
| ==手动重启== | `/mcp restart <name>` 命令重置重启计数器 |

==失败 server 不阻塞其他 server==——独立进程是 MCP 的核心安全特性（参考 [[MCP 安全模型#一、三道安全关卡]]）。

---

## 四、Host 集成层：MCP → LLM tools 的转换与维护

==Server 端写完了==只是一半工作——==Host 端要把 MCP server 的 tools 喂给 LLM==，中间有几个生产必踩的工程细节，wiki 之前没专门讲过。

### 4.1 工具命名空间：`mcp__{server}__{tool}` 前缀

==问题==：挂多个 MCP server 时，==容易出现同名工具==——`github` server 和 `gitlab` server 都有 `create_issue`，==LLM 调用会冲突==。

==生产解决方案==（Claude Code / Cursor / 主流 Coding Agent 都这么做）：==Host 在注册到 LLM 时给每个工具加 `mcp__{server}__{tool}` 前缀==：

```
github MCP server 提供 create_issue
   ↓ Host 注册到 LLM 时改名
LLM 看到的工具名: mcp__github__create_issue

gitlab MCP server 提供 create_issue
   ↓
LLM 看到的工具名: mcp__gitlab__create_issue
```

==三个好处==：
- ==避免命名冲突==——同名工具来自不同 server 时各自独立
- ==让 LLM 一眼看出工具来源==——前缀里写明 server 名，==方便 LLM 判断"这是外挂工具不是内置工具"==
- ==审计追踪== ——日志里看到 `mcp__github__create_issue` 立刻知道走的是 github MCP server

==实现==：

```python
def register_mcp_tools(host_tools: list, server_name: str, server_tools: list):
    for tool in server_tools:
        host_tools.append({
            "name": f"mcp__{server_name}__{tool.name}",  # ← 加前缀
            "description": tool.description,
            "input_schema": clean_schema(tool.inputSchema)  # ← 见 4.2
        })
```

==调用时反向解析==：LLM 输出 `tool_call: mcp__github__create_issue` → Host 拆出 server 名 `github` 和工具名 `create_issue` → 走对应的 Client 转发。

### 4.2 Schema 清洗：从 MCP server 到 LLM tools 的必踩坑

==MCP server 输出的 JSON Schema 不能直接扔给 LLM==——三个常见问题：

| 问题 | 影响 | 处理 |
|------|------|------|
| ==`$ref` 引用== | ==Anthropic Claude 不支持 `$ref`==——直接 400 报错 | ==递归内联展开 `$ref`==，转成扁平 schema |
| ==深层嵌套 `anyOf` / `oneOf`== | OpenAI 对 3 层以上嵌套支持不稳；Anthropic 处理 `oneOf` 行为不一致 | 简化为 `anyOf` 单层，或选最常用分支 |
| ==超长 description== | 占 token + LLM 抓不住重点 | 截断到 ~500 字符，超过的写到 system prompt 里别塞参数说明 |

==实现示例==：

```python
def clean_schema(schema: dict, root: dict = None) -> dict:
    root = root or schema

    # 1. 递归内联 $ref
    if "$ref" in schema:
        ref_path = schema["$ref"].lstrip("#/").split("/")
        resolved = root
        for part in ref_path:
            resolved = resolved[part]
        return clean_schema(resolved, root)

    # 2. 简化 anyOf（取第一个非 null 分支）
    if "anyOf" in schema:
        non_null = [s for s in schema["anyOf"] if s.get("type") != "null"]
        if len(non_null) == 1:
            return clean_schema(non_null[0], root)

    # 3. 截断长 description
    if "description" in schema and len(schema["description"]) > 500:
        schema["description"] = schema["description"][:500] + "..."

    # 4. 递归处理嵌套字段
    if "properties" in schema:
        schema["properties"] = {
            k: clean_schema(v, root) for k, v in schema["properties"].items()
        }

    return schema
```

==踩过这个坑的真实案例==：早期 Claude Code 集成 GitHub MCP server 时，==server 返回的 schema 有 `$ref` 引用==——Anthropic API 直接拒绝，==所有 GitHub 工具调用全失败==。社区花了几个月才规范化"==Host 必须做 schema 清洗=="这条经验。

==生产建议==：==Schema 清洗是 MCP→FC 转换层的标配==——不做就等着 LLM 调用失败率飙到 30%+。

==Schema 清洗与 token 预算的关系==：清洗不只是修复格式错误，==长 description 截断直接减少工具描述占用的 token==。挂 3 个 MCP server 时工具描述可达 12k tokens，清洗后可压到 5k 以内——详见 [[Coding Agent 工具集#66-工具集-token-管理工具描述是隐形的-prompt-成本]]。

### 4.3 Resources 怎么暴露给 LLM：自动注册为虚拟工具

==问题==：MCP 协议里 ==Resources（可读取的数据）和 Tools 是两个不同的能力==——但 ==LLM 只懂 `tool_calls`，不懂 Resources 协议==。==怎么让 LLM 用 Resources？==

==生产普遍方案==：Host 把 Resources 包装成==两个虚拟工具==：

```python
def register_mcp_resources(host_tools: list, server_name: str):
    if not server.has_capability("resources"):
        return

    # 虚拟工具 1：列出所有 resources
    host_tools.append({
        "name": f"mcp__{server_name}__list_resources",
        "description": f"列出 {server_name} 服务器的所有可读资源",
        "input_schema": {"type": "object", "properties": {}}
    })

    # 虚拟工具 2：读取指定 resource
    host_tools.append({
        "name": f"mcp__{server_name}__read_resource",
        "description": f"读取 {server_name} 服务器的指定资源",
        "input_schema": {
            "type": "object",
            "properties": {
                "uri": {"type": "string", "description": "资源 URI，如 file:///workspace/README.md"}
            },
            "required": ["uri"]
        }
    })
```

==LLM 实际使用流程==：

```
LLM: tool_call(mcp__filesystem__list_resources)
   ↓ Host 转发 list_resources JSON-RPC
   ↓ Server 返回 [{ uri: "file:///workspace/README.md", ... }, ...]
   ↓
LLM: tool_call(mcp__filesystem__read_resource, { uri: "file:///workspace/README.md" })
   ↓ Host 转发 read_resource JSON-RPC
   ↓ Server 读取文件返回内容
```

==关键认知==：==Resources 在 LLM 视角下就是两个普通 tool==——这是"==让协议能力对齐 LLM 接口=="的工程妥协，==不是协议本身的设计==。

==同样的处理也适用于 Prompts==：暴露为 `mcp__{server}__list_prompts` + `mcp__{server}__get_prompt` 两个虚拟工具。

### 4.4 notifications：处理工具列表的运行时变化

==MCP 协议特性==：Server 可以==主动向 Client 推送通知==——告诉 Host"==我的能力变了，需要重新拉一下=="。

==三个标准 notification==：

| Notification | 触发场景 | Host 应该做什么 |
|--------------|---------|---------------|
| ==`notifications/tools/list_changed`== | Server 动态加/减工具 | 重新调 `tools/list` 拉最新工具列表，==更新 LLM 的 tools 参数== |
| ==`notifications/resources/list_changed`== | 文件系统/数据库 schema 变化 | 重新拉 resources 列表 |
| ==`notifications/resources/updated`== | 单个 resource 内容变了 | ==失效缓存==，下次读取重新拉 |

==实现==（Host 端被动监听）：

```python
async def handle_notification(notif: Notification):
    if notif.method == "notifications/tools/list_changed":
        # 重新拉工具列表
        new_tools = await client.list_tools()
        host.replace_server_tools(server_name, new_tools)
        # ★ 关键：下一轮 LLM 调用就能看到新工具

    elif notif.method == "notifications/resources/list_changed":
        new_resources = await client.list_resources()
        host.replace_server_resources(server_name, new_resources)

    elif notif.method == "notifications/resources/updated":
        host.invalidate_resource_cache(notif.params["uri"])
```

==典型应用场景==：
- ==插件热更==——Server 加了新工具，不重启 Host 就能让 LLM 用上
- ==权限动态调整==——用户授权了新 scope，Server 推送新工具
- ==chrome-devtools 这类==——浏览器 tab 变化时推送 `list_changed`，让 LLM 看到的可用 tab 列表实时更新

==没处理 notification 的 Host==：用户加了新 MCP 工具==必须重启 Host==才生效——体验差。==生产 Host 都被动监听 notification 实现热更==。

---

## 五、与其他协议的关系（Function Calling / A2A）

### 5.1 与 Function Calling：配合工作的两层

==经常被混在一起，其实是配合工作的两层==：

| 概念 | 层级 | 解决什么 |
|------|------|--------|
| ==Function Calling== | LLM 协议层 | "LLM 怎么表达想调工具"——输出 tool_calls 字段 |
| ==MCP== | 应用 ↔ 工具协议层 | "工具怎么暴露给 LLM"——JSON-RPC 标准化 |

#### 工作流程：两个协议如何衔接

```
1. 启动时：MCP Client 向 Server 请求 list_tools
   → Server 返回 { name, description, inputSchema }

2. Host 把 Server 返回的 schema 转成 ==Function Calling 的 tools 参数==
   → 塞进给 LLM 的请求

3. LLM 看到 tools，决定调用 → 输出 ==Function Calling 的 tool_calls==
   → Host 拿到 tool_calls

4. Host 通过 ==MCP Client 把调用 forward 给 Server==
   → Server 执行 → 返回结果

5. Host 把结果作为 ==Function Calling 的 tool 角色消息==塞回 messages
   → 下一轮 LLM 看到结果
```

==分工清晰==：MCP 负责"==外部工具的标准化暴露与执行=="，Function Calling 负责"==LLM 与工具调用意图的表达=="。两个协议在 ==Host 内部==衔接。

==没有 MCP 也能用 Function Calling==：Coding Agent 的内置工具（read_file 写死在产品代码里的）直接走 FC，不经过 MCP。==MCP 是给"外部、可插拔工具"准备的==。

### 5.2 与 A2A 协议的区别

MCP 和 A2A（Agent-to-Agent）解决的是两个不同层次的问题：

- ==MCP==：Agent ↔ 工具的协议——"一个 Agent 怎么调外部工具"
- ==A2A==：Agent ↔ Agent 的协议（Google 2025 提出）——"多个 Agent 怎么互相调用协作"，尤其跨团队/跨组织

#### A2A 的工作机制

每个 Agent 发布一张==能力名片==（Agent Card）—— JSON 文件声明能做什么、接受什么输入、支持哪些认证：

```json
{
  "name": "CodeReviewAgent",
  "description": "审查代码，输出问题列表和改进建议",
  "capabilities": ["code_review", "security_scan"],
  "endpoint": "https://agents.company.com/code-review",
  "inputSchema": { "type": "object", "properties": { "code": { "type": "string" } } }
}
```

其他 Agent 通过标准 HTTP API 发现并调用它。

#### 单 Agent vs A2A 多 Agent

| 维度 | 单 Agent | A2A 多 Agent |
|------|---------|-------------|
| 能力边界 | 一个 Agent 包揽所有工具和技能 | 每个 Agent 专注一个领域，通过 A2A 组合 |
| 团队协作 | 单团队维护 | 不同团队各自维护自己的 Agent，通过 A2A 互操作 |
| 扩展方式 | 给 Agent 加工具 | 接入新的专业 Agent |
| 故障隔离 | 一个工具挂了影响整体 | 一个 Agent 挂了其他不受影响 |
| 适用规模 | 中小型任务 | 企业级、跨组织复杂任务 |

#### MCP 和 A2A 的互补关系

==完整 Agent 系统两者通常同时存在==：
- 每个 Agent 内部用 ==MCP== 接入工具（文件、数据库、API）
- Agent 之间用 ==A2A== 互相调用（编排者 Agent 调用执行者 Agent）

==类比==：MCP 是 Agent 的"==手=="（操作工具），A2A 是 Agent 的"==嘴=="（和其他 Agent 沟通）。

---

## 六、生产实战：在 Coding Agent 里挂 MCP

### 6.1 Claude Code 挂 MCP

```bash
# 命令行注册
claude mcp add github -- env GITHUB_TOKEN=$TOKEN npx -y @modelcontextprotocol/server-github

# 之后 Claude Code 内可以用 github 提供的所有工具
# 例如：claude -p "查 anthropic 仓库 issue #1234 的最新评论"
```

### 6.2 Cursor 挂 MCP

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

### 6.3 Claude Desktop 挂 MCP

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

### 6.4 配置文件的共同结构

不同 Host 的配置文件格式略有差异，但==共同字段==：

| 字段 | 说明 |
|------|------|
| `command` | 启动 Server 的命令（python / node / npx） |
| `args` | 命令参数（脚本路径 / npm 包名 / 启动参数） |
| `env` | 环境变量（API key / 配置） |
| `cwd` | 工作目录（可选） |

==MCP 生态的运维特点==：用 ==npx==（免装依赖）或 ==Docker==（隔离）启动 Server 是主流做法。

---

## 七、行业现状（2026）

| AI 工具 | 原生支持 MCP | 备注 |
|---------|------------|------|
| Claude Desktop / Code | ✓（Anthropic 自己推） | 全功能支持 |
| Cursor | ✓ | 2025 年加入 |
| Windsurf | ✓ | 2025 年加入 |
| VS Code | ✓ | 通过 GitHub Copilot Chat 集成 |
| Continue | ✓ | 开源插件原生支持 |
| OpenAI ChatGPT | ✓ | 2025 年宣布支持 |
| Gemini | ✓ | 2025 年加入 |

==MCP 已经是事实标准==——面试时强调它是"已落地的行业标准"，不是"实验性协议"。

---

## 相关链接

- [[MCP Server 生态]] — 主流 Server 清单 + 浏览器自动化 / CDP / isolated-shared 工作模式
- [[MCP 安全模型]] — 三道安全关卡 / 常见坑 / 审计日志凭证脱敏
- [[Function Calling]] — LLM 协议层（FC 解决"LLM 怎么调工具"，MCP 解决"工具怎么暴露"）
- [[Coding Agent 工具集]] — Claude Code / Cursor 等具体提供的工具集（含 MCP 动态工具）
- [[Agent 核心概念]] — Agent 整体架构
- [[Harness Engineering]] — 工具集成在 Harness 中的位置
- [[AI 编程工具]] — 主流 Coding Agent 怎么用 MCP
