---
module: LLM
tags: [LLM, Agent, Memory, 短期记忆, 长期记忆, MEMORY.md, Compaction]
difficulty: hard
last_reviewed: 2026-05-25
---

# Agent Memory 系统

> Agent 的记忆系统——==让 Agent 能跨会话记住事==。本文聚焦 Agent 视角的 Memory:三层架构、短期/长期的存储工程、==短期→长期转换机制==、Agent 如何使用 Memory、生产实现。
>
> 多轮对话的对话存储与上下文窗口管理见 [[多轮对话]]；与 RAG 的对比简化在 §六 引用 [[RAG基础与架构]];Skills 与 Memory 的边界见 [[Agent Skills 体系]]。

---

## 一、三层架构

Agent 的记忆系统分==三层==,每层解决不同问题:

| 层次 | 名称 | 生命周期 | 技术实现 | 存储位置 | 类比 |
|------|------|---------|---------|---------|------|
| ==L1== | 工作记忆(Working Memory) | 单次推理步骤内 | LLM 的 KV Cache + 当前 Prompt | ==内存==,不持久化 | CPU 寄存器 |
| ==L2== | 短期记忆(Short-term Memory) | 当前会话 | 上下文窗口 + 会话日志 | ==JSONL 会话日志文件== | 内存 |
| ==L3== | 长期记忆(Long-term Memory) | 跨会话持久化 | 向量检索 + FTS 全文索引 | ==Markdown + SQLite== | 硬盘 |

==关键认知==:这三层==不是独立的存储==,而是==同一份信息在不同生命周期的呈现==。每发生一次对话:
- 输入 LLM 时是 ==L1==(被压成 KV Cache 用一次)
- 拼回 messages 时是 ==L2==(整段对话历史)
- 提炼关键事实写入 MEMORY.md 后是 ==L3==(下次会话还能用)

==三层之间的转换==是 Memory 系统的核心设计——尤其 ==L2 → L3==,详见 §四。

---

## 二、L2 短期记忆详解

### 2.1 是什么

==当前会话的完整对话历史==——所有轮次的 user / assistant / tool 消息。==包括==:

- 用户的问题
- LLM 的回答(含 tool_calls)
- 工具的执行结果(role: tool 消息)
- 系统 Prompt

==生命周期==:会话开始 → 会话结束(或 `/new` 重置)就消失。

### 2.2 存储格式:JSONL 会话日志

==生产中通常存为 JSONL==(每行一个消息的 JSON):

```jsonl
{"role": "system", "content": "你是助手...", "ts": 1716624000}
{"role": "user", "content": "帮我看 pom.xml", "ts": 1716624010}
{"role": "assistant", "content": null, "tool_calls": [{...}], "ts": 1716624012}
{"role": "tool", "tool_call_id": "call_1", "content": "<dependencies>...", "ts": 1716624013}
{"role": "assistant", "content": "你的依赖是...", "ts": 1716624018}
```

==为什么是 JSONL 不是 JSON 数组==:
- ==流式追加==:每条消息直接 append 一行,不需要重写整个文件
- ==崩溃可恢复==:即使写一半挂了,前面已写的行仍可读
- ==易于并行==:多个会话各自一个 JSONL 文件互不干扰

==文件位置==:
```
.claude/sessions/                    Claude Code 风格
├── 2026-05-25-abc123.jsonl
├── 2026-05-25-def456.jsonl
└── ...
```

### 2.3 写入时机:同步 vs 异步

| 时机 | 优点 | 缺点 |
|------|------|------|
| ==同步==(每条消息立即落盘) | 不丢消息,崩溃恢复完整 | IO 开销,可能拖慢响应 |
| ==异步==(批量定期落盘) | 性能好 | ==崩溃可能丢最近 N 条== |

==生产推荐==:==同步==——Coding Agent 场景对延迟不敏感(LLM 调用本身就慢),不能丢消息(用户期望 history 完整)。

### 2.4 上下文窗口管理

==L2 短期记忆的核心挑战==:==上下文窗口有限==(GPT-4 128K / Claude 200K / Gemini 2M),长会话超出预算时怎么办。

==四种处理方案==:

