# 个人技术知识库

一个面向 Java 后端 + AI 工程方向的公开技术知识库，用 Obsidian 管理。
内容以通用技术知识、公开项目源码研习和可复用的求职方法为主；项目事实、个人经历与未公开资料严格分开。

## 适合谁阅读

- 希望系统复习 Java 后端、JVM、并发、数据库和计算机基础的开发者
- 正在学习 LLM、RAG、Agent 工程的工程师
- 想参考源码研习记录、技术复盘和知识库维护方法的人

## 推荐阅读路径

1. 先从对应主题目录的 `_MOC.md` 开始，了解范围和阅读顺序。
2. Java 后端路线：`Java基础 → 集合框架 → 并发编程 → JVM → Spring → MySQL / Redis`。
3. AI 工程路线：`LLM → Agent → RAG → 文档解析 / 数据格式`。
4. 项目研习路线：先读项目 README 或项目主卡，再进入专题、面试卡和证据边界卡。

> [!warning] 公开内容边界
> `projects/` 中的 PaiAgent、SageCLI、Baize 和 Claude Code 文档是公开项目的源码研习或技术分析，不能自动理解为个人原创实现、生产经验或性能承诺。`career/` 只保留脱敏模板和方法论；原始材料不进入公开目录。

---

## 目录结构

```
wiki/       技术知识（面试+学习）
projects/   项目文档与工具笔记
career/     求职材料
raws/       原始文档流水线（inbox → staged → processed）
wiki审计/   审计报告、检查结果和历史整理记录
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

**整理中的题解材料**
- [LeetCode 个人练习](wiki/leetcode-practice/) — 个人 LeetCode 方法代码，按平台 `class Solution` 格式保存
- [华为机试题解](wiki/华为机试/) — 个人整理中的题解，暂不纳入正式 wiki 规范

### projects/ — 项目文档

- [Baize 项目](projects/Baize项目/) — RAG 知识库系统（ES + Kafka + MinIO）
- [Claude Code](projects/ClaudeCode/) — Claude Code 工具笔记
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

## 本地检查

提交前可运行现有的只读审计脚本：

```bash
./wiki审计/check.sh --all
```

本仓库原创笔记和文档采用 [CC BY-NC-SA 4.0](LICENSE) 许可。该许可允许非商业分享与改编，要求署名，并要求改编内容使用相同许可。第三方源码、引用材料、商标和链接到的上游项目仍遵循各自许可。

---

## 根目录文件

| 文件 | 用途 |
|------|------|
| [AGENTS.md](AGENTS.md) | AI 操作规范（操作约束 + 黄金样例） |
| [OBSIDIAN_STYLE.md](OBSIDIAN_STYLE.md) | 写作格式规范（Frontmatter/高亮/Callout） |
| [LICENSE](LICENSE) | 公开内容使用 CC BY-NC-SA 4.0 许可 |
| [.gitattributes](.gitattributes) / [.editorconfig](.editorconfig) | 统一文本文件使用 LF 行尾 |
| [raws/WORKSPACE.md](raws/WORKSPACE.md) | raws 目录操作契约 |
| [scratch.md](scratch.md) | 零摩擦速记草稿区 |
| [思考记录.md](思考记录.md) | 设计决策（ADR 格式） |
| [优化记录.md](优化记录.md) | 变更日志（每条 2-3 行） |

---

## 重大变更历史

| 时间 | 变更 |
|------|------|
| 2026-09-07 | 移除主仓库中的完整第三方 LeetCode 题库快照，仅保留个人练习代码；忽略整个 `.obsidian/` 工作区配置，知识库正文与 Obsidian 本地状态分离 |
| 2026-09-05 | 将含公司内部实现、服务地址和运营信息的 AI 软件工厂学习资料整体移出知识库，待脱敏与公开性审计后再选择性回迁通用内容 |
| 2026-09-05 | 将含个人信息的简历与面试材料移出 `career/简历/`，投递材料单独保存；公开目录新增完全脱敏的简历优化提示词 |
| 2026-08-13 | 新增 `projects/PaiAgent/` 源码研习核心卡与 Agent 岗 7 天突击路线；AI 软件工厂作为实习证据主线，PaiAgent / PaiCLI 明确按开源源码研习使用 |
| 2026-07-22 | 修复全库 CRLF 行尾污染并建立 LF 约束；恢复 `raws/` 目录骨架与 `WORKSPACE.md`；修正项目路径和审计工具兼容性 |
| 2026-06-25 | 结构重构：新建 `projects/` 和 `career/`，wiki 专注技术知识；面试题目.md 废弃，考点分散到各模块 `_MOC.md`；治理文档从 6 份压缩到 3 份；补充 OS/网络缺失考点；并发编程大文件加顶部速览；优化记录从 1147 行压缩至 290 行 |
| 2026-06-01 | 全量审计 + P0/P1 修复：~50 个文件重构，SSoT 收敛，MOC 建立，死链清理 |
| 2026-05-25 | RAG 基础与架构大重构（1165→217行），新建文档解析/分块策略等独立文档 |
