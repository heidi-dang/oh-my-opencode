const fs = require('fs');

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let cleaned = [];
  
  // Very simplistic deduplication for identical lines within a 15 line distance
  let madeChanges = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let isDupe = false;
    let trimmed = line.trim();
    if (trimmed.startsWith('directory: ') || 
        trimmed.startsWith('worktree: ') || 
        trimmed.startsWith('metadata: ') || 
        trimmed.startsWith('messageID: ') || 
        trimmed.startsWith('agent: ') || 
        trimmed.startsWith('abort: ') || 
        trimmed.startsWith('ask: ')) {
      for (let j = Math.max(0, i - 25); j < i; j++) {
        if (lines[j].trim() === trimmed) {
          isDupe = true;
          madeChanges = true;
          break;
        }
      }
    }
    if (!isDupe) {
      cleaned.push(line);
    }
  }
  if (madeChanges) {
    fs.writeFileSync(filePath, cleaned.join('\n'));
    console.log("Cleaned", filePath);
  }
}

const child_process = require('child_process');
const files = child_process.execSync('find src -name "*.test.ts"').toString().trim().split('\n');
for (const file of files) {
  if (file) cleanFile(file);
}
