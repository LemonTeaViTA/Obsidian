---
module: Agent
tags: [Agent, Coding Agent, Tool Use, Claude Code, Cursor, MOC]
difficulty: medium
last_reviewed: 2026-06-01
---

# Coding Agent 工具集_MOC

> 本文是 Coding Agent 工具集的总索引——分类概览、使用场景对比、设计原则。
>
> 协议见 [[Function Calling]]；接入方式见 [[MCP 协议]]；产品对比见 [[AI 编程工具]]；代码检索底层见 [[Code RAG]]；Skills 详解见 [[Agent Skills 体系]]。

> [!tip] ==Coding Agent 工具集速览（一分钟读完）==
>
> ==1. Coding Agent 用工具的两个来源==
>
> | 来源 | 内置工具 | MCP 动态工具 |
> |------|--------|------------|
> | ==谁定义== | 产品厂商写死 | 用户运行时挂载 |
> | ==例子== | `read_file` / `grep` / `execute_command` | github / postgres / chrome-devtools |
> | ==实现== | Python/JS 函数（5-50 行） | JSON-RPC + 子进程 |
> | ==占比== | 80%+ 高频调用 | <20% 长尾扩展 |
>
> ==2. 内置工具的 5 大分类==
>
> | 类别 | 典型工具 |
> |------|--------|
> | 文件操作 | `read_file` / `write_file` / `edit_file` / `glob` |
> | 代码搜索 | `grep` / `codebase_search` / `get_definition` |
> | 命令执行 | `execute_command` / `run_test` |
> | 项目操作 | `create_project` / `install_dependency` |
> | 联网类 | `web_search` / `fetch_url` |
>
> ==3. 关键认知==
>
> - ==每个工具就是一段 5-50 行 Python==——==没有魔法==，全是简单实现
> - ==Coding Agent 不神秘==：工具集 + LLM 决策 + ReAct 循环
> - ==`grep` / `glob` 就是 ripgrep / glob 库的封装==——产品再大也是这套
> - ==只有 `codebase_search`==（语义检索）真正"重"——其他都很轻
>
> ==4. 工具数量管理==
>
> - ==单 Agent 工具 ≤ 10 个==——超过 LLM 选错率上升
> - ==工具描述 ≤ 4K tokens==——超过模型"看不见"末尾工具
> - ==MCP 工具用 `allowedTools` 白名单==——避免每个 server 30+ 工具堆积
>
> ==5. 工具的上层封装（Tool / Command / Skill）==
>
> | 抽象 | 触发方式 | 谁决定怎么做 |
> |------|--------|----------|
> | ==Tool== | LLM 主动调用 | LLM |
> | ==Command== | ==用户敲 `/xxx`== | 写死的 prompt 模板 |
> | ==Skill== | ==LLM 看上下文自动激活== | LLM 看完手册自己决定 |
>
> ==Skill ≠ 命令脚本==——是给 LLM 看的==专家手册==。完整机制见 [[Agent Skills 体系]]。

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

## 二、内置工具分类概览

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

详见 [[文件操作工具]]。

### 2.2 代码分析类

==让 Agent 在大代码库里找到相关代码==，是 Coding Agent 的核心能力。

| 工具 | 作用 | 底层 |
|------|------|-----|
| ==`grep`== / ==`code_search`== | 关键词搜索 | ripgrep（比 grep 快 10x） |
| ==`glob`== / ==`find_files`== | 按文件名模式找 | glob 库 / find 命令 |
| ==`codebase_search`== | 语义检索 | [[Code RAG]] 向量索引 + Re-rank |
| ==`get_definition`== | 跳转定义 | LSP / Tree-sitter |
| ==`get_references`== | 找引用 | LSP / 静态分析 |

