const fs = require('fs');
const path = require('path');

// This is a template script for splitting large monolithic markdown files into clustered smaller topics.
// Adjust the topic name, the regex pattern for finding headings, and the clustering thresholds as needed.

const sourceFile = 'wiki/Java基础篇.md';
const outputDir = 'wiki/Java基础';
const originalPrefix = 'Java基础篇';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// Read monolithic content
let content = fs.readFileSync(sourceFile, 'utf8');

// Example standard regex for finding numbered interview questions like "1. 什么是Java?"
// Note: Depending on the specific markdown file, this regex might need tuning (e.g., removing emojis).
const headerRegex = /^## (\d+)\.\s*(.*)/gm;

let matches = [...content.matchAll(headerRegex)];
let blocks = [];

for (let i = 0; i < matches.length; i++) {
    let start = matches[i].index;
    let end = (i + 1 < matches.length) ? matches[i + 1].index : content.length;
    blocks.push({
        num: parseInt(matches[i][1]),
        rawTitle: matches[i][2].trim(),
        content: content.slice(start, end).trim()
    });
}

// Example Clustering Logic
// Define the threshold boundaries and cluster names based on topic logic.
const clusters = [
    { limit: 20, name: '面向对象.md', parts: [] },
    { limit: 40, name: '异常与 IO.md', parts: [] },
    { limit: 999, name: '注解、反射与 Java 8.md', parts: [] }
];

blocks.forEach(block => {
    // Format the header to remove the number for better Obsidian viewing: "### 面向对象" instead of "## 12. 面向对象"
    let cleanHeader = `### ${block.rawTitle}`;
    let modifiedContent = block.content.replace(/^## \d+\.\s*(.*)/m, cleanHeader);
    
    // Assign to a cluster
    for (let cluster of clusters) {
        if (block.num <= cluster.limit) {
            cluster.parts.push(modifiedContent);
            break;
        }
    }
});

// Write to files
clusters.forEach(cluster => {
    if (cluster.parts.length > 0) {
        let finalOutput = `# ${cluster.name.replace('.md', '')}\n\n` + cluster.parts.join('\n\n---\n\n') + '\n';
        fs.writeFileSync(path.join(outputDir, cluster.name), finalOutput, 'utf8');
        console.log(`Generated: ${cluster.name} (${cluster.parts.length} questions)`);
    }
});
