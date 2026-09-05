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
- [PaiAgent](projects/PaiAgent/) — Agent 工作流平台源码研习与面试卡
- [SageCLI](projects/SageCLI/) — SageCLI 工具笔记

> 公司内部项目资料不纳入公开知识库；完成脱敏与公开性审计后，仅回迁可独立公开的通用技术内容。

### career/ — 求职材料

- [简历](career/简历/) — 脱敏优化提示词 + 写法指南 + 项目范例（个人投递材料不纳入知识库）

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
| [.gitattributes](.gitattributes) / [.editorconfig](.editorconfig) | 统一文本文件使用 LF 行尾 |
| [raws/WORKSPACE.md](raws/WORKSPACE.md) | raws 目录操作契约 |
| [scratch.md](scratch.md) | 零摩擦速记草稿区 |
| [思考记录.md](思考记录.md) | 设计决策（ADR 格式） |
| [优化记录.md](优化记录.md) | 变更日志（每条 2-3 行） |

---

## 重大变更历史

| 时间 | 变更 |
|------|------|
| 2026-09-05 | 将含公司内部实现、服务地址和运营信息的 AI 软件工厂学习资料整体移出知识库，待脱敏与公开性审计后再选择性回迁通用内容 |
| 2026-09-05 | 将含个人信息的简历与面试材料移出 `career/简历/`，投递材料单独保存；公开目录新增完全脱敏的简历优化提示词 |
| 2026-08-13 | 新增 `projects/PaiAgent/` 源码研习核心卡与 Agent 岗 7 天突击路线；AI 软件工厂作为实习证据主线，PaiAgent / PaiCLI 明确按开源源码研习使用 |
| 2026-07-22 | 修复全库 CRLF 行尾污染并建立 LF 约束；恢复 `raws/` 目录骨架与 `WORKSPACE.md`；修正项目路径和审计工具兼容性 |
| 2026-06-25 | 结构重构：新建 `projects/` 和 `career/`，wiki 专注技术知识；面试题目.md 废弃，考点分散到各模块 `_MOC.md`；治理文档从 6 份压缩到 3 份；补充 OS/网络缺失考点；并发编程大文件加顶部速览；优化记录从 1147 行压缩至 290 行 |
| 2026-06-01 | 全量审计 + P0/P1 修复：~50 个文件重构，SSoT 收敛，MOC 建立，死链清理 |
| 2026-05-25 | RAG 基础与架构大重构（1165→217行），新建文档解析/分块策略等独立文档 |
