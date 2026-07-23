# TDD-cpp-流媒体-apply

模板类型：后端

版本：1.9

创建时间：2026-07-09 13:30:35

更新时间：2026-07-09 13:30:35

描述：v1.9 反 sentinel 三层入口 Gate（哨兵遗留/编译必失败/red_phase.h 禁存在）

来源：用户于 2026-07-19 在当前 Codex 对话中提供

整理说明：以下内容按用户提供的系统模板原文记录，未做逻辑分析或内容改写。

---

# C++ 流媒体专属约束（v1.9 禁哨兵入口硬 Gate + 反 sentinel 作弊 + TDD-apply 通用规程）

本阶段目标：根据 test-scripts 阶段产出的 RED 用例（编译期 undefined reference），写真实业务代码让它们变 GREEN。
**严禁**：仅通过修改测试基础设施（哨兵 stub / sentinel bool / 注释断言解锁）达成 GREEN。

---

## 🛑 入口 Gate 0（P0 FATAL，哨兵遗留检测）

本次 apply 进入前，必须确认 test-scripts 阶段用的是**禁哨兵**规范（v1.15+）。任一命中即 STOP：

```bash
cd /home/www/logs/code-agent/tmp/projects/{taskId}/CloudZLMedieKit

# 检查哨兵头文件残留
SENTINEL_H=$(find tests/unit -name 'red_phase.h' -o -name '*stub_active*' 2>/dev/null | wc -l)
[ "$SENTINEL_H" -eq 0 ] || { echo "FATAL: 检测到哨兵头文件 red_phase.h，属于旧 test-scripts 产物。请重跑 test-scripts (使用 v1.15+ 禁哨兵规范)"; exit 1; }

# 检查 ASSERT_NOT_RED_PHASE / RedPhaseStubActive 宏残留
SENTINEL_MACRO=$(grep -rE '(ASSERT_NOT_RED_PHASE|RedPhaseStubActive)' tests/unit/ 2>/dev/null | wc -l)
[ "$SENTINEL_MACRO" -eq 0 ] || { echo "FATAL: tests/unit/ 下检测到 $SENTINEL_MACRO 处哨兵宏，属于旧 test-scripts 产物。请重跑 test-scripts"; exit 1; }

# 检查注释断言残留（旧模板允许 TEST_F body 只有 ASSERT_NOT_RED_PHASE + 注释断言）
ORPHAN=$(grep -rnE '^\s*//\s*(ASSERT_|EXPECT_)' tests/unit/*_test.cc 2>/dev/null | wc -l)
[ "$ORPHAN" -eq 0 ] || { echo "FATAL: 检测到 $ORPHAN 处注释断言（旧 test-scripts 产物）。请重跑 test-scripts"; exit 1; }
```

**如果命中**：说明 test-scripts 阶段用的是旧模板（v1.14 或更早），产出了哨兵结构。**不���在 apply 阶段修复**，直接返回并要求重跑 test-scripts（使用禁哨兵规范）。

---

## 🛑 入口 Gate 1（FATAL，manifest 存在性）

```bash
MANIFEST=/home/www/logs/code-agent/tmp/projects/{taskId}/test-manifest.json
test -f "$MANIFEST" || { echo "FATAL: test-manifest.json 不存在"; exit 1; }
RED_COUNT=$(python3 -c "import json; m=json.load(open('$MANIFEST')); print(sum(1 for c in m.get('cases',[]) if c.get('state')=='RED'))")
[ "$RED_COUNT" -ge 1 ] || { echo "FATAL: manifest 中无 RED 用例，apply 不能进入"; exit 1; }
echo "[Gate 1] RED 用例数：$RED_COUNT"
```

---

## 🛑 入口 Gate 2（P0 FATAL，编译必须失败）

**核心逻辑**：test-scripts 产出的测试代码直接调用被测符号，被测符号还没实现。**apply 一进来先跑一次编译，期望链接失败**（`undefined reference to ...`）。如果编译居然通过，说明测试没引用被测符号，是伪 RED，STOP。

```bash
rm -rf build && cmake -B build -DENABLE_TESTS=ON > /tmp/cmake_gate.log 2>&1
cmake --build build -j$(nproc) > /tmp/build_gate.log 2>&1
BUILD_EXIT=$?
UNDEF=$(grep -c 'undefined reference' /tmp/build_gate.log || echo 0)

if [ "$BUILD_EXIT" -eq 0 ]; then
    echo "FATAL: 入口编译居然通过，说明测试代码没引用被测符号（伪 RED）。请重跑 test-scripts (v1.15+)"; exit 1;
fi
[ "$UNDEF" -ge 1 ] || { echo "FATAL: 编译虽失败但不是 undefined reference（可能是语法错误）。看 /tmp/build_gate.log"; exit 1; }
echo "[Gate 2] 编译失败 with $UNDEF undefined reference 错误（合法 RED）"
```

---

## 🔒 反 sentinel 作弊硬约束（P0，违反=STOP）

**RED → GREEN 唯一合法路径**：
1. 定位 undefined reference 报的符号
2. 在 `src/**/*.cc` 实现该符号
3. 重编，undefined reference 消失，测试运行，断言通过 → GREEN

**以下模式一律禁止**：

- ❌ **写空实现凑符号**：`int WhepClient::Handshake() { return 200; }` 只为让 linker 找到符号，实际什么都不做
- ❌ **删/改测试断言**：test-scripts 产出的 `*_test.cc` FROZEN，仅允许 append 新 fixture
- ❌ **注释掉断言**：将 `EXPECT_EQ` 改为 `// EXPECT_EQ`
- ❌ **创建 red_phase.h / stub_active 变量**：apply 阶段禁止引入任何哨兵机制

