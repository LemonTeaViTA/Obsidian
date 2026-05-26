---
module: LLM
tags: [LLM, Prompt Engineering, Few-shot, CoT, ToT]
difficulty: medium
last_reviewed: 2026-05-25
---

# Prompt Engineering

> Prompt Engineering：通过设计输入文本让 LLM 输出更好的结果。本文聚焦 ==Prompt 工程的核心技术==和 ==Fine-tuning vs RAG vs Prompting 的决策框架==。
>
> Prompt → Context → Harness 的三代演进见 [[Harness Engineering#一、从 Prompt Engineering 到 Harness Engineering：三代进化]]，本文不重复。

---

## 一、Prompt Engineering 核心技术

### Few-shot Prompting

在 Prompt 里提供几个示例（输入→输出对），让模型学会模式后再处理新输入。

**示例数量的影响**：
- 0-shot：不给示例，直接问，适合模型已经熟悉的任务
- 1-shot：给一个示例，帮助模型理解格式
- Few-shot（3-8个）：给多个示例，适合需要特定格式或风格的任务

**示例质量比数量更重要**：示例要覆盖边界情况，格式要和期望输出完全一致，避免示例之间风格不统一。

### Chain-of-Thought（CoT）

让模型在给出最终答案前先"想一想"，输出推理过程。

**为什么有效**：复杂推理任务（数学、逻辑、多步骤问题）需要中间步骤，直接要答案容易出错。CoT 把隐式推理变成显式步骤，每一步都可以被验证。

**两种触发方式**：
- 显式触发：在 Prompt 末尾加"Let's think step by step"或"请一步步思考"
- Few-shot CoT：在示例里展示推理过程，模型自动模仿

> **2025-2026 现状：CoT 已被训练进模型。** o1/o3、Claude 3.7/4（extended thinking）、Gemini 2.5、DeepSeek-R1、Qwen3 这类推理模型内部会自动生成大量思考 token，不需要手动加"step by step"。对这些模型手动触发 CoT 不仅没有收益，还会增加延迟。手动 CoT 只对 GPT-4o、Claude Sonnet（非 thinking 模式）等非推理模型仍有效。

### Tree-of-Thought（ToT）

CoT 是一条推理链，ToT 是多条推理路径的树状探索——生成多个候选步骤、评估每条路是否走得通、选最优分支继续、支持回溯。

> **2025-2026 现状：ToT 作为手动 Prompting 技巧已基本被淘汰。** o3、DeepSeek-R1 等推理模型在内部已隐式做多路径探索，不需要外部手动构造树结构。

### 现代推理模型的范式（2025-2026）

CoT/ToT 从"Prompting 技巧"升级为"训练能力"之后，出现了一批新的推理范式：

| 范式 | 代表模型/技术 | 说明 |
|------|------------|------|
| Extended Thinking | Claude 3.7/4、Gemini 2.5 | 模型生成大量内部思考 token 再输出答案，可通过 API 参数开启 |
| Long CoT + RL | DeepSeek-R1、o1/o3 | 用强化学习训练模型自主生成长推理链，不依赖人工标注 |
| Thinking/No-thinking 切换 | Qwen3 | 单模型支持 `/think` 和 `/no_think` 两种模式，按任务复杂度选择 |
| ReAct（推理+行动） | Agent 框架标配 | 交替输出思考和工具调用，适合需要外部信息的任务 |
| Reflection / Self-critique | 多模型支持 | 模型生成答案后自我评估并修正，多轮迭代 |
| Planning + 子任务分解 | Agent 框架 | 把复杂任务拆成子任务，逐步验证，是 Harness Engineering 的核心 |

**对 Prompting 的影响**：对推理模型，不再需要引导推理过程，而是要**把问题描述清楚**——明确约束、期望格式、边界条件。模型自己会想怎么解。

> [!tip] 2026 年 Prompting 的核心转变
> 传统 Prompt Engineering 关注"怎么引导模型思考"（CoT、Few-shot），现代 Context Engineering 关注"给模型组装什么信息"（系统指令、工具描述、检索结果、Memory）。详见 [[Agent工程实践#Context Engineering 取代 Prompt Engineering]]。

### System Prompt 设计原则

System Prompt 是给模型设定角色、约束和行为规范的指令，在对话开始前注入。

**设计要点**：
1. **角色设定要具体**："你是一个专注于 Python 后端开发的代码审查专家，有 10 年经验"比"你是一个助手"效果好得多
2. **约束要明确**：写清楚"不要做什么"，比如"不要提供医疗建议"、"只回答和代码相关的问题"
3. **输出格式要规定**：如果需要特定格式，在 System Prompt 里明确说明，比"在每次回复里说明"更稳定
4. **保持简洁**：System Prompt 越长，模型对后续指令的遵循度越低，控制在 500 tokens 以内

### 结构化输出

让模型输出可以被程序直接解析的格式，而不是自然语言。

**JSON mode**：主流模型（GPT-4、Claude）支持强制输出合法 JSON，配合 JSON Schema 约束字段类型和必填项。

**XML 格式**：Claude 对 XML 格式的遵循度特别高，适合需要嵌套结构的场景：
```xml
<analysis>
  <severity>high</severity>
  <issue>SQL injection vulnerability</issue>
  <fix>Use parameterized queries</fix>
</analysis>
```

**OutputParser**：LangChain 提供的解析层，把模型输出的字符串解析成 Python 对象，支持 Pydantic 模型验证。

---

## 二、Fine-tuning vs RAG vs Prompting 决策框架

三者解决的问题本质不同，不是替代关系，而是互补关系。

### 三者的本质区别

| 方式 | 改变什么 | 解决什么问题 | 知识更新成本 |
|------|---------|------------|------------|
| Prompting | 模型行为（当次） | 引导模型用已有知识完成特定任务 | 零成本，改 Prompt 即可 |
| RAG | 模型的输入（注入外部知识） | 让模型访问训练数据之外的知识 | 低，更新知识库即可 |
| Fine-tuning | 模型参数（永久） | 让模型掌握新的技能或风格 | 高，需要重新训练 |

### 决策树

```
需要的是什么？
├── 特定的输出格式/风格/角色
│   └── Prompting（Few-shot + System Prompt）
├── 访问最新的/私有的/大量的外部知识
│   └── RAG
├── 模型需要掌握新的技能（不是知识）
│   ├── 技能可以用示例描述清楚？
│   │   └── Few-shot Prompting
│   └── 技能需要大量训练才能内化？
│       └── Fine-tuning（SFT）
└── 需要模型符合特定价值观/安全标准
    └── RLHF / DPO
```

### 成本对比

| 方式 | 开发成本 | 运行成本 | 知识更新成本 | 适用规模 |
|------|---------|---------|------------|---------|
| Prompting | 极低 | 低（多几百 token） | 零 | 任何规模 |
| RAG | 中（需要建索引） | 中（检索+生成） | 低（更新文档） | 知识量大 |
| Fine-tuning | 高（标注数据+训练） | 低（推理快） | 高（重新训练） | 技能固化 |

**常见误区**：
- 不要用 Fine-tuning 解决知识问题（用 RAG）
- 不要用 RAG 解决风格问题（用 Prompting）
- 不要在 Prompting 能解决的情况下做 Fine-tuning（成本高、灵活性低）

---

## 相关链接

- [[LLM基础与训练]] — Prompt 的效果取决于模型能力
- [[Harness Engineering]] — Harness 是 Prompt 的进阶
- [[Agent核心概念]] — Agent 依赖高质量 Prompt 驱动
