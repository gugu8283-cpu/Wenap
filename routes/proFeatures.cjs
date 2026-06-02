const express = require('express');
const { requireAuth } = require('../middleware/requireAuth.cjs');
const { requireTier } = require('../middleware/requireTier.cjs');
const { fetchEarningsFilings } = require('../lib/secEdgarClient.cjs');
const { fetchInsiderSummary } = require('../lib/secEdgarClient.cjs');
const { fetchCongressTradesForSymbol } = require('../lib/congressTrades.cjs');
const { getSentimentSeries } = require('../lib/sentimentStore.cjs');
const { getAlertSettings, saveAlertSettings } = require('../lib/riskAlerts.cjs');
const {
  runAiScreener,
  getScreenerUsage,
  incrementScreenerUsage,
} = require('../lib/aiScreener.cjs');
const { geminiApiConfigured } = require('../lib/geminiApiClient.cjs');
const { fetchWorldBankMacroSummary } = require('../lib/worldBankClient.cjs');

const router = express.Router();

function sanitizeSymbol(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 16);
}

/**
 * Pro: macro endpoint disabled (compliance-first).
 * FRED Terms of Use update (2024-06) includes prohibitions on caching/archiving
 * and use in connection with ML/GenAI. We disable this integration by default.
 */
router.get('/macro', requireAuth, requireTier('pro'), async (req, res) => {
  try {
    const locale = String(req.query.locale || 'en');
    const country = String(req.query.country || 'USA');
    const summary = await fetchWorldBankMacroSummary(country, locale);
    res.json(summary);
  } catch (e) {
    res.status(502).json({ error: 'MACRO_FAILED', message: e.message });
  }
});

/** Pro: SEC earnings / filing calendar */
router.get('/earnings/:symbol', requireAuth, requireTier('pro'), async (req, res) => {
  try {
    const sym = sanitizeSymbol(req.params.symbol);
    if (!sym) return res.status(400).json({ error: 'INVALID_SYMBOL' });
    const data = await fetchEarningsFilings(sym);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message || 'EARNINGS_FAILED' });
  }
});

/** Pro: 30-day sentiment series */
router.get('/sentiment/:symbol', requireAuth, requireTier('pro'), (req, res) => {
  try {
    const sym = sanitizeSymbol(req.params.symbol);
    const days = Math.min(90, Number(req.query.days) || 30);
    res.json(getSentimentSeries(sym, days));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Pro+: insider filings summary */
router.get('/insider/:symbol', requireAuth, requireTier('pro_plus'), async (req, res) => {
  try {
    const sym = sanitizeSymbol(req.params.symbol);
    if (!sym) return res.status(400).json({ error: 'INVALID_SYMBOL' });
    res.json(await fetchInsiderSummary(sym));
  } catch (e) {
    res.status(502).json({ error: e.message || 'INSIDER_FAILED' });
  }
});

/** Pro+: congressional trades */
router.get('/congress/:symbol', requireAuth, requireTier('pro_plus'), async (req, res) => {
  try {
    const sym = sanitizeSymbol(req.params.symbol);
    if (!sym) return res.status(400).json({ error: 'INVALID_SYMBOL' });
    res.json(await fetchCongressTradesForSymbol(sym, 12));
  } catch (e) {
    res.status(502).json({ error: e.message || 'CONGRESS_FAILED' });
  }
});

/** Pro+: AI screener */
router.post('/screener', requireAuth, requireTier('pro_plus'), async (req, res) => {
  try {
    const usage = getScreenerUsage(req.authUser.id);
    if (usage.remaining <= 0) {
      return res.status(429).json({ error: 'SCREENER_CAP', ...usage });
    }
    const locale = String(req.body?.locale || 'en');
    const result = await runAiScreener({ query: req.body?.query, locale });
    incrementScreenerUsage(req.authUser.id);
    res.json({ ...result, usage: getScreenerUsage(req.authUser.id) });
  } catch (e) {
    const code = e.message === 'QUERY_TOO_SHORT' ? 400 : 502;
    res.status(code).json({ error: e.message || 'SCREENER_FAILED' });
  }
});

router.get('/screener/usage', requireAuth, requireTier('pro_plus'), (req, res) => {
  res.json(getScreenerUsage(req.authUser.id));
});

/** Pro+: risk alert settings */
router.get('/alerts/settings', requireAuth, requireTier('pro_plus'), (req, res) => {
  res.json(getAlertSettings(req.authUser.id));
});

router.put('/alerts/settings', requireAuth, requireTier('pro_plus'), (req, res) => {
  try {
    res.json(saveAlertSettings(req.authUser.id, req.body || {}));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
