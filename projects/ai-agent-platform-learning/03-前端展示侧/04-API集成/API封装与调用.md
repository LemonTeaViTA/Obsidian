# API封装与调用

## 概述

AI Agent Platform 的前端 API 层采用模块化设计，基于 Axios 进行封装，提供了统一的请求配置、错误处理、拦截器机制。所有 API 按业务模块分类组织，支持 TypeScript 类型定义，便于维护和扩展。

## 核心文件

- **Axios实例**: `/src/api/open-hands-axios.ts`
- **API工具**: `/src/utils/api-base-url.ts`
- **任务服务**: `/src/api/task-service/task-service.api.ts`
- **用户服务**: `/src/api/user-service/user-service.api.ts`
- **模型服务**: `/src/api/model-service/model-service.api.ts`

## API目录结构

```
src/api/
├── open-hands-axios.ts              # 全局Axios实例
├── api-keys.ts                      # API密钥管理
├── approval-service/                # 审批服务
├── auth-service/                    # 认证服务
├── billing-service/                 # 账单服务
├── conversation-service/            # 对话服务
├── document-service/                # 文档服务
├── git-service/                     # Git服务
├── gitlab-service/                  # GitLab服务
├── model-service/                   # 模型服务
├── task-service/                    # 任务服务
├── user-service/                    # 用户服务
└── uitest/                          # UI测试服务
```

## Axios实例配置

### 1. 全局实例创建

```typescript
// src/api/open-hands-axios.ts
import axios from "axios";
import { displayErrorToast } from "#/utils/custom-toast-handlers";

export const openHands = axios.create({
  baseURL: `${window.location.protocol}//${import.meta.env.VITE_BACKEND_BASE_URL || window?.location.host}`,
  withCredentials: true, // 允许跨域请求携带 cookie
});
```

### 2. 响应拦截器

自动处理业务错误和特殊状态：

```typescript
// 响应拦截器
openHands.interceptors.response.use(
  (response: AxiosResponse) => {
    // 检查业务逻辑错误（success: false）
    if (
      response.data &&
      typeof response.data === "object" &&
      "success" in response.data
    ) {
      if (response.data.success === false) {
        const errorMessage = response.data.message || "操作失败";
        displayErrorToast(errorMessage);

        // 创建错误对象并拒绝Promise
        const businessError = new Error(errorMessage);
        (businessError as any).response = response;
        (businessError as any).isBusinessError = true;
        return Promise.reject(businessError);
      }
    }

    return response;
  },
  (error: AxiosError) => {
    // 检查403错误（邮箱验证）
    if (
      error.response?.status === 403 &&
      checkForEmailVerificationError(error.response?.data)
    ) {
      if (window.location.pathname !== "/settings/user") {
        window.location.reload();
      }
    }

    return Promise.reject(error);
  },
);
```

### 3. 邮箱验证错误检查

```typescript
// 检查响应中是否包含邮箱验证错误
const checkForEmailVerificationError = (data: any): boolean => {
  const EMAIL_NOT_VERIFIED = "EmailNotVerifiedError";

  if (typeof data === "string") {
    return data.includes(EMAIL_NOT_VERIFIED);
  }

  if (typeof data === "object" && data !== null) {
    if ("message" in data) {
      const { message } = data;
      if (typeof message === "string") {
        return message.includes(EMAIL_NOT_VERIFIED);
      }
      if (Array.isArray(message)) {
        return message.some(
          (msg) => typeof msg === "string" && msg.includes(EMAIL_NOT_VERIFIED),
        );
      }
    }

    // 搜索对象中的任何值
    return Object.values(data).some(
      (value) =>
        (typeof value === "string" && value.includes(EMAIL_NOT_VERIFIED)) ||
        (Array.isArray(value) &&
          value.some(
            (v) => typeof v === "string" && v.includes(EMAIL_NOT_VERIFIED),
          )),
    );
  }

  return false;
};
```

## API封装模式

### 1. 标准API函数结构

```typescript
/**
 * API函数文档注释
 * @param paramName - 参数说明
 * @returns 返回值说明
 */
export async function apiFunction(
  param1: string,
  param2?: number,
): Promise<ResponseType> {
  // 1. 获取API基础URL
  const apiBaseUrl = getApiBaseUrl();

  // 2. 构建请求参数
  const params: Record<string, string | number> = { param1 };
  if (param2) {
    params.param2 = param2;
  }

  // 3. 发送请求
  const response = await axios.get<ApiResponse>(
    `${apiBaseUrl}/api/endpoint`,
    { params }
  );

  // 4. 检查响应状态
  if (!response.data.success) {
    throw new Error(response.data.message || "操作失败");
  }

  // 5. 返回数据
  return response.data.data;
}
```

### 2. TypeScript类型定义

每个API都有完整的类型定义：

```typescript
/**
 * 按天统计数据的接口响应类型
 */
