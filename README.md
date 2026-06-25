# 个人知识库

一个面向 Java 后端 + AI 工程方向的个人学习笔记，用 Obsidian 管理，内容由我整理思路、LLM 辅助记录与重构维护。

---

## 目录结构

```
wiki/       技术知识（面试+学习）
projects/   项目文档与工具笔记
career/     求职材料
raws/       原始文档流水线（inbox → staged → processed）
```

### wiki/ — 技术知识

**Java 后端**
- [Java 基础](wiki/Java基础/) · [集合框架](wiki/集合框架/) · [并发编程](wiki/并发编程/) · [JVM](wiki/JVM/) · [Spring](wiki/Spring/)

**数据与中间件**
- [MySQL](wiki/MySQL/) · [Redis](wiki/Redis/)

**计算机基础**
- [操作系统](wiki/操作系统/) · [计算机网络](wiki/计算机网络/) · [算法](wiki/算法/)

**LLM / Agent / RAG**
- [LLM](wiki/LLM/) · [Agent 体系](wiki/Agent/) · [RAG 体系](wiki/RAG/)
- [数据格式](wiki/数据格式/) · [文档解析](wiki/文档解析/)

> 每个模块根目录有 `_MOC.md`（排序置顶），包含文档导航和面试考点清单。

### projects/ — 项目文档

- [Baize 项目](projects/Baize项目/) — RAG 知识库系统（ES + Kafka + MinIO）
- [CluadeCode](projects/CluadeCode/) — Claude Code 工具笔记
- [SageCLI](projects/SageCLI/) — SageCLI 工具笔记

### career/ — 求职材料

- [简历](career/简历/) — 写法指南 + 项目范例

---

## 工作流

```
raws/inbox/  →  staged/<类别>/  →  (提取知识到 wiki/)  →  processed/
```

LLM 协作约定见 [AGENTS.md](AGENTS.md)；raw 整理规则见 [raws/WORKSPACE.md](raws/WORKSPACE.md)。

零碎想法 → [scratch.md](scratch.md)（先记下，不考虑格式）  
设计决策 → [思考记录.md](思考记录.md)（对话中的洞察和误区纠正）  
变更日志 → [优化记录.md](优化记录.md)

---

## 根目录文件

| 文件 | 用途 |
|------|------|
| [AGENTS.md](AGENTS.md) | AI 操作规范（操作约束 + 黄金样例） |
| [OBSIDIAN_STYLE.md](OBSIDIAN_STYLE.md) | 写作格式规范（Frontmatter/高亮/Callout） |
| [raws/WORKSPACE.md](raws/WORKSPACE.md) | raws 目录操作契约 |
| [scratch.md](scratch.md) | 零摩擦速记草稿区 |
| [思考记录.md](思考记录.md) | 设计决策（ADR 格式） |
| [优化记录.md](优化记录.md) | 变更日志（每条 2-3 行） |

---

## 重大变更历史

| 时间 | 变更 |
|------|------|
| 2026-06-25 | 结构重构：新建 `projects/` 和 `career/`，wiki 专注技术知识；面试题目.md 废弃，考点分散到各模块 `_MOC.md`；治理文档从 6 份压缩到 3 份；补充 OS/网络缺失考点；并发编程大文件加顶部速览；优化记录从 1147 行压缩至 290 行 |
| 2026-06-01 | 全量审计 + P0/P1 修复：~50 个文件重构，SSoT 收敛，MOC 建立，死链清理 |
| 2026-05-25 | RAG 基础与架构大重构（1165→217行），新建文档解析/分块策略等独立文档 |
