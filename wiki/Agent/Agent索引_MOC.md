---
module: Agent
tags: [Agent, MOC, 工程师视角]
difficulty: hard
last_reviewed: 2026-05-28
---

# Agent 索引 MOC（工程师视角）

> ==按"我要解决什么问题"组织==，不是按"这是什么概念"组织。
>
> 模型基础见 [[LLM索引_MOC]]；RAG 体系见 [[wiki/RAG/]]。

---

## 🗺️ 知识体系导航

### 1. 入门：Agent 是什么

 Agent 核心概念
Agent 定义与基本架构、四个核心模块、Agent vs LLM Chain 的本质区别、推理模式总览、分层架构图。
👉 **[[Agent 核心概念]]**

---

### 2. 推理框架：Agent 怎么思考

 ReAct 与 Harness 实现
==最底层认知==——LLM 的本质（无状态纯函数）、LLM/Harness 完整分工对照、60 行极简 ReAct 实现、工具识别两种方式（传统 prompt vs Function Calling）。
👉 **[[ReAct 与 Harness 实现]]**

 Plan-and-Execute 实现
==规划框架==——80 行 Python 完整实现、Plan schema 三种递进设计（线性/DAG/输入输出绑定）、Replan 机制、==两层 context 分离==（Planner 看 metadata / Executor 看完整 artifact）、与 LangGraph 的关系。
👉 **[[Plan-and-Execute 实现]]**

 Reflection 实现
==质量保障层==——50 行 Python 完整实现、Self-Reflection vs Critic Model 两种变体、外部验证器（测试/lint/LSP 诊断）、与 ReAct/Plan-and-Execute 的叠加方式。
👉 **[[Reflection 实现]]**

---

### 3. 工具调用：Agent 怎么行动

 MCP 协议
==工具标准化接入协议==（2026 事实标准）——Host/Client/Server 三层架构、Streamable HTTP transport、Host 集成层（工具命名空间 / Schema 清洗 / Resources 虚拟化 / notifications）、CDP 浏览器自动化（isolated vs shared 模式 / 登录态访问）、Server 生命周期与异步启动。
👉 **[[MCP 协议]]**

 LSP 与代码诊断
==Coding Agent 调用语言服务的协议 + Post-Edit 诊断回注模式==——LSP 协议核心（publishDiagnostics 主动推送）、主流 server 生态（JDT LS / rust-analyzer / pyright / gopls）、LSP vs MCP 双胞胎、write_file 后异步触发诊断并回注下一轮 LLM。
👉 **[[LSP 与代码诊断]]**

 Coding Agent 工具集
Claude Code / Cursor / Aider 等==实际提供的工具集==——文件操作 / 代码搜索 / 命令执行 / 联网类（分级 fallback / SSRF 防御）、MCP 动态工具、==工具集 token 管理==（工具描述是隐形 prompt 成本 / 分组过滤 / allowedTools 白名单）。
👉 **[[Coding Agent 工具集]]**

---

### 4. 上下文与状态：Agent 怎么记忆

 Agent Memory 系统
==Agent 跨会话记住事的核心==——三层架构（L1/L2/L3）、JSONL 会话日志、MEMORY.md + SQLite 双层存储设计、==L2 → L3 转换机制==（触发条件 / 转换 prompt / 重要性判断）。
👉 **[[Agent Memory 系统]]**

 Agent Skills 体系
Skills 定义、渐进式披露原理（索引段 ≤ 4KB / 启用上限 20 个）、专用 load_skill 工具 vs 通用 view、三层加载位置（内置 < 用户级 < 项目级）、典型案例（web-access skill）、与 HITL 的协同。
👉 **[[Agent Skills 体系]]**

 长上下文工程
==2025-2026 Agent 工程核心方向==——Prompt Caching（三家厂商对比 + Anthropic `cache_control` + 命中率经济学省 80%+）+ 模型能力 self-aware（80% Rule 动态预算）+ Context Mode 三档切换（short/balanced/long）+ RAG topK 自适应 + Token 可观测性。
👉 **[[长上下文工程]]**

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

---

## 🛤️ 学习路径建议

### Stage 1 · 推理框架（先搞清楚 Agent 怎么思考）

1. **[[Agent 核心概念]]** — Agent 是什么 + 四个核心模块 + 推理模式总览
2. **[[ReAct 与 Harness 实现]]** — 60 行 Python 看清 LLM/Harness 分工
3. **[[Plan-and-Execute 实现]]** — 80 行 Python + Plan schema + Replan 上下文裁剪
4. **[[Reflection 实现]]** — 50 行 Python + Self-Reflection vs Critic Model + 叠加方式

### Stage 2 · 工具调用（Agent 怎么行动）

5. **[[MCP 协议]]** — 外部工具标准化接入（Host 集成层 / CDP 浏览器 / 安全模型）
6. **[[LSP 与代码诊断]]** — 语言服务协议 + Post-Edit 诊断回注
7. **[[Coding Agent 工具集]]** — 实际工具集 + 工具集 token 管理

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

- [[LLM索引_MOC]] — LLM 模型基础（Transformer / 训练 / Prompt / Harness / Function Calling）
- [[wiki/RAG/]] — RAG 完整体系（检索 / 向量 / 评估 / 安全）
- [[Java基础索引_MOC]] — Java 后端是 Agent 应用的工程基础
- [[Spring索引_MOC]] — Spring AI 集成 LLM/Agent
