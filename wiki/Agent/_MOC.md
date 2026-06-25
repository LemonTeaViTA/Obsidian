---
module: Agent
tags: [Agent, MOC, 工程师视角]
difficulty: hard
last_reviewed: 2026-06-01
---

# Agent 索引 MOC（工程师视角）

> ==按"我要解决什么问题"组织==，不是按"这是什么概念"组织。
>
> 模型基础见 [[_MOC]]；RAG 体系见 [[RAG基础与架构|RAG 体系]]。

> [!tip] ==Agent 工程 = Harness Engineering 的具体化==
> 这里所有 Agent 工程话题（推理框架 / Memory / Skills / Tools / 可靠性 / 可观测）都是 [[Harness Engineering]] 这套方法论的具体落地。==Harness 是"思想"，Agent 是"产品"==——读完本目录建议回头看一下 [[Harness Engineering]] 把方法论串起来。

---

## 🗺️ 知识体系导航

### 1. 入门：Agent 是什么

 Agent 核心概念
Agent 定义与基本架构、四个核心模块、Agent vs LLM Chain 的本质区别、推理模式总览、分层架构图。
👉 **[[Agent 核心概念]]**

---

### 2. 推理框架：Agent 怎么思考

> [!info] 推理谱系：从"模型内部怎么想"到"Harness 怎么编排"
> Agent 的推理能力横跨两层，本节讲的是**第二层（Harness 编排）**：
> - **模型内部推理**（LLM 自己怎么想）：CoT（思维链）/ Long CoT / ToT 作为提示技巧 → 见 [[Prompt Engineering]]。2025-2026 这层已被训练进推理模型（o3/DeepSeek-R1/Claude thinking）。
> - **Harness 编排推理**（外部怎么组织 LLM 的多步思考）：本节的 **ReAct**（想-做循环）、**Reflection**（自我批判）、**Plan-and-Execute**（先规划后执行）、**ToT/LATS**（搜索树，见 [[Plan 模式家族对比]]）。
>
> 一句话：==CoT 是"模型自己一步步想"，ReAct/Plan 是"Harness 让模型分步想 + 调工具"==——前者在 LLM 域，后者在这里。

 ReAct 与 Harness 实现
==最底层认知==——LLM 的本质（无状态纯函数）、LLM/Harness 完整分工对照、60 行极简 ReAct 实现、工具识别两种方式（传统 prompt vs Function Calling）。
👉 **[[ReAct 与 Harness 实现]]**

 Plan-and-Execute 模式
==规划框架索引==——Plan-and-Execute 模式总览、主流实现对比（LangGraph / CrewAI / AutoGPT）、80 行 Python 完整实现教程。
👉 **[[Plan-and-Execute 模式]]**
   - **[[Plan-and-Execute 实现对比]]** — 主流框架的实现差异
   - **[[Plan-and-Execute 实现教程]]** — 80 行 Python + Plan schema + Replan 机制

 Plan 模式家族对比
==Reference 文档==——把"让 LLM 怎么规划复杂任务"的 6 种主流变体放在一起对比：Plan-and-Execute / ReWOO / LLMCompiler / ToT / LATS / Hierarchical，含选型矩阵。
👉 **[[Plan 模式家族对比]]**

 Reflection 实现
==质量保障层==——50 行 Python 完整实现、Self-Reflection vs Critic Model 两种变体、外部验证器（测试/lint/LSP 诊断）、与 ReAct/Plan-and-Execute 的叠加方式。
👉 **[[Reflection 实现]]**

---

### 3. 工具调用：Agent 怎么行动

 MCP 协议索引
==工具标准化接入协议索引==（2026 事实标准）——协议概述、服务端开发、客户端集成。
👉 **[[MCP 协议概述]]**
   - **[[MCP 服务端开发]]** — Server 生命周期、异步启动、工具/资源/提示词开发
   - **[[MCP 客户端集成]]** — Host 集成层（命名空间 / Schema 清洗 / Resources 虚拟化）

 MCP Server 生态
[[MCP 协议概述]] 的==生态分册==——主流 MCP Server 分类清单 + CDP 浏览器自动化（isolated vs shared / 登录态访问）这一最复杂的 Server 类别的工程细节。
👉 **[[MCP Server 生态]]**

 MCP 安全模型
[[MCP 协议概述]] 的==安全分册==——MCP 把工具变成独立进程带来的安全特性、三道安全关卡、凭证脱敏与审计日志。与 [[Agent 安全模型]] 互补：本文聚焦 MCP 边界，后者讲 Agent 整体纵深防御。
👉 **[[MCP 安全模型]]**

 LSP 与代码诊断
