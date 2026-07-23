# AI24 接口层学习 - 阶段4：Controller 层

> 学习时间：2026-07-08  
> 目标：理解 HTTP 接口如何设计，Controller 如何工作

---

## 🎯 Controller 是什么？

**Controller = 餐厅前台**

```
用户（前端）         Controller（前台）      Service（后厨）
    │                      │                      │
    │  发送请求            │                      │
    ├─────────────────────>│                      │
    │  "我要创建任务"      │  接收请求            │
    │                      │  校验参数            │
    │                      │  获取用户信息        │
    │                      ├─────────────────────>│
    │                      │  "帮我创建任务"      │
    │                      │                      │ 处理业务逻辑
    │                      │                      │ 操作数据库
    │                      │<─────────────────────┤
    │                      │  返回任务ID          │
    │  返回响应            │                      │
    │<─────────────────────┤                      │
    │  {"success": true}   │                      │
```

---

## 📝 TaskInfoController 详解

### 类定义（当前实现）

```java
@Api(tags = "任务信息管理")  // Swagger 文档标签
@Slf4j                       // Lombok 日志注解
@RestController              // 标记为 REST 风格的 Controller
@RequestMapping("/api/taskInfo/")  // 基础路径
public class TaskInfoController {
    
    @Autowired
    private TaskInfoService taskInfoService;  // 注入 Service
    
    @Autowired
    private TaskRecordService taskRecordService;
    
    // ... 更多依赖注入
}
```

---

## 🔑 核心注解说明

### 1. @RestController

```java
@RestController = @Controller + @ResponseBody
```

**作用**：
- 标记这是一个 Controller 类
- 自动将返回值转换为 JSON 格式

**对比**：

```java
// 传统 Controller（返回页面）
@Controller
public class PageController {
    @GetMapping("/home")
    public String home() {
        return "home.html";  // 返回页面
    }
}

// REST Controller（返回 JSON）
@RestController
public class ApiController {
    @GetMapping("/api/data")
    public ApiResponse<String> getData() {
        return ApiResponse.success("数据");  // 自动转为 JSON
    }
}
```

---

### 2. @RequestMapping

```java
@RequestMapping("/api/taskInfo/")
```

**作用**：定义基础路径

**完整 URL 组成**：

```
http://localhost:8080/api/taskInfo/create
│                    │└─────────────┘└─────┘
│                    │      │            │
│                    │   基础路径    方法路径
│                    │
│               项目访问地址
```

---

### 3. HTTP 方法注解

```java
@PostMapping("/create")   // POST 请求，用于创建
@GetMapping("/query")     // GET 请求，用于查询
@PutMapping("/{id}")      // PUT 请求，用于更新
@DeleteMapping("/{id}")   // DELETE 请求，用于删除
```

**RESTful 风格**：

| HTTP 方法 | 用途 | 例子 |
|-----------|------|------|
| **GET** | 查询数据 | `/api/taskInfo/123` 查询任务 |
| **POST** | 创建数据 | `/api/taskInfo/create` 创建任务 |
| **PUT** | 更新数据 | `/api/taskInfo/123` 更新任务 |
| **DELETE** | 删除数据 | `/api/taskInfo/123` 删除任务 |

---

## 🎬 创建任务接口详解（当前实现）

### 完整代码结构

```java
@ApiOperation("创建任务")
@PostMapping("/create")
public ApiResponse<String> createTask(
    @ApiParam("创建任务请求") 
    @RequestBody CreateTaskRequest request) {
    
    try {
        // 1. 参数校验
        if (request == null) {
            return ApiResponse.error("请求对象不能为空");
        }
        
        // 2. 获取用户信息
        String username = SSOUtil.getUser().getName();
        String realName = SSOUtil.getUser().getNick();
        
        // 3. 权限校验
        boolean isAdmin = IdentityCheckUtils.isInWhitelist(
            username, PromotionDynConfig.ALLOWED_USERS_NAME);
        if (EnvUtils.isDaily() || EnvUtils.isPre()) {
            if (!isAdmin) {
                return ApiResponse.error("权限不足");
            }
        }

        // 4. PRD 自动流程覆盖的迭代，禁止普通用户重复手工创建
        if (!isAdmin && isManualCreationBlocked(request.getInput())) {
            return ApiResponse.error(
                "该迭代已启用PRD自动流程，不支持手动创建工厂任务，请通过PRD流程提交");
        }
        
        // 5. 根据 orchestrationNo 路由普通任务或编排任务
        String taskId = routeTaskCreation(request, username, realName);
        
        // 6. 返回结果
        return ApiResponse.success(taskId);
        
    } catch (Ai24BusinessException e) {
        // 业务异常
        return ApiResponse.error(e.getMessage());
    } catch (Exception e) {
        // 系统异常
        log.error("[创建任务未知异常]", e);
        return ApiResponse.error("系统内部错误");
    }
}
```

