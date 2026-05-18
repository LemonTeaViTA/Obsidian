---
module: LLM
tags: [LLM, AI编程, Claude Code, Codex, Cursor, 知识管理]
difficulty: medium
last_reviewed: 2026-05-18
---

# AI 编程工具

> 本文对比主流 AI 编程工具（Claude Code、Codex、Cursor），分析它们与传统 IDE 的本质区别。

---

## 一、AI 编程工具 vs 传统 IDE

**传统 IDE**（VS Code、IntelliJ）：工具辅助人写代码，人是主体。IDE 提供语法高亮、自动补全、调试器，但每一步操作都由人发起和决策。

**AI 编程工具**：AI 是主体，工具是 AI 的执行环境。开发者描述目标，AI 自主规划步骤、调用工具、执行代码、验证结果。

**三个核心差异**：

| 维度 | 传统 IDE | AI 编程工具 |
|------|---------|-----------|
| 控制权 | 人控制每一步 | AI 自主决策，人审批关键节点 |
| 上下文感知 | 当前文件 | 整个代码库 + 文档 + 历史对话 |
| 工具调用 | 人手动操作 | AI 自主调用（搜索、执行、测试） |

---

## 二、Claude Code（Anthropic）

### 核心特点

- **CLI 优先**：命令行工具，不依赖 IDE，可在任何终端环境运行
- **Harness Engineering 理念**：整个工具是一套精心设计的 Harness，包含工具权限控制、上下文压缩、循环控制
- **Skills 体系**：通过 Skills 封装可复用的工程经验，团队共享最佳实践
- **23 阶段递进式架构**：从基础感知-动作循环到 Redis Pub/Sub 通信，完整的 Harness 实现

### 2026 Q1 新特性

- **Remote Control**：手机端通过 Dispatch 继续控制本地 Agent 任务，不需要坐在电脑前
- **/loop**：定时循环执行 Agent 任务（类似 cron），支持自定义间隔
- **Multi-Agent 并行**：多个子 Agent 并行处理不同代码模块，主 Agent 协调汇总
- **Computer Use**：Agent 可以操作浏览器和 GUI，不只是命令行

### 适用场景

复杂工程任务（重构、跨文件修改、调试复杂 bug）、需要深度代码理解的场景、团队共享工程经验。

