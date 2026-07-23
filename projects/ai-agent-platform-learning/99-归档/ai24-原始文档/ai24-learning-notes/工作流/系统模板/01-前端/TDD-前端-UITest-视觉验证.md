版本：1.1

创建时间：2026-07-17 16:20:17

更新时间：2026-07-17 16:20:17

---

# 前端 TDD 视觉验证操作指南

本指南说明如何在 TDD 流程中使用 UI Test Automation MCP 和 Figma MCP 进行端到端测试和视觉还原度验证。

## 1. 适用场景

以下场景需要启用视觉验证：

- **新增页面或组件**：首次实现的 UI，需要验证设计还原度
- **样式敏感场景**：布局复杂、设计精细的页面
- **UI 组件库迁移**：更换或升级 UI 组件库时
- **响应式布局**：多端适配、不同视口下的表现
- **品牌视觉要求**：有严格视觉规范的项目

不需要视觉验证的场景：

- 纯逻辑功能（无 UI 变化）
- 后台管理页面（功能优先）
- 快速原型验证阶段

## 2. 前置准备

### 2.1 在 design.md 中记录 Figma 信息

```markdown
## 11. 视觉验证配置

### 11.1 Figma 设计稿信息

| 页面/组件 | Figma File Key | Figma Node ID | 设计稿名称 | 视口配置 | 对应 L3 用例 |
|---|---|---|---|---|---|
| 订单列表页 | abc123def456 | 123:456 | 订单列表-桌面端 | 1440x900 | CT-E2E-001 |
| 订单详情页 | abc123def456 | 789:012 | 订单详情-桌面端 | 1440x900 | CT-E2E-002 |
```

**如何获取 Figma 信息**：
1. 打开 Figma 设计稿
2. File Key：从 URL 中提取，如 `https://figma.com/file/abc123def456/...`
3. Node ID：右键设计稿节点 → Copy Link → 从 URL 提取 `node-id=123-456`，转换为 `123:456`

### 2.2 在 design.md 中配置 E2E 测试环境

```markdown
### 11.2 E2E 测试环境配置

| 配置项 | 值 | 说明 |
|---|---|---|
| 代码仓库 URL | ssh://git@gitlab.vdian.net:60022/weidian-pc/pc-vue-info.git | git clone 地址 |
| 测试分支 | feature/order-list | 当前开发分支 |
| 依赖安装命令 | npm install | 或 yarn install |
| 构建命令 | npm run build | 或 skip（如不需要构建） |
| 启动命令 | npm run dev | 开发服务器启动命令 |
| 页面入口 | /pages/index.html | 入口页面路径 |
| Mock 环境 | real | real（真实数据）/ mock（模拟数据） |
```

### 2.3 在 test_design.md 中标注需要视觉验证的用例

```markdown
## L3：E2E 测试用例

| 用例 ID | 测试场景 | 入口页面 | 用户路径 | **需要视觉验证** |
|---|---|---|---|---|
| CT-E2E-001 | 订单列表加载和展示 | /orders | 导航到订单页 → 等待加载 → 验证列表展示 | **是** |
| CT-E2E-002 | 订单详情查看 | /orders | 点击订单卡片 → 查看详情 → 验证详情展示 | **是** |
| CT-E2E-003 | 订单搜索功能 | /orders | 输入搜索词 → 点击搜索 → 验证结果 | 否 |
```

## 3. 编写 E2E 测试代码（RED 阶段）

### 3.1 测试代码结构

```typescript
import { test, expect } from '@playwright/test'

test('should_display_order_list_correctly', async ({ page }) => {
  // 1. 导航到页面
  await page.goto('/orders')
  
  // 2. 等待页面加载完成
  await expect(page.getByRole('heading', { name: '订单列表' })).toBeVisible()
  
  // 3. 验证核心功能
  await expect(page.getByRole('list')).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(10)
  
  // 4. 视觉检查点 - 完整页面截图
  await page.screenshot({ 
    path: 'tests/screenshots/order-list-full.png', 
    fullPage: true 
  })
  
  // 5. 测试交互
  await page.getByRole('button', { name: '查看详情' }).first().click()
  
  // 6. 视觉检查点 - 详情弹窗截图
  await page.screenshot({ 
    path: 'tests/screenshots/order-detail-dialog.png' 
  })
  
  // 7. 验证跳转或状态变化
  await expect(page.getByText('订单详情')).toBeVisible()
})
```

