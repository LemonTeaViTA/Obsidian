const fs = require('fs');
const files = fs.readdirSync('wiki/集合框架').filter(f => f.endsWith('.md') && f !== '集合框架索引_MOC.md').map(f => 'wiki/集合框架/' + f);
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  // 15.为什么 HashMap 的容量是 2 的幂次方？ -> ### 为什么 HashMap 的容量是 2 的幂次方？
  content = content.replace(/^ \s*15\.为什么 HashMap/gm, '### 为什么 HashMap');
  
  // Remove trailing Set
  content = content.replace(/\n\s*Set\s*$/g, '\n');
  
  // Remove numbered prefix '### 23. ' or '### 🌟23. ' -> '### '
  content = content.replace(/^(#+)\s*(🌟)?\s*\d+\.\s*(🌟)?\s*/gm, '$1 $2$3');
  
  fs.writeFileSync(f, content, 'utf8');
});
console.log('Done!');
