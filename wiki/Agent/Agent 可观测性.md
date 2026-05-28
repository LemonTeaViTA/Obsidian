---
module: Agent
tags: [Agent, 可观测性, OpenTelemetry, Trace, 审计, 成本控制, Benchmark]
difficulty: hard
last_reviewed: 2026-05-28
---

# Agent 可观测性

> ==Agent 的可观测性比普通服务难得多==——推理链不透明、工具调用链路长、非确定性（同样的输入可能走不同路径）。
>
> 与 [[Agent 可靠性设计]] 的关系：可观测是可靠性的前提——看不见就改不动。

---

## 一、Agent 可观测性为什么难

普通后端服务的可观测性已经成熟（OpenTelemetry / Prometheus / Grafana），但 Agent 多三个挑战：

1. ==推理链不透明== — LLM 的 Thought 是内部状态，不是结构化日志能完整捕获的
2. ==工具调用链路长== — 一次任务可能调用十几个工具，每个工具又可能调下游服务
3. ==非确定性== — 同样的输入可能走不同的路径，==traceId 复盘能力下降==

==这三个挑战决定了 Agent 可观测必须是"==分层 + 结构化 + 可回放=="==。

---

## 二、三层追踪体系

| 层次 | 追踪内容 | 关键指标 |
|------|---------|---------|
| ==Thought 层== | 每轮推理的输入/输出、token 消耗 | 推理耗时、token 数、是否触发工具 |
| ==Tool Call 层== | 工具名称、参数、返回值、耗时 | 调用成功率、重试次数、工具耗时分布 |
| ==任务层== | 整个任务的完整轨迹、最终结果 | 任务完成率、总步骤数、总耗时、总成本 |

==三层独立采集，统一 trace_id 串联==——这样既能看宏观（任务成功率）又能下钻到微观（具体哪步出错）。

### 结构化日志是基础

每一步都输出结构化日志，包含：

| 字段 | 说明 |
|------|------|
| ==`trace_id`== | 贯穿整个任务的唯一 ID，用于串联所有日志 |
| ==`step`== | 当前是第几步 |
| ==`type`== | thought / action / observation / final_answer |
| ==`content`== | 具体内容 |
| ==`duration_ms`== | 耗时 |
| ==`tokens`== | token 消耗（仅 LLM 调用步骤） |

==典型 JSONL 行==：

```json
{"trace_id": "t-abc123", "step": 3, "type": "action",
 "content": {"tool": "read_file", "args": {"path": "src/auth.ts"}},
 "duration_ms": 12, "ts": 1716879600}
```

### 分布式工作流的服务治理

系统由 Java、Python 等多种语言的微服务构成，服务间调用关系复杂。

==方案==：全面拥抱 ==OpenTelemetry== 标准，所有微服务集成 Tracing SDK，为每个请求生成唯一 Trace ID 并在整个调用链中传递。一次 workflow 执行经过的每一个服务、每一次数据库调用、每一次 API 请求，都串联成完整的调用火焰图。

---

## 三、Debug 推理链的实践方法

==Agent 出问题时怎么定位==——四个工具：

1. ==回放机制==：把完整的 Thought/Action/Observation 序列存下来，出问题时可以逐步回放，找到哪一步开始走偏
2. ==中间状态可视化==：用 LangSmith 或自建 Trace UI，把推理链渲染成树状图，一眼看出分支点
3. ==关键节点断点==：在 Harness 里加 hook，在特定条件（比如第 N 步、调用特定工具时）暂停并打印完整上下文
4. ==对比实验==：同一个任务跑多次，对比不同路径，找出不稳定的决策点

### 主流可观测平台

| 平台 | 特色 | 适用 |
|------|------|------|
| ==LangSmith== | LangChain 官方，深度集成 | LangChain / LangGraph 项目 |
| ==Helicone== | 代理 OpenAI / Anthropic API，零侵入接入 | 多模型生产环境 |
| ==Phoenix==（Arize） | 开源，支持 LangChain/LlamaIndex | 自托管偏好 |
| ==自建 Trace UI== | 完全可控 | 大规模生产 |

---

## 四、审计日志 schema 演进与向后兼容

==审计日志写出去就是固化资产==——存到 ELK / S3 / 合规系统后，==schema 必须可演进==，不能因为加字段就让旧日志读不出来。

### 典型 JSONL 行（原始）

```json
{"ts": 1716879600, "tool": "mcp__chrome-devtools__click", "args": {...}, "result_size": 1024}
```

### 演进后（加 metadata）

```json
{"ts": 1716879600, "tool": "mcp__chrome-devtools__click", "args": {...}, "result_size": 1024,
 "browser_mode": "shared", "sensitive": true, "target_url": "github.com/owner/repo/pull/1"}
```

