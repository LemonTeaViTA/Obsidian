# 领域审计报告 · Agent-工具与协议

> 审计单元：Agent 工具与协议（MCP / 工具集 / LSP / TUI / AI 编程工具 / MOC）
> 审计性质：只读审计，未修改任何 wiki 原文件
> 审计日期：2026-06-01
> 审计视角：① 知识库管理专家（Diátaxis / SSoT / 内容边界 / 求职对齐）② Coding Agent 工具与协议领域知识点专家

---

## 一、单元概览

| # | 文件 | 行数 | 顶层小节 | 健康度 | 主要问题 |
|---|------|------|---------|--------|---------|
| 1 | MCP 协议.md | 927 | 11 | 🔴 | >800 行红旗 + 顶层小节超 8 + 缺顶部渐进式摘要 callout + 示例瑕疵 |
| 2 | AI 编程工具.md | 279 | 8 | 🔴 | Diátaxis 混 ≥2 类（产品对比 + 知识管理方法论）+ 营销味特性清单 + 坏锚 |
| 3 | Coding Agent 工具集.md | 745 | 8 | 🟡 | >600 行 + 内部坏锚 #4.8 + isolated/shared 与 MCP 轻度重复 |
| 4 | LSP 与代码诊断.md | 665 | 10 | 🟡 | >600 行 + 顶层小节超 8 + Reflection 锚文本失配（反复出现）|
| 5 | Coding Agent TUI 设计.md | 550 | 8 | 🟡 | 多处 reorg 失配坏锚（指向 Agent 工程实践）+ >400 行缺渐进式摘要 |
| 6 | Agent索引_MOC.md | 196 | — | 🟡 | MOC 覆盖缺口：Agent 工程实践.md 未被收录 |

**单元整体健康度：🔴 RED**（含 2 个红旗：MCP >800 行、AI 编程工具 Diátaxis ≥2 类）

说明：纯机械项（行数阈值、frontmatter 字段、坏链全量校验）由全局 agent 统一处理，本报告聚焦判断类问题，机械项仅"顺手记录"。本单元 6 个文件 frontmatter 四字段齐全、last_reviewed 均在 6 个月内（2026-05-25 ~ 2026-05-31）、零 UTF-8 乱码。

---

## 二、逐条问题

### 🔴 P1-01 · AI 编程工具.md Diátaxis 类型混杂 + 内容边界越界（§8）
- **文件**：AI 编程工具.md
- **位置**：§8「AI 辅助知识管理方法论」（line 242-274），叠加 §1-2（Explanation/产品对比）、§7（Reference 概念体系）
- **问题**：单篇同时承载三类——产品对比（Explanation）、Claude Code 概念体系（Reference）、知识管理方法论（"两个大脑" / 知识代谢循环 / 三层架构，属 How-to/方法论）。其中 §8 知识管理方法论与"AI 编程工具"主题**完全不相关**——这是 Karpathy/Obsidian 知识库管理论的内容，应归入 `wiki-管理方法论.md` 或独立方法论文档，不该塞进 Coding Agent 工具对比页。
- **修复建议**：§8 整体迁出到管理方法论文档；本文收敛为单一类型（产品对比 Explanation + 概念体系 Reference 各自≤1.5 类）。

### 🔴 P1-02 · MCP 协议.md 体量超红旗线 + 结构超规
- **文件**：MCP 协议.md
- **位置**：全文 927 行；顶层 `##` 小节 11 个
- **问题**：>800 行触发红旗；顶层小节 11 个 > 规则上限 8。内容本身高度聚焦 MCP（无明显跑题），但单文承载"是什么 / 三层架构 / 写 Server / Host 集成层 / 生态 / 安全 / 与 FC 关系 / 与 A2A 区别 / 生产实战 / 行业现状"十一大块，过载。
- **修复建议**：拆分。建议把 §五（生态主流 Server，含 5.4 浏览器自动化/CDP/isolated-shared 这一大块）与 §六（安全模型）析出为子文档，主文保留协议核心（是什么 / 架构 / Host 集成层 / 与 FC 关系）。拆后顶层小节回落到 ≤8。

