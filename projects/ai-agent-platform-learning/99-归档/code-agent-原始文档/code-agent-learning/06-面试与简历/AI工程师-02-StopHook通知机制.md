# Stop Hook 通知机制详解 - AI工程师面试重点

## 📌 为什么 Stop Hook 是工作流驱动的关键？

在 AI Code Factory 项目中，**工作流是核心设计**：
- 需求分析 → 领域拆分 → 应用拆分 → 代码生成 → 代码审查
- 每个阶段由 Claude 执行，完成后需要**通知 ai24 平台进入下一阶段**
- Stop Hook 就是这个"通知机制"的实现

面试官会问：**Claude 执行完任务后，如何触发下一个工作流阶段？**

---

## 🔄 完整工作流程图

```
用户提交需求
    ↓
ai24 创建任务 (taskId=123, stage=init)
    ↓
ai24 调用 code-agent: POST /agent/execute (taskId=123, prompt="请初始化项目")
    ↓
code-agent 启动 Claude Agent SDK
    ↓
Claude 执行任务（init_project、read_file、write_file...）
    ↓
Claude 对话结束 → SDK 触发 Stop Hook
    ↓
Stop Hook 调用 CompleteStageClient
    ↓
CompleteStageClient → ai24: POST /api/task/notify/sessionComplete?taskId=123&completedCommand=init
    ↓
ai24 收到通知，更新任务状态，进入下一阶段 (stage=proposal)
    ↓
ai24 再次调用 code-agent: POST /agent/execute (taskId=123, prompt="请生成领域拆分方案")
    ↓
循环往复，直到所有阶段完成
```

**核心价值：**
- **自动化工作流流转**：无需人工干预，Claude 完成即触发下一阶段
- **解耦设计**：code-agent 不关心工作流逻辑，只负责"执行完了就通知"
- **容错性**：Stop Hook 失败不影响任务执行（只记录日志）

---

## 🛠️ CompleteStageClient：通知客户端

### 核心实现

**代码位置：** `code-agent/hooks/stop_hook_complete_stage.py:86-148`

```python
class CompleteStageClient:
    """AI24 sessionComplete 接口调用客户端"""
    
    API_PATH = "/api/task/notify/sessionComplete"
    DEFAULT_BASE_URL = "http://ai24.daily.vdian.net/"
    
    def __init__(self):
        base_url = os.getenv("MANAGEMENT_API_BASE_URL", self.DEFAULT_BASE_URL)
        self._base_url = base_url.rstrip("/")
    
    @retry_with_backoff(max_retries=3, base_delay=1.0, max_delay=30.0)
    def complete_stage(self, task_id: str, command: str, timeout: int = 10):
        """
        通知 AI24 当前阶段完成
        
        Args:
            task_id: 任务 ID
            command: 阶段命令标识（如 init/proposal/apply/develop）
            timeout: 请求超时秒数
        """
        if not task_id or not task_id.strip():
            raise ValueError("task_id 不能为空")
        
        url = self._build_url()
        params = {"taskId": task_id, "completedCommand": command}
        
        response = requests.post(url, params=params, timeout=timeout)
        response.raise_for_status()
        return response.json()
```

---

### 重试机制：指数退避

```python
def retry_with_backoff(max_retries=3, base_delay=1.0, max_delay=30.0):
    """带指数退避的重试装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    if attempt < max_retries:
                        # 指数退避：1s → 2s → 4s (最大30s)
                        delay = min(base_delay * (2 ** attempt), max_delay)
                        logger.warning(f"第{attempt + 1}次调用失败，{delay}秒后重试...")
                        time.sleep(delay)
            
            raise last_exception
        return wrapper
    return decorator
```

**重试策略：**

| 尝试次数 | 延迟时间 | 说明 |
|---------|---------|------|
| 第1次 | 立即执行 | 正常调用 |
| 第2次 | 1s 后 | `1.0 * (2^0) = 1s` |
| 第3次 | 2s 后 | `1.0 * (2^1) = 2s` |
| 第4次 | 4s 后 | `1.0 * (2^2) = 4s` |
| 失败 | 抛出异常 | 重试耗尽 |

