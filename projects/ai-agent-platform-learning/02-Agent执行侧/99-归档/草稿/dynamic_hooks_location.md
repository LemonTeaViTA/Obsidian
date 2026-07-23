# 动态 Hooks 插入位置详解

## 你的困惑是对的！

确实不太明显，因为动态 Hooks 的合并**分散在两个地方**：

---

## 位置 1：`_build_options()` 方法（构建 SDK 选项时）

**文件**：`claude_agent_sdk_wrapper.py:918-1154`

### 步骤 1：初始化 final_hooks（1018 行）
```python
# claude_agent_sdk_wrapper.py:1018
final_hooks = hooks or self.hooks or {}
```

**说明**：
- `hooks` - 调用 `_build_options()` 时传入的 hooks
- `self.hooks` - 服务启动时配置的全局 hooks（通常为空）
- `final_hooks` - 最终会传给 Claude SDK 的 hooks

---

### 步骤 2：注册路径安全 Hook（1020-1049 行）
```python
# claude_agent_sdk_wrapper.py:1022-1049
if enable_path_security and task_id:
    # 创建路径安全 Hook
    path_security_hook = create_path_security_hook(
        working_dir=task_base_dir,
        allowlist=allowlist
    )
    
    # 获取 SDK 兼容的配置
    sdk_hooks_config = path_security_hook.get_sdk_hooks_config()
    
    # 🔥 合并到 final_hooks
    for hook_type, matchers in sdk_hooks_config.items():
        if hook_type in final_hooks:
            final_hooks[hook_type].extend(matchers)  # 追加
        else:
            final_hooks[hook_type] = matchers         # 新增
```

---

### 步骤 3：注册 Git Commit Hook（1052-1064 行）
```python
# claude_agent_sdk_wrapper.py:1055-1061
git_commit_hook = get_git_commit_author_hook()
git_commit_hooks_config = git_commit_hook.get_sdk_hooks_config()

# 🔥 合并到 final_hooks
for hook_type, matchers in git_commit_hooks_config.items():
    if hook_type in final_hooks:
        final_hooks[hook_type].extend(matchers)
    else:
        final_hooks[hook_type] = matchers
```

---

### 步骤 4：注册 TDD Hooks（1066-1081 行）
```python
# claude_agent_sdk_wrapper.py:1072-1076
self._register_tdd_hooks(
    project_dir=tdd_project_dir,
    final_hooks=final_hooks,  # 🔥 传递 final_hooks 进去，在方法内部修改
    task_id=task_id,
)
```

**`_register_tdd_hooks()` 方法内部**（第 769-915 行）：
```python
def _register_tdd_hooks(self, project_dir, final_hooks, task_id):
    # 1. 检查是否启用 TDD
    enable_tdd = task_metadata.enable_tdd
    if not enable_tdd:
        return
    
    # 2. 查找 manifest.json
    manifest_path = self._find_manifest(project_dir)
    
    # 3. 如果有未完成的 case，注册 TDD Hooks
    if manifest_path and self._has_unfinished_cases(manifest_path):
        # 创建 TDD Test Lock Hook
        tdd_test_lock_hook = TddTestLockHook(project_dir, manifest_path, task_id)
        tdd_test_lock_config = tdd_test_lock_hook.get_sdk_hooks_config()
        
        # 创建 TDD Stop Gate Hook
        tdd_stop_gate_hook = TddStopGateHook(project_dir, manifest_path, task_id)
        tdd_stop_gate_config = tdd_stop_gate_hook.get_sdk_hooks_config()
        
        # 🔥 合并到 final_hooks
        for hook_type, matchers in tdd_test_lock_config.items():
            if hook_type in final_hooks:
                final_hooks[hook_type].extend(matchers)
            else:
                final_hooks[hook_type] = matchers
        
        for hook_type, matchers in tdd_stop_gate_config.items():
            if hook_type in final_hooks:
                final_hooks[hook_type].extend(matchers)
            else:
                final_hooks[hook_type] = matchers
        
        logger.info(f"[Task {task_id}] TDD Hooks 已注册")
```

---

### 步骤 5：传递给 ClaudeAgentOptions（1099-1130 行）
```python
# claude_agent_sdk_wrapper.py:1099-1130
options = ClaudeAgentOptions(
    cli_path=final_cli_path,
    system_prompt=final_system_prompt,
    model=final_model,
    mcp_servers=final_mcp_servers,
    hooks=final_hooks if final_hooks else None,  # 🔥 这里传入
    agents=agents or self.agents,
    ...
)

return options
```

---

## 位置 2：`query()` 方法（执行查询时）

**文件**：`claude_agent_sdk_wrapper.py:1157-1434`

### 从 main.py 传入的 dynamic_hooks（1302-1311 行）
```python
# claude_agent_sdk_wrapper.py:1302-1311
async def query(self, ..., dynamic_hooks: Optional[Dict] = None, ...):
    # 调用 _build_options 获取基础 hooks
    options = self._build_options(
        task_id=task_id,
        hooks=hooks,  # 这里传入的是全局 hooks（通常为 None）
        ...
    )
    
    # 🔥 在这里合并 dynamic_hooks
    final_hooks = hooks.copy() if hooks else {}
    if dynamic_hooks:
        for hook_type, matchers in dynamic_hooks.items():
            if hook_type in final_hooks:
                # 追加到已有的 matchers 列表
                final_hooks[hook_type].extend(matchers)
            else:
                # 新建 matchers 列表
                final_hooks[hook_type] = matchers
        
        logger.info(f"[Task {task_id}] 已合并动态 hooks: {list(dynamic_hooks.keys())}")
```

