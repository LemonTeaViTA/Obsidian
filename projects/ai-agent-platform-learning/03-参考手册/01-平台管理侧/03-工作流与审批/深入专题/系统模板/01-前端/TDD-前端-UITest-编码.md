版本：1.1

创建时间：2026-07-17 16:19:10

更新时间：2026-07-17 16:19:10

---

# 前端 TDD 编码提示词（Write 阶段）

依据 `design.md` / `test_design.md` / `tasks.md` 交付实现与测试。禁止猜接口，先查 design.md 的接口契约表。新增代码必须类型检查/编译通过。全程中文回复。

## 1. 写代码前检查

开始任何 RED 前，先确认：

- 已读取 `acceptance_criteria.md`、`proposal.md`、`design.md`、`test_design.md`、`tasks.md`、`test-manifest.json`。
- `proposal.md` 已完成技术栈盘点。
- `design.md` 已声明 UI 组件库、请求封装、store、router、边界态。
- 当前 case 的 `state` 是 `PENDING`。
- 当前 case 的 `layer`、`test_file`、`test_name`、`target_file` 明确。

若发现设计缺口，不要猜；先补设计或标记阻塞。

## 2. 每个对子执行格式

对子 N：`<case id> <test_name>`，layer=`unit|component|e2e`，target=`<target_file>`

### 【RED】写失败测试

必须输出：

- 测试意图：
- 测试文件：
- 被测目标：
- 测试代码：
- 单测命令：
- 失败结果：必须包含 FAILED/FAIL，且失败原因是“实现缺失或行为不满足”，不是语法错误、导入错误、环境错误。

L2 额外必须输出：

- 挂载的组件文件：
- 用户入口：role/text/label：
- 用户动作：userEvent 或等价用户级事件：
- 断言：可见结果 / emit / 路由变化：
- MSW handler：如本行为涉及接口：
- 是否未 mock 自己的子组件/store/utils：是

RED 后：

- commit 测试变更。
- 更新 manifest：当前 case `state = RED`，刷新 `last_updated`。

### 【GREEN】写最少真实生产实现

必须输出：

- 实现文件：
- 实现说明：只说明与当前 case 相关的最小行为。
- 实现代码摘要：关键片段即可，不需要整文件刷屏。
- 单测命令：
- 通过结果：必须包含 PASS/PASSED。

GREEN 规则：

- 禁止修改已 GREEN case 的测试。
- 禁止在 GREEN 阶段修改当前 case 测试来适配实现；若测试错了，说明原因并把 case 回退到 RED。
- 生产代码必须沿用 design.md 声明的 UI 组件库、请求封装、store、router。
- 不能为了过测试写死数据、写死文案、绕过真实数据流。

L2 GREEN 额外检查：

- 组件不是占位文件。
- 组件包含真实渲染、事件和状态处理。
- 若 design.md 要求 UI 组件库，生产代码已使用对应组件或项目封装。
- 已实现当前行为涉及的 loading/empty/error/submitting/disabled/success 反馈。

**L3 GREEN 额外流程（如标注"需要视觉验证: 是"）：**

执行以下步骤完成功能实现 + 视觉验证：

**步骤 1：编写 E2E 测试代码**
- 使用 Playwright 编写完整的用户交互流程
- 在关键视觉检查点添加截图代码
- 包含功能断言
- 提交测试代码到 git

**步骤 2：实现功能代码**
- 按 design.md 实现页面和组件
- 使用项目 UI 组件库或遵循设计规范
- 本地运行测试确认功能通过
- 提交实现代码到 git

**步骤 3：调用 UI Test Automation MCP**
- 使用 `mcp__ui-test-automation__ui_web_validation_submit` 工具
- 传入项目信息（repoUrl, branch, commitId）和测试配置
- 获取返回的 runId

**步骤 4：轮询测试状态**
- 使用 `mcp__ui-test-automation__ui_web_validation_status` 工具
- 传入 runId 查询测试状态
- 等待测试完成并获取截图 URL

