---
module: Agent
tags: [Agent, Memory, 实现对比, Claude Code, Codex, Hermes, OpenClaw]
difficulty: hard
last_reviewed: 2026-05-29
---

# Memory 实现对比 — Claude Code / Codex / Hermes / OpenClaw

> ==四项目源码级 Memory 系统横向对比==。==所有数据来自实际源码==——附文件路径，可验证。
>
> 概念入门见 [[Agent Memory 系统]]——本文==只讲实现==。

---

## 文档说明

==数据来源==：

| 项目 | 源码位置 | 验证方式 |
|------|--------|--------|
| ==Claude Code== | `claude-code-sourcemap/restored-src/` | npm v2.1.88 sourcemap 还原 4756 文件 |
| ==Codex CLI== | `codex/codex-rs/`（103 个 crate） | OpenAI 官方开源 |
| ==Hermes== | `hermes-agent/agent/` | Nous Research 官方开源 |
| ==OpenClaw== | `openclaw/extensions/memory-core/` | 官方开源 |

==所有阈值常量、源码原文、引用注释==都标注了文件路径——读者可以直接 grep 验证。

---

## 一、各项目 Memory 架构总览

| 维度 | Claude Code | Codex CLI | Hermes | OpenClaw |
|------|------------|----------|--------|---------|
| ==L2 存储== | JSONL 会话日志 | SQLite + history.jsonl | SQLite session | SQLite session |
| ==L2 压缩触发== | `tokens >= window - 13_000` | ==三阶段== Pre/Mid/Standalone | Plugin 配置阈值 | （多触发条件） |
| ==L2 摘要预算== | 20K tokens | `COMPACT_USER_MESSAGE_MAX_TOKENS = 20_000` | `_MIN=2000` / `_RATIO=0.20` | （配置） |
| ==L3 存储== | ==仅 Markdown==（memdir） | `~/.codex/history.jsonl` + `AGENTS.md` | `MEMORY.md` + `USER.md` + 8 个 plugin | ==Markdown + LanceDB== 向量 |
| ==L3 索引== | ==无== | ==无== | 看 plugin 实现 | ==FTS5 + 向量== |
| ==L3 检索== | ==LLM as Retriever== | 用户手写 / `external-agent-sessions` 导入 | Plugin 决定 | ==评分提升== |
| ==L2 → L3 转换== | ✅ Forked agent 后台 extract | ❌ ==无自动==（仅日志） | ✅ Plugin + 后台 Curator | ✅ 评分驱动 + Dreaming |
| ==Prompt cache 友好== | ⚠️ 写 memory 后下轮 cache miss | ✅ 不动 system prompt | ✅ ==Frozen snapshot==（设计最聪明） | （看实现） |

==四种风格==：

- ==Claude Code==：==文件 + LLM as Retriever==（简洁主义）
- ==Codex CLI==：==用户掌控==（保守，自动只到日志）
- ==Hermes==：==4 重保险==（工程主义）
- ==OpenClaw==：==仿生 Dreaming + 评分==（经验主义）

---

## 二、Claude Code 的"轻型路线"（基于 v2.1.88 源码验证）

### 2.1 存储：纯文件，无数据库

```
~/.claude/                                          # 用户级
├── CLAUDE.md                                       # ★ 用户全局规则(进 system prompt 直读)
├── settings.json
└── projects/
    └── {sanitized-cwd}/                            # 项目路径编码后
        ├── MEMORY.md                               # ★ 项目主入口(整个进 system prompt)
        └── memory/                                 # ★ 自动 memory 目录(扫描 + LLM 选)
            ├── 2025-12-01-typescript-paths.md
            ├── 2025-12-02-config-format.md
            └── ...                                 # 几十个文件量级
```

==每个 .md 文件结构==（用户机器实测）：

```markdown
---
name: Bug Fix Pattern
description: When seeing TypeScript "Cannot find module" errors, check tsconfig paths first.
type: gotcha
---

[memory 正文,可以很长,几百行也没关系——按需读]
```

==关键==：==`description` 字段==给 LLM Retriever 看的，写清楚"什么场景用得上"——这就是检索的"索引"。

==源码定位==：
- 目录管理：`src/memdir/paths.ts`
- 扫描：`src/memdir/memoryScan.ts`
- 检索：`src/memdir/findRelevantMemories.ts`

### 2.2 检索：LLM as Retriever

==没有向量索引、没有 BM25、没有 SQLite==。

==源码 `memoryScan.ts` 类型定义==：

