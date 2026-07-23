版本：1.1

创建时间：2026-07-17 16:20:32

更新时间：2026-07-17 16:20:32

---

# 前端 TDD 执行提示词（Apply 阶段）

## 1. Guardrails

- 选最简单直接的真实实现，不做无关复杂性。
- 改动严格限定在当前目标，不重构无关代码。
- 全程中文回复。
- “简单”不能被解释为降低测试层级、替换技术栈、写占位组件、跳过边界态。

## 2. Source of Truth

实现完整性由 `tasks.md` 判定，不是 manifest。

manifest 只跟踪测试进度：

- 每个 case：`PENDING → RED → GREEN`，禁止跳步。
- 外层 `status`：`PENDING → RED_IN_PROGRESS → READY_FOR_PR`。
- 禁止从外层 `status` 推断单个 case 进度。

质量完整性由以下文件共同判定：

- `acceptance_criteria.md`：用户可观察行为是否覆盖。
- `design.md`：技术栈、组件、接口、状态是否实现。
- `test_design.md`：测试层级和用例是否正确。
- `tasks.md`：实现任务是否全部完成。
- `test-manifest.json`：每个 case 是否完成 RED/GREEN。

## 3. Artifacts

从磁盘读取，无 `@/` 前缀：

- `changes/<change-id>/acceptance_criteria.md`
- `changes/<change-id>/proposal.md`
- `changes/<change-id>/design.md`
- `changes/<change-id>/test_design.md`
- `changes/<change-id>/tasks.md`
- `changes/<change-id>/test-manifest.json`

命令占位：

- `<test_command>` = manifest `config.test_command`，默认 `npm test`
- `<e2e_command>` = manifest `config.e2e_command`，默认 `npm run test:e2e`
- `<typecheck_command>` = manifest `config.typecheck_command`，默认 `npm run typecheck`
- `<build_command>` = manifest `config.build_command`，默认 `npm run build`

## 4. 执行前校验

开始前必须完成：

1. 读取所有 artifacts。
2. 确认 proposal.md 已完成项目技术栈盘点。
3. 确认 design.md 的边界态与 acceptance_criteria.md 一一对应。
4. 确认 test_design.md 的每条用例都有 manifest entry。
5. 确认每个 L2 case 都有 `target_file` 指向真实组件文件。
6. 将 manifest 外层 `status` 改为 `RED_IN_PROGRESS`。
7. 从第一个 `PENDING` case 开始，按 tasks.md 顺序执行。

若 artifacts 缺失或关键待确认点未清零，不得编码。

## 5. TDD 循环

对每个 case，执行完整 RED → GREEN → REFACTOR。

### 5.1 RED

- 按 case.layer 写测试。
- 单跑当前测试，确认失败。
- 失败原因必须是目标行为未实现，不是导入、语法、环境或测试写错。
- commit 测试。
- 更新 manifest：当前 case `state = RED`。

L2 RED 特别要求：

- 必须挂载目标组件。
- 必须从用户视角查询和交互。
- 涉及接口必须用 MSW。
- 不得 mock 自己的子组件/store/utils。

### 5.2 GREEN

- 写最少真实生产实现。
- 禁止修改当前 RED 测试来适配实现。
- 禁止修改已 GREEN case 的测试。
- 单跑当前测试，确认通过。
- commit 实现。
- 更新 manifest：当前 case `state = GREEN`。

L2 GREEN 特别要求：

- 组件必须是真实生产组件，不是占位或测试专用假组件。
- 若项目已有 UI 组件库/业务组件库，必须按 design.md 使用。
- 当前 case 涉及的状态必须真实实现：loading/empty/error/unauthorized/submitting/disabled/success。
- 接口、router、store 必须走项目既有封装或 design.md 声明方案。

**L3 GREEN 特别要求（含视觉验证）：**

对于标注"需要视觉验证: 是"的 L3 用例，执行以下流程：

1. **编写 E2E 测试代码**：
   - 使用 Playwright 编写完整测试流程
   - 在关键视觉检查点添加截图：`await page.screenshot({ path: 'checkpoint.png', fullPage: true })`
   - 包含功能断言（用户可见结果、URL 变化等）
   - 提交测试代码到 git

2. **实现功能代码**：
   - 按 design.md 实现组件和页面
   - 确保样式使用项目 UI 组件库或遵循设计规范
   - 本地运行测试确认功能通过
   - 提交实现代码到 git

