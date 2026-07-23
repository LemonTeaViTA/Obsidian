# MCP 服务深度解析

> 定位：解释动态 Token、AI24 接入、传输方式和生命周期等关键机制。完整服务清单与配置字段以《MCP服务配置详解》为准。

> 本文档深入讲解几个关键 MCP 服务的实现细节、使用方式和最佳实践。

---

## 一、Figma 动态 Token 机制 ⭐️

### 1.1 为什么需要动态 Token？

**问题背景**：
- Figma OAuth access token 有过期时间（通常 2 小时）
- 如果写死 token，过期后就无法访问 Figma
- 需要一个自动刷新机制

**解决方案**：`FigmaTokenProvider` 类

### 1.2 FigmaTokenProvider 源码解析

**代码位置**：[claude_agent_sdk_wrapper.py:269-308](../../code-agent/claude_agent_sdk_wrapper.py#L269-L308)

```python
class FigmaTokenProvider:
    """Figma OAuth access token 动态获取，带本地 TTL 缓存"""

    def __init__(self, api_base_url: str, buffer_ms: int = 180_000):
        """
        Args:
            api_base_url: 管理平台地址，如 http://ai24.daily.vdian.net
            buffer_ms: 提前刷新的缓冲时间（毫秒），默认 3 分钟
        """
        # AI24 管理平台的 Figma token API
        self._api_url = f"{api_base_url.rstrip('/')}/api/figma/oauth/token"
        self._buffer_ms = buffer_ms  # 180,000 ms = 3 分钟
        
        # 缓存的 token 和过期时间
        self._token: Optional[str] = None
        self._expires_at: int = 0  # 毫秒时间戳
        
        # 线程锁（防止并发刷新）
        self._lock = threading.Lock()

    def get_token(self) -> Optional[str]:
        """获取有效的 access_token，快过期则自动刷新"""
        now_ms = int(time.time() * 1000)
        
        # 检查缓存是否有效（提前 3 分钟刷新）
        if self._token and now_ms < self._expires_at - self._buffer_ms:
            return self._token  # 缓存有效，直接返回
        
        # 缓存失效或快过期，刷新 token
        return self._refresh()

    def _refresh(self) -> Optional[str]:
        """从 AI24 API 刷新 token"""
        with self._lock:  # 加锁，防止并发刷新
            # 双重检查（另一个线程可能已经刷新了）
            now_ms = int(time.time() * 1000)
            if self._token and now_ms < self._expires_at - self._buffer_ms:
                return self._token
            
            try:
                # 调用 AI24 API
                resp = httpx.get(self._api_url, timeout=10.0)
                data = resp.json()
                
                # API 返回格式：
                # {
                #   "success": true,
                #   "data": {
                #     "accessToken": "figd_xxx...",
                #     "expiresAt": 1720345678000
                #   }
                # }
                
                if data.get("success") and data.get("data"):
                    self._token = data["data"]["accessToken"]
                    self._expires_at = data["data"]["expiresAt"]
                    logger.info("Figma access token 刷新成功")
                else:
                    logger.warning(f"Figma token 接口返回失败: {data.get('message')}")
            except Exception as e:
                logger.error(f"刷新 Figma token 失败: {e}", exc_info=True)
            
            return self._token
```

### 1.3 工作流程图

```
第1次获取 token
    ↓
┌────────────────────────────────────────┐
│ get_token()                            │
│   now = 10:00:00                       │
│   _token = None                        │
│   _expires_at = 0                      │
│   → 缓存无效，调用 _refresh()          │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ _refresh()                             │
│   1. 加锁 (防止并发)                   │
│   2. 调用 AI24 API                     │
│      GET /api/figma/oauth/token        │
│   3. 解析响应                          │
│      accessToken: "figd_abc..."        │
│      expiresAt: 12:00:00 (2小时后)     │
│   4. 保存到缓存                        │
│      _token = "figd_abc..."            │
│      _expires_at = 12:00:00            │
└────────────────────────────────────────┘
    ↓
返回 "figd_abc..."


第2次获取 token (10分钟后)
    ↓
┌────────────────────────────────────────┐
│ get_token()                            │
│   now = 10:10:00                       │
│   _token = "figd_abc..."               │
│   _expires_at = 12:00:00               │
│   buffer = 3分钟                       │
│                                        │
│   检查：now < expires_at - buffer?     │
│   10:10:00 < 12:00:00 - 3分钟          │
│   10:10:00 < 11:57:00 ✅              │
│   → 缓存有效，直接返回                 │
└────────────────────────────────────────┘
    ↓
返回缓存的 "figd_abc..." (无需调用 API)


第3次获取 token (接近过期时)
    ↓
┌────────────────────────────────────────┐
│ get_token()                            │
│   now = 11:58:00                       │
│   _token = "figd_abc..."               │
│   _expires_at = 12:00:00               │
│   buffer = 3分钟                       │
│                                        │
│   检查：now < expires_at - buffer?     │
│   11:58:00 < 12:00:00 - 3分钟          │
│   11:58:00 < 11:57:00 ❌              │
│   → 缓存即将过期，调用 _refresh()      │
└────────────────────────────────────────┘
    ↓
_refresh() 获取新 token
    ↓
返回新 token
```

### 1.4 关键设计点

#### ① 提前刷新机制（buffer_ms）

```python
buffer_ms = 180_000  # 3 分钟 = 180,000 毫秒

# 不是等到 token 完全过期才刷新
# 而是提前 3 分钟刷新

# 例如：token 12:00:00 过期
# 11:57:00 就开始刷新
# 这样保证了服务的连续性
```

**为什么提前 3 分钟？**
- 给 API 调用留出时间
- 避免在关键时刻 token 失效
- 应对网络延迟

#### ② 双重检查锁定（Double-Check Locking）

```python
def _refresh(self):
    with self._lock:  # 第一重检查：加锁
        # 第二重检查：再次验证是否需要刷新
        now_ms = int(time.time() * 1000)
        if self._token and now_ms < self._expires_at - self._buffer_ms:
            return self._token  # 另一个线程已经刷新了
        
        # 真正刷新
        resp = httpx.get(self._api_url, timeout=10.0)
        ...
```

**为什么需要双重检查？**

```
并发场景：
线程 A: get_token() → 缓存失效 → 准备 _refresh()
线程 B: get_token() → 缓存失效 → 准备 _refresh()

如果没有双重检查：
线程 A: 获取锁 → 刷新 token → 释放锁
线程 B: 获取锁 → 再次刷新 token（浪费！）→ 释放锁

有双重检查：
线程 A: 获取锁 → 刷新 token → 释放锁
线程 B: 获取锁 → 发现已刷新 → 直接返回 → 释放锁
```

### 1.5 在 MCP 配置中的使用

**初始化时**：[claude_agent_sdk_wrapper.py:2374-2386](../../code-agent/claude_agent_sdk_wrapper.py#L2374-L2386)

```python
# 1. 创建 FigmaTokenProvider
management_api_url = os.getenv("MANAGEMENT_API_BASE_URL", "http://ai24.daily.vdian.net")
figma_token_provider = FigmaTokenProvider(api_base_url=management_api_url)

# 2. 首次获取 token
initial_token = figma_token_provider.get_token()

# 3. 配置 Figma MCP
if initial_token:
    mcp_servers["figma"] = {
        "type": "http",
        "url": "https://mcp.figma.com/mcp",
        "headers": {"Authorization": f"Bearer {initial_token}"},
        "alwaysLoad": True
    }
```

**运行时刷新**：[claude_agent_sdk_wrapper.py:2510-2512](../../code-agent/claude_agent_sdk_wrapper.py#L2510-L2512)

```python
# 挂载到 service 实例
if not mcp_config_path and figma_token_provider:
    service.figma_token_provider = figma_token_provider
```

### 1.6 AI24 Token API

**API 端点**：
```
GET {MANAGEMENT_API_BASE_URL}/api/figma/oauth/token
```

**响应格式**：
```json
{
  "success": true,
  "data": {
    "accessToken": "figd_xxx_yyy_zzz",
    "expiresAt": 1720345678000
  },
  "message": "success"
}
```

**三环境地址**：

| 环境 | API Base URL |
|------|--------------|
| daily | `http://ai24.daily.vdian.net` |
| pre | `http://ai24.pre.vdian.net` |
| prod | `http://ai24.vdian.net` |

---

## 二、AI24 MCP 服务详解 ⭐️

### 2.1 什么是 AI24？

**AI24 = AI 软件工厂管理平台**

功能：
- 任务管理（创建、分配、跟踪）
- 工作流模板管理
- 任务状态追踪
- 文档收集和整理
- 集成 DEP、Confluence 等系统

### 2.2 环境自适应配置

**代码位置**：[claude_agent_sdk_wrapper.py:2328-2336](../../code-agent/claude_agent_sdk_wrapper.py#L2328-L2336)

```python
# 1. 从环境变量获取 URL
ai24_mcp_url = os.getenv("AI24_MCP_URL", "http://higress.idcvdian.com/mcp-servers/ai24/sse")

# 2. 根据当前环境确定 MCP 服务器名称
from config import get_ai24_mcp_name
ai24_mcp_name = get_ai24_mcp_name()

# 3. 配置 MCP 服务器
mcp_servers[ai24_mcp_name] = {
    "type": "sse",
    "url": ai24_mcp_url,
    "alwaysLoad": True
}
```

**get_ai24_mcp_name() 实现**：[config.py:163-182](../../code-agent/config.py#L163-L182)

```python
def get_ai24_mcp_name() -> str:
    """
    根据当前环境获取 AI24 MCP 服务名称
    
    Returns:
        str: MCP 服务名称
            - daily 环境: "ai24"
            - pre 环境: "ai24-pre"
            - prod 环境: "ai24-prod"
    """
    env = os.getenv("ENV", "daily")
    
    if env == "pre":
        return "ai24-pre"
    elif env == "prod":
        return "ai24-prod"
    else:
        # daily 环境或其他未识别的环境默认使用 ai24
        return "ai24"
```

**环境映射表**：

| ENV 环境变量 | MCP 名称 | MCP URL |
|--------------|----------|---------|
| `daily` | `ai24` | `http://higress.idcvdian.com/mcp-servers/ai24/sse` |
| `pre` | `ai24-pre` | `http://higress.idcvdian.com/mcp-servers/ai24-pre/sse` |
| `prod` | `ai24-prod` | `http://higress.idcvdian.com/mcp-servers/ai24-prod/sse` |

### 2.3 AI24 MCP 提供的工具

虽然具体工具定义在 AI24 MCP Server 中，但根据代码使用情况，主要包括：

#### ① getTemplate（获取工作流模板）

**作用**：获取 OpenSpec 命令的提示词模板

**使用场景**：
```python
# 用户执行：/openspec:proposal
# Code-Agent 拦截命令，调用 AI24 MCP
prompt = await ai24_mcp.call_tool("getTemplate", {
    "template_id": "proposal",
    "stage": "requirements"
})
# 返回：详细的需求分析提示词（500+ 字符）
```

**代码位置**：`commands_container.py` 中的 `_fetch_prompt_from_ai24()`

#### ② updateTaskStatus（更新任务状态）

**作用**：更新任务状态到 AI24 管理平台

**状态枚举**：
- `RECEIVED` - 已接收
- `EXECUTING` - 执行中
- `COMPLETED` - 已完成
- `FAILED` - 失败

#### ③ reportDocument（上报技术文档）

**作用**：将生成的技术文档上报到 AI24

**文档类型**：
- 技术设计文档
- 测试设计文档
- API 文档
- 部署文档

#### ④ getTaskInfo（获取任务信息）

**作用**：从 AI24 获取任务详细信息

**返回内容**：
- 任务描述
- PRD 文档
- 相关资源
- 任务配置

### 2.4 SSE 连接机制

**SSE = Server-Sent Events（服务器推送事件）**

```
Claude Agent SDK
    ↓
建立 SSE 连接
    ↓
http://higress.idcvdian.com/mcp-servers/ai24/sse
    ↓
保持长连接（HTTP/1.1）
    ↓
AI24 MCP Server 主动推送：
  - 工具列表更新
  - 资源变更通知
  - 实时状态同步
```

**优势**：
- 实时性好（无需轮询）
- 服务器主动推送
- 单向通信（服务器 → 客户端）

---

## 三、本地 stdio MCP 服务详解

### 3.1 code-agent-report-tools

**作用**：Code-Agent 自己实现的 MCP 服务器，提供任务上报能力。

**源码位置**：[mcp_server/server.py](../../code-agent/mcp_server/server.py)

**启动方式**：
```python
mcp_servers["code-agent-report-tools"] = {
    "type": "stdio",
    "command": "python",
    "args": [str(Path(__file__).parent / "mcp_server" / "server.py")],
    "alwaysLoad": True
}
```

**通信方式**：
```
Claude Agent SDK
    ↓
启动子进程：python mcp_server/server.py
    ↓
通过 stdin/stdout 通信（JSON-RPC）
    ↓
SDK 发送请求到 stdin
    ↓
MCP Server 处理请求
    ↓
MCP Server 通过 stdout 返回响应
    ↓
SDK 解析响应
```

**示例交互**：
```json
// SDK → MCP Server (stdin)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "report_completion_metrics",
    "arguments": {
      "task_id": "task_123",
      "report_content": {
        "total_code_lines": 320,
        "total_token": 8000,
        "cost_estimate": 0.04,
        "execution_time": 180,
        "files_modified": 6
      }
    }
  }
}

// MCP Server → SDK (stdout)
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true,
    "message": "上报成功"
  }
}
```

### 3.2 mastergo

**作用**：访问 MasterGo 设计稿（国产 Figma 替代品）

**启动方式**：
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

**命令解析**：
```bash
npx -y @mastergo/magic-mcp \
  --token=mg_da6629db27d74b7e812c61e25a273f1e \
  --url=https://mastergo.com

# npx: Node.js 包执行器
# -y: 自动确认（不询问是否安装）
# @mastergo/magic-mcp: npm 包名
# --token: MasterGo API Token
# --url: MasterGo 服务地址
```

**提供的能力**：
- 读取设计稿结构
- 导出设计图层为图片
- 获取设计规范（颜色、字体、间距）
- 读取组件库

**使用场景**：
```
用户需求：根据 MasterGo 设计稿实现前端页面
    ↓
Claude 调用 mastergo MCP
    ↓
获取设计稿信息：
  - 页面布局
  - 组件层级
  - 颜色值 (#FF5733)
  - 字体大小 (16px)
  - 间距 (padding: 20px)
    ↓
生成对应的 HTML/CSS 代码
```

---

### 3.3 report-completion-metrics Skill：并存的新路径

当前 `code-agent-report-tools` MCP 实际暴露的是 `report_completion_metrics`。它会尝试从 `StopWatch` 补充时间数据，再通过 `MessageReporter.report_completion_metrics()` 以 `reportType=4` 上报 AI24。

新版本同时增加了一个不经过 MCP 的 Skill：

```text
report-completion-metrics Skill
  → report_metrics.py
  → requests.post(/api/task/notify)
  → reportType=4
```

两条路径当前并存：

| 路径 | 调用方式 | 当前状态 |
|---|---|---|
| 旧 MCP | `mcp__code-agent-report-tools__report_completion_metrics` | MCP 仍注册，Apply Skill 仍在使用 |
| 新 Skill | `report-completion-metrics` + Python 脚本 | 已加入并随启动复制到用户 Skill 目录，但尚未接管 Apply 流程 |

当前实现还有两个需要学习时注意的细节：Skill 命令使用项目内相对路径，而部署后的 Skill 位于 `~/.claude/skills`；脚本在 StopWatch 补全之前先校验 `execution_time` 必填，因此“缺失时自动补全”目前并不能真正生效。

---

## 四、远程 HTTP MCP 服务详解

### 4.1 jenkins

**作用**：触发 Jenkins 构建和部署

**配置代码**：[claude_agent_sdk_wrapper.py:2451-2460](../../code-agent/claude_agent_sdk_wrapper.py#L2451-L2460)

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

**认证方式：Basic Auth**

```python
# Base64 解码
import base64
auth_string = "<BASE64_USERNAME_PASSWORD>"
decoded = base64.b64decode(auth_string).decode('utf-8')
print(decoded)  # "<username>:<password>"

# 用户名和密码必须从安全配置或环境变量读取
```

**HTTP 请求示例**：
```bash
curl -X POST https://jenkins-ml.vdian.net/mcp-server/mcp \
  -H "Authorization: Basic <BASE64_USERNAME_PASSWORD>" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "trigger_build",
      "arguments": {
        "job_name": "order-service-build",
        "branch": "feature/login"
      }
    }
  }'
```

**autoApprove 的作用**：
```python
"autoApprove": ["*"]  # 自动批准所有操作
```

- 不需要用户手动确认
- Claude 可以直接触发 Jenkins 构建
- 适用于可信的内部服务

### 4.2 ui-test-automation

**作用**：UI 自动化测试服务

**配置代码**：[claude_agent_sdk_wrapper.py:2420-2426](../../code-agent/claude_agent_sdk_wrapper.py#L2420-L2426)

```python
ui_test_automation_mcp_url = os.getenv("UI_TEST_AUTOMATION_MCP_URL", "https://ui-test.daily.vdian.net/mcp")
mcp_servers["ui-test-automation"] = {
    "type": "http",
    "url": ui_test_automation_mcp_url,
    "alwaysLoad": True
}
```

**提供的能力**：
- 生成 UI 测试用例
- 执行自动化测试
- 截图对比
- 生成测试报告

**使用场景**：
```
Claude 完成前端页面开发
    ↓
调用 ui-test-automation MCP
    ↓
自动生成测试用例：
  - 点击按钮
  - 输入表单
  - 验证提示信息
    ↓
执行测试并返回结果
```

---

## 五、MCP 服务的生命周期

### 5.1 启动时机

```python
# main.py:3864
create_claude_service(enable_path_security=True)
    ↓
ClaudeAgentSDKService.__init__()
    ↓
启动所有 alwaysLoad=True 的 MCP 服务器
    ↓
当前配置中所有 `alwaysLoad=True` 的 MCP 服务完成加载
```

### 5.2 运行时状态

```
stdio MCP (子进程)
  ├── 进程状态：运行中
  ├── stdin/stdout：保持打开
  └── 进程号：记录在 SDK 内部

sse MCP (长连接)
  ├── HTTP 连接：保持活跃
  ├── 心跳：定期发送
  └── 事件监听：等待服务器推送

http MCP (无状态)
  ├── 按需建立连接
  ├── 请求-响应
  └── 连接关闭
```

### 5.3 关闭时清理

```python
# 服务关闭时
atexit.register(cleanup_mcp_servers)
    ↓
关闭所有 stdio 子进程
    ↓
关闭所有 sse 连接
    ↓
释放资源
```

---

## 六、小结

| MCP 服务 | 类型 | 核心功能 | 关键机制 |
|----------|------|----------|----------|
| **figma** | http | 设计稿访问 | 动态 Token 刷新 |
| **ai24** | sse | 平台集成 | 环境自适应 |
| **code-agent-report-tools** | stdio | 任务上报 | 本地子进程 |
| **report-completion-metrics Skill** | HTTP 脚本 | 完成量化上报 | 与旧 MCP 并存 |
| **mastergo** | stdio | 设计稿访问 | npx 启动 |
| **jenkins** | http | CI/CD | Basic Auth |
| **ui-test-automation** | http | UI 测试 | HTTP 无状态 |
| **zeus-ci / zeus** | sse | CI 构建 / Zeus 通用能力 | 两个独立服务与权限前缀 |

**关键设计亮点**：
1. ⭐️ **Figma 动态 Token** - 自动刷新，提前 3 分钟，双重检查锁定
2. ⭐️ **AI24 环境自适应** - daily/pre/prod 自动切换 MCP 名称和 URL
3. ⭐️ **stdio 本地服务** - 通过 stdin/stdout 通信，简单高效
4. ⭐️ **sse 长连接** - 实时推送，无需轮询
5. ⭐️ **http 无状态** - 按需连接，支持 Basic Auth

**关联阅读**：
- MCP 协议规范 → https://modelcontextprotocol.io/
- Figma MCP 文档 → https://developers.figma.com/docs/figma-mcp-server/
- MCP 服务配置详解 → [MCP服务配置详解.md](./MCP服务配置详解.md)
