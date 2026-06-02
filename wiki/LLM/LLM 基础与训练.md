---
module: LLM
tags: [LLM, Transformer, 训练, LoRA, 推理优化, MoE]
difficulty: hard
last_reviewed: 2026-06-01
---

# LLM 基础与训练

> [!info] 本文导览
> 覆盖 Transformer 架构 → 训练三阶段（Pre-train / SFT / RLHF / DPO） → LoRA / QLoRA 微调 → Embedding 演进 → 推理优化（KV Cache / PagedAttention / MLA / 量化 / Flash Attention / 部署框架） → MoE & Mamba 新架构 → Token 经济学。
>
> 想了解 Prompt 工程见 [[Prompt Engineering]]，工程框架见 [[Harness Engineering]]。

---

## 一、Transformer 架构

整体分 Encoder（理解输入）和 Decoder（生成输出）。核心创新是 Self-Attention 机制，替代了 RNN/LSTM 的循环结构，每个位置都能直接"看到"序列里所有其他位置，且可以并行计算。

### Self-Attention

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

- $Q$（Query）：当前 token 想查询什么信息
- $K$（Key）：每个 token 能提供什么信息
- $V$（Value）：实际取出的信息内容
- $\sqrt{d_k}$：缩放因子，防止点积过大导致 softmax 进入饱和区、梯度消失

计算流程：输入 $x$ 经三个独立线性变换得到 $Q, K, V$ → $Q$ 与所有 $K$ 做点积得相似度矩阵 → 除以 $\sqrt{d_k}$ 缩放 → Softmax 归一化得注意力权重 → 对 $V$ 加权求和得输出。

### Multi-Head Attention

$$\text{MultiHead}(Q,K,V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h)\,W^O$$

$$\text{head}_i = \text{Attention}(QW_i^Q,\; KW_i^K,\; VW_i^V)$$

每个 head 有独立的投影矩阵 $W_i^Q, W_i^K, W_i^V \in \mathbb{R}^{d_\text{model} \times d_k}$，并行计算后 Concat，再乘 $W^O$ 融合。不同 head 可以同时关注不同维度的关系（语法、语义、指代等），单头 Attention 做不到这一点。

### 位置编码（Positional Encoding）

**为什么需要位置编码？**

Self-Attention 是"置换不变"的——它只看 token 之间的相似度，完全不知道谁在前谁在后。"猫追狗"和"狗追猫"对 Attention 来说是一样的。所以必须人为注入位置信息。

**怎么注入？**

**方案一：绝对位置编码（Sinusoidal / 可学习）**

在 token embedding 上直接加一个位置向量：

$$x'_i = \text{TokenEmb}(w_i) + \text{PosEmb}(i)$$

- Sinusoidal：$\text{PosEmb}(i)$ 是固定的 sin/cos 函数值，不需要训练
- 可学习版（BERT/GPT-2）：$\text{PosEmb}(i)$ 是可训练参数，每个位置学一个向量

**方案二：RoPE（旋转位置编码，现代 LLM 主流）**

不加到 embedding 上，而是在 Attention 计算内部，对 Q 和 K 向量按位置做旋转变换：

$$q'_m = R_m \cdot q_m, \quad k'_n = R_n \cdot k_n$$

旋转后做点积：$q'_m \cdot k'_n = q_m^T R_m^T R_n k_n = q_m^T R_{n-m} k_n$

结果只依赖相对位置差 $n - m$，而非绝对位置 $m$ 或 $n$。

**什么是"外推"（Length Extrapolation）？**

训练时序列最长 2048 个 token，推理时遇到 4096 个 token——这就叫"外推"。

- **绝对位置编码的问题**：位置 2049、2050... 在训练时从未出现过，模型对这些位置的 embedding 完全没有概念，性能急剧下降
- **RoPE 的优势**：它编码的是相对距离，不管绝对位置是多少，token 之间"相差 5 个位置"的旋转角度是固定的，模型见过这个相对关系，因此可以更好地泛化到更长序列

| 方案 | 注入方式 | 编码类型 | 长度外推 |
|------|---------|---------|---------|
| Sinusoidal | 加到 embedding | 绝对位置 | 差 |
| 可学习绝对位置编码 | 加到 embedding | 绝对位置 | 差（训练长度硬上限） |
| **RoPE** | 作用于 Q/K 旋转 | 相对位置 | 好，是现代 LLM 标配 |

