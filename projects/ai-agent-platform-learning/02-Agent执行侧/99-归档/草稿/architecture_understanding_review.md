# Code-Agent 架构理解评估

## 你的回答分析

### ✅ 你答对的部分（理解正确）

#### 1. 启动流程（90分）
```
命令行参数解析 
  ↓
注册信号处理器（SIGTERM/SIGINT）
  ↓
初始化 coscmd（云端存储）
  ↓
初始化 langfuse（模型追踪）
  ↓
初始化 Claude 实例
  ↓
启动 Flask API
  ↓
Redis 心跳/订阅
```

**点评**：流程基本正确！但有一些小的遗漏。

---

### 📌 需要补充的细节

#### 遗漏 1：.claude 目录和配置文件的复制

**位置**：main.py:3824-3860

```python
# 在初始化 Claude SDK 之前
move_claude_project_on_startup()    # 恢复 .claude 目录
copy_skills_to_user_claude_dir()    # 复制 skills
copy_agents_to_user_claude_dir()    # 复制 agents
copy_settings_to_user_claude_dir()  # 复制 settings.json
```

**为什么重要**：
- Skills、Agents、Settings 是 Claude SDK 的核心配置
- 从项目目录复制到 `~/.claude/` 供 SDK 使用

---

#### 遗漏 2：任务执行的完整链路

你说的是**启动流程**，但实际任务执行还有：

```
AI24 调用 /task/perform/init（初始化）
  ↓
1. fetch_task_metadata_from_dep_id()  # 从 DEP 获取元数据
2. clone 代码仓库
3. 复制 OpenSpec 模板
4. 保存到 MetaContainer
  ↓
AI24 调用 /task/query（执行查询）
  ↓
1. 从 MetaContainer 获取任务信息
2. intercept_and_replace_prompt()  # 预处理提示词
3. 准备动态 Hooks
4. 调用 service.query()
  ↓
Claude SDK 执行
  ↓
返回结果 + 上报到 AI24
```

---

### 🎯 关键概念理解测试

#### 问题 1：MetaContainer 的作用
**你的理解**："任务元数据管理和判断归属"

**评分**：✅ 正确（85分）

**补充**：
- MetaContainer 是**单例**，管理所有任务的元数据
- 元数据包括：git_url, branch, project_path, model, flow_type, template_id, enable_tdd 等
- **判断归属**：多机器部署时，通过 MetaContainer 判断任务由哪台机器处理
- **数据持久化**：保存到云端（通过 task_data_api），重启不丢失

---

#### 问题 2：对话持久化
**你的理解**："对话持久化"

**评分**：✅ 正确（90分）

**补充**：
- 通过 `TaskSessionMapper` 维护 `task_id ↔ session_id` 映射
- 支持多轮对话：同一个 task_id 的多次 query 共享 session
- 持久化到文件：`tmp/data/task_session_mapping.json`

---

#### 问题 3：Claude 实例配置
**你的理解**："配置参数、动态 hooks、提示词"

**评分**：✅ 正确（80分）

**补充细节**：

```python
# Claude SDK 配置包括
ClaudeAgentOptions(
    # 1. 基础配置
    model="claude-opus-4-8",
    cli_path="/home/www/.local/bin/claude",
    
    # 2. 系统提示词
    system_prompt="...",  # 可以动态构建
    
    # 3. 工作目录
    cwd=project_path,
    
    # 4. MCP 服务器（关键！你没提到）
    mcp_servers={
        "ai24": {...},              # AI24 平台
        "mastergo": {...},          # MasterGo 设计
        "figma": {...},             # Figma 设计
        "code-agent-report-tools": {...},  # 任务上报
        "mcp-service-link-confluence": {...},  # Confluence 文档
    },
    
    # 5. Hooks（你提到了）
    hooks={
        "pre_tool_use": [PathSecurityHook, GitCommitHook, TddTestLockHook],
        "post_tool_use": [DocumentUploadHook],
        "stop": [TddStopGateHook]
    },
    
    # 6. 权限模式
    permission_mode="acceptEdits",  # 或 "default" / "plan"
    
    # 7. Settings 文件
    settings="~/.claude/settings.json",
)
```

