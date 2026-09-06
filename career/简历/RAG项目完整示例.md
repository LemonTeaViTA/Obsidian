---
module: 简历
tags: [简历, RAG, Agent, 项目经历, Java后端, 测试, 运维]
difficulty: medium
last_reviewed: 2026-06-12
---

# RAG 项目完整示例

> RAG / Agent 方向项目的**完整简历段落示例**，包含后端开发 / 测试 / 运维三个方向共 7 个项目。每个项目都是"项目名+时间+技术栈+简介+职责"的完整格式，可以挑最接近的直接套用改写。
>
> 如果需要**按技术点精雕细琢某个 bullet**，见 [[RAG项目简历范例]]（素材库按流式对话/双引擎检索/Kafka 异步等归类）。

> [!warning] 示例数据声明
> 本文中的项目名称、时间、角色、指标和技术栈均为写作示例或占位素材，不代表个人真实经历、生产结果或已验证性能。写入简历前必须替换为本人有证据支持的事实。

> [!tip] 速览（一分钟读完）
> - **后端方向 5 个**：PaiSmart 知识库 / Agentic RAG 研究助手 / Tiny-RAG / GitSeek / RAG 问答助手
> - **测试方向 1 个**：智能 RAG 知识库管理系统（测试工程师视角）
> - **运维方向 1 个**：RAG 智能报价系统（K8s + Prometheus）
> - **本文是完整段落**，配合 [[RAG项目简历范例]]（bullet 素材库）+ [[简历写法指南]]（写法规范）使用
> - 所有示例仅供参考改写，**写进简历的必须是自己真做过的项目**

---

## 后端开发方向

### 项目 1：PaiSmart RAG 知识库（Java 后端）

**项目名称**：派聪明 RAG 知识库  
**时间**：2025-06 ～ 2025-09  
**角色**：Java 后端开发  
**技术栈**：Spring Boot、MyBatis-Plus、Redis、RocketMQ、Milvus、Spring AI、GPT-4o、智谱 GLM-4、通义千问、WebSocket、MinIO、线程池

**项目简介**：

为 Java 学习社区构建的企业级 RAG 知识库系统，整合官方文档、教程、社区问答等多源数据，支持上下文感知的智能问答与代码生成，月活用户 2000+。

**技术职责**：

1. **流式对话与上下文管理**：基于 WebSocket + SSE 实现流式输出，优化首字响应时间至 200ms；引入 Redis 存储 5 轮上下文（每轮 max 1500 tokens），配合 Spring AI 的 Memory 机制保证对话连贯性。
2. **双引擎检索**：Spring AI 调用 OpenAI Embedding API 生成向量存储至 Milvus，实现语义检索（召回率 85%）；关键词检索通过 MyBatis-Plus 查询 MySQL 标题/标签（精确率 92%）；BM25 算法融合两路结果（α=0.7），Top-5 准确率 89%。
3. **异步知识库更新**：RocketMQ 订阅文档变更事件，消费者线程池（核心 8 / 最大 16）并发处理文档切片（500 字 + 100 字重叠）、向量化与入库，处理延迟 < 2s，峰值 QPS 120。
4. **文件分片上传**：前端 spark-md5 计算文件哈希，后端 Spring Boot 接收分片后合并，通过 MinIO SDK 上传至对象存储；支持断点续传与秒传（哈希命中率 15%），单文件上限 500MB。
5. **多模型路由**：封装统一 LLM Gateway，根据 prompt token 数动态路由（< 4k → 智谱 GLM-4-Flash，≥ 4k → GPT-4o），降低 API 成本 40%；集成 Spring Retry 实现模型降级（主模型超时 5s 后切换备用）。
6. **缓存优化**：高频查询结果（如"Spring Boot 启动流程"）缓存至 Redis（TTL 1 小时），缓存命中率 62%；用户会话数据序列化后存入 Redis Hash，会话恢复时间 < 50ms。
7. **单元测试与性能优化**：JUnit + Mockito 测试覆盖率 75%；JMeter 压测 500 并发，优化线程池配置与 Redis 连接池后，P99 响应时间从 800ms 降至 350ms。

