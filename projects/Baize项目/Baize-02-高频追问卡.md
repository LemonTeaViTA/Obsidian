---
module: Baize
type: project
tags: [Baize, PaiSmart, RAG, 面试题, Elasticsearch, Agent]
last_reviewed: 2026-09-05
---

# Baize 高频追问卡

> [!tip] 出题边界
> 正式问题固定为 8 个 P0 和 4 个 P1。P0 只由当前简历直接触发，P1 只做一跳原理、故障、对比和验证；支付、参数、类名和历史材料不升级为主问题。

## 一、P0-必会（推荐顺序 1-8）

### P0-01 如何用 90 秒介绍 Baize，并说明个人边界？

- **简历触发原句：**“采用 AI Coding Agent 辅助完成企业文档问答 RAG 技术验证方案的拆解、链路复现与源码分析，覆盖离线文档入库、在线检索、Agent 问答及来源引用链路。”
- **30-60 秒回答：**Baize 是企业知识库 RAG 技术验证 Demo。离线侧以 Redis/MySQL/MinIO 协调分片状态，合并后通过 Kafka 异步执行 LiteParse/Tika 解析、语义分块、Embedding 和 ES 索引；在线侧审计单次 ES 请求的顶层 KNN、带权限的关键词 Query 与 BM25 Rescore。Agent 通过 WebSocket 限轮 ReAct 调用 `search_knowledge`，把 Chunk 证据、引用映射和生成状态串起来。我的口径是自主选题、链路复现、源码分析和已执行的局部测试，不声称上游全部能力为个人原创，也不声称生产上线或规模效果。
- **输入 / 输出 / 状态：**文档与问题输入，索引、流式回答和引用输出；状态分散在 MySQL、Redis、MinIO、Kafka、ES 与 JVM 内存。
- **失败与限制：**跨存储无全局事务，消费/索引未幂等，KNN 权限过滤存在缺口，生成取消不是副作用回滚。
- **源码入口：**`SmartPaiApplication`、`UploadController`、`FileProcessingConsumer`、`HybridSearchService`、`ChatHandler`。
- **最容易答错：**堆技术名却不讲两条主链，或把 Demo 说成企业生产交付。

### P0-02 分片上传、断点状态和 MinIO 合并如何工作？

- **简历触发原句：**“梳理文件分片上传与 MinIO 合并链路”。
- **30-60 秒回答：**客户端携带文件 MD5 和分片索引。Redis `upload:{userId}:{fileMd5}` Bitmap 是进度快路径，MySQL `file_upload/chunk_info` 保存文件与分片元数据，MinIO `chunks/{fileMd5}/{chunkIndex}` 保存字节。新分片按 MinIO、MySQL、Redis 顺序写入；重复请求会交叉检查三方并清理或回填失效状态。分片完整后用 `UPLOADING -> MERGING` CAS 抢合并权，逐片确认 MinIO 对象并合并成 `merged/{fileMd5}`，成功后清理临时状态、记为 `COMPLETED`，再进入 Kafka 投递。
- **正常输出 / 关键状态：**返回上传进度或合并对象 URL；Redis 可丢失并由 DB 回源，但 DB 记录仍要与 MinIO 对象共同确认。
- **失败链路：**缺片拒绝；合并失败尝试回到 `UPLOADING`；Redis 标完整但对象缺失会清理失效状态；Kafka 投递失败发生在合并完成之后。
- **幂等边界：**分片重复请求与并发 merge 有局部幂等；同 MD5 的 MinIO/Chunk 路径未包含用户，不能把它当强租户隔离键。
- **为什么 / 替代：**断点续传降低大文件重传成本；小文件可直接上传，多实例生产可用对象存储 Multipart Upload 与租户化对象键。
- **如何验证：**构造 Redis 命中但 DB/MinIO 缺失、DB 命中但 Redis 丢失、缺片和两个并发 merge。
- **源码入口：**`UploadController`、`UploadService`、`FileUploadRepository`、`ChunkInfoRepository`。
- **最容易答错：**说 Redis 是事实源，或只按“已上传数量等于总数”判断完整。

### P0-03 Kafka 为什么异步，重试与三类幂等边界是什么？

