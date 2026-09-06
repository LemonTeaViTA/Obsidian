---
module: Baize
type: project
status: current
tags: [Baize, PaiSmart, RAG, Elasticsearch, Agent, 面试]
last_reviewed: 2026-09-05
---

# Baize 项目主卡

> [!warning] Fit Verdict
> 原“权限过滤前置到 KNN 召回”口径与源码冲突，属于 `risky fit`。简历收紧为“检索与权限审计”，明确顶层 KNN 未带权限 Filter 的风险后，按实习自主选题 Demo、链路复现与源码分析口径评为 `strong fit`；不能包装成安全完备的生产系统。

## 一、项目定位与开场

### 一句话定位

Baize / PaiSmart 是企业知识库 RAG 技术验证项目，覆盖异步文档入库、解析分块、向量索引、权限检索审计、ReAct 工具问答、引用恢复和生成状态管理。

### 30 秒介绍

> 我用 AI Coding Agent 辅助拆解并复现了企业知识库 RAG 全链路。离线侧从分片上传、MinIO 合并和 Kafka 异步处理进入 Tika / LiteParse 解析、语义分块、Embedding 与 Elasticsearch；在线侧审计单次 ES 请求中的顶层 KNN、带关键词和权限的 Query 分支及 BM25 Rescore。聊天侧通过 WebSocket 限轮 ReAct 调用 `search_knowledge`，把 Chunk 证据、引用映射和生成状态串起来。它是实习自主选题 Demo，不是大规模生产交付。

### 90 秒介绍

> 项目分为离线入库与在线问答。客户端按文件 MD5 分片；Redis Bitmap 是进度快路径，MySQL 保存文件与分片记录，MinIO 保存分片和合并对象。服务端交叉校验三方状态，完整后以 `UPLOADING -> MERGING` CAS 防止并发合并，合并后投递 Kafka。Consumer 用 PDF 文件头选择 LiteParse，非 PDF 使用 Tika；解析结果按段落、句子、HanLP 长句和字符兜底切分，小块向前合并，并从上一块尾部复制完整语义单元形成离线 Overlap，再生成 2048 维向量和权限元数据写入 ES。
>
> 查询先生成 Query Embedding。源码实际在同一次 ES 请求中并列提交顶层 KNN 与 `keyword must + userId/public/orgTag filter` Query，再进行 BM25 `AND` Rescore；它不是应用层两路召回，也不是 RRF。关键审计结论是权限 Filter 没有下推到 `knn.filter`，因此不能声称向量分支已安全前置过滤。Embedding 失败、混合查询失败和纯文本失败分别处理，但后两类最终可能都表现为空列表。
>
> WebSocket ChatHandler 建立 generation，最多四个常规 ReAct 轮次、八次 Tool Call，预算耗尽后有一次禁用工具的收尾轮。`search_knowledge` 返回文件、Chunk、页码、分数与正文；引用映射既写入 30 分钟 Redis generation 状态，也随问答写入 MySQL。用户停止最终记为 `CANCELLED`，但断开 WebSocket 不会自动取消模型流，已执行 Tool 也不会回滚。这些限制和改进方案都要与当前能力分开回答。

## 二、五条必须会画的链路

### 1. 上传与合并

```text
文件 MD5 → 查询 Redis Bitmap / MySQL chunk_info / MinIO 对象
→ 上传 chunks/{fileMd5}/{chunkIndex} → MySQL → Redis
→ 校验完整 → UPLOADING --CAS→ MERGING
→ 顺序合并 merged/{fileMd5} → 清理分片 → COMPLETED
→ vectorization=PROCESSING → Kafka FileProcessingTask
```

- 缺片或对象缺失时拒绝合并；合并异常尝试回到 `UPLOADING`。
- 合并成功与 Kafka 投递不是同一事务；`COMPLETED` 的重复 merge 只返回成功，不补发任务。

### 2. 异步解析与索引

```text
FileProcessingTask → Consumer 标记 PROCESSING → MinIO 取文件
→ PDF: LiteParse / 可选 OCR；非 PDF: Tika
→ 段落 → 句子 → HanLP 长句 → 字符兜底 → 小块合并 → 离线 Overlap
→ 批量 Embedding → MySQL DocumentVector + ES Bulk → COMPLETED / FAILED / DLT
```

- ErrorHandler 为固定 3 秒退避、最多 4 次重试，耗尽进入 DLT；源码未发现 DLT Consumer 或恢复闭环。
- Consumer、MySQL Chunk 与随机 UUID ES 文档均无任务级去重；重试可能放大部分写入。

### 3. 权限感知检索

