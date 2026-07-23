# AI工程师面试准备 - MCP 工具开发与集成（代码实现版）

## 📚 学习目标

理解 MCP（Model Context Protocol）工具的完整生命周期：
- **开发视角**：如何开发自定义 MCP 工具（Python 客户端封装）
- **集成视角**：Claude Agent SDK 如何配置和调用 MCP 工具
- **调用流程**：从用户请求到 MCP 工具执行的完整链路

---

## 🗂️ 核心文件路径

| 文件路径 | 核心类/方法 | 职责 |
|---------|-----------|------|
| **mcp_client_wrapper.py:49** | `MCPClientWrapper` | MCP 客户端基类 |
| **mcp_client_wrapper.py:194** | `DEPClient` | DEP 任务系统 MCP 客户端 |
| **mcp_client_wrapper.py:449** | `ConfluenceClient` | Confluence 文档 MCP 客户端 |
| **mcp_client_wrapper.py:474** | `AI24Client` | AI24 平台 MCP 客户端 |
| **claude_agent_sdk_wrapper.py:735** | `_build_mcp_servers()` | 构建 MCP 服务器配置 |
| **claude_agent_sdk_wrapper.py:966** | `_build_options()` 中的 MCP 配置 | 将 MCP 配置注入 SDK Options |
| **external_api_proxy.py:111** | `ManagementApiTool` | HTTP 工具类（非 MCP，直接调用） |

---

## 🔄 完整调用流程图

```
用户发起任务
  ↓
main.py: ExecuteTask.post()
  ↓
claude_agent_sdk_wrapper.py: ClaudeAgentSDKService.query()
  ↓
① _build_options(enable_mcp=True)
  ↓
② _build_mcp_servers(additional_mcp)
  │  - 合并默认 MCP 配置和额外配置
  │  - 动态刷新 Figma access token
  │  - 返回 MCP 服务器配置字典
  ↓
③ ClaudeAgentOptions(mcp_servers=final_mcp_servers)
  ↓
④ ClaudeSDKClient(options=options)
  ↓
⑤ client.query(prompt, session_id)
  ↓
Claude Agent SDK 内部
  ↓
⑥ Claude 决策调用 MCP 工具
  │  Think: "我需要调用 getIssueDetail 工具"
  │  Tool Call: {"name": "getIssueDetail", "arguments": {"issueId": 189002}}
  ↓
⑦ SDK 通过 SSE 连接调用 MCP Server
  │  → http://higress.idcvdian.com/mcp-servers/dep/sse
  │  → POST /call_tool
  │  → { "name": "getIssueDetail", "arguments": {...} }
  ↓
⑧ MCP Server 处理请求
  │  - 调用后端 API
  │  - 返回 JSON 结果
  ↓
⑨ SDK 接收结果并返回给 Claude
  │  Tool Result: {"issueId": 189002, "name": "任务标题", ...}
  ↓
⑩ Claude 继续思考或输出最终结果
```

---

## 💻 代码实现详解

### 1️⃣ MCP 客户端基类：MCPClientWrapper

**文件位置**：`mcp_client_wrapper.py:49-192`

```python
class MCPClientWrapper:
    """MCP客户端封装基类"""

    def __init__(self, endpoint: str, headers: Optional[Dict[str, str]] = None):
        """
        初始化MCP客户端

        Args:
            endpoint: MCP服务器SSE端点地址
            headers: 可选的HTTP请求头（用于鉴权等）
        """
        self.endpoint = endpoint
        self.headers = headers or {}
        self.session = None
        self.exit_stack = None

    async def __aenter__(self):
        """异步上下文管理器入口"""
        from contextlib import AsyncExitStack

        self.exit_stack = AsyncExitStack()
        await self.exit_stack.__aenter__()

        # ① 创建 SSE 客户端（Server-Sent Events 长连接）
        read_stream, write_stream = await self.exit_stack.enter_async_context(
            sse_client(url=self.endpoint)
        )

        # ② 创建 MCP 会话
        self.session = await self.exit_stack.enter_async_context(
            ClientSession(read_stream=read_stream, write_stream=write_stream)
        )

        # ③ 初始化会话（握手）
        await self.session.initialize()

        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器退出"""
        if self.exit_stack:
            await self.exit_stack.__aexit__(exc_type, exc_val, exc_tb)

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        """
        调用MCP工具

        Args:
            name: 工具名称
            arguments: 工具参数

        Returns:
            工具执行结果
        """
        try:
            logger.info(f"调用MCP工具: {name}, 参数: {json.dumps(arguments, ensure_ascii=False)}")
            
            # ④ 调用 MCP 工具
            result = await self.session.call_tool(name=name, arguments=arguments)
            logger.info(f"MCP工具调用成功: {name}")

            # ⑤ 解析返回结果
            if hasattr(result, 'content') and result.content:
                if len(result.content) == 1:
                    content = result.content[0]
                    if hasattr(content, 'text'):
                        text = content.text
                        # 尝试解析为 JSON
                        try:
                            return json.loads(text)
                        except json.JSONDecodeError:
                            # 如果不是 JSON，返回原始文本
                            return text
                    return content
                else:
                    # 多个内容块，返回列表
                    return [c.text if hasattr(c, 'text') else c for c in result.content]

            return result
        except Exception as e:
            logger.error(f"MCP工具调用失败: {name}, 错误: {str(e)}", exc_info=True)
            raise
```

