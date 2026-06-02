export const meta = {
  name: 'wiki-audit',
  description: 'wiki 知识库方法论合规性 + 内容质量全量审计：2 机械检查 + 21 领域专家 + 1 汇总，全部只读出报告',
  phases: [
    { title: 'Mechanical', detail: '全局机械检查：格式 + 链接同步' },
    { title: 'Domain', detail: '21 领域专家审计（管理 + 知识点双视角）' },
    { title: 'Synthesis', detail: '汇总全部报告产出审计总报告' },
  ],
}

const BASE = '/home/ubuntu/ADgai/dsq/Obsidian'
const REPORTS = BASE + '/wiki审计'

const METHODOLOGY = `
# 审计依据（来自 wiki-管理方法论.md + QUALITY_CHECKLIST.md）

## 客观规则（可机械校验）
- 单文档 < 600 行（>600🟡 / >800🔴）；流水账文档（优化记录/思考记录）豁免
- 顶层小节 ≤ 8 个
- frontmatter 必须含 module / tags / difficulty / last_reviewed 四字段；last_reviewed ≤ 6 个月
- 零 UTF-8 乱码（U+FFFD）
- 代码块必须有语言标签；前后留空行
- callout 仅限 tip/info/note/warning/danger；每个 ### 下 ≤ 3 个；禁止连用、禁止嵌套
- 标题不得内嵌 [[...]] 或 **bold**（破坏 anchor 匹配）；标题层级不得跳级
- 所有 wikilink 必须指向存在的文件/章节；anchor 文本与标题精确一致
- 面试题目.md 与 wiki 解答双向 100% 同步
- 无孤儿页；MOC 覆盖本域全部文件

## 判断规则（需专家）
- Diátaxis：每篇文档应为 Tutorial/How-to/Reference/Explanation 中的 1 种（≤1.5 种），混 ≥2 类是红旗
- SSoT：同一概念在 ≥2 篇文档各 ≥50 行重复讲解 = P0 违规；应单点保留全文，他处仅 callout 链接
- 内容边界：安装命令、教程、营销文案、项目实现细节不进 wiki 主文；原始文章须保留来源标注
- 求职方向对齐：目标�� Java + Agent 岗，非纯算法/纯大模型研发
- >400 行文档应有顶部渐进式摘要 callout

## 健康度
🔴 红旗（立即处理）：SSoT 违规 / >800 行 / Diátaxis ≥2 类
🟡 黄旗（计划整改）：>600 行 / 缺顶部摘要(>400行) / last_reviewed>6月 / 缺 frontmatter 字段
🟢 健康：0 红旗 + ≤1 黄旗
`

const UNIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['unit', 'reportFile', 'filesAudited', 'health', 'redFlags', 'yellowFlags', 'topIssues', 'summary'],
  properties: {
    unit: { type: 'string' },
    reportFile: { type: 'string', description: '已写入的报告文件绝对路径' },
    filesAudited: { type: 'integer' },
    health: { type: 'string', enum: ['green', 'yellow', 'red'] },
    redFlags: { type: 'integer' },
    yellowFlags: { type: 'integer' },
    topIssues: {
      type: 'array',
      description: '最多 6 条最重要问题',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'issue'],
        properties: {
          severity: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          file: { type: 'string' },
          issue: { type: 'string' },
        },
      },
    },
    summary: { type: 'string', description: '本单元一段话结论' },
  },
}