- **简历触发原句：**“通过 Kafka 解耦解析和向量化任务”。
- **30-60 秒回答：**解析、OCR、Embedding 和 Bulk 索引耗时且依赖外部服务，Kafka 让上传响应与重处理解耦。Producer 使用 `acks=all`、幂等生产和事务发送；Consumer 失败按固定 3 秒退避最多重试 4 次，耗尽进 DLT。但端到端不是 exactly-once：Consumer 每次都会追加 MySQL Chunk，并用随机 UUID 写 ES，任务没有唯一消费记录，所以重复投递或部分成功后重试会重复解析和索引。
- **状态 / 输出：**`FileUpload.vectorizationStatus` 记录 PROCESSING/COMPLETED/FAILED，Kafka 保存待处理与 DLT 消息，Chunk/向量落 MySQL/ES。
- **三类幂等：**上传幂等依赖 MD5+分片+状态交叉校验；消费幂等当前缺任务去重；索引幂等当前缺确定性文档 ID/索引版本。Agent Tool Call 幂等是第四类，也未统一实现。
- **失败链路：**合并完成但投递失败没有 Outbox；Bulk 部分成功仍抛错且不回滚；源码未发现 DLT Consumer 或手工恢复闭环。
- **为什么 / 替代：**当前方案适合验证解耦；可靠方案用 Outbox、`taskId/fileMd5+version` 去重、幂等 upsert、阶段状态与可重放 DLT。
- **如何验证：**同任务发送两次；在 MySQL Chunk 后、Embedding 中和 Bulk 部分成功处故障注入，再核对计数和状态。
- **源码入口：**`UploadController`、`KafkaConfig`、`FileProcessingConsumer`、`VectorizationService`。
- **最容易答错：**用“Kafka 幂等生产者”推出“消费和索引只执行一次”。

### P0-04 Tika/LiteParse 如何分工，分块与 Overlap 如何取舍？

- **简历触发原句：**“使用 Tika / LiteParse 提取文本，按段落与句子边界分块、合并过小片段并添加语义 Overlap”。
- **30-60 秒回答：**服务端根据文件头识别 PDF：PDF 只走 LiteParse，LiteParse 可调用内部 OCR 适配端点，再接 OCR Provider；非 PDF 才走 Tika `AutoDetectParser`。文本先按段落，再按中英文句子切分，超长句用 HanLP、最后字符硬切兜底；小块向前合并，并从上一块尾部取完整语义单元作为下一块离线 Overlap。它保护语义边界，但会增加重复索引和 Prompt 噪声。
- **输入 / 输出 / 状态：**文件流输入，带页码的 Chunk 输出；PDF 保存页码，非 PDF 页码通常为 `null`，Chunk 存 MySQL 后参与向量化。
- **失败链路：**LiteParse 失败直接抛错，不自动回退 Tika；空页被跳过，全部为空时可能以 0 Chunk 完成；OCR 清洗可能损伤原文。
- **为什么 / 替代：**LiteParse保留 PDF 页级结构，Tika覆盖通用格式；固定字符更简单，父子分块或查询邻块适合上下文补全但当前未实现。
- **如何验证：**准备扫描 PDF、空 PDF、混合格式、超长句、极短段和跨页事实，核对页码、边界、重复率与目标证据命中。
- **源码入口：**`ParseService`、`LiteParseService`、`LiteParseOcrAdapterService`。
- **最容易答错：**说 LiteParse 失败自动回退 Tika，或把离线 Overlap 说成命中后的动态邻块扩展。

### P0-05 当前混合检索和权限过滤到底如何实现？

