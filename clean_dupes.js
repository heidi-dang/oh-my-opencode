const fs = require('fs');
const glob = require('glob'); // Assuming glob is available, or use a naive traversal

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let cleaned = [];
  
  // Very simplistic deduplication for identical lines within a 10 line distance
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let isDupe = false;
    let trimmed = line.trim();
    if (trimmed.startsWith('directory: ') || 
        trimmed.startsWith('worktree: ') || 
        trimmed.startsWith('metadata: ') || 
        trimmed.startsWith('ask: ')) {
      for (let j = Math.max(0, i - 15); j < i; j++) {
        if (lines[j].trim() === trimmed) {
          isDupe = true;
          break;
        }
      }
    }
    if (!isDupe) {
      cleaned.push(line);
    }
  }
  fs.writeFileSync(filePath, cleaned.join('\n'));
}

const child_process = require('child_process');
const files = child_process.execSync('find src -name "*.test.ts"').toString().trim().split('\n');
for (const file of files) {
  if (file) cleanFile(file);
}
