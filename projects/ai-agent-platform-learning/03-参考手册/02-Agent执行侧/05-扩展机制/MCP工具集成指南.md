# MCP 工具集成指南

> **文档状态**: 新增 (2026-07-23)  
> **适用版本**: code-agent master (commit bd46847f9+)  
> **学习时长**: 45 分钟  
> **前置知识**: 了解 code-agent 基本架构、Claude SDK 使用

---

## 📋 更新记录

| 日期 | 变更内容 | 相关提交 |
|------|---------|---------|
| 2026-07-23 | 初始创建，整理 7月15-22日 MCP 集成变更 | f3e88586a ~ 5ae7c5b3f |

---

## 🎯 核心认知

### MCP 是什么？

**MCP (Model Context Protocol)** 是 Anthropic 推出的标准化协议，允许 Claude 通过统一接口调用外部工具和服务。

**类比理解**:
- 传统方式：每个外部服务需要在 code-agent 中写专门的 Python 代码集成
- MCP 方式：外部服务实现 MCP 协议，code-agent 自动识别并调用，无需修改代码

**核心优势**:
- ✅ 标准化：所有工具遵循统一协议
- ✅ 解耦：工具服务独立部署和升级
- ✅ 动态发现：运行时自动加载可用工具
- ✅ 权限控制：细粒度的工具调用权限管理

---

## 一、已集成的 MCP 服务器

截至 2026-07-23，code-agent 已集成以下 MCP 服务器：

### 1.1 Backstage MCP 服务器

**功能**: 查询微店内部的服务目录 (Backstage)

**配置时间**: 2026-07-15  
**提交记录**: f3e88586a, dbc935b28, c584ca7f6

**环境变量**:
```bash
BACKSTAGE_MCP_URL=http://backstage-mcp-service.vdian.net
```

**可用工具** (settings.json 权限):
```json
{
  "mcpServers": {
    "backstage": {
      "allowed_tools": [
        "mcp__backstage__*"
      ]
    }
  }
}
```

**典型用例**:
- 查询服务的依赖关系
- 获取服务的 API 文档
- 查找服务的负责人信息
- 检索服务的部署拓扑

---

### 1.2 Neo4j Query Remote MCP 服务器

**功能**: 远程查询 Neo4j 图数据库

**配置时间**: 2026-07-15  
**提交记录**: 4ee1cd5e6

**环境变量**:
```bash
NEO4J_QUERY_REMOTE_MCP_URL=http://neo4j-mcp.vdian.net
```

**可用工具**:
- 执行 Cypher 查询语句
- 查询节点和关系
- 图遍历和路径查询

**典型用例**:
- 查询服务调用链路
- 分析依赖关系图
- 查找影响范围分析
- 构建知识图谱查询

---

### 1.3 Zeus MCP 服务器

**功能**: 访问 Zeus 测试平台接口

**配置时间**: 2026-07-17  
**提交记录**: 03afacdc3

**典型用例**:
- 查询测试用例执行结果
- 获取测试覆盖率数据
- 触发自动化测试任务

---

### 1.4 AI24 MCP 工具集

**功能**: 调用 AI24 平台的内部接口

**配置时间**: 2026-07-21~22  
**提交记录**: 7f997cc38, 5ae7c5b3f

**关键工具**: `mcp__{ai24_mcp_name}__getTemplateUsingPOST`

**配置获取**:
```python
from config import get_ai24_mcp_name

ai24_mcp_name = get_ai24_mcp_name()  # 动态获取 MCP 服务名称
```

**核心功能**:
- 获取任务模板内容
- 读取文件引用 (`@/openspec/*` 路径)
- 查询任务元数据
- 上报执行结果

**典型用例** (详见下文"文件引用格式处理"章节):
```python
# 获取 @/openspec/design.md 的内容
mcp__{ai24_mcp_name}__getTemplateUsingPOST(
    templateId="",
    promptType=2,
    promptDetail="/openspec/design.md",
    taskId="task_12345"
)
```

---

## 二、MCP 配置详解

### 2.1 配置文件位置

MCP 服务器配置位于：
```
code-agent/config/.claude/settings.json
```

