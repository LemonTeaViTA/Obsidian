# Claude Agent 工作流详解 - AI工程师面试核心（代码实现版）

## 📌 为什么理解 Claude Agent 工作流很重要？

作为 AI 工程师，你需要深入理解：
- **Claude 如何"思考"并执行任务**：迭代循环 think → tool → result → think
- **Session 持久化机制**：如何保证对话连续性
- **工具调用链路**：Claude 如何决定调用哪个工具
- **错误处理**：工具执行失败后 Claude 如何应对

面试官会问：**Claude 拿到一个 PRD 后，是如何一步步完成代码生成的？**

**本文档特点：**
- ✅ 包含实际代码实现
- ✅ 标注关键文件路径
- ✅ 展示核心类和方法
- ✅ 串联完整调用链路

---

## 🗂️ 核心文件路径（代码定位）

学习 Claude Agent 工作流，需要重点关注这些文件：

| 文件 | 作用 | 关键类/方法 |
|------|------|------------|
| **claude_agent_sdk_wrapper.py** | Claude Agent SDK 封装服务 | `ClaudeAgentSDKService.query()` |
| **task_session_mapper.py** | Task ID ↔ Session ID 映射管理 | `TaskSessionMapper.set_mapping()` |
| **main.py** | Flask API 入口 | `/api/task/execute` 接口 |
| **hooks/__init__.py** | Hook 注册中心 | 所有 Hook 的导入和配置 |
| **claude_message_renderer.py** | 消息渲染器（日志格式化） | `ClaudeMessageRenderer.render_message()` |

---

## 🔄 Claude Agent 执行任务的完整流程（代码视角）

### 1. 整体流程图（含代码调用链）

```
ai24 平台 POST /api/task/execute
    ↓
main.py: ExecuteTask.post()
    ↓
claude_agent_sdk_wrapper.py: ClaudeAgentSDKService.query()
    ↓  ① 从 TaskSessionMapper 获取 session_id
    ↓  ② 构建 ClaudeAgentOptions（包含 Hook、MCP、权限配置）
    ↓  ③ 创建 ClaudeSDKClient
    ↓
ClaudeSDKClient.query(prompt, session_id)  # Claude Agent SDK
    ↓
┌─────────────────────────────────────────┐
│   Claude Agent 迭代循环（核心）          │
│                                         │
│   1. [Think] Claude 分析当前状态         │
│      - 我需要做什么？                    │
│      - 我已经知道什么？                  │
│      - 下一步该调用什么工具？            │
│                                         │
│   2. [Tool Call] 决定调用工具            │
│      - 工具名称：Read                    │
│      - 工具参数：{"file_path": "..."}   │
│                                         │
│   3. [PreToolUse Hook] 安全检查          │
│      - PathSecurityHook 检查路径         │
│      - 通过 → 继续                       │
│      - 拒绝 → 返回错误给 Claude          │
│                                         │
│   4. [Execute Tool] 执行工具             │
│      - SDK 调用 Read 工具                │
│      - 返回文件内容                      │
│                                         │
│   5. [Tool Result] 工具结果              │
│      - 成功：返回文件内容                │
│      - 失败：返回错误信息                │
│                                         │
│   6. [Think Again] Claude 分析结果       │
│      - 文件内容符合预期吗？              │
│      - 下一步需要做什么？                │
│      - 继续调用工具 or 输出最终答案？     │
│                                         │
│   循环往复，直到任务完成                 │
└─────────────────────────────────────────┘
    ↓
ClaudeSDKClient.receive_response()  # 接收响应流
    ↓
_process_response_messages()  # 处理每条消息
    ↓  ① SystemMessage → 提取 session_id，建立映射
    ↓  ② AssistantMessage → 渲染日志，上报进度
    ↓  ③ ResultMessage → 记录 token 消耗，返回结果
    ↓
[Stop Hook] StopHookCompleteStage 通知 ai24 任务完成
    ↓
对话结束，Session 持久化到云端（通过 claude_data_api）
```

---

### 2. 一个真实案例：生成用户登录功能

**PRD 输入：**
```
请在 Spring Boot 项目中实现用户登录功能，包括：
1. UserController 提供 /login 接口
2. UserService 实现登录逻辑
3. 使用 BCrypt 加密密码
```

**Claude 的迭代过程：**

#### 第1轮迭代：理解项目结构

```
[Think 1]
我需要先了解项目结构，找到 Controller 和 Service 的位置。

[Tool Call 1] Glob
{
  "pattern": "**/*Controller.java",
  "path": "/project/src"
}

[Tool Result 1]
找到文件：
- src/main/java/com/example/controller/HomeController.java
- src/main/java/com/example/controller/TaskController.java

[Think 2]
了解了 Controller 的位置在 com.example.controller 包下。
接下来看看现有的 Controller 代码风格。
```

#### 第2轮迭代：读取现有代码

