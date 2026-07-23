# 学习文档合并计划

> 创建时间：2026-07-22  
> 目标：将 ai24-learning-notes 和 code-agent-learning 合并为统一的学习体系

---

## 📊 当前状态

### 源目录

| 目录 | 文档数 | 内容 | 状态 |
|------|--------|------|------|
| `ai24-learning-notes` | 30篇 | Java 后端、工作流、审批 | ✅ stage8 已补充 |
| `code-agent-learning` | 65篇 | Python Agent、Hook、MCP | ✅ 内容完整 |
| **合计** | **95篇** | 完整的 AI Agent 平台文档 | |

### 目标目录

```
ai-agent-platform-learning/
├── 00-导航与入门/
├── 01-平台管理侧(ai24-Java)/
├── 02-Agent执行侧(code-agent-Python)/
├── 03-前端展示侧(ai-program-factory-React)/
├── 04-完整链路实战/
└── 99-归档/
```

---

## 🎯 合并策略

### 原则

1. **保留原始文档**：将原始文档移动到 `99-归档/` 目录，保持可追溯性
2. **消除重复**：合并重复或相似的内容
3. **建立索引**：创建跨系统的索引和导航
4. **补充空白**：补充前端侧文档（基于 ai-program-factory 项目）

### 不合并的内容

以下内容**保持独立**，因为它们属于不同的视角：
- ai24-stage5（Java 侧的完整链路）
- code-agent main核心业务流程详解（Python 侧的完整链路）
- 原因：虽然描述同一个流程，但一个是 Java 视角，一个是 Python 视角，合并会丢失细节

---

## 📋 详细合并计划

### 第一步：创建目录结构

```bash
mkdir -p ai-agent-platform-learning/{00-导航与入门,01-平台管理侧,02-Agent执行侧,03-前端展示侧,04-完整链路实战,99-归档}
mkdir -p ai-agent-platform-learning/01-平台管理侧/{01-架构与分层,02-任务生命周期,03-工作流与审批,04-原始文档}
mkdir -p ai-agent-platform-learning/03-前端展示侧/{01-项目架构,02-核心功能,03-组件设计,04-API集成}
mkdir -p ai-agent-platform-learning/99-归档/{ai24-原始文档,code-agent-原始文档}
```

### 第二步：ai24-learning-notes 处理

#### 2.1 需要合并的文档

| 原文档 | 新位置 | 操作 |
|--------|--------|------|
| `ai24-lesson-02-database-layer.md` + `ai24-stage2-practice.md` | `01-平台管理侧/01-架构与分层/Spring Boot持久层完整指南.md` | **合并** |
| `ai24-stage3-business-layer.md` | `01-平台管理侧/01-架构与分层/Spring Boot业务层详解.md` | 移动 |
| `ai24-stage4-controller-layer.md` | `01-平台管理侧/01-架构与分层/Spring Boot接口层详解.md` | 移动 |
| `ai24-stage5-full-flow.md` | `01-平台管理侧/02-任务生命周期/完整八站链路(Java视角).md` | 移动 |
| `ai24-stage6-input-fields.md` | `01-平台管理侧/02-任务生命周期/input参数五要素详解.md` | 移动 |
| `ai24-stage7-database-schema.md` | `01-平台管理侧/01-架构与分层/数据库设计(42张表).md` | 移动 |
| `ai24-stage8-workflow-approval.md` | `01-平台管理侧/03-工作流与审批/工作流与审批完整指南.md` | 移动 |
| `ai24-project-learning-guide.md` | `01-平台管理侧/README.md` | 改造为导航 |
| `工作流/` 目录 | `01-平台管理侧/03-工作流与审批/系统模板分析/` | 移动 |

#### 2.2 原始文档归档

```bash
# 将所有原始文档复制到归档目录
cp -r ai24-learning-notes/* ai-agent-platform-learning/99-归档/ai24-原始文档/
```

### 第三步：code-agent-learning 处理

#### 3.1 直接移动（保持结构）

```bash
# code-agent-learning 的结构已经很好，直接移动
cp -r code-agent-learning/* ai-agent-platform-learning/02-Agent执行侧/
```

#### 3.2 更新内部链接

需要更新的引用：
- 所有指向 `../` 的相对路径
- 文档间的交叉引用

### 第四步：补充前端文档

基于 `ai-program-factory` 项目创建前端文档：

| 新文档 | 内容来源 |
|--------|---------|
| `前端技术栈.md` | package.json + README.md |
| `目录结构详解.md` | src/ 目录分析 |
| `任务创建流程.md` | 创建任务相关组件分析 |
| `WebSocket实时通信.md` | WebSocket 相关代码分析 |
| `API封装与调用.md` | API 层代码分析 |
| `环境配置.md` | .env 文件分析 |

### 第五步：创建跨系统文档

#### 5.1 端到端流程追踪

合并以下内容：
- `ai24-stage5-full-flow.md` (Java 侧)
- `code-agent main核心业务流程详解.md` (Python 侧)
- `ai24-codeagent-full-flow-diagram.md` (流程图)

**新文档**：`04-完整链路实战/端到端流程追踪.md`

结构：
```markdown
# 端到端流程追踪

## 一、全景图（三个系统）

## 二、站点1：前端发起（React）

## 三、站点2-5：ai24 处理（Java）

## 四、站点6-7：code-agent 执行（Python）

## 五、站点8：状态回调与前端更新
```

