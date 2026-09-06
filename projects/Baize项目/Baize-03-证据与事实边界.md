---
module: Baize
type: project
status: current
tags: [Baize, PaiSmart, 简历验收, 技术核对, RAG, Agent]
last_reviewed: 2026-09-05
---

# Baize 证据与事实边界

> [!warning] 审计结论
> 旧卡把检索描述成“受 keyword 和 permission 约束的 KNN 候选”，但源码是在同一次 ES 请求中并列提交顶层 KNN 与带权限的 Query 分支。权限 Filter 未进入 `knn.filter`，因此旧简历口径为 `risky fit`。本轮已将正式表述收紧为“检索与权限审计”；在 Demo、链路复现、源码分析和局部测试边界内为 `strong fit`。

## 一、本轮实际审计范围

### 统一材料与整个 Baize 目录

- 完整读取 `RESUME.md`、`PROJECT-INTERVIEW-DOC-STANDARD.md`、`PROJECT-REVIEW-INDEX.md`、`INTERVIEWER-PROMPT.md`、Obsidian `AGENTS.md`。
- 扫描并读取 `projects/Baize项目/` 全部 Markdown：三张核心卡以及架构、RAG、上传、检索、聊天、上下文、Prompt、模型、权限、数据库、接口、配额限流、管理、支付、扩展与历史速记材料。
- 旧 README、旧速记和专题文档只作线索；凡与当前简历或源码冲突，以当前简历和源码为准。

### PaiSmart 仓库与关键入口

- 完整扫描仓库文件清单，并读取仓库 `AGENTS.md`、`CLAUDE.md`、Maven/前端清单、配置层级和 Compose 服务定义。
- **启动/配置/部署：**`SmartPaiApplication`、`SecurityConfig`、`JwtAuthenticationFilter`、`OrgTagAuthorizationFilter`、四套 `application*.yml`、`docs/docker-compose.yaml`。
- **上传/存储：**`UploadController`、`UploadService`、`DocumentController`、`DocumentService`、`FileUploadRepository`、`ChunkInfoRepository`。
- **消息/解析/索引：**`KafkaConfig`、`FileProcessingConsumer`、`ParseService`、LiteParse/OCR 适配、`VectorizationService`、`ElasticsearchService`、`EsIndexInitializer`、`knowledge_base.json`、`EsDocument`。
- **检索/权限：**`HybridSearchService`、`OrgTagCacheService`、`UserService`、用户/组织/文件 Repository。
- **Agent/会话/引用：**`AgentToolRegistry`、`ChatHandler`、`LlmProviderRouter`、`ChatGenerationStateService`、`ChatWebSocketHandler`、`ConversationService` 及 Controller/Repository/Model。
- **完整项目 P2/REF：**Provider 配置与路由、配额与限流、反馈、充值/支付、管理后台、邀请注册与用户管理。
- **前端：**知识库上传页、Chat 输入与 WebSocket 状态、会话侧栏、消息引用渲染、引用预览页及 TypeScript API 类型。
- **测试：**全量扫描 `src/test`；核对 Maven 未默认 skip、外部依赖、Mock 范围、日志型性能测试与前端脚本。

> [!note] 敏感配置
> 本卡只记录配置来源、优先级、缺失风险和部署依赖，不复制 `.env`、数据库口令、JWT、模型、OCR 或支付凭证。

## 二、当前简历逐 Bullet 核对

### 项目定位

> **Baize 企业知识库 RAG 技术验证项目 | 实习自主选题 Demo**
>
> 采用 AI Coding Agent 辅助完成企业文档问答 RAG 技术验证方案的拆解、链路复现与源码分析，覆盖离线文档入库、在线检索、Agent 问答及来源引用链路。

- **支持程度：**源码覆盖完整链路；个人口径明确是自主选题、复现和分析。
- **禁止升级：**不能说企业正式交付、大规模上线、全部上游能力原创或已有生产指标。

### Bullet 1：异步文档入库

> 梳理文件分片上传与 MinIO 合并链路，通过 Kafka 解耦解析和向量化任务；使用 Tika / LiteParse 提取文本，按段落与句子边界分块、合并过小片段并添加语义 Overlap，携带文件、页码和权限元数据写入 Elasticsearch。

