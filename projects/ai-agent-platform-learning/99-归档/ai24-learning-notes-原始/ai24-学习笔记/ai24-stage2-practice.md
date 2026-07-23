# AI24 数据层探索 - 阶段2练习笔记

> 学习时间：2026-07-08  
> 性质：**配套练习**（4个任务）
> 目标：理解数据库表结构和实体类
> 前置：先读 [ai24-lesson-02-database-layer.md](./ai24-lesson-02-database-layer.md) 理论讲解，再做本练习

---

## ✅ 练习任务 1：TaskInfoDO.java 字段含义

### 文件位置
```
/Users/dingshouqin/Documents/ai24/ai24-persist/src/main/java/com/vdian/ai24/persist/TaskInfoDO.java
```

### 字段详解表

| 字段名 | 类型 | 说明 | 例子 |
|--------|------|------|------|
| **id** | Long | 主键ID（自增） | 1, 2, 3... |
| **gmtCreate** | LocalDateTime | 创建时间 | 2026-07-08 10:30:00 |
| **gmtUpdate** | LocalDateTime | 更新时间 | 2026-07-08 15:20:00 |
| **taskId** | String | 任务唯一标识 | "T20260708001" |
| **userName** | String | 创建任务的用户 | "zhangsan" |
| **taskName** | String | 任务名称 | "开发用户登录功能" |
| **input** | String | 任务输入内容（用户需求） | "请帮我实现登录功能" |
| **status** | Integer | 任务状态 | 0=进行中, 1=完成, 2=失败 |
| **sessionStatus** | Integer | 会话状态 | 0=空闲, 1=进行中 |
| **extend** | String | 扩展字段（JSON格式） | `{"multiModel": true, "appName": "ai24"}` |
| **projectName** | String | 项目名称 | "ai24-web" |
| **flowType** | String | 流程类型 | "dev_workflow" |
| **depId** | Integer | DEP系统的ID | 258635 |
| **isDelete** | Integer | 删除标记 | 1=有效, -1=已删除 |
| **requirementName** | String | 需求名称 | "用户登录需求" |
| **requirementId** | Long | 需求ID | 12345 |
| **ineffective** | Byte | 是否失效 | 1=失效, 0/null=有效 |
| **workflowNo** | String | 工作流编号 | "WF001" |
| **gitUrl** | String | Git仓库地址 | "git@github.com:xxx/yyy.git" |
| **branch** | String | 任务分支 | "feature/login" |

### 核心字段分类

#### 1. 基础字段
```java
id              // 主键
gmtCreate       // 创建时间
gmtUpdate       // 更新时间
```

#### 2. 任务标识
```java
taskId          // 任务唯一ID（重要！用于关联所有数据）
userName        // 谁创建的任务
taskName        // 任务名称
```

#### 3. 任务内容
```java
input           // 用户输入的需求
status          // 任务状态（进行中/完成/失败）
sessionStatus   // 会话是否在进行中
```

#### 4. 项目信息
```java
projectName     // 项目名
gitUrl          // Git仓库
branch          // 分支名
workflowNo      // 工作流编号
```

#### 5. 需求关联
```java
depId           // DEP系统的需求ID
requirementName // 需求名称
requirementId   // 需求ID
```

#### 6. 扩展字段
```java
extend          // JSON格式的扩展信息
                // 例如：{"multiModel": true, "appName": "xxx", "models": ["gpt-4"]}
```

#### 7. 状态标记
```java
isDelete        // 软删除标记（1=有效, -1=已删除）
ineffective     // 是否失效（用于多任务场景，标记哪个是有效的）
```

---

## ✅ 练习任务 2：TaskInfoMapper.java 方法清单

### 文件位置
```
/Users/dingshouqin/Documents/ai24/ai24-persist/src/main/java/com/vdian/ai24/persist/mapper/TaskInfoMapper.java
```

### 继承的基础方法（BaseMapper 提供）

MyBatis Plus 自动提供的方法，不需要写SQL：

| 方法 | 说明 | 例子 |
|------|------|------|
| `insert(entity)` | 插入一条记录 | `mapper.insert(taskInfo)` |
| `deleteById(id)` | 根据ID删除 | `mapper.deleteById(1L)` |
| `updateById(entity)` | 根据ID更新 | `mapper.updateById(taskInfo)` |
| `selectById(id)` | 根据ID查询 | `mapper.selectById(1L)` |
| `selectList(wrapper)` | 条件查询列表 | `mapper.selectList(wrapper)` |
| `selectPage(page, wrapper)` | 分页查询 | `mapper.selectPage(page, wrapper)` |
| `selectCount(wrapper)` | 统计数量 | `mapper.selectCount(wrapper)` |

### 自定义方法（需要写SQL）

| 方法名 | 作用 | 参数 |
|--------|------|------|
| `selectCompletedTasks` | 查询已完成的任务 | status, startTime, endTime |
| `batchUpdateDepId` | 批量更新depId | List<TaskInfoDO> |
| `batchUpdateStatus` | 批量更新状态 | List<TaskInfoDO> |
| `countByDepIds` | 按部门统计任务数 | List<Integer> depIds |
| `selectDistinctUserNames` | 查询所有用户名（去重） | 无 |
| `selectValidTaskIdsByDepIds` | 查询有效任务的ID | List<Integer> depIds |

