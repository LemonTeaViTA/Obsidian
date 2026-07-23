# AI24 综合实战 - 阶段8：审批流程与工作流驱动

> 学习时间：2026-07-09
> 目标：理解"需求评审→领域拆分→应用拆分→开发"这条链路不是写死的,而是工作流配置驱动的;理解每个阶段"执行→审批→通过/驳回"的固定模式。
> 前置：stage5(完整链路)、stage6(input五要素)、stage7(数据库表)

---

## 🎯 核心认知

**最容易误解的点**:以为"需求评审→领域拆分→应用拆分→开发"是代码写死的顺序。

**真相**:
- ❌ 阶段顺序不是代码写死的 if-else
- ✅ 是**工作流配置**(spec_workflow → spec_stage)驱动的
- ✅ 不同工作流,阶段清单不同(大需求走领域拆分,普通任务直接 proposal→apply)
- ✅ 但**每个阶段的模式是固定的**:code-agent执行 → 上报产物 → 审批 → 通过/驳回

一句话:**机制固定,顺序可配。**

还要区分两个层次：

```text
spec_workflow / spec_stage
    定义“一个任务内部有哪些阶段和约定”

orchestration_definition / template / node
    定义“一个需求如何串联多个任务、审批、部署等节点”
```

前者是任务工作流，后者是需求级编排，不能混为同一套表。

---

## 一、工作流配置驱动(不是写死)

### 证据:阶段顺序来自数据库的 spec_stage 表

