/**
 * One-off: rename StockAI → Wenap in source/config (excludes node_modules, dist, data/history).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);
const SKIP_FILES = new Set(['rename-to-wenap.cjs']);
const EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.md', '.json', '.cjs', '.mjs', '.yml', '.yaml', '.env', '.example',
]);

const REPLACEMENTS = [
  ['stock-ai', 'wenap'],
  ['stock_ai', 'wenap'],
  ['stockai.app', 'wenap.app'],
  ['stockai.com', 'wenap.app'],
  ['StockAI ©', 'Wenap ©'],
  ['STOCKAI', 'WENAP'],
  ['StockAI', 'Wenap'],
  ['stockai', 'wenap'],
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      if (dir.includes(`${path.sep}data${path.sep}history`)) continue;
      walk(p, out);
    } else {
      const ext = path.extname(name);
      const base = path.basename(name);
      if (SKIP_FILES.has(base)) continue;
      if (!EXT.has(ext) && base !== '.env' && !base.endsWith('.example')) continue;
      out.push(p);
    }
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  let text = fs.readFileSync(file, 'utf8');
  const orig = text;
  for (const [from, to] of REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  if (text !== orig) {
    fs.writeFileSync(file, text, 'utf8');
    changed++;
    console.log('updated:', path.relative(root, file));
  }
}
console.log(`Done. ${changed} files updated.`);