---

## 📦 参数接收方式

### 1. @RequestBody - 接收 JSON 请求体

```java
@PostMapping("/create")
public ApiResponse<String> createTask(
    @RequestBody CreateTaskRequest request) {
    // request 自动从 JSON 转换为 Java 对象
}
```

**前端发送**：
```javascript
fetch('/api/taskInfo/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        taskName: '开发登录功能',
        input: '请实现登录',
        multiModel: false
    })
})
```

**后端接收**：
```java
CreateTaskRequest {
    taskName: "开发登录功能",
    input: "请实现登录",
    multiModel: false
}
```

---

### 2. @PathVariable - 接收路径参数

```java
@GetMapping("/{id}")
public ApiResponse<TaskInfoDO> getTask(@PathVariable Long id) {
    TaskInfoDO task = taskInfoService.getTaskById(id);
    return ApiResponse.success(task);
}
```

**请求示例**：
```
GET /api/taskInfo/123

id = 123
```

---

### 3. @RequestParam - 接收查询参数

```java
@GetMapping("/delete")
public ApiResponse<Boolean> deleteTask(@RequestParam Long id) {
    boolean result = taskInfoService.logicDeleteTask(id);
    return ApiResponse.success(result);
}
```

**请求示例**：
```
GET /api/taskInfo/delete?id=123

id = 123
```

**带默认值**：
```java
@GetMapping("/deploy")
public ApiResponse<TaskDeployResult> deploy(
    @RequestParam String taskId,
    @RequestParam(required = false, defaultValue = "daily") String env) {
    // env 如果不传，默认是 "daily"
}
```

---

## 🛡️ 参数校验

### 第82-91行：手动校验

```java
// 校验请求对象
if (request == null) {
    return ApiResponse.error("请求对象不能为空");
}

// 校验必填字段
if (!StringUtils.hasText(request.getInput())) {
    return ApiResponse.error("任务输入不能为空");
}

// 校验业务规则
if (request.getMultiModel() && CollectionUtils.isEmpty(request.getModels())) {
    return ApiResponse.error("多模型任务必须指定至少一个模型");
}
```

**为什么要校验？**

防止脏数据进入系统：
- 空指针异常
- 业务逻辑错误
- 数据库约束冲突

---

## 🔐 权限与手工创建拦截

```java
boolean isAdmin = IdentityCheckUtils.isInWhitelist(
    username, PromotionDynConfig.ALLOWED_USERS_NAME);

// 第一层：日常/预发环境需要校验管理员权限
if (EnvUtils.isDaily() || EnvUtils.isPre()) {
    if (!isAdmin) {
        log.warn("[创建任务] 权限不足, username={}, env={}", 
                username, EnvUtils.getEnvCnName());
        return ApiResponse.error("当前环境仅管理员可创建任务");
    }
}

// 第二层：PRD 自动流程覆盖的迭代，普通用户不能再手工创建
if (!isAdmin && isManualCreationBlocked(request.getInput())) {
    return ApiResponse.error(
        "该迭代已启用PRD自动流程，不支持手动创建工厂任务，请通过PRD流程提交");
}
```

**权限控制策略**：
- 日常环境：只有白名单用户可以创建
- 预发环境：只有白名单用户可以创建
- 生产环境管理员：始终可以创建，保留应急入口
- 生产环境普通用户：迭代未接入 PRD 自动流程时可以创建；即使迭代已接入，首个关联需求命中手工创建需求白名单时也可以创建

