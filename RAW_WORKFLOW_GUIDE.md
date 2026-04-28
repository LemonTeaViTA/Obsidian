# Raw 文档整理与质量检查系统使用指南

本指南说明如何使用新建立的 Agent 工作流系统来管理原始文档和维护知识库质量。

## 📁 目录结构

```
raws/
├── inbox/           # 新导入的原始文件（未分类）
├── staged/          # 已分类待整理
│   ├── rag/        # RAG 相关文章
│   ├── agent/      # Agent 相关文章
│   ├── java/       # Java 相关文章
│   ├── mysql/      # MySQL 相关文章
│   ├── redis/      # Redis 相关文章
│   ├── spring/     # Spring 相关文章
│   └── project/    # 项目相关（如 PaiSmart）
├── processed/       # 已整理完成
└── archive/         # 不需要整理的存档
```

## 🔄 完整工作流程

### 第一步：导入新文档

将新的 Markdown 文件放入 `raws/inbox/` 目录。

### 第二步：自动分类（Raw Intake）

**触发命令**：
```
请帮我分类 inbox 中的文件
```

**工作流程**：
1. Agent 扫描 `inbox/` 目录
2. 分析每个文件的标题、描述和内容
3. 根据关键词推断分类（RAG/Agent/Java/MySQL/Redis/Spring/Project）
4. 展示分类建议，等待你确认
5. 确认后自动：
   - 更新文件的 frontmatter（添加 status, category 等字段）
   - 移动文件到 `staged/{category}/`

**输出示例**：
```
已分类 15 个文件：
  - RAG: 8 个
  - Agent: 3 个
  - Project: 4 个

当前待处理：
  - staged/rag/: 36 个
  - staged/agent/: 5 个
  - staged/project/: 21 个
```

### 第三步：内容提取（Content Extraction）

**触发命令**：
```
请帮我整理 staged/rag/ 中的第一个文件
```
或
```
请帮我整理 staged/rag/2026年构建RAG系统的核心策略.md
```

**工作流程**：
1. Agent 读取指定文件
2. 按照规范提取核心内容：
   - 问题背景（现有技术痛点）
   - 解决方案（核心创新点）
   - 项目链接（GitHub、论文）
   - 跳过使用教程、安装命令
   - 标注数据来源
3. 生成提取预览，展示：
   - 提取的核心内容
   - 建议写入的 wiki 文件
   - 建议的章节位置
4. 等待你确认
5. 确认后自动：
   - 写入对应的 wiki 文件
   - 更新 frontmatter（status: processed, extracted_to: [...]）
   - 移动文件到 `processed/`
   - 在 `优化记录.md` 中追加日志

**重要原则**：
- 一次只处理一个文件
- 必须人工审核，不可批量
- 如果拒绝，Agent 会修改后重新预览

### 第四步：质量检查（Quality Check）

**触发命令**：
```
请运行质量检查
```

**检查项目**：
1. **链接完整性**：检测断链、嵌套链接
2. **内容重复**：检测相似段落（> 80%）
3. **结构一致性**：检查算法题解、面试题解的格式
4. **面试题目同步**：检查 wiki 题解与 `面试题目.md` 的同步
5. **孤岛页面**：检测没有入站链接的页面
6. **优化记录完整性**：检查最近 7 天的变更是否记录

**输出示例**：
```
=== 质量检查报告 ===

[断链] 发现 3 处断链：
  - wiki/Redis/缓存经典问题.md:45 → [[不存在的文件]]
  - wiki/面试题目.md:120 → [[MySQL篇#不存在的锚点]]

[重复内容] 发现 2 处可能重复：
  - wiki/RAG/检索召回与优化.md 与 wiki/Agent/Agent工程实践.md
    相似段落：Embedding 三代演进（建议使用引用）

[孤岛页面] 发现 1 个孤岛：
  - wiki/临时笔记.md（无入站链接）
```

### 第五步：交叉链接构建（Cross-Link Builder）

**触发命令**：
```
请帮我构建交叉链接
```