**关键点**：
- **SSE 连接**：使用 Server-Sent Events 协议建立长连接
- **会话管理**：通过 `ClientSession` 管理工具调用会话
- **结果解析**：自动解析 JSON 返回值，兼容文本和结构化数据

---

### 2️⃣ 具体 MCP 客户端实现：DEPClient

**文件位置**：`mcp_client_wrapper.py:194-447`

```python
class DEPClient(MCPClientWrapper):
    """DEP任务系统MCP客户端"""

    DEP_ENDPOINT = "http://higress.idcvdian.com/mcp-servers/dep/sse"

    def __init__(self):
        super().__init__(endpoint=self.DEP_ENDPOINT)

    async def get_issue_detail(self, issue_id: int) -> Dict[str, Any]:
        """
        根据需求id或任务id查询详细信息

        Args:
            issue_id: Issue的唯一ID

        Returns:
            包含Issue详细信息的字典
        """
        result = await self.call_tool(
            name="getIssueDetail",
            arguments={"issueId": issue_id}
        )
        return result

    async def update_issue_detail(
        self,
        issue_id: int,
        tech_creator: Optional[str] = None,
        tech_creator_display_name: Optional[str] = None,
        items: Optional[List[Dict[str, Any]]] = None,
        # ... 其他参数
    ) -> Dict[str, Any]:
        """
        根据任务id更新任务内容

        简化调用示例（仅更新AI任务链接和经办人）：
            await client.update_issue_detail(
                issue_id=123456,
                tech_creator="lizhaoyang",
                tech_creator_display_name="李朝阳",
                items=[{
                    "itemName": "AI软件工厂任务链接",
                    "name": "aiTaskId",
                    "value": "http://xxx/conversations/task_id"
                }]
            )
        """
        # 构建参数字典，只添加非 None 的参数
        arguments = {"issueId": issue_id}
        
        # 映射参数名到后端字段名
        param_mapping = {
            "tech_creator": "techCreator",
            "tech_creator_display_name": "techCreatorDisplayName",
            "items": "items",
            # ...
        }
        
        # 只添加非 None 的参数
        for param_name, backend_name in param_mapping.items():
            value = locals().get(param_name)
            if value is not None:
                arguments[backend_name] = value

        result = await self.call_tool(
            name="updateIssueDetail",
            arguments=arguments
        )
        return result

    async def get_requirement_tasks(self, requirement_id: int) -> List[Dict[str, Any]]:
        """
        根据需求id查询子任务明细
        """
        result = await self.call_tool(
            name="getRequirementTasks",
            arguments={"id": requirement_id}
        )
        return result
```

**关键设计**：
- **继承基类**：复用 SSE 连接和会话管理逻辑
- **类型安全**：使用类型提示确保参数正确
- **灵活参数**：支持只传递需要更新的字段（Optional 参数）

---

### 3️⃣ Claude Agent SDK 中的 MCP 配置

#### 3.1 构建 MCP 服务器配置

**文件位置**：`claude_agent_sdk_wrapper.py:735-764`