---

### 🔍 深入理解测试

#### 测试 1：提示词预处理
**你提到**："给提示词"

**追问**：提示词是直接传给 Claude 的吗？还是经过了预处理？

**答案**：
```python
# main.py:intercept_and_replace_prompt()

原始输入："/openspec:proposal"
  ↓
预处理：
  1. 检测到 OpenSpec 命令
  2. 通过 AI24 MCP 获取模板内容
  3. 注入完整的 Proposal 提示词
  ↓
最终提示词：
"""
你是一位资深的技术架构师...
请按照以下步骤生成技术方案：
1. 需求分析
2. 技术选型
3. 模块设计
...
"""
  ↓
传给 Claude SDK
```

**关键点**：
- `/openspec:proposal` 只是一个**命令标识**
- 真正的提示词来自 **AI24 MCP 的模板系统**
- 还会注入 **文件引用**（如 `@prd.md` → 实际 PRD 内容）

---

#### 测试 2：任务归属判断
**你提到**："判断归属"

**追问**：如何判断一个任务应该由哪台机器处理？

**答案**：
```python
# main.py:dispatch_task_query_message()

1. 收到 Redis 消息：task_id="T123"
2. 检查 MetaContainer.contains(task_id)
3. 如果 True  → 本机处理（初始化阶段记录的）
4. 如果 False → 忽略（其他机器的任务）

关键：
- 谁调用了 /task/perform/init，谁就"拥有"这个任务
- MetaContainer 保存在云端，所有机器共享
- 通过 task_id 精确路由
```

---

#### 测试 3：Redis 心跳/订阅
**你提到**："后台 redis 心跳设计"

**追问**：Redis 的作用是什么？

**答案**：
```python
# 两个用途

用途 1：任务分发（Pub/Sub）
- 所有机器订阅 "code_agent_global_tasks" 频道
- AI24 发布任务消息到频道
- 拥有该任务的机器处理，其他机器忽略

用途 2：任务中断（可选）
- 通过 Redis 发送中断信号
- ClaudeAgentSDKService.interrupt_task() 处理
```

**关键点**：
- Redis 不是必须的（单机部署可以不用）
- 但多机器部署时，Redis 是任务路由的核心

---

### 📊 综合评分

| 维度 | 得分 | 评价 |
|-----|------|------|
| **启动流程理解** | 90/100 | 流程清晰，但遗漏了 .claude 配置复制 |
| **任务执行流程** | 75/100 | 理解初始化，但查询执行细节不够 |
| **核心组件理解** | 85/100 | MetaContainer、Session 理解正确 |
| **配置细节** | 70/100 | 提到 Hooks，但 MCP 服务器没提 |
| **深度理解** | 80/100 | 理解架构目的，但实现细节需加强 |

**总体评价**：**熟练级（80分）**

你已经掌握了：
- ✅ 整体架构流程
- ✅ 核心组件作用
- ✅ Hooks 系统设计
- ✅ 多机器部署原理

还需要深入的：
- 📌 提示词预处理机制
- 📌 MCP 服务器配置
- 📌 查询执行的完整链路
- 📌 错误处理和重试机制

---

## 改进建议

### 建议 1：画一张完整的流程图
```
启动阶段 → 初始化阶段 → 查询阶段 → 响应阶段
```
标注每个阶段的关键组件和数据流

### 建议 2：实际操作验证
- 启动一个任务，查看日志
- 观察 MetaContainer 的数据
- 检查 Hooks 的注册时机

### 建议 3：阅读关键代码
- `intercept_and_replace_prompt()` - 提示词预处理
- `create_claude_service()` - MCP 配置
- `_register_tdd_hooks()` - 动态 Hook 注册

---

## 下一步学习重点

1. **MCP 系统**：各个 MCP 服务器的作用
2. **提示词系统**：模板如何管理和注入
3. **错误处理**：API 失败、网络超时如何处理
4. **性能优化**：Token 压缩、缓存机制

你对哪个部分最感兴趣？我可以深入讲解！
