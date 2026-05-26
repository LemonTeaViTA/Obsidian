---
module: LLM
tags: [LLM, Agent, Function Calling, Tool Use, OpenAI, Anthropic]
difficulty: hard
last_reviewed: 2026-05-25
---

# Function Calling 协议

> Function Calling 是==模型的原生能力==——通过专门训练，让 LLM 能输出符合 JSON Schema 的结构化工具调用指令，而不是在自然语言里"猜"工具。
>
> 本文聚焦协议细节：请求/响应结构、四种消息角色、多轮拼接、并行调用、厂商差异、可靠性与权限控制。
>
> 协议在分层架构中的位置见 [[Agent核心概念#二、推理模式与 Harness 控制流]]；具体的 ReAct 实现示例见 [[ReAct 与 Harness 实现]]。

---

## 一、是什么 + 解决什么问题

### 核心能力

LLM 厂商在训练时专门喂过这种数据："看到 `tools` 参数 → 输出结构化 `tool_calls`"。所以 Function Calling 是==模型内置的能力==，不是靠 prompt 引导出来的。

```
你：发请求带 tools 参数
       ↓
LLM：内置的工具调用能力被激活
       ↓
返回：tool_calls 字段（结构化对象），不是混在 content 文本里
```

### 解决什么

==让模型准确地触发工具调用==。

对比传统做法（把工具描述写在 system prompt 里、让 LLM 输出 JSON 字符串、框架自己 `json.loads`）：

| 维度 | 传统 prompt 做法 | Function Calling |
|------|----------------|------------------|
| 工具描述位置 | system prompt 里写文字 | API 的 `tools` 参数（结构化 schema） |
| LLM 输出位置 | `message.content`（普通文本字段） | `message.tool_calls`（独立字段） |
| 解析失败率 | 高（多个引号、Markdown 包裹、自然语言混入都会翻车） | ==极低==（模型专门训练过结构化输出） |
| 是否需要框架手动解析字符串 | 是（脆弱） | 否（API 已经解析好） |
| 现代地位 | 早期 LangChain ReAct 用这套 | ==2024 年后生产事实标准== |

==方式 A 不死，但生产现在都用方式 B==。

---

## 二、请求结构：tools schema 怎么写

==发给 LLM 的 HTTP body 里多一个 `tools` 字段==——这就是"传 tools 参数"的全部含义。

### 完整请求 body

```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "system", "content": "你是助手。"},
    {"role": "user", "content": "帮我看 pom.xml"}
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "read_file",
        "description": "读取磁盘文件的完整内容。仅限读取，不能修改。如果文件不存在会报错。",
        "parameters": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "description": "文件路径，相对当前工作目录"
            }
          },
          "required": ["path"]
        }
      }
    }
  ]
}
```

### 工具 schema 的三个关键字段

| 字段 | 作用 | 写不好的后果 |
|------|------|-------------|
| `name` | 工具名（LLM 输出 `tool_calls` 时返回的就是这个名字） | 名字含糊（如 `do_thing`）→ LLM 选错工具 |
| `description` | ==决定 LLM 何时用、为什么用==——LLM 全靠这段文字判断 | 描述模糊 → LLM 乱用或不用 |
| `parameters` | JSON Schema 描述参数（类型、必填、枚举值、范围） | schema 不严谨 → LLM 传错参数 |

### description 写得好 vs 写得差

```python
# ❌ 反例：LLM 看到这种描述会乱用
{"name": "search", "description": "搜索"}

# ✅ 正例：明确边界、明确触发条件
{
  "name": "search_docs",
  "description": (
    "在内部技术文档库中搜索关键词。"
    "==仅==检索 Confluence/Notion 已索引文档，不访问外网。"
    "==适用于==：用户问公司内部产品/流程/规范。"
    "==不适用==：通用知识问答（用 LLM 自身回答即可）、最新新闻（用 web_search）。"
    "返回 Top 5 文档摘要 + 链接。"
  )
}
```

==description 是 LLM 唯一的判断依据==——LLM 不知道工具实际能干什么，只会按你写的去理解。description 写错就是 bug，==LLM 不会自动检查==。

### parameters 用 JSON Schema

`parameters` 字段是标准的 [JSON Schema](https://json-schema.org/)：

```json
{
  "type": "object",
  "properties": {
    "query": {"type": "string", "description": "搜索关键词"},
    "top_k": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5},
    "category": {
      "type": "string",
      "enum": ["product", "engineering", "hr"],
      "description": "限定搜索类目"
    }
  },
  "required": ["query"]
}
```

==enum、minimum、maximum、required 都会被 LLM 看见==——能用 enum 就别用 free string，能 required 就强制 required，越严越不容易翻车。

---

## 三、四种消息角色

Function Calling 把消息角色从原来的 3 种（system / user / assistant）扩展到 4 种，新增 `tool` 角色。

| role | 谁产生 | 内容 | 何时出现 |
|------|-------|------|---------|
| `system` | 你（开发者） | Agent 的角色定位、行为约束 | 每次请求第一条 |
| `user` | 终端用户 | 用户输入的问题 | 用户每次提问 |
| `assistant` | LLM | 普通文字回答 ==或== 工具调用（`tool_calls` 字段） | LLM 每次返回 |
| `tool` | 你（执行后填回） | 工具执行结果，==绑定 `tool_call_id`==关联到上一轮 LLM 调用的哪个工具 | 工具执行完后下一轮请求带上 |

### 一个完整对话的角色序列

```
轮次 1：
  system    "你是助手"
  user      "帮我看 pom.xml"

LLM 返回：
  assistant tool_calls=[{id: "call_abc", function: read_file(path=pom.xml)}]

工具执行后，发起轮次 2：
  system    "你是助手"           ← 每轮都要带
  user      "帮我看 pom.xml"
  assistant tool_calls=[...]      ← 上轮 LLM 输出
  tool      tool_call_id="call_abc", content="<dependencies>..."  ← 工具执行结果

LLM 返回：
  assistant content="你的依赖是..."  ← 这次没有 tool_calls，是最终答案
```

==注意==：`tool` 角色消息==必须带 `tool_call_id`==，关联到上一轮 LLM 调用的某个 `tool_calls[i].id`——这样 LLM 知道这条结果对应哪次调用。多个并行工具调用就是多个 `tool` 消息。

---

## 四、响应结构

LLM 返回的 response 结构，==关键看三处==：

### 4.1 完整响应 JSON（OpenAI 格式）

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_abc123",
          "type": "function",
          "function": {
            "name": "read_file",
            "arguments": "{\"path\": \"pom.xml\"}"
          }
        }
      ]
    },
    "finish_reason": "tool_calls"
  }]
}
```

### 4.2 三个关键字段

| 字段 | 含义 | 怎么用 |
|------|------|-------|
| `content` | 普通文字回答 | 调工具时通常是 `null`；最终答案时是文本 |
| `tool_calls` | 工具调用数组 | ==独立字段，不是塞在 content 文本里==；多个就是并行调用 |
| `finish_reason` | 结束原因 | `"tool_calls"` = 模型要调工具；`"stop"` = 模型在回答；`"length"` = token 截断 |

==代码用 `tool_calls` 是否为空判断走哪条路==：

```python
msg = response.choices[0].message
if msg.tool_calls:
    # 模型要调工具
    for tc in msg.tool_calls:
        tool_name = tc.function.name
        tool_args = json.loads(tc.function.arguments)
        result = TOOLS[tool_name](**tool_args)
        # 把 result 拼回 messages，发下一轮
