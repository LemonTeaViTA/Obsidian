# AI24 项目学习 - 第二课：数据库层深入理解

> 学习时间：2026-07-08  
> 性质：**系统讲解**（理论 + 示例）
> 前置知识：已完成第一课（commons 模块基础）
> 配套练习：[ai24-stage2-practice.md](./ai24-stage2-practice.md) - 4个练习任务巩固本课内容

---

## 📚 本课学习目标

1. 理解 DO（Data Object）的作用
2. 掌握 MyBatis Plus 的基本注解
3. 理解任务系统的核心表结构
4. 学会通过 DO 类推断数据库表设计

---

## 1. 什么是 DO（Data Object）？

### 定义

**DO = Data Object（数据对象）**，是数据库表在 Java 代码中的映射。

简单来说：
- 数据库有一张表 `task_info`
- Java 中有一个类 `TaskInfoDO`
- **表的每一列 = DO 类的每一个字段**

### 类比

把 DO 想象成**表格的格式定义**：

```
数据库表：task_info
┌─────────┬──────────┬───────────┬────────┐
│ id      │ task_id  │ task_name │ status │
├─────────┼──────────┼───────────┼────────┤
│ 1       │ T001     │ 开发功能  │ 1      │
│ 2       │ T002     │ 修复Bug   │ 2      │
└─────────┴──────────┴───────────┴────────┘

Java 类：TaskInfoDO
class TaskInfoDO {
    Long id;
    String taskId;
    String taskName;
    Integer status;
}
```

---

## 2. MyBatis Plus 核心注解

### 2.1 @TableName - 指定表名

```java
@TableName("task_info")  // 对应数据库表名
public class TaskInfoDO {
    ...
}
```

**作用**：告诉 MyBatis Plus 这个类对应哪张数据库表

---

### 2.2 @TableId - 主键标识

```java
@TableId(value = "id", type = IdType.AUTO)
private Long id;
```

**参数说明**：
- `value = "id"` - 对应数据库列名
- `type = IdType.AUTO` - 主键自增策略

**常见主键策略**：
- `AUTO` - 数据库自增
- `INPUT` - 手动输入
- `ASSIGN_ID` - 雪花算法生成（分布式系统常用）

---

### 2.3 @TableField - 字段映射

```java
@TableField("task_name")
private String taskName;
```

**作用**：指定 Java 字段对应的数据库列名

**特殊参数**：
```java
@TableField(value = "gmt_create", fill = FieldFill.INSERT)
private LocalDateTime gmtCreate;
```
- `fill = FieldFill.INSERT` - 插入时自动填充
- `fill = FieldFill.INSERT_UPDATE` - 插入和更新时都自动填充

---

### 2.4 @Data - Lombok 注解

```java
@Data
public class TaskInfoDO {
    ...
}
```

**作用**：自动生成以下方法（编译时生成）
- getter 方法（getId()、getTaskName()...）
- setter 方法（setId()、setTaskName()...）
- toString() 方法
- equals() 和 hashCode() 方法

**好处**：减少重复代码，让类更简洁

---

## 3. 任务系统核心表结构

AI24 的任务系统有**三张核心表**，它们的关系如下：

```
┌──────────────────┐
│   TaskInfoDO     │  任务基础信息（主表）
│   task_info      │
└────────┬─────────┘
         │ 1
         │
         │ N
┌────────┴─────────┐       ┌──────────────────┐
│  TaskRecordDO    │  1:N  │  TaskReportDO    │
│  task_record     │───────│  task_report     │
│  任务执行记录    │       │  任务报告        │
└──────────────────┘       └──────────────────┘
```

**关系说明**：
- 一个任务（TaskInfo）可以有多条记录（TaskRecord）
- 一条记录（TaskRecord）可以有多个报告（TaskReport）

---

## 4. TaskInfoDO - 任务信息表

### 4.1 表结构

