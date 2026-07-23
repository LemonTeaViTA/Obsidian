# AI24 数据库 - 阶段7：完整表结构与关系

> 学习时间：2026-07-09
> 目标：搞清 ai24 有哪些表、核心任务表的字段、它们靠什么关联，以及贯穿所有表的通用规律。
> 关联：stage5(链路里数据怎么落地)、stage6(input如何变成task_info字段)。

---

## 🗺️ 全景：按业务分组理解表结构

别被数量吓到，按业务归类就清晰：

```
【任务核心】(本篇重点)
  task_info            任务主表(身份证)
  task_record          任务记录(日记本)
  task_report          任务报告
  task_feedback        任务反馈
  sub_task_info        子任务(多模型)
  sub_task_statistics  子任务统计
  task_relation        任务关联(开发↔测试)
  task_artifact        任务产物
  task_flow            任务流水
  task_memory          任务记忆
  task_memory_review   记忆审核

【审批】     approval_item(审批事项)

【提示词模板】(三层)  prompt_parent → prompt_template → prompt_template_detail

【工作流】(三层+模板)  spec_workflow → spec_stage → spec_convention + spec_workflow_template

【需求流水】  requirement_info / requirement_flow

【编排版本】  orchestration_definition → orchestration_template → orchestration_node

【Agent管理(OpenClaw)】  agent_config / agent_instance / agent_channels / agent_models
                        agent_cron / agent_task_data / agent_claude_data / agent_operation_log

【统计/看板】  task_statistics / user_statistics / ai_token_use

【杂项/集成】  beisen_vacation_record(北森考勤) / bot_key_relation / git_permission_apply
              changelog / app_memory_summary / task_owner_change_log
```

> 表结构在哪定义？——靠 DO 实体类的 `@TableName("表名")` + `@TableField("列名")`(MyBatis Plus)。
> 每个 `XxxDO.java` ≈ 一张表。

---

## 📋 核心任务表和编排表

### 1. task_info —— 任务主表(身份证)

```
id               bigint     自增主键(数据库内部用)
gmt_create       datetime   创建时间
gmt_update       datetime   更新时间
task_id          varchar    任务ID "t-xxx"  ★业务主键,全系统用它★
user_name        varchar    创建者
task_name        varchar    任务名
input            text       原始输入JSON(depUrl/flowType/model...都在这)
status           int        任务状态 0→100→500/999
session_status   int        会话状态(1=code-agent正在跑,审批时会被拦)
extend           text       杂物抽屉(JSON:realName/pageUrls/portalName...)
project_name     varchar    项目名
flow_type        varchar    任务类型 backend/frontend...
dep_id           int        关联的DEP需求ID
requirement_id   bigint     需求ID
requirement_name varchar    需求名
workflow_no      varchar    工作流编号
git_url          varchar    代码仓库
branch           varchar    分支
is_delete        int        逻辑删除 1=有效 -1=已删
ineffective      tinyint    失效标记(任务重试时旧任务标失效)
```

### 2. task_record —— 任务记录(日记本，1:N)

```
id            bigint    自增主键
gmt_create    datetime
gmt_update    datetime
task_id       varchar   属于哪个任务 ★外键→task_info.task_id★
record_id     varchar   这条记录自己的ID
record_type   int       记录类型(用户消息/系统消息/AI回复/文档...)
content       text      记录内容
document_type int       文档类型
```

### 3. task_report —— 任务报告

```
id          bigint
gmt_create / gmt_update
report_id   varchar   报告ID
task_id     varchar   属于哪个任务
record_id   varchar   ★挂在某条 task_record 下(比record更细)★
content     text      报告内容
```

### 4. task_feedback —— 任务反馈

```
id            bigint
gmt_create / gmt_update
task_id       varchar   属于哪个任务
feedback_name varchar   反馈名
feedback      text      反馈内容(用户对结果的评价)
user_name     varchar   谁反馈的
feature       varchar   功能点
status        int       状态
```

### 5. sub_task_info —— 子任务(多模型)

几乎是 task_info 的翻版，多两个关键字段：

```
task_id         varchar   子任务ID "st-xxx-序号"
parent_task_id  varchar   ★父任务ID→task_info.task_id★
sub_task_type   int       子任务类型(1=proposal, 2=apply)
extend          text      存 modelCode/modelName(哪个模型) + accepted/rejected(是否被采纳)
... 其余 task_name/input/status/flow_type/is_delete 等和 task_info 一样
```

### 6. task_relation —— 任务关联(开发↔测试)

```
id            bigint
gmt_create / gmt_update
dev_task_id   varchar   开发任务ID
test_task_id  varchar   测试任务ID
relation_type varchar   关联类型 "DEV_TEST"
status        int       1=有效 0=无效
```

### 7. approval_item —— 审批事项(字段最多)