> 架构细节见 [[LLM/Harness Engineering#十、相关开源项目]]

---

## 三、Codex（OpenAI）

### 核心特点

- **云端执行**：任务在 OpenAI 的云端沙箱中运行，不占用本地资源
- **沙箱隔离**：每个任务在独立容器中执行，安全隔离
- **并行任务**：支持同时运行多个独立任务，异步返回结果
- **CI/CD 集成**：可以接入 GitHub Actions，自动处理 PR 和 Issue

### 五条工程经验（来自 OpenAI 内部实践）

1. 任务描述越具体，完成质量越高——模糊的需求会导致模糊的结果
2. 把大任务拆成小任务，每个任务有明确的验收标准
3. 测试用例是最好的任务描述——有测试的任务完成率显著更高
4. 失败是正常的，设计好重试和回滚机制
5. 人工审查不能省——Agent 生成的代码需要人工 review，尤其是安全相关代码

### 适用场景

大规模代码生成、CI/CD 自动化、不需要本地环境的任务。

> 详细实战经验见 [[LLM/Harness Engineering#六、企业级实战经验]]

---

## 四、Cursor

### 核心特点

- **IDE 集成**：基于 VS Code 的 AI 原生 IDE，保留完整的 IDE 体验
- **Composer**：多文件编辑模式，一次修改跨越多个文件
- **Rules 系统**：在 `.cursorrules` 文件里定义编码规范，Agent 自动遵守

### Cursor 3（2026.4）新特性

- **Agent-First 架构**：Agent 成为主界面，而不是辅助功能
- **并行多 Agent**：单个 prompt 可启动最多 8 个 Agent 并行工作，用 git worktree 隔离各自的工作区
- **Automations**：后台 Agent 持续运行，无需人工触发，自动处理 PR review、测试失败等事件

### 五代架构演进

Cursor 的架构演进是 Harness Engineering 的典型案例：

1. **第一代**：简单的代码补全，类似 Copilot
2. **第二代**：加入对话功能，可以解释代码
3. **第三代**：Composer 多文件编辑，Agent 可以修改多个文件
4. **第四代**：工具调用，Agent 可以执行命令、运行测试
5. **第五代**：并行多 Agent，后台自动化

关键发现：**约束解空间反而提升生产力**——给 Agent 明确的规则（Rules）和边界，比给它完全自由的效果更好。

> 详细演进见 [[LLM/Harness Engineering#六、企业级实战经验]]

---

## 五、这些工具如何使用 MCP 和 CLI

**MCP（Model Context Protocol）**：AI 编程工具通过 MCP 接入外部能力——代码库索引、数据库查询、CI/CD 系统、文档系统。MCP 是标准化的工具接入协议，工具只需实现一次，所有支持 MCP 的 AI 工具都能调用。

> MCP 详细介绍 → [[LLM/Agent核心概念#四、MCP 协议]]

**CLI 设计**：Claude Code 和 Codex 本身就是 CLI 工具。好的 AI 编程工具 CLI 的特点：非交互式（所有参数一次性传入）、JSON 输出（AI 直接解析）、支持 `--dry-run` 预览危险操作。

> CLI 设计原则 → [[LLM/Agent工程实践#三、CLI 设计]]

## 六、Claude Code 概念体系

Claude Code 的能力通过六层概念组织，从简单到复杂递进：

### 6.1 Commands（命令）

用户直接输入的 prompt 驱动 Agent 行为。可复用命令存储在 `.claude/commands/` 目录，通过 `/` 前缀调用。命令本质是预定义的 prompt 模板，适合高频重复操作。

### 6.2 Skills（技能）

比 Command 更重的封装单元，将复杂标准化流程封装为 SOP。与 Command 的关键区别：==Skill 可被 Claude Code 根据上下文自动调用==，无需用户显式触发。Skill 定义包含触发条件、执行步骤、输出格式。

### 6.3 Rules（规则）

加载到每次 LLM 请求中的持久化指令。存储位置：
- `.claude/CLAUDE.md` — 项目级规则
- `.claude/rules/` 目录 — 按文件分类的规则集

支持**路径作用域**：规则可限定只对特定路径生效（如仅对 `src/api/**/*.ts` 应用 API 编码规范），避免全局规则污染无关上下文。

### 6.4 Hooks（生命周期钩子）

在 Agent 执行的关键节点插入自定义逻辑：
- `pre_session` / `post_session` — 会话开始/结束时触发
- `pre_tool` / `post_tool` — 工具调用前后触发

典型用法：会话结束时压缩上下文并持久化、工具调用后自动通知、下次会话自动恢复压缩的上下文。

### 6.5 Subagents（子代理）

独立的 Agent 实例，拥有自己的上下文窗口、Skills、MCP、权限和模型配置。核心价值是==上下文隔离==：主 Agent 的上下文不会被子任务的大量中间结果污染，节省 token 同时提升准确率。

存储在 `.claude/agents/` 目录，通过自然语言或 `@agent_name` 语法调用。注意：子代理定义过多会膨胀系统 prompt。

### 6.6 Plugins（插件）

将 Commands + Skills + Subagents 打包为面向特定工作流的完整解决方案。Plugin 是 Claude Code 生态的分发单元，一个 Plugin 解决一类问题（如"文档发布到多平台"）。

---

## 七、AI 辅助知识管理方法论

> [!tip] 来源启发
> 以下方法论提炼自 Karpathy 的 AI 知识库实践和 Obsidian 社区的深度思考。

### 7.1 三层架构

| 层 | 角色 | 说明 |
|---|------|------|
| raw | 原料层（AI 只读） | 原始文章、笔记、剪藏，AI 不修改 |
| wiki | 知识层（AI 维护） | 结构化的知识库，AI 负责摄入、组织、更新 |
| schema | 规则层 | 定义 AI 的行为边界和组织规范 |

AI 在此架构中执行三种操作：**digest**（摄入新原料到 wiki）、**query**（基于 wiki 回答问题）、**lint**（健康检查：发现矛盾、孤立节点、过时内容）。

### 7.2 "两个大脑"分离原则

将知识库分为两个独立空间：

- **个人思考库**（内脑）：深度内化的知识，经过自己思考和验证，追求深度
- **AI 研究库**（外脑）：AI 辅助收集整理的广度知识，追求覆盖面和速度

混合两者会导致个人库被未消化的机器输出膨胀，降低知识密度。

### 7.3 知识代谢循环

知识管理是持续的代谢过程，不是一次性产出：

采矿（收集原料）→ 破碎筛选（过滤噪音）→ 冶炼提纯（提取核心知识点）→ 锻造成型（结构化输出）

每个阶段都需要人类主动注入"能量"（判断、筛选、追问），纯自动化流水线产出的是信息堆积而非知识。

---

## 相关链接

- [[Agent核心概念]] — AI 编程工具本质是 Coding Agent
- [[Harness Engineering]] — Harness 思想驱动 AI 编程工具设计