```text
Query + 当前身份 → 有效组织标签（直接标签 + 父标签 + DEFAULT）
→ Query Embedding
→ 单次 ES _search：顶层 knn || 顶层 keyword must + permission filter
→ BM25 AND rescore（query 0.2 / rescore 1.0）→ Top-K → HYBRID
→ Embedding 失败或混合查询失败：权限感知文本检索 → TEXT_ONLY / 空列表
```

> [!danger] 当前权限边界
> `userId OR public OR orgTag` 只出现在顶层 Query 分支，未进入 `knn.filter`。顶层 KNN 与 Query 在 ES 混合搜索中并列组合，向量命中可能绕过租户过滤。纯文本降级分支带权限 Filter；管理员也没有检索绕过逻辑。

### 4. ReAct、引用与历史

```text
WebSocket 消息 → Conversation / Generation → Redis 最近历史 + 本轮消息
→ LLM 文本或 Tool Call → search_knowledge → 权限检索
→ [N] 文件 / fileMd5 / chunkId / page / score / 正文
→ Tool Result 按 tool_call_id 回填 → 下一轮 → 流式回答
→ MySQL question/answer/reference_mappings_json → Redis 短期历史
→ 历史接口 → 前端优先用持久化 referenceMappings 预览
```

- 多次 `search_knowledge` 都从 `[1]` 编号并覆盖 generation 引用映射，旧轮编号可能错位。
- 检索到证据、编号映射正确、答案陈述受证据支持是三个不同验证层次。

### 5. Generation 状态

```text
创建 → STREAMING → 模型流 / Tool Call / 响应缓冲
→ COMPLETED | CANCELLED | FAILED
→ Redis 快照（30 分钟）+ JVM Future / Stream / Buffer / 引用映射清理
```

- 真实状态没有 `RUNNING` 或 `STOPPED`；停止请求最终映射为 `CANCELLED`。
- Stop 会设置取消标记、dispose 当前订阅并完成 Future；WebSocket 断开只注销 Session，不自动 Stop。
- 没有显式终态单调 CAS，迟到回调、重复完成和内存清理仍是竞态审计点。

## 三、核心模块答题模板

### 上传协调与异步入库（简历 Bullet 1）

- **问题 / I/O / 状态：**接收分片，输出合并对象和 Kafka 任务；Redis 存快状态，MySQL 存文件与分片事实，MinIO 存字节对象。
- **正常 / 失败：**MinIO → MySQL → Redis，完整后 CAS 合并；缺片、合并或投递失败分别处理，三套存储没有全局事务。
- **一致性：**只有分片重复请求与并发 merge 有局部幂等；Kafka 消费和 ES 索引不幂等。
- **为什么 / 替代：**异步隔离上传延迟；小规模可同步，可靠生产可用 Outbox、任务唯一键和确定性索引 ID。
- **限制 / 验证 / 易错：**同 MD5 资源路径跨用户共享；用三方状态故障注入验证。最易错是说“Kafka 保证一次消费”。

### 解析、分块与向量化（简历 Bullet 1）

- **问题 / I/O / 状态：**文件流输入，Chunk、页码、向量与权限字段输出；Chunk 存 MySQL 与 ES，模型版本随 ES 文档保存。
- **正常 / 失败：**PDF 只走 LiteParse，非 PDF 走 Tika；LiteParse 失败不回退 Tika，空页可能得到 0 Chunk 完成。
- **一致性：**ES Bulk 部分成功不回滚，随机 UUID 使重放不能覆盖旧文档。
- **为什么 / 替代：**语义边界减少事实截断；固定字符更简单，父子块或查询邻块适合补上下文但当前未实现。
- **限制 / 验证 / 易错：**当前默认 2048 维；对边界、空文档、维度和部分 Bulk 做测试。最易错是把离线 Overlap 说成动态邻块扩展。

### 检索与权限审计（简历 Bullet 2）

- **问题 / I/O / 状态：**Query 与身份输入，带模式标签的 Top-K Chunk 输出；权限事实来自 MySQL/Redis，索引保存权限副本。
- **正常 / 失败：**Embedding → 顶层 KNN 与 Query 并列 → Rescore；Embedding、混合查询、文本查询有三级失败分支。
- **一致性：**权限缓存、文件记录和 ES 权限副本可能漂移；当前 KNN 没有权限预过滤。
- **为什么 / 替代：**单请求实现简单；安全修复应先用 `knn.filter`，再评估独立双路 + RRF 或 Cross-Encoder。
- **限制 / 验证 / 易错：**固定身份保存原始请求和 Top-K，做越权负例。最易错是说“先 KNN 候选，再对候选 keyword + permission”。