==Coding Agent 调用语言服务的协议 + Post-Edit 诊断回注模式==——LSP 协议核心（publishDiagnostics 主动推送）、主流 server 生态（JDT LS / rust-analyzer / pyright / gopls）、LSP vs MCP 双胞胎、write_file 后异步触发诊断并回注下一轮 LLM。
👉 **[[LSP 与代码诊断]]**

 Coding Agent 工具集索引
Claude Code / Cursor / Aider 等==实际提供的工具集索引==——工具分类、token 管理、MCP 集成、安全防护。
👉 **[[Coding Agent 工具集_MOC]]**

---

### 4. 上下文与状态：Agent 怎么记忆

 Agent Memory 系统
==Agent 跨会话记住事的核心==——三层架构（L1/L2/L3）、JSONL 会话日志、MEMORY.md + SQLite 双层存储设计、==L2 → L3 转换机制==（触发条件 / 转换 prompt / 重要性判断）。
👉 **[[Agent Memory 系统]]**

 Agent Skills 体系
Skills 定义、渐进式披露原理（索引段 ≤ 4KB / 启用上限 20 个）、专用 load_skill 工具 vs 通用 view、三层加载位置（内置 < 用户级 < 项目级）、典型案例（web-access skill）、与 HITL 的协同。
👉 **[[Agent Skills 体系]]**

 Agent Hooks 机制
==确定性控制层==——在生命周期固定时机（PreToolUse/PostToolUse/SessionStart 等 8+ 事件）强制执行命令，对冲 LLM 概率性行为。阻断语义（非零退出码拦下工具调用）是安全闸门基础；五大用途（安全拦截/格式化/上下文注入/审计/持久化）；Hooks vs Skills vs Commands vs MCP 区分。
👉 **[[Agent Hooks 机制]]**

 长上下文工程
==2025-2026 Agent 工程核心方向==——Prompt Caching 省 80%+ 成本、模型能力 self-aware（80% Rule 动态预算）、Context Mode 三档切换（topK / 压缩 / Resources 注入联动）、Token 可观测性。
👉 **[[长上下文工程]]**
   - **[[Prompt-Caching详解]]** — 三家厂商差异 + `cache_control` 用法 + 命中率经济学
   - **[[Context-Mode策略详解]]** — 策略矩阵 + RAG topK 自适应 + MCP Resources 注入

---

### 5. Multi-Agent：Agent 怎么协作

 Multi-Agent 架构
四种协作模式（流水线/主从/平行/辩论）、==经典三角色组合==（Planner + Worker + Reviewer = Plan-and-Execute + Reflection 的产品化封装）、冲突仲裁四种策略、==何时该用何时不该用==（七个真实代价 + 四个信号 + 选型决策树）。
👉 **[[Multi-Agent 架构]]**

---

### 6. 可靠性：Agent 怎么稳定运行

 Agent 可靠性设计
死循环检测（三层机制）、Fallback 四层架构、工具调用失败四层决策（L1 重试 / L4 换策略）、错误累积防护（中间结果验证 / 计划锚定 / 上下文隔离）、==Side-History Git Snapshot==（独立 git 仓库不写用户 .git）、LLM 幻觉缓解、Agent 评估方法。
👉 **[[Agent 可靠性设计]]**

---

### 7. 安全：Agent 怎么防止出错和被攻击

 Agent 安全模型
==为什么不做沙箱==（本地 CLI vs 云端 microVM 的根本区别）、四层安全防护（CommandGuard 黑名单 / PathGuard 路径围栏 / HITL 三档授权 / AuditLog）、HITL 工具读/写粒度细化、模式切换=会话边界、Prompt Injection 纵深防御。
👉 **[[Agent 安全模型]]**

---

### 8. 可观测性：Agent 怎么调试和省钱

 Agent 可观测性
三层追踪体系（Thought / Tool Call / 任务层）、结构化日志、Debug 推理链四种方法、审计日志 schema 演进与向后兼容、凭证脱敏、成本控制五种策略、必显的 5 个 Token 指标。
👉 **[[Agent 可观测性]]**

 模型路由策略
==生产级 Agent 的隐藏标配==——三种路由模式（规则/LLM/Embedding）+ Router LLM ≠ 主 LLM 的关键认知 + 三层级联架构 + 成本经济学（省 70%+）+ 真实产品案例（OpenAI/Anthropic/Cursor）。
👉 **[[模型路由策略]]**

---

### 9. 部署与产品形态：Agent 怎么交付

 Agent 工程实践
