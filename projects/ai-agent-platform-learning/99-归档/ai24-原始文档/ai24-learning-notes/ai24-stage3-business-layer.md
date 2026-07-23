# AI24 业务逻辑层学习 - 阶段3

> 学习时间：2026-07-08  
> 目标：理解业务逻辑如何实现，Service 和 Manager 如何协作

---

## 🎯 核心理解总结

### 你的理解（完全正确！）✅

1. **Mapper = 遥控器按钮**
   - 每个按钮负责一个功能（一个数据库操作）
   - 简单、直接、专一

2. **Manager = 部门负责人**
   - 管理某一张表的数据
   - 使用 Mapper 来操作数据库
   - 封装常用的查询和更新逻辑

3. **Service / Orchestrator = 业务处理层**
   - Service 负责事务边界和业务入口
   - Orchestrator 负责复杂步骤编排
   - 可以调用多个 Manager
   - 也可以直接调用简单的 Mapper 功能
   - 处理业务逻辑和事务

4. **Controller = 请求响应层**
   - 接收 HTTP 请求
   - 调用 Service 处理业务
   - 返回响应给用户

5. **MyBatis 替代 JDBC**
   - 不需要手写复杂的 JDBC 代码
   - 直接用 Mapper 接口就好
   - MyBatis 自动处理 SQL 执行和结果映射

---

## 📊 完整的分层架构图

```
┌─────────────────────────────────────────────────────┐
│                   用户 / 前端                        │
│                 发起 HTTP 请求                       │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Controller 层 (ai24-web)                            │
│  职责：接收请求、返回响应                            │
│  ─────────────────────────────────────────────────  │
│  @RestController                                     │
│  public class TaskInfoController {                   │
│      @PostMapping("/create")                         │
│      public ApiResponse createTask(Request req) {    │
│          // 参数、权限、PRD自动迭代拦截、创建路由      │
│          String taskId = routeTaskCreation(...);     │
│          return ApiResponse.success(taskId);         │
│      }                                                │
│  }                                                    │
└─────────────────────────────────────────────────────┘
                      ↓ 调用 Service
┌─────────────────────────────────────────────────────┐
│  Service 接口层 (ai24-core)                          │
│  职责：定义业务方法                                  │
│  ─────────────────────────────────────────────────  │
│  public interface TaskInfoService {                  │
│      String createTask(String taskName, ...);        │
│      TaskInfoDO getTaskById(Long id);                │
│  }                                                    │
└─────────────────────────────────────────────────────┘
                      ↓ 实现
┌─────────────────────────────────────────────────────┐
│  ServiceImpl / Orchestrator (ai24-core)              │
│  职责：事务入口 + 复杂业务步骤编排                    │
│  ─────────────────────────────────────────────────  │
│  @Service                                             │
│  TaskInfoServiceImpl.createTask                      │
│      @Transactional → TaskCreateOrchestrator         │
│          生成ID → 解析input/DEP → 存任务和记录        │
│          → 普通任务下发code-agent / 多模型建子任务     │
│  }                                                    │
└──────────────────���──────────────────────────────────┘
       ↓ 调用 Manager1    ↓ 调用 Manager2
┌────────────────────┐  ┌────────────────────┐
│  Manager 层         │  │  Manager 层         │
│  (ai24-core)       │  │  (ai24-core)       │
│  ──────────────    │  │  ──────────────    │
│  @Component        │  │  @Component        │
│  TaskInfoManager   │  │  TaskRecordManager │
│  职责：管理单表     │  │  职责：管理单表     │
│  ──────────────    │  │  ──────────────    │
│  @Autowired        │  │  @Autowired        │
│  TaskInfoMapper    │  │  TaskRecordMapper  │
│                    │  │                    │
│  save(task) {      │  │  create(record) {  │
│    mapper.insert() │  │    mapper.insert() │
│  }                 │  │  }                 │
└────────────────────┘  └────────────────────┘
       ↓ 调用 Mapper       ↓ 调用 Mapper
┌────────────────────┐  ┌────────────────────┐
│  Mapper 接口        │  │  Mapper 接口        │
│  (ai24-persist)    │  │  (ai24-persist)    │
│  ──────────────    │  │  ──────────────    │
│  @Mapper           │  │  @Mapper           │
│  TaskInfoMapper    │  │  TaskRecordMapper  │
│  extends           │  │  extends           │
│  BaseMapper<DO>    │  │  BaseMapper<DO>    │
│  ──────────────    │  │  ──────────────    │
│  自动提供：         │  │  自动提供：         │
│  - insert()        │  │  - insert()        │
│  - selectById()    │  │  - selectById()    │
│  - updateById()    │  │  - updateById()    │
│  - deleteById()    │  │  - deleteById()    │
└────────────────────┘  └────────────────────┘
       ↓ 执行 SQL          ↓ 执行 SQL
┌─────────────────────────────────────────────────────┐
│  MyBatis (ORM 框架)                                  │
│  职责：SQL 执行、结果映射                            │
│  ─────────────────────────────────────────────────  │
│  - 将 Java 方法调用转换为 SQL                        │
│  - 执行 SQL                                          │
│  - 将结果映射为 Java 对象                            │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Database (MySQL)                                    │
│  ─────────────────────────────────────────────────  │
│  task_info 表                                        │
│  task_record 表                                      │
│  task_report 表                                      │
│  ...                                                 │
└─────────────────────────────────────────────────────┘
```

