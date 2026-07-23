# commands_container.py 学习总结

> 归档说明：本文基于旧版固定命令和旧 GET 模板接口编写。当前实现请阅读 [commands_container详解.md](../../03-业务流程/commands_container详解.md)。

> 本文档总结 `commands_container.py` 模块的学习要点和核心理解。

---

## 一、模块定位

**commands_container.py = OpenSpec 命令处理中枢**

```
作用：将用户命令（/openspec:proposal）转换成 Claude 可理解的完整提示词
位置：位于 main.py 和 claude_agent_sdk_wrapper.py 之间
职责：命令识别、模板获取、提示词组装
```

---

## 二、核心流程

### 完整的命令处理链路

```
AI24 用户界面
  ↓
POST /task/query
{
  "taskId": "task_123",
  "input": "/openspec:proposal 实现支付功能"
}
  ↓
main.py 接收请求
  ↓
调用 CommandsContainer
  ├─ is_command() → True（识别为命令）
  │
  ├─ process_command()
  │   ├─ 解析：command_name = "/openspec:proposal"
  │   │        extra_prompt = "实现支付功能"
  │   │
  │   ├─ 从 AI24 获取模板
  │   │   GET /api/template/tpl_backend_001/openspec:proposal
  │   │   返回：800+ 字的架构师提示词
  │   │
  │   └─ 拼接：基础模板 + "实现支付功能"
  │
  └─ 返回：(完整提示词, "openspec_proposal")
  ↓
service.query(task_id, 完整提示词)
  ↓
Claude 执行任务 ✅
```

---

## 三、三个核心方法

### 1. is_command() - 命令识别

```python
作用：判断输入是否是命令
逻辑：
  1. 以 '/' 开头 → 可能是命令
  2. '/interrupt' → 不是命令（中断信号）
  3. pure 任务 → 不是命令（普通输入）
  4. 其他 → 是命令 ✅

特殊处理：
  - pure 任务中 "/home/user/file.txt" 不是命令，是文件路径
  - 避免误判，保证灵活性
```

### 2. _fetch_prompt_from_ai24() - 获取模板

```python
作用：从 AI24 管理平台获取工作流模板
机制：
  - 指数退避重试（1s → 2s → 4s）
  - 错误分类处理（系统错误 vs 未找到模板）
  - 最多重试 3 次

API：GET {AI24_URL}/api/template/{template_id}/{command_name}
返回：promptContent（800-1000+ 字的提示词）
```

### 3. process_command() - 命令处理

```python
作用：完整的命令处理流程
步骤：
  1. 解析命令和额外提示词
  2. 从 AI24 获取基础模板
  3. 拼接完整提示词（最后一步）
  4. 返回 (完整提示词, 命令类型)

支持：
  - 命令后附加额外需求
  - 不同 template_id 对应不同模板
```

---

## 四、关键设计亮点

### 1️⃣ 指数退避重试

```python
retry_delay = 1  # 初始 1 秒

第1次失败 → 等待 1 秒
第2次失败 → 等待 2 秒  (retry_delay *= 2)
第3次失败 → 等待 4 秒
第4次失败 → 抛出异常

优势：
  ✅ 避免频繁重试导致服务过载
  ✅ 给服务恢复时间
  ✅ 总等待时间：1 + 2 = 3 秒
```

### 2️⃣ 错误分类处理

```python
if response.get("code"):
    # 有错误码（如 500）→ 系统错误 → 抛出异常
    raise Exception("系统错误")
else:
    # 无错误码 → 未找到模板 → 返回 None
    return None  # 使用默认行为

为什么这样分类？
  - 系统错误：需要人工介入（抛异常）
  - 未找到模板：正常情况（返回None，使用默认）
```

### 3️⃣ 支持额外提示词

```python
用户输入："/openspec:proposal 增加登录功能"
            ↓              ↓
         命令部分      额外提示词

处理后：
  基础模板（800字）
  + "\n\n"
  + "增加登录功能"
  = 完整提示词（1000+字）

优势：
  ✅ 灵活性：在模板基础上添加具体要求
  ✅ 通用性：模板保持通用，不需要频繁修改
  ✅ 个性化：每个任务可以有特殊要求
```

### 4️⃣ 单例模式