// ---------- 阶段 1：全局机械检查 ----------
const MECH_UNITS = [
  {
    key: 'M1 格式检查',
    report: REPORTS + '/机械检查报告.md',
    focus: `对 wiki/ 下全部 .md 文件做【客观格式类】机械检查（用 Bash 的 grep/wc/find/sed 等只读命令逐项扫描，不要修改任何文件）：
1. 行数：列出所有 >600 行(🟡) 和 >800 行(🔴) 的文件及行数（优化记录/思考记录类流水账豁免）。
2. frontmatter：检查每个文件 head 是否含 module/tags/difficulty/last_reviewed 四字段；列出缺字段的文件。检查 last_reviewed 是否 >6 个月（今天是 2026-06-01）。
3. UTF-8 乱码：grep U+FFFD（$'\\xef\\xbf\\xbd'），列出含乱码的文件和行号。
4. 代码块语言标签：找出 \`\`\` 开头但缺语言标签的代码块。
5. callout：找出非法类型（非 tip/info/note/warning/danger）、嵌套 callout（> > [!）、连用 callout。
6. 标题：找出内嵌 [[...]] 或 **bold** 的标题、跳级标题（如 ## 直接到 ####）、单文档顶层小节 >8 个的。`,
  },
  {
    key: 'M2 链接与同步检查',
    report: REPORTS + '/链接同步检查报告.md',
    focus: `对 wiki/ 全库做【链接与同步类】机械检查（Bash 只读命令，不修改文件）：
1. wikilink 坏链：提取所有 [[...]]，验证目标文件/章节是否存在，列出所有坏链及所在文件。
2. anchor 匹配：对带 #锚点 的 wikilink，验证锚点文本与目标文件实际标题是否精确一致。
3. 面试题目同步：检查 wiki/面试题目.md（若存在）每条目是否有 ➡️ wikilink 指向解答；反向检查 wiki 解答是否都登记在面试题目.md。给出双向覆盖率。
4. 孤儿页：找出没有被任何其他文件 [[]] 引用、也不在任何 MOC 里的文件。
5. MOC 覆盖：对每个 *_MOC.md / 索引.md，检查其所在域的全部文件是否都被该 MOC 收录，列出遗漏。
6. 跨域 SSoT 候选：用关键词扫描，列出疑似在多篇文档重复 >50 行讲解的概念（给候选清单供后续人工确认���不必断定）。`,
  },
]

