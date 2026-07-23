# main.py 核心业务流程详解

> main.py 是整个 code-agent 的中枢，把所有模块串联起来。本文档梳理任务从接收到执行的完整链路。

---

## 一、整体结构

main.py 在当前 `master` 已有 3900+ 行，核心分为三部分：

```
1. Flask API 资源类（REST 接口）
   ├─ TaskPerformResource   /task/perform   （任务初始化）
   ├─ TaskQueryResource     /task/query     （任务查询）⭐ 核心
   ├─ TaskInterruptResource /task/interrupt （任务中断）
   └─ 其他 20+ 个接口

2. 核心执行函数
   ├─ dispatch_task_query_message()  （分发）
   ├─ run_query_task_in_thread()     （线程包装）
   └─ execute_query_task()           （调用 Claude SDK）⭐ 核心

3. 启动与环境准备
   ├─ setup_runtime_environment()
   ├─ copy_skills/agents/settings_to_user_claude_dir()
   └─ init_langfuse() / init_coscmd_config()
```

---

## 二、两个核心入口

### 2.1 任务初始化（TaskPerformResource → /task/perform）

AI24 成功创建需要实际执行的任务时调用。任务可能来自手工创建，也可能来自 PRD 自动流程；被 AI24 入口规则拦截的请求不会到达这里。

**处理流程**：

```
POST /task/perform
{
  "taskId": "task_123",
  "depUrl": "http://dep.vdian.net/#/taskDetail?id=235459",
  "flowType": "frontend_common",
  "templateId": "xxx",
  "userName": "张三",
  ...
}
    ↓
1. 同步知识库（clone/pull knowledge + knowledge-service + app-knowledge-v2）
   - 三套仓库分别从配置读取目标分支，默认都是 main
   - 同步失败只记日志，不阻断任务初始化
    ↓
2. 解析 dep_id（从 depUrl）
    ↓
3. 保存参数到 MetaContainer
   meta_container.update(task_id, dep_id, flow_type, ...)
    ↓
4. 上报机器信息
   meta_container.report_task(task_id)  → 记录 IP + 版本号
    ↓
5. 清除旧的 task_id → session_id 映射
   TaskSessionMapper.remove_task_to_session_only(task_id)
   （重新初始化，需要清除旧会话映射）
    ↓
6. 记录任务状态 RECEIVED
    ↓
7. 启动后台线程：run_init_task_via_claude(task_id)
   （通过 Claude 调用 init-project Skill，再由 Skill 运行固定 Python 脚本）
    ↓
返回 202（已接受，后台执行）
```

**关键点**：
- ✅ 初始化是**异步**的（后台线程），立即返回 202
- ✅ 所有参数先存到 MetaContainer（供后续查询阶段使用）
- ✅ 初始化入口通过 Claude + `init-project` Skill 完成，不是旧的 `init_project MCP` 工具
- ✅ 当前 `/task/perform` 会先同步三套知识库：`knowledge`、`knowledge-service` 与 `app-knowledge-v2`
- ✅ 三套知识库各自使用配置中心分支，配置读取失败时回退到 `main`
- ⚠️ `KnowledgeRepoScheduler` 虽然实现了每小时同步，但当前 `main.py` 只实例化、没有调用 `start()`；可以确认的主动同步点是 `/task/perform`
- ✅ 当前入参不止基础字段，还包含 `enable_tdd`、`is_apply`、`case_set_id`、`app_id`、`domain`、`dependent_git_urls/dependent_git_branch`（仅 `frontend_logic`）、`real_template_id` 等任务级开关/上下文
- ⚠️ 查询阶段实际优先使用 `real_template_id` 作为命令模板和路由的 template_id，而不是只看旧字段 `template_id`

**后台初始化的真实链路**：

```
run_init_task_via_claude
    ↓ 启动本次初始化的备份监听
上报 session=IN_PROGRESS + “任务初始化中”
    ↓
service.query(keep_session=True, system_prompt="", hooks=InitStatusCheckHook)
    ↓
短提示词要求 Claude 使用 init-project Skill
    ↓
project_initialization.py
    ├─ dep_initialization：查 DEP、保存 PRD、补充 git/branch 等元数据
    └─ environment_initialization：克隆代码、准备 CLAUDE.md/OpenSpec、上报 status=100
    ↓
清会话映射、上报 IDLE、保存环境、停止本次初始化的备份监听
```

外层初始化查询虽然使用 `keep_session=True`，但初始化脚本和外层函数都会清理 `task_id → session_id` 映射，所以后续开发查询不会直接续用初始化会话。

### 2.2 任务查询（TaskQueryResource → /task/query）⭐ 核心

用户在 AI24 平台发起对话时调用。

**处理流程**：

