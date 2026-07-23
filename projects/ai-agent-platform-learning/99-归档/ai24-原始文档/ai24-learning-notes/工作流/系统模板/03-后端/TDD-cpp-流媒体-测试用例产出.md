# TDD-cpp-流媒体-测试用例产出

模板类型：后端

版本：1.4

创建时间：2026-07-10 01:02:26

更新时间：2026-07-10 01:02:26

描述：C++ 流媒体功能测试用例清单：8 字段 YAML + 4 类边界（不含并发）+ 强制一次性 Write 禁止分块追加 + 不输出集成测试/媒体质量测试

来源：用户于 2026-07-19 在当前 Codex 对话中提供

整理说明：以下内容按用户提供的系统模板原文记录，包含原文元数据，未做逻辑分析或内容改写。

---

```yaml
id: 1075
templateId: f96ca826-4aa4-415a-8726-44134281bbca
templateName: "TDD-cpp-流媒体-测试用例产出"
templateType: 2
templateSubType: 1
version: "1.4"
parentId: 874
gmtCreate: 2026-06-28T22:29:20
gmtUpdate: 2026-07-09T22:00:00
description: "C++ 流媒体功能测试用例清单：8 字段 YAML + 4 类边界（不含并发）+ 先规划后分批写入（禁回头修改）+ 用例数量上限 30 条 + 不输出集成测试/媒体质量测试"
promptName: "TDD-cpp-流媒体-测试用例产出"
promptType: 3
detailId: 1183
```

## Steps

**严格按以下步骤执行，全程使用简体中文回复。本阶段只产出"功能测试用例"，不做稳定性测试，不做媒体质量测试，不生成 integration_test_cases.md / media_quality_cases.md。**

**任务跟踪精简到 4 个 Task（禁止超过 4 个）**：
1. 读取上游文档 + 规划 fixture 用例清单
2. 分批 Write + Edit 生成 unit_test_cases.md（先规划、后写入、禁回头改）
3. Schema 校验
4. 同步 test-manifest.json + 提交

---

### Step 1：读取上游文档

在 `/home/www/logs/code-agent/tmp/projects/{taskId}/` 下读取 `prd.md`、`design.md`、`test_design.md`、`test_analysis.md`（不存在则跳过并记录原因）。

本工程为 C++ 流媒体 SDK（WebRTC / FFmpeg / RTSP·RTMP·HLS / mediasoup-client），单测框架 GoogleTest + GoogleMock，构建系统 CMake。

### Step 2：规划用例清单（**只规划，不写文件**）

在内存中列出后续要写入 `unit_test_cases.md` 的全部内容骨架：

- 涉及哪些 fixture（按测试文件分组）
- 每个 fixture 下要写哪些 `TEST_F`（id 编号、suite、method、boundary_class）
- 矩阵统计（每个 fixture × 4 个分类的用例数）
- mock / fake 接口清单
- 覆盖率门槛清单（每个源文件一条）
- **总用例数（一次性确定，禁止后续追加）**

**用例数量约束（硬性上限）**：
- 功能测试用例总数 **≤ 30 条**
- 超过 30 条时必须优先级排序，只输出 Top 30
- 优先级原则：核心路径 > 边界值 > 错误注入 > null 输入

**禁止边规划边写文件。规划完成前不许打开编辑器/调用 Write/Edit。**

### Step 3：分批写入 `openspec/changes/<change-id>/unit_test_cases.md`（先规划、后写入、禁回头改）

**核心原则**：规划在前，写入在后；写入过程按计划推进，**禁止回头修改已完成的部分**。

**分批策略**（长文档时每批 12 条用例）：
```
Write: 文件头 + 矩阵表 + mock 声明 + 前 12 条
Edit 追加: 第 13-24 条
Edit 追加: 第 25-30 条（最后一批，总数 ≤ 30）
Edit 追加: 覆盖率门槛声明
```

**❌ 禁止**：Write 后检查发现遗漏 → Edit 补充到前面 fixture → 再检查 → 再补充（回头修改）。
**✅ 正确**：Step 2 规划好全部用例（≤ 30 条）→ 分批写入每批一次到位 → 不回头改。

### Step 4：用例 8 字段 schema（每条用例必须填齐，缺一字段视为草稿）

```yaml
- id: UTC-001
  suite: AudioRtpReceiverTest         # GoogleTest fixture，PascalCase
  method: OnPacket_NullPacket_DropsAndLogs   # snake_case，3 段：Action_Scenario_Expected
  test_file: src/audio/audio_rtp_receiver_test.cc
  fixture_setup: |                    # 该用例 SetUp 需要的 mock / fake 注入
    - MockNetworkTransport (NiceMock)
    - FakeClock (start at t=0)
  scenario: |                         # 用一句话描述本例覆盖的场景
    OnPacket 收到 nullptr 时，drop 包并写 ERROR 日志，不崩溃
  boundary_class: null_input          # happy_path | null_input | boundary_value | error_injection
  assertions:                         # 至少 1 条强断言
    - EXPECT_CALL(mock_logger, Log(ERROR, HasSubstr("null packet"))).Times(1);
    - EXPECT_EQ(receiver.dropped_count(), 1);
```

