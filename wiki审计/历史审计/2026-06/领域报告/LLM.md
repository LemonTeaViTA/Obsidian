# LLM 单元审计报告

> 审计目标目录：`wiki/LLM/`
> 审计日期：2026-06-01
> 审计依据：`wiki-管理方法论.md` + `QUALITY_CHECKLIST.md`
> 视角：① 知识库管理专家  ② 大模型基础（训练 / Prompt / Function Calling / Harness）领域专家

---

## 一、单元概览

| 文件 | 行数 | 顶层 ## | last_reviewed | 健康度 | 主要问题 |
|---|---|---|---|---|---|
| `LLM索引_MOC.md` | 69 | 3 | 2026-05-28 | 🟢 | 入口 MOC 清晰，无问题 |
| `Prompt Engineering.md` | 142 | 3 | 2026-05-25 | 🟢 | 1 个坏链；2026 现状部分写得好 |
| `Harness Engineering.md` | 338 | **12** | 2026-05-29 | 🟡 | 顶层小节超 8 个（含 "八-A"）；多处坏锚点；与 Agent 单元存在中度内容重叠 |
| `Function Calling.md` | 650 | **9** | 2026-05-25 | 🔴 | 行数 ≥ 600（650）；顶层小节 9 个；缺顶部渐进式摘要；多个坏锚点；"用户输入图片 / 历史图片裁剪" 内容边界值得讨论 |
| `LLM 基础与训练.md` | 505 | 7 | 2026-05-09 | 🟡 | 接近 600 行临界；缺顶部摘要 callout（>400 行规范）；`last_reviewed` 已超 3 个月偏老；与 `RAG检索策略` 之间有一处坏链 |

**单元整体：🟡（无 SSoT 级 P0，但有 1 个文件 650 行触发黄旗 + 多处坏锚点）**

文件数：**5**
红旗：0（无 >800 行、无 Diátaxis ≥2 类、无 SSoT 同概念 50+ 行重复）
黄旗：5（详见下文 P1）

---

## 二、逐条问题（按严重度排序）

### P0（无）

本单元未发现 SSoT 级违规、>800 行文件或 Diátaxis 严重混杂。

---

### P1 — 应纳入下一轮整改

#### P1-1【内容边界 / Diátaxis】`Function Calling.md` 650 行，触及行数黄旗
- 文件：`wiki/LLM/Function Calling.md`
- 现象：650 行，**触发 >600 黄旗**；顶层 9 个 ## 小节（规则上限 8）。
- 类型分析：文档本身以 **Reference**（协议字段表）为主，但混入了较多 **How-to**（生产代码示例：`prune_image_history`、`normalize_tool_result`、Token 计费陷阱、并行 asyncio 写法）。尚未达到"≥2 类"红旗，但已经开始倾斜。
- 修复建议：
  - 把"§三 Image Tool Result / 用户输入图片 / 历史 Image Payload 裁剪"（约 175 行）整段独立成新文档 `Function Calling 多模态.md` 或合并到 `Agent/长上下文工程` 的多模态预算节（更对齐）。这一刀下去可降到 ~470 行 + 顶层 8 节。
  - §五 多轮拼接、§六 并行调用 可合并为"§五 消息序列与并行"，减少一个 H2。

#### P1-2【坏锚点 / wikilink 不指向真实标题】多处
机械校验类，但全部需要人工修复，集中列出：

| 出处文件 | 现链接 | 实际标题 / 建议 |
|---|---|---|
| `Harness Engineering.md` L88 | `[[Agent 核心概念#二、ReAct 框架与推理模式]]` | 实际是 `## 二、推理模式与 Harness 控制流` |
| `Harness Engineering.md` L210 | `[[长上下文工程#1-prompt-caching]]` | 实际是 `## 一、Prompt Caching:Coding Agent 的成本第一杠杆` |
| `Function Calling.md` L266 | `[[长上下文工程#5 MCP Resources 在 Long Context 下的索引注入]]` | 实际是 `## 五、MCP Resources ...`（中文序号） |
| `Function Calling.md` L594, L650 | `[[Agent 工程实践#八-B、Agent 可靠性设计（实战设计题）]]` | `Agent 工程实践.md` 只有 5 个 H2，**无此锚点**；该内容已迁出到 `Agent 可靠性设计.md`，应直接指向新文件 |
| `Function Calling.md` L649 | `[[Agent 核心概念#四、MCP 协议]]` | `Agent 核心概念.md` 没有 "## 四、MCP 协议"；直接链 `[[MCP 协议]]` 即可 |
| `LLM 基础与训练.md` L242 | `[[LLM/RAG检索策略#题目：三代 Embedding 算法是怎么演进的？]]` | 路径多了 `LLM/`；`RAG/RAG检索策略.md` 中无此小节；应指向 `[[RAG向量与Embedding]]`（该文件才讨论 Embedding 演进） |
| `Harness Engineering.md` L336 | `[[Prompt与Harness]]` | **文件不存在**，全 wiki 仅 4 处引用、均为孤儿链。建议改成 `[[Prompt Engineering]]` 或直接删除 |
| `LLM 基础与训练.md` L502 | `[[Prompt与Harness]]` | 同上 |
| `Prompt Engineering.md` L63 | `[[Agent 工程实践#Context Engineering 取代 Prompt Engineering]]` | ✅ 该锚点存在（H3），保留 |

