---
报告单元: RAG-评估安全与高级
审计类型: 只读审计（判断类为主）
审计日期: 2026-06-01
审计文件数: 6
---

# RAG 评估/安全/高级 单元审计报告

## 一、单元概览

| 文件 | 行数 | 顶层小节 | 健康度 | 一句话 |
|------|------|---------|--------|--------|
| RAG评估.md | 457 | 8(+相关链接) | 🟢 | 指标体系完整准确，结构清晰，唯顶部摘要非 callout 形式 |
| RAG安全.md | 506 | 7(+相关链接) | 🟢 | 攻击面/PII/多租户/合规覆盖全面，技术准确 |
| 幻觉与置信度.md | 498 | 7(+相关链接) | 🟢 | 体系完整；与 RAG评估 有忠实度概念重叠（已互链）；NLI 代码示例有误 |
| RAG高级技术.md | 437 | 8(+相关链接) | 🟡 | 内容扎实；与文档解析综述 多模态/BookRAG 重叠；Graphiti 仓库地址疑误 |
| 文档解析综述.md | 396 | 7(+相关链接) | 🟡 | 二维框架优秀；3 处多模态锚点是断链（连字符 vs 空格） |
| 多轮对话.md | 760 | 4(+相关链接) | 🟡 | >600 行黄旗；§2.4 单节约 400 行严重失衡 + 4 个 callout 超限；高亮泛滥 |

单元整体健康度：🟡（0 红旗，多个黄旗）

---

## 二、逐条问题

### P1 问题

**[P1] 多轮对话.md §2.4 单节体量失衡 + callout 超限**
- 文件：`wiki/RAG/多轮对话.md`，§2.4「怎么知道哪些消息重要？五种判断方案」约 line 202–603
- 问题：单个 `### 2.4` 下塞了约 400 行内容（占全文 53%），内含 5 个方案 + 市面产品对比 + 推荐组合 + 常被忽略细节，结构严重头重脚轻。且该 `###` 下出现 4 个 callout（warning@206、warning@256、danger@269、info@313），违反「每个 ### 下 callout ≤3��规则。
- 修复建议：把「方案 5 分层摘要」「市面主流产品做法」「推荐组合」拆为独立的二级/三级章节，或将整个「对话压缩/记忆提取」抽成单独文档；callout 合并到 ≤3 个。

**[P1] 文档解析综述.md 多模态锚点断链（3 处）**
- 文件：`wiki/RAG/文档解析综述.md` line 115、309、395
- 问题：链接写作 `[[RAG高级技术#七、多模态-RAG]]`（连字符），但目标标题实际为 `## 七、多模态 RAG`（空格）。Obsidian 锚点按标题原文精确匹配，连字符版本无法跳转 → 3 处断链。
- 修复建议：改为 `[[RAG高级技术#七、多模态 RAG]]`。

**[P1] 幻觉与置信度.md ↔ RAG评估.md 忠实度/引用对齐概念重叠**
- 文件��`wiki/RAG/幻觉与置信度.md` §2.1 引用对齐（约 line 68–106，~38 行）与 `wiki/RAG/RAG评估.md` §3.1 Faithfulness（约 line 105–124，~20 行）
- 问题：两处都在讲「把 answer 拆成原子 claim → 逐条判断 context 是否支撑 → 算 Faithfulness」，方法与代码骨架高度同源。各自均 <50 行，未触发 P0 硬阈值，且两文已互称姊妹篇并互链，属可接受的边界重叠；但仍有收敛空间。
- 修复建议：保持「评估=指标定义」在 RAG评估、「检测=工程实现」在幻觉，二者再各自精简对方已讲的部分，避免读者两边看到同一段算法描述。

**[P1] 幻觉与置信度.md NLI 模型调用代码不正确**
- 文件：`wiki/RAG/幻觉与置信度.md` §2.2 line 114–120
- 问题：`nli(f"premise: {context}\nhypothesis: {claim}")` 把前提与假设拼成单串送入 `text-classification` pipeline，DeBERTa-MNLI 实际需要 (premise, hypothesis) 句对（应用 `nli({"text": context, "text_pair": claim})` 或 tokenizer 的 text/text_pair）。当前写法会被当成单句分类，NLI 蕴含判断失效。
- 修复建议：改用句对输入形式。

