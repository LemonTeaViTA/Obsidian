# Claude 执行任务的完整流程(带真实代码)

> 记录时间:2026-07-09
> 场景:用户输入"请帮我修复登录bug",Claude如何一步步执行
> 目的:看到真实代码,理解从用户输入到Claude执行工具的每一步

---

## 🎬 场景设定

**前提**:
- 任务已经初始化完成(项目代码已拉取)
- 用户在前端对话框输入:"请帮我修复登录bug"
- ai24 构造请求发给 code-agent

---

## 📊 完整执行流程(11步)

### 第1步:ai24 发送 query 请求

**ai24 侧** (TaskPerformServiceImpl.java)
```java
TaskQueryRequest request = new TaskQueryRequest();
request.setTaskId("t-1720512345678");
request.setInput("请帮我修复登录bug");
request.setHooks(Arrays.asList("task_completion_gate"));  // ai24下发的hook
request.setModel("claude-opus-4-8");

ResponseEntity<TaskQueryResponse> response = restTemplate.exchange(
    "http://code-agent/task/query",
    HttpMethod.POST,
    new HttpEntity<>(request),
    TaskQueryResponse.class
);
```

**HTTP 请求**:
```json
POST /task/query
{
  "taskId": "t-1720512345678",
  "input": "请帮我修复登录bug",
  "hooks": ["task_completion_gate"],
  "model": "claude-opus-4-8"
}
```

---

### 第2步:code-agent 接收请求

**code-agent 侧** (main.py:442 TaskQueryResource)
```python
def post(self):
    data = request.get_json()
    task_id = data.get('taskId')              # "t-1720512345678"
    raw_input = data.get('input', '')         # "请帮我修复登录bug"
    model = data.get('model')                 # "claude-opus-4-8"
    raw_hooks = data.get('hooks')             # ["task_completion_gate"]
    
    # 构造查询消息
    query_message = TaskQueryMessage(
        task_id=task_id,
        input_text=raw_input,
        message_type='query',
        hooks=hook_names,
        model=model
    )
    
    # 分发(启动新线程)
    dispatch_task_query_message(query_message)
    
    # 立刻返回202
    return {'success': True, 'message': '任务已开始执行'}, 202
```

---

### 第3步:新线程执行 run_query_task_in_thread

**main.py:2390**
```python
def run_query_task_in_thread(query_message: TaskQueryMessage):
    task_id = query_message.task_id
    input_text = query_message.input_text  # "请帮我修复登录bug"
    
    # 检查并恢复任务环境
    asyncio.run(check_and_restore_task_environment(task_id))
    
    # 上报会话状态"进行中"
    asyncio.run(MessageReporter.report_session_status(
        task_id, session_status=IN_PROGRESS
    ))
    
    # 上报系统消息
    asyncio.run(MessageReporter.report_system_message(
        task_id,
        report_content="收到请求，正在为您处理..."
    ))
    
    # 执行查询任务(核心!)
    asyncio.run(execute_query_task(
        task_id, 
        input_text,
        model=query_message.model,
        dynamic_hooks=resolved_hooks  # 从hook_registry解析的hooks
    ))
```

---

### 第4步:execute_query_task 获取元数据并准备

**main.py:1819**
```python
async def execute_query_task(task_id, input_text, model, dynamic_hooks):
    # 获取任务元数据
    meta_container = get_meta_container()
    task_metadata = meta_container.get(task_id)
    
    project_path = task_metadata.project_path  # 项目目录
    # 例如: "/home/www/.claude/projects/t-1720512345678/order-service"
    
    # 获取 SDK 服务单例
    service = ClaudeAgentSDKService.get_instance()
    
    # 调用 SDK(核心!)
    await service.query(
        task_id=task_id,
        prompt=input_text,          # "请帮我修复登录bug"
        cwd=project_path,           # 工作目录
        model=model,                # "claude-opus-4-8"
        dynamic_hooks=dynamic_hooks, # task_completion_gate hook
        keep_session=True           # 继续使用之前的会话
    )
```

---

### 第5步:ClaudeAgentSDKService.query 准备 Claude SDK 参数