```python
_commands_container = None

def get_commands_container():
    global _commands_container
    if _commands_container is None:
        _commands_container = CommandsContainer()
    return _commands_container

优势：
  ✅ 避免重复创建实例
  ✅ 全局共享（如果需要缓存）
  ✅ 符合其他模块设计模式
```

---

## 五、工作流模板管理

### 模板存储位置

```
❌ 不是本地存储
✅ 存储在 AI24 管理平台

AI24 数据库
  ├─ template_id: "tpl_backend_001"
  │   ├─ /openspec:proposal → "你是架构师..."
  │   ├─ /openspec:dev → "你是工程师..."
  │   └─ /openspec:test → "你是测试工程师..."
  │
  └─ template_id: "tpl_frontend_001"
      └─ /openspec:frontend → "你是前端工程师..."
```

### 为什么外部存储？

| 对比 | 本地存储 | 外部存储（当前） |
|------|----------|------------------|
| **更新** | 需重新部署 | 实时生效 ✅ |
| **管理** | 分散在各机器 | 集中管理 ✅ |
| **版本控制** | 难以同步 | 统一版本 ✅ |
| **灵活性** | 低 | 高 ✅ |
| **多租户** | 难实现 | 支持 ✅ |

---

## 六、为什么需要 CommandsContainer？

### 核心价值：职责分离 + 配置外部化

#### 没有 CommandsContainer（混乱）

```python
# main.py 里塞满了命令处理逻辑
if input_text == "/openspec:proposal":
    prompt = "你是架构师...请分析需求..."  # 硬编码
elif input_text == "/openspec:dev":
    prompt = "你是工程师...请实现代码..."  # 硬编码
elif input_text == "/openspec:test":
    prompt = "你是测试工程师...请编写测试..."  # 硬编码

问题：
  ❌ 提示词硬编码在代码里
  ❌ 修改提示词需要改代码、重新部署
  ❌ 不同 template_id 无法有不同的提示词
  ❌ main.py 代码会非常长
  ❌ 难以维护和扩展
```

#### 有 CommandsContainer（清晰）

```python
# main.py 只负责调度
is_cmd, processed_prompt, command_type = await process_custom_command(...)

if is_cmd:
    prompt = processed_prompt  # 已经处理好了
else:
    prompt = input_text

result = await service.query(task_id, prompt)

优势：
  ✅ 职责分离：main.py 负责调度，CommandsContainer 负责命令
  ✅ 配置外部化：提示词存储在 AI24，易于管理
  ✅ 灵活配置：不同 template_id 对应不同提示词
  ✅ 代码清晰：main.py 不需要关心命令细节
  ✅ 易于扩展：新增命令只需在 AI24 配置
```

### CommandsContainer 的四大作用

```
1. 命令识别（区分作用）⭐️
   明确告诉 main.py："这是命令，不是普通对话"
   
2. 命令路由
   不同的命令 → 不同的提示词模板
   
3. 模板管理（外部化）
   不同的 template_id → 不同的工作流
   
4. 提示词组装（最后一步）
   基础模板 + 用户额外需求 = 完整提示词
```

---

## 七、支持的 OpenSpec 命令

```python
# 需求分析和技术方案
/openspec:proposal [额外需求]
  → 获取架构师提示词
  → Claude 输出技术方案

# 开发实现
/openspec:dev [额外要求]
  → 获取工程师提示词
  → Claude 生成代码

# 测试设计
/openspec:test [测试重点]
  → 获取测试工程师提示词
  → Claude 编写测试用例

# 应用现有方案
/openspec:apply [应用说明]
  → 获取应用提示词
  → Claude 应用方案

# 前端实现
/openspec:frontend [前端要求]
  → 获取前端工程师提示词
  → Claude 实现前端页面
```

---

## 八、与其他模块的关系

```
AI24 管理平台
  ├─ 用户界面：发起任务
  └─ 模板存储：提供工作流提示词
        │
        ↓ HTTP 请求
main.py (Flask API)
  ├─ TaskQueryResource：接收请求
  └─ 调用 CommandsContainer
        │
        ↓
CommandsContainer
  ├─ 命令识别：is_command()
  ├─ 模板获取：_fetch_prompt_from_ai24()
  └─ 提示词组装：process_command()
        │
        ↓ 返回完整提示词
claude_agent_sdk_wrapper
  └─ service.query()：调用 Claude SDK
        │
        ↓
Claude 执行任务 ✅
```

