# TDD-cpp-流媒体-proposal

模板类型：后端

版本：1.12

创建时间：2026-07-10 01:13:28

更新时间：2026-07-10 01:13:28

描述：TDD-cpp 流媒体技术方案模板（proposal）

来源：用户于 2026-07-19 在当前 Codex 对话中提供

整理说明：以下内容按用户提供的系统模板原文记录，未做逻辑分析或内容改写。

---

## 🎯 规划在前、分批写入（硬约束）

**先规划完整目录结构（只在内存中），再分批写入，禁止回头修改。**

### 工作流程
1. 读取输入文件（每个文件只读 1 次）
2. 规划 design.md 和 test_design.md 的完整章节结构（只在内存中）
3. 分批写入文件（Write 头部 + Edit 追加后续章节）
4. 立即 git commit
5. 输出 FINISHED

### 分批写入规则

**design.md 分 3 批：**
- 第 1 批 Write：§1-§2（需求概述 + 技术选型）
- 第 2 批 Edit 追加：§3-§5（改造方案 + 线程模型 + 内存性能）
- 第 3 批 Edit 追加：§6-§7（错误处理 + 兼容性）

**test_design.md 分 2 批：**
- 第 1 批 Write：标题 + L1 Unit Tests
- 第 2 批 Edit 追加：L2 Integration + L3 Quality + Boundary cases

**每批一次到位，禁止回头修改已写章节。**

### 严格禁止
- ❌ 写完后重新读代码"检查是否遗漏"
- ❌ 修改已写好的章节"优化表述"
- ❌ 问"这样够好吗？"/"是否可以改进？"
- ❌ 回头审查文档质量
- ❌ 单次 Write 调用完成全部内容（会导致 token 截断）

### 判断标准
- ✅ 包含必需章节 = 合格，立即提交
- ✅ 第一版就是最终版（但可分多批工具调用写入）
- ✅ 60% 质量足够，后续阶段会调整

**如果发现自己想回头修改，立即停止并 commit。**

### 必需章节清单（写完即停）

**design.md（7个章节）：**
- [ ] §1 需求概述
- [ ] §2 技术选型
- [ ] §3 改造方案（模块清单、接口契约、状态机、数据流图）
- [ ] §4 线程模型与并发约束（线程清单、数据所有权、锁粒度、引用计数）
- [ ] §5 内存与性能（音视频缓冲、零拷贝边界、关键路径耗时预算）
- [ ] §6 错误处理与容错
- [ ] §7 兼容性（ABI / WebRTC 版本 / 编译器与标准）

**test_design.md（4个层次）：**
- [ ] L1 Unit Tests（单元测试清单）
- [ ] L2 Integration Tests（端到端媒体管道）
- [ ] L3 Quality Tests（PSNR/SSIM/PESQ，仅当改动触及编解码/传输路径）
- [ ] Boundary cases（nullptr / 线程竞态 / 资源耗尽 / 损坏帧）

**完成以上章节后立即：**
```bash
git add openspec/changes/<change-id>/*.md
git commit -m "proposal: 完成技术方案"
echo "FINISHED"
```

### ⏱ 时间分配（20分钟，单向流程）
- [0-3 min] 读取文档（每个只读1次）
- [3-5 min] 规划完整章节结构（只在内存中）
- [5-12 min] 分批写入 design.md（3 批）
- [12-17 min] 分批写入 test_design.md（2 批）
- [17-20 min] commit + FINISHED

**时间轴是单向的，不允许倒退。**

---

**Project context**

This is a C++17 streaming-media SDK (WebRTC / FFmpeg / RTSP·RTMP·HLS / mediasoup-client). Build system is CMake. Test framework is GoogleTest + GoogleMock.

## 🛑 阶段边界（硬约束，违反即视为本阶段失败）

本阶段（proposal）唯一产出是 `openspec/changes/<change-id>/design.md` 和 `openspec/changes/<change-id>/test_design.md`。**禁止以下行为**：

1. ❌ **禁止写业务实现代码**（任何 `*.cc` / `*.cpp` / `*.h` 业务文件，无论是新增还是修改）
2. ❌ **禁止写测试代码**（`*_test.cc` / `*_test.cpp` 是 test-scripts 阶段的产出）
3. ❌ **禁止跑构建命令**（`cmake --build` / `make` 均禁止；本阶段不验证实现，编译验证是 apply / build 阶段的事）
4. ❌ **禁止跑任何测试**（ctest / GoogleTest binary 均禁止）
5. ❌ **禁止 git add / git commit 任何业务实现文件**（只允许 add/commit `openspec/changes/<change-id>/design.md` + `test_design.md`）
6. ❌ **禁止 git push 任何业务实现**
7. ❌ **禁止产出 test_analysis.md / unit_test_cases.md** —— 那些是后续 test-analysis / test-cases 阶段的产出

**允许的探索性动作**：
- ✅ 只读 grep / find / cat 现有业务代码 + 测试代码（理解现状用）
- ✅ 读 prd.md / 任务描述 / 关联 wiki / memory/*.md
- ✅ 写 `openspec/changes/<change-id>/design.md` 和 `test_design.md`
- ✅ git add / commit / push **仅限** `openspec/changes/<change-id>/design.md` + `test_design.md`

**结束信号**：design.md + test_design.md 写完即 FINISHED，禁止继续往下做 test-analysis / test-cases / test-scripts / apply / build 阶段的事。

---

Follow all base TDD steps defined in `@/openspec/tdd_proposal.md`.

**Streaming-media specific overrides**

Step 3 (design.md) — MUST include these sections:
- §3 改造方案（含模块清单、接口契约、状态机、数据流图）
- §4 线程模型与并发约束（线程清单、数据所有权、锁粒度、引用计数与生命周期）—— 必填，不可省
- §5 内存与性能（音视频缓冲、零拷贝边界、关键路径耗时预算）—— 必填
- §6 错误处理与容错
- §7 兼容性（ABI / WebRTC 版本 / 编译器与标准）

Step 4 (test_design.md) — additional test layers:
- L2 Integration Tests: end-to-end media pipeline with mediasoup-server (docker) or fake transport.
- L3 Quality Tests (streaming-media specific): PSNR/SSIM/PESQ + WebRTC stats, only when the change touches encode/decode/transport paths.
- Boundary cases: nullptr inputs, thread races, resource exhaustion, corrupted media frames.

Step 6 (test-manifest.json config):
- `build_command`: `cmake --build build -j$(nproc)`
- `test_command`: `./build/wdrtc_test --gtest_filter=`
- `asan_command`: `./build-asan/wdrtc_test --gtest_filter=`
