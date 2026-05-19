const express = require('express');
const { requireAdmin } = require('../middleware/adminAuth.cjs');
const store = require('../db/store.cjs');

const router = express.Router();
router.use(requireAdmin);

router.get('/stats/overview', (req, res) => {
  res.json(store.adminOverview());
});

router.get('/stats/revenue', (req, res) => {
  res.json(store.revenueStats());
});

router.get('/predictions', (req, res) => {
  const q = req.query || {};
  res.json(
    store.listPredictions({
      status: q.status || 'all',
      ticker: q.ticker,
      from: q.from,
      to: q.to,
      backtest: q.backtest,
      limit: Number(q.limit) || 100,
      offset: Number(q.offset) || 0,
    }),
  );
});

router.get('/predictions/accuracy', (req, res) => {
  res.json(store.getAccuracyStats({ backtestOnly: req.query?.backtest === '1' }));
});

router.post('/predictions/verify', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : req.body?.id ? [req.body.id] : [];
  if (!ids.length) return res.status(400).json({ error: '需要 id 或 ids' });
  const results = [];
  for (const id of ids) {
    try {
      results.push({ id, ok: true, ...(await store.verifyPredictionById(id)) });
    } catch (e) {
      await store.verifyPredictionFailed(id, e.message);
      results.push({ id, ok: false, error: e.message });
    }
  }
  res.json({ results });
});

router.post('/predictions/skip', (req, res) => {
  const { id, reason } = req.body || {};
  if (!id) return res.status(400).json({ error: '需要 id' });
  store.setPredictionSkipReason(id, reason || '手动跳过');
  res.json({ ok: true });
});

router.get('/users', (req, res) => {
  const q = req.query || {};
  res.json(
    store.listUsers({
      tier: q.tier,
      banned: q.banned,
      q: q.q,
      limit: Number(q.limit) || 50,
      offset: Number(q.offset) || 0,
    }),
  );
});

router.get('/users/:id', (req, res) => {
  const detail = store.getUserDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(detail);
});

router.put('/users/:id/tier', (req, res) => {
  const tier = String(req.body?.tier || '').toLowerCase();
  if (!['free', 'pro', 'pro_plus', 'proplus'].includes(tier)) {
    return res.status(400).json({ error: '无效 tier' });
  }
  store.updateUserTier(req.params.id, tier === 'proplus' ? 'pro_plus' : tier);
  res.json({ ok: true });
});

router.put('/users/:id/reset-trials', (req, res) => {
  store.resetUserTrials(req.params.id);
  res.json({ ok: true });
});

router.put('/users/:id/ban', (req, res) => {
  const banned = Boolean(req.body?.banned);
  store.setUserBan(req.params.id, banned, req.body?.reason || '');
  res.json({ ok: true });
});

router.get('/analysis-logs', (req, res) => {
  const q = req.query || {};
  res.json(
    store.listAnalysisLogs({
      tier: q.tier,
      ticker: q.ticker,
      model: q.model,
      status: q.status,
      from: q.from,
      to: q.to,
      limit: Number(q.limit) || 100,
      offset: Number(q.offset) || 0,
    }),
  );
});

router.get('/system/api-health', (req, res) => {
  res.json(store.systemHealth());
});

router.get('/system/costs', (req, res) => {
  const h = store.systemHealth();
  res.json({ monthCost: h.monthCost, byModel: h.byModel, dailyCost: h.dailyCost });
});

// Conversion funnel endpoint
router.get('/stats/funnel', (req, res) => {
  try {
    const db = store.initDb();
    const totalRegistered = db.prepare('SELECT COUNT(*) as n FROM users').get()?.n || 0;
    const totalVerified = db.prepare('SELECT COUNT(*) as n FROM users WHERE email_verified = 1').get()?.n || 0;
    const totalAnalyzed = db.prepare('SELECT COUNT(DISTINCT user_id) as n FROM analysis_logs WHERE user_id IS NOT NULL').get()?.n || 0;
    const totalPaid = db.prepare("SELECT COUNT(*) as n FROM users WHERE tier IN ('pro', 'pro_plus', 'proplus')").get()?.n || 0;
    const mrrData = (() => {
      try {
        return db.prepare("SELECT tier, COUNT(*) as n FROM users WHERE tier IN ('pro', 'pro_plus', 'proplus') GROUP BY tier").all();
      } catch { return []; }
    })();
    const proCount = mrrData.find((r) => r.tier === 'pro')?.n || 0;
    const proPlusCount = mrrData.find((r) => r.tier === 'pro_plus' || r.tier === 'proplus')?.n || 0;
    const estimatedMrr = proCount * 9.99 + proPlusCount * 19.99;

    // Weekly registrations (last 4 weeks)
    const weeklyRegs = db.prepare(`
      SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as n
      FROM users
      WHERE created_at >= datetime('now', '-28 days')
      GROUP BY week ORDER BY week
    `).all();

    res.json({
      funnel: {
        registered: totalRegistered,
        verified: totalVerified,
        firstAnalysis: totalAnalyzed,
        paid: totalPaid,
        verifiedRate: totalRegistered ? (totalVerified / totalRegistered * 100).toFixed(1) : '0',
        analysisRate: totalVerified ? (totalAnalyzed / totalVerified * 100).toFixed(1) : '0',
        paidRate: totalAnalyzed ? (totalPaid / totalAnalyzed * 100).toFixed(1) : '0',
      },
      mrr: {
        pro: proCount,
        proPlus: proPlusCount,
        estimated: estimatedMrr.toFixed(2),
      },
      weeklyRegistrations: weeklyRegs,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