### 🔴 P1-03 · 跨文档 reorg 失配坏锚（多文件，导航完整性受损）
- **文件**：Coding Agent TUI 设计.md、Coding Agent 工具集.md、AI 编程工具.md
- **位置与实证**：
  - TUI line 13 / 546：`[[Agent 工程实践#三、CLI 设计]]` —— 实际 `Agent 工程实践.md` 的 §三是「Agent 2025-2026 新趋势」，**CLI 设计是 §一**。锚错位。
  - TUI line 331 / 547：`[[Agent 工程实践#hitl-工具读写粒度细化]]` —— `Agent 工程实践.md` 中**无此标题**；HITL 内容已迁至 `Agent 安全模型.md`。
  - 工具集 line 104 / 138 / 340：`[[Agent 工程实践#Human-in-the-Loop]]` / `#工具权限控制...` —— 同样已迁到 `Agent 安全模型.md`，原锚失效。
  - AI 编程工具 line 198：`[[Agent 工程实践#三、CLI 设计]]` —— 同 TUI，锚错位。
- **问题**：`Agent 工程实践.md` 经历过拆分/重构（顶部就有"导航：已拆分的独立文档"小节），但多篇引用方未跟随更新——CLI/HITL 章节早已搬家。这是 reorg 后的链接腐烂，属判断类（内容搬迁 + 引用未同步），不只是拼写。
- **修复建议**：全量替换：CLI 锚 → `#一、CLI 设计`；HITL 锚 → `[[Agent 安全模型#...]]` 对应小节（如 CommandGuard / HITL 三档授权）。

### 🟡 P2-04 · Coding Agent 工具集.md 内部坏锚 #4.8
- **文件**：Coding Agent 工具集.md
- **位置**：line 163 `详见 [[#4.8 联网工具的 SSRF 防御]]`
- **问题**：§4.8 实际标题是「MCP 动态工具：运行时发现 + JSON-RPC 转发」；SSRF 内容在 §4.7 末尾的 `[!warning]` callout 里，**不存在"4.8 联网工具的 SSRF 防御"这个小节**。锚指向错误。
- **修复建议**：改为指向 §4.7 的 SSRF callout，或直接外链 `[[Agent 安全模型#...SSRF...]]`（line 418 已有正确外链可复用）。

### 🟡 P2-05 · AI 编程工具.md 两处坏锚
- **文件**：AI 编程工具.md
- **位置与实证**：
  - line 196：`[[Agent 核心概念#四、MCP 协议]]` —— `Agent 核心概念.md` 只有 §一/二/三，**无 §四**，无 MCP 小节。
  - line 208：`[[Coding Agent 工具集#五、Commands / Skills:Tool 的上层封装]]` —— 工具集 §五实际标题已改名为「五、Tool / Command / Skill 三者关系」，旧锚失配。
- **修复建议**：line 196 改为 `[[MCP 协议]]`；line 208 改为 `[[Coding Agent 工具集#五、Tool / Command / Skill 三者关系]]`。

### 🟡 P2-06 · LSP 与代码诊断.md Reflection 锚文本失配（反复出现）
- **文件**：LSP 与代码诊断.md（及 TUI/工具集相关链接区间接涉及）
- **位置**：line 14 / 78 / 395 / 409 / 661 等多处 `[[Reflection 实现#3.3 外部验证器]]`
- **问题**：`Reflection 实现.md` 实际标题是 `### 3.3 外部验证器（最可靠）`（带全角括号后缀）。Obsidian anchor 需与标题精确一致，缺括号后缀会断链。本文是高频引用（核心论点"诊断回注=外部验证器落地"全靠它），断链影响较大。
- **修复建议**：统一改为 `[[Reflection 实现#3.3 外部验证器（最可靠）]]`，或在 Reflection 侧把标题去掉括号后缀以稳定 anchor。

### 🟡 P2-07 · LSP 顶层小节超规 + 文档偏长
- **文件**：LSP 与代码诊断.md
- **位置**：665 行；顶层 `##` 10 个（一~九 + 相关链接）
- **问题**：>600 行黄旗；顶层小节 10 > 8。§八「与 Reflection / Generator-Evaluator 的关系」与 §五 5.4、§九认知 1 在 LSP-vs-验证器主题上有内部回环重复。
- **修复建议**：§八与 §五 5.4 合并精简（同一论点不必三处展开）；§九面试要点保留即可。