==Agent 工程实践的导航枢纽 + 未拆分 CLI / 框架 / 趋势内容==——CLI Agent 设计要点、LangChain/LangGraph 落地经验、2025-2026 Agent 工程趋势；并指引 Multi-Agent / 可靠性 / 安全 / 可观测 / 部署 五个已拆分主题。
👉 **[[Agent 工程实践]]**

 Agent 部署与服务化
==Durable Task Queue==（SQLite 持久化 + 任务生命周期 + Worker Pool）+ ==Runtime API==（与 OpenAI Assistants API 同构 / POST /v1/threads / SSE events）+ 安全（强制 API Key + 仅 localhost）+ 与 Side-History 协同。
👉 **[[Agent 部署与服务化]]**

 Agent 框架
==国际主流==（LangChain / LangGraph / CrewAI / AutoGen / LlamaIndex）+ ==Java 生态==（Spring AI）+ ==国产框架==（OpenClaw / Hermes）的完整对比与选型决策树。
👉 **[[Agent 框架]]**

 Coding Agent TUI 设计
==Coding Agent 的"门面"==——三种渲染形态（inline 流式 / lanterna 全屏 / plain 兜底）、Renderer 与 Agent 核心解耦、流式渲染工程细节（token 拼接 / 折叠工具块 / 行内 diff / 状态栏）、交互式 HITL UI 设计、终端兼容性降级。
👉 **[[Coding Agent TUI 设计]]**

 AI 编程工具
Claude Code / Codex / Cursor 对比、AI 编程工具与传统 IDE 的本质区别、Claude Code 概念体系（Commands / Skills / Rules / Hooks / Subagents / Plugins）。
👉 **[[AI 编程工具]]**

### 10. 实现对比：主流 Coding Agent 怎么做的（源码级）

> [!info] ==这是单独的子目录==
> ==基于实际源码==（Claude Code / Codex CLI / Hermes / OpenClaw）做==每个话题的横向对比==——数据可验证，附文件路径。
>
> 主目录: ==[[Coding Agent 工具集_MOC|主流 Coding Agent 实现对比]]==

| 话题 | 文档 | 主文档 |
|------|------|------|
| ==Compaction（待做）== | — | [[长上下文工程]] |
| ==沙箱 / HITL（待做）== | — | [[Agent 安全模型]] |
| ==工具调用（待做）== | — | [[Function Calling]] |
| ==Multi-Agent（待做）== | — | [[Multi-Agent 架构]] |

---

## 🛤️ 学习路径建议

### Stage 1 · 推理框架（先搞清楚 Agent 怎么思考）

1. **[[Agent 核心概念]]** — Agent 是什么 + 四个核心模块 + 推理模式总览
2. **[[ReAct 与 Harness 实现]]** — 60 行 Python 看清 LLM/Harness 分工
3. **[[Plan-and-Execute 模式]]** — 规划框架总览 + 主流实现对比 + 80 行 Python 教程
4. **[[Reflection 实现]]** — 50 行 Python + Self-Reflection vs Critic Model + 叠加方式

### Stage 2 · 工具调用（Agent 怎么行动）

5. **[[MCP 协议概述]]** — 外部工具标准化接入（Host/Client/Server 三层架构）
6. **[[LSP 与代码诊断]]** — 语言服务协议 + Post-Edit 诊断回注
7. **[[Coding Agent 工具集_MOC]]** — 实际工具集 + 工具集 token 管理

### Stage 3 · 上下文与状态（Agent 怎么记忆）

8. **[[Agent Memory 系统]]** — 三层记忆架构 + L2→L3 转换机制
9. **[[Agent Skills 体系]]** — 可复用能力单元 + 渐进式披露
10. **[[长上下文工程]]** — Prompt Caching + 动态预算 + Context Mode 切换

### Stage 4 · Multi-Agent 与工程（Agent 怎么协作 / 怎么可靠）

11. **[[Multi-Agent 架构]]** — 三角色组合 + 冲突仲裁 + 何时该用
12. **[[Agent 可靠性设计]]** — 死循环 / Fallback / 错误累积防护 / Side-History
13. **[[Agent 安全模型]]** — 沙箱认知 / HITL 三档 / PathGuard / CommandGuard
14. **[[Agent 可观测性]]** — 三层追踪 / 审计日志 / 成本控制
15. **[[模型路由策略]]** — Router LLM ≠ 主 LLM + 三层级联 + 成本经济学

### Stage 5 · 部署与产品形态（Agent 怎么交付）