### Step 5：边界分类矩阵（**只 4 个分类，不含并发**）

每个被测函数每个分类至少 1 条；不适用的分类必须在用例 `boundary_class: not_applicable` 并写明理由。

- **happy_path**：典型输入、典型路径
- **null_input**：空指针 / 空字符串 / 空容器 / 0 长度 buffer
- **boundary_value**：0 / INT_MAX / SIZE_MAX / 容量上限 / 负值 / 时间戳回绕
- **error_injection**：mock 接口返回失败 / 回调抛异常 / IO 错误 / 解码失败

> 不写 concurrency 分类（多线程 / 重入 / 析构期间回调），并发用例归属稳定性测试，本阶段不输出。

### Step 6：矩阵表 + mock 声明（写入 `unit_test_cases.md` 顶部）

**fixture-用例矩阵表**：

| Fixture | happy_path | null_input | boundary_value | error_injection | 合计 |
|---|---|---|---|---|---|
| AudioRtpReceiverTest | 2 | 1 | 2 | 3 | 8 |
| ... | ... | ... | ... | ... | ... |

**mock 边界声明**：列出本变更所有 mock / fake 接口：mock 类名 / 真实接口 / mock 类型（GoogleMock MOCK_METHOD / 手写 fake / 第三方 wrapper）/ 替换理由（网络 / 文件 IO / 系统调用 / 时钟 / 硬件编解码 / 第三方库）。

### Step 7：断言强度约束（违者视为草稿）

- 禁止裸 `EXPECT_TRUE(result)`，必须断言到具体值或具体调用次数
- 禁止 `sleep` / `usleep` 等条件等待，用 fake clock 注入
- 异常路径必须断言「错误码 / 日志关键字 / mock 调用次数」三者其一
- 涉及 callback 的用例必须验证 callback 实际被调用（`EXPECT_CALL(..., Times(N))`）

### Step 8：覆盖率门槛（写入 `unit_test_cases.md` 末尾）

列出本次变更涉及的源文件清单，对每个文件给出预期覆盖率目标：
- 行覆盖（line）≥ 80%
- 分���覆盖（branch）≥ 70%
- 新增代码（diff line）≥ 90%

不达标的文件必须给出 `coverage_waiver` 理由（纯日志 / 第三方头文件 inline / 仅供调试代码）。

### Step 9：Python 校验 `unit_test_cases.md` 完整性

```bash
python3 -c "
import re, sys
with open('unit_test_cases.md', encoding='utf-8') as f:
    text = f.read()
cases = re.findall(r'- id: (UTC-\\d+)', text)
if not cases:
    print('NO CASES FOUND'); sys.exit(1)
if '\\ufffd' in text:
    print('MOJIBAKE FOUND'); sys.exit(1)
# 用例数量上限检查
if len(cases) > 30:
    print(f'EXCEEDED LIMIT: {len(cases)} cases > 30 limit'); sys.exit(1)
required = ['suite', 'method', 'test_file', 'fixture_setup', 'scenario', 'boundary_class', 'assertions']
for c in cases:
    for f in required:
        if f'{f}:' not in text.split(f'- id: {c}')[1].split('- id:')[0]:
            print(f'{c} missing field: {f}'); sys.exit(1)
# 禁止 concurrency 分类
if 'boundary_class: concurrency' in text:
    print('FORBIDDEN: concurrency boundary_class detected'); sys.exit(1)
print(f'OK, {len(cases)} cases passed schema check (limit: 30)')
"
```

任一失败回到 Step 2 重新规划（控制在 30 条内）→ Step 3 按原计划重新分批写入（**不是回头 Edit 修补单个字段**）。

### Step 10：同步 `test-manifest.json`

全部用例就位后，在 `openspec/changes/<change-id>/test-manifest.json` 的 `cases` 数组中按 `unit_test_cases.md` 同步登记每条用例（state 初始为 `PENDING`），交给后续阶段执行 RED→GREEN 主循环。

### Step 11：git commit + push

完成后立即提交，结束本阶段。

---

**范围声明（本阶段不做的事）**：
- 不生成 `integration_test_cases.md`（属稳定性测试）
- 不生成 `media_quality_cases.md`（属媒体质量测试）
- 不写 concurrency 边界用例（属稳定性测试）
- 不写 1h 长跑 / netem 丢包 / 断线重连等场景（属稳定性测试）
- **功能测试用例总数上限 30 条**（超过时按优先级截断）
