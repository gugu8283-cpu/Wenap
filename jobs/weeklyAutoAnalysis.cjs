/**
 * Weekly auto-analysis cron job.
 * Runs every Monday at 02:00 UTC on FEATURED_TICKERS using the cron service account.
 * Results are saved to history under `uid:cron` so `/sample/:ticker` can serve them.
 *
 * To disable: set CRON_AUTO_ANALYSIS=false in .env
 * To override tickers: set CRON_TICKERS=NVDA,AAPL,... in .env
 */

const cron = require('node-cron');
const http = require('http');

const FEATURED_TICKERS = (process.env.CRON_TICKERS || 'NVDA,AAPL,JPM,UNH,SPY,QQQ,VTI,O,PLD,GLD').split(',').map((s) => s.trim()).filter(Boolean);

async function callAnalyzeApi(ticker) {
  const port = Number.parseInt(String(process.env.PORT || '3002'), 10) || 3002;
  const url = `http://127.0.0.1:${port}/analyze`;
  const cronSecret = String(process.env.WENAP_CRON_SECRET || '').trim();

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ ticker, assetType: 'stock', horizon: '3m', locale: 'en', cronRun: true });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (cronSecret.length >= 8) headers['X-Wenap-Cron-Secret'] = cronSecret;

    const req = http.request(url, {
      method: 'POST',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const ok = res.statusCode < 300 && /"type"\s*:\s*"viz"/.test(data);
        resolve({ ok, status: res.statusCode, bytes: data.length });
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
  const cronSecret = String(process.env.WENAP_CRON_SECRET || '').trim();
  const cronUserId = String(process.env.CRON_SERVICE_USER_ID || '').trim();
  if (cronSecret.length < 8 || !cronUserId) {
    console.log(
      '[Wenap] Weekly auto-analysis disabled: set WENAP_CRON_SECRET (≥8 chars) and CRON_SERVICE_USER_ID to a valid user id',
    );
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