**全单元共 8 处坏链 / 坏锚点。**

#### P1-3【顶层小节超 8】`Harness Engineering.md`
- 文件：`wiki/LLM/Harness Engineering.md`
- 现象：12 个 H2，明显超过 8 上限（含 `## 八` 与 `## 八-A`、`## 八-B` 编号——`八-A` 单独算一个顶层小节而不是子小节，破坏编号体系）。
- 修复建议：
  - `## 八-A、Prompt 分层架构` 重新编号为 `## 九、Prompt 分层架构：System Prompt 的工程化管理`，把原来的 `## 九、落地路径`、`## 十、相关开源项目` 顺延。
  - 或者把 `## 八、DESIGN.md` 与 `## 十、相关开源项目` 合并为 "## 八、相关项目与实践案例"，整体压缩到 8 个顶层小节以内。

#### P1-4【>400 行缺顶部渐进式摘要】`LLM 基础与训练.md`
- 文件：`wiki/LLM/LLM 基础与训练.md`（505 行）
- 现象：文件第 1-11 行直接是 frontmatter + `# LLM 基础与训练` + `---`，**没有 `> [!info]` 或 `> [!tip]` 形式的渐进式摘要 callout**（规范要求 >400 行必须有）。
- 对比：`Harness Engineering.md` 开头有 `> [!info] ==本文偏方法论 + 概念框架==` 的摘要；`Function Calling.md`、`Prompt Engineering.md` 开头有 `>` 引用块摘要——只有本文件缺。
- 修复建议：在第 11 行 `## 一、Transformer 架构` 前插入：
  ```
  > [!info] 本文导览
  > 覆盖 Transformer 架构 → 训练三阶段（Pre-train/SFT/RLHF/DPO） → LoRA/QLoRA 微调 → 推理优化（KV Cache/PagedAttention/MLA/量化/Flash Attention/部署框架） → MoE & Mamba 新架构 → Token 经济学。
  > 想了解 Prompt 工程见 [[Prompt Engineering]]，工程框架见 [[Harness Engineering]]。
  ```

#### P1-5【last_reviewed 偏老】`LLM 基础与训练.md`
- 文件：`wiki/LLM/LLM 基础与训练.md`
- 现象：`last_reviewed: 2026-05-09`，距今 (2026-06-01) 仅 23 天，未超 6 个月红线，**但本文是技术更新最快的领域**（DeepSeek-V4、GLM-5、Qwen3 的数字 2026 年内已多次更新）。建议下次审阅时同步核对：
  - 表格中 "DeepSeek-V4-Pro（2026年4月）1.6T / 49B / 1M" 等数据需验证（2026-06 视角）
  - "GLM-5（2026年2月）744B / 40B" 准确性
  - GPT-5 / Claude Sonnet 4.6 命名是否仍是 2026-06 现状

---

### P2 — 可选改进

#### P2-1【内容边界 / 求职对齐】`Function Calling.md` 多模态预算与历史裁剪偏深
- 这部分内容（Image Tool Result / 历史 Image Payload 裁剪 / Token 计费陷阱）非常详细，是 Browser MCP / Computer Use 场景的高质量笔记，**与 Java + Agent 求职方向高度对齐**——但放在 "Function Calling 协议" 标题下显得越界（标题暗示是协议层 reference，实际混入了 Agent 工程层的 how-to）。
- 建议：要么改顶部摘要明确"本文覆盖协议 + 多模态工程"；要么如 P1-1 所述拆出。

#### P2-2【SSoT 边缘观察】Harness 三代演进 / 控制流 与 Agent 单元的边界
- `Harness Engineering.md` §一（三代演进表）、§三（ReAct/Plan-and-Execute/Reflection 对比）与 `Agent/Agent 核心概念.md`、`Agent/ReAct 与 Harness 实现.md` 在概念上有重叠，但 **本文都做了引用收口（"详细对比与选型见 [[Agent 核心概念#二、推理模式与 Harness 控制流]]"）**，且每处展开都不超过 30 行——**未触发 SSoT 50+ 行 P0 规则**，定位为"方法论入口 + 引用收口"是合理的。继续观察即可，无需立即改。

