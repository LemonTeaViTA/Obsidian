---
module: Agent
tags: [Agent, MCP, Client, Integration, Host]
difficulty: hard
last_reviewed: 2026-06-01
---

# MCP 客户端集成

> 本文聚焦 ==Host 端集成 MCP 的工程细节==：如何把 MCP Server 的工具喂给 LLM，中间涉及命名空间、Schema 清洗、Resources 包装、notifications 处理等生产必踩的坑。架构概念见 [[MCP 协议概述]]，Server 实现见 [[MCP 服务端开发]]。

---

## 一、工具命名空间：`mcp__{server}__{tool}` 前缀

### 问题

挂多个 MCP server 时，==容易出现同名工具==——`github` server 和 `gitlab` server 都有 `create_issue`，==LLM 调用会冲突==。

### 生产解决方案

==Claude Code / Cursor / 主流 Coding Agent 都这么做==：==Host 在注册到 LLM 时给每个工具加 `mcp__{server}__{tool}` 前缀==：

```
github MCP server 提供 create_issue
   ↓ Host 注册到 LLM 时改名
LLM 看到的工具名: mcp__github__create_issue

gitlab MCP server 提供 create_issue
   ↓
LLM 看到的工具名: mcp__gitlab__create_issue
```

### 三个好处

- ==避免命名冲突==——同名工具来自不同 server 时各自独立
- ==让 LLM 一眼看出工具来源==——前缀里写明 server 名，==方便 LLM 判断"这是外挂工具不是内置工具"==
- ==审计追踪== ——日志里看到 `mcp__github__create_issue` 立刻知道走的是 github MCP server

### 实现

```python
def register_mcp_tools(host_tools: list, server_name: str, server_tools: list):
    for tool in server_tools:
        host_tools.append({
            "name": f"mcp__{server_name}__{tool.name}",  # ← 加前缀
            "description": tool.description,
            "input_schema": clean_schema(tool.inputSchema)  # ← 见下节
        })
```

### 调用时反向解析

LLM 输出 `tool_call: mcp__github__create_issue` → Host 拆出 server 名 `github` 和工具名 `create_issue` → 走对应的 Client 转发。

```python
def parse_mcp_tool_call(tool_name: str) -> tuple[str, str]:
    if tool_name.startswith("mcp__"):
        parts = tool_name[5:].split("__", 1)  # 去掉 mcp__ 前缀
        if len(parts) == 2:
            return parts[0], parts[1]  # (server_name, tool_name)
    raise ValueError(f"非 MCP 工具：{tool_name}")

# 使用
server_name, tool_name = parse_mcp_tool_call("mcp__github__create_issue")
result = await mcp_clients[server_name].call_tool(tool_name, arguments)
```

---

## 二、Schema 清洗：从 MCP Server 到 LLM tools 的必踩坑

==MCP server 输出的 JSON Schema 不能直接扔给 LLM==——三个常见问题：

| 问题 | 影响 | 处理 |
|------|------|------|
| ==`$ref` 引用== | ==Anthropic Claude 不支持 `$ref`==——直接 400 报错 | ==递归内联展开 `$ref`==，转成扁平 schema |
| ==深层嵌套 `anyOf` / `oneOf`== | OpenAI 对 3 层以上嵌套支持不稳；Anthropic 处理 `oneOf` 行为不一致 | 简化为 `anyOf` 单层，或选最常用分支 |
| ==超长 description== | 占 token + LLM 抓不住重点 | 截断到 ~500 字符，超过的写到 system prompt 里别塞参数说明 |

### 实现示例

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

### 真实案例

早期 Claude Code 集成 GitHub MCP server 时，==server 返回的 schema 有 `$ref` 引用==——Anthropic API 直接拒绝，==所有 GitHub 工具调用全失败==。社区花了几个月才规范化"==Host 必须做 schema 清洗=="这条经验。

### Schema 清洗与 token 预算的关系

