# Hook 系统详解

> code-agent 的可扩展工作流核心 —— 在 Claude 调用工具、完成任务等关键时机插入检查、上报和门禁逻辑。

---

## ⚡ 核心问题

```
问题：如何让 Claude 在执行任务时：
  - 写文档后自动上报给平台？
  - 提交代码前检查是否符合规范？
  - 完成阶段时检查产出是否齐全？
  - 防止访问敏感路径？

传统方案：修改核心代码 ❌
  - 每个需求都要改主流程
  - 不同项目需求不同，代码越来越臃肿
  - 难以维护

Hook 方案：插件化扩展 ✅
  - 核心任务流程不变
  - 按需装配 Hook
  - Hook 失败尽量隔离，不拖垮主流程
```

---

## 一、Hook 是什么？

**Hook = 在特定时机插入的拦截器/旁路处理器，可以检查工具调用、补充业务上报、或在 Stop 阶段阻止任务结束。**

### 1.1 当前主要 Hook 时机

```
PreToolUse Hook   → 工具调用前，可以 block
PostToolUse Hook  → 工具调用后，主要做上报/补充动作
Stop Hook         → Claude 准备结束任务时，可以根据门禁结果决定是否拦截
```

> 旧文档里的 `CompletedCommand Hook` 在当前代码中没有对应实现；阶段完成通知由 `stop_hook_complete_stage` 等机制承担，不是一个独立的 CompletedCommand Hook 类型。

### 1.2 生命周期示例

```
用户："实现用户登录功能"
    ↓
Claude 决定调用 Write/Edit/Bash 等工具
    ↓
【PreToolUse Hook】检查：是否允许访问这个路径？
    ├─ {"continue_": True} → 继续执行工具
    └─ {"decision": "block", "reason": "..."} → 阻止，Claude 看到原因后调整
    ↓
工具执行成功
    ↓
【PostToolUse Hook】例如 document_upload_hook 自动上报文档
    ↓
Claude 继续工作...
    ↓
Claude 认为任务完成
    ↓
【Stop Hook】门禁检查产出是否达标
    ├─ PASS     → {"continue_": True}，任务结束
    ├─ RETRY    → {"decision": "block", "reason": "..."}，要求 Claude 继续补齐
    ├─ ESCALATE → 当前实现记录日志后放行
    └─ ABORT    → 放行/告警，不让 Claude 无意义空转
```

---

## 二、Hook 系统架构

### 2.1 整体结构

```
┌────────────────────────────────────────────────────┐
│        Hook Registry（动态下发白名单）              │
│  平台按名下发 → 查白名单 → 构建 SDK hooks 配置      │
└──────────────────┬─────────────────────────────────┘
                   ↓
┌────────────────────────────────────────────────────┐
│                 Hook 分类                           │
├────────────────────────────────────────────────────┤
│ 1. 系统强制/内置 Hook                               │
│    ├─ path_security_hook      路径安全检查          │
│    ├─ git_commit_author_hook  Git 提交作者设置      │
│    ├─ document_upload_hook    文档自动上报          │
│    ├─ single_scoring_hook     UI 单图评分           │
│    ├─ tdd_test_lock_hook      TDD 测试锁            │
│    └─ stop_hook_complete_stage 阶段完成通知         │
│                                                    │
│ 2. 动态白名单门禁 Hook（hooks/hook_registry.py）     │
│    ├─ proposal_files_gate     方案文件门禁          │
│    ├─ task_completion_gate    任务完成门禁          │
│    ├─ prd_audit_gate          PRD 审核门禁 ⚠️       │
│    └─ app_split_gate          应用拆分门禁 ⚠️       │
│                                                    │
│  ⚠️ 2026-07-10：ai24 的 resolveQueryHooks 已移除    │
│  对 prd_audit_gate/app_split_gate 的动态下发逻辑，  │
│  这两个 Hook 在 HOOK_FACTORIES 白名单里仍然存在，   │
│  但 ai24 平台当前不再通过 hooks 参数下发它们。      │
└────────────────────────────────────────────────────┘
                   ↓
┌────────────────────────────────────────────────────┐
│       ClaudeAgentSDKService（装配到 SDK）           │
│  _build_options() → 合并 hooks → 传给 Claude SDK    │
└────────────────────────────────────────────────────┘
```

