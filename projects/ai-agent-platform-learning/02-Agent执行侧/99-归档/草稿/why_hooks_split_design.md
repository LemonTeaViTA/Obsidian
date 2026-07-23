# 为什么 Hooks 要拆分组装？

## 你的理解是对的！

**核心原因**：不同的任务类型、不同的工作流阶段需要**不同组合的 Hooks**。

---

## 设计原理：按需组装（Composable Hooks）

### 传统方案（❌ 不灵活）

```python
# 如果写死所有 Hooks
class ClaudeAgentSDKService:
    def __init__(self):
        self.hooks = {
            "pre_tool_use": [
                PathSecurityHook(),      # 总是启用
                GitCommitHook(),         # 总是启用
                TddTestLockHook(),       # 总是启用 ← 问题：非 TDD 任务也会检查
            ],
            "post_tool_use": [
                DocumentUploadHook(),    # 总是启用 ← 问题：不需要上报的任务也会拦截
            ],
            "stop": [
                TddStopGateHook(),       # 总是启用 ← 问题：非 TDD 任务也会拦截
            ]
        }
```

**问题**：
- ❌ 所有任务都用相同的 Hooks，无法定制
- ❌ 性能浪费（每个请求都检查不需要的 Hook）
- ❌ 可能误拦截（TDD Hook 拦截了非 TDD 任务）

---

### 现在的方案（✅ 灵活）

```python
# 根据任务类型动态组装
def _build_options(self, ..., enable_tdd, enable_path_security, dynamic_hooks):
    final_hooks = {}
    
    # 1. 条件性注册：路径安全
    if enable_path_security:
        final_hooks["pre_tool_use"] = [PathSecurityHook()]
    
    # 2. 总是注册：Git Commit
    final_hooks["pre_tool_use"].append(GitCommitHook())
    
    # 3. 条件性注册：TDD Hooks
    if enable_tdd and manifest_exists:
        final_hooks["pre_tool_use"].append(TddTestLockHook())
        final_hooks["stop"] = [TddStopGateHook()]
    
    # 4. 运行时动态注册：DocumentUpload
    if dynamic_hooks:
        final_hooks["post_tool_use"] = dynamic_hooks["post_tool_use"]
    
    return ClaudeAgentOptions(hooks=final_hooks)
```

---

## 实际场景对比

### 场景 1：普通后端开发任务

```json
{
    "template_id": "backend_common",
    "enableTdd": false,
    "enable_document_auto_upload": false
}
```

**组装的 Hooks**：
```python
final_hooks = {
    "pre_tool_use": [
        PathSecurityHook,      # ✅ 启用（防止访问系统目录）
        GitCommitAuthorHook    # ✅ 启用（确保 Git 提交有作者）
    ]
}
# TDD Hooks ❌ 不启用（没有 TDD）
# DocumentUpload ❌ 不启用（不需要自动上报）
```

---

### 场景 2：TDD 工作流任务

```json
{
    "template_id": "backend_common",
    "enableTdd": true,  // ← 启用 TDD
    "enable_document_auto_upload": false
}
```

**组装的 Hooks**：
```python
final_hooks = {
    "pre_tool_use": [
        PathSecurityHook,      # ✅ 启用
        GitCommitAuthorHook,   # ✅ 启用
        TddTestLockHook        # ✅ 启用（锁定测试文件）
    ],
    "stop": [
        TddStopGateHook        # ✅ 启用（防止提前结束）
    ]
}
```

---

### 场景 3：前端任务 + 文档自动上报

```json
{
    "template_id": "frontend_common",
    "flowType": "frontend_common",
    "enableTdd": false,
    "enable_document_auto_upload": true  // ← 启用文档上报
}
```

**组装的 Hooks**：
```python
final_hooks = {
    "pre_tool_use": [
        PathSecurityHook,      # ✅ 启用
        GitCommitAuthorHook    # ✅ 启用
    ],
    "post_tool_use": [
        DocumentUploadHook     # ✅ 启用（自动上报技术方案）
    ]
}
# TDD Hooks ❌ 不启用（前端任务不需要）
```

---

### 场景 4：纯净任务（自由对话）

```json
{
    "template_id": "1",  // ← 纯净任务
    "enableTdd": false,
    "enable_document_auto_upload": false
}
```

**组装的 Hooks**：
```python
final_hooks = {
    "pre_tool_use": [
        GitCommitAuthorHook    # ✅ 启用（最基础的 Hook）
    ]
}
# PathSecurityHook ❌ 不启用（纯净任务可能不需要）
# TDD Hooks ❌ 不启用
# DocumentUpload ❌ 不启用
```

---

## 拆分组装的具体原因

### 1. **不同任务需要不同的 Hooks**

| 任务类型 | PathSecurity | GitCommit | TDD Hooks | DocumentUpload |
|---------|-------------|-----------|-----------|----------------|
| 后端开发 | ✅ | ✅ | ❌ | ❌ |
| TDD 工作流 | ✅ | ✅ | ✅ | ❌ |
| 前端开发 + 上报 | ✅ | ✅ | ❌ | ✅ |
| 纯净任务 | ❌ | ✅ | ❌ | ❌ |

### 2. **Hooks 有不同的生命周期**

```python
# 全局 Hooks（服务启动时）
- GitCommitAuthorHook  # 所有任务都需要

# 任务级 Hooks（任务初始化时）
- PathSecurityHook     # 根据 enable_path_security 决定
- TddTestLockHook      # 根据 enable_tdd 决定

# 查询级 Hooks（每次查询时）
- DocumentUploadHook   # 根据当前查询的配置决定
```

