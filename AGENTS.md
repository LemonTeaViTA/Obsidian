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

- Keep page titles stable and descriptive.
- Use short frontmatter only when it helps automation or filtering.
- Prefer one-page-per-topic and keep all topic pages under `wiki/`.
- Treat Q&A, summaries, and notes as the same kind of knowledge artifact. Do not enforce separate `questions` or `notes` categories.

## Starting point for this vault

- The Java and JVM notes already act as the core wiki content.
- Start from `wiki/Java基础篇.md` as the current primary page.