**工作流程**：
1. Agent 扫描所有 wiki 文件，提取关键概念
2. 分析概念之间的关联：
   - 同义词（并发 ↔ 多线程）
   - 上下位关系（HashMap → 集合框架）
   - 对比关系（悲观锁 vs 乐观锁）
   - 依赖关系（Spring AOP → 动态代理）
3. 生成双向链接建议
4. 等待你确认
5. 确认后批量插入链接

**输出示例**：
```
=== 交叉链接建议 ===

[1] wiki/MySQL/锁与事务机制.md:67
  "悲观锁和乐观锁" → 建议链接到 [[并发编程/锁#悲观锁与乐观锁]]

[2] wiki/并发编程/锁.md:120
  建议添加反向链接：MySQL 中的锁机制 → [[MySQL/锁与事务机制]]
```

## 🛠️ 手动工具

### 批量更新 Frontmatter
```bash
node .claude/scripts/update_frontmatter.js
```

### 批量分类整理
```bash
node .claude/scripts/organize_by_category.js
```

## 📋 质量检查清单

详见 [wiki/QUALITY_CHECKLIST.md](wiki/QUALITY_CHECKLIST.md)

定期检查计划：
- **每日**：检查新增内容的链接和格式
- **每周**：运行完整的 Quality Check
- **每月**：优化交叉链接

## 📝 Frontmatter 字段说明

每个 raw 文件的 frontmatter 包含：

```yaml
---
title: "文章标题"
source: "原文链接"
author: "作者"
published: 2026-04-27
created: 2026-04-27
status: inbox | staged | processed | archived
category: rag | agent | java | mysql | redis | spring | project
priority: high | medium | low
extracted_to: ["wiki/RAG/xxx.md"]  # 已提取到哪些 wiki 文件
notes: "简短备注"
description: "文章描述"
tags:
  - "clippings"
---
```

## 🎯 最佳实践

### 导入新文档时
1. 确保文件有基本的 frontmatter（至少包含 title 和 source）
2. 放入 `inbox/` 后立即运行分类
3. 不要在 `inbox/` 中堆积过多文件（建议 < 20 个）

### 整理文档时
1. 一次只整理一个文件，不要批量
2. 仔细审核 Agent 提取的内容
3. 确认数据来源都已标注
4. 确认项目链接都已保留

### 维护质量时
1. 每周运行一次质量检查
2. 优先修复断链（severity: error）
3. 定期优化交叉链接，减少孤岛页面
4. 保持 `优化记录.md` 的更新

## 🔧 配置文件

所有工作流配置文件位于 `.claude/workflows/`：
- `raw_intake.yaml` - 分类规则配置
- `content_extraction.yaml` - 提取规则配置
- `quality_check.yaml` - 检查规则配置
- `cross_link_builder.yaml` - 链接规则配置

可以根据需要调整关键词、优先级等参数。

## 📊 统计信息

当前状态（2026-04-27）：
- 总文件数：62 个
- 已分类：62 个（100%）
- 待整理：62 个（staged）
- 已整理：0 个（processed）

分类分布：
- RAG: 36 个（58%）
- Agent: 5 个（8%）
- Project: 21 个（34%）

## 🆘 常见问题

**Q: 如果分类错误怎么办？**
A: 手动移动文件到正确的 `staged/` 子目录，然后更新 frontmatter 中的 `category` 字段。

**Q: 如果提取的内容不满意怎么办？**
A: 在确认步骤选择拒绝，Agent 会修改后重新预览。也可以手动编辑 wiki 文件。

**Q: 如何处理重复文件？**
A: 检查 frontmatter 中的 `source` 字段，如果来源相同则删除重复文件。

**Q: 如何归档不需要整理的文件？**
A: 移动到 `raws/archive/`，并更新 frontmatter 的 `status: archived`。

---

**参考资料**：
- [AGENTS.md](AGENTS.md) - Agent 工作流详细定义
- [wiki/QUALITY_CHECKLIST.md](wiki/QUALITY_CHECKLIST.md) - 质量检查清单
- [优化记录.md](优化记录.md) - 历史变更记录