```
id             bigint
gmt_create / gmt_update
task_id        varchar   属于哪个任务
event_type     varchar   审批类型 DOMAIN_DIVIDE/APP_SPLIT/PRD审核...
confirm_item   varchar   审批项名
confirm_content text     审批内容
item_owner     varchar   事项归属(如某个领域)
confirmer      varchar   确认人(可逗号分隔多人)
follower       varchar   跟进人
confirm_status varchar   审批状态 PENDING/APPROVED/REJECTED
reject_reason  varchar   拒绝原因
problem_list   text      问题清单
app_list       text      应用列表(应用拆分场景)
extend         text      扩展(approver/pmReview...)
```

### 8. 编排版本相关表 —— 定义、版本、节点

2026-07-17 起，编排模板采用“稳定定义 + 不可变版本”模型：

```text
orchestration_definition       一个逻辑编排的稳定身份
    definition_no              始终不变
        ↓ 1:N
orchestration_template         每一行是一个不可变版本
    orchestration_no           具体版本编号
    definition_no              归属哪个稳定定义
        ↓ 1:N
orchestration_node             该版本独有的完整节点图
    orchestration_no           绑定具体模板版本
```

关键规则：

- 修改编排模板不会覆盖旧行，而是新增一个模板版本和一套新节点。
- 新需求创建时先解析当前最新版本，再把具体 `orchestration_no` 写入 `requirement_flow`。
- 运行中的流水始终使用已固定的版本；后来发布新版本不会改变它。
- 删除兼容接口实际执行“禁用定义”，历史模板、节点和任务关系继续保留。

`requirement_flow` 还保存：

```text
orchestration_no       这条流水固定使用的模板版本
master_task_id         编排主任务
current_node_no        当前节点
node_execution_status  NOT_STARTED / EXECUTING / COMPLETED / FAILED
```

`task_flow.node_no` 把每个实际任务登记到固定版本的具体节点上。

---

## 🔗 关系图：全靠 task_id 这根线串起来

```
                    ┌──────────────────┐
                    │    task_info      │  (1) 任务主表
                    │  task_id: t-xxx   │
                    └────────┬──────────┘
                             │ task_id 关联
     ┌──────────┬───────────┼───────────┬──────────────┬──────────────┐
     ▼          ▼           ▼           ▼              ▼              ▼
task_record task_report task_feedback approval_item sub_task_info task_relation
 (N条日记)   (N条报告)   (N条反馈)    (N条审批项)   (N个子任务)   (dev↔test)
     ▲                                                │
     │ record_id                               parent_task_id
     └── task_report 挂在某条 record 下          指回 task_info
```

- 一个 task_info(1) 对应多个 record/report/feedback/approval_item/sub_task(N)，全靠 `task_id` 外键关联。
- 这就是为什么 stage5 编排器必须"先存 task_info 拿到 task_id，再建其他记录"——没 task_id，子表挂不上。

---

## 📐 贯穿所有表的两条通用规律

### 规律1：每张表都有 id(自增) + 核心表有 task_id(业务主键)，两个主键概念

| | id | task_id |
|---|---|---|
| 是什么 | 数据库自增主键 | 业务主键 "t-xxx" |
| 谁用 | 数据库内部(索引/关联最快) | 全系统 + 跨系统(连code-agent) |
| 有无业务含义 | 无 | 有，可读、可跨系统传 |

> code-agent 回调时带的是 `task_id`(它不知道也不该知道你数据库的自增 id)。

### 规律2：每张表都有 gmt_create/gmt_update，核心表还有 is_delete

- **时间戳**：阿里系规范，追溯何时建/改。
- **is_delete**：逻辑删除。删数据不真删，只标记(1有效/-1删除)，永远可追溯可恢复。
  查询处处 `.eq(is_delete, 1)`(stage2/stage5 见过)。

---

## ❓ 为什么核心表没建表SQL，却有 approval_item.sql？

`sql/` 目录只有 approval_item / requirement_flow / task_info_add_requirement_id 等零星脚本：

- **老表(task_info 等)**：结构稳定，早期建过就不留仓库，现在靠 DO 类的注解反映结构。
- **新表/改表**：后加的表或字段，需在各环境执行 DDL，所以留 SQL 作为"数据库变更记录"。
  例：`task_info_add_requirement_id.sql` = 给 task_info 加 requirement_id 字段的增量脚本。

> 数据库演进的常见做法：**表结构变更用一个个小 SQL 脚本记录，方便各环境同步**(即"数据库迁移/migration"思想)。

---

## ✅ 阶段7 检查清单

- [x] 知道全库按业务分几大组(任务核心/审批/提示词/工作流/需求/Agent/统计/杂项)
- [x] 掌握核心任务表的字段与用途
- [x] 理解所有子表靠 task_id 外键挂在 task_info 下(1:N)
- [x] 理解 id(自增内部) vs task_id(业务/跨系统) 两个主键
- [x] 理解 gmt_create/gmt_update + is_delete 逻辑删除的通用规律
- [x] 理解建表SQL只留"变更脚本"、老表结构看DO类
- [x] 理解 definition_no 是稳定编排身份，orchestration_no 是具体不可变版本
- [x] 理解 requirement_flow 创建后固定模板版本，运行中不会自动升级

**关联笔记：stage5(先存task_info后建子表的原因) / stage6(input如何变成task_info各字段)。**
