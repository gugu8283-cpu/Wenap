const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { fetchClosePrice } = require('../lib/alphaPrice.cjs');
const { checkTendency, checkScenario } = require('../lib/predictionLogic.cjs');
const { savePrediction, insertAnalysisLog } = require('../jobs/savePrediction.cjs');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'wenap.db');
const VERIFY_DAYS = Number(process.env.PREDICTION_VERIFY_DAYS) || 30;

let db;

function uuid() {
  return crypto.randomUUID();
}

function initDb() {
  if (db) return db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  migrateDb();
  return db;
}

function migrateDb() {
  const cols = db.prepare('PRAGMA table_info(predictions)').all().map((c) => c.name);
  if (!cols.includes('verified_at')) {
    db.exec('ALTER TABLE predictions ADD COLUMN verified_at TEXT');
  }
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS ux_predictions_ticker_analyzed ON predictions(ticker, analyzed_at)',
  );
  try {
    require('./auth.cjs').migrateAuthSchema(db);
  } catch (e) {
    console.warn('[Wenap] auth schema migrate:', e.message);
  }
}

function upsertUserByExternalKey(externalKey, tier = 'free') {
  initDb();
  const key = String(externalKey || 'anonymous').slice(0, 128);
  const existing = db.prepare('SELECT id FROM users WHERE external_key = ?').get(key);
  if (existing) {
    db.prepare(`UPDATE users SET last_active_at = datetime('now'), tier = COALESCE(?, tier) WHERE id = ?`).run(
      tier || null,
      existing.id,
    );
    return existing.id;
  }
  const id = uuid();
  db.prepare(
    `INSERT INTO users (id, external_key, tier, free_trials_limit, last_active_at) VALUES (?, ?, ?, 5, datetime('now'))`,
  ).run(id, key, tier || 'free');
  return id;
}

function recordAnalysisSuccess({ userKey, tier, model, symbol, data, latestPriceUsd, usage, durationMs }) {
  try {
    initDb();
    const userId = upsertUserByExternalKey(userKey, tier);
    return savePrediction(db, {
      userId,
      tier,
      model,
      symbol,
      data,
      latestPriceUsd,
      usage,
      durationMs,
    });
  } catch (e) {
    console.warn('[Wenap] recordAnalysisSuccess:', e.message);
    return null;
  }
}

function recordAnalysisFailure({ userKey, tier, model, symbol, errorMessage, durationMs }) {
  try {
    initDb();
    const userId = upsertUserByExternalKey(userKey, tier);
    return insertAnalysisLog(db, {
      userId,
      ticker: symbol,
      tier,
      model,
      durationMs,
      status: 'failed',
      errorMessage,
    });
  } catch (e) {
    console.warn('[Wenap] recordAnalysisFailure:', e.message);
    return null;
  }
}

async function verifyPredictionById(predictionId) {
  initDb();
  const row = db.prepare('SELECT * FROM predictions WHERE id = ?').get(predictionId);
  if (!row) throw new Error('预测记录不存在');
  if (row.status === 'verified') return { already: true };

  const verifyDate = new Date(row.verify_at);
  const actualPrice = await fetchClosePrice(row.ticker, verifyDate);
  const priceChangePct = ((actualPrice - row.current_price) / row.current_price) * 100;
  const tendencyCorrect = checkTendency(row.tendency, priceChangePct) ? 1 : 0;
  const scenarioHit = checkScenario(actualPrice, row);
  const targetPriceHit =
    row.target_price != null && Number(row.target_price) > 0 && actualPrice >= row.target_price ? 1 : 0;

  const resultId = uuid();
  const verifiedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO prediction_results (
      id, prediction_id, verified_at, actual_price, price_change_pct,
      tendency_correct, scenario_hit, target_price_hit, fetch_source
    ) VALUES (?,?,?,?,?,?,?,?, 'alpha_vantage')`,
  ).run(
    resultId,
    row.id,
    verifiedAt,
    actualPrice,
    Math.round(priceChangePct * 100) / 100,
    tendencyCorrect,
    scenarioHit,
    targetPriceHit,
  );
  db.prepare(
    `UPDATE predictions SET status = 'verified', verified_at = datetime('now') WHERE id = ?`,
  ).run(row.id);
  return { resultId, actualPrice, priceChangePct, tendencyCorrect, scenarioHit };
}

async function verifyPredictionFailed(predictionId, errorDetail) {
  initDb();
  db.prepare(`UPDATE predictions SET status = 'failed' WHERE id = ?`).run(predictionId);
  const resultId = uuid();
  db.prepare(
    `INSERT INTO prediction_results (id, prediction_id, verified_at, actual_price, price_change_pct, tendency_correct, target_price_hit, error_detail)
     VALUES (?, ?, datetime('now'), 0, 0, 0, 0, ?)`,
  ).run(resultId, predictionId, String(errorDetail || '').slice(0, 500));
}

function getAccuracyStats({ backtestOnly = false } = {}) {
  initDb();
  const where = backtestOnly ? 'AND p.is_backtest = 1' : 'AND p.is_backtest = 0';
  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM predictions p WHERE p.status = 'verified' ${where}`)
    .get().c;
  const statusCounts = {
    pending: db.prepare(`SELECT COUNT(*) AS c FROM predictions WHERE status='pending'`).get().c,
    verified: db.prepare(`SELECT COUNT(*) AS c FROM predictions WHERE status='verified'`).get().c,
    failed: db.prepare(`SELECT COUNT(*) AS c FROM predictions WHERE status='failed'`).get().c,
    skipped: db.prepare(`SELECT COUNT(*) AS c FROM predictions WHERE status='skipped'`).get().c,
  };
  if (!total) {
    return {
      total: 0,
      tendencyAccuracy: 0,
      scenarioAccuracy: 0,
      targetHitRate: 0,
      ...statusCounts,
    };
  }
  const row = db
    .prepare(
      `SELECT
        SUM(r.tendency_correct) AS tc,
        SUM(CASE WHEN r.scenario_hit IS NOT NULL AND r.scenario_hit != 'none' THEN 1 ELSE 0 END) AS sc,
        SUM(r.target_price_hit) AS th
      FROM prediction_results r
      JOIN predictions p ON p.id = r.prediction_id
      WHERE p.status = 'verified' ${where}`,
    )
    .get();
  return {
    total,
    tendencyAccuracy: Math.round((row.tc / total) * 1000) / 10,
    scenarioAccuracy: Math.round((row.sc / total) * 1000) / 10,
    targetHitRate: Math.round((row.th / total) * 1000) / 10,
    ...statusCounts,
  };
}

