export const meta = {
  name: 'wiki-fix-p0p1',
  description: 'wiki P0+P1 修复：阶段1 文件夹内修复(21并行) → 阶段2 跨域整合+MOC+全局改链 → 阶段3 完整性验收 → 阶段4 归档',
  phases: [
    { title: 'Phase1-文件夹修复', detail: '21 领域 agent 并行：拆超长文件/结构/域内去重/本地完整性，暂存跨域内容' },
    { title: 'Phase2-整合与改链', detail: '整合暂存内容 + 统一 MOC + 全局改链(单一所有者)' },
    { title: 'Phase3-验收', detail: '重跑机械检查捕捉重组新引入的问题' },
    { title: 'Phase4-归档', detail: '汇总修复日志写入优化记录，产出修复总报告' },
  ],
}

const BASE = '/home/ubuntu/ADgai/dsq/Obsidian'
const AUD = BASE + '/wiki审计'
const LOG = AUD + '/_修复日志'
const STAGE = AUD + '/_迁移暂存'

const RULES = `
# 修复必须遵守的方法论规则（来自 wiki-管理方法论.md）
- 单文档目标 <600 行；>800 行必须拆分，600-800 行有干净切缝才拆、否则加顶部「速览」callout。
- 顶层小节 ≤8 个；标题层级不得跳级；每文件单一 H1（其余降级为 H2/H3）。
- Diátaxis：一篇文档应聚焦 1 种类型（教程/指南/参考/解释），混 ≥2 类要拆开或重定位。
- 域内 SSoT：同一概念在多篇 >50 行重复 → 保一处全文，他处改为 1-2 行摘要 + callout 链接。
- frontmatter 四字段 module/tags/difficulty/last_reviewed 补全；module 要与所在域一致。
- 代码块加语言标签；callout 仅 tip/info/note/warning/danger，不嵌套、不连用。
- 拆分新文件命名用自然名（不加 00-/01- 前缀），放同一文件夹内。

# 本阶段铁律（极重要）
1. 你【只能改自己负责的文件夹内的文件】。绝不碰其他文件夹、不碰 wiki/面试题目.md。
2. 你【不要碰任何 MOC / 索引文件】（*_MOC.md、索引.md）——这些留到阶段2统一处理。
3. 跨域内容搬迁：只把要搬走的内容【删除并写入暂存文件】，绝不写入目标文件夹（目标文件夹由阶段2整合）。
4. 链接：你可以修复【你本次编辑/新建的文件内部】的锚点；所有【跨文件夹的链接、坏链、锚点漂移】只【记录到修复日志】，不要去改——阶段2有专门的全局改链 agent 统一修。
5. 这是真实修改 wiki 原文，务必精准；改完该文件应仍是合法 Markdown。
`

const P1_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['unit', 'fixLogFile', 'filesChanged', 'splits', 'stagedFiles', 'p0Fixed', 'p1Fixed', 'linksToFixInPhase2', 'summary'],
  properties: {
    unit: { type: 'string' },
    fixLogFile: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    splits: { type: 'array', description: '拆分：旧文件→新文件清单',
      items: { type: 'object', additionalProperties: false, required: ['from', 'into'],
        properties: { from: { type: 'string' }, into: { type: 'array', items: { type: 'string' } } } } },
    stagedFiles: { type: 'array', description: '写入_迁移暂存/的文件及其预期目标',
      items: { type: 'object', additionalProperties: false, required: ['stagePath', 'destination'],
        properties: { stagePath: { type: 'string' }, destination: { type: 'string' } } } },
    p0Fixed: { type: 'integer' },
    p1Fixed: { type: 'integer' },
    linksToFixInPhase2: { type: 'integer', description: '记录给阶段2修的跨域链接数' },
    summary: { type: 'string' },
  },
}

