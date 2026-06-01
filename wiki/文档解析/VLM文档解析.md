---
module: 文档解析
tags: [文档解析, VLM, 多模态, ColPali, Dolphin, PaliGemma, ViT]
difficulty: medium
last_reviewed: 2026-05-20
---

# VLM 文档解析

> **VLM = Vision-Language Model（视觉语言模型）**。==文档解析的最新趋势：用一个多模态大模型同时搞定 [[OCR]] + [[TSR]] + [[版面分析]] + [[公式识别]]==——直接把页面图像喂进去，输出结构化文本。前置 [[OCR]]、[[版面分析]] 等概念会让本文更好懂。

---

## 一、VLM 解决什么问题

### Pipeline 方案的痛点

传统文档解析是 Pipeline：

```text
PDF/扫描件
   ↓
[[版面分析]]
   ↓
按区域分发：
  ├─ 文字 → [[OCR]]
  ├─ 表格 → [[TSR]]
  ├─ 公式 → [[公式识别]]
  └─ 图片 → 图像分类/检测
   ↓
后处理拼接
```

==Pipeline 方案的问题==：
- 每一步都是独立模型，错误会累积（版面分析切错了，下游全错）
- 边界不清的元素难处理（行内公式？表格里的图？）
- 多个模型部署、维护、版本管理都麻烦
- 对边缘场景（手写、复杂排版、多语言）泛化弱

### VLM 的承诺

==一个模型搞定所有==：

```text
PDF/扫描件 → VLM → 结构化 Markdown / HTML / JSON
```

不需要显式的中间步骤，不需要不同模型协调，不需要边界规则。

---

## 二、VLM 的基础架构

VLM 不是一个具体模型，是一类架构。所有 VLM 都包含三个组件：

```text
图像 → 视觉编码器 → 跨模态对齐 → 语言模型 → 文本输出
       (Vision      (Connector)  (LLM)
        Encoder)
```

| 组件 | 作用 | 常见实现 |
|------|------|---------|
| 视觉编码器 | 把图像变成视觉特征序列 | ViT、Swin Transformer、SigLIP |
| 跨模态对齐 | 把视觉特征映射到语言模型能理解的空间 | MLP 投影、Q-Former、Cross-Attention |
| 语言模型 | 基于视觉特征生成文本 | LLaMA、Qwen、Gemma、Phi |

---

## 三、三类典型架构

按"==视觉特征如何进入语言模型=="可以分三类：

### 类型 1：CLIP 类（双塔对比学习）

```text
图像 → Vision Encoder → 图像向量
                                  ↓
                              对比学习
                                  ↑
文本 → Text Encoder    → 文本向量
```

代表：CLIP、SigLIP。==不生成文本==，只是把图像和文本映射到同一向量空间，用于检索/分类。

[[ColPali]] 用的就是 SigLIP 风格——把整页 PDF 当图像编码，与 query 文本做向量匹配，==跳过 OCR 直接做视觉检索==。

### 类型 2：Pali 类（Vision-as-Token）

```text
图像 → ViT → 视觉 patch 序列 (N 个 token)
                                  ↓
                          [视觉 token] + [文本 token]
                                  ↓
                            统一的 Transformer
                                  ↓
                              文本输出
```

==把视觉 patch 当成"特殊的 token"塞进语言模型的输入==——和文本 token 一起送进同一个 Transformer 处理。

代表：**PaliGemma**（Google）、**Qwen-VL**（阿里）、**InternVL**（上海AI实验室）。

**关键设计**：
- 视觉编码器输出固定数量的 patch（如 256 个）
- 通过线性投影把 patch 维度对齐到语言模型的 embedding 维度
- 语言模型自回归生成文本，==注意力可以同时看视觉和文本==

ColPali 也基于 PaliGemma 改造，但换成 Late Interaction 用于检索。这里与上文"ColPali 用 SigLIP 风格"并不矛盾：SigLIP 正是 PaliGemma 内部的视觉编码器，所以说 ColPali 的视觉编码器是 SigLIP、整体架构基于 PaliGemma，二者描述的是同一件事的不同层次。

### 类型 3：Flamingo 类（Cross-Attention 注入）

```text
图像 → Vision Encoder → 视觉特征
                          ↓
文本输入 → Text Embedding → Transformer Layer
                              ↓
                       插入 Cross-Attention 层
                       （让文本注意视觉特征）
                              ↓
                          下一层 Transformer
                              ↓
                          ...生成文本
```

