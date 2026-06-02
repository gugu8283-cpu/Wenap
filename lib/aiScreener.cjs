/**
 * Pro+ AI screener — natural language → Top 5 tickers (Gemini + search).
 */
const { geminiApiConfigured, geminiApiGenerate } = require('./geminiApiClient.cjs');
const { initDb } = require('../db/store.cjs');

const MONTHLY_CAP = Number.parseInt(String(process.env.WENAP_SCREENER_MONTHLY_CAP || '20'), 10) || 20;

function getDb() {
  return initDb();
}

function ensureSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS screener_usage (
      user_id TEXT NOT NULL,
      month_key TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, month_key)
    );
  `);
}

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getScreenerUsage(userId) {
  ensureSchema();
  const db = getDb();
  const row = db
    .prepare(`SELECT count FROM screener_usage WHERE user_id = ? AND month_key = ?`)
    .get(userId, monthKey());
  const used = Number(row?.count) || 0;
  return { used, cap: MONTHLY_CAP, remaining: Math.max(0, MONTHLY_CAP - used) };
}

function incrementScreenerUsage(userId) {
  ensureSchema();
  const db = getDb();
  const mk = monthKey();
  db.prepare(
    `INSERT INTO screener_usage (user_id, month_key, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, month_key) DO UPDATE SET count = count + 1`,
  ).run(userId, mk);
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('JSON_PARSE');
  return JSON.parse(raw.slice(start, end + 1));
}

async function runAiScreener({ query, locale = 'en' }) {
  if (!geminiApiConfigured()) throw new Error('GEMINI_NOT_CONFIGURED');
  const q = String(query || '').trim().slice(0, 500);
  if (q.length < 8) throw new Error('QUERY_TOO_SHORT');
  const zh = String(locale || '').startsWith('zh');
  const prompt = `${zh ? '你是美股研究筛选助手。' : 'You are a US equity research screener assistant.'}
User query: ${q}

Return ONLY valid JSON:
{
  "disclaimer": "${zh ? '仅供研究，非投资建议' : 'For research only; not investment advice'}",
  "picks": [
    { "symbol": "TICKER", "reason": "≤40 words", "sourceHint": "public data theme" }
  ]
}
Rules: exactly 5 US-listed tickers max; no crypto; cite plausible public themes; no guaranteed returns.`;

  const result = await geminiApiGenerate({
    userContent: prompt,
    maxOutputTokens: 1200,
    useWeb: true,
  });
  const data = extractJsonObject(result.content);
  const picks = Array.isArray(data.picks) ? data.picks.slice(0, 5) : [];
  return {
    query: q,
    picks: picks.map((p) => ({
      symbol: String(p.symbol || '')
        .toUpperCase()
        .replace(/[^A-Z0-9.-]/g, '')
        .slice(0, 16),
      reason: String(p.reason || '').trim(),
      sourceHint: String(p.sourceHint || '').trim(),
    })),
    disclaimer: String(data.disclaimer || '').trim(),
    model: result.modelUsed,
  };
}

module.exports = {
  runAiScreener,
  getScreenerUsage,
  incrementScreenerUsage,
  MONTHLY_CAP,
};
