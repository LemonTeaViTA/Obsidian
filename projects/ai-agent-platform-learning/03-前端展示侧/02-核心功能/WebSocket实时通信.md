# WebSocket实时通信

## 概述

WebSocket实时通信是AI Agent Platform的核心功能，负责前后端之间的双向实时数据传输。通过 `CustomAgentWebSocketProvider` 组件实现，基于GMS (Global Message Service) SDK建立长连接，实时接收任务执行过程中的消息、状态更新和事件通知。

## 核心文件

- **Context文件**: `/src/contexts/custom-agent-websocket-context.tsx`
- **事件Store**: `/src/stores/use-event-store.ts`
- **任务状态Store**: `/src/stores/task-status-store.ts`
- **会话状态Store**: `/src/stores/session-status-store.ts`

## 功能特性

### 1. 基于GMS SDK的连接管理

使用微店GMS SDK建立WebSocket连接：

```typescript
// GMS业务ID
const GMS_BUSINESS_ID = "ai24";

// 初始化GMS SDK
const sdk = SDK.getInstance();
sdk.channel.init({
  appId: GMS_BUSINESS_ID,
  userId: `task_${currentListeningTaskId}`,
  sourceType: "h5",
  wsLinkUrl: gmsWsUrl,
});

// 建立连接
sdk.channel.connect((err) => {
  if (!err) {
    setConnectionState("OPEN");
    // 发送taskId消息订阅任务相关消息
    sdk.channel.send(GMS_BUSINESS_ID, {
      type: "taskId",
      message: currentListeningTaskId,
    }, () => {});
  }
});
```

### 2. 多子任务支持

支持单任务和多子任务模式：

```typescript
// 判断是否为多子任务模式
const isMultiSubTaskMode =
  (taskDetail?.subTasks && taskDetail.subTasks.length > 1) ||
  (subTaskIds && subTaskIds.length > 1);

// 计算当前应该监听的taskId
const currentListeningTaskId = useMemo(() => {
  if (isMultiSubTaskMode) {
    // 多子任务模式：使用当前选中的子任务ID
    if (activeSubTaskId) {
      return activeSubTaskId;
    }
    if (subTaskIds && subTaskIds.length > 0) {
      return subTaskIds[0];
    }
    if (taskDetail?.subTasks && taskDetail.subTasks.length > 0) {
      return taskDetail.subTasks[0].taskId;
    }
  }
  // 单任务模式：使用主任务的realTaskId
  return realTaskId;
}, [isMultiSubTaskMode, activeSubTaskId, subTaskIds, taskDetail?.subTasks, realTaskId]);

// 计算所有需要接收消息的taskIds（用于消息过滤）
const acceptedTaskIds = useMemo(() => {
  if (subTaskIds && subTaskIds.length > 0) {
    return subTaskIds;
  }
  if (taskDetail?.subTasks && taskDetail.subTasks.length > 1) {
    return taskDetail.subTasks.map((s) => s.taskId);
  }
  return realTaskId ? [realTaskId] : [];
}, [subTaskIds, taskDetail?.subTasks, realTaskId]);
```

### 3. V1协议事件解析

支持解析V1协议的Action和Observation事件：