| 声明 | 证据 | 边界 |
| --- | --- | --- |
| 分片与合并 | Redis Bitmap、MySQL file/chunk、MinIO chunk/merged、merge CAS | 三方无全局事务；对象/Chunk 键主要按 MD5 |
| Kafka 解耦 | 合并后事务 Producer、Consumer、ErrorHandler/DLT | 投递不与 DB/MinIO 原子；消费不幂等 |
| Tika/LiteParse | PDF 文件头选择 LiteParse，非 PDF Tika | LiteParse 失败不回退 Tika；OCR 是可选适配 |
| 语义分块 | 段落/句子/HanLP/字符、小块合并、上一块尾部 Overlap | 是离线 Overlap，不是查询邻块 |
| ES 元数据 | fileMd5/chunkId/page/anchor/model/user/org/public | Mapping/维度/模型版本有漂移风险 |

**结论：**`strong evidence`，但面试必须主动讲消费和索引幂等缺口。

### Bullet 2：检索与权限审计

> 分析单次 Elasticsearch 请求中顶层 KNN、带关键词和 `userId / public / orgTag` 权限 Filter 的 Query 分支及 BM25 Rescore，识别权限条件未下推 KNN 的隔离风险，并梳理 Embedding、混合查询与纯文本查询的分级降级边界。

| 声明 | 证据 | 边界 |
| --- | --- | --- |
| Query Embedding | `embedToVectorList` | 失败返回 `null` 后文本降级 |
| 单次 ES 混合 | 顶层 `knn`、顶层 `query`、`rescore` | 是并列混合，不是顺序约束，也不是 RRF |
| Query 权限 | 本人 OR public OR 有效 orgTag | 没有进入 KNN Filter，存在高风险缺口 |
| BM25 Rescore | `AND`、窗口 `topK*30`、权重 0.2/1.0 | 参数未由保存的评测报告证明最优 |
| 分级降级 | Embedding 失败；混合异常；文本异常/空结果 | 文本异常与真正空结果最终都为空列表 |

**结论：**原“权限感知检索已正确前置”不成立；改为源码审计结论后是 `strong evidence`。

### Bullet 3：Agent 引用问答

> 复现基于 WebSocket 的限轮次 ReAct 问答流程，模型按需调用 `search_knowledge`，将文件、Chunk、页码和分数作为证据回填上下文，并维护引用编号映射与生成任务的流式、完成、取消和失败状态。

| 声明 | 证据 | 边界 |
| --- | --- | --- |
| ReAct | 4 个常规轮、8 次 Tool Call、一次禁用工具收尾 | Tool 无通用幂等，空检索不硬拒答 |
| Tool Result | 文件名/fileMd5/chunkId/page/score/正文 | 正文有截断；多次搜索编号重置 |
| 引用恢复 | Redis generation + MySQL `reference_mappings_json` + 前端优先持久化映射 | generation API 受 30 分钟 TTL 限制 |
| Generation | `STREAMING/COMPLETED/CANCELLED/FAILED` | 没有 `RUNNING/STOPPED`，终态无显式 CAS |
| 停止 | 取消标记、Redis 状态、dispose、Future、WS 通知 | 断开 WS 不自动取消，副作用不回滚 |

**结论：**当前收紧后的状态名称与持久化口径有源码支持；不能声称引用天然保证忠实。

## 三、三张旧核心卡审计

| 类别 | 旧卡问题 | 本轮处理 |
| --- | --- | --- |
| 内容缺失 | 缺三方上传状态、merge/Kafka 窗口、DLT 恢复、PDF 路由、五条核心链、会话恢复和完整 Failure Case | 主卡补全链路，追问卡补输入/输出/状态/失败/验证，证据卡补 12 个案例 |
| 重复 | 主卡和追问卡反复讲 RRF/Cross-Encoder，却没有等量展开当前失败与状态 | 优化只保留在 P1，对当前代码链路优先分配篇幅 |
| 偏离简历 | 旧卡把评测实现和双路改造当核心闭环，挤压三条 Bullet 的直接复习 | P0 严格映射三条当前 Bullet，P1 只做一跳 |
| 技术不准确 | 把顶层 KNN/Query 描述为“KNN 候选 + keyword/permission”；把权限说成已前置；状态写“停止/取消”但未给真实枚举 | 改为并列混合结构，显式报告 KNN 权限风险，使用四个真实状态 |
| 当前/优化混淆 | 将 RRF、Cross-Encoder、查询邻块和“防迟到完成”写得像当前完成能力 | 全部标为优化；当前只保留 BM25 Rescore、离线 Overlap 和现有取消动作 |
| 证据不足 | “验证降级”“strong fit”“避免迟到回调”等表述超出测试和代码保证 | 改成“梳理/审计”，Fit 解释原风险与收紧条件，测试结果单列 |
| 历史过期 | 旧材料还有 1024 维、RRF/CE 已实现、MinerU/VLM 路由、固定 RAGAS/QPS/P95/规模等 | 当前确认 2048 维；其余降为历史线索或方案，不进入成果 |