// ---------- 阶段 2：领域专家单元 ----------
// target 为 files（明确文件清单）或 folder（整个文件夹）
const A = 'wiki/Agent/'
const ALG = 'wiki/算法/'
const RAG = 'wiki/RAG/'
const DOMAIN_UNITS = [
  { key: 'Agent-核心与Memory', domain: 'Agent 核心机制（ReAct/Plan/Reflection/Memory/Skills/上下文/Multi-Agent/路由）', report: REPORTS + '/领域报告/Agent-核心与Memory.md',
    files: [A+'Agent 核心概念.md', A+'Agent 框架.md', A+'Agent Memory 系统.md', A+'Agent Skills 体系.md', A+'长上下文工程.md', A+'ReAct 与 Harness 实现.md', A+'Reflection 实现.md', A+'Plan-and-Execute 实现.md', A+'Multi-Agent 架构.md', A+'模型路由策略.md'] },
  { key: 'Agent-工具与协议', domain: 'Coding Agent 工具与协议（MCP/工具集/LSP/TUI/AI编程工具）', report: REPORTS + '/领域报告/Agent-工具与协议.md',
    files: [A+'MCP 协议.md', A+'Coding Agent 工具集.md', A+'LSP 与代码诊断.md', A+'Coding Agent TUI 设计.md', A+'AI 编程工具.md', A+'Agent索引_MOC.md'] },
  { key: 'Agent-安全部署与对比', domain: 'Agent 安全/可靠/可观测/部署 + 主流实现对比', report: REPORTS + '/领域报告/Agent-安全部署与对比.md',
    files: [A+'Agent 安全模型.md', A+'Agent 可观测性.md', A+'Agent 可靠性设计.md', A+'Agent 工程实践.md', A+'Agent 部署与服务化.md', A+'主流 Coding Agent 实现对比/Memory 实现对比.md', A+'主流 Coding Agent 实现对比/WORKSPACE.md', A+'主流 Coding Agent 实现对比/索引.md'] },
  { key: '算法-数据结构', domain: '数据结构类算法（数组/链表/栈队列/树/堆/字符串/图）', report: REPORTS + '/领域报告/算法-数据结构.md',
    files: [ALG+'数组.md', ALG+'链表.md', ALG+'栈与队列.md', ALG+'树.md', ALG+'堆.md', ALG+'字符串.md', ALG+'图.md', ALG+'算法_MOC.md'] },
  { key: '算法-高级算法', domain: '高级算法（DP/回溯/贪心/二分/排序/位运算/设计）', report: REPORTS + '/领域报告/算法-高级算法.md',
    files: [ALG+'动态规划.md', ALG+'回溯算法.md', ALG+'贪心算法.md', ALG+'二分查找.md', ALG+'排序.md', ALG+'位运算.md', ALG+'设计.md'] },
  { key: 'RAG-检索与向量', domain: 'RAG 检索与向量（基础架构/Embedding/检索策略/分块/CodeRAG）', report: REPORTS + '/领域报告/RAG-检索与向量.md',
    files: [RAG+'RAG基础与架构.md', RAG+'RAG向量与Embedding.md', RAG+'RAG检索策略.md', RAG+'分块策略.md', RAG+'分块策略前沿.md', RAG+'Code RAG.md'] },
  { key: 'RAG-评估安全与高级', domain: 'RAG 评估/安全/高级技术/幻觉/多轮/解析综述', report: REPORTS + '/领域报告/RAG-评估安全与高级.md',
    files: [RAG+'RAG评估.md', RAG+'RAG安全.md', RAG+'RAG高级技术.md', RAG+'幻觉与置信度.md', RAG+'多轮对话.md', RAG+'文档解析综述.md'] },
  { key: '并发编程', domain: 'Java 并发编程', report: REPORTS + '/领域报告/并发编程.md', folder: 'wiki/并发编程/' },
  { key: 'MySQL', domain: 'MySQL 数据库', report: REPORTS + '/领域报告/MySQL.md', folder: 'wiki/MySQL/' },
  { key: 'Java基础', domain: 'Java 语言基础', report: REPORTS + '/领域报告/Java基础.md', folder: 'wiki/Java基础/' },
  { key: 'JVM', domain: 'JVM 虚拟机', report: REPORTS + '/领域报告/JVM.md', folder: 'wiki/JVM/' },
  { key: 'Redis', domain: 'Redis', report: REPORTS + '/领域报告/Redis.md', folder: 'wiki/Redis/' },
  { key: 'Spring', domain: 'Spring 框架', report: REPORTS + '/领域报告/Spring.md', folder: 'wiki/Spring/' },
  { key: '集合框架', domain: 'Java 集合框架', report: REPORTS + '/领域报告/集合框架.md', folder: 'wiki/集合框架/' },
  { key: 'LLM', domain: '大模型基础（训练/Prompt/FunctionCalling/Harness）', report: REPORTS + '/领域报告/LLM.md', folder: 'wiki/LLM/' },
  { key: '文档解析', domain: '文档解析（OCR/版面/公式/表格/VLM/清洗）', report: REPORTS + '/领域报告/文档解析.md', folder: 'wiki/文档解析/' },
  { key: '数据格式', domain: '数据格式（XML/OOXML/PDF/DOM）', report: REPORTS + '/领域报告/数据格式.md', folder: 'wiki/数据格式/' },
  { key: '计算机网络', domain: '计算机网络', report: REPORTS + '/领域报告/计算机网络.md', folder: 'wiki/计算机网络/' },
  { key: '操作系统', domain: '操作系统', report: REPORTS + '/领域报告/操作系统.md', folder: 'wiki/操作系统/' },
  { key: 'Baize项目', domain: 'Baize 项目（白泽 AI 项目实现）', report: REPORTS + '/领域报告/Baize项目.md', folder: 'wiki/Baize项目/' },
  { key: 'PaiFlow', domain: 'PaiFlow 工作流平台', report: REPORTS + '/领域报告/PaiFlow.md', folder: 'wiki/PaiFlow/' },
]

function mechPrompt(u) {
  return `你是 wiki 知识库的【机械检查专家】。工作目录：${BASE}。这是只读审计，禁止修改任何 wiki 原文件。

${METHODOLOGY}

## 你的任务：${u.key}
${u.focus}

## 输出要求（重要）
1. 用 Write 工具把【完整详细结果】写入：${u.report}
   报告需含：每一类检查的发现（用表格逐条列出 文件/行号/问题），以及该类是否通过的小结。命中项标注 🔴/🟡。
2. 然后只返回结构化摘要（不要把长报告塞进返回值）。reportFile 填 ${u.report}；filesAudited 填扫描的文件总数；redFlags/yellowFlags 填命中数；topIssues 填最严重的最多 6 条；summary 一段话总结全库格式健康度。`
}