```typescript
export type MemoryHeader = {
  filename: string
  filePath: string
  mtimeMs: number
  description: string | null  // ★ 一句话描述
  type: MemoryType | undefined
}

const MAX_MEMORY_FILES = 200       // ★ 最多 200 个文件
const FRONTMATTER_MAX_LINES = 30   // ★ 只读前 30 行(够 frontmatter 即可)
```

==检索流程==（来自 `findRelevantMemories.ts`，简化伪代码）：

```python
async def find_relevant_memories(query, memory_dir, recent_tools, already_surfaced):
    # 1. 扫描所有 memory 文件,只读 frontmatter header
    memories = scan_memory_files(memory_dir)
    memories = [m for m in memories if m.path not in already_surfaced]

    if len(memories) == 0:
        return []

    # 2. 把 header 列表 + query 给 LLM,让它选最多 5 个
    selected = await sonnet.invoke({
        "system": SELECT_MEMORIES_SYSTEM_PROMPT,
        "user": f"Query: {query}\nAvailable memories:\n{format_manifest(memories)}\nRecent tools: {recent_tools}"
    })

    return [m for m in memories if m.filename in selected][:5]
```

==Claude Code 实际的 system prompt==（直接抄自源码 `findRelevantMemories.ts`）：

```
You are selecting memories that will be useful to Claude Code as it processes
a user's query. You will be given the user's query and a list of available
memory files with their filenames and descriptions.

Return a list of filenames for the memories that will clearly be useful to
Claude Code as it processes the user's query (up to 5). Only include memories
that you are certain will be helpful based on their name and description.
- If you are unsure if a memory will be useful in processing the user's
  query, then do not include it in your list. Be selective and discerning.
- If there are no memories in the list that would clearly be useful, feel
  free to return an empty list.
- If a list of recently-used tools is provided, do not select memories that
  are usage reference or API documentation for those tools (Claude Code is
  already exercising them). DO still select memories containing warnings,
  gotchas, or known issues about those tools — active use is exactly when
  those matter.
```

==几个工程亮点==：
1. ==只读 header 不读全文==——`scanMemoryFiles` 只扫 frontmatter（前 30 行），省 token
2. ==LLM 自己挑==——避免向量召回的"语义漂移"
3. ==`alreadySurfaced` 去重==——前面几轮已经展示过的 memory 不重复挑
4. ==`recentTools` 优化==——已经在用 grep / read 这些工具的 API 文档不挑，但相关 ==warnings/gotchas== 仍要挑

### 2.3 L2 → L3：后台 Forked Agent 自动 Extract

==源码定位==：
- 触发：`src/query/stopHooks.ts`（每个 query loop 结束）
- 实现：`src/services/extractMemories/extractMemories.ts`
- 配置：`src/services/SessionMemory/sessionMemoryUtils.ts`

==阈值常量==（源码原值）：

```typescript
export const DEFAULT_SESSION_MEMORY_CONFIG: SessionMemoryConfig = {
  minimumMessageTokensToInit: 10_000,    // ★ 第一次抽取触发
  minimumTokensBetweenUpdate: 5_000,     // ★ 后续抽取间隔
  toolCallsBetweenUpdates: 3,            // ★ 至少 3 次工具调用才再次抽取
}
```

==`extractMemories.ts` 头部注释原文==：

> Extracts durable memories from the current session transcript and writes them to the auto-memory directory (`~/.claude/projects/<path>/memory/`).
>
> It runs once at the end of each complete query loop (when the model produces a final response with no tool calls) via `handleStopHooks` in `stopHooks.ts`.
>
> Uses the ==forked agent pattern (runForkedAgent)== — a perfect fork of the main conversation that ==shares the parent's prompt cache==.

==4 个核心设计==：

| 设计点 | 说明 |
|------|------|
| ==Forked Agent== | Background agent 是主 Agent 的 fork——共享 prompt cache，==不重复消耗 token== |
| ==非阻塞== | 后台跑，==不打断用户==的对话节奏 |
| ==幂等== | 用 `lastSummarizedMessageId` 跟踪进度，已抽取过的不重复 |
| ==主备分工== | 主 Agent 也能写 memory（通过工具），background agent 兜底——`hasMemoryWritesSince` 检查范围已写就跳过 |

### 2.4 L2 压缩触发：基于 token buffer

==源码 `services/compact/autoCompact.ts` 实际常量==：

