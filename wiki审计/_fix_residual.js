export const meta = {
  name: 'wiki-fix-残留P0P1',
  description: '修复残留 P0+P1：面试题目.md 批量补目录前缀 + 4 条路径错误',
  phases: [
    { title: 'Fix', detail: '单 agent 修复：面试题目.md 批量补前缀 + PaiFlow 路径修正' },
    { title: 'Verify', detail: '重跑锚点验证，确认成功率 >95%' },
  ],
}

const BASE = '/home/ubuntu/ADgai/dsq/Obsidian'
const AUD = BASE + '/wiki审计'

const fixPrompt = `你是【残留问题修复 agent】。工作目录：${BASE}。

Phase 2 验收发现 2 个残留问题,请精准修复:

## P0: wiki/面试题目.md 链接缺目录前缀(~70% 失效)

**问题**: 大量链接格式为 \`[[文件名#锚点]]\`,缺少域前缀,导致 Obsidian 无法精确解析。

**修复方法**:
1. 用 Read 读取 ${BASE}/wiki/面试题目.md 全文。
2. 用 find 列出 wiki/ 下所有域的实际文件清单(分组按域,如 wiki/MySQL/*.md、wiki/JVM/*.md)。
3. 对面试题目.md 中每条 \`[[文件名#...]]\` 或 \`[[文件名]]\`:
   - 用 find 结果确定该文件属于哪个域(如 索引机制详解.md 在 MySQL/)。
   - 把链接改为 \`[[域/文件名#...]]\`(如 \`[[MySQL/索引机制详解#...]]\`)。
   - 注意保留原锚点不变;只改文件路径部分。
4. 批量规则(根据验收报告的失效清单优先处理):
   - \`[[计算机网络#...]]\` → \`[[计算机网络/计算机网络#...]]\`
   - \`[[缓存经典问题#...]]\` → \`[[Redis/缓存经典问题#...]]\`
   - \`[[高可用与分库分表#...]]\` → \`[[MySQL/高可用与分库分表#...]]\`
   - \`[[锁机制#...]]\` → \`[[MySQL/锁机制#...]]\`
   - \`[[Spring MVC 架构#...]]\` → \`[[Spring/Spring MVC 架构#...]]\`
   - \`[[MySQL 基础与架构#...]]\` → \`[[MySQL/MySQL 基础与架构#...]]\`
   - \`[[JVM 类加载机制#...]]\` → \`[[JVM/JVM 类加载机制#...]]\`
   - \`[[优化与实战#...]]\` → \`[[MySQL/优化与实战#...]]\`
   - \`[[索引机制详解#...]]\` → \`[[MySQL/索引机制详解#...]]\`
   - \`[[JVM 垃圾收集#...]]\` → \`[[JVM/JVM 垃圾收集#...]]\`
   - \`[[事务与MVCC#...]]\` → \`[[MySQL/事务与MVCC#...]]\`
   - 类似地,扫全文、按域归类、批量加前缀。
5. 用 Edit 把修复后的内容写回 ${BASE}/wiki/面试题目.md。

注意:
- 已有域前缀的链接(如 \`[[Agent/...]]\` \`[[RAG/...]]\`)保持不变。
- 子目录文件(如 \`[[主流 Coding Agent 实现对比/索引]]\`)保持不变。
- 占位符/术语(如 \`[[wikilink]]\` \`[[主文档]]\`)保持不变。

## P1: PaiFlow 路径错误 1 处

修复 ${BASE}/wiki/PaiFlow/PaiFlow工作流平台.md 第 51 行:
- 原: \`[[LLM/Agent 核心概念]]\`
- 改: \`[[Agent/Agent 核心概念]]\`

用 Read 确认行号后用 Edit 精确替换。

## 输出

用 Write 写修复日志到 ${AUD}/_修复日志/_残留P0P1修复.md,记录:
- 面试题目.md 修改了多少条链接(分域统计)
- PaiFlow 修改详情
- 修复前后对比示例

返回 3-5 句话总结:修了多少链接、哪些域、PaiFlow 是否已改。`

const verifyPrompt = `你是【残留修复验收 agent】。工作目录：${BASE}。

刚完成残留 P0+P1 修复。请验证:

1. **面试题目.md 锚点验证**:
   - Read ${BASE}/wiki/面试题目.md。
   - 随机抽 30 条 \`[[域/文件#锚点]]\` 链接(比上次 20 条多)。
   - 对每条:验证文件存在(\`find wiki/域/ -name 文件.md\`)、Read 文件确认锚点标题存在。
   - 统计成功率(目标 >95%)。

2. **PaiFlow 路径修正验证**:
   - grep ${BASE}/wiki/PaiFlow/PaiFlow工作流平台.md 确认不再含 \`[[LLM/Agent 核心概念]]\`,已改为 \`[[Agent/Agent 核心概念]]\`。

3. **全仓库坏链统计**(快速):
   - 用 grep 抽取全仓库 wikilink,用 find 核对文件是否存在,统计剩余坏链数。

用 Write 产出 ${AUD}/残留修复验收报告.md:
- 面试题目.md 锚点成功率(30 条抽样)
- PaiFlow 验证结果
- 全仓库坏链剩余数
- 结论:Pass / 部分 Pass / Fail

返回一句话:成功率 + Pass/Fail。`

phase('Fix')
log('修复残留 P0(面试题目.md 批量补前缀) + P1(PaiFlow 路径)')
const fixRes = await agent(fixPrompt, { label: '残留P0P1修复', phase: 'Fix', agentType: 'general-purpose' })

phase('Verify')
log('验收:抽样 30 条锚点 + 全仓库坏链统计')
const verifyRes = await agent(verifyPrompt, { label: '残留修复验收', phase: 'Verify', agentType: 'general-purpose' })

return { fix: fixRes, verify: verifyRes }