```typescript
/**
 * 尝试将reportContent解析为V1协议事件
 */
function tryParseV1Event(
  reportContent: string,
  actionCache?: V1ActionCache,
): any | null {
  try {
    const parsed = JSON.parse(reportContent);

    // 验证是否符合V1协议的BaseEvent结构
    const hasId = "id" in parsed && typeof parsed.id === "string";
    const hasTimestamp = "timestamp" in parsed && typeof parsed.timestamp === "string";
    const hasSource = "source" in parsed && typeof parsed.source === "string";
    const isValidSource = ["agent", "user", "environment"].includes(parsed.source);

    if (hasId && hasTimestamp && hasSource && isValidSource) {
      // 修复ActionEvent：补充缺失的必需字段
      if ("action" in parsed && "tool_name" in parsed && "tool_call_id" in parsed) {
        // 记录action的tool_call_id -> tool_name映射到缓存
        if (actionCache && typeof parsed.tool_call_id === "string") {
          actionCache[parsed.tool_call_id] = {
            tool_name: parsed.tool_name,
          };
        }

        // 补充必需字段
        if (!("thought" in parsed)) parsed.thought = [];
        if (!("thinking_blocks" in parsed)) parsed.thinking_blocks = [];
        if (!("llm_response_id" in parsed)) {
          parsed.llm_response_id = parsed.id || generateSimpleId();
        }
        if (!("security_risk" in parsed)) parsed.security_risk = "low";
        
        // 补充tool_call字段
        if (!("tool_call" in parsed)) {
          parsed.tool_call = {
            id: parsed.tool_call_id,
            type: "function",
            function: {
              name: parsed.tool_name,
              arguments: JSON.stringify(parsed.action),
            },
          };
        }
      }

      // 修复ObservationEvent：补充缺失的必需字段
      if ("observation" in parsed && "tool_call_id" in parsed) {
        // 从缓存中查找对应action的tool_name
        if (!("tool_name" in parsed) && actionCache) {
          const cachedData = actionCache[parsed.tool_call_id];
          if (cachedData) {
            parsed.tool_name = cachedData.tool_name;
          }
        }

        // 补充action_id
        if (!("action_id" in parsed)) {
          parsed.action_id = parsed.tool_call_id || generateSimpleId();
        }
      }

      return parsed;
    }

    return null;
  } catch (error) {
    return null;
  }
}
```

## 消息类型

### 1. 连接状态消息

```typescript
// type: "connected" - 连接建立
// type: "heartbeat" - 心跳消息
// type: "taskId" - 任务ID确认
```

### 2. 任务状态消息

```typescript
// type: "taskUpdate" - 任务更新通知
if (parsedData.type === "taskUpdate") {
  // 使任务详情缓存失效，触发重新获取
  if (taskIdProp) {
    queryClient.invalidateQueries({
      queryKey: ["task-detail", taskIdProp],
    });
  }
  // 同时使所有子任务详情缓存失效
  queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === "sub-task-detail",
  });
  removeErrorMessage();
  return;
}

// type: "sessionStatus" - 会话状态更新
if (parsedData.type === "sessionStatus") {
  const statusTaskId = parsedData.taskId as string;
  const sessionStatus = parsedData.sessionStatus as number;
  if (statusTaskId) {
    setSessionStatus(statusTaskId, sessionStatus);
  }
  removeErrorMessage();
  return;
}
```

### 3. 报告消息 (reportType)

根据 `reportType` 字段区分不同类型的消息：

