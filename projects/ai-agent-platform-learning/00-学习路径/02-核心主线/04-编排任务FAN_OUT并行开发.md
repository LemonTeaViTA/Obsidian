# 编排任务 FAN_OUT 并行开发

> 🎯 目标：15分钟理解编排任务的并行机制  
> 📊 难度：⭐⭐⭐⭐  
> 🔗 前置：[[工作流引擎如何驱动流程]]

---

## 一句话总结

**编排任务通过 FAN_OUT 机制将一个大需求拆分为多个子任务，使用 MQ 解耦，实现多个应用的并行开发。**

---

## 💡 为什么需要编排任务？

### 问题：大需求串行开发太慢

```
订单系统需求拆分为：
  - order-service（订单创建）
  - order-query-service（订单查询）
  - payment-service（支付）
  - inventory-service（库存）

串行开发：
  4个应用 × 40分钟 = 160分钟 ❌

并行开发：
  4个应用同时开发 = 40分钟 ✅（最慢的那个）
```

---

## 🏗️ 编排任务的设计

### 核心思想：FAN_OUT 扇出

```
                    应用拆分审批通过
                           ↓
                    [FAN_OUT 扇出点]
                           ↓
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓                  ↓
   order-service   order-query-service   payment-service   inventory-service
   (子任务1)           (子任务2)           (子任务3)           (子任务4)
        ↓                  ↓                  ↓                  ↓
   并行开发            并行开发            并行开发            并行开发
        ↓                  ↓                  ↓                  ↓
   完成 (500)         完成 (500)         完成 (500)         完成 (500)
        └──────────────────┼──────────────────┘
                           ↓
                    [聚合点] 全部完成
```

---

## 🔄 执行流程

### Step 1：应用拆分审批通过

```java
// AppSplitApprovalStrategy.java
public void onAllApproved(String taskId, List<ApprovalItemDO> approvedItems) {
    // 1. 判断是否为编排任务
    TaskFlowDO taskFlow = taskFlowManager.getByTaskId(taskId);
    if (taskFlow != null && taskFlow.getNodeNo() != null) {
        // 编排任务：跳过，由编排层驱动
        return;
    }
    
    // 2. 老任务：投递 MQ 消息
    onAllApprovedLegacy(taskId, approvedItems);
}
```

---

### Step 2：投递 MQ 消息（每个应用一条）

```java
protected void onAllApprovedLegacy(String taskId, 
                                    List<ApprovalItemDO> approvedItems) {
    for (ApprovalItemDO domainItem : approvedItems) {
        // 解析该领域下的应用列表
        List<AppSplitItem> apps = parseAppListFromAppList(domainItem);
        
        // 为每个应用投递 MQ
        for (AppSplitItem app : apps) {
            sendMqMessageForApp(currentTask, sourceDepId, domainItem, app);
        }
    }
}
```

**MQ 消息内容**：
```json
{
  "taskId": "T001-N1003",
  "appName": "order-service",
  "follower": "zhangsan",
  "domainName": "订单域",
  "workflowNo": "10001"
}
```

---

### Step 3：MQ 消费者创建子任务

```java
@RocketMQMessageListener(
    topic = "ai24_biz_msg",
    consumerGroup = "ai24"
)
public class AppSplitMessageListener implements RocketMQListener<String> {
    
    @Override
    public void onMessage(String message) {
        AppSplitMessage msg = JSON.parseObject(message);
        
        // 创建子任务
        String subTaskId = taskInfoService.createTask(
            msg.getAppName(),      // 任务名
            buildInput(msg),       // input JSON
            msg.getTaskId(),       // 父任务ID
            msg.getFollower(),     // 负责人
            ...
        );
        
        log.info("子任务创建成功: {}", subTaskId);
    }
}
```

---

### Step 4：并行下发 code-agent

```
子任务1、2、3、4 同时创建
  ↓
ai24 并行调用 code-agent
  ├─ POST /task/perform {taskId: "sub-1"} → code-agent-1
  ├─ POST /task/perform {taskId: "sub-2"} → code-agent-2
  ├─ POST /task/perform {taskId: "sub-3"} → code-agent-3
  └─ POST /task/perform {taskId: "sub-4"} → code-agent-4
  ↓
code-agent 为每个创建独立线程和工作目录
```

---

### Step 5：工作目录隔离

```python
# code-agent main.py
def task_perform(task_id):
    # 为每个任务创建独立工作目录
    workspace = PathManager.ensure_task_dir_exists(task_id)
    # /workspace/sub-1/
    # /workspace/sub-2/
    # /workspace/sub-3/
    # /workspace/sub-4/
    
    # 独立克隆代码
    git.clone(repo_url, workspace)
    
    # 执行任务
    execute_in_workspace(task_id, workspace)
```

**避免冲突**：
- ✅ 每个任务独立的 Git 仓库
- ✅ 每个任务独立的文件目录
- ✅ 互不干扰

---

### Step 6：状态聚合

