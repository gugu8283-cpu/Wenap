/**
 * Demo seed: users, analysis_logs, verified/pending/backtest predictions.
 * Usage: node scripts/seed-demo.cjs [--reset-demo]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const crypto = require('crypto');
const store = require('../db/store.cjs');

const RESET = process.argv.includes('--reset-demo');

function uuid() {
  return crypto.randomUUID();
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function addDaysYmd(ymd, days) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function main() {
  const db = store.getDb();

  if (RESET) {
    const demoTickers = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'META', 'DEMO_BT'];
    for (const t of demoTickers) {
      const preds = db.prepare(`SELECT id FROM predictions WHERE ticker = ?`).all(t);
      for (const p of preds) {
        db.prepare('DELETE FROM prediction_results WHERE prediction_id = ?').run(p.id);
      }
      db.prepare('DELETE FROM predictions WHERE ticker = ?').run(t);
    }
    db.prepare(`DELETE FROM analysis_logs WHERE ticker IN (${demoTickers.map(() => '?').join(',')})`).run(
      ...demoTickers,
    );
    db.prepare(`DELETE FROM users WHERE external_key LIKE 'demo-%'`).run();
    console.log('[seed] Cleared prior demo rows');
  }

  const existing = db.prepare(`SELECT COUNT(*) AS c FROM predictions WHERE ticker = 'NVDA' AND analyzed_at = ?`).get(
    daysAgo(40),
  ).c;
  if (existing > 0 && !RESET) {
    console.log('[seed] Demo data already present (use --reset-demo to replace)');
    return;
  }

  const userIds = [];
  const tiers = [
    { key: 'demo-free', tier: 'free', email: 'demo-free@wenap.local' },
    { key: 'demo-pro', tier: 'pro', email: 'demo-pro@wenap.local' },
    { key: 'demo-proplus', tier: 'pro_plus', email: 'demo-proplus@wenap.local' },
  ];
  for (const u of tiers) {
    const id = uuid();
    db.prepare(
      `INSERT OR REPLACE INTO users (id, external_key, email, tier, free_trials_used, free_trials_limit, created_at, last_active_at)
       VALUES (?, ?, ?, ?, ?, 5, datetime('now', '-14 days'), datetime('now'))`,
    ).run(id, u.key, u.email, u.tier, u.tier === 'free' ? 2 : 0);
    userIds.push({ id, ...u });
  }

  const models = [
    'google/gemini-2.5-flash-lite',
    'google/gemini-2.5-flash-lite',
    'anthropic/claude-haiku-4-5',
  ];
  const tickers = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'META'];
  for (let i = 0; i < 25; i++) {
    const u = userIds[i % userIds.length];
    const t = tickers[i % tickers.length];
    db.prepare(
      `INSERT INTO analysis_logs (id, user_id, ticker, tier, model, input_tokens, output_tokens, cost_usd, duration_ms, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', datetime('now', ?))`,
    ).run(
      uuid(),
      u.id,
      t,
      u.tier,
      models[i % models.length],
      8000 + i * 100,
      1200 + i * 50,
      0.002 + i * 0.0001,
      12000 + i * 200,
      `-${i} days`,
    );
  }

  /** @type {Array<object>} */
  const verified = [
    {
      ticker: 'NVDA',
      tendency: 'buy',
      score: 78,
      current: 120,
      target: 140,
      actual: 135.6,
      analyzed_at: daysAgo(40),
      bull: [130, 150],
      base: [115, 128],
      bear: [95, 110],
      backtest: 0,
    },
    {
      ticker: 'AAPL',
      tendency: 'hold',
      score: 55,
      current: 180,
      target: 185,
      actual: 184.2,
      analyzed_at: daysAgo(35),
      bull: [195, 210],
      base: [175, 190],
      bear: [160, 172],
      backtest: 0,
    },
    {
      ticker: 'TSLA',
      tendency: 'sell',
      score: 42,
      current: 250,
      target: 220,
      actual: 218.5,
      analyzed_at: daysAgo(32),
      bull: [270, 290],
      base: [240, 255],
      bear: [200, 230],
      backtest: 0,
    },
    {
      ticker: 'MSFT',
      tendency: 'buy',
      score: 72,
      current: 400,
      target: 450,
      actual: 405.2,
      analyzed_at: daysAgo(28),
      bull: [430, 460],
      base: [395, 415],
      bear: [360, 385],
      backtest: 0,
    },
    {
      ticker: 'META',
      tendency: 'hold',
      score: 61,
      current: 500,
      target: 520,
      actual: 488.0,
      analyzed_at: daysAgo(25),
      bull: [540, 570],
      base: [480, 510],
      bear: [450, 475],
      backtest: 0,
    },
    {
      ticker: 'DEMO_BT',
      tendency: 'buy',
      score: 80,
      current: 100,
      target: 120,
      actual: 115,
      analyzed_at: daysAgo(60),
      bull: [110, 125],
      base: [100, 110],
      bear: [85, 95],
      backtest: 1,
    },
  ];

  const insPred = db.prepare(
    `INSERT INTO predictions (
      id, user_id, ticker, analyzed_at, tendency, score, current_price, target_price,
      scenario_bull_prob, scenario_bull_min, scenario_bull_max,
      scenario_base_prob, scenario_base_min, scenario_base_max,
      scenario_bear_prob, scenario_bear_min, scenario_bear_max,
      verify_at, verified_at, status, is_backtest
    ) VALUES (?,?,?,?,?,?,?,?,35,?,?,40,?,?,25,?,?,?,?, 'verified', ?)`,
  );
  const insRes = db.prepare(
    `INSERT INTO prediction_results (
      id, prediction_id, verified_at, actual_price, price_change_pct,
      tendency_correct, scenario_hit, target_price_hit, fetch_source
    ) VALUES (?,?,?,?,?,?,?,?, 'seed')`,
  );

  const { checkTendency, checkScenario } = require('../lib/predictionLogic.cjs');

  for (const row of verified) {
    const predId = uuid();
    const verifyAt = addDaysYmd(row.analyzed_at, Number(process.env.PREDICTION_VERIFY_DAYS) || 30);
    const pct = Math.round(((row.actual - row.current) / row.current) * 10000) / 100;
    const tendencyCorrect = checkTendency(row.tendency, pct) ? 1 : 0;
    const scenarioRow = {
      scenario_bull_min: row.bull[0],
      scenario_bull_max: row.bull[1],
      scenario_base_min: row.base[0],
      scenario_base_max: row.base[1],
      scenario_bear_min: row.bear[0],
      scenario_bear_max: row.bear[1],
    };
    const scenarioHit = checkScenario(row.actual, scenarioRow);
    const targetHit = row.actual >= row.target ? 1 : 0;
    const verifiedAt = isoDaysAgo(5);

    insPred.run(
      predId,
      userIds[0].id,
      row.ticker,
      row.analyzed_at,
      row.tendency,
      row.score,
      row.current,
      row.target,
      row.bull[0],
      row.bull[1],
      row.base[0],
      row.base[1],
      row.bear[0],
      row.bear[1],
      verifyAt,
      verifiedAt,
      row.backtest,
    );
    insRes.run(
      uuid(),
      predId,
      verifiedAt,
      row.actual,
      pct,
      tendencyCorrect,
      scenarioHit,
      targetHit,
    );
  }

  const pendingId = uuid();
  const pendingAt = daysAgo(5);
  const verifyAt = addDaysYmd(pendingAt, Number(process.env.PREDICTION_VERIFY_DAYS) || 30);
  db.prepare(
    `INSERT INTO predictions (
      id, user_id, ticker, analyzed_at, tendency, score, current_price, target_price,
      scenario_bull_prob, scenario_bull_min, scenario_bull_max,
      scenario_base_prob, scenario_base_min, scenario_base_max,
      scenario_bear_prob, scenario_bear_min, scenario_bear_max,
      verify_at, status, is_backtest
    ) VALUES (?,?,?,?,?,?,?,?,35,?,?,40,?,?,25,?,?,?,'pending',0)`,
  ).run(
    pendingId,
    userIds[1].id,
    'NVDA',
    pendingAt,
    'hold',
    58,
    130,
    135,
    145,
    160,
    125,
    140,
    110,
    122,
    verifyAt,
  );

  const stats = store.getPublicAccuracy();
  console.log('[seed] Done.');
  console.log('[seed] Public accuracy:', {
    total: stats.total,
    tendencyAccuracy: stats.tendencyAccuracy,
    scenarioAccuracy: stats.scenarioAccuracy,
  });
  console.log('[seed] Users:', userIds.length, '| verified:', verified.length, '| pending: 1');
}

main();