**步骤 5：获取 Figma 设计稿截图**
- 使用 `mcp__figma__download_assets` 工具
- 传入 design.md 中记录的 fileKey 和 nodeId
- 获取设计稿导出图片

**步骤 6：对比分析**
- 下载实际截图和设计稿截图
- 分析布局、颜色、字体、交互状态等差异
- 计算差异率

**步骤 7：判断结果**
- 功能全绿 + 视觉差异 < 1%：GREEN，进入 REFACTOR
- 功能全绿 + 视觉差异 >= 1%：修复样式，回到步骤 2
- 功能失败：修复功能，回到步骤 2
- 最多重试 3 次，超过则标记阻塞

**步骤 8：记录结果**
- 保存对比截图到 `docs/visual-validation/`
- 在 commit message 中记录验证结果

GREEN 后：

- commit 实现变更。
- 更新 manifest：当前 case `state = GREEN`，刷新 `last_updated`。

### 【REFACTOR】保持 GREEN 清理

有重复、命名混乱、组件职责不清、测试 setup 可复用等坏味道时进行小步重构。

必须输出：

- 重构内容：
- 重跑命令：
- 结果：PASS/PASSED。

若无需重构，输出：

```text
REFACTOR skipped — 无重复、坏味道或职责漂移。
```

## 3. L2 不能降级

以下情况即使测试通过，也必须判定当前 case 未完成并重做：

- L2 测试没有挂载目标组件。
- 用 utils/composable/store 测试替代组件测试。
- 组件 `.vue/.tsx/.jsx` 只有占位或伪实现。
- 用原生 HTML 偷懒替代项目既有 UI 组件库。
- 通过内部 state、私有方法、调用次数断言。
- mock 自己的子组件/store/utils。
- 未覆盖 design.md/AC 已声明的用户可见状态。

## 4. “最少实现”的边界

最少实现允许：

- 只实现当前 case 需要的行为。
- 不做无关抽象。
- 不重构无关代码。

最少实现不允许：

- 降低测试层级。
- 省略真实组件结构。
- 省略真实 props/emits/API/store/router 数据流。
- 用假 UI 替代项目 UI 组件库。
- 省略错误、空态、加载、提交中等当前 case 需要的状态。

## 5. 共享测试文件规则

- RED/GREEN/commit 的单位是 `test_name`，不是文件。
- 一个 `test_file` 可包含多个 case。
- PENDING/RED case 可以向共享测试文件追加测试。
- 已 GREEN case 的测试视为冻结；要改必须先把对应 case 回退 RED，并写明原因。

## 6. 全部 case 完成后的收尾

完成所有 case 后：

1. 跑全量 `<test_command>`。
2. 跑 `<e2e_command>`，如项目无 E2E 或本次无 L3，写明不适用原因。
3. 跑 `<typecheck_command>`，如项目无该命令，写明替代检查。
4. 跑 `<build_command>`，如项目无该命令，写明原因。
5. 逐行核对 tasks.md，确认每个 `[ ]` 对应工作真实完成后再改 `[x]`。
6. 执行质量审计：层级一致性、技术栈一致性、生产可用性、测试真实性。
7. 生成工作总结到 `docs/work-summary/【任务名称】-工作总结.md`，遵循 `local_summary_fe.md`。

## 7. 禁止结束条件

出现以下任一情况，不得宣布完成：

- manifest 还有 PENDING/RED。
- tasks.md 还有未完成项。
- test_design.md 有用例没有 manifest entry。
- L2 存在降级 L1。
- 生产组件未沿用 design.md 的技术栈。
- 类型检查/构建未运行且无合理说明。
- 工作总结里任何质量门禁为“否/有”，但仍写“已完成”。

## GREEN 证据要求

GREEN 不以测试通过为唯一标准，而以“真实业务断言通过”为标准。

每个 GREEN case 必须提供：
1. 对应 test_name
2. 失败过的 RED 输出
3. 通过的 GREEN 输出
4. 测试中的业务断言摘录
5. 对 L2：被测组件、用户动作、用户可见断言
6. 对 L3：入口页面、用户路径、最终可见结果或 URL 变化

占位测试即使 PASS，也必须视为失败。