```python
def _build_mcp_servers(self, additional_mcp: Optional[Dict] = None) -> Dict[str, Any]:
    """
    构建 MCP 服务器配置

    Args:
        additional_mcp: 本次请求的额外 MCP 配置

    Returns:
        合并后的 MCP 服务器配置
    """
    # ① 如果指定了配置文件路径，直接返回路径
    if self.mcp_config_path:
        return self.mcp_config_path

    # ② 合并默认配置和额外配置
    mcp_config = {**self.mcp_servers_config}
    if additional_mcp:
        mcp_config.update(additional_mcp)

    # ③ 动态刷新 Figma access token
    if self.figma_token_provider and "figma" in mcp_config:
        fresh_token = self.figma_token_provider.get_token()
        if fresh_token:
            mcp_config["figma"] = {
                "type": "http",
                "url": "https://mcp.figma.com/mcp",
                "headers": {"Authorization": f"Bearer {fresh_token}"}
            }

    return mcp_config
```

**MCP 配置格式示例**：

```python
mcp_servers_config = {
    "dep": {
        "type": "http",
        "url": "http://higress.idcvdian.com/mcp-servers/dep/sse"
    },
    "confluence": {
        "type": "http",
        "url": "http://higress.idcvdian.com/mcp-servers/mcp-service-link-confluence/sse"
    },
    "ai24": {
        "type": "http",
        "url": "http://higress.idcvdian.com/mcp-servers/ai24/sse"
    },
    "figma": {
        "type": "http",
        "url": "https://mcp.figma.com/mcp",
        "headers": {"Authorization": "Bearer <dynamic_token>"}
    }
}
```

---

#### 3.2 将 MCP 配置注入 SDK Options

**文件位置**：`claude_agent_sdk_wrapper.py:966-1127`

```python
def _build_options(
    self,
    enable_mcp: bool = True,
    mcp_servers: Optional[Dict] = None,
    **kwargs
) -> ClaudeAgentOptions:
    """构建 ClaudeAgentOptions"""
    
    # ① 构建 MCP 服务器配置
    if enable_mcp:
        final_mcp_servers = self._build_mcp_servers(mcp_servers)
        logger.info(f"[Task {task_id}] 已启用 MCP 服务器")
    else:
        final_mcp_servers = None
        logger.info(f"[Task {task_id}] 已禁用 MCP 服务器")

    # ② 如果 model 以 ccr 开头，移除 zebra-build-deploy MCP
    final_model = model or self.model
    if final_model and final_model.startswith("ccr"):
        if isinstance(final_mcp_servers, dict) and "zebra-build-deploy" in final_mcp_servers:
            final_mcp_servers.pop("zebra-build-deploy")
            logger.info(f"[Task {task_id}] 检测到 model 以 ccr 开头({final_model}), 已移除 zebra-build-deploy MCP")

    # ③ 构建选项
    options = ClaudeAgentOptions(
        # ... 其他配置
        mcp_servers=final_mcp_servers,  # 👈 MCP 配置注入点
        # ...
    )

    return options
```

---

### 4️⃣ 使用示例：便捷函数

**文件位置**：`mcp_client_wrapper.py:728-942`

```python
# 便捷函数：提供更简洁的调用方式
async def get_dep_issue(issue_id: int) -> Dict[str, Any]:
    """
    获取DEP任务详情（便捷函数）

    Example:
        >>> import asyncio
        >>> result = asyncio.run(get_dep_issue(189002))
    """
    async with DEPClient() as client:
        return await client.get_issue_detail(issue_id)


async def get_requirement_tasks(requirement_id: int) -> List[Dict[str, Any]]:
    """
    获取需求的子任务列表（便捷函数）

    Example:
        >>> import asyncio
        >>> tasks = asyncio.run(get_requirement_tasks(189002))
    """
    async with DEPClient() as client:
        return await client.get_requirement_tasks(requirement_id)


async def upload_ai24_document(
    task_id: str,
    content: str,
    document_type: int,
    env: str = "daily"
) -> Dict[str, Any]:
    """
    上传文档报告到AI24平台(便捷函数)

    Args:
        task_id: 任务ID
        content: 文档内容
        document_type: 文档类型(可使用 DocumentType 枚举)
            - 1: 技术方案
            - 2: 测试报告
            - 3: 总结报告
            - 4: 任务清单
            - 5: CR文档
            - 9: PRD文档

    Example:
        >>> import asyncio
        >>> from mcp_client_wrapper import DocumentType
        >>> result = asyncio.run(upload_ai24_document(
        ...     task_id="test_task_123",
        ...     content="# PRD文档\\n\\n这是PRD内容",
        ...     document_type=DocumentType.PRD,  # 9
        ...     env="pre"
        ... ))
    """
    async with AI24Client(env=env) as client:
        return await client.upload_document(
            task_id=task_id,
            content=content,
            document_type=document_type
        )
```