---

## 🔄 完整请求流程示例：创建任务

### 场景：用户点击"创建任务"按钮

```
【第1步：前端发送请求】
POST http://localhost:8080/api/taskInfo/create
Body: {
  "taskName": "开发登录功能",
  "input": "{\"depUrl\":\"http://dep.vdian.net/#/taskDetail?id=236628\",\"flowType\":\"backend\"}",
  "multiModel": false
}

         ↓

【第2步：Controller 接收】
TaskInfoController.createTask(request)
- 参数和登录用户校验
- 日常/预发管理员权限校验
- 普通用户命中 PRD 自动流程迭代时默认拒绝手工创建；管理员或首个关联需求命中 `MANUAL_CREATE_REQUIREMENT_ID_WHITELIST` 时放行
- 按 orchestrationNo 路由普通任务或编排任务

         ↓

【第3步：普通任务进入 Service / Orchestrator】
TaskInfoServiceImpl.createTask(...) 负责事务入口
TaskCreateOrchestrator.createTask(...) 负责编排创建步骤

  步骤3.1：创建任务记录
  taskInfoManager.save(taskInfo)
    ↓
  TaskInfoMapper.insert(taskInfo)
    ↓
  SQL: INSERT INTO task_info (task_id, task_name, ...) VALUES (...)
    ↓
  task_info 表新增一条记录
  
  步骤3.2：创建初始对话记录
  taskRecordManager.create(record)
    ↓
  TaskRecordMapper.insert(record)
    ↓
  SQL: INSERT INTO task_record (task_id, record_id, ...) VALUES (...)
    ↓
  task_record 表新增一条记录
  
  步骤3.3：普通任务调用外部 Agent 系统
  taskPerformService.performTask(request)
    ↓
  HTTP POST code-agent /task/perform

如果 `orchestrationNo > 0`，则改走 RequirementFlowService：
创建编排主任务 → 固定编排模板版本 → 推进首节点 → 节点任务执行。

         ↓

【第4步：返回响应】
Controller 返回：
{
  "success": true,
  "code": "200",
  "message": "操作成功",
  "data": "T20260708001"  ← 新创建的任务ID
}

         ↓

【第5步：前端显示】
页面跳转到任务详情页
实时显示 Claude Agent 的执行过程
```

---

## 💡 关键概念深入理解