### Agent 引用问答（简历 Bullet 3）

- **问题 / I/O / 状态：**用户消息输入，流式文本和引用输出；Tool 消息、编号映射、回答与引用分别在内存、Redis、MySQL 保存。
- **正常 / 失败：**限轮 ReAct 调用 Tool 并回填；空检索、Tool 异常、预算耗尽和模型失败不等价。
- **一致性：**Tool Call 无去重，引用映射采用最新搜索覆盖；带引用不能证明答案忠实。
- **为什么 / 替代：**WebSocket 支持双向 stop 与流式事件；SSE 更简单但客户端控制需另建 HTTP 通道，固定 RAG 则流程更可预测。
- **限制 / 验证 / 易错：**回放多次搜索、伪造引用和空结果。最易错是把 `[N]` 正确映射等同于陈述有证据。

### 会话与 Generation（简历 Bullet 3）

- **问题 / I/O / 状态：**管理多轮上下文、持久历史和生成生命周期；Redis 历史 7 天/最多 20 条，ReAct 实取最近 6 条，MySQL 永久保存问答。
- **正常 / 失败：**先持久化 MySQL，再写 Redis 历史；MySQL 失败会提示降级并跳过 Redis，Redis 失败则在线上下文漂移。
- **一致性：**Redis 过期后不会从 MySQL 重建模型短期上下文；停止不能回滚已发 Tool 副作用。
- **为什么 / 替代：**Redis 低延迟、MySQL 可恢复展示；多实例需共享生成注册表或路由黏性，并给终态加 CAS。
- **限制 / 验证 / 易错：**断链、迟到完成、Redis 过期后回放。最易错是混用 `CANCELLED`、断开连接和上游真实取消。

## 四、知识目录与分级

### 简历原句索引

- **R0 项目定位：**“采用 AI Coding Agent 辅助完成企业文档问答 RAG 技术验证方案的拆解、链路复现与源码分析，覆盖离线文档入库、在线检索、Agent 问答及来源引用链路。”
- **R1 异步文档入库：**“梳理文件分片上传与 MinIO 合并链路，通过 Kafka 解耦解析和向量化任务；使用 Tika / LiteParse 提取文本，按段落与句子边界分块、合并过小片段并添加语义 Overlap，携带文件、页码和权限元数据写入 Elasticsearch。”
- **R2 检索与权限审计：**“分析单次 Elasticsearch 请求中顶层 KNN、带关键词和 `userId / public / orgTag` 权限 Filter 的 Query 分支及 BM25 Rescore，识别权限条件未下推 KNN 的隔离风险，并梳理 Embedding、混合查询与纯文本查询的分级降级边界。”
- **R3 Agent 引用问答：**“复现基于 WebSocket 的限轮次 ReAct 问答流程，模型按需调用 `search_knowledge`，将文件、Chunk、页码和分数作为证据回填上下文，并维护引用编号映射与生成任务的流式、完成、取消和失败状态。”

