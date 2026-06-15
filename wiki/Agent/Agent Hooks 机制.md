---
module: Agent
tags: [LLM, Agent, Hooks, 生命周期, 确定性控制, 安全]
difficulty: medium
last_reviewed: 2026-06-12
---

# Agent Hooks 机制

> Hooks（生命周期钩子）= 在 Agent 执行的固定时机，**自动执行用户定义的命令**。它是 Coding Agent 的「确定性控制层」，用来对冲 LLM 的概率性行为。
>
> 与 [[Agent Skills 体系]] 同属 Claude Code 概念体系（Commands / Skills / Rules / **Hooks** / Subagents / Plugins），但定位正交——见 [[#六、Hooks vs Skills vs Commands vs MCP]]。

> [!tip] 速览（一分钟读完）
> - **本质**：Hooks 是「确定性控制」，对冲 LLM 的「概率性行为」——LLM 可能忘记格式化，Hook 必然执行
> - **触发时机**：工具调用前后、用户提交、会话开始/结束、压缩前、停止时（8+ 个生命周期事件）
> - **阻断能力**：`PreToolUse` 钩子返回非零退出码可**拦下**工具调用——这是它当安全闸门的基础
> - **五大用途**：安全拦截 / 自动格式化 / 上下文注入 / 审计日志 / 会话持久化
> - **和 Skills 的区别**：Skill 是「给 LLM 看的能力」（概率激活），Hook 是「绕过 LLM 的强制规则」（确定执行）

## 一、Hooks 是什么？为什么需要？

==Hooks 在 Agent 生命周期的固定时机，自动执行你配置的命令==（通常是 shell 脚本）。

**核心价值——确定性控制对冲 LLM 概率性：**

LLM 是**概率的**：你在 system prompt 里写"每次改完代码记得跑 prettier 格式化"，它**大概率**会做，但**可能忘**——尤其上下文长了、任务复杂了之后。

Hook 是**确定的**：配一个"编辑文件后"的钩子,**每次**编辑后**必然**执行 `prettier`，==不依赖 LLM 记不记得==。

```
LLM 行为：概率性  →  "我应该格式化"（可能忘）
Hook 行为：确定性  →  PostToolUse(Edit) → 必然跑 prettier
```

> [!tip] 一句话抓住本质
> 凡是"==必须每次都做、不能依赖 LLM 自觉=="的事，就交给 Hook。Hook 是 Harness 层的强制规则，不进 LLM 的决策循环。

## 二、生命周期事件

Coding Agent（以 Claude Code 为参照）在执行链路上埋了多个钩子点：

| 事件 | 触发时机 | 典型用途 |
|------|---------|---------|
| ==`PreToolUse`== | 工具调用**前** | **拦截危险操作**、参数校验 |
| ==`PostToolUse`== | 工具调用**后** | 自动格式化 / lint / 跑测试 |
| ==`UserPromptSubmit`== | 用户提交输入时 | 注入上下文（如当前 git 分支、时间） |
| ==`SessionStart`== | 会话开始 | 加载历史状态、初始化环境 |
| ==`SessionEnd`== | 会话结束 | 持久化状态、清理资源 |
| ==`Stop`== | Agent 准备结束回复时 | 检查任务是否真完成、强制补充 |
| ==`SubagentStop`== | 子代理结束时 | 收集子任务结果 |
| ==`PreCompact`== | 上下文压缩**前** | 先归档完整上下文，防信息丢失 |
| `Notification` | Agent 发通知时 | 接入系统通知 / 飞书 / Slack |

> [!note] 不同产品事件名略有差异
> 上表以 Claude Code 为准。Cursor、Cline 等也有类似机制但命名不同（如简化为 `pre_session` / `post_session` / `pre_tool` / `post_tool`）。理解「在生命周期固定点插入逻辑」这个**模式**即可，具体事件名查对应产品文档。

## 三、阻断语义：Hook 能拦下工具调用

==这是 Hooks 最关键的能力==——不只是"旁观执行"，还能**阻止**后续动作：

| Hook 退出码 / 返回 | 效果 |
|------------------|------|
| **退出码 0** | 放行，Agent 继续 |
| **退出码非 0（如 2）** | **阻断**——工具调用被取消，错误信息回传给 LLM |
| 返回结构化 JSON | 可携带"为什么拦"的原因，让 LLM 知道并调整 |

```bash
# PreToolUse 钩子示例：拦截危险的 rm 命令
# 钩子脚本读取工具调用信息（JSON via stdin），判断后决定放行还是拦截
if echo "$TOOL_INPUT" | grep -qE 'rm\s+-rf\s+/'; then
    echo "拒绝：检测到危险的 rm -rf 操作" >&2
    exit 2   # 非零退出码 → 阻断这次工具调用
fi
exit 0       # 放行
```

==正是这个"阻断语义"让 Hook 能当安全闸门==——见 [[#五、五大典型用途]] 的安全场景，以及 [[Agent 安全模型]]。

## 四、配置方式

以 Claude Code 为例，Hooks 配置在 `settings.json`：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",            // 匹配哪些工具触发
        "hooks": [
          { "type": "command", "command": "prettier --write $FILE" }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/guard.sh" }
        ]
      }
    ]
  }
}
```

**关键设计：**
- ==`matcher`==：用正则匹配工具名，只对特定工具触发（如只对 `Edit`/`Write` 格式化）
- ==钩子拿到的是 JSON==：工具名、参数等通过 stdin 传入，脚本自己解析
- ==配置分层==：用户级（`~/.claude/`）/ 项目级（`.claude/`），项目级可纳入 git 团队共享

## 五、五大典型用途

| # | 时机 | 用途 | 价值 |
|---|------|------|------|
| 1 | `PreToolUse` | **安全拦截**——挡掉 `rm -rf`、`git push --force`、写敏感路径 | 🔴 确定性 guardrail，不靠 LLM 自觉 |
| 2 | `PostToolUse` | **自动格式化 / lint / 测试**——每次改完代码必跑 | 质量底线，零遗漏 |
| 3 | `UserPromptSubmit` | **上下文注入**——自动带上当前分支、时间、环境信息 | 省一轮交互，信息更准 |
| 4 | `PostToolUse` / `Stop` | **审计日志**——记录每次工具调用、每轮结束，供合规追溯 | 可观测性 / 合规 |
| 5 | `SessionStart` / `SessionEnd` | **会话持久化**——退出存档、重启恢复 | 跨会话连续性 |

> [!warning] Hook 不是越多越好
> 每个 Hook 都是一次同步的外部进程调用，会增加每轮延迟。只给"必须确定执行"的事配 Hook（安全、格式化），别把能让 LLM 自己判断的逻辑也塞进来——那样既慢又僵。

## 六、Hooks vs Skills vs Commands vs MCP

==初学最容易混的四个 Coding Agent 扩展机制==，关键区别是「**谁触发、确定还是概率**」：

| 机制 | 谁触发 | 确定性 | 本质 | 类比 |
|------|--------|--------|------|------|
| ==Hooks== | **系统**（生命周期事件） | ✅ 确定执行 | 绕过 LLM 的强制规则 | 自动门禁（到点必触发） |
| ==Skills== | **LLM**（语义匹配激活） | ❌ 概率激活 | 给 LLM 看的专家手册 | 顾问（LLM 觉得需要才请） |
| ==Commands== | **用户**（主动输入 `/xxx`） | ✅ 用户决定 | 用户触发的快捷指令 | 遥控器按钮 |
| ==MCP== | **LLM**（调用工具） | ❌ 概率调用 | 接入外部工具/数据的协议 | 外接设备 |

**一句话区分**：
- 要"**每次必做**" → **Hook**（系统强制）
- 要"**让 LLM 在合适时机自己用**" → **Skill**（概率激活）见 [[Agent Skills 体系]]
- 要"**用户手动触发**" → **Command**
- 要"**接外部工具/数据**" → **MCP** 见 [[MCP 协议概述]]

> [!tip] 面试高频对比
> "Hook 和 Skill 都能扩展 Agent，区别是什么？"——==Hook 是确定性的（系统在固定时机强制执行，不进 LLM 决策），Skill 是概率性的（LLM 语义匹配后自己决定要不要用）==。安全拦截、强制格式化这种"不能靠 LLM 自觉"的事用 Hook；专业领域知识、复杂决策框架这种"让 LLM 按需调用"的用 Skill。

## 关键认知

1. ==Hook 的本质是确定性控制==——对冲 LLM 概率性，凡"必须每次做、不能靠自觉"的事交给它。
2. ==阻断语义是 Hook 当安全闸门的基础==——`PreToolUse` 返回非零退出码能拦下危险工具调用。
3. ==Hook 不进 LLM 决策循环==——它是 Harness 层的强制规则，和 Skill（LLM 概率激活）正交。
4. ==别滥用==——每个 Hook 增加同步延迟，只给安全/格式化这类硬底线配。

## 相关链接

- [[Agent Skills 体系]] — Skill 是 LLM 概率激活的能力，与 Hook（确定执行）正交
- [[Agent 安全模型]] — Hook 作为 `PreToolUse` 安全闸门拦截危险操作
- [[Coding Agent 工具集_MOC]] — Hook 拦截/增强的对象就是工具调用
- [[MCP 协议概述]] — 另一种扩展机制（接外部工具）
- [[AI 编程工具]] — Claude Code 概念体系总览（Commands/Skills/Rules/Hooks/Subagents/Plugins）
- [[Agent 可观测性]] — Hook 是实现审计日志/断点的手段之一