```
POST /task/query
{
  "taskId": "task_123",
  "input": "请实现用户登录功能",   ← 支持纯文本或JSON多模态
  "model": "claude-opus-4-8",     ← 可选
  "speed": "fast",                ← 可选
  "planMode": false,              ← 可选
  "hooks": ["xxx"]                ← 可选（AI24按名下发）
}
    ↓
1. 解析 input（支持纯文本 / JSON多模态格式）
   - text 类型 → input_text
   - image 类型 → image_urls
    ↓
2. 参数校验（task_id 和 input 必填）
    ↓
3. 创建 TaskQueryMessage 对象
    ↓
4. dispatch_task_query_message(query_message)
    ↓
返回 202（已接受，后台执行）
```

**关键点**：
- ✅ 支持**多模态输入**（文本 + 图片）
- ✅ 支持动态 hooks（AI24 按名下发）
- ✅ 用户只传 task_id，不需要 session_id ✅（印证了我们之前的理解）
- ℹ️ `project_note` 类型有特殊分支：先跑模型生成笔记再写记忆库（main.py 约 2572 行），不走普通的查询任务路径

---

## 三、完整执行链路

### 3.1 三层调用结构

```
dispatch_task_query_message()      ← 分发（创建线程）
    ↓
run_query_task_in_thread()         ← 线程包装（命令处理、环境恢复）
    ↓
execute_query_task()               ← 真正调用 Claude SDK
    ↓
service.query()                    ← ClaudeAgentSDKService（单例）
```

### 3.2 dispatch_task_query_message（分发层）

```python
def dispatch_task_query_message(query_message):
    # 创建新线程执行任务（不阻塞 HTTP 响应）
    thread = threading.Thread(
        target=run_query_task_in_thread,
        args=(query_message,)
    )
    thread.daemon = True
    thread.start()
    return {'success': True, 'task_id': ...}, 202
```

**作用**：把任务丢到后台线程，立即返回 202。

### 3.3 run_query_task_in_thread（线程包装层）

这一层做了大量准备工作：

```
1. 检查并恢复任务环境
   asyncio.run(check_and_restore_task_environment(task_id))
   （多机场景下，任务可能切换到新机器，需要恢复代码/环境）
    ↓
2. 记录任务状态 RECEIVED
    ↓
3. 启动计时（StopWatch.step START）
    ↓
4. 判断是否为中断请求
   - 是 → 调用 service.interrupt_task()，上报 IDLE，返回
    ↓
5. 从 MetaContainer 获取 flow_type、template_id、ui_mcp_type
    ↓
6. 处理命令（process_custom_command）
   - 识别是否命令、获取模板、拼接提示词
    ↓
7. 命令路由判断（command_route）
    ↓
8. 装配动态 hooks
   - 文档上报 hook（enable_document_auto_upload）
   - AI24 下发的 hook（hook_names）
    ↓
9. 提取阶段标识（_extract_stage_from_prompt）
   （用于任务完成后通知 AI24 当前完成了哪个阶段）
    ↓
10. 调用 execute_query_task()
    ↓
finally: 停止计时、清理状态
```

**关键点**：
- ✅ 环境恢复是多机协作的关键（任务可以在任意机器执行）
- ✅ 命令处理、hooks 装配都在这一层完成
- ✅ finally 保证计时和状态清理

### 3.4 execute_query_task（SDK 调用层）⭐

```
1. 启动文件备份监听（start_file_backup_listener）
    ↓
2. 添加任务到计数器（task_counter）
    ↓
3. 检查中断标识（如已中断，跳过执行）
   service._get_interrupt_flag(task_id)
    ↓
4. 补充 model 参数（从 MetaContainer 获取）
    ↓
5. 上报会话状态 IN_PROGRESS
    ↓
6. 上报系统消息"收到请求，正在为您生成..."
    ↓
7. 从 MetaContainer 获取 task_metadata、project_path、flow_type
    ↓
8. 根据任务类型分流：
   ├─ 纯净任务/自由任务 → 直接 query（不插系统提示词）
   ├─ frontend_common + figma → Figma 官方 MCP
   ├─ frontend_common + figma_pat → Figma PAT 方案
   ├─ frontend_common + mastergo → MasterGo MCP
   └─ 其他 → 后端/通用流程
    ↓
9. service.query(task_id, prompt, cwd, ...)
   ← 真正调用 Claude SDK
```

**关键点**：
- ✅ 根据 flow_type + ui_mcp_type 分流（不同工作流用不同 MCP）
- ✅ project_path 来自 MetaContainer（多机共享）
- ✅ 中断标识在执行前检查（快速响应中断）

---

## 四、模块协作全景图