**关键变化**：`document_upload`、`single_scoring` 等系统强制/内置 Hook 不在动态白名单里；白名单只负责平台可按名字启用的少数门禁 Hook。

---

## 三、Hook Registry（白名单机制）

### 3.1 为什么需要白名单？

```
问题：平台如何动态启用某个 Hook？

错误方案：平台直接传 Hook 代码 ❌
  - 安全风险极大（任意代码执行）

当前方案：白名单机制 ✅
  - code-agent 预定义允许动态启用的 Hook 名称
  - 平台只能按字符串下发
  - code-agent 根据名称查白名单，构建 SDK Hook 配置
  - 未知名称或构建失败的 Hook 会被跳过，不影响其他 Hook
```

### 3.2 当前白名单

文件：`hooks/hook_registry.py`

```python
HOOK_FACTORIES = {
    "proposal_files_gate": _proposal_files_gate_factory,
    "task_completion_gate": _task_completion_gate_factory,
    "prd_audit_gate": _prd_audit_gate_factory,
    "app_split_gate": _app_split_gate_factory,
    "files_gate": _files_gate_factory,
}
```

特点：

- 使用命名工厂函数，不是旧文档里的 lambda 写法。
- 只包含动态门禁 Hook。
- `files_gate` 接受 `files`、`blockMessage`、`maxLoops` 参数，必须通过 `stageHooks` 的对象格式下发。
- `document_upload`、`single_scoring` 等由系统/元数据路径装配，不通过这个白名单动态下发。

### 3.3 使用流程

```
POST /task/query
{
  "taskId": "task_123",
  "input": "实现登录功能",
  "hooks": ["prd_audit_gate", "app_split_gate"]
}
    ↓
main.py 读取 hook_names
    ↓
resolve_hook_names_to_sdk_config(hook_names, context)
    ↓
遍历 hook_names：
  - 名称在 HOOK_FACTORIES 中 → 调用工厂函数创建 Stop Hook 配置
  - 名称不存在/创建失败 → 打日志并跳过
    ↓
合并 dynamic_hooks → service.query(...)
```

---

## 四、Hook 返回格式

当前代码统一使用 Claude SDK 的 JSON Hook 输出格式，常见两类：

```python
# 放行
{"continue_": True}

# 阻止本次动作/阻止 Stop 结束
{
    "decision": "block",
    "reason": "说明原因，Claude 会看到并继续修正"
}
```

旧文档中 `{"action": "proceed"}` / `{"action": "block", "error": ...}` 的写法已经不准确。

---

## 五、Stop Hook 与 Gate 策略

### 5.1 四种裁决（Verdict）

| Verdict | 含义 | 当前行为 | 使用场景 |
|---------|------|----------|---------|
| `PASS` | 通过 | 放行 | 所有产出齐全 |
| `RETRY` | 重试 | **block Stop**，要求 Claude 继续补齐 | Claude 能自己解决的问题 |
| `ESCALATE` | 升级 | 当前实现记录日志后放行 | Claude 无法解决、需要人工/上游介入 |
| `ABORT` | 中止 | 放行/告警 | 严重异常，避免无限空转 |

核心原则仍然是：**只有 RETRY 真正拦截任务结束；ESCALATE/ABORT 不让 Claude 对无法解决的问题反复空转。**

### 5.2 防循环机制

文件：`hooks/gate_strategy.py`

当前不再是简单的内存 `rejection_count`。RETRY 拦截次数会持久化到 `gate_hook_rejections.json`，可以跨 query 生效：

```
StopGateHook
  ↓
validator.validate(...)
  ↓
Verdict.RETRY
  ↓
读取/更新 gate_hook_rejections.json 中该 task + hook 的计数
  ↓
未超过上限 → {"decision":"block", "reason": 分层提醒消息}
超过上限 → 放行，避免无限循环
```

### 5.3 RETRY 分层提醒