```typescript
export const AUTOCOMPACT_BUFFER_TOKENS = 13_000        // ★ 离 context 满还差 13k 时触发
export const WARNING_THRESHOLD_BUFFER_TOKENS = 20_000  // 提前预警
export const ERROR_THRESHOLD_BUFFER_TOKENS = 20_000
const MAX_OUTPUT_TOKENS_FOR_SUMMARY = 20_000           // 摘要输出预留 20k

// 触发逻辑
threshold = effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS
if (current_tokens >= threshold) {
    trigger_auto_compact()
}
```

==几个生产细节==：
- ==`MAX_CONSECUTIVE_AUTOCOMPACT_FAILURES = 3`== — 连续失败 3 次就停（==源码注释提到 2026-03-10 有 1279 个 session 失败 50+ 次浪费 250K API calls/天，所以加了这个熔断==）
- ==`getEffectiveContextWindowSize`== — 不是 raw window，要减去模型的 max output tokens
- ==`CLAUDE_CODE_AUTO_COMPACT_WINDOW`== 环境变量可覆盖（测试用）
- ==`turnId` 跟踪== — 每个 turn 一个 ID，避免一个 turn 内重复 compact

### 2.5 设计哲学

==Claude Code 的 Memory 哲学==：

| 原则 | 说明 |
|------|------|
| ==Markdown 是用户资产== | 用户能直接看 / 改 / 版本化；SQLite 不透明 |
| ==零运维== | 文件系统直接读，没有 db init / 索引重建 |
| ==乐观信任 LLM== | 相信 LLM 能 extract 出有用信息，后台自动跑 |
| ==Claude 200K window== | 上下文够大，不需要精确 top-3，相关 5 个进 prompt 模型自己消化 |

==代价==：
- ==Memory 文件多了不行==——上千个 .md 文件，scanMemoryFiles 会慢，且 header 列表给 Sonnet 当 prompt 会爆 context
- ==查询无法直接给用户==——LLM 调用是异步的

==适用场景==：==个人 / 单项目 / 几十个 memory 文件级别==。超出这个规模就要走重型路线。

---

## 三、Codex CLI 的"用户掌控"路线

### 3.1 ==没有==自动 L2 → L3

==源码定位==：
- `codex-rs/message-history/src/lib.rs` — 全局 history.jsonl
- `codex-rs/external-agent-sessions/src/ledger.rs` — 跨 agent session 导入

==源码原文==（`message-history/src/lib.rs` 头部注释）：

```rust
//! Persistence layer for the global, append-only *message history* file.
//!
//! The history is stored at `~/.codex/history.jsonl` with **one JSON object per
//! line**. Each record has the following schema:
//!
//! ```text
//! {"session_id":"<uuid>","ts":<unix_seconds>,"text":"<message>"}
//! ```
```

==Codex 把 long-term memory 完全交给用户==：

| 维度 | Codex 实现 |
|------|----------|
| ==L2（会话内）== | ✅ Compaction（==三阶段== Pre/Mid/Standalone Turn） |
| ==L3 自动 extract== | ❌ ==没有== |
| ==`history.jsonl`== | ==Append-only 日志==——保留原始消息，不提炼 |
| ==`AGENTS.md`== | ==用户手动维护==的项目规则文件，自动加载到 system prompt |
| ==`external-agent-sessions`== | ==用户主动==导入其他 agent 的 session（不是 promotion） |

### 3.2 三阶段 Compaction（最值得学的设计）

==源码 `codex-rs/analytics/src/facts.rs`==：

```rust
pub enum CompactionPhase {
    StandaloneTurn,   // 用户主动触发(/compact 命令)
    PreTurn,          // 新一轮开始前压缩
    MidTurn,          // 一轮中途压缩
}

pub enum CompactionReason {
    UserRequested,    // 用户要的
    ContextLimit,     // 接近窗口
    ModelDownshift,   // 切换到小窗口模型时
}

