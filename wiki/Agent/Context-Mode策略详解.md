---
module: Agent
tags: [LLM, Agent, Context Mode, RAG, MCP Resources, 成本优化]
difficulty: hard
last_reviewed: 2026-06-12
---

# Context Mode 策略详解

> Harness 层根据模型能力 + 任务类型动态切换上下文策略，覆盖 **Context Mode 三档**（short/balanced/long）、**RAG topK 自适应**、**MCP Resources 索引注入**三个联动机制。
>
> 主文档速览见 [[长上下文工程#三、Context Mode 概览]]。

---

## 一、三种模式：short / balanced / long

==生产级 Coding Agent 都有 context mode 切换==（Cursor 的 "Max" / Cline 的 context optimization），==因为没有"一刀切最优"==：

| 模式 | 适用 | 历史压缩 | RAG topK | Resources 索引 | 触发条件 |
|------|------|---------|---------|---------------|---------|
| ==short== | 快问快答 / 简单任务 / 成本敏感 | ==积极压缩==(摘要 + 滑窗) | ==5== | ==不注入== | window < 50k 或用户选 |
| ==balanced== | 默认模式 / 中等任务 | ==中等压缩==(关键信息保留) | ==10== | ==不注入== | 默认 |
| ==long== | 大型代码库 / 跨文件分析 / 1M window | ==不压缩==(原文保留) | ==20== | ==URI + 描述索引注入== | window ≥ 200k 或用户选 |

==为什么不统一用 long==：
- 历史不压缩 → 历史轮次多了之后==前置内容覆盖大量 token==，反而把当前任务挤出去
- topK 拉到 20 → ==每次检索 token 翻倍==，且大量低相关结果稀释注意力
- Resources 索引注入 → ==system prompt 多 5-10k token==，缓存命中率下降

==long mode 是"换一种代价"==（更多 token / 更慢 / 更贵）换"==更全的可见信息=="——只有真正需要时才开。

---

## 二、模式驱动的下游策略矩阵

==同一个 Agent 行为根据 mode 切换==——典型联动：

```python
class ContextMode(Enum):
    SHORT = "short"
    BALANCED = "balanced"
    LONG = "long"

def apply_mode(mode: ContextMode) -> AgentConfig:
    if mode == ContextMode.SHORT:
        return AgentConfig(
            history_strategy="summarize_aggressive",  # 摘要压缩
            rag_top_k=5,
            inject_mcp_resources_index=False,
            max_tool_result_size=5_000,               # 工具返回截断
            sliding_window_turns=10,                  # 只保留最近 10 轮
        )
    elif mode == ContextMode.BALANCED:
        return AgentConfig(
            history_strategy="summarize_balanced",
            rag_top_k=10,
            inject_mcp_resources_index=False,
            max_tool_result_size=20_000,
            sliding_window_turns=30,
        )
    elif mode == ContextMode.LONG:
        return AgentConfig(
            history_strategy="keep_raw",              # ★ 不压缩
            rag_top_k=20,                             # ★ 拉满
            inject_mcp_resources_index=True,          # ★ 注入索引
            max_tool_result_size=100_000,
            sliding_window_turns=None,                # ★ 不滑窗
        )
```

==关键设计==：==mode 是 1 个 enum，联动 5+ 个策略==——别让用户单独调每个开关，==复杂度爆炸==。

---

## 三、模式选择：自动 vs 手动

==生产做法==：==默认 balanced + 用户可手动切== + ==自动建议==：

```python
def auto_suggest_mode(client: LlmClient, task: str) -> ContextMode:
    window = client.max_context_window()

    # 模型 window 太小 → 强制 short
    if window < 50_000:
        return ContextMode.SHORT

    # 模型 window 巨大且任务关键词命中 → 建议 long
    if window >= 500_000 and any(kw in task for kw in ["全项目", "整个代码库", "跨文件"]):
        return ContextMode.LONG

    return ContextMode.BALANCED
```

==用户体验==：`/context` 命令显示当前 mode + 提示"==当前模型 window 1M，你可以试试 long mode 处理大型分析任务=="。

---

## 四、RAG topK 自适应

### 4.1 问题：topK 不能写死

==传统 RAG 默认 topK = 5/10==——这是 32k window 时代的合理值。==long context 下==：

| Window | 合理 topK | 理由 |
|--------|---------|------|
| 32K | 3-5 | 检索结果占太多 prompt 空间 |
| 200K | 10 | 平衡覆盖率和噪声 |
| 1M | ==20-50== | 召回率优先，模型能消化 |

==没自适应的代价==：
- ==topK = 5 跑在 1M 模型上== → 召回率太低，关键文档被漏
- ==topK = 50 跑在 32k 模型上== → 检索结果直接挤爆 prompt

### 4.2 实现：跟着 context mode 走

```python
def search_code(query: str, top_k: Optional[int] = None) -> list[Doc]:
    # 显式指定优先
    if top_k is not None:
        return semantic_search(query, k=top_k)

    # 默认：根据当前 context mode 自适应
    mode = current_context_mode()
    auto_k = {
        ContextMode.SHORT: 5,
        ContextMode.BALANCED: 10,
        ContextMode.LONG: 20,
    }[mode]
    return semantic_search(query, k=auto_k)
```

==踩过的坑==：用户切到 long mode 期望"看到更多结果"，但工具签名 `search_code(query, top_k=10)` 把 top_k 写死了——==自适应逻辑被覆盖==。==修复==：让 top_k 默认 None，只在显式传值时覆盖。

### 4.3 实时 grep 优先 vs RAG

==生产经验==：==代码定位优先实时 grep + read==，==RAG 是补充==。

- grep ==确定性高==——给定文件名/函数名，grep 一定找到
- RAG ==基于语义==——可能召回相关但不准确的文件

==long mode 下==：topK 拉高(20)是==增强 search_code 的兜底能力==，不是把它当主要手段——主路径仍然是 LLM 用 grep + read 自己定位。

---

## 五、MCP Resources 在 Long Context 下的索引注入

### 5.1 问题：LLM 不知道有哪些 Resource 可读

==MCP Resources== 是只读数据——但默认实现下：
- LLM 只看到 `list_resources` / `read_resource` 两个虚拟工具
- ==LLM 不知道实际有哪些 Resource 可读==——必须先调 `list_resources` 才知道
- 多走一轮 → 延迟 + token 浪费

### 5.2 long mode 下的索引注入策略

==long mode 下，window 富余==——可以==预先把 Resource 索引塞到 system prompt==：

```python
def build_system_prompt(mode: ContextMode, mcp_resources: dict) -> str:
    base = LOAD_BASE_SYSTEM_PROMPT()

    if mode == ContextMode.LONG:
        # ★ 注入 URI + description，不注入正文
        index_section = "## 可用 MCP Resources\n\n"
        for server, resources in mcp_resources.items():
            for r in resources:
                index_section += f"- `{r.uri}` — {r.description}\n"
        base += "\n\n" + index_section

    return base
```

==关键==：==只注入 URI + 描述，不注入正文==——

| 注入方式 | Token 量 | 何时用 |
|---------|---------|------|
| ==只 URI + 描述==(索引) | ~10 token / resource | ==long mode 默认== |
| ==URI + 描述 + 摘要== | ~50 token / resource | 极长 window 且 resources 少 |
| ==URI + 描述 + 完整正文== | ~1000+ token / resource | ==几乎不用==——直接塞死 prompt |

==典型规模==：50 个 resources × 10 token = 500 token——一个长 system prompt 多 500 token，换来 LLM 直接知道有哪些资源可读，==省一轮 list_resources 调用==。

### 5.3 short / balanced mode 下不注入

==为什么 short/balanced 不注入==：
- ==window 紧张==——多 500 token 影响其他重要内容
- ==Prompt cache 命中率下降==——resources 列表会变，前缀稳定性破坏
- ==大部分任务用不到 Resources==——LLM 需要时再调 list_resources 即可

> [!tip] 面试要点
> "long mode 下注入 Resource 索引"是 token-friendly 的优化，核心是==只注入元信息(URI + 描述)不注入正文==——让 LLM 知道有什么可读但不预先加载，避免 50 个 resource 全部塞 prompt 的灾难。

## 相关链接

- [[长上下文工程]] — 主文档（Prompt Caching / 动态预算 / Token可观测性）
- [[Prompt-Caching详解]] — Prompt Caching 详解
- [[MCP 协议概述]] — MCP Resources 协议层
- [[RAG检索策略]] — RAG 检索策略与 topK 选择