### Layer Normalization

$$\text{LayerNorm}(x) = \frac{x - \mu}{\sigma} \cdot \gamma + \beta$$

对每个样本的特征维度做归一化（不跨 batch），$\gamma, \beta$ 是可学习参数。

- **Post-LN**（原始 Transformer）：LN 在残差连接之后，梯度不稳定，深层网络难训练
- **Pre-LN**（现代 LLM 主流）：LN 在残差连接之前，梯度更稳定，可以训练更深的网络

### Feed-Forward Network（FFN）

$$\text{FFN}(x) = \text{ReLU}(xW_1 + b_1)\,W_2 + b_2$$

两层全连接，中间维度通常是 $4 \times d_\text{model}$（如 $d=4096$ → FFN 维度 16384）。现代 LLM 多用 **SwiGLU** 替代 ReLU：

$$\text{SwiGLU}(x) = \text{Swish}(xW_1) \odot (xW_2)$$

FFN 承担非线性变换和知识存储，模型约 **2/3 的参数**集中在 FFN 层（而非 Attention）。

### 面试高频问答

#### 为什么 Self-Attention 要除以 √dk？不除会怎样？

点积 $QK^T$ 的结果量级和向量维度 $d_k$ 成正比——假设 Q 和 K 的每个分量都是均值 0、方差 1 的独立随机变量，那么它们的点积的方差是 $d_k$（$d_k$ 个乘积项求和，每项方差为 1）。

当 $d_k$ 很大时（如 128），点积值可能达到几十甚至上百，Softmax 对大数值极度敏感——输入值一大，Softmax 输出就趋近于 one-hot（一个接近 1，其余接近 0），梯度几乎为零（饱和区），模型学不动。

除以 $\sqrt{d_k}$ 把点积的方差拉回到 1，让 Softmax 的输入保持在合理范围内，梯度正常流动。

#### Decoder-only 架构为什么成为 LLM 主流？和 Encoder-Decoder 有什么区别？

**三种 Transformer 架构**：

| 架构 | 代表模型 | 注意力方式 | 适用任务 |
|------|---------|-----------|---------|
| Encoder-only | BERT | 双向注意力（每个 token 看到所有 token） | 理解类（分类、NER、相似度） |
| Encoder-Decoder | T5、BART | Encoder 双向 + Decoder 单向 + Cross-Attention | 翻译、摘要（输入→输出） |
| **Decoder-only** | GPT、LLaMA、Claude | 因果注意力（每个 token 只看到它之前的 token） | 生成类（对话、代码、推理） |

**Decoder-only 成为主流的三个原因**：

1. **统一性**：所有任务都可以转化为"给定前文，预测下一个 token"的形式。理解任务（分类）可以转化为生成"是/否"，翻译可以转化为"英文: xxx\n中文:"后续生成。一个架构通吃所有任务，简化了工程
2. **Scaling 效率**：Encoder-Decoder 有两套参数（Encoder 和 Decoder），同样的参数预算下，Decoder-only 把所有参数集中在一个模块上，每个参数都参与生成，利用率更高。实验表明同等参数量下 Decoder-only 的生成质量更好
3. **训练简单**：只需要 Next Token Prediction 一个目标函数，不需要设计 Encoder 的预训练目标（BERT 需要 MLM + NSP），数据处理也更简单——任何文本都可以直接用

**因果注意力（Causal Attention）的实现**：在 Attention 矩阵上加一个上三角 mask（值为 $-\infty$），Softmax 后这些位置变成 0，确保每个 token 只能 attend 到它之前的 token。这也是为什么叫"自回归"——生成是从左到右逐个进行的。

---

## 二、大模型训练三阶段

### 1. 预训练（Pre-training）

海量文本（万亿 token 级别）自监督学习，目标是预测下一个 token（Next Token Prediction）。消耗算力最大，占整体训练成本 95% 以上。

**Chinchilla 法则**：最优训练 token 数 ≈ 20 × 参数量。如 70B 模型应训练约 1.4T tokens，参数量和数据量同等重要，单纯堆参数而数据不足是浪费。

