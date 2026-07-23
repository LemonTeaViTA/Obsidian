# 工作流模板、流程类型、动态 Hooks 详解

## 1. Template ID（工作流模板）

### 定义
`template_id` 是 AI24 后端定义的**工作流模板标识符**，决定了任务的初始化方式和执行流程。

### 已知的模板类型

| Template ID | 名称 | 说明 | 初始化行为 |
|------------|------|------|----------|
| `"0"` 或 `0` | 自由任务 | 完全跳过初始化 | ❌ 不 clone 代码<br>❌ 不初始化 OpenSpec |
| `"1"` 或 `1` | 纯净任务 | 自由任务但需要项目目录 | ❌ 不 clone 代码<br>❌ 不初始化 OpenSpec |
| `"2"` 或 `2` | 自由任务（变体） | 同 "0" | ❌ 不 clone 代码<br>❌ 不初始化 OpenSpec |
| `"backend_common"` | 后端工作流 | 标准后端开发流程 | ✅ Clone 代码<br>✅ 复制 `openspec/` 模板 |
| `"frontend_common"` | 前端工作流 | 前端开发（需要 UI 设计） | ✅ Clone 代码<br>✅ 复制 `openspec_frontend/` 模板 |
| `"test_workflow"` | 测试工作流 | 测试用例生成和导出 | ✅ Clone 代码<br>✅ 复制 `openspec_test/` 模板 |
| 其他自定义 | AI24 定义的模板 | 从 AI24 平台获取提示词模板 | ✅ Clone 代码<br>✅ 初始化 OpenSpec |

### 作用

**1. 决定初始化流程**
```python
# main.py:init_task_project()
if is_pure_task(template_id) or is_free_task(template_id):
    # 跳过 Git 克隆和 OpenSpec 初始化
    pass
else:
    # 执行完整初始化
    clone_repository(git_url, branch, project_path)
    copy_openspec_to_project(template_id)  # 根据 template_id 选择模板
```

**2. 影响提示词获取**
```python
# AI24 MCP 工具
mcp__ai24__getTemplateUsingPOST(
    templateId=template_id,  # ← 使用 template_id 获取模板
    promptType=2,
    promptDetail="/openspec/proposal.md"
)
```

**3. 控制执行流程**
```python
# main.py:execute_query_task()
if is_pure_task(template_id):
    # 纯净任务：不注入系统提示词
    await service.query(prompt=input_text, cwd=project_path)
else:
    # 标准任务：注入 OpenSpec 提示词
    await service.query(prompt=processed_prompt, cwd=project_path)
```

---

## 2. Flow Type（流程类型）

### 定义
`flow_type` 是任务的**执行流程类型**，决定了使用什么工具、注入什么提示词。

### 已知的流程类型

| Flow Type | 说明 | 特殊处理 |
|-----------|------|---------|
| `"frontend_common"` | 前端开发（UI 还原） | ✅ 启用 Figma/MasterGo MCP<br>✅ 注入前端特定提示词<br>✅ 设置 `permission_mode="acceptEdits"` |
| `"frontend_logic"` | 前端逻辑开发（无 UI） | ✅ 不需要 UI 设计工具<br>✅ 使用标准 OpenSpec 流程 |
| `"test_workflow"` | 测试工作流 | ✅ 启用测试用例生成流程<br>✅ 支持导出到 DEP |
| `"backend_common"` | 后端开发（默认） | ✅ 标准 OpenSpec 流程 |
| 其他 | 自定义流程 | ✅ 使用默认处理逻辑 |

### 作用

**1. 决定使用什么工具**
```python
# main.py:1918-1947
if flow_type == 'frontend_common':
    # 启用 UI 设计工具
    if ui_mcp_type == 'figma':
        # 使用 Figma 官方 MCP
        await service.query(..., env={'PROJECT_ROOT': project_path})
    elif ui_mcp_type == 'mastergo':
        # 使用 MasterGo MCP
        await service.query(..., env={'MASTERGO_LINK': mastergo_link})
```

**2. 注入特定提示词**
```python
# prompts/frontend_common.py
if flow_type == 'frontend_common':
    # 注入前端开发特定的系统提示词
    system_prompt = """
    你是一位前端开发专家...
    请严格按照 Figma 设计稿还原 UI...
    """
```