### 3.2 截图最佳实践

- **全页面截图**：`fullPage: true`，用于整体布局验证
- **局部截图**：针对特定组件或区域，使用 `clip` 参数
- **等待稳定**：截图前确保动画完成、数据加载完毕
- **命名规范**：`<page>-<state>-<viewport>.png`，如 `order-list-loaded-1440x900.png`

```typescript
// 等待动画完成
await page.waitForTimeout(300)

// 局部截图
await page.locator('.order-card').first().screenshot({ 
  path: 'tests/screenshots/order-card.png' 
})

// 指定区域截图
await page.screenshot({
  path: 'tests/screenshots/header.png',
  clip: { x: 0, y: 0, width: 1440, height: 80 }
})
```

## 4. 实现功能代码（GREEN 阶段）

### 4.1 实现流程

1. 按 design.md 实现页面和组件
2. 使用项目 UI 组件库（不要用原生 HTML 偷懒）
3. 本地运行测试确认功能通过
4. 提交代码到 git

### 4.2 样式实现注意事项

- **严格遵循设计稿**：颜色、字体、间距、圆角等
- **使用设计 token**：如有设计系统，使用预定义的颜色变量、间距变量
- **响应式适配**：确保在目标视口下表现正确
- **交互状态**：hover、active、disabled、focus 等状态样式

## 5. 调用 UI Test Automation MCP

### 5.1 提交代码并获取 commit ID

```bash
git add .
git commit -m "feat: 实现订单列表页面"
git push origin feature/order-list

# 获取最新 commit ID
git rev-parse HEAD
```

### 5.2 构建 MCP 调用参数

从 design.md 中读取配置，��建 MCP 参数：