## 四、真实 Failure Case 与限制

> 以下是源码分支、已运行单测或架构直接推导的风险，不冒充真实线上事故。

### FC-01 顶层 KNN 未带权限 Filter

- **现象：**用户可能收到只属于其他租户、但向量相似的 Chunk。
- **根因：**权限 Bool 只在顶层 Query 分支，顶层 KNN 是并列分支而非受其约束。
- **当前处理：**Query 分支和纯文本降级带 `userId OR public OR orgTag`；KNN 分支没有同等保护。
- **如何定位：**记录原始 ES DSL、身份和 Top-K，检查命中文档 owner/org/public。
- **如何验证：**两个用户各建私有文档，用语义相近、词面错开的 Query 做负向越权测试。
- **残余风险：**Chunk 文本一旦进入 Tool/Prompt，即使应用层后裁剪也可能已经泄漏；当前没有后置兜底。
- **重新设计：**把权限 Bool 放入 `knn.filter`；若拆双路，两路均预过滤并在 Tool 输出前二次授权。

### FC-02 合并成功但 Kafka 投递失败

- **现象：**MinIO 合并对象和 `COMPLETED` 上传状态存在，但文档长期不可检索；重复 merge 仍返回成功。
- **根因：**合并、MySQL 状态和 Kafka 事务不在同一原子边界，已完成分支不会补发任务。
- **当前处理：**异常返回给本次 merge 请求；有异步重试入口，但没有自动 Outbox 扫描。
- **如何定位：**按 fileMd5 对照上传/向量化状态、合并对象、Producer 日志和 Topic 消息。
- **如何验证：**合并成功后让 Kafka send 失败，再重试 merge，确认是否补发。
- **残余风险：**任务丢失窗口依赖人工发现，状态可能停在 PROCESSING。
- **重新设计：**数据库 Outbox 与文件状态同事务提交，由 Relay 重试投递，并提供可审计重放入口。

### FC-03 Kafka 重复消费导致重复 Chunk 与 ES 文档

- **现象：**同一文件的 MySQL Chunk 和 ES 命中重复，检索上下文出现重复证据。
- **根因：**无任务去重；解析追加记录，ES ID 使用随机 UUID，重放不能覆盖。
- **当前处理：**Producer 幂等、Consumer 重试和 DLT 只控制消息交付，不消除业务重复。
- **如何定位：**按 fileMd5/chunkId/text hash 统计 DB/ES 重复并关联 Consumer 日志。
- **如何验证：**向 Topic 发送两份相同 `FileProcessingTask`，比较处理前后计数。
- **残余风险：**重复索引改变排序、成本和引用编号，删除/重建也可能扩大影响。
- **重新设计：**任务唯一键 + 阶段状态；Chunk/ES 使用 `fileMd5:fileVersion:chunkId:modelVersion` 确定性 ID upsert。

### FC-04 解析或 Bulk 部分成功后重试放大残留

- **现象：**第一次执行已写部分 MySQL/ES，随后失败；重试追加全套数据，最终出现新旧混合。
- **根因：**普通上传重试前不清理，ES Bulk `errors=true` 时已成功项不回滚。
- **当前处理：**任务标 `FAILED` 并交 ErrorHandler 重试，耗尽进 DLT；没有补偿清单。
- **如何定位：**对照 Chunk 数、Bulk item 错误、ES fileMd5 计数和向量化状态时间线。
- **如何验证：**在解析写入后、Embedding 批次中和 Bulk 部分项处分别注入失败。
- **残余风险：**状态可能最终 COMPLETED，但底层仍保留重复或版本不一致文档。
- **重新设计：**临时版本索引/阶段表，全部成功后发布；失败按版本清理，重试使用幂等 ID。

### FC-05 LiteParse 空页导致 0 Chunk 完成

- **现象：**上传 PDF 显示向量化完成，但搜索永远无结果。
- **根因：**空页被跳过；全部为空时 `VectorizationService` 对空 Chunk 返回 0 用量，不抛错。
- **当前处理：**有空页日志和 0 Chunk 结果，但完成状态仍可被写入。
- **如何定位：**检查 LiteParse 页结果、DocumentVector 数和 `actualChunkCount=0`。
- **如何验证：**用空白、扫描但 OCR 关闭、解析服务返回全空页的 PDF。
- **残余风险：**用户无法区分“处理成功但无内容”和“解析失败”。
- **重新设计：**将 0 Chunk 视为独立 `EMPTY_CONTENT` 或失败状态，给出 OCR/格式建议和可重试动作。

