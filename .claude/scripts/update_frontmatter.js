#!/usr/bin/env node
/**
 * 批量更新 raws 文件的 frontmatter，添加 status, category, priority, extracted_to 字段
 */

const fs = require('fs');
const path = require('path');

// 分类关键词映射
const categoryKeywords = {
  rag: ['RAG', '检索', '向量', '召回', 'Embedding', '知识库', '文档解析', 'MinerU', 'BookRAG'],
  agent: ['Agent', '智能体', 'Harness', 'Memory', 'Skills', 'MCP', 'Reflection'],
  java: ['Java', 'JVM', '集合', '并发', '线程', 'HashMap', 'ConcurrentHashMap'],
  mysql: ['MySQL', '数据库', 'InnoDB', '索引', 'B+树', '事务', 'MVCC'],
  redis: ['Redis', '缓存', 'Lua', '分布式锁', '持久化'],
  spring: ['Spring', 'SpringBoot', 'IoC', 'AOP', '微服务', 'Nacos'],
  project: ['派聪明', 'PaiSmart', 'Baize']
};

// 根据文件路径和内容推断分类
function inferCategory(filePath, content) {
  const pathLower = filePath.toLowerCase();
  const contentLower = content.toLowerCase();

  // 先根据路径判断
  if (pathLower.includes('paismart')) return 'project';

  // 再根据内容关键词判断
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return 'uncategorized';
}

// 根据文件路径推断状态
function inferStatus(filePath) {
  if (filePath.includes('/inbox/')) return 'inbox';
  if (filePath.includes('/staged/')) return 'staged';
  if (filePath.includes('/processed/')) return 'processed';
  if (filePath.includes('/archive/')) return 'archived';
  return 'inbox';
}

// 解析现有 frontmatter
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatterText = match[1];
  const body = match[2];
  const frontmatter = {};

  const lines = frontmatterText.split('\n');
  let currentKey = null;
  let currentValue = [];

  for (const line of lines) {
    if (line.match(/^[a-zA-Z_]+:/)) {
      if (currentKey) {
        frontmatter[currentKey] = currentValue.join('\n').trim();
      }
      const [key, ...valueParts] = line.split(':');
      currentKey = key.trim();
      currentValue = [valueParts.join(':').trim()];
    } else if (currentKey) {
      currentValue.push(line);
    }
  }

  if (currentKey) {
    frontmatter[currentKey] = currentValue.join('\n').trim();
  }

  return { frontmatter, body };
}

// 更新单个文件
function updateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  // 添加新字段（如果不存在）
  if (!frontmatter.status) {
    frontmatter.status = inferStatus(filePath);
  }

  if (!frontmatter.category) {
    frontmatter.category = inferCategory(filePath, content);
  }

  if (!frontmatter.priority) {
    frontmatter.priority = 'medium';
  }

  if (!frontmatter.extracted_to) {
    frontmatter.extracted_to = '[]';
  }

  if (!frontmatter.notes) {
    frontmatter.notes = '';
  }

  // 重新构建 frontmatter
  const newFrontmatter = [
    '---',
    `title: ${frontmatter.title || '"Untitled"'}`,
    `source: ${frontmatter.source || '""'}`,
    `author: ${frontmatter.author || ''}`,
    `published: ${frontmatter.published || ''}`,
    `created: ${frontmatter.created || new Date().toISOString().split('T')[0]}`,
    `status: ${frontmatter.status}`,
    `category: ${frontmatter.category}`,
    `priority: ${frontmatter.priority}`,
    `extracted_to: ${frontmatter.extracted_to}`,
    `notes: ${frontmatter.notes}`,
    `description: ${frontmatter.description || '""'}`,
    `tags: ${frontmatter.tags || ''}`,
    '---'
  ].join('\n');

  const newContent = newFrontmatter + '\n' + body;
  fs.writeFileSync(filePath, newContent, 'utf-8');

  return {
    file: path.basename(filePath),
    category: frontmatter.category,
    status: frontmatter.status
  };
}

// 递归扫描目录
function scanDirectory(dir) {
  const results = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...scanDirectory(fullPath));
    } else if (item.endsWith('.md')) {
      results.push(fullPath);
    }
  }

  return results;
}

// 主函数
function main() {
  const rawsDir = path.join(__dirname, '../../raws');
  const files = scanDirectory(rawsDir);

  console.log(`找到 ${files.length} 个 Markdown 文件`);

  const results = [];
  for (const file of files) {
    try {
      const result = updateFile(file);
      results.push(result);
      console.log(`✓ ${result.file} [${result.category}] [${result.status}]`);
    } catch (error) {
      console.error(`✗ ${path.basename(file)}: ${error.message}`);
    }
  }

  // 统计
  const stats = {
    total: results.length,
    byCategory: {},
    byStatus: {}
  };

  for (const result of results) {
    stats.byCategory[result.category] = (stats.byCategory[result.category] || 0) + 1;
    stats.byStatus[result.status] = (stats.byStatus[result.status] || 0) + 1;
  }

  console.log('\n=== 统计 ===');
  console.log(`总计: ${stats.total} 个文件`);
  console.log('\n按分类:');
  for (const [category, count] of Object.entries(stats.byCategory)) {
    console.log(`  ${category}: ${count}`);
  }
  console.log('\n按状态:');
  for (const [status, count] of Object.entries(stats.byStatus)) {
    console.log(`  ${status}: ${count}`);
  }
}

main();
