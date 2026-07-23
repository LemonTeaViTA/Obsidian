# 提示词预处理和 MCP 工具详解

## 一、提示词预处理机制

### 核心流程

```
用户输入："/openspec:proposal"
    ↓
process_custom_command() 处理
    ↓
调用 AI24 MCP 的 getTemplateUsingPOST 工具
    ↓
获取完整的提示词模板
    ↓
返回处理后的提示词
    ↓
传给 Claude SDK
```

---

### 详细代码流程

#### 步骤 1：接收用户输入（main.py:2499）

```python
# main.py:2499-2508
is_command, processed_text, original_command_type = asyncio.run(
    process_custom_command(
        task_id=task_id,
        input_text="/openspec:proposal",  # ← 用户输入
        template_id=real_template_id,     # ← 从 metadata 获取
        params={
            'flow_type': flow_type,
            'ui_mcp_type': ui_mcp_type
        },
        project_path=project_path
    )
)
```

#### 步骤 2：检测命令类型（commands_container.py）

```python
# commands_container.py:process_custom_command()

async def process_custom_command(task_id, input_text, template_id, params, project_path):
    """
    处理自定义命令
    
    Returns:
        (is_command, processed_text, command_type)
        - is_command: 是否是命令
        - processed_text: 处理后的文本
        - command_type: 命令类型（如 'openspec_proposal'）
    """
    
    # 1. 检测是否是 OpenSpec 命令
    if input_text.startswith('/openspec:'):
        command = input_text  # "/openspec:proposal"
        
        # 2. 调用 AI24 MCP 获取模板
        template_content = await get_template_from_ai24_mcp(
            template_id=template_id,
            prompt_type=2,  # 2 表示获取提示词模板
            prompt_detail=command  # "/openspec:proposal"
        )
        
        # 3. 返回处理后的内容
        return (
            True,                    # is_command
            template_content,        # 完整的提示词
            'openspec_proposal'      # command_type
        )
    
    # 4. 如果不是命令，原样返回
    return (False, input_text, '')
```

#### 步骤 3：调用 AI24 MCP 获取模板

```python
async def get_template_from_ai24_mcp(template_id, prompt_type, prompt_detail):
    """
    通过 AI24 MCP 工具获取提示词模板
    
    相当于调用：
    mcp__ai24__getTemplateUsingPOST(
        templateId="backend_common",
        promptType=2,
        promptDetail="/openspec:proposal"
    )
    """
    
    # AI24 MCP 返回的内容示例
    return """
你是一位资深的技术架构师，擅长需求分析和技术方案设计。

# 当前任务
请根据 PRD 文档生成技术方案（Proposal）。

# 执行步骤

## 1. 需求分析
- 阅读 PRD 文档
- 提取核心功能点
- 分析技术难点

## 2. 技术选型
- 选择合适的技术栈
- 评估技术风险
- 考虑性能和可维护性

## 3. 模块设计
- 划分功能模块
- 设计接口和数据结构
- 绘制架构图

## 4. 测试设计
- 设计单元测试
- 设计集成测试
- 考虑边界条件

## 5. 生成文档
- 创建 changes/proposal.md
- 创建 changes/test-design.md
- 创建 changes/tasks.md

# 输出格式
以 Markdown 格式输出，包含以上所有内容。
"""
```

#### 步骤 4：替换用户输入（main.py:2516-2517）

```python
# main.py:2516-2517
if should_route:  # 如果需要路由（替换）
    input_text = processed_text  # ← 用完整模板替换原始输入
```

#### 步骤 5：传给 Claude SDK

```python
# main.py:1898
await service.query(
    task_id=task_id,
    prompt=input_text,  # ← 这里已经是完整的提示词模板了！
    cwd=project_path,
    ...
)
```

---

### 对比：用户看到 vs Claude 看到

#### 用户输入
```
/openspec:proposal
```

#### Claude 实际收到（通过 AI24 MCP 扩展后）
```
你是一位资深的技术架构师，擅长需求分析和技术方案设计。

# 当前任务
请根据 PRD 文档生成技术方案（Proposal）。

# 执行步骤

## 1. 需求分析
- 阅读 PRD 文档（位于 prd.md）
- 提取核心功能点
- 分析技术难点

## 2. 技术选型
- 选择合适的技术栈
- 评估技术风险
- 考虑性能和可维护性

## 3. 模块设计
- 划分功能模块
- 设计接口和数据结构
- 绘制架构图

## 4. 测试设计
- 设计单元测试
- 设计集成测试
- 考虑边界条件

## 5. 生成文档
请创建以下文件：
- changes/proposal.md（技术方案）
- changes/test-design.md（测试设计）
- changes/tasks.md（任务分解）

## 6. 约束条件
- 必须使用项目现有的技术栈
- 考虑团队的技术水平
- 符合公司的开发规范

# 输出格式
以 Markdown 格式输出，包含以上所有内容。

请开始执行。
```