---

### 项目 2：Agentic RAG 学术研究助手

**项目名称**：Agentic RAG 学术研究助手  
**时间**：2026.02 – 2026.04  
**角色**：Java 后端开发  
**技术栈**：Spring Boot、Spring AI、LangChain4j、Tavily API、arXiv API、Redis、Elasticsearch、PostgreSQL、Docker Compose

**项目简介**：

基于 Agent 架构的学术文献检索与分析系统，集成多源文献库（arXiv / PubMed / Google Scholar），支持自动化文献综述生成、引用关系分析与研究趋势预测。

**技术职责**：

1. **Agent 编排与规划**：LangChain4j 构建 ReAct Agent，ReAct 循环执行"Thought → Action → Observation"（最大迭代 5 轮），自动调用 Tavily 搜索 / arXiv API / 向量检索 / 引用分析 4 个 Tool，平均 3.2 轮完成复杂查询（如"总结 2024 年 Transformer 改进工作"）。
2. **工具层封装**：Spring AI 集成 Function Calling，通过 `@Tool` 注解暴露 4 个工具供 Agent 调用，工具识别准确率 94%；Tavily API 返回网页摘要（max 5 条），arXiv API 拉取论文元信息与 PDF，向量检索从 Elasticsearch 召回相似文献（Top-10）。
3. **文献向量化与检索**：Sentence-Transformers 模型（all-MiniLM-L6-v2）生成 384 维向量存储至 Elasticsearch，支持 ANN 检索（HNSW 索引），召回延迟 < 100ms；PostgreSQL 存储论文元信息（标题 / 作者 / 引用次数），配合向量检索实现混合排序（BM25 + 余弦相似度，α=0.6）。
4. **引用关系分析**：爬取论文 References 字段构建引用图谱（Neo4j 图数据库），Cypher 查询 2 跳引用链，PageRank 算法计算核心文献（Top-20），可视化展示（ECharts 力导向图）。
5. **缓存与限流**：Redis 缓存高频查询（如"机器学习综述"）TTL 24 小时，命中率 55%；Guava RateLimiter 限流 Tavily API 调用（5 req/s），避免超额扣费。
6. **Docker 部署**：Docker Compose 编排 Spring Boot / Redis / Elasticsearch / PostgreSQL / Neo4j 5 个容器，单机部署支持 50 并发，P95 响应时间 1.8s。

---

### 项目 3：Tiny-RAG（轻量级 RAG 框架）

**项目名称**：Tiny-RAG  
**时间**：2025.10 - 2025.12  
**角色**：Java 后端开发  
**技术栈**：Spring Boot、OpenAI API、Milvus、Sentence-Transformers、Markdown 解析、缓存

**项目简介**：

轻量级 RAG 框架，支持 Markdown 文档快速接入与智能问答，适合个人知识库与小型团队文档管理。

**技术职责**：

1. 实现 Markdown 文档解析与切片（按章节 + 500 字窗口），OpenAI Embedding API 生成向量存储至 Milvus，检索召回 Top-5 后拼接 Prompt 调用 GPT-3.5 生成答案。
2. 引入 Redis 缓存高频问答（TTL 1 小时），缓存命中率 40%，降低 API 成本 30%。
3. 支持增量更新：监听文件变更（WatchService），仅重新向量化变更章节，更新延迟 < 3s。

---

### 项目 4：GitSeek（代码语义搜索引擎）

**项目名称**：GitSeek  
**时间**：2025.08 - 2025.10  
**角色**：Java 后端开发  
**技术栈**：Spring Boot、CodeBERT、Elasticsearch、GitHub API、Redis、线程池

**项目简介**：

基于代码语义理解的 GitHub 仓库搜索引擎，支持自然语言查询（如"实现 LRU 缓存的 Java 代码"）返回相关代码片段与仓库。

