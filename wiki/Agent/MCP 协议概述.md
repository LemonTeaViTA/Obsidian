---
module: Agent
tags: [Agent, MCP, Protocol, Architecture]
difficulty: medium
last_reviewed: 2026-06-01
---

# MCP 协议概述

> MCP（Model Context Protocol）是 Anthropic 2024 年 11 月推出的==工具接入标准协议==，相当于 AI 世界的"USB 接口"。==2026 年已成为事实标准==——Claude、Cursor、Windsurf、VS Code、OpenAI 都已原生支持。

## 一、核心问题：M × N 困境

### 没有 MCP 之前

```
Claude  ↔ 文件系统适配
Claude  ↔ 数据库适配
Claude  ↔ Slack 适配
GPT-4   ↔ 文件系统适配（重写一遍）
GPT-4   ↔ 数据库适配（重写一遍）
GPT-4   ↔ Slack 适配（重写一遍）
Gemini  ↔ 文件系统适配（再重写）
...
```

==M 个模型 × N 个工具 = M × N 个集成==。==每个工具厂商要为每个 AI 工具单独写适配==，维护成本爆炸。

### MCP 之后：M + N

```
==MCP 协议==
   ↑↓
工具厂商写一次 MCP Server
   ↑↓
所有支持 MCP 的 AI 工具都能调用
   ↑↓
Claude / Cursor / VS Code / Windsurf / Continue ...
```

==M + N 个集成==。==工具只实现一次 MCP 接口==，所有支持 MCP 的模型都能调用。

### 类比：USB 协议

USB 出现前：键盘要配 PS/2 接口、鼠标要配 PS/2 接口、打印机要配并口、扫描仪要配 SCSI——每个外设都有自己的接口。==USB 出现后==：所有外设统一接口，任何电脑都能接入。==MCP 就是 AI 工具的 USB==。

---

## 二、Host / Client / Server 三层架构

MCP 基于 ==JSON-RPC 2.0== 通信，分三层角色：

```
┌──────────────────────────────────────────────────┐
│  Host（AI 应用）                                 │
│  Claude Desktop / Cursor / VS Code / Windsurf    │
│  ↓ 嵌入                                          │
│  MCP Client（每个连接一个）                      │
│  ↓ JSON-RPC over stdio / SSE / WebSocket         │
└──────────────────────────────────────────────────┘
         ↕                  ↕                ↕
   ┌─────────┐       ┌──────────┐      ┌──────────┐
   │ Server 1│       │ Server 2 │      │ Server 3 │
   │ GitHub  │       │ Postgres │      │ Slack    │
   └─────────┘       └──────────┘      └──────────┘
```

### 三个角色

| 角色 | 谁来做 | 干什么 |
|------|-------|-------|
| ==Host== | AI 应用（Claude Desktop / Cursor 等） | 启动 Client、管理用户授权、把工具喂给 LLM |
| ==Client== | Host 内部组件（每个 Server 一个 Client 实例） | 用 JSON-RPC 与 Server 通信 |
| ==Server== | 工具厂商写的独立进程 | 暴露具体能力（工具/资源/Prompt 模板） |

==关键设计==：每个 Server 是==独立进程==——挂了不影响 Host，权限隔离，不同 Server 互不感知。

### Server 提供的三种能力

| 能力 | 说明 | 例子 |
|------|------|------|
| ==Tools== | 可调用的函数（LLM 决定何时调） | `github.create_issue` / `postgres.query` |
| ==Resources== | 可读取的数据（类似只读 API） | `file://README.md` / `db://users/schema` |
| ==Prompts== | 预定义 Prompt 模板（用户主动调用） | `"重构这段代码"` / `"生成单元测试"` |

==Tools 是最常用的==——其他两种生态还在演化中。

---

## 三、通信方式：三种 transport

| Transport | 适用 | MCP 占比 |
|-----------|------|------|
| ==stdio==（标准输入输出） | ==本地 Server 进程==——Host 启动子进程 + pipe 通信 | ==80%+== |
| ==Streamable HTTP==（2025 新规范） | ==远程 Server==——单 endpoint POST + chunked 流式响应 | ~15% |
| ==WebSocket== | 远程双向实时通信 | <5%（防火墙问题） |

> [!info] ==stdio / Streamable HTTP / WebSocket 是什么？三者怎么选？==
> 这三个不是 MCP 特有概念——是==操作系统 IPC + 计算机网络协议==的基础知识。==MCP / LSP / gRPC 都用它们做底层传输==。
>
> 完整解释（==类比、消息边界、关键特征、对比表==）见 [[计算机网络#五Agent-时代的传输方式stdio--streamable-http--websocket]]。
>
> ==简单说==：==stdio == 本机父子进程的"传话筒"==；==Streamable HTTP == 浏览器协议的"流式版"==；==WebSocket == 真正的"双向电话"==。

==生产中 stdio 占 80%+==——大部分 MCP Server 是本地工具（filesystem / git / postgres）。==远程 server 走 Streamable HTTP==——典型场景：托管在云端的 SaaS 工具（chrome-devtools 远程实例 / 团队共享的内网 API server）。

### Streamable HTTP vs 老 SSE：协议演进

==2024 年初版 SSE 方案==（已废弃）：两个 endpoint——`POST /messages` 发请求 + `GET /sse` 接收响应流——==Client 要同时维持两条连接，状态不好对齐==。

==2025 Streamable HTTP==（当前规范）：==单 endpoint==——`POST /mcp` 同时承担请求和流式响应，Server 用 ==`Transfer-Encoding: chunked`== 边算边推。==简化为一条连接==，断线重连容易。

```
Client → POST /mcp { "method": "tools/call", ... }
   ↓
Server → 200 OK, Transfer-Encoding: chunked
         chunk 1: { "type": "progress", ... }
         chunk 2: { "type": "progress", ... }
         chunk N: { "type": "result", ... }
```

### Server 配置示例

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    },
    "chrome-devtools": {
      "url": "https://devtools.example.com/mcp",
      "headers": { "Authorization": "Bearer xxx" }
    }
  }
}
```

> [!note] 上例两个 Server 分别演示两种 transport：`filesystem` 用 `command`（stdio 本地子进程），`chrome-devtools` 用 `url`（Streamable HTTP 远程 server）。

==Host 看 `command` vs `url` 字段判断走哪种 transport==。

---

## 四、与其他协议的关系

### 与 Function Calling：配合工作的两层

==经常被混在一起，其实是配合工作的两层==：

| 概念 | 层级 | 解决什么 |
|------|------|--------|
| ==Function Calling== | LLM 协议层 | "LLM 怎么表达想调工具"——输出 tool_calls 字段 |
| ==MCP== | 应用 ↔ 工具协议层 | "工具怎么暴露给 LLM"——JSON-RPC 标准化 |

#### 工作流程：两个协议如何衔接

```
1. 启动时：MCP Client 向 Server 请求 list_tools
   → Server 返回 { name, description, inputSchema }

