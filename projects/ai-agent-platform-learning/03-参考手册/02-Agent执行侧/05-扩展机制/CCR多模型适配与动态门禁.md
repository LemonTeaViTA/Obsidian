---
module: AI Agent 平台学习
type: project
tags: [code-agent, CCR, Kimi, Hook, 文件门禁]
last_reviewed: 2026-08-03
---

# CCR 多模型适配与动态门禁

> [!tip] 速览
> code-agent 的 HTTP 入口仍是 Flask，Agent 执行仍通过 Claude Agent SDK 抽象；新增的 CCR 层让同一执行框架可路由到不同模型。Kimi K2.5 / K3 的关键不是加一个模型名，而是同时修正工具 JSON Schema 和流式 usage 位置，并用上游协议探测与真实执行路径验证。

## 一、多模型路由在什么位置

```text
ai24 下发 model
  -> code-agent /task/perform 或 /task/query
  -> ClaudeAgentSDKService 构建会话
  -> Claude Code Router 选择 provider / model transformer
  -> 上游 Chat Completions 或 Responses 服务
```

因此应把“Claude Agent SDK”理解为执行框架接口，而不是“只能调用 Claude 模型”。当前 CCR 配置可承载 Gemini、Kimi、MiniMax、GPT 和 Claude 等不同上游，但每种协议需要自己的 transformer 组合。

## 二、Kimi K2.5 / K3 的两层兼容

### 2.1 工具 Schema 归一化

Moonshot 的工具方言不能稳定接受任意位置的本地 JSON Pointer，例如：

```json
{"$ref": "#/properties/query/anyOf/0"}
```

`moonshot-tool-schema.js` 会：

1. 深拷贝请求，避免修改调用方原对象。
2. 解析可解析的本地 pointer。
3. 把目标结构放入根级 `$defs`。
4. 把原引用重写为 `#/$defs/moonshot_ref_N`。
5. 复用重复 pointer，并在递归 schema 中提前登记引用以避免无限递归。

它同时处理三种工具形状：`function.parameters`、顶层 `parameters` 和 Anthropic 风格 `input_schema`。已经合规的 `$defs` 保持不变；外部引用和无法解析的引用保持原样。

### 2.2 usage 归一化

部分网关把 token 用量放在 `choices[].usage`，而调用端读取根级 `usage`。`chat-completions-usage.js` 在 JSON 响应和 SSE `data:` 行中找到第一个 choice usage，并提升到根级；已有根级 usage 时不覆盖。

Kimi K2.5 和 K3 都按模型启用：

```text
moonshot-tool-schema -> chat-completions-usage
```

源码和测试：

- `config/.claude-code-router/plugins/moonshot-tool-schema.js`
- `config/.claude-code-router/plugins/chat-completions-usage.js`
- `scripts/test_moonshot_tool_schema.js`
- `scripts/smoke_test_kimi_k3.py`

## 三、动态 Hook 现在有两种输入

`POST /task/query` 兼容：

- `hooks`：旧格式，只接受字符串数组。
- `stageHooks`：新格式，接受字符串或 `{name, params}`。

两者会合并后交给 `hooks/hook_registry.py`。当前白名单为：

| 名称 | 作用 |
|------|------|
| `proposal_files_gate` | TDD Proposal 固定产物门禁 |
| `task_completion_gate` | 任务完成状态补偿 |
| `prd_audit_gate` | PRD 审核结果门禁 |
| `app_split_gate` | 应用拆分审批项门禁 |
| `files_gate` | 任意 Stage 可配置文件存在性门禁 |

未知名称、非法条目或工厂创建失败会记录告警并跳过，避免单个扩展拖垮主流程。

## 四、files_gate 参数协议

### 4.1 请求示例

```json
{
  "taskId": "task_123",
  "input": "生成设计文档",
  "stageHooks": [
    {
      "name": "files_gate",
      "params": {
        "files": ["design.md", "test.md"],
        "blockMessage": "仍缺少：\n{missing_files}",
        "maxLoops": 5
      }
    }
  ]
}
```

| 参数 | 约束 |
|------|------|
| `files` | 必填、非空；相对 `openspec/changes/{taskId}/` |
| `blockMessage` | 可选；支持 `{missing_files}` 占位符 |
| `maxLoops` | 可选；默认 3，钳制到 1-10 |

### 4.2 Stop 时的行为

```text
定位 change 目录
  -> 找不到：fail open，放行
  -> 文件齐全：放行
  -> 文件缺失且未到 maxLoops：阻止 Stop，要求模型补文件
  -> 达到 maxLoops：放行，防止无限循环
  -> Hook 自身异常：记录错误并放行
```

`files_gate` 是流程完整性保护，不是绝对安全边界。其 fail-open 和最大循环放行是可用性取舍；如果某个文件是发布安全的强制条件，还需要在 CI 或服务端再校验一次。

## 五、审批项 Skill 的当前分流

code-agent 侧还有两个与 ai24 审批写入配套的 Skill：

- `batch-create-approval-items`：首次创建、审批项集合发生增加 / 删除 / 拆分 / 合并，或需要修改已通过项时，整批重建。
- `update-approval-item`：稳定 `item_key` 能一一对应、没有集合变化、只修改未通过项时，逐项更新并保留 ID。

两个 Skill 都要求先 `--dry-run`。批量接口有整批覆盖语义，不能只提交变化项；单项更新不能绕过已通过项保护。这与 ai24 的 `/batchCreate`、`/update`、`/reconcile` 三种写入语义要一起理解。

## 六、验证模型适配的正确顺序

1. 静态配置：模型是否绑定正确 transformer。
2. transformer 单测：嵌套 / 重复 / 递归 `$ref`、SSE usage 是否正确。
3. 上游协议探测：普通对话、工具调用、reasoning / usage 事件是否可解析。
4. 真实 code-agent 路径：通过任务调度、MCP 多工具链和实际会话验证，而不是只看一个 curl 返回 200。
5. 回归基线：与已稳定模型对比工具成功率、事件完整性和 token 统计。

## 七、关联文档

- [[03-参考手册/02-Agent执行侧/05-扩展机制/Hook系统详解|Hook 系统详解]]
- [[03-参考手册/01-平台管理侧/2026-08源码演进补充|平台管理侧 2026-08 源码演进补充]]
- [[源码同步审计-20260803|源码同步审计]]