```java
// TaskAggregationScheduler.java
@Scheduled(fixedDelay = 3000) // 每3秒检查一次
public void aggregateSubTasks() {
    // 1. 查询有子任务的父任务
    List<String> parentTaskIds = taskInfoManager.listParentTasks();
    
    for (String parentId : parentTaskIds) {
        // 2. 查询所有子任务
        List<TaskInfoDO> subTasks = taskInfoManager.listByParentId(parentId);
        
        // 3. 检查是否全部完成
        long completedCount = subTasks.stream()
            .filter(t -> t.getStatus() == 500)
            .count();
        
        if (completedCount == subTasks.size()) {
            // 4. 更新父任务状态
            TaskInfoDO parent = taskInfoManager.getById(parentId);
            parent.setStatus(500);
            taskInfoManager.updateById(parent);
            
            log.info("父任务聚合完成: {}", parentId);
        }
    }
}
```

---

## 🎯 关键技术点

### 技术1：MQ 解耦

**为什么用 MQ？**
```
直接创建 vs MQ创建：

直接创建：
  - 审批通过 → 循环创建4个子任务（阻塞）
  - 耗时：4 × 500ms = 2秒
  - 失败1个，全部回滚 ❌

MQ创建：
  - 审批通过 → 投递4条消息（异步）
  - 耗时：50ms 返回
  - 失败1个，其他不受影响 ✅
  - 失败的消息可以重试
```

---

### 技术2：工作目录隔离

**避免 Git 冲突**：
```
4个子任务同时修改代码：

不隔离：
  - 4个任务共用 /workspace/order-system/
  - 同时修改 ErrorCode.java
  - Git 冲突 ❌

隔离：
  - 任务1: /workspace/sub-1/order-system/
  - 任务2: /workspace/sub-2/order-system/
  - 任务3: /workspace/sub-3/order-system/
  - 任务4: /workspace/sub-4/order-system/
  - 各自独立，无冲突 ✅
  - CR 阶段人工合并
```

---

### 技术3：状态聚合

**定时检查 vs 事件驱动**：
```
当前方案：定时聚合（3秒检查一次）
  - 简单可靠
  - 略有延迟（最多3秒）
  
可优化方案：事件驱动
  - 子任务完成 → 发 MQ → 立即聚合
  - 实时性更好
  - 但需要确保消息不丢失
```

---

## ⚠️ 潜在问题和解决方案

### 问题1：MQ 消息丢失

**场景**：投递4条消息，只收到3条

**解决方案**：
```java
// 1. 持久化到数据库
INSERT INTO sub_task_creation_log (
    parent_task_id,
    app_name,
    mq_message_id,
    status  -- PENDING/SUCCESS/FAILED
);

// 2. 补偿任务（定时扫描）
@Scheduled(fixedDelay = 60000) // 每分钟
public void compensateMissingSubTasks() {
    // 查询 PENDING 超过5分钟的记录
    // 重新投递 MQ 或直接创建
}
```

---

### 问题2：某个子任务失败

**场景**：4个子任务，1个失败，3个成功

**当前处理**：
```
父任务状态计算：
  - 如果全部成功 → 父任务 500
  - 如果有失败 → 父任务保持进行中
  - 人工查看失败原因，决定是否重试
```

**可优化方案**：
```
PARTIAL_SUCCESS 状态：
  - 3/4 成功
  - 前端明确显示
  - 提供"重试失败任务"按钮
```

---

### 问题3：资源竞争

**场景**：4个任务同时启动测试服务，端口冲突

**解决方案**：
```python
# 动态端口分配
def allocate_port(task_id):
    base_port = 8000
    task_hash = hash(task_id) % 1000
    return base_port + task_hash

# 传递给测试
test_config = {
    "port": allocate_port(task_id),
    "database": f"test_db_{task_id}"
}
```

---

## 💎 设计亮点（面试可讲）

### 亮点1：MQ 解耦 + 异步处理
```
- 审批通过立即返回
- MQ 削峰填谷
- 失败重试机制
```

### 亮点2：工作目录隔离
```
- 每个任务独立 Git 仓库
- 避免并发冲突
- CR 阶段合并
```

### 亮点3：状态聚合
```
- 定时轮询检查
- 自动更新父任务状态
- 简单可靠
```

### 亮点4：容错设计
```
- 单个失败不影响其他
- 补偿机制
- 人工介入
```

---

## 📊 性能提升

```
场景：4个应用，每个40分钟

串行开发：
  4 × 40 = 160分钟

并行开发：
  max(40, 40, 40, 40) = 40分钟

提升：
  160 / 40 = 4倍
  
实际：
  考虑到失败重试、CR合并
  约 3倍提升
```

---

## 🔗 相关概念

- [[工作流引擎]] - 单任务内的阶段流程
- [[编排流水]] - 需求级别的任务串联
- [[MQ消息队列]] - 异步解耦机制

---

**你现在理解 FAN_OUT 并行开发了吗？** 🎉