**3. 控制权限模式**
```python
if flow_type == 'frontend_common':
    permission_mode = "acceptEdits"  # 自动接受编辑
else:
    permission_mode = "default"  # 需要用户确认
```

---

## 3. Dynamic Hooks（动态 Hooks）

### 定义
`dynamic_hooks` 是**运行时动态注入的 Hooks**，不同于启动时配置的全局 Hooks（如 `path_security_hook`）。

### 为什么需要动态 Hooks？

**全局 Hooks（启动时配置）**：
- 在 `create_claude_service()` 时配置
- 所有任务共享
- 无法根据任务类型调整

**动态 Hooks（查询时注入）**：
- 每次 `service.query()` 时传递
- 可以根据任务特征动态启用
- 只影响当前查询

---

## 4. 项目中的所有 Hooks

### 全局 Hooks（启动时配置）

**1. Path Security Hook**
```python
# claude_agent_sdk_wrapper.py:2275
hooks = {
    "path_security_hook": PathSecurityHook(
        allowed_paths=[cwd],  # 只允许访问项目目录
        blocked_patterns=["/etc/", "/root/"]  # 禁止访问系统目录
    )
}
```
**作用**：防止 Claude 访问项目外的敏感文件

**2. Git Commit Author Hook**
```python
hooks = {
    "git_commit_author_hook": GitCommitAuthorHook(
        default_author="Claude",
        default_email="noreply@anthropic.com"
    )
}
```
**作用**：确保 Git commit 有正确的作者信息

---

### 动态 Hooks（查询时注入）

**1. Document Upload Hook**
```python
# main.py:2520-2531
if task_metadata.enable_document_auto_upload:
    doc_hook = create_document_upload_hook(task_id, project_path)
    dynamic_hooks = doc_hook.get_sdk_hooks_config()
```

**作用**：自动上报文档到 AI24
- 拦截 `Write`/`Edit` 工具
- 匹配特定文件（如技术方案、测试报告）
- 自动调用 AI24 MCP 上传

**配置示例**：
```python
{
    "post_tool_use": [
        {
            "tool_name": "Write",
            "pattern": r".*技术方案.*\.md$",  # 匹配技术方案文件
            "action": "upload_to_ai24",
            "doc_type": 2  # 文档类型：技术方案
        }
    ]
}
```

**2. AI24 下发的 Hooks（按名调用）**
```python
# main.py:2539-2562
if hook_names:  # AI24 传递 hook_names 参数
    resolved_hooks = hook_registry.resolve(hook_names, context)
    dynamic_hooks.update(resolved_hooks)
```

**支持的 Hook 类型**（从 hooks/ 目录）：

| Hook 类 | 文件 | 作用 |
|---------|------|------|
| `ProposalFilesGateHook` | proposal_files_gate_hook.py | Proposal 阶段文件生成检查 |
| `TaskCompletionGateHook` | task_completion_gate_hook.py | 任务完成条件检查 |
| `TddStopGateHook` | tdd_stop_gate_hook.py | TDD 工作流中断条件 |
| `TddTestLockHook` | tdd_test_lock_hook.py | TDD 测试文件锁定 |
| `StopHookCompleteStageHook` | stop_hook_complete_stage.py | 阶段完成后自动停止 |
| `SingleScoringFileHookHandler` | single_scoring_hook.py | 单个评分文件处理 |
| `AppSplitGateHook` | app_split_gate_hook.py | 应用拆分场景检查 |
| `PrdAuditGateHook` | prd_audit_gate_hook.py | PRD 审核检查 |

**Hook Registry 机制**：
```python
# hooks/hook_registry.py
HOOK_REGISTRY = {
    "proposal_files_gate": ProposalFilesGateHook,
    "task_completion_gate": TaskCompletionGateHook,
    "tdd_stop_gate": TddStopGateHook,
    ...
}

# AI24 传递: hook_names=["proposal_files_gate", "tdd_stop_gate"]
# 系统自动实例化对应的 Hook 类
```

---

## 5. Hooks 的工作机制

### Hook 类型（Claude SDK 支持）

