# OpenClaw 框架

> OpenClaw（龙虾）是一个 Agent 框架，支持多 Agent 路由、Gateway 网关、Memory 管理等核心能力。

## 一、多 Agent 路由机制

### dmPolicy（私信策略）

控制机器人如何处理私信，三种策略：

- `allow`：允许所有私信，适合内部工具
- `deny`：拒绝所有私信，适合纯群组场景
- `pairing`：只允许配对过的用户私信，适合面向外部用户的客服机器人

### bindings（精准路由规则）

bindings 是多 Agent 路由的核心机制，定义消息如何分配给不同的 Agent。

```json
{
  "bindings": [
    {
      "agentId": "CodeReview",
      "match": {
        "channel": "feishu",
        "accountId": "cli_xxx1",
        "peer": { "type": "group", "id": "oc_xxx" }
      }
    }
  ]
}
```

字段说明：`channel` 是消息来源（feishu/wecom），`accountId` 是应用 App ID，`peer` 是发送者信息（user 或 group）。

**优先级规则**：最具体优先原则。同时匹配多个 binding 时，match 条件越具体（字段越多）优先级越高。

### groupPolicy（群组策略）

- `requireMention`：群组中是否需要 @ 机器人（默认 true）
- `allowAnonymous`：是否允许匿名消息

---

## 二、Gateway 网关架构

Gateway 是 OpenClaw 的"神经中枢"，负责消息接收、路由分发、回复推送。

整个链路：`飞书消息 → Gateway → Agent → 大模型 → Agent → Gateway → 飞书回复`

### 通信机制

Gateway 和飞书之间通过 **WebSocket 长连接**通信。Gateway 启动时向飞书注册 WebSocket 连接，飞书有消息主动推过来。认证使用 `verificationToken` 和 `encryptKey`。

### Gateway 生命周期

优雅关闭流程：
1. 停止接收新连接
2. 等待现有连接处理完成（默认 30 秒超时）
3. 保存会话状态
4. 清理资源后退出

超时后强制退出，未完成的任务会丢失。复杂任务应设计成可重入的，支持断点续传。

---

## 三、核心组件

| 组件 | 职责 |
|------|------|
| LLM | 理解指令、规划任务、生成回复 |
| 任务规划器 | 把自然语言需求拆解成可执行步骤 |
| 工具执行器 | 调用外部工具（搜索、文件、数据库等） |
| 记忆管理器 | 管理短期记忆（Session）和长期记忆（Memory） |
| 技能加载器 | 动态加载 Skills，扩展 Agent 能力 |

### 组件通信：消息总线

组件之间通过消息总线（事件队列）通信，不直接调用。优点：解耦、异步、可观测。

### Agent 是 per-session 瞬态实例

Agent 不是常驻进程，每个对话都是完整的加载-执行-销毁循环：

1. **加载**：读取 AGENTS.md、SOUL.md 等配置，初始化 Memory
2. **执行**：接收输入，调用 LLM，执行工具，返回结果
3. **销毁**：保存 Session 到磁盘，释放资源

好处：资源节省 + 配置实时生效（每次 run 重新读取配置，改配置不用重启）。

### Session 优化：Compaction vs Pruning

| | Compaction | Pruning |
|---|---|---|
| 触发时机 | Session 接近 context 上限 | 每次发送给 LLM 前 |
| 操作 | 提取重要信息写入 Memory，压缩 Session | 临时裁剪旧的 tool 结果 |
| 持久化 | 是，写入磁盘 | 否，只影响本次请求 |
| 类比 | 把重要笔记抄到笔记本，永久保存 | 临时把草稿纸上无关内容划掉 |

### sessions_send vs sessions_spawn

- **sessions_send**：发消息给另一个 Agent，等待回复。同步阻塞，类似函数调用
- **sessions_spawn**：派生新的 Agent 实例，独立运行。异步非阻塞，类似多线程

---

## 四、8 个配置文件

每个 Agent 的 workspace 包含 8 个核心配置文件：

| 文件 | 职责 |
|------|------|
| AGENTS.md | 定义 Agent 能力边界、启动流程、Memory 管理流程、工具调用规范、安全约束 |
| SOUL.md | 注入 Agent 性格（语气风格、价值观、行为准则） |
| TOOLS.json | 定义可用工具（底层能力：文件读取、网络请求等） |
| SKILLS.json | 配置加载的 Skills（高层封装，一个 Skill 可调用多个 Tool） |
| MEMORY.json | 配置长期记忆的存储和检索策略 |
| SESSION.json | 配置 Session 管理策略（压缩阈值、保留时间等） |
| ROUTER.json | 配置消息路由规则 |
| CONFIG.json | 杂项配置（LLM 模型选择、API Key 等） |

**TOOLS.json vs SKILLS.json**：Tools 是"手脚"（底层能力），Skills 是"技能"（高层封装）。

**Skills 管理三原则**：
1. 精简：一个 Agent 加载 5-10 个 Skills 就够了
2. 评估：用 Evals 机制测试 Skills 质量
3. 版本化：避免不同版本 Skills 冲突

---

## 五、Memory 和 Session 的区别

### 短期记忆（Session）

存储在 `~/.openclaw/agents/{agentId}/sessions/*.jsonl`，自动记录每次对话内容，是最原始的未经处理的记忆。

### 长期记忆（Memory）

存储在 `~/.openclaw/workspace/MEMORY.md` 和 `memory/*.md`，从短期记忆中提炼出需要重点记住的内容（用户偏好、身份信息、回答偏好等）。

### 两种转换机制

**机制一：session-memory Hook**：用户执行 `/new` 重置会话时触发，自动将上一个会话的关键内容转换为 Markdown 文件。

**机制二：Memory Flush（Compaction）**：Session 接近 context 上限时触发，提取重要信息写入 Memory。

### Memory 索引建立四步

1. **发现**：监控 MEMORY.md 和 memory/*.md 的变化，标记 dirty
2. **切块**：把 Markdown 切成多个 chunk，每块表达一段完整意思
3. **索引**：每个 chunk 同时走向量索引（语义召回）和 FTS 全文索引（关键词命中）
4. **落库**：chunk、元信息、全文索引、向量索引都放到本地 SQLite

**关键架构观点**：Markdown 文件是记忆本体（source of truth），SQLite 只是加速层。

### 混合检索：FTS5 + BM25 + sqlite-vec

- **FTS5 + BM25**：精确词项命中，适合搜索 `nomic-embed-text` 这类精确关键词
- **sqlite-vec**：语义相似召回，适合"上次说过的那个写作偏好"这类模糊语义查询
- 两边结果融合返回，互补短板