function domainPrompt(u) {
  const target = u.files
    ? `审计以下文件（逐个用 Read 读取）：\n${u.files.map(f => '  - ' + BASE + '/' + f).join('\n')}`
    : `审计文件夹 ${BASE}/${u.folder} 下的全部 .md 文件（先列目录，再逐个 Read）。`
  return `你身兼两职：【知识库管理专家】+【${u.domain} 领域知识点专家】。工作目录：${BASE}。这是只读审计，禁止修改任何 wiki 原文件。

${METHODOLOGY}

## 审计目标单元：${u.key}
${target}

## 审计视角（聚焦【判断类】问题；纯机械项如行数/frontmatter字段/坏链已由其他 agent 全局统一检查，你不必重复，但顺手发现明显问题也记下）

### 视角一 · 知识库管理专家
- Diátaxis：每篇是否类型混杂（同时是教程+参考+解释）→ 混 ≥2 类记红旗
- 域内 SSoT：同一概念是否在本单元多篇 >50 行重复讲解
- 内容边界与求职对齐：是否塞了安装命令/教程/营销文案/不相关内容；是否对齐 Java + Agent 求职方向
- 标题层级是否跳级、逻辑是否清晰
- >400 行文档是否有顶部渐进式摘要 callout

### 视角二 · ${u.domain} 领域知识点专家
- 知识点是否准确、有无明显技术错误或概念混淆
- 是否过时（对照 2026 年现状）
- 面试深度是否足够、有无重要知识点遗漏
- 代码示例是否正确、可运行

## 输出要求（重要）
1. 用 Write 工具把【完整详细报告】写入：${u.report}
   报告需含：① 单元概览（文件数、各文件健康度🔴🟡🟢）② 逐条问题（标注 P0/P1/P2、文件、行号或小节、问题、修复建议）③ 领域知识点准确性评价 ④ 本单元小结。
2. 然后只返回结构化摘要（不要把完整报告塞进返回值）。reportFile 填 ${u.report}；filesAudited 填实际审计文件数；health 取本单元整体（有红旗=red，仅黄旗=yellow，否则 green）；topIssues 最多 6 条最重要的。`
}

// ---------- 执行 ----------
phase('Mechanical')
log('启动 ' + (MECH_UNITS.length + DOMAIN_UNITS.length) + ' 个审计 agent（2 机械 + 21 领域），并行分波运行…')

const mechThunks = MECH_UNITS.map(u => () =>
  agent(mechPrompt(u), { label: u.key, phase: 'Mechanical', schema: UNIT_SCHEMA, agentType: 'general-purpose' }))

const domainThunks = DOMAIN_UNITS.map(u => () =>
  agent(domainPrompt(u), { label: u.key, phase: 'Domain', schema: UNIT_SCHEMA, agentType: 'general-purpose' }))

const results = (await parallel([...mechThunks, ...domainThunks])).filter(Boolean)

log('审计完成：' + results.length + '/' + (MECH_UNITS.length + DOMAIN_UNITS.length) + ' 个单元返回结果。开始汇总…')

// ---------- 阶段 3：汇总 ----------
phase('Synthesis')
const summaryTable = results.map(r =>
  `- [${r.health || '?'}] ${r.unit}：${r.filesAudited} 文件，红${r.redFlags || 0}/黄${r.yellowFlags || 0}；${(r.summary || '').slice(0, 120)}`).join('\n')

const synthPrompt = `你是 wiki 知识库【首席审计官】。工作目录：${BASE}。只读，禁止修改 wiki 原文件。

已有 ${results.length} 个子 agent 完成审计，各自报告已写入 ${REPORTS}/ 与 ${REPORTS}/领域报告/。

各单元返回的摘要：
${summaryTable}

## 你的任务
1. 读取 ${REPORTS}/ 下的 机械检查报告.md、链接同步检查报告.md，以及 ${REPORTS}/领域报告/ 下的全部 .md（用工具读，逐个看，不要遗漏）。
2. 用 Write 工具产出总报告 ${REPORTS}/审计总报告.md，包含：
   - 全局结论（一段话：整库健康度如何、最该先修什么）
   - 红黄绿记分卡表格（每个单元一行：单元 / 文件数 / 健康度 / 红旗数 / 黄旗数 / 一句话）
   - P0 问题清单（跨全库汇总，按影响排序，每条注明出处文件）
   - P1 问题清单
   - P2 / 优化建议清单
   - 跨域共性问题（如普遍缺 frontmatter、普遍超长、SSoT 重复模式等）
   - 建议修复顺序（分批，先 P0 后 P1，给出可执行的批次）
3. 用 Write 工具更新 ${REPORTS}/进度.md：把所有完成单元标为 ✅，未返回的标为 ❌。

完成后返回一段话总结：整库健康度 + P0 数量 + 最优先的 3 件事。`

const finalText = await agent(synthPrompt, { label: '审计总报告', phase: 'Synthesis', agentType: 'general-purpose' })

return { unitsAudited: results.length, finalText }
