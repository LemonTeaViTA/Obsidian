<!--
  个人简历 — 含隐私信息，不要提交到公开 Git 仓库。
  填写说明：【】标记处替换为你的真实信息。
  照片：把证件照命名为 photo.jpg 放在本文件同目录下，或修改下方 <img src="..."> 的路径。
-->

<table border="0" width="100%" style="border:none;">
<tr>
<td width="78%" style="border:none; vertical-align:top;">

# 丁首钦

求职意向：RAG 算法工程师 / AI 应用开发工程师 / Agent 开发工程师

性别：男 | 出生年月：2001.02 | 政治面貌：中共党员 | 籍贯：江苏省连云港市

电话：13260967855 | 邮箱：shouqin.ding@foxmail.com

GitHub：[github.com/LemonTeaViTA](https://github.com/LemonTeaViTA) | 现居：杭州

</td>
<td width="22%" align="right" style="border:none; vertical-align:top;">

<img src="photo.jpg" width="120" alt="证件照" />

</td>
</tr>
</table>

---

## 教育经历

**杭州电子科技大学** · 硕士 · 通信工程 · 2024.09 – 2027.06

金陵科技学院 · 学士 · 通信工程 · 2019.09 – 2023.06

---

## 专业技能

- 熟悉 RAG 检索管道：混合检索（BM25 + 向量召回 RRF 融合）、Cross-Encoder 重排、窗口扩展、召回参数调优。
- 熟悉大模型流式调用：WebSocket + SSE 流式输出、Token 计量与成本控制、超时重试与模型降级。
- 了解 Agent 执行模式（ReAct / Plan-and-Execute / Multi-Agent）：工具注册与并行调用、任务 DAG 调度、多模型适配与故障转移、MCP 协议集成。
- 熟练使用 Java：集合框架、多线程并发（ThreadPoolExecutor / CompletableFuture）、JVM 内存模型与 GC 调优。
- 熟练使用 MySQL：索引、事务（MVCC / 隔离级别）、锁、慢 SQL 优化；熟悉 Redis 数据类型、持久化（RDB / AOF）、过期淘汰策略。

---

## 实习经历

**微店（无限生活杭州信息科技有限公司）** · AI 应用开发实习生 · 【2025.09 – 2026.03】

**企业知识库 RAG 系统** | 杭电联合实验室项目

杭电-微店联合实验室委托项目，为企业内部构建知识库 RAG 系统，成果交付企业方部署，10 人内测期间处理 1000+ 查询。

- 构建混合检索管道（向量召回 + BM25 RRF 融合 + Cross-Encoder 重排），在 RAGBench 五领域与自建中文集共 259 题上达到 **NDCG@5 0.81、Recall@5 0.97、MRR 0.92**。
- 针对模型把检索侧二手转述当作事实复述的问题，设计双索引存储（检索侧拼接上下文、生成侧只读原文），**RAGAS Faithfulness 从 0.91 提升至 0.93** 且召回不降。
- 诊断技术文档召回错误片段问题，定位到 HTML 转换残留的 URL 碎片挤占正文，清洗后**该类文档 Recall@5 从 0.35 提升至 0.95、整体 NDCG +0.18**。

开源仓库：[github.com/LemonTeaViTA/Baize](https://github.com/LemonTeaViTA/Baize)

---

## 项目经历

**SageCLI · 终端 Agent CLI** | 个人开源项目 · 对标 Claude Code | 【2026.03 – 至今】

项目描述：对标 Claude Code 的终端 Agent CLI，用自然语言驱动代码开发与调试，内置三条执行路径与多平台模型适配。

- 针对单轮 ReAct 处理多步骤依赖任务易丢步、重复执行的问题，设计 Plan-and-Execute 路径将 LLM 输出解析为任务 DAG、按依赖分批并行；ReAct / Plan / Multi-Agent **三条路径共享同一套工具与记忆栈**，按任务复杂度切换，新增模式无需重写工具栈。
- 针对每接一个平台就要新写一个 client 类的问题，抽象 `LlmClient` 接口 + 模板基类，把各 provider 差异收敛为数据驱动注册表，**新增平台从写一个类降到加一条配置**；接入 GLM / DeepSeek / Kimi 等 5+ 平台，支持运行时热切换与主备故障转移。
- 针对固定压缩比率在大窗口浪费 Token、小窗口又溢出的问题，设计按模型窗口派生的长上下文策略（**压缩触发点 = 窗口 − 摘要预留 − 缓冲**），超阈值时自动摘要早期对话、保留最近原文，结合 prompt cache 控制开销。
- 诊断模型调用 MCP 工具频繁失败问题，定位到部分 server 返回的 Schema 含 `$ref` / `anyOf` 嵌套、模型无法解析，设计 SchemaSanitizer 展开引用并降级复杂结构后**显著提升工具调用成功率**；支持 stdio / HTTP 两种 transport。
- 面向不可信的 LLM 输出设计安全纵深防御：**HITL 人工审批 → 路径围栏 → 命令黑名单**三道防线，危险操作按天写 JSONL 审计并脱敏凭证；对话无损持久化支持 `/resume` 跨重启恢复会话。

开源仓库：[【github 仓库链接】](https://github.com/LemonTeaViTA/SageCLI)

---

## 科研经历

**研究方向：被动式非视距（NLOS）成像** — 从中继墙反射恢复隐藏人体轮廓分割，围绕频谱重校准与扩散精修展开三项连续工作，自建真实+仿真数据集 ReflectHuman。

**RecDiffusion: Spatial-Spectral Recalibration with Weak-Physics Diffusion Refinement for NLOS Human Silhouette Segmentation** | ACM MM（CCF-A）· 共同一作 · 在投

- 提出空间-频谱重校准 + 扩散精修两阶段框架，抑制墙面低频干扰、增强可恢复信号，在 Reflect-Corridor / Room 上 **Dice 0.711 / 0.728**，全面超越分割、GAN、扩散基线。

**DiProxB-Net: Recovering Occluded Human Boundaries from Single-Frame Indirect Observation** | IEEE TMM（中科院一区 / CCF-B）· 共同一作 · 在投

- 针对多径反射方向漂移与低通高频抑制两大退化，提出双域扰动建模框架，在多个真实/仿真 NLOS 数据集上区域与边界指标均优于通用分割及 NLOS 专用基线。

**SpecGR-Net: Spectral-Geometric Refinement Network for NLOS Object Segmentation** | Neural Networks（中科院二区 / CCF-B）· 第一作者 · 在投

- 基于 ConvNeXtV2 + 频域注意力提出频谱-几何重校准网络，做弱信号 NLOS 分割的频域增强与跨尺度证据路由，经留一场景交叉验证系统验证稳健性。

---
