const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../src/screens');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const lines = content.split('\n');
  const matches = [];
  lines.forEach((l, i) => {
    if (
      l.includes("backgroundColor: '#FFFFFF'") ||
      l.includes("backgroundColor: '#ffffff'") ||
      l.includes("backgroundColor: '#fff'") ||
      l.includes("backgroundColor: '#FFF'") ||
      l.includes("backgroundColor: '#FAF5EF'") ||
      l.includes("backgroundColor: '#F8FAFC'")
    ) {
      matches.push({ line: i + 1, text: l.trim() });
    }
  });
  if (matches.length > 0) {
    console.log(`\n=== ${file} (${matches.length} matches) ===`);
    matches.slice(0, 15).forEach(m => console.log(`  L${m.line}: ${m.text}`));
  }
}