// ---- 阶段1 单元定义 ----
const A = 'wiki/Agent/', ALG = 'wiki/算法/', RAG = 'wiki/RAG/'
const UNITS = [
  { key: 'Agent-核心与Memory', report: '领域报告/Agent-核心与Memory.md',
    files: [A+'Agent 核心概念.md', A+'Agent 框架.md', A+'Agent Memory 系统.md', A+'Agent Skills 体系.md', A+'长上下文工程.md', A+'ReAct 与 Harness 实现.md', A+'Reflection 实现.md', A+'Plan-and-Execute 实现.md', A+'Multi-Agent 架构.md', A+'模型路由策略.md'],
    p0: 'P0：拆 Plan-and-Execute 实现.md(814行)——把§七「其他规划模式(ReWOO/LLMCompiler/ToT/LATS/Hierarchical)」提取为新文件「Plan 模式家族对比.md」，主文件保留实现+Replan，目标~500行。P1：Agent Memory 系统 顶部callout去重/空壳小节合并；Agent 核心概念 公式与表格不一致(补 Skills/Harness)；批量 frontmatter module:LLM→Agent(框架/Skills/长上下文/ReAct/Reflection/Plan/模型路由)；可靠性=不在本单元。详见报告。' },
  { key: 'Agent-工具与协议', report: '领域报告/Agent-工具与协议.md',
    files: [A+'MCP 协议.md', A+'Coding Agent 工具集.md', A+'LSP 与代码诊断.md', A+'Coding Agent TUI 设计.md', A+'AI 编程工具.md'],
    p0: 'P0-a：拆 MCP 协议.md(927行,11个顶层小节)——提取§五(生态主流Server)+§六(安全模型)为独立新文件，主文件保留协议核心、≤8小节、~600行。P0-b：AI 编程工具.md §8「AI辅助知识管理方法论」与本文无关→【删除并写入暂存】 '+STAGE+'/方法论-AI辅助知识管理.md (目标: wiki-管理方法论.md)。P1：MCP endpoint /sse→/mcp、Python SDK 示例修正、给>400行文件加速览callout。注意：本单元不要碰 Agent索引_MOC.md。详见报告。' },
  { key: 'Agent-安全部署与对比', report: '领域报告/Agent-安全部署与对比.md',
    files: [A+'Agent 安全模型.md', A+'Agent 可观测性.md', A+'Agent 可靠性设计.md', A+'Agent 工程实践.md', A+'Agent 部署与服务化.md', A+'主流 Coding Agent 实现对比/Memory 实现对比.md', A+'主流 Coding Agent 实现对比/WORKSPACE.md'],
    p0: 'P0-a：拆 Memory 实现对比.md(1092行)——§5.5 内嵌的~510行通用RAG教程(FTS5/倒排/BM25/分块)与「Memory实现对比」跑题→【删除并写入暂存】 '+STAGE+'/RAG-FTS5与分块教程.md (目标: wiki/RAG/)，主文件只保留各产品Memory实现对比+结论表+源码路径。P0-b：可观测性.md §6「生产环境延迟优化策略」属RAG检索域→【删除并写入暂存】 '+STAGE+'/RAG-延迟优化策略.md (目标: wiki/RAG/)。P1：安全模型 PathGuard前缀漏洞(commonpath)、SSRF DNS-rebinding(pin IP)、CommandGuard词边界、人名Tobi Lütke、可靠性 合并重复表/统一阈值。注意：不要碰 索引.md。详见报告。' },
  { key: '算法-数据结构', report: '领域报告/算法-数据结构.md',
    files: [ALG+'数组.md', ALG+'链表.md', ALG+'栈与队列.md', ALG+'树.md', ALG+'堆.md', ALG+'字符串.md', ALG+'图.md'],
    p0: 'P0：树.md L327-331 maxPathSum 的 self.max_sum 裸写在类体(NameError)→移进方法内；图.md L113 `rawnge`→`range`(NameError)。P1：链表↔堆 都有「合并K个升序链表」全解(各~45行)→在堆.md保留全文(多路归并主题)、链表.md改为callout链接；链表.md difficulty:easy→medium；字符串.md 补 KMP 或从MOC移除该承诺(MOC阶段2处理,你只补内容)；>600行加速览callout。注意：不碰 算法_MOC.md。详见报告。' },
  { key: '算法-高级算法', report: '领域报告/算法-高级算法.md',
    files: [ALG+'动态规划.md', ALG+'回溯算法.md', ALG+'贪心算法.md', ALG+'二分查找.md', ALG+'排序.md', ALG+'位运算.md', ALG+'设计.md'],
    p0: 'P0：拆 动态规划.md(927行)——把「背包问题」(§四)提取为新文件「动态规划-背包.md」，主文件保留五步框架+序列DP。P1：回溯算法.md L69 乱码(信号)+章节跳级(二→四缺三,重排为连续)、排序.md L55 乱码(大量)、位运算.md L138 乱码(不同)、二分查找.md §四 命名与内容不符(补Koko/LC410 或改名)、设计.md 补LFU(LC460)+O(1)随机集合(LC380) 或收窄开头、>400行加速览callout。详见报告。' },
  { key: 'RAG-检索与向量', report: '领域报告/RAG-检索与向量.md',
    files: [RAG+'RAG基础与架构.md', RAG+'RAG向量与Embedding.md', RAG+'RAG检索策略.md', RAG+'分块策略.md', RAG+'分块策略前沿.md', RAG+'Code RAG.md'],
    p0: 'P0：拆 RAG检索策略.md(904行)——把「查询理解/改写」相关大块提取为新文件，主文件≤8小节、~600行。P1 详见报告。注意：阶段2会把暂存的「延迟优化策略」「FTS5/分块教程」整合进RAG域，本阶段你不要处理暂存内容、不碰RAG域的MOC。' },
  { key: 'RAG-评估安全与高级', report: '领域报告/RAG-评估安全与高级.md',
    files: [RAG+'RAG评估.md', RAG+'RAG安全.md', RAG+'RAG高级技术.md', RAG+'幻觉与置信度.md', RAG+'多轮对话.md', RAG+'文档解析综述.md'],
    p0: 'P0/P1 详见报告（本单元无超大文件，重点处理事实性错误、Diátaxis、域内去重、坏链记录）。' },
  { key: '并发编程', report: '领域报告/并发编程.md', folder: 'wiki/并发编程/',
    p0: 'P0：拆 线程基础与ThreadLocal.md(1446行)——把「线程通信与同步」(wait/notify/Condition/Exchanger/CompletableFuture,~400行)提取为新文件「线程通信与同步.md」，主文件保留线程基础+ThreadLocal(~600行)。P1：并发/并行定义纠正、Exchanger 两处去重(保并发工具类.md)、锁.md ABA示例无法体现ABA(重排)、Mark Word偏向位、ExchangerTest `exchange("B")`→`exchange(B)`、Java内存模型 9个H2超限、清理品牌字符串。详见报告。注意：不碰并发编程索引_MOC.md。' },
  { key: 'MySQL', report: '领域报告/MySQL.md', folder: 'wiki/MySQL/',
    p0: 'P0：锁机制.md L36 乱码(备)。其余 P0/P1 详见报告(Online DDL域内去重、事实性错误等)。注意：不碰MySQL索引_MOC.md。' },
  { key: 'Java基础', report: '领域报告/Java基础.md', folder: 'wiki/Java基础/',
    p0: 'P0：拆 面向对象.md(930行)为~3篇聚焦文档；弯引号——注解、反射与 Java 8.md(8处)+面向对象.md(11处) 代码块内中文弯引号""(U+201C/D)→英文直引号"；String.md L43 乱码(等)。P1 详见报告。注意：不碰Java基础索引_MOC.md。' },
  { key: 'JVM', report: '领域报告/JVM.md', folder: 'wiki/JVM/',
    p0: 'P1：内存管理.md 缓存行64字节纠正、JIT与字节码.md AOT jaotc(JDK17已移除)/Graal、类加载机制.md PlatformClassLoader(JDK9+)。详见报告。注意：不碰JVM索引_MOC.md。' },
  { key: 'Redis', report: '领域报告/Redis.md', folder: 'wiki/Redis/',
    p0: 'P0：底层数据结构与实战.md L301-418「实战应用」(~120行)与进阶功能.md/缓存经典问题.md 重复(秒杀Lua/限流/SCAN/keepalive)+跑题→域内去重(保进阶功能.md或新建实战文件、他处callout)。P1：Redis 基础.md 删install命令、6.0多线程重复、SDS 3.2+五变体、intset。详见报告。注意：不碰Redis索引_MOC.md。' },
  { key: 'Spring', report: '领域报告/Spring.md', folder: 'wiki/Spring/',
    p0: 'P1：IoC.md MyBatis-Plus不属Spring ORM 纠正、事务.md protected方法事务不生效纠正、AOP与动态代理.md L145-151+L193-198 代理示例`return null`→`return returnValue`、Boot自定义Starter用3.x新机制、>400行速览callout。坏链(如[[MySQL 锁与事务机制]])只记录、阶段2修。注意：不碰Spring索引_MOC.md。详见报告。' },
  { key: '集合框架', report: '领域报告/集合框架.md', folder: 'wiki/集合框架/',
    p0: 'P0：Set体系与HashSet.md L62-136 重复了 HashMap核心原理.md 的put全流程(~62行)→删除细节、改为callout链接到HashMap核心原理。P1：List体系.md L15 乱码(于)、HashMap核心原理.md 速览callout+取模重复合并(3-4处)、概述.md 首标题H2→H1。注意：不碰集合框架索引_MOC.md。详见报告。' },
  { key: 'LLM', report: '领域报告/LLM.md', folder: 'wiki/LLM/',
    p0: 'P1：Function Calling.md(650行,9个H2)拆/合并(提取多模态~175行 或合并多轮+并行)、Harness Engineering.md 12个H2+八/八-A/八-B编号乱→重排、LLM 基础与训练.md 速览callout、多处坏锚只记录阶段2修。注意：不碰LLM索引_MOC.md。详见报告。' },
  { key: '文档解析', report: '领域报告/文档解析.md', folder: 'wiki/文档解析/',
    p0: 'P0/P1 详见报告（代码块语言标签、事实性、坏链记录）。注意：本域缺MOC，阶段2会新建，你不要建。' },
  { key: '数据格式', report: '领域报告/数据格式.md', folder: 'wiki/数据格式/',
    p0: 'P1：XML.md↔OOXML.md 去重(w:p代码块/docx是ZIP 双写→XML保概念、删完整示例改摘要+callout)、各文件代码块补语言标签(xml/text/postscript)、PDF.md 扫描页栅格图像纠正、OOXML r:命名空间。注意：本域缺MOC,阶段2新建。详见报告。' },
  { key: '计算机网络', report: '领域报告/计算机网络.md', folder: 'wiki/计算机网络/',
    p0: 'P0：计算机网络.md 章节编号错乱(一→四→二→三→五)→重排为 一→二→三→四→五；Agent传输章 Diátaxis混类→重定位或纯参考化。详见报告。' },
  { key: '操作系统', report: '领域报告/操作系统.md', folder: 'wiki/操作系统/',
    p0: 'P1：操作系统.md IO多路复用/进程线程区别 与其他域重复→本域作SSoT保留(跨域调整只记录)、knowledge gaps(major/minor page fault、ET需O_NONBLOCK)。注意：本域缺MOC,阶段2新建。详见报告。' },
  { key: 'Baize项目', report: '领域报告/Baize项目.md', folder: 'wiki/Baize项目/',
    p0: 'P0：聊天助手模块.md L17/70/129 乱码(与/键/示)；LLM选型自相矛盾(聊天助手模块 DeepSeek vs RAG管道设计 Qwen3.5)→读文件判定真实方案并全域统一；文件上传机制.md 7个H1+Diátaxis四类混→降级为单H1+H2/H3、分离参考/指南/解释。坏链(对话上下文管理相对路径等)只记录。注意：不碰任何MOC。详见报告。' },
  { key: 'PaiFlow', report: '领域报告/PaiFlow.md', folder: 'wiki/PaiFlow/',
    p0: 'P1：PaiFlow工作流平台.md L50-52 三条死链只记录(阶段2修)。注意：本域缺MOC,阶段2新建。详见报告。' },
]