```json
{
  "taskId": "visual-change-001-20260711",
  "flowType": "WEB_VALIDATION",
  "repoUrl": "ssh://git@gitlab.vdian.net:60022/weidian-pc/pc-vue-info.git",
  "branch": "feature/order-list",
  "commitId": "d5caca61a158034066fbc244b4da012a221d0286",
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "startCommand": "npm run dev",
  "pageEntry": "/pages/index.html",
  "mockProfile": "real",
  "functionalScenarios": [
    {
      "scenarioId": "e2e-order-list-display",
      "name": "订单列表加载和展示",
      "priority": "P0",
      "url": "/orders",
      "timeoutSeconds": 60,
      "steps": [
        {
          "action": "goto",
          "url": "/orders"
        },
        {
          "action": "assertVisible",
          "selector": "role=heading[name='订单列表']"
        },
        {
          "action": "assertVisible",
          "selector": "role=list"
        },
        {
          "action": "screenshot",
          "path": "order-list-full.png",
          "fullPage": true
        }
      ]
    }
  ],
  "validationConfig": {
    "visual": {
      "enabled": false
    },
    "functional": {
      "enabled": true
    },
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

### 5.3 Playwright 步骤到 MCP 步骤的映射

| Playwright 代码 | MCP 步骤格式 |
|---|---|
| `await page.goto('/orders')` | `{"action": "goto", "url": "/orders"}` |
| `await page.getByRole('button', {name: '查看'}).click()` | `{"action": "click", "selector": "role=button[name='查看']"}` |
| `await page.getByLabel('搜索').fill('订单号')` | `{"action": "fill", "selector": "label=搜索", "value": "订单号"}` |
| `await expect(page.getByText('成功')).toBeVisible()` | `{"action": "assertVisible", "selector": "text=成功"}` |
| `await page.screenshot({path: 'x.png'})` | `{"action": "screenshot", "path": "x.png"}` |
| `await page.waitForTimeout(1000)` | `{"action": "wait", "milliseconds": 1000}` |

### 5.4 调用 MCP 工具

使用 `mcp__ui-test-automation__ui_web_validation_submit` 工具：

```
调用工具并传入上述 JSON 参数，获取返回的 runId
```

## 6. 轮询测试状态

使用 `mcp__ui-test-automation__ui_web_validation_status` 工具：

```json
{
  "runId": 14
}
```

每隔 10-15 秒查询一次，直到状态为 `SUCCESS` 或 `FAILED`。

返回结果包含：
- 测试状态（运行中/成功/失败）
- 功能测试结果（每个场景的通过/失败状态）
- 截图 URL 列表
- 测试日志和追踪信息

## 7. 获取 Figma 设计稿截图

使用 `mcp__figma__download_assets` 工具：

```json
{
  "fileKey": "abc123def456",
  "nodeId": "123:456"
}
```

返回结果包含：
- 导出的设计稿图片（PNG 格式）
- 图片 URL

## 8. 视觉对比分析

### 8.1 对比维度

| 维度 | 检查点 | 权重 |
|---|---|---|
| **布局** | 元素位置、大小、间距、对齐 | 高 |
| **颜色** | 背景色、文字色、边框色、阴影 | 高 |
| **字体** | 字号、字重、行高、字体族 | 高 |
| **组件** | UI 组件库使用正确性 | 高 |
| **交互状态** | hover、disabled、active、focus | 中 |
| **图标** | 图标显示、尺寸、颜色 | 中 |
| **圆角边框** | border-radius、border-width | 中 |
| **阴影效果** | box-shadow 参数 | 低 |

### 8.2 差异分类

**必须修复的差异**：
- 布局错位（元素位置偏移 > 5px）
- 尺寸错误（宽高差异 > 10%）
- 颜色不匹配（RGB 差异 > 10）
- 字体错误（字号、字重明显不同）
- 未使用 UI 组件库（用了原生 HTML）
- 间距错误（padding/margin 差异 > 4px）

**可接受的差异**：
- 动态内容（时间戳、用户名、订单号等）
- 随机数据（头像、金额、数量等测试数据）
- 第三方内容（广告、地图、嵌入组件）
- 浏览器渲染差异（字体反锯齿、子像素差异）
- 设计稿与需求不符（以实现为准，需记录原因）

**需要讨论的差异**：
- 设计稿不完整（缺少某些状态的设计）
- 交互设计变更（产品确认过的调整）
- 技术限制（某些效果难以实现）

### 8.3 差异率计算

```
差异率 = (差异像素数 / 总像素数) × 100%

通过标准：
- 差异率 < 1%：完全通过
- 1% <= 差异率 < 5%：需说明原因
- 差异率 >= 5%：未通过，必须修复
```

## 9. 修复流程

### 9.1 根据差异类型修复

**布局问题**：
```css
/* 检查 flexbox/grid 布局参数 */
.container {
  display: flex;
  gap: 16px; /* 间距是否正确 */
  padding: 24px; /* 内边距是否正确 */
}
```

**颜色问题**：
```css
/* 使用设计 token */
.title {
  color: var(--color-text-primary); /* 不要硬编码颜色 */
  background: var(--color-bg-base);
}
```

**字体问题**：
```css
.heading {
  font-size: 24px; /* 检查字号 */
  font-weight: 600; /* 检查字重 */
  line-height: 32px; /* 检查行高 */
}
```

**组件使用问题**：
```vue
<!-- 错误：用原生 HTML -->
<button class="btn">提交</button>

<!-- 正确：使用 UI 组件库 -->
<el-button type="primary">提交</el-button>
```

### 9.2 修复验证循环

```
1. 修复代码
2. 本地验证样式
3. git commit
4. 调用 UI Test MCP（回到第 5 步）
5. 重新对比
6. 判断是否通过

最多重试 3 次，超过则标记阻塞需人工介入
```

## 10. 记录和归档

### 10.1 保存对比截图

```bash
# 创建视觉验证目录
mkdir -p docs/visual-validation/change-001

