/**
 * 清空分析/预测/演示数据，保留真实注册账号（非 demo-*）。
 * 用法：node scripts/clear-data.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const store = require('../db/store.cjs');

const root = path.join(__dirname, '..');
const historyDir = path.join(root, 'data', 'history');
const quotaFile = path.join(root, 'data', 'quotas.json');
const watchlistFile = path.join(root, 'data', 'watchlist.json');

function rmDirContents(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    if (name === '.gitkeep') continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      fs.rmSync(p, { recursive: true, force: true });
      n += 1;
    } else if (name !== 'index.json') {
      fs.unlinkSync(p);
      n += 1;
    }
  }
  return n;
}

function main() {
  const db = store.getDb();

  const r1 = db.prepare('DELETE FROM prediction_results').run();
  const r2 = db.prepare('DELETE FROM predictions').run();
  const r3 = db.prepare('DELETE FROM analysis_logs').run();
  const r4 = db.prepare(`DELETE FROM users WHERE external_key LIKE 'demo-%'`).run();

  db.prepare(
    `UPDATE users SET free_trials_used = 0, free_trials_reset_at = datetime('now') WHERE email IS NOT NULL AND email NOT LIKE 'demo-%'`,
  ).run();

  fs.writeFileSync(
    path.join(historyDir, 'index.json'),
    JSON.stringify({ version: 1, byUser: {} }, null, 2),
    'utf8',
  );
  const removedDirs = rmDirContents(historyDir);

  fs.writeFileSync(quotaFile, JSON.stringify({ version: 1, byUser: {} }, null, 2), 'utf8');

  if (fs.existsSync(watchlistFile)) {
    fs.writeFileSync(watchlistFile, JSON.stringify({ version: 1, byUser: {} }, null, 2), 'utf8');
  }

  const usersLeft = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const logsLeft = db.prepare('SELECT COUNT(*) AS c FROM analysis_logs').get().c;
  const predsLeft = db.prepare('SELECT COUNT(*) AS c FROM predictions').get().c;

  console.log('[clear-data] 已清空：');
  console.log(`  prediction_results: ${r1.changes} 行`);
  console.log(`  predictions: ${r2.changes} 行`);
  console.log(`  analysis_logs: ${r3.changes} 行`);
  console.log(`  demo 用户: ${r4.changes} 个`);
  console.log(`  历史报告目录: ${removedDirs} 个用户文件夹`);
  console.log(`  quotas.json / watchlist.json 已重置`);
  console.log('[clear-data] 当前：');
  console.log(`  用户 ${usersLeft} | 分析记录 ${logsLeft} | 预测 ${predsLeft}`);
}

main();