### 2. SFT（Supervised Fine-Tuning）

用人工标注的指令-回答对做有监督微调，让模型从"预测下一个词"转变为"按指令做事"。数据格式为对话模板：

```
<system>你是一个助手</system>
<user>帮我写一封邮件</user>
<assistant>好的，以下是...</assistant>
```

数据量通常只需几千到几万条高质量样本，远小于预训练。

### 3. RLHF 与 DPO

**RLHF 流程**：需要同时维护 4 个模型：

| 模型 | 作用 |
|------|------|
| Actor（策略模型） | 被优化的目标，生成回答 |
| Critic（价值模型） | 估计当前状态的期望回报 |
| Reward Model | 用人类偏好数据训练，给回答打分 |
| Reference Model | 防止 Actor 偏离 SFT 模型太远（KL 约束） |

用 PPO 算法让 Actor 往 Reward Model 高分方向优化，同时 KL 散度约束不偏离 Reference 太远。流程复杂，4 个模型同时占显存，训练不稳定。

**DPO（Direct Preference Optimization）**：省去 Reward Model，直接用偏好数据对 $\langle y_w, y_l \rangle$（好回答 vs 差回答）优化策略：

$$\mathcal{L}_\text{DPO} = -\log\sigma\!\left(\beta \log\frac{\pi_\theta(y_w|x)}{\pi_\text{ref}(y_w|x)} - \beta \log\frac{\pi_\theta(y_l|x)}{\pi_\text{ref}(y_l|x)}\right)$$

本质：让模型对好回答 $y_w$ 的概率相对参考模型提升，对差回答 $y_l$ 的概率相对降低。两步并一步，只需 2 个模型，是当前主流。

### 4. LoRA 微调（Parameter-Efficient Fine-Tuning）

**全量微调的问题**：一个 7B 模型有 70 亿参数，全量微调需要存储完整的梯度和优化器状态，显存需求约为模型本身的 3-4 倍（FP16 权重 14GB + Adam 优化器状态 ~42GB），普通 GPU 根本放不下。

**LoRA 的核心思想**：大模型的权重更新矩阵 $\Delta W$ 是低秩的——虽然 $W$ 是 $d \times d$ 的大矩阵，但微调时真正需要改变的"方向"很少，可以用两个小矩阵的乘积来近似：

$$W' = W + \Delta W = W + BA$$

其中 $B \in \mathbb{R}^{d \times r}$，$A \in \mathbb{R}^{r \times d}$，$r \ll d$（通常 $r = 8$ 或 $16$）。

**为什么有效**：
- 原始权重 $W$ 完全冻结，不参与梯度计算
- 只训练 $A$ 和 $B$，参数量从 $d^2$ 降到 $2dr$（如 $d=4096, r=16$，参数量从 1600 万降到 13 万，减少 99%）
- 推理时 $BA$ 可以直接合并进 $W$，不增加推理延迟

**rank 怎么选**：
- $r = 4$~$8$：简单任务（风格迁移、格式调整）
- $r = 16$~$32$：中等任务（领域适配、指令微调）
- $r = 64$+：复杂任务（新语言、新能力），但此时可能不如全量微调

**什么场景需要微调？什么场景 RAG + Prompt 就够了？**

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 让模型掌握特定知识（公司文档、产品信息） | RAG | 知识会更新，微调后的知识是静态的 |
| 让模型遵循特定输出格式/风格 | LoRA 微调 | 格式是行为模式，Prompt 难以稳定控制 |
| 让模型学会新语言或新领域术语 | LoRA 微调 | 需要改变模型内部表示 |
| 让模型回答特定领域问题 | RAG + Prompt | 先检索再回答，不需要改模型 |
| 让模型具备新能力（如代码生成） | 全量微调或大 rank LoRA | 能力需要深层改变 |

### 5. QLoRA（Quantized LoRA）

**核心思想**：在 4-bit 量化的基础模型上做 LoRA 微调，三项关键技术的组合：