```
[Tool Call 2] Read
{
  "file_path": "/project/src/main/java/com/example/controller/HomeController.java"
}

[Tool Result 2]
@RestController
@RequestMapping("/api")
public class HomeController {
    @GetMapping("/home")
    public ApiResponse<String> home() {
        return ApiResponse.success("Welcome");
    }
}

[Think 3]
明白了，项目使用 ApiResponse<T> 统一返回格式。
我需要按照这个风格写 UserController。
```

#### 第3轮迭代：创建 UserController

```
[Tool Call 3] Write
{
  "file_path": "/project/src/main/java/com/example/controller/UserController.java",
  "content": "@RestController\n@RequestMapping(\"/api/user\")\npublic class UserController {\n    @Autowired\n    private UserService userService;\n    \n    @PostMapping(\"/login\")\n    public ApiResponse<String> login(@RequestBody LoginRequest request) {\n        String token = userService.login(request.getUsername(), request.getPassword());\n        return ApiResponse.success(token);\n    }\n}"
}

[Tool Result 3]
文件创建成功

[Think 4]
UserController 已创建。接下来创建 UserService。
```

#### 第4轮迭代：创建 UserService

```
[Tool Call 4] Write
{
  "file_path": "/project/src/main/java/com/example/service/UserService.java",
  "content": "..."
}

[Tool Result 4]
文件创建成功

[Think 5]
代码已生成完成。运行测试验证一下。
```

#### 第5轮迭代：运行测试

```
[Tool Call 5] Bash
{
  "command": "cd /project && mvn test -Dtest=UserServiceTest"
}

[Tool Result 5]
Tests run: 3, Failures: 0, Errors: 0

[Think 6]
测试通过！任务完成。总结：
1. ✅ 创建了 UserController，提供 /login 接口
2. ✅ 创建了 UserService，实现登录逻辑
3. ✅ 使用 BCrypt 加密密码
4. ✅ 测试通过

[Final Output]
用户登录功能已实现，代码位于：
- src/main/java/com/example/controller/UserController.java
- src/main/java/com/example/service/UserService.java
测试全部通过。
```

**总计：6 轮迭代，5 次工具调用**

---

## 💻 核心代码实现解析

### 1. ClaudeAgentSDKService.query() - 任务执行入口

**文件位置：** `claude_agent_sdk_wrapper.py:1157-1443`

**核心逻辑：**

```python
class ClaudeAgentSDKService:
    async def query(
        self,
        prompt: str,
        task_id: Optional[str] = None,
        keep_session: bool = True,
        new_session: bool = False,
        system_prompt: Optional[str] = None,
        # ... 其他参数
        **kwargs
    ) -> None:
        """
        执行 Claude 查询（简洁的对外接口）
        
        核心流程：
        1. 获取任务锁（防止并发）
        2. 从 TaskSessionMapper 获取 session_id（支持多轮对话）
        3. 构建 ClaudeAgentOptions（配置工具、Hook、MCP）
        4. 创建 ClaudeSDKClient 并发送 query
        5. 处理响应流（_process_response_messages）
        6. 保存 session_id 映射（支持下次继续对话）
        """
        
        # 步骤1：获取任务锁（同一 task_id 只能串行执行）
        task_lock = self._get_task_lock(task_id) if task_id else None
        if task_lock:
            task_lock.acquire()
            logger.info(f"[Task {task_id}] 已获取任务锁")
            
            # 检查打断标识（用户可能点击了"停止"按钮）
            if self._get_interrupt_flag(task_id):
                logger.warning(f"[Task {task_id}] 检测到打断标识，取消执行")
                self._clear_interrupt_flag(task_id)
                return
        
        # 步骤2：从映射关系获取 session_id（只有在 keep_session=True 时）
        session_id = None
        if task_id and keep_session:
            session_id = TaskSessionMapper.get_session_id(task_id)
            if session_id:
                logger.info(f"[Task {task_id}] 从映射关系中找到 session_id: {session_id}")
            else:
                logger.info(f"[Task {task_id}] 映射关系中不存在，将使用空 session_id")
        
        # 步骤3：构建 ClaudeAgentOptions（包含所有配置）
        options = self._build_options(
            task_id=task_id,
            allowed_tools=allowed_tools,
            hooks=final_hooks,  # 包含 PathSecurityHook、GitCommitAuthorHook、Gate Hook
            mcp_servers=mcp_servers,
            session_id=session_id,  # 传入 session_id，SDK 会恢复对话历史
            system_prompt=system_prompt,
            **kwargs
        )
        
        # 步骤4：创建 ClaudeSDKClient 并发送查询
        async with ClaudeSDKClient(options=options) as client:
            logger.info(f"[Session {session_id}] [Task {task_id}] 创建新的 ClaudeSDKClient")
            
            # 注册客户端到活跃映射（用于中断功能）
            if task_id:
                with self._client_lock:
                    self._active_clients[task_id] = client
                    self._client_loops[task_id] = asyncio.get_running_loop()
            
            # 发送查询
            await client.query(prompt, session_id=session_id)
            logger.info(f"[Session {session_id}] [Task {task_id}] 查询已发送，开始接收响应...")
            
            # 步骤5：处理响应消息流
            await self._process_response_messages(
                client, session_id, task_id, keep_session=keep_session
            )
```

