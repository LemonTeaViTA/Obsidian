---
module: Agent
tags: [LLM, Agent, Prompt Caching, 成本优化]
difficulty: hard
last_reviewed: 2026-06-12
---

# Prompt Caching 详解

> LLM provider 把请求的==前缀部分==缓存到服务端,下次请求==同样前缀==时不用重新计算 KV,==直接复用==。
>
> **为什么是 Coding Agent 成本第一杠杆**、三家厂商差异、`cache_control` 用法、命中率经济学详见本文。主文档速览见 [[长上下文工程#一、Prompt Caching 概览]]。

---

## 一、为什么是头号优化点

==为什么 Coding Agent 必须开 Prompt Caching==(否则字面意义烧钱):

| 部分 | 典型 token 量 | 是否每轮重复 |
|------|-------------|------------|
| ==System prompt==(身份 + 行为指南) | 2k - 10k | ==每轮一模一样== |
| ==工具描述==(tools schema) | 5k - 30k | ==每轮一模一样== |
| ==项目上下文==(CLAUDE.md / 规则文件) | 1k - 5k | ==每轮一模一样== |
| ==历史对话== | 不定 | ==前缀部分一模一样== |
| 当前用户消息 | 50 - 500 | 每轮变化 |

==没缓存==:每轮都要把 8k-50k 的固定前缀==重新算 KV==——延迟 + 成本 N 轮叠加。

==开缓存==:固定前缀==算一次缓存住==,后续 N 轮只��增量(几百 token)——==省 80%-90% 成本 + 延迟降到 1/3==。

==Anthropic 公开数据==:Claude Code 用户的 cache hit rate 中位数 ==85%+==,这就是为什么 Claude Code 长会话也不贵。

---

## 二、三家主流 API 的实现差异

| 厂商 | 触发方式 | TTL | 命中省钱 | 命中省时 |
|------|---------|-----|---------|---------|
| ==Anthropic== | ==手动 `cache_control` 标记缓存点== | ==5 分钟==(可买扩展到 1 小时) | ==90%==(命中部分按 10% 计费) | ==~80%==(无 prefill 计算) |
| ==DeepSeek== | ==自动==(任何重复前缀) | ~小时级(磁盘) | ==90%==(0.014 元 / 0.14 元 per M tokens) | ~70% |
| ==OpenAI== | ==自动==(>1024 token 前缀,完全相同才命中) | ~5-10 分钟 | ==50%==(命中部分半价) | ~50% |
| ==Gemini== | 显式 `CachedContent` API | 1 小时(默认) | 25%(命中部分 0.25x) | ~50% |
| ==Qwen / GLM / Kimi== | 自动(类 DeepSeek 模式) | 小时级 | 80%-90% | 70%+ |

==关键差异==:
- ==Anthropic 是手动==——你必须主动标记"==这里建缓存点==",更精准但要设计
- ==DeepSeek / 国产== 自动——开箱省钱,但缓存命中粒度由 server 决定
- ==OpenAI 自动==但命中条件最严(完全相同前缀 + >1024 token),代码场景 hit rate 低

---

## 三、Anthropic `cache_control` 用法详解

==四个关键设计==:

```python
# Anthropic API 示例
messages = [
    {"role": "user", "content": [
        # === 缓存点 1:System prompt + 工具描述 ===
        {
            "type": "text",
            "text": SYSTEM_PROMPT + TOOLS_SCHEMA_TEXT,
            "cache_control": {"type": "ephemeral"}  # ★ 标记此处建缓存
        },
        # === 缓存点 2:项目上下文(CLAUDE.md) ===
        {
            "type": "text",
            "text": project_context,
            "cache_control": {"type": "ephemeral"}
        },
        # === 缓存点 3:历史对话(前 N 轮) ===
        {
            "type": "text",
            "text": history_summary,
            "cache_control": {"type": "ephemeral"}
        },
        # === 不加 cache_control:当前用户消息(每轮变化) ===
        {"type": "text", "text": current_user_message}
    ]}
]
```

==四条规则==:

| 规则 | 说明 |
|------|------|
| ==最多 4 个缓存点== | API 限制——超过会报错;一般够用(system / tools / project / history) |
| ==前缀必须完全一致== | 缓存点之前的内容==哪怕变 1 个 token==,缓存就失效 |
| ==顺序敏感== | tools 在 system 之前 vs 之后 = 完全不同的缓存 |
| ==最小长度 1024 token== | 短于这个不缓存(避免缓存抖动) |

==踩坑==:
- ==时间戳进 prompt== → 每秒变,缓存==每次都失效==。==解决==:时间戳放最末段(用户消息部分),前缀保持稳定
- ==tools schema 顺序变化== → 用 `dict.items()` 不固定顺序时,工具列表顺序每次不同,缓存失效。==解决==:`sorted(tools, key=lambda t: t["name"])`
- ==消息合并方式不一致== → 一会儿合并多条 tool_result 一会儿不合,前缀变化。==解决==:统一合并策略

---

## 四、缓存命中率经济学

==实际成本计算==(Claude Sonnet 4.5):
- 普通 input:$3 / M token
- ==Cache write==(首次写入):$3.75 / M token(==贵 25%==)
- ==Cache read==(后续命中):$0.30 / M token(==便宜 90%==)

==举例==:Coding Agent 一次会话 20 轮,前缀 30k token

```
不开缓存:
   20 轮 × 30k × $3 / M = $1.8

开缓存:
   首轮:    30k × $3.75 / M = $0.1125  (cache write)
   后 19 轮: 19 × 30k × $0.30 / M = $0.171  (cache read)
   总计                          = $0.28

省 84% 成本($1.8 → $0.28)
```

==Coding Agent 实战==:Claude Code / Cursor / Cline ==默认开 cache==——这是==生产级 Coding Agent 的标配==,关掉就是字面烧钱。

---

## 五、缓存点设计的最佳实践

==分层缓存策略==(Coding Agent 通用模式):

```
┌──────────────────────────────────────────────┐
│ 缓存点 1: System Prompt + 工具描述           │  ←━ 最稳定,生命周期最长
├──────────────────────────────────────────────┤
│ 缓存点 2: 项目上下文 (CLAUDE.md / 规则)      │  ←━ 项目级稳定
├──────────────────────────────────────────────┤
│ 缓存点 3: 历史摘要 / 早期对话                │  ←━ 会话内增量
├──────────────────────────────────────────────┤
│ (无缓存) 当前用户消息 + tool_result           │  ←━ 每轮变化
└──────────────────────────────────────────────┘
```

==面试时讲清==:"Prompt Caching 的命中率取决于==前缀稳定性==,设计原则是==把变化的内容放最末段==,稳定的(system/tools/project)放前面并加缓存点。"

## 相关链接

- [[长上下文工程]] — 主文档(Context Mode / 动态预算 / Token可观测性)
- [[Context-Mode策略详解]] — Context Mode 切换策略详解
- [[模型路由策略]] — 多模型路由与 Prompt Cache 的协同