### 1. MyBatis vs JDBC

#### JDBC 方式（老方法，很麻烦）
```java
// 需要手写大量代码
Connection conn = DriverManager.getConnection(url, user, password);
String sql = "INSERT INTO task_info (task_id, task_name) VALUES (?, ?)";
PreparedStatement stmt = conn.prepareStatement(sql);
stmt.setString(1, "T001");
stmt.setString(2, "开发登录");
stmt.executeUpdate();

ResultSet rs = stmt.executeQuery("SELECT * FROM task_info WHERE id = 1");
while (rs.next()) {
    TaskInfoDO task = new TaskInfoDO();
    task.setId(rs.getLong("id"));
    task.setTaskId(rs.getString("task_id"));
    task.setTaskName(rs.getString("task_name"));
    // ... 每个字段都要手动映射
}
stmt.close();
conn.close();
```

#### MyBatis 方式（新方法，简单！）
```java
// Mapper 接口
@Mapper
public interface TaskInfoMapper extends BaseMapper<TaskInfoDO> {
    // 不需要写任何实现代码！
}

// 使用
TaskInfoDO task = new TaskInfoDO();
task.setTaskId("T001");
task.setTaskName("开发登录");
taskInfoMapper.insert(task);  // 一行搞定！

TaskInfoDO result = taskInfoMapper.selectById(1L);  // 自动映射到对象
```

**MyBatis 的优势**：
- ✅ 自动生成基础 CRUD 方法
- ✅ 自动处理结果映射（数据库行 → Java 对象）
- ✅ 自动管理连接、Statement、ResultSet
- ✅ 支持复杂查询（写在 XML 里）
- ✅ 类型安全（编译时检查）

---

### 2. 事务管理（@Transactional）

#### 什么是事务？

**事务 = 一组操作要么全成功，要么全失败**

**生活例子**：银行转账
```
张三给李四转账 100 元：
1. 张三账户 -100
2. 李四账户 +100

如果步骤1成功，步骤2失败（系统崩溃）
→ 没有事务：张三的钱没了，李四也没收到（钱丢了！）
→ 有事务：自动回滚，张三的钱还在
```

#### 代码中的事务

```java
@Transactional(rollbackFor = Exception.class)
public String createTask(...) {
    // 操作1：插入 task_info
    taskInfoManager.save(task);
    
    // 操作2：插入 task_record
    taskRecordManager.create(record);
    
    // 操作3：调用外部服务
    externalService.call();
    
    // 如果操作3抛异常，操作1和操作2会自动回滚（撤销）
}
```

**没有事务的后果**：
- task_info 插入成功
- task_record 插入失败
- 数据不一致！任务存在但没有记录

**有事务的保证**：
- 要么都成功
- 要么都失败（自动回滚）
- 数据永远一致

---

### 3. 依赖注入（@Autowired）

#### 什么是依赖注入？

**不需要自己 new 对象，Spring 自动帮你创建并注入**

```java
// ❌ 传统方式（自己 new）
public class TaskInfoServiceImpl {
    private TaskInfoManager manager = new TaskInfoManager();
    // 问题：new 太多次，浪费内存，难以管理
}

// ✅ Spring 方式（依赖注入）
public class TaskInfoServiceImpl {
    @Autowired
    private TaskInfoManager manager;
    // Spring 自动创建一个 TaskInfoManager 实例并注入
    // 整个应用共用一个实例（单例模式）
}
```

**好处**：
- ✅ 不需要手动 new
- ✅ 自动管理对象生命周期
- ✅ 方便测试（可以注入 Mock 对象）

---

## 🎓 分层的好处

### 1. 职责清晰

```
Controller: "我只管接收请求和返回响应"
Service:    "我负责业务逻辑编排"
Manager:    "我负责某张表的数据管理"
Mapper:     "我负责执行 SQL"
```

每层只做自己的事，**单一职责原则**。

---

### 2. 易于维护

