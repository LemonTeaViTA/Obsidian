export const meta = {
  name: 'wiki-fix-phase2-recovery',
  description: 'Phase-2 恢复：整合暂存 + MOC 统一 + 全局改链 + 验收 + 归档追加（Phase 1 已完成于 ead7072，不重跑）',
  phases: [
    { title: 'Integrate-MOC', detail: '并行：整合暂存内容(2A) + 统一/新建 MOC(2B)' },
    { title: 'Relink', detail: '单一所有者：全仓库改链（76+ 死链 + 跨域 + 锚点漂移）' },
    { title: 'Verify-Archive', detail: '重跑机械检查 + 优化记录追加 + 修复总报告更新' },
  ],
}

const BASE = '/home/ubuntu/ADgai/dsq/Obsidian'
const AUD = BASE + '/wiki审计'
const LOG = AUD + '/_修复日志'
const STAGE = AUD + '/_迁移暂存'

const NOTE = '注意：本次只跑 Phase 2 之后的恢复工作。Phase 1 的 21 领域文件夹内修复已完成并 commit 于 git 分支 wiki-fix-p0p1 (HEAD ead7072)，禁止重做。'

// 2A 整合暂存
const integratePrompt = `你是【内容整合 agent】。工作目录：${BASE}。${NOTE}

阶段1把 3 块跨域内容写到了 ${STAGE}/，请整合并入目标：
1. 用 ls 和 Read 把 ${STAGE}/ 下所有 .md 读一遍，了解每块内容。
2. 整合规则：
   - ${STAGE}/方法论-AI辅助知识管理.md → 并入 ${BASE}/wiki-管理方法论.md（找到合适章节插入，去重，与现有结构融合）。
   - ${STAGE}/RAG-FTS5与分块教程.md (~362行) → 并入 wiki/RAG/ 合适文件。这是通用 RAG 教程内容（FTS5/倒排/BM25/分块）。可以并入 wiki/RAG/分块策略.md 或 wiki/RAG/RAG基础与架构.md 的合适章节；也可以新建独立文件如 wiki/RAG/全文检索与分块教程.md。请按内容判断哪种最合理（避免再让目标文件超长）。
   - ${STAGE}/RAG-延迟优化策略.md (~34行) → 并入 wiki/RAG/ 相关检索/基础文件（如 RAG基础与架构.md 或 RAG检索策略.md 合适章节）。
3. 整合后【删除】已消费的暂存文件（用 Bash rm）。
4. 整合时务必：补/保留 frontmatter；保持目标文件 Diátaxis 类型一致；不要让目标文件 >800 行。
5. 用 Write 把"哪段内容最终落到哪个文件的哪节、新建了什么文件、产生了哪些新锚点(章节标题)"详细记录到 ${LOG}/_阶段2A整合.md。

铁律：不要碰任何 MOC/索引文件（阶段2B处理）；不要碰 wiki/面试题目.md（阶段2C处理）；不要碰除目标外的其他文件。

返回 4-6 句话：每个暂存文件去了哪、有哪些新锚点、整合后目标文件多少行。`

// 2B MOC 统一
const mocPrompt = `你是【MOC/索引维护 agent】。工作目录：${BASE}。${NOTE}

Phase 1 已对各域做了拆分/重组，新文件已在磁盘上。请统一处理全部 MOC 与缺失 MOC：

1. 先用 Bash 列出 wiki/ 下每个域当前【实际存在】的全部 .md 文件（这是事实基础）：
   find wiki -maxdepth 2 -name '*.md' | sort
2. 找到现有 MOC 文件（*_MOC.md / 索引.md），用 Read 确认其内容：
   find wiki -name '*MOC*.md' -o -name '*索引*.md'
3. 更新每个现有 MOC，使其覆盖本域当前实际全部文件（含 Phase 1 新拆出的文件）、移除已删/已改名的文件链接、补漏（如 Agent 索引_MOC 缺 Agent 工程实践、新拆出的 MCP Server 生态.md / MCP 安全模型.md / Plan 模式家族对比.md；算法_MOC 需含 动态规划-背包.md / 动态规划-多维.md；Java基础 需含 面向对象核心/类成员与关键字/对象语义；RAG 需含 RAG查询理解.md；Redis 需含 Redis 实战场景.md；并发 需含 线程通信与同步.md；LLM 需含 Function Calling 多模态.md；计算机网络 需含 Agent传输方式.md）。
4. 为缺 MOC 的 4 个域新建：
   - wiki/文档解析/文档解析_MOC.md
   - wiki/数据格式/数据格式_MOC.md
   - wiki/操作系统/操作系统_MOC.md
   - wiki/PaiFlow/PaiFlow_MOC.md
   每个 MOC 列本域所有文件+一句定位，加 frontmatter。
5. 孤儿页 wiki/Git.md（若存在）挂进一个合适 MOC（看内容判断）。
6. 用 Write 记录到 ${LOG}/_阶段2B_MOC.md：哪些 MOC 改了什么、哪些 MOC 是新建的、各 MOC 覆盖了几个文件。

铁律：不要改任何非 MOC 的正文文件；不要碰 wiki/面试题目.md。
返回 4-6 句话总结：更新了哪些 MOC、新建了哪些 MOC、覆盖完整性如何。`