pub enum CompactionTrigger { Manual, Auto }
```

==关键洞见==：==MidTurn 压缩需要特殊处理==——

```rust
/// Mid-turn compaction must use `BeforeLastUserMessage` because the model is
/// trained to see the compaction summary as the last item in history after
/// mid-turn compaction; we therefore inject initial context into the
/// replacement history just above the last real user message.
pub(crate) enum InitialContextInjection {
    BeforeLastUserMessage,  // 中途压缩用这个
    DoNotInject,            // 预压缩用这个
}
```

==这是==Claude Code wiki 里没有的细节，wiki 一直只讲"自动 compaction"模糊带过。

### 3.3 设计哲学：保守

==哲学==："==自动提炼会出错，让用户掌握 L3==——保守是美德"。

==牺牲便利换可控==：
- 自动只到 `history.jsonl`（==原始日志，不提炼==）
- 长期知识沉淀靠用户写 `AGENTS.md`
- 没有"forked agent extract" 这种机制

==适用场景==：企业 / 强可控性 / 用户可信。

---

## 四、Hermes 的 4 重保险

==Hermes 的 L2→L3 不是单一机制，而是 4 种并存==。

### 4.1 Plugin Context Engine（架构最先进）

==源码 `agent/context_engine.py`==：

```python
class ContextEngine(ABC):
    """Engine 生命周期:
      1. on_session_start()
      2. update_from_response()       # 每次 API 后
      3. should_compress()            # 每轮检查
      4. compress()                   # 触发压缩
      5. on_session_end()             # 真正会话边界
    """

    @abstractmethod
    def should_compress(self, ...): ...
    @abstractmethod
    def compress(self, ...): ...
```

==配置驱动的可插拔==——`context.engine: "compressor"` (默认) `/ "lcm"` (Latent Concept Model)。

==这就是 Harness Engineering 的"四大原则"之"权限声明化"==的具体落地——压缩策略写在配置里，不硬编码。

### 4.2 内置 memory tool（Frozen Snapshot Pattern）

==源码 `tools/memory_tool.py:8`==：

```python
"""
Provides bounded, file-backed memory that persists across sessions. Two stores:
  - MEMORY.md: agent's personal notes and observations
  - USER.md:   what the agent knows about the user

Both are injected into the system prompt as a ==frozen snapshot at session start==.
Mid-session writes update files on disk immediately (durable) but ==do NOT change
the system prompt== -- this ==preserves the prefix cache for the entire session==.
"""
```

==核心设计：Frozen Snapshot Pattern==

```
session 启动:
  读 MEMORY.md / USER.md → 快照进 system prompt → 整个 session 不变

session 中 Agent 调 memory tool:
  立即写入磁盘(durable) → 但 system prompt 不变 → ==prompt cache 100% 命中==

下次 session 启动:
  读最新的 MEMORY.md → 新快照
```

==这是非常聪明的设计==——==解决了"频繁写 memory 会破坏 prompt cache"的核心矛盾==。

==Claude Code 没这么做==——所以 Claude Code 写 memory 后下一轮 system prompt 会变（cache miss）。

### 4.3 memory nudge（系统提醒 Agent）

==源码 `tests/run_agent/test_memory_nudge_counter_hydration.py`==：

```python
# 触发条件:
# turns_since_memory >= memory_nudge_interval (默认 10 轮)
# → 输出"💾 Self-improvement review:" 提示

# Hydration 关键: gateway 重启 Agent 时,要从 conversation_history
# 恢复 _turns_since_memory / _user_turn_count 计数
# 否则 user 聊几小时都看不到 nudge
```

==设计==：==Agent 不会自己记得==该写 memory，==每 N 轮系统主动提醒==。==解决 LLM 短期内不重视长期记忆的问题==。

### 4.4 后台 Curator（self-improving 闭环）

==源码 `agent/curator.py:1`==：

```python
"""Curator — background skill maintenance orchestrator.

The curator is an auxiliary-model task that periodically reviews
==agent-created skills== and maintains the collection. It runs
inactivity-triggered (no cron daemon): when the agent is idle and
the last curator run was longer than ``interval_hours`` ago,
``maybe_run_curator()`` spawns a forked AIAgent to do the review.

Strict invariants:
  - Only touches ==agent-created skills== (用户的不动)
  - ==Never auto-deletes== — only archives. Archive is recoverable.
  - Pinned skills bypass all auto-transitions
  - Uses the auxiliary client; never touches the main session's prompt cache
"""
```

==关键不变量==：
- ==只动 agent 自己创建的==——用户的不动（信任边界）
- ==永不删，只 archive==（可恢复）
- ==用便宜模型==（auxiliary client）跑——不污染主会话 cache

==Curator 自动==：pin / archive / consolidate / patch ==agent-created skills==——这就是 Nous Research 说的 "==self-improving=="。

### 4.5 Plugin Memory Provider（外接 8 个 backend）

==`plugins/memory/` 目录==：

```
plugins/memory/
├── byterover/    社区
├── hindsight/    社区
├── holographic/  社区
├── honcho/       Plastic Labs(dialectic user modeling)
├── mem0/         商业
├── openviking/
├── retaindb/
└── supermemory/  商业
```

==设计==：通过 `agent/memory_provider.py` 抽象基类，==8 个 backend 可热插拔==。

### 4.6 设计哲学：工程主义

==哲学==："==单一机制不够==——Agent 自主 + 系统提醒 + 后台维护 + 第三方插件，==四重保险=="。

==适用场景==：复杂场景 / 多 backend 需求。

---

## 五、OpenClaw 的"评分提升 + 仿生 Dreaming"

### 5.1 文件结构 + 评分常量

==源码位置==：`extensions/memory-core/src/short-term-promotion.ts`

```typescript
export const DEFAULT_PROMOTION_MIN_SCORE = 0.75              // ★ 分数阈值
export const DEFAULT_PROMOTION_MIN_RECALL_COUNT = 3          // ★ 至少召回 3 次
export const DEFAULT_PROMOTION_MIN_UNIQUE_QUERIES = 2        // ★ 至少 2 个不同 query
const DEFAULT_RECENCY_HALF_LIFE_DAYS = 14                    // ★ 14 天指数衰减