- **简历触发原句：**“分析单次 Elasticsearch 请求中顶层 KNN、带关键词和权限 Filter 的 Query 分支及 BM25 Rescore”。
- **30-60 秒回答：**Query Embedding 成功后，`HybridSearchService` 发出一次 ES `_search`：顶层 `knn` 用 `recallK=topK*30`，顶层 `query` 是 `textContent match must` 加 `userId OR public OR orgTag` Filter，随后 BM25 `AND` Rescore，query 权重 0.2、rescore 权重 1.0。ES 顶层 KNN 与 Query 是并列混合分支，不是“先 KNN 再用 keyword/permission 限制候选”，也不是应用层两次召回后 RRF。
- **状态 / 输出：**有效组织标签来自 Redis 缓存和 MySQL 用户/标签关系；ES 返回 `HYBRID` Top-K，保存文本、文件、Chunk、页码及权限字段。
- **高风险失败：**权限 Filter 没进入 `knn.filter`，向量分支可能让跨租户 Chunk 进入最终结果；管理员也没有额外检索旁路。
- **权限逻辑：**本人 OR 公开 OR 有效组织标签；有效标签包含直接标签、递归父标签与 `DEFAULT`。标签查询异常至少返回 `DEFAULT`，HybridService 再异常则可能使用空标签。
- **为什么 / 替代：**单请求简化查询和排序；最小安全修复是把同一权限 Bool 下推 `knn.filter`，独立双路时两路都必须先过滤再融合。
- **如何验证：**创建两个用户的私有文档，使用只与对方文档语义相近而词面不匹配的 Query，抓取原始 ES 请求和 Top-K 做负向越权测试。
- **源码入口：**`HybridSearchService.searchWithPermission()`、`OrgTagCacheService`、`EsDocument`、`EsIndexInitializer`。
- **最容易答错：**继续背“权限前置到 KNN 候选”，这是本轮必须纠正的核心口径。

### P0-06 Embedding、混合查询和纯文本查询失败如何区分？

- **简历触发原句：**“梳理 Embedding、混合查询与纯文本查询的分级降级边界”。
- **30-60 秒回答：**第一类是 Query Embedding 失败，返回 `null` 后直接走权限感知纯文本检索；第二类是 Embedding 成功但混合 ES 查询抛异常，外层 catch 再尝试纯文本；第三类是纯文本 ES 查询自身失败，它在方法内部吞异常并返回空列表。真正没有命中也返回空列表，所以调用方目前不能区分“知识库无答案”和“降级检索故障”。成功纯文本结果标记 `TEXT_ONLY`，混合结果标记 `HYBRID`。
- **输入 / 输出 / 状态：**同一 Query 与身份输入，返回模式标记或空列表；原因主要在日志，没有稳定错误码随 Tool Result 传播。
- **一致性 / 限制：**降级提升可用性但改变召回质量；权限文本分支有 Filter，不代表混合 KNN 风险被修复。
- **为什么 / 替代：**关键词搜索能覆盖专名和精确词；可改成 `SearchOutcome(mode, results, failureReason)`，对故障与无结果采用不同提示和指标。
- **如何验证：**分别 mock Embedding、混合 ES 和文本 ES 异常，再加真实空结果，核对调用次数、模式、日志和用户提示。
- **源码入口：**`HybridSearchService.embedToVectorList()`、`searchWithPermission()`、`textOnlySearchWithPermission()`。
- **最容易答错：**一句“异常自动降级”掩盖三级分支，或宣称当前能向用户区分空结果原因。

### P0-07 ReAct 如何调用 `search_knowledge`，引用如何映射和恢复？

- **简历触发原句：**“复现基于 WebSocket 的限轮次 ReAct 问答流程，模型按需调用 `search_knowledge`，将文件、Chunk、页码和分数作为证据回填上下文，并维护引用编号映射”。
- **30-60 秒回答：**ChatHandler 建立 generation 并加载最近上下文，模型最多进行四个常规 ReAct 轮次和八次 Tool Call；预算耗尽后再做一次禁用工具的最终轮。`search_knowledge` 校验 Query/Top-K 和当前用户权限，把结果格式化为 `[N]`，包含文件名、fileMd5、chunkId、page、score 与最多约 1200 字正文，并按 `tool_call_id` 回填模型。完成时将编号映射写入 Redis generation 状态，也把完整 `reference_mappings_json` 与问答写入 MySQL；历史接口返回映射，前端优先用持久化数据预览。
- **关键状态：**当前流的 Tool 消息与映射在 JVM/Redis；历史问答与引用在 MySQL；generation 引用 API 受 30 分钟 TTL 限制。
- **失败与一致性：**每次搜索都从 `[1]` 开始并覆盖映射，多次搜索可能让模型引用旧编号；空结果不强制拒答；Tool Call 无通用去重，副作用 Tool 可能重复执行。
- **忠实性三层：**检索命中正确证据；`[N]` 正确映射到证据；回答每个陈述确实被该证据支持。三者必须分别验证。
- **为什么 / 替代：**ReAct 支持按需检索和工具组合；固定 RAG 更可控、更低延迟，适合每问必检索场景。
- **如何验证：**连续两次搜索、引用不存在编号、空结果、历史重载和 30 分钟后 generation API 失效。
- **源码入口：**`AgentToolRegistry`、`ChatHandler`、`ConversationService`、前端 `chat-message.vue`。
- **最容易答错：**说“有引用所以无幻觉”，或说引用只在当前 WebSocket 内存中。