2. Host 把 Server 返回的 schema 转成 ==Function Calling 的 tools 参数==
   → 塞进给 LLM 的请求

3. LLM 看到 tools，决定调用 → 输出 ==Function Calling 的 tool_calls==
   → Host 拿到 tool_calls

4. Host 通过 ==MCP Client 把调用 forward 给 Server==
   → Server 执行 → 返回结果

5. Host 把结果作为 ==Function Calling 的 tool 角色消息==塞回 messages
   → 下一轮 LLM 看到结果
```

==分工清晰==：MCP 负责"==外部工具的标准化暴露与执行=="，Function Calling 负责"==LLM 与工具调用意图的表达=="。两个协议在 ==Host 内部==衔接。

==没有 MCP 也能用 Function Calling==：Coding Agent 的内置工具（read_file 写死在产品代码里的）直接走 FC，不经过 MCP。==MCP 是给"外部、可插拔工具"准备的==。

### 与 A2A 协议的区别

MCP 和 A2A（Agent-to-Agent）解决的是两个不同层次的问题：

- ==MCP==：Agent ↔ 工具的协议——"一个 Agent 怎么调外部工具"
- ==A2A==：Agent ↔ Agent 的协议（Google 2025 提出）——"多个 Agent 怎么互相调用协作"，尤其跨团队/跨组织

#### A2A 的工作机制

每个 Agent 发布一张==能力名片==（Agent Card）—— JSON 文件声明能做什么、接受什么输入、支持哪些认证：

```json
{
  "name": "CodeReviewAgent",
  "description": "审查代码，输出问题列表和改进建议",
  "capabilities": ["code_review", "security_scan"],
  "endpoint": "https://agents.company.com/code-review",
  "inputSchema": { "type": "object", "properties": { "code": { "type": "string" } } }
}
```

其他 Agent 通过标准 HTTP API 发现并调用它。

#### 单 Agent vs A2A 多 Agent

| 维度 | 单 Agent | A2A 多 Agent |
|------|---------|-------------|
| 能力边界 | 一个 Agent 包揽所有工具和技能 | 每个 Agent 专注一个领域，通过 A2A 组合 |
| 团队协作 | 单团队维护 | 不同团队各自维护自己的 Agent，通过 A2A 互操作 |
| 扩展方式 | 给 Agent 加工具 | 接入新的专业 Agent |
| 故障隔离 | 一个工具挂了影响整体 | 一个 Agent 挂了其他不受影响 |
| 适用规模 | 中小型任务 | 企业级、跨组织复杂任务 |

#### MCP 和 A2A 的互补关系

==完整 Agent 系统两者通常同时存在==：
- 每个 Agent 内部用 ==MCP== 接入工具（文件、数据库、API）
- Agent 之间用 ==A2A== 互相调用（编排者 Agent 调用执行者 Agent）

==类比==：MCP 是 Agent 的"==手=="（操作工具），A2A 是 Agent 的"==嘴=="（和其他 Agent 沟通）。

---

## 五、行业现状（2026）

| AI 工具 | 原生支持 MCP | 备注 |
|---------|------------|------|
| Claude Desktop / Code | ✓（Anthropic 自己推） | 全功能支持 |
| Cursor | ✓ | 2025 年加入 |
| Windsurf | ✓ | 2025 年加入 |
| VS Code | ✓ | 通过 GitHub Copilot Chat 集成 |
| Continue | ✓ | 开源插件原生支持 |
| OpenAI ChatGPT | ✓ | 2025 年宣布支持 |
| Gemini | ✓ | 2025 年加入 |

==MCP 已经是事实标准==——面试时强调它是"已落地的行业标准"，不是"实验性协议"。

---

## 相关链接

- [[MCP 服务端开发]] — Server 实现、工具注册、生命周期管理
- [[MCP 客户端集成]] — Host 集成层、Schema 清洗、命名空间、notifications 处理
- [[MCP Server 生态]] — 主流 Server 清单 + 浏览器自动化 / CDP / isolated-shared 工作模式
- [[MCP 安全模型]] — 三道安全关卡 / 常见坑 / 审计日志凭证脱敏
- [[Function Calling]] — LLM 协议层（FC 解决"LLM 怎么调工具"，MCP 解决"工具怎么暴露"）
- [[Coding Agent 工具集]] — Claude Code / Cursor 等具体提供的工具集（含 MCP 动态工具）
- [[计算机网络]] — stdio / Streamable HTTP / WebSocket 底层传输机制
