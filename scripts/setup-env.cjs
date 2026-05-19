/**
 * Append missing Wenap admin / cron env vars to .env (does not overwrite existing keys).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '..', '.env');
const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
const keys = new Set(
  lines
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=')[0].trim()),
);

const toAdd = [];
if (!keys.has('ADMIN_SECRET')) {
  const secret = crypto.randomBytes(32).toString('hex');
  toAdd.push(`ADMIN_SECRET=${secret}`);
  console.log('[setup-env] Generated ADMIN_SECRET (32 bytes hex) — save it for /admin login');
}
if (!keys.has('CRON_ENABLED')) toAdd.push('CRON_ENABLED=true');
if (!keys.has('PREDICTION_VERIFY_DAYS')) toAdd.push('PREDICTION_VERIFY_DAYS=30');
if (!keys.has('TENDENCY_THRESHOLD')) toAdd.push('TENDENCY_THRESHOLD=5');
if (!keys.has('SQLITE_PATH')) toAdd.push('SQLITE_PATH=./data/wenap.db');
if (!keys.has('JWT_SECRET')) {
  toAdd.push(`JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`);
  console.log('[setup-env] Generated JWT_SECRET');
}
if (!keys.has('APP_PUBLIC_URL')) toAdd.push('APP_PUBLIC_URL=http://localhost:5173');

if (!toAdd.length) {
  console.log('[setup-env] .env already has admin/cron keys — nothing to add');
  process.exit(0);
}

const block = ['', '# --- Wenap 预测追踪 / 管理后台（scripts/setup-env.cjs 自动追加）---', ...toAdd, ''];
fs.appendFileSync(envPath, (lines.length && !lines[lines.length - 1] ? '' : '\n') + block.join('\n') + '\n', 'utf8');
console.log('[setup-env] Appended:', toAdd.map((l) => l.split('=')[0]).join(', '));
