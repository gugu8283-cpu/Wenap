const cron = require('node-cron');
const store = require('../db/store.cjs');

async function runVerificationBatch() {
  const due = store.getDuePredictions();
  if (!due.length) return { processed: 0, ok: 0, fail: 0 };
  let ok = 0;
  let fail = 0;
  for (const row of due) {
    try {
      await store.verifyPredictionById(row.id);
      ok += 1;
    } catch (e) {
      await store.verifyPredictionFailed(row.id, e.message);
      fail += 1;
      console.error(`[Cron] Failed: ${row.ticker}`, e.message);
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log(`[Cron] Done: ${due.length} predictions processed (ok=${ok}, fail=${fail})`);
  return { processed: due.length, ok, fail };
}

function startVerifyCron() {
  if (process.env.CRON_ENABLED !== 'true') {
    console.log('[Wenap] CRON_ENABLED!=true，跳过预测验证定时任务');
    return;
  }
  cron.schedule(
    '0 0 * * *',
    async () => {
      console.log('[Cron] Starting prediction verification...');
      try {
        await runVerificationBatch();
      } catch (e) {
        console.error('[Cron] verify batch error:', e);
      }
    },
    { timezone: 'UTC' },
  );
  console.log('[Wenap] 预测验证定时任务已注册（UTC 00:00）');
}

module.exports = { startVerifyCron, runVerificationBatch };
