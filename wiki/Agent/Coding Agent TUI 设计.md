---
module: Agent
tags: [Agent, Coding Agent, TUI, CLI, JLine, lanterna, 产品形态]
difficulty: medium
last_reviewed: 2026-06-01
---

# Coding Agent TUI 设计

> ==Coding Agent 在用户面前的"门面"==——TUI(Terminal User Interface)的形态选择 / 渲染器抽象 / 流式输出 / 折叠块 / 状态栏 / HITL 交互的工程实践。
>
> ==与 [[Agent 工程实践#三、CLI 设计]] 的关键区别==:
> - 那个讲==被 AI 调用的 CLI==(`gh issue list --json` 这种工具型 CLI)——一次执行、输出 JSON、给 Agent 解析
> - 本文讲==给用户用的交互式 TUI==(Claude Code / Qoder REPL)——长会话、流式输出、人类可读 UI
>
> 两者正交,生产 Coding Agent 经常==同时是被调 CLI 和交互 TUI==(`paicli "fix bug"` 单次 vs `paicli` 进 REPL)。

> [!tip] 速览（一分钟读完）
> - ==产品形态光谱==：非交互 CLI / inline 流式 TUI（主流）/ 全屏 TUI / IDE 插件 / 桌面应用——本文聚焦中间三类"终端形态"。
> - ==核心架构是 Renderer 抽象==：inline / lanterna / plain 三种 Renderer 共享同一套 Agent 核心（推理 / Tool / Memory / MCP / Skill / HITL），只是 UI 呈现不同。
> - ==inline 流式是事实标准==——主流终端 + 流式体验；lanterna 适合演示/复杂调试；plain 给 CI 和单测兜底。
> - ==HITL 决策逻辑在核心层，UI 呈现在 Renderer 层==——同一个决策，inline 单字符、lanterna 模态、plain 回车。
> - ==永远不要假设支持高级特性==——降级（NO_COLOR / 非 TTY / CI / dumb terminal → plain）是 TUI 工程的核心。

---

## 一、Coding Agent 的产品形态光谱

==Coding Agent 在用户面前可以是 5 种形态==,从轻到重:

| 形态 | 例子 | 启动方式 | 特征 |
|------|------|---------|------|
| ==非交互 CLI== | `claude -p "fix bug"` | 单次命令 | 适合脚本 / CI |
| ==inline 流式 TUI==(主流) | Claude Code / Qoder / Aider | 终端运行进入 REPL | ==流式输出 + 状态栏 + 折叠块== |
| ==全屏 TUI== | (lanterna 类) | 接管整个终端 | 三栏布局 / 文件树 / 模态弹窗 |
| ==IDE 插件== | Cursor / Continue / Cline | IDE 内嵌 | inline diff / 悬浮提示 |
| ==桌面应用== | Claude Desktop / Cherry Studio | 独立 GUI | 富文本 / 图片 / 拖拽 |

==本文聚焦中间三类==——CLI / TUI / 全屏 TUI 这条"终端形态"分支。==Coding Agent 主流走 inline 流式 TUI==,因为兼顾"轻量"和"可视化"。

==与 [[AI 编程工具]] 大形态对比的关系==:那篇讲==大形态==(终端 vs IDE vs 桌面),本文是==终端形态内部==的细分。

---

## 二、TUI 三种渲染形态

==生产级 Coding Agent 都做"==Renderer 抽象==",支持多种渲染形态切换。原因:

- ==不同终端能力差异==——CI 终端 / SSH / 老 Windows console / VSCode terminal 能力不同
- ==不同场景偏好不同==——日常用 inline 流式,演示用全屏,CI/单测用 plain
- ==降级兜底==——状态栏不工作 / ANSI 不支持时优雅退化

### 2.1 inline 流式 TUI(默认推荐)

==Claude Code / Qoder / Aider 都是这种风格==——主流形态。

==特征==:
- ==主屏直出==——和 `bash` 一样,输出滚动到 transcript 末尾,不接管整个终端
- ==流式 token 拼接==——LLM 输出 token 逐个 print,体验像 ChatGPT 网页版
- ==底部 dock 状态栏==——固定在底部显示 model / mode / token / cwd
- ==行内可折叠工具块==——`Read 3 files (ctrl+o to expand)`
- ==行内 git diff==——彩色 +/- 着色
- ==输入提示==——`* ` 或 `> ` 之类的 cursor 标记

==底层栈==:JLine(Java)/ readline(C)/ prompt_toolkit(Python)/ blessed(Python)/ ink(Node.js)。==关键 API==:`Status` / `Cursor positioning` / 行重写。

==典型布局==:

```
🎉 PaiCli v16.1
> 帮我看 src/auth.ts 的认证逻辑

✦ 我来读一下 auth.ts...

  Read 1 file (ctrl+o to expand)

  src/auth.ts:42 检查 JWT 签名,但缺少 expiry 校验。
  建议添加:

  +  if (decoded.exp < Date.now() / 1000) {
  +    throw new Error("Token expired");
  +  }

  Edit 1 file (ctrl+o to expand)

> ▌
─────────────────────────────────────────────────────────────────
HITL: on  MCP: 2/2  Skill: 4  claude-sonnet-4-5  ctx 18.4k  $0.012  ~/code/myapp
```

### 2.2 全屏 TUI

==接管整个终端==,类似 vim / htop——三栏 / 多面板布局,模态弹窗。

==底层栈==:lanterna(Java) / urwid(Python) / Textual(Python,Rich-based) / ratatui(Rust) / ink(Node.js,React-style)。

==典型布局==:

```
┌─ Files ─────────┬─ Conversation ──────────────┬─ Context ──────────┐
│ src/            │ > 帮我看 auth.ts            │ Model: sonnet-4-5  │
│   auth.ts       │                              │ Window: 200K       │
│   server.ts     │ ✦ 读取 auth.ts...           │ Used: 18.4k (12%)  │
│ tests/          │   认证逻辑分析:              │                    │
├─────────────────┴──────────────────────────────┤ Tools: 24          │
│ Status: HITL on / MCP 2 servers / Skill 4      │ MCP: 2 connected   │
└─────────────────────────────────────────────────┴────────────────────┘
> ▌
```

==适合==:演示 / 复杂调试场景 / 需要同时看多个面板的工作流。

==代价==:学习曲线高 / 不适合纯命令场景 / 终端 resize 处理复杂。

### 2.3 plain 兜底

==最简形态==——纯 `println`,无折叠 / 无状态栏 / 无 ANSI 控制。

==存在的理由==:
- ==CI / 单测==——重定向到文件,不要彩色和光标控制字符污染日志
- ==不支持 ANSI 的终端==——老 Windows console(<10) / 某些容器 stdin 不通的环境
- ==测试 Renderer 抽象本身==——plain 是回归测试基线

==典型输出==:

```
> 帮我看 src/auth.ts

[reading] Read src/auth.ts
[edit] Edit src/auth.ts
src/auth.ts:42 检查 JWT 签名...
+   if (decoded.exp < Date.now() / 1000) {
+     throw new Error("Token expired");
+   }

>
```

### 2.4 三形态对比

| 维度 | inline 流式 | 全屏 lanterna | plain |
|------|-----------|------------|-------|
| ==默认推荐== | ✅ | 特定场景 | 兜底 |
| 终端兼容 | 主流终端 | 需 ANSI + resize | ==所有终端== |
| 流式体验 | ✅ | ✅ | 部分(无折叠) |
| CI 友好 | ⚠️(状态栏污染) | ❌ | ✅ |
| 学习曲线 | 低 | 中 | 零 |
| 实现复杂度 | 中(JLine Status) | 高(全屏布局) | 低 |

==选型默认==:==inline 流式==——除非用户显式切换或环境检测不支持。

---

## 三、Renderer 与 Agent 核心解耦

### 3.1 关注点分离架构

==生产 Coding Agent 的核心架构==——三种 Renderer 共享同一套 Agent 核心:

```
┌────────────────────────────────────────────────────────────┐
│ Renderer 层(可替换)                                       │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ inline       │ │ lanterna     │ │ plain        │        │
│ │ Renderer     │ │ Renderer     │ │ Renderer     │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
└────────────────────────────────────────────────────────────┘
                          ↓ events / streams
┌────────────────────────────────────────────────────────────┐
│ Agent 核心层(共享)                                        │
│   Agent (ReAct / Plan-and-Execute / Multi-Agent)          │
│   ToolRegistry  MemoryManager  MCP servers                 │
│   SkillRegistry  HITL handler  Logger                      │
└────────────────────────────────────────────────────────────┘
```

==关键设计==:
- ==Renderer 只负责"==怎么显示=="==——接收 events,渲染到终端
- ==Agent 核心只负责"==做什么=="==——推理 / 工具调用 / 记忆 / Skill 加载
- ==两者通过 event/stream 接口解耦==——Agent 不知道是什么 Renderer 在用,Renderer 不知道是什么 Agent 在跑

### 3.2 Renderer 接口长什么样

==典型抽象==:

```java
public interface Renderer {
    void onAgentStart(SessionContext ctx);
    void onAgentToken(String token);             // LLM 流式输出
    void onToolCall(ToolCall call);              // 工具调用开始
    void onToolResult(ToolResult result);        // 工具结果(可折叠)
    void onHitlPrompt(HitlPrompt prompt);        // HITL 询问 → 返回用户选择
    HitlChoice askHitl(HitlPrompt prompt);
    void onStatusChange(StatusUpdate update);    // 状态栏更新
    void onAgentEnd();
    void onError(Throwable e);
}
```

==三种实现==:
- ==InlineRenderer==:JLine + ANSI,实现折叠 / 状态栏 / 行内 diff
- ==LanternaRenderer==:lanterna 全屏,管理多面板布局
- ==PlainRenderer==:System.out.println,忽略所有 UI 事件(折叠/状态/光标)

### 3.3 共享什么、不共享什么

| 必须共享(Agent 核心) | 可独立(Renderer) |
|-------------------|----------------|
| ==Agent 推理循环== | UI 事件处理 |
| ==Tool 调用与 Result== | 折叠 / 展开行为 |
| ==Memory(JSONL 历史)== | 状态栏布局 |
| ==MCP server 连接== | 颜色 / 主题 |
| ==Skill 注册== | 输入提示符 |
| ==HITL 决策逻辑== | HITL ==UI 呈现==(单字符 vs 模态) |

==关键洞察==:==HITL 决策(允不允许)在核心层,HITL UI(怎么问)在 Renderer 层==——这就是为什么 inline 用 `[y/n/a/s/m]` 单字符,lanterna 用模态弹窗——==同一个决策,两种 UI 呈现==。

### 3.4 测试友好性

==plain Renderer 是测试 Agent 核心的关键==——它==忽略所有 UI 事件==,让单测能跑完整 Agent 循环而不被 ANSI / 光标污染:

```python
def test_agent_full_flow():
    renderer = PlainRenderer()  # 测试用
    agent = Agent(renderer=renderer)
    agent.run("fix typo in README")
    assert renderer.captured_output.contains("fixed")
```

==没有 Renderer 抽象==:测试 Agent 必须 mock 所有 UI 调用——脆弱、覆盖率低。

---

## 四、流式渲染的工程细节

### 4.1 LLM token 流式拼接

==LLM API 用 SSE 推 token==,Renderer 接收后==逐个 print==——但==不能简单 print==,因为:

| 问题 | 原因 | 解决 |
|------|------|------|
| ==遇到代码块== | LLM 流式输出 ` ``` ` 时还不知道是什么语言 | 缓冲到完整 fence 才高亮 |
| ==遇到 markdown 表格== | 列宽要看完整行 | 缓冲整段表格再渲染 |
| ==状态栏冲突== | print 会把状态栏推上去 | ==JLine `Status`== 托管底部行 |
| ==输入提示符冲突== | 流式 print 把 prompt `>` 顶走 | 先擦除 prompt,流式完再重画 |

==生产实现==(简化):

```python
async def render_stream(token_stream):
    buffer = ""
    in_code_block = False

    async for token in token_stream:
        buffer += token

        # 检测代码块边界
        if "```" in token:
            in_code_block = not in_code_block

        # 在代码块外可立即输出,代码块内缓冲到结束才高亮
        if not in_code_block:
            renderer.write(token)
        else:
            # 缓冲到 ``` 关闭
            if "```" in buffer[buffer.rfind("```")-3:]:
                renderer.write_highlighted(buffer)
                buffer = ""
```

### 4.2 工具调用块的折叠展开

==Coding Agent 一轮可能调几十次 tool==——全展开会刷屏。==生产标配==:折叠成单行摘要 + 快捷键展开。

==显示形态==:

```
  Read 3 files (ctrl+o to expand)
  Edit src/auth.ts (ctrl+o to expand)
  Bash: pytest tests/ (ctrl+o to expand)
```

==实现要点==:
- ==存折叠状态==——Renderer 维护每个 tool block 的折叠/展开状态
- ==快捷键监听==——`ctrl+o` 切换光标位置上下文的 block
- ==展开时重渲==——把摘要行擦除,展开完整内容,再画下一行
- ==不影响后续输出==——展开发生时,后续 token 流式输出仍正常追加

==与流式输出的协调==:工具块的"折叠摘要"==必须在 tool 调用结束后才出现==——流式时显示 spinner,结束才折叠。

### 4.3 行内 git diff

==Coding Agent 修改文件时,inline 显示 diff== 是核心体验:

```
  src/auth.ts
   40  function verifyToken(token: string) {
   41    const decoded = jwt.verify(token, SECRET);
+  42    if (decoded.exp < Date.now() / 1000) {
+  43      throw new Error("Token expired");
+  44    }
   45    return decoded;
   46  }
```

==实现==:
- ==diff 算法==:常用 Myers diff(`difflib`)
- ==着色==:`+` 行 ANSI 绿色,`-` 行红色,context 灰色
- ==行号==:从原文件起始行 + diff hunk 起始位置算
- ==整体折叠==:大 diff(>30 行)默认折叠成 `Edit src/auth.ts (+15 -3, ctrl+o)`

### 4.4 状态栏更新与正文不冲突

==底部状态栏 dock== 是 inline TUI 的标志特性,但==实现非常容易出 bug==——状态栏更新 / print 互相覆盖。

==JLine `Status` API 的工作原理==:

1. JLine ==预留底部 N 行==给 Status,主屏滚动区是上面的部分
2. 任何 `print` 在主屏滚动,==不会覆盖 Status==
3. Status 更新时,==光标先保存==→ 跳到 Status 行重写 → 恢复光标
4. 终端 resize 时,Status ==自动重新计算位置==

==没有 Status 框架自己实现==的坑:

| 坑 | 现象 | 原因 |
|----|------|------|
| 状态栏被覆盖 | 主屏 print 把状态栏推走 | 没用 ANSI 滚动区 (`DECSTBM`) |
| 状态栏闪烁 | 频繁更新眼花 | 没做节流(<10Hz) |
| Resize 后位置乱 | 终端窗口变小后状态栏位置错 | 没监听 SIGWINCH |
| Ctrl+C 不还原 | 退出后状态栏残留 | 没注册 shutdown hook 清理 |

==生产建议==:==用现成框架==(JLine `Status` / blessed / Rich 等),==不要自己撸==。

---

## 五、交互式 HITL 的 UI 设计

==HITL 决策已在 [[Agent 工程实践#hitl-工具读写粒度细化]] 讲过==——本节聚焦 UI 层呈现。

### 5.1 inline:单字符 prompt

==Claude Code / Qoder 风格==——inline 形态用单字符快捷键,不破坏滚动流:

```
⚠️  即将执行: Bash("rm -rf node_modules")
   工作目录: ~/code/myapp

   [y] Yes  [n] No  [a] Always allow  [s] Skip  [m] More info
   > _
```

==每个字符的含义==(主流约定):

| 键 | 含义 | 风险 |
|----|------|------|
| ==y== | Yes,这一次允许 | 单次,默认 |
| ==n== | No,拒绝这次调用 | LLM 收到拒绝消息,自己决定下一步 |
| ==a== | ==Always allow==(本会话所有 + 同工具调用) | 中(三档授权的 Server/工具级) |
| ==s== | Skip,跳过这步但继续 | 等于 LLM 收到"用户跳过" |
| ==m== | More info,展开工具参数详情 | 不决策,只是看更多 |
| ==Esc / Ctrl+C== | 取消整个任务 | 终止 Agent run |

==实现==:JLine `KeyMap` / readline 的 character mode——==单字符即触发==,不需按回车。

### 5.2 lanterna:模态弹窗

==全屏 TUI 用模态==——居中弹窗显示完整信息 + 选项按钮:

```
┌─────────── Confirm Tool Call ──────────────┐
│                                             │
│  Tool: Bash                                 │
│  Command: rm -rf node_modules               │
│  Working dir: ~/code/myapp                  │
│  Risk: HIGH (destructive)                   │
│                                             │
│  [Y]es  [N]o  [A]lways  [S]kip  [M]ore     │
│                                             │
└─────────────────────────────────────────────┘
```

==优点==:信息更全 / 选项更明显——但==中断流式体验==。

### 5.3 plain:逐行 prompt + 回车

==CI / 单测场景==——可能不交互(直接拒绝)或走环境变量 / 配置文件预设答案:

```
HITL prompt: tool=Bash, cmd="rm -rf node_modules"
Allow? [y/n/a/s/m] (default n in non-interactive mode):
```

==关键==:plain 模式下==非交互场景默认拒绝==——避免 CI 卡死。

### 5.4 三种 HITL UI 的设计共识

| 原则 | 三形态都遵守 |
|------|------------|
| ==关键信息显眼== | tool name / 关键参数 / 工作目录必须显示 |
| ==选项快捷化== | 单字符 / 单按键,不要"输入完整单词" |
| ==默认安全选项== | 直接回车 = 拒绝(不是允许) |
| ==高危操作显示风险等级== | 红色高亮 / 警告图标 |

==面试时讲清==:"==HITL 决策逻辑在 Agent 核心层,UI 呈现在 Renderer 层==——同一个决策,inline 用单字符提示,lanterna 用模态,plain 用回车——==决策结果传回 Agent 核心一致==,这是 Renderer 抽象的价值。"

---

## 六、运行时切换推理模式

### 6.1 显式命令切换

==普通输入走 ReAct 默认模式==,显式命令切换:

| 命令 | 切换到 | 行为 |
|------|-------|------|
| (普通输入) | ==ReAct== | 默认,边想边做 |
| ==`/plan <任务>`== | Plan-and-Execute | 先规划完整计划再逐步执行 |
| ==`/team <任务>`== | Multi-Agent | Planner + Worker + Reviewer 三角色 |
| ==`/cancel`== | 终止 | 取消运行中任务,不结束 REPL |

==推理模式各自详见==:[[ReAct 与 Harness 实现]] / [[Plan-and-Execute 实现]] / [[Reflection 实现]] / [[Agent 工程实践#multi-agent-架构]]。

### 6.2 模式切换的 UX 设计要点

| 要点 | 说明 |
|------|------|
| ==当前模式可见== | 状态栏显示 `mode: react` / `mode: plan` |
| ==切换不丢上下文== | `/plan` 切到 PE 模式,会话历史 / Memory 仍连续 |
| ==`/cancel` 优雅终止== | 不强杀,而是设置 cancel flag → Agent 在下一个 checkpoint 退出 → 输出当前进度 |
| ==模式专属 UI== | Plan 模式可以加"==Plan 视图=="(显示完整计划 + 当前步骤),ReAct 模式没有 |

### 6.3 `/cancel` 实现

==取消运行中任务的关键==——不能强杀线程,要==协作式取消==:

```python
async def agent_run(task: str, cancel_token: CancelToken):
    for step in plan:
        if cancel_token.is_cancelled():
            return PartialResult(steps_done, "用户取消")

        result = await execute_step(step)
        # 工具调用前后都检查 cancel_token

    return FinalResult(...)
```

==关键设计==:
- ==检查点密集==——每个 tool 调用前后 / 每个 LLM 输出 token 时都检查
- ==输出当前进度==——不能默默退出,要告诉用户"==做到了哪一步=="
- ==清理资源==——MCP server 进程不杀(可能其他 Agent 在用),但临时文件 / 浏览器 tab 要清

---

## 七、终端兼容性与降级

### 7.1 环境变量降级

==生产 Coding Agent 必支持的降级开关==:

| 环境变量 | 触发降级 | 适用场景 |
|---------|---------|---------|
| ==`NO_COLOR=1`== | 禁用所有 ANSI 颜色,保留布局 | 颜色盲 / 偏好纯文本 / 旧终端 |
| ==`<APP>_NO_STATUSBAR=true`== | 禁用底部状态栏 | 不支持 ANSI 光标控制的终端 |
| ==`<APP>_RENDERER=plain`== | 强制 plain 模式 | CI / 重定向到文件 |
| ==`<APP>_RENDERER=lanterna`== | 强制全屏 | 演示场景 |
| ==`TERM=dumb`== | terminfo 终端类型为 dumb——能力最弱终端，无光标定位/颜色 | 各种受限环境 |

==`NO_COLOR` 是行业标准==(no-color.org)——==所有 CLI 工具都应该支持==。

### 7.2 自动检测降级

==启动时检测,自动选择==:

```python
def select_renderer():
    # 1. 用户显式指定优先
    if explicit := os.getenv("PAICLI_RENDERER"):
        return RENDERERS[explicit]

    # 2. 非 TTY → plain(stdout 被重定向到文件)
    if not sys.stdout.isatty():
        return PlainRenderer()

    # 3. CI 环境 → plain(典型 CI: GITHUB_ACTIONS / GITLAB_CI / CI=true)
    if os.getenv("CI"):
        return PlainRenderer()

    # 4. 老终端 / dumb terminal → plain
    if os.getenv("TERM") in {"dumb", ""}:
        return PlainRenderer()

    # 5. 默认 → inline
    return InlineRenderer()
```

==关键==:==永远不要假设支持高级特性==——检测失败优雅退化是 TUI 工程的核心。

### 7.3 配置演进与 deprecated 处理

==老的配置开关==如何兼容?

```python
def select_renderer():
    new_value = os.getenv("PAICLI_RENDERER")
    old_value = os.getenv("PAICLI_TUI")  # 已 deprecated

    if old_value and not new_value:
        # 兼容映射 + 警告
        sys.stderr.write(
            "warning: PAICLI_TUI is deprecated, use PAICLI_RENDERER=lanterna\n"
        )
        if old_value == "true":
            return LanternaRenderer()

    return RENDERERS[new_value or "inline"]
```

==生产配置演进的 3 条经验==:
- ==不删旧开关==——立刻删会破坏老用户的 shell rc / Dockerfile
- ==deprecated 警告写 stderr==——不污染主输出
- ==文档明确生命周期==——"vN 起 deprecated,vN+2 移除"

---

## 八、主流产品 TUI 风格对比

| 产品 | 默认形态 | 渲染特色 | 状态栏 | HITL UI |
|------|---------|---------|-------|---------|
| ==Claude Code== | inline 流式 | 紫色主题 / 折叠工具 / 行内 diff | ✅ JLine 风 | 单字符 `[y/n/a]` |
| ==Codex CLI== | inline 流式 | 简洁 / 分隔线 | 简易 | 单字符 |
| ==Qoder== | inline 流式 | 多彩 / 折叠 / 进度条 | ✅ | 单字符 |
| ==Aider== | inline 流式 | 极简 / git 集成强 | 无 | 单字符 |
| ==Goose== | inline 流式 | Rust ratatui 风 | ✅ | 单字符 |
| ==Cline== | IDE 插件 | webview 富文本 | 侧边栏 | 按钮 |
| ==Cursor terminal== | inline | 接近 Claude Code | 简易 | 按钮 |
| ==PaiCli== | inline 流式(默认) | π 主题 / 三形态可切 | ✅ JLine | 单字符 `[y/n/a/s/m]` |

==共识==:==inline 流式是事实标准==,主流产品都默认这个形态。

==分化点==:
- ==状态栏复杂度==——Claude Code 信息密集,Aider 完全没有
- ==HITL UI==——CLI 都用单字符,IDE 插件用按钮
- ==主题==——产品调性差异(简洁 vs 多彩 vs 黑暗系)

==面试时讲清==:"==Coding Agent TUI 设计的核心是 Renderer 抽象==——三种形态(inline/lanterna/plain)共享同一套 Agent / Tool / Memory / MCP / Skill / HITL 核心,只是 UI 呈现不同。==inline 是默认==(主流终端 / 流式体验),==lanterna 适合演示和复杂调试==,==plain 给 CI 和单测兜底==——==永远不要假设支持高级特性==,降级机制是 TUI 工程的核心。"

---

## 相关链接

- [[AI 编程工具]] — Coding Agent 的大产品形态对比(CLI / IDE / 桌面)
- [[Agent 工程实践#三、CLI 设计]] — 被 AI 调用的 CLI(本文是给用户用的 TUI,正交)
- [[Agent 工程实践#hitl-工具读写粒度细化]] — HITL 决策逻辑(本文是 UI 呈现层)
- [[Coding Agent 工具集]] — Coding Agent 的工具集
- [[长上下文工程#6-token-与成本可观测性]] — 状态栏显示 token / cost 的设计
- [[ReAct 与 Harness 实现]] / [[Plan-and-Execute 实现]] — `/plan` 切换的目标模式
