/**
 * Phase B (free + compliance-first):
 * - Macro: World Bank Indicators API (global; attribution required).
 * - Technicals: computed from Marketstack EOD closes.
 */
const { fetchWorldBankMacroSummary, worldBankPromptBlock } = require('./worldBankClient.cjs');
const { computeTechnicals, technicalPromptBlock } = require('./technicalIndicators.cjs');
const {
  marketDataProvider,
  marketstackConfigured,
  fetchEodClosesOldestFirst,
} = require('./marketstackClient.cjs');

async function buildMarketEnrichment({ symbol, locale = 'en', tier = 'free', macroCountry = 'USA' }) {
  const t = String(tier || 'free').toLowerCase();
  const isPro = t === 'pro' || t === 'pro_plus';
  if (!isPro) return { text: '', macro: null, technicals: null };

  const parts = [];
  let macro = null;
  let technicals = null;

  try {
    macro = await fetchWorldBankMacroSummary(macroCountry, locale);
    const block = worldBankPromptBlock(macro, locale);
    if (block) parts.push(block);
  } catch (e) {
    console.warn('[Enrichment] WorldBank:', e.message);
  }

  let closes = [];
  if (marketDataProvider() === 'marketstack' && marketstackConfigured()) {
    try {
      closes = await fetchEodClosesOldestFirst(symbol, 260);
    } catch (e) {
      console.warn('[Enrichment] EOD:', e.message);
    }
  }
  if (closes.length >= 20) {
    technicals = computeTechnicals(closes);
    const tBlock = technicalPromptBlock(technicals, locale);
    if (tBlock) parts.push(tBlock);
  }

  return {
    text: parts.filter(Boolean).join('\n\n'),
    macro,
    technicals,
    sources: [
      macro?.series?.length ? { label: 'World Bank Data', url: macro.sourceUrl } : null,
      technicals?.ok ? { label: 'Computed from EOD', url: 'https://marketstack.com/' } : null,
    ].filter(Boolean),
  };
}

module.exports = {
  buildMarketEnrichment,
};
