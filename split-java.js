const fs = require('fs');

function main() {
    let content = fs.readFileSync('wiki/Java基础篇.md', 'utf8');
    let parts = content.split(/^(##\s.*)$/gm);
    let sections = [];
    
    if (parts[0].trim()) {
        sections.push({ title: 'Java基础引言', content: parts[0] });
    }
    
    for (let i = 1; i < parts.length; i += 2) {
        let rawTitle = parts[i].trim().replace(/^##\s*/, '');
        let title = rawTitle.replace(/^\d+\.\s*/, '').replace(/（\d+\s*题）$/, '').trim();
        title = title.replace(/[\/\\]/g, '与'); // sanitize file names
        let body = parts[i] + '\n' + parts[i+1];
        sections.push({ title: title, content: body });
    }
    
    fs.mkdirSync('wiki/Java基础', { recursive: true });
    
    sections.forEach(sec => {
        let cleanContent = sec.content;
        
        // Fix H2: `## 1. Java 概述（6 题）` -> `## Java 概述`
        cleanContent = cleanContent.replace(/^(##\s+)\d+\.\s*(.*?)(?:（\d+\s*题）)?\s*$/gm, '$1$2');
        
        // Fix H3: `### 题 1：Java 语言...` -> `### Java 语言...`
        cleanContent = cleanContent.replace(/^(###\s*)(?:题\s*\d+[：: ]\s*)?/gm, '$1');
        
        cleanContent = cleanContent.trim() + '\n';
        
        fs.writeFileSync('wiki/Java基础/' + sec.title + '.md', cleanContent, 'utf8');
        console.log('Created: wiki/Java基础/' + sec.title + '.md');
    });
}

main();const fs = require('fs');
let content = fs.readFileSync('wiki/Java����ƪ.md', 'utf8');
let parts = content.split(/^(##\s.*)$/gm);
let sections = [];
if (parts[0].trim()) {
    sections.push({ title: '����', content: parts[0] });
}
for (let i = 1; i < parts.length; i += 2) {
    let rawTitle = parts[i].trim().replace(/^##\s*/, '');
    let title = rawTitle.replace(/^\d+\.\s*/, '').replace(/��\d+\s*�⣩$/, '').trim();
    title = title.replace(/\//g, '��');
    let body = parts[i] + '\n' + parts[i+1];
    sections.push({ title: title, content: body });
}
fs.mkdirSync('wiki/Java����', { recursive: true });
sections.forEach(sec => {
    let cleanContent = sec.content;
    // remove '## 1. Java����(xx��)' numbering
    cleanContent = cleanContent.replace(/^(##\s*)\d+\.\s*(.*?)(?:��\d+\s*�⣩)?\s*$/gm, '\\');
    // remove '### �� 1��'
    cleanContent = cleanContent.replace(/^(###\s*)(?:��\s*\d+[��: ]\s*)?/gm, '\');
    cleanContent = cleanContent.trim() + '\n';
    fs.writeFileSync('wiki/Java����/' + sec.title + '.md', cleanContent, 'utf8');
    console.log('Created: wiki/Java����/' + sec.title + '.md');
});