`isManualCreationBlocked` 的判断过程：

```text
input JSON
  → 读取 depUrl
  → 提取 DEP 任务 ID
  → 查询 DEP 任务详情
  → 读取第一个 requirementInfo.requirementId
  → 命中 MANUAL_CREATE_REQUIREMENT_ID_WHITELIST：直接放行
  → 未命中：继续判断 iterationId 是否命中 PRD_ITERATION_ID_WHITELIST
```

同一个 `PRD_ITERATION_ID_WHITELIST` 有两种视角：

- 对 PRD 自动事件：名单内迭代允许进入自动流程。
- 对工厂手工创建：名单内迭代默认拒绝普通用户重复创建，管理员和需求白名单中的需求除外。

`MANUAL_CREATE_REQUIREMENT_ID_WHITELIST` 是更细粒度的豁免名单：

- 配置的是 DEP 需求 ID，不是迭代 ID，也不是任务 ID。
- 只读取 `requirementInfo` 中第一个关联需求，与任务落库时的需求归属规则保持一致。
- 命中后只跳过本次“PRD 自动迭代手工拦截”，后续原有参数、DEP、创建上限等校验仍然执行。
- 名单为空时不提供需求维度豁免，行为与旧版本一致。

以下情况采用“放行”策略，让后续原有创建流程继续处理：

- 配置名单为空；
- input 不是可解析的 JSON，或没有 `depUrl`；
- DEP 查询异常；
- DEP 返回结果没有 `iterationId`。

---

## 📤 统一响应格式：ApiResponse

### 响应结构

```java
public class ApiResponse<T> {
    private boolean success;  // 是否成功
    private String message;   // 提示消息
    private T data;           // 返回数据
}
```

### 使用方式

```java
// 成功响应
return ApiResponse.success(taskId);
// 返回：{"success": true, "message": "成功", "data": "T001"}

// 失败响应
return ApiResponse.error("参数错误");
// 返回：{"success": false, "message": "参数错误", "data": null}
```

---

## 🚨 异常处理（第150-159行）

```java
try {
    // 业务逻辑
    
} catch (Ai24BusinessException e) {
    // 业务异常：已知的业务错误
    log.warn("[创建任务业务异常] error={}, message={}", 
            e.getErrorCode(), e.getMessage());
    return ApiResponse.error(e.getMessage());
    
} catch (NullPointerException e) {
    // 空指针异常：代码缺陷
    log.error("[创建任务NPE异常] 代码缺陷", e);
    return ApiResponse.error("系统内部错误，请联系管理员");
    
} catch (Exception e) {
    // 未知异常：兜底处理
    log.error("[创建任务未知异常]", e);
    return ApiResponse.error("系统内部错误，请重试");
}
```

**异常分类处理**：

| 异常类型 | 原因 | 日志级别 | 返回信息 |
|---------|------|---------|---------|
| **Ai24BusinessException** | 业务错误 | WARN | 错误详情 |
| **NullPointerException** | 代码缺陷 | ERROR | 联系管理员 |
| **Exception** | 未知错误 | ERROR | 请重试 |

---

## 🎨 常见接口模式

### 模式1：创建接口

```java
@PostMapping("/create")
public ApiResponse<String> create(@RequestBody Request req) {
    // 1. 校验参数
    // 2. 获取用户信息
    // 3. 调用 Service 创建
    // 4. 返回 ID
    String id = service.create(...);
    return ApiResponse.success(id);
}
```

---

### 模式2：查询单个

```java
@GetMapping("/{id}")
public ApiResponse<TaskInfoDO> getById(@PathVariable Long id) {
    TaskInfoDO task = service.getById(id);
    return ApiResponse.success(task);
}
```

---

### 模式3：查询列表（分页）

```java
@GetMapping("/list")
public ApiResponse<Page<TaskInfoDO>> list(
    @RequestParam(defaultValue = "1") Integer pageNum,
    @RequestParam(defaultValue = "10") Integer pageSize,
    @RequestParam(required = false) String keyword) {
    
    Page<TaskInfoDO> page = service.page(pageNum, pageSize, keyword);
    return ApiResponse.success(page);
}
```