#### 5.2 消息流转图

新文档：`04-完整链路实战/消息流转图.md`

整合：
- HTTP API 调用
- WebSocket 推送
- MQ 消息
- 回调机制

### 第六步：创建导航索引

#### 6.1 总导航

`00-导航与入门/README.md` - 已创建

#### 6.2 各子系统导航

- `01-平台管理侧/README.md` - ai24 学习路线
- `02-Agent执行侧/README.md` - code-agent 学习路线（保留原有）
- `03-前端展示侧/README.md` - 前端学习路线（新建）

---

## 🔧 执行步骤

### 步骤1：创建目录结构（已完成）

```bash
mkdir -p ai-agent-platform-learning/...
```

### 步骤2：合并重复文档

#### lesson-02 + stage2-practice 合并

```bash
# 创建合并后的文档
cat ai24-learning-notes/ai24-lesson-02-database-layer.md \
    ai24-learning-notes/ai24-stage2-practice.md \
    > ai-agent-platform-learning/01-平台管理侧/01-架构与分层/Spring Boot持久层完整指南.md
```

**合并策略**：
- 保留 lesson-02 的系统讲解
- 将 stage2-practice 作为"实战练习"章节附加
- 添加章节：`## 实战练习：TaskInfoDO 字段详解`

### 步骤3：移动单个文档

```bash
# ai24 文档
cp ai24-learning-notes/ai24-stage3-business-layer.md \
   ai-agent-platform-learning/01-平台管理侧/01-架构与分层/Spring Boot业务层详解.md

cp ai24-learning-notes/ai24-stage4-controller-layer.md \
   ai-agent-platform-learning/01-平台管理侧/01-架构与分层/Spring Boot接口层详解.md

# ... 其他文档
```

### 步骤4：移动 code-agent 文档

```bash
cp -r code-agent-learning/* ai-agent-platform-learning/02-Agent执行侧/
```

### 步骤5：创建跨系统文档

手动创建以下文档：
- [ ] `04-完整链路实战/端到端流程追踪.md`
- [ ] `04-完整链路实战/消息流转图.md`
- [ ] `04-完整链路实战/调试技巧.md`

### 步骤6：补充前端文档

基于 ai-program-factory 项目创建：
- [ ] `03-前端展示侧/01-项目架构/前端技术栈.md`
- [ ] `03-前端展示侧/02-核心功能/任务创建流程.md`
- [ ] `03-前端展示侧/02-核心功能/WebSocket实时通信.md`
- [ ] `03-前端展示侧/04-API集成/API封装与调用.md`

### 步骤7：更新所有 README

- [ ] 更新总 README
- [ ] 创建各子系统 README
- [ ] 更新内部链接

### 步骤8：归档原始文档

```bash
cp -r ai24-learning-notes ai-agent-platform-learning/99-归档/ai24-原始文档
cp -r code-agent-learning ai-agent-platform-learning/99-归档/code-agent-原始文档
```

---

## 📝 文档重命名映射表

### ai24-learning-notes 重命名

| 原文件名 | 新文件名 |
|---------|---------|
| `ai24-lesson-02-database-layer.md` + `ai24-stage2-practice.md` | `Spring Boot持久层完整指南.md` |
| `ai24-stage3-business-layer.md` | `Spring Boot业务层详解.md` |
| `ai24-stage4-controller-layer.md` | `Spring Boot接口层详解.md` |
| `ai24-stage5-full-flow.md` | `完整八站链路(Java视角).md` |
| `ai24-stage6-input-fields.md` | `input参数五要素详解.md` |
| `ai24-stage7-database-schema.md` | `数据库设计(42张表).md` |
| `ai24-stage8-workflow-approval.md` | `工作流与审批完整指南.md` |
| `ai24-project-learning-guide.md` | `README.md` (改造) |
| `ai24-codeagent-full-flow-diagram.md` | 合并到 `端到端流程追踪.md` |

### code-agent-learning 保持不变

code-agent-learning 的文档结构已经很好，保持原有文件名和目录结构。

---

## ✅ 完成标准

合并完成后应达到：

### 功能完整性
- [ ] 三个系统的文档都已整合
- [ ] 跨系统的流程文档已创建
- [ ] 前端文档已补充

### 内容质量
- [ ] 重复内容已合并
- [ ] 内部链接已更新
- [ ] 所有文档格式统一

### 可用性
- [ ] 总导航清晰
- [ ] 各子系统导航完善
- [ ] 学习路线明确
- [ ] 概念索引可用

### 可追溯性
- [ ] 原始文档已归档
- [ ] 保留版本历史
- [ ] 更新记录完整

---

## 🚀 下一步

合并完成后：

1. **验证文档**：检查所有链接是否有效
2. **补充示例**：添加更多代码示例和图表
3. **收集反馈**：邀请团队成员试用
4. **持续更新**：随着项目演进更新文档

---

## 📞 需要确认的问题

在执行合并前，需要确认：

1. ✅ **是否保留原始目录**？
   - 建议：保留在 `99-归档/`，便于追溯

2. ✅ **lesson-02 和 stage2 如何合并**？
   - 建议：lesson-02 为主体，stage2 作为实战章节

3. ✅ **前端文档的详细程度**？
   - 建议：先创建基础框架，后续逐步完善

4. ✅ **是否需要视频教程链接**？
   - 建议：暂不需要，专注文字文档

---

**准备好开始合并了吗？**
