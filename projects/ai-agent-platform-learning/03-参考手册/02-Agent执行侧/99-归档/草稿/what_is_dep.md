# DEP 系统详解

## 什么是 DEP？

**DEP = Development Efficiency Platform（开发效能平台）**

这是公司内部的**项目管理和需求管理系统**，类似于 Jira、禅道等工具。

---

## DEP 的作用

### 1. 需求管理
```
产品经理在 DEP 创建需求：
  - 需求标题
  - PRD 文档
  - 验收标准
  - 优先级
```

### 2. 任务管理
```
项目经理在 DEP 创建任务：
  - 关联需求
  - 分配开发人员
  - 设置截止日期
  - 跟踪进度
```

### 3. 测试用例管理
```
测试人员在 DEP 管理测试用例：
  - 创建测试用例库
  - 编写测试用例
  - 执行测试
  - 记录缺陷
```

---

## 在 Code-Agent 中的作用

### DEP 是任务的"源头"

```
完整流程：

1. 产品经理在 DEP 创建需求
   ↓
   需求 ID: DEP123
   PRD: http://dep.vdian.net/#/requirement?id=123
   ↓

2. AI24 平台从 DEP 拉取任务
   ↓
   获取：
   - dep_id: 123
   - dep_url: http://dep.vdian.net/#/requirement?id=123
   - git_url: http://gitlab.com/project.git
   - branch: master
   ↓

3. AI24 调用 Code-Agent
   POST /task/perform/init
   {
       "taskId": "T123",
       "depUrl": "http://dep.vdian.net/#/requirement?id=123"
   }
   ↓

4. Code-Agent 通过 DEP MCP 获取元数据
   mcp__dep__getIssueDetail(depId=123)
   ↓
   返回：
   {
       "title": "用户登录功能",
       "prd": "# 用户登录功能\n\n需求说明...",
       "gitUrl": "http://gitlab.com/project.git",
       "branch": "develop"
   }
   ↓

5. Code-Agent 初始化项目
   - Clone 代码
   - 保存 PRD
   - 初始化 OpenSpec
   ↓

6. 开发完成后，上报结果到 DEP
```

---

## DEP 的核心功能（在项目中）

### 功能 1：获取需求信息

```python
# 通过 DEP MCP
mcp__dep__getIssueDetail(depId=123)

# 返回
{
    "id": 123,
    "title": "用户登录功能",
    "description": "实现用户名密码登录",
    "prd": "# PRD 文档内容...",
    "gitUrl": "http://gitlab.com/project.git",
    "branch": "develop",
    "assignee": "zhangsan",
    "priority": "P0"
}
```

**代码位置**：`fetch_task_metadata_refactored.py:63`

---

### 功能 2：获取子任务列表

```python
# 通过 DEP MCP
mcp__dep__getRequirementTasks(requirementId=123)

# 返回
{
    "tasks": [
        {
            "taskId": "TASK-001",
            "title": "登录接口开发",
            "status": "进行中"
        },
        {
            "taskId": "TASK-002",
            "title": "登录前端页面",
            "status": "待开始"
        }
    ]
}
```

---

### 功能 3：上传测试用例到 DEP

```python
# main.py:1327-1469: export_test_cases_to_dep()

流程：
1. 从本地读取测试用例（XMind 格式）
2. 调用 DEP MCP: importTestCase()
3. 轮询确认导入成功
4. 上报结果到 AI24
```

**使用场景**：
```
用户：/export-testcase-to-dep
  ↓
Code-Agent：
  1. 读取 test_cases.xmind
  2. 转换格式
  3. 调用 DEP MCP 导入
  ↓
DEP 系统：
  - 创建测试用例
  - 显示在用例库中
```

---

### 功能 4：更新任务详情

```python
# 通过 DEP MCP
mcp__dep__updateIssueDetail(
    depId=123,
    status="已完成",
    comment="开发完成，已提交代码"
)
```

---

## DEP URL 的格式

### 需求详情页
```
http://dep.vdian.net/#/requirement?id=123
                                    ↑
                                  dep_id
```

### 测试用例库
```
http://dep.vdian.net/#/testRepositoryDetail?libraryId=11&checkedId=714144_directory&checkedDirId=714144
                                                                                         ↑
                                                                                    directory_id
```

### 解析代码
```python
# main.py:178-226
def parse_dep_id_from_url(dep_url: str) -> str:
    """从 depUrl 中解析出 dep_id"""
    
    # 处理 hash 后的 URL 参数
    if '#' in dep_url:
        hash_part = dep_url.split('#')[1]
        if '?' in hash_part:
            query_string = hash_part.split('?')[1]
            params = parse_qs(query_string)
            dep_id = params.get('id', [None])[0]
            
    return dep_id
```

---

## 实际使用场景

### 场景 1：从 DEP 初始化任务

