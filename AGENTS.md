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

## Copilot & Tooling Lessons Learned (Do Not Repeat)

- **PowerShell Encoding**: When generating or executing multi-line Node.js scripts via the PowerShell terminal pipeline (`echo ... > script.js`), PowerShell defaults to UTF-16-LE with BOM, which inherently breaks Node.js parsing (`SyntaxError`). **Always use `create_file` or edit tools to write scripts**, do not write them via shell echoing streams.
- **Markdown Global Search/Replace**: When performing mass text operations on the Obsidian workspace (such as inserting `[[...]]` links or editing headings), never blindly use global regex loops across the whole file. Always split the text strictly by code blocks (` ``` ` and `` ` ``) or use Markdown AST parsing to avoid breaking explicit code snippets and URLs.
- **Strict Data Validation**: When proving no data was lost during mass file splitting, character-by-character validation (by stripping numbers and whitespace: `/[^a-zA-Z\u4e00-\u9fa5]/g`) works perfectly. However, always remember that `fs.readdirSync()` returns files **alphabetically**, which will fail linear character sequence validation against the original monolithic file. You must reconstruct the concatenated text in the *exact chronological order* the original file was partitioned.
- **Git Operations & Uploads**: Do NOT proactively run `git push`, `git commit`, or attempt to upload updates yourself. Your role is strictly to update the documentation and files locally. The user will take full responsibility for uploading and syncing changes via Git.
- **Backtick / AST Escaping in PowerShell**: Beware of passing raw Markdown strings containing syntax blocks (```) directly into `node -e` or PowerShell commands, as they will almost always break shell escaping. Use `fs.writeFileSync()` via a standalone JS script or directly use the `create_file` / `replace_string_in_file` tools.
- **Update Automations**: Whenever performing major codebase refactoring (e.g. changing coding languages, re-grouping files, or reformatting), **always** automatically update the progress tracking flags in `README.md`, `OPS-导入进度.md`, and `HANDOVER.md` without waiting for the user to tell you.

## Starting point for this vault

- The Java and JVM notes already act as the core wiki content.
- Start from `wiki/Java基础篇.md` as the current primary page.