---

### 模式4：更新接口

```java
@PutMapping("/{id}")
public ApiResponse<Boolean> update(
    @PathVariable Long id,
    @RequestBody UpdateRequest req) {
    
    boolean result = service.update(id, req);
    return ApiResponse.success(result);
}
```

---

### 模式5：删除接口

```java
@DeleteMapping("/{id}")
public ApiResponse<Boolean> delete(@PathVariable Long id) {
    // 1. 权限校验：只能删除自己的
    String currentUser = SSOUtil.getUser().getName();
    TaskInfoDO task = service.getById(id);
    
    if (!currentUser.equals(task.getUserName())) {
        return ApiResponse.error("只能删除自己的任务");
    }
    
    // 2. 逻辑删除
    boolean result = service.logicDelete(id);
    return ApiResponse.success(result);
}
```

---

## 📊 完整的请求响应流程

```
【用户操作】
前端点击"创建任务"按钮

         ↓

【前端发送请求】
POST http://localhost:8080/api/taskInfo/create
Content-Type: application/json

{
  "taskName": "开发登录功能",
  "input": "请实现登录",
  "multiModel": false
}

         ↓

【Spring MVC 处理】
1. 接收 HTTP 请求
2. 根据 URL 和 HTTP 方法找到对应的 Controller 方法
3. 将 JSON 转换为 CreateTaskRequest 对象
4. 调用 Controller 方法

         ↓

【Controller 处理】
TaskInfoController.createTask(request)

  1. 参数校验
     ✓ request 不为空
     ✓ input 不为空
     ✓ multiModel 规则校验
  
  2. 获取用户信息
     username = "zhangsan"
     realName = "张三"
  
  3. 权限校验
     ✓ 环境检查
     ✓ 白名单检查
  
  4. PRD 自动流程迭代检查
     ✓ 从 input.depUrl 提取 DEP ID
     ✓ 查询 iterationId 和第一个关联 requirementId
     ✓ 需求命中手工白名单则放行
     ✓ 其余普通用户命中迭代名单则拒绝
     ✓ 管理员保留应急创建权限

  5. 创建路由
     orchestrationNo > 0 → 创建编排任务
     其他情况            → 调用 taskInfoService.createTask 创建普通任务
     
  6. 返回响应
     return ApiResponse.success("T20260708001");

         ↓

【Spring MVC 处理】
1. 将 ApiResponse 对象转换为 JSON
2. 设置 HTTP 响应头
3. 发送响应

         ↓

【前端接收响应】
HTTP 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "成功",
  "data": "T20260708001"
}

         ↓

【前端处理】
- 显示成功提示
- 跳转到任务详情页
- 开始轮询任务状态
```

---

## 🎯 Controller 的职责边界

### ✅ Controller 应该做的

1. **接收请求**
   - 绑定参数
   - 校验参数格式

2. **权限控制**
   - 用户认证
   - 权限校验
   - 创建入口的访问策略和重复触发保护

3. **调用 Service**
   - 传递参数
   - 获取结果

4. **返回响应**
   - 统一格式
   - 异常处理

---

### ❌ Controller 不应该做的

1. **复杂业务逻辑**
   ```java
   // ❌ 错误：在 Controller 写业务逻辑
   @PostMapping("/create")
   public ApiResponse create(...) {
       TaskInfoDO task = new TaskInfoDO();
       task.setTaskId(UUID.randomUUID());
       taskMapper.insert(task);  // 不应该直接操作 Mapper
       return ApiResponse.success(task.getId());
   }
   
   // ✅ 正确：Controller 只做入口策略和路由，复杂创建逻辑委托给 Service
   @PostMapping("/create")
   public ApiResponse create(...) {
       String taskId = taskInfoService.createTask(...);
       return ApiResponse.success(taskId);
   }
   ```

2. **数据库操作**
   - 不直接注入 Mapper
   - 不写 SQL

3. **复杂计算**
   - 不做数据处理
   - 不做业务计算

