# LLM 单元 — 修复日志（阶段1）

> 修复日期：2026-06-01
> 负责文件夹：`wiki/LLM/`（只改本文件夹；未碰 `LLM索引_MOC.md`、未碰 `wiki/面试题目.md`）
> 依据：`wiki审计/领域报告/LLM.md` + `wiki-管理方法论.md`

---

## 一、改了哪些文件 / 各做了什么

### 1. `Function Calling.md`（650 行 → 483 行，9 H2 → 8 H2）
- **拆分**：把原 §三 下的多模态三节（Image Tool Result / 用户输入图片 / 历史 Image Payload 裁剪，约 169 行）整段移出，新建 `Function Calling 多模态.md`。原位置在 §三 末尾留下 `[!info]` 占位 callout 指向新文件（不是"已迁移别域"占位，因为是本文件夹内拆分）。
- **合并**：原 §五（多轮拼接）+ §六（并行调用）合并为新 §五「多轮工具调用与并行调用」，并行调用降为该节下的 H3。
- **重新编号**：原 §七 厂商差异 → §六；原 §八 协议层可靠性 → §七（含 8.1-8.4 → 7.1-7.4）。
- **小修**：§七.4 正文里 "详见 §二.2" 改为 "详见 §二"（§二无 .2 编号）。
- 顶部摘要 callout 增加一句指向 `[[Function Calling 多模态]]`。
- frontmatter `last_reviewed` 2026-05-25 → 2026-06-01。
- **未改**：所有跨文件夹 wikilink 一律保持原文（含坏链），交阶段2统一改（见第四节）。

### 2. `Function Calling 多模态.md`（新建，195 行，4 H2）
- frontmatter：module=LLM，tags=[LLM, Function Calling, 多模态, Vision, Browser MCP, Computer Use]，difficulty=hard，last_reviewed=2026-06-01。
- 内容：从 Function Calling.md 原样搬来的三节，重排为 §一 Image Tool Result / §二 用户输入图片 / §三 历史 Image Payload 裁剪 + 相关链接。
- 内部保留了原有的跨文件夹链接 `[[长上下文工程#5 MCP Resources ...]]`（坏锚，交阶段2）。

### 3. `Harness Engineering.md`（338 行 → 342 行，12 H2 → 8 H2）
- **核心修复**：消灭非法编号 `## 八-A`。把尾部 5 个顶层小节（§七 会被淘汰吗 / §八 DESIGN.md / §八-A Prompt 分层 / §九 落地路径 / §十 相关开源项目）合并为单个 `## 七、Harness 的演进与工程化落地`，原 5 个标题降为该节下的 H3，其各自子标题（PromptAssembler 实现、为什么需要分层、组装顺序、三层文件覆盖、关键设计原则、DeerFlow/GitNexus/claude-code-from-scratch）相应降为 H4。
- 新 §七 顶部加 `[!info]` 概述 callout。
- §一-§六 **完全未动**（这些小节被 Agent/RAG/面试题目 大量引用，保持锚点稳定）。
- **未改**：`gpt-5.2-codex`（审计标记疑似笔误，但不确定，且属引用的实验数据，不擅改）；所有跨文件夹链接保持原文。

### 4. `LLM 基础与训练.md`（505 行 → 510 行）
- 在 H1 与 `---` 之间插入 `> [!info] 本文导览` 渐进式摘要 callout（>400 行规范要求）。
- frontmatter `last_reviewed` 2026-05-09 → 2026-06-01。
- 知识点未改（审计判定内容近乎无需返工；GQA 等 P2 加分项本阶段不做）。

### 5. `Prompt Engineering.md`
- 无 P1 必改项，未改动（P2 的 500 tokens 偏保守、OutputParser 补充均为可选，不在本阶段范围）。

---

## 二、拆分清单

| 旧文件 | 新建文件 | 装什么内容 |
|---|---|---|
| `Function Calling.md` §三 多模态三节（约 169 行） | `Function Calling 多模态.md` | Image Tool Result（三家厂商格式 / text fallback / Token 计费陷阱）、用户输入图片、历史 Image Payload 裁剪 |

---

## 三、锚点变更（阶段2全局改链要用）

### 3.1 `Function Calling.md` 内部锚点变化

| 旧锚点 | 新锚点 | 说明 |
|---|---|---|
| `#六、并行调用` | `#五、多轮工具调用与并行调用`（并行调用降为 H3，Obsidian 子标题锚点 `#并行调用` 仍可用） | §五+§六 合并 |
| `#七、厂商差异` | `#六、厂商差异` | 编号顺延 |
| `#八、协议层的可靠性` | `#七、协议层的可靠性` | 编号顺延 |
| `#image-tool-result多模态返回`（原在本文件 §三 下） | 移至新文件 `[[Function Calling 多模态#一、Image Tool Result：多模态返回]]` | 内容已拆出 |

### 3.2 `Harness Engineering.md` 内部锚点变化

| 旧锚点 | 新锚点 | 说明 |
|---|---|---|
| `#七、Harness 会被淘汰吗？` | `#七、Harness 的演进与工程化落地` → `#Harness 会被淘汰吗？`（H3） | 合并降级 |
| `#八、DESIGN.md：Harness 在 UI 层面的实践` | `#DESIGN.md：Harness 在 UI 层面的实践`（H3，去掉"八、"前缀） | 合并降级 |
| `#八-A、Prompt 分层架构：System Prompt 的工程化管理` | `#Prompt 分层架构：System Prompt 的工程化管理`（H3，消灭非法 八-A 编号） | 合并降级 |
| `#九、落地路径` | `#落地路径`（H3） | 合并降级 |
| `#十、相关开源项目` | `#相关开源项目`（H3） | 合并降级 |
| `#GitNexus：代码库知识图谱引擎`（原 H3） | 仍是 `#GitNexus：代码库知识图谱引擎`（降为 H4，**标题文本不变，锚点不变**） | 安全 |