**关键点：**
1. **任务锁机制**：同一 task_id 只能串行执行，避免并发冲突
2. **Session 映射**：通过 `TaskSessionMapper` 实现 task_id ↔ session_id 映射
3. **打断机制**：通过 `_interrupt_flags` 字典支持用户中断任务
4. **资源管理**：使用 `async with` 自动管理 Client 生命周期

---

### 2. TaskSessionMapper - Session 映射管理

**文件位置：** `task_session_mapper.py:40-225`

**核心逻辑：**

```python
class TaskSessionMapper:
    """
    Task Session 映射管理器（静态工具类）
    
    职责：
    - 管理 task_id 和 session_id 的双向映射
    - 持久化到云端（claude_data_api + task_data_api）
    - 内存缓存加速查询
    """
    
    # 类级别的锁，保护映射文件的线程安全读写
    _lock = threading.Lock()
    
    # 简单的内存缓存：session_id -> task_id
    _session_to_task_cache: Dict[str, str] = {}
    
    @classmethod
    def get_session_id(cls, task_id: str) -> Optional[str]:
        """
        根据 task_id 获取 session_id（从云端读取）
        
        使用场景：
        - 用户第2次提问时，需要找到之前的 session_id 继续对话
        """
        with cls._lock:
            try:
                # 从云端读取（task_data_api 以 task_id 为索引）
                session_id = task_data_api.get_data_content(
                    task_id, 
                    TaskDataType.SESSION_MAPPING
                )
                
                if session_id:
                    logger.info(f"从云端找到映射: task_id={task_id} -> session_id={session_id}")
                else:
                    logger.info(f"未找到映射: task_id={task_id}")
                
                return session_id
            except Exception as e:
                logger.error(f"读取 session_id 失败: {e}", exc_info=True)
                return None
    
    @classmethod
    def set_mapping(cls, task_id: str, session_id: str) -> bool:
        """
        设置 task_id 和 session_id 的双向映射关系
        
        使用场景：
        - Claude 首次返回 SystemMessage 时，提取 session_id 并建立映射
        
        存储策略：
        1. 更新内存缓存（session_id -> task_id）
        2. 写入 claude_data_api（以 session_id 为索引）
        3. 写入 task_data_api（以 task_id 为索引）
        """
        with cls._lock:
            try:
                # 1. 更新缓存
                cls._session_to_task_cache[session_id] = task_id
                
                # 2. 双写到云端 API（两个方向都存储，支持双向查询）
                # 以 session_id 为索引保存
                claude_data_api.save_or_update(
                    session_id=session_id,
                    data_type=ClaudeDataType.SESSION_CONFIG,
                    data=task_id
                )
                
                # 以 task_id 为索引保存
                task_data_api.save_or_update(
                    task_id=task_id,
                    data_type=TaskDataType.SESSION_MAPPING,
                    data=session_id
                )
                
                logger.info(f"建立映射关系: task_id={task_id} <-> session_id={session_id}")
                return True
            except Exception as e:
                logger.error(f"保存映射关系失败: {e}", exc_info=True)
                return False
```

**为什么需要双向映射？**
- **task_id → session_id**：用户第2次提问时，根据 task_id 找到之前的 session_id 继续对话
- **session_id → task_id**：Claude 返回消息时，根据 session_id 找到对应的 task_id 用于日志记录

**存储架构：**
```
内存缓存（快速查询）
    session_id -> task_id
    
云端存储（持久化）
    claude_data_api（以 session_id 为索引）
        key: session_id
        value: task_id
    
    task_data_api（以 task_id 为索引）
        key: task_id
        value: session_id
```

---

### 3. _process_response_messages() - 响应流处理

**文件位置：** `claude_agent_sdk_wrapper.py:1708-1900`

**核心逻辑：**

