---
module: Baize
type: project
status: current
tags: [Baize, Qwen3, Thinking, 排障]
difficulty: easy
last_reviewed: 2026-05-29
---

# Qwen3 Thinking 模型接入排障

接入 Qwen3.5-9B thinking 模型过程中遇到的四个问题及解决方案。

## 系统链路

```
vLLM (Qwen3.5-9B, port 3598)
  → LlmProviderRouter（构建请求、解析 SSE chunk）
    → ChatHandler（RAG 检索 + 上下文构建 + WebSocket 推送）
      → 前端 chat-message.vue（渲染 thinking/content）
```

vLLM 输出 OpenAI SSE 兼容格式：思考阶段 `{"delta":{"reasoning":"..."}}`，回复阶段 `{"delta":{"content":"..."}}`；后端转发为 WebSocket JSON `{"type":"thinking"}` / `{"type":"content"}`。

## 问题一：content 永远为空

**现象**：前端只收到 `type=thinking`，所有输出都在思考框里，正文区为空。
**排查**：前端逻辑正确、后端 `processChunk()` 正确，临时加 `logger.info("[LLM-RAW-CHUNK] {}", rawChunk)` 后发现每个 chunk 的 `content` 始终为 `null`，全部文本落在 `reasoning` 字段。
**根因**：`start_llm.sh` 用了 `--reasoning-parser deepseek_r1`，但 Qwen3 的思考格式是 `<think>...</think>`（XML 标签），与 DeepSeek R1 的特殊 token 格式不同，parser 无法正确分离 reasoning / content。
**修复**：改为 `--reasoning-parser qwen3`（vLLM 内置专用 parser）。
**教训**：问题出在 vLLM 的 parser 层而非后端代码。不同模型家族 thinking 格式不同，切换模型时必须同步更换 reasoning parser，这个配置在 vLLM 启动脚本里，不在 Spring Boot 侧，容易被忽略。

## 问题二：max_tokens=2000 截断

**现象**：`completion_tokens` 始终为 2000，`finish_reason=length`，thinking 阶段吃光 token，content 没机会输出。
**根因**：配置覆盖链 `Java 默认值(2000) ← application.yml(无此行) ← application-docker.yml(dev 不生效) ← 环境变量(未设)`，最终生效的是 `AiProperties.java` 硬编码的 `maxTokens=2000`。yml 里的 `max-tokens: ${AI_GENERATION_MAX_TOKENS:}` 空默认值在环境变量未设时绑定失败，静默回落 Java 默认值。
**修复**：Java 默认值改为 `8000`，`application.yml` 不写 `max-tokens` 行，让 8000 作安全兜底。
**教训**：thinking 模型的 max_tokens 是 thinking + content 共享总预算，太低会被 thinking 吃光。Spring Boot `${VAR:}` 空默认值会绑定失败并静默回落，排查要从最底层（Java 默认值）往上查。
**检查清单**：改 max_tokens 时同时核对 `AiProperties.java` / `application.yml` / `application-docker.yml` / `.env` 的 `AI_GENERATION_MAX_TOKENS` 与 `SPRING_PROFILES_ACTIVE`。

## 问题三：简单问题 thinking 死循环

**现象**：用户发 "hello"，模型在 reasoning 阶段无限循环英文推理，不断重复，永远不输出 content。
**根因**：两因素叠加 ——（1）RAG 对任何输入都返回结果，低相关性结果（score 0.13-0.15）也被传入 context；（2）原逻辑 `context 非空 → enable_thinking=true`，没考虑相关性。复杂 RAG system prompt + 不相关 context + thinking 模式，三者叠加让模型陷入"我该怎么处理这些不相关参考资料"的无限推理。
**解决方案**：**三段式门控 + presence_penalty**，用 RAG 检索相关性分作为代理信号（现成、零额外延迟）判断何时该深度思考：

| maxScore 范围 | context | enable_thinking | 场景 |
|:---:|:---:|:---:|:---|
| < 0.3 | 空（过滤） | false | 闲聊/问候，直接回复 |
| 0.3 - 0.6 | 有 | false | 有一定相关性，但不需深度推理 |
| ≥ 0.6 | 有 | true | 高相关性，需综合推理 |