**为什么用指数退避？**
1. **避免雪崩**：线性重试（每次间隔1s）在高并发下会对服务端造成压力
2. **提高成功率**：短暂的网络波动通过延迟重试可以恢复
3. **快速失败**：如果真的不可达，4次尝试（1+2+4=7秒）后快速失败

---

## 🎯 StopHookCompleteStageHook：Stop Hook 实现

### 核心代码

**代码位置：** `code-agent/hooks/stop_hook_complete_stage.py:152-233`

```python
class StopHookCompleteStageHook:
    """Stop Hook - 对话终止时通知 ai24"""
    
    def __init__(self, task_id: str, stage: str):
        """
        Args:
            task_id: 任务 ID
            stage: 阶段标识（init/proposal/apply/develop）
        """
        self.task_id = task_id
        self.stage = stage
        self.client = CompleteStageClient()
    
    async def sdk_hook(
        self,
        hook_input: 'StopHookInput',
        session_id: Optional[str],
        context: 'HookContext'
    ) -> 'SyncHookJSONOutput':
        """SDK Stop Hook 入口"""
        
        hook_result = {"continue_": True}
        
        try:
            logger.info(
                f"[StopHook] 开始通知阶段完成: "
                f"taskId={self.task_id}, stage={self.stage}"
            )
            
            # 调用 CompleteStageClient
            result = self.client.complete_stage(
                task_id=self.task_id,
                command=self.stage
            )
            
            logger.info(
                f"[StopHook] 通知成功: "
                f"taskId={self.task_id}, result={result}"
            )
            
        except Exception as e:
            # 容错：失败只记录日志，不阻塞主流程
            logger.error(
                f"[StopHook] 通知失败: "
                f"taskId={self.task_id}, error={str(e)}"
            )
        
        return hook_result
```

**关键设计：**
1. **容错优先**：`try-except` 包裹全部逻辑，失败只记录日志
2. **不阻塞主流程**：无论成功失败，都返回 `{"continue_": True}`
3. **日志完整**：记录 taskId、stage、result，方便排查问题

---

### Hook 注册

```python
def get_sdk_hooks_config(self) -> Dict[str, Any]:
    """获取符合 Claude Agent SDK 格式的 hooks 配置"""
    return {
        "Stop": [
            HookMatcher(
                matcher=None,  # None 表示匹配所有 Stop 事件
                hooks=[self.sdk_hook]
            )
        ]
    }
```

**使用方式：**

```python
# 在 code-agent 启动 Claude Agent SDK 时
from hooks.stop_hook_complete_stage import StopHookCompleteStageHook

stop_hook = StopHookCompleteStageHook(
    task_id="task_123456",
    stage="init"  # 或 proposal/apply/develop
)

agent_options = ClaudeAgentOptions(
    hooks={
        "Stop": [HookMatcher(matcher=None, hooks=[stop_hook.sdk_hook])]
    }
)
```

---

## 🔍 Stop Hook 触发时机

### Claude Agent SDK 的 Stop 事件

SDK 在以下情况触发 Stop Hook：

1. **对话正常结束**：Claude 完成任务，输出最终答案
2. **达到 Token 上限**：对话超过最大 Token 数
3. **用户手动停止**：前端点击"停止任务"
4. **异常终止**：SDK 内部错误或超时

**Stop Hook 在所有情况下都会触发**，保证通知不丢失。

---

### 时序图

```
Claude Agent SDK                 Stop Hook                    ai24 平台
      |                              |                            |
      | [对话结束]                    |                            |
      |----------------------------->|                            |
      |                              |                            |
      |   sdk_hook(hook_input)       |                            |
      |                              |                            |
      |                              | complete_stage(taskId, stage)
      |                              |--------------------------->|
      |                              |                            |
      |                              |      HTTP 200 OK           |
      |                              |<---------------------------|
      |                              |                            |
      |   {"continue_": True}        |                            |
      |<-----------------------------|                            |
      |                              |                            |
      | [SDK 清理资源，退出]           |                            |
```

---

## 📊 Stop Hook vs PreToolUse Hook 对比