function p1Prompt(u) {
  const target = u.files
    ? '你负责的文件（只改这些）：\n' + u.files.map(f => '  - ' + BASE + '/' + f).join('\n')
    : '你负责的文件夹（只改此文件夹内的文件）：' + BASE + '/' + u.folder + ' 下全部 .md（先列目录）'
  const logFile = LOG + '/' + u.key + '.md'
  return `你身兼【知识库管理专家】+【该领域知识点专家】，对 wiki 做 P0+P1 真实修复。工作目录：${BASE}。

${RULES}

## 你的单元：${u.key}
${target}

## 必做重点（P0 优先）
${u.p0}

## 完整问题清单
先用 Read 读你的审计报告 ${AUD}/${u.report}，里面有逐文件、带行号的全部 P0+P1 问题与修复建议。按报告逐条修复（本阶段做：拆分/结构/Diátaxis/域内SSoT去重/本地数据完整性如乱码弯引号代码笔误/事实性错误/frontmatter/速览callout）。

## 跨域内容暂存（如适用）
若要搬走的内容属于别的域：用 Write 把该内容【完整写入指定的暂存文件】，并在原文件中删除该段、留一句占位 callout "[!info] 该内容已迁移，见 XXX"（阶段2会改成正式链接）。绝不直接写入目标文件夹。

## 输出
1. 真实修改你负责的文件。
2. 用 Write 写修复日志 ${logFile}，必须精确记录：
   - 改了哪些文件、各做了什么
   - 【拆分清单】：旧文件 → 新建了哪些文件、各装什么内容
   - 【锚点变更】：哪些标题改名/移动了（旧锚点→新锚点）——阶段2全局改链要用
   - 【暂存清单】：写了哪些暂存文件、预期目标
   - 【留给阶段2的链接问题】：本文件夹里发现的跨文件夹坏链/锚点漂移（源文件:行 → 应指向什么）
   - P0/P1 各修了几条、还剩什么没修
3. 返回结构化摘要（不要把长日志塞进返回值）。`
}