export interface DayStatisticsData {
  date: string;                    // 日期，格式如 "2025-01-01"
  totalCodeLines: number;          // 当天生成的代码行数
  totalTasks: number;              // 当天完成的任务数
  totalTokenConsumption: number;   // 当天消耗的Token数
  totalExecutionTime: number;      // 当天执行时间（秒）
  developCodeCount: number;        // 当天生成的开发代码行数
  totalTestsCodeLines: number;     // 当天生成的单测代码行数
}

export interface DayStatisticsResponse {
  success: boolean;
  data: DayStatisticsData[];
  message?: string;
}
```

### 3. GET请求示例

```typescript
/**
 * 获取个人按天统计的数据
 * @param days - 获取近x天的数据，默认7天
 * @param username - 用户名，指定要查询的用户
 * @returns 个人按天统计数据数组
 */
export async function getDaysPersonal(
  days: number = 7,
  username?: string,
): Promise<DayStatisticsData[]> {
  const apiBaseUrl = getApiBaseUrl();

  const params: Record<string, string | number> = { days };
  if (username) {
    params.username = username;
  }

  const response = await axios.get<DayStatisticsResponse>(
    `${apiBaseUrl}/api/taskStatistics/days/personal`,
    { params }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "获取个人按天统计数据失败");
  }

  return response.data.data;
}
```

### 4. POST请求示例

```typescript
/**
 * 启动前端预览
 * @param backendTaskId - 后端数据库中的任务ID
 * @param env - 预览环境: "daily" | "pre" | "prod"
 * @param devMode - 调试模式（仅管理员可用）
 * @returns 启动预览的响应
 */
export async function startPreview(
  backendTaskId: string,
  env?: "daily" | "pre" | "prod",
  devMode?: boolean,
): Promise<StartPreviewResponse["data"]> {
  const apiBaseUrl = getApiBaseUrl();

  const requestBody: Record<string, string | boolean> = {
    taskId: backendTaskId,
    env: env || "daily",
  };

  if (devMode) {
    requestBody.devMode = true;
  }

  const response = await axios.post<StartPreviewResponse>(
    `${apiBaseUrl}/api/task/preview`,
    requestBody,
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "启动前端预览失败");
  }

  return response.data.data;
}
```

### 5. 带可选参数的请求

```typescript
/**
 * 中断任务
 * @param backendTaskId - 后端数据库中的任务ID
 * @param subTaskId - 子任务ID（可选，多子任务模式时传入）
 */
export async function interruptTask(
  backendTaskId: string,
  subTaskId?: string,
): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  await axios.get(`${apiBaseUrl}/api/task/interrupt`, {
    params: {
      taskId: backendTaskId,
      ...(subTaskId && { subTaskId }), // 仅在subTaskId存在时添加
    },
  });
}
```

## React Query集成

### 1. 查询Hook封装

```typescript
// src/hooks/query/use-tasks-with-summary.ts
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getApiBaseUrl } from "#/utils/api-base-url";

export interface TaskQueryParams {
  taskName?: string;
  taskId?: string;
  userId?: string;
  status?: number;
  // ... 其他参数
}

export function useTasksWithSummary(
  current: number,
  pageSize: number,
  params: TaskQueryParams,
) {
  return useQuery({
    queryKey: ["tasks-with-summary", current, pageSize, params],
    queryFn: async () => {
      const apiBaseUrl = getApiBaseUrl();
      
      const response = await axios.get(
        `${apiBaseUrl}/api/taskInfo/list`,
        {
          params: {
            current,
            pageSize,
            ...params,
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || "获取任务列表失败");
      }

      return response.data.data;
    },
    staleTime: 30000, // 30秒内数据视为新鲜
  });
}
```

### 2. 变更Hook封装

```typescript
// src/hooks/mutation/use-delete-task.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTask } from "#/api/task-service/task-service.api";
import { displaySuccessToast, displayErrorToast } from "#/utils/custom-toast-handlers";

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      // 删除成功后刷新任务列表
      queryClient.invalidateQueries({ queryKey: ["tasks-with-summary"] });
      displaySuccessToast("任务删除成功");
    },
    onError: (error: Error) => {
      displayErrorToast(error.message || "任务删除失败");
    },
  });
}
```

## 常用API示例

### 1. 任务相关API

```typescript
// 创建任务
const response = await axios.post(
  `${apiBaseUrl}/api/taskInfo/create`,
  {
    input: JSON.stringify(inputData),
    status: 100,
    username: window.ssoData.name,
  }
);