# 保存截图
docs/visual-validation/change-001/
├── order-list-actual.png       # 实际截图
├── order-list-design.png       # 设计稿
├── order-list-diff.png         # 差异对比图（可选）
└── report.md                   # 对比报告
```

### 10.2 编写对比报告

```markdown
# 视觉验证报告 - change-001

## 基本信息
- Change ID: change-001
- 验证日期: 2026-07-11
- 验证人: Agent
- Figma 设计稿: https://figma.com/file/abc123/...

## 验证结果

### 订单列表页

- **Figma 节点**: 123:456
- **实际截图**: order-list-actual.png
- **差异率**: 0.8%
- **结论**: ✅ 通过

#### 主要差异
1. 用户头像（测试数据，合理差异）
2. 订单号（随机生成，合理差异）

#### 修复记录
无需修复

### 订单详情页

- **Figma 节点**: 789:012
- **实际截图**: order-detail-actual.png
- **差异率**: 3.2%
- **结论**: ❌ 未通过（第 1 次）

#### 主要差异
1. 标题字号错误：实际 20px，设计 24px
2. 卡片间距错误：实际 12px，设计 16px
3. 按钮颜色错误：实际 #1890ff，设计 #0066FF

#### 修复记录
- 修复 1: 调整标题字号为 24px
- 修复 2: 调整卡片间距为 16px
- 修复 3: 使用设计 token --color-primary
- 第 2 次验证差异率: 0.6% ✅ 通过

## 总结

- 需要验证的页面数: 2
- 通过数: 2
- 未通过数: 0
- 修复轮次: 2
```

### 10.3 更新工作总结

在 `docs/work-summary/【任务名称】-工作总结.md` 中添加视觉验证结果。

## 11. 常见问题

### Q1: MCP 调用超时怎么办？

增加超时时间，或者分批执行测试：
```json
{
  "validationConfig": {
    "timeoutSeconds": 1200  // 增加到 20 分钟
  }
}
```

### Q2: 截图中有动态内容导致差异率高怎么办？

标注为合理差异并记录原因：
```markdown
#### 合理差异说明
1. 时间戳：当前时间 vs 设计稿固定时间
2. 用户数据：测试账号 vs 设计稿示例数据
3. 随机 ID：系统生成 vs 设计稿示例 ID
```

### Q3: UI Test 平台测试失败但本地通过？

检查环境差异：
- 登录态注入是否正确
- Mock 数据是否正确
- 网络环境是否可达
- 浏览器版本差异

### Q4: Figma 设计稿更新了怎么办？

重新记录 Figma Node ID：
- 打开最新设计稿
- 获取新的 Node ID
- 更新 design.md
- 重新执行视觉验证

### Q5: 差异率计算不准确？

可能原因：
- 视口尺寸不一致
- 字体渲染差异
- 浏览器缩放比例

解决：
- 确保截图使用相同视口尺寸
- 使用 `deviceScaleFactor: 1` 避免缩放
- 对比时排除已知的动态区域

## 12. 最佳实践总结

✅ **DO（推荐做法）**：
- 在 proposal 阶段就规划好哪些用例需要视觉验证
- 及早获取 Figma 设计稿信息，避免后期返工
- 截图命名规范，便于管理和对比
- 详细记录合理差异，避免重复检查
- 保存对比报告，便于后续审计

❌ **DON'T（避免做法）**：
- 不要在没有设计稿的情况下启用视觉验证
- 不要忽略小的差异（积少成多）
- 不要修改测试代码来"通过"视觉验证
- 不要用原生 HTML 偷懒替代 UI 组件库
- 不要在视觉验证未通过的情况下标记为 GREEN

## 13. 工具链接

- UI Test Automation MCP 文档: `/Users/weidian/projects/code-agent/docs/ui-test-automation-mcp.md`
- Figma MCP 官方文档: https://developers.figma.com/docs/figma-mcp-server/
- Playwright 文档: https://playwright.dev/
