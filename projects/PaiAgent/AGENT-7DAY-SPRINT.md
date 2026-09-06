---
module: PaiAgent
type: project
status: source-study
tags: [Agent, PaiAgent, PaiCLI, AI软件工厂, 简历, 面试, 一周突击]
last_reviewed: 2026-09-05
---

# Agent 岗 7 天突击计划

> [!tip] 总目标
> 7 天后不是“学完所有 Agent 知识”，而是冻结一份真实简历，并把简历每一条 Agent 相关声明练到能回答：项目价值、完整链路、关键取舍、一个 Failure Case 和事实边界。

## 一、战术取舍

### 最终叙事

```text
AI 软件工厂：真实实习与个人贡献，承担简历主证据
    ↓ 平台如何调度和消费 Agent 能力
PaiAgent：可视化 Workflow + 节点内 ReAct，承担工作流 / Agent 架构学习
    ↓ 从画布式编排转向开发者终端执行
PaiCLI：Coding Agent Host，承担 Tool Calling / Context / Safety 深挖
```

这是一条知识叙事，不是三个项目的个人贡献合并。AI 软件工厂按本人模块讲；PaiAgent / PaiCLI 必须标注开源源码研习。

### 本周不做

- 不运行、构建、部署 PaiAgent，也不安装依赖。
- 不平行学习 PaiFlow；它与 PaiAgent 的工作流知识重叠，当前收益低。
- 不把 Baize 作为 Agent 定向简历主项目；原材料保留，需要投 RAG 岗时再恢复。
- 不追求掌握 PaiAgent 所有媒体节点、后台页面和配置细节。
- 不新增无证据的指标、用户量、上线状态或个人所有权。

## 二、每天固定节奏

建议每天 4 到 6 小时，按同一节奏减少切换成本：

| 模块 | 时间 | 输出 |
| --- | ---: | --- |
| 复习前一天 | 30 分钟 | 不看笔记复述 90 秒 + 3 个问题 |
| 学当天主题 | 90 分钟 | 画一条链路，标输入/输出/状态/失败 |
| 口述训练 | 60 分钟 | P0 问题逐题录音或文字作答 |
| 简历证据 | 60 分钟 | 每条 Bullet 对应源码/提交/事实边界 |
| Failure Case | 30 分钟 | 现象、原因、定位、当前处理、改进 |
| 晚间回顾 | 30 分钟 | 只记今天答错的 5 个点 |

## 三、Day 1：冻结方向与项目全景

### 必学

- 最终项目组合与归属边界。
- AI 软件工厂三仓全景与本人三条贡献。
- PaiAgent 的 Workflow / Agent 职责区别。
- PaiAgent 保存链和执行链。

### 当天产出

- 背熟 PaiAgent 90 秒安全介绍。
- 画出 `ReactFlow -> flowData -> EngineSelector -> NodeExecutor`。
- 读完 Agent 定向候选简历，逐条标记“我能否证明”。
- 删除口述里的“主导、企业级、高并发、完整实现”等无证据词。

### 必答题

1. 为什么工作流不自动等于 Agent？
2. PaiAgent 保存到执行经过哪些层？
3. 你的三个项目分别是实习贡献还是源码学习？

### 验收

不看笔记讲完 90 秒，且主动说出归属边界。

## 四、Day 2：DAG、输入传播和条件分支

### 必学

- DFS 环检测与 Kahn 拓扑排序各自负责什么。
- 当前 DAG 为什么是串行，不是自动并行。
- 多前驱输出合并、同名字段覆盖。
- Condition 的 `sourceHandle`、selected branch、skipped 集合和汇合点。

### 当天产出

- 手画一个 `Input -> Condition -> A/B -> Merge -> Output`。
- 用口头例子解释为什么 Merge 不应被一条未选中分支误跳过。
- 准备一个改进方案：显式端口映射或字段命名空间。

### 必答题

1. 拓扑排序为什么不能证明并行？
2. 多个前驱输出同名字段怎么办？
3. 条件分支如何避免跳过汇合节点？

### 验收

能在白纸上从输入推导每个节点的实际 Map。

## 五、Day 3：执行状态、快照恢复与 LangGraph

### 必学

- `workflow`、`execution_record`、snapshot、variable、SSE 的粒度。
- DAG 恢复：起点选择、成功输出恢复、修改变量覆盖、重试计数。
- `useSnapshotVariables` 当前未生效。
- LangGraph 当前真实能力：StateGraph Adapter，而非完整循环/Checkpoint。

### 当天产出

- 画出失败节点恢复时的状态时间线。
- 做一张 DAG / LangGraph 对比表。
- 准备“为什么 SSE 不能代替 Snapshot”的 30 秒回答。

### 必答题

1. 整次执行记录和每节点快照为什么要分开？
2. 从失败节点恢复时，上游输出从哪里来？
3. 为什么不能说 LangGraph 已支持断点恢复？

### 验收

回答中不使用“框架理论上支持”替代“当前项目代码已实现”。

## 六、Day 4：ReAct、Tool Calling 和 MCP

### 必学

- ReAct 的 goal、decision、tool、observation、trace、stop。
- JSON 决策协议与原生 Function Calling 的区别。
- Tool Registry 的注册和局部候选集。
- 当前工具白名单闭环缺失。
- MCP 当前只接通 web_search，Web Fetch 是普通本地工具。

### 当天产出

