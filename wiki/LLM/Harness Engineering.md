# Harness Engineering

## 一、从 Prompt Engineering 到 Harness Engineering：三代进化

| 阶段 | 时间 | 核心关注 |
|------|------|---------|
| **Prompt Engineering** | 2022-2024 | 怎么写好一条指令（few-shot、CoT、角色扮演） |
| **Context Engineering** | 2025 | 为模型动态构建完整上下文（相关文件、历史对话、工具定义、知识库检索结果） |
| **Harness Engineering** | 2026 | 搭建整个运行环境——约束、反馈循环、架构规则、工具链、生命周期管理 |

类比：Prompt Engineering 是写好一封邮件。Context Engineering 是把相关附件都带上。Harness Engineering 是搭建整个工作环境，让 Agent 能持续、稳定、高质量地工作。

概念来源：Mitchell Hashimoto（HashiCorp 联合创始人、Terraform 缔造者），核心定义：

> 每当你发现 Agent 犯了一个错误，你就花时间去工程化一个解决方案，让它再也不会犯同样的错。

---

## 二、四大原则

Harness 的核心理念是**模型负责推理与决策，治理环境负责执行、约束与连接**：

1. **决策唯一性**：模型是决策的唯一来源，治理环境不介入逻辑分支，仅执行模型请求。
2. **工具接口化**：工具是模型与外部世界的唯一接口，所有动作必须通过类型化、Schema 验证的工具调用完成。
3. **上下文资源化**：对模型可见的上下文进行精细化管理、压缩和按需注入，而非把所有历史塞进 context window。
4. **权限声明化**：准入、拦截或审批逻辑定义在配置文件中，而非硬编码在程序里。

---

## 三、六大核心组件

一个完整的 Harness 包含六个部分，核心公式：**Agent = Model + Harness**

| 组件 | 职责 | 解决什么问题 |
|------|------|-------------|
| **标准化工具集成层** | 所有工具调用前加钩子，统一参数校验、权限检查、异常兜底 | 某个工具挂了不会让整个任务崩溃 |
| **上下文工程系统** | 用结构化状态替代聊天历史，每阶段有明确输入输出 | 长任务上下文越来越乱 |
| **状态持久化与任务调度** | 断点续传、Checkpoint 机制，任务状态全部持久化 | Agent 跑着跑着断了能恢复 |
| **子代理编排与隔离** | 复杂任务拆给多个子 Agent 并行，各自独立上下文 | 子 Agent 之间互相干扰 |
| **验证与安全防护层** | 生成前、调用前、输出前每道关口加校验 | 模型一抽风后果很严重 |
| **可观测性与审计** | 每一步有日志、追踪、告警 | 出问题能快速定位根因 |

一句话：让非确定性的模型，在确定性的框架里稳定运行。

### 三层上下文压缩机制

上下文工程系统的具体实现通常采用三层分层策略，平衡"即时精度"与"长期记忆"：

| 层级 | 策略 | 作用 |
|------|------|------|
| **第一层：逐字保留** | 保留最近 N 条消息（如 KEEP_RECENT = 6）不作任何处理 | 对当前讨论和刚发生的工具输出保持 100% 精确感知 |
| **第二层：智能摘要** | 超过字符阈值（如 40000 字符/10k Tokens）时，将较旧消息发给 LLM 压缩，要求提取"技术决策、文件路径、代码变更、待办事项"，剔除琐碎对话 | 节省 Token 的同时保留关键信息 |
| **第三层：持久化存储** | 将摘要写入磁盘文件（如 `.agent_memory.md`） | 实现"跨 Session 记忆"，程序重启后能找回之前的进度 |

---

## 四、Harness 为什么比模型本身更重要？

同一个模型，什么都没换，只换模型外面的运行环境，效果天差地别：

| 来源 | 实验 | 结果 |
|------|------|------|
| Nate B Jones | 同一模型，只换 Harness | 编程成功率 42% → 78% |
| LangChain | 同一 gpt-5.2-codex，换 Harness | Terminal Bench 52.8% → 66.5%，排名从 30+ 进前 5 |
| Anthropic | Solo 模式 vs Harness 模式 | Solo：20 分钟/$9，功能全坏；Harness：6 小时/$200，游戏能玩 |
| Terminal Bench 2.0 | Claude Opus 4.6 换 Harness | 排名从第 33 跳到第 5 |
| Pi Research | 一个下午修改 Harness | 提升了 15 个不同 LLM 的编程能力 |

结论：在当前节点，优化模型外面的壳，回报率比等下一代模型更高。

---

## 五、Generator-Evaluator 架构（Anthropic）

**核心问题：** 模型不会评价自己的工作。让 Agent 自评，它会自信地说"写得很好"，即使质量明显不行。

**解法：** 借鉴 GAN 思路，把生成和评估拆成两个独立 Agent：
- **Generator**：负责写代码/实现功能
- **Evaluator**：不是看截图打分，而是用 Playwright 真机操作——点页面、查 API、看数据库状态，像真人 QA 一样验收