**关键**：用户只输入 8 个字符，但 Claude 收到的是 **几百字的详细指令**！

---

## 二、MCP 工具详解

### MCP（Model Context Protocol）是什么？

**MCP = 给 Claude 扩展能力的工具系统**

就像给浏览器安装插件：
- 浏览器本身只能浏览网页
- 安装插件后可以：翻译、截图、下载视频等
- MCP 工具让 Claude 可以：读取 Figma 设计、查询数据库、上报状态等

---

### 项目中的 MCP 工具（7大类）

#### 1. **AI24 MCP**（最重要）

**位置**：claude_agent_sdk_wrapper.py:2328-2336

```python
ai24_mcp_name = get_ai24_mcp_name()  # 根据环境：ai24 / ai24-pre / ai24-prod
mcp_servers[ai24_mcp_name] = {
    "type": "sse",
    "url": "http://higress.idcvdian.com/mcp-servers/ai24/sse",
    "alwaysLoad": True
}
```

**作用**：
| 工具 | 功能 | 调用示例 |
|-----|------|---------|
| `getTemplateUsingPOST` | 获取提示词模板 | 获取 `/openspec:proposal` 的完整模板 |
| `notifyTaskStatusUsingPOST` | 上报任务状态 | 通知 AI24 任务完成（status=500） |
| `uploadDocumentUsingPOST` | 上传文档 | 上传技术方案到 AI24 |
| `notifyErrorRecordUsingPOST` | 上报错误 | 上报任务执行失败 |
| `getUserEmailUsingGET` | 获取用户信息 | 获取 Git commit 的作者信息 |
| `getTechDesignUsingGET` | 获取技术方案 | 测试任务获取开发任务的技术方案 |

**为什么重要**：
- ✅ 提示词模板管理（所有 `/openspec:xxx` 命令）
- ✅ 任务状态同步（AI24 前端实时显示进度）
- ✅ 文档自动上报（技术方案、测试报告等）

---

#### 2. **Figma MCP**（前端开发）

**位置**：claude_agent_sdk_wrapper.py:2371-2410

```python
mcp_servers["figma"] = {
    "type": "http",
    "url": "https://mcp.figma.com/v1",
    "headers": {
        "Authorization": f"Bearer {figma_token}"
    }
}
```

**作用**：
| 工具 | 功能 |
|-----|------|
| `get_file` | 读取 Figma 设计稿的结构 |
| `get_image` | 导出设计稿的图片 |
| `get_comments` | 读取设计稿的评论 |

**使用场景**：
```
用户：请根据 Figma 设计还原 UI
  ↓
Claude 调用 Figma MCP
  ↓
获取设计稿的：
  - 布局结构
  - 颜色值（#FF5733）
  - 字体大小（16px）
  - 间距（padding: 12px）
  ↓
生成前端代码
```

---

#### 3. **MasterGo MCP**（国产设计工具）

**位置**：claude_agent_sdk_wrapper.py:2360-2369

```python
mcp_servers["mastergo"] = {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@mastergo/magic-mcp", f"--token={mastergo_token}"]
}
```

**作用**：和 Figma MCP 类似，但用于 MasterGo 设计稿

**为什么需要**：
- Figma 在国内访问慢
- 很多公司使用国产的 MasterGo
- 功能和 Figma 基本一致

---

#### 4. **Confluence MCP**（文档管理）

**位置**：claude_agent_sdk_wrapper.py:2322-2326

```python
mcp_servers["mcp-service-link-confluence"] = {
    "type": "sse",
    "url": "http://higress.idcvdian.com/mcp-servers/mcp-service-link-confluence/sse"
}
```

**作用**：
| 工具 | 功能 |
|-----|------|
| `get_confluence_page` | 读取 Confluence 文档内容 |

**使用场景**：
```
用户：参考这个 Confluence 文档实现功能
  ↓
Claude 调用 Confluence MCP
  ↓
读取文档内容（技术规范、API 文档等）
  ↓
根据文档生成代码
```

---

#### 5. **Code-Agent-Report-Tools MCP**（任务上报）

**位置**：claude_agent_sdk_wrapper.py:2301-2306

```python
mcp_servers["code-agent-report-tools"] = {
    "type": "stdio",
    "command": "python",
    "args": [str(Path(__file__).parent / "mcp_server" / "server.py")]
}
```