```java
@TableName("task_info")
public class TaskInfoDO {
    
    // === 基础字段 ===
    @TableId(value = "id", type = IdType.AUTO)
    private Long id;                    // 主键ID（自增）
    
    private LocalDateTime gmtCreate;    // 创建时间
    private LocalDateTime gmtUpdate;    // 更新时间
    
    // === 任务基本信息 ===
    private String taskId;              // 任务ID（唯一标识）
    private String userName;            // 创建任务的用户
    private String taskName;            // 任务名称
    private String input;               // 任务输入内容
    private Integer status;             // 任务状态（0-进行中, 1-完成, 2-失败）
    private Integer sessionStatus;      // 会话状态（0-空闲, 1-进行中）
    
    // === 项目信息 ===
    private String projectName;         // 项目名称
    private String flowType;            // 流程类型
    private Integer depId;              // DEP系统的ID
    private String requirementName;     // 需求名称
    private Long requirementId;         // 需求ID
    
    // === Git 信息 ===
    private String gitUrl;              // Git 仓库地址
    private String branch;              // 任务分支
    
    // === 工作流信息 ===
    private String workflowNo;          // 工作流编号
    
    // === 扩展字段 ===
    private String extend;              // JSON格式的扩展字段
    
    // === 状态标记 ===
    private Integer isDelete;           // 删除标记（1-有效, -1-删除）
    private Byte ineffective;           // 是否失效（1-失效, 0-有效）
}
```

### 4.2 字段详解

#### 核心字段

| 字段 | 类型 | 说明 | 例子 |
|------|------|------|------|
| `taskId` | String | 任务唯一标识 | "T20260708001" |
| `userName` | String | 创建者用户名 | "zhangsan" |
| `taskName` | String | 任务名称 | "开发用户登录功能" |
| `input` | String | 任务输入内容 | "需要实现登录功能，支持手机号和密码登录" |
| `status` | Integer | 任务状态 | 0-进行中, 1-完成, 2-失败 |

#### 扩展字段 extend

这是一个 **JSON 字符串**，存储灵活的扩展信息：

```json
{
  "multiModel": true,           // 是否多模型
  "appName": "ai24-web",       // 应用名称
  "appId": "12345",            // 应用ID
  "models": ["gpt-4", "claude"] // 使用的模型列表
}
```

**为什么需要扩展字段？**
- 数据库表结构不容易修改
- 新增字段需要改表结构（风险高）
- 用 JSON 存储灵活字段，方便扩展

### 4.3 生命周期示例

```
1. 创建任务
   └─> taskId: T001, status: 0 (进行中), sessionStatus: 1 (会话中)

2. 执行任务
   └─> 产生多条 TaskRecord（执行记录）

3. 任务完成
   └─> status: 1 (完成), sessionStatus: 0 (空闲)

4. 任务失败
   └─> status: 2 (失败), sessionStatus: 0 (空闲)

5. 删除任务
   └─> isDelete: -1 (已删除)
```

---

## 5. TaskRecordDO - 任务记录表

### 5.1 表结构

```java
@TableName("task_record")
public class TaskRecordDO {
    
    @TableId(value = "id", type = IdType.AUTO)
    private Long id;                    // 主键ID
    
    private LocalDateTime gmtCreate;    // 创建时间
    private LocalDateTime gmtUpdate;    // 更新时间
    
    private String taskId;              // 关联的任务ID
    private String recordId;            // 记录ID
    private Integer recordType;         // 记录类型
    private String content;             // 记录内容
    private Integer documentType;       // 文档类型
}
```

### 5.2 recordType - 记录类型

```java
// 记录类型枚举
1 - 错误信息（ERROR_INFO）
2 - 用户消息（USER_MESSAGE）
3 - 系统消息（SYSTEM_MESSAGE）
```

**例子**：
```
recordType = 1: "数据库连接失败"
recordType = 2: "请帮我开发登录功能"
recordType = 3: "任务已创建，开始执行..."
```

### 5.3 documentType - 文档类型

```java
// 文档类型枚举
1 - design（技术方案）
2 - test_design（测试报告）
3 - summary（总结报告）
4 - task（任务清单）
```

**例子**：
```
documentType = 1: 技术方案文档
documentType = 2: 测试报告
documentType = 3: 总结报告
documentType = 4: 任务清单
```

### 5.4 使用场景

```
任务 T001：开发登录功能
├─ Record 1 (recordType=2, 用户消息)
│  └─ "请帮我开发登录功能"
├─ Record 2 (recordType=3, 系统消息)
│  └─ "开始分析需求..."
├─ Record 3 (recordType=3, 系统消息, documentType=1)
│  └─ "技术方案：使用JWT实现登录..."
├─ Record 4 (recordType=3, 系统消息)
│  └─ "代码已生成"
└─ Record 5 (recordType=3, 系统消息, documentType=3)
   └─ "总结：本次任务完成了登录功能开发..."
```