3. **调用 UI Test Automation MCP 执行远程测试**：
   ```
   使用 mcp__ui-test-automation__ui_web_validation_submit 工具，参数：
   {
     "taskId": "visual-<change-id>-<timestamp>",
     "flowType": "WEB_VALIDATION",
     "repoUrl": "从项目获取 git remote URL",
     "branch": "当前分支名",
     "commitId": "最新 commit SHA",
     "installCommand": "从 design.md 获取，如 npm install",
     "buildCommand": "从 design.md 获取，如 npm run build 或 skip",
     "startCommand": "从 design.md 获取，如 npm run dev",
     "pageEntry": "从 design.md 获取入口页面",
     "mockProfile": "从 design.md 获取，如 real/mock",
     "functionalScenarios": [
       {
         "scenarioId": "e2e-<test_name>",
         "name": "测试用例名称",
         "priority": "P0",
         "url": "测试页面 URL",
         "timeoutSeconds": 60,
         "steps": [
           // 将 Playwright 测试代码转换为步骤格式
           // goto, click, fill, assertVisible, assertText 等
         ]
       }
     ],
     "validationConfig": {
       "visual": { "enabled": false },  // 暂不使用平台的视觉对比
       "functional": { "enabled": true },
       "gate": {
         "failOnP0FunctionalFail": true
       },
       "browser": "chromium",
       "timeoutSeconds": 600
     },
     "artifactPolicy": {
       "retentionDays": 30,
       "saveTrace": true,
       "saveVideo": false,
       "saveLogs": true,
       "saveScreenshots": true
     }
   }
   ```
   
4. **轮询测试状态**：
   - 使用 `mcp__ui-test-automation__ui_web_validation_status` 查询 runId 状态
   - 等待测试完成（状态为 SUCCESS 或 FAILED）
   - 获取测试结果和截图 URL

5. **使用 Figma MCP 获取设计稿截图**：
   ```
   使用 mcp__figma__download_assets 工具，参数：
   {
     "fileKey": "从 design.md 第 11.1 节获取",
     "nodeId": "从 design.md 第 11.1 节获取对应页面的节点ID"
   }
   ```
   获取设计稿的导出图片

6. **对比分析视觉差异**：
   - 下载 UI Test 返回的实际截图
   - 下载 Figma 导出的设计稿截图
   - 使用图片分析能力对比两张图片，检查：
     * 布局差异：元素位置、大小、间距是否一致
     * 颜色差异：背景色、文字色、边框色是否匹配
     * 字体差异：字号、字重、行高是否正确
     * 交互状态：按钮、输入框等组件状态是否符合设计
     * 响应式布局：在目标视口下的表现是否正确
   - 计算差异率（像素级或区域级）

7. **判断是否通过**：
   - **功能测试全绿 + 视觉差异 < 1%**：通过，更新 manifest `state = GREEN`
   - **功能测试全绿 + 视觉差异 >= 1%**：
     * 分析差异原因（样式问题、组件使用错误、布局问题等）
     * 修复样式代码
     * 提交修复后的代码
     * 回到步骤 3，重新执行 MCP 测试
   - **功能测试失败**：
     * 分析失败原因（逻辑错误、接口问题、交互问题等）
     * 修复功能代码
     * 提交修复后的代码
     * 回到步骤 2，本地验证后再执行 MCP 测试
   - **视觉差异为合理差异**（动态内容、设计稿与需求不符等）：
     * 在测试文档中记录差异原因
     * 标注为"已接受的差异"
     * 更新 manifest `state = GREEN`

8. **循环终止条件**：
   - 最多重试 3 次
   - 超过 3 次仍未通过，记录问题并标记为阻塞，需人工介入

9. **记录验证结果**：
   - 在 commit message 中记录视觉验证结果
   - 保存对比截图到 `docs/visual-validation/` 目录
   - 在工作总结中记录视觉还原度

### 5.3 REFACTOR

- 只在测试保持 GREEN 的前提下小步重构。
- 每次重构后重跑相关测试。
- 无重构则写明跳过原因。

## 6. Shared Test Files

- 一个 `test_file` 可以承载多个 case。
- RED/GREEN/commit 的单位是 `test_name`。
- PENDING/RED case 可以追加测试。
- 已 GREEN case 的测试冻结；若必须修改，先回退对应 case 到 RED，并记录原因。

## 7. 完成后全量验证

所有 case GREEN 后，按顺序执行：

1. `<test_command>` 全量测试。
2. `<e2e_command>` + E2E 视觉验证（如有标注"需要视觉验证: 是"的 L3 用例）：
   - **功能验证**：运行所有 E2E 测试，确认功能全部通过
   - **视觉验证**（针对需要视觉验证的用例）：
     * 确保所有代码已提交到 git
     * 对每个需要视觉验证的 L3 用例，重新调用 UI Test Automation MCP
     * 获取所有页面的最终截图
     * 使用 Figma MCP 获取对应的设计稿截图
     * 逐页对比视觉还原度
     * 生成视觉对比报告，保存到 `docs/visual-validation/<change-id>-report.md`
     * 报告内容包括：
       - 对比的页面列表
       - 每个页面的差异率
       - 差异截图（如有）
       - 合理差异说明（如有）
       - 最终结论：通过/未通过
   - 如无 L3 或项目无 E2E，写明不适用原因。