`gate_strategy.py` 中的 `_format_retry_message` 会按拦截次数组织不同话术：

- 第 1 次：明确指出缺什么，让 Claude 补齐。
- 第 2 次：提醒仍未满足要求。
- 最后机会：提示如果再失败将放行/升级，避免死循环。

同时，RETRY reason 中会拼入原始 `input_text`，相当于把用户原始需求再次交给 Claude，帮助它继续修正。

### 5.4 ESCALATE 当前状态

旧文档写的是“调用 AI24 API 通知上一级”。当前代码中 `on_escalate` 相关通知逻辑处于 TODO/注释状态，本期实际行为是**记录日志后放行**。

PRD 相关 Hook 里还加入了 ESCALATE 文件变更检测：通过 `audit_report.json` 的 hash 判断是否重复升级，文件未变时避免重复 ESCALATE。

---

## 六、典型 Hook 详解

### 6.1 path_security_hook（路径安全检查）

**类型**：PreToolUse Hook（系统强制/内置）

**触发时机**：读写文件、执行命令等工具调用前。

**核心作用**：限制 Claude 访问危险路径或越界路径。

当前返回格式：

```python
# 允许
return {"continue_": True}

# 阻止
return {
    "decision": "block",
    "reason": "禁止访问敏感路径/项目外路径"
}
```

---

### 6.2 document_upload_hook（文档自动上报）

**类型**：PostToolUse Hook（系统/元数据装配，不在动态白名单）

**触发时机**：Write/Edit 等工具执行后。

**工作流程**：

```
Claude 写入/编辑文档
    ↓
PostToolUse Hook 触发
    ↓
匹配文档类型/文件名规则
    ↓
读取文件内容
    ↓
调用文档上报接口
    ↓
失败时记录日志，避免影响主任务流程
```

重点：PostToolUse 主要做旁路上报，不应承担核心门禁阻断。

---

### 6.3 prd_audit_gate_hook（PRD 审核门禁）

**类型**：Stop Hook（动态白名单：`prd_audit_gate`）

旧文档说“调用 AI24 API 查询 PRD 审核状态”，当前实际逻辑已经改为：

```
读取本地 audit_report.json
    ↓
按审核问题/优先级（如 P0）走决策树
    ↓
返回 PASS / RETRY / ESCALATE / ABORT
```

也就是说，PRD 审核门禁现在更依赖本地审核报告文件，而不是每次 Stop 时远程查询旧接口。

---

### 6.4 tdd_stop_gate_hook（TDD 测试门禁）

**类型**：Stop Hook（TDD 相关）

旧文档写的是“glob 找测试文件 + subprocess pytest”。当前实现不是直接全项目跑 pytest，而是基于 manifest/路径约束做校验：

```
读取 TDD/测试相关 manifest 或约束信息
    ↓
校验必要测试产物/路径是否存在或符合要求
    ↓
不满足则 RETRY，满足则 PASS
```

所以它更像“测试产物/流程约束门禁”，不是一个通用 pytest 执行器。

---

### 6.5 proposal_files_gate / task_completion_gate / app_split_gate

这些是当前动态白名单中的主要门禁：

- `proposal_files_gate`：检查方案阶段必要文件是否齐全。
- `task_completion_gate`：检查任务完成阶段的关键产出。
- `app_split_gate`：检查应用拆分相关产出/约束。

它们共享 `StopGateHook + Validator + Verdict` 模式：Validator 只负责判断，StopGateHook 统一负责 RETRY 拦截、防循环、放行策略。

### 6.6 files_gate（通用文件存在性门禁）

`files_gate` 不硬编码业务文件名，由 Stage 通过 `stageHooks` 下发参数：

```json
{
  "name": "files_gate",
  "params": {
    "files": ["design.md", "test.md"],
    "blockMessage": "仍缺少：\n{missing_files}",
    "maxLoops": 5
  }
}
```