---

## 6. TaskReportDO - 任务报告表

### 6.1 表结构

```java
@TableName("task_report")
public class TaskReportDO {
    
    @TableId(value = "id", type = IdType.AUTO)
    private Long id;                    // 主键ID
    
    @TableField(value = "gmt_create", fill = FieldFill.INSERT)
    private LocalDateTime gmtCreate;    // 创建时间（自动填充）
    
    @TableField(value = "gmt_update", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime gmtUpdate;    // 更新时间（自动填充）
    
    private String reportId;            // 报告ID
    private String taskId;              // 任务ID
    private String recordId;            // 关联的记录ID
    private String content;             // 报告内容
}
```

### 6.2 自动填充机制

注意到 `gmtCreate` 和 `gmtUpdate` 的注解：

```java
@TableField(value = "gmt_create", fill = FieldFill.INSERT)
private LocalDateTime gmtCreate;

@TableField(value = "gmt_update", fill = FieldFill.INSERT_UPDATE)
private LocalDateTime gmtUpdate;
```

**自动填充规则**：
- `FieldFill.INSERT` - 插入时自动填充（创建时间）
- `FieldFill.INSERT_UPDATE` - 插入和更新时都填充（更新时间）

**好处**：
- 不需要手动设置时间
- MyBatis Plus 会自动处理
- 避免忘记设置时间导致的问题

### 6.3 使用场景

```
任务 T001 的执行过程中：

Record R001: "开始分析需求"
├─ Report RP001: "需求分析报告-第1版"
└─ Report RP002: "需求分析报告-第2版（修正）"

Record R002: "生成技术方案"
└─ Report RP003: "技术方案文档"

Record R003: "代码生成"
├─ Report RP004: "生成的代码-UserController.java"
└─ Report RP005: "生成的代码-UserService.java"
```

---

## 7. 三张表的关系总结

### 7.1 数据关系

```
TaskInfo (1) ──┬──> TaskRecord (N) ──┬──> TaskReport (N)
               │                     │
               │                     └──> TaskReport (N)
               │
               ├──> TaskRecord (N) ──┬──> TaskReport (N)
               │                     └──> TaskReport (N)
               │
               └──> TaskRecord (N) ──> TaskReport (N)
```

### 7.2 实际例子

```
任务：开发登录功能 (task_info)
│
├─ 记录1：用户输入 (task_record)
│  └─ 无报告
│
├─ 记录2：需求分析 (task_record)
│  ├─ 报告1：需求分析文档 (task_report)
│  └─ 报告2：需求分析修正 (task_report)
│
├─ 记录3：技术方案 (task_record)
│  └─ 报告3：技术方案文档 (task_report)
│
├─ 记录4：代码生成 (task_record)
│  ├─ 报告4：UserController.java (task_report)
│  ├─ 报告5：UserService.java (task_report)
│  └─ 报告6：UserMapper.java (task_report)
│
└─ 记录5：任务总结 (task_record)
   └─ 报告7：总结报告 (task_report)
```

### 7.3 通过 taskId 关联

所有数据通过 `taskId` 关联在一起：

```sql
-- 查询任务的所有信息
SELECT * FROM task_info WHERE task_id = 'T001';

-- 查询任务的所有记录
SELECT * FROM task_record WHERE task_id = 'T001';

-- 查询任务的所有报告
SELECT * FROM task_report WHERE task_id = 'T001';

-- 查询某条记录的所有报告
SELECT * FROM task_report WHERE record_id = 'R001';
```

---

## 8. MyBatis Plus 基础操作

### 8.1 Mapper 接口

每个 DO 都对应一个 Mapper 接口：

```java
public interface TaskInfoMapper extends BaseMapper<TaskInfoDO> {
    // 继承 BaseMapper 后，自动拥有以下方法：
    // - insert(entity)          插入一条记录
    // - deleteById(id)          根据ID删除
    // - updateById(entity)      根据ID更新
    // - selectById(id)          根据ID查询
    // - selectList(wrapper)     条件查询列表
    // - selectPage(page, wrapper) 分页查询
}
```

### 8.2 基础操作示例

