const cron = require('node-cron');
const { runRiskAlertBatch } = require('../lib/riskAlerts.cjs');

function startRiskAlertCron() {
  if (process.env.CRON_ENABLED === 'false') return;
  if (String(process.env.WENAP_RISK_ALERTS || '1').trim() === '0') return;
  cron.schedule(
    '30 14 * * 1-5',
    async () => {
      try {
        await runRiskAlertBatch();
      } catch (e) {
        console.error('[Cron] risk alerts:', e.message);
      }
    },
    { timezone: 'America/New_York' },
  );
  console.log('[Wenap] Risk alert cron registered (US market weekdays 14:30 ET)');
}

module.exports = { startRiskAlertCron, runRiskAlertBatch };
