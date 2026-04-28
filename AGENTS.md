# Obsidian Vault Operating Schema

This vault is maintained as a persistent knowledge base. Treat the existing note hierarchy as the wiki layer and keep raw sources immutable.

## Layers

- Raw sources: `raw/` holds imported or clipped material. Do not rewrite source files unless the user explicitly asks.
- Wiki: `wiki/` is the main knowledge layer. Prefer a flat structure where each topic is a first-class page directly under `wiki/`.
- Optional support: `templates/` for note templates.
- Legacy folders under `wiki/` may exist from older organization and can be merged into flat topic pages incrementally.

## Canonical flows

## Raw Sources Management (原始文档管理)

### Directory Structure

```
raws/
├── inbox/           # 新导入的原始文件（未分类）
├── staged/          # 已分类待整理（按主题分类）
│   ├── rag/
│   ├── agent/
│   ├── java/
│   ├── mysql/
│   ├── redis/
│   ├── spring/
│   └── project/     # 项目相关（如 PaiSmart）
├── processed/       # 已整理完成
└── archive/         # 不需要整理的存档
```

### Frontmatter Schema

每个 raw 文件必须包含以下 frontmatter 字段：

```yaml
---
title: "文章标题"
source: "原文链接"
author: "作者"
published: 2026-04-27
created: 2026-04-27
status: inbox | staged | processed | archived
category: rag | agent | java | mysql | redis | spring | project
priority: high | medium | low
extracted_to: ["wiki/RAG/xxx.md", "wiki/Agent/yyy.md"]
notes: "简短备注"
description: "文章描述"
tags:
  - "clippings"
---
```

### Agent Workflow 1: Raw Intake（原始文档接收）

**触发时机**：用户将新文件放入 `raws/inbox/` 或明确要求分类

**工作流程**：
1. 扫描 `raws/inbox/` 目录，列出所有未分类的 `.md` 文件
2. 逐个读取文件，分析标题、描述和内容前 500 字
3. 根据关键词推断分类（category）：
   - RAG: 检索、向量、Embedding、知识库、文档解析、召回、重排
   - Agent: 智能体、Harness、Memory、Skills、MCP、工作流、ReAct
   - Java: Java、JVM、集合、并发、线程池、HashMap
   - MySQL: MySQL、数据库、索引、事务、锁、MVCC
   - Redis: Redis、缓存、持久化、分布式锁
   - Spring: Spring、SpringBoot、IoC、AOP、微服务
   - Project: 派聪明、PaiSmart、Baize、具体项目名
4. 向用户展示分类建议，等待确认
5. 确认后：
   - 更新文件的 frontmatter（status: staged, category: xxx）
   - 移动文件到 `raws/staged/{category}/`
6. 生成分类报告

**输出示例**：
```
已分类 15 个文件：
  - RAG: 8 个
  - Agent: 3 个
  - Project: 4 个

待处理文件：
  - staged/rag/: 36 个
  - staged/agent/: 5 个
  - staged/project/: 21 个
```

### Agent Workflow 2: Content Extraction（内容提取）

**触发时机**：用户明确要求整理某个 staged 文件，或执行批量整理命令

**工作流程**：
1. 读取指定的 `staged/` 文件（一次只处理一个）
2. 按照 `feedback_raw_organize.md` 的规范提取核心内容：
   - **记录研究解决了什么问题**：现有技术痛点 + 该研究如何解决 + 核心创新点
   - **项目链接必须保留**：GitHub、论文地址放在内容后面
   - **不记录使用教程**：跳过安装命令、代码示例、软硬件要求
   - **数据来源必须标注链接**：实验数据、性能数字标注来源 `> 数据来源：[文章标题](source URL)`
3. 生成提取预览，向用户展示：
   - 提取的核心内容（Markdown 格式）
   - 建议写入的 wiki 文件路径
   - 建议的章节位置
4. 等待用户确认（必须人工审核）
5. 确认后：
   - 将内容写入对应的 wiki 文件
   - 更新 raw 文件的 frontmatter（status: processed, extracted_to: ["wiki/xxx.md"]）
   - 移动文件到 `raws/processed/`
   - 在 `优化记录.md` 中追加变更日志
6. 如果用户拒绝，修改提取内容并重新预览

**重要原则**：
- **一篇一篇来**：绝不批量整理，每篇都需要用户审核
- **逐步确认**：先汇报核心内容和整理方向，确认后再写入
- **质量优先**：宁可慢，不可错

### Agent Workflow 3: Quality Check（质量检查）

**触发时机**：用户明确要求质量检查，或定期执行（如每周一次）

**检查项目**：

1. **链接完整性检查**：
   - 扫描所有 `wiki/` 文件中的 `[[...]]` 链接
   - 检测断链（目标文件或锚点不存在）
   - 检测嵌套链接（`[[xxx|[[yyy]]]]`）
   - 生成断链报告

2. **内容重复检查**：
   - 检测跨文件的相似段落（使用简单的文本相似度）
   - 标记可能的重复内容
   - 建议合并或使用 `[[]]` 引用