[TaskWorkflowQueryService.java:132](ai24-core/service/support/TaskWorkflowQueryService.java#L132):

```java
// 先按工作流白名单解析实际生效模板，再查有序阶段
SpecWorkflowTemplateDO effectiveTemplate = resolveEffectiveWorkflowTemplate(requestedWorkflowTemplateId);
List<SpecStageDO> stages = specStageManager.listByWorkflowTemplateId(
        effectiveTemplate.getWorkflowTemplateId());

// calculateCanExecuteForStage:280 决定某阶段能不能跑
// 规则:只能执行"当前步骤、之前的步骤、以及下一步骤"
return targetIndex <= currentIndex + 1;
```

**这说明什么?** 有多少阶段、什么顺序,配在 `spec_workflow → spec_stage` 里,不是 Java 代码 if-else。

### 哪个模板版本决定阶段顺序

默认情况下，任务继续使用创建时写入 `input.templateId` 的具体版本。只有当稳定的 `workflowNo` 命中 `GET_TEMPLATE_LATEST_WORKFLOW_NOS` 时，系统才改用 `spec_workflow.workflow_template_id` 指向的最新版本。

这个“实际生效模板”同时用于：

- `/api/task/notify/getTemplate` 查 Stage 或 Convention Prompt。
- 任务详情组装 `specWorkflowTemplate` 和阶段树。
- `StageControlService.canExecute`、下一阶段计算和 `currentStage` 更新。

因此，白名单工作流发布新模板后，存量任务也会看到新阶段树；如果旧命令在新版本中被删除或改名，旧任务可能找不到当前阶段或无法自动推进。发布这类工作流的新版本时，必须考虑正在运行的任务。

### 工作流三层结构(stage6 提过,这里串起来)

```
spec_workflow(工作流)         一套完整研发流程模板
    ↓ has many
spec_stage(阶段)             有序的步骤列表
    ↓ has many
spec_convention(约定)        每步的指令+提示词
```

**前端选工作流 = 选了一串有序的阶段清单。** 不同工作流,清单不同:

| 工作流类型 | 阶段清单 |
|-----------|---------|
| 大需求(领域划分工作流) | 需求评审 → 领域拆分 → 应用拆分 → 开发 |
| 普通开发任务 | proposal(方案) → apply(开发) |
| PRD 审核工作流 | 只有 PRD 审核这一环 |

**所以"需求评审是固定的吗"——不是所有任务都有,取决于选的工作流。**

---

## 二、每个阶段的固定模式(这部分你说对了)

虽然阶段顺序可配,但**每一环怎么走是固定套路**:

```
每个阶段的固定模式(不管领域拆分还是应用拆分,都一样):
  ① code-agent 执行这个阶段(拆分/��方案)
  ② 干完 → 上报产物给 ai24 → 创建审批项(approval_item, PENDING)
  ③ 找到负责人审核(item_owner/confirmer)
  ④ 分两条路:
     ├─ 全部通过 → 推进到下一阶段(创建下一阶段任务)
     └─ 有驳回 → 加备注(reject_reason) → 打回 code-agent 重做 → 重做完再上报审批
```

### 关键:审批通过 ≠ 继续同一任务,而是"创建下一阶段的新任务"

这是最精彩的设计——**不是一个任务从头走到尾,而是一串任务接力**。

---

## 三、代码里的阶段接力链

当前同时保留两条链路：

```text
新编排任务（task_flow.node_no 非空）
  → 审批策略不直接创建下一批任务
  → NodeCompletedEventConsumer 按 requirement_flow 固定版本推进下一节点

历史兼容任务（无 node_no）
  → 继续执行 DomainDivide/AppSplit 策略中的 Legacy 逻辑
```

这样可以避免“审批策略创建一次、编排层又创建一次”的重复触发。

### 老任务兼容：领域拆分审核通过 → 创建应用拆分任务

[DomainDivideApprovalStrategy.onAllApproved:95](ai24-core/service/approval/impl/DomainDivideApprovalStrategy.java#L95):

```java
protected void onAllApprovedLegacy(...) {
    // 遍历每个审批项(每个领域)
    processApprovedItem(currentTask, item);  // 里面调:
        ↓
    taskInfoService.createTask(...)  // 建"应用拆分"任务(新taskId!)
        ↓
    advanceWorkflow(...)  // 把工作流推进到下一环节
}
```

### 老任务兼容：应用拆分审核通过 → 投 MQ 创建开发任务

[AppSplitApprovalStrategy.onAllApproved:91](ai24-core/service/approval/impl/AppSplitApprovalStrategy.java#L91):

```java
protected void onAllApprovedLegacy(...) {
    // 遍历每个应用
    sendMqMessageForApp(...)  // 每个应用投一条MQ,创建开发任务
}
```

### 驳回 → 打回 code-agent 重做

[AppSplitApprovalStrategy.onSomeRejected:628](ai24-core/service/approval/impl/AppSplitApprovalStrategy.java#L628):

```java
public void onSomeRejected(...) {
    // 拼"哪些通过/哪些拒绝/拒绝原因"文本
    String parsedText = ...;
    
    // 把意见当新消息发回 code-agent
    QueryTaskRpcRequest request = new QueryTaskRpcRequest();
    request.setInputText(parsedText);
    taskInfoFacade.queryTask(request, ...);  // 发回去重做
}
```

### 新编排任务：由编排层推进和登记

新编排任务完成后，由 `NodeCompletedEventConsumer` 重新加载 `requirement_flow`，按照其中固定的 `orchestration_no` 查找下一节点，再调用 `RequirementFlowService.advanceToNextNode`。新任务通过 `registerTaskToNode` 登记到 `task_flow.node_no`。

整个过程必须始终使用流水创建时固定的模板版本，不能因为后台发布了新版本就改读新节点。

**关键表**:
- `requirement_flow`:需求级流水(记录当前走到哪个 workflowNo)
- `task_flow`:任务级流水(记录每个阶段的任务 ID)
- `task_relation`:任务关联(开发任务↔测试任务,不是阶段关联)

---

## 四、审批的调度中枢:策略模式

[ApprovalItemServiceImpl.approve](ai24-core/service/impl/ApprovalItemServiceImpl.java):

```java
// 先检查:所有审批项都表态了吗(没有PENDING了)
boolean allResolved = all.stream()
    .noneMatch(item -> PENDING.equals(item.getConfirmStatus()));
if (!allResolved) return;   // 还有人没批,继续等

// 都表态了,看全过还是有拒
boolean allApproved = all.stream()
    .allMatch(item -> APPROVED.equals(item.getConfirmStatus()));

if (allApproved) {
    strategy.onAllApproved(...);   // ← 全过:下一阶段
} else {
    strategy.onSomeRejected(...);  // ← 有拒:打回重做
}
```

`strategy.onAllApproved` 还会经过 `AbstractApprovalStrategy`：如果当前任务已经绑定 `task_flow.node_no`，说明它属于新编排，策略不再直接创建下一阶段任务；无节点绑定的历史任务才进入各子类的 `onAllApprovedLegacy`。

**策略选择**(根据 `eventType`):

| eventType | 策略类 | 通过后干啥 |
|-----------|--------|-----------|
| DOMAIN_DIVIDE | DomainDivideApprovalStrategy | 创建应用拆分任务 |
| APP_SPLIT | AppSplitApprovalStrategy | 投MQ创建开发任务 |
| PRD审核 | PrdAuditApprovalStrategy | ... |

**为什么策略模式?** 不同审批类型,通过后的"下一步"不同。用策略模式,每种审批一个策略类,主流程只管调 `strategy.onAllApproved()`,具体干啥由策略决定。

---

## 五、审批项的结构(stage7 学过,这里串起来)

**approval_item 表关键字段**(与审批流程的对应):

```
task_id          属于哪个任务
event_type       审批类型(DOMAIN_DIVIDE/APP_SPLIT)  ← 决定用哪个策略
confirm_item     审批项名(如"订单域")
confirm_content  审批内容(产物报告,JSON)  ← code-agent上报的!最近改动:必须带产物
item_owner       事项归属(领域名/应用名)
confirmer        确认人列表(逗号分隔)     ← 这些人审批
confirm_status   PENDING/APPROVED/REJECTED ← 审批状态
reject_reason    拒绝原因                 ← 驳回时填,发回code-agent
```

**创建审批项的时机**:code-agent 某阶段完成后,上报产物时同时创建(详见 code-agent 侧"上报机制与流式推送"笔记)。

---

## 六、完整链路示意图

```
【领域划分/应用拆分工作流的完整链条】

PRD 自动事件或允许通过的手工创建 → 编排主任务
   ↓ 固定本次使用的 orchestration_no 模板版本
创建首个节点任务 → taskId: t-001
   ↓ 发给 code-agent
code-agent 执行领域拆分 → 上报产物 + 创建审批项(DOMAIN_DIVIDE, PENDING)
   ↓ ai24 找到领域负责人
负责人审批 → 3个领域
   ├ 订单域:APPROVED
   ├ 用户域:APPROVED
   └ 商品域:REJECTED(备注:"商品域拆分粒度太粗")
   ↓ 触发 onSomeRejected
ai24 调 queryTask 把备注发回 code-agent → code-agent 重新拆商品域 → 再上报审批
   ↓ 负责人再审,全过
   ↓ 触发 onAllApproved
ai24 调 createTask 建"应用拆分"任务 → taskId: t-002(新任务!)
   ↓ advanceWorkflow(推进工作流) + 发给 code-agent
code-agent 执行应用拆分 → 上报产物 + 创建审批项(APP_SPLIT, PENDING)
   ↓ ai24 找到应用负责人
负责人审批 → 5个应用全过
   ↓ 触发 onAllApproved
ai24 投 MQ,为每个应用创建开发任务 → taskId: t-003/t-004/t-005/t-006/t-007
   ↓ 5个开发任务各自执行(不用审批了,直接干)
...
```

**关键点**:
- t-001(领域拆分)、t-002(应用拆分)、t-003~007(开发)是**一串独立任务**,不是"一个任务走多阶段"
- 它们靠 `requirement_flow` / `task_flow` 串成一条链
- 编排主任务只负责承载整条流水，不直接发给 code-agent；真正的业务节点任务才会执行

### PRD 自动流程与手工创建入口如何配合

`PRD_ITERATION_ID_WHITELIST` 同时服务两个入口：

```text
PRD 已完成事件：
  名单为空   → 不按迭代过滤
  名单非空   → 只处理名单内迭代

工厂手工创建：
  管理员                              → 允许应急创建
  首个关联需求命中手工创建需求白名单   → 允许创建
  普通用户 + 名单内迭代               → 拒绝，要求走 PRD 自动流程
  名单为空/DEP查询失败                 → 放行
```

目的不是限制正常开发，而是防止同一需求同时被 PRD 自动事件和工厂手工入口重复触发。

### 编排模板版本化

编排模板现在不再原地覆盖：

```text
发布版本1 → 流水A固定使用版本1
修改并发布版本2
    ├─ 流水A继续使用版本1
    └─ 新建流水B解析并固定使用版本2
```

- `orchestration_definition.definition_no` 是逻辑编排的稳定身份。
- `orchestration_template.orchestration_no` 是某个具体不可变版本。
- 更新模板会新增版本和完整节点图，旧版本保留。
- 禁用定义只影响新流水选择，已经运行的流水可以继续完成。
- `requirement_flow.orchestration_no` 是运行时固定版本，推进、回滚和完成事件都必须使用它。

> 不要混淆两种版本策略：需求级编排 `orchestration_no` 仍然固定版本；任务内部的 `spec_workflow` 只有命中 `GET_TEMPLATE_LATEST_WORKFLOW_NOS` 时才动态读取最新版本。

---

## 七、最近改动(补充你的记忆)

git log 显示最近一堆提交都在优化审批:

```
14adad0ed  创建审批项必须携带产物      ← confirm_content 不能空
690ead67a  应用拆分支持审批项传递
38d804bc8  PM审批                     ← 新增 pmReview 字段
8220f2dd6  审批人记录
5643db297  领域划分打回卡片产品/审批人转中文名展示
d7cc2eb10  全部审批通过则创建
```

**核心变化**:
1. 审批项必须带产物(不能空建)
2. 新增 PM 审批环节(pmReview / pmReviewType)
3. 审批人中文名展示
4. PRD 自动流程迭代默认禁止普通用户重复手工创建，管理员和需求白名单提供豁免入口
5. 指定任务工作流可通过白名单动态读取最新 Stage/Convention 模板
6. 编排模板改为稳定定义 + 不可变版本，运行流水固定具体版本

---

## ✅ 阶段8 检查清单

- [x] 理解阶段顺序不是写死,是 spec_stage 配置驱动
- [x] 理解每个阶段固定模式:执行→上报→审批→通过/驳回
- [x] 理解审批通过 = 创建下一阶段任务(接力),不是继续同一任务
- [x] 理解 DomainDivide/AppSplit 两条关键链路
- [x] 理解审批调度中枢:策略模式,按 eventType 选策略
- [x] 理解驳回 = queryTask 打回 code-agent 带 reject_reason 重做
- [x] 理解 advanceWorkflow 推进工作流 + task_flow 登记任务流水
- [x] 知道 approval_item 表结构与审批流程的对应
- [x] 理解 PRD 自动入口与工厂手工入口如何通过迭代名单避免重复触发
- [x] 理解需求白名单如何对特定需求开放手工创建豁免
- [x] 区分请求模板 ID 和实际生效模板 ID
- [x] 区分稳定 definition_no 与具体版本 orchestration_no
- [x] 理解运行中的流水固定版本，不会跟随新版本自动升级

**关联笔记**:
- stage5:完整链路(审批是链路中的一环)
- stage7:数据库表(approval_item/requirement_flow/task_flow)
- code-agent 侧"上报机制":创建审批项的时机
