---
module: 计算机网络
tags: [计算机网络, Agent, MCP, LSP, stdio, WebSocket, RPC]
difficulty: medium
last_reviewed: 2026-06-01
---

# Agent 传输方式：stdio / Streamable HTTP / WebSocket

> [!info] 本文定位
> Agent 协议（MCP / LSP）底层是 RPC，它们的传输层有三种主流选择。本文讲清三者的工作机制、消息边界处理和选型逻辑。从 [[计算机网络]] 的传输层知识延伸而来，MCP / LSP 等文档统一链接到这里。

## Stdio：进程间通信（IPC），不是网络

stdio（Standard Input/Output）是**操作系统层面的进程间通信**，==不是网络协议==。

### 类比

```text
父进程(Host)
   │
   │ ① fork 出子进程
   ↓
子进程(Server)

   两人间有 3 根管道:
   ─ stdin  (父→子)   "你做这个事"
   ─ stdout (子→父)   "我做完了"
   ─ stderr (子→父)   "出错了!"
```

像 shell 里：

```bash
ls | grep agent
^^   ^   ^^^^^^
ls.stdout → grep.stdin

echo "hello" > file.txt
echo.stdout → 文件
```

### 关键特征

| 特征 | 说明 |
|------|------|
| 只能本机 | 不能跨网络（不能跟邻居家的进程说话） |
| 字节流 | OS 只保证字节顺序，不知道"消息边界" |
| 父进程启动子进程 | 启动时建立管道，关掉子进程就断 |
| 零网络开销 | 不走 TCP/IP，几乎免费（内核内存拷贝） |

### 消息边界问题

字节流的本质是"水流"——OS 不知道一条消息哪里结束。

