# TDD 工作流详解

## 什么是 TDD？

**TDD = Test-Driven Development（测试驱动开发）**

### 经典 TDD 流程

```
1. 写测试（Red）
   ↓
   测试失败（因为功能还没实现）
   ↓
2. 写代码（Green）
   ↓
   测试通过
   ↓
3. 重构（Refactor）
   ↓
   优化代码，保持测试通过
   ↓
重复循环
```

---

## 项目中的 TDD 工作流

### 启用条件

**AI24 初始化时传递**：
```json
{
    "dep_id": "DEP123",
    "template_id": "backend_common",
    "enableTdd": true  // ← 启用 TDD 模式
}
```

**保存到 MetaContainer**：
```python
# main.py:303
enable_tdd = data.get('enableTdd', False)
if enable_tdd:
    logger.info(f"[Task {task_id}] TDD 模式已启用")
    
# 持久化到 metadata
meta_container.update(
    task_id=task_id,
    enable_tdd=enable_tdd  # ← 作为硬开关
)
```

---

## TDD 工作流的核心机制

### 1. **Manifest 文件**

TDD 模式下，系统会生成一个 `manifest.json` 文件，记录测试用例的状态：

```json
{
    "status": "IN_PROGRESS",  // 整体状态：PENDING/IN_PROGRESS/COMPLETED
    "cases": [
        {
            "id": "case_1",
            "name": "测试用户登录成功",
            "test_file": "src/test/java/UserServiceTest.java",
            "test_method": "testLoginSuccess",
            "state": "PENDING",  // 用例状态：PENDING/RED/GREEN
            "description": "验证正确的用户名密码可以登录"
        },
        {
            "id": "case_2",
            "name": "测试用户登录失败",
            "test_file": "src/test/java/UserServiceTest.java",
            "test_method": "testLoginFailed",
            "state": "RED",  // 测试已写，但未通过
            "description": "验证错误的密码无法登录"
        },
        {
            "id": "case_3",
            "name": "测试用户登录成功",
            "test_file": "src/test/java/UserServiceTest.java",
            "test_method": "testLoginSuccess",
            "state": "GREEN",  // 测试通过
            "description": "验证正确的用户名密码可以登录"
        }
    ]
}
```

### 用例状态说明

| State | 含义 | 阶段 |
|-------|------|------|
| `PENDING` | 测试尚未编写 | 准备阶段 |
| `RED` | 测试已写，但失败 | 写完测试，开始写实现 |
| `GREEN` | 测试通过 | 实现完成 |

---

## TDD 工作流的两个关键 Hooks

### 1. **TddTestLockHook（测试文件锁）**

**作用**：防止 Claude 在写完测试后再修改测试代码

**机制**：
```python
# hooks/tdd_test_lock_hook.py

class TddTestLockHook:
    """
    测试文件锁定 Hook
    
    规则：
    - 当测试文件中任意一个 case 的 state != PENDING 时
    - 锁定该测试文件，禁止修改
    """
    
    def pre_tool_use(self, tool_name, inputs):
        # 拦截写操作
        if tool_name in ["Write", "Edit", "MultiEdit"]:
            target_file = inputs.get("file_path")
            
            # 检查是否是测试文件
            if self._is_locked_test_file(target_file):
                return {
                    "allow": False,
                    "reason": (
                        f"🔒 测试文件已锁定：{target_file}\n"
                        f"该文件的测试用例已写出（state 非 PENDING），"
                        f"现在应该写实现代码，不要修改测试。\n"
                        f"如需修改测试，请先将对应 case 的 state 改回 PENDING。"
                    )
                }
        
        return {"allow": True}
    
    def _is_locked_test_file(self, file_path):
        """检查测试文件是否被锁定"""
        manifest = self._load_manifest()
        
        for case in manifest["cases"]:
            if case["test_file"] == file_path:
                # 只要有一个 case 不是 PENDING，就锁定
                if case["state"] != "PENDING":
                    return True
        
        return False
```

**示例场景**：
```
Claude: 我要修改 UserServiceTest.java
  ↓
TddTestLockHook 拦截：
  - 检查 manifest.json
  - 发现 case_2 的 state = "RED"（已写出测试）
  ↓
返回：🔒 测试文件已锁定，不允许修改
```

---

### 2. **TddStopGateHook（停止门禁）**

**作用**：防止 Claude 在任务未完成时就想结束

**机制**：
```python
# hooks/tdd_stop_gate_hook.py

class TddStopGateHook:
    """
    TDD 停止门禁 Hook
    
    规则：
    - 当 Claude 想执行 Stop 时拦截
    - 检查 manifest.json 是否还有未完成的 case
    - 如果有未完成的，返回提示词让 Claude 继续
    - 连续 3 次自检通过后才放行
    """
    
    DEFAULT_MAX_LOOPS = 3  # 默认自检 3 次
    
    def __init__(self):
        self._loop_count = 0  # 自检次数计数
        self._max_loops = 3
    
    def stop_hook(self, context):
        """Claude 想要停止时触发"""
        self._loop_count += 1
        
        # 如果已经自检了 3 次，放行
        if self._loop_count > self._max_loops:
            logger.info(f"已自检 {self._max_loops} 次，放行")
            return {"allow": True}
        
        # 否则，返回自检提示词
        return {
            "allow": False,
            "block_reason": self._generate_self_check_prompt()
        }
    
    def _generate_self_check_prompt(self):
        """生成自检提示词"""
        manifest = self._load_manifest()
        
        # 统计未完成的 case
        pending_cases = []
        red_cases = []
        
        for case in manifest["cases"]:
            if case["state"] == "PENDING":
                pending_cases.append(case["name"])
            elif case["state"] == "RED":
                red_cases.append(case["name"])
        
        prompt = f"""
[TDD 自检 - 第 {self._loop_count}/{self._max_loops} 轮]

请对照 manifest.json 检查任务完成度：

未编写测试的用例（{len(pending_cases)} 个）：
{chr(10).join(f"  - {c}" for c in pending_cases)}

测试未通过的用例（{len(red_cases)} 个）：
{chr(10).join(f"  - {c}" for c in red_cases)}

如果所有测试都已通过（全部 GREEN），请再次主动结束。
否则，请继续完成剩余工作。
"""
        return prompt
```

