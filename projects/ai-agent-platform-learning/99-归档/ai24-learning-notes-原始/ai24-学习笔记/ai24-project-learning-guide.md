# AI24 项目学习指南

> 作者：专业 Java 工程师  
> 创建时间：2026-07-08  
> 目标：带你从零开始，一步一步看懂 AI24 项目

---

## 📖 目录

1. [项目概述](#项目概述)
2. [第一课：理解基础组件（commons模块）](#第一课理解基础组件commons模块)
3. [第二课：数据层理解（persist模块）](#第二课数据层理解persist模块)
4. [第三课：业务逻辑层（core模块）](#第三课业务逻辑层core模块)
5. [第四课：接口层（web模块）](#第四课接口层web模块)
6. [学习路线图](#学习路线图)

---

## 项目概述

### 什么是 AI24？

AI24 是一个**企业级 AI 任务管理平台**，主要用于：
- 管理 AI 相关的任务
- 调度任务执行
- 提供工作流编排
- 实时通信和反馈

### 技术栈

```
核心框架：Spring Boot 2.7.2 + Java 11
数据库：MySQL + MyBatis Plus 3.5.2
缓存：Redis Cluster
RPC通信：Dubbo 2.8.8
实时通信：WebSocket
接口文档：Swagger 3.0
```

### 项目架构图

```
┌─────────────────────────────────────────┐
│         ai24-web (展示层)                │  ← Controller、WebSocket、启动入口
│         接收用户请求，返回响应             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         ai24-core (业务层)               │  ← Service + Manager
│         处理核心业务逻辑                  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       ai24-persist (持久层)              │  ← Mapper + DO (数据库实体)
│       负责数据库操作                      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       ai24-commons (公共层)              │  ← DTO + 常量 + 枚举
│       提供通用工具和数据结构               │
└─────────────────────────────────────────┘
```

### 用生活例子理解

把这个系统想象成一个**餐厅**：

- **ai24-web** = 前台服务员（接待客人点餐，处理请求）
- **ai24-core** = 后厨厨师（处理订单，制作菜品）
- **ai24-persist** = 仓库管理员（管理食材库存）
- **ai24-commons** = 菜单和工具（大家都会用的东西）

---

## 第一课：理解基础组件（commons模块）

### 1.1 Result.java - 统一响应封装

**作用**：所有接口返回的数据都使用这个类包装

```java
public class Result<T> {
    private boolean success;    // 是否成功
    private String code;        // 响应码（200成功，500失败）
    private String message;     // 提示信息
    private T data;            // 实际数据（泛型，可以是任何类型）
}
```

**例子**：
```java
// 成功的情况
Result<String> result = Result.success("操作成功");
// 返回：{ success: true, code: "200", message: "操作成功", data: "操作成功" }

// 失败的情况
Result<String> result = Result.fail("用户名不能为空");
// 返回：{ success: false, code: "500", message: "用户名不能为空", data: null }
```

**类比**：就像外卖平台的统一包装盒
- success = 订单是否成功
- code = 状态码
- message = 提示信息（"配送成功"或"地址错误"）
- data = 实际的餐食

---

### 1.2 ErrorCodeEnum.java - 错误码枚举

**作用**：统一管理所有错误码和错误信息

**分类规则**：
- **1xxx** - 通用参数校验错误
- **2xxx** - DEP相关错误
- **3xxx** - 任务相关错误
- **4xxx** - 规范约定相关错误
- **5xxx** - ID生成器相关错误
- **6xxx** - 工作流相关错误
- **7xxx** - 记忆相关错误
- **8xxx** - TokenUse看板相关错误
- **9xxx** - AI效能看板相关错误
- **10xxx** - 审批事项相关错误
- **11xxx** - 需求流水相关错误
- **40xxx-50xxx** - OpenClaw管理平台相关错误

**例子**：
```java
TASK_NOT_FOUND(3001, "任务不存在")
TASK_ID_EMPTY(1002, "任务ID不能为空")
MEMORY_NOT_FOUND(7004, "记忆记录不存在")
```

**使用方式**：
```java
// 获取错误信息
ErrorCodeEnum.TASK_NOT_FOUND.getMessage(); // "任务不存在"

// 格式化错误信息
ErrorCodeEnum.DEP_URL_FORMAT_INVALID.formatMessage("xxx");
// "depUrl格式不正确: xxx, 正确格式应为..."
```

**类比**：就像快递的错误代码
- 3001 = 收件人地址不存在
- 1002 = 快递单号为空
- 每个错误都有对应的代码和说明

---

### 1.3 TaskStatusEnum.java - 任务状态枚举

**作用**：定义任务的所有可能状态

```java
public enum TaskStatusEnum {
    COMPLETED("completed", "已完成"),
    FAILED("failed", "失败"),
    IN_PROGRESS("in_progress", "进行中");
}
```

**方法**：
- `fromCode(String code)` - 根据代码获取枚举值
- `isValid(String code)` - 检查状态码是否有效

**例子**：
```java
// 根据代码获取枚举
TaskStatusEnum status = TaskStatusEnum.fromCode("completed");
System.out.println(status.getDescription()); // "已完成"

// 验证状态码
boolean valid = TaskStatusEnum.isValid("completed"); // true
boolean invalid = TaskStatusEnum.isValid("unknown"); // false
```

**类比**：就像订单状态
- COMPLETED = 已送达
- FAILED = 配送失败
- IN_PROGRESS = 配送中

---

## 第二课：数据层理解（persist模块）

### 2.1 什么是持久层？

**持久层**负责与数据库打交道，包含：
- **DO（Data Object）**：数据库实体类，对应数据库表
- **Mapper**：数据库操作接口（增删改查）
- **Mapper XML**：SQL语句文件

### 2.2 核心概念

#### MyBatis Plus
- 增强版的 MyBatis
- 自动提供基础的 CRUD 方法
- 不需要写简单的增删改查 SQL

#### 典型的表结构
```
task_info          - 任务基础信息表
task_record        - 任务执行记录表
task_report        - 任务报告表
task_feedback      - 任务反馈表
prompt_template    - 提示词模板表
spec_workflow      - 工作流表
```

---

## 第三课：业务逻辑层（core模块）

### 3.1 什么是业务层？

业务层是系统的**核心大脑**，负责：
- 处理业务规则
- 组合多个数据操作
- 实现复杂的业务逻辑

### 3.2 代码分层

```
Controller (接收请求)
    ↓
Service (业务接口)
    ↓
Manager (业务实现 + 数据管理)
    ↓
Mapper (数据库操作)
    ↓
Database (数据库)
```

**例子**：创建任务的流程
1. Controller 接收用户的创建任务请求
2. Service 定义创建任务的接口
3. Manager 实现具体逻辑：
   - 验证参数
   - 检查用户权限
   - 调用 Mapper 保存数据
   - 发送 WebSocket 通知
4. Mapper 执行数据库插入
5. 返回结果给用户

---

## 第四课：接口层（web模块）

### 4.1 什么是接口层？

接口层是系统的**门面**，负责：
- 接收 HTTP 请求
- 参数校验
- 调用业务层
- 返回响应

### 4.2 核心组件

#### Controller
- 定义 API 接口
- 处理请求路由
- 返回统一格式的响应

#### WebSocket
- 实时推送任务执行结果
- 端点：`/ws/report`

#### 配置文件
- `application.properties` - Spring 配置
- `filter.properties` - 环境配置

---

## 学习路线图

### 🟢 阶段1：基础认知（1-2天）

**目标**：理解项目整体架构和基础组件

**学习内容**：
1. ✅ 阅读 CLAUDE.md，了解项目概述
2. ✅ 学习 Result.java（统一响应）
3. ✅ 学习 ErrorCodeEnum.java（错误码）
4. ✅ 学习 TaskStatusEnum.java（任务状态）
5. 📝 理解其他枚举类：
   - AgentTypeEnum（Agent类型）
   - MemoryReviewStatusEnum（记忆审核状态）
   - RequirementStatusEnum（需求状态）

**练习任务**：
- [ ] 找到所有枚举类文件
- [ ] 理解每个枚举的作用
- [ ] 尝试在代码中找到使用这些枚举的地方

---

### 🟡 阶段2：数据层探索（2-3天）

**目标**：理解数据库表结构和实体类

**学习内容**：
1. 学习核心表结构（从 SQL 文件或 DO 类）
2. 理解 DO（Data Object）的作用
3. 学习 Mapper 接口
4. 了解 MyBatis Plus 的基础用法

**关键表**：
- `task_info` - 任务信息
- `task_record` - 任务记录
- `prompt_template` - 提示词模板
- `spec_workflow` - 工作流

**练习任务**：
- [ ] 找到 TaskInfoDO.java，理解字段含义
- [ ] 找到 TaskInfoMapper.java，看看有哪些方法
- [ ] 找到对应的 SQL 建表语句
- [ ] 画出核心表的关系图

---

### 🟠 阶段3：业务逻辑理解（3-4天）

**目标**：理解核心业务流程

**学习内容**：
1. 学习 Service 和 Manager 的区别
2. 理解任务管理的核心流程
3. 学习提示词模板管理
4. 了解工作流管理

**核心业务**：
- 任务创建
- 任务执行
- 任务反馈
- 提示词模板管理
- 工作流管理

**练习任务**：
- [ ] 找到 TaskInfoService 和 TaskInfoManager
- [ ] 画出"创建任务"的完整流程图
- [ ] 理解 WebSocket 推送机制
- [ ] 找到任务状态流转的代码

---

### 🔴 阶段4：接口层掌握（2-3天）

**目标**：理解 API 接口设计和调用流程

**学习内容**：
1. 学习 Controller 的编写规范
2. 理解 Swagger 接口文档
3. 学习 WebSocket 的使用
4. 了解 Dubbo RPC 调用

**关键文件**：
- TaskInfoController.java
- ReportWebSocketHandler.java
- Swagger 配置

**练习任务**：
- [ ] 找到所有 Controller 类
- [ ] 访问 Swagger 接口文档（http://localhost:8080/swagger-ui/）
- [ ] 尝试调用一个简单的接口
- [ ] 理解 WebSocket 连接流程

---

### 🎯 阶段5：综合实战（持续）

**目标**：通过实际案例串联所有知识点

**实战项目**：
1. **追踪一个完整请求**：
   - 从用户访问接口开始
   - 到 Controller 接收
   - 到 Service 处理
   - 到 Mapper 操作数据库
   - 最后返回响应

2. **阅读核心功能代码**：
   - 任务创建功能
   - 任务查询功能
   - WebSocket 推送功能

3. **尝试小改动**：
   - 添加一个新的错误码
   - 修改一个提示信息
   - 添加一个查询条件

---

## 核心概念速查表

### Java 注解

| 注解 | 作用 | 例子 |
|------|------|------|
| `@Data` | Lombok自动生成getter/setter | `@Data public class User {}` |
| `@Service` | 标记为Service层组件 | `@Service public class TaskService {}` |
| `@RestController` | 标记为Controller层 | `@RestController public class TaskController {}` |
| `@Autowired` | 自动注入依赖 | `@Autowired private TaskService taskService;` |

### 常见术语

| 术语 | 解释 | 例子 |
|------|------|------|
| **DTO** | Data Transfer Object，数据传输对象 | 用于不同层之间传递数据 |
| **DO** | Data Object，数据库实体对象 | 对应数据库表 |
| **VO** | View Object，视图对象 | 用于前端展示 |
| **枚举** | 固定的一组值 | 任务状态：已完成、失败、进行中 |
| **泛型** | 类型参数化 | `Result<T>` 中的 T 可以是任何类型 |

---

## 下一步行动

### 立即开始

1. **打开项目**：用 IDEA 打开 ai24 项目
2. **运行项目**：
   ```bash
   cd ai24-web
   mvn spring-boot:run
   ```
3. **访问接口文档**：http://localhost:8080/swagger-ui/
4. **开始阅读代码**：从 Result.java 开始

### 学习建议

✅ **循序渐进**：不要试图一次理解所有代码  
✅ **画图辅助**：多画架构图、流程图  
✅ **实际运行**：边看代码边运行，加深理解  
✅ **做笔记**：记录不懂的地方，逐个攻破  
✅ **提问讨论**：遇到问题及时讨论  

### 推荐工具

- **IDEA** - Java 开发 IDE
- **Postman** - 接口测试工具
- **Navicat** - 数据库管理工具
- **draw.io** - 画图工具

---

## 常见问题 FAQ

### Q1: 为什么要分这么多模块？

**答**：这是**模块化设计**的体现：
- 职责清晰：每个模块负责特定功能
- 易于维护：修改某个模块不影响其他模块
- 可复用：commons 模块可以被其他项目使用
- 团队协作：不同团队可以负责不同模块

### Q2: DTO 和 DO 有什么区别？

**答**：
- **DO（Data Object）**：数据库实体，字段与数据库表一一对应
- **DTO（Data Transfer Object）**：数据传输对象，用于不同层之间传递数据

**例子**：
```java
// DO - 数据库表对应
class TaskInfoDO {
    Long id;
    String taskName;
    Date createTime;
    // ... 所有数据库字段
}

// DTO - 接口返回
class TaskInfoDTO {
    Long id;
    String taskName;
    String createTimeStr;  // 格式化后的时间
    // ... 只包含需要返回的字段
}
```

### Q3: 为什么要用枚举？

**答**：枚举的优势：
- **类型安全**：编译时检查，不会写错
- **代码可读**：`TaskStatusEnum.COMPLETED` 比 `"completed"` 更清晰
- **集中管理**：所有状态定义在一个地方
- **便于维护**：修改状态只需改一个地方

### Q4: 什么是 Spring Boot？

**答**：Spring Boot 是 Java 企业级应用开发框架：
- **简化配置**：约定优于配置
- **内置服务器**：不需要部署到 Tomcat
- **自动装配**：自动配置常用组件
- **快速开发**：专注业务逻辑，而不是配置

---

## 学习检查清单

### 第一周目标

- [ ] 理解项目的整体架构
- [ ] 掌握 Result 统一响应的使用
- [ ] 理解所有错误码的分类
- [ ] 掌握任务状态枚举的使用
- [ ] 能够说出 5 个核心模块的作用
- [ ] 找到并理解 3 个以上的 DTO 类

### 第二周目标

- [ ] 理解核心数据库表结构
- [ ] 能够读懂 Mapper 接口
- [ ] 理解 Service 和 Manager 的区别
- [ ] 追踪一个完整的请求流程
- [ ] 能够修改一个简单的业务逻辑

### 第三周目标

- [ ] 理解 WebSocket 推送机制
- [ ] 能够调用 Swagger 接口
- [ ] 理解 Dubbo RPC 的作用
- [ ] 能够独立完成一个小功能
- [ ] 画出核心业务的流程图

---

## 总结

学习一个新项目就像**探索一座城市**：

1. **先看地图**（整体架构）
2. **找主干道**（核心流程）
3. **探索街区**（各个模块）
4. **体验生活**（实际运行）

记住：**不要试图一次理解所有细节**，先建立整体认知，再逐步深入。

祝你学习顺利！🎉

---

**下一步**：我们从 commons 模块的其他枚举类开始，继续深入学习。准备好了吗？
