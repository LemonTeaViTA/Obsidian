# MCP 服务配置详解

> 定位：MCP 服务清单、传输类型和配置字段的主参考文档。具体机制分析见《MCP服务深度解析》，避免在两篇文档中重复维护完整服务列表。

> 本文档详细展示 Code-Agent 中所有 MCP（Model Context Protocol）服务的配置细节。
> 代码位置：[claude_agent_sdk_wrapper.py:2275-2514](../../code-agent/claude_agent_sdk_wrapper.py#L2275-L2514)

---

## 一、核心架构：Claude + MCP 工具箱 🎯

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│  ClaudeAgentSDKService (单例)                                │
│                                                             │
│  Claude 大模型 (大脑)                                        │
│  ├── 思考能力：如何实现功能                                  │
│  ├── 代码生成：编写代码                                      │
│  └── 任务规划：分步骤执行                                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ MCP 工具箱（按环境动态组装 - 手和眼睛）              │  │
│  │                                                       │  │
│  │  📚 读取文档类 (眼睛)                                 │  │
│  │    ├── confluence (Confluence 文档)                  │  │
│  │    ├── context1 (中间件文档)                         │  │
│  │    └── ai24 (工作流模板、PRD)                        │  │
│  │                                                       │  │
│  │  🎨 设计稿类 (眼睛)                                   │  │
│  │    ├── figma (Figma 设计稿)                          │  │
│  │    └── mastergo (MasterGo 设计稿)                    │  │
│  │                                                       │  │
│  │  🔧 CI/CD 类 (手)                                     │  │
│  │    ├── jenkins (Jenkins 构建)                        │  │
│  │    ├── zeus-ci (Zeus CI 构建)                        │  │
│  │    ├── zeus (Zeus 通用服务)                          │  │
│  │    └── media (媒体编译)                              │  │
│  │                                                       │  │
│  │  🧪 测试类 (手)                                       │  │
│  │    ├── ui-test-automation (UI 自动化测试)            │  │
│  │    └── integration-test-automation (集成测试)        │  │
│  │                                                       │  │
│  │  📤 上报类 (手)                                       │  │
│  │    └── code-agent-report-tools (任务上报)            │  │
│  │                                                       │  │
│  │  ☁️ 云服务类                                          │  │
│  │    ├── data-factory (数据工厂)                       │  │
│  │    ├── odin (Odin 服务)                              │  │
│  │    └── wd24-cloud-* (板端云服务 3个)                 │  │
│  │                                                       │  │
│  │  💾 其他类                                            │  │
│  │    ├── memmachine (记忆存储)                         │  │
│  │    └── vimg (图片上传)                               │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**核心理解**：
- **Claude = 大脑**：负责思考、规划、生成代码
- **MCP 工具 = 手和眼睛**：
  - 眼睛：读取文档、设计稿（confluence, figma, context1）
  - 手：执行操作（jenkins 构建、ui-test 测试、report 上报）

### 1.2 典型工作流程

```
用户需求：实现用户登录功能
    ↓
┌────────────────────────────────────────────┐
│ Claude 调用 MCP 工具自动获取信息           │
│                                            │
│ 1️⃣ ai24.getTaskInfo()                     │
│    → 获取 PRD 文档                         │
│                                            │
│ 2️⃣ figma.getFile()                        │
│    → 读取登录页面设计稿                    │
│                                            │
│ 3️⃣ confluence.readPage()                  │
│    → 查阅登录模块技术规范                  │
│                                            │
│ 4️⃣ context1.queryMiddleware()             │
│    → 查询 Redis 使用规范                   │
└────────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────────┐
│ Claude 生成代码                            │
│  - 前端：login.html, login.css, login.js  │
│  - 后端：LoginController.java             │
│  - 测试：LoginTest.java                   │
└────────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────────┐
│ Claude 调用 MCP 工具执行操作               │
│                                            │
│ 5️⃣ ui-test-automation.runTest()           │
│    → 执行 UI 测试 ✅                       │
│                                            │
│ 6️⃣ jenkins.triggerBuild()                 │
│    → 触发构建 ✅                           │
│                                            │
│ 7️⃣ code-agent-report-tools.report_completion_metrics()│
│    → 通过旧 MCP 链路上报量化指标 ✅         │
└────────────────────────────────────────────┘
```

**关键价值**：
- ✅ **自动化**：无需人工复制粘贴文档
- ✅ **高效**：并行调用多个 MCP 获取信息
- ✅ **准确**：直接从源头获取最新数据
- ✅ **可扩展**：随时添加新的 MCP 服务

### 1.3 有 MCP vs 没有 MCP

| 对比 | 没有 MCP | 有了 MCP |
|------|----------|----------|
| **获取 PRD** | 用户复制粘贴到对话框 | Claude 自动调用 ai24.getTaskInfo() |
| **查看设计稿** | 用户截图发给 Claude | Claude 自动调用 figma.getFile() |
| **查阅文档** | 用户复制文档内容 | Claude 自动调用 confluence.readPage() |
| **触发构建** | 用户手动点击 Jenkins | Claude 自动调用 jenkins.triggerBuild() |
| **上报结果** | 用户手动填写报告 | Claude 调用完成指标 MCP 或量化指标 Skill |
| **效率** | 低（人工操作多） | 高（全自动） |
| **准确性** | 低（可能漏掉信息） | 高（直接获取最新数据） |

---

## 二、MCP 服务总览

Code-Agent 按环境和开关动态配置 MCP 服务器，分为 3 种传输类型。不要把数量理解成固定值：Figma token、memmachine 开关和环境版服务都会影响最终清单。

| 类型 | 说明 |
|------|------|
| **stdio** | 本地子进程，通过标准输入输出通信 |
| **sse** | 远程 Server-Sent Events，HTTP 长连接 |
| **http** | 远程 HTTP，无状态请求响应 |

---

## 三、stdio 类型 MCP 服务（本地子进程）

### 1. code-agent-report-tools（任务上报工具）

**作用**：Code-Agent 自己的 MCP 服务器，提供任务上报能力。

**配置代码**：[2300-2306](../../code-agent/claude_agent_sdk_wrapper.py#L2300-L2306)

```python
mcp_servers["code-agent-report-tools"] = {
    "type": "stdio",
    "command": "python",
    "args": [str(Path(__file__).parent / "mcp_server" / "server.py")],
    "alwaysLoad": True
}
```

**实现位置**：[mcp_server/server.py](../../code-agent/mcp_server/server.py)

**当前提供的工具**：
- `report_completion_metrics` - 汇总代码量、Token、耗时、文件和测试数量，以 `reportType=4` 上报 AI24

### 完成指标的新 Skill 路径

主分支新增 `.claude/skills/report-completion-metrics`：

```text
Claude 调用 report-completion-metrics Skill
  → report_metrics.py
  → POST /api/task/notify
  → reportType=4
```

它是直接 HTTP 脚本，不是 MCP 服务。当前仍处于并存状态：`code-agent-report-tools` 没有删除，`apply` 和 `apply-no-upload` 仍明确调用旧 MCP，所以文档不能写成“已经完全替换”。

**启动命令**：
```bash
python /path/to/code-agent/mcp_server/server.py
```

---

### 2. memmachine（记忆存储）

**作用**：通过 `mcp-remote` 连接到远程记忆存储服务。

**配置代码**：[2353-2358](../../code-agent/claude_agent_sdk_wrapper.py#L2353-L2358)

```python
mcp_servers["memmachine"] = {
    "type": "stdio",
    "command": "mcp-remote",
    "args": ["http://10.33.140.21:8080/mcp/", "--allow-http"],
    "alwaysLoad": True
}
```

**特殊说明**：
- 使用 `mcp-remote` 工具作为代理
- 实际连接到 `http://10.33.140.21:8080/mcp/`
- `--allow-http` 允许非 HTTPS 连接

**环境变量控制**：
```python
# 可通过环境变量关闭
if os.getenv("ENABLE_MEMMACHINE_MCP", "1") != "0":
    # ... 配置 memmachine
```

**启动命令**：
```bash
mcp-remote http://10.33.140.21:8080/mcp/ --allow-http
```

---

### 3. mastergo（MasterGo 设计稿访问）

**作用**：访问 MasterGo 设计稿（类似 Figma 的国产设计工具）。

**配置代码**：[2364-2369](../../code-agent/claude_agent_sdk_wrapper.py#L2364-L2369)

```python
mastergo_token = os.getenv("MASTERGO_TOKEN", "mg_da6629db27d74b7e812c61e25a273f1e")
mastergo_url = os.getenv("MASTERGO_URL", "https://mastergo.com")
mcp_servers["mastergo"] = {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@mastergo/magic-mcp", f"--token={mastergo_token}", f"--url={mastergo_url}"],
    "alwaysLoad": True
}
```

**环境变量**：
- `MASTERGO_TOKEN` - MasterGo 访问令牌（默认值：黄建华的 token）
- `MASTERGO_URL` - MasterGo 服务地址（默认：https://mastergo.com）

**启动命令**：
```bash
npx -y @mastergo/magic-mcp \
  --token=mg_da6629db27d74b7e812c61e25a273f1e \
  --url=https://mastergo.com
```

**提供的能力**：
- 读取 MasterGo 设计稿
- 导出设计图层
- 获取设计规范（颜色、字体、间距）

---

### 4. vimg（图片上传）

**作用**：上传视觉稿导出的图片。

**配置代码**：[2389-2394](../../code-agent/claude_agent_sdk_wrapper.py#L2389-L2394)

```python
mcp_servers["vimg"] = {
    "type": "stdio",
    "command": "npx",
    "args": ["--registry=http://npm.idcvdian.com", "-y", "-p", "@vdian/mcp-vimg@1.0.4", "mcp-vimg"],
    "alwaysLoad": True
}
```

**特殊说明**：
- 使用公司内部 npm 仓库（`http://npm.idcvdian.com`）
- 固定版本 `@vdian/mcp-vimg@1.0.4`

**启动命令**：
```bash
npx --registry=http://npm.idcvdian.com \
  -y -p @vdian/mcp-vimg@1.0.4 mcp-vimg
```

---

## 四、sse 类型 MCP 服务（远程 SSE）

### 1. ai24（AI24 平台集成）⭐️ 最重要

**作用**：与 AI24 管理平台集成，提供模板、状态更新、文档上报等能力。

**配置代码**：[2328-2336](../../code-agent/claude_agent_sdk_wrapper.py#L2328-L2336)

```python
ai24_mcp_url = os.getenv("AI24_MCP_URL", "http://higress.idcvdian.com/mcp-servers/ai24/sse")
from config import get_ai24_mcp_name
ai24_mcp_name = get_ai24_mcp_name()  # daily: "ai24", pre: "ai24-pre", prod: "ai24-prod"
mcp_servers[ai24_mcp_name] = {
    "type": "sse",
    "url": ai24_mcp_url,
    "alwaysLoad": True
}
```

**环境自适应**：

| 环境 | MCP 名称 | URL |
|------|----------|-----|
| daily | `ai24` | `http://higress.idcvdian.com/mcp-servers/ai24/sse` |
| pre | `ai24-pre` | `http://higress.idcvdian.com/mcp-servers/ai24-pre/sse` |
| prod | `ai24-prod` | `http://higress.idcvdian.com/mcp-servers/ai24-prod/sse` |

**提供的工具**：
- `getTemplate` - 获取工作流模板（OpenSpec 命令的提示词）
- `updateTaskStatus` - 更新任务状态
- `reportDocument` - 上报技术文档
- `getTaskInfo` - 获取任务信息

---

### 2. context1（中间件文档）

**作用**：访问公司中间件文档（如 Redis、MySQL、RocketMQ 的使用规范）。

**配置代码**：[2398-2403](../../code-agent/claude_agent_sdk_wrapper.py#L2398-L2403)

```python
context1_mcp_url = os.getenv("CONTEXT1_MCP_URL", "http://middleware-mcp.daily.idcvdian.com/sse")
mcp_servers["context1"] = {
    "type": "sse",
    "url": context1_mcp_url,
    "alwaysLoad": True
}
```

**环境变量**：
- `CONTEXT1_MCP_URL` - Context1 MCP 服务地址

**三环境配置**：

| 环境 | URL |
|------|-----|
| daily | `http://middleware-mcp.daily.idcvdian.com/sse` |
| pre | `http://middleware-mcp.pre.idcvdian.com/sse` |
| prod | `http://middleware-mcp.idcvdian.com/sse` |

---

### 3. mcp-service-link-confluence（Confluence 文档）

**作用**：读取 Confluence 上的技术文档。

**配置代码**：[2322-2326](../../code-agent/claude_agent_sdk_wrapper.py#L2322-L2326)

```python
mcp_servers["mcp-service-link-confluence"] = {
    "type": "sse",
    "url": "http://higress.idcvdian.com/mcp-servers/mcp-service-link-confluence/sse",
    "alwaysLoad": True
}
```

**作用**：
- 读取 Confluence 页面内容
- 搜索相关文档
- 获取最新的技术规范

---

### 4. data-factory-daily（数据工厂）

**作用**：访问数据工厂服务。

**配置代码**：[2405-2410](../../code-agent/claude_agent_sdk_wrapper.py#L2405-L2410)

```python
mcp_servers["data-factory-daily"] = {
    "type": "sse",
    "url": "http://higress.idcvdian.com/mcp-servers/data-factory-daily/sse",
    "alwaysLoad": True
}
```

---

### 5. odin-daily（Odin 服务）

**作用**：Odin 服务集成。

**配置代码**：[2428-2433](../../code-agent/claude_agent_sdk_wrapper.py#L2428-L2433)

```python
mcp_servers["odin-daily"] = {
    "type": "sse",
    "url": "http://higress.idcvdian.com/mcp-servers/odin-daily/sse",
    "alwaysLoad": True
}
```

---

### 6. zeus-ci（Zeus CI）

**作用**：Zeus 持续集成服务。

**配置代码**：[2435-2441](../../code-agent/claude_agent_sdk_wrapper.py#L2435-L2441)

```python
mcp_servers["zeus-ci"] = {
    "type": "sse",
    "url": "http://higress.idcvdian.com/mcp-servers/zeus-ci/sse",
    "autoApprove": ["*"],  # 自动批准所有操作
    "alwaysLoad": True
}
```

**特殊配置**：
- `autoApprove: ["*"]` - 自动批准所有操作，无需用户确认

---

### 7. zeus（Zeus 通用服务）

```python
mcp_servers["zeus"] = {
    "type": "sse",
    "url": "http://higress.idcvdian.com/mcp-servers/zeus/sse",
    "autoApprove": ["*"],
    "alwaysLoad": True
}
```

`zeus-ci` 与 `zeus` 是两个独立 MCP 名称，工具权限也分别使用 `mcp__zeus-ci__*` 和 `mcp__zeus__*`。

---

### 8. integration-test-automation（集成测试自动化）

**作用**：集成测试自动化服务。

**配置代码**：[2443-2449](../../code-agent/claude_agent_sdk_wrapper.py#L2443-L2449)

```python
mcp_servers["integration-test-automation"] = {
    "type": "sse",
    "url": "http://higress.idcvdian.com/mcp-servers/integration-test-automation/sse",
    "autoApprove": ["*"],
    "alwaysLoad": True
}
```

---

### 9-11. 板端云服务（3个）

**作用**：板端接入 AI 软件工厂相关服务。

**配置代码**：[2474-2491](../../code-agent/claude_agent_sdk_wrapper.py#L2474-L2491)

```python
# 板端设备服务
mcp_servers["daily-wd24-cloud-device"] = {
    "type": "sse",
    "url": "http://higress-dev.idcvdian.com/mcp-servers/daily-wd24-cloud-device/sse",
    "autoApprove": ["*"],
    "alwaysLoad": True
}

# 板端核心服务
mcp_servers["daily-wd24-cloud-core"] = {
    "type": "sse",
    "url": "http://higress-dev.idcvdian.com/mcp-servers/daily-wd24-cloud-core/sse",
    "autoApprove": ["*"],
    "alwaysLoad": True
}

# 板端云运维服务
mcp_servers["wd24-cloud-ops-daily"] = {
    "type": "sse",
    "url": "http://higress.idcvdian.com/mcp-servers/wd24-cloud-ops-daily-http/sse",
    "autoApprove": ["*"],
    "alwaysLoad": True
}
```

---

## 五、http 类型 MCP 服务（远程 HTTP）

### 1. figma（Figma 官方 MCP）⭐️ 动态 Token

**作用**：访问 Figma 设计稿（官方 MCP 服务器）。

**配置代码**：[2371-2386](../../code-agent/claude_agent_sdk_wrapper.py#L2371-L2386)

```python
management_api_url = os.getenv("MANAGEMENT_API_BASE_URL", "http://ai24.daily.vdian.net")
figma_token_provider = FigmaTokenProvider(api_base_url=management_api_url)
initial_token = figma_token_provider.get_token()
if initial_token:
    mcp_servers["figma"] = {
        "type": "http",
        "url": "https://mcp.figma.com/mcp",
        "headers": {"Authorization": f"Bearer {initial_token}"},
        "alwaysLoad": True
    }
    logger.info("Figma MCP 服务器配置完成（动态 token）")
else:
    logger.warning("Figma token 获取失败，Figma MCP 未配置")
```

**特殊机制：动态 Token**

```python
# FigmaTokenProvider 自动刷新 token
class FigmaTokenProvider:
    def get_token(self):
        # 1. 检查 token 是否过期
        # 2. 如果过期，从 AI24 API 获取新 token
        # 3. 缓存新 token
        # 4. 返回 token
```

**官方文档**：https://developers.figma.com/docs/figma-mcp-server/

---

### 2. ui-test-automation（UI 自动化测试）

**作用**：UI 自动化测试服务。

**配置代码**：[2420-2426](../../code-agent/claude_agent_sdk_wrapper.py#L2420-L2426)

```python
ui_test_automation_mcp_url = os.getenv("UI_TEST_AUTOMATION_MCP_URL", "https://ui-test.daily.vdian.net/mcp")
mcp_servers["ui-test-automation"] = {
    "type": "http",
    "url": ui_test_automation_mcp_url,
    "alwaysLoad": True
}
```

**环境变量**：
- `UI_TEST_AUTOMATION_MCP_URL`

**三环境配置**：

| 环境 | URL |
|------|-----|
| daily | `https://ui-test.daily.vdian.net/mcp` |
| pre | `https://ui-test.pre.vdian.net/mcp` |
| prod | `https://ui-test.vdian.net/mcp` |

---

### 3. jenkins（Jenkins 构建）

**作用**：Jenkins 构建和部署。

**配置代码**：[2451-2460](../../code-agent/claude_agent_sdk_wrapper.py#L2451-L2460)

```python
mcp_servers["jenkins"] = {
    "type": "http",
    "url": "https://jenkins-ml.vdian.net/mcp-server/mcp",
    "headers": {
        "Authorization": "Basic <BASE64_USERNAME_PASSWORD>"
    },
    "autoApprove": ["*"],
    "alwaysLoad": True
}
```

**认证方式**：Basic Auth
- 用户名和密码从安全配置或环境变量读取
- 文档只保留占位符，不保存可还原的 Basic Auth 凭据

---

### 4. media（媒体编译）

**作用**：媒体文件编译服务。

**配置代码**：[2462-2471](../../code-agent/claude_agent_sdk_wrapper.py#L2462-L2471)

```python
mcp_servers["media"] = {
    "type": "http",
    "url": "http://compile-media.daily.idcvdian.com/mcp-server/stateless",
    "headers": {
        "Authorization": "Basic <BASE64_USERNAME_PASSWORD>"
    },
    "autoApprove": ["*"],
    "alwaysLoad": True
}
```

**特殊说明**：
- `stateless` 端点 - 无状态 HTTP 请求

---

## 六、MCP 服务配置的通用字段

### 必填字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `type` | 服务类型 | `"stdio"` / `"sse"` / `"http"` |

### stdio 类型字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `command` | 命令 | `"python"` / `"npx"` / `"mcp-remote"` |
| `args` | 参数数组 | `["server.py"]` |
| `alwaysLoad` | 是否始终加载 | `True` |

### sse 类型字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `url` | SSE 服务地址 | `"http://...sse"` |
| `alwaysLoad` | 是否始终加载 | `True` |
| `autoApprove` | 自动批准的操作 | `["*"]` 全部批准 |

### http 类型字段

| 字段 | 说明 | 示例 |
|------|------|------|
| `url` | HTTP 服务地址 | `"https://..."` |
| `headers` | 请求头 | `{"Authorization": "Bearer ..."}` |
| `alwaysLoad` | 是否始终加载 | `True` |
| `autoApprove` | 自动批准的操作 | `["*"]` 全部批准 |

### settings.json 权限变化

服务配置决定“连接哪个 MCP”，`config/.claude/settings.json` 决定“哪些工具可以直接调用”。本次更新包括：

- UI 自动化从多个具体工具名合并为 `mcp__ui-test-automation__*`，新工具名不再需要逐个追加权限。
- Zeus 与 Zeus-CI 分别开放 `mcp__zeus__*`、`mcp__zeus-ci__*`。
- AI24 单条 `createApprovalItemUsingPOST` 权限被移除，保留 `batchCreateApprovalItemUsingPOST`，审批项创建应走批量接口。

---

## 七、MCP 服务的启动时机

### alwaysLoad: True

所有 MCP 服务都配置了 `"alwaysLoad": True`，表示：
- 在 ClaudeAgentSDKService 初始化时立即启动
- 不是按需启动
- 全局共享（所有任务共用）

**启动位置**：[claude_agent_sdk_wrapper.py:2504-2508](../../code-agent/claude_agent_sdk_wrapper.py#L2504-L2508)

```python
service = ClaudeAgentSDKService.get_instance(
    mcp_config_path=mcp_config_path,
    enable_path_security=enable_path_security,
    **kwargs  # 包含 mcp_servers 配置
)
```

---

## 八、动态配置机制

### 1. 环境自适应（AI24 MCP）

```python
from config import get_ai24_mcp_name
ai24_mcp_name = get_ai24_mcp_name()

# config.py 中的实现
def get_ai24_mcp_name() -> str:
    env = os.getenv("ENV", "daily")
    if env == "pre":
        return "ai24-pre"
    elif env == "prod":
        return "ai24-prod"
    else:
        return "ai24"
```

### 2. 动态 Token（Figma）

```python
# 初始化时获取 token
figma_token_provider = FigmaTokenProvider(api_base_url=management_api_url)
initial_token = figma_token_provider.get_token()

# 运行时动态刷新
service.figma_token_provider = figma_token_provider
```

### 3. 环境变量控制

```python
# 可通过环境变量关闭 memmachine
if os.getenv("ENABLE_MEMMACHINE_MCP", "1") != "0":
    mcp_servers["memmachine"] = { ... }
```

---

## 九、MCP 服务的使用示例

### Claude 如何调用 MCP 工具？

```
Claude 执行任务时：

1. 读取 Confluence 文档
   → 调用 mcp-service-link-confluence 的 readPage 工具

2. 获取 OpenSpec 模板
   → 调用 ai24 的 getTemplate 工具

3. 读取 Figma 设计稿
   → 调用 figma 的 getFile 工具

4. 上报完成量化指标
   → 当前 Apply 流程调用 code-agent-report-tools.report_completion_metrics
   → 新增 report-completion-metrics Skill 可直接 HTTP 上报

5. 触发 Jenkins 构建
   → 调用 jenkins 的 triggerBuild 工具
```

### 日志示例

```
[2026-07-07 10:30:00] Figma MCP 服务器配置完成（动态 token）
[2026-07-18 10:30:01] 正在动态组装 MCP 服务器...
[2026-07-07 10:30:02] stdio MCP 启动: code-agent-report-tools
[2026-07-07 10:30:02] stdio MCP 启动: mastergo
[2026-07-07 10:30:02] stdio MCP 启动: memmachine
[2026-07-07 10:30:02] stdio MCP 启动: vimg
[2026-07-07 10:30:03] sse MCP 连接: ai24
[2026-07-07 10:30:03] sse MCP 连接: context1
[2026-07-07 10:30:03] http MCP 连接: figma
...
[2026-07-07 10:30:05] 所有 MCP 服务器启动完成
```

---

## 十、小结

| 维度 | 内容 |
|------|------|
| **总数量** | 按环境、开关和凭证动态变化 |
| **stdio** | 本地子进程类服务 |
| **sse** | 远程长连接类服务，包含独立的 `zeus-ci` 与 `zeus` |
| **http** | 远程无状态服务 |
| **核心服务** | ai24（模板/状态）、figma（设计）、jenkins（构建） |
| **启动时机** | ClaudeAgentSDKService 初始化时全部启动 |
| **特殊机制** | 环境自适应、动态 Token、环境变量控制 |

**设计亮点**：
1. ⭐️ **环境自适应** - ai24 MCP 根据 daily/pre/prod 自动切换
2. ⭐️ **动态 Token** - Figma token 自动刷新，无需手动维护
3. ⭐️ **全局共享** - 所有任务共用 MCP 连接，节省资源

**关联阅读**：
- MCP 协议规范 → https://modelcontextprotocol.io/
- Figma MCP 文档 → https://developers.figma.com/docs/figma-mcp-server/
- 核心层启动流程 → [04-核心层详解.md](../01-架构与启动/04-核心层详解.md)
