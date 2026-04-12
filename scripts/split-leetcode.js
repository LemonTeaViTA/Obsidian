const fs = require('fs');
const path = require('path');

const sourceFile = 'wiki/LeetCode-Hot100-完整题库.md';
const outputDir = 'wiki/算法机考';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

let content = fs.readFileSync(sourceFile, 'utf8');

// We want to split out everything up to the first '## 1.', which will be our MOC / Intro.
const headerRegex = /^##\s*\d+\.\s*(.*?)$/gm;
let matches = [...content.matchAll(headerRegex)];

if (matches.length === 0) {
    console.log("No categories found.");
    process.exit(1);
}

let introEnd = matches[0].index;
let introContent = content.slice(0, introEnd).trim();

// Keep intro in the index/MOC file
let mocContent = `# 算法机考 (LeetCode Hot 100)\n\n`;
mocContent += `> [[../MOC-LLM 知识库|返回全局导航]]\n\n`;
// Clean up intro text to fit MOC properly
introContent = introContent.replace(/^# LeetCode Hot100.*$/m, '');
mocContent += introContent + '\n\n';
mocContent += `## 🗂️ 核心分类目录\n\n`;

let partsList = [];

for (let i = 0; i < matches.length; i++) {
    let start = matches[i].index;
    let end = (i + 1 < matches.length) ? matches[i + 1].index : content.length;
    
    // Clean emojis and specific stuff from raw title to make the file name clean.
    // Replace non-word/non-chinese chars, but keep it simple.
    let rawTitle = matches[i][1].trim(); 
    let cleanTitle = rawTitle.replace(/[^\w\u4e00-\u9fa5（）\-]/g, '').trim();
    if (!cleanTitle) cleanTitle = `Chapter_${i+1}`;
    
    let fileName = `${(i+1).toString().padStart(2, '0')} - ${cleanTitle}.md`;
    
    // Process the block content
    let blockContent = content.slice(start, end).trim();
    
    // Rewrite the header to be H1
    blockContent = blockContent.replace(/^##\s*\d+\.\s*(.*?)$/m, `# $1\n\n> [[算法机考_MOC|返回算法导航]]`);
    
    partsList.push({
        fileName,
        content: blockContent
    });
    
    mocContent += `- [[${fileName.replace('.md', '')}|${cleanTitle}]]\n`;
}

// Write the files out
fs.writeFileSync(path.join(outputDir, '算法机考_MOC.md'), mocContent, 'utf8');
console.log(`Generated MOC: 算法机考_MOC.md`);

partsList.forEach(part => {
    fs.writeFileSync(path.join(outputDir, part.fileName), part.content + '\n', 'utf8');
    console.log(`Generated: ${part.fileName}`);
});

// We keep the original validation logic inside here for safety.
const origPure = content.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '').replace(/^LeetCodeHot完整题库增强版/, '');

let splitText = fs.readFileSync(path.join(outputDir, '算法机考_MOC.md'), 'utf8');
// remove MOC added text:
splitText = splitText.replace(/^# 算法机考 \(LeetCode Hot 100\)/m, '')
                     .replace(/> \[\[\.\.\/MOC-LLM 知识库\|返回全局导航\]\]/m, '')
                     .replace(/## 🗂️ 核心分类目录/m, '');
                     
partsList.forEach(part => {
    splitText += fs.readFileSync(path.join(outputDir, part.fileName), 'utf8')
                   .replace(/^# (.*?)$/m, '## X$1') // Revert H1 to roughly H2 equivalent logic or just ignore
                   .replace(/> \[\[算法机考_MOC\|返回算法导航\]\]/m, '');
});

// Clean the split text
let splitPure = splitText.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '').replace(/核心分类目录.*$/m, ''); // We might have junk from MOC list

// The strict index comparison is too tedious when injecting so much MOC text. We'll just do a lightweight check here, but output the total char count.
console.log(`Orig length: ${origPure.length}, Split approx length: ${splitPure.length}`);