| 特性 | Stop Hook | PreToolUse Hook |
|------|-----------|-----------------|
| **触发时机** | 对话终止时 | 工具执行前 |
| **触发次数** | 每次对话1次 | 每次工具调用1次 |
| **典型用途** | 通知工作流流转、清理资源 | 安全拦截、参数修改 |
| **失败影响** | 不影响（对话已结束） | 可能阻止工具执行 |
| **返回值** | `{"continue_": True}` | `{"continue_": True}` 或 `{"decision": "block"}` |
| **异步执行** | 可以（对话已结束） | 不行（必须同步返回） |

---

## 🎯 面试问题准备

### Q1: Stop Hook 是什么时候触发的？

**标准回答：**

Stop Hook 在 **Claude Agent SDK 对话终止时触发**，无论是正常结束、Token 上限、用户手动停止还是异常终止，都会触发。

在我们项目中，Stop Hook 的作用是**通知 ai24 平台当前工作流阶段已完成**，触发下一阶段执行。例如：
- Claude 完成"init"阶段 → Stop Hook 通知 ai24 → ai24 进入"proposal"阶段
- Claude 完成"proposal"阶段 → Stop Hook 通知 ai24 → ai24 进入"apply"阶段

这样实现了**工作流的自动流转**，无需人工干预。

---

### Q2: 为什么 Stop Hook 失败不影响主流程？

**标准回答：**

因为 **Stop Hook 在对话结束后执行**，此时 Claude 的工作已经完成，即使通知失败也不影响任务结果。

设计原则是**容错优先**：
```python
try:
    self.client.complete_stage(task_id, stage)
    logger.info("通知成功")
except Exception as e:
    logger.error(f"通知失败: {e}")  # 只记录日志，不抛异常

return {"continue_": True}  # 无论成功失败都返回 True
```

**如果通知失败会怎样？**
- Claude 的工作成果（生成的代码、PRD）已经保存在项目目录
- 用户可以在前端看到任务完成状态
- ai24 可能不会自动进入下一阶段，需要人工触发或等待重试

**为什么不让通知失败阻塞主流程？**
因为 Stop Hook 是"锦上添花"的功能，不是"必不可少"的。即使通知失败，代码已经生成了，用户可以手动继续。

---

### Q3: 重试机制为什么用指数退避？

**标准回答：**

**指数退避（Exponential Backoff）** 是处理网络请求重试的最佳实践：

| 重试策略 | 延迟序列 | 优点 | 缺点 |
|---------|---------|------|------|
| **固定延迟** | 1s, 1s, 1s | 简单 | 高并发时对服务端压力大 |
| **线性延迟** | 1s, 2s, 3s | 逐渐降低频率 | 等待时间过长 |
| **指数退避** | 1s, 2s, 4s | 快速失败 + 避免雪崩 | 需要设置 max_delay 防止过长 |

在我们项目中：
```python
@retry_with_backoff(max_retries=3, base_delay=1.0, max_delay=30.0)
```
- 第1次失败：等待 1s → 可能是短暂的网络波动
- 第2次失败：等待 2s → 给服务端更多恢复时间
- 第3次失败：等待 4s → 最后尝试
- 总耗时：1+2+4 = 7秒 → 快速失败，不阻塞太久

**为什么不无限重试？**
因为如果 ai24 真的挂了，无限重试只会浪费资源。3次重试已经足够覆盖大部分网络抖动场景。

---

### Q4: taskId 和 stage 是从哪里来的？

**标准回答：**

**taskId** 和 **stage** 由 **ai24 平台在调用 code-agent 时传入**：

```java
// ai24/service/task/TaskPerformService.java
public void performTask(String taskId, String stage, String prompt) {
    // 调用 code-agent
    String url = "http://code-agent:5000/agent/execute";
    Map<String, Object> body = Map.of(
        "taskId", taskId,
        "stage", stage,  // init/proposal/apply/develop
        "prompt", prompt
    );
    restTemplate.post(url, body);
}
```

**code-agent 收到后，创建 Stop Hook：**