```python
async def _process_response_messages(
    self,
    client: 'ClaudeSDKClient',
    session_id: Optional[str],
    task_id: Optional[str] = None,
    keep_session: bool = True,
    options: Optional[ClaudeAgentOptions] = None
) -> tuple[List[str], Optional['ResultMessage'], int, Optional[str]]:
    """
    处理客户端响应消息流
    
    核心职责：
    1. 接收 Claude 返回的消息流（SystemMessage、AssistantMessage、UserMessage、ResultMessage）
    2. 渲染日志并上报进度到 ai24
    3. 提取 session_id 并建立映射关系
    4. 记录 token 消耗
    5. 检查工具错误并告警
    """
    
    content_parts = []
    final_result = None
    message_count = 0
    mapping_saved = False  # 标记是否已保存映射（只保存一次）
    
    try:
        # 核心：接收响应流（异步迭代器）
        async for message in client.receive_response():
            message_count += 1
            logger.info(f"[Session {session_id}] 收到第 {message_count} 条消息: {message}")
            
            # ===== 消息类型1：SystemMessage（首条消息） =====
            if isinstance(message, SystemMessage):
                # 更新任务状态为"执行中"
                status_holder = get_task_status_holder()
                status_holder.update_stage(task_id=task_id, stage=TaskStage.EXECUTING)
                
                # 提取 session_id 并建立映射（仅首次）
                if not mapping_saved and hasattr(message, 'data'):
                    msg_session_id = message.data.get('session_id')
                    if msg_session_id and keep_session and task_id:
                        TaskSessionMapper.set_mapping(task_id, msg_session_id)
                        mapping_saved = True
                        logger.info(
                            f"[Task {task_id}] 首次建立映射关系: "
                            f"task_id={task_id} <-> session_id={msg_session_id}"
                        )
            
            # ===== 打断检查（用户点击了"停止"按钮） =====
            if task_id and self._get_interrupt_flag(task_id):
                self._clear_interrupt_flag(task_id)
                logger.warning(f"[Task {task_id}] 检测到打断标识，中断消息处理")
                raise InterruptedError(f"任务 {task_id} 被打断")
            
            # ===== 消息渲染和上报 =====
            # 使用渲染器将消息转换为可读格式
            rendered_msg = self._message_renderer.render_message(message, session_id)
            
            # 判断是否应该上报该消息（过滤掉不重要的消息）
            if self._should_report_message(message, session_id):
                await self._report_coding_message(session_id, rendered_msg, task_id)
            
            # ===== 消息类型2：UserMessage（工具返回结果） =====
            if isinstance(message, UserMessage):
                # 检查 ToolResultBlock 中的错误
                if isinstance(message.content, list):
                    for block in message.content:
                        if isinstance(block, ToolResultBlock) and block.is_error:
                            # 发现工具错误，记录到错误告警日志
                            log_error_alert(
                                error_content=str(block.content),
                                task_id=task_id,
                                session_id=session_id,
                                tool_use_id=block.tool_use_id
                            )
            
            # ===== 消息类型3：AssistantMessage（Claude 的思考和工具调用） =====
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        content_parts.append(block.text)
                        logger.info(f"收到文本块: {block.text[:100]}...")
                    elif isinstance(block, ToolUseBlock):
                        logger.info(f"工具调用: {block.name}")
            
            # ===== 消息类型4：ResultMessage（任务完成） =====
            elif isinstance(message, ResultMessage):
                final_result = message
                
                # 更新任务状态为"完成"
                status_holder = get_task_status_holder()
                status_holder.update_stage(task_id=task_id, stage=TaskStage.COMPLETED)
                
                logger.info(
                    f"查询完成 - 轮数: {message.num_turns}, "
                    f"耗时: {message.duration_ms}ms"
                )
                
                # 记录 token 消耗
                if task_id and message.usage:
                    # 生成唯一 message_id（基于 session_id + num_turns + timestamp）
                    namespace = uuid.NAMESPACE_DNS
                    timestamp = datetime.now().isoformat()
                    name = f"{message.session_id}_{message.num_turns}_{timestamp}"
                    message_id = str(uuid.uuid5(namespace, name))
                    
                    # 本地记录到 StopWatch
                    tag = f"query_{task_id}_{message.num_turns}"
                    StopWatch.record_tokens(
                        task_id=task_id,
                        tag=tag,
                        usage=message.usage,
                        cost_usd=message.total_cost_usd,
                        num_turns=message.num_turns
                    )
                    
                    # 实时上报到 AI24（省略详细代码...）
    
    except Exception as e:
        logger.error(f"处理响应消息失败: {e}", exc_info=True)
        raise
```

**消息流处理关键点：**

| 消息类型 | 触发时机 | 核心操作 |
|---------|---------|---------|
| **SystemMessage** | 首条消息 | 提取 session_id，建立 task ↔ session 映射 |
| **AssistantMessage** | Claude 思考/工具调用 | 渲染日志，上报进度，提取文本内容 |
| **UserMessage** | 工具返回结果 | 检查工具错误，记录告警 |
| **ResultMessage** | 任务完成 | 记录 token 消耗，更新任务状态 |

---

## 🧠 Claude 的"思考"机制（SDK 层面）

### 1. Claude 是如何决定调用哪个工具的？（SDK 内部机制）

**Claude 的决策过程（基于 Claude Agent SDK）：**

