# Raw 文档整理指南

> ==高层流程概述==——具体规则 / 步骤 / 整理原则的 single source of truth 是 [[raws/WORKSPACE]]。
>
> ==Agent 进入 raws/ 操作前==必须先读 ==`raws/WORKSPACE.md`==——它就是==给 Agent 看的契约==。

---

## 流程总览

```
inbox/Clippings/  →  staged/<category>/  →  wiki/  →  processed/
       ↑分类             ↑逐篇整理            ↑写入后移走
```

==4 个阶段==：

| 阶段 | 位置 | 含义 |
|------|------|------|
| ==1. 接收== | `raws/inbox/` | 新导入未分类（Web Clipper 默认输出） |
| ==2. 分类== | `raws/staged/{category}/` | 按主题（rag / agent / java / ...）分类 |
| ==3. 整理== | 提取知识到 `wiki/` | ==逐篇==，==非批量== |
| ==4. 归档== | `raws/processed/` | 整理完成的原始文件留作追溯 |

---

## 关键原则（==必读==）

==整理细则、Frontmatter、归属判断==等所有具体规则==都在== [[raws/WORKSPACE]]。==本文不重复==。

==最关键的 3 条==：

1. ==一篇一篇来==——==不批量==
2. ==只提取核心知识==——跳过教程 / 安装命令 / 营销文案
3. ==保留数据来源链接==——`> 数据来源：[标题](URL)`

---

## 操作前必看

| 文档 | 用途 |
|------|------|
| [[raws/WORKSPACE]] | ==raws/ 工作区契约==（==必读==） |
| [[AGENTS]] §当你整理 raw 文档时 | 仓库级操作规范 |
| [[QUALITY_CHECKLIST]] | 整理后的质量检查 |
| [[OBSIDIAN_STYLE]] | wiki 写作格式 |

---

## 防误删机制

1. 删除超过 10 行的内容前先确认（见 [[AGENTS]] Boundaries）
2. 编辑后验证标题层级：`grep -n "^## \|^### " 文件路径`
3. 大段删除用 Python 脚本按行号操作

---

## 完整性检查（每月一次）

```bash
# A. 找出没有 wikilink 的面试题目（= wiki 缺答案）
grep -n '^\- \[ \]' wiki/面试题目.md | grep -v '➡️'

# B. 断链检测
grep -roh '\[\[[^\]]*\]\]' wiki/ | sed 's/\[\[//;s/\]\]//' | cut -d'|' -f1 | cut -d'#' -f1 | sort -u
```

---

==所有详细规则==去 [[raws/WORKSPACE]]——==那是唯一来源==。
