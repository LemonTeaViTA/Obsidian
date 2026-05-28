---
module: Agent
tags: [Agent, 部署, Durable Task Queue, Runtime API, Worker Pool, OpenAI Assistants API]
difficulty: hard
last_reviewed: 2026-05-28
---

# Agent 部署与服务化

> ==Agent 从"工具"到"服务"的关键一步==——SQLite 持久化 + Worker Pool + HTTP Runtime API，让 Agent 能被 CI/CD、IDE 插件、脚本调用。
>
> 与 [[Coding Agent TUI 设计]] 互补：TUI 是给用户用的交互形态，本文是给程序用的服务化形态。

---

## 一、为什么需要 Agent 服务化

==短任务==（< 30s）直接在 REPL 里跑，但==长任务==需要后台异步执行 + 持久化：

| 场景 | 例子 | 需求 |
|------|------|------|
| ==大规模分析== | 分析整个代码库 / 批量重构 | 跑几小时，进程重启不能丢 |
| ==CI/CD 集成== | PR 自动 review / 测试自动修复 | 通过 HTTP API 触发 |
| ==IDE 插件== | VS Code / JetBrains 调本地 Agent | 不嵌入 Agent 逻辑，统一调用 |
| ==脚本自动化== | Python 批量提交任务 | 流式接收结果 |

==Agent 服务化的两大支柱==：

1. ==Durable Task Queue== — 任务持久化，进程重启不丢
2. ==Runtime API== — HTTP 接口暴露 Agent 能力

---

## 二、Durable Task Queue：Agent 任务持久化

### 任务生命周期

```
enqueued → running → completed
                   → failed
                   → canceled
```

### SQLite 持久化（轻量，无需额外服务）

```sql
CREATE TABLE tasks (
    id          TEXT PRIMARY KEY,
    content     TEXT NOT NULL,          -- 任务描述
    status      TEXT NOT NULL,          -- enqueued/running/completed/failed/canceled
    created_at  INTEGER NOT NULL,
    started_at  INTEGER,
    finished_at INTEGER,
    result      TEXT,                   -- 完成时的输出摘要
    error       TEXT,                   -- 失败时的错误信息
    log_path    TEXT                    -- 完整日志文件路径
);
```

==为什么用 SQLite==：
- ==零运维==——单文件数据库，跟 Agent 进程一起部署
- ==足够快==——每秒数千次写入，Agent 任务量级完全够
- ==简单==——不引入 Redis / PostgreSQL 这些重型依赖

==生产规模需要时==可换成 PostgreSQL / Redis Streams——schema 不变，只换驱动层。

### Worker Pool

==默认 2 个后台 worker 并发执行任务==——每个 worker 是==独立的 Agent 实例==，共享 ToolRegistry / MCP server / SkillRegistry，但各自有==独立的 Memory 和 HITL handler==。

==共享 vs 独立==：

| 共享（节省资源） | 独立（避免相互干扰） |
|-----------------|-----------------|
| ToolRegistry | Memory（每个任务独立会话） |
| MCP server 连接 | HITL handler（每个任务独立审批） |
| SkillRegistry | trace_id |
| Logger | 任务上下文 |

### CLI 闭环

| 命令 | 作用 |
|------|------|
| `/task` | 列出所有任务及状态 |
| `/task add <内容>` | 提交后台任务 |
| `/task cancel <id>` | 取消运行中任务（协作式取消） |
| `/task log <id>` | 查看任务完整日志 |

### 与前台 REPL 的关系

后台任务和前台对话==共享同一套 Agent 核心==（ToolRegistry / MCP / Skills），但==不共享上下文==——后台任务有自己的 session，==不会看到前台对话历史==。

---

## 三、Runtime API：HTTP 暴露 Agent 能力

### 启动方式

```bash
java -jar paicli.jar serve --http --port 8080
```

### API 设计（与 OpenAI Assistants API 同构）

```
POST /v1/threads                    # 创建会话
POST /v1/threads/{id}/turns         # 提交一轮任务
GET  /v1/threads/{id}/events        # SSE 流式接收输出
```

### 与 OpenAI Assistants API 的对比

| 维度 | OpenAI Assistants | 本地 Runtime API |
|------|------------------|-----------------|
| 会话 | Thread | Thread |
| 一轮交互 | Run | Turn |
| 流式输出 | SSE events | SSE events |
| 工具 | Function / Code Interpreter | 内置工具 + MCP |
| 部署 | 云端 | ==本地 localhost== |

==关键认知==：==Runtime API 是 OpenAI Assistants API 的本地化==——同样的协议设计，区别在部署位置。==协议统一意味着客户端可复用==——OpenAI 的客户端 SDK 改个 base_url 就能调本地 Agent。

### 安全：强制 API Key

==Runtime API 强制要求 API Key==（`PAICLI_RUNTIME_API_KEY` 环境变量或 `-D` 参数）——没有 Key 的请求直接 401。

==不要把 Runtime API 暴露到公网==——它有完整的文件系统和命令执行能力。生产部署：

