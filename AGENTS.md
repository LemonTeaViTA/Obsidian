# Obsidian 知识库操作规范

个人学习和求职准备知识库，包含 Java 后端、算法、RAG、Agent 方向的面试题解和知识整理。

## 目录结构

```
wiki/                  # 正式知识内容
├── Java基础/
├── JVM/
├── 并发编程/
├── 集合框架/
├── Spring/
├── MySQL/
├── Redis/
├── RAG/
├── LLM/
├── Baize项目/         # 个人项目（RAG 知识库系统，ES + Kafka + MinIO）
├── 算法/
├── 项目/
├── 汇总文档/
├── 面试题目.md        # 所有面试题的 checklist 索引（约 325 道）
└── Git.md

raws/                  # 原始文档（待整理）
├── inbox/             # 新导入，待分类
├── staged/            # 已分类，待整理
└── processed/         # 已整理完成

优化记录.md            # 变更日志
OBSIDIAN_STYLE.md      # 格式规范
QUALITY_CHECKLIST.md   # 质量检查清单
RAW_WORKFLOW_GUIDE.md  # Raw 文档整理指南
```

---

## Boundaries

### Always do

- 修改 wiki 文件后更新 frontmatter 的 `last_reviewed` 为今天
- 新增题解后同步 `wiki/面试题目.md`（加 checklist 条目 + wikilink）
- 写入内容后检查编码：`grep -n $'\xef\xbf\xbd' 文件路径`
- 新增内容前确认无重复章节
- 变更后在 `优化记录.md` 当天日期下追加日志

### Ask first

- 删除超过 10 行的内容
- 合并或拆分已有 wiki 文件
- 修改面试题目.md 的模块分类结构
- 修改 OBSIDIAN_STYLE.md 或本文件的规则

### Never do

- 标题内嵌入 `[[...]]` 链接或 `**加粗**`（导致锚点匹配失败）
- 用 Edit 工具做大段删除（用 Python 脚本按行号操作）
- 凭记忆猜测日期（必须从系统上下文读取）
- 在算法题解以外的地方写算法题（算法题只放 `wiki/算法/`）
- 跳过编码检查直接提交

---

## 当你修改/新建 wiki 文件时

1. 确认 frontmatter 四字段齐全：`module`, `tags`, `difficulty`, `last_reviewed`
2. 遵循标题层级：`##` 主题分组 → `###` 具体题目 → `####` 子问题
3. 知识颗粒度：主题聚类（如 `List体系.md` 包含 ArrayList + LinkedList + 对比），不拆碎片也不堆万字
4. 对照 `OBSIDIAN_STYLE.md` 快速自检：高亮 ≤ 3 处/节，callout 不连续，wikilink 有效
5. 检查编码：`grep -n $'\xef\xbf\xbd' 文件路径`

**完成标准**：
```bash
# 验证 frontmatter 存在
head -5 wiki/模块/文件.md | grep -q "last_reviewed"
# 验证无损坏字符
grep -c $'\xef\xbf\xbd' wiki/模块/文件.md  # 应输出 0
```

---

## 当你新增面试题解时

1. 在对应 wiki 文件中写题解（`###` 主题目，`####` 子题目）
2. 在 `wiki/面试题目.md` 对应模块下追加：
   ```
   - [ ] 题目 ➡️ 👉 [[文件名#标题|查看核心解析]]
   ```
3. 锚点必须与 wiki 文件中的实际标题完全一致（含空格和标点）
4. 在 `优化记录.md` 当天日期下追加日志

**完成标准**：
```bash
# 验证锚点有效（标题存在于目标文件）
grep -q "### 你写的标题" wiki/模块/文件.md
# 验证面试题目.md 已更新
grep -q "题目关键词" wiki/面试题目.md
```

---

## 当你整理 raw 文档时

流程：`raws/staged/分类/文件` → 提取知识到 wiki → 移到 `raws/processed/`

1. 一次只处理一个文件
2. 只提取核心知识（跳过教程、安装命令、个人经验）
3. 保留数据来源和项目链接
4. 完成后按"新增面试题解"流程同步

详细操作见 `RAW_WORKFLOW_GUIDE.md`。

---

## 当你写优化记录时

- 先确认当前日期（从系统上下文读取）
- 新记录插入文件顶部（`# 知识库优化记录` 标题后）
- 格式：`- \`文件路径\` — 改动描述` + `**原因**：原因描述`
- 同一天同一文件的多项改动合并为一条

---

## 当你写算法笔记时

标题层级：
- `### 题目名称`
- `#### 解题思路`（含物理隐喻和坑点）
- `#### 代码实现`（基础解法 → 进阶优化）
- `#### 复杂度分析`（不能遗漏）

多解法题目必须在不同页面留双向链接。

---

## 防误操作

批量编辑后验证：
```bash
# 检查面试题目.md 标题层级完整
grep -n "^## \|^### " wiki/面试题目.md | tail -20
# 检查题目总数
grep -c "^\- \[ \]" wiki/面试题目.md
```

大段删除用 Python 脚本按行号操作，不用 Edit 工具。

---

> 目录结构和题目数量应在每次大批量修改后同步更新本文件。