---

## 九、实际使用示例

### 场景：实现支付功能

```
1. AI24 用户输入
   "/openspec:proposal 实现支付功能"

2. CommandsContainer 处理
   a. 识别为命令 ✅
   b. 解析：
      command_name = "/openspec:proposal"
      extra_prompt = "实现支付功能"
   c. 从 AI24 获取模板（800字）
   d. 拼接：模板 + "实现支付功能"

3. Claude 接收（1000+字）
   "你是一个资深的软件架构师...
    请分析以下需求并输出详细的技术方案...
    
    实现支付功能"

4. Claude 工作
   ├─ 分析支付功能需求
   ├─ 设计技术架构
   │   ├─ 支付网关选择（支付宝/微信）
   │   ├─ 订单流程设计
   │   └─ 安全措施（签名验证）
   ├─ 选择技术栈
   │   ├─ Spring Boot
   │   ├─ MySQL
   │   └─ Redis
   └─ 输出技术方案文档 ✅

5. 下一步：用户执行 /openspec:dev
   → Claude 根据技术方案生成代码
```

---

## 十、关键学习要点

### ✅ 核心理解

1. **CommandsContainer 的本质**：命令处理的抽象层
2. **工作流模板来源**：外部存储（AI24），不是本地
3. **提示词拼装时机**：process_command() 的最后一步
4. **为什么需要它**：职责分离、配置外部化、明确指令类型

### ✅ 设计精髓

1. **指数退避重试**：避免服务过载
2. **错误分类处理**：区分系统错误和业务逻辑
3. **支持额外提示词**：灵活性和通用性兼顾
4. **单例模式**：全局共享，避免重复创建

### ✅ 实践价值

1. **抽象层价值**：main.py 不需要知道提示词细节
2. **外部化配置**：修改提示词不需要改代码
3. **多租户支持**：不同 template_id 对应不同工作流
4. **易于扩展**：新增命令只需在 AI24 配置

---

## 十一、下一步学习建议

基于 commands_container.py 的学习，推荐继续学习：

### 选项1：step_planner.py（步骤规划器）⭐️ 推荐

```
为什么：
  - commands_container 获取了提示词
  - step_planner 负责分解多步骤任务
  - 两者配合完成复杂任务

学习重点：
  - 如何将大任务分解成小步骤
  - 如何规划执行顺序
  - 如何处理步骤依赖
```

### 选项2：claude_data_api.py（云端存储）

```
为什么：
  - 理解数据如何持久化到云端
  - 理解 MetaContainer 的底层实现

学习重点：
  - COS 对象存储如何使用
  - 数据结构设计
  - 读写性能优化
```

### 选项3：frontend_preview_service.py（前端预览）

```
为什么：
  - 理解前端页面如何预览
  - 理解设计稿如何对比

学习重点：
  - 前端预览服务器如何启动
  - 静态文件如何托管
  - 热更新如何实现
```

---

## 十二、学习心得

### 个人理解总结

```
1. AI24 传递参数和指令 ✅
   - taskId, input, templateId
   
2. 选择对应的提示词 ✅
   - 根据 templateId + command 从 AI24 获取
   
3. 拼接指令一起发送给 Claude ✅
   - 基础模板 + 用户额外需求
   
4. 重试和错误分类机制 ✅
   - 指数退避重试
   - 区分系统错误和业务逻辑
   
5. 工作流模板外部存储 ✅
   - 存储在 AI24 管理平台，不是本地
   
6. 提示词最后拼装 ✅
   - 在 process_command() 最后一步
   
7. CommandsContainer 的区分作用 ✅
   - 明确指令类型，职责分离
```

### 关键顿悟点

```
1. 为什么不本地存储模板？
   → 实时生效、集中管理、易于更新

2. 为什么需要 CommandsContainer？
   → 职责分离、配置外部化、代码清晰

3. 为什么支持额外提示词？
   → 灵活性和通用性兼顾

4. 为什么用指数退避重试？
   → 避免服务过载，给恢复时间
```

---

**学习完成时间**：[当前时间]  
**理解程度**：✅ 完全理解  
**下一步**：继续学习 step_planner.py 或其他推荐模块