### 🟡 P2-08 · 域内 SSoT 轻度重复：isolated vs shared 浏览器模式
- **文件**：MCP 协议.md §5.4（line 608-661，完整：模式表 + 登录态三方案 + Tab 所有权）vs Coding Agent 工具集.md §2.5「浏览器模式自适应」（line 195-215，含 browser_connect 流程 + isolated 默认 + 切换副作用）
- **问题**：两处都对 isolated/shared 做了**带流程/代码的实质讲解**（各 >20 行）。工具集 line 215 虽已 callout-链接回 MCP，但前面 line 195-214 仍重复展开了 isolated 默认/切 shared 的机制。轻度违反 SSoT（同概念两处各 >50 行的硬红线未完全触发，但接近）。
- **修复建议**：MCP §5.4 作为单点全文权威；工具集 §2.5 收敛为"何时触发 fallback 到浏览器 MCP"的决策视角，isolated/shared 机制细节仅留一句 callout 链接。

### 🟡 P2-09 · Agent��引_MOC.md 覆盖缺口
- **文件**：Agent索引_MOC.md
- **问题**：Agent 目录下 `Agent 工程实践.md` 真实存在且被多篇引用，但 MOC 全文 grep 不到「工程实践」——**未被任何导航小节或学习路径收录**，构成孤儿页（从 MOC 视角）。
- **修复建议**：在 §2 推理框架或 §9 部署形态附近补一条 `[[Agent 工程实践]]` 入口（CLI 设计 / LangChain / 2025-2026 趋势）。

### 🟡 P2-10 · >400 行文档缺顶部渐进式摘要 callout
- **文件**：MCP 协议.md（927 行）、Coding Agent TUI 设计.md（550 行）
- **问题**：方法论要求 >400 行文档应有顶部渐进式摘要 callout。工具集、LSP 都有 `[!tip] 速览（一分钟读完）`，但 MCP 与 TUI 仅有 3 行普通 blockquote 引言，无结构化速览 callout。
- **修复建议**：MCP/TUI 顶部补 `[!tip] 速览` callout（核心认知 + 章节地图），与同单元其他文档对齐。

### 🟡 P2-11 · 营销味 / 难核实的产品特性清单
- **文件**：AI 编程工具.md
- **位置**：§3「2026 Q1 新特性」（Remote Control / /loop / Multi-Agent 并行 / Computer Use）、"23 阶段递进式架构"（line 118）；§5 Cursor「五代架构演进」「最多 8 个 Agent」「Automations」
- **问题**：偏产品 changelog/营销文案，且部分具体数字（"23 阶段""8 个 Agent"）难核实、易过时。内容边界规则不建议营销文案进 wiki 主文。
- **修复建议**：降级为"代表性能力方向"的概括描述，去掉精确版本号/阶段数；或迁至 `主流 Coding Agent 实现对比/` 子目录（那里强调"数据可验证、附文件路径"）。

---

## 三、领域知识点准确性评价

### 整体评价：技术准确性高，硬核内容扎实

**LSP 与代码诊断.md（强）**
- JSON-RPC 2.0 / stdio 默认 / `publishDiagnostics` 为 Server 主动推送 / severity 1-4 枚举 / M×N→M+N 解耦——全部准确。
- "MCP 借鉴 LSP（2016→2024，差 8 年）"的论断成立且有洞察。
- 主流 server 生态表（JDT LS / rust-analyzer / pyright / gopls / clangd / sourcekit-lsp / Roslyn LSP）与 2026 现状吻合。
- 诊断回注（post-edit 异步→pending 队列→下一轮注入→容量上限 20+优先级排序）是真实生产模式，面试深度足够。
- 小瑕疵：§2.4 最简 Client 示例发完 `initialize` 后未发 `notifications/initialized` 就监听（演示可接受，但严格协议需补握手第三步）；与 §2.3 流程图自相比少了一步。