- 手画两轮 ReAct：搜索 -> 抓取 -> 最终答案。
- 准备一个非法 JSON、工具失败、最大步数 Failure Case。
- 口述工具越权风险的最小修复方案。

### 必答题

1. 为什么工具异常不直接让工作流失败？
2. 当前 Tool 白名单哪里失效？
3. MCP 配置泛化为什么不等于任意 MCP 动态调用？

### 验收

能准确说“每步一个工具，默认 5、最大 20”，但不把这些参数包装成算法亮点。

## 七、Day 5：Context、Memory、Knowledge、Skill 与安全

### 必学

- 普通 LLM 和 ReAct 的上下文路径差异。
- Memory 是进程内 List；Knowledge 是 MySQL 候选全扫 + Java 打分。
- 普通 LLM 加载 Skill 主指南和全部 references；ReAct 具备 reference 按需加载工具，但当前 UI 不暴露、后端不自动补入。
- `web_fetch` 的 SSRF、大响应和重定向风险。
- PaiCLI 的 Tool Calling、Context / Skill / MCP 与安全纵深，用来补充深度，不扩张个人归属。

### 当天产出

- 画普通 LLM / ReAct 的上下文对比。
- 准备 Memory 重启丢失和 Web Fetch SSRF 两个 Failure Case。
- 用 60 秒解释 Prompt、Memory、Knowledge、Skill 的生命周期差异。

### 必答题

1. 为什么 Schema 有 Memory 表也不能说已经持久化？
2. 为什么执行器里有 Skill 加载工具，也不能说当前 UI 链路已闭合？
3. URL 正则为什么不能完整防 SSRF？

### 验收

能讲清 PaiAgent 与 PaiCLI 的共同原理，但不提前做“哪个项目更强”的横向比较。

## 八、Day 6：AI 软件工厂与简历冻结

### 必学

- 拓扑增量采集：Resource / CALLS、稳定键、Redis pending observation。
- 可视化工作台：ECharts / d3-force、可读/全景视图、缩放 LOD、版本刷新。
- Kimi CCR：嵌套 `$ref` Tool Schema、JSON/SSE Usage、真实调度验证边界。
- 候选简历的每条 Claim-Evidence-Risk。

### 当天产出

- 冻结最终 Agent 定向简历，不再临时添加新项目。
- 每条 Bullet 准备“30 秒主答 + 两个追问 + 一个 Failure Case”。
- 准备 2 分钟自我介绍，把科研压缩到岗位相关能力，不展开论文细节。

### 必答题

1. 为什么 Redis pending 不是全局事务？
2. 可读/全景视图和缩放 LOD 有什么区别？
3. Tool Schema 和 Usage 分别属于请求还是响应问题？

### 验收

任何简历强动词都能立刻指出个人代码、提交或明确事实来源。

## 九、Day 7：全真模拟与止损

### 上午：项目面

按以下顺序各练两轮：

```text
自我介绍
-> AI 软件工厂 90 秒
-> 拓扑 / 工作台 / Kimi 各一个深挖
-> PaiAgent 源码研习 60 秒
-> ReAct / Workflow / Tool / State 各一个深挖
-> Failure Case 与重新设计
-> 事实边界追问
```

### 下午：基础面

只复习简历触发的一跳基础：

- Java：集合、并发、线程池、异常、Spring DI / AOP / 事务边界。
- MySQL / Redis：索引、事务、缓存一致性、TTL、分布式状态边界。
- Agent：ReAct、Tool Calling、MCP、Context、Memory、Skill、终止和授权。
- 图与前端：Neo4j MERGE、力导向、LOD、快照版本协调。
- 模型协议：JSON Schema、SSE、Tool Call ID、Usage。

### 晚上：只做止损

- 不学新框架。
- 不再改项目叙事。
- 只修正模拟中答错的 10 个问题。
- 再扫一次事实红线和候选简历。

## 十、7 天优先级看板

### P0：面试前必须完成

- 冻结 Agent 定向简历。
- AI 软件工厂三条贡献全部能深挖。
- PaiAgent 8 道 P0 全部能答。
- 能讲 4 个 Failure Case：pending 一致性、工具越权、Memory 不持久、Web Fetch SSRF。
- 所有开源项目主动声明源码研习边界。

### P1：有余力再做

- PaiCLI 的流式 Tool Calling、安全和预算再复习一轮。
- 为每条 Bullet 准备英文关键词。
- 根据真实 JD 调整技能顺序，不改事实强度。

### P2：本周放弃

- PaiFlow 全仓学习。
- PaiAgent 图片、视频、TTS 深入。
- 重做 RAG / Baize 评测。
- 没有证据的个人 Agent 改造包装。

## 十一、最终自检

- [ ] 2 分钟自我介绍不超时。
- [ ] AI 软件工厂 90 秒介绍不看稿。
- [ ] PaiAgent 只说源码研习，不说个人实现。
- [ ] 能画 Workflow、ReAct、Snapshot 三条图。
- [ ] 能解释当前实现与推荐方案的区别。
- [ ] 不使用虚构指标、规模、上线或所有权。
- [ ] 每个 Failure Case 都包含现象、根因、当前边界和最小改进。

## 相关链接

- [[PaiAgent-01-项目主卡]]
- [[PaiAgent-02-高频追问卡]]
- [[PaiAgent-03-证据与事实边界]]
- AI 软件工厂材料已移出公开仓库（不在本目录提供链接）
- [[SageCLI-01-项目主卡]]
