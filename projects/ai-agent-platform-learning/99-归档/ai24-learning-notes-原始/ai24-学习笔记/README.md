# AI24 学习笔记体系梳理

> 更新时间：2026-07-09
> 共 8 份笔记，分 4 大类型

---

## 📚 笔记清单与分类

### 类型A：入门/导览类（让你知道"学什么、怎么学"）

| 文件 | 大小 | 性质 | 核心内容 |
|------|------|------|---------|
| `ai24-project-learning-guide.md` | 15K | 🧭 学习路线图 | 项目概述 + 5阶段学习路线 + 技术栈 + 目录结构 |

**作用**：第一次接触项目时看，规划学习路径。

---

### 类型B：分层架构静态结构（Spring Boot 四层）

| 文件 | 大小 | 阶段 | 层 | 核心内容 |
|------|------|------|-----|---------|
| `ai24-lesson-02-database-layer.md` | 16K | lesson-02 | persist(持久层) | MyBatis Plus + Mapper + DO实体 + 表关系 |
| `ai24-stage2-practice.md` | 8.5K | stage2练习 | persist | TaskInfoDO字段详解(练习性质,lesson-02的实战) |
| `ai24-stage3-business-layer.md` | 18K | stage3 | core(业务层) | Service/Manager协作 + 事务 + 业务逻辑 |
| `ai24-stage4-controller-layer.md` | 17K | stage4 | web(接口层) | Controller + HTTP请求处理 + 参数校验 + Swagger |

**作用**：从下往上(persist → core → web)理解 Spring Boot 分层架构的**静态结构**——每层是什么、怎么写、职责边界。学完这 4 份，你会写一个标准的 CRUD 接口。

**注意**：`lesson-02` 和 `stage2-practice` 内容重叠（都是持久层），但视角不同——lesson-02 是系统讲解，stage2 是练习笔记。可以考虑合并或明确一个是"讲义"一个是"作业"。

---

### 类型C：动态流程综合实战（把静态结构"跑起来"）

| 文件 | 大小 | 阶段 | 范围 | 核心内容 |
|------|------|------|------|---------|
| `ai24-stage5-full-flow.md` | 21K | stage5 | 完整链路 | 前端→Controller→Service→Orchestrator→存库→发HTTP→code-agent→回调，含并发模型、task_info vs task_record |
| `ai24-stage6-input-fields.md` | 17K | stage6 | 链路第一环 | input五要素(dep/工作流/模型/测试人员/类型)、测试任务自动派生、多模型竞赛 |
| `ai24-stage8-workflow-approval.md` | 25K | stage8 | 审批与工作流 | spec_workflow三层结构、阶段接力、审批通过/驳回、策略模式、编排流水 |

**作用**：把 stage2-4 学的**静态分层变成动态请求**，一个真实任务从头到尾怎么走。学完这 3 份，你理解"一个任务的生命周期"和"多阶段工作流"。

**stage5 vs stage6 vs stage8**：
- stage5 是完整八站链路(宏观)
- stage6 是链路第一环 input 的五要素细节(微观)
- stage8 是工作流配置驱动的审批流程(核心业务逻辑)

---

### 类型D：数据库/基础设施（支撑性知识）

| 文件 | 大小 | 阶段 | 范围 | 核心内容 |
|------|------|------|------|---------|
| `ai24-stage7-database-schema.md` | 8.6K | stage7 | 数据库 | 42张表按业务分组、核心7表字段、ER关系、id vs task_id双主键、逻辑删除 |

**作用**：理解"数据落在哪、怎么关联"。stage5 里"先存库后下发"的原因，在这里能看到表结构支撑。

---

## 🗺️ 知识体系全景图

```
【入门】ai24-project-learning-guide  ← 第一份看，规划路线
   ↓
【静态结构】lesson-02/stage2(持久层) → stage3(业务层) → stage4(接口层)
   ↓         ↑ 4份，从下往上理解分层架构
   ↓         └─ lesson-02 和 stage2-practice 内容重叠
   ↓
【动态流程】stage5(完整链路) → stage6(input五要素细节)
   ↓         ↑ 2份，把静态结构"跑起来"
   ↓
【基础设施】stage7(数据库表结构)
             ↑ 1份，理解数据怎么落地
```

---

## ✅ 体系完整度评估

### 已覆盖 ✅

- ✅ Spring Boot 分层架构(persist/core/web)
- ✅ 完整请求链路(前端→Java→code-agent→回调)
- ✅ 数据库表结构与关系
- ✅ 创建任务的 input 参数详解
- ✅ 并发模型(单例+无状态)
- ✅ 两张表的关系(task_info 身份证 vs task_record 日记本)

### 缺失/可补充 ⚠️

~~今天口头讲过但**还没成文**的重要内容:~~

1. ~~**审批流程**（工作流配置驱动、阶段接力、通过/驳回分支）—— 今天讲得很透，但没落笔记~~ ✅ **已补充 stage8**
2. ~~**工作流三层结构实战**（spec_workflow → spec_stage → spec_convention）—— stage6 提过但没深入~~ ✅ **已补充 stage8**
3. **code-agent 侧的完整笔记**（启动、任务处理、上报机制）—— 在 code-agent-learning 目录，不在 ai24 这边

### 重复内容 🔄

- `lesson-02-database-layer` 和 `stage2-practice` 都讲持久层，内容 70% 重叠。
  - **建议**：明确 lesson-02 是"讲义"，stage2-practice 是"练习作业"，或合并成一份带练习环节的完整笔记。

---

## 🎯 下一步建议

### 选项A：补齐缺失的审批流程（ai24 侧 stage8）

今天讲的"工作流配置驱动 + 阶段接力 + 审批通过/驳回"是整个系统最复杂的业务逻辑，值得单独成篇。

**内容提纲**:
- 流程不是写死而是 spec_stage 配置驱动
- 每个阶段固定模式：执行→上报→审批→通过/驳回
- 审批通过 = 创建下一阶段任务(接力)
- DomainDivideApprovalStrategy / AppSplitApprovalStrategy 两条关键链路

### 选项B：整理 lesson-02 和 stage2-practice 的重复

合并或明确关系，避免后续复习时困惑"该看哪份"。

### 选项C：继续深挖其他模块

如 Dubbo 调用、WebSocket 推送、任务恢复/迁移等，取决于你想往哪个方向深入。

---

## 📝 笔记使用建议

**新人看法（假设你 3 个月后重新复习）**:

```
第1天：读 ai24-project-learning-guide         了解项目和学习路线
第2天：读 lesson-02 + stage2-practice         搞懂持久层
第3天：读 stage3                              搞懂业务层
第4天：读 stage4                              搞懂接口层
第5天：读 stage5 + stage6                     完整链路 + input细节
第6天：读 stage7                              数据库表结构
第7天：读 stage8                              工作流与审批机制 ✅ 已补充
```

**当前体系已完整！从入门到精通的完整学习路径。**