### FC-06 Embedding、混合与文本失败最终伪装成空结果

- **现象：**用户看到“没有相关知识”，实际可能是 Embedding/ES 故障或真正无命中。
- **根因：**文本搜索内部 catch 返回空列表，外层无法区分异常与零命中。
- **当前处理：**日志记录错误；成功结果通过 `HYBRID/TEXT_ONLY` 标记模式。
- **如何定位：**关联 Embedding、混合 ES、文本 ES 三处日志与 Tool 返回。
- **如何验证：**分别 mock 三处异常，再运行真实零命中基线。
- **残余风险：**错误提示、拒答和降级率监控不准确，模型仍可能无证据作答。
- **重新设计：**返回结构化 `SearchOutcome`，传播 mode、failureStage、degradedReason 和 emptyReason。

### FC-07 多次 `search_knowledge` 覆盖引用编号

- **现象：**回答里的 `[1]` 指向第二次检索结果，而模型原本引用第一次检索的 `[1]`。
- **根因：**每次 Tool Result 从 `[1]` 重新编号，generation 引用映射使用覆盖语义。
- **当前处理：**最终只保留最新一次搜索映射；没有跨轮全局编号命名空间。
- **如何定位：**保存每轮 Tool Result、tool_call_id、最终文本与 generation/MySQL 映射并逐一对照。
- **如何验证：**诱导模型连续搜索两个不同主题并在最终答案同时引用两轮证据。
- **残余风险：**错误映射可形成“看似有引用”的伪证据，历史持久化会固化错位。
- **重新设计：**按 generation 递增全局引用号，或将引用绑定 `tool_call_id + localNumber`，持久化所有搜索集合。

### FC-08 WebSocket 断开与取消迟到竞态

- **现象：**页面关闭后模型仍消耗资源；用户 Stop 后迟到回调仍可能竞争写终态或内容。
- **根因：**WebSocket `afterConnectionClosed` 只注销 Session；状态更新没有显式终态 CAS，活动流/回调跨线程。
- **当前处理：**显式 Stop 设置取消标记、写 `CANCELLED`、dispose 订阅、完成 Future 并通知前端。
- **如何定位：**按 generationId 追踪 WS、Stream、Future、Redis 状态、内容长度与 Provider Usage。
- **如何验证：**生成中断网、不发 Stop；Stop 同时触发上游完成/异常，重复查询状态。
- **残余风险：**已执行 Tool 副作用不回滚，多实例上内存 Stream 更难定位。
- **重新设计：**连接断开策略可配置自动取消；终态 compare-and-set；Provider 层传播取消；副作用工具使用幂等键。

### FC-09 Redis 短期上下文与 MySQL 历史漂移

- **现象：**历史页面仍显示旧问答和引用，但下一轮模型像“失忆”；或 MySQL 有记录而 Redis 缺最新轮。
- **根因：**Redis 过期/重启不从 MySQL 重建；写入顺序是 MySQL 后 Redis，两者没有同一事务。
- **当前处理：**MySQL 失败提示 persistence degraded 并跳过 Redis；Redis 失败只记日志，历史仍可展示。
- **如何定位：**比较 conversationId 下 MySQL 问答、Redis history 长度/TTL 与实际 ReAct messages。
- **如何验证：**完成一轮后删除/过期 Redis，再继续同会话；分别注入 MySQL 与 Redis 写失败。
- **残余风险：**页面恢复和模型上下文恢复语义不同，用户容易误以为完整续聊。
- **重新设计：**Redis miss 时从 MySQL 最近轮/摘要回填，带上下文版本并对双写失败告警。

### FC-10 MD5 全局资源键与删除范围跨用户