| 顺序 | 模块 | 级别 | 简历触发 | 主要入口 | 最易答错 |
| --- | --- | --- | --- | --- | --- |
| 1 | 项目全景与个人事实边界 | P0 | R0 | `SmartPaiApplication`、本卡五链路 | 说成生产上线或原创全部框架 |
| 2 | 分片、三方状态与合并 | P0 | R1 | `UploadController`、`UploadService` | Redis 是唯一事实源 |
| 3 | Kafka 重试与三类幂等 | P0 | R1 | `FileProcessingConsumer`、`KafkaConfig` | 一次消费等于端到端幂等 |
| 4 | 解析、分块和离线 Overlap | P0 | R1 | `ParseService`、`LiteParseService` | PDF 失败自动回退 Tika |
| 5 | 单次 ES 混合请求与权限风险 | P0 | R2 | `HybridSearchService` | 说成受权限约束的 KNN 候选 |
| 6 | 三级检索故障与文本降级 | P0 | R2 | `HybridSearchService` | 把失败与无结果合成一种 |
| 7 | ReAct Tool、证据和引用持久化 | P0 | R3 | `AgentToolRegistry`、`ChatHandler` | 引用存在即忠实 |
| 8 | Generation、会话与恢复 | P0 | R3 | `ChatGenerationStateService`、`ConversationService` | Redis 上下文等于 MySQL 历史 |
| 9 | KNN Filter、RRF、Rescore、Cross-Encoder | P1 | R2 一跳 | ES 查询构造与方案对比 | 把优化写成当前实现 |
| 10 | Chunk Size、Overlap、邻块扩展 | P1 | R1 一跳 | `ParseService` | overlap 越大越好 |
| 11 | 检索、引用与回答评测 | P1 | R2/R3 一跳 | Top-K / Prompt / 引用回放设计 | 测试类存在等于已有指标 |
| 12 | 幂等、版本、可观测与扩容 | P1 | R1-R3 一跳 | Consumer、ES、Generation | 直接补分布式架构冒充现状 |
| 13 | Kafka 交付、重试与 DLT 基础 | P2-01 | R1 基础 | `KafkaConfig`、Consumer | Producer 幂等等于业务幂等 |
| 14 | MinIO 对象与 Redis Bitmap | P2-02 | R1 基础 | `UploadService` | 快状态等于事实源 |
| 15 | Tika、LiteParse 与 OCR | P2-03 | R1 基础 | `ParseService`、解析适配 | 三者任意自动回退 |
| 16 | Embedding、HNSW/KNN 与 BM25 | P2-04 | R1/R2 基础 | Client、Mapping、Search | ANN 与重排职责混淆 |
| 17 | WebSocket、SSE 与 Spring 并发 | P2-05 | R3 基础 | Handler、Router | 断链等于取消上游 |
| 18 | JWT、RBAC 与组织标签 | P2-06 | R2 基础 | 安全 Filter、`UserService` | 接口角色等于数据权限 |
| 19 | 模型 Provider、路由与流式协议 | P2-07 | R3 基础 | `ModelProviderConfigService`、Router | 可配置等于自动故障转移 |
| 20 | 配额、限流与反馈 | P2-08 | R0 全景 | Usage/RateLimit/Tool | 强行升级为简历主问题 |
| 21 | 支付、充值、管理后台与 Compose | P2-09 | R0 全景 | Recharge/Admin/Compose | 存在模块等于个人 RAG 成果 |
| 22 | 表结构、对象路径与 Redis Key | REF-01 | R1 查阅 | Model/Repository/Upload | 背字段不讲状态关系 |
| 23 | Topic、重试、DLT 与任务状态 | REF-02 | R1 查阅 | Kafka/Consumer/FileUpload | 配置存在等于恢复闭环 |
| 24 | ES Mapping、维度与检索参数 | REF-03 | R1/R2 查阅 | Mapping/HybridSearch | 旧注释覆盖实际 Mapping |
| 25 | Tool、引用、Generation 与会话字段 | REF-04 | R3 查阅 | Agent/Chat/Conversation | 内存、Redis、MySQL混用 |
| 26 | 前端组件、配置层级与测试入口 | REF-05 | R0-R3 验证 | Vue、resources、`src/test` | 测试文件等于运行证据 |

## 五、运行与部署边界

- Spring Boot 后端与 Vue 3 / TypeScript 前端；前端有 build/typecheck，无单元测试脚本，Playwright 用例要求已运行页面。
- Compose 提供 MySQL、Redis、Kafka、Elasticsearch 与 MinIO；LiteParse/OCR、LLM 和 Embedding 还依赖外部或独立服务。
- 配置按基础 `application.yml`、环境 profile、环境变量和数据库 Provider/限流配置覆盖；生产缺失必需变量会启动或调用失败。
- 单机 JVM 内存保存活动生成流和 Future，多实例需要会话路由、共享协调或可转移状态；当前没有这套闭环。
- 不展示任何配置值；支付、密钥、模型凭证和 JWT 只记录来源、优先级、缺失风险及部署依赖。

## 六、最终复习顺序

```text
90 秒介绍 → 画上传链 → 画解析索引链 → 画真实 ES 查询
→ 画 ReAct 引用链 → 画 Generation 状态 → 8 个 P0
→ 4 个 P1 → 选 6 个 Failure Case 做故障演练 → REF 查源码
```

- 闭卷要求：逐条解释三条 Bullet，并连续回答“为什么异步—重复消费怎么办—如何验证”。
- 至少能讲：一个异步取舍、一个幂等缺口、一个权限检索故障、一个取消竞态、一个评测方案和一个当前限制。
- 必须准确区分：顶层并列 KNN/Query 与两路 RRF、离线 Overlap 与查询邻块、BM25 Rescore 与 Cross-Encoder、证据命中与引用映射与答案忠实性。

## 相关链接

- [[Baize-02-高频追问卡]] — 8 个 P0、4 个 P1 与技术对比
- [[Baize-03-证据与事实边界]] — 源码证据、Failure Case、测试和声明门槛
- [[Baize-03-证据与事实边界]] — 统一项目验收标准与个人事实边界
- [[RAG管道设计]] — 历史材料，仅作 REF，不作为事实源
