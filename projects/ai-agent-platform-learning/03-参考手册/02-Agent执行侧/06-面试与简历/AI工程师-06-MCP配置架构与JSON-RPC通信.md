# AI工程师面试准备 - MCP配置架构与JSON-RPC通信协议

> 学习日期：2026-07-15
> 主题：深入理解MCP的配置层作用和JSON-RPC通信机制

---

## 📋 学习目标

1. 理解MCP三层架构的设计原理
2. 掌握MCP配置层的作用和必要性
3. 深入理解JSON-RPC 2.0协议在MCP中的应用
4. 掌握STDIO和HTTP两种传输方式
5. 理解装饰器模式在MCP服务端的路由机制

---

## 一、MCP配置架构深度解析

### 1.1 核心困惑

**问题**：为什么MCP工具实现好了，还需要配置层？SDK不能直接调用吗？

**答案**：MCP采用三层架构，配置层是连接服务实现和SDK的关键桥梁。

### 1.2 三层架构详解

```
┌─────────────────────────────────────────────────────┐
│  第1层：MCP 服务实现层                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  • Python/Node.js实现的具体工具                      │
│  • 例如：step_planner.py, dep_mcp.py               │
│  • 实现@app.list_tools()和@app.call_tool()         │
│  • 包含业务逻辑代码                                  │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│  第2层：MCP 配置层                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  • .mcp.json 文件或 mcp_servers 参数                │
│  • 告诉SDK：服务在哪、怎么启动、需要什么环境          │
│  • 类似"通讯录" - 记录服务的地址和启动方式            │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│  第3层：Claude SDK 集成层                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  • create_client() 读取配置                         │
│  • 根据配置启动MCP服务（子进程或HTTP连接）            │
│  • 初始化连接、获取工具列表、调用工具                 │
└─────────────────────────────────────────────────────┘
```

### 1.3 为什么需要配置层？

#### 类比1：餐厅点餐系统

| 层次 | 餐厅角色 | MCP对应 | 职责 |
|------|---------|---------|------|
| 第1层 | 厨房（厨师） | MCP服务实现 | 会做菜（实现工具功能） |
| 第2层 | 菜单 | MCP配置 | 告诉顾客有什么菜、怎么点 |
| 第3层 | 服务员 | Claude SDK | 拿着菜单接单，转给厨房 |

**如果没有菜单会怎样？**
- 顾客不知道有什么菜
- 不知道菜怎么做
- 不知道价格和材料

#### 类比2：手机联系人

| 场景 | 说明 |
|------|------|
| 联系人（配置） | 张三：138xxxx，微信：zhangsan |
| 没有联系人 | 你知道张三存在，但不知道怎么联系他 |
| SDK的困境 | 知道step_planner工具存在，但不知道在哪、怎么启动 |

### 1.4 配置文件示例

#### 本地STDIO服务配置

```json
{
  "mcpServers": {
    "step_planner": {
      "command": "python",
      "args": ["-m", "step_planner"],
      "env": {
        "DEP_API_KEY": "your-api-key",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

**配置说明**：
- `step_planner`：服务名称（SDK用这个名字引用）
- `command`：启动命令（python、node、uv等）
- `args`：命令参数（模块名、脚本路径等）
- `env`：环境变量（API密钥、配置等）

#### 远程HTTP服务配置

```json
{
  "mcpServers": {
    "dep_platform": {
      "url": "https://dep.example.com/mcp",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}
```

**配置说明**：
- `url`：远程服务地址
- `headers`：HTTP请求头（认证信息）

### 1.5 配置层的三大作用

#### 1. 灵活性

```python
# 开发环境
mcp_servers = {
    "step_planner": {
        "command": "python",
        "args": ["-m", "step_planner_dev"],
        "env": {"API_URL": "http://localhost:8080"}
    }
}

# 生产环境
mcp_servers = {
    "step_planner": {
        "url": "https://prod-mcp.example.com",
        "headers": {"Authorization": "Bearer prod-token"}
    }
}
```

#### 2. 可维护性

```
修改工具实现 ≠ 修改配置
- 升级Python版本：只改command
- 切换服务地址：只改url
- 添加新服务：追加配置项
```

#### 3. 环境隔离

```
同一份代码，不同环境配置：
- 本地开发：STDIO本地服务
- 测试环境：HTTP测试服务器
- 生产环境：HTTP生产服务器 + 认证
```

---

## 二、JSON-RPC 2.0 通信协议

### 2.1 为什么需要JSON-RPC？

**核心问题**：SDK和MCP服务是两个独立进程，需要标准化通信协议。

**JSON-RPC解决的问题**：
1. 统一的消息格式（请求/响应）
2. 错误处理标准
3. 异步调用支持（请求ID匹配）
4. 跨语言兼容（JSON格式）

### 2.2 基本格式

#### 请求格式

```json
{
  "jsonrpc": "2.0",           // 协议版本（固定值）
  "id": 1,                     // 请求编号（用于匹配响应）
  "method": "tools/list",      // 调用的方法名
  "params": {                  // 方法参数（可选）
    "key": "value"
  }
}
```

#### 成功响应格式

```json
{
  "jsonrpc": "2.0",
  "id": 1,                     // 对应请求的id
  "result": {                  // 返回结果
    "data": "..."
  }
}
```

#### 错误响应格式

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,            // 错误代码
    "message": "Invalid params", // 错误消息
    "data": {                  // 额外错误信息（可选）
      "detail": "..."
    }
  }
}
```

### 2.3 MCP标准方法

| 方法 | 作用 | 调用时机 | 返回内容 |
|------|------|---------|---------|
| `initialize` | 握手连接 | SDK启动时 | 服务器信息、支持的能力 |
| `tools/list` | 获取工具列表 | 初始化后 | 所有可用工具的定义 |
| `tools/call` | 调用工具 | Agent决策后 | 工具执行结果 |
| `resources/list` | 获取资源列表 | 需要时 | 可用资源 |
| `resources/read` | 读取资源 | 需要时 | 资源内容 |
| `prompts/list` | 获取提示列表 | 需要时 | 可用提示模板 |
| `prompts/get` | 获取提示 | 需要时 | 提示内容 |

### 2.4 完整通信流程示例

#### 阶段1：建立连接（initialize）

**SDK → MCP服务**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": {
        "listChanged": true
      }
    },
    "clientInfo": {
      "name": "claude-sdk",
      "version": "1.0.0"
    }
  }
}
```

**MCP服务 → SDK**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "step_planner",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": {}
    }
  }
}
```