// 2C 全局改链（依赖 2A/2B，最后跑，看到最终结构）
const relinkPrompt = `你是【全局改链 agent】——全仓库 wikilink/锚点的唯一修复者。工作目录：${BASE}。${NOTE}

此前：Phase 1 已完成域内拆分（新文件名见磁盘）；2A 整合记录于 ${LOG}/_阶段2A整合.md；2B MOC 记录于 ${LOG}/_阶段2B_MOC.md。

【关键】Phase 1 有部分 agent 未写修复日志，所以你不能完全依赖日志。请【以磁盘当前状态为唯一真相源】，方法：

步骤一 · 摸底
- 用 find 列出 wiki/ 下所有 .md 文件名（这是所有合法 wikilink 目标）。
- 用 grep 抽取全仓库的所有 wikilink: \`grep -rohE '\\[\\[[^\\]]+\\]\\]' wiki/ | sort -u\`，分析坏链。
- 用 Read 加载 ${AUD}/链接同步检查报告.md 作为问题参考（注意它是 Phase 1 前的快照，里面的目标锚点可能已被 Phase 1 改名，不能盲信，最终要以磁盘为准）。

步骤二 · 修 wiki/面试题目.md（最重要，76+ 死链）
- 把面试题目.md 整个 Read 一遍。
- 对每条 [[file#anchor]]：先验证 file 是否存在；再 Read 目标文件、grep 其 ^## / ^### 标题，找到与 anchor 语义最匹配的实际标题，把 anchor 改成精确一致。
- Phase 1 把多个解答拆/搬到了新文件（如 Agent 核心概念 中部分内容移到 MCP 协议 / Agent Memory 系统 / Multi-Agent 架构 等；面向对象 拆成 面向对象核心 / 类成员与关键字 / 对象语义；RAG检索策略 部分拆到 RAG查询理解；Function Calling 部分拆到 Function Calling 多模态；动态规划 拆出 动态规划-背包/多维）——按内容主题判断重指到哪个新文件。
- 路径前缀/空格统一：LLM/LLM基础与训练 → LLM/LLM 基础与训练；MySQL 引擎与日志 → MySQL/引擎与日志；类似批量。
- 目标文件【真不存在】且无合理替代的（如 Hermes框架 / ColPali / 主文档 / 框架选型 / Prompt与Harness 已不存在）：将 [[Hermes框架]] 改为纯文本 \`Hermes框架\` 或删除该行，按上下文判断。

步骤三 · 修跨域死文件链 41 条
- 同样以磁盘为准重指（Spring/Spring 事务.md [[MySQL 锁与事务机制]] → [[事务与MVCC]]；Redis/Redis 持久化.md [[MySQL 引擎与日志]] → [[引擎与日志]]；PaiFlow 工作流平台.md 3 条 LLM/* 死链按内容修；操作系统.md [[计算机网络篇]] → [[计算机网络]] 等）。

步骤四 · 修锚点漂移（slug 锚点、标题改名）
- Reflection 实现 §3.3 外部验证器（最可靠）—多处引用缺括号；
- LSP 与代码诊断 多处指向 Reflection；
- Coding Agent TUI 设计 → Agent 工程实践 错位；
- 算法 MOC 的栈与队列锚点；
- LLM/Harness Engineering 多个标题改名后的锚点。
方法都一样：Read 当前目标文件标题、改 anchor。

步骤五 · 验证
- 改完用 grep + find 自查：所有 [[...]] 都能匹配磁盘上的文件，所有 #anchor 都能匹配目标文件的实际标题（精确字符串包含）。
- 仍无法解析的剩余链接，写进报告并说明原因。

输出
- 用 Write 写 ${LOG}/_阶段2C改链.md：分类统计（面试题目.md 修了 X 条 / 跨域文件链 Y 条 / 锚点漂移 Z 条 / 删除 W 条无法解析）+ 剩余无法解析清单。
- 返回 4-6 句话总结。

铁律：本阶段只改链接（[[...]] 内容），不要改正文实质内容；不要新建/删除文件（除非是删除已无意义的占位）；不要碰 MOC（2B 处理过了）。`