- **现象：**两个用户上传相同内容后，一个用户删除自己的记录，可能删除共享 MinIO 对象、ES 文档、Chunk 元数据和全部同 MD5 文件记录。
- **根因：**Redis Key 含 userId，但 MinIO、`chunk_info`、DocumentVector 和 ES 删除主要按 fileMd5；`DocumentService.deleteDocument` 最终调用全局 `deleteByFileMd5`。
- **当前处理：**Controller/Service 先按 `fileMd5 + userId` 找到本人记录，但后续资源清理范围扩大为 fileMd5。
- **如何定位：**按同一 MD5 查询多用户 `file_upload`，观察删除前后 DB/MinIO/ES 全部对象。
- **如何验证：**两个用户上传相同字节但权限不同，再由其中一人删除。
- **残余风险：**数据丢失和跨租户影响，属于高风险安全/完整性问题。
- **重新设计：**对象和 Chunk 键加入 tenant/fileUploadId，或明确内容寻址的引用计数；删除只释放本人引用，最后引用才回收共享内容。

### FC-11 会话历史与会话操作缺少归属校验

- **现象：**已认证用户若获得他人的 conversationId，可能读取消息或切换、归档、取消归档他人会话。
- **根因：**Controller 只验证 Token 有用户，Service 按 conversationId 查询/更新，没有绑定当前 userId。
- **当前处理：**会话列表按 userId 过滤，但详情和三个操作接口未复用该归属条件。
- **如何定位：**检查 Controller 入参和 Repository 查询，审计 conversationId 是否可枚举/泄露。
- **如何验证：**用户 A 创建会话，用户 B 带合法 Token 请求 A 的详情与状态操作。
- **残余风险：**跨用户历史泄露与状态篡改；这是高风险原有问题，本轮不擅自改源码。
- **重新设计：**Repository 使用 `conversationId + userId`；管理员显式走独立审计接口；统一资源归属授权函数。

### FC-12 Mapping、维度与模型版本漂移

- **现象：**Embedding 写入报维度错误、查询向量不兼容，或新旧模型向量混在同一索引中排序失真。
- **根因：**当前 Mapping `dims=2048`，Initializer 仅在索引不存在时创建；文档虽存 `modelVersion`，查询不按版本过滤。Java/Jackson 的 `isPublic` 与查询字段 `public` 还存在命名漂移风险。
- **当前处理：**启动诊断能提示维度问题，但不会迁移/校验既有索引；动态 Mapping 可能掩盖字段差异。
- **如何定位：**检查实际 Mapping、Embedding 输出维度、索引文档字段与 modelVersion 分布。
- **如何验证：**保留旧索引切换 Provider/维度，再执行写入和 Query；关闭动态 Mapping 重建对照。
- **残余风险：**静默混用模型比直接报错更难发现，权限字段漂移还可能影响过滤。
- **重新设计：**版本化索引 + Alias 切换，启动前验证维度/字段，Query 绑定模型版本，全量重嵌入后再发布。

## 五、配置、部署和非简历模块

| 范围 | 当前位置 | 事实边界 |
| --- | --- | --- |
| 基础配置 | `application.yml` + profile + 环境变量 | 环境变量覆盖默认；生产缺失必需项会失败，不记录值 |
| 动态 Provider | 配置文件默认 + MySQL Provider 配置 + Router | 支持 Chat/Embedding scope 与连通测试；不等于自动故障转移 |
| Compose | MySQL、Redis、Kafka、ES、MinIO | LiteParse/OCR/模型等仍是外部依赖；当前是单机开发组合 |
| 用户与组织 | JWT/RBAC、私人/默认组织、父标签缓存 | 管理员管理能力存在，但检索没有管理员旁路 |
| 配额与限流 | Redis Token 预留/结算、请求窗口、后台动态配置 | 属 P2/REF，不进入简历 P0 |
| 反馈/后台 | Tool、统计、用户/知识库/Provider/限流管理 | 完整系统的一部分，不冒充 RAG 核心成果 |
| 充值/支付 | 套餐、订单、回调和管理入口 | 只理解系统位置；配置和结果不进入求职成果 |

## 六、测试与运行证据

### 本轮实际执行

```text
mvn -Dtest=UploadServiceTest,UploadControllerTest,ParseServiceUnitTest,
LiteParseOcrAdapterServiceTest,ConversationServiceTest,UserServiceTest,
UsageQuotaServiceTest,RateLimitConfigServiceTest,ModelProviderConfigServiceTest test
```

- Maven 没有默认跳过测试；实际执行 49 个用例，47 通过、2 失败、0 skipped，构建失败。
- 通过范围包括局部上传 Controller、解析/分块/OCR 适配、会话、用户、配额限流和 Provider 配置等 Mockito/单元逻辑。
- 两个失败都在 `UploadServiceTest`：旧断言假设 Redis 命中可跳过 DB/MinIO、DB 命中可不访问 MinIO；当前代码为防失效状态会交叉检查三方。归类为测试预期落后于当前实现，不是本轮文档修改引入，也不修改源码/测试掩盖。
- 未启动 MySQL、Redis、ES、Kafka、MinIO、LiteParse、OCR 或模型服务，不能声称真实中间件联调通过。

