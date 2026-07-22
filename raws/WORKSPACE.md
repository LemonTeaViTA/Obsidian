# raws 工作区操作契约

> `raws/` 只存待整理和已归档的原始材料；正式知识必须写入 `wiki/`。进入本目录操作前，先读根目录 `AGENTS.md`。

## 目录与状态

```text
inbox/              新导入、尚未分类
  -> staged/<分类>/ 已分类、等待逐篇整理
  -> processed/     已提取知识、保留用于追溯
```

原始材料默认不提交到 Git，仓库只跟踪本契约和三个目录骨架。

## 整理流程

1. 一次只处理 `staged/` 中的一个文件，先确认目标 wiki 没有重复章节。
2. 只提取核心知识，跳过安装步骤、营销内容、流水账和缺少普适价值的个人经验。
3. 把知识写入对应 `wiki/<模块>/` 文档；新增面试考点时同步该模块 `_MOC.md`。
4. 保留原文标题、来源 URL 和必要的项目链接，不把无法核实的说法改写成确定事实。
5. 完成 frontmatter、链接、编码和内容检查后，把原文件移入 `processed/`。
6. 在根目录 `优化记录.md` 的当天日期下记录本次提取。

## 写入要求

- wiki frontmatter 必须包含 `module`、`tags`、`difficulty`、`last_reviewed`。
- 标题层级、Callout、高亮和 wikilink 遵循 `OBSIDIAN_STYLE.md`。
- 新增面试题解使用 `###` 主题目与 `####` 子题目，不在算法模块之外写算法题。
- 数据来源统一写成 `> 数据来源：[标题](URL)`；多个来源可使用列表。

## 完成检查

```bash
# 检查目标文件没有损坏字符
grep -n $'\xef\xbf\xbd' wiki/模块/文件.md

# 检查全库链接和编码
bash wiki审计/check.sh --links
bash wiki审计/check.sh --encoding
```

只有以上检查通过，原始文件才能从 `staged/` 移到 `processed/`。
