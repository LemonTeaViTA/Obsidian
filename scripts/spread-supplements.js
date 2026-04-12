const fs = require('fs');
const path = require('path');

const supplements = [
    'wiki/LeetCode-Hot100/更多经典题目补充.md',
    'wiki/LeetCode-Hot100/补充题目（78-100）.md'
];

let unmatched = [];

supplements.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Split by questions
    let problems = content.split(/(?=### 题 \d+：)/);
    
    problems.forEach(prob => {
        if (!prob.startsWith('### 题')) return; // Skip intro
        
        let headerMatch = prob.match(/^### 题 \d+：(.*?)(?:（难度|（简单|（中等|（困难)/);
        if (!headerMatch) headerMatch = prob.match(/^### 题 \d+：(.*?)（/);
        
        let rawTitle = headerMatch ? headerMatch[1].trim() : prob.split('\n')[0];
        let category = null;
        
        let lower = prob.toLowerCase();
        
        // Very aggressive keyword mapping to route the supplement problem to the exact file
        if (prob.includes('二分查找') || prob.includes('二分法')) category = '二分查找.md';
        else if (prob.includes('动态规划') || prob.includes('dp =') || prob.includes('dp[')) category = '动态规划.md';
        else if (prob.includes('回溯') || prob.includes('backtrack')) category = '回溯算法.md';
        else if (prob.includes('贪心')) category = '贪心算法.md';
        else if (prob.includes('DFS') || prob.includes('BFS') || prob.includes('图') || prob.includes('邻接表') || lower.includes('dfs(') || lower.includes('bfs(')) category = '图.md';
        else if (prob.includes('树') || prob.includes('TreeNode') || prob.includes('二叉')) category = '树.md';
        else if (prob.includes('链表') || prob.includes('ListNode') || prob.includes('next')) category = '链表.md';
        else if (prob.includes('栈') || prob.includes('队列') || prob.includes('单调栈') || prob.includes('stack')) category = '栈与队列.md';
        else if (prob.includes('堆') || prob.includes('优先队列') || prob.includes('heapq') || prob.includes('PriorityQueue')) category = '堆.md';
        else if (prob.includes('字符串') || prob.includes('字母异位词')) category = '字符串.md';
        else if (prob.includes('排序') || prob.includes('sort(') || prob.includes('排序算法')) category = '排序.md';
        else if (prob.includes('位运算') || prob.includes('异或') || prob.includes('位操作')) category = '位运算.md';
        else if (prob.includes('数组') || prob.includes('矩阵') || prob.includes('matrix') || prob.includes('nums') || lower.includes('array')) category = '数组.md';
        else if (prob.includes('设计') || prob.includes('LRU') || prob.includes('数据流') || prob.includes('Trie')) category = '设计.md';
        else {
            category = '数组.md'; // fallback
            // console.log("Missing rule for:", rawTitle, "=> Defaulting to array");
        }
        
        if (category) {
            let targetPath = path.join('wiki/LeetCode-Hot100', category);
            if (fs.existsSync(targetPath)) {
                fs.appendFileSync(targetPath, '\n\n' + prob.trim() + '\n', 'utf8');
                console.log(`Moved: "${rawTitle}" -> ${category}`);
            }
        }
    });
});

console.log("Finished spreading supplementary problems.");