---

## 完整的 Hooks 合并流程图

```
启动服务（create_claude_service）
    ↓
self.hooks = {}  # 全局 hooks（通常为空）
    ↓
    ↓
执行查询（service.query）
    ↓
传入参数：
  - hooks=None（全局 hooks）
  - dynamic_hooks={"post_tool_use": [...]}（从 main.py 传入）
    ↓
    ↓
调用 _build_options()
    ↓
步骤 1：初始化
  final_hooks = hooks or self.hooks or {}
  # 结果：final_hooks = {}
    ↓
步骤 2：路径安全 Hook
  if enable_path_security:
      path_security_hook = create_path_security_hook(...)
      合并到 final_hooks
  # 结果：final_hooks = {"pre_tool_use": [PathSecurityHook]}
    ↓
步骤 3：Git Commit Hook
  git_commit_hook = get_git_commit_author_hook()
  合并到 final_hooks
  # 结果：final_hooks = {
  #     "pre_tool_use": [PathSecurityHook, GitCommitHook]
  # }
    ↓
步骤 4：TDD Hooks（如果启用）
  if enable_tdd and manifest_exists:
      tdd_test_lock_hook = TddTestLockHook(...)
      tdd_stop_gate_hook = TddStopGateHook(...)
      合并到 final_hooks
  # 结果：final_hooks = {
  #     "pre_tool_use": [PathSecurityHook, GitCommitHook, TddTestLockHook],
  #     "stop": [TddStopGateHook]
  # }
    ↓
步骤 5：返回 options
  return ClaudeAgentOptions(hooks=final_hooks, ...)
    ↓
    ↓
回到 query() 方法
    ↓
步骤 6：合并 dynamic_hooks
  if dynamic_hooks:
      for hook_type, matchers in dynamic_hooks.items():
          if hook_type in final_hooks:
              final_hooks[hook_type].extend(matchers)
          else:
              final_hooks[hook_type] = matchers
  # 结果：final_hooks = {
  #     "pre_tool_use": [PathSecurityHook, GitCommitHook, TddTestLockHook],
  #     "stop": [TddStopGateHook],
  #     "post_tool_use": [DocumentUploadHook]  ← 新增
  # }
    ↓
步骤 7：创建 ClaudeSDKClient
  async with ClaudeSDKClient(options=options) as client:
      # Claude SDK 使用这些 hooks
```

---

## 为什么不明显？

### 1. **分散在两个地方**
- `_build_options()` 中合并：PathSecurity、GitCommit、TDD
- `query()` 中合并：DocumentUpload（从 main.py 传入）

### 2. **使用相同的合并逻辑**
```python
# 到处都是这个模式
for hook_type, matchers in sdk_hooks_config.items():
    if hook_type in final_hooks:
        final_hooks[hook_type].extend(matchers)
    else:
        final_hooks[hook_type] = matchers
```

### 3. **Hook 注册是条件性的**
- PathSecurityHook：只在 `enable_path_security=True` 时
- TDD Hooks：只在 `enable_tdd=True` 且有 manifest 时
- DocumentUploadHook：只在 `enable_document_auto_upload=True` 时

---

## 关键代码位置总结

| Hook | 注册位置 | 触发条件 |
|------|---------|---------|
| **PathSecurityHook** | `_build_options():1022-1049` | `enable_path_security=True` |
| **GitCommitAuthorHook** | `_build_options():1052-1064` | 总是注册 |
| **TddTestLockHook** | `_register_tdd_hooks():769-915` | `enable_tdd=True` + manifest 存在 |
| **TddStopGateHook** | `_register_tdd_hooks():769-915` | `enable_tdd=True` + manifest 存在 |
| **DocumentUploadHook** | `query():1302-1311` | 从 main.py 的 `dynamic_hooks` 传入 |
| **其他按名 Hooks** | `query():1302-1311` | AI24 下发 `hook_names` |

---

## 实际例子

### 场景：TDD 模式 + 文档自动上报

```python
# main.py 调用
await service.query(
    task_id="T123",
    prompt="执行 apply",
    enable_path_security=True,  # ← 触发 PathSecurityHook
    dynamic_hooks={              # ← 触发 DocumentUploadHook
        "post_tool_use": [
            DocumentUploadHook(...)
        ]
    }
)

# 在 _build_options() 中
final_hooks = {}

# Step 1: PathSecurityHook
final_hooks = {
    "pre_tool_use": [PathSecurityHook]
}

# Step 2: GitCommitHook
final_hooks = {
    "pre_tool_use": [PathSecurityHook, GitCommitHook]
}

# Step 3: TDD Hooks（如果 enable_tdd=True）
final_hooks = {
    "pre_tool_use": [PathSecurityHook, GitCommitHook, TddTestLockHook],
    "stop": [TddStopGateHook]
}

# Step 4: 合并 dynamic_hooks（在 query() 方法中）
final_hooks = {
    "pre_tool_use": [PathSecurityHook, GitCommitHook, TddTestLockHook],
    "stop": [TddStopGateHook],
    "post_tool_use": [DocumentUploadHook]  # ← 新增
}

# 最终传给 Claude SDK
ClaudeSDKClient(options=ClaudeAgentOptions(hooks=final_hooks))
```

---

现在清楚了吗？动态 Hooks 的合并确实不太明显，因为分散在 `_build_options()` 和 `query()` 两个方法中！
