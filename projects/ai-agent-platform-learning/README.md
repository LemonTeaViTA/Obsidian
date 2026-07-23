# AI Agent 平台完整学习体系

> 更新时间：2026-07-22  
> 涵盖：ai24 平台管理侧 + code-agent 执行侧 + ai-program-factory 前端侧  
> 共 95+ 篇文档，完整覆盖 AI Agent 开发平台的全栈技术

---

## 📚 体系概览

这套学习资料整合了三个项目的文档，帮助你全面理解一个完整的 AI Agent 平台是如何运作的：

```
┌─────────────────────────────────────────────────────────┐
│                    前端展示层                             │
│         ai-program-factory (React + TypeScript)          │
│  用户创建任务、查看进度、审批、查看产物                    │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTP API + WebSocket
┌─────────────────┴��──────────────────────────────────────┐
│                  平台管理侧                               │
│              ai24 (Spring Boot + Java)                   │
│  任务管理、工作流配置、审批流程、数据持久化                │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTP API (RESTful)
┌─────────────────┴───────────────────────────────────────┐
│                  Agent 执行侧                             │
│           code-agent (Python + Claude SDK)               │
│  任务执行、代码生成、MCP 工具调用、状态上报                │
└─────────────────────────────────────────────────────────┘
```

---

## 🗺️ 学习路线图

### 路线A：快速理解（3-5天）

适合：快速了解整个系统如何工作

```
第1天：系统全景
  └─ 00-导航与入门/系统全景图.md
  └─ 00-导航与入门/快速上手指南.md

第2天：完整链路追踪
  └─ 04-完整链路实战/端到端流程追踪.md

第3天：三大核心组件
  ├─ 01-平台管理侧(ai24)/任务生命周期/任务创建与存储.md
  ├─ 02-Agent执行侧(code-agent)/业务流程/main核心业务流程详解.md
  └─ 03-前端展示侧(ai-program-factory)/前端架构.md
```

### 路线B：平台管理侧深入（7-10天）

适合：理解 Java 后端、Spring Boot、工作流设计

```
第1-2天：Spring Boot 分层架构
  ├─ ai24-lesson-02-database-layer.md (持久层)
  ├─ ai24-stage3-business-layer.md (业务层)
  └─ ai24-stage4-controller-layer.md (接口层)

第3-4天：完整链路与参数
  ├─ ai24-stage5-full-flow.md (八站链路)
  └─ ai24-stage6-input-fields.md (input五要素)

第5天：数据库设计
  └─ ai24-stage7-database-schema.md (42张表)

第6-7天：工作流与审批 ⭐核心⭐
  └─ ai24-stage8-workflow-approval.md
      ├─ spec_workflow 三层结构
      ├─ 阶段接力机制
      ├─ 审批通过/驳回策略
      └─ 编排流水版本化
```

### 路线C：Agent 执行侧深入（7-10天）

适合：理解 AI Agent 如何执行任务、调用工具、上报状态

```
第1天：架构与启动
  ├─ 01-架构与启动/项目概览.md
  ├─ 01-架构与启动/ClaudeSDK核心逻辑.md
  └─ 01-架构与启动/启动流程走读.md

第2-3天：核心业务流程
  ├─ 03-业务流程/main核心业务流程详解.md
  ├─ 03-业务流程/Claude执行任务的完整流程.md
  └─ 03-业务流程/service.query内部实现详解.md

第4-5天：消息与通信
  ├─ 04-消息与通信/Claude-SDK消息类型完全解析.md
  ├─ 04-消息与通信/消息上报系统详解.md
  ├─ 04-消息与通信/MCP服务配置详解.md
  └─ 04-消息与通信/MCP服务深度解析.md

第6-7天：扩展机制
  ├─ 05-扩展机制/Hook系统详解.md
  ├─ 05-扩展机制/环境恢复机制详解.md
  └─ 05-扩展机制/任务异常处理与中断机制.md
```

### 路线D：全栈工程师路线（14-21天）

适合：希望掌握完整技术栈的工程师

按顺序学习：
1. 路线A（快速理解）
2. 路线B（平台管理侧）
3. 路线C（Agent 执行侧）
4. 前端展示侧文档
5. 完整链路实战案例

---

## 📂 目录结构