// 获取任务详情
const response = await axios.get(
  `${apiBaseUrl}/api/taskInfo/detail`,
  { params: { id: taskId } }
);

// 获取任务历史记录
const response = await axios.get(
  `${apiBaseUrl}/api/report/list`,
  { params: { taskId } }
);

// 中断任务
await interruptTask(backendTaskId, subTaskId);

// 删除任务
await deleteTask(taskId);
```

### 2. 用户相关API

```typescript
// 搜索用户
const response = await axios.get(
  `${apiBaseUrl}/api/user/search`,
  { params: { keyword } }
);

// 获取用户信息
const response = await axios.get(
  `${apiBaseUrl}/api/user/info`,
  { params: { userId } }
);
```

### 3. 模型相关API

```typescript
// 获取模型配置列表
const response = await axios.get(
  `${apiBaseUrl}/api/modelConfig/list`
);

// 获取默认模型
const response = await axios.get(
  `${apiBaseUrl}/api/modelConfig/default`
);
```

### 4. 工作流相关API

```typescript
// 获取工作流列表
const response = await axios.get(
  `${apiBaseUrl}/api/promptTemplate/promptParent/listByUser`,
  { params: { workflowTypes: "1,2,3" } }
);

// 获取工作流详情
const response = await axios.get(
  `${apiBaseUrl}/api/workflow/detail`,
  { params: { workflowNo } }
);
```

### 5. 统计相关API

```typescript
// 获取个人按天统计
const data = await getDaysPersonal(7, username);

// 获取全局按天统计
const data = await getDaysGlobal(7);
```

## 环境配置

### 1. 环境变量

```bash
# .env 文件
VITE_BACKEND_BASE_URL="localhost:3000"     # 后端URL（不含协议）
VITE_BACKEND_HOST="127.0.0.1:3000"         # 后端主机地址
VITE_USE_TLS="false"                       # 是否使用HTTPS/WSS
VITE_NEW_BACKEND_URL="http://localhost:8080"  # 新后端URL
VITE_NEW_API_TIMEOUT="30000"               # 新API超时时间（毫秒）
```

### 2. API基础URL获取

```typescript
// src/utils/api-base-url.ts
export function getApiBaseUrl(): string {
  const protocol = import.meta.env.VITE_USE_TLS === "true" ? "https" : "http";
  const host = import.meta.env.VITE_BACKEND_BASE_URL || window.location.host;
  return `${protocol}://${host}`;
}
```

## 错误处理

### 1. 统一错误处理

```typescript
try {
  const response = await axios.post(url, data);
  
  if (!response.data.success) {
    throw new Error(response.data.message || "操作失败");
  }
  
  return response.data.data;
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // 服务器返回错误响应
      const errorMsg = error.response.data?.message ||
        `服务器错误 (${error.response.status})`;
      displayErrorToast(errorMsg);
    } else if (error.request) {
      // 请求已发出但没有收到响应
      displayErrorToast("网络连接失败，请检查网络连接");
    } else {
      // 请求配置出错
      displayErrorToast("请求配置错误，请重试");
    }
  } else {
    displayErrorToast("操作失败，请稍后重试");
  }
  throw error;
}
```

### 2. 业务错误拦截

响应拦截器会自动处理 `success: false` 的业务错误：

```typescript
// 自动拦截并显示错误提示
{
  "success": false,
  "message": "用户权限不足",
  "data": null
}

// 拦截器会：
// 1. 调用 displayErrorToast("用户权限不足")
// 2. 拒绝Promise并抛出错误
```

### 3. 特殊错误处理

```typescript
// 邮箱未验证错误 - 自动刷新页面
if (error.response?.status === 403 && 
    error.response.data?.message?.includes("EmailNotVerifiedError")) {
  window.location.reload();
}

// 401未授权 - 跳转登录页
if (error.response?.status === 401) {
  window.location.href = "/login";
}
```

## 数据流

```
组件调用Hook
  ↓
Hook调用API函数
  ↓
API函数构建请求
  ├─ 获取baseURL (getApiBaseUrl)
  ├─ 构建params/body
  └─ 添加headers
  ↓
发送Axios请求
  ↓
响应拦截器处理
  ├─ 检查business error (success: false)
  ├─ 检查邮箱验证错误 (403 + EmailNotVerifiedError)
  └─ 通过则返回response
  ↓
API函数处理响应
  ├─ 检查success字段
  ├─ 抛出错误或返回data
  └─ 类型转换
  ↓
Hook处理结果
  ├─ 成功: 更新缓存、显示提示
  └─ 失败: 错误处理、显示错误
  ↓