#### P2-3【面试深度补强建议】`LLM 基础与训练.md` 缺几个高频面试点
- 缺 **GQA（Grouped Query Attention）** 介绍：Llama 2/3、Qwen2/3 等主流模型已普遍采用，是 KV Cache 节省的标准手段，介于 MHA 和 MQA 之间，比 MLA 更主流——本文只讲了 MLA，未提 GQA，是个**面试盲点**。
- 缺 **学习率调度（cosine schedule / warmup）、loss spike 处理**：训练相关面试常问。
- 缺 **数据混合比例 / RLHF reward hacking** 等训练数据工程内容。
- 推理章节缺 **prefix caching / Anthropic Prompt Caching** 的 API 层简介（在长上下文工程里有，但 LLM 基础里可加一句指向）。
- 这些是**可加分项**，不是缺陷——目前内容已足够深度。

#### P2-4【风格一致性】callout 使用比例
- 全单元 5 个文件 callout 使用规范，未发现连用 / 嵌套 / 非法类型——**通过**。
- 但 `Function Calling.md`、`Harness Engineering.md` 用 `==高亮==`（Obsidian highlight）密度偏高，会产生视觉疲劳。建议**关键术语保留高亮，纯强调语气改为 `**bold**`**。这是审美问题，不算违规。

---

## 三、领域知识点准确性评价

### 3.1 LLM 基础与训练
**总体：高质量，2026 年视角下基本准确，深度足够面试。**

✅ 正确且深入：
- Self-Attention 公式、`√dk` 缩放的解释（方差从 dk 拉回 1）正确清晰
- RoPE 的相对位置编码推导 `q'_m·k'_n = q_m^T R_(n-m) k_n` 正确
- LoRA 的 `W' = W + BA` 低秩分解、参数量从 d² 降到 2dr 正确
- DPO 损失函数公式正确，本质阐述清晰
- KV Cache 计算公式 `2 × 层数 × 头数 × 头维度 × 序列长度 × batch × 字节` 正确
- MLA 描述准确——明确指出是**端到端学到的低秩近似**而非数学意义无损，难得
- PagedAttention 解释准确（OS 虚拟内存类比 + 内存利用率 20-40% → 接近 100%）
- 推理框架对比表（vLLM / SGLang / TensorRT-LLM / Ollama）2026 现状准确

⚠️ 可以更准确：
- L156 "需要同时维护 4 个模型" + Reference Model — Actor / Critic / Reward / Ref **是 4 个模型**，但严格说 Ref 通常是冻结的 SFT 模型副本，显存上是 4 份。表述无误。
- L388 "RocketKV 等方法可压缩 KV Cache 400 倍" — 400× 是论文极限数据，工程实际通常 8-32×；可以加一句"工程可用约 8-32 倍"。
- L425 表格中 "V4-Pro（2026年4月）1.6T / 49B / 1M"、"GLM-5 744B / 40B"、"MiniMax 4M token 推理"：**需要在下次审阅时核对 2026-06 最新数据**（截至 2026-06-01 视角）。
- L391 "混合线性注意力" 描述较模糊，建议补一句代表模型（如 MiniMax 的 Lightning Attention 已在表格里——可联动）。

❌ 待修：
- L242 链接路径错误（`LLM/RAG检索策略` 应为 `RAG/`，且锚点不存在）
- 缺 GQA 介绍（详见 P2-3）

### 3.2 Prompt Engineering
**总体：精炼准确，2026 视角对齐良好。**

✅ 亮点：
- "2025-2026 现状：CoT 已被训练进模型" + "ToT 作为手动 Prompting 技巧已基本被淘汰" 的判断**非常正确**，避免了陈旧教程的陷阱。
- 现代推理模型范式表覆盖 Extended Thinking / Long CoT+RL / `<think>` / ReAct / Reflection / Planning 完整。
- Fine-tuning vs RAG vs Prompting 决策框架表清晰、可直接用于面试答题。

⚠️ 小问题：
- L67 "控制在 500 tokens 以内" 现在主流 system prompt 早已普遍 2-3k tokens（Claude Code、Cursor 都是几千 tokens），这个数字**偏保守**。可以改为 "保持精炼，常见 300-2000 tokens 区间，按角色复杂度调整"。
- L90 OutputParser 段提及 LangChain Pydantic，但 2026 年 OpenAI/Anthropic 都有原生结构化输出（`response_format` / Tool Use forcing），这里可以补一句对照。

### 3.3 Harness Engineering
**总体：方法论框架清晰，引用了 Mitchell Hashimoto / Nate B Jones / Anthropic 等一线观点，时效性强。**