```
ai-agent-platform-learning/
├── 00-导航与入门/
│   ├── README.md (本文件)
│   ├── 系统全景图.md
│   ├── 快速上手指南.md
│   └── 技术栈总览.md
│
├── 01-平台管理侧(ai24-Java)/
│   ├── README.md (ai24 学习路线)
│   ├── 01-架构与分层/
│   │   ├── Spring Boot分层架构.md
│   │   ├── 数据库设计(42张表).md
│   │   └── 并发模型与无状态设计.md
│   ├── 02-任务生命周期/
│   │   ├── 任务创建与存储.md
│   │   ├── 任务下发与回调.md
│   │   ├── input参数五要素详解.md
│   │   └── 任务状态机.md
│   ├── 03-工作流与审批/ ⭐核心⭐
│   │   ├── 工作流三层结构(spec_workflow-spec_stage-spec_convention).md
│   │   ├── 审批流程详解(策略模式).md
│   │   ├── 阶段接力机制.md
│   │   ├── 编排流水版本化.md
│   │   └── 系统模板分析/
│   │       ├── 01-前端/
│   │       ├── 02-客户端/
│   │       └── 03-后端/
│   └── 04-原始文档/ (保留 ai24-learning-notes 原始文档)
│
├── 02-Agent执行侧(code-agent-Python)/
│   ├── README.md (code-agent 学习路线)
│   ├── 00-导航/
│   ├── 01-架构与启动/
│   ├── 02-数据层/
│   ├── 03-业务流程/
│   ├── 04-消息与通信/
│   ├── 05-扩展机制/
│   ├── 06-面试与简历/
│   └── 99-归档/
│
├── 03-前端展示侧(ai-program-factory-React)/
│   ├── README.md (前端学习路线)
│   ├── 01-项目架构/
│   │   ├── 前端技术栈.md
│   │   ├── 目录结构详解.md
│   │   └── React Router配置.md
│   ├── 02-核心功能/
│   │   ├── 任务创建流程.md
│   │   ├── WebSocket实时通信.md
│   │   ├── 任务列表与筛选.md
│   │   └── 审批流程前端实现.md
│   ├── 03-组件设计/
│   │   ├── 通用组件库.md
│   │   ├── 业务组件设计.md
│   │   └── 状态管理.md
│   └── 04-API集成/
│       ├── API封装与调用.md
│       ├── 环境配置(.env).md
│       └── ��误处理.md
│
├── 04-完整链路实战/
│   ├── 端到端流程追踪.md
│   ├── 消息流转图.md
│   ├── 调试技巧.md
│   └── 常见问题排查.md
│
└── 99-归档/
    ├── ai24-原始文档/
    └── code-agent-原始文档/
```

---

## 🎯 核心概念索引

### 平台管理侧 (ai24)

| 概念 | 说明 | 参考文档 |
|------|------|---------|
| **工作流三层结构** | spec_workflow → spec_stage → spec_convention | ai24-stage8 |
| **阶段接力** | 审批通过后创建下一阶段任务 | ai24-stage8 |
| **审批策略** | DomainDivideApprovalStrategy / AppSplitApprovalStrategy | ai24-stage8 |
| **input 五要素** | depUrl, flowType, templateId, model, testerName | ai24-stage6 |
| **任务状态机** | 0(初始) → 100(初始化) → 500(完成) | ai24-stage5 |
| **编排流水** | requirement_flow / task_flow / orchestration | ai24-stage8 |
| **并发模型** | 单例 + 无状态 = 天然线程安全 | ai24-stage5 |

### Agent 执行侧 (code-agent)

| 概念 | 说明 | 参考文档 |
|------|------|---------|
| **main.py 核心流程** | TaskPerformResource / TaskQueryResource | main核心业务流程详解 |
| **Claude SDK** | service.query() / resume() | ClaudeSDK核心逻辑 |
| **Hook 系统** | PreToolUse / PostToolUse / Stop | Hook系统详解 |
| **MCP 工具** | JSON-RPC 2.0 通信协议 | MCP服务深度解析 |
| **消息上报** | message_reporter / 流式推送 | 消息上报系统详解 |
| **环境恢复** | COS 备份 / Git 恢复 | 环境恢复机制详解 |
| **MetaContainer** | 任务元数据管理 | MetaContainer深度解析 |

### 前端展示侧 (ai-program-factory)

