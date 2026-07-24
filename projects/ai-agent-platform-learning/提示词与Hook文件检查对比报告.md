# 提示词与Hook文件检查对比报告

> 检查时间：2026-07-23  
> 目的：验证各端提示词要求的产物文件与Hook检查是否匹配

---

## 🔍 检查结果总结

### Hook要求的4个文件

```python
# hooks/proposal_files_gate_hook.py

REQUIRED_FILES = [
    "design.md",
    "test_design.md",
    "tasks.md",
    "test-manifest.json"
]
```

---

## 📊 各端对比结果

### ✅ 前端（TDD-前端-UITest-proposal.md）

**提示词要求生成的文件**：
```
Step 1: acceptance_criteria.md
Step 2: proposal.md
Step 4: design.md              ← Hook检查
Step 5: test_design.md         ← Hook检查
Step 6: tasks.md               ← Hook检查
Step 7: test-manifest.json     ← Hook检查
```

**结论**：✅ **完全匹配**  
提示词明确要求生成这4个文件，Hook检查完全对应。

---

### ⚠️ 后端（TDD-cpp-流媒体-proposal.md）

**提示词要求生成的文件**：
```
Step 3: design.md              ← Hook检查
Step 4: test_design.md         ← Hook检查

明确说明：
"本阶段（proposal）唯一产出是 design.md 和 test_design.md"
"禁止 git add/commit 任何业务实现文件"
"结束信号：design.md + test_design.md 写完即 FINISHED"
```

**Hook检查但提示词未要求**：
```
❌ tasks.md             - 提示词没有要求生成
❌ test-manifest.json   - 提示词没有要求生成
```

**提示词中的说明**：
```
Step 6 (test-manifest.json config):
  - `build_command`: `cmake --build build -j$(nproc)`
  - `test_command`: `./build/wdrtc_test --gtest_filter=`
  - `asan_command`: `./build-asan/wdrtc_test --gtest_filter=`
  
但这只是说明配置内容，不是要求在proposal阶段生成
```

**结论**：⚠️ **部分不匹配**  
- 后端提示词只要求生成 2 个文件（design.md, test_design.md）
- Hook 检查 4 个文件
- 可能导致后端任务在 Proposal 阶段被 Hook block

---

### ⚠️ 客户端（Android UI测试）

**提示词引用**：
```
| `@/openspec:proposal` | `proposal.md`、`design.md`、`test_design.md`、`tasks.md` |

输入文件（按需读取）：
  - openspec/changes/{{CHANGE_ID}}/proposal.md
  - openspec/changes/{{CHANGE_ID}}/design.md
  - openspec/changes/{{CHANGE_ID}}/test_design.md
  - openspec/changes/{{CHANGE_ID}}/tasks.md
  - openspec/changes/{{CHANGE_ID}}/test_analysis.md
  - ...
```

**Hook检查但提示词未明确要求生成**：
```
⚠️ test-manifest.json   - 提示词中没有明确要求在proposal阶段生成
```

**结论**：⚠️ **基本匹配，但 test-manifest.json 不明确**  
- 客户端提示词引用了 @/openspec:proposal，要求生成 design.md、test_design.md、tasks.md
- 但 test-manifest.json 没有明确说明

---

## 🚨 发现的问题

### 问题1：后端提示词与Hook不匹配

**问题描述**：
```
后端提示词明确说：
"本阶段（proposal）唯一产出是 design.md 和 test_design.md"

但 Hook 检查 4 个文件，包括：
- tasks.md
- test-manifest.json
```

**影响**：
- 后端任务在 Proposal 阶段会被 Hook block
- Claude 生成了 design.md 和 test_design.md，想 Stop
- Hook 检查发现缺少 tasks.md 和 test-manifest.json，阻止 Stop
- Claude 重试，但提示词说不要生成这些文件

**建议修复方案**：

**方案A：修改Hook（推荐）**
```python
# hooks/proposal_files_gate_hook.py

# 根据不同flow_type定义不同的检查文件
REQUIRED_FILES_BY_TYPE = {
    "frontend": [
        "design.md",
        "test_design.md", 
        "tasks.md",
        "test-manifest.json"
    ],
    "backend": [
        "design.md",
        "test_design.md"
    ],
    "client": [
        "design.md",
        "test_design.md",
        "tasks.md"
    ]
}
```

**方案B：修改提示词**
```markdown
# TDD-cpp-流媒体-proposal.md

在 Step 7 增加：
### 7. 生成 tasks.md 和 test-manifest.json
（与前端对齐）
```

---

### 问题2：test-manifest.json 在多个阶段都涉及

**后端提示词**：
```
Step 6 (test-manifest.json config):
  - 说明配置内容
  - 但不明确在哪个阶段生成
```

**前端提示词**：
```
Step 7: 生成 test-manifest.json
  - 明确在 proposal 阶段生成
```

**客户端提示词**：
```
引用 @/openspec:proposal
  - 间接要求这些文件
  - 但不够明确
```

---

## 💡 建议

### 建议1：统一各端的产物要求（推荐）

**方案**：让所有端的 Proposal 阶段都生成 4 个文件

**优点**：
- Hook 逻辑简单统一
- 流程一致，易维护

**缺点**：
- 后端需要调整提示词
- 可能增加后端工作量

---

### 建议2：Hook 根据类型动态检查

**方案**：Hook 读取任务的 flow_type，根据类型检查不同文件

**优点**：
- 灵活，各端保持自己的特色
- 不需要修改提示词

**缺点**：
- Hook 逻辑复杂
- 需要维护多套规则

---

### 建议3：提示词补充说明

**方案**：在提示词中明确说明哪些文件在哪个阶段生成

**优点**：
- 提高清晰度
- 避免混淆

**缺点**：
- 需要更新多个提示词文件

---

## 📋 检查清单

```
✅ 前端提示词与Hook匹配
⚠️ 后端提示词与Hook不匹配（缺 tasks.md、test-manifest.json）
⚠️ 客户端提示词不够明确（test-manifest.json）

建议优先修复：
1. 后端提示词 or Hook逻辑
2. 明确 test-manifest.json 的生成阶段
```

---

**总结**：前端完全匹配，后端和客户端存在不匹配的风险。建议统一各端要求或让Hook根据类型动态检查。
