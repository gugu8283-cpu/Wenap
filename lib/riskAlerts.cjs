/**
 * Pro+ risk alerts — watchlist price drop / volume spike checks (daily cron).
 */
const fs = require('fs');
const path = require('path');
const { initDb } = require('../db/store.cjs');
const { pushNotification } = require('../routes/notifications.cjs');
const {
  marketDataProvider,
  marketstackConfigured,
  fetchEodClosesOldestFirst,
} = require('./marketstackClient.cjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const WATCHLIST_FILE = path.join(DATA_DIR, 'watchlist.json');

function getDb() {
  return initDb();
}

function ensureSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_settings (
      user_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      drop_pct REAL DEFAULT 5,
      volume_spike REAL DEFAULT 2,
      email_only INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS alert_cooldown (
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      last_alert_at TEXT,
      PRIMARY KEY (user_id, symbol)
    );
  `);
}

function readWatchlist() {
  try {
    if (!fs.existsSync(WATCHLIST_FILE)) return { byUser: {} };
    return JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
  } catch {
    return { byUser: {} };
  }
}

function getAlertSettings(userId) {
  ensureSchema();
  const db = getDb();
  const row = db.prepare(`SELECT * FROM alert_settings WHERE user_id = ?`).get(userId);
  return {
    enabled: Boolean(row?.enabled),
    dropPct: Number(row?.drop_pct) || 5,
    volumeSpike: Number(row?.volume_spike) || 2,
    emailOnly: row?.email_only !== 0,
  };
}

function saveAlertSettings(userId, body) {
  ensureSchema();
  const db = getDb();
  const enabled = body?.enabled ? 1 : 0;
  const dropPct = Math.min(50, Math.max(1, Number(body?.dropPct) || 5));
  const volumeSpike = Math.min(10, Math.max(1.2, Number(body?.volumeSpike) || 2));
  const emailOnly = body?.emailOnly === false ? 0 : 1;
  db.prepare(
    `INSERT INTO alert_settings (user_id, enabled, drop_pct, volume_spike, email_only, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       enabled=excluded.enabled,
       drop_pct=excluded.drop_pct,
       volume_spike=excluded.volume_spike,
       email_only=excluded.email_only,
       updated_at=datetime('now')`,
  ).run(userId, enabled, dropPct, volumeSpike, emailOnly);
  return getAlertSettings(userId);
}

function onCooldown(userId, symbol) {
  ensureSchema();
  const db = getDb();
  const row = db
    .prepare(`SELECT last_alert_at FROM alert_cooldown WHERE user_id = ? AND symbol = ?`)
    .get(userId, symbol);
  if (!row?.last_alert_at) return false;
  const last = new Date(row.last_alert_at).getTime();
  return Date.now() - last < 24 * 3600 * 1000;
}

function markCooldown(userId, symbol) {
  ensureSchema();
  const db = getDb();
  db.prepare(
    `INSERT INTO alert_cooldown (user_id, symbol, last_alert_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id, symbol) DO UPDATE SET last_alert_at=datetime('now')`,
  ).run(userId, symbol);
}

async function evaluateSymbolAlert(symbol, settings) {
  if (marketDataProvider() !== 'marketstack' || !marketstackConfigured()) {
    return null;
  }
  const rows = await fetchEodClosesOldestFirst(symbol, 30, true);
  if (rows.length < 5) return null;
  const latest = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  if (!latest?.close || !prev?.close) return null;
  const dropPct = ((prev.close - latest.close) / prev.close) * 100;
  const vols = rows.slice(-6, -1).map((r) => r.volume).filter((v) => v > 0);
  const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0;
  const volRatio = avgVol > 0 && latest.volume ? latest.volume / avgVol : 1;
  const reasons = [];
  if (dropPct >= settings.dropPct) {
    reasons.push(`Price down ${dropPct.toFixed(1)}% vs prior session`);
  }
  if (volRatio >= settings.volumeSpike) {
    reasons.push(`Volume ~${volRatio.toFixed(1)}× recent average`);
  }
  if (!reasons.length) return null;
  return { symbol, reasons, dropPct, volRatio, asOf: latest.date };
}

async function runRiskAlertBatch() {
  ensureSchema();
  const wl = readWatchlist();
  let sent = 0;
  for (const [userKey, items] of Object.entries(wl.byUser || {})) {
    if (!userKey.startsWith('uid:')) continue;
    const userId = userKey.slice(4);
    const settings = getAlertSettings(userId);
    if (!settings.enabled) continue;
    const list = Array.isArray(items) ? items : [];
    for (const item of list.slice(0, 30)) {
      const sym = String(item.symbol || '').toUpperCase();
      if (!sym || item.assetType !== 'stock') continue;
      if (onCooldown(userId, sym)) continue;
      try {
        const hit = await evaluateSymbolAlert(sym, settings);
        if (!hit) continue;
        pushNotification({
          userId,
          type: 'risk_alert',
          title: `${sym} risk alert`,
          body: hit.reasons.join(' · '),
          data: hit,
        });
        markCooldown(userId, sym);
        sent += 1;
      } catch (e) {
        console.warn(`[Alerts] ${sym}:`, e.message);
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  console.log(`[Alerts] Risk batch done; notifications=${sent}`);
  return { sent };
}

module.exports = {
  getAlertSettings,
  saveAlertSettings,
  runRiskAlertBatch,
};
