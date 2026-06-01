---
module: Agent
tags: [Agent, AI编程, Claude Code, Codex, Cursor]
difficulty: medium
last_reviewed: 2026-06-01
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

## 二、产品形态：CLI / IDE 插件 / 桌面应用

§一讲的是==功能层==差异。这一节讲==形态层==——AI 编程工具长什么样、跑在哪儿、怎么用。==2025-2026 年的明显趋势：Power user 的 AI 工具集体往 CLI 迁移==。

### 2.1 三种主流形态

| 形态 | 代表产品 | 宿主环境 | 控制方式 |
|------|---------|---------|---------|
| ==CLI== | Claude Code、Codex CLI、Aider、Goose | 终端（任何 shell） | 命令行交互 / 非交互式调用 |
| ==IDE 插件== | GitHub Copilot、Continue、Cline、Roo Code | VS Code / IntelliJ / Vim | 插件 UI（侧边栏、inline）|
| ==桌面应用== | Cursor、Windsurf、Zed | 自建 / Fork 编辑器 | 完整原生 UI |

> [!info] CLI 形态内部还有细分
> CLI 形态本身分 inline 流式 TUI / 全屏 TUI / 非交互 CLI / plain 兜底——详见 [[Coding Agent TUI 设计]]。Claude Code / Qoder / Aider / Goose 默认都是 ==inline 流式 TUI==(状态栏 + 折叠工具块 + 行内 diff)。

### 2.2 为什么 Agent 时代偏向 CLI

==CLI 和 Agent 工程是天作之合==——不是巧合，是六个工程优势叠加：

==①  Agent 的工作就是"执行命令"==
Agent 要读文件、跑测试、调 git、运行 shell——==这些本来就是 CLI 的活==。CLI 工具自己就在终端里，==执行子命令是零成本==。在 IDE 插件里跑 `npm test` 反而要绕一层 IDE API。

==②  终端是跨平台跨编辑器的最大公约数==
Mac/Linux/Windows 都有终端，VS Code/IntelliJ/Vim 用户都能用。==插件却必须为每个 IDE 单独写一份==——Copilot 维护 VS Code/JetBrains/Neovim 三套插件，工程成本极高。

==③  远程开发天然支持==
SSH 进服务器、跑在 Docker 容器、跑在 GitHub Codespaces——==CLI 一行命令就能用==。IDE 插件依赖宿主 IDE，远程要么靠 Remote-SSH、要么直接不可用。

==④  容易组合（Unix 哲学）==

```bash
# Claude Code 一行命令完成任务，可塞进任何脚本/CI
claude -p "fix the failing tests in api/auth/"

# 可以管道串起来
git diff main | claude -p "review this diff for security issues"
```

==IDE 插件做不了这种事==。

==⑤  CI/CD 天然==
GitHub Actions / Jenkins / GitLab CI 都是 shell——==CLI 工具可以直接被 CI 调用==做自动 PR、自动修 bug、自动写测试。Cursor 这种桌面应用就做不到。

==⑥  Agent 不需要"看屏幕"==
传统 IDE 插件的优势是 UI（inline diff、悬浮提示、code lens）。但==Agent 是看代码做决策的，不需要这些 UI==——Agent 直接读 AST/文本，UI 反而是给人看的。==给人看的 UI 在 Agent 时代价值打折==。

### 2.3 CLI 的代价

==劣势==：
- ==diff 体验差==——Cursor 的 inline diff 一眼能看 LLM 改了啥，CLI 终端里 diff 难读
- ==新手门槛==——非程序员用不来 CLI（但 AI 编程工具的目标用户本来就是程序员）
- ==没有富 UI==——画图、表格、可视化都受限

所以 ==Cursor / Windsurf 这种桌面应用没死==——他们在"AI 主导但保留 IDE 体验"这条路上，对==非 power user 友好==。

### 2.4 趋势判断：两条平行赛道

```
程序员 power user  →  CLI 路线（Claude Code / Codex / Aider）
                      容易组合、远程友好、CI 友好
                      "Agent 即 shell 命令"

普通开发者         →  桌面应用路线（Cursor / Windsurf）
                      富 UI、低门槛
                      "Agent 即编辑器"
```

==被夹击的中间态==：==Copilot 这种纯 IDE 插件==正在被两边挤压——上不如 Cursor 原生集成，下不如 Claude Code 灵活。这也是 GitHub 在 2025 年加快推 Copilot Workspace（独立 Web 界面）的原因——==想从纯插件升级为独立产品==。

### 2.5 CLI 的设计原则（给"我也想做一个 CLI 工具"的人）

好的 AI 编程工具 CLI 应该满足：
- ==非交互式==：所有参数一次性传入，能被脚本调用（`claude -p "..."` 而不是必须进入交互模式）
- ==JSON 输出==：可选 `--output-format=json`，让另一个 Agent / 脚本能直接解析
- ==`--dry-run`==：危险操作（删文件、推代码）支持预览模式
- ==可被管道==：stdin 接收输入、stdout 输出结果，符合 Unix 哲学