---

## 🔍 MCP vs HTTP 工具对比

| 特性 | MCP 工具 | HTTP 工具（如 ManagementApiTool） |
|------|---------|----------------------------------|
| **协议** | SSE (Server-Sent Events) | HTTP POST/GET |
| **连接方式** | 长连接 | 短连接 |
| **调用方式** | Claude SDK 自动调用 | Python 代码直接调用 |
| **适用场景** | Claude 需要主动调用的工具 | 后台任务、状态上报 |
| **典型示例** | `getIssueDetail`、`uploadDocument` | `report_task_status`、`notify_task_status` |
| **代码位置** | `mcp_client_wrapper.py` | `external_api_proxy.py` |

**HTTP 工具示例**：

```python
class ManagementApiTool:
    """管理接口调用工具类（静态方法，基于 HttpTool）"""

    @staticmethod
    async def report_task_status(
        task_id: str,
        *,
        status: Optional[TaskStatus] = None,
        report_content: Optional[str] = None,
        timeout: float = 5.0,
    ) -> bool:
        """上报任务状态/报告"""
        url = f"{ManagementApiTool._base_url()}/api/task/notify"
        payload: Dict[str, Any] = {
            "taskId": str(task_id),
        }
        
        if status is not None:
            payload["status"] = int(status)
        if report_content is not None:
            payload["reportContent"] = report_content

        try:
            ok, data = await HttpTool.post(url, params=payload, timeout=timeout)
        except Exception as e:
            logger.error(f"[ManagementApiTool] POST {url} raised exception: {e}")
            return False

        return ok
```

**关键区别**：
- **MCP 工具**：Claude 决策后 SDK 自动调用，无需手动编写调用代码
- **HTTP 工具**：Python 代码主动调用，用于后台任务（如状态上报、错误告警）

---

## 🎯 面试核心问答

### Q1: MCP 工具的生命周期是什么？

**A1: 注册 → 配置 → 调用 → 返回**

1. **注册**：在 `ClaudeAgentSDKService.__init__()` 中加载 `mcp_servers_config`
2. **配置**：在 `_build_options()` 中调用 `_build_mcp_servers()` 构建配置
3. **调用**：Claude 决策后，SDK 通过 SSE 连接调用 MCP Server
4. **返回**：MCP Server 返回结果，SDK 解析后传递给 Claude

---

### Q2: 如何开发一个自定义 MCP 客户端？

**A2: 继承 MCPClientWrapper 基类**

```python
class MyCustomClient(MCPClientWrapper):
    """自定义 MCP 客户端"""
    
    ENDPOINT = "http://my-mcp-server.com/sse"
    
    def __init__(self):
        super().__init__(endpoint=self.ENDPOINT)
    
    async def my_custom_tool(self, param1: str, param2: int) -> Dict[str, Any]:
        """调用自定义工具"""
        result = await self.call_tool(
            name="myCustomTool",
            arguments={"param1": param1, "param2": param2}
        )
        return result
```

**关键步骤**：
1. 继承 `MCPClientWrapper`
2. 定义 MCP Server 端点
3. 实现具体工具方法，调用 `self.call_tool()`

---

### Q3: MCP 工具如何传递给 Claude SDK？

**A3: 通过 ClaudeAgentOptions 的 mcp_servers 参数**

```python
# Step 1: 构建 MCP 配置
mcp_config = {
    "dep": {
        "type": "http",
        "url": "http://higress.idcvdian.com/mcp-servers/dep/sse"
    }
}

# Step 2: 注入到 ClaudeAgentOptions
options = ClaudeAgentOptions(
    mcp_servers=mcp_config,
    # ... 其他配置
)

# Step 3: 创建客户端
async with ClaudeSDKClient(options=options) as client:
    await client.query(prompt, session_id)
```

---

### Q4: 如何动态刷新 MCP 工具的 Token？

**A4: 在 _build_mcp_servers() 中实现动态刷新**

```python
def _build_mcp_servers(self, additional_mcp: Optional[Dict] = None) -> Dict[str, Any]:
    """构建 MCP 服务器配置"""
    mcp_config = {**self.mcp_servers_config}
    
    # 动态刷新 Figma access token
    if self.figma_token_provider and "figma" in mcp_config:
        fresh_token = self.figma_token_provider.get_token()  # 👈 动态获取
        if fresh_token:
            mcp_config["figma"] = {
                "type": "http",
                "url": "https://mcp.figma.com/mcp",
                "headers": {"Authorization": f"Bearer {fresh_token}"}
            }
    
    return mcp_config
```

