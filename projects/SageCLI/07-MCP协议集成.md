---
module: SageCLI
type: project
status: source-study
tags: [SageCLI, Agent, 项目笔记]
last_reviewed: 2026-07-22
---

# MCP 协议集成

**是什么**：通过 MCP（Model Context Protocol）协议动态接入外部工具，不需要修改 CLI 代码。

**为什么**：内置工具满足不了所有场景，MCP 允许第三方工具按协议接入，工具生态可以独立扩展。

**怎么做**：
- 两种 transport：stdio（本地子进程，标准输入输出通信）和 HTTP SSE（远端服务，流式事件）
- SchemaSanitizer：自动清洗 MCP server 返回的 JSON Schema，去掉目标模型不支持的字段
- Chrome DevTools MCP：通过 CDP 协议控制浏览器，实现网页自动化（截图、点击、抓内容）
- 工具注册：启动时从 MCP server 拉取工具列表，合并进内置工具，LLM 统一看到完整工具集

**关键权衡**：SchemaSanitizer 是必要的兼容层——MCP server 是第三方写的，schema 格式千变万化，不清洗直接注册会导致部分模型拒绝工具调用甚至报错。

---

## 面试 Q&A

**Q：stdio 和 HTTP 两种 transport 分别适合什么场景？**
stdio 适合本地工具（代码分析、文件操作类 MCP），启动子进程即可，无需网络。HTTP SSE 适合远端服务，支持多客户端复用。

**Q：为什么要做 SchemaSanitizer 而不是要求 MCP server 输出标准格式？**
MCP server 由第三方维护，无法控制它的输出。同时不同 LLM 对 schema 的支持不同（比如某些模型不支持特定 schema 关键字）。做在客户端兼容是唯一可控的方案。
