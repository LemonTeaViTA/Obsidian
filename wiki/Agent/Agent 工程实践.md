---
module: Agent
tags: [Agent, 工程实践, CLI, LangChain, LangGraph, 2026趋势]
difficulty: hard
last_reviewed: 2026-05-28
---

# Agent 工程实践

> ==本文是 Agent 工程实践的导航枢纽==——原有的大杂烩已拆分为 5 个独立文档，每个主题有清晰的边界。
>
> 如果你想找具体内容，直接跳到对应文档；如果你想了解 CLI 设计或 LangChain/LangGraph，本文有完整内容。

---

## 导航：已拆分的独立文档

| 主题 | 文档 | 核心内容 |
|------|------|---------|
| ==Multi-Agent 协作== | [[Multi-Agent 架构]] | 四种协作模式 / 三角色组合 / 冲突仲裁 / 何时该用 |
| ==可靠性设计== | [[Agent 可靠性设计]] | 死循环检测 / Fallback 四层 / 工具失败四层决策 / 错误累积防护 / Side-History |
| ==安全模型== | [[Agent 安全模型]] | 为什么不做沙箱 / HITL 三档 / PathGuard / CommandGuard / Prompt Injection |
| ==可观测性== | [[Agent 可观测性]] | 三层追踪 / 审计日志 / 成本控制 / Debug 推理链 |
| ==部署与服务化== | [[Agent 部署与服务化]] | Durable Task Queue / Runtime API / Worker Pool |

---

## 一、CLI 设计

### 为什么 AI 时代大家都在做 CLI

AI 就是文本进、文本出，它没有眼睛看不了图形界面。CLI 是纯文本的，和 AI 天然适配。

AI 的实际能力 = 它能调用的工具 + 它拿到的上下文。CLI 是当下效率最高的 AI 能力分发方式。

> [!info] 注意区分两种 CLI
> 本节讲的是==被 AI 调用的工具型 CLI==（`gh issue list --json` 这种）——一次执行、输出 JSON、给 Agent 解析。
> 给用户用的==交互式 TUI==（Claude Code / Qoder REPL）见 [[Coding Agent TUI 设计]]。

### 新一代 CLI vs 传统 CLI

| 维度 | 传统 CLI | 新一代 CLI |
|------|----------|-----------|
| 设计对象 | 给程序员用 | 假设调用者是 AI Agent |
| 交互方式 | 弹交互式菜单 | 所有操作通过参数一次性传入 |
| 输出格式 | 彩色文字给人看 | JSON 格式，AI 直接解析 |
| 说明书 | 靠 man page | 自带 Skills 文件 |
| 预览能力 | 无 | 支持 --dry-run |

### 做 CLI 的五个关键点

1. **不要弹交互式菜单**：所有选项通过参数传入，提供 `--no-interactive`
2. **输出 JSON 格式**：默认 JSON 或提供 `--output json`
3. **提供 --dry-run 预览**：危险操作前让 AI 先看看会发生什么
4. **控制输出大小**：用 field masks 或 `--fields` 控制返回字段
5. **写好 Skills 说明书**：控制在 1.6KB 左右，只写 AI 需要知道的

### CLI 打包了 MCP + Skills + Plugin

一个 CLI 工具同时包含执行能力、通信协议和使用说明，就是一个完整的 AI 插件。跨平台，免审核，人和 AI 都能用。

CLI 还有管道优势，多个工具可以通过管道串联：
```
数据拉取 CLI | jq 处理 | AI 生成报告 | 飞书 CLI 发送
```

Karpathy 说得对：**每一个产品都应该有一个 CLI 工具。不要让开发者去访问、查看或点击。直接指示和赋能他们的 AI。**

---

## 二、LangChain 使用

### LangChain 的三层架构

**基础抽象层**：定义 LLM、ChatModel、Prompt、OutputParser 核心接口，换模型只要换实现类。

**能力层**：六个核心模块：

| 模块 | 职责 |
|------|------|
| Models | 对各家大模型的统一封装，上层调用接口都是 `ChatModel.call()` |
| Prompts | 提示词管理，支持模板变量、Few-Shot 示例、动态拼装 |
| Indexes | 文档索引（DocumentLoader、TextSplitter、VectorStore、Retriever） |
| Memory | 记忆管理，短期用 BufferMemory，长期接 VectorStore |
| Chains | 多步骤串联，最常用 LLMChain = Prompt + Model + OutputParser |
| Agents | 自主决策模块，模型根据目标自己选择调用哪个工具 |

**应用层**：LangServe 做部署，LangSmith 做调试和监控，LangGraph 做复杂状态图编排。

### LangChain vs LangGraph

LangChain 的 Chain 是线性的，A→B→C 一条路走到黑。真实 Agent 场景经常需要条件分支、循环、并行执行，Chain 搞不定。

LangGraph 把工作流从链式升级成图式——节点处理步骤，边可以带条件，还支持循环。底层是 StateGraph，用状态驱动整个执行流程。