解决方案（参考 [[计算机网络#TCP 面向字节流、UDP 面向报文，会导致什么区别？|TCP 面向字节流]]）：

| 方案 | 例子 |
|------|------|
| 分隔符 | HTTP/1.1 用 `\r\n` |
| 长度前缀（MCP / LSP 都用这个） | `Content-Length: 50\r\n\r\n{...}` |

MCP / LSP 通过 stdio 传 JSON-RPC——每条消息前加 `Content-Length` 头，告诉对方"这条 50 字节"，避免粘包。

### 实际代码

```python
# Host 启动 server 子进程
proc = subprocess.Popen(
    ["npx", "@modelcontextprotocol/server-github"],
    stdin=PIPE,
    stdout=PIPE,
)

# Host 发请求
msg = b'{"jsonrpc":"2.0","method":"tools/list"}'
proc.stdin.write(f"Content-Length: {len(msg)}\r\n\r\n".encode() + msg)

# Host 读响应
header = proc.stdout.readline()        # Content-Length: NN
length = int(header.split(b": ")[1])
proc.stdout.readline()                 # 空行
body = proc.stdout.read(length)        # 实际消息
```

### 适用场景

本地工具——MCP server、LSP server、puppeteer / playwright 这种 Host 启动子进程的场景。**生产中 stdio 占 80%+**。

## Streamable HTTP：浏览器协议的"流式版"

### 普通 HTTP vs Streamable HTTP

普通 HTTP（请求-响应）：

```text
Client → 请求: "给我 README.md"
Server → 全部计算完后,一次性返回完整内容
```

Streamable HTTP（边算边推）：

```text
Client → 请求: "给我 README.md"
Server → 第一段:    "# README"          ← 边算边推
Server → 第二段:    "## Install"
Server → 第三段:    "## Usage"
...
Server → 标记结束
```

LLM 输出 token 一个个流出来就是这个机制——不等全部生成完才发，生成一段发一段。

### HTTP/1.1 Chunked Transfer Encoding

实际报文：

```http
HTTP/1.1 200 OK
Transfer-Encoding: chunked          ← ★ 流式标记

7\r\n                                ← 第一块 7 字节(十六进制)
# READM\r\n
A\r\n                                ← 第二块 10 字节
E\r\n
## Insta\r\n
0\r\n                                ← 0 表示流结束
\r\n
```

每块前面有"这块多少字节"，最后一个 `0` 标记结束。

### Server-Sent Events (SSE) — Streamable HTTP 的子集

SSE 是 Streamable HTTP 的文本规范——专为事件推送设计：

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"token":"Hello"}\n\n
data: {"token":" world"}\n\n
data: {"type":"done"}\n\n
```

`data:` + 空行 是 SSE 的消息分隔符。

2024 年 MCP 早期用 SSE 双 endpoint 方案。2025 年改成 Streamable HTTP（单 endpoint chunked）。

### 关键特征

| 特征 | 说明 |
|------|------|
| 基于 TCP | 可靠传输 |
| 走 80/443 端口 | 防火墙友好（企业网都开放） |
| 请求-响应模型（即使流式） | Client 主动发请求 Server 才能推 |
| 服务端边算边推 | LLM token 流式 / 大文件下载 |
| 断线重连容易 | HTTP 标准操作 |

### 适用场景

远程 SaaS API：
- LLM API（GPT-4 / Claude）——token 流式输出
- MCP 远程 server（chrome-devtools 云端版）
- 实时数据推送（股票、新闻）

MCP 选 Streamable HTTP 而不是 WebSocket 的原因：生产 / 企业环境 WebSocket 经常被防火墙拦，HTTP 不会被拦。

## WebSocket：真正的"双向电话"

### HTTP vs WebSocket 类比

HTTP 像寄信——你寄一封，等回信，回信完结束。
WebSocket 像电话——建立连接后双方都能随时说话。

```text
HTTP:                               WebSocket:

Client → 请求                       Client ↔ Server
Server → 响应                       双方随时互相说话
连接关                              连接保持
                                    直到一方挂电话
```

### 工作流程

WebSocket 始于 HTTP 升级握手——握手前像 HTTP，握手后变成全双工 TCP-like 通道：

```http
# Step 1: Client 发 HTTP 升级请求
GET /ws HTTP/1.1
Host: example.com
Upgrade: websocket               ← ★ "我想升级到 WebSocket"
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZQ==

# Step 2: Server 同意
HTTP/1.1 101 Switching Protocols  ← ★ "好,切换协议"
Upgrade: websocket

# Step 3: 之后双方就能随便发消息(不再是 HTTP 格式)
[Client → Server] {"type": "ping"}
[Server → Client] {"type": "pong"}
[Server → Client] {"type": "broadcast", "msg": "hi"}   ← Server 主动推
```

### 关键特征

| 特征 | 说明 |
|------|------|
| 全双工 | 双方都能主动发（HTTP 只能 Client 发 Server 应） |
| 持续连接 | 一直开着直到主动关 |
| 低延迟 | 没有 HTTP 头开销（每条消息只有几字节 frame） |
| 容易被防火墙拦 | 企业网常拦 |
| 实时场景 | 聊天 / 游戏 / 股票行情 |

### 适用场景

- 实时聊天（WhatsApp / Discord 网页版）
- 在线游戏（位置同步）
- 协同编辑（Google Docs）
- 实时仪表盘（监控、股票）

Agent 场景：MCP 协议规范支持 WebSocket，但实际很少用（防火墙问题 + Streamable HTTP 也够流式）。

## 三者对比

| 维度 | stdio | Streamable HTTP | WebSocket |
|------|---------|------------------|------------|
| 层级 | OS 进程间通信 | 应用层(HTTP) | 应用层(从 HTTP 升级) |
| 通信范围 | 仅本机 | 跨网络 | 跨网络 |
| 方向 | 双向(stdin+stdout) | Client 请求 Server 流式响应 | 全双工 |
| 连接生命周期 | 父子进程同生死 | 单次请求-响应(可流式) | 长连接(直到主动关) |
| 消息边界 | 自定义(MCP 用 Content-Length) | HTTP chunk 自带 | 自带 frame |
| 协议头开销 | 几乎无 | 大(每次 HTTP 头) | 小(只有 frame 头) |
| 防火墙友好 | N/A(本机) | 极好 | 经常被拦 |
| 典型用途 | 本地子进程协议 | 远程 SaaS / LLM API | 实时聊天 / 游戏 |
| MCP 占比 | 80%+ | ~15% | <5% |

## 为什么 Agent 协议（MCP / LSP）用这三种

Agent 协议本质上是 RPC（远程过程调用，让一个进程调另一个进程的方法）——传输方式取决于：

| 场景 | 选择 |
|------|------|
| 本地 server（github MCP / pyright LSP） | stdio——零网络开销 |
| 远程 SaaS server（云端 chrome-devtools / 团队共享 MCP） | Streamable HTTP——防火墙友好 |
| 需要 server 高频主动推送 | WebSocket（极少用） |

选型决策树：

```text
你的 server 在哪?
├── 本机进程            → stdio
└── 远程
    ├── 一般推送频率    → Streamable HTTP
    └── 双向高频实时    → WebSocket
```

MCP / LSP 都默认 stdio——90% 场景够用。其他两种是特殊场景的补充。

## 关键认知

1. ==stdio 不是网络==——是 OS 提供的进程间通信，只能本机。
2. ==字节流必须自定义消息边界==——MCP / LSP 都用 `Content-Length` 头。
3. Streamable HTTP 不是新协议——是 HTTP/1.1 + chunked transfer，2025 MCP 选它取代 SSE。
4. WebSocket 适合双向实时——但 Agent 场景很少需要，防火墙问题让它不流行。
5. 这三种是 RPC 协议（MCP / LSP / gRPC）的常见传输层选择——与具体协议无关。