==Claude Code 的特色：无索引模式==——不预建代码向量索引，==靠 grep + glob + read_file 现场检索==，依赖 Claude 的长上下文能力。详见 [[Code RAG#主流产品对比]]。Cursor 走的是相反路线——预建索引+语义检索。

详见 [[代码分析工具]]。

### 2.3 执行与调试类

==让 Agent 真的"做事"==——而不只是写代码。

| 工具 | 作用 | 设计要点 |
|------|------|---------|
| ==`execute_command`== / ==`run_in_terminal`== | 执行 shell 命令 | 沙箱 / 命令白名单 / 输出截断 |
| ==`run_test`== | 跑测试 | 自动检测项目（npm test / pytest / cargo test） |
| ==`run_lint`== / ==`run_format`== | 代码检查 / 格式化 | 自动调用项目配置的工具 |

==`execute_command` 是最危险的工具==——理论上 LLM 可以让它执行 `rm -rf /`。==生产部署必须配==：
- 沙箱（Docker / Bubblewrap / firejail）
- 命令白名单（只允许 `npm/yarn/git/python/...`）或黑名单（拦 `rm/curl|sh/...`）
- 高危命令==弹窗确认==（[[Agent 工程实践#Human-in-the-Loop]]）

详见 [[执行与调试工具]]。

### 2.4 Git 与协作类

==超越单文件，对整个项目结构和版本控制的操作==。

| 工具 | 作用 |
|------|------|
| ==`git_*`== | git 操作（status / diff / commit / push） |
| ==`create_project`== | 初始化新项目（脚手架） |
| ==`install_dependency`== | 装依赖（npm install / pip install） |
| ==`update_dependency`== | 升级依赖版本 |
| ==`refactor_rename`== | 全项目改名（变量/函数/文件） |

详见 [[Git与协作工具]]。

### 2.5 联网类

==访问代码库外的世界==。

| 工具 | 作用 | 底层 |
|------|------|-----|
| ==`web_search`== | 联网搜索 | Bing / Brave / Tavily / Google |
| ==`fetch_url`== | 读网页内容 | curl + HTML→Markdown 转换 |
| ==`read_documentation`== | 读官方文档 | Context7 / DevDocs |

==web_search 的工程难点==：搜索结果质量差异巨大——SEO 垃圾网页太多。==Tavily / Brave Search 是 AI 时代==专门优化的搜索 API（去除广告/低质内容）。

==安全难点==：联网工具是 Agent 最大的攻击面之一——LLM 输出的 URL 可被 Prompt Injection 控制，必须做 ==SSRF 防御==（协议白名单 / 内网屏蔽 / 重定向手动追 / 大小+频率限制）。详见 [[Agent 安全模型#八SSRF-防御联网工具的-agent-时代特殊攻击面]]。

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
- ==读文件== → ���置（所有人都要）
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

## 四、Tool / Command / Skill 三者关系

> [!info] ==本节是边界澄清==——详细机制见独立文档
> ==Skill 完整机制==（渐进式披露 / SKILL.md / 三层加载 / 与 MCP 的关系）→ [[Agent Skills 体系]]
> ==Command 实现==（三种风格 / 拦截机制 / 自定义命令） → [[Agent Skills 体系#Command 与 Skill 的边界]]

==这三个概念经常被混淆==——==层级清晰==：

| 抽象 | 触发方式 | 实现 | 谁决定怎么做 | 例子 |
|------|---------|------|----------|------|
| ==Tool== | LLM 主动调用（Function Calling） | 一段 Python 函数 | LLM | `read_file` / `grep` |
| ==Command== | ==用户敲 `/xxx`== | Python 函数 ==或== prompt 模板 | ==写死的逻辑== | `/index` / `/save` / `/compact` |
| ==Skill== | ==LLM 自主激活==（看上下文） | Markdown 决策手册 + 子工具 | ==LLM 看完手册自己决定== | "数据库迁移" / "code review" Skill |

==递进关系==：

```
Tool         ← 原子操作(read_file / grep / web_search)
 ↓ 被组合
Command      ← 用户主动调(`/index` / `/save`)         ← 给用户用
 ↓ 被组合
Skill        ← LLM 自主激活的决策手册                 ← 给 LLM 用
 ↓ 打包发行
Plugin       ← Skills + Commands 的发行单元
```

==关键澄清==：

- ==Tool 是最小积木==——原子操作
- ==Command == 用户敲的快捷指令==——按按钮就执行
- ==Skill ≠ "命令脚本"==——是==给 LLM 看的"专家手册"==。Skill 里==没有"先调 A 再调 B"==，只有"==遇到 X 场景考虑 Y 原则=="，==LLM 看完自己决定==怎么用 Tool 完成

==没有魔法==：

```
LLM 决策(Agent 智能从这里来)
   +
几十个原子 Tool(每个 5-50 行 Python)
   +
各种封装(Command / Skill / Plugin) ← 让 Tool 更易用
```

---

## 五、工具设计原则

==给"我自己想做一个 Coding Agent"或"我要写 MCP Server"的人==。

### 5.1 工具粒度：单一职责

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

### 5.2 description 写法：决定 LLM 用得对不对

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

### 5.3 参数设计

| 设计点 | 推荐 |
|-------|------|
| 路径 | ==绝对路径优先==（避免 cwd 不确定）；相对路径必须明确"相对哪里" |
| 必填 vs 可选 | ==能必填就必填==（required），降低 LLM 漏填风险 |
| 默认值 | 有默认值就别让 LLM 决定（如 `top_k=5` 别让它每次都选） |
| 枚举值 | 能用 enum 就别用 free string |
| 范围 | 用 `minimum` / `maximum` 限制数值范围 |

### 5.4 输出格式

==给 LLM 看的输出，不是给人看的==——需要：

- ==结构化优先==：能 JSON 就别纯文本
- ==截断策略==：超长输出自动截断 + 提示"还有 N 行，用 read_file 的 offset 继续"
- ==错误格式统一==：`ERROR: <type>: <message>`，方便 LLM 解析后决定走哪条 [[Agent 工程实践#Agent 工具调用失败的四层决策策略]]
- ==行信息要给==：返回的代码片段要带行号 + 文件路径，==方便 LLM 后续 edit==

### 5.5 工具不是越多越好

==Stripe 的 Minions 实战经验==（见 [[Harness Engineering#六、企业级实战经验]]）：
- 工具数量超过 ==15 个==，LLM 选错工具的概率显著上升
- 工具描述总长度超过 ==4K tokens==，模型容易"看不见"末尾的工具
- ==推荐==：单 Agent 工具不超过 10 个；多 Agent 时每个 Agent 工具更少（5-7 个）

### 5.6 工具集 token 管理

==工具描述不是免费的==——每次 LLM 调用都要把 `tools` 参数完整发送，==不管当前任务用不用这些工具==。

#### 具体成本

| 场景 | 工具数 | 估算 token |
|------|--------|-----------|
| 内置工具（9 个） | 9 | ~1,500 |
| 内置 + 1 个 MCP server（20 工具） | 29 | ~5,000 |
| 内置 + 3 个 MCP server（60 工具） | 69 | ~12,000 |
| 内置 + 5 个 MCP server（100 工具） | 109 | ~20,000 |

==100 个工具 = 每轮白烧 20k tokens==——大部分工具当前任务根本用不到。

#### 三种解决方案

**方案一：工具集分组过滤（最常见）**

==根据当前任务类型，只注入相关工具子集==——这是生产 Coding Agent 最普遍的做法。

**方案二：工具描述截断**

==MCP server 返回的 schema 必须清洗==——description 超 500 字符截断，`$ref` 内联展开，`anyOf` 简化。这是 MCP→FC 转换层的标配，不是可选项。详见 [[MCP 协议#42-schema-清洗从-mcp-server-到-llm-tools-的必踩坑]]。

**方案三：渐进式工具披露（高级）**

==只注入工具名 + 一句话描述的索引==，LLM 需要时调 `get_tool_schema(name)` 拿完整 schema。==适合工具极多（>50）的场景==。

---

## 六、主流 Coding Agent 工具集对比

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

### 6.1 Claude Code 的"无索引模式"

==Claude Code 不预建代码向量索引==——靠 grep + read_file 现场检索。原因：
1. 索引建得慢、过期快（代码变化频繁）
2. Claude 的 ==1M context== 能直接装下中等代码库，==检索精度比向量召回更高==
3. ==grep 是确定性的==，索引检索是概率性的——前者更可靠

==但代价==：每次都要现搜，==大代码库（百万行级）会慢==。Cursor 用预建索引在大库上更快，但小库优势不明显。==选型见== [[Code RAG#主流产品对比]]。

### 6.2 Aider 的极简哲学

Aider ==只用 git ls-files + cat==——没有 grep 工具、没有 codebase 检索。==哲学==：让人决定看哪些文件，AI 只负责改。==权限边界更清晰==但==自主性更弱==。

---

## 七、工具调用的可靠性

==LLM 是概率系统，工具调用有失败率是常态==——不是 bug 是事实。==完整可靠性方案==分散在三处：

- ==协议层==（schema 校验 / JSON 解析失败 / tool_call_id 不匹配）→ [[Function Calling#八、协议层的可靠性]]
- ==决策层==（L1 重试 / L2 参数修正 / L3 换工具 / L4 换策略）→ [[Agent 可靠性设计#三、工具调用失败的四层决策策略]]
- ==权限层==（工具白名单 / 参数粒度 / 频率粒度 / HITL）→ [[Agent 安全模型#五、工具权限控制]]

---

## 分类详解

- [[文件操作工具]] — Read / Write / Edit / NotebookEdit 详细说明
- [[代码分析工具]] — LSP / Grep / Search / AST 底层实现
- [[执行与调试工具]] — Bash / 测试 / 性能分析工具
- [[Git与协作工具]] — Git / PR / 代码审查流程

---

## 相关链接

- [[Function Calling]] — 工具调用协议层
- [[MCP 协议]] — 工具标准化接入协议
- [[Agent Skills 体系]] — Skill / Command 详细机制
- [[Agent 安全模型]] — SSRF 防御 / 工具权限 / HITL
- [[Agent 可靠性设计]] — 工具失败处理 / Fallback
- [[Code RAG]] — `codebase_search` 工具的底层实现
- [[Harness Engineering]] — 工具的注册/拦截/执行机制
- [[AI 编程工具]] — Claude Code / Cursor / Codex 产品对比
- [[ReAct 与 Harness 实现]] — 60 行 ReAct + 工具识别两种方式