const PHASE_SIGNAL_LIGHT_BOOST_MAX = 0.06                    // light dreaming 加分
const PHASE_SIGNAL_REM_BOOST_MAX = 0.09                      // REM dreaming 加分
```

==文件结构==：

```
memory/
├── 2025-12-01-foo.md           ← 短期(date-stamped)
├── .dreams/
│   ├── session-corpus/         ← 会话语料库
│   ├── short-term-recall.json  ← ★ 召回评分(关键)
│   └── phase-signals.json      ← ★ 梦境阶段信号
└── dreaming/                   ← 长期(已促进)
```

### 5.2 促进流程（7 步）

```
Step 1: 短期写入   → memory/{date}-{name}.md (date stamped)
Step 2: 每次召回   → short-term-recall.json 计数 +1
Step 3: Light Dreaming  → 提取 themes,加 PHASE_SIGNAL_LIGHT_BOOST
Step 4: REM Dreaming    → 提取 concept tags,加 PHASE_SIGNAL_REM_BOOST
Step 5: 评分计算   = recency_decay × recall_count × unique_query × phase_boost
Step 6: 满足条件   (score >= 0.75 AND recall >= 3 AND unique >= 2) → ✓ 提升
Step 7: Deep Dreaming   → 写入 memory/dreaming/{promoted}.md
```

### 5.3 仿生学元素

| 元素 | 对应人脑 | 实际作用 |
|------|--------|--------|
| ==Light Dreaming== | NREM 浅睡 | 快速过一遍提取 themes |
| ==Deep Dreaming== | NREM 深睡 | 巩固高分记忆，提升到 durable |
| ==REM Dreaming== | REM 快速眼动睡眠 | 跨主题关联，提取 concept tags |

### 5.4 设计哲学：经验主义

==哲学==："==记忆像人脑睡眠==——多次使用、跨场景使用的记忆才被巩固，==高频但单一场景的不算=="。

==适用场景==：大量长期使用 / 个性化要求高。==冷启动时和 Claude Code 没区别==。

### 5.5 SQLite + FTS5 实现详解（轻量化 RAG）

==这是 OpenClaw 与 Claude Code 最大的工程差异==——OpenClaw ==把 RAG 的核心思想压进单个 SQLite 文件==，零依赖、零运维。本节基于实际源码讲清楚==怎么实现==。

#### 与完整 RAG 的关系

==OpenClaw 的 Memory 检索就是一个轻量化 RAG==：

| 维度 | 完整 RAG（Milvus + Elasticsearch） | OpenClaw Memory（FTS5 + sqlite-vec） |
|------|--------------------------------|---------------------------------|
| 存储 | 分布式向量库 + 搜索引擎 | ==单个 SQLite 文件== |
| 向量索引 | HNSW / IVF-PQ | ==sqlite-vec==（SQLite 扩展） |
| 关键词索引 | Elasticsearch / Lucene | ==FTS5==（SQLite 自带） |
| 混合检索 | RRF / 加权融合 | ==BM25 + cosine 加权融合== |
| 分块 | 滑动窗口 / 语义切分 / AST | ==行+token 上限+重叠==（标准滑动窗口） |
| 运维 | 集群 / 副本 / 索引优化 | ==零运维== |
| 典型规模 | 百万-亿级 chunk | ==几千-几万==条 |

==所以这就是==："不需要 RAG 的完整工程，但要 RAG 的功能"——==OpenClaw 用 SQLite 完美填了这个空==。

> [!info] FTS5 / 倒排索引 / BM25 通用原理已迁移
> "FTS5 是什么、倒排索引内部结构、BM25 排序本质、滑动窗口分块完整流程（Step 1–6）、与按段落切的对比"属 RAG 检索通用知识，已迁出到 RAG 域（`wiki审计/_迁移暂存/RAG-FTS5与分块教程.md`，目标 `wiki/RAG/`）。本节只保留 OpenClaw 的源码级实现（schema / chunkMarkdown / 混合检索 SQL）。

#### 真实 SQL Schema（基于 `packages/memory-host-sdk/src/host/memory-schema.ts`）

==普通 chunks 表==（存数据 + 向量）：

```sql
CREATE TABLE chunks (
    id          TEXT PRIMARY KEY,         -- chunk 唯一 id
    path        TEXT NOT NULL,            -- 来自哪个 .md 文件
    source      TEXT NOT NULL DEFAULT 'memory',
    start_line  INTEGER NOT NULL,         -- ★ 起始行号
    end_line    INTEGER NOT NULL,         -- ★ 结束行号
    hash        TEXT NOT NULL,            -- 内容 hash(用于幂等)
    model       TEXT NOT NULL,            -- 用什么 embedding 模型
    text        TEXT NOT NULL,            -- ★ chunk 原文
    embedding   TEXT NOT NULL,            -- 向量(JSON 序列化)
    updated_at  INTEGER NOT NULL
);