1. **PreToolUse Hook** - 工具执行前
   ```python
   # 用途：参数校验、权限检查
   if tool_name == "Bash" and "rm -rf /" in command:
       return {"allow": False, "reason": "危险命令"}
   ```

2. **PostToolUse Hook** - 工具执行后
   ```python
   # 用途：结果处理、自动上报
   if tool_name == "Write" and file_path.endswith(".md"):
       upload_to_ai24(file_path)
   ```

3. **Stop Hook** - 停止条件检查
   ```python
   # 用途：自动结束任务
   if all_files_generated and tests_passed:
       return {"stop": True, "reason": "任务完成"}
   ```

---

## 6. 完整示例：前端任务的配置

### AI24 发起请求
```json
{
    "dep_id": "DEP123",
    "template_id": "frontend_common",  // ← 工作流模板
    "flowType": "frontend_common",     // ← 流程类型
    "figma_oauth_access_token": "...",
    "enable_document_auto_upload": true
}
```

### 代码处理流程
```python
# 1. 初始化阶段（/task/perform/init）
template_id = "frontend_common"
flow_type = "frontend_common"
↓
init_task_project():
  - Clone 代码
  - 复制 openspec_frontend/ 模板  # ← 根据 template_id
  - 保存 metadata

# 2. 查询阶段（/task/query）
execute_query_task():
  ↓
  # 根据 flow_type 分流
  if flow_type == "frontend_common":
      ↓
      # 准备 Figma MCP
      env_vars = {"PROJECT_ROOT": project_path}
      ↓
      # 准备动态 Hooks
      if enable_document_auto_upload:
          dynamic_hooks = {
              "post_tool_use": [
                  {
                      "tool_name": "Write",
                      "pattern": r".*技术方案.*",
                      "action": "upload_to_ai24"
                  }
              ]
          }
      ↓
      # 调用 SDK
      await service.query(
          prompt=input_text,
          cwd=project_path,
          env=env_vars,           # ← Figma 相关
          dynamic_hooks=dynamic_hooks,  # ← 文档自动上报
          permission_mode="acceptEdits"  # ← 前端流程特定
      )
```

---

## 7. 总结对比

### Template ID vs Flow Type

| 维度 | Template ID | Flow Type |
|-----|------------|-----------|
| 定义时机 | 初始化阶段 | 初始化阶段 |
| 作用阶段 | 初始化 + 执行 | 执行 |
| 控制范围 | 项目结构、模板选择 | 工具选择、提示词注入 |
| 示例值 | "backend_common"、"1" | "frontend_common"、"test_workflow" |
| 来源 | AI24 后端定义 | AI24 后端定义 |

### 全局 Hooks vs 动态 Hooks

| 维度 | 全局 Hooks | 动态 Hooks |
|-----|-----------|-----------|
| 配置时机 | 服务启动时 | 查询执行时 |
| 生命周期 | 全局共享 | 单次查询 |
| 用途 | 通用安全检查 | 任务特定逻辑 |
| 示例 | PathSecurityHook | DocumentUploadHook |
| 数量 | 固定 2 个 | 动态 8+ 种 |

---

## 8. 实际应用场景

### 场景 1：标准后端开发
```
Template ID: "backend_common"
Flow Type: "backend_common"
Dynamic Hooks: None（无需自动上报）
↓
初始化：Clone 代码 + 复制 openspec/
执行：标准 OpenSpec 流程（proposal → apply → archive）
```

### 场景 2：前端 UI 还原
```
Template ID: "frontend_common"
Flow Type: "frontend_common"
Dynamic Hooks: DocumentUploadHook（自动上报技术方案）
↓
初始化：Clone 代码 + 复制 openspec_frontend/
执行：启用 Figma MCP + 注入前端提示词 + 自动上报文档
```

### 场景 3：纯净对话任务
```
Template ID: "1"
Flow Type: None
Dynamic Hooks: None
↓
初始化：跳过（不 clone 代码）
执行：纯对话，无系统提示词注入
```

### 场景 4：TDD 测试工作流
```
Template ID: "test_workflow"
Flow Type: "test_workflow"
Dynamic Hooks: TddStopGateHook + TddTestLockHook
↓
初始化：Clone 代码 + 复制 openspec_test/
执行：生成测试用例 → Hook 自动检查完成度 → 导出到 DEP
```