| 场景 | 推荐 |
|------|------|
| ==个人开发机== | 仅 localhost 监听（`--bind 127.0.0.1`） |
| ==团队共享== | 内网 + API Key + 审计日志 |
| ==公网服务化== | ==必须 microVM 沙箱==，详见 [[Agent 安全模型#真正的-agent-沙箱是-microvm-级]] |

### 典型使用场景

| 场景 | 示例 |
|------|------|
| ==CI/CD 集成== | `curl POST /v1/threads/{id}/turns -d '{"content": "跑测试并修复失败的用例"}'` |
| ==IDE 插件== | VS Code 插件通过 Runtime API 调本地 Agent，不用嵌入 Agent 逻辑 |
| ==脚本自动化== | Python 脚本批量提交任务，通过 SSE 接收结果 |
| ==Webhook 触发== | GitHub PR 创建 → webhook → Runtime API → Agent 自动 review |

---

## 四、与 Side-History Git Snapshot 的协同

==Durable Task Queue 持久化的是任务元数据==（status / 日志路径），但==文件系统的修改==需要 Side-History 来兜底：

```
任务执行流程:
  Worker 拉取任务
    ↓
  pre-turn snapshot (Side-History)
    ↓
  Agent 执行(读写文件)
    ↓
  post-turn snapshot (Side-History)
    ↓
  状态更新到 SQLite (Durable Task Queue)
```

==两者互补==：
- ==Durable Task Queue== 管"任务跑到哪一步"
- ==Side-History== 管"任务对文件做了什么"

详见 [[Agent 可靠性设计#5-side-history-git-snapshot文件系统层coding-agent-特有]]。

---

## 五、监控与运维

### 关键指标

| 指标 | 说明 |
|------|------|
| ==任务成功率== | completed / total |
| ==平均执行时长== | 区分快/慢任务 |
| ==Worker 利用率== | 看是不是要扩 Worker Pool |
| ==失败原因分布== | 哪类任务最容易失败 |
| ==成本累积== | 总 token / 总美元 |

详见 [[Agent 可观测性]]。

### 运维注意事项

| 事项 | 说明 |
|------|------|
| ==SQLite 锁竞争== | Worker 多时考虑 WAL 模式 / 换 PostgreSQL |
| ==日志滚动== | 任务日志按天分文件，超过 30 天归档或清理 |
| ==MCP server 共享== | Worker Pool 共享 MCP 连接，server 重启要通知所有 Worker |
| ==优雅关闭== | SIGTERM 后让运行中任务完成当前 step 再退出，状态写回 SQLite |

---

## 六、关键认知与面试要点

### 认知 1：Agent 服务化是从"工具"到"基础设施"的跨越

==CLI 工具== 用户主动调用，单次任务 → ==服务化 Agent== 程序调用，长期运行 → 这是 Agent 进入企业生产环境的关键。

### 认知 2：Durable Task Queue + Runtime API 是标配

==SQLite 持久化保证任务不丢，Worker Pool 支持并发，Runtime API 让 Agent 能被 CI/CD / IDE 插件 / 脚本调用==。这和 OpenAI Assistants API 的设计同构，区别是本地部署。

### 认知 3：服务化的安全模型与本地不同

本地 CLI 用户已经信任了 Agent，==服务化暴露给程序调用就需要 API Key + 审计 + 沙箱==——见 [[Agent 安全模型]]。

### 认知 4：Side-History 是服务化的 fail-safe

==长任务跑到一半失败，Side-History 让用户能恢复文件状态==——没有它，服务化 Agent 的失败代价太高。

### 面试时的高质量回答

==问==："你们 Agent 怎么部署？"

==❌ 平庸答案==："打成 jar 包跑在服务器上。"

==✅ 高质量答案==："==Agent 服务化双支柱==——

1. ==Durable Task Queue==：SQLite 持久化任务状态（enqueued→running→completed/failed/canceled），Worker Pool 并发执行（共享 Tool/MCP/Skills，独立 Memory/HITL）
2. ==Runtime API==：与 OpenAI Assistants API 同构（POST /v1/threads / Turns / SSE events），让 CI/CD / IDE 插件 / 脚本能调本地 Agent
3. ==安全==：强制 API Key + 仅 localhost 监听 + 公网部署用 microVM
4. ==与 Side-History 协同==：任务元数据走 SQLite，文件系统修改走 Side-History Git Snapshot——出错时既能恢复任务状态又能恢复文件

==关键认知==：服务化是 Agent 从'工具'到'基础设施'的跨越，协议设计与 OpenAI Assistants API 同构带来生态复用价值。"

---

## 相关链接

- [[Agent 可靠性设计]] — Side-History Git Snapshot 详细实现
- [[Agent 安全模型]] — 公网部署的沙箱要求
- [[Agent 可观测性]] — 任务监控指标
- [[Coding Agent TUI 设计]] — TUI 形态（与服务化形态互补）
- [[Function Calling]] — Runtime API 内部走 FC 协议
- [[长上下文工程]] — Worker 间共享 prompt cache 优化