```
输入上下文：
1. System Prompt（定义可用工具和使用规范）
2. User Prompt（用户的任务需求）
3. 历史对话（之前的工具调用和结果，存储在 Session 中）
4. 工具定义（MCP 工具的 input_schema）

Claude 内部推理（LLM 推理过程）：
1. 任务分解：登录功能需要 Controller + Service + 加密
2. 信息收集：我需要先了解项目结构
   → 选择工具：Glob（查找文件）
3. 学习现有风格：读取现有 Controller 代码
   → 选择工具：Read（读取文件）
4. 生成代码：按照现有风格创建新文件
   → 选择工具：Write（写入文件）
5. 验证结果：运行测试
   → 选择工具：Bash（执行命令）

输出（Tool Use）：
{
  "type": "tool_use",
  "name": "Glob",
  "input": {"pattern": "**/*Controller.java", "path": "/project/src"}
}
```

**SDK 层面的工具调用流程：**

```python
# claude_agent_sdk_wrapper.py:1364-1385

async with ClaudeSDKClient(options=options) as client:
    # 1. 发送 query（包含 prompt 和 session_id）
    await client.query(prompt, session_id=session_id)
    
    # 2. SDK 内部流程（简化）：
    #    ① Claude 分析 prompt + 历史对话
    #    ② Claude 决定调用工具（输出 ToolUseBlock）
    #    ③ SDK 触发 PreToolUse Hook（PathSecurityHook 检查）
    #    ④ Hook 返回 continue_=True（允许执行）
    #    ⑤ SDK 调用工具实现（如 Read 工具）
    #    ⑥ 工具返回结果
    #    ⑦ SDK 包装为 ToolResultBlock，追加到对话历史
    #    ⑧ Claude 继续下一轮思考
    
    # 3. 接收响应流
    async for message in client.receive_response():
        # AssistantMessage → Claude 的思考和工具调用
        # UserMessage → 工具返回结果
        # ResultMessage → 任务完成
        pass
```

**关键点：**
- Claude 是 **LLM（大语言模型）**，不是传统的规则引擎
- 它通过 **上下文理解** 决定下一步行动，而非预设流程
- **System Prompt** 定义了可用工具和使用规范
- **历史对话** 让 Claude 知道"我已经做了什么，还需要做什么"
- **Hook 机制** 在工具执行前强制检查（代码级拦截）

---

### 2. _build_options() - 构建 SDK 配置

**文件位置：** `claude_agent_sdk_wrapper.py:950-1155`

**核心逻辑：**

```python
def _build_options(
    self,
    task_id: Optional[str] = None,
    allowed_tools: Optional[str] = None,
    hooks: Optional[Dict] = None,
    mcp_servers: Optional[Dict] = None,
    session_id: Optional[str] = None,
    system_prompt: Optional[str] = None,
    enable_path_security: bool = True,
    enable_mcp: bool = True,
    **kwargs
) -> ClaudeAgentOptions:
    """
    构建 ClaudeAgentOptions（Claude Agent SDK 的配置对象）
    
    包含：
    - 工具配置（allowed_tools、disallowed_tools）
    - Hook 配置（PathSecurityHook、GitCommitAuthorHook、Gate Hook）
    - MCP 配置（Figma、MasterGo 等外部工具）
    - 权限配置（permission_mode、can_use_tool）
    - 模型配置（model、max_thinking_tokens）
    - 会话配置（max_turns、session_id）
    """
    
    # ===== 1. Hook 配置（核心安全机制） =====
    final_hooks = {}
    
    # 1.1 PathSecurityHook（路径安全检查）
    if enable_path_security:
        project_dir = PathManager.get_project_path(task_id) if task_id else None
        path_hook = create_path_security_hook(project_dir=project_dir)
        final_hooks["PreToolUse"] = [path_hook]
        logger.info(f"[Task {task_id}] 已启用 PathSecurityHook")
    
    # 1.2 GitCommitAuthorHook（Git 提交作者强制）
    git_hook = get_git_commit_author_hook()
    if "PreToolUse" in final_hooks:
        final_hooks["PreToolUse"].append(git_hook)
    else:
        final_hooks["PreToolUse"] = [git_hook]
    
    # 1.3 合并用户传入的 hooks（如 Gate Hook）
    if hooks:
        for hook_type, matchers in hooks.items():
            if hook_type in final_hooks:
                final_hooks[hook_type].extend(matchers)
            else:
                final_hooks[hook_type] = matchers
    
    # ===== 2. MCP 配置（外部工具集成） =====
    final_mcp_servers = {}
    if enable_mcp and mcp_servers:
        final_mcp_servers = mcp_servers.copy()
        logger.info(f"[Task {task_id}] MCP 服务器: {list(final_mcp_servers.keys())}")
    
    # ===== 3. 工具配置 =====
    # allowed_tools 示例：["Bash", "Read", "Write", "Edit", "Glob", "Grep", "mcp__figma__*"]
    final_allowed_tools = allowed_tools or self.default_allowed_tools or []
    
    # ===== 4. 构建 ClaudeAgentOptions =====
    options = ClaudeAgentOptions(
        # API 配置
        api_key=self.api_key,
        
        # 系统提示词
        system_prompt=final_system_prompt,
        
        # 工具配置
        allowed_tools=final_allowed_tools,
        disallowed_tools=disallowed_tools or self.default_disallowed_tools,
        
        # 权限配置
        permission_mode=permission_mode or self.default_permission_mode,
        can_use_tool=self.can_use_tool,  # 自定义权限回调
        
        # 工作目录
        cwd=final_cwd,
        add_dirs=final_add_dirs,
        
        # 模型配置
        model=final_model,
        
        # 会话配置
        max_turns=max_turns or self.max_turns_limit,
        
        # MCP 配置
        mcp_servers=final_mcp_servers,
        
        # Hook 配置
        hooks=final_hooks,  # 包含所有 Hook
        
        # session_id（恢复对话历史）
        resume=session_id,  # 关键：传入 session_id，SDK 会加载历史对话
        
        # 环境变量
        env=final_env,
        
        **kwargs
    )
    
    return options
```