---

## 量化 Gate（commit 前自查）

```bash
# Gate A：业务代码新增行数 ≥ 测试新增行数 × 0.5
SRC_ADD=$(git diff --stat HEAD~1 -- 'src/**/*.cc' 'src/**/*.h' 'src/**/*.cpp' 'src/**/*.hpp' 'webrtc/**/*.cc' 'webrtc/**/*.h' 2>/dev/null | tail -1 | grep -oE '[0-9]+ insertions' | grep -oE '[0-9]+' || echo 0)
TEST_ADD=$(git diff --stat HEAD~1 -- 'tests/**/*.cc' 'tests/**/*.cpp' 2>/dev/null | tail -1 | grep -oE '[0-9]+ insertions' | grep -oE '[0-9]+' || echo 0)
THRESHOLD=$((TEST_ADD / 2))
[ "$SRC_ADD" -ge "$THRESHOLD" ] || { echo "FATAL: 业务代码新增 $SRC_ADD 行 < 测试新增 $TEST_ADD × 0.5，疑似作弊"; exit 1; }

# Gate B：GREEN 用例必须能 grep 到实体断言（EXPECT_/ASSERT_ 且非注释）
for name in $(python3 -c "import json; m=json.load(open('$MANIFEST')); print('\n'.join(c['method'] for c in m.get('cases',[]) if c.get('state')=='GREEN'))"); do
    grep -qE "TEST_F\([^,]+, ${name}\)" tests/unit/*_test.cc || { echo "FATAL: GREEN 用例 ${name} 找不到 TEST_F"; exit 1; }
    ASSERTS=$(awk "/TEST_F\([^,]+, ${name}\)/,/^}/" tests/unit/*_test.cc | grep -cE '^\s*(EXPECT_|ASSERT_)' || echo 0)
    [ "$ASSERTS" -ge 1 ] || { echo "FATAL: GREEN 用例 ${name} body 内无实体断言（可能全是注释）"; exit 1; }
done

# Gate C：apply 阶段禁止创建/存在哨兵文件
SENTINEL=$(find tests/unit -name 'red_phase.h' -o -name '*stub_active*' 2>/dev/null | wc -l)
[ "$SENTINEL" -eq 0 ] || { echo "FATAL: apply 阶段检测到哨兵文件"; exit 1; }
```

---

## Anti-劫持硬约束（禁止写测试代码）

- ❌ **禁止新增 `tests/unit/*_test.cc`**：测试文件已在 test-scripts 阶段完成，apply 只能写业务代码
- ❌ **禁止修改已存在 TEST_F body**：仅允许新增 fixture setup / mock 辅助代码
- ✅ **允许修改 tests/unit/CMakeLists.txt**：新增链接库、include 路径时需要
- ✅ **允许新增 tests/mocks/*.h**：当 GREEN 需要 mock 对象时

```bash
NEW_TEST_FILES=$(git diff --name-only HEAD~1 -- 'tests/unit/*_test.cc' | wc -l)
[ "$NEW_TEST_FILES" -eq 0 ] || { echo "FATAL: apply 阶段新增了 $NEW_TEST_FILES 个测试文件"; exit 1; }
```

---

## C++ 流媒体专属约束

- **零警告编译**：`-Wall -Wextra`（业务代码必须零 warning）
- **weak_ptr 必先 lock**：每次解引用前必须 `.lock()` 判空
- **RTP/RTCP 字节序**：用 `htons/ntohs/htonl/ntohl`，禁手工 shift
- **jsoncpp assert_stub.cc**：test-scripts 已创建的 stub 文件保留，apply 不能删
- **禁止修改 3rdpart3/**：第三方库子目录只读

---

## 构建 + 跑单测（主机端）

```bash
cmake --build build -j$(nproc) > /tmp/build.log 2>&1
grep -E "error:|warning:" /tmp/build.log | head -20 || echo "编译通过"
./build/wdrtc_test --gtest_color=no 2>&1 | tail -30
# 预期：[  PASSED  ] = 已实现的用例数，[  FAILED  ] = 0
```

**PASSED 少于预期时**：
1. **绝不**创建 red_phase.h / sentinel 绕过
2. `--gtest_filter=<Class>.*` 定位未 GREEN 用例
3. 针对给定用例追加/修改对应业务实现

---

## 增量策略（防止 3000+ 行大 GREEN）

**一口气写完所有业务代码不现实**：若 manifest 含 > 20 个 RED 用例，采用批次推进：

1. 按 tasks.md 順序逐条推进，每次 5-10 个用例一 commit
2. 每循环：写业务代码 → 子集单测 → GREEN → commit + push
3. 禁止「一 commit 声称 GREEN 20+ 用例」
4. 若单测总时长 > 30 分钟，先 push 已 GREEN 部分

**突发作弊信号**（任意一项命中即停）：
- diff 中代码只改测试基础设施（含新建 red_phase.h）
- 业务新增行数 < 100 而 manifest 声称 GREEN 用例 > 20
- 单 commit 同时声称 GREEN 20+ 用例

---

## 产出

- 业务代码：`src/**/*.cc`、`src/**/*.h`、`webrtc/**/*.cc/.h`（新增/修改）
- Mock 辅助（如需）：`tests/mocks/*.h`
- 更新后的 test-manifest.json：所有实现完的用例 state → "GREEN"
- git commit：`feat(<scope>): implement <cases> for <change-id>`（多个 commit）
- git push（每个 commit 都要 push）
