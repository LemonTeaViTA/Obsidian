---
module: Agent
tags: [WORKSPACE, 实现对比, 写作规范]
---

# 主流 Coding Agent 实现对比 — 工作区规范

> ==给 Agent 看的工作区契约==——任何 Agent（Claude Code / Codex / Cursor / OpenCode 等）进入本目录写文档时，必须先读本文件。

## 用途

==基于实际源码==做 ==Coding Agent 各个话题的横向对比==——
- ==四个项目==：Claude Code（npm sourcemap 还原） / Codex CLI / Hermes / OpenClaw
- ==每个话题一篇==：Memory / Compaction / 沙箱 / 工具调用 / Multi-Agent / MCP / 推理框架 / ...
- ==所有结论==基于 grep 实际源码，==附文件路径==

==与主文档的关系==：

| 位置 | 内容 |
|------|------|
| ==主文档==（如 `Agent Memory 系统.md`） | 概念 / 方法论 / 通用思路 |
| ==本目录==（如 `Memory 实现对比.md`） | 四项目==实际怎么做==（源码级） |

==读者按需选==：学概念 → 主文档；学实现 → 本目录。

## 允许的内容

| 内容类型 | 说明 |
|---------|------|
| ==四项目源码级对比== | 每个项目一节，附源码路径 |
| ==横向对比表== | 多维度对照（事实而非推测） |
| ==设计哲学分析== | 每个项目"==为什么==这么做" |
| ==选型决策树== | "你做项目该选哪种" |
| ==关键认知==（3-6 条） | 最值得记住的点 |

## 禁止的内容

- ❌ ==重复主文档的概念解释==（概念去主文档读）
- ❌ ==推测性描述==（==没源码就标"未验证"==或省略）
- ❌ ==单方面褒贬==（==每个项目都有它的设计前提==）
- ❌ ==项目特定的 PaiCli / Baize 实现==（去对应项目目录）

## 命名规范

- ==文件名==：`<话题> 实现对比.md`（如 `Memory 实现对比.md`、`Compaction 实现对比.md`）
- ==无日期前缀==——本目录不按时间组织
- ==索引==文件叫 `索引.md`（仅做导航 + 计划清单）

## Frontmatter 必备字段

```yaml
---
module: Agent
tags: [Agent, <话题名>, 实现对比, Claude Code, Codex, Hermes, OpenClaw]
difficulty: hard
last_reviewed: YYYY-MM-DD
---
```

==`tags` 必须包含== `实现对比` + 四个项目名（让搜索能聚合）。

## 文档结构（每篇对比文档遵循）

```markdown
# <话题> 实现对比 — Claude Code / Codex / Hermes / OpenClaw

> 一句话定位 + 链接到主文档

## 文档说明
- 数据来源（项目 / 源码位置 / 验证方式）

## 一、各项目架构总览
- 多维度对比表

## 二、Claude Code 的<风格名>
- 源码定位
- 核心机制（含源码原文引用）
- 关键常量 / API
- 设计哲学

## 三、Codex CLI 的<风格名>
（同结构）

## 四、Hermes 的<风格名>
（同结构）

## 五、OpenClaw 的<风格名>
（同结构）

## 六、横向对比表（多维度）

## 七、选型决策树

## 八、关键认知（3-6 条）

## 相关链接
- 主文档
- 索引
```

## 数据可信度三档（必标）

| 标记 | 含义 |
|------|------|
| ✅ ==源码验证== | 我从源码里 grep 到的，附文件路径+行号 |
| ⚠️ ==文档/博客== | 来自官方公开文档，未在源码验证 |
| ❓ ==推测== | 没有直接证据，==合理推断==（少用，且必须明确标注） |

## 四个项目的源码位置（可 grep 验证）

| 项目 | 源码位置 | 验证方式 |
|------|--------|--------|
| Claude Code | `/home/ubuntu/ADgai/dsq/Obsidian/claude-code-sourcemap/restored-src/` | npm v2.1.88 sourcemap 还原 4756 文件 |
| Codex CLI | `/home/ubuntu/ADgai/dsq/Obsidian/codex/codex-rs/` | OpenAI 官方开源 |
| Hermes | `/home/ubuntu/ADgai/dsq/Obsidian/hermes-agent/agent/` | Nous Research 官方开源 |
| OpenClaw | `/home/ubuntu/ADgai/dsq/Obsidian/openclaw/extensions/memory-core/` | 官方开源 |

==Agent 写新对比文档时==：
1. 在四个仓库 grep 关键代码
2. 引用源码原文（用 ``` 代码块或 `>` 引用块）
3. 附文件路径（如 `services/compact/autoCompact.ts:78`）

## 写作工作流（Agent 操作步骤）

```
1. 读本 WORKSPACE.md(本文件)
2. 读 索引.md(看已有 + 计划)
3. 在四个仓库 grep 该话题相关代码:
     find <仓库> -name "*<keyword>*" -type f
     grep -rln "<keyword>" <仓库>
4. 读核心实现文件,提取:
     - 关键类名 / 函数 / 常量
     - 头部注释(一手设计意图)
     - 数据流 / 时序
5. 按 §"文档结构" 写对比文档
6. 数据可信度三档标注
7. 在 索引.md 增加一行(状态: 已完成 / 待做)
8. 在主文档加 callout 指向新对比文档
```

## 与索引.md 的分工

| 文件 | 职责 |
|------|------|
| ==WORKSPACE.md==（本文件） | ==规范 / 契约== — 怎么写、写什么、不写什么 |
| ==索引.md== | ==导航 / 状态== — 已有哪些、计划做哪些、链接到具体文档 |

## 与主 Agent 文档的链接规范

每个对比文档的"相关链接"必须有：

1. ==[[主文档]]== — 概念入门
2. ==[[索引]]== — 本目录导航
3. ==[[Agent索引_MOC]]== — Agent 知识体系入口
