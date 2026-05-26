---
module: LLM
tags: [LLM, Agent, ReAct, Harness, 工具调用]
difficulty: hard
last_reviewed: 2026-05-25
---

# ReAct 与 Harness 实现

> 这是 Agent 工程的最底层认知——==LLM 在屋里只会写文字，Harness 在屋外做实际执行==。读完本文你会清楚：LLM 干什么、框架干什么、为什么是这样分工，以及怎么用 60 行 Python 把 ReAct 跑起来。
>
> ReAct/Plan-and-Execute/Reflection 三种推理框架的概念对比见 [[Agent核心概念#二、推理模式与 Harness 控制流]]；工具调用协议细节见 [[Function Calling]]。

---

## 一、LLM 的本质：一个无状态的纯函数

==LLM 自己==**几乎什么也干不了**——它就是：

```
输入（文本）→ LLM → 输出（文本）
```

仅此而已。==LLM 不会==：

- ❌ 调用任何 API
- ❌ 读你的文件
- ❌ 执行命令
- ❌ 记住上一句你说了什么（每次都是 stateless）
- ❌ 自己循环
- ❌ 真的"做"任何事

==它只会接收文本、生成文本==。

> [!warning] 大部分人对 ReAct 的最大误解
> 以为"思考是 LLM 干的，行动也是 LLM 干的"。==错==。==思考==是 LLM（生成 thought 文本）；==行动==的"决定调什么工具"也是 LLM；但==真正去执行工具==是 Harness（你的 Python 代码）。下面用具体例子拆开。

---

## 二、一个具体例子：用户问"帮我看下 pom.xml 里有什么依赖"

### 2.1 没有 Harness 框架时

```
你 → LLM: "帮我看下 pom.xml 里有什么依赖"
LLM → 你: "好的，你的 pom.xml 里有 spring-boot-starter、mysql-connector..."
            ↑ ==凭空编==——它根本读不到你的文件
```

### 2.2 有 ReAct 框架时

```
==第 1 轮==
[你] 帮我看下 pom.xml 里有什么依赖
   ↓
[Harness] 拼接 prompt：
   "你是助手，可用工具：read_file(path) / list_directory(path)
    用户问：帮我看下 pom.xml 里有什么依赖"
   ↓
[Harness] 调用 LLM API（HTTP 请求）
   ↓
[LLM] ==只是输出文本==：
   {
     "thought": "我需要先读 pom.xml",
     "action": "read_file",
     "args": {"path": "pom.xml"}
   }
   ↓
[Harness] 解析 JSON ← LLM 没真的读文件，==只写了"我想读"==
   ↓
[Harness] ==实际执行==：file_content = open("pom.xml").read()  ← Python 在做
   ↓
[Harness] 拼新 prompt：
   "...上次内容...
    工具返回：<dependencies><dependency>spring-boot-starter</dependency>...</dependencies>"
   ↓

==第 2 轮==
[Harness] 再次调用 LLM API
   ↓
[LLM] 输出：
   {
     "thought": "看到内容了，可以回答",
     "answer": "你的 pom.xml 包含以下依赖：..."
   }
   ↓
[Harness] 检测到 answer → 循环结束
   ↓
[Harness] 把 answer 返回给你
```

---

## 三、谁干了什么——完整分工对照

| 任务 | 谁做 |
|------|------|
| 思考"接下来做什么" | ==LLM==（生成 thought 文本） |
| 决定"调哪个工具、参数是啥" | ==LLM==（生成 action JSON） |
| 生成最终答案文本 | ==LLM==（生成 answer 文本） |
| 拼接 prompt（用户问题 + 工具列表 + 历史 + 上次工具返回） | ==Harness== |
| 调用 LLM API（发 HTTP 请求） | ==Harness== |
| 解析 LLM 输出的 JSON | ==Harness== |
| ==真的去读 pom.xml 文件== | ==Harness== |
| ==真的去执行 shell 命令、调 API、查数据库== | ==Harness== |
| 把工具返回值塞回下次 prompt | ==Harness== |
| 判断什么时候停 | ==Harness== |
| 循环（继续下一轮） | ==Harness== |
| 异常处理（工具失败把 error 喂回 LLM） | ==Harness== |
| 超时（max_steps、超时时间） | ==Harness== |
| 权限检查 | ==Harness== |

==LLM 只决定"做什么"==，==Harness 真的去"做"==。

---

## 四、一个鲜活的类比

==LLM 是一个被关在屋里的人==——**不能动、不能看外面、没有手机，==只能通过纸条和外界沟通==**。

```
你（用户）写纸条递进去："帮我看下 pom.xml"
   ↓
屋里的 LLM 写新纸条："我需要看 pom.xml，请把内容给我"
   ↓
==屋外的秘书==（==这就是 Harness==）读纸条：哦，他想看文件
   ↓
秘书去做：cat pom.xml，把结果写到新纸条
   ↓
秘书把新纸条递进屋
   ↓
LLM 看到内容，写新纸条："你的依赖是..."
   ↓
秘书把这张纸条递给你
```

==LLM 永远在屋里没动==——它一直在写纸条。==所有"实际执行"的部分都是 Harness 做的==：读文件、调 API、运行命令、控制流、异常、超时、权限，==除了"想"和"写文本"之外的一切==。

==Cursor / Claude Code 这种 Coding Agent 的核心创新不在 LLM 本身==，而在它们的 Harness 设计有多精致。==同一个 Claude 模型==换不同的 Harness，编程成功率从 42% → 78%（详见 [[Harness Engineering#四、Harness 为什么比模型本身更重要？]]）——==这个差距全部来自 Harness 设计，模型本身没动==。

---

## 五、从零写一个极简 ReAct——60 行 Python

==没有任何"魔法"==，全是手写代码。生产级框架（LangChain / LangGraph）只是在这个基础上加了异常处理、重试、并行、可观测性、Memory 抽象——==核心循环不变==。

```python
import json

# ============ 第 1 部分：定义工具（手写代码） ============

def read_file(path: str) -> str:
    """读取文件内容"""
    with open(path, 'r') as f:
        return f.read()

def list_directory(path: str) -> list:
    """列出目录"""
    import os
    return os.listdir(path)

# 工具注册表：名字 → 真实函数
TOOLS = {
    "read_file": read_file,
    "list_directory": list_directory,
}

# ============ 第 2 部分：拼接 prompt（手写） ============

SYSTEM_PROMPT = """你是一个助手。可用工具：

1. read_file(path: str) -> str  读取文件内容
2. list_directory(path: str) -> list  列出目录内容

输出格式（必须是 JSON）：
- 想调工具：{"action": "工具名", "args": {...}}
- 完成任务：{"answer": "最终答案"}
"""

def build_prompt(user_query, history):
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history,
        {"role": "user", "content": user_query}
    ]

# ============ 第 3 部分：ReAct 循环（这就是 Harness 核心） ============

def react_loop(user_query, max_steps=5):
    history = []

    for step in range(max_steps):
        # ① 拼 prompt
        messages = build_prompt(user_query, history)

        # ② 调 LLM API（HTTP 请求）
        response_text = llm.invoke(messages)

        # ③ 解析 LLM 输出
        response = json.loads(response_text)

        # ④ 检测是否完成
        if "answer" in response:
            return response["answer"]

        # ⑤ ==实际执行工具==（Harness 真的"做"的部分）
        tool_name = response["action"]
        tool_args = response["args"]

        if tool_name not in TOOLS:
            observation = f"错误：没有 {tool_name} 这个工具"
        else:
            try:
                observation = TOOLS[tool_name](**tool_args)
            except Exception as e:
                observation = f"工具失败：{e}"

        # ⑥ 把 observation 加到 history（下轮 LLM 能看到）
        history.append({"role": "assistant", "content": response_text})
        history.append({"role": "user", "content": f"工具返回: {observation}"})

    return "超过最大步数"
```

==整个 ReAct 框架的核心就这 60 行==。

---

## 六、工具是怎么"被识别"的？两种方式

==这是新手最大的疑问之一==。

### 6.1 方式 A：传统做法（写在 prompt 里）

工具描述==文字写在 system prompt 里==，让 LLM 看到描述就"知道"有这些工具。LLM 输出 JSON 字符串，==框架自己解析==：

```python
response_text = llm.invoke(messages)        # ← 字符串
response = json.loads(response_text)         # ← 框架解析 JSON 字符串
tool_name = response["action"]               # ← 拿出工具名
tool_func = TOOLS[tool_name]                 # ← 注册表里查到对应函数
result = tool_func(**response["args"])       # ← 调用真实函数
```

==缺点==：LLM 输出格式不严谨——多个引号、中文逗号、Markdown 代码块包裹 JSON——==解析常常失败==。早期 LangChain ReAct 用这套，碰到这些坑很多。

==§五 上面的 60 行实现就是方式 A==——靠 system prompt 描述工具 + `json.loads` 解析。

### 6.2 方式 B：Function Calling（==2024 年后生产事实标准==）

==不在 prompt 里写工具描述==，而是用结构化 schema 通过 LLM API 的 `tools` 参数传过去。LLM 厂商在模型训练时==专门训练了输出工具调用 JSON 的能力==。

简化示例：

```python
tools = [{
    "type": "function",
    "function": {
        "name": "read_file",
        "description": "读取文件内容",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"}
            },
            "required": ["path"]
        }
    }
}]

response = openai.chat.completions.create(
    model="gpt-4",
    messages=messages,
    tools=tools,           # ← 工具描述传到这里，==不写进 prompt==
)

# LLM 直接返回结构化的 tool_call（不是字符串）
if response.choices[0].message.tool_calls:
    tc = response.choices[0].message.tool_calls[0]
    tool_name = tc.function.name           # 已经是 "read_file"
    tool_args = json.loads(tc.function.arguments)  # API 解析好了
    result = TOOLS[tool_name](**tool_args)
```

==Function Calling 的协议细节、四种消息角色、多轮拼接、并行调用、厂商差异==见独立文档 → [[Function Calling]]。

### 6.3 两种方式对比

| 维度 | 方式 A（传统） | 方式 B（Function Calling） |
|------|--------------|--------------------------|
| 工具描述位置 | system prompt 里写文字 | API 的 tools 参数（结构化 schema） |
| LLM 输出 | 字符串（JSON 字符串） | 结构化对象（API 直接给 dict） |
| 解析 | 框架 `json.loads()` | API 已经解析好 |
| 解析失败率 | 高（LLM 输出可能不严谨） | ==极低==（模型专门训练过） |
| 现代地位 | 早期 LangChain 用这套 | ==生产事实标准== |

==但都需要==：
1. ==手写每个工具的代码==（read_file、调 API、查数据库的实际逻辑）
2. ==手写工具描述==（无论是 prompt 文字还是 JSON schema）
3. ==手写工具注册表==（名字 → 真实函数的映射）

---

## 七、常见疑惑 FAQ

### Q1：prompt 是我们自己写的吗？

==是的==。System prompt（角色 + 工具描述 + 输出格式）100% 手写。==用户的问题==动态拼到末尾。每个工具的描述也是==手写==的。

### Q2：工具描述要写多详细？

==越详细越好==。LLM 全靠这段描述决定何时用、用什么参数。

```python
# ❌ 反例：LLM 常常会乱用
description: "读文件"

# ✅ 正例：明确边界、明确触发条件
description: (
    "读取磁盘文件的完整内容。"
    "仅限读取，不能修改。"
    "如果文件不存在会报错。"
    "适用于：用户问文件内容、需要看代码实现"
)
```

### Q3：LLM 怎么知道工具该不该用？

==只看 description==。==它不知道工具实际能干什么==。你 description 写错就是 bug——LLM 会按你写的去理解，==不会自动检查==。

### Q4：调 LLM API 是什么？

发个 HTTP 请求给 OpenAI / Anthropic / Qwen：

```python
response = requests.post(
    "https://api.openai.com/v1/chat/completions",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "model": "gpt-4",
        "messages": [...],   # ← 拼好的 prompt
        "tools": [...]        # ← 工具列表（如果用 Function Calling）
    }
)
```

LLM 服务器收请求 → 跑模型 → 返回 JSON 响应。==ReAct 循环每一轮都要发一次 HTTP 请求==——这也是为什么 Agent 慢且贵：N 步任务 = N 次网络往返 + N 次模型推理。

### Q5：能不能让 LLM 一次调多个工具？

现代 Function Calling 支持==并行调用==（一个 response 里多个 tool_calls）。框架收到 N 个 tool_calls，==并发执行 N 个工具==，N 个 observation 一起拼回去。详见 [[Function Calling#六、并行调用]]。

---

## 八、完整流程串起来

```
你写代码：
  ① 60 行 ReAct 循环（Harness）
  ② 工具函数实现（read_file 怎么读、execute_command 怎么跑）
  ③ 工具描述（schema 或 prompt 文字）

运行时：
  [Harness] 拼 messages：system prompt + 历史 + 用户问题
  [Harness] 调 LLM API（HTTP）
     ↓
  [LLM 服务器] 跑模型，返回工具调用 JSON
     ↓
  [Harness] 解析 → 在工具注册表查到对应函数
  [Harness] ==实际执行==：function(**args)
  [Harness] 把执行结果拼回 messages
     ↓
  [Harness] 再调 LLM API（第二轮）
     ↓
  ...直到 LLM 输出 answer 字段，循环结束
```

==整个流程没有"魔法"==——全是确定性代码 + 几次 LLM API 调用。

---

## 相关链接

- [[Agent核心概念]] — Agent 整体架构与推理模式（ReAct/Plan-and-Execute/Reflection）
- [[Function Calling]] — 工具调用协议细节（请求/响应结构、四种角色、多轮拼接）
- [[Harness Engineering]] — Harness 的工程方法论（六大组件、控制流模式）
- [[Agent框架]] — LangChain/LangGraph/CrewAI/Spring AI 等生产级框架