**MCP 协议.md（强，但有 2 处示例瑕疵）**
- 三层架构 / 三种 transport（stdio 80%+）/ initialize 握手三步 / protocolVersion `2025-06-18` 格式 / Streamable HTTP 单 endpoint ���代老双 endpoint SSE / `mcp__{server}__{tool}` 命名空间 / Schema 清洗（$ref 内联、anyOf 简化、description 截断）/ notifications 热更 / CDP 底层——均准确且深入，明显高于一般面试资料。
- **瑕疵 a（line 132）**：`streamablehttp_client("https://mcp.example.com/sse")` 用了 `/sse` 路径，与全文反复强调的"Streamable HTTP 单 endpoint `POST /mcp`、`/sse` 是已废弃老方案"自相矛盾。应改为 `/mcp`。
- **瑕疵 b（line 199-201）**：`asyncio.run(stdio_server(app))` 与真实 MCP Python SDK 签名不符——SDK 实际为 `async with stdio_server() as (read, write): await app.run(read, write, app.create_initialization_options())`。示例过度简化到不可运行。
- A2A 对比、安全三关、凭证脱敏（key 名 + value 正则 + 递归 + result 脱敏）准确且实战。

**Coding Agent 工具集.md（强）**
- 内置 vs MCP 动态、五大分类、ripgrep（比 grep 快≈10x、读 .gitignore）、codebase_search 唯一"重"工具、fetch_url 分级 fallback、SSRF、工具集 token 管理（分组过滤 / allowedTools 白名单 / 渐进式披露 / prompt cache 关系）——全部正确，且求职方向（Java + Agent）友好：MVP 用 JavaParser 的示例贴合 Java 背景。
- Claude Code 无索引模式 vs Cursor 预建索引的对比准确。

**Coding Agent TUI 设计.md（良）**
- Renderer 抽象 / inline·lanterna·plain 三形态 / JLine Status / 协作式 cancel / NO_COLOR 行业标准 / 自动降级——工程视角扎实，Java 栈（JLine/lanterna/lsp4j 系）对齐求职方向。
- 小瑕疵：line 460 `TERM=dumb` 描述为"标准 POSIX 信号"——表述错误，TERM 是 terminfo 终端类型，非"信号"。line 462 `noco lor.org` 有空格断字（应为 no-color.org）。

**AI 编程工具.md（弱，本单元最薄）**
- §1-2 形态光谱、CLI 六大优势、两条赛道判断——观点清晰、准确。
- 但 §3-5 产品特性偏 changelog/营销、部分数字难核实；§7 概念体系与工具集/Skills 体系重叠；§8 知识管理方法论完全跑题。深度与其余 5 篇不在一个量级。

### 知识点遗漏（面试增益，非缺陷）
- LSP：可补一句 LSP `position` 是 **UTF-16 code unit 偏移**（跨语言常见踩坑），及 pull-model diagnostics（`textDocument/diagnostic`，3.17 新增，与 push model 并存）。
- MCP：可补 2025 引入的 **OAuth 2.1 授权框架**（远程 server 鉴权），当前安全章偏本地进程视角。

---

## 四、本单元小结

本单元 6 篇覆盖 Coding Agent 工具与协议链路完整（FC↔MCP↔LSP↔工具集↔TUI↔产品），**领域知识点准确性整体很高、面试深度足够**，MCP/LSP/工具集三篇是同类资料中的上乘水准，且贴合 Java + Agent 求职方向。

主要问题集中在**结构与链接完整性**，而非知识错误：
- 2 个红旗：MCP 协议 927 行需拆分；AI 编程工具 Diátaxis 混杂 + §8 跑题需迁出。
- 突出系统性问题：`Agent 工程实践.md` 拆分重构后，**多篇引用方的锚未同步更新**（CLI / HITL 章节已搬家），叠加 Reflection 锚文本失配、工具集 #4.8 内部坏锚、AI 编程工具两处坏锚——构成一组"reorg 后链接腐烂"，建议作为一个批次集中修复。
- isolated/shared 浏览器模式在 MCP 与工具集两处实质重复，建议按 SSoT 单点保留。
- MOC 漏收 `Agent 工程实践.md`，需补入口。

修复优先级：先批量修锚（P1-03 / P2-04/05/06）恢复导航完整性 → 再拆 MCP、迁 AI 编程工具 §8（红旗）→ 最后收敛 SSoT 重复与补渐进式摘要。