3. `<typecheck_command>`，如无该命令，写明替代检查。
4. `<build_command>`，如无该命令，写明原因。

任何失败（功能或视觉）都不得继续写总结。先修复并回到对应 case。

**视觉验证失败处理**：
- 识别差异类型：布局问题、颜色不匹配、字体错误、组件使用错误等
- 定位到具体组件和样式文件
- 修复后重新执行全量验证
- 记录修复过程到工作总结

## 8. 独立质量审计

全量验证通过后，逐项审计。

### 8.1 行为覆盖审计

- acceptance_criteria.md 每条 Given/When/Then 是否有 L2 或 L3 覆盖。
- 可抽纯逻辑是否有 L1 覆盖。
- 不写测试的项是否在 test_design.md 显式声明原因。

### 8.2 层级一致性审计

- L1 是否只测纯逻辑。
- L2 是否全部挂载真实组件。
- L3 是否覆盖主流程。
- 是否存在 L2 被 utils/composable/store 测试替代；若存在，必须回退重做。

### 8.3 技术栈一致性审计

- 生产代码是否沿用 proposal/design 声明的 UI 组件库、业务组件、store、router、请求封装。
- 是否存在用原生 HTML 偷懒替代既有 UI 组件库。
- 测试环境问题是否通过 setup/stub 边界解决，而不是降级测试或降级实现。

### 8.4 生产可用性审计

新增/修改组件必须检查：

- 非占位文件。
- 真实 template/render、script/logic、必要样式或项目类名。
- 真实 props/emits。
- loading/empty/error/unauthorized/submitting/disabled/success 状态按设计实现。
- API 成功/失败分支处理。
- 重试或恢复路径。
- 表单校验和提交中防重复提交。

### 8.5 测试真实性审计

- L2 查询以 role/text/label 为主。
- 用户动作使用 userEvent 或等价用户级事件。
- 接口用 MSW。
- 不 mock 自己的子组件/store/utils。
- 不断言内部 state、私有方法、调用次数。
- 不用 snapshot 当主断言。

有任何审计缺口，不得进入总结；回到对应 case 修复。

### 8.6 视觉还原度审计（如有视觉验证的 L3 用例）

针对标注"需要视觉验证: 是"的 L3 用例，逐项审计：

| 页面/组件 | Figma 节点 | 实际截图 | 差异率 | 主要差异点 | 是否通过 | 备注 |
|---|---|---|---|---|---|---|
|  |  |  |  |  | 是/否 |  |

审计标准：
- 差异率 < 1%：通过
- 差异率 >= 1% 但 < 5%：需说明原因，评估是否可接受
- 差异率 >= 5%：未通过，必须修复

常见差异类型及处理：
- **布局错误**（元素位置、大小、间距）：必须修复
- **颜色不匹配**（背景色、文字色、边框色）：必须修复
- **字体问题**（字号、字重、行高）：必须修复
- **组件使用错误**（未使用 UI 组件库或使用错误）：必须修复
- **动态内容差异**（时间戳、随机数、用户数据）：标注为合理差异
- **第三方内容差异**（广告、地图、嵌入内容）：标注为合理差异
- **设计稿与需求不符**：以实现为准，记录原因

未通过项必须回到对应 case 修复。

## 9. tasks.md 完整性检查

逐行核对 `tasks.md`：

- 每个 `[ ]` 对应工作是否真实完成。
- 文件是否存在。
- 方法/组件/状态/接口是否按 design.md 实现。
- 测试是否存在且执行过。

只有确认完成后才能改为 `[x]`。

## 10. 结束

所有验证和审计通过后：

1. 将 manifest 外层 `status` 改为 `READY_FOR_PR`。
2. 按 `local_summary_fe.md` 生成工作总结。
3. 输出到 `docs/work-summary/【任务名称】-工作总结.md`。
4. 若视觉走查属于阶段 3，明确列为移交项，不得冒充已完成。

## 11. 禁止完成声明

出现以下任一情况，最终回复必须说明“本轮未完成”，不得写“完成”：

- manifest 存在 PENDING/RED。
- tasks.md 存在未完成项。
- L2 降级为 L1。
- 组件是占位/伪实现。
- 未沿用 design.md 指定技术栈。
- 已声明边界态未实现。
- 全量测试、类型检查、构建未通过且无合理不适用说明。

## Anti-Fake Completion Gate

禁止以下测试作为完成依据：
- expect(true).toBe(true)
- expect(1).toBe(1)
- it.todo / test.todo
- 仅检查组件能 mount，但无业务断言
- 仅断言 mock 被调用，但无用户可见结果
- 仅测试 utils，却把 case 标记为 component
- 空 E2E、无 page 操作的 E2E