✅ 亮点：
- 三代演进表（Prompt / Context / Harness）的时间标注（2022-2024 / 2025 / 2026）准确反映了行业认知演进。
- "六大组件 + 第七维控制流" 的拆解符合工程直觉。
- §八-A "Prompt 分层架构" 8 层组装顺序 + 三层文件覆盖是**高质量工程经验**，与 Claude Code / PaiCli 实际架构一致。
- §五 Generator-Evaluator 准确引用 Anthropic 经验。

⚠️ 小问题：
- L93 表格中 "Function Calling | LLM 协议层 | 让 LLM 输出'调什么工具'的结构化 JSON"——准确，但下一行"ReAct | Harness 控制流"在 Agent 单元里有更细的说明，应该把详细对比的 truth source 明确指向 Agent 单元，本文只留一句话定位（已经做到了，但锚点错——见 P1-2）。
- L111 "LangChain | 同一 gpt-5.2-codex" — `gpt-5.2-codex` 这个模型命名需要核对，可能笔误（行业惯例是 `gpt-5-codex`）。

### 3.4 Function Calling
**总体：协议层 reference 写得非常扎实，从请求体到响应字段到多轮拼接的"三个必踩坑"都覆盖到，是面试时讲清楚 Function Calling 协议的最佳素材。**

✅ 亮点：
- 协议四种角色 system/user/assistant/tool 拆解清晰
- `tool_call_id` 关联、`arguments` 仍是 JSON 字符串的反直觉点、`content` 和 `tool_calls` 是否互斥（少数模型可能并存）— 这些**坑都讲到了**，非常实用
- 多模态 tool result 三家厂商格式对比 + text fallback 三大场景论证 + Token 计费陷阱 — 工程化思考非常深
- 厂商差异表 OpenAI `parameters` vs Anthropic `input_schema` + Anthropic 返回 `block.input` 已经是 dict 不需 json.loads — 这是**容易被坑的细节**，记到了
- §八 协议层可靠性 4 小节 + 与执行层/决策层划清边界

⚠️ 小问题：
- L554 "claude-sonnet-4-6" — 2026-06 现状下命名核实
- L578 LiteLLM 模型列表"200+ 模型"，2026 年实际已 300+，可更新
- L640 "==description 写好比加重试更治本==" — 价值观判断正确

### 3.5 LLM索引_MOC
**简洁清晰，按"基础理论 / 工程框架 / 工具调用协议"三档分类合理。Agent / RAG 体系外链清晰。无需改动。**

---

## 四、本单元小结

### 健康度结论：🟡（黄）

**正面**：
- 5 篇文档**无 P0 红旗**（无 SSoT 50+ 行重复、无 >800 行、无 Diátaxis ≥2 类）
- 2026 年视角的知识更新**做得很好**（CoT 已训练进模型 / Harness Engineering 概念 / DeepSeek-V4 / MiniMax / SGLang 都已纳入），是整个 wiki 时效性最强的单元之一
- 与 Agent / RAG 单元的边界划得相对清晰（Harness Engineering 主动声明"方法论入口 + 工程落地在 Agent 目录"）
- 对 Java + Agent 求职方向高度对齐（Function Calling 协议、Harness 工程化、Prompt 分层是 Agent 工程师面试核心考点）

**需要改进**：
1. **`Function Calling.md` 650 行偏长** — 建议拆出"多模态预算"章节（约 175 行）合并到 `Agent/长上下文工程`，回到 ~470 行（P1-1）
2. **`Harness Engineering.md` 12 个 H2 超 8** — 重新编号 `八-A → 九`，并合并相邻小节（P1-3）
3. **8 处坏锚点 / 坏链** — 集中修复一轮（P1-2）：`Prompt与Harness` 孤儿链 2 处、`Agent 工程实践#八-B...` 2 处、`长上下文工程` 锚点 2 处、`Agent 核心概念#二/四` 2 处
4. **`LLM 基础与训练.md` 505 行缺顶部摘要 callout**（P1-4）
5. **`LLM 基础与训练.md` 建议补 GQA 介绍**（P2-3，加分项）

### 优先修复路径
按修复成本 / 收益排序：
1. 最快收益：批量修坏锚点（30 分钟）
2. 中等收益：加 LLM 基础顶部摘要 + 重新编号 Harness H2（1 小时）
3. 较大改造：拆 Function Calling 多模态章节（2 小时，需要谨慎搬迁，不能丢内容）

### 整体评价

> LLM 单元是本 wiki **知识深度最优**的子单元之一，2026 年视角下的领域准确性达到了"可直接用于面试自测"的水准。当前问题集中在**工程治理层**（锚点维护、单文档体量、顶层小节数），知识内容本身近乎不需要返工。
>
> 修完上述 5 处 P1 后，本单元可整体升级为 🟢 健康。
