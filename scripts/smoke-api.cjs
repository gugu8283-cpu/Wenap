/**
 * API smoke test (isolated SQLite — safe while dev:full is running).
 * Usage: node scripts/smoke-api.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const SECRET = process.env.ADMIN_SECRET || '';
const root = path.join(__dirname, '..');

function req(port, method, urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers,
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(buf);
          } catch {
            json = buf;
          }
          resolve({ status: res.statusCode, json, raw: buf });
        });
      },
    );
    r.on('error', reject);
    r.end();
  });
}

function waitForLog(child, pattern, ms = 20000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start timeout')), ms);
    const onData = (chunk) => {
      const s = String(chunk);
      if (pattern.test(s)) {
        clearTimeout(t);
        child.stdout?.off('data', onData);
        child.stderr?.off('data', onData);
        resolve();
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(t);
      reject(new Error(`server exited early code=${code}`));
    });
  });
}

function prepareSmokeDb(smokeDb) {
  const mainDb = path.resolve(root, process.env.SQLITE_PATH || path.join('data', 'wenap.db'));
  fs.mkdirSync(path.dirname(smokeDb), { recursive: true });
  if (fs.existsSync(smokeDb)) fs.unlinkSync(smokeDb);

  let copied = false;
  if (fs.existsSync(mainDb)) {
    try {
      fs.copyFileSync(mainDb, smokeDb);
      copied = true;
    } catch {
      console.warn('[smoke] 主库被占用，改用全新临时库 + 演示种子');
    }
  }

  if (!copied) {
    const seed = spawnSync(process.execPath, ['scripts/seed-demo.cjs'], {
      cwd: root,
      env: { ...process.env, SQLITE_PATH: smokeDb },
      encoding: 'utf8',
    });
    if (seed.status !== 0) {
      throw new Error(`seed-demo failed: ${seed.stderr || seed.stdout}`);
    }
  }
}

function failHttp(label, res) {
  const detail =
    typeof res.json === 'object' && res.json?.error
      ? res.json.error
      : String(res.raw || '').slice(0, 300);
  throw new Error(`${label} -> ${res.status}${detail ? ` (${detail})` : ''}`);
}

async function main() {
  const smokeDb = path.join(os.tmpdir(), 'wenap-smoke', `smoke-${process.pid}.db`);
  prepareSmokeDb(smokeDb);

  const port = 39000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['server.cjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), SQLITE_PATH: smokeDb, CRON_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await waitForLog(child, /listening on/i);
  console.log(`[smoke] server on :${port} (db: ${smokeDb})`);

  try {
    const acc = await req(port, 'GET', '/accuracy/stats');
    if (acc.status !== 200) failHttp('/accuracy/stats', acc);
    console.log('[smoke] /accuracy/stats OK', {
      total: acc.json?.total,
      tendencyAccuracy: acc.json?.tendencyAccuracy,
    });

    if (!SECRET || SECRET.length < 8) {
      console.warn('[smoke] ADMIN_SECRET missing — skip admin');
    } else {
      const overview = await req(port, 'GET', '/admin-api/stats/overview', {
        Authorization: `Bearer ${SECRET}`,
      });
      if (overview.status !== 200) failHttp('/admin-api/stats/overview', overview);
      console.log('[smoke] /admin-api/stats/overview OK');

      const bad = await req(port, 'GET', '/admin-api/stats/overview', { Authorization: 'Bearer wrong' });
      if (bad.status === 401) console.log('[smoke] admin auth OK');
      else console.warn('[smoke] expected 401, got', bad.status);
    }

    console.log('[smoke] All checks passed');
  } finally {
    child.kill('SIGTERM');
    try {
      if (fs.existsSync(smokeDb)) fs.unlinkSync(smokeDb);
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error('[smoke] FAILED:', e.message);
  if (/NODE_MODULE_VERSION|better_sqlite3/i.test(String(e.message))) {
    console.error('  → Node 与 better-sqlite3 原生模块版本不一致。请在 wenap 目录执行：');
    console.error('     cd wenap');
    console.error('     npm run rebuild:native');
    console.error(`     （当前 smoke 使用的 Node: ${process.version}）`);
  }
  process.exit(1);
});
