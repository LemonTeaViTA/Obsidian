---
module: SageCLI
type: project
tags: [SageCLI, Agent, 项目笔记]
last_reviewed: 2026-07-22
---

# 终端渲染与 TUI

**是什么**：流式输出的终端渲染层，让 LLM 输出像打字机一样实时显示，并保持底部状态栏固定。

**为什么**：LLM 流式输出需要实时更新同一行而不是每次滚动刷新，普通 println 做不到。

**怎么做**：
- JLine 4 提供终端控制能力，用 ANSI escape codes 控制光标位置和文本样式
- 底部状态栏：固定在终端最后几行，显示当前 token 用量、模型名、工具执行状态
- live thinking 区：显示 LLM reasoning 内容，可折叠，迟到的 reasoning 在 finish 后补充展示
- 流式输出时原地更新同一行，避免大量空白滚动

**关键权衡**：不用 TUI 框架（如 Lanterna），全部手写 ANSI 控制——轻量、无额外依赖，但复杂布局变更时维护成本高。

---

## 面试 Q&A

**Q：为什么 reasoning 内容需要特殊处理？**
某些模型（如 DeepSeek）的 reasoning 和 content 可能交错下发，甚至 reasoning 在 content 之后才到。需要缓冲迟到的 reasoning，在 finish 时单独展示，否则输出顺序会混乱。

**Q：底部状态栏固定怎么实现？**
每次更新内容时，用 ANSI 转义码保存光标位置、跳到底部写状态栏、再恢复光标位置继续输出内容，对用户看起来像是状态栏始终固定在底部。