> CLI 设计的更深论述 → [[Agent 工程实践#三、CLI 设计]]

---

## 三、Claude Code（Anthropic）

### 核心特点

- **CLI 优先**：命令行工具，不依赖 IDE，可在任何终端环境运行
- **Harness Engineering 理念**：整个工具是一套精心设计的 Harness，包含工具权限控制、上下文压缩、循环控制
- **Skills 体系**：通过 Skills 封装可复用的工程经验，团队共享最佳实践
- **递进式架构**：从基础感知-动作循环到多进程通信，逐层叠加的 Harness 实现

### 代表性能力方向

> [!note] 下列是代表性能力方向，非精确 changelog——具体特性名/版本随产品迭代变化快，以官方文档为准。

- **远程接管**：手机端继续控制本地 Agent 任务，不需要坐在电脑前
- **定时循环**：定时循环执行 Agent 任务（类似 cron）
- **Multi-Agent 并行**：多个子 Agent 并行处理不同代码模块，主 Agent 协调汇总
- **Computer Use**：Agent 可以操作浏览器和 GUI，不只是命令行

### 适用场景

复杂工程任务（重构、跨文件修改、调试复杂 bug）、需要深度代码理解的场景、团队共享工程经验。

> 架构细节见 [[LLM/Harness Engineering#十、相关开源项目]]

---

## 四、Codex（OpenAI）

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

## 五、Cursor

### 核心特点

- **IDE 集成**：基于 VS Code 的 AI 原生 IDE，保留完整的 IDE 体验
- **Composer**：多文件编辑模式，一次修改跨越多个文件
- **Rules 系统**：在 `.cursorrules` 文件里定义编码规范，Agent 自动遵守

### Cursor 的 Agent-First 演进

> [!note] 代表性方向，非精确版本/数字——以官方为准。

- **Agent-First 架构**：Agent 成为主界面，而不是辅助功能
- **并行多 Agent**：单个 prompt 可启动多个 Agent 并行工作，用 git worktree 隔离各自的工作区
- **后台自动化（Automations）**：后台 Agent 持续运行，无需人工触发，自动处理 PR review、测试失败等事件

### 架构演进的主线

Cursor 的架构演进是 Harness Engineering 的典型案例，主线是==能力逐层叠加==：

1. **代码补全**：类似早期 Copilot
2. **对话能力**：可以解释代码
3. **多文件编辑（Composer）**：Agent 可以修改多个文件
4. **工具调用**：Agent 可以执行命令、运行测试
5. **并行多 Agent + 后台自动化**

关键发现：**约束解空间反而提升生产力**——给 Agent 明确的规则（Rules）和边界，比给它完全自由的效果更好。

> 详细演进见 [[LLM/Harness Engineering#六、企业级实战经验]]

---

## 六、MCP 接入：AI 编程工具的能力扩展协议

==MCP（Model Context Protocol）==：AI 编程工具通过 MCP 接入外部能力——代码库索引、数据库查询、CI/CD 系统、文档系统。MCP 是标准化的工具接入协议，==工具只需实现一次，所有支持 MCP 的 AI 工具都能调用==。

==实际应用==：Claude Code 内置 MCP 客户端，可接入 GitHub MCP（管理 issue/PR）、Filesystem MCP（受控文件访问）、Postgres MCP（数据库查询）。Cursor、Windsurf、Continue 也都已原生支持 MCP，==MCP 是 AI 编程工具生态的事实标准==。

> MCP 协议详细介绍 → [[Agent 核心概念#四、MCP 协议]]
>
> CLI 设计原则见 §2.5（前面）+ [[Agent 工程实践#三、CLI 设计]]

## 七、Claude Code 概念体系

Claude Code 的能力通过六层概念组织，从简单到复杂递进：

### 7.1 Commands（命令）

用户直接输入的 prompt 驱动 Agent 行为。可复用命令存储在 `.claude/commands/` 目录，通过 `/` 前缀调用。命令本质是预定义的 prompt 模板，适合高频重复操作。

> ==实现机制详解==(Host 拦截斜杠命令 / 三种实现风格 / Markdown 即 Prompt / Tool/Command/Skill 三层关系)见 [[Coding Agent 工具集#五、Commands / Skills:Tool 的上层封装]]。

### 7.2 Skills（技能）

比 Command 更重的封装单元，将复杂标准化流程封装为 SOP。与 Command 的关键区别：==Skill 可被 Claude Code 根据上下文自动调用==，无需用户显式触发。Skill 定义包含触发条件、执行步骤、输出格式。

### 7.3 Rules（规则）

加载到每次 LLM 请求中的持久化指令。存储位置：
- `.claude/CLAUDE.md` — 项目级规则
- `.claude/rules/` 目录 — 按文件分类的规则集

支持**路径作用域**：规则可限定只对特定路径生效（如仅对 `src/api/**/*.ts` 应用 API 编码规范），避免全局规则污染无关上下文。

### 7.4 Hooks（生命周期钩子）

在 Agent 执行的关键节点插入自定义逻辑：
- `pre_session` / `post_session` — 会话开始/结束时触发
- `pre_tool` / `post_tool` — 工具调用前后触发

典型用法：会话结束时压缩上下文并持久化、工具调用后自动通知、下次会话自动恢复压缩的上下文。

### 7.5 Subagents（子代理）

独立的 Agent 实例，拥有自己的上下文窗口、Skills、MCP、权限和模型配置。核心价值是==上下文隔离==：主 Agent 的上下文不会被子任务的大量中间结果污染，节省 token 同时提升准确率。

存储在 `.claude/agents/` 目录，通过自然语言或 `@agent_name` 语法调用。注意：子代理定义过多会膨胀系统 prompt。

### 7.6 Plugins（插件）

将 Commands + Skills + Subagents 打包为面向特定工作流的完整解决方案。Plugin 是 Claude Code 生态的分发单元，一个 Plugin 解决一类问题（如"文档发布到多平台"）。

---

## 八、AI 辅助知识管理方法论

> [!info] 该内容已迁移，见 方法论-AI辅助知识管理
> 「AI 辅助知识管理方法论」（三层架构 / "两个大脑"分离 / 知识代谢循环）与"AI 编程工具产品对比"主题无关，已迁出到知识库管理方法论文档（阶段2 整合为正式链接）。

---

## 相关链接

- [[Agent 核心概念]] — AI 编程工具本质是 Coding Agent
- [[Harness Engineering]] — Harness 思想驱动 AI 编程工具设计