```
需求变更：改业务逻辑
→ 只需要改 Service 层

需求变更：改数据库查询
→ 只需要改 Mapper 层

不会牵一发而动全身
```

---

### 3. 可复用

```
TaskInfoManager.getById()
可以被多个 Service 调用：
- TaskInfoService
- TaskRecordService
- WorkflowService
```

---

### 4. 易于测试

```java
// 测试 Service 时，Mock Manager
@Test
public void testCreateTask() {
    TaskInfoManager mockManager = Mockito.mock(TaskInfoManager.class);
    when(mockManager.save(any())).thenReturn(true);
    
    TaskInfoService service = new TaskInfoServiceImpl();
    service.setManager(mockManager);
    
    String taskId = service.createTask(...);
    assertNotNull(taskId);
}
```

---

## 📋 层级职责总结表

| 层级 | 位置 | 注解 | 职责 | 依赖 | 例子 |
|------|------|------|------|------|------|
| **Controller** | ai24-web | @RestController | 接收请求、返回响应 | Service | TaskInfoController |
| **Service 接口** | ai24-core | 无 | 定义业务方法 | 无 | TaskInfoService |
| **ServiceImpl** | ai24-core | @Service | 实现业务逻辑、编排多个 Manager | Manager, Service | TaskInfoServiceImpl |
| **Manager** | ai24-core | @Component | 管理单表数据、封装查询 | Mapper | TaskInfoManager |
| **Mapper** | ai24-persist | @Mapper | 定义数据库操作方法 | 无 | TaskInfoMapper |
| **Mapper XML** | ai24-persist/resources | 无 | 编写 SQL 实现 | 无 | TaskInfoMapper.xml |
| **DO** | ai24-persist | @TableName | 数据库表映射 | 无 | TaskInfoDO |

---

## 🔍 代码阅读技巧

### 从上往下读（理解业务流程）

```
1. 先看 Controller：了解有哪些接口
2. 再看 Service 接口：了解有哪些业务功能
3. 然后看 ServiceImpl：了解业务如何实现
4. 最后看 Manager/Mapper：了解数据如何操作
```

### 从下往上读（理解数据流转）

```
1. 先看 DO：了解数据库表结构
2. 再看 Mapper：了解有哪些数据库操作
3. 然后看 Manager：了解数据如何被封装
4. 最后看 Service：了解业务如何使用数据
```

---

## ✅ 阶段3完成检查清单

- [x] 理解 Mapper 的作用（遥控器按钮，一个功能）
- [x] 理解 Manager 的作用（部门负责人，管理单表）
- [x] 理解 Service 的作用（业务编排者，协调多个 Manager）
- [x] 理解 Controller 的作用（请求响应层）
- [x] 理解 MyBatis 替代 JDBC 的优势
- [x] 理解分层架构的好处
- [x] 理解事务管理的重要性
- [x] 理解依赖注入的便���性

---

## 🎉 恭喜完成阶段3！

你现在已经掌握了：

### 阶段1：基础组件层 ✅
- 枚举、DTO、Result 统一响应

### 阶段2：数据库层 ✅
- DO、Mapper、MyBatis Plus

### 阶段3：业务逻辑层 ✅
- Service、Manager、分层架构

---

## 🚀 下一步：阶段4 - 接口层（Controller）

准备好学习：
1. Controller 如何接收请求
2. 参数校验
3. 异常处理
4. Swagger 接口文档
5. WebSocket 实时通信

---

## 💡 核心记忆口诀

```
Mapper 是按钮，功能单一
Manager 管单表，封装查询
Service 编排者，协调全局
Controller 门面，收发请求

MyBatis 替 JDBC，简化开发
事务保一致，要么全成功
依赖自动注，Spring 帮忙
分层职责清，易维护测
```

---

**完成时间**：2026-07-08  
**学习效果**：✅ 优秀！理解透彻，能用自己的话总结