| 概念 | 说明 | 参考文档 |
|------|------|---------|
| **WebSocket** | 实时任务状态推送 | WebSocket实时通信 |
| **任务创建** | 表单 → input JSON → API 调用 | 任务创建流程 |
| **审批界面** | 审批项展示、通过/拒绝操作 | 审批流程前端实现 |
| **环境切换** | .env.daily / .env.pre / .env.prod | 环境配置 |

---

## 🔗 三方交互关系

### 任务创建流程

```
用户在前端点击"创建任务"
  ↓ POST /api/taskInfo/create
ai24 接收请求
  ├─ 参数校验
  ├─ 权限检查
  ├─ 入口规则拦截 (PRD 自动迭代)
  └─ 存库 (task_info, status=0)
  ↓ POST /task/perform
code-agent 接收任务
  ├─ 同步知识库
  ├─ 解析 depUrl
  ├─ 初始化环境
  └─ 执行 init-project Skill
  ↓ POST /api/task/notify/taskStatus (status=100)
ai24 更新任务状态
  ↓ WebSocket 推送
前端实时更新进度条
```

### 审批流程

```
code-agent 完成某阶段
  ↓ POST /api/approval/create
ai24 创建审批项 (approval_item, status=PENDING)
  ↓ WebSocket 通知
前端展示审批卡片
  ↓ 产品点击"通过"或"拒绝"
  ↓ POST /api/approval/approve 或 /reject
ai24 更新审批状态
  ├─ 全部通过 → ApprovalStrategy.onAllApproved()
  │   └─ 创建下一阶段任务
  └─ 存在拒绝 → ApprovalStrategy.onSomeRejected()
      └─ queryTask 打回 code-agent
```

---

## 🛠️ 技术栈总览

| 层级 | 技术栈 | 用途 |
|------|--------|------|
| **前端** | React 18 + TypeScript + Vite | UI 展示与交互 |
| | React Router 7 | 路由管理 |
| | TanStack Query | 数据请求与缓存 |
| | Tailwind CSS | 样式 |
| | WebSocket | 实时通信 |
| **平台管理** | Spring Boot 2.7.2 + Java 11 | 后端框架 |
| | MyBatis Plus 3.5.2 | ORM |
| | MySQL | 数据库 |
| | Redis Cluster | 缓存 |
| | Dubbo 2.8.8 | RPC |
| **Agent 执行** | Python 3.9+ | 执行环境 |
| | Flask | HTTP 服务器 |
| | Claude SDK | AI 调用 |
| | MCP (Model Context Protocol) | 工具调用协议 |
| | LangFuse | 可观测性 |

---

## 📖 使用建议

### 新手入门

1. **先看全景图**：理解三个系统如何协作
2. **跟踪一个完整请求**：从前端点击到任务完成
3. **选择一个方向深入**：前端/后端/AI Agent

### 面试准备

重点阅读：
- 工作流与审批流程 (ai24-stage8)
- Hook 系统与 MCP 工具 (code-agent)
- 完整链路追踪 (跨系统理解)
- 面试与简历目录下的所有文档

### 项目开发

- 需要改前端：先看 03-前端展示侧
- 需要改后端业务：先看 01-平台管理侧
- 需要改 Agent 执行逻辑：先看 02-Agent执行侧
- 需要排查问题：先看 04-完整链路实战

---

## ✅ 学习检验清单

完成学习后，你应该能回答：

**系统理解**
- [ ] 三个系统之间如何通信？各自的职责是什么？
- [ ] 一个任务从创建到完成经历了哪些阶段？
- [ ] 审批流程如何工作？审批通过后发生了什么？

**平台管理侧 (ai24)**
- [ ] Spring Boot 的分层架构是什么？
- [ ] 工作流三层结构是什么？如何配置？
- [ ] 阶段接力机制如何实现？
- [ ] 审批策略模式如何设计？
- [ ] 编排流水如何版本化？

**Agent 执行侧 (code-agent)**
- [ ] main.py 的核心流程是什么？
- [ ] Claude SDK 如何调用？
- [ ] Hook 系统如何扩展 Agent 行为？
- [ ] MCP 工具调用协议是什么？
- [ ] 消息如何上报给 ai24？

**前端展示侧 (ai-program-factory)**
- [ ] 如何创建一个任务？
- [ ] WebSocket 如何实现实时通信？
- [ ] 审批界面如何实现？

---

## 🎓 贡献指南

如果你发现文档有误或需要补充，欢迎：
1. 提出问题
2. 补充内容
3. 改进示例

---

**🎉 开始你的学习之旅吧！**