### P0-08 Generation、停止/取消和 Redis/MySQL 会话如何协作？

- **简历触发原句：**“维护引用编号映射与生成任务的流式、完成、取消和失败状态”。
- **30-60 秒回答：**真实 generation 状态只有 `STREAMING / COMPLETED / CANCELLED / FAILED`。Redis 保存 30 分钟的元数据、内容和引用快照；JVM 内存保存响应缓冲、Future、活动 Reactor Stream、取消标记和映射。Stop 会设置取消标记、先写 `CANCELLED`、dispose 当前订阅、完成 Future 并通知前端，但 WebSocket 断开只注销 Session，不会自动停止模型，已执行 Tool 也不会回滚。会话方面，Redis 保存 7 天当前会话和最多 20 条短期消息，ReAct 实取最近 6 条；MySQL 保存会话元数据、问答与引用历史。
- **正常 / 失败：**回答完成时先写 MySQL，再写 Redis 短期上下文；MySQL 失败会提示持久化降级且跳过 Redis，Redis 写失败则历史仍在但下一轮上下文可能漂移。
- **竞态与恢复：**没有显式终态单调 CAS；迟到完成与取消可能竞争。Redis 过期或重启后，页面能从 MySQL 恢复历史，但不会自动重建模型短期上下文。
- **为什么 / 替代：**WebSocket 适合双向 stop 和多事件流；SSE 可降低协议复杂度，但控制需另发 HTTP。多实例需 sticky routing 或共享 generation 协调。
- **如何验证：**断网不 Stop、Stop 后制造迟到回调、持久化失败、Redis 过期后继续对话，并核对 UI、Redis、MySQL 和上游调用。
- **源码入口：**`ChatWebSocketHandler`、`ChatHandler`、`ChatGenerationStateService`、`ConversationService`、前端 `input-box.vue`。
- **最容易答错：**使用不存在的 `RUNNING/STOPPED`，或把关闭页面等同于上游模型已取消。

## 二、P1-深挖（推荐顺序 9-12）

### P1-01 如何正确比较当前检索、KNN 预过滤、独立双路、RRF 与 Cross-Encoder？

- **简历触发原句：**Bullet 2 的 KNN、Query、权限 Filter 与 BM25 Rescore。
- **30-60 秒回答：**当前是一条 ES 请求里的并列顶层 KNN/Query，再用 BM25 Rescore；首先要把权限 Bool 放进 `knn.filter`。独立双路是向量和 BM25 各自产生榜单，RRF 用 `1/(k+rank)` 做无量纲融合，能补回另一条路独有候选，但增加两路查询、去重与超时协调。Cross-Encoder 是 Query/候选联合编码，只能重排已召回 Top-N，质量上限高但延迟和成本更高。应先修安全，再用固定证据集判断召回还是排序问题，不能用架构更复杂代替验证。
- **状态 / 失败 / 验证：**保存身份、索引/模型版本、两路 rank、融合分、重排分和各阶段耗时；覆盖无权限、同义改写、精确词和服务超时。
- **替换条件：**词法独有证据常漏时上双路/RRF；证据已召回但名次差时上 Cross-Encoder；低延迟小库可保留简单方案。
- **源码入口：**`HybridSearchService` 当前基线。
- **最容易答错：**把 RRF 或 Cross-Encoder 说成已实现，或修排序却不先修权限。

### P1-02 Chunk Size、离线 Overlap 与查询时邻块扩展如何选择？