组件获取数据/状态
```

## 使用方式

### 1. 直接调用API函数

```typescript
import { getDaysPersonal } from "#/api/task-service/task-service.api";

async function fetchData() {
  try {
    const data = await getDaysPersonal(7, "zhangsan");
    console.log("统计数据:", data);
  } catch (error) {
    console.error("获取失败:", error);
  }
}
```

### 2. 使用React Query Hook

```typescript
import { useTasksWithSummary } from "#/hooks/query/use-tasks-with-summary";

function TaskList() {
  const { data, isLoading, error } = useTasksWithSummary(
    1,  // current
    10, // pageSize
    { status: 500, userId: "zhangsan" }
  );

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>加载失败</div>;

  return (
    <div>
      {data.records.map((task) => (
        <div key={task.id}>{task.taskName}</div>
      ))}
    </div>
  );
}
```

### 3. 使用Mutation Hook

```typescript
import { useDeleteTask } from "#/hooks/mutation/use-delete-task";

function TaskActions({ taskId }: { taskId: number }) {
  const deleteTaskMutation = useDeleteTask();

  const handleDelete = async () => {
    await deleteTaskMutation.mutateAsync(taskId);
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={deleteTaskMutation.isPending}
    >
      {deleteTaskMutation.isPending ? "删除中..." : "删除"}
    </button>
  );
}
```

## 常见问题

### 1. CORS跨域问题？

**原因**: 后端未配置CORS或withCredentials设置不正确。

**解决方案**:
```typescript
// Axios实例已配置withCredentials
export const openHands = axios.create({
  baseURL: `${window.location.protocol}//${import.meta.env.VITE_BACKEND_BASE_URL}`,
  withCredentials: true, // 允许跨域携带cookie
});

// 确保后端配置CORS
// Access-Control-Allow-Origin: 前端域名
// Access-Control-Allow-Credentials: true
```

### 2. API请求超时？

**原因**: 网络慢或后端处理时间长。

**解决方案**:
```typescript
// 为特定请求设置超时
const response = await axios.get(url, {
  timeout: 60000, // 60秒
});

// 或在Axios实例中全局设置
export const openHands = axios.create({
  baseURL: "...",
  timeout: 30000, // 30秒
});
```

### 3. 响应数据类型不匹配？

**原因**: TypeScript类型定义与实际响应不一致。

**解决方案**:
```typescript
// 使用泛型指定响应类型
const response = await axios.get<ApiResponse<TaskData>>(url);

// 运行时验证关键字段
if (!response.data || typeof response.data.success !== "boolean") {
  throw new Error("响应数据格式错误");
}
```

### 4. 业务错误未被捕获？

**原因**: 响应拦截器只处理 `success: false`，其他业务错误需手动检查。

**解决方案**:
```typescript
// API函数中明确检查success字段
if (!response.data.success) {
  throw new Error(response.data.message || "操作失败");
}

// 或使用响应拦截器统一处理
openHands.interceptors.response.use(
  (response) => {
    if (response.data?.success === false) {
      displayErrorToast(response.data.message);
      return Promise.reject(new Error(response.data.message));
    }
    return response;
  }
);
```

### 5. 如何取消正在进行的请求？

**解决方案**:
```typescript
import { useEffect, useRef } from "react";

function Component() {
  const abortControllerRef = useRef<AbortController>();

  useEffect(() => {
    abortControllerRef.current = new AbortController();

    const fetchData = async () => {
      try {
        const response = await axios.get(url, {
          signal: abortControllerRef.current?.signal,
        });
        // 处理响应
      } catch (error) {
        if (axios.isCancel(error)) {
          console.log("请求已取消");
        }
      }
    };

    fetchData();

    // 组件卸载时取消请求
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);
}
```

### 6. 如何处理并发请求？

**解决方案**:
```typescript
// 使用Promise.all
const [data1, data2, data3] = await Promise.all([
  getDaysPersonal(7),
  getDaysGlobal(7),
  getTaskDetail(taskId),
]);

// 使用Promise.allSettled（容错）
const results = await Promise.allSettled([
  getDaysPersonal(7),
  getDaysGlobal(7),
  getTaskDetail(taskId),
]);

results.forEach((result, index) => {
  if (result.status === "fulfilled") {
    console.log(`请求${index}成功:`, result.value);
  } else {
    console.error(`请求${index}失败:`, result.reason);
  }
});
```

## 相关资源

- **Axios文档**: https://axios-http.com/
- **React Query文档**: https://tanstack.com/query/latest
- **API基础配置**: `/src/api/open-hands-axios.ts`
- **工具函数**: `/src/utils/api-base-url.ts`
- **Toast提示**: `/src/utils/custom-toast-handlers.ts`
- **环境配置**: `/.env.sample`
