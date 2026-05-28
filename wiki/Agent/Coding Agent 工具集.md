---
module: LLM
tags: [LLM, Agent, Coding Agent, Tool Use, Claude Code, Cursor]
difficulty: medium
last_reviewed: 2026-05-25
---

# Coding Agent 工具集

> 本文聚焦 ==Coding Agent（Claude Code / Cursor / Aider / Continue）实际提供的工具集==——分类、底层实现、设计原则、与 MCP 的关系。
>
> 协议见 [[Function Calling]]；接入方式见 [[MCP 协议]]；产品对比见 [[AI 编程工具]]；代码检索的底层见 [[Code RAG]]。

> [!info] 这是"应用层"的内容
> 工具清单本身==是 Coding Agent 的产品决策==——不是 Function Calling（协议层），不是 MCP（接入层），不是 Harness Engineering（工程层）。是==产品层面==决定"我提供哪些工具给 LLM 用"。

---

## 一、工具集的四层归属

读到 Coding Agent 文档里"==支持工具调用：读文件、写文件、列目录、glob、grep、执行命令、RAG 检索、联网搜索、MCP 动态工具==" 这种清单时，==很容易混淆"工具是哪个概念"==。其实工具同时跨越四层，只是==每层管的事不同==：

```
┌──────────────────────────────────────────────────────┐
│  Application 层（产品决策：提供哪些工具）            │
│  - 内置工具（写死在产品代码里）                      │
│  - MCP 动态工具（用户挂的外部 Server 运行时发现）    │
├──────────────────────────────────────────────────────┤
│  ↓ 通过 [[MCP 协议]] 接入外部工具（仅 MCP 动态工具） │
├──────────────────────────────────────────────────────┤
│  ↓ 通过 [[Function Calling]] 协议调用                │
├──────────────────────────────────────────────────────┤
│  Harness 层（工程实现：注册/拦截/校验/执行/重试）    │
│  → [[Harness Engineering#三、六大核心组件]]          │
└──────────────────────────────────────────────────────┘
```

==关键区分==：
- ==Function Calling== 是协议（==怎么传递==调用意图）
- ==MCP== 是标准化接入（==外部工具==怎么暴露）
- ==Harness== 是工程实现（怎么==注册/拦截/执行==）
- ==工具清单==是产品决策（==提供哪些==工具）

==MCP 在工具清单里只是其中一条"动态工具"==——它是==接入方式==，不是==工具种类==。`read_file` 这种内置工具==不走 MCP==，由 Harness 直接实现。

---

## 二、内置工具分类

==Coding Agent 的内置工具==基本可以分成五类：

### 2.1 文件操作类

==最高频、最基础==的工具集——Coding Agent 的"四肢"。