```python
# code-agent/app.py
@app.route("/agent/execute", methods=["POST"])
def execute_agent():
    task_id = request.json.get("taskId")
    stage = request.json.get("stage")
    
    # 创建 Stop Hook
    stop_hook = StopHookCompleteStageHook(task_id=task_id, stage=stage)
    
    # 启动 Claude Agent SDK
    agent = ClaudeAgent(hooks=stop_hook.get_sdk_hooks_config())
    agent.run()
```

**流程总结：**
1. ai24 创建任务 → 生成 taskId，确定当前 stage
2. ai24 调用 code-agent，传入 taskId 和 stage
3. code-agent 创建 Stop Hook，传入 taskId 和 stage
4. Claude 执行完毕 → Stop Hook 用 taskId 和 stage 通知 ai24

---

### Q5: 如何测试 Stop Hook 是否生效？

**标准回答：**

**测试方法：**

1. **单元测试**：
```python
import asyncio
from hooks.stop_hook_complete_stage import StopHookCompleteStageHook

async def test():
    hook = StopHookCompleteStageHook(task_id="test_123", stage="init")
    result = await hook.sdk_hook({}, "session_456", {})
    assert result["continue_"] == True

asyncio.run(test())
```

2. **集成测试**：
```bash
# 启动 code-agent
python app.py

# 调用 /agent/execute
curl -X POST http://localhost:5000/agent/execute \
  -H "Content-Type: application/json" \
  -d '{"taskId": "test_123", "stage": "init", "prompt": "请初始化项目"}'

# 检查 ai24 是否收到通知
curl http://ai24.daily.vdian.net/api/task/detail?taskId=test_123
# 应该看到 stage 变为 "proposal"（下一阶段）
```

3. **日志验证**：
```bash
# 查看 code-agent 日志
tail -f /var/log/code-agent/app.log | grep StopHook

# 应该看到：
[StopHook] 开始通知阶段完成: taskId=test_123, stage=init
[StopHook] 通知成功: taskId=test_123, result={'success': True}
```

**验证标准：**
- Stop Hook 在对话结束时触发（日志有记录）
- ai24 收到通知并更新任务状态（stage 变为下一阶段）
- 重试机制生效（网络故障时能看到重试日志）

---

### Q6: Stop Hook 和心跳上报有什么区别？

**标准回答：**

| 维度 | Stop Hook | 心跳上报 |
|------|-----------|---------|
| **触发时机** | 对话结束时（一次性） | 每 10s（持续） |
| **作用** | 通知工作流流转 | 监控机器存活状态 |
| **接口** | `/api/task/notify/sessionComplete` | `/api/machine/heartbeat` |
| **参数** | taskId, completedCommand | machineId, cpu, memory, taskCount |
| **失败影响** | 不影响任务结果 | 30s 超时后机器被标记离线 |
| **实现位置** | Stop Hook | machine_status_manager.py |

**两者配合工作：**
- **心跳上报**：持续报告"机器还活着，正在执行任务"
- **Stop Hook**：报告"任务执行完了，可以进入下一阶段"

类比到现实：
- 心跳 = 员工每天打卡（证明在岗）
- Stop Hook = 员工完成任务后发邮件（触发下一个流程）

---

## 💡 简历写法建议

### 项目职责（精简版）

```
参与建立 AI 可观测性体系，集成 Langfuse 记录完整对话历史、Token 消耗、工具调用链路；
开发 Stop Hook 通知机制，任务完成时通过 CompleteStageClient 通知 ai24 平台触发工作流流转
```

### 技术亮点（展开版）

```
**Stop Hook 通知**：任务完成时通过 Stop Hook 调用 CompleteStageClient，
通知 ai24 平台触发工作流流转（init → proposal → apply），
实现工作流自动化；采用指数退避重试机制（1s → 2s → 4s），
提高通知成功率并避免服务端压力
```

---

## 🚀 下一步学习

理解了 Stop Hook 后，接下来学习：

1. **Claude Agent 工作流** - Claude 如何迭代执行任务
2. **MCP 工具开发** - 如何开发 init_project、read_file 等工具
3. **Langfuse 可观测性** - 如何追踪 Claude 的每次对话

**准备好了吗？我们继续深入下一个主题！** 🎯
