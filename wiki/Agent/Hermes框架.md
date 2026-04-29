# Hermes Agent 框架

> Hermes Agent 是 Nous Research 开源的自进化 AI Agent 框架，核心理念：**用得越多越聪明**。

## 核心特点

**自进化（内置学习循环）**：完成复杂任务后，自动把解决过程沉淀成 Markdown 格式的 Skill。发现更好路径时自动更新。不需要手写 Rules 规定工具调用顺序。

**三层记忆系统**：
- SQLite 存对话历史
- FTS5 做全文检索
- 大模型自动做摘要

跨会话记住用户偏好和习惯。

**安全机制**：在框架层面做了用户授权、危险命令审批、容器隔离和上下文扫描，不依赖大模型自己判断风险。

**广泛兼容**：支持 200+ 大模型（OpenAI、Anthropic、OpenRouter 等），支持 Telegram、Discord、Slack 等多端接入。

## 和 OpenClaw 的区别

| | OpenClaw | Hermes |
|---|---|---|
| 安全机制 | 依赖大模型自己判断风险 | 框架层面强制授权和审批 |
| 技能沉淀 | 手动管理 Skills | 自动从任务中提炼 Skill |
| 记忆系统 | SQLite + FTS5 + sqlite-vec | SQLite + FTS5 + 大模型摘要 |
| 模型支持 | 需配置 | 200+ 模型开箱即用 |