**技术职责**：

1. 集成 CodeBERT 模型（Hugging Face Transformers Java API）生成代码向量（768 维），存储至 Elasticsearch，ANN 检索召回 Top-10 代码片段，召回延迟 < 150ms。
2. GitHub API 增量爬取热门仓库代码（Stars > 1000），线程池（核心 10 / 最大 20）并发处理代码解析与向量化，峰值处理 200 文件/分钟。
3. Redis 缓存热门查询结果（如"快速排序实现"）TTL 6 小时，命中率 50%。

---

### 项目 5：基于 RAG 的问答助手

**项目名称**：基于 RAG 的问答助手  
**时间**：2025.08 - 2025.11  
**角色**：后端开发  
**技术栈**：Spring Boot、MyBatis-Plus、Redis、MySQL、OpenAI API、Milvus、WebSocket、MinIO

**项目简介**：

企业内部知识库问答系统，整合公司文档、邮件、Wiki 等数据源，支持自然语言查询与流式对话。

**技术职责**：

1. **双引擎检索**：向量检索（Milvus + OpenAI Embedding）召回语义相关文档 Top-5，关键词检索（MySQL 全文索引）召回精确匹配 Top-3，BM25 融合排序（α=0.65），Top-5 准确率 87%。
2. **流式对话**：WebSocket 实现流式输出，首字响应 < 300ms；Redis 存储 5 轮上下文（每轮 max 2000 tokens），Session 过期时间 30 分钟。
3. **文件分片上传**：前端 spark-md5 计算文件哈希，后端接收分片合并后上传 MinIO，支持断点续传与秒传（哈希命中率 12%），单文件上限 1GB。
4. **异步知识库更新**：监听文档变更事件（Spring Event），线程池异步处理文档切片、向量化与入库，处理延迟 < 3s。
5. **缓存优化**：高频查询结果缓存至 Redis（TTL 2 小时），缓存命中率 58%；用户会话数据序列化后存入 Redis Hash，会话恢复时间 < 80ms。

---

## 测试工程师方向

### 项目 6：智能 RAG 知识库管理系统（测试视角）

**项目名称**：智能 RAG 知识库管理系统  
**时间**：2025.06 - 至今  
**角色**：测试工程师  
**技术栈**：JUnit、Mockito、Selenium、JMeter、Postman、Redis、Docker、Spring Boot

**项目简介**：

企业级 RAG 知识库系统，支持文档上传、向量检索、流式对话与权限管理，面向内部员工与外部用户提供智能问答服务。

**技术职责**：

1. **功能测试**：基于需求文档编写测试用例（覆盖用户注册 / 登录 / 文档上传 / 检索 / 对话等 15 个核心功能），Postman 执行接口测试，发现并提交 32 个 Bug（Severity: Critical 5 / Major 12 / Minor 15），回归测试通过率 95%。
2. **单元测试**：编写 JUnit + Mockito 单元测试，覆盖用户注册、认证、会话管理等功能与异常场景；对比验证 Redis 优化前后性能差异，为系统调优提供数据支撑。
3. **自动化测试**：Selenium WebDriver 编写 UI 自动化脚本（覆盖登录 / 文档上传 / 检索 / 对话 4 个关键流程），Jenkins 定时执行（每日凌晨 2 点），自动化覆盖率 60%，节省手工测试时间 40%。
4. **性能测试**：JMeter 模拟 500 并发用户执行检索与对话操作，发现 Redis 连接池配置不足导致 P99 响应时间 > 2s；优化后 P99 降至 400ms，系统 QPS 从 80 提升至 200。
5. **压力测试与性能优化**：对文件分片上传、向量检索等关键环节进行压力测试，检索响应时间从初始的 800ms 降低到 200ms，支持 TB 级文档存储和毫秒级检索。
6. **测试驱动开发（TDD）**：项目采用 Mockito 注解驱动的测试模式，每个业务功能都有对应的测试用例，包括正常流程和异常流程，保证代码质量与系统稳定性。

