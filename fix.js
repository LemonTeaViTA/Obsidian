const fs = require('fs');
['HashMap核心原理.md', 'List体系.md', 'Set体系与HashSet.md'].forEach(file => {
    let p = 'wiki/集合框架/' + file;
    let s = fs.readFileSync(p, 'utf8');
    // Remove headings numbering (e.g. '### 16. ', '## 2. ', '### ??24. ')
    s = s.replace(/^\uFEFF?(#+)\s*(?:??\s*)?\d+\.\s*(?:??\s*)?/gm, '\ ');
    // Remove trailing 'Set' in HashMap if it exists
    if (file === 'HashMap核心原理.md') {
        s = s.replace(/\s+Set\s*$/, '\n');
    }
    fs.writeFileSync(p, s, 'utf8');
    console.log('Fixed:', p);
});
