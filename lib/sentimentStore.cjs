/**
 * 30-day sentiment score series (derived from analysis score per symbol/day).
 */
const { initDb } = require('../db/store.cjs');

function getDb() {
  return initDb();
}

function ensureSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS sentiment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      score REAL NOT NULL,
      signal TEXT,
      recorded_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sentiment_sym_time ON sentiment_history(symbol, recorded_at);
  `);
}

function recordSentiment({ symbol, score, signal }) {
  ensureSchema();
  const sym = String(symbol || '')
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 16);
  const s = Number(score);
  if (!sym || !Number.isFinite(s)) return;
  const db = getDb();
  db.prepare(
    `INSERT INTO sentiment_history (symbol, score, signal) VALUES (?, ?, ?)`,
  ).run(sym, s, String(signal || '').slice(0, 24));
  db.prepare(
    `DELETE FROM sentiment_history WHERE id NOT IN (
      SELECT id FROM sentiment_history ORDER BY recorded_at DESC LIMIT 50000
    )`,
  ).run();
}

function getSentimentSeries(symbol, days = 30) {
  ensureSchema();
  const sym = String(symbol || '')
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 16);
  const d = Math.min(Math.max(Number(days) || 30, 7), 90);
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT date(recorded_at) AS day, AVG(score) AS avgScore, COUNT(*) AS n
       FROM sentiment_history
       WHERE symbol = ? AND recorded_at >= datetime('now', ?)
       GROUP BY day
       ORDER BY day ASC`,
    )
    .all(sym, `-${d} days`);
  return {
    symbol: sym,
    points: rows.map((r) => ({
      date: r.day,
      score: Math.round(Number(r.avgScore) * 10) / 10,
      samples: r.n,
    })),
    source: 'Wenap analysis scores (aggregated)',
    disclaimer: 'Derived from past Wenap reports on this symbol; not market sentiment.',
  };
}

module.exports = {
  recordSentiment,
  getSentimentSeries,
};