```
┌───────────────────────────────────────────────────────────────┐
│                      AI24 平台                                 │
│  用户创建任务 / 发起对话（只用 task_id）                        │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTP
                            ↓
┌───────────────────────────────────────────────────────────────┐
│                       main.py (Flask)                          │
│                                                                │
│  TaskPerformResource        TaskQueryResource                  │
│       │                          │                             │
│       ↓                          ↓                             │
│  MetaContainer.update()     dispatch → thread → execute        │
│  report_task()                   │                             │
│  TaskSessionMapper               │                             │
│    .remove_task_to_session       ↓                             │
│                          ┌───────────────────┐                 │
│                          │ execute_query_task │                 │
│                          └────────┬──────────┘                 │
│                                   │                            │
│  读取：MetaContainer.get()        │  分流：flow_type            │
│  ├─ project_path                  │  ├─ frontend_common        │
│  ├─ flow_type                     │  ├─ figma/mastergo         │
│  ├─ template_id                   │  └─ 后端/通用              │
│  └─ model                         ↓                            │
│                          ┌───────────────────┐                 │
│                          │ service.query()   │  ← 单例          │
│                          │ ClaudeAgentSDK    │                 │
│                          └────────┬──────────┘                 │
│                                   │                            │
│  内部：TaskSessionMapper          │  StopWatch 计时             │
│    .get_session_id()              │  MessageReporter 上报       │
│    （task_id → session_id）       ↓                            │
└───────────────────────────────────────────────────────────────┘
                            │
                            ↓
                     Claude SDK + MCP 工具
```

---

## 五、关键设计总结

### 5.1 异步执行模式

两个核心长任务入口 `/task/perform` 和 `/task/query` 都是“接收即返回 202，后台线程执行”：

```
优点：
  ✅ HTTP 请求快速返回，不阻塞
  ✅ 长任务（可能几分钟）在后台执行
  ✅ 通过 MessageReporter 实时上报进度

代价：
  ⚠️ 需要额外的状态上报机制（AI24 无法从 HTTP 响应知道结果）
```

### 5.2 MetaContainer 是数据中枢

初始化阶段写入，查询阶段读取：

```
/task/perform:  meta_container.update(所有参数)
                    ↓ 存到云端
/task/query:    meta_container.get(task_id)
                    ↓ 读取
                project_path, flow_type, model, template_id...
```

这就是为什么 MetaContainer 用**纯云端存储**——多机场景下，
初始化和查询可能在不同机器，必须共享数据。

### 5.3 分流设计（flow_type + ui_mcp_type）

```
flow_type:
  ├─ frontend_common → 前端页面（需要设计稿）
  │   ├─ ui_mcp_type = figma       → Figma 官方 MCP
  │   ├─ ui_mcp_type = figma_pat   → Figma PAT（旧方案）
  │   └─ ui_mcp_type = mastergo    → MasterGo MCP
  ├─ frontend_logic → 前端逻辑（多仓库）
  └─ 后端/通用 → 标准流程
```

不同工作流使用不同的 MCP 工具和提示词模板。

### 5.4 三层调用的职责分离

| 层级 | 函数 | 职责 |
|------|------|------|
| 分发层 | dispatch_task_query_message | 创建线程，快速返回 |
| 包装层 | run_query_task_in_thread | 环境恢复、命令处理、hooks 装配 |
| 执行层 | execute_query_task | 分流、调用 SDK |

---

## 六、印证之前的理解

### 6.1 用户只需要 task_id ✅

在 TaskQueryResource 中，请求参数只有 task_id，没有 session_id。
session_id 是在 service.query() 内部通过 TaskSessionMapper 查找的。

### 6.2 MetaContainer 纯云端存储的原因 ✅

- 初始化（/task/perform）可能在机器 A
- 查询（/task/query）可能在机器 B
- 必须通过云端共享 project_path、flow_type 等

### 6.3 双层中断机制 ✅

- execute_query_task 开头检查 interrupt_flag（Python 层）
- interrupt 请求调用 service.interrupt_task()（SDK 层）

---

## 七、待深入的问题

1. **check_and_restore_task_environment 如何恢复环境？**
   - 多机场景下如何拉取代码、恢复工作区？

2. **run_init_task_via_claude 的完整流程？**
   - 初始化如何通过 Claude + MCP 完成？

3. **service.query() 内部如何管理 session？**
   - TaskSessionMapper 在 SDK 层如何被调用？

4. **MessageReporter 如何实时上报？**
   - WebSocket 还是 HTTP 轮询？

---

**学习日期**：2026-07-08
**关联文档**：[MetaContainer深度解析](../02-数据层/MetaContainer深度解析.md)、[TaskSessionMapper深度解析](../02-数据层/TaskSessionMapper深度解析.md)
**下一目标**：service.query() 内部实现 或 环境恢复机制
