# 当前项目的 Claude SDK 使用架构分析

## 实际实现流程

### 1. 服务启动（main.py:3864）

```python
# main.py 启动时创建单例
create_claude_service(enable_path_security=True)
```

这会创建一个**全局唯一的 ClaudeAgentSDKService 单例**。

---

### 2. 请求处理流程

```
HTTP 请求 (/task/query)
    ↓
main.py:TaskQueryResource.post()
    ↓
run_query_task_in_thread() (新线程)
    ↓
execute_query_task() (异步函数)
    ↓
intercept_and_replace_prompt() (提示词预处理)
    ↓
service.query() (调用 SDK)
```

---

### 3. 核心调用：service.query()

**位置**: main.py:1898, 1935, 1975 等多处

**典型调用**:
```python
service = ClaudeAgentSDKService.get_instance()  # 获取单例

await service.query(
    task_id=task_id,           # ✅ 任务ID（来自 AI24）
    prompt=input_text,          # ✅ 用户输入（经过预处理）
    cwd=project_path,          # ✅ 工作目录（从 metadata 获取）
    permission_mode="acceptEdits",  # ✅ 权限模式
    settings=str(Path.home() / ".claude" / "settings.json"),  # ✅ 配置文件
    setting_sources=["user", "project"],
    skip_check=skip_check,     # ✅ 兼容参数
    model=model,               # ✅ 模型（从 AI24 传递）
    dynamic_hooks=dynamic_hooks,  # ✅ 动态 hooks
    speed=speed,               # ✅ fast mode
    image_urls=image_urls,     # ✅ 多模态图片
)
```

---

### 4. 参数来源分析

#### 从 AI24 传递的参数：

**初始化阶段**（/task/perform）：
```json
{
    "dep_id": "任务ID",
    "git_url": "代码仓库",
    "branch": "分支",
    "template_id": "模板ID",
    "model": "claude-opus-4-8",  // ← AI24 指定模型
    "flow_type": "frontend_common",  // ← AI24 指定流程
    "figma_oauth_access_token": "...",  // ← UI 设计工具配置
}
```

**查询阶段**（/task/query）：
```json
{
    "task_id": "T123",
    "input": "用户输入的需求",
    "model": "claude-opus-4-8",  // ← 可选，覆盖初始化的模型
    "speed": "fast",  // ← 可选，启用 fast mode
    "plan_mode": true,  // ← 可选，启用 Plan 模式
    "image_urls": ["https://..."]  // ← 可选，多模态图片
}
```

#### 从 MetaContainer 获取的参数：

```python
# main.py:1888-1892
meta_container = get_meta_container()
task_metadata = meta_container.get(task_id)

project_path = task_metadata.project_path  # 项目路径
flow_type = task_metadata.flow_type        # 流程类型
model = task_metadata.model                # 模型（如果请求没传）
template_id = task_metadata.template_id    # 模板ID
```

#### 本地处理的参数：

```python
# 提示词预处理（intercept_and_replace_prompt）
processed_prompt = intercept_and_replace_prompt(
    task_id=task_id,
    prompt=original_input,
    original_command_type=command_type
)

# 动态 Hooks（根据 metadata.enable_document_auto_upload 决定）
dynamic_hooks = {
    "document_auto_upload_hook": {...}
} if enable_auto_upload else None
```

---

### 5. SDK 实例化参数（create_claude_service）

**位置**: claude_agent_sdk_wrapper.py:2275

**启动时的全局配置**:
```python
ClaudeAgentSDKService(
    # MCP 服务器（硬编码）
    mcp_servers={
        "code-agent-report-tools": {...},  # 本地 stdio
        "ai24": {...},                      # AI24 平台（SSE）
        "mcp-service-link-confluence": {...},  # Confluence（SSE）
        "mastergo": {...},                 # MasterGo（stdio）
        "figma": {...},                    # Figma 官方（HTTP）
    },
    
    # Hooks（硬编码）
    hooks={
        "path_security_hook": {...},      # 路径安全检查
        "git_commit_author_hook": {...},  # Git 提交作者
    },
    
    # 其他全局配置
    output_format="event",  # 日志格式
    enable_path_security=True,
)
```

---

### 6. 关键发现：**没有用到 agents 参数**

从代码搜索结果看：

```python
# claude_agent_sdk_wrapper.py:1133
options = ClaudeAgentOptions(
    agents=agents or self.agents,  # ← 接口存在
    ...
)
```

**但是**：

❌ `ClaudeAgentSDKService.__init__()` 中 `self.agents = agents`，默认为 `None`

