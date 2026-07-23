# commands_container.py 详解

> 本文档详细解析 `commands_container.py` 的当前实现。该模块不只处理固定的 OpenSpec 命令，而是把大多数 `/` 开头输入交给 AI24 模板系统解析。
> 
> **文件位置**：[commands_container.py](../../code-agent/commands_container.py)  
> **文件大小**：321 行  
> **核心功能**：识别和处理以 `/` 开头的命令，从 AI24 获取工作流提示词

---

## 一、模块概览

### 1.1 模块职责

```
用户输入：/openspec:proposal
    ↓
CommandsContainer 识别这是一个命令
    ↓
从 AI24 API 获取对应的提示词模板
    ↓
返回处理后的完整提示词
    ↓
Claude 接收提示词并执行
```

**核心作用**：
- ✅ 识别大多数 `/` 开头命令（部分本地特殊命令除外）
- ✅ 从 AI24 管理平台获取工作流模板
- ✅ 组装最终的提示词
- ✅ 支持命令后附加额外提示词

### 1.2 类和函数概览

```python
class CommandsContainer:
    # 核心方法
    def is_command(input_text, template_id)              # 判断是否是命令
    async def process_command(task_id, command, ...)     # 处理命令
    async def _fetch_prompt_from_ai24(template_id, ...)  # 从AI24获取提示词

# 全局单例
def get_commands_container()                             # 获取单例实例

# 便捷函数
async def process_custom_command(task_id, input_text, ...)  # 一站式处理
```

---

## 二、核心方法详解

### 2.1 is_command() - 判断是否是命令