### 3. **Hooks 有不同的触发条件**

```python
# 静态条件（启动时就知道）
if enable_path_security:
    register(PathSecurityHook)

# 动态条件（需要检查文件系统）
if enable_tdd and os.path.exists("manifest.json"):
    register(TddTestLockHook)

# 运行时条件（每次查询可能不同）
if current_query.enable_document_upload:
    register(DocumentUploadHook)
```

### 4. **性能优化**

```python
# 不需要的 Hook 不注册 = 不检查 = 更快

# 场景 A：普通任务
final_hooks = {
    "pre_tool_use": [PathSecurityHook, GitCommitHook]  # 2 个 Hook
}
# Claude 每次调用工具只检查 2 个 Hook

# 场景 B：如果不拆分，所有 Hook 都注册
final_hooks = {
    "pre_tool_use": [
        PathSecurityHook,
        GitCommitHook,
        TddTestLockHook,        # ← 不需要但也检查
        ProposalFilesGateHook,  # ← 不需要但也检查
        ...                     # ← 8 个 Hook 都检查
    ]
}
# Claude 每次调用工具检查 8 个 Hook（浪费性能）
```

---

## 拆分的三个层次

### 层次 1：启动时配置（全局 Hooks）
```python
# create_claude_service() - 服务启动时
self.hooks = {
    # 通常为空，或只有最基础的 Hook
}
```

### 层次 2：任务初始化时配置（任务级 Hooks）
```python
# _build_options() - 每个任务初始化时
if enable_path_security:
    final_hooks["pre_tool_use"].append(PathSecurityHook())

if enable_tdd and manifest_exists:
    final_hooks["pre_tool_use"].append(TddTestLockHook())
    final_hooks["stop"].append(TddStopGateHook())
```

### 层次 3：查询时配置（查询级 Hooks）
```python
# query() - 每次查询时
if dynamic_hooks:
    final_hooks.update(dynamic_hooks)
```

---

## 代码组织的优势

### 优势 1：灵活性
```python
# 可以根据需要自由组合
任务 A = PathSecurity + GitCommit
任务 B = PathSecurity + GitCommit + TDD
任务 C = GitCommit + DocumentUpload
```

### 优势 2：可扩展性
```python
# 新增 Hook 很容易，不影响现有逻辑
if enable_new_feature:
    final_hooks["pre_tool_use"].append(NewFeatureHook())
```

### 优势 3：条件控制
```python
# 每个 Hook 都可以有自己的启用条件
if enable_tdd:           # 条件 1
    if manifest_exists:  # 条件 2
        if has_unfinished_cases:  # 条件 3
            register(TddTestLockHook)
```

### 优势 4：故障隔离
```python
try:
    register(TddTestLockHook)
except Exception as e:
    logger.warning("TDD Hook 注册失败，不影响主流程")
    # 其他 Hooks 仍然可以正常工作
```

---

## 如果不拆分会怎样？

### 方案 A：所有 Hooks 写死

```python
# ❌ 问题：无法定制
class ClaudeAgentSDKService:
    def __init__(self):
        self.hooks = ALL_POSSIBLE_HOOKS  # 所有任务都用这些
```

**后果**：
- 普通任务被 TDD Hook 误拦截
- 性能浪费（检查不需要的 Hook）
- 无法根据任务类型定制

---

### 方案 B：每种任务类型一个配置

```python
# ❌ 问题：组合爆炸
BACKEND_HOOKS = [PathSecurity, GitCommit]
BACKEND_TDD_HOOKS = [PathSecurity, GitCommit, TddLock, TddStop]
FRONTEND_HOOKS = [PathSecurity, GitCommit]
FRONTEND_WITH_UPLOAD_HOOKS = [PathSecurity, GitCommit, DocumentUpload]
FRONTEND_TDD_HOOKS = [PathSecurity, GitCommit, TddLock, TddStop]
FRONTEND_TDD_WITH_UPLOAD_HOOKS = [PathSecurity, GitCommit, TddLock, TddStop, DocumentUpload]
# ... 组合太多了！
```

**后果**：
- 配置爆炸（2^N 种组合）
- 难以维护
- 新增 Hook 需要修改所有配置

---

### 方案 C：现在的方案（✅ 最优）

```python
# ✅ 按需组装，灵活且高效
final_hooks = {}
if enable_path_security: final_hooks += PathSecurity
if always: final_hooks += GitCommit
if enable_tdd: final_hooks += TddHooks
if dynamic_hooks: final_hooks += dynamic_hooks
```

**优点**：
- 灵活：任意组合
- 高效：只注册需要的
- 可维护：新增 Hook 只需加一个 if
- 隔离：每个 Hook 独立，互不影响

---

## 总结

### 为什么拆分？

| 原因 | 说明 |
|-----|------|
| **任务类型不同** | 后端、前端、测试、纯净任务需要不同的 Hooks |
| **工作流阶段不同** | Proposal 阶段、Apply 阶段需要不同的 Hooks |
| **条件动态** | 是否启用 TDD、是否需要上报文档，运行时才知道 |
| **性能优化** | 不需要的 Hook 不注册，减少检查开销 |
| **故障隔离** | 某个 Hook 失败不影响其他 Hooks |
| **可扩展性** | 新增 Hook 不影响现有逻辑 |

### 拆分的三个层次

```
全局 Hooks（服务启动）
    ↓
任务级 Hooks（_build_options）
    ↓
查询级 Hooks（query 方法）
    ↓
最终传给 Claude SDK
```

你的理解完全正确：**根据初始化方式和工作流类型，有的任务需要某些 Hooks，有的不需要，所以要动态组装**！