`presence_penalty=1.5` 作为第二层防护，即使 thinking 被错误开启也能抑制重复循环。为什么是三段而非两段：score 0.3-0.6 的结果有参考价值应作 context，但不足以证明问题复杂到需要 thinking，两段会被迫"丢 context"或"冒险开 thinking"。

> [!note] 当前实际状态（截至本次复盘）
> 三段式门控的**第一段（score<0.3 过滤）已生效**，但**第三段尚未真正实现**：`enable_thinking` 在 `LlmProviderRouter.buildRequest()` 中被**硬编码为 `false`**。`maxRelevanceScore` 参数已传入 `buildRequest()` 但当前未被使用。也就是说，RAG 场景目前一律不开 thinking。如需启用，需在 `buildRequest()` 中按 `maxRelevanceScore >= 0.6` 添加条件判断。
> 联动文件：`ChatHandler.java:40`（`MIN_RELEVANCE_SCORE=0.3`，生效中）、`ChatHandler.java:94`（`buildContext()` 返回 maxScore）、`LlmProviderRouter.java:51`（参数已传入未用）、`LlmProviderRouter.java:103`（`enable_thinking` 硬编码 false）。

**教训**：thinking 模型对输入非常敏感，不是"开了就好"。解决思路不是限制 thinking 输出长度（那只是截断症状），而是从源头控制什么时候开启 thinking。

> [!warning] 禁止操作
> - ❌ 不要把 `--reasoning-parser` 改回 `deepseek_r1`（与 Qwen3 的 `<think>` 格式不兼容，会导致 content 全空）
> - ❌ 不要移除 `presence_penalty=1.5`（移除后即使有三段式门控，仍可能重复循环）
> - ❌ 不要绕过三段式门控直接传 context（低相关性噪音会触发过度思考/死循环）
> - ❌ 不要在 `ChatHandler` 和 `LlmProviderRouter` 之间插入中间层（可能丢失或篡改 `maxScore`）

## 问题四：thinking 框默认展开

**现象**：思考框不点击就自动展开，正文还没看到就被一大段思考过程干扰。
**根因**：`v-if="thinkingExpanded || isThinking"`，模型正在思考（`isThinking=true`）时强制展开。
**修复**：改为 `v-if="thinkingExpanded"`，默认折叠、用户点击才展开。
**文件**：`frontend/src/views/chat/modules/chat-message.vue`。

## 修改文件汇总

| 文件 | 修改内容 |
|:---|:---|
| `Qwen3.5-9B/start_llm.sh` | `--reasoning-parser deepseek_r1` → `qwen3` |
| `config/AiProperties.java` | `maxTokens = 2000` → `8000` |
| `service/ChatHandler.java` | 新增 `ContextResult` record、`MIN_RELEVANCE_SCORE=0.3`、三段式门控（第一段过滤） |
| `service/LlmProviderRouter.java` | `streamResponse` 新增 `maxRelevanceScore` 参数、`presence_penalty=1.5`；`enable_thinking` 当前硬编码 false |
| `frontend/.../chat-message.vue` | thinking 框默认折叠 |
| `application.yml` | 删除 `max-tokens` 行 |

## 调试技巧

- 后端 `org.springframework.web.HttpLogging` 设为 DEBUG 可看发给 vLLM 的完整请求体
- 临时在 `LlmProviderRouter.processChunk` 加 `logger.info("[LLM-RAW-CHUNK] {}", rawChunk)` 查看每个 SSE chunk
- 检查 `.env` 的 `SPRING_PROFILES_ACTIVE` 确认哪个 yml profile 生效

## 相关链接

- [[聊天助手模块]] — 流式对话中的 Thinking 处理
- [[RAG管道设计]] — 检索相关性分如何作为门控信号
- [[模型选型]] — 为什么选 Qwen3
- [[评测体系与性能基线]] — thinking 开关对评测指标的影响
- [[LLM/LLM 基础与训练]] — LLM 推理参数调优