3. **结构一致性检查**：
   - 检查算法题解是否遵循统一的标题结构（`### 题目名称` → `#### 解题思路` → `#### 代码实现` → `#### 复杂度分析`）
   - 检查面试题解是否遵循 `###` 主题目 + `####` 子题目结构
   - 检查是否有孤立的加粗标签（`**题目**`）

4. **面试题目同步检查**：
   - 扫描所有 wiki 文件中的面试题解（`###` 或 `####` 标题）
   - 检查 `wiki/面试题目.md` 中是否有对应的 checklist 条目
   - 检查 checklist 中的锚点链接是否准确
   - 检测重复题目

5. **孤岛页面检测**：
   - 检测没有任何入站链接的 wiki 文件
   - 建议在 `wiki/index.md` 或相关 MOC 页面中添加链接

6. **优化记录完整性**：
   - 检查最近 7 天是否有 wiki 文件变更但未记录在 `优化记录.md`
   - 使用 `git log` 对比

**输出示例**：
```
=== 质量检查报告 ===

[断链] 发现 3 处断链：
  - wiki/Redis/缓存经典问题.md:45 → [[不存在的文件]]
  - wiki/面试题目.md:120 → [[MySQL篇#不存在的锚点]]

[重复内容] 发现 2 处可能重复：
  - wiki/RAG/检索召回与优化.md 与 wiki/Agent/Agent工程实践.md 
    相似段落：Embedding 三代演进（建议使用引用）

[结构问题] 发现 1 处结构不一致：
  - wiki/算法/动态规划.md:67 使用了旧的加粗标签 **题目**

[面试题目] 发现 2 处未同步：
  - wiki/Spring/AOP 与动态代理.md:34 的题目未添加到面试题目.md

[孤岛页面] 发现 1 个孤岛：
  - wiki/临时笔记.md（无入站链接）
```

### Agent Workflow 4: Cross-Link Builder（交叉链接构建）

**触发时机**：用户明确要求构建交叉链接，或在质量检查后执行

**工作流程**：
1. 扫描所有 `wiki/` 文件，提取关键概念和实体
2. 分析概念之间的语义关联：
   - 同义词（如 "并发" 和 "多线程"）
   - 上下位关系（如 "HashMap" 是 "集合框架" 的一部分）
   - 对比关系（如 "悲观锁" vs "乐观锁"）
   - 依赖关系（如 "Spring AOP" 依赖 "动态代理"）
3. 生成双向链接建议：
   - 在文件 A 中提及概念 X 时，建议链接到文件 B
   - 在文件 B 中添加反向链接到文件 A
4. 向用户展示建议，等待确认
5. 确认后批量插入链接（使用 `[[文件名#锚点|显示文本]]` 格式）
6. 更新 `优化记录.md`

**输出示例**：
```
=== 交叉链接建议 ===

[1] wiki/MySQL/锁与事务机制.md:67
  "悲观锁和乐观锁" → 建议链接到 [[并发编程/锁#悲观锁与乐观锁|悲观锁和乐观锁]]

[2] wiki/并发编程/锁.md:120
  建议添加反向链接：MySQL 中的锁机制 → [[MySQL/锁与事务机制]]

[3] wiki/Spring/AOP 与动态代理.md:45
  "反射" → 建议链接到 [[Java基础/反射与注解#反射机制|反射]]
```

## Human-in-the-loop default

- For source ingest, default to preview-only mode.
- Never batch-write all extracted content at once.
- Read and present one small section at a time for user verification.
- Only write to wiki files after explicit user confirmation for that section.
- If the user rejects a section, revise and re-preview instead of writing.

### Ingest

1. Read one source at a time.
2. Extract the key claims, entities, concepts, open questions, and any contradictions.
3. Update or create the relevant wiki pages.
4. Update the index and append a log entry.
5. Keep source material intact and separate from synthesis.

### Query

1. Read the index first.
2. Drill into the most relevant pages.
3. Synthesize an answer with markdown links back into the wiki.
4. If the answer is durable, file it back into the wiki as a page instead of leaving it only in chat.

### Lint

1. Look for contradictions between pages.
2. Look for stale claims that newer notes supersede.
3. Look for orphan pages, missing cross-links, and thin pages that should be expanded.
4. Prefer adding structure and links over deleting content.

## Page conventions

- **知识颗粒度（适度拆分原则）**：为了方便阅读、学习和建立知识体系，不要拆分得过细（避免产生只有几行字的孤立碎片），也不要保留上万字的巨型文档。推荐采用**“主题聚类（Concept-Cluster）”**的颗粒度。例如将 `List体系` 作为一个文件（内含 ArrayList、LinkedList 及其对比），而不是拆成四五个小文件。对于异常庞大且极具重点的主题（如 `HashMap核心原理`），则应当独立成篇。
- **目录思维（MOC）**：在分类文件夹中，配合一个 `Index` 或 `MOC`（Map of Content）页面，将分散的知识点按照学习顺序串联起来。
- Keep page titles stable and descriptive.
- Use short frontmatter only when it helps automation or filtering.
- Prefer one-page-per-topic and keep all topic pages under `wiki/` or categorized folders according to user preference.
- Treat Q&A, summaries, and notes as the same kind of knowledge artifact. Do not enforce separate `questions` or `notes` categories.

