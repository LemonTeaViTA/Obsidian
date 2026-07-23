# TDD-cpp-流媒体-测试脚本产出

模板类型：后端

版本：1.15

创建时间：2026-07-09 15:25:55

更新时间：2026-07-09 15:25:55

描述：v1.16 精简版禁哨兵（编译失败=RED，删示例骨架）

来源：用户于 2026-07-19 在当前 Codex 对话中提供

整理说明：以下内容按用户提供的系统模板原文记录，未做逻辑分析或内容改写。

---

# C++ 流媒体 test-scripts 阶段（v1.16 禁哨兵物理事实 RED）

**本阶段职责**：根据 unit_test_cases.md 生成 tests/unit/*_test.cc + test-manifest.json，编译**故意失败**（undefined reference）。

**RED 唯一合法方式**：测试直接引用被测符号 → 被测代码未实现 → 链接期 `undefined reference` → 编译失败。

---

## 🛑 入口 Gate（FATAL，违反=STOP）

```bash
CASES=/home/www/logs/code-agent/tmp/projects/{taskId}/unit_test_cases.md
test -f "$CASES" || { echo "FATAL: unit_test_cases.md 不存在"; exit 1; }
grep -q '##' "$CASES" || { echo "FATAL: unit_test_cases.md 无用例"; exit 1; }
```

---

## 范围声明（硬约束）

**只生成功能测试代码**，禁止：

- ❌ 稳定性测试（>5s 运行、压力）
- ❌ 性能测试（Benchmark、PSNR/SSIM）
- ❌ 覆盖率脚本（lcov 单独阶段）
- ✅ 只做：happy_path / null_input / boundary / error_injection

**含 `boundary_class: concurrency` 的用例全部跳过**。

---

## 🛑 反哨兵硬约束（P0，违反=STOP）

以下模式一律**禁止**：

- ❌ **创建 `red_phase.h` 或任何哨兵头文件**（含 `RedPhaseStubActive` / `ASSERT_NOT_RED_PHASE` 宏或函数）
- ❌ **注释形式保留断言**（`// ASSERT_EQ(...)`）
- ❌ **空 TEST_F body**：每个 TEST_F 至少 1 个可执行 `ASSERT_*` / `EXPECT_*`，且直接调用被测方法
- ❌ **用 `SUCCEED()` / `FAIL()` 代替真实断言**
- ❌ **`if (false) { ASSERT_... }` 绕过**

---

## Anti-空跑（强制产出）

FINISHED 前必须满足：

- 至少 1 个 `tests/unit/*_test.cc`
- 所有 TEST_F body 含可执行断言，直接调用被测类/方法
- `openspec/changes/{change_id}/test-manifest.json` 存在，所有用例 `state: "RED"`
- 编译**失败**（link error on undefined reference）
- git commit + push

---

## Steps

### Step 1: 读取上下文（一次性 batch）

```bash
cat /home/www/logs/code-agent/tmp/projects/{taskId}/unit_test_cases.md
cat /home/www/logs/code-agent/tmp/projects/{taskId}/test-manifest.json 2>/dev/null
cat CLAUDE.md 2>/dev/null
cat CMakeLists.txt
ls tests/unit/ 2>/dev/null
```

工程：C++ 流媒体（WebRTC / ZLMediaKit / Mediasoup），gtest + CMake。**只读一次**。

---

### Step 2: 输出测试文件分配清单（前置，违反=STOP）

进入 Step 3 前必须输出：

```
| 文件路径 | UTC 编号 | 用例数 | 跳过 |
|---|---|---|---|
| tests/unit/whep_client_test.cc | UTC-001..010 | 10 | 无 |
| tests/unit/opus_transcoder_test.cc | UTC-011..018 | 7 | UTC-016 (concurrency) |
```

必须枚举被跳过用例及原因。

---

### Step 3: 建基础设施

- 按工程既有 CMake 结构建 `tests/unit/CMakeLists.txt`（复用同级项目风格，不引入哨兵）
- 若工程用 jsoncpp 需要 assert stub，建 `tests/unit/assert_stub.cc` 实现 `Json::throwLogicError` / `throwRuntimeError`
- **不建 `red_phase.h`，不建任何哨兵**

---

### Step 4: 生成测试文件（每文件 Write 一次写完，禁 Edit 追加）

每个 `*_test.cc` 约束：

- ✅ `#include` 真实被测头文件（若头文件不存在，让编译失败）
- ✅ 每个 `TEST_F` body 直接调用 `TargetClass::Method(...)` 并 `ASSERT_*` / `EXPECT_*` 结果
- ❌ 不写 `#define ASSERT_NOT_RED_PHASE()` 或任何哨兵宏
- ❌ 不用 `SUCCEED()` 顶替断言

---

### Step 5: test-manifest.json

写到 `openspec/changes/{change_id}/test-manifest.json`，字段：

- `task_id`、`change_id`、`generated_at`（ISO8601）、`status: "RED"`
- `cases[]`：每条含 `utc_id` / `method` / `class` / `file` / `state: "RED"` / `boundary_class`

---

### Step 6: 编译验证 RED + 提交

```bash
cmake -B build -DENABLE_TESTS=ON -DCMAKE_BUILD_TYPE=Debug 2>&1 | tail -10
cmake --build build --target wdrtc_test -j$(nproc) 2>&1 | tail -20
BUILD_EXIT=$?

# Gate 1：必须编译失败
if [ "$BUILD_EXIT" -eq 0 ]; then
    echo "FATAL: 编译成功 = 测试未引用真实符号，RED Gate 不满足"
    exit 1
fi

# Gate 2：失败原因必须是 undefined reference（非语法错误）
UNDEF=$(cmake --build build --target wdrtc_test 2>&1 | grep -c 'undefined reference')
[ "$UNDEF" -ge 1 ] || { echo "FATAL: 编译失败但不是 undefined reference"; exit 1; }

# Gate 3：无哨兵残留
SENTINEL=$(grep -rn 'red_phase\|RedPhaseStubActive\|ASSERT_NOT_RED_PHASE' tests/unit/ 2>/dev/null | wc -l)
[ "$SENTINEL" -eq 0 ] || { echo "FATAL: 哨兵残留 $SENTINEL 处"; exit 1; }

# Gate 4：无注释断言
ORPHAN=$(grep -rnE '^\s*//\s*(ASSERT_|EXPECT_)' tests/unit/*.cc 2>/dev/null | wc -l)
[ "$ORPHAN" -eq 0 ] || { echo "FATAL: 注释断言 $ORPHAN 处"; exit 1; }

echo "RED Gate ✅"

# git commit + push
git add tests/unit/ openspec/changes/{change_id}/
git commit -m "test(<scope>): RED phase unit tests for {change_id}"
git push origin HEAD
```

---

## 产出

- `tests/unit/*_test.cc`（引用真实符号，编译故意失败）
- `tests/unit/CMakeLists.txt`
- `tests/unit/assert_stub.cc`（如需）
- `openspec/changes/{change_id}/test-manifest.json`（所有 state=RED）
- git commit + push

**不产出**：`red_phase.h`、哨兵文件、注释断言。