// ============ 执行 ============
phase('Phase1-文件夹修复')
log('阶段1：' + UNITS.length + ' 个领域 agent 并行修复文件夹内 P0+P1…')
const p1Results = (await parallel(UNITS.map(u => () =>
  agent(p1Prompt(u), { label: u.key, phase: 'Phase1-文件夹修复', schema: P1_SCHEMA, agentType: 'general-purpose' })
))).filter(Boolean)

const splitsDigest = p1Results.flatMap(r => (r.splits || []).map(s => `${s.from} → ${(s.into||[]).join(', ')}`)).join('\n') || '（无拆分）'
const stagedDigest = p1Results.flatMap(r => (r.stagedFiles || []).map(s => `${s.stagePath} → ${s.destination}`)).join('\n') || '（无暂存）'
log('阶段1完成 ' + p1Results.length + '/' + UNITS.length + '。拆分与暂存已记录，进入阶段2。')

// ---- 阶段2 ----
phase('Phase2-整合与改链')

// 2A 整合暂存内容（并入方法论 / RAG）—— 与 2B(MOC) 可并行：编辑文件不重叠
const integratePrompt = `你是内容整合 agent。工作目录：${BASE}。${RULES.split('# 本阶段铁律')[0]}
阶段1把若干跨域内容写入了暂存目录 ${STAGE}/。请：
1. 列出 ${STAGE}/ 下所有文件并 Read。
2. 按各文件预期目标整合：
   - 「方法论-*」→ 并入 ${BASE}/wiki-管理方法论.md（放合适章节，去重，符合方法论结构）。
   - 「RAG-*」→ 并入 wiki/RAG/ 合适文件（RAG-延迟优化策略→检索/基础相关文件；RAG-FTS5与分块教程→分块策略.md 或新建合适文件），与现有内容去重融合，补 frontmatter。
   暂存清单：\n${stagedDigest}
3. 整合后删除已消费的暂存文件。把"哪段内容最终落到哪个文件的哪节、新建了什么文件、产生了哪些新锚点"写入 ${LOG}/_阶段2A整合.md（供全局改链使用）。
返回一句话总结 + 列出新文件/新锚点。不要碰 MOC 和 面试题目.md。`