16. **[[Agent 框架]]** — 框架选型（LangGraph / Spring AI / 等）
17. **[[Agent 部署与服务化]]** — Durable Task Queue + Runtime API
18. **[[AI 编程工具]]** — Claude Code / Cursor 等的产品落地
19. **[[Coding Agent TUI 设计]]** — 终端形态（inline / lanterna / plain）+ Renderer 抽象

---

> **核心认知**：
> Agent 不是"更高级的模型"——模型还是那个模型，变的是外面那一圈工程系统。
> ==推理框架解决"怎么思考"，工具协议解决"怎么行动"，Memory/Skills 解决"怎么积累"，可靠性/安全解决"怎么稳定"==。
> 四者组合才是生产级 Agent 的完整答案。

## 相关链接

- [[_MOC]] — LLM 模型基础（Transformer / 训练 / Prompt / Harness / Function Calling）
- [[RAG基础与架构|RAG 体系]] — RAG 完整体系（检索 / 向量 / 评估 / 安全）
- [[_MOC]] — Java 后端是 Agent 应用的工程基础
- [[_MOC]] — Spring AI 集成 LLM/Agent
- [[Git]] — Coding Agent 与 Side-History Git Snapshot 依赖的版本控制工具速查


---

## 面试考点

### Agent 核心概念

- Agent 的基本架构是什么？
- Agent 和传统 LLM Chain 的区别？
- ReAct 模式是怎么工作的？
- Agent 的规划能力（Planning）是如何实现的？
- Agent 如何处理工具调用失败的情况？

### Agent 工具与协议

- Function Calling 是什么？怎么保证可靠性？
- MCP 协议是什么？解决了什么问题？
- Skills 是什么？和 Prompt 有什么区别？
- 为什么 Skills 不直接把所有内容都加载进去？
- Skills 的渐进式披露原理是什么？
- 怎么知道该调用哪个 Skill？（语义匹配机制）
- SKILL.md 是怎么被读进去的？
- 如何创建一个 Skill？六步流程了解吗？
- 创建 Skill 有哪些注意事项？
- Skills 和 GPTs、Rules 有什么区别？
- 如何写出一个高质量的 Skill？
- Agent 读取 Skill 时有哪些性能优化措施？
- Agent 执行 Skills 时有哪些安全机制？
- 在实际项目中，如何管理大量的 Skills？
- 如何设计安全的工具权限控制机制？

### Agent 记忆与多智能体

- Agent 的长期记忆怎么实现？
- Memory 和 RAG 有什么区别？
- 短期记忆、长期记忆、工作记忆分别对应什么技术实现？
- 为什么需要 Multi-Agent？
- Multi-Agent 的协作模式有哪些？
- A2A（Agent-to-Agent）是什么？和单 Agent 有什么区别？

### Agent 工程实践

- Agent 的可观测性怎么做？如何 debug 复杂的推理链？
- Agent 的成本控制策略有哪些？如何避免无限循环调用？
- 如何评估 Agent 的效果？有哪些 benchmark？
- Agent 在生产环境中的安全风险有哪些？如何防护？
- Agent 陷入死循环（反复调用同一工具或在两个状态间震荡）怎么检测和处理？
- 如何设计 Agent 的 Fallback 策略？所有工具都调用失败时怎么优雅降级？
- Agent 在多步推理中如何防止错误累积？（一步错步步错的问题）
- Prompt Injection 攻击有哪些类型？Agent 场景下如何防御？
- Context Engineering 是什么？和 Prompt Engineering 有什么区别？
- Computer Use / Browser Use 是什么？解决了什么问题？
- SWE-bench 和 GAIA 分别评估 Agent 的什么能力？
- LangChain 的三层架构是什么？六大核心模块分别是什么？
- LangChain 和 LangGraph 有什么区别？
- Agent 开发有哪四种方式？各自适用什么场景？

### Harness Engineering

- Harness Engineering 是什么？和 Prompt Engineering 有什么区别？
- Harness 的四大原则是什么？
- 为什么说 Harness 比模型本身更重要？
- Generator-Evaluator 架构是什么？
- 企业级 Agent 有哪些实战经验？（Codex/Stripe/Cursor）

### AI 编程工具与框架选型

- AI 编程工具和传统 IDE 有什么本质区别？
- Claude Code、Codex、Cursor 各自的核心特点是什么？
- Cursor 五代架构演进说明了什么？
- OpenClaw 和 Hermes 框架各自的核心特点是什么？
- Hermes 的自进化机制是怎么工作的？ ➡️ 👉 Hermes框架
- 什么场景选 OpenClaw，什么场景选 Hermes？ ➡️ 👉 Hermes框架