function listPredictions(filters = {}) {
  initDb();
  const { status, ticker, from, to, backtest, limit = 100, offset = 0 } = filters;
  const clauses = ['1=1'];
  const params = [];
  if (status && status !== 'all') {
    clauses.push('p.status = ?');
    params.push(status);
  }
  if (ticker) {
    clauses.push('p.ticker LIKE ?');
    params.push(`%${ticker.toUpperCase()}%`);
  }
  if (from) {
    clauses.push('date(p.analyzed_at) >= date(?)');
    params.push(from);
  }
  if (to) {
    clauses.push('date(p.analyzed_at) <= date(?)');
    params.push(to);
  }
  if (backtest === '1' || backtest === true) clauses.push('p.is_backtest = 1');
  if (backtest === '0' || backtest === false) clauses.push('p.is_backtest = 0');

  const where = clauses.join(' AND ');
  const rows = db
    .prepare(
      `SELECT p.*, r.actual_price, r.price_change_pct, r.tendency_correct, r.scenario_hit, r.target_price_hit, r.verified_at AS result_verified_at
       FROM predictions p
       LEFT JOIN prediction_results r ON r.prediction_id = p.id
       WHERE ${where}
       ORDER BY p.analyzed_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM predictions p WHERE ${where}`).get(...params).c;
  return { rows, total };
}

function adminOverview() {
  initDb();
  const today = new Date().toISOString().slice(0, 10);
  const usersTotal = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const usersToday = db
    .prepare(`SELECT COUNT(*) AS c FROM users WHERE date(created_at) = date(?)`)
    .get(today).c;
  const analysesTotal = db.prepare(`SELECT COUNT(*) AS c FROM analysis_logs WHERE status='success'`).get().c;
  const analysesToday = db
    .prepare(`SELECT COUNT(*) AS c FROM analysis_logs WHERE status='success' AND date(created_at)=date(?)`)
    .get(today).c;
  const acc = getAccuracyStats();
  const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
  const monthCost =
    db
      .prepare(
        `SELECT COALESCE(SUM(cost_usd),0) AS s FROM analysis_logs WHERE status='success' AND created_at >= ?`,
      )
      .get(monthStart).s || 0;

  const recentLogs = db
    .prepare(
      `SELECT l.created_at, l.ticker, l.tier, l.model, u.email, u.external_key
       FROM analysis_logs l LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC LIMIT 10`,
    )
    .all();
  const recentResults = db
    .prepare(
      `SELECT p.ticker, p.tendency, p.analyzed_at, r.actual_price, r.price_change_pct, r.tendency_correct, r.scenario_hit
       FROM prediction_results r
       JOIN predictions p ON p.id = r.prediction_id
       ORDER BY r.verified_at DESC LIMIT 10`,
    )
    .all();

  return { usersTotal, usersToday, analysesTotal, analysesToday, accuracy: acc, monthCost, recentLogs, recentResults };
}

