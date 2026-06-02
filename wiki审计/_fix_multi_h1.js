export const meta = {
  name: 'fix-multi-h1',
  description: '修复 2 个真实多 H1 文件: Baize 文件上传机制 + Git.md',
  phases: [
    { title: 'Fix', detail: '2 个 agent 并行修复' },
    { title: 'Verify', detail: '运行 check.sh 确认多 H1 清零' },
  ],
}

const BASE = '/home/ubuntu/ADgai/dsq/Obsidian'

const baizePrompt = `你是【知识库结构修复 agent】。工作目录：${BASE}。

## 任务
修复 ${BASE}/wiki/Baize项目/文件上传机制.md 的多 H1 问题。

## 现状
该文件有 7 个 H1,违反"单文件单 H1"方法论。这 7 个 H1 实际是 7 个面试问题,应该作为 H2(章节)而不是 H1(文档标题):

- L8: # 文件上传限制：大小、数量、类型
- L79: # 文件上传分片大小：为什么是 5MB？
- L134: # 分片上传：怎么知道文件传没传完？
- L272: # 分片上传中 MySQL 存储了什么？
- L331: # 分片文件存储在哪里？
- L398: # 断点续传：怎么实现的？为什么这样设计？
- L482: # 文档更新机制：修改后重新上传是新文档还是覆盖旧文档？

## 修复方法
1. 先用 Read 读完整个文件(557行)了解结构。
2. 在文件最顶端(frontmatter 之后)添加单一 H1 作为文档标题: \`# 文件上传机制\`
3. 把原来 7 个 H1 全部降级为 H2 (\`#\` → \`##\`)。
4. 检查这 7 个 section 内部:如果有 H2,需相应降级为 H3,以此类推(避免标题层级混乱)。
5. 用 Edit 工具逐个改(或 Read→Write 整体重写,选你认为最稳的方式)。

## 验证
改完后用 awk 自查:
\`awk '/^\\\`\\\`\\\`/{c=!c; next} !c && /^# /{n++} END{print "H1: " n}' "${BASE}/wiki/Baize项目/文件上传机制.md"\`
应该输出 \`H1: 1\`。

返回 3-4 句:修了几个 H1、新文档结构如何、是否通过自查。`

const gitPrompt = `你是【知识库结构修复 agent】。工作目录：${BASE}。

## 任务
重写 ${BASE}/wiki/Git.md(目前是个未规范化的速查表)。

## 现状
该文件 56 行,**完全没有 markdown 结构**:
- 无 H1 文档标题
- 无代码块包裹(整个文件是裸 bash 命令)
- 用 \`#\` 行注释作为分组(L1/9/19/24/28/34/38/42/45/51/53),其中后 4 个(42/45/51/53)被误判为 H1

## 修复方法
1. 用 Read 读完整个文件(只有 56 行)。
2. 用 Write 整体重写为规范的 markdown 文档,结构如下:
   - frontmatter (module: 工具, tags: [Git], difficulty: easy, last_reviewed: 2026-06-02)
   - 单一 H1: \`# Git 常用命令\`
   - 按现有分组用 H2: 日常开发流程 / 分支管理 / 同步远程 / 查看历史 / 撤销 / 从 git 追踪中移除 / 检查 gitignore / 标准工作流
   - 每个 H2 下的命令用代码块包裹 (\`\\\`\\\`\\\`bash ... \\\`\\\`\\\`\`)
   - 原始 \`#\` 注释保留在代码块内
3. 改后文件应该是合法的 Obsidian markdown,有清晰结构。

## 验证
改完后:
- 单 H1: \`awk '/^\\\`\\\`\\\`/{c=!c; next} !c && /^# /{n++} END{print n}' ${BASE}/wiki/Git.md\` 应为 1
- 行数应在 60-100 行之间(适当扩展为正规 markdown 后)

返回 3-4 句:重写后的结构、行数、是否通过自查。`

phase('Fix')
log('启动 2 个 agent 并行修复多 H1 问题')
const [baizeRes, gitRes] = await parallel([
  () => agent(baizePrompt, { label: 'Baize文件上传机制', phase: 'Fix', agentType: 'general-purpose' }),
  () => agent(gitPrompt, { label: 'Git.md重写', phase: 'Fix', agentType: 'general-purpose' }),
])

phase('Verify')
const verifyPrompt = `你是【验收 agent】。工作目录：${BASE}。

刚完成 2 个文件的多 H1 修复:
- wiki/Baize项目/文件上传机制.md (原 7 个 H1 → 应降为 1 个)
- wiki/Git.md (原无结构 → 应重写为规范 markdown)

请用 Bash 验证:
1. 运行 \`${BASE}/wiki审计/check.sh --structure 2>&1 | grep "多H1"\`
2. 该命令输出应为空(无多 H1 文件)或只剩 0 个红旗。

如果还有多 H1 文件,列出来。

返回一句话:多 H1 是否清零,如未清零列出残留。`
const verifyRes = await agent(verifyPrompt, { label: '验收', phase: 'Verify', agentType: 'general-purpose' })

return { baize: baizeRes, git: gitRes, verify: verifyRes }