// 2B MOC 统一处理
const mocPrompt = `你是 MOC/索引维护 agent。工作目录：${BASE}。${RULES.split('# 本阶段铁律')[0]}
阶段1已完成所有文件夹内拆分/重组。拆分清单：\n${splitsDigest}\n
请统一处理全部 MOC 与缺失 MOC（这些阶段1都没碰）：
1. 更新各域 *_MOC.md / 子目录 索引.md，使其覆盖本域【当前磁盘上实际存在的全部文件】（含阶段1新拆出的文件），移除已删文件、补漏（如 Agent索引_MOC 缺 Agent 工程实践、算法_MOC 锚点漂移、字符串KMP承诺与实际对齐）。
2. 为缺 MOC 的域新建：文档解析、数据格式、操作系统、PaiFlow（各列本域文件+一句定位）。
3. 孤儿页 wiki/Git.md 挂进合适 MOC。
先 find 出各域当前实际文件清单再改，确保不写不存在的文件。把所做改动+涉及的锚点写入 ${LOG}/_阶段2B_MOC.md。返回一句话总结。不要碰 面试题目.md，不要改非MOC正文。`

log('阶段2A/2B：整合暂存内容 + 统一 MOC（并行）…')
const [integrateRes, mocRes] = await parallel([
  () => agent(integratePrompt, { label: '2A-整合暂存', phase: 'Phase2-整合与改链', agentType: 'general-purpose' }),
  () => agent(mocPrompt, { label: '2B-MOC统一', phase: 'Phase2-整合与改链', agentType: 'general-purpose' }),
])