### P2 问题

**[P2] RAG高级技术.md ↔ 文档解析综述.md 多模态 RAG / ColPali / BookRAG 重叠**
- 文件：`wiki/RAG/RAG高级技术.md` §七（多模态 RAG，line 362–415）、§一 BookRAG（line 34–46）与 `wiki/RAG/文档解析综述.md` §五 ColPali/VisionRAG（line 299–312）、§7.1 BookRAG（line 366–372）
- 问题：MultiVectorRetriever、Caption 质量要求、ColPali 架构、BookRAG 在两文均有讲解。文档解析综述已用「详见 [[RAG高级技术#…]]」收口，重叠属轻度且有意控制；但 BookRAG 在两文都给了同一篇 arXiv 2512.03413 且各自展开，是可压缩的重复。
- 修复建议：BookRAG 全文单点保留（建议留在文档解析综述 §7.1 结构感知一节），RAG高级技术 §一仅留一句 + callout 链接。

**[P2] RAG高级技术.md Graphiti 仓库地址疑误**
- 文件：`wiki/RAG/RAG高级技术.md` line 175
- 问题：写作 `https://github.com/graphiti-ai/graphiti`，Graphiti 实际仓库为 `getzep/graphiti`（Zep 出品）。离线无法 100% 确认，但高度疑为错误地址。
- 修复建议：核实并改为 `https://github.com/getzep/graphiti`。

**[P2] 多轮对话.md 高亮（==…==）泛滥，损害可读性**
- 文件：`wiki/RAG/多轮对话.md` 全文，尤以 §2.4 line 202–262 为甚
- 问题：单段内连续多处 `==…==`，甚至「==方案 2/3/4 是历史/学术价值,不是生产标准==」等整句高亮，高亮密度过高反而失去强调作用，也偏离百科式中性表述。
- 修复建议：每个小节高亮收敛到 1–2 个关键词。

**[P2] 代码块缺语言标签（多文件）**
- 文件：多篇文档的 ASCII 示意图/伪代码块使用裸 ```（如 多轮对话.md line 117/139/193/323/343/352；RAG安全.md line 20/28/181；幻觉与置信度.md line 281/327；文档解析综述.md line 37/108/152/175）
- 问题：示意图块应标 `text`，prompt 模板块可标 `text`，便于渲染与规范统一。
- 修复建议：补语言标签（机械项，已由全局检查覆盖，此处一并记录）。

**[P2] >400 行文档顶部摘要非 callout 形式**
- 文件：`RAG评估.md`、`RAG安全.md`、`幻觉与置信度.md`、`多轮对话.md`（均 >400 行）
- 问题：各文顶部均有 `>` 引用式导语（已起到渐进式摘要作用），但非规范要求的 `> [!tip]/[!info]` callout。属轻微格式偏差，内容意图已满足。
- 修复建议：将顶部导语包成 `> [!info]` callout。

**[P2] RAG评估.md A/B 测试对二元指标用 t 检验**
- 文件：`wiki/RAG/RAG评估.md` §6.3 line 365–373
- 问题：对点赞（0/1 伯努利）数据用 `ttest_ind` 不是最优；二元比例对比更宜用两比例 z 检验 / 卡方检验。样本大时 t 检验近似可用，但作为面试/教学示例略不严谨。
- 修复建议：补一句说明或改用 `proportions_ztest`。

### 观察项（非缺陷，记录备查）

- RAG高级技术.md、RAG评估.md 若把「相关链接」算作顶层小节则为 9 个，超 ≤8；通常「相关链接」视作页脚不计入，按内容小节仍达标。
- Self-RAG 归属写「华盛顿大学 + IBM」，更准确应含 AI2（Allen Institute）；属轻微表述，不影响理解。
- 多轮对话.md / 幻觉 / 安全 等大量引用「重疾险/保额/等待期」保险业务案例，贯穿一致，利于上下文连贯，无问题。

---

## 三、领域知识点准确性评价

整体技术准确度高，2026 年现状对齐良好，面试深度充分。要点：

- **RAG评估.md**：Recall@K / MRR / NDCG 三个公式实现正确（NDCG 用 log2(rank+1) 折损 + IDCG 归一化无误）；RAGAS 四指标（Faithfulness/Answer Relevancy/Context Precision/Context Recall）定义与「反向生成」「ground-truth claim 拆解」机制描述准确；Cohen's Kappa 阈值合理；四指标联合诊断表是亮点。唯 A/B 二元指标检验方法可更严谨（见 P2）。
- **RAG安全.md**：间接 Prompt Injection 概念与 Bing Chat 2023、Copilot 案例真实；instruction hierarchy（OpenAI）归属正确；PII 正则（中国身份证 17+校验位、手机号、银行卡）与部分脱敏 `138****5678` 逻辑正确；多租户「tenant_id 只能从认证态取、不能从 query 传」是正确安全原则；GDPR/HIPAA/等保覆盖到位；「Embedding 训���数据无法事后删除→不应用用户数据训通用 Embedding」是高质量洞察。
- **幻觉与置信度.md**：三类幻觉（事实/归因/推理）划分清晰；引用对齐 SUPPORTED/CONTRADICTED/NO_EVIDENCE 三分类正确；token 置信度用 logprobs 几何平均合理且点明「高概率≠正确」；检索置信度 top_score+score_gap 启发式实用；Verify-Then-Answer、Calibration over-confident 讨论准确。唯 NLI 句对输入代码有误（见 P1）。
- **RAG高级技术.md**：Agentic RAG、Self-RAG（Reflection Tokens [Retrieve]/[IsRel]/[IsSup]/[IsUse]、7B 超 13B）、RAG-Gym（arXiv:2502.13957 过程监督 vs 结果监督）、Contextual Retrieval（Anthropic，BM25 叠加降失败率 49%/67%）、ColPali（PaliGemma+ColBERT Late Interaction、ViDoRe）均准确；多模态三方案精度区间（CLIP~60%/VLM~90%/ColPali 最高）为合理示意。Graphiti 仓库地址疑误（见 P2）。
- **文档解析综述.md**：「内容元素 × 容器格式」二维框架是高质量原创组织视角；TableFormer(IBM)、Nougat(Meta)、MarkItDown(微软)、Whisper、pyannote、DocLayNet/RT-DETR、MinerU、Docling 均真实准确；「数字版 PDF 是 PostScript 绘制指令、有文字层」解释正确；表格/公式/版面/OCR 通用方法描述专业。Dolphin-v2(字节,3B,21 类)、SmolDocling(IBM)、MinerU 2.5-Pro(1.2B 超 235B) 等较新条目无法离线逐一核验，但与 2026 现状不矛盾。
- **多轮对话.md**：双表 schema、SQLite/Redis/PG 选型、token 预算分配、滑动窗口/摘要/混合三策略、分层摘要、指代消解 query 改写、>0.95 embedding 相似缓存、Agent Memory L1/L2/L3 边界均准确且工程性强；「市面产品对比」（Claude Code /compact、ChatGPT bio()、Cursor、LangChain/LangGraph）是面试加分内容。知识点无技术硬伤，问题集中在结构与表达。

---

## 四、本单元小结

6 篇文档技术质量整体优秀，知识点准确、深度足够、与 2026 现状对齐，互链网络（评估↔幻觉↔安全↔高级↔解析）组织良好，是本知识库的高水准单元。无红旗（无 >800 行、无 ≥50 行 P0 级 SSoT 违规、无 Diátaxis ≥2 类硬混杂）。

主要待整改（黄旗）：① 多轮对话.md 760 行超阈值，且 §2.4 单节约 400 行严重失衡 + callout 超限，建议拆分；② 文档解析综述.md 3 处多模态锚点断链（连字符 vs 空格），应尽快修；③ 幻觉↔评估 忠实度概念、高级↔解析 多模态/BookRAG 存在轻度可压缩重叠；④ 幻觉.md NLI 代码句对输入需修正；⑤ Graphiti 仓库地址疑误。求职方向上，本单元 Python 工程示例丰富，与 Java+Agent 目标中的「Agent 应用层 RAG」高度相关，方向对齐良好（RAG 是 Agent 检索增强的核心能力，非纯大模型研发）。