LangGraph 的两个独特能力：
1. **循环支持**：传统 DAG 不允许循环，但 Agent 的推理循环天然需要循环
2. **状态持久化**：每一步状态快照存下来，支持 Human-in-the-Loop——关键节点暂停等待人工确认

条件边（Conditional Edge）：A → f(state) → B 或 C 或 D，下一步走哪里取决于当前状态的计算结果，让有向图具备动态路由能力。

### Agent 开发的四种方式

| 方式 | 特点 | 适用场景 |
|------|------|---------|
| ReAct 模式 | 交替推理和执行，LangChain Agent 的默认模式 | 探索性任务、信息检索、通用 Agent |
| Plan-and-Execute | 先规划完整计划再逐步执行 | 步骤明确的多步任务、报告生成 |
| Multi-Agent 协作 | 多个 Agent 各司其职，通过消息传递协调 | 复杂任务分解、并行处理 |
| 状态图编排 | LangGraph 方式，开发者画图定义节点、边和条件分支 | 需要精确控制流程、有复杂条件分支的场景 |

**选型建议**：

```
任务步骤是否固定？
├── 是 → 步骤是否有复杂条件分支？
│   ├── 是 → 状态图编排（LangGraph）
│   └── 否 → Plan-and-Execute
└── 否 → 任务是否可以并行分解？
    ├── 是 → Multi-Agent 协作
    └── 否 → ReAct 模式
```

实际项目中这四种方式经常混用：用状态图编排整体流程，每个节点内部用 ReAct 模式执行，复杂节点拆成 Multi-Agent 协作。

---

## 三、Agent 2025-2026 新趋势

### Context Engineering 取代 Prompt Engineering

**范式转变**：Shopify CEO Toby Lutke 提出"Context Engineering"概念——Prompt Engineering 只关注一条指令怎么写，Context Engineering 关注的是**在 LLM 调用时，如何组装最优的完整输入**，包括系统指令、工具描述、检索结果、对话历史、Memory、元数据等所有上下文。

**为什么重要**：Agent 的每次 LLM 调用，Prompt 文本本身可能只占 5%，剩下 95% 是动态组装的上下文。真正决定 Agent 质量的不是那 5% 的措辞，而是上下文的选择、排列和压缩策略。

**Context Engineering 的五个维度**：

| 维度 | 内容 | 典型技术 |
|------|------|---------|
| 指令层 | System Prompt + 任务约束 | Harness Engineering、CLAUDE.md |
| 知识层 | 外部知识注入 | RAG、Knowledge Graph |
| 记忆层 | 历史交互信息 | Memory 系统、对话摘要 |
| 工具层 | 可用能力描述 | Function Calling、MCP |
| 约束层 | 输出格式、安全边界 | JSON Schema、Guard Rails |

> [!tip] 面试高频
> 被问到"Prompt Engineering"时主动提及 Context Engineering 的演进，展示对 Agent 工程化的深度理解。核心论点：**单次 Prompt 优化的收益天花板很低，真正的杠杆在于上下文管理系统的设计**。

### Computer Use / Browser Use

**是什么**：让 Agent 像人类一样操作桌面 GUI 和浏览器——点击按钮、填写表单、截图理解页面、导航网页。

**技术路线**：
- **截图 + 多模态理解**：Agent 截取屏幕画面，用多模态 LLM 理解 UI 元素位置和含义，输出鼠标坐标和操作指令（Anthropic Claude Computer Use）
- **DOM 解析 + 结构化操作**：Agent 直接解析网页 DOM 树，通过 CSS 选择器精确操作元素（Browser Use、Playwright MCP）

**价值**：打通"最后一公里"——很多企业内部系统没有 API，只有 Web 界面。Computer Use 让 Agent 能操作任何有 GUI 的软件，不再依赖 API 集成。

详见 [[MCP 协议#54-浏览器自动化]]。

### 2026 Agent 技术趋势

1. **Agent-to-Agent 协议（A2A）**：Google 提出的标准协议，让不同厂商的 Agent 之间能发现能力、协商任务、交换结果。MCP 解决 Agent-to-Tool，A2A 解决 Agent-to-Agent
2. **长期记忆与个性化**：Agent 从"无状态工具"进化为"有记忆的助手"，跨会话保留用户偏好和工作上下文
3. **Agent 安全框架成熟**：OWASP Top 10 for LLM 和 Agent 的安全标准逐步建立，Prompt Injection 防御从"最佳实践"变为"工程标准"
4. **端侧 Agent**：Apple Intelligence、Gemini Nano 等让 Agent 在手机端本地运行，隐私敏感场景不再依赖云端

---

## 相关链接

- [[Multi-Agent 架构]] — 多 Agent 协作模式
- [[Agent 可靠性设计]] — 死循环 / Fallback / 错误累积防护
- [[Agent 安全模型]] — HITL / PathGuard / CommandGuard / 沙箱认知
- [[Agent 可观测性]] — 三层追踪 / 审计日志 / 成本控制
- [[Agent 部署与服务化]] — Durable Task Queue / Runtime API
- [[Agent 框架]] — LangChain / LangGraph / Spring AI / 国产框架选型
- [[Harness Engineering]] — LLM 工程的统一框架
