const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function patch(rel, fn) {
  const fp = path.join(root, rel);
  let s = fs.readFileSync(fp, 'utf8');
  const next = fn(s);
  if (next !== s) fs.writeFileSync(fp, next, 'utf8');
  console.log('patched', rel);
}

patch('src/admin/components.jsx', (s) => {
  s = s.replace(/if \(!iso\) return '[^']*'?\s*\n/m, "if (!iso) return '-'\n");
  s = s.replace(
    /if \(n == null \|\| Number\.isNaN\(Number\(n\)\)\) return '[^']*'?\s*\n/m,
    "if (n == null || Number.isNaN(Number(n))) return '-'\n",
  );
  return s;
});

patch('src/admin/pages/Users.jsx', (s) => {
  s = s.replace(/<option value="1">[^<]*<\/option>/, '<option value="1">已封禁</option>');
  s = s.replace(/<Btn onClick=\{load\}>[^<]*<\/Btn>/, '<Btn onClick={load}>筛选</Btn>');
  return s;
});

patch('src/admin/AdminLayout.jsx', (s) => {
  s = s.replace(/\s*[^\n]*返回主站/, '\n            ← 返回主站');
  s = s.replace(/退出登[^\n<]*/, '退出登录');
  return s;
});