**注意**: 此文件在任务启动时会被复制到用户 Claude 配置目录：
```
~/.claude/settings.json
```

### 2.2 配置结构示例

```json
{
  "mcpServers": {
    "backstage": {
      "command": "node",
      "args": ["/path/to/backstage-mcp-server.js"],
      "env": {
        "BACKSTAGE_MCP_URL": "${BACKSTAGE_MCP_URL}"
      }
    },
    "neo4j-query-remote": {
      "command": "python",
      "args": ["-m", "neo4j_mcp_server"],
      "env": {
        "NEO4J_QUERY_REMOTE_MCP_URL": "${NEO4J_QUERY_REMOTE_MCP_URL}"
      }
    }
  },
  "allowedMcpServers": [
    "backstage",
    "neo4j-query-remote",
    "zeus",
    "ai24"
  ],
  "mcpToolPermissions": {
    "mcp__backstage__*": "allowed",
    "mcp__neo4j__*": "allowed",
    "mcp__zeus__*": "allowed",
    "mcp__ai24__*": "allowed"
  }
}
```

### 2.3 权限控制机制

**三层权限控制**:

1. **服务器级别**: `allowedMcpServers` 列表
   - 只有列表中的服务器才会被加载

2. **工具级别**: `mcpToolPermissions` 字典
   - 支持通配符 `*` 匹配
   - `allowed`: 允许调用
   - `denied`: 禁止调用
   - 未配置: 默认需要用户确认

3. **运行时确认**: 首次调用工具时
   - Claude 会提示用户是否允许
   - 用户可选择"本次允许"或"总是允许"

**最佳实践**:
```json
{
  "mcpToolPermissions": {
    // 内部可信服务 - 直接允许
    "mcp__backstage__*": "allowed",
    "mcp__ai24__*": "allowed",
    
    // 外部服务 - 需要确认
    "mcp__external_api__*": "prompt",
    
    // 危险操作 - 禁止
    "mcp__*__delete*": "denied"
  }
}
```

---

## 三、MCP 工具在系统提示词中的应用

### 3.1 文件引用格式处理 (重要更新 2026-07-21)

**背景**: 用户在提示词中可能使用文件引用格式，例如：
- `@/openspec/design.md` - 设计文档
- `@/openspec/AGENTS.md` - Agent 配置
- `@/command` - 命令说明

**核心规则** (来自 `prompt_holder.py`):
```python
def get_concise_system_prompt(task_id: str) -> str:
    from config import get_ai24_mcp_name
    
    prd = PathManager.get_prd_file_path(task_id)
    ai24_mcp_name = get_ai24_mcp_name()
    
    return f"""
    1. **当前任务task_id = {task_id}**
    2. 如果你在这个过程中，需要读取需求文档（PRD），那么请读取 {prd} 文件
    3. 注意(FATAL): **当你在执行任务时,如果用户的提示词中包含文件引用格式
       (如 @/openspec/design.md、@/openspec/local_design.md、@/command 等以 @ 开头的路径),
       你必须先使用 MCP 工具获取这些文件的内容:**
       
       - **必须先调用 `mcp__{ai24_mcp_name}__getTemplateUsingPOST` 来获取模板内容**
       - **调用参数格式:**
         - templateId: "" (固定传空字符串)
         - promptType: 2 (固定值,表示获取文件引用)
         - promptDetail: 文件引用路径 (例如 "/openspec/AGENTS.md" 或 "/command",去掉开头的@符号)
         - taskId: "{task_id}" (当前任务ID)
         
       - **示例:** 如果用户提示词包含 "@/openspec/design.md",你必须先调用:
         mcp__{ai24_mcp_name}__getTemplateUsingPOST(
             templateId="",
             promptType=2,
             promptDetail="/openspec/AGENTS.md",
             taskId="{task_id}"
         )
         
       - **获取到文件内容后,再继续执行后续操作**
       - **禁止跳过这个步骤,禁止假设文件内容**
    """
```

### 3.2 promptType 参数说明

AI24 MCP 的 `getTemplateUsingPOST` 接口支持多种 `promptType`:

| promptType | 含义 | 使用场景 |
|-----------|------|---------|
| 0 | 获取模板内容 | 通过 templateId 获取预定义模板 |
| 1 | 获取 PRD 内容 | 获取需求文档 |
| 2 | 获取文件引用 | 获取 @/ 开头的文件引用内容 |

**关键点**:
- `promptType=2` 时，`templateId` 固定传空字符串 `""`
- `promptDetail` 存放去掉 `@` 符号后的路径
- 必须传递 `taskId` 用于权限校验和日志记录

### 3.3 为什么要强制使用 MCP？

**问题场景**: 如果 Claude 不调用 MCP 直接假设文件内容：
- ❌ 可能使用过时的内容 (文件已更新)
- ❌ 可能使用错误的内容 (路径理解错误)
- ❌ 无法跟踪文件访问 (审计困难)

**强制策略** (2026-07-21 引入):
- 系统提示词中明确标注 `(FATAL)` 级别
- 使用 "必须"、"禁止" 等强制性语言
- 提供完整的调用示例代码
- 减少 Claude 自行判断的空间

---

## 四、MCP 工具调用流程

### 4.1 调用时序图

```
用户提示词包含 @/openspec/design.md
    ↓
Claude 识别文件引用格式
    ↓
检查系统提示词 (发现 MCP 调用要求)
    ↓
构造 MCP 调用参数
    {
      "tool": "mcp__ai24__getTemplateUsingPOST",
      "parameters": {
        "templateId": "",
        "promptType": 2,
        "promptDetail": "/openspec/design.md",
        "taskId": "task_12345"
      }
    }
    ↓
code-agent 拦截 MCP 调用
    ↓
通过 HTTP/SSE 发送到 AI24 MCP 服务器
    ↓
AI24 服务器验证权限、查询数据库
    ↓
返回文件内容
    ↓
Claude 收到内容并继续执行任务
```

### 4.2 错误处理流程

**场景1: MCP 服务器不可用**
```
Claude 调用 MCP 工具
    ↓
code-agent: 连接 MCP 服务器失败
    ↓
返回错误: "MCP server 'ai24' is unavailable"
    ↓
Claude 提示用户: "无法访问 AI24 服务，请检查网络或联系管理员"
```

**场景2: 权限不足**
```
Claude 调用 MCP 工具
    ↓
AI24 MCP 服务器: 检查 taskId 权限
    ↓
返回错误: "User does not have permission to access this file"
    ↓
Claude 提示用户: "您没有权限访问该文件，请联系任务创建者"
```

**场景3: 文件不存在**
```
Claude 调用 MCP 工具
    ↓
AI24 MCP 服务器: 查询文件路径
    ↓
返回错误: "File not found: /openspec/design.md"
    ↓
Claude 提示用户: "文件不存在，请检查路径是否正确"
```

---

## 五、开发者指南

### 5.1 如何添加新的 MCP 服务器

**步骤1: 实现 MCP 服务器**

创建符合 MCP 协议的服务器 (Python/Node.js/Go 等)：
```python
# example_mcp_server.py
from mcp import MCPServer

server = MCPServer(name="example")

@server.tool(name="query_data", description="查询数据")
def query_data(query: str) -> dict:
    # 实现查询逻辑
    return {"result": "..."}

if __name__ == "__main__":
    server.run()
```

**步骤2: 配置环境变量**

在 code-agent 部署环境中添加：
```bash
export EXAMPLE_MCP_URL=http://example-mcp.vdian.net
```

**步骤3: 更新 settings.json**

编辑 `config/.claude/settings.json`:
```json
{
  "mcpServers": {
    "example": {
      "command": "python",
      "args": ["/path/to/example_mcp_server.py"],
      "env": {
        "EXAMPLE_MCP_URL": "${EXAMPLE_MCP_URL}"
      }
    }
  },
  "allowedMcpServers": ["example"],
  "mcpToolPermissions": {
    "mcp__example__*": "allowed"
  }
}
```

**步骤4: 重启 code-agent**

```bash
cd /path/to/code-agent
./restart.sh
```