```java
// 插入
TaskInfoDO task = new TaskInfoDO();
task.setTaskId("T001");
task.setTaskName("开发登录功能");
task.setStatus(0);
taskInfoMapper.insert(task);

// 查询
TaskInfoDO task = taskInfoMapper.selectById(1L);

// 更新
task.setStatus(1);
taskInfoMapper.updateById(task);

// 删除
taskInfoMapper.deleteById(1L);

// 条件查询
LambdaQueryWrapper<TaskInfoDO> wrapper = new LambdaQueryWrapper<>();
wrapper.eq(TaskInfoDO::getTaskId, "T001");
List<TaskInfoDO> list = taskInfoMapper.selectList(wrapper);
```

---

## 9. 学习检查清单

### ✅ 基础概念

- [ ] 理解 DO 的作用（数据库表映射）
- [ ] 掌握 @TableName、@TableId、@TableField 注解
- [ ] 理解 @Data 注解的作用（Lombok）
- [ ] 理解主键自增策略（IdType.AUTO）
- [ ] 理解自动填充机制（FieldFill）

### ✅ 表结构理解

- [ ] 能说出 task_info 表的核心字段
- [ ] 理解 task_record 的 recordType 分类
- [ ] 理解 task_report 的作用
- [ ] 理解三张表的关系（1:N:N）
- [ ] 理解通过 taskId 关联数据

### ✅ 实践练习

- [ ] 找到 TaskInfoMapper.java 文件
- [ ] 找到 mapper XML 配置文件
- [ ] 找到建表 SQL 语句
- [ ] 画出三张表的 ER 图
- [ ] 尝试理解一个简单的查询语句

---

## 10. 扩展阅读

### 10.1 其他重要的 DO 类

```
PromptTemplateDO        - 提示词模板
PromptParentDO          - 提示词分类
SpecWorkflowDO          - 工作流
TaskFeedbackDO          - 任务反馈
TaskMemoryDO            - 任务记忆
SubTaskInfoDO           - 子任务信息
```

### 10.2 下一步学习计划

1. **阅读 Mapper 接口**：理解数据库操作方法
2. **查看 SQL 文件**：理解建表语句
3. **学习 MyBatis Plus 文档**：深入理解 ORM 框架
4. **进入第三课**：学习业务逻辑层（Service 和 Manager）

---

## 11. 常见问题

### Q1: DO、DTO、VO 有什么区别？

**答**：
- **DO（Data Object）**：数据库实体，与数据库表一一对应
- **DTO（Data Transfer Object）**：数据传输对象，用于不同层之间传递数据
- **VO（View Object）**：视图对象，用于前端展示

**转换流程**：
```
数据库 <-> DO <-> DTO <-> VO <-> 前端
```

### Q2: 为什么时间用 LocalDateTime 而不是 Date？

**答**：
- `LocalDateTime` 是 Java 8 新的时间 API
- 线程安全
- API 更好用
- 不包含时区信息（适合存储数据库时间）

### Q3: extend 字段为什么用 JSON 存储？

**答**：
- **灵活性**：不需要改表结构就能添加新字段
- **扩展性**：不同任务可能有不同的扩展信息
- **兼容性**：老数据不受影响

**缺点**：
- 不能直接用 SQL 查询 JSON 里的字段
- 需要在代码中解析 JSON

### Q4: recordType 和 documentType 为什么用 Integer？

**答**：
- **节省空间**：Integer 占 4 字节，String 占更多
- **性能更好**：数字比较比字符串快
- **规范化**：统一用枚举管理

**使用方式**：
```java
// 在代码中用枚举
TaskRecordTypeEnum.ERROR_INFO.getCode();  // 返回 1

// 存储到数据库
record.setRecordType(1);

// 从数据库读取后转换
TaskRecordTypeEnum type = TaskRecordTypeEnum.fromCode(record.getRecordType());
```

---

## 12. 总结

### 核心知识点

1. **DO = 数据库表的 Java 映射**
2. **MyBatis Plus 注解简化开发**
3. **任务系统三张核心表：TaskInfo → TaskRecord → TaskReport**
4. **通过 taskId 关联所有数据**
5. **扩展字段 extend 提供灵活性**

### 下一步

准备好进入**第三课：业务逻辑层**了吗？

我们将学习：
- Service 和 Manager 的区别
- 如何组合多个 Mapper 完成复杂业务
- 事务管理
- 业务流程设计

继续加油！🚀