| 工具 | 作用 | 设计要点 |
|------|------|---------|
| ==`read_file`== | 读文件内容 | 路径白名单 / 大文件分页（offset+limit） |
| ==`write_file`== | 整个文件覆盖写 | ==必须先 read 再 write==（防误删） |
| ==`edit_file`== | 局部修改（diff/replace） | 比 write 更安全——只改指定片段 |
| ==`list_directory`== | 列目录 | 默认排除 `.git` / `node_modules` |
| ==`create_directory`== | 创建目录 | 自动创建父目录 |
| ==`move`== / ==`copy`== / ==`delete`== | 文件操作 | 高危操作走 [[Agent 工程实践#Human-in-the-Loop]] |

==`edit_file` vs `write_file`==：现代 Coding Agent 强烈倾向 ==`edit_file` 局部修改==而非 ==`write_file` 整体覆盖==——前者出错只损失一段，后者出错丢整个文件。

### 2.2 代码搜索类

==让 Agent 在大代码库里找到相关代码==，是 Coding Agent 的核心能力。

| 工具 | 作用 | 底层 |
|------|------|-----|
| ==`grep`== / ==`code_search`== | 关键词搜索 | ripgrep（比 grep 快 10x） |
| ==`glob`== / ==`find_files`== | 按文件名模式找 | glob 库 / find 命令 |
| ==`codebase_search`== | 语义检索 | [[Code RAG]] 向量索引 + Re-rank |
| ==`get_definition`== | 跳转定义 | LSP / Tree-sitter |
| ==`get_references`== | 找引用 | LSP / 静态分析 |

==Claude Code 的特色：无索引模式==——不预建代码向量索引，==靠 grep + glob + read_file 现场检索==，依赖 Claude 的长上下文能力。详见 [[Code RAG#主流产品对比]]。Cursor 走的是相反路线——预建索引+语义检索。

==`get_definition` / `get_references` 走 LSP 协议==——LSP 是 Microsoft 2016 的语言服务协议(JSON-RPC),与 [[MCP 协议]] 同源。Coding Agent 还会用 LSP 做==编辑后诊断回注==(write_file 后自动收集 error/warning 注入下一轮 LLM,让 LLM 自主修复)——详见 [[LSP 与代码诊断]]。

### 2.3 命令执行类

==让 Agent 真的"做事"==——而不只是写代码。

| 工具 | 作用 | 设计要点 |
|------|------|---------|
| ==`execute_command`== / ==`run_in_terminal`== | 执行 shell 命令 | 沙箱 / 命令白名单 / 输出截断 |
| ==`run_test`== | 跑测试 | 自动检测项目（npm test / pytest / cargo test） |
| ==`run_lint`== / ==`run_format`== | 代码检查 / 格式化 | 自动调用项目配置的工具 |
| ==`git_*`== | git 操作（status / diff / commit / push） | 高危操作（push / force-push）走人工确认 |

==`execute_command` 是最危险的工具==——理论上 LLM 可以让它执行 `rm -rf /`。==生产部署必须配==：
- 沙箱（Docker / Bubblewrap / firejail）
- 命令白名单（只允许 `npm/yarn/git/python/...`）或黑名单（拦 `rm/curl|sh/...`）
- 高危命令==弹窗确认==（[[Agent 工程实践#Human-in-the-Loop]]）

### 2.4 项目操作类

==超越单文件，对整个项目结构的操作==。

| 工具 | 作用 |
|------|------|
| ==`create_project`== | 初始化新项目（脚手架） |
| ==`install_dependency`== | 装依赖（npm install / pip install） |
| ==`update_dependency`== | 升级依赖版本 |
| ==`refactor_rename`== | 全项目改名（变量/函数/文件） |

### 2.5 联网类

==访问代码库外的世界==。

| 工具 | 作用 | 底层 |
|------|------|-----|
| ==`web_search`== | 联网搜索 | Bing / Brave / Tavily / Google |
| ==`fetch_url`== | 读网页内容 | curl + HTML→Markdown 转换 |
| ==`read_documentation`== | 读官方文档 | Context7 / DevDocs |

==web_search 的工程难点==：搜索结果质量差异巨大——SEO 垃圾网页太多。==Tavily / Brave Search 是 AI 时代==专门优化的搜索 API（去除广告/低质内容）。

==安全难点==：联网工具是 Agent 最大的攻击面之一——LLM 输出的 URL 可被 Prompt Injection 控制，必须做 ==SSRF 防御==（协议白名单 / 内网屏蔽 / 重定向手动追 / 大小+频率限制）。详见 [[#4.8 联网工具的 SSRF 防御]]。

==fetch_url 的局限==：基于 curl + HTML 解析的轻量方案==处理不了三类页面==——
- ==SPA 单页应用==（React/Vue/Next.js）——HTML 是空壳，内容靠 JS 动态注入
- ==防爬墙站点==——微信公众号 / 知乎专栏 / 推特 / 小红书等需 cookie / JS challenge / 动态 token
- ==需要交互的页面==——登录、点击、滚动加载的表单/列表

==生产解决方案：分级 fallback==——

```
轻量层: fetch_url(curl + HTML→Markdown)
   ↓ 失败 / 内容明显异常(空白 / 极短 / 命中黑名单域名)
重量层: 浏览器 MCP(chrome-devtools-mcp / playwright-mcp)
   - 启动 Chromium 渲染 SPA
   - take_snapshot 拿 DOM 或截图
   - 必要时 click / fill_form 完成交互
```

==成本对比==：

| 维度 | fetch_url | 浏览器 MCP |
|------|----------|-----------|
| 启动 | 无 | 启动 Chromium ~1-2s |
| 单次延迟 | 几十 ms | 1-5s |
| 内存占用 | ~MB | ~200MB+ |
| 适用 | 静态 HTML / 文档站 / API 文档 | SPA / 防爬墙 / 需交互页面 |
| 输出 | Markdown 文本 | DOM snapshot / ==截图（image 类型）== |

==失败站点黑名单==：生产 Coding Agent 通常==预置一个失败站点列表==（mp.weixin.qq.com / zhihu.com/p / x.com / xiaohongshu.com 等），命中后==直接走浏览器 MCP 不再试 fetch_url==——避免浪费一次失败请求。

==chrome-devtools-mcp==（Google 官方 2025）是浏览器 MCP 的事实标准——参见 [[MCP 协议#54-浏览器自动化]]。截图返回值的 image 类型协议见 [[Function Calling#image-tool-result多模态返回]]。

==浏览器模式自适应==：浏览器 MCP 默认 ==isolated 模式==（临时 profile 无登录态）。Agent 遇到==登录页 / 权限不足 / 明确需要登录态==的页面时，可==自主调用 `browser_connect` 切到 shared 模式==（连用户已开 Chrome，复用登录态）：

```
用户: 帮我看 GitHub 上 PR #1234 的 review 状态
Agent: [navigate_page("github.com/owner/repo/pull/1234")]
   ↓
Agent: [take_snapshot] → 检测到登录页(redirect 到 /login)
   ↓
Agent: [browser_connect] → 切到 shared 模式
   ↓
Agent: [navigate_page(同 URL)] → 用用户登录态访问成功
   ↓
Agent: [take_snapshot] → 返回 PR 内容
```

==关键设计==：
- ==公开页面不提前切==——微信公众号文章、Docs 站点、StackOverflow 等用 isolated 即可，==避免不必要的身份暴露==
- ==只在 Agent 判断需要时切==——不要在 system prompt 强制 Agent 总用 shared
- ==切 shared 必须用户已启用 CDP==——`chrome --remote-debugging-port=9222` 且 `chrome://inspect/#remote-debugging` 允许

==模式切换的副作用==：切换 shared/isolated 都==清空 chrome-devtools 的"全部放行"==——避免 isolated 时的授权延续到 shared 后产生超授权问题。详见 [[MCP 协议#isolated-vs-shared两种工作模式]]。

---

## 三、MCP 动态工具

==除了内置工具==，Coding Agent 通过 [[MCP 协议]] 在运行时挂载==外部工具==。

### 3.1 内置 vs MCP 动态：本质区别

| 维度 | 内置工具 | MCP 动态工具 |
|------|---------|------------|
| 决定时机 | 编译时（产品代码里） | ==运行时==（用户配置） |
| 适用范围 | 所有用户一致 | 每个用户可不同 |
| 扩展方式 | 厂商发版 | ==用户/团队自己挂== |
| 故障隔离 | 进程内（一起挂） | ==独立进程==（互不影响） |
| 适用 | 通用、高频、必备的能力 | 团队特定 / 第三方系统集成 |

==典型场景==：
- ==读文件== → 内置（所有人都要）
- ==发 Slack 消息== → MCP（只有用 Slack 的团队需要）
- ==查公司内部 Postgres== → MCP（每家公司库不一样）

### 3.2 主流 MCP Server（生产中常挂）

| 类别 | Server | 用途 |
|------|--------|------|
| 协作 | ==github== | 管理 issue / PR / commit |
| 协作 | linear / jira | 任务管理 |
| 通信 | slack | 发消息、读历史 |
| 数据 | ==postgres== / sqlite | 数据库查询 |
| 自动化 | ==puppeteer== / playwright | 浏览器自动化 |
| 搜索 | brave-search | Web 搜索 |
| 文件 | filesystem（受限路径） | 跨项目文件访问 |

==完整生态见== [[MCP 协议#四、MCP 生态：主流 Server]]。

---

## 四、底层实现揭秘：这些工具到底怎么做的

==Coding Agent 看起来像"魔法"==——它能读代码、跑测试、提交 PR、连接数据库。但==底层每个工具基本都是几十行 Python 包装==。把"魔法"揭穿，你会发现==只有 RAG 是真正"重工程"==，其他全是简单封装。

### 4.1 实现量级总览

| 工具 | 实现量级 | 底层依赖 |
|------|---------|---------|
| `read_file` / `write_file` | 5 行 | Python 内置 `open()` |
| `list_directory` | 5 行 | Python 内置 `os.listdir()` |
| ==`glob`== | 5 行 | Python 内置 `glob` 库 |
| ==`grep`== | 10 行 | subprocess + ripgrep（rg 命令） |
| ==`execute_command`== | 10 行 | subprocess（+沙箱） |
| ==`create_project`== | 0 行（==组合==） | `execute_command` + `write_file` |
| ==`codebase_search`== | ~500 行 ★ | tree-sitter + embedding + 向量库 + rerank |
| ==`web_search`== | 10 行 | requests + 第三方 API key |
| ==MCP 动态工具调用== | ~200 行 | JSON-RPC 客户端 + 子进程管理 |

==其中只有 codebase_search 是真"重"==，MCP 是中等，其他全是==包装一层==几十行搞定。

### 4.2 glob：文件名通配符匹配

==glob== 是 Unix 老概念——用 `*` `?` `**` 匹配文件名。Shell 里 `ls *.py` 就是 glob：

```python
import glob

# 当前目录所有 .py 文件
glob.glob("*.py")
# → ['main.py', 'utils.py']

# 递归找所有 .ts 文件
glob.glob("**/*.ts", recursive=True)
# → ['src/app.ts', 'src/api/user.ts', 'tests/app.test.ts']

def find_files(pattern: str, root: str = ".") -> list[str]:
    return glob.glob(f"{root}/{pattern}", recursive=True)
```

==Python 内置 glob 库，零依赖，5 行结束==。

### 4.3 grep：在文件内容里搜关键词

==grep== = Global Regular Expression Print（1973 年的 Unix 命令）——找包含某关键词的行。

==现代 Coding Agent 都用 [ripgrep](https://github.com/BurntSushi/ripgrep)==（命令是 `rg`），比 grep 快 10 倍，==自动跳过 .git/node_modules、读 .gitignore==：

```python
import subprocess

def grep(pattern: str, path: str = ".") -> str:
    result = subprocess.run(
        ["rg", "--line-number", pattern, path],
        capture_output=True, text=True, timeout=30
    )
    return result.stdout

grep("def authenticate", "src/")
# → src/auth.py:42:def authenticate(user, password):
#   src/api/login.py:18:def authenticate_oauth(token):
```

==工具就是包了一下 ripgrep 命令==。Claude Code 在搜代码时其实==每一次都在用 rg==。

### 4.4 execute_command：执行 shell 命令

==核心就是 `subprocess.run`==——Python 起子进程跑命令：

```python
import subprocess

def execute_command(cmd: str, cwd: str = ".", timeout: int = 30) -> dict:
    result = subprocess.run(
        cmd, shell=True, cwd=cwd,
        capture_output=True, text=True, timeout=timeout
    )
    return {
        "stdout": result.stdout[:5000],   # 截断防止超长
        "stderr": result.stderr[:5000],
        "exit_code": result.returncode
    }
```

==就这么 10 行==。生产版加几样：
- ==沙箱==：Docker / Bubblewrap / firejail（防 `rm -rf /`）
- ==命令白名单==：`if cmd.split()[0] not in ALLOWED: raise PermissionError`
- ==Human-in-the-Loop==：高危命令弹窗确认（详见 [[Agent 工程实践#工具权限控制：白名单 / 参数粒度 / Human-in-the-Loop]]）

### 4.5 create_project：不是单独工具，是组合

==这其实不是一个独立工具==——而是 ==`execute_command` + `write_file` 的组合==。Coding Agent 通常==不专门实现 create_project==，而是让 LLM 自己组合：

```
LLM 思考：用户要建 React 项目
   ↓
LLM 调用 execute_command("npx create-react-app my-app")
   ↓ 脚手架自己生成所有文件
LLM 调用 read_file("my-app/package.json") 看下生成的内容
   ↓
LLM 调用 write_file("my-app/src/App.tsx", "...") 改写部分文件
```

==看起来"很大"的功能，其实是底层小工具的组合==——这就是 ReAct + 工具组合的力量，==LLM 自己规划怎么用基础工具组合完成大任务==（详见 [[ReAct 与 Harness 实现]]）。

==这也是为什么"工具不是越多越好"==——10 个原子工具靠组合能完成 100 种任务，工具数量太多反而增加 LLM 选错的风险。

### 4.6 codebase_search：唯一真正"重"的工具

==这才是==整套系统而不是几十行包装。完整 [[Code RAG]] 流水线：

```
离线（建索引时）：
  ① 遍历代码库所有文件
  ② AST 切块（每个函数/类一个 chunk）—— 用 tree-sitter
  ③ 每个 chunk 调 embedding 模型（如 Qwen2.5-Coder-Embedding）
  ④ 存到向量库（Qdrant / Milvus / sqlite-vec）

在线（LLM 调 codebase_search 时）：
  ① 把 query 也做 embedding
  ② 向量库 ANN 检索 Top-50
  ③ Re-rank 模型重排，返回 Top-5
  ④ 把 5 个代码片段返回给 LLM
```

```python
def codebase_search(query: str) -> list[dict]:
    query_vec = embedding_model.encode(query)            # ① query → embedding
    results = vector_db.search(query_vec, top_k=50)      # ② 向量检索
    reranked = rerank_model.rerank(query, results)       # ③ Re-rank
    return [
        {"file": r.path, "line": r.line, "code": r.text}
        for r in reranked[:5]
    ]                                                    # ④ 返回 Top-5
```

==Cursor / Continue / Windsurf 都是这种实现==。详见 [[Code RAG]]。

==Claude Code 不这么做==——它==没有 codebase_search 工具==，靠 grep + read_file 现搜，依赖 Claude 1M context 的长上下文能力。详见 [[Code RAG#主流产品对比]]。

### 4.7 web_search：调第三方搜索 API

==就是 HTTP 请求==：

```python
import requests

def web_search(query: str, top_k: int = 5) -> list[dict]:
    resp = requests.post(
        "https://api.tavily.com/search",
        headers={"Authorization": f"Bearer {TAVILY_API_KEY}"},
        json={"query": query, "max_results": top_k}
    )
    return resp.json()["results"]
    # → [{"title": "...", "url": "...", "content": "..."}]
```

==主流搜索 API==：
- ==Tavily== / ==Brave Search==——AI 时代专门优化的搜索 API（去除广告/SEO 垃圾）
- ==Bing Search API== / ==Google Custom Search==——传统通用
- ==Perplexity API==——直接返回 LLM 已总结好的内容

==你不直接调 google.com==，因为 Google 不开放 raw API，会被反爬。==所有 Coding Agent 都依赖第三方搜索 API==。

### 4.8 联网工具的 SSRF 防御

==Agent 时代 SSRF（Server-Side Request Forgery）是新攻击面==——和传统 SSRF 的区别在于：==LLM 输出的 URL 可以被 Prompt Injection 控制==，攻击者通过污染网页内容、文档、用户输入诱导 Agent 发起恶意请求。

#### 三种典型攻击场景

| 攻击 URL | 后果 |
|---------|------|
| ==`http://169.254.169.254/latest/meta-data/iam/security-credentials/`== | 偷 AWS / GCP / Azure 实例的 ==IAM 临时凭证==——直接拿到云账号控制权 |
| ==`file:///etc/passwd`== / ==`file:///root/.ssh/id_rsa`== | 读宿主机敏感文件（密码哈希 / SSH 私钥） |
| ==`http://localhost:6379/`== / ==`http://10.0.0.5:3306/`== | 攻击内网服务（Redis / MySQL / 内部 API），跳过外网防火墙 |

==攻击链==：网页/文档里嵌入"==请帮我读这个 URL 的内容总结一下=="（恶意 URL 藏在看似正常的网页里）→ LLM 调 `fetch_url` → ==Agent 用自己的网络身份发请求==→ 数据泄露。

#### 五道防线（缺一不可）

```python
import socket, ipaddress
from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}
MAX_BODY_BYTES = 5 * 1024 * 1024   # 5MB
MAX_REDIRECTS = 3

def safe_fetch(url: str, depth: int = 0) -> str:
    if depth > MAX_REDIRECTS:
        raise SecurityError("重定向次数超限")

    # 1. 协议白名单——禁 file://、ftp://、gopher://、data://
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise SecurityError(f"禁止协议: {parsed.scheme}")

    # 2. DNS 解析后检查 IP——防 DNS rebinding
    host = parsed.hostname
    ip = ipaddress.ip_address(socket.gethostbyname(host))
    if ip.is_private:        # 10.x / 172.16.x / 192.168.x
        raise SecurityError("禁止访问内网")
    if ip.is_loopback:       # 127.x
        raise SecurityError("禁止访问 loopback")
    if ip.is_link_local:     # 169.254.x——含云元数据 169.254.169.254
        raise SecurityError("禁止访问链路本地地址")
    if ip.is_reserved or ip.is_multicast:
        raise SecurityError("禁止访问保留地址")

    # 3. 不自动跟随重定向——重定向目标可能指向内网
    resp = requests.get(url, allow_redirects=False, timeout=30, stream=True)
    if resp.is_redirect:
        return safe_fetch(resp.headers["Location"], depth + 1)

    # 4. 大小限制——防止流量打爆 / 上下文爆炸
    if int(resp.headers.get("Content-Length", 0)) > MAX_BODY_BYTES:
        raise SecurityError("响应超过 5MB")
    body = resp.raw.read(MAX_BODY_BYTES + 1)
    if len(body) > MAX_BODY_BYTES:
        raise SecurityError("响应流超限")

    # 5. 频率限制(外层装饰器)——防止 LLM 失控刷接口
    return body.decode("utf-8", errors="ignore")
```

==关键点==：

| 防线 | 防什么 |
|------|------|
| ==协议白名单== | `file://` 读本地文件、`gopher://` 打 SMTP/Redis 协议走私 |
| ==DNS 解析后查 IP== | 攻击者注册的域名 A 记录指向 `127.0.0.1` 或 `169.254.169.254`(==DNS rebinding==) |
| ==重定向手动追== | 第一跳合法 → 第二跳指向内网 |
| ==大小限制== | 5MB 是 token 上下文 + 网络流量的双重保险 |
| ==频率限制== | LLM 失控/被注入后疯狂调接口 → 设单工具 30 次/分钟、单任务 100 次上限 |

#### Agent 场景的特殊考量

- ==URL 来源标记==：把 LLM 输出的 URL 标记为"==不可信源=="——比用户直接输入的 URL 多走一道安全检查
- ==沙箱网络==：Agent 进程跑在 ==network namespace== 里，==默认禁止访问内网网段==（比代码层防护更可靠，纵深防御）
- ==凭证隔离==：Agent 的网络身份 ≠ 宿主机网络身份，==Agent 进程不持有任何云元数据访问权限==
- ==审计日志==：所有 `fetch_url` 调用记录(URL / 解析 IP / 响应大小 / 触发的安全策略)——异常调用能事后回溯

==生产实践==：Anthropic Claude 的 web tool、OpenAI Browse with Bing 都内置了 SSRF 防护——==这是 Agent 上线前必过的安全审计项==。详见 [[Agent 工程实践#Prompt Injection 在 Agent 场景下如何防御？]]。

### 4.9 MCP 动态工具：运行时发现 + JSON-RPC 转发

==MCP 工具的"动态"体现在==：Host 启动时才发现有哪些工具，==不是写死在代码里==。

```
启动时：
  Host（Claude Code）读配置文件 .mcp.json
   ↓
  发现要挂 github MCP Server
   ↓
  spawn 子进程：npx @modelcontextprotocol/server-github
   ↓
  通过 stdio 发 JSON-RPC 请求：list_tools
   ↓
  Server 返回 [{name: "github_create_issue", ...}, ...]
   ↓
  Host ==把这些 schema 加到 LLM 的 tools 参数列表==

调用时：
  LLM 输出 tool_call: {"name": "github_create_issue", "args": {...}}
   ↓
  Host 判断：这是 MCP 工具（不是内置）
   ↓
  通过对应 Client → JSON-RPC 转发给 github Server 子进程
   ↓
  Server 执行（实际调 GitHub REST API）
   ↓
  结果回传给 LLM 作为 tool 消息
```

==对 LLM 来说==：内置工具和 MCP 工具长得一样（都是 tools 列表里的一项）。==对 Host 来说==：内置工具直接调 Python 函数，MCP 工具要走 JSON-RPC 转发。详见 [[MCP 协议#二、Host / Client / Server 三层架构]]。

### 4.10 关键认知：Coding Agent 没那么神秘

==看起来像魔法的工具==，本质是：

```
LLM 决策（Agent 智能从这里来）
   +
几十个原子工具（每个 5-50 行 Python）
   +
一两个"重"工具：codebase_search / MCP
```

==你完全可以自己写一个简版 Coding Agent==——见 [[ReAct 与 Harness 实现#五、从零写一个极简 ReAct——60 行 Python]] 的 60 行示例。==Cursor / Claude Code 之所以强==，强的不是单个工具有多复杂，而是==工具集设计得好==（粒度 / description / 组合性）+ ==Harness 工程做得精==（错误回注 / 上下文压缩 / 权限控制）。

---

## 五、Commands / Skills:Tool 的上层封装

==§四揭穿了 Tool 怎么实现==——但用户实际用的是 ==`/index`、`/search`、`/save`== 这种斜杠命令,不是直接调 Tool。==Command 和 Skill 是 Tool 的上层封装==,本节揭穿它们的实现机制。

### 5.1 Tool / Command / Skill 三者的关系

==这三个概念经常被混淆==,但其实==层级清晰==:

| 抽象 | 触发方式 | 实现 | 例子 |
|------|---------|------|------|
| ==Tool== | LLM 主动调用(Function Calling) | 一段 Python 函数 | `read_file` / `grep` / `execute_command` |
| ==Command== | ==用户敲 `/xxx`== | Python 函数 ==或== prompt 模板 | `/index` / `/save` / `/compact` |
| ==Skill== | ==LLM 自主激活==(看上下文) | Markdown 描述 + 子工具 | "数据库迁移" / "代码 review" Skill |

==关键差别==:
- ==Tool 是最小积木==(原子操作)
- ==Command 是用户主动触发的工具组合==(用户语法糖)
- ==Skill 是 LLM 自动激活的工具组合 + 经验==(隐式触发)

==递进关系==:
```
Tool         ← 原子操作(read_file / grep / web_search)
 ↓ 被组合
Command      ← 用户主动调(`/index` / `/save`)
 ↓ 被组合
Skill        ← LLM 看上下文自动用("写代码迁移" / "code review")
 ↓ 打包发行
Plugin       ← Skills + Commands 的发行单元
```

### 5.2 Command 的实现机制

==Command 的实现==有==三种风格==:

| 风格 | 实现路径 | 适合 |
|------|---------|------|
| ==纯代码== | Host 拦截命令 → 直接跑 Python 函数 → 显示结果(==不走 LLM==) | 流水线稳定,LLM 没价值 |
| ==纯 prompt== | Host 拦截命令 → 读 prompt 模板 → 当作用户消息发给 LLM → LLM 自主调工具 | 流程灵活,需要 LLM 判断 |
| ==混合==(生产推荐) | 确定步骤代码做,智能部分交 LLM | 大部分生产命令 |

#### Host 怎么"拦截"斜杠命令

```python
# Host 主循环
user_input = input("> ")

# ==第一关:斜杠命令拦截==
if user_input.startswith("/"):
    cmd, *args = user_input[1:].split(maxsplit=1)
    if cmd in BUILTIN_COMMANDS:
        return BUILTIN_COMMANDS[cmd](args)         # 直接跑函数,不发给 LLM
    elif cmd_file := find_command_md(cmd):          # .claude/commands/<cmd>.md
        prompt = read(cmd_file).format(args=args)
        return run_react_loop(prompt)               # 走 LLM
    else:
        print(f"未知命令:/{cmd}")
        return

# 普通对话走 LLM
run_react_loop(user_input)
```

==两层拦截==:
- ==内置命令==(`/index` / `/search` / `/help` / `/clear`):写死在 Host 里,直接跑函数
- ==用户自定义命令==(`.claude/commands/*.md`):读 Markdown 模板当 prompt 发给 LLM

#### 三种风格的具体实现

==`/index`(纯代码)==——建索引是确定性流水线,无需 LLM 决策:

```python
def cmd_index(args):
    files = glob.glob("**/*.{py,ts,java}", recursive=True)

    chunks = []
    for f in files:
        ast = tree_sitter.parse(read(f))
        chunks.extend(split_by_ast(ast))           # 按函数/类切

    embeddings = embedding_model.encode_batch([c.content for c in chunks])

    for chunk, vec in zip(chunks, embeddings):
        db.execute("INSERT INTO chunks VALUES (?, ?, ?, ?)",
                   (chunk.file, chunk.start, chunk.end, chunk.content))
        db.execute("INSERT INTO chunks_vec VALUES (?)", (vec,))

    print(f"建立索引完成:{len(files)} 文件,{len(chunks)} 块")
```

==零 LLM 调用==——又快又便宜。

==`/search <query>`(混合)==——查向量库是确定的,结果展示交 LLM:

```python
def cmd_search(args, query):
    # 确定步骤:查向量库
    query_vec = embedding_model.encode(query)
    results = db.execute("""
        SELECT file, line_start, content FROM chunks JOIN chunks_vec ON ...
        ORDER BY vec_distance_cosine(embedding, ?) LIMIT 10
    """, (query_vec,)).fetchall()

    # 智能步骤:让 LLM 整理结果
    return llm.invoke(
        f"用户搜索:{query}\n\n找到代码:\n{format(results)}\n\n请整理:哪些最相关,各做什么"
    )
```

==Cursor 倾向直接打印结果==(用户自己看);==Claude Code 倾向让 LLM 解读==(更好的体验)。

==`/graph who-calls foo`(纯代码)==——查关系图是确定性 SQL:

```python
def cmd_graph(args):
    relation, node = args.split()

    if relation == "who-calls":
        return db.execute("""
            SELECT caller_file, caller_line FROM call_edges WHERE callee_func = ?
        """, (node,)).fetchall()
    elif relation == "subclasses":
        return db.execute("""
            SELECT child_class FROM inherits_edges WHERE parent_class = ?
        """, (node,)).fetchall()
    elif relation == "imports":
        return db.execute(...)
```

==关系图存储==选项:
- ==简单==:SQLite 多张表(`call_edges` / `inherits_edges` / `imports_edges`)
- ==中等==:NetworkX 内存图(项目不大时,从 SQLite 加载到 NetworkX 用图算法)
- ==复杂==:Neo4j / Memgraph(超大代码库)

#### 自定义命令:Markdown 即 Prompt

==Claude Code 的精髓==:用户在 ==`.claude/commands/<name>.md`==写一个 Markdown 文件,Coding Agent 自动把它注册为 `/<name>` 命令。==Markdown 内容直接当 prompt 发给 LLM==:

```markdown
---
description: 建立代码库索引
---

请建立代码库的语义索引:

1. 使用 glob_files 找所有 .py / .ts / .java 文件
2. 对每个文件用 read_file 读取,然后用 tree_sitter 解析切块
3. 调用 embed_chunks 工具批量 embedding
4. 写入向量库

开始执行。完成后告诉我索引了多少文件、多少块。
```

用户敲 `/index` 后:
- Host 读 index.md → 把内容当用户消息发给 LLM
- LLM 看完指令==自主调用 glob_files / read_file / tree_sitter_parse / embed_chunks==
- 完成后报告结果

==这就是为什么 Commands 能"零代码定义"==——==只要写 prompt 模板==,LLM 自己知道怎么用工具组合完成任务。

### 5.3 Skill 的实现机制(简述)

==Skill 与 Command 的核心差别==:Command ==用户主动触发==,Skill ==LLM 自动激活==。

实现机制:
- 每个 Skill 是一个 ==`SKILL.md`== 文件,头部有 description 描述何时该用
- Coding Agent 启动时把所有 Skills 的 description ==预加载==到 system prompt
- LLM 在 ReAct 循环中==看上下文判断"现在该用哪个 Skill"==
- 触发后==读完整 SKILL.md==(渐进式披露)+ 调用 Skill 内的 Tool 链

==举例==:用户说"帮我把这段代码改成 TypeScript",LLM 在 system prompt 看到 "TypeScript Migration" Skill 的 description,==自动激活==,读完整 SKILL.md 按步骤执行。

==完整机制==(渐进式披露 / SKILL.md 加载机制 / 与 MCP 的关系)详见 [[Agent Skills 体系]]。

### 5.4 关键认知:没有魔法

==Coding Agent 看着像"魔法"==,本质永远是同一个套路:

```
LLM 决策(Agent 智能从这里来)
   +
几十个原子 Tool(每个 5-50 行 Python)
   +
各种封装:
   - Command(用户敲斜杠触发)
   - Skill(LLM 自动激活)
   - Plugin(Skills + Commands 打包发行)
```

==Cursor / Claude Code 强==的不是某个工具复杂,==强在工具集设计精良 + 命令体系完整 + Skill 经验沉淀==。==面试时讲清"==Tool 是积木,Command 是用户语法糖,Skill 是 LLM 经验包=="==——比死记产品功能有深度。

---

## 六、工具设计原则

==给"我自己想做一个 Coding Agent"或"我要写 MCP Server"的人==。

### 6.1 工具粒度：单一职责

```python
# ❌ 反例：一个工具包揽多种操作
{
    "name": "do_file_thing",
    "parameters": {
        "action": "read|write|delete|move",  # 多功能开关
        "path": "...",
        "content": "..."  # 仅 write/move 用
    }
}

# ✅ 正例：一个工具一个职责
"read_file"   {"path": str}
"write_file"  {"path": str, "content": str}
"delete_file" {"path": str}
"move_file"   {"source": str, "dest": str}
```

==单一职责的好处==：
- LLM 的 description 只用讲清楚一件事
- 错误信息更精准（不会"do_file_thing 失败了，但不知道是哪个 action 失败"）
- 权限控制更细（可以只放开 read 不放开 delete）

### 6.2 description 写法：决定 LLM 用得对不对

LLM 全靠 description 决定何时用、用什么参数。==description 写好比加重试更治本==——很多"不可靠"其实是工具描述不到位。

```python
# ❌ 反例：LLM 看了会乱用
description: "搜索"

# ✅ 正例：明确边界、明确触发条件
description: (
    "在内部技术文档库中搜索关键词。"
    "==仅==检索 Confluence/Notion 已索引文档，不访问外网。"
    "==适用于==：用户问公司内部产品/流程/规范。"
    "==不适用==：通用知识问答（用 LLM 自身回答即可）、最新新闻（用 web_search）。"
    "返回 Top 5 文档摘要 + 链接。"
)
```

详见 [[Function Calling#二、请求结构：tools schema 怎么写]]。

### 6.3 参数设计

| 设计点 | 推荐 |
|-------|------|
| 路径 | ==绝对路径优先==（避免 cwd 不确定）；相对路径必须明确"相对哪里" |
| 必填 vs 可选 | ==能必填就必填==（required），降低 LLM 漏填风险 |
| 默认值 | 有默认值就别让 LLM 决定（如 `top_k=5` 别让它每次都选） |
| 枚举值 | 能用 enum 就别用 free string |
| 范围 | 用 `minimum` / `maximum` 限制数值范围 |

### 6.4 输出格式

==给 LLM 看的输出，不是给人看的==——需要：

- ==结构化优先==：能 JSON 就别纯文本
- ==截断策略==：超长输出自动截断 + 提示"还有 N 行，用 read_file 的 offset 继续"
- ==错误格式统一==：`ERROR: <type>: <message>`，方便 LLM 解析后决定走哪条 [[Agent 工程实践#Agent 工具调用失败的四层决策策略]]
- ==行信息要给==：返回的代码片段要带行号 + 文件路径，==方便 LLM 后续 edit==

### 6.5 工具不是越多越好

==Stripe 的 Minions 实战经验==（见 [[Harness Engineering#六、企业级实战经验]]）：
- 工具数量超过 ==15 个==，LLM 选错工具的概率显著上升
- 工具描述总长度超过 ==4K tokens==，模型容易"看不见"末尾的工具
- ==推荐==：单 Agent 工具不超过 10 个；多 Agent 时每个 Agent 工具更少（5-7 个）

### 6.6 工具集 token 管理：工具描述是隐形的 prompt 成本

==工具描述不是免费的==——每次 LLM 调用都要把 `tools` 参数完整发送，==不管当前任务用不用这些工具==。

#### 具体成本

| 场景 | 工具数 | 估算 token |
|------|--------|-----------|
| 内置工具（9 个） | 9 | ~1,500 |
| 内置 + 1 个 MCP server（20 工具） | 29 | ~5,000 |
| 内置 + 3 个 MCP server（60 工具） | 69 | ~12,000 |
| 内置 + 5 个 MCP server（100 工具） | 109 | ~20,000 |

==100 个工具 = 每轮白烧 20k tokens==——大部分工具当前任务根本用不到。

#### 三种解决方案（按普遍程度排序）

**方案一：工具集分组过滤（最常见）**

==根据当前任务类型，只注入相关工具子集==——这是生产 Coding Agent 最普遍的做法：

```python
TOOL_GROUPS = {
    "code":    ["read_file", "write_file", "grep", "edit_file", "execute_command"],
    "web":     ["web_search", "fetch_url", "mcp__chrome-devtools__*"],
    "git":     ["mcp__github__*", "execute_command"],
    "data":    ["mcp__postgres__*", "mcp__sqlite__*"],
    "default": ["read_file", "write_file", "grep", "web_search"],
}

def select_tools(task: str, all_tools: list) -> list:
    # 规则路由（快）
    if any(kw in task for kw in ["网页", "浏览", "爬取"]):
        group = "web"
    elif any(kw in task for kw in ["PR", "issue", "commit", "git"]):
        group = "git"
    elif any(kw in task for kw in ["数据库", "SQL", "查询"]):
        group = "data"
    else:
        group = "code"  # 默认代码任务

    patterns = TOOL_GROUPS[group]
    return [t for t in all_tools if matches_any(t.name, patterns)]
```

==真实产品案例==：
- ==Cursor==：Composer（大改）和 Chat（问答）工具集不同——Composer 有 edit_file，Chat 没有
- ==Cline==：Plan 模式和 Act 模式工具集不同——Plan 只读，Act 才有写工具
- ==Claude Code==：`/plan` 模式下不暴露危险工具（execute_command 等）

**方案二：工具描述截断（已在 [[MCP 协议#42-schema-清洗从-mcp-server-到-llm-tools-的必踩坑]] 讲过）**

==MCP server 返回的 schema 必须清洗==——description 超 500 字符截断，`$ref` 内联展开，`anyOf` 简化。这是 MCP→FC 转换层的标配，不是可选项。

**方案三：渐进式工具披露（高级，与 Skill 同理）**

==只注入工具名 + 一句话描述的索引==，LLM 需要时调 `get_tool_schema(name)` 拿完整 schema：

```
# 注入 LLM 的 tools 参数（轻量索引）
tools: [
  { name: "mcp__github__create_issue", description: "在 GitHub 创建 issue" },
  { name: "mcp__github__list_prs",     description: "列出 PR 列表" },
  ...
]

# LLM 需要时调：
tool_call: get_tool_schema("mcp__github__create_issue")
# → 返回完整 inputSchema，LLM 再用完整 schema 调用
```

==优点==：工具索引 ~10 token/个，100 个工具只占 1k tokens。
==缺点==：多一轮 LLM 调用拿 schema，延迟增加。==适合工具极多（>50）的场景==。

#### MCP 外部工具的特殊处理

==MCP server 是最容易"工具爆炸"的来源==——一个 github MCP server 就有 30+ 工具，三个 server 就 90 个。

==四种控制手段==（可叠加）：

| 手段 | 实现 | 适用 |
|------|------|------|
| ==Server 级启用/禁用== | `/mcp disable <name>` 整个 server 不注入 | 当前任务完全用不到某 server |
| ==工具白名单== | 配置文件声明每个 server 只允许哪些工具 | 精细控制，安全优先 |
| ==前缀过滤== | 只在 git 相关任务时注入 `mcp__github__*` | 任务路由驱动 |
| ==description 截断== | Host 清洗 schema，长 description 截到 500 字符 | 所有 MCP 工具默认做 |

==生产配置示例==（`.paicli/mcp.json` 白名单）：

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "allowedTools": ["create_issue", "list_prs", "get_file_contents"]
    }
  }
}
```

==`allowedTools` 是最直接的控制==——github server 有 30 个工具，只允许 3 个，LLM 看到的就是 3 个。

==关键认知==：==工具集管理是 prompt 工程的一部分==——和控制 system prompt 大小、历史截断、RAG topK 一样，都是在有限 context budget 里做取舍。工具描述进 prompt cache（参考 [[长上下文工程#1-prompt-caching]]），所以==工具集稳定不变时 cache 命中率高，频繁变化时 cache 失效==——这也是"按任务类型分组"比"每轮动态过滤"更好的原因之一。

---

## 七、主流 Coding Agent 工具集对比

| 工具 | Claude Code | Cursor | Aider | Continue | Windsurf |
|------|------------|--------|-------|----------|----------|
| read_file / write_file | ✓ | ✓ | ✓ | ✓ | ✓ |
| edit_file（局部修改） | ✓ | ✓ | ✓（diff 模式）| ✓ | ✓ |
| grep / 代码搜索 | ✓（ripgrep） | ✓ | git grep | ✓ | ✓ |
| ==codebase 语义检索== | ✗ ==无索引== | ✓ 预建 | ✗ | ✓ | ✓ |
| execute_command | ✓ | ✓ | ✓ | ✓ | ✓ |
| run_test | ✓ | ✓ | ✓ | 部分 | ✓ |
| Web 搜索 | ✓ | ✓ | ✗ | 插件 | ✓ |
| Computer Use | ✓（2026） | ✗ | ✗ | ✗ | 部分 |
| ==MCP 支持== | ✓ 原生（Anthropic 推） | ✓ 原生 | ✗ | ✓ 原生 | ✓ 原生 |

### 7.1 Claude Code 的"无索引模式"特别说明

==Claude Code 不预建代码向量索引==——靠 grep + read_file 现场检索。原因：
1. 索引建得慢、过期快（代码变化频繁）
2. Claude 的 ==1M context== 能直接装下中等代码库，==检索精度比向量召回更高==
3. ==grep 是确定性的==，索引检索是概率性的——前者更可靠

==但代价==：每次都要现搜，==大代码库（百万行级）会慢==。Cursor 用预建索引在大库上更快，但小库优势不明显。==选型见== [[Code RAG#主流产品对比]]。

### 7.2 Aider 的极简哲学

Aider ==只用 git ls-files + cat==——没有 grep 工具、没有 codebase 检索。==哲学==：让人决定看哪些文件，AI 只负责改。==权限边界更清晰==但==自主性更弱==。

---

## 八、工具调用的可靠性

==LLM 是概率系统，工具调用有失败率是常态==——不是 bug 是事实。详见：

- [[Function Calling#八、协议层的可靠性]] —— 协议层的 schema 校验、JSON 解析失败、tool_call_id 不匹配
- [[Agent 工程实践#Agent 工具调用失败的四层决策策略]] —— L1 重试 / L2 参数修正 / L3 换工具 / L4 换策略
- [[Agent 工程实践#工具权限控制：白名单 / 参数粒度 / Human-in-the-Loop]] —— 工具粒度 / 参数粒度 / 频率粒度 / 危险操作人工确认

---

## 相关链接

- [[Function Calling]] — 工具调用协议层
- [[MCP 协议]] — 工具标准化接入协议
- [[Code RAG]] — `codebase_search` 工具的底层实现
- [[Harness Engineering]] — 工具的注册/拦截/执行机制
- [[AI 编程工具]] — Claude Code / Cursor / Codex 产品对比
- [[ReAct 与 Harness 实现]] — 60 行 ReAct + 工具识别两种方式
- [[Agent 工程实践]] — Agent 工程化落地（含工具失败处理、权限控制）