**关键发现：** 开箱即用的 Claude 是一个很差的 QA Agent——会发现问题然后说服自己这不是大问题，倾向于做表面测试。需要多轮校准 evaluator 的严苛程度。但让独立 evaluator 变严格，远比让 generator 学会自我批评容易得多。

**完整架构：** Planner（需求展开为产品规格）→ Generator（按 sprint 逐功能实现）→ Evaluator（每个 sprint 结束后真机验收）

---

## 六、企业级实战经验

**OpenAI Codex 团队（5 个月，100 万行代码，全 Agent 生成）：**
- 仓库是 Agent 唯一的知识来源
- 代码不仅要对人类可读，更要对 Agent 可读
- 架构约束不靠 prompt，靠 linter
- 自主性得一步步给
- 如果 PR 需要大改才能合并，问题不在 Agent，在 Harness

**Stripe Minions（每周 1300+ PR，无人值守）：**
- Blueprint 编排：确定性节点（linter、推送）按固定路径执行不调模型，Agentic 节点（实现功能、修 CI）让模型判断
- CI 最多跑两轮，第一轮失败 Agent 自动修复再跑一次，还失败直接转人类
- 500 个 MCP 工具，但每个 Agent 只给精心筛选的子集——更多工具不等于更好表现

**Cursor 的教训（递归 Planner-Worker 模型）：**
- 第一版单 Agent → 复杂任务扛不住
- 第二版多 Agent 共享状态 → 锁竞争，Agent 互相打架
- 第三版结构化角色 → 太僵硬
- 第四版持续执行器 → 角色过载
- 最终版：递归 Planner-Worker
- 关键发现：约束解空间，反而让 Agent 更有生产力

---

## 七、Harness 会被淘汰吗？

**反对观点（Noam Brown，OpenAI）：** Harness 是拐杖，统一模型终将超越。推理模型出来后，之前搭的复杂 Agentic 系统一夜之间不需要了。

**Anthropic 的判断：** Harness 的可能性空间不会缩小，只会平移。模型变强了，旧约束可以拆掉（如 Opus 4.6 不再需要 sprint + context reset），但新的更高阶约束空间打开了（如 4 小时自主开发任务需要新的反馈和验收机制）。

**事实佐证：** Manus 6 个月重构 5 次 Harness，LangChain 一年重新架构 3 次研究型 Agent，Vercel 砍掉 80% 的 Agent 工具。Harness 不是一次性工程，是持续演化的系统。