**claude_agent_sdk_wrapper.py:1157**
```python
async def query(self, task_id, prompt, cwd, model, dynamic_hooks, keep_session):
    # 1. 获取或创建会话
    session_id = self._get_or_create_session(task_id, keep_session)
    
    # 2. 装配 hooks(系统hook + 元数据hook + ai24下发hook)
    final_hooks = {}
    
    # 系统hook(启动时注册的)
    if enable_path_security:
        path_security_hook = create_path_security_hook(working_dir=cwd)
        final_hooks.update(path_security_hook.get_sdk_hooks_config())
    
    git_commit_hook = get_git_commit_author_hook()
    final_hooks.update(git_commit_hook.get_sdk_hooks_config())
    
    # ai24下发hook
    if dynamic_hooks:
        for hook_type, matchers in dynamic_hooks.items():
            if hook_type in final_hooks:
                final_hooks[hook_type].extend(matchers)
            else:
                final_hooks[hook_type] = matchers
    
    # 3. 构造 ClaudeAgentOptions
    options = ClaudeAgentOptions(
        cwd=cwd,
        model=model,
        hooks=final_hooks,
        # ... 其他配置
    )
    
    # 4. 获取 Claude Code Client
    client = self.claude_sdk.get_session(session_id, options)
    
    # 5. 调用 Claude SDK!(核心中的核心!)
    await client.query(prompt, session_id=session_id)
    
    # 6. 处理响应消息(流式上报)
    await self._process_response_messages(task_id, session_id)
```

---

### 第6步:Claude SDK 发送请求给 Claude API

**Claude SDK 内部**(伪代码,SDK是闭源的)
```python
# claude_agent_sdk 内部
async def query(prompt, session_id):
    # 1. 构造 API 请求
    messages = [
        {"role": "user", "content": prompt}  # "请帮我修复登录bug"
    ]
    
    # 2. 发送到 Claude API
    response = await anthropic_client.messages.create(
        model="claude-opus-4-8",
        messages=messages,
        tools=self.available_tools,  # Read/Write/Edit/Bash/MCP工具列表
        stream=True  # 流式返回
    )
    
    # 3. 流式处理响应
    async for chunk in response:
        if chunk.type == "content_block_delta":
            # Claude 说话了
            text = chunk.delta.text
            self._on_text_output(text)  # 上报给code-agent
            
        elif chunk.type == "tool_use":
            # Claude 要调用工具!
            tool_name = chunk.name       # 例如: "Read"
            tool_input = chunk.input     # 例如: {"path": "src/login.js"}
            
            # 执行工具调用(见第7步)
            result = await self._execute_tool(tool_name, tool_input)
            
            # 把结果返回给 Claude
            messages.append({
                "role": "assistant",
                "content": [{"type": "tool_use", "id": chunk.id, "name": tool_name, "input": tool_input}]
            })
            messages.append({
                "role": "user",
                "content": [{"type": "tool_result", "tool_use_id": chunk.id, "content": result}]
            })
            
            # 继续请求(Claude 看到工具结果后继续思考)
            # ... 重复这个过程,直到 Claude 说"修复完成"
```

---

### 第7步:SDK 执行工具调用(带 Hook 检查!)

**Claude SDK 内部**(伪代码)
```python
async def _execute_tool(tool_name, tool_input):
    # 1. 检查 PreToolUse Hook
    for hook in self.hooks.get("PreToolUse", []):
        if hook.matches(tool_name):
            result = hook.check(tool_name, tool_input)
            if result["type"] == "deny":
                # Hook拒绝了!返回错误,不执行工具
                return f"错误: {result['reason']}"
    
    # 2. 执行工具
    if tool_name == "Read":
        content = self._read_file(tool_input["path"])
        return content
    elif tool_name == "Write":
        self._write_file(tool_input["path"], tool_input["content"])
        return "文件已写入"
    elif tool_name == "Bash":
        output = self._execute_bash(tool_input["command"])
        return output
    # ... 其他工具
    
    # 3. 检查 PostToolUse Hook
    for hook in self.hooks.get("PostToolUse", []):
        if hook.matches(tool_name):
            hook.check(tool_name, tool_input, result)
    
    return result
```

---

### 第8步:Claude 的实际执行流程(示例)

**Claude 思考并调用工具的完整对话**(简化版):