**关键配置项说明：**

| 配置项 | 作用 | 典型值 |
|-------|------|-------|
| **resume** | 恢复对话历史 | session_id（如 `session_abc123`） |
| **hooks** | Hook 配置 | `{"PreToolUse": [PathSecurityHook, GitCommitAuthorHook]}` |
| **allowed_tools** | 允许的工具 | `["Bash", "Read", "Write", "mcp__figma__*"]` |
| **permission_mode** | 权限模式 | `"acceptEdits"`（自动通过编辑类操作） |
| **max_turns** | 最大轮数 | `1000` |
| **model** | Claude 模型 | `"claude-opus-4-5-20251101"` |

---

## 💾 Session 持久化机制（云端存储）

**Claude 的决策过程（简化版）：**

```
输入：
- System Prompt（你是一个代码助手，可用工具：Read, Write, Edit, Bash...）
- User Prompt（请实现用户登录功能）
- 历史对话（之前的工具调用和结果）

Claude 内部推理：
1. 任务分解：登录功能需要 Controller + Service + 加密
2. 信息收集：我需要先了解项目结构
   → 选择工具：Glob（查找文件）
3. 学习现有风格：读取现有 Controller 代码
   → 选择工具：Read（读取文件）
4. 生成代码：按照现有风格创建新文件
   → 选择工具：Write（写入文件）
5. 验证结果：运行测试
   → 选择工具：Bash（执行命令）

输出：
{
  "tool_name": "Glob",
  "tool_input": {"pattern": "**/*Controller.java", "path": "/project/src"}
}
```

**关键点：**
- Claude 是 **LLM（大语言模型）**，不是传统的规则引擎
- 它通过 **上下文理解** 决定下一步行动，而非预设流程
- **System Prompt** 定义了可用工具和使用规范
- **历史对话** 让 Claude 知道"我已经做了什么，还需要做什么"

---

### 2. System Prompt 的作用

**System Prompt 示例（简化版）：**

```
你是一个专业的代码助手，帮助用户完成代码生成任务。

可用工具：
1. Read - 读取文件内容
   参数：file_path (string)
   
2. Write - 写入文件
   参数：file_path (string), content (string)
   
3. Edit - 编辑文件
   参数：file_path (string), old_string (string), new_string (string)
   
4. Bash - 执行命令
   参数：command (string)
   
5. Glob - 查找文件
   参数：pattern (string), path (string)

工作规范：
1. 在生成代码前，先用 Read 或 Glob 了解项目结构
2. 生成代码后，用 Bash 运行测试验证
3. 遵循项目现有的代码风格和命名规范
4. 每次只调用一个工具，等待结果后再决定下一步

输出格式：
- 使用工具时，输出工具名称和参数的 JSON
- 最终完成时，输出总结报告
```

**System Prompt 的价值：**
- **定义能力边界**：Claude 知道自己可以做什么
- **规范行为**：引导 Claude 按照最佳实践工作
- **提高成功率**：明确的指引减少 Claude 的"试错"

---

## 💾 Session 持久化机制

### 1. 什么是 Session？

**Session = 一次完整的对话历史**，包括：
- User 输入的 Prompt
- Claude 的每次思考（Think）
- 每次工具调用（Tool Call）
- 每次工具结果（Tool Result）
- Claude 的最终输出（Final Output）

**为什么需要持久化？**
- **对话连续性**：下次调用时 Claude 能"记住"之前做了什么
- **故障恢复**：code-agent 崩溃后可以恢复未完成的任务
- **审计追踪**：可以回溯 Claude 的完整决策过程

---

### 2. Session 存储结构

**当前存储位置：** `~/.claude/projects/{normalized_project_path}/{session_id}.jsonl`

其中 `normalized_project_path` 由项目绝对路径转换而来。会话文件由 Claude Agent SDK 管理，code-agent 不会自行创建下面这种 `metadata.json + artifacts/` 目录结构。

**简化结构：**
```
~/.claude/projects/
└── {normalized_project_path}/
    └── {session_id}.jsonl
```

