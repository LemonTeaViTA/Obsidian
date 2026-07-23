版本：1.1

创建时间：2026-07-17 16:20:48

更新时间：2026-07-17 16:20:48

---

# 前端 TDD 规划提示词（Proposal 阶段）

本阶段只做规划，不写生产代码。目标是把需求拆成「可观察行为 → 技术设计 → 测试设计 → RED/GREEN 对子任务」。

## 一、基本原则

- `test_design.md` 与 `design.md` 同等重要。
- `tasks.md` 必须按 RED → GREEN → REFACTOR 对子组织，禁止先写完测试、再统一实现，禁止按“先搭页面、再补测试”的水平切片。
- 所有模糊点必须在规划阶段暴露。不能确认的问题写入「待确认点」，并阻止进入编码阶段。
- 视觉/样式走阶段 3 视觉旁路；但涉及用户可见状态、交互反馈、表单校验、错误处理的内容必须进入 AC / design / test_design。

## 二、步骤

### 1. 需求转行为：生成 acceptance_criteria.md

遵循 `local_ac_fe.md`。

必须包含：

- 用户角色与入口。
- 主操作路径。
- 正常态、加载态、空态、错误态、无权限态；不适用也要显式写「不适用」和原因。
- Given / When / Then。每条 GWT 只描述一个用户可观察行为。
- 待确认点。凡是会影响页面行为、跳转、接口、权限、空态/错误态呈现的问题，都必须列出。

### 2. 建立 change 目录

根据taskId生成 `change-id`，在 `changes/<change-id>/` 下创建：

- `acceptance_criteria.md`
- `proposal.md`
- `design.md`
- `test_design.md`
- `test-manifest.json`
- `tasks.md`

### 3. 项目技术栈盘点：写入 proposal.md

在写 design/test/tasks 前，先读取项目现有文件，确认并记录以下内容：

| 项 | 结论 | 证据文件 |
|---|---|---|
| 前端框架 | Vue2 / Vue3 / React / 其他 | package.json / main 文件 |
| UI 组件库 | Element Plus / Ant Design / Vant / 自研 / 无 | package.json / 入口注册文件 / 既有组件 |
| 状态管理 | Pinia / Vuex / Redux / 无 | store 目录 |
| 路由方案 | vue-router / react-router / 其他 | router 目录 |
| 请求封装 | axios / fetch / request 工具 | api/request 文件 |
| 测试框架 | Vitest / Jest / Playwright / 其他 | 配置文件 |
| 组件测试工具 | Testing Library / Vue Test Utils / 其他 | package.json / 既有 spec |
| 测试 setup | 已有 / 需补充 | vitest/jest 配置 |

规则：

- 后续设计、测试、实现必须沿用项目既有技术栈。
- 如果项目已有 UI 组件库，生产组件必须使用该组件库或项目既有业务组件；禁止用原生 HTML 作为偷懒替代。
- 如果测试环境暂不支持 UI 组件库，任务应包含补充测试 setup；不能以“组件库测试麻烦”为由把 L2 降级为 L1。
- 若确实不能使用某个既有库，必须在 proposal.md 写明原因、影响和替代方案，并进入待确认点。

### 4. 写 design.md

遵循 `local_design_fe.md`。

必须覆盖：

- 方案概述与影响范围。
- 组件树与组件职责。
- Props / Emits / 路由 / store / 请求封装。
- 接口契约，MSW handler 必须以后续此表为准。
- 边界态，必须与 acceptance_criteria.md 的界面态一一对应。
- 生产实现约束：哪些组件必须使用 UI 组件库、哪些状态必须真实实现、哪些纯逻辑可抽 L1。
- **如有 L3 需要视觉验证**：记录 Figma 设计稿信息（File Key、Node ID、视口配置）和 E2E 测试环境配置。

### 5. 写 test_design.md

遵循 `local_test_fe.md`。

按三层设计：

- L1：纯逻辑、数据转换、formatter、composable/store 中可独立验证的业务事实。
- L2：组件行为。凡是来自 GWT 的用户可见状态或交互，优先进入 L2。
- L3：少量核心主流程 E2E，不覆盖细枝末节。

L2 用例必须写明：

| 字段 | 要求 |
|---|---|
| 被测组件 | 具体组件文件，不能写 utils/composable/store |
| 用户入口 | role / text / label |
| 用户动作 | userEvent 或等价用户级事件 |
| 网络 | MSW handler 名称；数据结构对齐 design 接口契约 |
| 断言 | 用户可见结果、emit、路由变化之一 |
| 禁止替代 | 不得用纯函数测试替代组件测试 |

L3 用例必须写明：

| 字段 | 要求 |
|---|---|
| 测试场景 | 核心用户主流程描述 |
| 入口页面 | 测试起点 URL |
| 用户路径 | 导航 → 交互 → 断言的完整流程 |
| **需要视觉验证** | **是/否（如为"是"，需在 design.md 中填写 Figma 信息）** |

判断规则：

- 如果测试对象是纯函数，它只能是 L1。
- 如果行为用户可见，它必须至少有 L2 或 L3 覆盖。
- 如果 L2 测试写不出来，优先调整组件设计，而不是降低测试层级。
- **如果 L3 用例需要验证视觉还原度（UI 组件、布局、样式敏感场景），标注"需要视觉验证: 是"。**

### 6. 写 tasks.md

按 test_design 的 case 顺序生成对子任务：

```md
- [ ] T1 RED：为 <case id/test_name> 写失败测试
- [ ] T1 GREEN：写最少生产实现让该测试通过
- [ ] T1 REFACTOR：在测试保持通过的前提下清理重复/坏味道；无则说明跳过原因
```

要求：

- 一个对子对应一个 test case。
- RED/GREEN 的单位是 test case，不是测试文件。
- 不允许把“实现组件骨架”“接接口”“补样式”拆成脱离测试的水平任务；它们必须归入能验证行为的 GREEN 步骤。
- 若需要补测试 setup，也作为最早的准备任务列出，但不得替代 RED。

### 7. 生成 test-manifest.json

Schema：

```json
{
  "spec_id": "<change-id>",
  "status": "PENDING",
  "config": {
    "test_command": "npm test",
    "e2e_command": "npm run test:e2e",
    "typecheck_command": "npm run typecheck",
    "build_command": "npm run build"
  },
  "cases": [
    {
      "id": "CT-001",
      "layer": "unit | component | e2e",
      "intent": "业务行为，大白话",
      "state": "PENDING",
      "test_file": "src/components/OrderList.spec.ts",
      "test_name": "should_show_empty_state_when_list_is_empty",
      "target_file": "src/components/OrderList.vue"
    }
  ],
  "last_updated": "<ISO8601>"
}
```

规则：

- `test_design.md` 每条用例必须有 manifest entry，不许漏。
- 初始阶段所有 `cases[].state` 必须是 `PENDING`。
- 外层 `status` 初始为 `PENDING`。
- `target_file` 必填：L1 指向被测逻辑文件，L2 指向组件文件，L3 指向主流程入口或 e2e spec 目标。
- manifest 只记录进度，不记录冻结、阻塞、回退原因；这些写在执行日志或提交信息中。

## 三、规划阶段完成条件

只有同时满足以下条件，才允许进入编码阶段：

- acceptance_criteria.md 中无未清零的关键待确认点。
- proposal.md 已完成技术栈盘点，并给出证据文件。
- design.md 的边界态与 AC 一一对应。
- test_design.md 中每条 L2 都指向真实组件。
- tasks.md 完全按 RED/GREEN/REFACTOR 对子排列。
- manifest 与 test_design 一一对应，且所有 case 都是 PENDING。