### 方法使用示例

#### 1. 插入新任务
```java
TaskInfoDO task = new TaskInfoDO();
task.setTaskId("T001");
task.setUserName("zhangsan");
task.setTaskName("开发登录功能");
task.setStatus(0);
task.setGmtCreate(LocalDateTime.now());
task.setGmtUpdate(LocalDateTime.now());
task.setIsDelete(1);

taskInfoMapper.insert(task);
```

#### 2. 根据ID查询
```java
TaskInfoDO task = taskInfoMapper.selectById(1L);
```

#### 3. 条件查询
```java
LambdaQueryWrapper<TaskInfoDO> wrapper = new LambdaQueryWrapper<>();
wrapper.eq(TaskInfoDO::getUserName, "zhangsan");
wrapper.eq(TaskInfoDO::getStatus, 500);
wrapper.eq(TaskInfoDO::getIsDelete, 1);

List<TaskInfoDO> tasks = taskInfoMapper.selectList(wrapper);
```

#### 4. 批量更新
```java
List<TaskInfoDO> list = Arrays.asList(
    new TaskInfoDO(id=1, depId=100),
    new TaskInfoDO(id=2, depId=200)
);

taskInfoMapper.batchUpdateDepId(list);
```

---

## ✅ 练习任务 3：找到 SQL 建表语句

### 查找建表语句

<function_calls>
<invoke name="bash">
<parameter name="command">find /Users/dingshouqin/Documents/ai24/sql -name "*.sql" -type f | grep -i "task_info"
---

## ✅ 练习任务 3：SQL 建表语句（根据 DO 推断）

### SQL 文件位置

项目中的 SQL 文件主要是增量修改脚本：
```
/Users/dingshouqin/Documents/ai24/sql/task_info_add_requirement_id.sql
```

### 根据 TaskInfoDO 推断的建表语句

```sql
CREATE TABLE `task_info` (
    -- 基础字段
    `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `gmt_create` datetime NOT NULL COMMENT '创建时间',
    `gmt_update` datetime NOT NULL COMMENT '更新时间',
    
    -- 任务标识
    `task_id` varchar(64) NOT NULL COMMENT '任务ID',
    `user_name` varchar(64) DEFAULT NULL COMMENT '用户名',
    `task_name` varchar(255) DEFAULT NULL COMMENT '任务名称',
    
    -- 任务内容
    `input` text COMMENT '输入内容',
    `status` int DEFAULT NULL COMMENT '任务状态：0-进行中, 1-完成, 2-失败',
    `session_status` int DEFAULT NULL COMMENT '会话状态：0-空闲, 1-进行中',
    
    -- 项目信息
    `project_name` varchar(255) DEFAULT NULL COMMENT '项目名称',
    `flow_type` varchar(64) DEFAULT NULL COMMENT '流程类型',
    `workflow_no` varchar(64) DEFAULT NULL COMMENT '工作流编号',
    `git_url` varchar(512) DEFAULT NULL COMMENT 'Git仓库地址',
    `branch` varchar(128) DEFAULT NULL COMMENT '分支名',
    
    -- 需求关联
    `dep_id` int DEFAULT NULL COMMENT 'DEP系统ID',
    `requirement_name` varchar(255) DEFAULT NULL COMMENT '需求名称',
    `requirement_id` bigint DEFAULT NULL COMMENT '需求ID',
    
    -- 扩展字段
    `extend` text COMMENT '扩展字段（JSON格式）',
    
    -- 状态标记
    `is_delete` int DEFAULT 1 COMMENT '删除标记：1-有效, -1-删除',
    `ineffective` tinyint DEFAULT NULL COMMENT '是否失效：1-失效, 0-有效',
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_task_id` (`task_id`),
    KEY `idx_user_name` (`user_name`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务信息表';
```

---

## ✅ 练习任务 4：核心表关系图

### 关系图（ASCII版）

```
task_info (任务信息表)
├─ id (主键)
├─ task_id (唯一标识) ←──────┐
├─ user_name                 │ 关联
├─ task_name                 │
├─ status                    │
└─ ...                       │
                             │
         1:N 关系             │
                             │
task_record (任务记录表)      │
├─ id                        │
├─ task_id ──────────────────┘
├─ record_id ←───────────┐
├─ record_type           │ 关联
└─ content               │
                         │
         1:N 关系         │
                         │
task_report (任务报告表)  │
├─ id                    │
├─ task_id               │
├─ record_id ────────────┘
└─ content
```

---

## 🎓 学习总结

### 完成情况

- [x] 找到 TaskInfoDO.java，理解字段含义
- [x] 找到 TaskInfoMapper.java，理解方法
- [x] 推断出 SQL 建表语句
- [x] 画出核心表的关系图

**恭喜你完成了阶段2的所有练习！** 🎉
