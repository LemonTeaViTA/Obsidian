# 个人知识库

一个面向 Java 后端 + AI 工程方向的个人学习笔记，用 Obsidian 管理，内容由我整理思路、LLM 辅助记录与重构维护。

---

## 包含哪些内容

`wiki/` 目录按主题组织：

### Java 后端

- [Java 基础](wiki/Java基础/) — 语言核心
- [集合框架](wiki/集合框架/)
- [并发编程](wiki/并发编程/)
- [JVM](wiki/JVM/) — 虚拟机与内存管理
- [Spring](wiki/Spring/) — Spring 生态

### 数据与中间件

- [MySQL](wiki/MySQL/) — 锁、事务、索引
- [Redis](wiki/Redis/) — 缓存、持久化、集群

### 计算机基础

- [操作系统](wiki/操作系统/)
- [计算机网络](wiki/计算机网络/)
- [算法](wiki/算法/) — 题解模板（Python 3）

### LLM / Agent / RAG

- [LLM 基础](wiki/LLM/) — 模型原理、Prompt、Harness、Function Calling
- [Agent 体系](wiki/Agent/) — 推理框架、MCP/LSP 协议、Memory、Skills、可靠性、安全、可观测性
- [RAG 体系](wiki/RAG/) — 检索、向量、评估、安全
- [数据格式](wiki/数据格式/) / [文档解析](wiki/文档解析/) — RAG 数据基础

### 工程项目

- [Baize 项目](wiki/Baize项目/) — RAG 管道相关实践
- [PaiFlow](wiki/PaiFlow/) — 工作流平台

### 面试

- [面试题目](wiki/面试题目.md) — 题目清单 + 跳转链接，按知识点聚合

---

## LLM 在这套知识库里干什么

**整理与记录**：根据我的理解和素材，由 LLM 帮我把内容重构、补全细节、统一格式。每一篇 wiki 文档都不是直接生成的，而是==我提出方向 → LLM 协助起草 → 我审核修改==的产物。

**结构维护**：当某个主题文档膨胀到难以阅读时（比如 1000+ 行的 `Agent 工程实践.md`），由 LLM 协助按逻辑拆分成多个独立文档，并修复跨文件的 wikilink。

**数据集整理（raws/）**：`raws/` 目录是从公众号 / 论文 / 博客等来源收集的原始素材，由 LLM 按主题归类、去重、提取要点，再决定是否进入 `wiki/`。这部分的协作约定见 [RAW_WORKFLOW_GUIDE.md](RAW_WORKFLOW_GUIDE.md)。

---

## 根目录辅助文件

- [AGENTS.md](AGENTS.md) — 给 AI 协作者看的规则（哪些操作禁止、历史踩过的坑）
- [OBSIDIAN_STYLE.md](OBSIDIAN_STYLE.md) — Obsidian 写作风格规范
- [QUALITY_CHECKLIST.md](QUALITY_CHECKLIST.md) — 文档质量检查清单
- [RAW_WORKFLOW_GUIDE.md](RAW_WORKFLOW_GUIDE.md) — `raws/` 处理流程
- [优化记录.md](优化记录.md) — 全局变更日志，每次重构都记一笔

---

仅供个人学习使用，不保证内容准确性，欢迎指正。
