# Wiki 质量检查清单

每季度全量审计一次，批量修改后按需抽查。

---

## 1. 链接完整性

- [ ] 所有 `[[...]]` 内部链接指向存在的文件
- [ ] 所有锚点链接（`[[文件#标题]]`）的标题存在
- [ ] 没有嵌套链接（`[[xxx|[[yyy]]]]`）
- [ ] 重要外部链接（GitHub、论文）每季度抽查

```bash
# 断链检测
grep -roh '\[\[[^\]]*\]\]' wiki/ | sed 's/\[\[//;s/\]\]//' | cut -d'|' -f1 | cut -d'#' -f1 | sort -u > /tmp/linked.txt
# 嵌套链接
grep -rn '\[\[[^\]]*\[\[' wiki/
```

## 2. 内容质量

- [ ] 没有明显的内容重复（相似度 > 80%）
- [ ] 重复内容已用 `[[]]` 引用替代
- [ ] 引用数据时注明来源（非强制）
- [ ] 项目链接（GitHub、论文）已保留
- [ ] 没有使用教程、安装命令等无关内容

## 3. 结构一致性

**算法题解**（`wiki/算法/`）：
- [ ] 标题结构：`### 题目` → `#### 解题思路` → `#### 代码实现` → `#### 复杂度分析`
- [ ] 先基础解法再优化版，含物理隐喻
- [ ] 多解法题目有双向链接

**面试题解**（其他 wiki 目录）：
- [ ] 标题结构：`###` 主题目 + `####` 子题目
- [ ] 标题中没有嵌入链接或加粗
- [ ] 每个题解有清晰的问题和答案

## 4. 面试题目同步

- [ ] `面试题目.md` 中所有条目都有对应 wiki 题解
- [ ] 所有 wiki 题解都在 `面试题目.md` 中有条目
- [ ] 锚点与实际标题完全一致
- [ ] 没有重复题目
- [ ] 题目归入正确的模块分类

```bash
# 检查无链接的条目
grep -n '^\- \[ \]' wiki/面试题目.md | grep -v '➡️'
```

## 5. 可发现性

- [ ] 没有孤岛页面（至少有一个入站链接）
- [ ] 新文件被 `面试题目.md` 或相关 wiki 文件引用
- [ ] 相关概念之间有双向链接
- [ ] 文件末尾有"## 相关链接"区块

```bash
# 查找孤岛页面
grep -roh '\[\[[^\]]*\]\]' wiki/ | sed 's/\[\[//;s/\]\]//' | cut -d'|' -f1 | cut -d'#' -f1 | sort > /tmp/linked.txt
find wiki/ -name "*.md" | xargs -I{} basename {} .md | sort > /tmp/all.txt
comm -23 /tmp/all.txt /tmp/linked.txt
```

## 6. 格式与 Obsidian 风格

> ==格式规则==的 single source of truth 是 [[OBSIDIAN_STYLE]]。==本节只列==必检项 + 自动化命令。

### 6.1 必检项

- [ ] ==Frontmatter==：4 字段齐全（`module` / `tags` / `difficulty` / `last_reviewed`）
- [ ] ==高亮密度==：单 `###` 下 ≤ 3 处
- [ ] ==Callout==：只用 tip/info/note/warning/danger 五种，无连续两个，无嵌套
- [ ] ==代码块==：都有语言标签（java/bash/yaml 等），前后有空行
- [ ] ==标题==：层级不跳级，无 `[[]]` / `**加粗**`
- [ ] ==编码==：无 UTF-8 损坏字符（U+FFFD）

==详细规则==见 [[OBSIDIAN_STYLE]]。

### 6.2 自动化命令

```bash
# 编码检查(必跑)
grep -rn $'\xef\xbf\xbd' wiki/

# Frontmatter 完整性
head -5 wiki/模块/文件.md | grep -q "last_reviewed"

# Callout 嵌套检查(应该 0 行)
grep -rn '> > \[!' wiki/
```

## 7. 变更记录

- [ ] 最近 7 天的 wiki 变更都记录在 `优化记录.md`
- [ ] 格式统一（`文件路径` — 描述 + 原因）
- [ ] 同一天同一文件的改动已合并

## 8. Raw 文件管理

- [ ] `raws/inbox/` 为空或只含待分类文件
- [ ] `raws/staged/` 文件已分类到正确子目录
- [ ] `raws/processed/` 文件标记为 `status: processed`

---

## 自动化工具

```bash
# 校验单个文件
bash .claude/scripts/validate-md.sh wiki/模块/文件.md

# 批量校验
find wiki/JVM -name "*.md" | xargs -I{} bash .claude/scripts/validate-md.sh {}

# 统计面试题目总数
grep -c "^\- \[ \]" wiki/面试题目.md
```

---

## 质量目标

| 指标 | 目标 |
|------|------|
| 链接完整性 | 100%（零断链） |
| 面试题目同步率 | 100% |
| 孤岛页面 | < 5% |
| 内容重复率 | < 10% |
| 变更记录覆盖率 | > 95% |

---

## 检查记录

每次全量审计后在此记录。

<!-- 格式：
### YYYY-MM-DD
- ✅ / ⚠️ 检查项：结论
-->


