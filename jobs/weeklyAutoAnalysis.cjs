/**
 * Weekly auto-analysis cron job.
 * Runs every Monday at 02:00 UTC on FEATURED_TICKERS using the cron service account.
 * Results are saved to history under `uid:cron` so `/sample/:ticker` can serve them.
 *
 * To disable: set CRON_AUTO_ANALYSIS=false in .env
 * To override tickers: set CRON_TICKERS=NVDA,AAPL,... in .env
 */

const cron = require('node-cron');
const https = require('https');
const http = require('http');

const FEATURED_TICKERS = (process.env.CRON_TICKERS || 'NVDA,AAPL,JPM,UNH,SPY,QQQ,VTI,O,PLD,GLD').split(',').map((s) => s.trim()).filter(Boolean);
const CRON_INTERNAL_TOKEN = process.env.CRON_INTERNAL_TOKEN || '';

async function callAnalyzeApi(ticker) {
  const port = Number(process.env.PORT) || 3000;
  const url = `http://localhost:${port}/api/analyze`;
  const token = CRON_INTERNAL_TOKEN;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ ticker, assetType: 'stock', horizon: '3m', locale: 'en', cronRun: true });
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 300, status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ ok: false, status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

async function runWeeklyBatch() {
  console.log(`[WeeklyCron] Starting auto-analysis for ${FEATURED_TICKERS.length} tickers: ${FEATURED_TICKERS.join(', ')}`);
  const results = [];
  for (const ticker of FEATURED_TICKERS) {
    try {
      const r = await callAnalyzeApi(ticker);
      results.push({ ticker, ok: r.ok, status: r.status });
      console.log(`[WeeklyCron] ${ticker}: ${r.ok ? 'OK' : 'FAIL'} (${r.status})`);
    } catch (e) {
      results.push({ ticker, ok: false, error: e.message });
      console.error(`[WeeklyCron] ${ticker} error:`, e.message);
    }
    // Rate-limit: 5s between calls
    await new Promise((r) => setTimeout(r, 5000));
  }
  const ok = results.filter((r) => r.ok).length;
  console.log(`[WeeklyCron] Done: ${ok}/${FEATURED_TICKERS.length} succeeded`);
  return results;
}

function startWeeklyAutoAnalysis() {
  if (process.env.CRON_ENABLED === 'false') return;
  if (process.env.CRON_AUTO_ANALYSIS === 'false') {
    console.log('[Wenap] CRON_AUTO_ANALYSIS=false, skipping weekly auto-analysis');
    return;
  }
  // Every Monday at 02:00 UTC
  cron.schedule('0 2 * * 1', async () => {
    try {
      await runWeeklyBatch();
    } catch (e) {
      console.error('[WeeklyCron] Fatal error:', e);
    }
  }, { timezone: 'UTC' });
  console.log('[Wenap] Weekly auto-analysis scheduled: Mondays 02:00 UTC');
}

module.exports = { startWeeklyAutoAnalysis, runWeeklyBatch };