else:
    # 模型在正常回答
    print(msg.content)
```

### 4.3 content 和 tool_calls 是否互斥？

==大多数情况互斥==：调工具时 `content: null + tool_calls: [...]`；最终回答时 `content: "..." + tool_calls: null`。

==但==少数模型（比如 Claude 的 Extended Thinking 模式）会两个都有：先在 content 里"出声思考"几句，再在 tool_calls 里给调用——==代码两个都要处理==，不能假设 content 一定是 null。

### 4.4 arguments 还是字符串

==注意一个反直觉的点==：`tc.function.name` 直接是字符串 `"read_file"` 能用，==但 `tc.function.arguments` 还是 JSON 字符串==，得 `json.loads` 一次：

```python
tool_name = tc.function.name                       # "read_file" ← 直接用
tool_args = json.loads(tc.function.arguments)      # {"path": "pom.xml"} ← 还需解析
```

OpenAI 这么设计是历史包袱——多家厂商也跟随了，==所以 `json.loads(arguments)` 是固定写法==。

---

## 五、多轮工具调用：消息序列怎么拼

每轮请求都是==无状态的全量发送==——LLM 不记得上轮，你必须把所有历史塞进 messages 数组。

### 一个完整的 messages 数组演化

```python
# 轮次 1：用户首次提问
messages = [
    {"role": "system", "content": "你是助手"},
    {"role": "user", "content": "帮我看 pom.xml 里有什么依赖"}
]
# 发请求带 tools=[...]