### 5.2 如何调试 MCP 调用

**方法1: 查看 Claude 日志**

```bash
# code-agent 的 Claude SDK 日志
tail -f ~/.claude/logs/claude.log | grep "mcp__"
```

**方法2: 查看 MCP 服务器日志**

```bash
# AI24 MCP 服务器日志
kubectl logs -f ai24-mcp-server-xxx -n default
```

**方法3: 使用 MCP Inspector**

```bash
# 本地调试 MCP 服务器
mcp-inspector --server example_mcp_server.py
```

### 5.3 常见问题排查

**问题1: MCP 工具未出现在可用工具列表**

检查项:
- [ ] `allowedMcpServers` 是否包含服务器名称
- [ ] `mcpToolPermissions` 是否配置了工具权限
- [ ] MCP ��务器是否正常启动 (检查进程)
- [ ] 环境变量是否正确配置

**问题2: MCP 调用超时**

```python
# 检查 MCP 服务器响应时间
curl -X POST http://example-mcp.vdian.net/health
```

调整超时配置 (settings.json):
```json
{
  "mcpServers": {
    "example": {
      "timeout": 30000  // 30秒超时
    }
  }
}
```

**问题3: 权限被拒绝**

```json
// 检查工具权限配置
{
  "mcpToolPermissions": {
    "mcp__example__query_data": "allowed"  // 确保是 allowed 而非 denied
  }
}
```

---

## 六、最佳实践

### 6.1 MCP 服务器设计原则

1. **单一职责**: 一个 MCP 服务器专注一个领域 (如 Backstage、Neo4j)
2. **幂等性**: 查询类工具必须幂等，多次调用结果一致
3. **快速响应**: 工具调用应在 5 秒内返回，长时间操作使用异步模式
4. **错误友好**: 返回清晰的错误信息，便于 Claude 理解和提示用户
5. **权限最小化**: 只暴露必要的工具，避免过度授权

### 6.2 权限配置最佳实践

```json
{
  "mcpToolPermissions": {
    // ✅ 推荐: 使用通配符简化配置
    "mcp__backstage__query*": "allowed",
    "mcp__backstage__update*": "prompt",
    
    // ❌ 不推荐: 过于宽泛的权限
    "mcp__*__*": "allowed",
    
    // ✅ 推荐: 明确禁止危险操作
    "mcp__*__delete": "denied",
    "mcp__*__drop": "denied",
    
    // ✅ 推荐: 敏感操作需要确认
    "mcp__payment__*": "prompt"
  }
}
```

### 6.3 系统提示词集成建议

在系统提示词中引导 Claude 使用 MCP 工具：

```python
# 好���示例 (明确、可执行)
"""
如果用户要求查询服务依赖关系，使用 mcp__backstage__queryDependencies 工具:
  mcp__backstage__queryDependencies(serviceName="user-service")
"""

# 不好的示例 (模糊、不可执行)
"""
你可以使用 Backstage 工具查询服务信息。
"""
```

---

## 七、未来规划

### 7.1 计划集成的 MCP 服务器

- **Jira MCP**: 查询和创建 Jira 任务
- **GitLab MCP**: 查询代码仓库、MR 状态
- **Grafana MCP**: 查询监控指标和告警
- **K8s MCP**: 查询集群资源状态

### 7.2 MCP 生态建设

- 建立内部 MCP 服务器市场
- 提供 MCP 服务器开发模板
- 统一 MCP 服务器部署和监控
- 定期审计 MCP 工具使用情况

---

## 八、参考资料

- [Anthropic MCP 官方文档](https://docs.anthropic.com/mcp)
- [code-agent MCP 配置示例](../config/.claude/settings.json)
- [AI24 MCP 接口文档](../../01-平台管理侧/API文档/MCP接口说明.md)
- 相关提交记录: f3e88586a, 4ee1cd5e6, c584ca7f6, 03afacdc3, 7f997cc38, 5ae7c5b3f, 29076014c

---

**文档维护者**: AI Agent 平台团队  
**最后更新**: 2026-07-23  
**下次审查**: 2026-08-23