JSONL 的具体字段属于 SDK 内部格式，学习文档不应虚构固定的 `role/timestamp/tool_use` 结构。code-agent 主要通过 SDK 消息对象和 `session_id` 使用这些会话数据。

---

### 3. Session ID 的生成

Session ID 由 Claude Agent SDK 创建。code-agent 在收到初始化 `SystemMessage` 后提取该 ID，并通过 `TaskSessionMapper` 保存 `task_id ↔ session_id` 双向映射；后续查询把它传给 SDK 的 `resume` 参数。

跨机器时，如果本地 JSONL 缺失，`ClaudeSessionRestoreStrategy` 会尝试从 COS、OSS 恢复会话文件，然后再由 SDK resume 续接会话。

---

## 🛠️ MCP 工具调用机制

### 1. 什么是 MCP 工具？

**MCP（Model Context Protocol）** 是 Claude 的工具协议标准：
- 定义了工具的**输入输出格式**
- 定义了工具的**调用方式**
- 类似于 OpenAI 的 Function Calling

**MCP 工具示例：**

```python
{
  "name": "read_file",
  "description": "读取文件内容",
  "input_schema": {
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "文件的绝对路径"
      }
    },
    "required": ["file_path"]
  }
}
```

**Claude 看到这个工具定义后，就知道：**
- 工具名称是 `read_file`
- 需要传入 `file_path` 参数（字符串类型）
- 这个工具的作用是"读取文件内容"

---

### 2. 工具调用流程

```
Claude 决定调用工具
    ↓
输出 JSON: {"tool_name": "read_file", "tool_input": {"file_path": "/path/to/file.java"}}
    ↓
Claude Agent SDK 解析 JSON
    ↓
触发 PreToolUse Hook（PathSecurityHook 检查）
    ↓
Hook 返回 {"continue_": True}（允许执行）
    ↓
SDK 调用 read_file 工具实现
    ↓
read_file 返回文件内容
    ↓
SDK 包装为 Tool Result: {"tool_name": "read_file", "content": "文件内容...", "success": true}
    ↓
Tool Result 追加到对话历史
    ↓
Claude 继续下一轮思考
```

---

## 🎯 面试问题准备

### Q1: Claude 如何执行一个任务？

**标准回答：**

Claude 通过 **迭代循环** 执行任务，每轮包括：

1. **Think（思考）**：分析当前状态，决定下一步行动
2. **Tool Call（调用工具）**：选择合适的工具（Read、Write、Bash 等）
3. **PreToolUse Hook（安全检查）**：PathSecurityHook 检查路径是否合法
4. **Execute Tool（执行工具）**：SDK 调用工具实现，返回结果
5. **Tool Result（处理结果）**：Claude 分析工具返回的结果
6. **继续 or 结束**：决定是继续调用工具，还是输出最终答案

例如生成用户登录功能：
- 第1轮：Glob 查找现有 Controller → 了解项目结构
- 第2轮：Read 读取现有代码 → 学习代码风格
- 第3轮：Write 创建 UserController → 生成代码
- 第4轮：Write 创建 UserService → 生成代码
- 第5轮：Bash 运行测试 → 验证结果
- 第6轮：输出总结 → 任务完成

---

### Q2: 什么是 Session 持久化？

**标准回答：**

**Session 持久化** 是指将 Claude 的完整对话历史保存到磁盘，包括：
- 用户输入的 Prompt
- Claude 的每次思考
- 每次工具调用和结果
- 最终输出

存储位置：`~/.claude/projects/{normalized_project_path}/{session_id}.jsonl`，具体文件格式由 Claude Agent SDK 管理。

**作用：**
1. **对话连续性**：下次调用时 Claude 能"记住"之前做了什么
2. **故障恢复**：code-agent 崩溃后可以从 Session 恢复任务
3. **审计追踪**：可以回溯 Claude 的完整决策过程

**Session ID** 是全局唯一的标识符（如 `session_a1b2c3d4e5f6`），用于关联对话历史和任务。

---

### Q3: 如何保证 Claude 不会访问敏感目录？

**标准回答：**

通过 **PreToolUse Hook（PathSecurityHook）** 在代码层面拦截：

1. **Claude 决定调用工具**：`Read {"file_path": "/etc/passwd"}`
2. **SDK 触发 PreToolUse Hook**：调用 PathSecurityHook
3. **Hook 检查路径**：
   - 规范化路径：`os.path.abspath("/etc/passwd")` → `/etc/passwd`
   - 匹配黑名单：`/etc` 在黑名单中
   - 返回拒绝：`{"decision": "block", "reason": "访问受保护目录"}`
4. **SDK 跳过工具执行**：不调用 Read 工具
5. **返回错误给 Claude**：`Tool Result: "访问被拒绝"`
6. **Claude 处理错误**：调整策略或报告失败