**含义**：握手成功，双方确认协议版本和支持的能力。

---

#### 阶段2：获取工具列表（tools/list）

**SDK → MCP服务**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

**MCP服务 → SDK**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "create_plan",
        "description": "创建任务执行计划，将复杂任务拆解为可执行步骤",
        "inputSchema": {
          "type": "object",
          "properties": {
            "task": {
              "type": "string",
              "description": "要规划的任务描述"
            }
          },
          "required": ["task"]
        }
      },
      {
        "name": "get_plan_status",
        "description": "查询任务计划的执行状态",
        "inputSchema": {
          "type": "object",
          "properties": {
            "plan_id": {
              "type": "string",
              "description": "计划ID"
            }
          },
          "required": ["plan_id"]
        }
      }
    ]
  }
}
```

**含义**：SDK获取到2个工具，知道了每个工具的名称、描述和参数要求。

---

#### 阶段3：调用工具（tools/call）

**SDK → MCP服务**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "create_plan",
    "arguments": {
      "task": "实现用户登录功能"
    }
  }
}
```

**MCP服务 → SDK**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"plan_id\": \"plan_123\", \"steps\": [{\"step\": 1, \"action\": \"设计数据库表结构\", \"estimated_time\": \"1h\"}, {\"step\": 2, \"action\": \"实现用户注册API\", \"estimated_time\": \"2h\"}, {\"step\": 3, \"action\": \"实现登录API和JWT生成\", \"estimated_time\": \"2h\"}, {\"step\": 4, \"action\": \"添加单元测试\", \"estimated_time\": \"1h\"}]}"
      }
    ]
  }
}
```

**含义**：工具执行成功，返回了包含4个步骤的任务计划。

**重要细节**：
- `result.content` 是数组（支持多种内容类型）
- `text` 字段是 JSON 字符串（需要二次解析）

---

#### 阶段4：查询状态

**SDK → MCP服务**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "get_plan_status",
    "arguments": {
      "plan_id": "plan_123"
    }
  }
}
```

**MCP服务 → SDK**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"plan_id\": \"plan_123\", \"status\": \"in_progress\", \"completed_steps\": 2, \"total_steps\": 4}"
      }
    ]
  }
}
```

---

#### 阶段5：错误处理

**SDK → MCP服务**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "invalid_tool",
    "arguments": {}
  }
}
```