1. **4-bit NormalFloat（NF4）量化**：将预训练权重量化为 4 位，使用针对正态分布优化的数据类型（模型权重近似正态分布），比普通 INT4 精度更高
2. **Double Quantization**：对量化的缩放因子再做一次量化（FP32 → INT8），进一步节省约 0.37 bit/参数
3. **Paged Optimizers**：利用 CUDA 统一内存，在优化器状态超出 GPU 显存时自动分页到 CPU 内存，避免 OOM

**效果**：在单张 24GB 消费级 GPU（如 RTX 4090）上微调 65B 模型，性能接近全量 16-bit 微调。

> [!tip] QLoRA 的 alpha 参数
> LoRA 的缩放系数 $\alpha$ 控制低秩更新的影响力：$\Delta W = \frac{\alpha}{r} \cdot BA$。经验法则：$\alpha = 2r$（如 $r=16, \alpha=32$），训练更稳定。$\alpha$ 过大会导致训练不稳定，过小则微调效果弱。

**主流微调工具对比**：

| 工具 | 特色 | 适用场景 |
|------|------|---------|
| LLaMA-Factory | 中文生态最完善，WebUI 支持，100+ 模型模板 | 中文模型微调首选 |
| Axolotl | YAML 配置驱动，社区活跃，支持多种训练方法 | 快速实验，灵活配置 |
| Unsloth | 2x 训练速度，70% 显存节省，内核级优化 | 资源受限场景，极致性价比 |
| Hugging Face TRL | 官方库，SFTTrainer + DPO/PPO 一站式 | 与 HF 生态深度集成 |

**微调工程实践要点**：
- 数据质量 > 数据数量：1000 条高质量指令数据的效果常优于 10 万条噪声数据
- 先用 LoRA $r=8$ 快速验证，确认方向正确后再提升 rank 或尝试全量微调
- 评估用困惑度（Perplexity）+ 人工评测 + 任务指标三管齐下

---

## 三、Embedding 算法演进

### Word2Vec（第一代：静态词向量）

训练方式：给定一个词，预测它周围的词（Skip-gram），或给定周围词预测中心词（CBOW）。训练完后每个词对应一个固定向量。

**问题**："苹果"这个词，不管是"吃苹果"还是"苹果公司"，向量都一样——无法区分多义词。

### BERT（第二代：上下文感知）

用双向 Transformer Encoder，同时看左边和右边的上下文，同一个词在不同语境下得到不同的向量表示。

**问题**：BERT 的 `[CLS]` 向量质量差，不能直接用于句子相似度计算——两个句子分别编码后的向量，余弦相似度几乎没有意义。

### SBERT（第三代：句子级语义）

用孪生网络（Siamese Network）结构，用句子对的相似/不相似标签微调 BERT，让句子向量空间具有语义意义。

**效果**：可以直接用余弦相似度比较两个句子的语义，是 RAG 检索的基础。