**关键点：**
- Hook 是**代码级拦截**，无论 Prompt 如何都会生效
- 使用 `os.path.abspath` 防止 `../` 目录穿越
- 使用 `os.path.realpath` 防止符号链接绕过

---

### Q4: Claude 如何决定调用哪个工具？

**标准回答：**

Claude 是 **LLM（大语言模型）**，通过**上下文理解**决定工具选择：

**输入上下文：**
1. **System Prompt**：定义可用工具和使用规范
2. **User Prompt**：用户的任务需求
3. **历史对话**：之前的工具调用和结果

**决策过程：**
```
任务：实现用户登录功能

Claude 推理：
1. 我需要先了解项目结构 → 选择 Glob（查找文件）
2. 找到现有 Controller 了 → 选择 Read（读取代码）
3. 了解代码风格了 → 选择 Write（生成新代码）
4. 代码生成完了 → 选择 Bash（运行测试）
```

**不是规则引擎**：
- 没有预设的"if-else"流程
- 完全基于 LLM 的语义理解和推理能力
- **System Prompt 是关键**：明确的指引能提高成功率

---

### Q5: 工具执行失败后 Claude 会怎么做？

**标准回答：**

Claude 会收到 **Tool Result（失败）**，然后决定：

**场景1：路径错误**
```
[Tool Call] Read {"file_path": "/project/src/main/java/UserController.jav"}  # 拼写错误
[Tool Result] 错误：文件不存在

[Claude Think] 文件路径可能拼错了，应该是 .java 而不是 .jav
[Tool Call] Read {"file_path": "/project/src/main/java/UserController.java"}  # 修正
[Tool Result] 成功：文件内容...
```

**场景2：权限被拒绝**
```
[Tool Call] Read {"file_path": "/etc/passwd"}
[Tool Result] 错误：访问被拒绝（PathSecurityHook 拦截）

[Claude Think] 这个路径被拒绝了，我不应该访问系统目录。回到用户项目目录。
[Tool Call] Read {"file_path": "/project/src/config.properties"}  # 换个路径
```

**场景3：命令执行失败**
```
[Tool Call] Bash {"command": "mvn test"}
[Tool Result] 错误：编译失败，UserService.java:15 找不到符号

[Claude Think] 编译失败了，看起来是导入语句有问题。我需要修复。
[Tool Call] Edit {"file_path": "UserService.java", "old_string": "...", "new_string": "..."}
```

**Claude 的容错能力：**
- 能够理解错误信息并调整策略
- 多次尝试不同的方法
- 如果实在无法解决，会在最终输出中说明

---

### Q6: 一个任务通常需要多少轮迭代？

**标准回答：**

根据任务复杂度不同：

| 任务类型 | 迭代轮数 | 工具调用次数 | 示例 |
|---------|---------|-------------|------|
| **简单查询** | 1-2轮 | 1-2次 | 读取一个文件的内容 |
| **代码修复** | 3-5轮 | 3-5次 | 修复一个 Bug |
| **功能开发** | 5-10轮 | 5-10次 | 实现用户登录功能 |
| **复杂重构** | 10-20轮 | 10-20次 | 重构一个模块的架构 |
| **完整项目** | 20+轮 | 20+次 | 从零生成一个完整项目 |

**实际案例（用户登录功能）：**
- Glob 查找文件（1次）
- Read 读取现有代码（2次）
- Write 生成新代码（2次）
- Bash 运行测试（1次）
- **总计：6轮迭代，6次工具调用**

**影响因素：**
- 项目复杂度（文件数量、依赖关系）
- PRD 清晰度（需求越清晰，迭代越少）
- 现有代码质量（代码风格一致性）
- Claude 的"幸运度"（有时第一次就成功，有时需要多次尝试）

---

## 💡 简历写法建议

### 项目职责（精简版）

```
参与 Claude Agent 集成开发，使用 Claude Agent SDK 实现任务初始化、代码生成、代码审查的 AI 工作流
```

### 技术亮点（展开版）

```
**Agent 工作流实现**：
- **任务初始化**：Claude 调用 init_project MCP 工具 → git clone → 安装依赖 → 获取 PRD
- **代码生成**：Claude 读取项目结构 → 分析需求 → 生成代码 → 运行测试
- **迭代执行**：通过 Think → Tool → Result 循环，平均 5-10 轮迭代完成一个功能
- **Session 持久化**：SDK 将会话保存到 `~/.claude/projects/.../*.jsonl`；code-agent 保存任务/会话映射，并在跨机器时恢复会话文件
```

---

## 🚀 下一步学习

理解了 Claude Agent 工作流后，接下来学习：

1. **MCP 工具开发** - 如何开发 init_project、read_file 等工具
2. **Langfuse 可观测性** - 如何追踪 Claude 的每次对话和 Token 消耗
3. **Prompt Engineering** - 如何设计 System Prompt 提高成功率

**准备好了吗？我们继续深入下一个主题！** 🎯
