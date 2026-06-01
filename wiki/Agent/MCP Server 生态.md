---
module: Agent
tags: [Agent, MCP, MCP Server, 浏览器自动化, CDP, Tool Use]
difficulty: medium
last_reviewed: 2026-06-01
---

# MCP Server 生态

> 本文是 [[MCP 协议]] 的生态分册——主流 MCP Server 分类清单 + 浏览器自动化（CDP / isolated vs shared / 登录态）这一最复杂的 Server 类别的工程细节。
>
> 协议核心（架构 / transport / 握手 / Host 集成层）见 [[MCP 协议]]；安全模型见 [[MCP 安全模型]]。

> [!tip] 速览（一分钟读完）
> - ==2026 年 MCP Server 生态已成熟==——Anthropic 维护[官方仓库](https://github.com/modelcontextprotocol/servers)，社区贡献上百个 Server。
> - ==按用途分五类==：文件/数据、开发协作、通信、浏览器自动化、AI 接入。
> - ==最复杂的是浏览器自动化==——底层都是 CDP（Chrome DevTools Protocol）封装；核心设计选择是 ==isolated（默认，无登录态）vs shared（连用户 Chrome，有登录态）== 两种模式。
> - ==安全原则==：isolated 是 fail-safe 默认；shared 必须用户显式启用；Agent 创建的 tab 才能关（不可证明则拒绝）。

---

## 一、文件 / 数据访问

| Server | 用途 |
|--------|------|
| `filesystem` | 受控文件读写（限制目录，路径白名单） |
| `git` | git 仓库操作（log / diff / blame） |
| `postgres` | PostgreSQL 查询（read-only / read-write） |
| `sqlite` | SQLite 数据库操作 |

---

## 二、开发协作

| Server | 用途 |
|--------|------|
| ==`github`== | issue/PR 管理、代码搜索、commit 操作 |
| `gitlab` | GitLab 同上 |
| `linear` | 任务管理 |
| `jira` | 项目管理 |

---

## 三、通信 / 团队工具

| Server | 用途 |
|--------|------|
| `slack` | 发消息、读频道、搜历史 |
| `gmail` | 收发邮件 |
| `google-drive` | 读写文件、列目录 |

---

## 四、浏览器自动化

| Server | 用途 |
|--------|------|
| ==`chrome-devtools-mcp`== | Google 官方（2025），2026 浏览器 MCP 事实标准 |
| ==`puppeteer`== | 控制 Chrome（点击、输入、截图） |
| `playwright` | 跨浏览器自动化 |
| `brave-search` | Web 搜索（Brave Search API） |

### 底层协议：Chrome DevTools Protocol (CDP)

==所有浏览器 MCP server 的共同底层==——chrome-devtools-mcp / puppeteer / playwright 都是 ==CDP 客户端==的封装。

==CDP 是什么==：Chrome / Chromium / Edge 内置的==远程控制协议==，基于 WebSocket + JSON-RPC，==独立于 MCP==（早 10 多年就存在，是 Chrome DevTools 的实现协议）。

==启用方式==：

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
chrome.exe --remote-debugging-port=9222
```

==探活与连接==：

```bash
# 探活：返回 Chrome 版本和 WebSocket endpoint
curl http://127.0.0.1:9222/json/version
# {
#   "Browser": "Chrome/121.0.0.0",
#   "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/browser/xxx"
# }

# CDP 客户端通过 WebSocket 发 JSON-RPC
# 例：Page.navigate / DOM.getDocument / Input.dispatchMouseEvent
```

==MCP 与 CDP 的关系==：

```
LLM tool_calls → MCP Server (chrome-devtools-mcp)
                    ↓ 翻译成 CDP 调用
                  WebSocket → Chrome (--remote-debugging-port)
                    ↓ 执行
                  返回 DOM / 截图 / 错误
```

==chrome-devtools-mcp 提供的核心工具==:`navigate_page` / `take_snapshot` / `click` / `fill_form` / `evaluate_script` / `close_page`——本质都是 CDP 调用的封装。

### isolated vs shared:两种工作模式

==生产浏览器 MCP 的核心设计选择==——同一个 server 支持两种模式,行为差异巨大:

| 模式 | 启动参数 | profile | 登录态 | 适用 | 安全风险 |
|------|---------|--------|--------|------|---------|
| ==isolated==(默认) | `--isolated=true` | ==临时 profile,会话结束销毁== | ==无== | 公开页面爬取 / 测试 / 截图 | ==低==——隔离用户数据 |
| ==shared== | `--autoConnect` 或 `--browser-url=...` | ==连用户已开 Chrome== | ==有==(用户的 cookie / login) | 需要登录的任务(GitHub / 知乎 / 微信) | ==高==——Agent 拥有用户身份 |

==isolated 默认的理由==:==安全 fail-safe==——除非用户主动切,否则 Agent 操作的是一个"==干净的临时浏览器=="——不会动用户的 GitHub session、不会发出钱、不会读邮件。

==shared 模式必须用户显式启用==(PaiCli 的 `/browser connect`):
1. 用户在 Chrome 输入 `chrome://inspect/#remote-debugging` ==允许远程调试==
2. PaiCli 探活 `127.0.0.1:9222/json/version` 成功 → 切到 shared
3. 切换==清空所有"全部放行"信任==——避免 isolated 时的授权延续到 shared

### 登录态访问的三种方案

==Agent 怎么访问需要登录的页面==(GitHub PR / 知乎专栏 / 公司内部系统)——三种主流方案:

| 方案 | 实现 | 优点 | 缺点 |
|------|------|------|------|
| ==CDP 复用== | 连用户已开 Chrome(shared 模式) | ==零迁移成本==——用户已登录的所有站点都能用 | 用户必须开远程调试,Agent 拥有完整用户身份 |
| ==Cookie injection== | 从用户 Chrome 导出 cookie,注入 isolated profile | 隔离性好,可选择性导出某站点 cookie | 实现复杂,cookie 过期需重新导出 |
| ==OAuth + token 持久化== | Agent 走标准 OAuth flow,本地存 access_token | ==合规友好==,有明确授权范围 | 实现侵入性大,只支持有 OAuth 的站点 |

==Coding Agent 实战==:绝大多数选 ==CDP 复用==——成本最低、覆盖最广,用户体验最好。==合规要求高的企业==才上 OAuth 方案。

### Tab 所有权追踪:共享浏览器时的隔离原则

==shared 模式下 Agent 不能关用户的 tab==——这是 ==fail-safe 设计==。

==实现==:Agent 创建的每个 tab 打==internal id 标记==,工具操作前校验所有权:

```python
# Agent 创建 tab 时记录
def navigate_page(url: str) -> dict:
    target = await cdp.create_target(url)
    AGENT_OWNED_TARGETS.add(target.id)  # ★ 标记所有权
    return {"target_id": target.id, ...}

# Agent 关 tab 时校验
def close_page(target_id: str):
    if target_id not in AGENT_OWNED_TARGETS:
        raise PermissionError(
            "无法证明此 tab 是 Agent 创建的,拒绝关闭"
        )
    await cdp.close_target(target_id)
    AGENT_OWNED_TARGETS.remove(target_id)
```

==关键原则==:==不可证明则拒绝==——不是"看着像不是自己的就不关",而是"==证明不了是自己的就不关=="。==安全设计的默认态是拒绝==。

==同样适用于==:Multi-Agent 共享资源(数据库连接 / 文件句柄 / GPU)、Sandbox 共享 / 用户级与 Agent 级文件混存等场景——==Tab 所有权追踪是通用模式==。

---

## 五、AI / 其他 LLM 接入

| Server | 用途 |
|--------|------|
| `everart` | 调用 EverArt 生成图片 |
| `sequential-thinking` | 让 Claude 自己调用 CoT 思考工具 |
| `memory` | 跨会话记忆 |

==特别提示==：==官方 Server 用 TypeScript 写==，Python SDK 也成熟，社区两种都活跃。

---

## 相关链接

- [[MCP 协议]] — 协议核心（架构 / transport / 握手 / Host 集成层）
- [[MCP 安全模型]] — 三道安全关卡 / 凭证脱敏
- [[Coding Agent 工具集]] — 浏览器 MCP 作为 `fetch_url` 的重量层 fallback
- [[Function Calling]] — 截图返回值的 image 类型协议