CREATE INDEX idx_chunks_path ON chunks(path);
CREATE INDEX idx_chunks_source ON chunks(source);
```

==FTS5 虚拟表==（关键词搜索专用）：

```sql
CREATE VIRTUAL TABLE fts_chunks USING fts5(
    text,                       -- ★ 这个字段建倒排索引
    id UNINDEXED,              -- 这些字段只附带,不索引
    path UNINDEXED,
    source UNINDEXED,
    model UNINDEXED,
    start_line UNINDEXED,
    end_line UNINDEXED,
    tokenize = 'trigram case_sensitive 0'  -- ★ 三字符分词器(中文友好)
);
```

==关键设计==：
- `text` 字段建倒排索引——以后 `WHERE text MATCH ...` 秒查
- 其他字段 `UNINDEXED`——一起存，==查询一次返回完整信息==（不用 join 主表）
- `tokenize='trigram'`——三字符分词，==中文场景==（中文没空格，trigram 切成 3 字符一组）

#### 分块策略（基于 `internal.ts:chunkMarkdown`）

==这是 RAG 标准的「滑动窗口分块」==——按行累积到 token 上限：

```typescript
export function chunkMarkdown(
  content: string,
  chunking: { tokens: number; overlap: number },
): MemoryChunk[] {
  const lines = content.split("\n");                     // 1. 按行切
  const maxChars = chunking.tokens * 4;                  // 2. token × 4 ≈ 字符上限
  const overlapChars = chunking.overlap * 4;             // 3. 重叠字符数
  
  const chunks: MemoryChunk[] = [];
  let current = [];
  let currentChars = 0;
  
  for (const line of lines) {                            // 4. 一行一行读
    if (currentChars + line.length > maxChars && current.length > 0) {
      chunks.push({                                      // 5. 累积到上限才 flush 成 chunk
        startLine: current[0].lineNo,
        endLine: current[current.length - 1].lineNo,
        text: current.map(e => e.line).join("\n"),
        hash: hashText(text),
      });
      // 处理 overlap: 保留最后 overlapChars 进入下一个 chunk...
      current = [];
    }
    current.push({ line, lineNo });
    currentChars += line.length;
  }
}
```

==`chunkMarkdown` 用的是 RAG 标准的「滑动窗口分块」==——按行累积到 `token × 4 ≈ 字符上限`，相邻 chunk 留 overlap 防止关键信息被切断。chunk 不是"行"也不是"段落"，是「N 行打包成的一段 + 元数据（path / start_line / end_line）」。

> [!info] 滑动窗口分块原理 + overlap 工程意义已迁移
> 「chunk 粒度（一个文件 N 个 chunk，不是每行一个）、overlap 为什么能覆盖完整段落、与按段落/heading/语义切的对比」属 RAG 分块通用知识，见迁移文件 `RAG-FTS5与分块教程.md`（目标 `wiki/RAG/`）与 [[分块策略]]。

#### 二次切分：Embedding 模型上限保险

==源码 `embedding-chunk-limits.ts`==：

```typescript
export function enforceEmbeddingMaxInputTokens(
  provider: EmbeddingProvider,
  chunks: MemoryChunk[],
): MemoryChunk[] {
  const maxInputTokens = resolveEmbeddingMaxInputTokens(provider);
  // ★ 如果 chunk 超过 embedding 模型的 token 上限,再切
  for (const chunk of chunks) {
    if (estimateUtf8Bytes(chunk.text) <= maxInputTokens) {
      out.push(chunk);
      continue;
    }
    // 切到符合 embedding 模型上限(比如 OpenAI text-embedding-3 是 8191 tokens)
    for (const text of splitTextToUtf8ByteLimit(chunk.text, maxInputTokens)) {
      out.push({ startLine, endLine, text, hash, embeddingInput: { text } });
    }
  }
}
```

==两层切分==：
1. ==`chunkMarkdown`== — 业务层切（按业务 token 上限，比如 512）
2. ==`enforceEmbeddingMaxInputTokens`== — 兜底切（按 embedding 模型硬上限，OpenAI text-embedding-3 是 8191 tokens）

==这是工程细节==——确保 chunk 永远不超 embedding API 限制。

#### 检索：BM25 + 向量混合

==关键词搜索==（FTS5）：

```sql
SELECT id, path, start_line, end_line, text, rank
FROM fts_chunks
WHERE text MATCH 'agent compaction'      -- 自动 BM25 ranking
ORDER BY rank
LIMIT 10;
```

==向量搜索==（sqlite-vec）：

```sql
SELECT id, path, text, distance
FROM chunks
WHERE id IN (
    SELECT rowid FROM vec0_chunks
    WHERE embedding MATCH ?               -- 向量相似度
    AND k = 10
);
```

==混合检索==（实际生产做法）：

```typescript
// 来自 manager-search.ts 的简化逻辑
const ftsResults = await ftsSearch(query, k=20);          // 1. 关键词召回
const vecResults = await vectorSearch(queryEmbedding, k=20); // 2. 向量召回
const merged = mergeWithRRF(ftsResults, vecResults);      // 3. RRF 融合
return merged.slice(0, 10);                               // 4. 取 top-10
```

==实际效果==：
- 关键词搜"==整理 raws=="——FTS5 秒查所有提到这两词的 chunk
- 语义搜"==如何处理网页剪藏=="——向量搜也能召回不含原词但语义相关的 chunk
- ==RRF 融合==——两个结果集按 ranking 合并去重

==查询出 chunk 后==：

```
chunk_3, raws/WORKSPACE.md, line 15-30, "整理流程..."
chunk_5, RAW_WORKFLOW_GUIDE.md, line 8-25, "## 整理流程..."
```

==因为有 startLine/endLine==，Agent 拿到结果可以==精确读那几行原文==——不用重新加载整个文件。

#### 总结：和 Claude Code 无索引的对比

| 维度 | OpenClaw（FTS5+vec） | Claude Code（无索引） |
|------|------------------|------------------|
| ==文件量级== | ==几千-几万==条 chunk | ==几十==个 .md 文件 |
| ==索引建立== | ==自动==（每次写入 trigger 同步） | ==无==（每次扫 frontmatter） |
| ==查询速度== | ==毫秒级==（SQLite 索引） | ==秒级==（Sonnet LLM 调用） |
| ==查询成本== | 几乎免费 | ~$0.001 per query |
| ==查询准确度== | 关键词 / 向量召回 | ==LLM 看着挑==（更准但慢） |
| ==运维== | 索引可能要重建 | 零运维 |
| ==分块粒度== | ==chunk 级==（每文件 N 个 chunk） | ==文件级==（每文件 1 个 header） |

==选哪种==：
- ==几十个文件==：Claude Code 的 LLM as Retriever 更准
- ==几千个 chunk==：OpenClaw 的 FTS5+vec 必须

---

## 六、四项目横向对比表（9 维度）

### L2 → L3 转换

| 维度 | Claude Code | Codex CLI | Hermes | OpenClaw |
|------|------------|----------|--------|---------|
| ==自动转换== | ✅ Forked agent 后台 | ❌ ==无==（仅日志） | ✅ Plugin + Curator | ✅ ==Dreaming + 评分== |
| ==触发机制== | token 阈值（10K/5K/3 calls） | 用户手动 `/compact` | turns >= nudge_interval | 召回次数 + unique queries |
| ==决策权== | 后台 Agent | ==用户== | Agent + 系统 + Curator | ==评分系统==（自动） |
| ==Prompt 影响== | extract 不进 system | N/A | ==frozen snapshot==（保 cache） | promotion 后才进 |
| ==存储输出== | `memory/*.md` | `history.jsonl`（仅日志） | `MEMORY.md` + `USER.md` | `dreaming/*.md` |
| ==去重== | `lastSummarizedMessageId` | 无 | sanitize fence tags | ==指纹哈希== |
| ==复杂度== | 中 | 低 | 高 | 高 |
| ==独特优势== | 不打断用户 | 简单可控 | ==4 重保险== | ==评分驱动==（最准） |
| ==独特弱点== | 看不到内部决策 | 无自动沉淀 | 配置复杂 | 需要长期数据 |

### 设计哲学（信任假设）

| 哲学 | 项目 | 信任假设 |
|------|------|--------|
| ==后台 forked agent 自动 extract== | Claude Code | ==乐观信任 LLM==——它能 extract 出有用信息 |
| ==用户掌握 L3，自动只到日志== | Codex CLI | ==保守==——不信任自动 extract，让用户写 |
| ==4 重保险（Agent 自主 + nudge + curator + plugin）== | Hermes | ==工程主义==——单一机制不够 |
| ==评分驱动 + 仿生 dreaming== | OpenClaw | ==经验主义==——用数据投票 |

==四种风格反映了不同的"==信任模型=="==：
- 你==信不信==LLM 能自动从对话里提炼出有用记忆？
- 你==愿不愿==让用户自己管理记忆？
- 你==有没有==足够的使用数据让评分系统起作用？

---

## 七、选型决策树

```
你做项目时该选哪种 Memory 方案?

1. 你的 Memory 文件量级是多少?
   ├── 几十个(单项目个人用)        → ==Claude Code 路线==(纯文件 + LLM as Retriever)
   ├── 几百到几千(多项目)          → ==Hermes 路线==(MEMORY.md + USER.md + plugin)
   └── 上万级(企业/海量历史)       → ==OpenClaw 路线==(向量索引 + 评分提升)

2. 你信任 LLM 自动 extract 吗?
   ├── 信任(乐观)                  → ==Claude Code 路线==(后台 forked agent)
   ├── 不信任(保守/合规要求高)     → ==Codex 路线==(只做日志,用户写 AGENTS.md)
   └── 部分信任(要多重验证)        → ==Hermes 路线==(4 重保险)

3. 你有长期使用数据吗?
   ├── 没有(冷启动)                → ==Claude Code 路线==(评分系统冷启动等于没用)
   ├── 有(老用户/长期项目)         → ==OpenClaw 路线==(评分提升才能发挥威力)

4. 你需要插件化 / 多 backend 吗?
   ├── 需要(企业要灵活)            → ==Hermes 路线==(8 个 plugin + Plugin Context Engine)
   └── 不需要(简单产品)            → ==Claude Code 路线==(零依赖最省心)

5. 你的 LLM 是长 context (>=200K) 还是短的?
   ├── 长 context                  → 倾向 ==Claude Code 路线==(window 大,不需要精确召回)
   └── 短 context (32K)            → 倾向 ==OpenClaw / Hermes 路线==(必须精确召回)
```

---

## 八、关键认知（最值得记住的 6 条）

1. ==没有"标准"L2→L3 实现==——四种实现差异巨大，==选哪种取决于你的信任假设和使用场景==

2. ==Hermes 的 frozen snapshot 是最聪明的工程设计==——解决了"频繁写 memory 破坏 prompt cache"的核心矛盾。==Claude Code 没这么做==——所以 Claude Code 写 memory 后下一轮 system prompt 会变（cache miss）

3. ==OpenClaw 的评分提升==是最准的方法——但需要==长期使用数据==才生效，==冷启动时和 Claude Code 没区别==

4. ==Codex 的"==只做日志=="==看似落后，但==避免了 LLM 自动 extract 出错==的风险——==简单 + 可控==。==Codex 的三阶段 Compaction（Pre/Mid/Standalone Turn）==是 Claude Code 没有的工程精细度

5. ==Claude Code 的 forked agent==巧妙利用 ==prompt cache 共享==——==零额外成本==。LLM as Retriever 在文件量小时比向量索引==更准更便宜==

6. ==Multi-Agent 也能用 self-improving 思路==——Hermes 的 Curator 思想可以扩展到任何长期运行的 Agent

---

## 相关链接

- [[Agent Memory 系统]] — 概念入门 / 三层架构 / 通用方法论
- [[长上下文工程]] — Compaction 在长 context 下的策略
- [[索引]] — 实现对比目录索引
- [[Agent索引_MOC]] — Agent 知识体系入口