❌ 调用 `service.query()` 时从来没有传递 `agents` 参数

❌ 项目中没有 `.claude/agents/` 目录和配置文件

**结论**：虽然 SDK 支持 Agent Team 功能，**但项目完全没有使用**。

---

### 7. 当前架构的特点

#### ✅ 优点：

1. **单例模式**：全局共享一个 SDK 实例，资源利用高效
2. **Session 持久化**：task_id ↔ session_id 映射，支持多轮对话
3. **参数灵活**：AI24 可以动态指定 model、flow_type、template_id
4. **提示词预处理**：OpenSpec 命令自动注入对应的提示词模板
5. **动态 Hooks**：根据任务类型动态启用不同的 Hook

#### ❌ 局限性：

1. **串行执行**：一个 task_id 同一时间只能有一个查询（task_lock）
2. **单一 Claude**：没有多 Claude 并行分析能力
3. **无错误重试**：API 错误直接失败，没有自动重试
4. **MCP 硬编码**：MCP 服务器配置写死在代码里，无法动态调整
5. **未用 Agent Team**：虽然 SDK 支持，但没有配置和使用

---

## 实际的工作流程

### 场景：用户通过 AI24 发起开发任务

```
1. AI24 调用 /task/perform/init
   ↓ 传递参数
   {
       "dep_id": "DEP123",
       "template_id": "backend_common",
       "model": "claude-opus-4-8"
   }
   ↓ Flask 处理
   - 从 DEP 拉取 PRD
   - Clone 代码仓库
   - 保存 metadata 到 MetaContainer
   ↓ 返回
   { "success": true, "task_id": "T123" }

2. AI24 调用 /task/query（多次）
   ↓ 传递参数
   {
       "task_id": "T123",
       "input": "/openspec:proposal"  // 或其他用户输入
   }
   ↓ Flask 处理
   - 获取 task_id 锁（防止并发）
   - 从 MetaContainer 获取 project_path, model 等
   - 预处理提示词（注入 OpenSpec 模板）
   - 调用 SDK
   ↓
   service.query(
       task_id="T123",
       prompt="[OpenSpec Proposal 完整提示词]",  // ← 预处理后的
       cwd="/path/to/project",
       model="claude-opus-4-8",  // ← 从 AI24 或 metadata
       settings="~/.claude/settings.json",
       dynamic_hooks={...}  // ← 根据任务类型动态构建
   )
   ↓ SDK 处理
   - 创建 ClaudeSDKClient
   - 加载 MCP 工具（ai24, mastergo, figma 等）
   - 执行 Claude 对话
   - 流式返回消息
   ↓ Flask 处理响应
   - 渲染消息并保存日志
   - 上报到 AI24（通过 MCP 或 HTTP）
   - 释放锁

3. 重复步骤 2，直到任务完成
```

---

## 关于 Agent Team 的现状

### SDK 支持但未使用

```python
# 接口存在
await service.query(
    agents={...},  # ← 可以传，但从来没传过
)
```

### 如果要使用，需要：

1. **创建 Agent 配置**
   ```bash
   mkdir .claude/agents
   # 创建 code-reviewer.md 等
   ```

2. **在调用时传递**
   ```python
   await service.query(
       task_id=task_id,
       prompt=input_text,
       agents=["code-reviewer", "security-checker"],  # ← 明确指定
   )
   ```

3. **或者让 SDK 自动读取**
   - SDK 可能会自动扫描 `.claude/agents/` 目录
   - 根据任务自动调用合适的 Agent
   - **但需要查看 SDK 文档确认**

---

## 总结

### 你说得完全对：

1. ✅ **单例 SDK 实例**：启动时创建一次，全局共享
2. ✅ **提示词给他**：通过 `service.query(prompt=...)` 传递
3. ✅ **参数从 AI24 传递**：model, flow_type, template_id 等都是 AI24 控制
4. ✅ **MetaContainer 管理元数据**：保存任务信息，每次查询时获取

### 当前没有用到的功能：

1. ❌ **Agent Team**：SDK 支持，但未配置和使用
2. ❌ **多 Claude 并行**：一个任务只能串行执行
3. ❌ **错误重试**：没有自动重试机制

### 优化空间：

1. **错误重试**：添加 `query_with_retry()` 包装
2. **Judge Panel**：在 apply 阶段实现多维度并行审查
3. **Agent Team**：创建专用 Agent 配置文件
4. **动态 MCP**：支持任务级别的 MCP 配置