它在 Stop 时检查 `openspec/changes/{taskId}/`。目录不存在、Hook 异常或达到 1-10 范围内的最大循环次数时会放行，因此它是流程完整性保护，不应替代 CI 的强制校验。完整协议见 [[03-参考手册/02-Agent执行侧/05-扩展机制/CCR多模型适配与动态门禁|CCR 多模型适配与动态门禁]]。

---

## 七、Hook 的装配来源

```
ClaudeAgentSDKService._build_options() 装配 hooks：

1. 系统强制/内置 Hook
   ├─ path_security_hook
   ├─ git_commit_author_hook
   ├─ document_upload_hook
   ├─ single_scoring_hook
   ├─ tdd_test_lock_hook
   └─ stop_hook_complete_stage

2. 元数据/任务参数控制的 Hook
   ├─ enable_document_auto_upload
   ├─ enable_tdd
   └─ 其他任务级开关

3. 动态下发 Hook
   └─ hook_names=["prd_audit_gate", ...]
      → hooks/hook_registry.py 白名单
      → resolve_hook_names_to_sdk_config()
```

理解这点很重要：**不是所有 Hook 都在 HOOK_FACTORIES 里；HOOK_FACTORIES 只代表“平台可按名动态启用”的那一部分。**

---

## 八、设计亮点

### 8.1 白名单安全机制

```
平台只能传字符串，不能传代码
  → 避免任意代码执行
  → code-agent 完全控制可用 Hook
```

### 8.2 Validator 与 Gate 策略分离

```
Validator：判断业务是否通过，返回 Verdict + message
StopGateHook：统一处理 RETRY block、防循环、ESCALATE/ABORT 放行
```

好处是不同业务门禁只需要写自己的 Validator，通用策略不重复实现。

### 8.3 防循环持久化

```
gate_hook_rejections.json
  → 记录 task + hook 的拦截次数
  → 跨 query 生效
  → 避免 Claude 与 Hook 长时间互相对抗
```

### 8.4 容错设计

```python
try:
    sdk_hooks_config = factory(context)
except Exception as e:
    logger.warning(...)
    continue
```

单个动态 Hook 构建失败会被跳过，不影响其他 Hook 或主流程。

---

## 九、Hook vs 系统提示词

| 维度 | Hook | 系统提示词 |
|------|------|-----------|
| 时机 | 特定动作前后/Stop 阶段 | 整个对话开始时 |
| 强制性 | 可以 block | 只能建议 |
| 代码执行 | 可以调用 API/读文件/查本地产物 | 纯文本 |
| 适用场景 | 硬性约束、自动上报、门禁 | 行为引导、背景说明 |

例子：

- Hook：“禁止访问项目外敏感路径”（硬阻止）
- 提示词：“请注意不要访问敏感文件”（软提醒）

---

## 十、总结

### 核心价值

**Hook 系统让 code-agent 从固定流程变成可插拔的平台。**

不同项目、不同阶段、不同团队，只需要组合不同 Hook，就能获得不同的约束和自动化能力。

### 当前关键设计

1. **三类时机**：PreToolUse / PostToolUse / Stop
2. **动态白名单**：平台按名下发，但只能启用 `HOOK_FACTORIES` 里的门禁 Hook
3. **四种裁决**：PASS / RETRY / ESCALATE / ABORT
4. **只有 RETRY 拦截**：ESCALATE/ABORT 放行，避免 Claude 空转
5. **防循环持久化**：拦截次数写入 `gate_hook_rejections.json`
6. **容错**：单个 Hook 失败不影响整体任务

### 典型应用

- ✅ 文档自动上报：文档生成后自动推送
- ✅ 路径安全：防止 Claude 访问敏感路径
- ✅ 门禁检查：产出不齐全，不允许结束任务
- ✅ TDD/方案/任务完成检查：把流程规范落到硬约束

---

**更新日期**：2026-07-09  
**核心文件**：`hooks/hook_registry.py`、`hooks/gate_strategy.py`、`hooks/prd_audit_gate_hook.py`、`hooks/tdd_stop_gate_hook.py`  
**关联文档**：[service.query内部实现详解](../03-业务流程/service.query内部实现详解.md)、[main核心业务流程详解](../03-业务流程/main核心业务流程详解.md)