> 当前 `TaskInfoController` 为防止 PRD 自动流程与手工入口重复触发，会查询 DEP 迭代并做入口拦截。这是一个轻量入口策略；任务落库、节点推进和 code-agent 下发仍由 Service/Orchestrator 负责。

---

## 🔧 Swagger 接口文档

### 注解说明

```java
@Api(tags = "任务信息管理")  // 接口分组
public class TaskInfoController {
    
    @ApiOperation("创建任务")  // 接口说明
    @PostMapping("/create")
    public ApiResponse<String> createTask(
        @ApiParam("创建任务请求") @RequestBody CreateTaskRequest request) {
        // ...
    }
}
```

### 访问 Swagger UI

```
http://localhost:8080/swagger-ui/
```

**Swagger 自动生成**：
- 接口列表
- 请求参数说明
- 响应格式说明
- 在线测试功能

---

## 🎓 学习总结

### Controller 的核心作用

```
Controller = 餐厅前台服务员

职责：
1. 接待客人（接收请求）
2. 点餐（参数校验）
3. 检查是否允许从当前入口下单（环境权限、PRD 自动流程拦截）
4. 分流普通任务或编排任务
5. 传单到后厨（调用 Service）
6. 上菜（返回响应）

不做：
- 不做菜（不写业务逻辑）
- 不去仓库拿食材（不操作数据库）
```

---

### 关键注解记忆

| 注解 | 作用 | 例子 |
|------|------|------|
| `@RestController` | 标记 REST 风格 Controller | 类级别 |
| `@RequestMapping` | 定义基础路径 | `/api/taskInfo/` |
| `@PostMapping` | POST 请求（创建） | `/create` |
| `@GetMapping` | GET 请求（查询） | `/{id}` |
| `@PutMapping` | PUT 请求（更新） | `/{id}` |
| `@DeleteMapping` | DELETE 请求（删除） | `/{id}` |
| `@RequestBody` | 接收 JSON 请求体 | 方法参数 |
| `@PathVariable` | 接收路径参数 | `/{id}` 中的 id |
| `@RequestParam` | 接收查询参数 | `?id=123` |

---

### 完整分层架构回顾

```
用户/前端
   ↓ HTTP 请求
Controller    ← 接收请求、返回响应
   ↓ 调用
Service       ← 业务逻辑编排
   ↓ 调用
Manager       ← 单表数据管理
   ↓ 调用
Mapper        ← 数据库操作
   ↓ 执行
MyBatis       ← SQL 执行
   ↓
Database      ← 数据存储
```

---

## ✅ 阶段4完成检查清单

- [x] 理解 Controller 的作用（前台服务员）
- [x] 掌握核心注解（@RestController、@RequestMapping 等）
- [x] 理解参数接收方式（@RequestBody、@PathVariable、@RequestParam）
- [x] 理解参数校验的重要性
- [x] 理解权限控制
- [x] 理解统一响应格式（ApiResponse）
- [x] 理解异常处理
- [x] 理解 Controller 的职责边界

---

## 🎉 恭喜！你已经完成了所有4个阶段的学习！

### 你现在掌握的完整知识体系

```
✅ 阶段1：基础组件层（commons）
   - Result 统一响应
   - 枚举管理
   - DTO 数据传输
   - 错误码管理

✅ 阶段2：数据库层（persist）
   - DO 实体类
   - Mapper 接口
   - MyBatis Plus
   - 表关系设计

✅ 阶段3：业务逻辑层（core）
   - Service 接口
   - ServiceImpl 实现
   - Manager 数据管理
   - 事务管理

✅ 阶段4：接口层（web）
   - Controller 控制器
   - HTTP 请求处理
   - 参数校验
   - 异常处理
```

---

## 🚀 下一步建议

1. **实践操作**
   - 运行项目
   - 访问 Swagger UI
   - 测试接口

2. **阅读源码**
   - 选择一个完整功能
   - 从 Controller 追踪到 Mapper
   - 理解数据流转

3. **尝试修改**
   - 添加一个新接口
   - 修改一个查询条件
   - 添加一个字段

---

**完成时间**：2026-07-08  
**学习效果**：🌟 优秀！完整掌握了 Spring Boot 分层架构