phase('Integrate-MOC')
log('阶段2A/2B 并行：整合暂存 + MOC 统一')
const [integrateRes, mocRes] = await parallel([
  () => agent(integratePrompt, { label: '2A-整合暂存', phase: 'Integrate-MOC', agentType: 'general-purpose' }),
  () => agent(mocPrompt, { label: '2B-MOC统一', phase: 'Integrate-MOC', agentType: 'general-purpose' }),
])

phase('Relink')
log('阶段2C：全局改链（看到 2A/2B 后的最终磁盘状态）')
const relinkRes = await agent(relinkPrompt, { label: '2C-全局改链', phase: 'Relink', agentType: 'general-purpose' })

// 验收 + 归档
phase('Verify-Archive')

const verifyPrompt = `你是【二次验收 agent】。工作目录：${BASE}。${NOTE}

Phase 2 (整合/MOC/改链) 刚结束。请重跑【链接同步类】机械检查，重点确认 2C 改链有效、新引入的MOC文件/整合产物没引入新问题：
1. 全仓库 wikilink 坏链：grep + find，应已显著减少。统计仍无法解析的链接数和示例。
2. 锚点匹配抽查：从 wiki/面试题目.md 随机抽 20 条 [[file#anchor]]，逐个验证 anchor 与目标文件实际标题精确一致。
3. UTF-8 乱码 U+FFFD 全仓扫：应为 0。
4. 行数：列出仍 >800 行的文件。
5. 新建/更新的 MOC 文件是否覆盖了本域全部 .md（抽 1-2 个域核对）。
6. 暂存目录 ${STAGE}/ 应为空（已整合）。

对发现的【明确且安全的残留】（个别乱码、明显的复制粘贴坏链）直接就地修。
用 Write 把结果写入 ${AUD}/Phase2验收报告.md（不要覆盖之前的 修复后验收报告.md）。返回一句话总结：还剩什么红旗。`

const archivePrompt = `你是【归档追加 agent】。工作目录：${BASE}。${NOTE}

注意：${BASE}/优化记录.md 已有 Phase 1 的归档条目（顶部 2026-06-01 章节）。${AUD}/修复总报告.md 已有 Phase 1 的总报告。请【追加】Phase 2 的内容，不要覆盖现有内容：

1. Read ${LOG}/_阶段2A整合.md、${LOG}/_阶段2B_MOC.md、${LOG}/_阶段2C改链.md、${AUD}/Phase2验收报告.md。
2. 用 Edit 给 ${BASE}/优化记录.md 的 2026-06-01 章节末尾追加 Phase 2 修复条目（按方法论格式：- 文件 — 改动；**原因**：...）。条目分组：暂存整合 / MOC 统一与新建 / 全局改链。
3. 用 Edit 给 ${AUD}/修复总报告.md 追加一节"## Phase 2 后续修复"，含：整合了哪些暂存、新建/更新了哪些 MOC、全局改链统计、验收红旗清单。
4. 用 Edit 把 ${AUD}/进度.md 末尾的 Phase2 占位标为完成。

返回 3-5 句话：Phase 2 共修了什么、还残留什么（用于交付）。`

const [verifyRes, archiveResRaw] = await parallel([
  () => agent(verifyPrompt, { label: '3-Phase2验收', phase: 'Verify-Archive', agentType: 'general-purpose' }),
  // 归档依赖验收报告，所以晚一步起跑，但 parallel 内部独立——这里改为顺序，避免归档读到不存在的验收报告
])

// 归档必须看到验收报告，所以放在验收之后串行
const archiveRes = await agent(archivePrompt, { label: '4-归档追加', phase: 'Verify-Archive', agentType: 'general-purpose' })

return {
  phase2A_integrate: integrateRes,
  phase2B_moc: mocRes,
  phase2C_relink: relinkRes,
  verify: verifyRes,
  archive: archiveRes,
}
