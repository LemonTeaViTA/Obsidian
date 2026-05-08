# Raw 文档整理指南

本文件专注于 `raws/` 目录的操作流程。通用规范（Boundaries、面试题目同步、格式检查）见 `AGENTS.md`。

## 目录结构

```
raws/
├── inbox/           # 新导入的原始文件（未分类）
├── staged/          # 已分类待整理
│   ├── rag/
│   ├── agent/
│   ├── java/
│   ├── mysql/
│   ├── redis/
│   ├── spring/
│   └── project/
├── processed/       # 已整理完成
└── archive/         # 不需要整理的存档
```

---

## 整理流程

```
inbox → 分类到 staged/{category} → 逐篇提取到 wiki → 移到 processed
```

### Step 1：分类

将 `inbox/` 中的文件按内容移动到 `staged/` 对应子目录。

### Step 2：提取

逐篇阅读 staged 文件，提取有价值的知识点写入对应 wiki 文件。

**提取原则**：
- 一次只处理一个文件
- 只提取核心知识（跳过教程、安装命令、个人经验）
- 保留数据来源和项目链接
- 不记录使用教程

### Step 3：同步

按 `AGENTS.md` 中"当你新增面试题解时"的流程完成同步（wiki → 面试题目.md → 优化记录.md）。

### Step 4：归档

完成后将 staged 文件移到 `processed/`。

---

## 完整性检查

定期执行，确保知识库没有缺漏：

**检查 A：面试题目 → wiki**
```bash
# 找出没有 wikilink 的面试题目（= wiki 中缺答案）
grep -n '^\- \[ \]' wiki/面试题目.md | grep -v '➡️'
```

**检查 B：wiki → 面试题目**
- 遍历 wiki 文件中的 `###` 题解标题
- 检查是否都在 `面试题目.md` 中有对应条目

**检查 C：断链检测**
```bash
# 提取所有 wikilink 目标，检查文件是否存在
grep -roh '\[\[[^\]]*\]\]' wiki/ | sed 's/\[\[//;s/\]\]//' | cut -d'|' -f1 | cut -d'#' -f1 | sort -u > /tmp/linked.txt
```

---

## 防误删机制

1. 删除超过 10 行的内容前先确认（见 `AGENTS.md` Boundaries）
2. 编辑后验证标题层级：`grep -n "^## \|^### " 文件路径`
3. 大段删除用 Python 脚本按行号操作

---

**参考**：
- [AGENTS.md](AGENTS.md) — 通用操作规范
- [QUALITY_CHECKLIST.md](QUALITY_CHECKLIST.md) — 质量检查清单