```typescript
// reportType=1: 状态消息（成功/失败）
case 1: {
  const statusData = JSON.parse(cleanedContent);
  const { code, message } = statusData;
  
  if (code === 999) {
    // 任务终止
    setTaskStatus(999);
    addEventWithTaskId({
      id: generateSimpleId(),
      timestamp: new Date().toISOString(),
      source: "agent" as const,
      tool_name: "websocket",
      tool_call_id: "",
      error: message || "任务已终止",
    });
  } else if (code === 0) {
    // 成功消息
    addEventWithTaskId({
      id: generateSimpleId(),
      timestamp: new Date().toISOString(),
      source: "agent" as const,
      llm_message: {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: message || "操作成功" }],
      },
      activated_microagents: [],
      extended_content: [],
    });
  } else {
    // 错误消息
    addEventWithTaskId({
      id: generateSimpleId(),
      timestamp: new Date().toISOString(),
      source: "agent" as const,
      tool_name: "websocket",
      tool_call_id: "",
      error: message || "操作失败",
    });
  }
  break;
}

// reportType=2: 用户消息确认
case 2: {
  const v1Event = tryParseV1Event(cleanedContent, v1ActionCacheRef.current);
  if (v1Event) {
    addEventWithTaskId({ ...v1Event, source: "user" as const });
  } else {
    addEventWithTaskId({
      id: generateSimpleId(),
      timestamp: new Date().toISOString(),
      source: "user" as const,
      llm_message: {
        role: "user" as const,
        content: [{ type: "text" as const, text: cleanedContent }],
      },
      activated_microagents: [],
      extended_content: [],
    });
  }
  removeOptimisticUserMessage();
  break;
}

// reportType=3: 系统消息（Agent响应）
case 3: {
  const v1Event = tryParseV1Event(cleanedContent, v1ActionCacheRef.current);
  if (v1Event) {
    // 检查是否是TaskTracker/TodoWrite消息，更新任务进度store
    const isTaskTrackerAction = v1Event.action?.kind === "TaskTrackerAction";
    const isTodoWriteAction = v1Event.tool_call?.function?.name === "TodoWrite";
    
    if ((isTaskTrackerAction || isTodoWriteAction) && 
        v1Event.action?.task_list && 
        Array.isArray(v1Event.action.task_list)) {
      const taskList = v1Event.action.task_list.map((task) => ({
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: task.title || task.content || "",
        status: task.status === "todo" ? "pending" : 
                task.status === "done" ? "completed" : 
                task.status || "pending",
        activeForm: task.notes || task.activeForm || "",
      }));
      
      if (progressTaskId) {
        useTaskProgressStore.getState().setTaskList(progressTaskId, taskList);
      }
    }
    
    addEventWithTaskId({ ...v1Event, source: "agent" as const });
  } else {
    addEventWithTaskId({
      id: generateSimpleId(),
      timestamp: new Date().toISOString(),
      source: "agent" as const,
      llm_message: {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: cleanedContent }],
      },
      activated_microagents: [],
      extended_content: [],
    });
  }
  break;
}

// reportType=5: 文档消息（不在聊天中显示）
case 5: {
  // 直接跳过，文档有专门的展示位置
  break;
}
```

### 4. 前端预览消息

```typescript
// type: "frontend_preview" - 前端预览消息
if (parsedData.type === "frontend_preview") {
  const reportContent = typeof parsedData.reportContent === "string"
    ? JSON.parse(parsedData.reportContent)
    : parsedData.reportContent;

  const { status, previewUrl, host, port, projectType, domain, debugPages } = reportContent;

  if (status === "started" && previewUrl) {
    // 预览成功
    const previewData: PreviewResponseData = {
      success: true,
      message: "",
      preview_url: previewUrl,
      actual_host: host,
      actual_port: port,
      project_type: projectType || "web",
      domain: domain || "vdian.net",
    };

    const { url: transformedUrl, useNewWindow } = transformPreviewUrl(previewData);

    setTaskState(previewTaskId, {
      previewUrl: transformedUrl,
      useNewWindow,
      debugPages: debugPages || [],
      isLoading: false,
      errorMessage: "",
    });

    startHeartbeat(previewTaskId);
  } else if (status === "failed") {
    // 预览失败
    resetTask(previewTaskId);
    setTaskState(previewTaskId, {
      errorMessage: reportContent.message || "预览启动失败",
    });
  }
}
```

### 5. 客户端构建消息

```typescript
// type: "clientPreview" - 客户端构建消息
if (parsedData.type === "clientPreview") {
  const isSuccess = parsedData.success === true;

  if (isSuccess) {
    const { qrCodeUrl, downloadUrl, buildDuration, packSize } = parsedData.data;
    setBuildSuccess({ qrCodeUrl, downloadUrl, buildDuration, packSize });
    
    const successMessage = `客户端构建成功！\n\n下载链接：${downloadUrl}\n构建耗时：${formatDuration(buildDuration)}\n包大小：${formatSize(packSize)}`;
    addEvent({
      id: generateSimpleId(),
      timestamp: new Date().toISOString(),
      source: "agent" as const,
      llm_message: {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: successMessage }],
      },
      activated_microagents: [],
      extended_content: [],
    });
  } else {
    const { buildUrl, consoleLogUrl } = parsedData.data;
    const errorMsg = parsedData.message || "客户端构建失败";
    setBuildFailed({ buildUrl, consoleLogUrl, errorMessage: errorMsg });
    
    const failedMessage = `客户端构建失败\n\n${errorMsg}\n\n查看构建详情：${buildUrl}\n查看日志：${consoleLogUrl}`;
    addEvent({
      id: generateSimpleId(),
      timestamp: new Date().toISOString(),
      source: "agent" as const,
      llm_message: {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: failedMessage }],
      },
      activated_microagents: [],
      extended_content: [],
    });
  }
}
```

