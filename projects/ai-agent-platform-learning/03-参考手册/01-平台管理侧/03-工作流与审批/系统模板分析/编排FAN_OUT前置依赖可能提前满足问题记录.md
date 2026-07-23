# 编排 FAN_OUT 前置依赖可能提前满足问题记录

> 记录日期：2026-07-20  
> 核对分支：`ai24/master`  
> 核对 Commit：`4e61f5da8cd19818b72d7ec5296882d213b59cec`  
> 当前状态：仅记录，尚未修复代码

## 一、问题结论

当前 AI24 编排流程对“节点自己是否完成”和“后续节点的前置依赖是否满足”使用了不同的判断标准：

```text
检查 FAN_OUT 节点自己是否完成
    → 要求节点下所有 task_flow 都是 DONE（allMatch）

检查后续节点的每个前置节点是否完成
    → 只要前置节点下至少一个 task_flow 是 DONE（anyMatch）
```

对 `SINGLE` 节点来说，因为通常只有一个任务，两种判断的结果相同。对 `FAN_OUT` 节点来说，`anyMatch` 可能在只完成一个子任务时就把该节点当成“前置依赖已满足”，导致后续节点被提前创建和执行。

## 二、正确的业务含义

假设“联调测试”同时依赖“应用开发”和“客户端开发”：

```text
应用开发（FAN_OUT）──┐
  ├── 支付服务            │
  ├── 订单服务            ├── 联调测试
  └── 库存服务            │
                           │
客户端开发（SINGLE）──┘
```

“联调测试”的正确启动条件应该是：

```text
支付服务 = DONE
且 订单服务 = DONE
且 库存服务 = DONE
且 客户端开发 = DONE
→ 联调测试才能启动
```

不能因为支付服务已经完成，就认为整个“应用开发”前置节点已完成。

## 三、当前代码的两次检查

### 3.1 节点自身完成检查是正确的

代码位置：

```text
ai24-core/src/main/java/com/vdian/ai24/core/service/requirement/RequirementFlowService.java
方法：checkAndFireNodeCompleted
```

每个子任务完成时，该方法查询当前节点的所有 `task_flow`，并使用：

```java
boolean allDone = nodeTaskFlows.stream()
        .allMatch(tf -> STATUS_DONE.equals(tf.getStatus()));
```

只有当节点下所有任务都是 `DONE` 时，才会把当前节点设为 `COMPLETED`，并发送 `NodeCompletedEvent`。

### 3.2 后续节点的前置依赖检查存在缺口

代码位置：

```text
ai24-core/src/main/java/com/vdian/ai24/core/manager/OrchestrationNodeManager.java
方法：allParentsCompleted
```

当 `NodeCompletedEventConsumer` 消费某个前置节点的完成事件时，会调用 `getNextNodes`，再通过 `allParentsCompleted` 检查后续节点的所有父节点。当前代码使用：

```java
boolean hasCompletedTask = parentTasks.stream()
        .anyMatch(tf -> "DONE".equals(tf.getStatus()));
```

这里检查的是“父节点是否至少有一个已完成任务”，不是“父节点的所有任务是否已完成”。

## 四、可复现的时序

```text
1. 应用开发拆出支付、订单、库存三个任务。
2. 支付任务先完成，订单和库存仍在执行。
3. checkAndFireNodeCompleted 使用 allMatch，不会发送“应用开发完成”事件。
4. 另一个前置节点“客户端开发”完成，并发送自己的 NodeCompletedEvent。
5. 消费该事件时，系统检查“联调测试”的所有前置节点。
6. 当前 anyMatch 看到应用开发已有支付任务是 DONE，就把该前置条件判为满足。
7. 在完成事件通过当前流水指针等校验的前提下，“联调测试”可能被提前启动。
```

这是一个时序相关的问题。如果客户端完成时，应用开发还没有任何一个 `DONE` 任务，当次不会提前启动；如果应用开发已经部分完成，就存在误判风险。

## 五、影响范围

主要受影响的是同时满足以下条件的编排：

1. 后续节点有多个前置节点。
2. 至少一个前置节点是 `FAN_OUT`。
3. `FAN_OUT` 前置节点只完成了部分子任务。
4. 其他前置节点此时完成并触发后续节点的依赖检查。

可能影响包括：

- 联调、测试、构建或发布任务过早开始。
- 后续任务读到不完整的代码或产物。
- 编排页面显示的进度与真实子任务进度不一致。
- 后续任务已创建后，迟到的前置节点完成事件还可能带来重复推进或被幂等校验忽略的复杂时序。

## 六、建议修复原则

最小修正方向是让前置依赖检查与节点自身完成检查使用同一标准：

```java
boolean allTasksDone = !parentTasks.isEmpty()
        && parentTasks.stream().allMatch(tf -> "DONE".equals(tf.getStatus()));
```

更稳妥的方向是为每个“需求流水 + 编排节点”保存独立的节点执行状态，后续节点只依赖已经可靠落库的 `NODE_COMPLETED` 状态，不再通过“是否有一个子任务完成”间接推断。

修复时建议至少覆盖以下测试：

1. `SINGLE` 父节点的唯一任务 `DONE` 后允许推进。
2. `FAN_OUT` 父节点只有一个任务 `DONE` 时不允许推进。
3. `FAN_OUT` 父节点所有任务 `DONE` 后允许推进。
4. 多个父节点中任意一个尚未全部完成时不允许推进。
5. 父节点没有 `task_flow` 记录时不允许推进。
6. 多个前置节点并发完成时，后续节点只创建一次。

## 七、与其他问题的区别

本问题与 Code Agent “阶段异常仍上报完成”不是同一个问题：

```text
阶段异常仍上报完成
    → 节点任务内部的 Stage 可能被错误推进

FAN_OUT 前置依赖使用 anyMatch
    → 编排节点之间可能被错误推进
```

两者都可能造成“实际工作未全部完成，流程却继续向后走”，但位于不同层级，需要分别处理。