## Interview Q&A Conventions (面试题解维护规范)

- **三步同步**：每次在 wiki 文件中新增或修改面试题解，必须同步完成以下三步：
  1. 在对应 wiki 文件中编写题解（`###` 主题目，`####` 子题目）
  2. 在 `wiki/面试题目.md` 对应模块下追加 checklist 条目：`- [ ] 题目 ➡️ 👉 [[文件名#标题|查看核心解析]]`
  3. 在根目录 `优化记录.md` 当天日期下追加变更日志
- **链接精确性**：checklist 中的 `[[文件名#标题]]` 锚点必须与 wiki 文件中的实际标题完全一致，包括空格和标点。
- **去重检查**：新增条目前，先检查 `面试题目.md` 中是否已存在相同或近似题目，避免重复录入。
- **模块归属**：题目必须归入正确的模块分类（并发编程、JVM、集合框架、Spring、Redis、计算机网络、MySQL 基础与底层等），不得混放。

## Algorithm Notes Conventions (算法笔记生成与排版规范)

- **结构大一统**：绝不使用陈旧的加粗标签（如 `**题目**`）。严格采用以下 Markdown 标题层级结构写题解：
  - `### 题目名称`
  - `#### 解题思路`（必须包含直观的物理隐喻和坑点揭秘）
  - `#### 代码实现`（需标明解法版本，如基础版/优化版）
  - `#### 复杂度分析`（严禁遗漏，需详细点出空间优化点和时间来源）
- **教学循序渐进（Progressive Disclosure）**：绝不能为了秀代码简短而一步到位直接给出空间极致优化的代码（如 $O(1)$ 原地篡改或 1D 滚动数组）。初次展示**必须是**最常规、符合直觉的基础解法（如经典的 2D DP 打表矩阵），然后再以“进阶”形式铺出降维优化版。
- **物理隐喻与大白话解析**：讲解核心逻辑时，大量使用直观的比喻（如“洋葱模型”、“武林淘汰赛”），讲透死循环、边界坑、以及“为什么要用 `n+1` 数组防越界”等极其本质的原因。段落化自然拆解，不要堆叠断句条目。
- **避免孤岛与双向链接 (Cross-Linking)**：当碰到诸如《最长回文子串》（既可用区间 DP，也可双指针）等多面型题目时，必须在不同的 Markdown 页面以锚点形式（`[[文件名#对应的标题]]`）留下**双向链接**。明确告知学习者该方案的平替最优解在哪个文件。
- **强制更新工作流**：每次解答完问题、重构了笔记排版，**必须**同步将详细的改动项与总结的知识心得（类似”知识串联”或”教学改进”）写入根目录的 `优化记录.md` 中。
- **优化记录格式规范**：每条记录统一为两行结构，聚焦”改了什么”和”为什么改”：
  ```
  - `文件路径` — 一句话描述改动内容
    **原因**：一句话描述改动原因
  ```
  同一天、同一文件的多项改动可合并为一条。避免冗长的修辞和重复描述。

## Copilot & Tooling Lessons Learned (Do Not Repeat)

- **PowerShell Encoding**: When generating or executing multi-line Node.js scripts via the PowerShell terminal pipeline (`echo ... > script.js`), PowerShell defaults to UTF-16-LE with BOM, which inherently breaks Node.js parsing (`SyntaxError`). **Always use `create_file` or edit tools to write scripts**, do not write them via shell echoing streams.
- **Markdown Global Search/Replace**: When performing mass text operations on the Obsidian workspace (such as inserting `[[...]]` links or editing headings), never blindly use global regex loops across the whole file. Always split the text strictly by code blocks (` ``` ` and `` ` ``) or use Markdown AST parsing to avoid breaking explicit code snippets and URLs.
- **Strict Data Validation**: When proving no data was lost during mass file splitting, character-by-character validation (by stripping numbers and whitespace: `/[^a-zA-Z\u4e00-\u9fa5]/g`) works perfectly. However, always remember that `fs.readdirSync()` returns files **alphabetically**, which will fail linear character sequence validation against the original monolithic file. You must reconstruct the concatenated text in the *exact chronological order* the original file was partitioned.
- **Git Operations & Uploads**: Do NOT proactively run `git push`, `git commit`, or attempt to upload updates yourself. Your role is strictly to update the documentation and files locally. The user will take full responsibility for uploading and syncing changes via Git.
- **Backtick / AST Escaping in PowerShell**: Beware of passing raw Markdown strings containing syntax blocks (```) directly into `node -e` or PowerShell commands, as they will almost always break shell escaping. Use `fs.writeFileSync()` via a standalone JS script or directly use the `create_file` / `replace_string_in_file` tools.
- **Update Automations**: Whenever performing major codebase refactoring (e.g. changing coding languages, re-grouping files, or reformatting), **always** automatically update `README.md` and append a log entry to `优化记录.md` without waiting for the user to tell you.

## Starting point for this vault

- The Java and JVM notes already act as the core wiki content.
- Start from `wiki/Java基础篇.md` as the current primary page.