> 完整内容见 [[LLM/RAG检索策略#题目：三代 Embedding 算法是怎么演进的？]]

---

## 四、LLM 推理优化

### KV Cache

**是什么**：Transformer 在生成每个新 token 时，需要计算所有历史 token 的 Key 和 Value。KV Cache 把已经计算过的 K、V 缓存下来，避免重复计算，大幅降低推理延迟。

**缓存在哪里**：KV Cache 存储在 GPU 显存（HBM，High Bandwidth Memory）中，和模型权重共用同一块显存。这是推理时显存的主要消耗来源——一个 70B 模型权重本身约占 140GB（FP16），而长序列推理时 KV Cache 可能同样占用数十 GB，两者叠加是推理服务显存规划的核心挑战。

**内存占用**：KV Cache 大小 = `2 × 层数 × 头数 × 头维度 × 序列长度 × batch_size × 精度字节数`。长序列 + 大 batch 时内存占用极大，是推理服务的主要瓶颈。

### PagedAttention（vLLM 核心）

**问题**：传统 KV Cache 为每个请求预分配连续内存，导致严重内存碎片——实际使用率只有 20-40%。

**解决方案**：借鉴操作系统虚拟内存的分页思想，把 KV Cache 切成固定大小的 Block（页），按需分配，不同请求的 Block 可以不连续。

**效果**：内存利用率从 20-40% 提升到接近 100%，吞吐量提升 2-4x，是 vLLM 高性能的核心原因。

### MLA（Multi-head Latent Attention）

DeepSeek-V2 提出的 KV Cache 压缩方案。传统 MHA 每个 Head 都要存完整的 K、V，MLA 把所有 Head 的 K、V 压缩到一个低维潜在向量（Latent Vector），推理时再解压。

**压缩流程**：
- 压缩：$c_{KV} = x \cdot W_{DKV}$（把输入投影到低维潜在空间，维度远小于原始 KV）
- 解压：$K = c_{KV} \cdot W_{UK}$，$V = c_{KV} \cdot W_{UV}$（从潜在向量还原出各 Head 的 K、V）
- 推理时只需缓存 $c_{KV}$，而不是所有 Head 的完整 K、V

**为什么"几乎无损"**：这里说的"无损"是相对的，本质是**低秩近似**——K、V 矩阵在实践中存在大量冗余（不同 Head 的 K、V 高度相关），真正有效的信息维度远小于原始维度。MLA 的压缩矩阵 $W_{DKV}$ 和解压矩阵 $W_{UK}$、$W_{UV}$ 是端到端训练出来的，模型在训练过程中自己学会了"把最重要的信息塞进低维空间"。所以不是数学意义上的无损，而是模型学会了在低维空间里保留对预测最关键的信息，精度损失极小。

**效果**：KV Cache 大小压缩到 MHA 的 5-13%，大幅降低内存占用。

### 量化（Quantization）

**量化是什么**：计算机存储数字有不同精度，精度越高占用内存越多、计算越慢。量化就是把模型权重从高精度格式"压缩"成低精度格式，用更少的比特数表示同一个数，从而节省显存和加速推理。

**各精度格式的区别**：

| 格式 | 位数 | 每个参数占用 | 说明 |
|------|------|------------|------|
| FP32 | 32位 | 4 字节 | 标准单精度浮点，训练基准 |
| FP16 | 16位 | 2 字节 | 半精度浮点，数值范围较小，容易溢出 |
| BF16 | 16位 | 2 字节 | Brain Float16，指数位更多，数值范围和 FP32 一样大，不容易溢出，现代训练标配 |
| INT8 | 8位 | 1 字节 | 8位整数，只能表示 -128~127，需要缩放因子还原 |
| INT4 | 4位 | 0.5 字节 | 4位整数，精度损失明显，但内存极省 |

> FP16 和 BF16 都是 16 位，区别在于分配方式：FP16 精度更高但范围小，BF16 范围大但精度略低。训练时 BF16 更稳定（不容易数值溢出），推理时两者差不多。

**量化的本质**：把一个浮点数映射到整数。比如 INT8 量化：找到权重的最大值和最小值，把整个范围均匀划分成 256 个格子，每个权重用最近的格子编号（0-255）表示，同时记录一个缩放因子（scale）用于还原。推理时用整数做矩阵乘法，速度更快，最后乘以 scale 还原结果。

**主流量化方法**：

| 方法 | 类型 | 核心思路 | 适用场景 |
|------|------|---------|---------|
| GPTQ | 训练后量化（PTQ） | 逐层量化，用 Hessian 矩阵信息最小化量化误差 | GPU 推理，精度要求高 |
| AWQ | 训练后量化（PTQ） | 观察激活值分布，对"重要通道"的权重做缩放保护再量化 | GPU 推理，当前主流，精度最好 |
| GGUF | 训练后量化（PTQ） | llama.cpp 的量化格式，支持 Q4_K_M、Q5_K_M 等多种混合精度 | CPU/本地推理，llama.cpp 生态 |
| BitsAndBytes | 训练后量化（PTQ） | HuggingFace 集成，支持 INT8 和 NF4（4位正态浮点） | 快速加载大模型，QLoRA 微调 |

> AWQ 的关键洞察：不是所有权重都同等重要。激活值大的通道对应的权重影响更大，量化误差更敏感，AWQ 对这些权重做缩放（scale up）再量化，等效于给重要权重更高的精度保护。

**量化 vs 知识蒸馏**：这是两种不同的模型压缩技术，经常被混淆：
- **量化**：压缩已有模型的数值精度，模型结构不变，参数量不变，只是每个参数用更少的比特表示
- **知识蒸馏（Knowledge Distillation）**：用大模型（Teacher）的输出分布指导训练一个更小的模型（Student），Student 参数量更少、结构更小，是真正意义上的"小模型"
- 两者可以叠加：先蒸馏出小模型，再对小模型做量化

### Speculative Decoding（投机解码）

**原理**：用一个小模型（Draft Model）快速生成多个候选 token，再用大模型（Target Model）并行验证。验证通过的 token 直接采用，不通过的从大模型重新采样。

**为什么能加速**：大模型验证多个 token 的计算量和验证一个 token 差不多（并行计算），但如果小模型猜对了，就相当于一次大模型调用生成了多个 token。

**效果**：在小模型猜测准确率高的场景（如代码补全、重复性文本），提速 2-3x。

### Continuous Batching（连续批处理）

**问题**：传统静态 batching 要等一批请求都完成才能处理下一批，长请求会阻塞短请求。

**解决方案**：每生成一个 token 后就检查哪些请求已完成，立即将新请求插入 batch，不等待整批完成。

**效果**：GPU 利用率大幅提升，吞吐量提升 5-10x，是现代推理框架（vLLM、TensorRT-LLM）的标配。

### Flash Attention

**问题**：标准 Attention 的内存复杂度是 $O(N^2)$——需要在 GPU HBM 中存储完整的 $N \times N$ 注意力矩阵。当序列长度为 128K 时，这个矩阵占用巨大，且 HBM 带宽成为瓶颈。

**核心思想（IO-Aware）**：不是优化计算量（FLOPs 不变），而是优化内存访问模式。把 Q、K、V 切成小块（Tiling），在 GPU 的高速 SRAM 中完成 Attention 计算，避免在 HBM 中存储 $N \times N$ 矩阵。

**三代演进**：
- **Flash Attention 1**（2022）：Tiling + Online Softmax（分块计算 Softmax 并在线合并），速度提升 2-4x，内存从 $O(N^2)$ 降至 $O(N)$
- **Flash Attention 2**（2023）：优化线程块分配和 warp 级并行，进一步提升 2x，达到理论 FLOPs 利用率 50-73%
- **Flash Attention 3**（2024）：针对 H100 GPU（Hopper 架构）优化，利用异步执行和 FP8 张量核心

> [!info] Flash Attention 是基础设施
> Flash Attention 不是一个独立的推理框架，而是所有主流推理引擎（vLLM、SGLang、TensorRT-LLM）的底层依赖。面试中问到"推理优化"，从 Flash Attention → PagedAttention → 推理框架这条线回答最清晰。

### 推理部署框架

生产环境部署 LLM 需要解决三个核心问题：高吞吐（同时服务多用户）、低延迟（首 token 时间 + 逐 token 速度）、资源效率（GPU 利用率最大化）。

**主流推理框架对比**：

| 框架 | 核心技术 | 适用场景 | 特色 |
|------|---------|---------|------|
| **vLLM** | PagedAttention + Continuous Batching | 通用生产部署 | 当前最流行的开源推理引擎，吞吐量最高 |
| **SGLang** | RadixAttention + 结构化生成 | Agent/结构化输出 | 前缀共享缓存，JSON Schema 约束生成 |
| **TensorRT-LLM** | NVIDIA 内核优化 + FP8 量化 | NVIDIA GPU 极致性能 | 延迟最低，但只支持 NVIDIA 生态 |
| **Ollama** | GGUF 量化 + llama.cpp | 本地开发/测试 | 一行命令拉模型运行，开发者体验最好 |
| **Triton Inference Server** | 多模型编排 + 动态批处理 | 企业级多模型服务 | 支持 TensorRT/PyTorch/ONNX 多后端 |

**vLLM 深入**：
- 架构：Scheduler（调度） → Worker（GPU 执行） → KV Cache Manager（内存管理）
- 部署：`python -m vllm.entrypoints.openai.api_server --model path/to/model --tensor-parallel-size 2`
- 核心优势：PagedAttention 几乎消除显存碎片；支持 Tensor Parallel（单模型跨多 GPU）；OpenAI 兼容 API

**SGLang 深入**：
- **RadixAttention**：用 Radix Tree（基数树）管理 KV Cache 前缀。多个请求共享相同的 System Prompt 前缀时，KV Cache 只计算一次，后续请求直接复用
- **结构化生成**：编译 JSON Schema 为有限状态机（FSM），在 token 采样时屏蔽不合法的 token，保证输出 100% 符合 Schema
- 适合 Agent 场景：Agent 的多次工具调用共享相同的系统指令前缀，RadixAttention 带来 3-5x 吞吐提升

> [!tip] 推理框架选型决策
> 通用生产部署 → vLLM；Agent/结构化输出密集 → SGLang；NVIDIA GPU 极致延迟 → TensorRT-LLM；本地开发测试 → Ollama。大多数情况下 vLLM 是安全的默认选择。

### 上下文窗口管理

**为什么 128k context 不等于真正能用 128k**：

1. **注意力稀释**：序列越长，每个 token 的注意力权重越分散，模型对早期内容的"关注度"下降
2. **Lost in the Middle**：模型对上下文开头和结尾记忆最好，中间部分容易被忽略
3. **位置编码外推**：超出训练长度后 RoPE 外推效果下降

**2025-2026 现状：问题依然存在，但有所改善**

这三个问题目前都没有被彻底解决，只是程度减轻了：

| 模型 | 标称窗口 | 实际可靠范围 |
|------|---------|------------|
| GPT-4o | 128K | ~20-30K |
| Claude 3.5/4 | 200K | ~100K（中间利用率有改善） |
| Gemini 2.5 Pro | 1M+ | 长文档任务表现最好，但成本和延迟高 |
| Llama 3.1+ | 128K | 长上下文性能弱于同规模闭源模型 |

**新技术方向（2024-2026）**：
- **KV Cache 压缩**：RocketKV 等方法可压缩 KV Cache 400 倍，性能损失极小，缓解了注意力稀释问题
- **稀疏注意力（Sparse Attention）**：不对所有 token 做全量 Attention，动态选择相关 token，降低 O(n²) 的计算压力
- **Infini-Attention**（Google，2024）：在有限内存内维护压缩的历史记忆 + 局部注意力，理论上支持无限上下文
- **混合线性注意力**（2026）：对远距离 token 用线性机制替代二次方 Attention，降低长序列计算量

**实践结论**：128k/1M 的上下文窗口更多是营销数字，工程上超过 50K token 的场景仍然需要 RAG + KV 压缩 + 分块处理组合使用。

**实践建议**：
- 重要信息放在 Prompt 开头或结尾
- 超过 50K token 的场景用 RAG 替代直接塞入
- 超长上下文用摘要压缩后再注入

---

## 五、大模型架构新趋势

### MoE（Mixture of Experts）

**核心思想**：稀疏激活——模型有很多"专家"（FFN 子网络），每个 token 只激活其中少数几个专家，而不是激活所有参数。

**Router 如何决定激活哪些专家**：不是向量相似度，而是一个线性层打分：

```
gate_scores = Linear(token_hidden_state)   # 对每个专家打一个分
top_k_idx   = TopK(gate_scores, k=2)       # 取分最高的 2 个专家
weights     = Softmax(gate_scores[top_k_idx])  # 归一化为权重
output      = sum(weights[i] * Expert_i(x))    # 加权求和
```

关键点：先 Top-K 再 Softmax（不是先 Softmax 再取 Top-K），这样权重只在被选中的专家之间归一化。

**负载均衡**：如果不加约束，Router 会倾向于总选同几个专家（专家坍塌）。常见解法是加辅助损失（auxiliary loss）惩罚不均匀分配。DeepSeek-V3 改用**偏置项调整**（bias-based balancing）代替辅助损失，效果更稳定。

**DeepSeek 系列规模**：

| 版本 | 总参数 | 激活参数 | 上下文 | 亮点 |
|------|--------|---------|--------|------|
| V3（2024年底） | 671B | 37B | 128K | MLA + 无辅助损失负载均衡 + FP8 训练 |
| V4-Pro（2026年4月） | 1.6T | 49B | 1M | 混合注意力机制，规模大幅提升 |
| V4-Flash（2026年4月） | 284B | 13B | 1M | 轻量版，适合低延迟场景 |

**工程挑战**：
- 负载均衡：避免专家坍塌
- 通信开销：分布式训练时专家分布在不同 GPU，需要 All-to-All 通信

### Mamba / SSM（状态空间模型）

**Transformer 的问题**：Self-Attention 的计算复杂度是 O(n²)，序列越长计算量越大。

**Mamba 的解决方案**：用状态空间模型（SSM）替代 Attention，计算复杂度是 O(n)（线性）。核心是一个递归状态更新机制，类似 RNN 但可以并行训练。

**Mamba vs Transformer**：

| 维度 | Transformer | Mamba |
|------|------------|-------|
| 计算复杂度 | O(n²) | O(n) |
| 长序列处理 | 内存和计算随序列长度平方增长 | 线性增长，适合超长序列 |
| 局部注意力 | 天然支持 | 需要特殊设计 |
| 训练稳定性 | 成熟 | 相对较新 |

**Hybrid 架构**：结合 Mamba（长程依赖）+ Transformer（局部注意力）+ MoE（稀疏计算），是当前研究热点。

### 国内主流开源大模型架构对比

**Qwen3（阿里千问，2025年）**：
- 同时提供密集模型和 MoE 变体（如 Qwen3-235B-A22B，235B 总参数 / 22B 激活）
- MoE 版每层 128 个专家，Top-K 路由，上下文 128K
- 独特设计：**单模型内统一 thinking/non-thinking 双模式**，通过 `<think>` 标签控制推理链开关，无需两个独立模型

**GLM-5（智谱 AI，2026年2月）**：
- 744B 总参数 / 40B 激活，80 层，256 个专家每次激活 8 个
- 集成 DeepSeek Sparse Attention（DSA），降低长上下文部署成本
- 训练数据 28.5T tokens

**MiniMax-Text-01（2025年1月）**：
- 架构最有特色：**混合注意力**——每 8 层中 7 层用 Lightning Attention（线性复杂度 O(n)），1 层用标准 Softmax Attention
- MoE：32 个专家 Top-2 路由，456B 总参数 / 45.9B 激活
- 上下文训练 1M token，推理可达 **4M token**（发布时最长）
- Lightning Attention 是线性注意力的高效实现，避免了标准注意力 O(n²) 的瓶颈，使超长上下文成本可控

| 模型 | 架构类型 | 总参数/激活 | 上下文 | 特色 |
|------|---------|-----------|--------|------|
| DeepSeek-V4-Pro | MoE | 1.6T / 49B | 1M | MLA + 混合注意力 |
| Qwen3-235B | MoE | 235B / 22B | 128K | thinking/non-thinking 统一切换 |
| GLM-5 | MoE | 744B / 40B | 200K | DSA 稀疏注意力 |
| MiniMax-Text-01 | MoE + 混合注意力 | 456B / 45.9B | 4M | Lightning Attention，超长上下文 |

### 多模态架构

**统一自回归**：文本、图像、音频用同一个 Transformer 生成，不同模态的 token 混合在一起训练（如 GPT-4o、Chameleon）。

**Transfusion**：文本用交叉熵损失，图像用扩散模型损失，同一个模型用两种损失函数混合训练，兼顾文本理解和图像生成。

---

## 六、Token 经济学

**Token 计算方式**：
- 英文：约 1 token ≈ 4 个字符 ≈ 0.75 个单词
- 中文：约 1 token ≈ 1-2 个汉字（取决于分词器）
- 代码：密度较高，约 1 token ≈ 3-4 个字符

**成本估算**：
- 输入 token 通常比输出 token 便宜（约 1/3 价格）
- 一次 Agent 任务（20 步，每步 2k token）≈ 40k tokens ≈ $0.04-0.12（取决于模型）

**Context 窗口使用策略**：
- 系统 Prompt：精简，只放必要的角色设定和约束（< 500 tokens）
- 工具描述：只加载当前任务需要的工具，不全量注入
- 历史对话：超过 10 轮后考虑摘要压缩
- 文档内容：用 RAG 按需检索，不直接塞入全文

## 相关链接

- [[Prompt Engineering]] — Prompt 工程与 Harness 进阶
- [[RAG基础与架构]] — RAG 是 LLM 落地的核心技术
- [[Agent 核心概念]] — Agent 是 LLM 的应用形态
- [[JVM JIT与字节码]] — JIT 编译优化与 LLM 推理优化的思想相通