**示例场景**：
```
Claude: 我觉得完成了，执行 Stop
  ↓
TddStopGateHook 拦截（第 1 次）：
  - 检查 manifest.json
  - 发现还有 2 个 PENDING、1 个 RED
  ↓
返回自检提示词：
  "你还有 3 个用例未完成，请继续工作"
  ↓
Claude 继续工作...
  ↓
Claude: 再次执行 Stop
  ↓
TddStopGateHook 拦截（第 2 次）：
  - 检查 manifest.json
  - 还有 1 个 RED
  ↓
返回自检提示词：
  "还有 1 个测试未通过，请继续"
  ↓
Claude 继续工作...
  ↓
Claude: 第三次执行 Stop
  ↓
TddStopGateHook 拦截（第 3 次）：
  - 检查 manifest.json
  - 全部 GREEN
  ↓
放行：✅ 任务完成
```

---

## 完整的 TDD 工作流程

### 阶段 1：Proposal（设计测试用例）

```
用户: /openspec:proposal
  ↓
Claude 分析需求，生成：
  - test_design.md（测试设计文档）
  - manifest.json（测试清单）
```

**manifest.json 初始状态**：
```json
{
    "status": "PENDING",
    "cases": [
        {"id": "1", "state": "PENDING", "test_file": "UserServiceTest.java"},
        {"id": "2", "state": "PENDING", "test_file": "OrderServiceTest.java"}
    ]
}
```

### 阶段 2：Apply（编写测试和实现）

```
用户: /openspec:apply
  ↓
Claude 开始工作：

步骤 1：编写测试
  - 写 UserServiceTest.java
  - 更新 manifest: case_1.state = "RED"
  ↓
  TddTestLockHook 自动激活
  - UserServiceTest.java 被锁定
  ↓
步骤 2：编写实现
  - 写 UserService.java（实现代码）
  - 运行测试
  - 测试通过，更新 manifest: case_1.state = "GREEN"
  ↓
步骤 3：继续下一个用例
  - 写 OrderServiceTest.java
  - 更新 manifest: case_2.state = "RED"
  - 写 OrderService.java
  - 测试通过，更新 manifest: case_2.state = "GREEN"
  ↓
Claude 想要结束
  ↓
TddStopGateHook 拦截：
  - 自检 manifest.json
  - 全部 GREEN，放行
  ↓
✅ 任务完成
```

---

## TDD 模式的价值

### 1. **强制测试优先**
- 确保先写测试再写代码
- 通过 TddTestLockHook 防止反向操作

### 2. **防止遗漏**
- manifest.json 记录所有测试用例
- TddStopGateHook 确保全部完成

### 3. **自动化检查**
- Hook 自动执行规则检查
- 不需要人工监督

### 4. **可追溯**
- manifest.json 记录完整状态
- 随时可以查看进度

---

## Hook 注册时机

**在 SDK 初始化时动态注册**：
```python
# claude_agent_sdk_wrapper.py:776-873

def _build_options(...):
    # 检查是否启用 TDD
    enable_tdd = task_metadata.enable_tdd
    
    if enable_tdd:
        # 查找 manifest.json
        manifest_path = self._find_manifest(project_dir)
        
        if manifest_path and self._has_unfinished_cases(manifest_path):
            # 注册 TDD Hooks
            hooks = {
                "pre_tool_use": [
                    TddTestLockHook(project_dir, manifest_path, task_id)
                ],
                "stop": [
                    TddStopGateHook(project_dir, manifest_path, task_id)
                ]
            }
            
            logger.info(f"[Task {task_id}] TDD Hooks 已注册")
```

**注册条件**：
1. ✅ `enable_tdd = True`（metadata 中配置）
2. ✅ 存在 `manifest.json` 文件
3. ✅ manifest 中有未完成的 case（不是全部 GREEN）

---

## 总结

| 概念 | 说明 |
|-----|------|
| **TDD 工作流** | 测试驱动开发流程：先写测试 → 再写实现 → 测试通过 |
| **manifest.json** | 测试清单，记录所有用例及其状态（PENDING/RED/GREEN） |
| **TddTestLockHook** | 锁定已写出的测试文件，防止修改 |
| **TddStopGateHook** | 拦截 Claude 的 Stop 操作，确保所有测试都完成 |
| **启用方式** | AI24 初始化时传递 `enableTdd: true` |
| **自检机制** | 连续 3 次自检通过才允许结束 |

TDD 工作流通过 Hooks 强制执行测试优先的开发流程，确保代码质量和测试覆盖率。