# LLM 返回 tool_calls，本地解析
assistant_msg = response.choices[0].message
# assistant_msg.tool_calls = [{id: "call_1", function: read_file(path="pom.xml")}]

# 轮次 2：把 LLM 的 tool_calls + 工具执行结果一起拼回
messages = [
    {"role": "system", "content": "你是助手"},
    {"role": "user", "content": "帮我看 pom.xml 里有什么依赖"},
    # ↓ 把上一轮 LLM 的输出原样塞回
    {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {"id": "call_1", "type": "function",
             "function": {"name": "read_file", "arguments": "{\"path\": \"pom.xml\"}"}}
        ]
    },
    # ↓ 新增工具执行结果消息
    {
        "role": "tool",
        "tool_call_id": "call_1",          # 关联到上面 assistant 里的 id
        "content": "<dependencies><dependency>spring-boot-starter</dependency>...</dependencies>"
    }
]
# 再次发请求，仍然带 tools=[...]

# LLM 返回最终答案
# assistant_msg.content = "你的 pom.xml 包含以下依赖..."
# assistant_msg.tool_calls = None
```

### 三个必踩的坑

==每轮都要带 `tools` 字段==——LLM 是无状态的，不带它就不知道有工具。

==`assistant` 消息要原样塞回==——含 `tool_calls` 字段也要带，==不能只带 content==。漏了 LLM 会困惑"我什么时候调过工具？"。

==每个 `tool_calls[i]` 都要对应一条 `tool` 消息==——并行调了 3 个工具就要塞 3 条 tool 消息，少一条 LLM 报错"unmatched tool_call_id"。

---

## 六、并行调用

现代 Function Calling 支持==一次返回多个 tool_calls==：

```python
# 用户问："帮我看 pom.xml 和 build.gradle 里都有什么依赖"
# LLM 返回：
{
  "tool_calls": [
    {"id": "call_1", "function": {"name": "read_file", "arguments": "{\"path\": \"pom.xml\"}"}},
    {"id": "call_2", "function": {"name": "read_file", "arguments": "{\"path\": \"build.gradle\"}"}}
  ]
}
```

### 你的代码可以并发执行

```python
import asyncio

async def execute_tool(tc):
    tool_name = tc.function.name
    tool_args = json.loads(tc.function.arguments)
    return tc.id, await TOOLS[tool_name](**tool_args)

# ==并发执行所有 tool_calls==
results = await asyncio.gather(*[execute_tool(tc) for tc in msg.tool_calls])

# 拼回多条 tool 消息
for call_id, result in results:
    messages.append({
        "role": "tool",
        "tool_call_id": call_id,
        "content": str(result)
    })
```

==N 个独立工具==并行执行 = N 倍加速，比串行快很多。

### 关闭并行

OpenAI 默认开启并行调用。某些场景需要严格串行（比如工具间有依赖），可以传：

```python
response = openai.chat.completions.create(
    model="gpt-4",
    messages=messages,
    tools=tools,
    parallel_tool_calls=False   # 强制每次只返回一个 tool_call
)
```

---

## 七、厂商差异

OpenAI 是事实标准，但 Anthropic / Qwen / DeepSeek 各家协议略有差别。

### 7.1 OpenAI（事实标准）

```python
tools = [{
    "type": "function",
    "function": {
        "name": "read_file",
        "description": "...",
        "parameters": {...}      # ← JSON Schema 字段名是 "parameters"
    }
}]

response = openai.chat.completions.create(
    model="gpt-4", messages=messages, tools=tools
)
# 响应：response.choices[0].message.tool_calls
```

### 7.2 Anthropic（Claude）

```python
tools = [{
    "name": "read_file",
    "description": "...",
    "input_schema": {...}       # ← 字段名是 "input_schema"，==不是 parameters==
}]

response = anthropic.messages.create(
    model="claude-sonnet-4-6", messages=messages, tools=tools
)
# 响应：response.content 是数组，里面 type="tool_use" 的元素是工具调用
for block in response.content:
    if block.type == "tool_use":
        tool_name = block.name
        tool_args = block.input    # ==已经是 dict，不是字符串==——比 OpenAI 省一步