==视觉特征不进入主序列==，而是通过 Cross-Attention 在 Transformer 每一层"注入"信息。

代表：**Flamingo**（DeepMind）、**BLIP-2**（Salesforce）。

**优势**：语言模型主体不变，==只插入轻量的 Cross-Attention 层==，训练快、参数效率高。

---

## 四、文档解析专用 VLM

通用 VLM（GPT-4V、Qwen-VL、Claude-3.5）都能做文档解析，但==有专门为文档解析训练的 VLM==更高效。

### Dolphin-v2（字节跳动，ACL 2025）

==当前开源端到端文档解析的代表==。3B 参数，MIT 协议。

**两阶段架构（异构锚点提示）：**

```text
阶段 1：版面元素序列生成
PDF 页面 → ViT → "[标题][段落][表格][公式][图片说明]..."
                  ↑ 按阅读顺序输出元素类型 + 位置

阶段 2：每个元素的精细识别
对每个版面元素，根据其类型（标题/表格/公式/...）做专门解码
最终拼接为结构化 Markdown
```

**关键创新：异构锚点提示（Heterogeneous Anchor Prompting）**：

第二阶段对每种内容类型用不同的"提示锚点"：
- 文字元素 → 输出文本
- 表格元素 → 输出 HTML 表格
- 公式元素 → 输出 LaTeX
- 图片元素 → 输出图片描述

==同一个模型，根据元素类型切换输出格式==，避免 Pipeline 方案的多模型协调。

支持识别 21 种内容类型（文本/标题/表格/公式/代码/图片说明/页眉/页脚/...）。

### SmolDocling（IBM）

==超紧凑 VLM==（仅 256M 参数）。

**关键设计：DocTags 输出语言**

不输出标准 Markdown 或 HTML，而是输出 IBM 自定义的 **DocTags**——一种==专为文档结构设计的标记语言==，比 HTML 紧凑、比 Markdown 表达能力强。

```xml
<doctag>
  <text><loc_120><loc_80><loc_580><loc_110>合同编号: HT-2026-0042</text>
  <table><loc_...>...</table>
  <formula><loc_...>E=mc^2</formula>
</doctag>
```

每个元素带==位置信息==，可以反向定位到原图。256M 参数让它能在 CPU 部署。

### ColPali（视觉检索）

不生成文本，==生成多向量用于检索==。架构基于 PaliGemma，输出每个图像 patch 的向量，与 query 文本向量做 Late Interaction 匹配。

详见 [[RAG高级技术#七、多模态-RAG]]。

---

## 五、为什么 VLM 文档解析效果好

### 训练数据规模

通用 VLM 在数十亿对（图像-文本）数据上预训练，==见过的版面、字体、语言、艺术字远超 OCR 模型==。

### 多任务统一训练

文档解析专用 VLM 训练时同时学：
- 识别字（OCR）
- 识别表格结构（TSR）
- 识别公式（公式识别）
- 识别版面（版面分析）

==多任务学习的隐式知识共享==让模型在边界场景（行内公式、表格里的图）表现远好于分开训练的 Pipeline 方案。

### 零样本鲁棒性

通用 VLM 可以==零样本==处理没见过的版面（手写、艺术字、扫描质量差），传统 OCR 必须重新训练才能适配。

---

## 六、VLM 的代价

==没有免费的午餐==：

| 维度 | Pipeline 方案 | VLM 方案 |
|------|--------------|---------|
| 速度 | 快（CPU 也能跑） | 慢（GPU 必需） |
| 成本 | 低 | 高（按 token 收费或买 GPU） |
| 模型体积 | 小（PaddleOCR 几十 MB） | 大（GB 级） |
| 可解释性 | 强（每步都能看中间结果） | 弱（端到端黑盒） |
| 边缘部署 | 可以 | 难 |

**实战选择**：
- 大批量、规整文档（如批处理 1000 万份合同）→ Pipeline
- 复杂、多样、低批量场景（如客户上传的奇形怪状文档）→ VLM
- 极致精度要求（如金融合规审查）→ 两者结合，VLM 兜底

---

## 相关链接

- [[OCR]] — VLM 在替代/补充的传统技术之一
- [[TSR]] — 同上
- [[版面分析]] — 同上
- [[公式识别]] — 同上
- [[RAG基础与架构]] — VLM 在 RAG 文档解析中的位置（多个章节）
- [[RAG高级技术]] — ColPali 在多模态 RAG 中的应用（参见七、多模态 RAG）