**作用**：
| 工具 | 功能 |
|-----|------|
| `report_completion_metrics` | 上报开发指标（代码行数、测试行数、文件数） |
| `init_project` | 初始化项目（从 DEP 获取元数据） |

**使用场景**：
```
Claude 完成代码编写
  ↓
调用 report_completion_metrics
  ↓
上报：
  - 代码行数：120 行
  - 测试行数：80 行
  - 修改文件：5 个
  ↓
AI24 前端显示统计数据
```

---

#### 6. **Context1 MCP**（中间件文档）

**位置**：claude_agent_sdk_wrapper.py（通过环境变量配置）

```python
mcp_servers["context1"] = {
    "type": "sse",
    "url": "http://middleware-mcp.daily.idcvdian.com/sse"
}
```

**作用**：
| 工具 | 功能 |
|-----|------|
| `getMiddlewareProductDoc` | 获取中间件产品文档 |

**使用场景**：
```
用户：使用 Redis 实现缓存
  ↓
Claude 调用 Context1 MCP
  ↓
获取公司内部的 Redis 使用文档
  ↓
按照公司规范生成代码
```

---

#### 7. **MemMachine MCP**（记忆系统）

**位置**：claude_agent_sdk_wrapper.py:2353-2358

```python
mcp_servers["memmachine"] = {
    "type": "stdio",
    "command": "mcp-remote",
    "args": ["http://10.33.140.21:8080/mcp/", "--allow-http"]
}
```

**作用**：
- 记录 Claude 的"记忆"
- 跨会话保存上下文信息

---

### MCP 工具类型对比

| 类型 | 说明 | 示例 |
|-----|------|------|
| **stdio** | 本地命令行程序 | MasterGo, Code-Agent-Report-Tools |
| **sse** | 远程 HTTP 服务（Server-Sent Events） | AI24, Confluence, Context1 |
| **http** | 远程 HTTP API | Figma |

---

## 三、完整示例：用户输入 → Claude 执行

### 示例：前端任务执行 Proposal

```
1. 用户输入（AI24 发送）
   {
       "taskId": "T123",
       "input": "/openspec:proposal"
   }

2. main.py 接收并预处理
   ↓
   process_custom_command() 检测到 /openspec: 命令
   ↓
   调用 AI24 MCP: getTemplateUsingPOST(
       templateId="frontend_common",
       promptType=2,
       promptDetail="/openspec:proposal"
   )
   ↓
   AI24 MCP 返回完整模板（500+ 字）

3. 替换用户输入
   input_text = 完整模板内容

4. 调用 Claude SDK
   await service.query(
       prompt=完整模板内容,  # ← 不是 "/openspec:proposal"
       cwd=project_path,
       mcp_servers={
           "ai24": {...},        # 后续上报状态
           "figma": {...},       # 读取设计稿
           "code-agent-report-tools": {...}  # 上报指标
       }
   )

5. Claude 执行
   ↓
   - 调用 Figma MCP 读取设计稿
   - 生成技术方案
   - 生成测试设计
   - 创建文件
   ↓
   - 调用 code-agent-report-tools MCP 上报指标
   - 调用 AI24 MCP 上传文档
   - 调用 AI24 MCP 更新状态

6. 完成
   AI24 前端显示：✅ Proposal 完成
```

---

## 四、关键理解

### 1. 提示词预处理 = 命令展开

```
短命令 → 完整指令

/openspec:proposal (8 字符)
    ↓ 通过 AI24 MCP 展开
完整的 Proposal 生成指令 (500+ 字符)
```

### 2. MCP = Claude 的"能力插件"

| 没有 MCP | 有 MCP |
|---------|--------|
| ❌ 只能写代码 | ✅ 能读取 Figma 设计 |
| ❌ 不知道任务状态 | ✅ 能上报任务进度 |
| ❌ 不知道公司规范 | ✅ 能读取公司文档 |
| ❌ 无法持久化记忆 | ✅ 能保存上下文 |

### 3. AI24 MCP 的核心作用

```
AI24 MCP = 中央控制系统

1. 提示词模板管理（所有 /openspec: 命令）
2. 任务状态同步（进度条、完成状态）
3. 文档自动上报（技术方案、测试报告）
4. 用户信息获取（Git 作者）
```

---

现在明白了吗？

1. **提示词预处理** = 把短命令（`/openspec:proposal`）通过 AI24 MCP 展开成完整指令
2. **MCP 工具** = 给 Claude 扩展各种能力（读设计稿、查文档、上报状态）

你还有什么疑问吗？