---

## 四、留给阶段2的链接问题（跨文件夹坏链 / 锚点漂移）

### 4.1 因本次拆分/重排，外部文件需更新的链接（新增）

| 源文件:行 | 现链接 | 应指向 |
|---|---|---|
| `Agent/ReAct 与 Harness 实现.md:351` | `[[Function Calling#六、并行调用]]` | `[[Function Calling#五、多轮工具调用与并行调用]]`（或 `#并行调用`） |
| `Agent/模型路由策略.md:14` | `[[Function Calling#七、厂商差异]]` | `[[Function Calling#六、厂商差异]]` |
| `Agent/模型路由策略.md:261` | `[[Function Calling#七、厂商差异]]` | `[[Function Calling#六、厂商差异]]` |
| `Agent/Coding Agent 工具集.md:729` | `[[Function Calling#八、协议层的可靠性]]` | `[[Function Calling#七、协议层的可靠性]]` |
| `Agent/Coding Agent 工具集.md:193` | `[[Function Calling#image-tool-result多模态返回]]` | `[[Function Calling 多模态#一、Image Tool Result：多模态返回]]`（内容已拆出到新文件） |
| `Agent/AI 编程工具.md:131` | `[[LLM/Harness Engineering#十、相关开源项目]]` | `[[LLM/Harness Engineering#相关开源项目]]`（已降为 H3，去前缀） |

> 注：`Agent/Coding Agent 工具集.md:561`→`#二、请求结构...`、`Agent/Agent 可靠性设计.md:111`→`#三、四种消息角色` 这两条指向的 §二/§三 标题未变，**仍有效，无需改**。

### 4.2 审计报告原有的跨文件夹坏链（本文件夹内的源，未改，待阶段2修）

| 源文件:行 | 现链接 | 建议指向 |
|---|---|---|
| `LLM/Harness Engineering.md:88` | `[[Agent 核心概念#二、ReAct 框架与推理模式]]` | 实际标题是 `#二、推理模式与 Harness 控制流` |
| `LLM/Harness Engineering.md:210` | `[[长上下文工程#1-prompt-caching]]` | 实际是 `#一、Prompt Caching：Coding Agent 的成本第一杠杆`（锚点漂移） |
| `LLM/Harness Engineering.md:336`（相关链接） | `[[Prompt与Harness]]` | 文件不存在（孤儿链），建议改 `[[Prompt Engineering]]` 或删除 |
| `LLM/Function Calling.md` §七 + 相关链接 | `[[Agent 工程实践#八-B、Agent 可靠性设计（实战设计题）]]` | `Agent 工程实践.md` 只有 5 个 H2 无此锚点；内容已迁出到 `Agent 可靠性设计.md`，应改指 `[[Agent 可靠性设计]]`（本次保持原文，交阶段2） |
| `LLM/Function Calling.md` 相关链接 | `[[Agent 核心概念#四、MCP 协议]]` | `Agent 核心概念.md` 无此锚点；应改 `[[MCP 协议]]`（保持原文，交阶段2） |
| `LLM/Function Calling 多模态.md` §一末 | `[[长上下文工程#5 MCP Resources 在 Long Context 下的索引注入]]` | 实际是 `#五、MCP Resources ...`（中文序号，锚点漂移） |
| `LLM/LLM 基础与训练.md:247` | `[[LLM/RAG检索策略#题目：三代 Embedding 算法是怎么演进的？]]` | 路径多了 `LLM/`，且 `RAG/RAG检索策略.md` 无此节；建议指 `[[RAG向量与Embedding]]` |
| `LLM/LLM 基础与训练.md`（相关链接） | `[[Prompt与Harness]]` | 孤儿链，同上 |

> `[[Prompt与Harness]]` 孤儿链全 wiki 共 5 处引用（本文件夹 2 处 + `面试题目.md` 2 处 + `Baize项目/Prompt设计.md` 1 处），均指向不存在文件，建议阶段2统一改为 `[[LLM/Prompt Engineering]]`。

---

## 五、暂存清单

无。本单元的拆分内容（多模态）属于 LLM 域自身，直接在本文件夹内新建 `Function Calling 多模态.md`，未涉及跨域搬迁，无需写暂存文件。

---

## 六、本阶段完成度

- **P1-1**（Function Calling 650 行拆分 + 顶层 ≤8）：✅ 已修。483 行 / 8 H2，多模态拆出 195 行新文件，§五+§六 合并。
- **P1-3**（Harness 12 H2 超 8 + 非法 八-A 编号）：✅ 已修。8 H2，尾部 5 节合并为 §七，非法 八-A 消灭。
- **P1-4**（LLM 基础缺顶部摘要 callout）：✅ 已修。
- **P1-5**（LLM 基础 last_reviewed 偏老）：✅ 已更新为 2026-06-01（Function Calling 同步更新）。
- **P1-2**（8 处坏锚点 / 坏链）：⏸ 按铁律不在本阶段改，全部记录到第四节，交阶段2全局改链 agent。
- **P2 全部**（GQA 补强、500 tokens、高亮密度、gpt-5.2-codex 疑似笔误等）：未做（加分项/审美项/不确定项，超出 P0+P1 范围）。

**P1：实质结构类 4 条已修（P1-1/3/4/5）；P1-2 链接类按规则只记录不改（共记录 14 条：6 条因本次重排新增 + 8 条审计原有）。P0：本单元无。**
