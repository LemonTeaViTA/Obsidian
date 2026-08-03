# 前端展示侧 (ai-program-factory) 学习指南

> React 19 + TypeScript + React Router 7 + TanStack Query  
> 负责：用户界面、任务创建、实时通信、审批操作

> [!tip] 2026-08 当前变化
> 首页已改为个人工作台，Custom Agent 实时接收以 GMS 为主；审批角色状态、产物历史和最新模板开关已形成新的交互闭环。先读 [[03-参考手册/03-前端展示侧/02-核心功能/个人工作台与审批产物闭环|个人工作台与审批产物闭环]]。

---

## 📚 学习路线

### 快速入门（1-2天）

```
第1天：项目架构与技术栈
  ├─ 01-项目架构/前端技术栈详解.md
  ├─ 01-项目架构/目录结构详解.md
  └─ 01-项目架构/环境配置.md

第2天：核心功能
  ├─ 02-核心功能/任务创建流程.md
  ├─ 02-核心功能/任务列表与筛选.md
  ├─ 02-核心功能/WebSocket实时通信.md
  └─ 02-核心功能/个人工作台与审批产物闭环.md
```

### 深入掌握（3-5天）

```
第3-4天：组件设计
  ├─ 03-组件设计/通用组件库.md
  ├─ 03-组件设计/业务组件设计.md
  └─ 03-组件设计/状态管理.md

第5天：API集成
  ├─ 04-API集成/API封装与调用.md
  ├─ 04-API集成/错误处理.md
  └─ 04-API集成/环境配置详解.md
```

---

## 🎯 核心概念

### 技术栈

```
├─ React 19 (UI框架)
├─ TypeScript (类型安全)
├─ React Router 7 (路由管理)
├─ TanStack Query (数据请求与缓存)
├─ Zustand (状态管理)
├─ Tailwind CSS (样式)
├─ Socket.IO (WebSocket实时通信)
└─ Vite (构建工具)
```

### 任务创建流程

```
用户填写表单
    ↓
├─ flowType: backend/frontend_common/frontend_logic
├─ depUrl: DEP需求单地址
├─ templateId: 工作流模板ID
└─ model: AI模型选择
    ↓
POST /api/taskInfo/create
    ↓
获取 taskId
    ↓
跳转到 /conversations/{taskId}
```

### GMS / WebSocket 实时通信

```
Custom Agent 前端订阅
    ↓ GMS SDK（VITE_GMS_WS_URL）
接收 ai24 业务消息
    ↓
发送用户输入时走 HTTP /api/task/query
    ↓
更新 UI
```

仓库仍保留 V0 Socket.IO、V1 原生 WebSocket 和 Custom Agent / GMS 三套 Provider。排障前必须先确认当前会话版本，不能把某一套 URL 当作全局唯一链路。

---

## 📂 目录结构

```
ai-program-factory/
├── src/
│   ├── api/                      # API 调用
│   │   ├── task-service/         # 任务相关API
│   │   ├── conversation-service/ # 对话相关API
│   │   └── approval-service/     # 审批相关API
│   ├── components/               # 组件
│   │   ├── features/             # 业务组件
│   │   │   ├── home/             # 首页相关
│   │   │   │   └── simple-task-form.tsx ⭐ 任务创建表单
│   │   │   └── conversation-panel/ # 对话面板
│   │   ├── ui/                   # 通用UI组件
│   │   └── layout/               # 布局组件
│   ├── routes/                   # 路由页面
│   │   ├── home.tsx              ⭐ 首页
│   │   ├── tasks.tsx             ⭐ 任务列表
│   │   ├── conversation.tsx      ⭐ 对话页
│   │   └── workflow-manage.tsx   # 工作流管理
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── mutation/             # 修改操作
│   │   └── query/                # 查询操作
│   ├── stores/                   # Zustand 状态管理
│   ├── contexts/                 # React Context
│   ├── constants/                # 常量定义
│   │   ├── task-constants.ts    ⭐ 任务类型/状态
│   │   └── workflow-constants.ts ⭐ 工作流配置
│   ├── types/                    # TypeScript 类型
│   └── utils/                    # 工具函数
├── public/                       # 静态资源
├── __tests__/                    # 测试文件
├── .env.daily                    # 日常环境配置
├── .env.pre                      # 预发环境配置
├── .env.prod                     # 生产环境配置
└── package.json                  # 依赖配置
```

---

## 🔗 关联文档

### 跨系统理解

- [端到端流程追踪](../04-完整链路实战/端到端流程追踪.md) - 前端在整个系统中的位置
- [ai24 任务管理](../01-平台管理侧/README.md) - 后端 API 接口
- [code-agent 执行](../02-Agent执行侧/00-导航/README.md) - Agent 如何执行任务

### API 对接

- [API 映射文档](./04-API集成/API封装与调用.md) - 前后端接口对接
- [WebSocket 通信](./02-核心功能/WebSocket实时通信.md) - 实时消息推送
- [个人工作台与审批产物闭环](./02-核心功能/个人工作台与审批产物闭环.md) - 首页、角色审批、产物版本和模板策略

