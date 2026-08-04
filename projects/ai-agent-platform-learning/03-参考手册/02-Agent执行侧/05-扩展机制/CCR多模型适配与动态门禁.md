---
module: AI Agent 平台学习
type: project
tags: [code-agent, CCR, Kimi, Hook, 文件门禁, Web Validation, Figma]
last_reviewed: 2026-08-04
---

# CCR 多模型适配与动态门禁

> [!tip] 速览
> code-agent 的 HTTP 入口仍是 Flask，Agent 执行仍通过 Claude Agent SDK 抽象；CCR 负责多模型协议适配，Hook 负责运行时约束，Skill 负责审批事实源编译，task-scoped MCP 则承载 Figma 节点级 Web Validation。它们是同一执行框架中的四层扩展，不应混成“换了一个模型配置”。

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
  -> 达到 maxLoops：尝试 setAutoExecute(false) 后放行
  -> Hook 自身异常：记录错误并放行
```

达到循环上限时，Hook 会调用 ai24 的 `PUT /api/taskInfo/{taskId}/autoExecute?autoExecute=false`，避免任务在产物持续缺失时继续自动推进；调用失败也不会把 Stop 永久卡死。

`files_gate` 是流程完整性保护，不是绝对安全边界。其 fail-open、远端降级和最大循环放行是可用性取舍；如果某个文件是发布安全的强制条件，还需要在 CI 或服务端再校验一次。

## 五、审批项 Skill 的当前分流

code-agent 侧有三个与 ai24 审批写入配套的 Skill：

- `batch-create-approval-items`：只用于 `(taskId,eventType)` 还没有审批项的首次创建。
- `update-approval-item`：只为尚未迁移的旧调用方保留，不能作为新流程的分流目标。
- `reconcile-approval-items`：已有非空批次的重新提交统一入口，覆盖新增、更新、删除、拆分、合并及已通过项变化。

reconcile 的决策文件必须覆盖“当前 itemKey 与目标 itemKey 的并集”，每项显式声明 `CREATE`、`UPDATE`、`DELETE` 或 `KEEP`。`UPDATE` 还要由 Agent 根据完整上下文选择 `REAPPROVE` 或 `KEEP_APPROVAL`，并提供 reason、affectedFields 和 evidence；无法证明无需重审时选择 `REAPPROVE`。

脚本从事实源确定性编译完整 target、`sourceRefs` 和 `sourceDigest`，长正文不由模型手工拼装。`--apply` 也不会跳过预览：它先调用服务端 dry-run，取得最新 `batchToken`，再用完全相同的 decisions 原子提交。遇到稳定键、令牌、封存或依赖冲突时停止，不能退回破坏性 batchCreate。

## 六、节点级 Web Validation 是独立运行链

### 6.1 任务作用域

外部 `frontend_common` 任务只有进入 `/web-validation-node` 阶段，才解析为内部 `WEB_VALIDATION_NODE`。初始化阶段只保存 Figma 原始引用，不提前下载节点资产；普通任务不会自动获得这套 UI Test MCP 运行时。

```text
Figma 官方 MCP
  -> get_metadata / get_design_context / get_screenshot
  -> web-validation-tools: web_validation_build_assets
  -> 内容寻址 assetRef（wva-sha256-*，绑定 taskId）
  -> web_validation_submit_assets
  -> UI Test Automation MCP
  -> status / retry / review
  -> web_validation_prepare_feedback
```

### 6.2 资产交接为什么不用模型内联

`mcp_server/web_validation_server.py` 是独立 stdio MCP Server。build-assets 从 Figma MCP 快照构建服务端资产，只把短 `assetRef`、摘要和有限映射返回给模型；完整 DesignSpec、MappingManifest 和 visualTargets 保留在任务作用域资产仓库。submit-assets 再按 `taskId + assetRef` 校验归属和 SHA-256 内容，加载完整资产并调用远端 UI Test Automation MCP。

这条设计避免模型复制、截断或篡改大块节点 JSON。正常节点流程约定使用 submit-assets，而不是让模型直接拼 `ui_web_validation_submit`。运行时注册的 `web_validation_submit_hook` 是最后一道身份护栏：如果仍发生直接调用，它会在 PreToolUse 阶段强制 `flowType=WEB_VALIDATION_NODE` 且 `taskId` 与当前任务一致；它不代替资产交接规则本身。

### 6.3 能力边界

- 正常链路只支持初始化 Figma nodeId 自身或后代的最小 Frame，不使用 Figma REST PAT，也不靠图层名猜 DOM selector。
- build-assets 失败会阻止视觉验证 submit，但不会回滚已经完成的 proposal、apply、页面开发和功能验证。
- 源码或构建文件变化必须产生新 commit 和新 run；retry 只用于同一 commit 的明确瞬态平台故障。
- Gate、failureType 和 decision 决定修复或转人工，不能通过放宽容差、删除关键场景来制造“通过”。

## 七、验证模型适配的正确顺序

1. 静态配置：模型是否绑定正确 transformer。
2. transformer 单测：嵌套 / 重复 / 递归 `$ref`、SSE usage 是否正确。
3. 上游协议探测：普通对话、工具调用、reasoning / usage 事件是否可解析。
4. 真实 code-agent 路径：通过任务调度、MCP 多工具链和实际会话验证，而不是只看一个 curl 返回 200。
5. 回归基线：与已稳定模型对比工具成功率、事件完整性和 token 统计。

## 八、关联文档

- [[03-参考手册/02-Agent执行侧/05-扩展机制/Hook系统详解|Hook 系统详解]]
- [[03-参考手册/01-平台管理侧/2026-08源码演进补充|平台管理侧 2026-08 源码演进补充]]
- [[源码同步审计-20260803|源码同步审计]]
