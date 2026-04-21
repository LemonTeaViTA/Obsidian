# Obsidian Vault Operating Schema

This vault is maintained as a persistent knowledge base. Treat the existing note hierarchy as the wiki layer and keep raw sources immutable.

## Layers

- Raw sources: `raw/` holds imported or clipped material. Do not rewrite source files unless the user explicitly asks.
- Wiki: `wiki/` is the main knowledge layer. Prefer a flat structure where each topic is a first-class page directly under `wiki/`.
- Optional support: `templates/` for note templates.
- Legacy folders under `wiki/` may exist from older organization and can be merged into flat topic pages incrementally.

## Canonical flows

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