- **简历触发原句：**Bullet 1 的段落/句子分块、小块合并和语义 Overlap。
- **30-60 秒回答：**小 Chunk 定位细、向量主题单一，但事实容易断裂且召回数量增加；大 Chunk 上下文完整，却带来语义稀释、Prompt 噪声和 Token 成本。离线 Overlap 在索引前复制上一块尾部语义单元，会永久增加存储和重复命中；查询邻块扩展只在命中后按 Chunk 顺序补上下文，成本按请求发生，但需要稳定相邻关系、权限继承和去重。当前只实现前者。
- **替换条件 / 风险：**跨边界事实经常缺上下文时考虑邻块或父子块；重复证据过多时降低 overlap。邻块扩展若按 fileMd5/序号取数据，也必须再次守住权限和版本。
- **如何验证：**固定 Query-Evidence 集对比 Recall@k、重复率、上下文 Token、忠实性与延迟，不能只挑单个成功例子。
- **源码入口：**`ParseService.splitTextIntoChunksWithSemantics()`。
- **最容易答错：**说 overlap 越大越好，或把查询动态 Window 写成当前能力。

### P1-03 如何定位 RAG 错误并建立最小评测集？

- **简历触发原句：**Bullet 2/3 的检索、证据回填与引用映射。
- **30-60 秒回答：**先固定语料、身份、解析/索引/模型版本，建立 30-50 条 `query / reference answer / evidence chunk / user identity`，覆盖精确词、同义改写、跨 Chunk、易混、无答案和无权限。逐层保存解析 Chunk、召回 Top-K、Rescore 后排名、最终 Prompt、答案与引用：Recall@k 看证据是否进入候选，MRR/NDCG 看排序，人工或受约束 Judge 分别核对引用映射与陈述忠实性。调参与最终集分离。
- **失败分类：**解析缺失、召回漏失、排序压低、Prompt 截断/重复、引用错位、正确证据下的生成不忠实。
- **当前边界：**项目没有保存正式 Recall/NDCG/MRR/RAGAS 或延迟基线；测试类与日志不能替代报告。
- **源码入口：**解析、HybridSearch、Tool Result、Conversation 引用字段可作为 Dump 点。
- **最容易答错：**只报 RAGAS 总分，或把“检索到了”当“回答有依据”。

### P1-04 如果面向可靠多实例，幂等、索引版本与可观测性如何改？

- **简历触发原句：**三条 Bullet 的异步、检索和 Generation 一跳扩展。
- **30-60 秒回答：**不做大重构式空谈，先补最小闭环：合并后以 Outbox 保证任务可投递；Consumer 用 `taskId + fileVersion` 记录阶段状态，Chunk/ES 用确定性 ID upsert；索引别名切换前验证 Mapping、维度与模型版本，Query 固定到兼容版本；日志和指标统一关联 fileMd5/taskId/generationId，保存阶段耗时、重试/DLT、降级率和 Top-K。多实例再处理 WebSocket 路由、共享取消令牌和终态 CAS。
- **替代 / 成本：**Outbox 与状态机会增加表和恢复流程，版本索引增加存储，Top-K Dump 有隐私与成本风险，必须脱敏和限期保留。
- **如何验证：**重复消息、进程崩溃、Bulk 部分成功、索引切换、跨实例 Stop 和迟到回调故障注入。
- **源码入口：**`FileProcessingConsumer`、`EsIndexInitializer`、`VectorizationService`、`ChatGenerationStateService`。
- **最容易答错：**把建议中的 Outbox、确定性 ID、共享状态说成当前已经实现。

## 三、自然技术对比速查

