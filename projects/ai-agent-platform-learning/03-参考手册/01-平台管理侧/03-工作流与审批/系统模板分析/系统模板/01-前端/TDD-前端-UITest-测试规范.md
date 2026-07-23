版本：1.1

创建时间：2026-07-17 16:19:44

更新时间：2026-07-17 16:19:44

---

# 前端测试规范（TDD 版）

## 1. 总原则

### 1.1 测试先行

- 每个 case 必须先 RED，再 GREEN，再 REFACTOR。
- 禁止 test-after；只提交最终实现和全绿测试视为无效。

### 1.2 测行为，不测实现

- 测用户或调用方能感知到的结果。
- 不测内部 state、私有方法、实现调用顺序。
- 重构内部实现后，只要行为不变，测试应继续通过。

### 1.3 层级不能互相替代

- L1 验证纯逻辑。
- L2 验证组件行为。
- L3 验证核心流程。
- L1 通过不能证明 L2 完成；组件行为不能被 utils/composable/store 测试抵账。

## 2. L1：纯逻辑单元测试

### 范围

- utils / formatter / 数据转换。
- 无 UI 渲染的 composable/hook。
- store action/getter 中可独立验证的业务逻辑。

### 要求

- AAA 结构。
- 命名：`should_[期望行为]_when_[场景]`。
- 断言返回值或业务事实。
- 不渲染 UI。
- 不断言调用次数、私有过程。

示例：

```ts
it('should_return_90_when_vip_buys_100', () => {
  expect(finalPrice({ price: 100, vip: true })).toBe(90)
})
```

## 3. L2：组件测试

L2 是前端 TDD 主战场，用于验证有交互、条件渲染、接口状态、表单状态、边界态的组件。

### 3.1 L2 必须满足的形态

一个 L2 case 必须同时满足：

- 被测对象是具体组件文件，如 `.vue/.tsx/.jsx`。
- 测试通过 render/mount 挂载组件。
- 用户入口优先使用 role/text/label。
- 用户动作使用 userEvent 或等价用户级事件。
- 断言用户可见结果、emit、路由变化之一。
- 接口通过 MSW 在网络层拦截，数据结构对齐 design.md 接口契约。
- 使用真实子组件、真实 store、真实 utils/composable；除第三方 SDK/路由边界/重型 UI 边界外，不 mock 自己代码。

### 3.2 推荐查询优先级

1. `getByRole(role, { name })`
2. `getByLabelText(label)`
3. `getByText(text)`
4. `findByRole/findByText` 用于异步出现的内容
5. `data-testid` 仅用于无语义的第三方组件边界，并在测试注释中说明原因

禁止：

- 以 class/id/CSS 结构作为主查询。
- 通过 `wrapper.vm.xxx` 读写内部 state。
- 直接调用组件方法完成交互。
- 把 snapshot 当主断言。

### 3.3 组件库与测试

- 生产代码使用项目既有 UI 组件库时，L2 测试应尽量挂载真实组件库或项目已有测试 setup。
- 若组件库需要全局注册/插件注入，应优先补 `test/setup`。
- 只有第三方 UI 内部实现与本 case 无关且会造成环境噪音时，才允许 stub 该第三方 UI 组件；stub 后仍必须验证本组件的用户可见行为。
- 禁止因为组件库测试麻烦而改用原生 HTML 实现生产组件。

### 3.4 判废条件

出现任一情况，L2 case 不得记为 GREEN：

- 测试对象是 utils/composable/store，而不是组件。
- 只测试抽出的纯函数，没有挂载目标组件。
- 组件文件只有注释、空 template、空 script 或伪实现。
- 用原生 HTML 偷懒替代 design.md 要求的项目 UI 组件库。
- 通过内部 state、私有方法、调用次数完成断言。
- 通过 mock 自己的子组件/store/utils 才能通过。

### 3.5 示例