function listUsers(filters = {}) {
  initDb();
  const { tier, banned, q, limit = 50, offset = 0 } = filters;
  const clauses = ['1=1'];
  const params = [];
  if (tier && tier !== 'all') {
    clauses.push('tier = ?');
    params.push(tier);
  }
  if (banned === '1') clauses.push('is_banned = 1');
  if (banned === '0') clauses.push('is_banned = 0');
  if (q) {
    clauses.push('(email LIKE ? OR phone LIKE ? OR external_key LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const where = clauses.join(' AND ');
  const rows = db
    .prepare(
      `SELECT u.*,
        (SELECT COUNT(*) FROM analysis_logs l WHERE l.user_id = u.id AND l.status='success') AS analysis_count
       FROM users u WHERE ${where}
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM users u WHERE ${where}`).get(...params).c;
  return { rows, total };
}

function getUserDetail(id) {
  initDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return null;
  const logs = db
    .prepare(
      `SELECT * FROM analysis_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
    )
    .all(id);
  return { user, logs };
}

function updateUserTier(id, tier) {
  initDb();
  db.prepare(`UPDATE users SET tier = ? WHERE id = ?`).run(tier, id);
}

function resetUserTrials(id) {
  initDb();
  db.prepare(`UPDATE users SET free_trials_used = 0 WHERE id = ?`).run(id);
}

function setUserBan(id, banned, reason = '') {
  initDb();
  db.prepare(`UPDATE users SET is_banned = ?, ban_reason = ? WHERE id = ?`).run(banned ? 1 : 0, reason, id);
}

function listAnalysisLogs(filters = {}) {
  initDb();
  const { tier, ticker, status, from, to, model, limit = 100, offset = 0 } = filters;
  const clauses = ['1=1'];
  const params = [];
  if (tier && tier !== 'all') {
    clauses.push('l.tier = ?');
    params.push(tier);
  }
  if (ticker) {
    clauses.push('l.ticker LIKE ?');
    params.push(`%${ticker.toUpperCase()}%`);
  }
  if (status && status !== 'all') {
    clauses.push('l.status = ?');
    params.push(status);
  }
  if (model) {
    clauses.push('l.model LIKE ?');
    params.push(`%${model}%`);
  }
  if (from) {
    clauses.push('date(l.created_at) >= date(?)');
    params.push(from);
  }
  if (to) {
    clauses.push('date(l.created_at) <= date(?)');
    params.push(to);
  }
  const where = clauses.join(' AND ');
  const rows = db
    .prepare(
      `SELECT l.*, u.external_key, u.email FROM analysis_logs l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  const agg = db
    .prepare(
      `SELECT COALESCE(SUM(cost_usd),0) AS totalCost, COUNT(*) AS cnt,
        SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) AS ok,
        AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms END) AS avgMs
       FROM analysis_logs l WHERE ${where}`,
    )
    .get(...params);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM analysis_logs l WHERE ${where}`).get(...params).c;
  return { rows, total, agg };
}

function revenueStats() {
  initDb();
  const tiers = db
    .prepare(`SELECT tier, COUNT(*) AS c FROM users GROUP BY tier`)
    .all();
  const totalUsers = tiers.reduce((s, t) => s + t.c, 0) || 1;
  const paid = tiers.filter((t) => t.tier === 'pro' || t.tier === 'pro_plus' || t.tier === 'proplus');
  const mrr =
    (tiers.find((t) => t.tier === 'pro')?.c || 0) * 9.99 +
    (tiers.find((t) => t.tier === 'pro_plus' || t.tier === 'proplus')?.c || 0) * 19.99;
  const dailyUsers = db
    .prepare(
      `SELECT date(created_at) AS d, COUNT(*) AS c FROM users
       WHERE created_at >= datetime('now', '-30 days') GROUP BY date(created_at) ORDER BY d`,
    )
    .all();
  const dailyPaid = db
    .prepare(
      `SELECT date(created_at) AS d, COUNT(*) AS c FROM users
       WHERE tier IN ('pro','pro_plus','proplus')
       AND created_at >= datetime('now', '-30 days')
       GROUP BY date(created_at) ORDER BY d`,
    )
    .all();
  const paidTotal =
    (tiers.find((t) => t.tier === 'pro')?.c || 0) +
    (tiers.find((t) => t.tier === 'pro_plus')?.c || 0) +
    (tiers.find((t) => t.tier === 'proplus')?.c || 0);
  return {
    tiers,
    totalUsers,
    paidTotal,
    mrr: Math.round(mrr * 100) / 100,
    dailyUsers,
    dailyPaid,
  };
}

function systemHealth() {
  initDb();
  const logs = db
    .prepare(
      `SELECT status, duration_ms, created_at FROM analysis_logs ORDER BY created_at DESC LIMIT 100`,
    )
    .all();
  const ok = logs.filter((l) => l.status === 'success').length;
  const avgMs = logs.length
    ? Math.round(logs.reduce((s, l) => s + (Number(l.duration_ms) || 0), 0) / logs.length)
    : 0;
  const avCallsToday = db
    .prepare(
      `SELECT COUNT(*) AS c FROM analysis_logs WHERE date(created_at)=date('now') AND status='success'`,
    )
    .get().c;
  const failedLogs = db
    .prepare(`SELECT * FROM analysis_logs WHERE status='failed' ORDER BY created_at DESC LIMIT 20`)
    .all();
  const failedPreds = db
    .prepare(`SELECT * FROM predictions WHERE status='failed' ORDER BY created_at DESC LIMIT 20`)
    .all();
  const monthCost = db
    .prepare(
      `SELECT COALESCE(SUM(cost_usd),0) AS s FROM analysis_logs WHERE created_at >= datetime('now', 'start of month')`,
    )
    .get().s;
  const byModel = db
    .prepare(
      `SELECT model, SUM(cost_usd) AS cost FROM analysis_logs WHERE status='success' AND created_at >= datetime('now', '-30 days') GROUP BY model`,
    )
    .all();
  const dailyCost = db
    .prepare(
      `SELECT date(created_at) AS d, SUM(cost_usd) AS cost FROM analysis_logs
       WHERE status='success' AND created_at >= datetime('now', '-30 days') GROUP BY date(created_at) ORDER BY d`,
    )
    .all();
  const lastLog = logs[0];
  return {
    openRouter: {
      successRate: logs.length ? Math.round((ok / logs.length) * 100) : 0,
      avgMs,
      lastAt: lastLog?.created_at || null,
    },
    alphaVantage: {
      callsToday: avCallsToday,
      quotaPerDay: 500,
      lastAt: lastLog?.created_at || null,
    },
    database: { ok: true, path: DB_PATH, slowMs: avgMs },
    monthCost,
    byModel,
    dailyCost,
    failedLogs,
    failedPreds,
  };
}

function getDuePredictions() {
  initDb();
  return db
    .prepare(
      `SELECT * FROM predictions WHERE status = 'pending' AND date(verify_at) <= date('now')`,
    )
    .all();
}

function setPredictionSkipReason(id, reason) {
  initDb();
  db.prepare(`UPDATE predictions SET skip_reason = ?, status = 'skipped' WHERE id = ?`).run(
    String(reason || '手动跳过').slice(0, 100),
    id,
  );
}

function getBuySignalWinRate30d() {
  initDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(r.tendency_correct) AS hits
       FROM predictions p
       JOIN prediction_results r ON r.prediction_id = p.id
       WHERE p.status = 'verified' AND p.is_backtest = 0
         AND UPPER(p.tendency) = 'BUY'
         AND p.analyzed_at >= datetime('now', '-30 days')`,
    )
    .get();
  const total = row?.total || 0;
  if (!total) return null;
  return Math.round((row.hits / total) * 1000) / 10;
}

function getScorePercentile(score) {
  initDb();
  const s = Number(score);
  if (!Number.isFinite(s)) return null;
  const rows = db
    .prepare(
      `SELECT score FROM predictions
       WHERE analyzed_at >= datetime('now', 'start of day')
         AND score IS NOT NULL`,
    )
    .all()
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n));
  if (rows.length < 2) return null;
  const below = rows.filter((n) => n < s).length;
  return Math.round((below / rows.length) * 100);
}