---

## ✅ 学习检验

完成学习后，你应该能回答：

**基础架构**
- [ ] 前端使用了哪些核心技术？各自的作用？
- [ ] 项目的目录结构是怎样的？
- [ ] 如何配置不同环境（日常/预发/生产）？

**任务创建**
- [ ] 用户如何创建一个新任务？
- [ ] 任务创建表单有哪些字段？
- [ ] flowType、depUrl、templateId 分别是什么？
- [ ] 创建任务后如何跳转到对话页？

**WebSocket 通信**
- [ ] WebSocket 连接的 URL 是什么？
- [ ] 前端如何订阅实时消息？
- [ ] 收到消息后如何更新 UI？
- [ ] 如何处理连接断开和重连？

**状态管理**
- [ ] 使用了哪些状态管理方案？
- [ ] Zustand store 和 React Query 的区别？
- [ ] 如何在组件间共享状态？

---

## 🛠️ 开发环境

### 安装依赖

```bash
cd /Users/dingshouqin/projects/ai-program-factory
npm install
```

### 启动开发服务器

```bash
# 日常环境
npm run dev:daily

# 预发环境
npm run dev:pre

# 生产环境
npm run dev:prod

# 本地Mock模式
npm run dev:mock
```

### 构建生产版本

```bash
# 日常环境
npm run build:daily

# 预发环境
npm run build:pre

# 生产环境
npm run build:prod
```

---

## 🎨 核心功能说明

### 1. 任务创建

**位置**：`src/components/features/home/simple-task-form.tsx`

**流程**：
1. 用户选择任务类型（backend/frontend_common/frontend_logic）
2. 填写 DEP 地址（必填）
3. 选择工作流模板
4. 选择 AI 模型
5. 提交创建任务

### 2. 任务列表

**位置**：`src/routes/tasks.tsx`

**功能**：
- 显示所有任务
- 筛选（按状态、类型、时间）
- 搜索（按任务名、ID）
- 分页

### 3. 实时对话

**位置**：`src/routes/conversation.tsx`

**功能**：
- 显示任务执行日志
- 实时接收 Agent 消息
- 用户发送指令
- 查看代码变更
- 审批操作

### 4. 工作流管理

**位置**：`src/routes/workflow-manage.tsx`

**功能**：
- 查看工作流列表
- 创建/编辑工作流
- 配置阶段和约束
- 工作流模板管理

---

## 📊 关键数据流

### 任务创建数据流

```
SimpleTaskForm
    ↓ (用户填写)
FormData {
  flowType: string,
  depUrl: string,
  templateId: string
}
    ↓ (组装请求)
{
  input: JSON.stringify({
    flowType,
    depUrl,
    templateId,
    model: "claude-opus-4-8"
  }),
  status: 100,
  username: currentUser
}
    ↓ (API调用)
POST /api/taskInfo/create
    ↓ (响应)
{ taskId: "T001" }
    ↓ (路由跳转)
/conversations/T001
```

### WebSocket 消息流

```
WebSocket Server
    ↓ (推送消息)
{
  type: "TASK_STATUS_UPDATE",
  taskId: "T001",
  status: 200,
  message: "技术方案已生成"
}
    ↓ (Context处理)
CustomAgentWebSocketContext
    ↓ (存储到Store)
EventStore
    ↓ (组件订阅)
ConversationPanel
    ↓ (UI更新)
显示新消息
```

---

## 💡 学习建议

1. **从使用开始**：先启动项目，创建一个任务，体验完整流程
2. **理解数据流**：追踪一个任务从创建到完成的完整数据流
3. **阅读核心组件**：重点阅读 SimpleTaskForm、ConversationPanel
4. **理解状态管理**：学习 Zustand 和 TanStack Query 的使用
5. **调试 WebSocket**：打开浏览器 DevTools，查看 WebSocket 消息

---

## 🐛 常见问题

### Q1: 如何切换环境？

**A**: 使用不同的启动命令
```bash
npm run dev:daily   # 日常环境
npm run dev:pre     # 预发环境
npm run dev:prod    # 生产环境
```

### Q2: WebSocket 连接不上？

**A**: 检查以下几点
1. 确认 `.env.*` 文件中的 WebSocket URL 正确
2. 查看浏览器 Console 是否有错误
3. 确认后端 WebSocket 服务已启动
4. 检查网络和防火墙设置

### Q3: 如何调试 API 调用？

**A**: 
1. 打开浏览器 DevTools → Network 标签
2. 筛选 XHR 请求
3. 查看请求和响应详情
4. 使用 `console.log` 在代码中打印

### Q4: 如何添加新的路由页面？

**A**: 
1. 在 `src/routes/` 下创建新文件
2. 在 `src/routes.ts` 中注册路由
3. 添加导航链接

---

**开始学习前端开发吧！** 🚀