```ts
it('should_show_empty_state_when_order_list_is_empty', async () => {
  server.use(
    http.get('/api/orders', () => HttpResponse.json({ list: [] }))
  )

  render(OrderListPage)

  expect(await screen.findByText('暂无订单')).toBeVisible()
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

it('should_emit_order_id_when_click_order_card', async () => {
  const user = userEvent.setup()
  const onView = vi.fn()

  render(OrderCard, {
    props: { order: { id: 7, amount: 100, status: 'PAID' }, onView }
  })

  await user.click(screen.getByRole('button', { name: '查看订单' }))

  expect(onView).toHaveBeenCalledWith(7)
})
```

说明：第二个示例中断言 emit/listener 是组件对外契约；禁止改为断言内部方法被调用。

## 4. L3：E2E

### 范围

- 核心用户主流程。
- 一个流程一个 spec，少而精。

### 要求

- 使用 Playwright 等真实浏览器测试工具。
- 定位优先 role/text/label，禁止硬编码 CSS 结构。
- 接口可使用 MSW browser 模式或真实测试环境，二选一并在 test_design.md 写明。
- 避免 sleep，使用自动等待断言。
- 不覆盖细枝末节；细节交给 L2。

### 视觉验证增强（可选）

对于需要验证视觉还原度的 L3 用例，需要：

1. **在 test_design.md 中标注**：`需要视觉验证: 是`
2. **测试代码要求**：
   - 编写标准 Playwright 测试代码
   - 包含完整的用户交互流程
   - 在关键视觉检查点执行截图：`await page.screenshot({ path: 'screenshot.png' })`
3. **执行流程**：
   - Agent 编写并提交测试代码到 git
   - 调用 `ui-test-automation` MCP 工具执行测试
   - MCP 返回测试结果和实际页面截图
   - 使用 `figma` MCP 工具获取设计稿截图
   - Agent 对比两张截图，分析视觉还原度
   - 若有差异，修复样式代码并重新提交，直到视觉完美
4. **视觉对比检查点**：
   - 布局：元素位置、大小、间距
   - 颜色：背景色、文字色、边框色
   - 字体：字号、字重、行高、字体族
   - 交互状态：hover、disabled、active、focus 等
   - 响应式：不同视口下的表现
5. **差异容忍**：
   - 像素级差异 < 1% 视为通过
   - 动态内容（时间戳、随机数等）可标注为合理差异
   - 设计稿与需求不符时，以实现为准并记录原因

### E2E 测试代码结构示例

```typescript
import { test, expect } from '@playwright/test'

test('should_complete_order_submission_flow', async ({ page }) => {
  // 1. 导航到页面
  await page.goto('/orders/create')
  
  // 2. 等待页面加载
  await expect(page.getByRole('heading', { name: '创建订单' })).toBeVisible()
  
  // 3. 填写表单
  await page.getByLabel('商品名称').fill('测试商品')
  await page.getByLabel('数量').fill('10')
  
  // 4. 视觉检查点 - 表单填写完成状态截图
  await page.screenshot({ path: 'order-form-filled.png', fullPage: true })
  
  // 5. 提交
  await page.getByRole('button', { name: '提交订单' }).click()
  
  // 6. 断言成功
  await expect(page.getByText('订单创建成功')).toBeVisible()
  
  // 7. 视觉检查点 - 成功状态截图
  await page.screenshot({ path: 'order-success.png', fullPage: true })
})
```

## 5. Mock 边界

可以 mock：

- 后端 HTTP：必须优先 MSW。
- 时间、随机数、Date。
- 第三方 SDK：支付、地图、埋点、宿主能力。
- 路由边界：按需 mock 或注入真实 router。
- 第三方重型 UI 内部实现：仅当与本行为无关且测试环境不稳定。

禁止 mock：

- 自己写的子组件。
- 自己写的 store。
- 自己写的 utils/composable。
- 自己写的请求封装。

如果必须 mock 自己代码才能测，说明设计耦合过重，应回到 design.md 调整组件边界。

## 6. 何时不写测试

需在 test_design.md 显式声明跳过原因：

- 纯静态展示组件，无 props 分支、无交互、无条件渲染。
- 纯样式/布局，进入阶段 3 视觉走查。
- 第三方组件透传封装，且无自有逻辑。

不能跳过：

- loading/empty/error/unauthorized。
- 表单校验、提交、禁用、失败反馈。
- 路由跳转。
- emit 或父子组件协作。
- 接口成功/失败分支。
