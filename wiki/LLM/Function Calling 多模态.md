---
module: LLM
tags: [LLM, Function Calling, 多模态, Vision, Browser MCP, Computer Use]
difficulty: hard
last_reviewed: 2026-06-01
---

# Function Calling 多模态

> 本文是 [[Function Calling]] 协议的多模态扩展——聚焦==图片如何进出模型==：工具返回图片（tool result）、用户输入图片（user input）、历史图片裁剪三大场景。是 Browser MCP / Computer Use 落地的关键协议细节。
>
> 协议主干（请求/响应结构、四种消息角色、多轮拼接、并行调用、厂商差异）见 [[Function Calling]]。

---

## 一、Image Tool Result：多模态返回

==tool 消息的 content 不止是字符串==——支持 ==image 类型==，把工具产生的截图 / 图表 / 图片直接作为下一轮 LLM 的视觉输入。==这是 Browser/Computer Use 落地的关键协议细节==——Agent 调 `take_snapshot` 拿到的是图片，==必须能塞回模型才形成闭环==。

### 三家厂商的 image content 格式

==Anthropic Claude==（content blocks 数组）：

```python
{
    "role": "tool",
    "tool_call_id": "call_abc",
    "content": [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": "iVBORw0KGgoAAA..."  # base64 编码的截图
            }
        },
        # 可以同时带文本描述
        {"type": "text", "text": "页面已加载，截图如上"}
    ]
}
```

==OpenAI==（multimodal content）：

```python
{
    "role": "tool",
    "tool_call_id": "call_abc",
    "content": [
        {
            "type": "image_url",
            "image_url": {"url": "data:image/png;base64,iVBORw0KGgoAAA..."}
        },
        {"type": "text", "text": "页面已加载"}
    ]
}
```

==Qwen-VL / GLM-4V / Kimi-Vision==：兼容 OpenAI 格式（`image_url` + `data:image/png;base64,`）。

### 关键设计：text fallback 必须保留

==生产 Agent 不能只发 image==——三个理由：

| 场景 | 为什么需要 text fallback |
|------|----------------------|
| ==模型不支持图片== | Router 路到纯文本模型（如 DeepSeek-V3.1 base / 早期 Qwen3-Coder）时，image content 直接报错 |
| ==审计日志== | image base64 几 MB，==日志存不下也读不动==——必须有人类可读摘要 |
| ==成本敏感== | 图片输入 token 计费高（一张 1024×1024 截图 ~1500 tokens），==短任务退化为纯文本省钱== |
| ==上下文压缩== | 历史轮次的截图==不可能全保留==，压缩时丢图保文本 |

==生产实现==：工具返回值==同时带 image 和 text==——Host 根据当前模型能力决定塞哪个：

```python
def normalize_tool_result(raw: dict, client: LlmClient) -> dict:
    parts = []
    if "image" in raw and client.supports_vision():
        parts.append({"type": "image", "source": {...}})
    # ★ text 永远保留(作为 fallback / 摘要 / 日志)
    parts.append({"type": "text", "text": raw.get("text") or describe(raw["image"])})
    return {"role": "tool", "tool_call_id": raw["call_id"], "content": parts}
```

==典型 Browser MCP 工具返回==：

```json
{
  "image": "<base64 截图>",
  "text": "页面 https://example.com 已加载,标题 'Example Domain',包含 1 个 <h1>、2 个 <p> 元素",
  "snapshot": "<DOM 结构 outline,简化版>"
}
```

==模型支持图==→ 塞 image；==模型不支持== / ==审计场景== → 塞 text + snapshot。

### Token 计费陷阱

==图片输入比文本贵==——一张高分辨率截图 = 几千 tokens：

| 模型 | 1024×1024 图片 token 估算 |
|------|-------------------------|
| Claude Sonnet 4.5 | ~1,600 tokens |
| GPT-5 | ~1,000 tokens（"high" detail） |
| Qwen-VL | ~1,200 tokens |

==Browser MCP 一轮交互可能 5-10 张截图==——==token 消耗几万级==。生产建议：
- ==优先用 DOM snapshot==（文本，几百 token）替代截图
- 截图==仅在需要视觉理解==时用（验证渲染效果、读图表）
- 历史轮次的截图==压缩时优先丢弃==

详见 [[长上下文工程#5 MCP Resources 在 Long Context 下的索引注入]] 的多模态 token 预算思路。

---

## 二、用户输入图片（Image as User Input）

==上面讲的是工具返回图片（tool result）==——还有另一种场景：==用户直接输入图片==（粘贴截图 / `@image:` 引用本地文件）。两者协议不同：

| 维度 | 工具返回图片 | 用户输入图片 |
|------|-----------|-----------|
| 消息角色 | `tool` | `user` |
| 触发方式 | 工具执行后自动 | 用户主动粘贴 / 引用 |
| 典型场景 | 浏览器截图 / 图表 | 用户截图问题 / 设计稿 |

==用户输入图片的 content 格式==（Anthropic）：

```python
{
    "role": "user",
    "content": [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": "iVBORw0KGgoAAA..."
            }
        },
        {"type": "text", "text": "这个报错是什么意思？"}
    ]
}
```

==图片预处理（发送前必做）==：

| 处理 | 原因 |
|------|------|
| ==压缩 / 缩放== | 原图可能几 MB，压到 1024px 以内省 token |
| ==alpha 通道铺白底== | 带透明通道的 PNG 发给部分模型会报错 |
| ==注入元信息== | 来源路径 / 原始尺寸 / 坐标映射（截图分析时 LLM 需要知道坐标对应哪里） |

==本轮图片优先原则==：如果用户本轮输入了图片，==要求 LLM 优先分析本轮图片==，不能用历史对话里的旧截图替代。

---

## 三、历史 Image Payload 裁剪

==图片 token 贵（1024×1024 ≈ 1500 tokens）==，历史轮次的图片如果全保留，几轮之后 context 就被旧截图占满。

==生产做法==：==新 turn 开始前，省略历史消息里的 image payload，只保留文本元信息==：

```python
def prune_image_history(messages: list) -> list:
    pruned = []
    for msg in messages[:-1]:  # 最新一轮保留完整图片
        if isinstance(msg["content"], list):
            new_parts = []
            for part in msg["content"]:
                if part["type"] == "image":
                    # 图片替换为文本元信息
                    new_parts.append({
                        "type": "text",
                        "text": f"[图片已省略: {part.get('_meta', {}).get('source', 'unknown')}, "
                                f"{part.get('_meta', {}).get('size', '')}]"
                    })
                else:
                    new_parts.append(part)
            pruned.append({**msg, "content": new_parts})
        else:
            pruned.append(msg)
    pruned.append(messages[-1])  # 最新一轮原样保留
    return pruned
```

==关键==：==只裁剪历史，不裁剪当前轮==——LLM 需要看到用户刚发的图片，但不需要看 5 轮前的截图。

==同理==：`reasoning_content`（模型的思考过程）也只写日志 / 展示，==不回传进下一轮请求历史==——避免思考过程占用大量 context。

---

## 相关链接

- [[Function Calling]] — Function Calling 协议主干（请求/响应/角色/多轮/并行/厂商差异）
- [[长上下文工程]] — 多模态 token 预算与历史压缩策略
- [[Coding Agent 工具集]] — Browser MCP 截图工具的返回值协议