## 历史消息加载

从API加载历史对话记录并转换为事件格式：

```typescript
useEffect(() => {
  if (!taskReportsData || taskReportsData.length === 0) return;
  if (!isMultiSubTaskMode && !realTaskId) return;

  // 防止重复加载：检查EventStore中是否已经有历史消息
  const { events } = useEventStore.getState();
  const hasCurrentTaskHistory = events.some((event) => {
    if (!("id" in event) || !("historyTaskId" in event)) return false;
    const eventHistoryTaskId = (event as { historyTaskId?: string }).historyTaskId;
    
    if (isMultiSubTaskMode) {
      return event.id.startsWith("history_") && 
             acceptedTaskIds.includes(eventHistoryTaskId || "");
    }
    return event.id.startsWith("history_") && eventHistoryTaskId === realTaskId;
  });

  if (hasCurrentTaskHistory) return;

  // 将历史数据转换为V1事件格式并添加到EventStore
  taskReportsData
    .filter((report) => report.recordType !== 5) // 过滤掉文档记录
    .forEach((report) => {
      const reportTaskId = "_taskId" in report
        ? (report as { _taskId: string })._taskId
        : report.taskId || realTaskId;
      
      const cleanedContent = cleanAnsiEscapeSequences(report.content).trim();
      if (!cleanedContent) return;

      // 根据recordType创建不同类型的事件
      switch (report.recordType) {
        case 1: // 状态消息
        case 2: // 用户消息
        case 3: // 系统消息
          // ... 处理逻辑与WebSocket消息类似
          break;
        default:
          break;
      }
    });
}, [taskReportsData, addEvent, realTaskId, taskIdProp, isMultiSubTaskMode, acceptedTaskIds]);
```

## 数据流

```
GMS WebSocket连接建立
  ↓
发送taskId消息订阅
  ↓
接收WebSocket消息
  ↓
消息解析与分类
  ├─ 连接状态消息 → 更新连接状态
  ├─ 任务状态消息 → 更新任务状态、刷新缓存
  ├─ 报告消息 (reportType)
  │   ├─ reportType=1 → 状态消息（成功/失败/终止）
  │   ├─ reportType=2 → 用户消息确认
  │   ├─ reportType=3 → 系统消息（V1事件）
  │   └─ reportType=5 → 文档消息（跳过）
  ├─ 前端预览消息 → 更新预览状态
  └─ 客户端构建消息 → 更新构建状态
  ↓
V1事件解析与修复
  ├─ ActionEvent → 补充必需字段、缓存tool_call_id
  └─ ObservationEvent → 从缓存查找tool_name、补充字段
  ↓
添加到EventStore
  ↓
触发UI更新（对话列表、任务进度等）
```

## 使用方式

### 基础用法

```tsx
import { CustomAgentWebSocketProvider, useCustomAgentWebSocket } from "#/contexts/custom-agent-websocket-context";

// 在父组件中提供Context
function ConversationPage({ taskId }) {
  return (
    <CustomAgentWebSocketProvider taskId={taskId}>
      <ChatInterface />
    </CustomAgentWebSocketProvider>
  );
}

// 在子组件中使用WebSocket
function ChatInterface() {
  const ws = useCustomAgentWebSocket();
  
  const handleSendMessage = async (message: string) => {
    if (ws?.connectionState === "OPEN") {
      await ws.sendMessage(message);
    }
  };

  return (
    <div>
      <div>连接状态: {ws?.connectionState}</div>
      <button onClick={() => handleSendMessage("Hello")}>
        发送消息
      </button>
    </div>
  );
}
```