```
【第1轮】
User: 请帮我修复登录bug

Claude: 我来分析登录相关的代码。首先读取登录模块的代码。

[调用工具] Read(path="src/login.js")
    ↓ SDK检查 PreToolUse Hook
    ↓ PathSecurityHook: "/home/www/.claude/projects/t-xxx/src/login.js" 在允许范围内,通过
    ↓ 执行 read_file("src/login.js")
    ↓ 返回文件内容

[工具返回] 
```javascript
function login(username, password) {
  if (username = 'admin') {  // ← bug! 应该用 == 或 ===
    return true;
  }
  return validatePassword(password);
}
```

【第2轮】
Claude: 发现了bug!第3行使用了赋值运算符=而不是比较运算符===,导致任何用户名都会被赋值为'admin'并通过验证。我来修复它。

[调用工具] Edit(
  path="src/login.js",
  old_text="if (username = 'admin') {",
  new_text="if (username === 'admin') {"
)
    ↓ SDK检查 PreToolUse Hook
    ↓ PathSecurityHook: 通过
    ↓ 执行 edit_file(...)
    ↓ 返回成功

[工具返回] 文件已修改

【第3轮】
Claude: bug已修复。建议运行测试验证。

[调用工具] Bash(command="npm test")
    ↓ SDK检查 PreToolUse Hook
    ↓ GitCommitAuthorHook: 命令里没有git commit,通过
    ↓ 执行 bash("npm test")
    ↓ 返回测试输出

[工具返回] ✓ login test passed (2/2)

【第4轮】
Claude: ✅ 登录bug已修复!

问题:第3行使用了赋值运算符=而不是比较运算符===
修复:已改为===
测试:所有测试通过

[遇到 task_completion_gate Hook]
    ↓ Hook检查: Claude说了"已修复",判断任务完成
    ↓ 返回 stop 信号
    ↓ SDK停止对话

【结束】
```

---

### 第9步:流式上报给 ai24

**每当 Claude 输出一段文本时**:
```python
# claude_agent_sdk_wrapper.py
def _on_text_output(text):
    # 立刻POST给ai24
    asyncio.run(MessageReporter.report_content(
        task_id=task_id,
        content=text  # Claude刚说的这段话
    ))
```

**ai24 收到**:
```
POST /api/task/report/content
{
  "taskId": "t-1720512345678",
  "content": "我来分析登录相关的代码..."
}
```

**ai24 处理**:
```java
// INSERT INTO task_record (task_id, content, record_type)
taskRecordManager.save(record);

// WebSocket推给前端
webSocketHandler.send(taskId, content);
```

**前端看到**:
```
Claude正在打字...
"我来分析登录相关的代码..."
```

---

### 第10步:上报任务完成

**execute_query_task 完成后**:
```python
# 上报会话状态"空闲"
await MessageReporter.report_session_status(
    task_id, session_status=IDLE
)

# 如果有completed_command,通知ai24阶段完成
if completed_command:
    CompleteStageClient().complete_stage(
        task_id, command=completed_command
    )
```

---

### 第11步:用户看到结果

**前端界面**:
```
Claude: 我来分析登录相关的代码。首先读取登录模块的代码。

[读取文件] src/login.js

发现了bug!第3行使用了赋值运算符=而不是比较运算符===...

[修改文件] src/login.js

[执行命令] npm test
✓ login test passed (2/2)

✅ 登录bug已修复!

问题:第3行使用了赋值运算符=而不是比较运算符===
修复:已改为===
测试:所有测试通过
```

---

## 🔑 关键认知点

### 1. Claude 不是一次性返回结果,而是"对话式"执行

```
User → Claude思考 → 调工具 → 看结果 → 继续思考 → 再调工具 → ... → 完成
```

每次调工具后,Claude都会看到结果,再决定下一步。这就是为什么叫"Agent"——它是**自主决策、迭代执行**的。

### 2. Hook 在每次工具调用前都会检查

```
Claude决定调Read → SDK拦截 → PathSecurityHook检查路径 → 通过 → 真正执行read_file
```

不是"Claude自觉遵守规则",而是**每次都强制检查**。

### 3. 流式上报的真相

```
Claude说一段话 → SDK立刻POST给code-agent → code-agent立刻POST给ai24 → ai24立刻WebSocket推前端
```

不是等Claude全说完,是**边说边传**,所以前端才能实时看到。

### 4. 会话是保持的

```
初始化时: keep_session=True → 创建 session_id
第1次query: 继续用这个 session_id → Claude记得项目结构
第2次query: 还是这个 session_id → Claude记得上次改了什么
```

所以Claude能"记住"之前的对话和操作。

---

## ✅ 检查清单

- [ ] 理解Claude不是一次性返回,而是"思考→调工具→看结果→继续"的迭代过程
- [ ] 理解每次工具调用都会经过Hook检查(PreToolUse/PostToolUse)
- [ ] 理解流式上报的链路(Claude→SDK→code-agent→ai24→WebSocket→前端)
- [ ] 理解会话保持的机制(session_id贯穿多次query)
- [ ] 理解gate hook如何判断任务完成(检测Claude的输出内容)

---

**这就是"执行具体任务"的完整真相!**  
从用户输入,到Claude一步步调工具,到结果实时显示在前端,每一步都清清楚楚。