function getPublicAccuracy() {
  initDb();
  const stats = getAccuracyStats({ backtestOnly: false });
  const buySignalWinRate30d = getBuySignalWinRate30d();
  const recent = db
    .prepare(
      `SELECT p.ticker, p.tendency, p.analyzed_at, r.price_change_pct, r.tendency_correct, r.scenario_hit, p.is_backtest
       FROM predictions p
       JOIN prediction_results r ON r.prediction_id = p.id
       WHERE p.status = 'verified' AND p.is_backtest = 0
       ORDER BY r.verified_at DESC LIMIT 20`,
    )
    .all();
  return {
    ...stats,
    buySignalWinRate30d,
    pct_correct: stats.total ? stats.tendencyAccuracy : null,
    updatedAt: new Date().toISOString(),
    recent,
  };
}

function getDb() {
  return initDb();
}

module.exports = {
  initDb,
  getDb,
  DB_PATH,
  recordAnalysisSuccess,
  recordAnalysisFailure,
  verifyPredictionById,
  verifyPredictionFailed,
  getAccuracyStats,
  listPredictions,
  adminOverview,
  listUsers,
  getUserDetail,
  updateUserTier,
  resetUserTrials,
  setUserBan,
  listAnalysisLogs,
  revenueStats,
  systemHealth,
  getDuePredictions,
  setPredictionSkipReason,
  getPublicAccuracy,
  getScorePercentile,
  getBuySignalWinRate30d,
};