| 方案 | 原理 | 优缺点 |
|------|------|--------|
| ==滑动窗口== | 只保留最近 N 轮 | 简单粗暴,丢早期重要信息 |
| ==摘要压缩== | LLM 把旧对话压缩成摘要 | 保留大意,细节丢失 |
| ==向量检索增强== | 历史对话存向量库,每轮检索相关片段注入 | 精准但增加延迟 |
| ==关键事实提取== | 维护"重要事实列表",每轮注入 | 最精准,维护成本高 |

==生产中通常组合用==:最近 5 轮原文 + 6-15 轮基础摘要 + 15+ 轮关键事实——这就是==分层摘要==模式。

==详细的对话存储 schema、token 预算分配、五种重要性判断方案==见 [[多轮对话]],本文不重复。

---

## 三、L3 长期记忆详解

### 3.1 关键架构原则:Markdown 是本体

==L3 的核心设计==:

> ==Markdown 是记忆本体(source of truth),SQLite 只是加速层。==

```
.claude/  或  .openclaw/  这种项目目录:
├── MEMORY.md              ★ 主记忆文件(人和 Agent 都能读写)
├── memory/                ★ 分类记忆文件夹
│   ├── user_preferences.md
│   ├── project_decisions.md
│   ├── architecture_notes.md
│   └── debugging_tips.md
└── .cache/
    └── memory.db          SQLite(FTS5 全文索引 + sqlite-vec 向量索引)
                           ==这个删了能从 Markdown 重建==
```

==为什么这么设计==:

| 维度 | 单纯用数据库 | Markdown + 数据库 |
|------|------------|-----------------|
| 人能直接读 | ✗ | ==✓== |
| 能 git 化 | ✗ | ==✓==(`git diff MEMORY.md`) |
| 能手动改 | ✗(要写 SQL) | ==✓==(直接编辑) |
| 跨产品迁移 | ✗(锁在数据库格式) | ==✓==(Markdown 是通用格式) |
| 重建索引 | 数据丢了真丢了 | ==✓==(Markdown 在,索引可重建) |

==这是==重要的工程哲学==——记忆数据是用户的资产,不能被锁在不透明的数据库里==。

### 3.2 MEMORY.md 内容结构

==典型的 MEMORY.md==(以 Claude Code 风格为例):

```markdown
# 项目记忆

## 用户偏好
- 用户是 Java 后端工程师,熟悉 Spring Boot
- 倾向函数式编程风格,避免过深的继承
- 每个 PR 都要带测试

## 项目约定
- 后端用 Spring Boot 3.x + Java 21
- 数据库用 PostgreSQL,不要用 ORM 写复杂查询
- 测试框架用 JUnit 5 + Mockito
- API 风格遵循 RESTful + OpenAPI 3 文档

## 决策记录
- 2026-04-15:决定不引入 Redis,用 Caffeine 本地缓存
- 2026-05-02:Auth 改用 JWT,放弃 Session
```

==特点==:
- ==分类清晰==(用户偏好 / 项目约定 / 决策记录...)
- ==简短结论==,不是流水账(不是"用户说他喜欢 Java",而是"用户是 Java 后端工程师")
- ==可手动审查==——你打开看到不对的可以直接改/删

### 3.3 SQLite 加速层

==SQLite 存什么==(以 OpenClaw / Hermes 实现为参考):

```sql
-- 切块存储
CREATE TABLE chunks (
    id INTEGER PRIMARY KEY,
    file_path TEXT NOT NULL,        -- 来自哪个 Markdown 文件
    line_start INTEGER,
    line_end INTEGER,
    content TEXT NOT NULL,
    created_at TIMESTAMP
);

-- FTS5 全文索引(关键词搜索)
CREATE VIRTUAL TABLE chunks_fts USING fts5(
    content,
    content='chunks',
    content_rowid='id'
);

-- sqlite-vec 向量索引(语义搜索)
CREATE VIRTUAL TABLE chunks_vec USING vec0(
    embedding float[768]
);
```

==查询时==:==Markdown 不参与==,直接从 SQLite 读 chunks,通过 FTS5 + 向量混合检索找到相关 chunks 返回。

### 3.4 索引建立四步

==Markdown → SQLite 索引==的流程:

1. ==发现==:监控 MEMORY.md 和 memory/*.md 的变化(文件 mtime 变化或显式触发),标记 dirty
2. ==切块==:把 Markdown 切成多个 chunk,让==一个块只表达一小段完整的意思==(通常按 H2/H3 标题或段落切)
3. ==索引==:每个 chunk 同时走==向量索引==(embedding 进 sqlite-vec)和 ==FTS5 全文索引==(走 BM25)
4. ==落库==:chunk 内容、文件路径、行号、向量、FTS 索引都写入 SQLite

### 3.5 混合检索为什么比纯向量靠谱

- 搜 ==`nomic-embed-text`== 这种==精确关键词==→ FTS5+BM25 命中
- 搜 ==「上次说过的写作偏好」==这种==模糊语义==→ 向量检索召回
- 两边结果==RRF 融合==返回 Top-K

==为什么要两路==:向量擅长语义模糊匹配,FTS 擅长精确关键词命中,==互补==。

### 3.6 写入触发的三种方式

==L3 长期记忆==怎么进去的(三种来源,从被动到主动):

| 触发方式 | 谁触发 | 例子 |
|---------|-------|------|
| ==1. 用户显式 `/save`== | 用户敲命令 | `/save 用户偏向函数式编程风格` |
| ==2. Agent 调 `save_memory` 工具== | Agent 自动 | 用户说"记一下:每个 PR 必须带测试" → Agent 调 `save_memory("项目约定:每个 PR 必须带测试")` |
| ==3. Compaction Hook== | 系统自动 | 会话结束/接近 context 上限时,提取关键事实写入 |

==1 和 2 的区别==:1 是用户主动,2 是 Agent 判断"这条值得记"主动调工具。生产中两个都要有,各自适合不同场景。

==3 是最隐式的==,详见 §四。

---

## 四、★ 短期 → 长期转换机制

==L2 短期记忆==是==当前会话的完整流水账==,==L3 长期记忆==是==跨会话沉淀的关键事实==——==两者的鸿沟需要"转换"来跨越==。这是 Memory 系统最关键也是最容易做错的环节。

### 4.1 三种触发条件

| 触发 | 来源 | 时机 |
|------|------|------|
| ==A. 用户主动 `/new`== | 用户敲命令重置会话 | 会话切换时强制处理 |
| ==B. 会话结束== | 用户关闭 IDE / 关闭终端 | 退出前 hook |
| ==C. Context 接近上限== | 系统自动监控 | 用满 80% context 时触发 Compaction |

==A 和 B 的差别==:A 用户明确知道要切换,B 用户可能没注意。==C 是最危险的==——用户可能正在中间某步,不希望被中断。

### 4.2 转换流程的三步

```
[L2 当前会话日志]                    JSONL 文件,可能上百轮对话
       ↓
==Step 1: 重要性判断==                 哪些值得保留?
       ↓
==Step 2: 提炼成事实==                 一段对话 → 一行简洁陈述
       ↓
==Step 3: 写入 L3==                    追加到 MEMORY.md + 同步索引
       ↓
[L3 长期记忆]                        Markdown + SQLite
```

### 4.3 重要性判断:哪些保留、哪些丢

==这是转换最关键的一步==——错了要么丢重要信息,要么 MEMORY.md 充满垃圾。==五种判断方案==(详见 [[多轮对话#§2.4 五种判断方案]]):

| 方案 | 适合 |
|------|------|
| ==方案 1:让 LLM 自己判断==(最常用) | prompt 明确列"必须保留 vs 可以舍弃" |
| ==方案 2:消息入库时打 is_critical 标签== | 实时标注,提取时过滤 |
| ==方案 3:纯规则启发式打分== | 数字+2/决策关键词+3/寒暄-3 |
| ==方案 4:基于注意力/嵌入的重要性== | 研究前沿,生产少用 |
| ==方案 5:分层摘要==(==生产推荐==) | 最近 5 轮原文 / 6-15 轮基础摘要 / 15+ 轮高度浓缩 |

==生产组合==:==方案 2 入库标注 + 方案 5 分层 + 方案 1 LLM 摘要==——大部分对话用方案 5 自动处理,关键决策点用方案 2 显式标注,最终摘要由方案 1 LLM 生成。

### 4.4 转换 prompt 实战写法

==转换 prompt 是 L2→L3 的核心工程产物==。一个生产级模板:

```
SUMMARIZE_TO_MEMORY_PROMPT = """
你正在把一段对话历史转换为长期记忆条目。

==必须保留==的内容:
1. 用户偏好(技术栈、风格、习惯)
2. 项目级决策(选了什么、为什么)
3. 关键约束(不能用什么、必须满足什么)
4. 重要事实(版本、链接、配置)

==必须舍弃==:
1. 寒暄、确认("好的"、"谢谢")
2. 单次操作(读了某个文件、跑了某个命令)——除非结果很关键
3. 错误探索过程——除非用户表达了重要偏好
4. 临时上下文(本次任务的中间状态)

==输出格式==:Markdown 列表,每条 ≤ 50 字,按以下分类:
## 用户偏好
- ...
## 项目约定
- ...
## 决策记录
- 日期:决策内容

==重要==:
- 没有信息的分类==留空==,不要硬编
- 不要复述对话,直接给==结论==
- 用户没明确说的不要瞎猜
"""
```

==关键设计==:
- ==明确"保留 vs 舍弃"清单==——别让 LLM 自己猜
- ==输出格式严格==(Markdown 列表 + 分类)——便于追加到 MEMORY.md
- ==允许留空==(没信息的分类不硬编)——防止 LLM 编造

### 4.5 转换的两个常见陷阱

==❌ 陷阱 1:把短期对话误当作"历史记忆"注入==

错误模式:把当前会话的最近几轮也当成 L3 注入下一轮 prompt——==等于上下文重复==,token 翻倍。

==正确做法==:==L3 注入只用稳定事实==(MEMORY.md 里的内容),==当前会话历史用 L2 自己管==,两层不混。

这就是你引用功能里的"==注入给模型的相关记忆只使用长期稳定事实,不把当前轮短期对话误当成历史记忆=="——非常重要的工程纪律。

==❌ 陷阱 2:摘要不可逆,生产必须留原文==

错误模式:Compaction 后把原始 JSONL 删了,只留摘要。

==正确做法==:
- ==始终保留原始 JSONL==(磁盘便宜)
- ==用户追问"上次为什么这么改"==时,从 JSONL 拉原文不是从摘要
- ==摘要是 prompt 优化,不是数据替代==

==生产实操==:JSONL 永久保留,SQLite 索引可重建,摘要写入 MEMORY.md 但==不删原始日志==。

### 4.6 转换的工程实现

```python
def compact_session_to_memory(session_jsonl_path: str, memory_md_path: str):
    """会话结束时调用——把 L2 转成 L3"""
    # 1. 读 JSONL
    messages = read_jsonl(session_jsonl_path)

    # 2. 跳过琐碎消息(方案 3 规则过滤)
    filtered = [m for m in messages if not is_trivial(m)]

    # 3. 让 LLM 提炼(方案 1)
    summary = llm.invoke(
        system=SUMMARIZE_TO_MEMORY_PROMPT,
        user=format_messages(filtered)
    )

    # 4. 追加到 MEMORY.md(本体)
    append_to_markdown(memory_md_path, summary)

    # 5. 触发 SQLite 重新索引(加速层)
    rebuild_index_for_file(memory_md_path)

    # 6. 原始 JSONL ==保留不删==
```

---

## 五、Memory 怎么被 Agent 使用

==核心原则:按需检索而非全量注入==——MEMORY.md 不是每回合全量塞进上下文,而是==通过工具按需读取==。==这是 Memory 能"越记越多但不撑爆上下文"的根本==。

### 5.1 Agent 的三个 Memory 工具

| 工具 | 作用 | 何时调用 |
|------|------|---------|
| ==`memory_search(query)`== | 向量+FTS 混合检索,返回 Top-K snippet + 路径 + 行号 | LLM 觉得需要回忆历史决策时 |
| ==`memory_get(path, line_range)`== | 根据搜索结果精读具体内容 | search 找到位置后展开读 |
| ==`save_memory(content)`== | 追加新条目到 MEMORY.md + 索引 | 用户说"记一下" / Agent 判断值得记 |

==为什么 search 不直接返回内容==:
- 控制 token——只返回 snippet 而非整段
- ==让 LLM 决定值得展开哪条==——它可能搜到 5 条相关,只想细看 1 条

### 5.2 注入策略:System Prompt 中的 MEMORY 段

==除了按需检索,部分高频核心事实可以默认注入==:

```
SYSTEM_PROMPT = """
你是 Coding Agent。

== 项目永久记忆(摘自 MEMORY.md "用户偏好" 和 "项目约定") ==
- 用户是 Java 后端工程师,熟悉 Spring Boot
- 项目用 Java 21 + Spring Boot 3.x
- 测试框架是 JUnit 5
== ==

可用工具:read_file / write_file / memory_search / memory_get / save_memory ...
"""
```

==设计要点==:
- ==只放最高频的稳定事实==(不超过 500 token)
- ==决策记录这种==走按需检索
- ==每次会话开始时从 MEMORY.md 拉==这一段(因为 Markdown 可能被人改了)

### 5.3 一个完整会话流程

```
会话开始
   ↓
Host 读 MEMORY.md 提取"高频事实"段塞进 system prompt
   ↓
LLM 看到 system prompt(==含项目偏好==)
   ↓
用户问:"上次我们为什么放弃 Redis?"
   ↓
LLM 调 memory_search("Redis 决策")
   ↓
SQLite 返回:"决策记录(2026-04-15.md:12-15):决定不引入 Redis,用 Caffeine"
   ↓
LLM 调 memory_get("决策记录.md", "12-15")
   ↓
返回完整决策记录(包括理由)
   ↓
LLM 回答:"2026-04-15 你们决定用 Caffeine,因为..."

中间用户说:"以后所有 PR 必须带测试,记一下"
   ↓
LLM 调 save_memory("项目约定:所有 PR 必须带测试")
   ↓
==MEMORY.md 追加一行 + SQLite 同步索引==
   ↓
下次任何会话都能搜到这条
```

---

## 六、与 RAG 的关系

==Memory 和 RAG 都用了向量检索==,经常被混为一谈。==关键区别==:

| 维度 | Memory | RAG |
|------|--------|-----|
| 目的 | 记住用户偏好、决策、个性化信息 | 检索外部知识库回答专业问题 |
| 数据来源 | ==对话自动沉淀==或用户主动 `/save` | ==外部文档主动导入== |
| 数据规模 | 几百到几千条事实 | 百万到亿级 chunk |
| 存储 | ==Markdown + SQLite==(本地轻量) | ==ES / Milvus / Qdrant==(集群重量) |
| 检索方式 | FTS5 + sqlite-vec 混合检索 | 向量 + BM25 + Rerank |
| 注入 | 按需(memory_search) | Top-K 拼入 prompt |

==RAG 的完整方法论==(混合检索/Embedding 选型/重排/Agentic RAG)见 [[RAG基础与架构]] 及 [[RAG检索策略]] [[RAG向量与Embedding]] [[RAG高级技术]],==本文不重复==。

==一句话==:==Memory 是"我的记忆",RAG 是"外部知识库"==——两者底层技术相似但==场景和规模完全不同==。

---

## 七、生产实现对比

| 产品 | L2 短期 | L3 长期 | 转换机制 |
|------|--------|--------|---------|
| ==Claude Code== | JSONL 会话日志 | `~/.claude/CLAUDE.md` + memory/*.md | session-memory Hook + Compaction |
| ==Cursor== | 内置 SQLite | `.cursorrules` 文件(规则)+ Notepads(记忆) | 用户手动维护为主 |
| ==OpenClaw== | SQLite conversations 表 | MEMORY.md + SQLite + sqlite-vec | Compaction 自动 |
| ==Hermes== | SQLite + 三层架构 | MEMORY.md + FTS5 + LLM 摘要 | 多触发条件 |

==共同点==:
- 都用==文件 + 嵌入式数据库==的本地方案,不依赖远程服务
- 都遵循"==Markdown 是本体=="原则
- 都支持==用户手动审查/修改==记忆

==Anthropic 的 Memory 设计哲学==:
> ==记忆是用户的资产,不是产品的锁定==——这是为什么 Claude Code 的记忆都在用户文件系统,而不是云端数据库。

---

## 相关链接

- [[Agent 核心概念]] — Agent 整体架构(Memory 是其中一个核心模块)
- [[多轮对话]] — 对话存储 schema、上下文窗口管理、五种重要性判断方案
- [[Agent Skills 体系]] — Skills 是显式的能力包,Memory 是隐式的事实沉淀
- [[RAG基础与架构]] — RAG 详解(与 Memory 的对比已在 §六)
- [[Function Calling]] — `memory_search` / `save_memory` 是工具调用的具体应用
- [[ReAct 与 Harness 实现]] — Memory 工具如何被 Agent 在 ReAct 循环中使用