### 明确测试缺口

- 没有 HybridSearch DSL/权限隔离/三级降级的直接测试。
- 没有 Kafka Consumer 重复、部分成功、重试/DLT 恢复测试。
- 没有 AgentToolRegistry、ReAct 多轮、引用覆盖、Generation 竞态和 WebSocket 断链测试。
- 没有 MySQL 引用历史与 Redis 上下文联合恢复集成测试。
- 前端没有 `test` 脚本；Playwright 需要运行中的页面，本轮不启动服务。前端只适合另做 typecheck/build 静态验证。
- 本轮尝试 `pnpm typecheck` 时本机无可用 `pnpm`，仓库也没有已安装的 `vue-tsc`；未安装依赖，因此前端静态检查记为“未执行”，不是通过。
- `UploadServicePerformanceTest` 主要输出理论网络延迟对比，不是保存的真实压测基线，本轮未运行。

## 七、当前实现与优化建议

| 当前事实 | 可选优化 | 声明门槛 |
| --- | --- | --- |
| 顶层 KNN 与 Query 并列，KNN 未过滤 | `knn.filter`，两路均过滤，Tool 前二次授权 | 越权负例测试通过 |
| BM25 Rescore | 独立双路 + RRF；Top-N Cross-Encoder | 固定集 before/after、延迟和原始结果 |
| 离线语义 Overlap | 查询邻块、父子块 | 稳定邻接/权限/版本和重复率验证 |
| 随机 UUID 索引 | 确定性 ID、版本索引与 Alias | 重放、部分失败和切换测试 |
| Kafka 重试 + DLT | Outbox、消费状态机、DLT 重放 | 故障注入与恢复记录 |
| JVM Generation 状态 | 终态 CAS、共享取消与多实例路由 | 跨实例 Stop/迟到回调测试 |
| 日志和模式标签 | Top-K Dump、降级原因、关联 ID、指标告警 | 脱敏、保留周期与回放命令 |

## 八、结果声明门槛

- 当前没有可引用的 Recall、NDCG、MRR、RAGAS、QPS、P95、用户规模、Token 降幅或生产效果报告。
- 测试代码存在不等于运行通过；Mock 通过不等于真实 ES/Kafka/MinIO 联调通过。
- RRF、Cross-Encoder、独立双路、动态 Top-K、查询邻块、Outbox、索引版本化均是建议，不是当前能力。
- `knowledge_base.json` 当前为 2048 维；`EsDocument` 注释中的 768 和旧材料的 1024 都不能覆盖实际 Mapping。
- “有证据片段”“引用编号正确”“答案忠实”必须逐层报告，不能用一个引用图标概括。
- Fit 的强度来自事实边界清楚、链路能展开和风险能验证，不来自虚构指标或把缺陷包装成成果。

## 九、面试前机械核对

- [ ] 逐字解释当前三条 Bullet，P0 仅 8 个、P1 仅 4 个。
- [ ] 说清当前是并列顶层 KNN/Query + BM25 Rescore，不是两路 RRF。
- [ ] 说清 KNN 权限 Filter 缺失是当前风险，不声称权限前置已完成。
- [ ] 区分上传、消费、索引和 Tool Call 幂等。
- [ ] 区分 LiteParse/Tika 路由、离线 Overlap/查询邻块、BM25/Cross-Encoder。
- [ ] 使用 `STREAMING/COMPLETED/CANCELLED/FAILED`，区分 Stop、断链、上游取消与副作用回滚。
- [ ] 区分 Redis 短期上下文、Redis generation 快照和 MySQL 持久历史。
- [ ] 区分证据命中、引用映射和答案忠实。
- [ ] 测试只报告 49 执行、47 通过、2 个旧断言失败及集成缺口。
- [ ] 不背诵旧指标、规模、1024 维、RRF/CE 已实现或生产上线口径。

## 相关链接

- [[Baize-01-项目主卡]] — 五条核心链路和知识目录
- [[Baize-02-高频追问卡]] — 8 个 P0、4 个 P1 与技术对比
- [[Baize-02-高频追问卡]] — 完整学习、问题范围和事实边界
- [[文件上传机制]]、[[混合搜索与检索]]、[[聊天助手模块]] — 历史专题，仅作 REF