**MCP服务 → SDK**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": {
      "tool": "invalid_tool",
      "available_tools": ["create_plan", "get_plan_status"]
    }
  }
}
```

### 2.5 标准错误代码

| 错误代码 | 错误名称 | 含义 | 示例 |
|---------|---------|------|------|
| -32700 | Parse error | 无效的JSON | 格式错误的请求 |
| -32600 | Invalid Request | 不符合JSON-RPC规范 | 缺少jsonrpc字段 |
| -32601 | Method not found | 方法不存在 | 调用不存在的工具 |
| -32602 | Invalid params | 参数错误 | 缺少必需参数 |
| -32603 | Internal error | 内部错误 | 服务器崩溃 |

---

## 三、传输方式对比

### 3.1 STDIO传输（本地服务）

#### 架构图

```
┌─────────────────┐                    ┌─────────────────┐
│   Claude SDK    │                    │  MCP Server     │
│                 │                    │  (子进程)        │
│                 │  ──── stdin ────→  │                 │
│                 │                    │                 │
│                 │  ←─── stdout ────  │                 │
└─────────────────┘                    └─────────────────┘

传输格式：每行一个JSON对象
{"jsonrpc":"2.0","id":1,"method":"initialize",...}\n
{"jsonrpc":"2.0","id":1,"result":{...}}\n
```

#### 特点

| 特性 | 说明 |
|------|------|
| 启动方式 | SDK启动MCP服务作为子进程 |
| 通信方式 | 管道（pipe）传输 |
| 消息格式 | 每行一个JSON对象（换行符分隔） |
| 生命周期 | 随SDK进程存在 |
| 适用场景 | 本地工具、快速原型 |

#### 配置示例

```json
{
  "mcpServers": {
    "local_tool": {
      "command": "python",
      "args": ["-m", "my_mcp_server"]
    }
  }
}
```

---

### 3.2 HTTP + SSE传输（远程服务）

#### 架构图

```
┌─────────────────┐                    ┌─────────────────┐
│   Claude SDK    │                    │  Remote MCP     │
│                 │                    │  Server         │
│                 │ ─── HTTP POST ──→  │                 │
│                 │     (请求)          │                 │
│                 │                    │                 │
│                 │ ←─── SSE ─────────  │                 │
│                 │     (响应/事件)      │                 │
└─────────────────┘                    └─────────────────┘

SSE格式：
data: {"jsonrpc":"2.0","id":1,"result":{...}}\n\n
```

#### 特点

| 特性 | 说明 |
|------|------|
| 通信方式 | HTTP请求 + SSE长连接 |
| 认证 | HTTP Headers（Bearer Token） |
| 连接保持 | SSE自动重连 |
| 适用场景 | 远程服务、多客户端共享 |

#### SSE（Server-Sent Events）

**什么是SSE？**
- 服务器主动推送事件到客户端
- 基于HTTP的单向长连接
- 自动重连机制
- 适合实时通知场景

**SSE消息格式**：
```
data: {"jsonrpc":"2.0","id":3,"result":{...}}\n
\n
data: {"jsonrpc":"2.0","method":"notifications/progress",...}\n
\n
```

#### 配置示例

```json
{
  "mcpServers": {
    "remote_tool": {
      "url": "https://mcp.example.com",
      "headers": {
        "Authorization": "Bearer sk-xxx"
      }
    }
  }
}
```

---

## 四、MCP服务端实现

### 4.1 装饰器模式：自动路由

**核心思想**：用装饰器注册处理函数，框架自动完成JSON-RPC路由。

#### 完整示例

```python
from mcp.server import Server
from mcp.types import Tool, TextContent
import json

# 创建服务器实例
app = Server("step_planner")

# 注册工具列表处理器
@app.list_tools()
async def list_tools() -> list[Tool]:
    """
    当收到 {"method": "tools/list"} 请求时，
    框架自动调用这个函数
    """
    return [
        Tool(
            name="create_plan",
            description="创建任务执行计划",
            inputSchema={
                "type": "object",
                "properties": {
                    "task": {
                        "type": "string",
                        "description": "任务描述"
                    }
                },
                "required": ["task"]
            }
        ),
        Tool(
            name="get_plan_status",
            description="查询计划状态",
            inputSchema={
                "type": "object",
                "properties": {
                    "plan_id": {"type": "string"}
                },
                "required": ["plan_id"]
            }
        )
    ]

# 注册工具调用处理器
@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """
    当收到 {"method": "tools/call"} 请求时，
    框架自动调用这个函数
    """
    if name == "create_plan":
        task = arguments["task"]
        
        # 执行业务逻辑
        plan = {
            "plan_id": "plan_123",
            "steps": [
                {"step": 1, "action": "设计数据库"},
                {"step": 2, "action": "实现API"}
            ]
        }
        
        # 返回TextContent列表
        return [TextContent(
            type="text",
            text=json.dumps(plan)
        )]
    
    elif name == "get_plan_status":
        plan_id = arguments["plan_id"]
        
        status = {
            "plan_id": plan_id,
            "status": "in_progress",
            "completed_steps": 1,
            "total_steps": 2
        }
        
        return [TextContent(
            type="text",
            text=json.dumps(status)
        )]
    
    else:
        raise ValueError(f"Unknown tool: {name}")