---

## 运维工程师方向

### 项目 7：RAG 智能报价系统（运维视角）

**项目名称**：RAG 智能报价系统  
**时间**：2025.03 - 至今  
**角色**：运维工程师  
**技术栈**：Spring Boot、Redis、MinIO、Elasticsearch、vLLM、Kubernetes、Prometheus、Grafana、Fluent Bit、NetworkPolicy、Helm

**项目简介**：

为传感器制造企业构建的智能报价系统，集成 RAG 架构与中文大模型，服务于内部销售人员与官网用户，月均处理报价请求 5000+。

**技术职责**：

1. **Kubernetes 集群部署**：Helm Chart 编排 Spring Boot / Redis / MinIO / Elasticsearch / vLLM 5 个组件，ConfigMap 管理配置，Secret 存储敏感信息（API Key / 数据库密码），滚动更新实现零停机部署。
2. **Pod 资源配置与弹性伸缩**：Spring Boot Pod 配置 Requests（CPU 500m / Memory 1Gi）与 Limits（CPU 2 / Memory 2Gi），HPA 根据 CPU 使用率（目标 70%）自动扩缩容（min 2 / max 10），高峰期自动扩容至 8 个 Pod，P95 响应时间 < 500ms。
3. **持久化存储**：MinIO StatefulSet 挂载 PVC（500GB），Elasticsearch 挂载 PVC（1TB），数据持久化至 Ceph 分布式存储，支持跨节点迁移与故障恢复。
4. **监控与告警**：Prometheus 采集 Pod / Node / Redis / Elasticsearch 指标，Grafana 大盘展示 QPS / P99 延迟 / 错误率 / 资源使用率；AlertManager 配置告警规则（CPU > 80% / Memory > 85% / 错误率 > 5%），告警通知至企业微信。
5. **日志聚合**：Fluent Bit DaemonSet 采集容器日志，聚合至 Elasticsearch，Kibana 可视化查询与分析，支持全文检索与错误日志追踪。
6. **网络策略与安全**：NetworkPolicy 限制 Pod 间通信（仅允许 Spring Boot → Redis / MinIO / Elasticsearch，禁止外部直接访问），Ingress-Nginx 配置 HTTPS 与 Rate Limit（100 req/s），防止 DDoS 攻击。
7. **灰度发布与回滚**：Helm 支持灰度发布（金丝雀部署），先发布 10% 流量至新版本 Pod，观察 Grafana 指标无异常后逐步扩大至 100%；一次新版本上线后发现内存泄漏，2 分钟内通过 `helm rollback` 回滚至稳定版本，故障恢复时间 < 3 分钟。

---

## 关键认知

1. **完整 vs Bullet**：本文提供**完整项目段落**（可直接套用），[[RAG项目简历范例]] 提供 **bullet 素材库**（按技术点归类，便于精雕细琢）。
2. **三个文件配合使用**：
   - [[简历写法指南]] — 写法规范（黄金公式 / 模块结构）
   - [[RAG项目简历范例]] — Bullet 素材库（按技术点归类）
   - 本文 — 完整项目段落（快速套用）
3. **量化数字必须真实**：示例中的性能数字（QPS / 响应时间 / 召回率）仅供格式参考，写进简历的必须是自己项目实测的。
4. **技术栈对齐求职方向**：后端方向聚焦 Spring Boot / Redis / RocketMQ / Milvus，测试方向聚焦 JUnit / JMeter / Selenium，运维方向聚焦 Kubernetes / Prometheus / Helm。

## 相关链接

- [[RAG项目简历范例]] — Bullet 素材库（按技术点归类）
- [[简历写法指南]] — 写法规范（黄金公式 / 模块结构）
- [[RAG基础与架构]] — RAG 技术原理
- [[Agent 核心概念]] — Agent 技术原理

> 数据来源：[派聪明 RAG 项目如何写到简历上](https://paicoding.com/paismart-resume-write)（派聪明社区，球友简历范例整理）