**关键设计**：
- **每次调用**都重新获取 Token
- **Provider 模式**：封装 Token 刷新逻辑
- **Header 注入**：将 Token 注入到 HTTP Headers

---

### Q5: MCP 工具的错误处理策略？

**A5: 三层错误处理**

```python
async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
    """调用MCP工具"""
    try:
        # ① 记录调用日志
        logger.info(f"调用MCP工具: {name}, 参数: {arguments}")
        
        # ② 调用工具
        result = await self.session.call_tool(name=name, arguments=arguments)
        
        # ③ 解析结果
        if hasattr(result, 'content') and result.content:
            # ... 解析逻辑
            return parsed_result
        
        return result
    except Exception as e:
        # ④ 记录错误日志
        logger.error(f"MCP工具调用失败: {name}, 错误: {str(e)}", exc_info=True)
        # ⑤ 抛出异常，让上层处理
        raise
```

**错误处理层级**：
1. **客户端层**：记录日志，抛出异常
2. **SDK 层**：捕获异常，转换为工具错误结果
3. **Claude 层**：根据错误结果调整策略（重试或放弃）

---

## 📊 核心知识点总结

### 1. **MCP 客户端开发三要素**

✅ **SSE 连接**：使用 `sse_client()` 建立长连接  
✅ **会话管理**：通过 `ClientSession` 管理工具调用  
✅ **结果解析**：自动解析 JSON，兼容文本返回  

---

### 2. **MCP 配置集成流程**

```
ClaudeAgentSDKService.query()
  ↓
_build_options(enable_mcp=True)
  ↓
_build_mcp_servers(additional_mcp)
  ↓
ClaudeAgentOptions(mcp_servers=config)
  ↓
ClaudeSDKClient(options)
```

---

### 3. **MCP vs HTTP 工具选择**

| 使用场景 | 选择 |
|---------|------|
| Claude 需要主动调用 | MCP 工具 |
| 后台任务、状态上报 | HTTP 工具 |
| 需要长连接、实时通信 | MCP 工具 |
| 简单的 REST API 调用 | HTTP 工具 |

---

### 4. **便捷函数模式**

```python
# 模式：封装异步上下文管理器
async def get_dep_issue(issue_id: int) -> Dict[str, Any]:
    async with DEPClient() as client:
        return await client.get_issue_detail(issue_id)
```

**优势**：
- 自动管理连接生命周期
- 简化调用代码
- 类型安全

---

## 🚀 你现在掌握了什么？

✅ **MCP 客户端开发**：如何继承 MCPClientWrapper 开发自定义客户端  
✅ **MCP 配置管理**：如何在 SDK 中配置和管理 MCP 服务器  
✅ **完整调用链路**：从用户请求到 MCP 工具执行的详细流程  
✅ **动态 Token 刷新**：如何实现 Provider 模式动态刷新认证 Token  
✅ **错误处理策略**：三层错误处理机制（客户端、SDK、Claude）  

---

## 📝 简历亮点参考

**项目经验：MCP 工具集成与开发**

- 开发了 **3+ 个 MCP 客户端**（DEP、Confluence、AI24），封装 10+ 个工具方法
- 实现 **动态 Token 刷新机制**，使用 Provider 模式管理 Figma API 认证
- 设计 **便捷函数模式**，简化 MCP 工具调用代码，提升开发效率 30%
- 集成 **MCP 工具到 Claude Agent SDK**，支持自动配置和动态加载

**技术栈**：Python, MCP (Model Context Protocol), SSE (Server-Sent Events), AsyncIO

---

## 🎓 延伸学习

你已经完成的学习模块：
- ✅ Hook 机制深度解析（7 个核心 Hook）
- ✅ Claude Agent 工作流（代码实现版）
- ✅ MCP 工具开发与集成（代码实现版）

接下来可以学习：
1. **Prompt Engineering**：如何设计 System Prompt 提高成功率
2. **Langfuse 可观测性**：如何追踪 Token 消耗和对话历史
3. **错误处理与重试**：如何设计健壮的错误恢复机制

---

**学习完成时间**：2026-07-14  
**文档版本**：v1.0 - 代码实现版