### 兼容原则

| 原则 | 实现 |
|------|------|
| ==只加字段，不删字段== | 旧字段保持原义，即使新字段更精确 |
| ==不改字段类型== | `result_size` 不能从 int 改 str |
| ==新字段可选== | 旧日志没有该字段不报错（用 `.get()` / `Optional[T]`） |
| ==schema 版本号显式== | 关键 breaking 变化加 `"schema_version": "v2"`，读取端按版本分支处理 |
| ==枚举值只增不减== | 老日志的 enum 值仍合法 |

### 读取端代码

```python
def parse_audit(line: str) -> AuditRecord:
    raw = json.loads(line)
    return AuditRecord(
        ts=raw["ts"],
        tool=raw["tool"],
        args=raw["args"],
        result_size=raw["result_size"],
        # 新字段:有就用,没有就 None
        browser_mode=raw.get("browser_mode"),
        sensitive=raw.get("sensitive", False),
        target_url=raw.get("target_url"),
    )
```

==踩过的坑==：某团队把审计日志的 `args` 字段从 dict 改成了 base64 编码 string（为了脱敏）——==旧日志全部读不出来==，半年的合规数据丢失。==审计日志的 schema 演进比 API 演进更严格==——API 至少能版本化，日志写出去就改不了。

### 凭证脱敏

==审计日志最容易踩的隐患==：工具调用参数里==经常带凭证==——`Authorization: Bearer xxx` / `api_key: sk-...` / `password: xxx` / `token: ghp_...`。==审计日志原样落盘 = 凭证泄露==。详细脱敏实现见 [[MCP 协议#63-审计日志的凭证脱敏]]。

---

## 五、Agent 成本控制

### 成本来源分析

Agent 的成本主要来自三块：
- ==LLM 调用==：每轮 Thought 都要调用 LLM，步骤越多成本越高
- ==工具调用==：部分工具有调用费用（搜索 API、付费数据库）
- ==重试开销==：工具失败重试、LLM 输出格式错误重新生成，都是额外成本

### 五种成本控制策略

1. ==预算上限==：给每个任务设置 token 预算（如 50k tokens），超出后强制终止并汇报进度
2. ==模型降级==：简单步骤（格式转换、信息提取）用便宜的小模型，只有复杂推理才用大模型——详见 [[模型路由策略]]
3. ==语义缓存==：相似的工具调用结果缓存复用，避免重复调用付费 API
4. ==批处理==：多个相似的 LLM 调用合并成一次批量请求，降低 API 调用次数
5. ==提前终止==：检测到任务已经无法完成（关键工具不可用、权限不足）时，立即终止而不是继续消耗

### 必显的 5 个 Token 指标

==生产 Coding Agent 必须实时显示==：

| 指标 | 含义 | 为什么重要 |
|------|------|---------|
| ==Total input tokens== | 本轮 input 总数 | 看 prompt 是否快爆 budget |
| ==Cached input tokens== | 命中缓存的 input | ==判断 cache 有没有正常工作== |
| ==Cache hit rate== | cached / total input | ==<50% 就要查为什么没命中== |
| ==Output tokens== | 本轮 output | 看 LLM 输出长度 |
| ==估算成本== | 实时累加（input + cached + output） | ==让用户对成本有感知== |

详见 [[长上下文工程#6 Token 与成本可观测性]]。

---

## 六、生产环境延迟优化策略

1. ==并行检索==：多知识源同时查询
2. ==语义缓存==：语义相似的查询共享结果，命中率 >30%
3. ==两阶段检索==：低成本模型粗召回 Top-100，高精度 Reranker 精排 Top-10
4. ==超时降级==：超时后返回无检索的 LLM 直接回答
5. ==动态 Top-K==：简单查询检索少，复杂查询检索多
6. ==模型降级==：高峰时使用更便宜的模型

---

## 七、Agent 评估方法

> 评估的三个维度（任务完成率 / 效率 / 质量）+ 主流 Benchmark（SWE-bench / WebArena / AgentBench / ToolBench / GAIA / τ-bench）+ 生产评估方法（A/B 测试 / 人工抽检 / 自动化回归 / 用户反馈）详见 [[Agent 可靠性设计#六、Agent 评估方法]]。

---

## 相关链接

- [[Agent 可靠性设计]] — 可观测是可靠性的前提
- [[Agent 安全模型]] — 审计日志属于安全防护体系的一环
- [[长上下文工程#6 Token 与成本可观测性]] — 状态栏 token / cost 显示设计
- [[模型路由策略]] — 成本优化的路由维度
- [[MCP 协议#63-审计日志的凭证脱敏]] — 凭证脱敏实现细节