清洗不只是修复格式错误，==长 description 截断直接减少工具描述占用的 token==。挂 3 个 MCP server 时工具描述可达 12k tokens，清洗后可压到 5k 以内——详见 [[Coding Agent 工具集#66-工具集-token-管理工具描述是隐形的-prompt-成本]]。

---

## 三、Resources 怎么暴露给 LLM：自动注册为虚拟工具

### 问题

MCP 协议里 ==Resources（可读取的数据）和 Tools 是两个不同的能力==——但 ==LLM 只懂 `tool_calls`，不懂 Resources 协议==。==怎么让 LLM 用 Resources？==

### 生产普遍方案

Host 把 Resources 包装成==两个虚拟工具==：

```python
def register_mcp_resources(host_tools: list, server_name: str, server):
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

### LLM 实际使用流程

```
LLM: tool_call(mcp__filesystem__list_resources)
   ↓ Host 转发 list_resources JSON-RPC
   ↓ Server 返回 [{ uri: "file:///workspace/README.md", ... }, ...]
   ↓
LLM: tool_call(mcp__filesystem__read_resource, { uri: "file:///workspace/README.md" })
   ↓ Host 转发 read_resource JSON-RPC
   ↓ Server 读取文件返回内容
```

### 关键认知

==Resources 在 LLM 视角下就是两个普通 tool==——这是"==让协议能力对齐 LLM 接口=="的工程妥协，==不是协议本身的设计==。

==同样的处理也适用于 Prompts==：暴露为 `mcp__{server}__list_prompts` + `mcp__{server}__get_prompt` 两个虚拟工具。

---

## 四、notifications：处理工具列表的运行时变化

### MCP 协议特性

Server 可以==主动向 Client 推送通知==——告诉 Host"==我的能力变了，需要重新拉一下=="。

### 三个标准 notification

| Notification | 触发场景 | Host 应该做什么 |
|--------------|---------|---------------|
| ==`notifications/tools/list_changed`== | Server 动态加/减工具 | 重新调 `tools/list` 拉最新工具列表，==更新 LLM 的 tools 参数== |
| ==`notifications/resources/list_changed`== | 文件系统/数据库 schema 变化 | 重新拉 resources 列表 |
| ==`notifications/resources/updated`== | 单个 resource 内容变了 | ==失效缓存==，下次读取重新拉 |

### 实现（Host 端被动监听）

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

### 典型应用场景

- ==插件热更==——Server 加了新工具，不重启 Host 就能让 LLM 用上
- ==权限动态调整==——用户授权了新 scope，Server 推送新工具
- ==chrome-devtools 这类==——浏览器 tab 变化时推送 `list_changed`，让 LLM 看到的可用 tab 列表实时更新

### 没处理 notification 的后果

用户加了新 MCP 工具==必须重启 Host==才生效——体验差。==生产 Host 都被动监听 notification 实现热更==。

---

## 五、Client 端异步启动与超时管理

详见 [[MCP 服务端开发#二、Server 生命周期与 initialize 握手]]。关键要点：

### 两层超时设计

| 超时 | 时长 | 作用 |
|------|------|------|
| ==CLI 首屏等待== | 8 秒 | 用户体验上限——超过就让用户先用 |
| ==Server initialize== | 60 秒 | 协议级超时——超过判定 server 故障 |

### 实现要点

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
```

---

## 六、Streamable HTTP Client 集成

远程 Server 走 Streamable HTTP（单 endpoint `/mcp`）：

```python
from mcp.client.streamable_http import streamablehttp_client

# ★ 单 endpoint /mcp——不是老 SSE 方案的 /sse
async with streamablehttp_client("https://mcp.example.com/mcp") as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tools = await session.list_tools()
        
        # 调用工具
        result = await session.call_tool("tool_name", {"arg": "value"})
```

### 与 stdio 的区别

| 维度 | stdio | Streamable HTTP |
|------|-------|-----------------|
| 启动方式 | Host spawn 子进程 | HTTP 连接远程 endpoint |
| 通信 | 标准输入输出 pipe | POST /mcp + chunked 响应 |
| 认证 | 环境变量 / 文件 | HTTP headers（Bearer token） |
| 适用场景 | 本地工具（80%+） | 远程 SaaS / 团队共享服务 |

---

## 七、Client 端完整集成示例

```python
import asyncio
from mcp.client.stdio import stdio_client
from mcp.client.session import ClientSession

async def integrate_mcp_server(config: dict):
    """集成单个 MCP Server"""
    
    # 1. 启动 Client（stdio 或 HTTP）
    if "command" in config:
        # stdio 本地子进程
        async with stdio_client(
            command=config["command"],
            args=config["args"],
            env=config.get("env", {})
        ) as (read, write):
            await run_session(read, write, config["name"])
    
    elif "url" in config:
        # Streamable HTTP 远程服务
        from mcp.client.streamable_http import streamablehttp_client
        async with streamablehttp_client(config["url"]) as (read, write, _):
            await run_session(read, write, config["name"])

async def run_session(read, write, server_name: str):
    """运行 MCP 会话"""
    async with ClientSession(read, write) as session:
        # 2. 握手
        await session.initialize()
        
        # 3. 拉取工具列表
        tools = await session.list_tools()
        
        # 4. Schema 清洗 + 命名空间
        cleaned_tools = []
        for tool in tools:
            cleaned_tools.append({
                "name": f"mcp__{server_name}__{tool.name}",
                "description": tool.description,
                "input_schema": clean_schema(tool.inputSchema)
            })
        
        # 5. 注册到 LLM
        llm_register_tools(cleaned_tools)
        
        # 6. 监听 notifications
        async def notification_handler(notif):
            if notif.method == "notifications/tools/list_changed":
                new_tools = await session.list_tools()
                # ... 重新注册
        
        session.set_notification_handler(notification_handler)
        
        # 7. 等待调用
        while True:
            # LLM 调用工具时
            tool_call = await get_next_tool_call()
            if tool_call["name"].startswith(f"mcp__{server_name}__"):
                _, tool_name = parse_mcp_tool_call(tool_call["name"])
                result = await session.call_tool(tool_name, tool_call["arguments"])
                send_result_to_llm(result)
```

---

## 相关链接

- [[MCP 协议概述]] — 架构、核心概念、与其他协议对比
- [[MCP 服务端开发]] — Server 实现、工具注册、生命周期管理
- [[MCP Server 生态]] — 主流 Server 清单
- [[MCP 安全模型]] — 三道安全关卡 / 审计日志
- [[Coding Agent 工具集]] — token 管理、工具描述优化
- [[Function Calling]] — LLM 协议层