> 来源：[Anthropic说：不要在等下一代模型了，立刻马上做Harness！](https://mp.weixin.qq.com/s?__biz=MzkxNjcyNTk2NA==&mid=2247491751&idx=1&sn=a46776aeac4344bc9b82fedb8006a582&chksm=c0df4a5feae65afd3f1e6070d9b0ac6225b503e78c34b671bf7ec6e4c6c63cf1aa3d97fc40e5&mpshare=1&scene=24&srcid=0325NU2lUQ4h2TGFWqnHFCEB&sharer_shareinfo=04477679b266aa971df147192955c7df&sharer_shareinfo_first=04477679b266aa971df147192955c7df#rd)

---

## 八、DESIGN.md：Harness 在 UI 层面的实践

AGENTS.md 告诉 Agent 怎么构建项目，**DESIGN.md** 告诉 Agent 项目应该长什么样——Google Stitch 提出的概念，专门给 AI Agent 读的纯文本设计系统文档。

**awesome-design-md** 项目从 Stripe、Vercel、Apple、Linear 等 31+ 真实网站提取设计系统（色彩体系、字体层级、��件样式、间距系统、Do's and Don'ts），转成约 300-400 行的 Markdown 文件。把文件丢进项目根目录，Agent 生成的 UI 就能严格遵循该设计规范。

本质上就是 Harness 的审美约束层——和上面 Stripe "给每个 Agent 精心筛选工具子集"、OpenAI "架构约束靠 linter 不靠 prompt" 一脉相承：**把约束写成规格书，比在 prompt 里反复描述有效得多。**

> 项目地址：https://github.com/VoltAgent/awesome-design-md

---

## 九、落地路径

从性价比来看，建议从工具层开始，逐步演进：

| 层级 | 做什么 | 改造成本 | 解决什么 |
|------|--------|---------|---------|
| **工具层** | 工具调用前后加拦截器（参数校验、权限检查、日志记录） | 低 | "一着不慎满盘皆输" |
| **框架层** | 引入现成 Harness 框架（DeerFlow、Claude Code 执行框架） | 中 | 状态管理、断点续传、子代理编排 |
| **平台层** | 搭建统一 Agent 运行时平台（集中配置、调度、监控、审计） | 高 | 大量 Agent 的统一管理 |

---

## 十、相关开源项目

### 字节 DeerFlow 2.0（54k Star）

字节开源的 Agent Harness 实现，三个核心特点：

1. **子代理沙箱隔离**：每个子 Agent 在独立沙箱运行（独立文件系统、网络隔离、资源限制），一个搞坏了不影响其他的，也不污染主环境。
2. **结构化任务状态**：不再把所有对话塞进 context，而是把任务状态抽象成清晰的数据结构（当前阶段、已完成步骤、待办事项、依赖关系），模型只读结构化数据。
3. **可插拔工具链**：工具调用封装成标准接口，支持热插拔，新增工具不需要改框架代码。

> 项目地址：https://github.com/bytedance/deer-flow

> 来源：[字节开源的 Harness Agent 火爆全网，已狂飙 54k+ Star](https://mp.weixin.qq.com/s?__biz=MzUxNzAzMTU4OQ==&mid=2247486850&idx=1&sn=86f4faa1227e628656ddf808069b0a30&chksm=f8db67f9738b5f562da6ec42a406271ec3476d2b282631b809e57c40198caeea37695424e1be&mpshare=1&scene=24&srcid=040129NT9gcbbFwD27FHnzSz&sharer_shareinfo=b71982cf0d4b072881a01d2f67caf694&sharer_shareinfo_first=b71982cf0d4b072881a01d2f67caf694#rd)

### GitNexus：代码库知识图谱引擎

**解决的问题：** AI 编程工具（Claude Code、Cursor、Codex）在修改代码时缺乏对项目整体架构的理解，容易盲目修改导致连锁问题。

**核心方案：** 用 Tree-sitter AST 解析把整个代码库索引成知识图谱——映射所有函数调用、导入关系、类继承、接口实现，然后通过 MCP 协议暴露给 AI Agent，让 Agent 在修改代码前能"看懂"项目架构。

**关键能力：**
- 从入口点追踪完整调用链
- 修改任何一行代码前执行影响范围分析（哪些进程会受影响）
- 按内聚评分将相关代码分组为功能簇
- 自动从知识图谱生成代码库文档

**和 DeepWiki 的区别：** DeepWiki 帮你"理解"代码（生成描述），GitNexus 让你"分析"代码（记录所有关系）。知识图谱记录的是结构化关系，不仅仅是自然语言描述。

**本质：** 给 Agent 提供代码上下文的基础设施，让较小的模型也能获得大模型级别的架构理解能力。

> 项目地址：https://github.com/abhigyanpatwari/GitNexus
> 在线体验：https://gitnexus.vercel.app

### claude-code-from-scratch：23 阶段 Harness 实现

**解决的问题：** Harness Engineering 概念虽火，但缺乏从零到生产级的完整实现路径作为参考。

**核心方案：** 通过 23 个递进式 Session 脚本，逐步构建一个仿 Claude Code 的智能体系统，每个 Session 只新增一个核心概念，代码控制在 40-150 行：

| 阶段 | 关键特性 |
|------|---------|
| **基础层** | 感知-动作循环、工具调度映射、TodoWrite 规划 |
| **增强层** | 子智能体上下文隔离、按需技能加载、三层上下文压缩 |
| **协作层** | 基于文件的任务图（DAG）、后台任务、持久化邮箱的智能体团队 |
| **进阶层** | 自动任务认领、Git Worktree 隔离、实时 Token 流式传输 |
| **生产治理层** | YAML 权限管理、事件总线、会话持久化与分支、MCP 运行时集成 |
| **优化层** | 并行工具执行、中断注入、Anthropic Prompt Caching |

**亮点设计：**
- **DAG 任务图**：`.agent_tasks.json` 作为事实来源，支持 `depends_on` 字段定义任务依赖
- **Git Worktree 隔离**：每个并行任务在独立 Git 分支和工作目录中执行，避免文件冲突
- **YAML 权限治理**：always_deny / always_allow / ask_user 三级，支持对工具名和操作目标联合检查
- **Redis Pub/Sub 通信**：替代基于文件的轮询，实现毫秒级跨智能体消息传递

**适用场景：** 想自己实现一套生产级 Agent 系统、理解 Claude Code 内部机制、或者作为 Harness 学习路线图的参考实现。

> 项目地址：https://github.com/FareedKhan-dev/claude-code-from-scratch

> 来源：[小白剖析Claude Code：基于Harness Engineering 智能体系统](https://mp.weixin.qq.com/s?__biz=MzIwNDA5NDYzNA==&mid=2247511570&idx=1&sn=4de78a89b6b9793b0bfa29e9ad92426a&chksm=97f2689a75d3a9bc44d0ebc1316799103d121268cd198f2df2cca66f0acf245bbde70b7f2399&mpshare=1&scene=24&srcid=04086fH5u1mTMY9RpkP44I1O&sharer_shareinfo=699f02024605e87cc162c44a7b8ddfad&sharer_shareinfo_first=699f02024605e87cc162c44a7b8ddfad#rd)