// 2C 全局改链（单一所有者，最后跑，看到最终结构）
const relinkPrompt = `你是【全局改链 agent】——全仓库 wikilink/锚点的唯一修复者。工作目录：${BASE}。这是只改链接、不改正文实质内容的精修。${RULES.split('# 本阶段铁律')[0]}
此前：阶段1各域已拆分/重组并记录锚点变更于 ${LOG}/*.md；阶段2A整合记录于 ${LOG}/_阶段2A整合.md；阶段2B MOC记录于 ${LOG}/_阶段2B_MOC.md。
请依据这些日志 + 两份链接报告(${AUD}/链接同步检查报告.md)，一次性修复全仓库链接：
1. wiki/面试题目.md 的 76 条死链（19 死文件链 + 57 死锚点）：重指到当前实际文件与标题（注意阶段1拆分后很多解答已移到新文件/新锚点）。
2. 41 条跨域死文件链：修路径前缀与空格(如 LLM/LLM基础与训练→LLM/LLM 基础与训练、MySQL 引擎与日志→MySQL/引擎与日志、Spring [[MySQL 锁与事务机制]]→[[事务与MVCC]] 等)，确实不存在的目标则删除该链接。
3. slug 式锚点、标题漂移锚点：改为与目标文件【实际标题精确一致】。
方法：对每个要修的链接，先用 grep/Read 确认目标文件存在、目标标题的精确文本，再改。改完自查：全仓库 [[...]] 应无坏链、锚点应精确匹配。
把修复统计(改了多少链接、还有多少无法解析及原因)写入 ${LOG}/_阶段2C改链.md。返回一句话总结 + 剩余无法解析的链接数。`

log('阶段2C：全局改链（单一所有者，依赖前序日志）…')
const relinkRes = await agent(relinkPrompt, { label: '2C-全局改链', phase: 'Phase2-整合与改链', agentType: 'general-purpose' })

// ---- 阶段3 验收 ----
phase('Phase3-验收')
const verifyPrompt = `你是修复验收 agent。工作目录：${BASE}。只读检查 + 就地修复你发现的残留小问题。
重组刚结束，请重跑机械检查，【重点捕捉重组过程新引入的问题】：
1. UTF-8 乱码 U+FFFD：grep 全 wiki，应为 0。
2. 代码块中文弯引号 ""（U+201C/U+201D）：应为 0（尤其 Java/算法 代码块）。
3. wikilink 坏链 + 锚点不匹配：抽查重指过的链接，确认指向存在的文件/标题。
4. 行数：列出仍 >800 行的文件（应已基本消除）。
5. 代码块语言标签缺失、callout 嵌套/连用、单文件多 H1、标题跳级：抽查阶段1改过的文件。
6. 面试题目.md 同步：抽查死链是否已修。
对发现的【明确且安全的残留问题】（乱码、漏网弯引号、明显坏链）直接就地修复；范围大的结构问题只记录不强行改。
用 Write 产出 ${AUD}/修复后验收报告.md：逐项 通过/未通过 + 残留问题清单 + 你就地修了什么。返回一句话总结 + 是否还有红旗。`
const verifyRes = await agent(verifyPrompt, { label: '3-验收', phase: 'Phase3-验收', agentType: 'general-purpose' })

// ---- 阶段4 归档 ----
phase('Phase4-归档')
const archivePrompt = `你是归档 agent。工作目录：${BASE}。
1. Read ${LOG}/ 下全部修复日志 + ${AUD}/修复后验收报告.md。
2. 按方法论格式把本轮修复写入 ${BASE}/优化记录.md：新条目置顶(保持最新在最前)，每条 \`- 文件路径 — 改动描述\` + \`**原因**：...\`，同文件同日合并。规则见 wiki-管理方法论.md。
3. 用 Write 产出 ${AUD}/修复总报告.md：本轮共修 P0/P1 各多少、拆了哪些文件、搬迁了什么、改了多少链接、新建了哪些文件/MOC、验收残留与后续建议。
4. 用 Write 更新 ${AUD}/进度.md：在末尾追加「P0+P1 修复」小节，列各阶段完成情况。
返回一句话总结：本轮修复成果 + 还剩什么(P2/残留)。`
const archiveRes = await agent(archivePrompt, { label: '4-归档', phase: 'Phase4-归档', agentType: 'general-purpose' })

return {
  phase1Units: p1Results.length,
  totalP0: p1Results.reduce((a, r) => a + (r.p0Fixed || 0), 0),
  totalP1: p1Results.reduce((a, r) => a + (r.p1Fixed || 0), 0),
  splits: splitsDigest,
  integrate: integrateRes,
  moc: mocRes,
  relink: relinkRes,
  verify: verifyRes,
  archive: archiveRes,
}
