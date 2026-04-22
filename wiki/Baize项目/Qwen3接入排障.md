# Qwen3 Thinking 模型接入排障

接入 Qwen3.5-9B thinking 模型过程中遇到的四个问题及解决方案。

## 问题一：content 永远为空

**现象**：所有输出都在 thinking 里，content 从未出现。
**根因**：`--reasoning-parser deepseek_r1` 与 Qwen3 的 `<think>...</think>` 格式不兼容。
**修复**：改为 `--reasoning-parser qwen3`。
**教训**：切换模型时必须同步更换 reasoning parser。

## 问题二：max_tokens=2000 截断

**现象**：thinking 消耗完所有 token，content 没机会输出。
**根因**：`AiProperties.java` 硬编码 `maxTokens=2000`，yml 空值绑定失败回落 Java 默认值。
**修复**：Java 默认值改为 8000。
**教训**：Spring Boot `${VAR:}` 空默认值会绑定失败，排查从 Java 默认值往上查。

## 问题三：简单问题 thinking 死循环

**现象**：用户发 "hello"，模型无限循环推理。
**根因**：低相关性 RAG 结果（score 0.13）触发 thinking，复杂 prompt 导致过度思考。
**修复**：三段式门控（score<0.3 过滤 + 0.3-0.6 不开 thinking + ≥0.6 开 thinking）+ presence_penalty=1.5。后来直接关闭 thinking（`enable_thinking=false`），RAG 场景不需要深度推理。
**教训**：thinking 模型对输入敏感，不是"开了就好"。

## 问题四：thinking 框默认展开

**现象**：思考框不点击就自动展开。
**根因**：`v-if="thinkingExpanded || isThinking"` 强制展开。
**修复**：改为 `v-if="thinkingExpanded"`。