```

### 7.3 Qwen / DeepSeek / Moonshot（兼容 OpenAI）

国产模型基本都==兼容 OpenAI 的 schema==，可以直接用 `openai` SDK，只改 `base_url`：

```python
from openai import OpenAI
client = OpenAI(
    api_key="...",
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"  # 阿里千问
)
# ↑ 之后用法和 OpenAI 完全一致
```

### 7.4 跨厂商的统一抽象

如果要支持多家模型，==别自己写适配层==——用 [LiteLLM](https://github.com/BerriAI/litellm) 统一封装，200+ 模型同一套 API。Hermes 框架就是基于 LiteLLM。

```python
from litellm import completion

response = completion(
    model="gpt-4",                    # 改成 "claude-sonnet-4-6" 或 "qwen-max" 都能用
    messages=messages, tools=tools
)
# 响应统一成 OpenAI 格式
```

---

## 八、协议层的可靠性

==Function Calling 不等于 100% 可靠==——即使 GPT-4 级别的模型，参数正确率也不是 100%。本节聚焦==协议层==的可靠性问题（schema、解析、API 错误）；==执行层==（工具超时、下游打挂）和==决策层==（失败后 Agent 怎么办）属于 Agent 工程范畴，详见 [[Agent工程实践#八-B、Agent 可靠性设计（实战设计题）]]。

### 8.1 参数 schema 校验

LLM 可能传错参数：必填字段缺失、类型错误、枚举值不存在、值越界。==协议本身不保证 LLM 的输出严格满足 schema==——必须在你的代码里显式校验。

```python
import json
from jsonschema import validate, ValidationError

tc = response.choices[0].message.tool_calls[0]
try:
    args = json.loads(tc.function.arguments)
    validate(args, TOOLS_SCHEMA[tc.function.name])  # JSON Schema 校验
    result = TOOLS[tc.function.name](**args)
except (json.JSONDecodeError, ValidationError) as e:
    # 参数无效 → 把错误回注让 LLM 重新生成（最多重试 3 次）
    error_msg = f"参数无效：{e}。请重新生成符合 schema 的参数。"
    messages.append({"role": "tool", "tool_call_id": tc.id, "content": error_msg})
```

==生产环境的硬规则==：参数校验失败 → 回注让 LLM 重试，最多 3 次；超过 3 次说明 schema 有问题，触发告警。

### 8.2 JSON 解析失败

==方式 B（Function Calling）的 `arguments` 字段仍是 JSON 字符串==——虽然模型经过专门训练，==但生产中偶尔仍会输出不合法 JSON==（多余引号、转义错误、截断）。处理方式同上：捕获 `JSONDecodeError`，把错误回注让 LLM 重试。

==方式 A（传统 prompt）的 JSON 解析失败率显著更高==——这就是为什么生产事实标准是方式 B。

### 8.3 tool_call_id 不匹配

多轮拼接时如果 ==`tool` 消息的 `tool_call_id`==没对齐到上一轮 `tool_calls[i].id`，OpenAI 会直接返回 400 错误：

```
Error: tool_call_id "call_xxx" does not match any tool call in the conversation.
```

常见原因：
- 漏拼了某条 `tool` 消息（并行调了 N 个工具但只回了 N-1 条）
- `tool_call_id` 写错（拼错字符、拿错变量）
- 重复处理（同一个 tool_call 拼了两条 tool 消息）

==生产代码必须在拼 messages 时校验==：每个 `tool_calls[i].id` 必须有且仅有一条对应的 `tool` 消息。

### 8.4 模型选错工具：description 写得不到位

==这是协议外的可靠性问题==——LLM 选错工具的根本原因往往是 description 写得不清楚（详见 §二.2 description 写得好 vs 差对比）。==description 写好比加重试更治本==——很多"不可靠"其实是工具描述不到位。

---

## 相关链接

- [[Agent核心概念]] — Agent 整体架构
- [[ReAct 与 Harness 实现]] — 60 行 ReAct 代码 + 工具识别两种方式
- [[Harness Engineering]] — Function Calling 在 Harness 分层中的位置
- [[Agent核心概念#四、MCP 协议]] — MCP 协议（工具如何标准化暴露给模型）
- [[Agent工程实践#八-B、Agent 可靠性设计（实战设计题）]] — ==执行层/决策层==的可靠性（工具超时、Fallback 策略、L1-L4 决策路径、Human-in-the-Loop）