**代码位置**：[commands_container.py:122-157](../../code-agent/commands_container.py#L122-L157)

```python
def is_command(self, input_text: str, template_id: Optional[str] = None) -> bool:
    """
    判断输入是否为命令
    
    命令格式：以 '/' 开头
    特殊处理：
    - 如果 template_id 是 free 任务 → 不是命令（直接传给 Claude）
    - /interrupt、/clear、/context、/model、/test:* 等本地命令不走模板处理
    """
    
    if not input_text or not isinstance(input_text, str):
        return False
    
    stripped = input_text.strip()
    
    special_commands = [
        '/interrupt', '/clear', '/context', '/model',
        '/test:generate', '/test:generate-api', '/test:analysis'
    ]
    if any(stripped.startswith(cmd) for cmd in special_commands):
        return False

    if template_util.is_free_task(template_id):
        return False

    return stripped.startswith('/')
    
    # 特殊情况2：纯对话任务（is_pure_task）
    # 如果是纯对话任务，'/' 开头的输入视为普通对话内容
    if template_id and template_util.is_pure_task(template_id):
        logger.info(f"纯对话任务（template_id={template_id}），'/' 开头的输入作为普通内容")
        return False
    
    # 其他以 '/' 开头的输入都是命令
    return True
```

**判断逻辑流程图**：

```
输入："/openspec:proposal"
    ↓
是否以 '/' 开头？ → Yes
    ↓
是否是 '/interrupt'？ → No
    ↓
是否是 pure 任务？ → No
    ↓
返回：True（是命令）✅


输入："/some-path/file.txt" (pure任务中)
    ↓
是否以 '/' 开头？ → Yes
    ↓
是否是 '/interrupt'？ → No
    ↓
是否是 pure 任务？ → Yes
    ↓
返回：False（不是命令，是普通输入）❌
```

**为什么需要 pure 任务判断？**

```
场景：用户要 Claude 处理文件路径
输入："/home/user/documents/report.pdf"

如果没有 pure 判断：
  → 被识别为命令
  → 尝试从 AI24 获取模板
  → 失败 ❌

有了 pure 判断：
  → 识别为普通输入
  → 直接传给 Claude
  → Claude 理解为文件路径 ✅
```

---

### 2.2 _fetch_prompt_from_ai24() - 从 AI24 获取提示词

**代码位置**：[commands_container.py:27-118](../../code-agent/commands_container.py#L27-L118)

**完整流程**：

```python
async def _fetch_prompt_from_ai24(
    self,
    template_id: str,
    command_name: str,
    task_id: str,
    max_retries: int = 3
) -> Optional[str]:
    """从 AI24 API 获取命令提示词内容"""
    
    # 1. 构造 API 请求
    management_api_url = os.getenv('MANAGEMENT_API_BASE_URL', 'http://ai24.daily.vdian.net')
    api_url = f"{management_api_url}/api/template/{template_id}/{command_name}"
    
    # 2. 使用指数退避重试机制
    retry_delay = 1
    last_error = None
    
    for attempt in range(1, max_retries + 1):
        try:
            # 调用 HTTP API
            http_tool = HttpTool()
            ok, response = await http_tool.call_async(
                method='GET',
                url=api_url,
                timeout=10
            )
            
            if ok:
                break  # 成功，退出重试循环
                
        except Exception as e:
            last_error = str(e)
            
            if attempt < max_retries:
                logger.warning(f"调用 AI24 API 失败（第 {attempt}/{max_retries} 次）: {last_error}")
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # 指数退避：1s → 2s → 4s
    
    # 3. 处理失败情况
    if not ok:
        error_msg = f"调用 AI24 API 失败（已重试 {max_retries} 次）: {last_error}"
        logger.error(error_msg)
        raise Exception(error_msg)
    
    # 4. 解析响应
    if not isinstance(response, dict):
        raise Exception(f"API 返回格式异常: {type(response)}")
    
    success = response.get("success")
    
    # 5. 处理错误响应
    if not success:
        error_msg = response.get("message", "未知错误")
        code = response.get("code")
        
        if code is not None and str(code) != "":
            # 有错误码 → 系统错误 → 抛出异常
            logger.error(f"AI24 API 返回系统错误: code={code}, message={error_msg}")
            raise Exception(f"AI24 API 返回系统错误: code={code}, message={error_msg}")
        else:
            # 无错误码 → 未找到模板 → 返回 None（使用默认行为）
            logger.warning(f"AI24 API 未找到模板: message={error_msg}, command: {command_name}")
            return None
    
    # 6. 提取提示词内容
    data = response.get("data") or {}
    template_detail = data.get("templateDetail") or {}
    prompt_content = template_detail.get("promptContent", "")
    
    if not prompt_content:
        logger.warning(f"API 返回的 promptContent 为空, command: {command_name}")
        return None
    
    logger.info(f"成功获取提示词，长度: {len(prompt_content)}")
    return prompt_content
```

**API 请求示例**：

```http
POST /api/task/notify/getTemplate
Content-Type: application/json

{
  "templateId": "tpl_backend_001",
  "promptType": 1,
  "promptDetail": "/openspec:proposal",
  "taskId": "task_123"
}

# 成功响应
{
  "success": true,
  "data": {
    "templateDetail": {
      "promptContent": "你是一个资深的软件架构师...\n请分析需求并输出技术方案...\n"
    }
  }
}

# 失败响应1：未找到模板（不抛异常）
{
  "success": false,
  "message": "未找到匹配的模板"
}

# 失败响应2：系统错误（抛异常）
{
  "success": false,
  "code": "500",
  "message": "数据库连接失败"
}
```

**重试机制（指数退避）**：

```
第1次尝试
  ↓ 失败
等待 1 秒
  ↓
第2次尝试
  ↓ 失败
等待 2 秒
  ↓
第3次尝试
  ↓ 失败
抛出异常 ❌
```

---

### 2.3 process_command() - 处理命令

**代码位置**：[commands_container.py:160-249](../../code-agent/commands_container.py#L160-L249)

**核心逻辑**：

```python
async def process_command(
    self,
    task_id: str,
    command: str,
    template_id: Optional[str] = None,
    project_path: Optional[str] = None,
    flow_type: Optional[str] = None,
    ui_mcp_type: Optional[str] = None
) -> Tuple[str, str]:
    """
    处理命令，返回处理后的提示词
    
    Returns:
        Tuple[str, str]: (组装后的提示词, 命令类型标识)
    """
    
    # 1. 解析命令和额外提示词
    # 命令格式：/command 或 /command 额外的提示词
    parts = command.strip().split(None, 1)  # 最多分割一次
    command_name = parts[0]  # 如 '/openspec:proposal'
    extra_prompt = parts[1] if len(parts) > 1 else None  # 额外提示词
    
    if extra_prompt:
        logger.info(f"检测到额外提示词: {extra_prompt}")
    
    # 2. 判断命令类型
    is_openspec_proposal = command_name == '/openspec:proposal'
    is_openspec_apply = command_name == '/openspec:apply'
    
    # 3. 检查 template_id
    if not template_id:
        return f"""无法处理命令 "{command_name}"：任务未配置 templateId。

请在任务初始化时（POST /task/perform）提供 templateId 参数""", ''
    
    # 4. 特殊处理：pure 任务直接返回原始输入
    if template_util.is_pure_task(template_id):
        return command, ''
    
    # 5. 从 AI24 获取提示词
    prompt_content = await self._fetch_prompt_from_ai24(
        template_id=template_id,
        command_name=command_name,
        task_id=task_id
    )
    
    # 6. 如果未找到提示词，返回原始输入
    if prompt_content is None:
        return command, ''
    
    # 7. 拼接最终提示词：promptContent + 额外提示词
    if extra_prompt:
        final_prompt = f"{prompt_content}\n\n{extra_prompt}"
        logger.info(f"拼接额外提示词，最终长度: {len(final_prompt)}")
    else:
        final_prompt = prompt_content
    
    # 8. 确定命令类型标识
    command_type = ''
    if is_openspec_apply:
        command_type = 'openspec_apply'
    elif is_openspec_proposal:
        command_type = 'openspec_proposal'
    
    return final_prompt, command_type
```

**处理流程图**：

```
输入："/openspec:proposal 增加用户登录功能"
    ↓
┌────────────────────────────────────────┐
│ 1. 解析命令                            │
│    command_name = "/openspec:proposal" │
│    extra_prompt = "增加用户登录功能"   │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ 2. 检查 template_id                    │
│    template_id = "tpl_backend_001" ✅  │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ 3. 从 AI24 获取提示词                  │
│    POST /api/task/notify/getTemplate   │
│    promptDetail = /openspec:proposal   │
│                                        │
│    返回：                              │
│    "你是一个资深的软件架构师...        │
│     请分析需求并输出技术方案..."       │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ 4. 拼接额外提示词                      │
│                                        │
│    final_prompt =                      │
│    "你是一个资深的软件架构师...        │
│     请分析需求并输出技术方案...        │
│                                        │
│     增加用户登录功能"                  │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ 5. 返回结果                            │
│    (final_prompt, "openspec_proposal") │
└────────────────────────────────────────┘
```

---

## 三、使用示例

### 3.1 从 main.py 调用

**代码位置**：main.py 中的任务查询处理

```python
# main.py 中
async def process_query(task_id, input_text, template_id):
    """处理查询请求"""
    
    # 1. 尝试处理命令
    is_cmd, processed_prompt, command_type = await process_custom_command(
        task_id=task_id,
        input_text=input_text,
        template_id=template_id,
        params={
            'flow_type': 'backend',
            'ui_mcp_type': 'figma'
        }
    )
    
    # 2. 根据是否是命令决定如何处理
    if is_cmd:
        # 是命令 → 使用处理后的提示词
        prompt = processed_prompt
        logger.info(f"使用命令处理后的提示词，command_type: {command_type}")
    else:
        # 不是命令 → 使用原始输入
        prompt = input_text
    
    # 3. 调用 Claude SDK
    result = await service.query(task_id, prompt)
    
    return result
```

### 3.2 完整的命令执行流程

```
用户发起任务
    ↓
POST /task/query
{
  "taskId": "task_123",
  "input": "/openspec:proposal 实现支付功能"
}
    ↓
main.py:TaskQueryResource.post()
    ↓
process_custom_command()
    ├─ is_command() → True（是命令）
    └─ process_command()
        ├─ _fetch_prompt_from_ai24()
        │   └─ POST /api/task/notify/getTemplate
        │       返回：1000+ 字符的提示词模板
        │
        └─ 拼接额外提示词
            返回：完整提示词 + "openspec_proposal"
    ↓
service.query(task_id, 完整提示词)
    ↓
Claude 接收提示词
  "你是一个资深的软件架构师...
   请分析需求并输出技术方案...
   
   实现支付功能"
    ↓
Claude 开始工作
  1. 分析需求
  2. 设计技术方案
  3. 生成代码
  4. ...
    ↓
返回结果给用户 ✅
```

---

## 四、命令类型与示例

### 4.1 常见模板命令

下面是常见示例，不是代码里的固定白名单。只要命令以 `/` 开头、不属于本地特殊命令、任务不是 free 类型，系统就会尝试从 AI24 获取对应模板；模板不存在时回退为原始输入。

```python
# Proposal 命令（需求分析和技术方案）
/openspec:proposal [额外需求]

# Development 命令（开发实现）
/openspec:dev [额外要求]

# Test 命令（测试设计）
/openspec:test [测试重点]

# Apply 命令（应用现有方案）
/openspec:apply [应用说明]

# Frontend 命令（前端实现）
/openspec:frontend [前端要求]
```

### 4.2 命令类型标识

```python
command_type 的可能值：
- "openspec_proposal" → 需求分析命令
- "openspec_apply" → 应用命令
- "" (空字符串) → 其他命令或非命令
```

**command_type 的作用**：

在 main.py 中可能用于：
- 判断是否需要自动提交代码
- 决定后续工作流步骤
- 记录命令类型到日志

---

## 五、关键设计亮点

### 5.1 指数退避重试机制

```python
retry_delay = 1  # 初始延迟 1 秒

for attempt in range(1, max_retries + 1):
    try:
        # 尝试调用 API
        ...
    except Exception as e:
        if attempt < max_retries:
            await asyncio.sleep(retry_delay)
            retry_delay *= 2  # 指数增长：1s → 2s → 4s
```

**为什么用指数退避？**
- ✅ 避免频繁重试导致服务过载
- ✅ 给服务恢复时间
- ✅ 最多重试 3 次，总等待时间：1 + 2 = 3 秒

### 5.2 错误分类处理

```python
if not success:
    code = response.get("code")
    
    if code is not None and str(code) != "":
        # 有错误码 → 系统错误 → 抛出异常
        raise Exception(f"系统错误: {code}")
    else:
        # 无错误码 → 业务逻辑（如未找到模板）→ 返回 None
        return None
```

**为什么这样分类？**

| 错误类型 | 错误码 | 处理方式 | 原因 |
|----------|--------|----------|------|
| **系统错误** | 有（500） | 抛出异常 | 需要人工介入 |
| **未找到模板** | 无 | 返回 None | 正常情况，使用默认行为 |

### 5.3 单例模式

```python
# 全局单例
_commands_container = None

def get_commands_container() -> CommandsContainer:
    global _commands_container
    if _commands_container is None:
        _commands_container = CommandsContainer()
    return _commands_container
```

**为什么用单例？**
- ✅ 避免重复创建实例
- ✅ 全局共享状态（如果需要缓存）
- ✅ 符合其他模块的设计模式

### 5.4 支持额外提示词

```python
# 用户输入
"/openspec:proposal 增加用户登录功能"
    ↓
# 解析
command_name = "/openspec:proposal"
extra_prompt = "增加用户登录功能"
    ↓
# 拼接
final_prompt = f"{api_prompt}\n\n{extra_prompt}"
```

**为什么支持额外提示词？**
- ✅ 更灵活：在模板基础上添加具体要求
- ✅ 不修改模板：保持模板通用性
- ✅ 个性化：每个任务可以有特殊要求

---

## 六、与其他模块的关系

```
┌─────────────────────────────────────┐
│ main.py (Flask API)                 │
│   TaskQueryResource.post()          │
└─────────────────────────────────────┘
            │
            ▼ 调用
┌─────────────────────────────────────┐
│ commands_container.py               │
│   process_custom_command()          │
│     ├─ is_command()                 │
│     └─ process_command()            │
│         └─ _fetch_prompt_from_ai24()│
└─────────────────────────────────────┘
            │
            ├─→ HTTP 请求到 AI24
            │   POST /api/task/notify/getTemplate
            │
            └─→ 返回提示词
                    │
                    ▼
┌─────────────────────────────────────┐
│ claude_agent_sdk_wrapper.py         │
│   service.query(task_id, prompt)    │
└─────────────────────────────────────┘
            │
            ▼
      Claude 执行任务
```

---

## 七、小结

| 维度 | 内容 |
|------|------|
| **核心职责** | 识别命令、获取模板、组装提示词 |
| **主要方法** | is_command()、process_command()、_fetch_prompt_from_ai24() |
| **设计模式** | 单例模式 |
| **重试机制** | 指数退避（1s → 2s → 4s） |
| **错误处理** | 分类处理（系统错误 vs 业务逻辑） |
| **扩展性** | 支持额外提示词、纯对话任务 |

**关键设计亮点**：
1. ⭐️ **指数退避重试**：避免服务过载
2. ⭐️ **错误分类处理**：系统错误抛异常，未找到模板返回 None
3. ⭐️ **支持额外提示词**：灵活性和通用性兼顾
4. ⭐️ **pure 任务特殊处理**：纯对话任务不处理命令

**使用场景**：
- 用户输入 `/openspec:proposal` → 尝试获取需求分析模板
- 用户输入其他 `/xxx` 命令 → 尝试按命令名获取远程模板
- AI24 没有对应模板 → 保留原始输入，不伪造本地模板

**关联阅读**：
- 任务执行流程 → [main.py](../../code-agent/main.py) TaskQueryResource
- Claude SDK 调用 → [claude_agent_sdk_wrapper.py](../../code-agent/claude_agent_sdk_wrapper.py)
- 工作流模板管理 → AI24 管理平台文档