| 对比 | 分别解决什么 | 当前选择与原因 | 何时切换 | 成本与风险 |
| --- | --- | --- | --- | --- |
| 离线入库 / 在线检索 | 建索引 / 低延迟取证 | Kafka 入库、ES 在线查询 | 小文件可同步；强实时需增量可见 | 异步有状态与可见性延迟 |
| 同步解析 / Kafka | 简单一致 / 削峰解耦 | Kafka 隔离 OCR/Embedding 延迟 | 极小流量可同步 | 重复、积压、DLT 恢复 |
| 上传 / 消费 / 索引幂等 | 请求去重 / 任务去重 / 写入覆盖 | 只较完整地做上传局部幂等 | 可靠重放前补后两类 | 唯一键、状态机和版本成本 |
| MinIO / MySQL / Redis | 字节 / 持久事实 / 快状态 | 三方交叉校验 | 对象存储原生 Multipart 可替代部分状态 | 漂移与跨存储事务窗口 |
| Tika / LiteParse | 通用格式 / PDF 页级解析与 OCR | PDF LiteParse，非 PDF Tika | LiteParse 不可用时可设计显式回退 | 结构差异与页码丢失 |
| 固定字符 / 语义分块 | 实现简单 / 保护边界 | 语义边界 + 字符兜底 | 无语言工具或严格字节限制 | 语言依赖与分块不稳定 |
| 离线 Overlap / 查询邻块 | 永久补上下文 / 按需补上下文 | 只实现离线 Overlap | 重复高、边界缺失时考虑邻块 | 存储重复 / 查询复杂与权限风险 |
| 小 Chunk / 大 Chunk | 精确定位 / 完整上下文 | 参数折中，无最优结论 | 由固定评测决定 | 断义 / 噪声与 Token |
| 当前请求 / 独立双路 | 单请求混合 / 各保留独有候选 | 当前单请求简单但权限有缺口 | 词法或语义独有结果常漏 | 双路延迟、去重、超时 |
| Rescore / RRF | 同候选重排 / 榜单融合 | 当前 BM25 Rescore | 两路分数不可比时用 RRF | Rescore 补不回漏召；RRF 忽略分差 |
| BM25 / Cross-Encoder 重排 | 词面相关 / 语义联合判断 | 当前 BM25 成本低 | 已召回但排序差时上 CE | CE 延迟、模型与降级成本 |
| 权限预过滤 / 召回后裁剪 | 防泄漏 / 实现方便 | 意图应预过滤，当前 KNN 未做到 | 不应为性能改成后裁剪 | 后裁剪泄漏且 Top-K 不足 |
| 混合 / 文本降级 | 语义+词法 / 保底可用 | 异常走文本 | 无 Embedding 或低成本场景 | 质量漂移且故障/空结果混淆 |
| WebSocket / SSE / HTTP | 双向流 / 单向流 / 请求响应 | WebSocket 支持 stop 与多事件 | 单向生成可用 SSE，短答用 HTTP | 连接治理 / 控制通道 / 无流式 |
| 固定 RAG / ReAct | 每问固定检索 / 模型按需工具 | 当前限轮 ReAct | 强可控低延迟场景用固定 RAG | ReAct 成本、循环和副作用 |
| 证据 / 映射 / 忠实性 | 找对片段 / 编号指对 / 陈述受支持 | 当前前两层有机制，第三层未保证 | 评测始终三层分开 | 伪引用与过度信任 |
| Redis 上下文 / MySQL 历史 | 在线低延迟 / 持久恢复展示 | 两者并存，不自动重建 | 强连续性需历史摘要/回填 | 漂移、过期与成本 |
| 停止 / 取消 / 超时 / 失败 | UI意图 / 终止订阅 / 时间预算 / 异常终态 | Stop→CANCELLED，其他分开 | 多实例需共享协调 | 迟到回调与副作用不回滚 |
| 单机 / 多实例 | 简单内存状态 / 扩容容灾 | 当前活动流依赖单 JVM | 并发或容灾要求提高时扩展 | 路由、共享状态、连接迁移 |
| 当前测试 / 完整 RAG 评测 | 局部逻辑 / 端到端质量 | 当前以 Mockito/分块测试为主 | 比较检索方案前必须建评测集 | 标注、环境、回放与隐私成本 |

## 四、P2 与 REF 使用规则

- **P2-基础：**Kafka 交付语义、Redis Bitmap、MinIO 对象模型、Tika/LiteParse/OCR、Embedding/HNSW、BM25、WebSocket/SSE、JWT/RBAC、Spring Reactor/线程池、配额限流与支付状态。只补概念，不新增正式 Baize 主问题。
- **REF-查阅：**类/方法、Redis Key、表字段、Topic/DLT、2048 维 Mapping、`topK*30`、0.2/1.0 权重、TTL、前端组件与测试类。参数变更时查源码，不靠背旧卡。

## 相关链接

- [[Baize-01-项目主卡]] — 五条核心链路、模块答题模板与复习顺序
- [[Baize-03-证据与事实边界]] — 真实 Failure Case、测试结果和证据等级
- [[Baize-03-证据与事实边界]] — P0/P1 数量与事实边界