# 启动服务器
if __name__ == "__main__":
    import asyncio
    from mcp.server.stdio import stdio_server
    
    async def main():
        async with stdio_server() as (read_stream, write_stream):
            await app.run(
                read_stream,
                write_stream,
                app.create_initialization_options()
            )
    
    asyncio.run(main())
```

### 4.2 装饰器的工作原理

```python
# 装饰器注册流程
@app.list_tools()
def handler():
    ...

# 等价于
handler = app.list_tools()(handler)
app._handlers["tools/list"] = handler

# 收到请求时
incoming_request = {"jsonrpc": "2.0", "method": "tools/list", ...}
method = incoming_request["method"]  # "tools/list"
handler = app._handlers[method]      # 找到注册的函数
result = await handler()             # 调用函数
response = {
    "jsonrpc": "2.0",
    "id": incoming_request["id"],
    "result": result
}
```

### 4.3 为什么返回 list[TextContent]？

**MCP协议要求**：支持多种内容类型

```python
# 返回文本
return [TextContent(type="text", text="结果")]

# 返回多个内容
return [
    TextContent(type="text", text="步骤1完成"),
    ImageContent(type="image", data="base64..."),
    TextContent(type="text", text="步骤2完成")
]

# 返回资源引用
return [
    TextContent(type="text", text="详见日志"),
    ResourceContent(type="resource", uri="file:///log.txt")
]
```

---

## 五、关键知识点总结

### 5.1 MCP配置架构

✅ **三层架构**：服务实现 → 配置层 → SDK集成  
✅ **配置作用**：告诉SDK服务在哪、怎么启动  
✅ **灵活性**：同一服务，不同环境不同配置  
✅ **类比**：配置 = 通讯录/菜单  

### 5.2 JSON-RPC协议

✅ **标准格式**：`{jsonrpc, id, method, params/result/error}`  
✅ **请求ID**：用于匹配异步响应  
✅ **MCP方法**：initialize, tools/list, tools/call等  
✅ **错误处理**：标准错误代码（-32xxx）  

### 5.3 传输方式

✅ **STDIO**：本地子进程，管道通信，每行一个JSON  
✅ **HTTP+SSE**：远程服务，HTTP请求+SSE推送  
✅ **选择依据**：本地用STDIO，远程用HTTP  

### 5.4 装饰器模式

✅ **自动路由**：`@app.list_tools()` 注册处理函数  
✅ **框架处理**：自动解析JSON-RPC，调用对应函数  
✅ **返回格式**：`list[TextContent]` 支持多内容类型  

---

## 六、面试要点

### 6.1 设计思路类问题

**Q: 为什么MCP需要配置层？**

A: 三个原因：
1. **灵活性** - 同一服务支持多种部署方式（本地/远程）
2. **可维护性** - 修改服务地址无需改代码
3. **环境隔离** - 开发/测试/生产用不同配置

**Q: JSON-RPC在MCP中解决了什么问题？**

A: 
1. 统一通信格式（跨语言兼容）
2. 标准错误处理（错误代码规范）
3. 异步调用支持（请求ID匹配）
4. 方法路由机制（method字段）

### 6.2 技术实现类问题

**Q: STDIO和HTTP传输有什么区别？**

A:
- **STDIO**: 本地子进程，管道通信，生命周期随SDK
- **HTTP**: 远程服务，长连接推送，支持多客户端

**Q: 装饰器是如何实现自动路由的？**

A:
1. 装饰器注册时保存 `method → handler` 映射
2. 收到请求时解析 `method` 字段
3. 查找对应 `handler` 并调用
4. 将返回值包装成JSON-RPC响应

### 6.3 实战场景类问题

**Q: 如果MCP工具调用失败，如何排查？**

A: 三步排查：
1. 检查配置层：路径、命令、环境变量是否正确
2. 检查JSON-RPC日志：请求格式、参数是否符合要求
3. 检查服务实现：业务逻辑是否正确

**Q: 如何实现一个新的MCP工具？**

A: 四步实现：
1. 定义Tool（name, description, inputSchema）
2. 实现@app.list_tools()返回工具定义
3. 实现@app.call_tool()执行业务逻辑
4. 配置到.mcp.json，SDK启动测试

---

## 七、下一步学习方向

1. **SSE长连接机制** - 深入理解HTTP MCP的实时通信
2. **实战：开发自定义MCP工具** - 动手实践完整流程
3. **错误处理和重试机制** - 生产环境的健壮性
4. **Prompt Engineering** - 优化Agent的工具调用决策
5. **Langfuse可观测性** - 监控Token消耗和调用链路

---

**学习笔记结束** 📝