### 多子任务模式

```tsx
// 多子任务模式：传入subTaskIds和activeSubTaskId
<CustomAgentWebSocketProvider 
  taskId={mainTaskId}
  subTaskIds={["task_1", "task_2", "task_3"]}
  activeSubTaskId={currentSubTaskId}
>
  <MultiTaskInterface />
</CustomAgentWebSocketProvider>

// 子任务切换时会自动重新建立连接和加载历史
```

## 常见问题

### 1. WebSocket连接失败？

**原因**: GMS服务地址配置错误或网络问题。

**解决方案**:
```bash
# 检查环境变量配置
VITE_GMS_WS_URL="wss://link.daily.weidian.com/gms_ws"

# 查看连接错误日志
console.error("[GMS] Connection error:", err);
```

### 2. 消息收不到或重复收到？

**原因**: taskId订阅不正确或消息过滤失败。

**解决方案**:
```typescript
// 确保taskId消息已发送
sdk.channel.send(GMS_BUSINESS_ID, {
  type: "taskId",
  message: currentListeningTaskId,
}, () => {});

// 检查消息过滤逻辑
const messageTaskId = parsedData.taskId;
if (messageTaskId && 
    acceptedTaskIds.length > 0 && 
    !acceptedTaskIds.includes(messageTaskId)) {
  return; // 过滤掉不匹配的消息
}
```

### 3. 历史消息重复加载？

**原因**: 组件重新渲染导致useEffect重复执行。

**解决方案**:
```typescript
// 使用hasCurrentTaskHistory标志防止重复加载
const hasCurrentTaskHistory = events.some((event) => {
  return event.id.startsWith("history_") && 
         eventHistoryTaskId === realTaskId;
});

if (hasCurrentTaskHistory) {
  console.log("已存在历史记录，跳过重复加载");
  return;
}
```

### 4. V1事件解析失败？

**原因**: 事件格式不完整或缺少必需字段。

**解决方案**:
```typescript
// 使用tryParseV1Event自动补充缺失字段
const v1Event = tryParseV1Event(cleanedContent, v1ActionCacheRef.current);

if (v1Event) {
  // 成功解析，直接使用
  addEventWithTaskId(v1Event);
} else {
  // 解析失败，使用兜底逻辑
  addEventWithTaskId({
    id: generateSimpleId(),
    timestamp: new Date().toISOString(),
    source: "agent" as const,
    llm_message: {
      role: "assistant" as const,
      content: [{ type: "text" as const, text: cleanedContent }],
    },
    activated_microagents: [],
    extended_content: [],
  });
}
```

### 5. 子任务切换后消息混乱？

**原因**: 子任务切换时未清理旧事件或未重新订阅。

**解决方案**:
```typescript
// 检测子任务切换，清理事件和缓存
if (prevListeningTaskIdRef.current !== undefined &&
    prevListeningTaskIdRef.current !== currentListeningTaskId &&
    isMultiSubTaskMode) {
  const { clearEvents } = useEventStore.getState();
  clearEvents();
  removeOptimisticUserMessage();
  v1ActionCacheRef.current = {};
  useTaskProgressStore.getState().clearTaskList();
}

// 更新子任务监听ref
prevListeningTaskIdRef.current = currentListeningTaskId;
```

## 相关资源

- **GMS SDK**: `@vdian/conn-sdk`
- **事件存储**: `/src/stores/use-event-store.ts`
- **任务状态**: `/src/stores/task-status-store.ts`
- **会话状态**: `/src/stores/session-status-store.ts`
- **预览状态**: `/src/stores/preview-store.ts`
- **任务进度**: `/src/stores/task-progress-store.ts`
- **子任务管理**: `/src/state/sub-task-store.ts`
- **测试文件**: `/__tests__/contexts/custom-agent-websocket-context.test.tsx`
