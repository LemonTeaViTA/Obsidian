const fs = require('fs');

const validateTopics = ['Java基础', 'JVM', 'MySQL', 'Redis', 'Spring', '并发编程', '集合框架'];
const logErrors = true; // True for logging character mismatches

validateTopics.forEach(topic => {
    let originalFile = `wiki/${topic}篇.md`;
    if (!fs.existsSync(originalFile)) {
        console.log(`Skipping validation: ${originalFile} not found.`);
        return;     
    }

    let original = fs.readFileSync(originalFile, 'utf8');

    // Strip out all whitespace, symbols, markdown markers, and the initial massive header to get pure valid characters
    let origPure = original.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '').replace(new RegExp(`^${topic}篇`), '');

    let splitText = '';
    
    // IMPORTANT LESSON: Files must be concatenated in their original exact sequence they were split!
    // Using fs.readdirSync() returns alphabetical order, which fails strict linear validation.
    // Replace parts array based on how the clustering script built the parts.
    
    let parts = fs.readdirSync(`wiki/${topic}`)
                  .filter(f => f.endsWith('.md') && !f.includes('MOC'));
                  
    // Example: For sequential validation, sort the parts or define array manually like:
    // parts = ['1.基础.md', '2.进阶.md'];
    
    // Fallback: Read alphabetically if hardcoded parts aren't available (will trigger false positives if content is out of order)
    parts.forEach(part => {
        splitText += fs.readFileSync(`wiki/${topic}/${part}`, 'utf8');
    });
    
    let splitPure = splitText.replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '');

    // Note: If chronological order of parts isn't preserved above, this will likely fail even if data isn't lost.
    if (origPure === splitPure) {
        console.log(`✅ ${topic} 校验通过：文本严格匹配，没有任何汉字/英文字符丢失！`);
    } else {
        console.log(`❌ ${topic} 存在顺序或丢失风险！(Orig Length: ${origPure.length}, Split Length: ${splitPure.length})`);
        
        if (logErrors) {
            for (let i = 0; i < Math.min(origPure.length, splitPure.length); i++) {
                if (origPure[i] !== splitPure[i]) {
                    console.log('Error around position:', i);
                    console.log('Orig: ...', origPure.substring(Math.max(0, i-20), i + 20));
                    console.log('Spli: ...', splitPure.substring(Math.max(0, i-20), i + 20));
                    break;
                }
            }
        }
    }
});
