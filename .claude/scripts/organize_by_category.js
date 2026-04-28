#!/usr/bin/env node
/**
 * 根据 frontmatter 中的 category 字段，将 inbox 中的文件移动到对应的 staged 子目录
 */

const fs = require('fs');
const path = require('path');

// 解析 frontmatter
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatterText = match[1];
  const frontmatter = {};

  const lines = frontmatterText.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

// 更新文件中的 status 字段
function updateStatus(filePath, newStatus) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const newContent = content.replace(/^status: \w+$/m, `status: ${newStatus}`);
  fs.writeFileSync(filePath, newContent, 'utf-8');
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
  const inboxDir = path.join(rawsDir, 'inbox');
  const stagedDir = path.join(rawsDir, 'staged');

  if (!fs.existsSync(inboxDir)) {
    console.log('inbox 目录不存在');
    return;
  }

  const files = scanDirectory(inboxDir);
  console.log(`在 inbox 中找到 ${files.length} 个文件\n`);

  const stats = {
    moved: 0,
    skipped: 0,
    errors: 0
  };

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const category = frontmatter.category;

      if (!category || category === 'uncategorized') {
        console.log(`⊘ ${path.basename(file)} - 未分类，跳过`);
        stats.skipped++;
        continue;
      }

      const targetDir = path.join(stagedDir, category);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const targetPath = path.join(targetDir, path.basename(file));

      // 移动文件
      fs.renameSync(file, targetPath);

      // 更新 status 字段
      updateStatus(targetPath, 'staged');

      console.log(`✓ ${path.basename(file)} → staged/${category}/`);
      stats.moved++;
    } catch (error) {
      console.error(`✗ ${path.basename(file)}: ${error.message}`);
      stats.errors++;
    }
  }

  console.log('\n=== 统计 ===');
  console.log(`已移动: ${stats.moved}`);
  console.log(`跳过: ${stats.skipped}`);
  console.log(`错误: ${stats.errors}`);
}

main();
