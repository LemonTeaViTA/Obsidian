---
module: Agent
tags: [Agent, Coding Agent, LSP, Language Server, JSON-RPC, 代码诊断, Post-Edit Verification]
difficulty: hard
last_reviewed: 2026-05-31
---

# LSP 与代码诊断

> ==Coding Agent 调用语言服务的核心协议== + 编辑后诊断回注 LLM 的工程模式。
>
> Coding Agent 与 IDE 用同一套 LSP,但==处理诊断的方式完全不同==——IDE 显示给人看,Coding Agent ==把诊断回注 LLM 让它自己修==,这是 Agent 与 IDE 的本质区别。
>
> 与 [[MCP 协议]] / [[Function Calling]] 是同源协议家族(都是 JSON-RPC),与 [[Reflection 实现#3.3 外部验证器]] 是落地关系——本文是诊断回注的具体实现。

> [!tip] ==LSP / MCP / LLM 三层关系速览（一分钟读完）==
>
> ==这部分是 LSP 最容易混淆的认知==——读完这个 callout，==后面所有章节都是细节展开==。
>
> ==1. LSP 和 MCP 表面非常像==
>
> | 维度 | 共同点 |
> |------|------|
> | 协议基础 | ==都是 JSON-RPC 2.0== |
> | 默认 transport | ==都默认 stdio== |
> | 模式 | "暴露方法" + initialize 握手 + 长连接 |
>
> ==MCP（2024）明显借鉴 LSP（2016）的设计==——==时间差 8 年==。
>
> ==2. 但解决不同问题==
>
> | 维度 | LSP（2016 Microsoft） | MCP（2024 Anthropic） |
> |------|---------------------|------|
> | ==设计目标== | ==编辑器 ↔ 语言服务== | ==AI 应用 ↔ 工具== |
> | ==消费者== | 编辑器 / IDE（人类用户的代理） | LLM（AI） |
> | ==推送机制== | ==Server 主动推 `publishDiagnostics`==（核心） | 弱（只有 list_changed notification） |
> | ==文档抽象== | ==完整生命周期==（didOpen / didChange / didSave） | 无文档抽象 |
> | ==方法体系== | ==70+ 标准方法==（textDocument/* 为核心） | 几个核心 method（tools/* + resources/*） |
>
> ==MCP 是 LSP 思想在 AI 时代的演化==——==同一个协议模式（USB-style），换了消费者==。
>
> ==3. ★ LSP 不直接给 LLM 用——经过 Host 中间层==
>
> ==关键认知==：==LSP 协议太复杂==（70+ 方法 + 推送 + 文档生命周期），==LLM 用不动==。==实际链路==：
>
> ```
> ┌────────────────────────────────────┐
> │  Layer 3: LLM(Claude / GPT)         │
> │  看到的: "find_definition(x)" Tool   │  ← Function Calling 协议
> └────────────────────────────────────┘
>                 ↑↓ tool_calls
> ┌────────────────────────────────────┐
> │  Layer 2: Host(Coding Agent)        │
> │  - 接 LLM 的 tool_calls              │
> │  - 翻译成 LSP / MCP 调用             │
> │  - 收 publishDiagnostics 推送         │
> │  - 把诊断回注下一轮 LLM              │
> └────────────────────────────────────┘
>                 ↑↓
> ┌────────────────┐  ┌────────────────┐
> │ Layer 1a:      │  │ Layer 1b:      │
> │ MCP Server     │  │ LSP Server     │
> │ (github)       │  │ (rust-analyzer)│
> └────────────────┘  └────────────────┘
> ```
>
> ==Host 把 LSP 的核心能力包装成 Tool 暴露给 LLM==——==LLM 永远不直接看到 LSP 协议==。
>
> ==4. 两种集成方式==
>
> | 方式 | 谁用 |
> |------|------|
> | ==Host 内置 LSP Client== | Cursor / VS Code Continue（==Host 本来就是 IDE==） |
> | ==通过 MCP 桥接==（langserver-mcp 等） | CLI Agent（==Host 不内置 LSP，走 MCP 协议桥==） |
>
> ==5. LSP 给 LLM 解决了什么核心问题==
>
> ==确定性工具替代 LLM 自检==——这就是 [[Reflection 实现#3.3 外部验证器]] 的具体落地：
>
> | 维度 | LLM 自检 | LSP 诊断 |
> |------|--------|---------|
> | 准确性 | ==概率性==（可能漏 / 误判 / 幻觉） | ==确定性==（基于完整类型系统） |
> | 成本 | LLM 调用费 | ==几乎免费==（本地解析） |
> | 速度 | 秒级 | ==毫秒级== |
> | 适合 | 逻辑 / 设计错误 | ==语法 / 类型错误== |
>
> ==Coding Agent 标配==：post-edit 触发 LSP → 诊断回注 LLM → LLM 自主修复。
>
> ==6. 完整工作流==
>
> ```
> 1. LLM 调 write_file Tool 改代码
>    ↓
> 2. Host 收到 tool_call → 写文件 → 异步触发 LSP
>    ↓
> 3. LSP 协议层:
>    - Host 发 textDocument/didChange → Server
>    - Server 后台分析
>    - Server 主动推 publishDiagnostics → Host
>    ↓
> 4. Host 缓存诊断到 pending 队列
>    ↓
> 5. 下一轮 LLM 请求前,Host 把诊断格式化注入 system prompt
>    ↓
> 6. LLM 看到 "[error] foo.ts:42:18 - Cannot find name 'X'"
>    ↓
> 7. LLM 自己决定 read + edit 修复
> ```

---

## 一、LSP 是什么 + 为什么会出现

### 1.1 没有 LSP 之前:M × N 困境

```
VS Code  ↔ Java 语言支持(自己实现)
VS Code  ↔ Python 语言支持(自己实现)
VS Code  ↔ Go 语言支持(自己实现)
IntelliJ ↔ Java 语言支持(再实现一遍)
IntelliJ ↔ Python 语言支持(再实现一遍)
Vim      ↔ Java 支持(再实现一遍)
...
```

==M 个编辑器 × N 个语言 = M × N 个集成==。每个编辑器要为每种语言重写"代码补全 / 跳定义 / 找引用 / 诊断"。

### 1.2 LSP 之后:M + N

==Microsoft 2016 年提出 LSP==(Language Server Protocol),把"语言能力"从编辑器解耦成==独立的 Language Server==:

```
==LSP 协议==
   ↑↓
语言团队写一次 Language Server(rust-analyzer / pyright / gopls)
   ↑↓
所有支持 LSP 的编辑器都能用
   ↑↓
VS Code / IntelliJ / Vim / Neovim / Emacs / Sublime / Helix ...
```

==M + N 个集成==。==Rust 团队写一次 rust-analyzer==,所有编辑器都能用 Rust。

### 1.3 LSP 的核心价值

| 价值 | 说明 |
|------|------|
| ==解耦语言与编辑器== | 编辑器不需要懂语言,语言不需要懂编辑器 |
| ==生态网络效应== | 一个语言写好 LSP server,几十个编辑器立即支持 |
| ==深度可对等 IDE== | rust-analyzer 在 VS Code 的 Rust 体验 ≈ JetBrains RustRover |
| ==Coding Agent 友好== | Agent 调 LSP server 拿语言能力,不用嵌入解析器 |

==类比==:LSP 就是==编辑器与语言之间的 USB==——和 [[MCP 协议#类比usb-之前-vs-之后]] 异曲同工。

---

## 二、LSP 协议核心

### 2.1 通信机制

==基于 JSON-RPC 2.0==(与 [[MCP 协议]] 同源),通过 ==stdio / TCP / WebSocket== 传输。生产几乎都用 stdio——编辑器启动 server 子进程,通过 stdin/stdout 通信。

```
编辑器(Client)
   ↓ JSON-RPC over stdio
Language Server(独立进程,如 rust-analyzer)
```

> [!info] ==stdio / Streamable HTTP / WebSocket 是什么？==
> 这三种是==操作系统 IPC + 计算机网络协议==的基础知识，==MCP / LSP / gRPC 都用它们做底层传输==。完整解释（含类比、消息边界、对比表）见 ==[[计算机网络#五Agent-时代的传输方式stdio--streamable-http--websocket]]==。
>
> ==简单说==：==stdio == 本机父子进程的"传话筒"==——LSP/MCP 都默认走这个；==Streamable HTTP == 跨网络流式==；==WebSocket == 双向实时==。

### 2.2 核心方法

==LSP 协议有 ~70 个方法==,Coding Agent 高频用到的核心方法:

| 方法 | 方向 | 作用 |
|------|------|------|
| ==`initialize`== | C → S | 握手,声明 client 能力 + 工作目录 |
| ==`textDocument/didOpen`== | C → S | 打开文件——通知 server 文件已加载 |
| ==`textDocument/didChange`== | C → S | 文件内容变更通知 |
| ==`textDocument/didSave`== | C → S | 文件保存通知(触发 server 全量分析) |
| ==`textDocument/publishDiagnostics`== | ==S → C== | ==Server 主动推送诊断==(error/warning/info) |
| ==`textDocument/definition`== | C → S | 跳转定义 |
| ==`textDocument/references`== | C → S | 找引用 |
| ==`textDocument/hover`== | C → S | 悬浮文档 |
| ==`textDocument/completion`== | C → S | 代码补全 |
| ==`textDocument/codeAction`== | C → S | 修复建议 / Quick Fix |
| ==`textDocument/rename`== | C → S | 重命名符号 |
| ==`workspace/symbol`== | C → S | 全工作区搜索符号 |

==关键认知==:==`publishDiagnostics` 是 server 主动推送==——Client 不主动查,而是订阅。这就是 ==LSP 的诊断模型==:文件状态变化触发分析,server 算完主动通知。

### 2.3 一次诊断的完整流程

```
1. Client → Server: initialize { rootUri, capabilities }
2. Server → Client: { capabilities: { ..., diagnosticProvider: true } }
3. Client → Server: notifications/initialized

4. (用户打开文件)
   Client → Server: textDocument/didOpen { uri, text }
                  ↓ Server 后台分析
5. Server → Client: textDocument/publishDiagnostics {
                     uri,
                     diagnostics: [
                       { range, severity: 1, message: "Cannot find symbol 'x'" },
                       { range, severity: 2, message: "Unused import" }
                     ]
                   }

6. (用户修改文件)
   Client → Server: textDocument/didChange { contentChanges }
                  ↓ Server 重新分析(增量)
7. Server → Client: textDocument/publishDiagnostics { ... }  ← 重发覆盖之前的
```

==severity 等级==:`1=error / 2=warning / 3=info / 4=hint`——LSP 标准枚举,所有 server 一致。

### 2.4 一个最简 LSP Client(Python)

```python
import json, subprocess, threading

# 1. 启动 server 子进程(stdio)
proc = subprocess.Popen(
    ["pyright-langserver", "--stdio"],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE
)

# 2. 发送 initialize
def send(method, params):
    msg = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    body = json.dumps(msg).encode()
    proc.stdin.write(f"Content-Length: {len(body)}\r\n\r\n".encode() + body)
    proc.stdin.flush()

send("initialize", {
    "rootUri": "file:///workspace",
    "capabilities": {"textDocument": {"publishDiagnostics": {}}}
})

# 3. 读取 server 推送的诊断
def listen():
    while True:
        # 读 Content-Length header
        header = proc.stdout.readline().decode().strip()
        length = int(header.split(": ")[1])
        proc.stdout.readline()  # 空行
        body = proc.stdout.read(length)
        msg = json.loads(body)
        if msg.get("method") == "textDocument/publishDiagnostics":
            print("收到诊断:", msg["params"]["diagnostics"])

threading.Thread(target=listen, daemon=True).start()
```

==生产实现==:用 `pygls`(Python)/ `vscode-languageclient`(TS)/ `lsp4j`(Java)等 SDK,不要自己撸协议。

---

## 三、主流 LSP Server 生态

==2026 年成熟度极高==,几乎每种主流语言都有官方/社区维护的 server:

| 语言 | Server | 维护方 | 特点 |
|------|--------|--------|------|
| ==Java== | ==JDT LS==(Eclipse JDT) | Red Hat / IBM | 完整 Java 语义,JDK 协同 |
| ==Rust== | ==rust-analyzer== | Rust 官方 | 业界标杆,响应极快 |
| ==Python== | ==pyright== / ==pylsp== | Microsoft / 社区 | pyright 类型推断强 |
| ==Go== | ==gopls== | Go 官方 | 与 go toolchain 深度集成 |
| ==TypeScript / JavaScript== | ==typescript-language-server== | TS 团队 | 基于 tsserver 包装 |
| ==C / C++== | ==clangd== | LLVM 官方 | 与 Clang AST 共享 |
| ==Kotlin== | ==kotlin-language-server== | 社区 | JetBrains 也有官方版 |
| ==C#== | ==omnisharp== / ==Roslyn LSP== | Microsoft | 大型项目偏慢 |
| ==Swift== | ==sourcekit-lsp== | Apple | 与 Xcode 共用 |

==Coding Agent 普遍内置或可挂这套==——Cursor / Continue / Claude Code 都通过 LSP 拿语言能力。

==2026 趋势==:==LSP server 的"AI 友好化"==——增加 batch API(一次拿整个项目的诊断 / 符号),原本设计是给 IDE 单文件用的。

---

## 四、LSP vs MCP:JSON-RPC 双胞胎

==经常被混淆==——两个都是 JSON-RPC 协议,看起来很像,==但目标完全不同==:

| 维度 | LSP | MCP |
|------|-----|-----|
| ==提出== | Microsoft 2016 | Anthropic 2024 |
| ==连接对== | 编辑器 ↔ 语言服务 | AI 应用 ↔ 工具 |
| ==协议基础== | JSON-RPC 2.0 over stdio | JSON-RPC 2.0 over stdio / Streamable HTTP |
| ==核心方法== | `textDocument/*` / `workspace/*` | `tools/list` / `tools/call` / `resources/*` |
| ==推送机制== | ==Server 主动推 diagnostics== | ==Server 推 notifications/*_changed== |
| ==生态成熟度== | 极成熟(10 年,所有主流语言) | 快速成熟(2 年,生态爆发) |
| ==典型 Server== | rust-analyzer / pyright / gopls | github / postgres / chrome-devtools |
| ==解决问题== | M×N 编辑器×语言 | M×N 模型×工具 |

==关键认知==:==MCP 在协议设计上明显借鉴了 LSP==——同样的 JSON-RPC、同样的 capability 协商、同样的 notifications 机制。==MCP 是 LSP 思想在 Agent 时代的演化==。

### 4.1 LSP 服务通过 MCP 暴露给 LLM

==生产桥接模式==——LSP server 已存在,把它包成 MCP server 让 LLM 调:

```
LLM (tool_calls) → MCP Client (Host)
                      ↓
                MCP Server "langserver-mcp"
                      ↓ JSON-RPC 转换
                  LSP Server (rust-analyzer / pyright / ...)
                      ↓
                  返回符号 / 诊断 / 定义位置
```

==社区项目==:`langserver-mcp` / `lsp-mcp-bridge` / `mcp-language-server`——把 LSP 的 70+ 方法选择性暴露成 MCP tools。

==典型暴露的工具==:
- `lsp_find_definition(file, line, col)` ← `textDocument/definition`
- `lsp_find_references(file, line, col)` ← `textDocument/references`
- `lsp_get_diagnostics(file)` ← 缓存 server 推过来的 publishDiagnostics
- `lsp_rename_symbol(file, line, col, new_name)` ← `textDocument/rename`

==价值==:Agent 不用懂 LSP 协议细节,只用调几个工具就拿到 IDE 级语言能力。

### 4.2 不通过 MCP 直接内置 LSP Client

==另一种主流方案==:Coding Agent 自己内置 LSP Client——直接连 LSP server,把诊断回注 LLM。==更轻量,但与 Coding Agent 强耦合==。

==选型==:
- ==Cursor / VS Code Continue== → 直接内置(已经有 IDE 级 LSP 集成)
- ==CLI 类 Coding Agent==(Aider / Goose / PaiCli) → 内置 + 可选 MCP 桥接
- ==基于 Claude Desktop / 通用 AI Host== → ==走 MCP 桥接==更解耦

---

## 五、Coding Agent 的诊断回注模式

==这是 Coding Agent 区别于 IDE 的关键差异==——IDE 把诊断显示给人看,Coding Agent 把诊断==回注给 LLM 让它自己修==。

### 5.1 Post-Edit 触发模式

==典型时序==:

```
1. LLM tool_call: write_file("src/auth.ts", new_content)
2. Host 写文件成功
3. Host ==异步触发==:
   - LSP textDocument/didOpen / didChange
   - 等待 server 返回 publishDiagnostics
   - 缓存到"pending diagnostics"队列
4. Host 立即返回 tool_result("write success") 给 LLM —— ==不等诊断==
5. LLM 进入下一轮推理
6. ★ Host 在下一轮 LLM 请求前注入:
   user message 前置 / system 末尾追加:
     "## Pending Diagnostics(从上次编辑收集)
      [error] src/auth.ts:42:18 - Cannot find name 'JWTPayload'
      [warning] src/auth.ts:50:5 - Variable 'unused' is never used
      ..."
7. LLM 看到诊断 → 自主决定调 read_file / Edit 修复
```

==关键设计==:

| 设计点 | 理由 |
|------|------|
| ==异步不阻塞主流程== | LSP 分析可能 1-5s,阻塞会让 Coding Agent 体验劝退 |
| ==缓存到 pending 队列== | 多次编辑可能产生多组诊断,统一注入 |
| ==下一轮请求前注入== | 时机关键——太早 LLM 还没准备处理,太晚 LLM 已经走偏 |
| ==格式化为人类可读== | LLM 训练数据里见过编译器错误格式,直接给"file:line:col - message"最有效 |

### 5.2 三种推理模式都注入

==ReAct / Plan-and-Execute / Multi-Agent 都要注入==——只是注入位置不同:

| 推理模式 | 注入位置 | 触发频率 |
|---------|---------|---------|
| ==ReAct== | 每轮 LLM 调用前 | 每个 Thought 之前 |
| ==Plan-and-Execute== | 每个 Step 执行前 | Step 边界 |
| ==Multi-Agent== | Worker 每次调用前 / Reviewer 看到诊断决定通过否 | Worker 级 + Reviewer 级 |

==Multi-Agent 中 Reviewer 看诊断==是个高级用法——Reviewer 不只看代码,还看==这次编辑产生了多少诊断==,据此打分。

### 5.3 不阻塞 vs 强制等待

==两种策略对比==:

| 策略 | 适用 | 代价 |
|------|------|------|
| ==异步不阻塞==(推荐) | 一般 Coding Agent | 诊断有 1-2 轮延迟,LLM 偶尔基于"无诊断"假设继续编辑 |
| ==同步等待诊断== | 高精度场景(关键代码) | LSP 慢时 Agent 卡死,体验差 |

==生产推荐异步==——延迟 1-2 轮的代价远小于同步等待 5s 的体验损失。

### 5.4 与 [[Reflection 实现#3.3 外部验证器]] 的关系

==诊断回注是外部验证器的具体落地形式==:

```
Reflection §3.3: 用确定性工具验证(test / lint / 编译)
                              ↓ 具体到代码诊断场景
Post-Edit 诊断回注:
  - "测试" 对应 → LSP 编译错误 / 类型错误
  - "lint" 对应 → LSP warning / unused variable / style
  - 验证结果回注 LLM 上下文 → 让 LLM 自主修
```

==关系总结==:
- [[Reflection 实现#3.3 外部验证器]] 讲==思想==(用确定性工具替代 LLM 自评)
- 本节讲==落地==(LSP 诊断怎么收集 / 怎么格式化 / 怎么注入)

---

## 六、诊断格式化与容量管理

### 6.1 标准格式

==LLM 训练数据里见过的诊断格式==——直接用编译器/lint 风格最有效:

```
[error] src/auth.ts:42:18 - Cannot find name 'JWTPayload'
[error] src/auth.ts:50:5 - Type 'string' is not assignable to type 'number'
[warning] src/auth.ts:55:10 - 'oldVar' is declared but never used
[info] src/auth.ts:60:1 - Consider extracting this expression into a constant
```

==格式要素==:
- ==方括号 severity==(`[error]` / `[warning]` / `[info]`)
- ==文件路径==(相对工作目录,LLM 容易理解)
- ==行:列==(1-based,与 LSP 协议一致)
- ==破折号 + message==

==避免==:JSON 格式(LLM 处理 JSON 不如纯文本快)、过度结构化(`severity: 1` 不如 `[error]` 直观)。

### 6.2 容量管理:为什么要上限

==大型项目首次扫描可能产生 1000+ 诊断==——全注入会:
- ==吃光 prompt budget==——20 条诊断 ~500 token,1000 条就 25k token
- ==注意力稀释==——LLM 看到 1000 条会失焦,反而修不好任何一个
- ==破坏 prompt cache==——诊断变化频繁,前缀稳定性差

==生产实践==:==默认上限 20 条==,可配置:

```python
DEFAULT_MAX_DIAGNOSTICS = 20

def format_pending_diagnostics(diagnostics: list, max_count: int = DEFAULT_MAX_DIAGNOSTICS) -> str:
    # 1. 优先级排序
    sorted_diags = sorted(
        diagnostics,
        key=lambda d: (
            -SEVERITY_WEIGHT[d.severity],   # error > warning > info
            d.file != current_file,          # 当前编辑的文件优先
            d.line                           # 行号小的优先
        )
    )

    # 2. 截断
    truncated = sorted_diags[:max_count]
    overflow = len(sorted_diags) - max_count

    # 3. 格式化
    lines = [format_one(d) for d in truncated]
    if overflow > 0:
        lines.append(f"... 还有 {overflow} 条诊断未显示(超过上限 {max_count})")

    return "\n".join(lines)
```

### 6.3 优先级排序的考量

| 维度 | 排序逻辑 | 理由 |
|------|---------|------|
| ==Severity== | error > warning > info > hint | error 必须修,warning 可选,info 是建议 |
| ==文件相关性== | 当前编辑的文件 > 其他文件 | LLM 刚改完最容易理解上下文 |
| ==行号== | 小行号优先 | 通常文件头的错误更结构性 |
| ==重复抑制== | 同一行多个诊断只保留最严重的 | 一处错误可能触发多个连锁警告 |

### 6.4 下游清理

==注入下一轮后,pending 队列要清==——避免反复注入旧诊断让 LLM 误以为没修好:

```python
def inject_diagnostics_to_next_turn():
    pending = diagnostic_queue.drain()  # ★ 取出并清空
    if pending:
        formatted = format_pending_diagnostics(pending)
        next_turn_context.prepend(f"## Pending Diagnostics\n{formatted}")
```

==清空时机==:输出格式化后立即清——下次编辑触发新一轮诊断,新诊断进队列。

---

## 七、渐进式实现策略

### 7.1 MVP:轻量解析器先上

==生产 Coding Agent 普遍模式==:不要一开始就接 LSP——先用轻量方案覆盖最常见诊断:

| 阶段 | 实现 | 覆盖率 | 成本 |
|------|------|------|------|
| ==MVP== | 语言专属 AST 解析器(JavaParser / tree-sitter / ast 模块) | ==~60%==(语法错误 / 基础静态分析) | 低 |
| ==v1== | 接入 1-2 个核心 LSP server | ~85% | 中 |
| ==v2== | 接全主流 LSP(Java / Rust / Py / Go / TS) | ~95% | 高 |

==典型 MVP 实现==(Java):

```java
// 用 JavaParser 做语法诊断,不依赖 JDT LS
import com.github.javaparser.JavaParser;
import com.github.javaparser.ParseResult;
import com.github.javaparser.Problem;

public List<Diagnostic> diagnoseJava(String filePath, String content) {
    JavaParser parser = new JavaParser();
    ParseResult<CompilationUnit> result = parser.parse(content);

    return result.getProblems().stream()
        .map(p -> new Diagnostic(
            filePath,
            p.getLocation().get().getBegin().get().line,
            p.getLocation().get().getBegin().get().column,
            "error",
            p.getMessage()
        ))
        .collect(Collectors.toList());
}
```

==MVP 的局限==:
- 只能查==语法错误==,查不出==类型错误==(需要类型推断,JavaParser 不做)
- 查不出==跨文件引用==(需要全项目分析)
- 查不出==unused / dead code==

==但 MVP 已经足够==——大部分 LLM 编辑后的错误都是==基础语法错==,真正需要 full LSP 的场景占少数。

### 7.2 升级到完整 LSP

==当 MVP 覆盖不够时==,接入对应 LSP server:

```
启动 LSP server 子进程(stdio)
   ↓
initialize 握手 + 工作目录
   ↓
write_file 后:
  textDocument/didOpen → 通知 server
  textDocument/didSave → 触发完整分析
   ↓
监听 publishDiagnostics 推送
   ↓
缓存到 pending 队列
```

==升级的工程成本==:
- ==安装 LSP server==——用户机器要装 JDT LS / rust-analyzer 等(部分语言要 SDK)
- ==协议适配==——70+ 方法,不同 server 对扩展协议支持不同
- ==状态管理==——server 进程生命周期(参考 [[MCP 协议#35-server-生命周期与异步启动]])

### 7.3 渐进式策略的工程价值

==不要一开始就接所有 LSP==——
1. ==MVP 快速上线==——证明诊断回注模式有价值
2. ==高频语言先接==——Python / TypeScript 是 Coding Agent 主战场,优先
3. ==小众语言走 MCP 桥接==——不内置,通过 `langserver-mcp` 让用户自己挂

==这个策略与 [[MCP 协议]] / [[Agent Skills 体系]] / [[长上下文工程]] 的"==渐进式==思路一致==——MVP 验证 → 主流场景内置 → 长尾走插件。

---

## 八、与 Reflection / Generator-Evaluator 的关系

### 8.1 诊断回注 = 外部验证器的具体落地

==[[Reflection 实现]] §3.3 外部验证器==讲了思想:

```python
def evaluate_with_tools(task: str, code: str) -> dict:
    test_result = run_tests(code)
    lint_result = run_lint(code)
    return {"passed": ..., "issues": ...}
```

==本文讲了具体实现==:
- "运行 tests" → LSP `publishDiagnostics` 中的 ==error 类==(类型错误 / 编译错误)
- "运行 lint" → LSP `publishDiagnostics` 中的 ==warning / info 类==
- "issues 回 LLM" → 下一轮请求前注入 pending 诊断

### 8.2 Generator-Evaluator 模式的具象

```
Generator(LLM)
  ↓ 生成代码 (write_file)
Evaluator(LSP)
  ↓ 后台诊断 (publishDiagnostics)
反馈 Loop
  ↓ 下一轮注入 LLM
Generator 自主修复
```

==这就是 [[Harness Engineering]] 提到的 Generator-Evaluator 架构==——LSP 是天然的 Evaluator,因为它==给出确定性结果==(没有 LLM 概率性误判)。

### 8.3 与 LLM-as-Judge 的对比

| 方式 | 例子 | 准确性 | 成本 | 速度 |
|------|------|------|------|------|
| ==LSP 诊断== | rust-analyzer 报错 | ==极高==(确定性) | 低 | 快(1-2s) |
| ==LLM-as-Judge== | 让另一个 LLM 评估代码 | 中(概率性) | 高(多一次 LLM 调用) | 慢(LLM 调用) |
| ==自我反思== | 同一个 LLM 自评 | 低(盲点) | 低 | 中 |

==生产建议==:==有 LSP 用 LSP==——确定性 + 便宜 + 快;==没有 LSP 才上 LLM-as-Judge==(如评估文档质量 / 代码风格主观项)。

---

## 九、关键认知与面试要点

### 认知 1:LSP 与 MCP 是 JSON-RPC 双胞胎

==MCP 在协议设计上明显借鉴 LSP==——同样的 JSON-RPC、capability 协商、notifications 机制。==MCP 是 LSP 思想在 Agent 时代的演化==。

### 认知 2:Coding Agent ≠ IDE,诊断处理方式根本不同

==IDE 把诊断显示给人看,Coding Agent 把诊断回注 LLM 让它自己修==——这是 Agent 与 IDE 的核心差异。

### 认知 3:Post-Edit 诊断必须异步不阻塞

==阻塞主流程==等 LSP 分析(1-5s)会让 Coding Agent 体验劝退。==异步缓存到 pending 队列,下一轮请求前注入==是生产标配。

### 认知 4:诊断容量管理是 prompt 工程

==默认上限 20 条 + 优先级排序==(error > warning > info,当前文件优先)——避免 1000 条诊断 flood prompt。

### 认知 5:渐进式实现策略

==MVP 用轻量解析器(JavaParser / tree-sitter)→ v1 接核心 LSP → v2 全语言==。先验证模式有价值,再上重武器。

### 面试时的高质量回答

==问==:"你们 Coding Agent 怎么处理代码错误?"

==❌ 平庸答案==:"用 LSP 拿诊断显示给用户。"

==✅ 高质量答案==:"==Post-Edit 诊断回注模式==——

1. ==write_file 后异步触发== LSP `textDocument/didSave`,server 后台分析
2. 不阻塞主流程,诊断结果缓存到 ==pending 队列==
3. ==下一轮 LLM 请求前注入==——格式化为 `[error] file:line:col - message` 风格
4. ==默认上限 20 条==,按 severity + 当前文件 + 行号优先级排序
5. ReAct / Plan-and-Execute / Multi-Agent 三种推理模式都注入,Multi-Agent 中 Reviewer 还会基于诊断打分
6. ==MVP 用轻量解析器==(JavaParser / tree-sitter)覆盖 60% 语法错,后续接全 LSP server

==关键认知==:Coding Agent 与 IDE 的本质区别是诊断处理方式——IDE 给人看,Agent 给 LLM 看让它自己修。这就是 [[Reflection 实现#3.3 外部验证器]] 思想的具体落地——==确定性工具验证 + 反馈回 LLM==,比 LLM-as-Judge 更准更便宜更快。"

---

## 相关链接

- [[MCP 协议]] — JSON-RPC 协议家族(MCP 借鉴 LSP 设计)
- [[Function Calling]] — Tool 调用协议(LSP 工具暴露给 LLM 经过 FC 层)
- [[Reflection 实现#3.3 外部验证器]] — 诊断回注是外部验证器思想的具体落地
- [[Harness Engineering]] — Generator-Evaluator 架构(LSP 是天然 Evaluator)
- [[Coding Agent 工具集#22-代码搜索类]] — `get_definition` / `get_references` 走 LSP
- [[Code RAG]] — LSP 在 Code RAG 中的调用图增强
- [[Coding Agent TUI 设计]] — 诊断的 UI 呈现(IDE 显示 vs Agent 回注 LLM)
