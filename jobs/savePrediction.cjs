const crypto = require('crypto');
const {
  signalToTendency,
  parsePricesFromReport,
  scenarioFields,
} = require('../lib/predictionLogic.cjs');

const VERIFY_DAYS = Number(process.env.PREDICTION_VERIFY_DAYS) || 30;

function uuid() {
  return crypto.randomUUID();
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysYmd(ymd, days) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function estimateCostUsd(inputTokens, outputTokens, model) {
  const inp = Number(inputTokens) || 0;
  const out = Number(outputTokens) || 0;
  const m = String(model || '');
  if (m.includes('haiku')) return (inp / 1e6) * 0.25 + (out / 1e6) * 1.25;
  if (m.includes('sonnet')) return (inp / 1e6) * 3 + (out / 1e6) * 15;
  return (inp / 1e6) * 0.1 + (out / 1e6) * 0.4;
}

function insertAnalysisLog(db, { userId, ticker, tier, model, usage, durationMs, status, errorMessage }) {
  const inp =
    (Number(usage?.main?.prompt_tokens) || 0) + (Number(usage?.leader?.prompt_tokens) || 0);
  const out =
    (Number(usage?.main?.completion_tokens) || 0) + (Number(usage?.leader?.completion_tokens) || 0);
  const cost = estimateCostUsd(inp, out, model);
  const logId = uuid();
  if (status === 'failed') {
    db.prepare(
      `INSERT INTO analysis_logs (id, user_id, ticker, tier, model, duration_ms, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, 'failed', ?)`,
    ).run(logId, userId, ticker, tier, model, durationMs || null, String(errorMessage || '').slice(0, 2000));
  } else {
    db.prepare(
      `INSERT INTO analysis_logs (id, user_id, ticker, tier, model, input_tokens, output_tokens, cost_usd, duration_ms, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'success')`,
    ).run(logId, userId, ticker, tier, model, inp, out, cost, durationMs || null);
  }
  return logId;
}

/**
 * 分析成功后写入预测（30 天去重）与分析日志。
 * @returns {{ logId: string, predictionId: string|null, skipped?: boolean }}
 */
function savePrediction(db, { userId, tier, model, symbol, data, latestPriceUsd, usage, durationMs }) {
  const ticker = String(symbol || '')
    .trim()
    .toUpperCase();
  const today = todayYmd();
  const logId = insertAnalysisLog(db, {
    userId,
    ticker,
    tier,
    model,
    usage,
    durationMs,
    status: 'success',
  });

  const { current, target } = parsePricesFromReport(data, latestPriceUsd);
  if (current <= 0) {
    return { logId, predictionId: null };
  }

  const existing = db
    .prepare(
      `SELECT id, analyzed_at, verify_at, status
       FROM predictions
       WHERE ticker = ?
         AND status IN ('pending', 'verified')
         AND (
           (date(analyzed_at) <= date(?) AND date(verify_at) >= date(?))
           OR date(analyzed_at) = date(?)
         )
       LIMIT 1`,
    )
    .get(ticker, today, today, today);

  if (existing) {
    console.log(
      `[Prediction] Skip: ${ticker} already has active prediction from ${existing.analyzed_at} (${existing.status})`,
    );
    return { logId, predictionId: null, skipped: true };
  }

  const { bull, base, bear } = scenarioFields(data);
  const verifyAt = addDaysYmd(today, VERIFY_DAYS);
  const predId = uuid();

  const info = db
    .prepare(
      `INSERT INTO predictions (
        id, user_id, ticker, analyzed_at, tendency, score, current_price, target_price,
        scenario_bull_prob, scenario_bull_min, scenario_bull_max,
        scenario_base_prob, scenario_base_min, scenario_base_max,
        scenario_bear_prob, scenario_bear_min, scenario_bear_max,
        verify_at, status
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')
      ON CONFLICT(ticker, analyzed_at) DO NOTHING
      RETURNING id`,
    )
    .get(
      predId,
      userId,
      ticker,
      today,
      signalToTendency(data.signal),
      Math.min(100, Math.max(0, Math.round(Number(data.score) || 0))),
      current,
      target,
      bull.prob,
      bull.min,
      bull.max,
      base.prob,
      base.min,
      base.max,
      bear.prob,
      bear.min,
      bear.max,
      verifyAt,
    );

  const predictionId = info?.id || null;
  if (!predictionId) {
    console.log(`[Prediction] Skip: ${ticker} conflict on analyzed_at ${today}`);
  }
  return { logId, predictionId };
}

module.exports = {
  savePrediction,
  insertAnalysisLog,
  estimateCostUsd,
};
