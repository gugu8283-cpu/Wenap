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

module.exports = router;