```
1. 产品经理在 DEP 创建需求
   需求 ID: 12345
   PRD: 用户登录功能需求文档
   关联代码仓库: http://gitlab.com/user-service.git

2. AI24 调用 Code-Agent
   POST /task/perform/init
   {
       "taskId": "T20260707001",
       "depUrl": "http://dep.vdian.net/#/requirement?id=12345"
   }

3. Code-Agent 处理
   ① 解析 dep_id = 12345
   ② 调用 DEP MCP 获取元数据
   ③ Clone 代码：http://gitlab.com/user-service.git
   ④ 保存 PRD 到 prd.md
   ⑤ 初始化 OpenSpec

4. 开发人员开始工作
   用户：/openspec:proposal
   （Claude 读取 prd.md 生成技术方案）
```

---

### 场景 2：测试用例导出到 DEP

```
1. 测试任务生成测试用例
   文件：test_cases.xmind
   内容：
     - 登录功能测试
       - 正常登录
       - 密码错误
       - 用户名不存在

2. 用户执行导出命令
   用户：/export-testcase-to-dep
   
3. Code-Agent 处理
   ① 读取 test_cases.xmind
   ② 转换为 DEP 格式
   ③ 调用 DEP MCP: importTestCase()
   ④ 轮询确认导入成功

4. DEP 系统更新
   测试用例库新增：
   - 登录功能测试（3 个用例）
```

---

### 场景 3：关联开发任务和测试任务

```
1. 开发任务完成
   Task ID: T20260707001
   生成了技术方案：tech_design.md

2. 创建测试任务
   POST /test/task/perform/init
   {
       "testTaskId": "T20260707002",
       "relatedDevTaskId": "T20260707001",  ← 关联开发任务
       "depId": 12345
   }

3. Code-Agent 获取技术方案
   ① 从 AI24 获取开发任务的技术方案
   ② 保存为 tech_design.md
   ③ 结合 PRD 生成测试用例

4. 测试用例导出到 DEP
   关联到需求 12345
```

---

## DEP MCP 工具列表

| 工具 | 功能 | 代码位置 |
|-----|------|---------|
| `getIssueDetail` | 获取需求详情（PRD、Git 信息） | fetch_task_metadata_refactored.py |
| `getRequirementTasks` | 获取子任务列表 | - |
| `updateIssueDetail` | 更新任务状态 | - |
| `importTestCase` | 导入测试用例 | main.py:export_test_cases_to_dep |
| `getCaseDirectory` | 获取用例库目录 | main.py:query_dep_testcase_count |

---

## DEP 系统在架构中的位置

```
                    ┌─────────────┐
                    │   DEP 系统   │
                    │ (需求管理)   │
                    └──────┬──────┘
                           │
                    ① 创建需求和任务
                           │
                           ↓
                    ┌─────────────┐
                    │  AI24 平台   │
                    │ (任务调度)   │
                    └──────┬──────┘
                           │
                    ② 调用 Code-Agent
                           │
                           ↓
                    ┌─────────────┐
                    │ Code-Agent  │
                    │ (代码生成)   │
                    └──────┬──────┘
                           │
                    ③ 通过 DEP MCP 获取元数据
                           │
                           ↓
                    ┌─────────────┐
                    │   DEP 系统   │
                    │ (提供数据)   │
                    └─────────────┘
```

---

## 关键配置

### DEP MCP 配置（在 settings.json）

```json
{
    "permissions": {
        "allow": [
            "mcp__dep__getIssueDetail",
            "mcp__dep__getRequirementTasks",
            "mcp__dep__updateIssueDetail"
        ]
    }
}
```

### DEP URL 配置（在环境变量）

```bash
# DEP 系统地址
DEP_BASE_URL="http://dep.vdian.net"

# 任务链接模板
TASK_URL="http://b.daily.vdian.net/weidian-pc/ai-program-factory/#/conversations/"
```

---

## 总结

### DEP 是什么？
**公司内部的需求管理和项目管理系统**

### DEP 在 Code-Agent 中的作用
1. **任务源头**：所有开发任务来自 DEP
2. **元数据提供者**：提供 PRD、Git 信息、分支等
3. **测试用例存储**：测试用例最终导出到 DEP
4. **进度跟踪**：任务状态同步到 DEP

### 关键流程
```
DEP 创建需求
  ↓
AI24 拉取任务
  ↓
Code-Agent 通过 DEP MCP 获取元数据
  ↓
初始化项目、生成代码
  ↓
测试用例导出回 DEP
  ↓
任务状态更新到 DEP
```

---

**类比理解**：
- **DEP** = Jira（国外）/ 禅道（国内）
- **作用** = 项目管理 + 需求跟踪 + 测试管理
- **与 Code-Agent 关系** = DEP 是任务的"上游"，提供需求信息；Code-Agent 是"下游"，执行开发任务

现在明白 DEP 是什么了吗？😊
