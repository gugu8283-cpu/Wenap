/**
 * English (and non-Chinese) main analysis prompt — avoids Chinese prompt body
 * conflicting with outputLanguageInstruction when locale is en/ja/ko/de.
 */

const {
  normalizeLocale,
  outputLanguageInstruction,
  horizonLabel,
  assetLabel,
  dimensionJsonSpec,
  dimensionBoundaryPromptBlock,
  policyRegulationBlock,
  sixthDimensionPromptBlock,
  defaultDisclaimer,
} = require('./outputLocale.cjs');
const { searchIntegrityBlock, sourceFreshnessBlock, accuracyTrustPromptBlock } = require('./promptSearchRules.cjs');
const { timeAnchorPromptBlock } = require('./reportTimeAnchor.cjs');
const { stockPricePromptBlock, etfSharePricePromptBlock } = require('./priceSanity.cjs');

function scenarioCurrencyPromptBlockEn(listingCurrency, exchangeHint) {
  const ex = String(exchangeHint || '').trim();
  const exLine = ex ? `\nExchange field (reference): ${ex}` : '';
  if (listingCurrency === 'JPY') {
    return `【Quote currency】JPY listing.${exLine}
- scenarios.bull/base/bear ranges must use yen (e.g. 4800–5200 JPY or ¥4800–¥5200); do NOT use "$" for yen prices.
- analystPriceLine and actionLine prices must use yen/¥.`;
  }
  if (listingCurrency === 'HKD') {
    return `【Quote currency】HKD.${exLine} Use HK$xx–yy; do not confuse with USD $.`;
  }
  if (listingCurrency === 'CNY') {
    return `【Quote currency】CNY.${exLine} Use ¥xx–yy or xx–yy CNY; not USD $.`;
  }
  if (listingCurrency === 'USD') {
    return `【Quote currency】USD.${exLine} Ranges may use $low–$high; must match quote currency.`;
  }
  return `【Quote currency】Listing currency is **${listingCurrency}**.${exLine} All ranges and analystPriceLine must match; no wrong "$" for non-USD listings.`;
}

function stockComplianceSnippetEn(ticker, asOf) {
  return `【Stock】Only cite sourced events (splits, listing rules, material events in last 90d); omit if none. ${ticker} · ${asOf}. No fabricated filing IDs.`;
}

function horizonWeightHintEn(horizon) {
  if (horizon === '1m' || horizon === '3m') {
    return 'Short horizon: weight news sentiment, market sentiment, and policy/regulation higher.';
  }
  if (horizon === '6m' || horizon === '1y' || horizon === '2y') {
    return 'Longer horizon: weight macroeconomics and industry trends higher.';
  }
  return '';
}

function tierPromptExtensionsEn(tier) {
  const t = String(tier || 'free').toLowerCase();
  let ext = '';
  if (t === 'pro' || t === 'pro_plus') {
    ext += `

【Pro extra fields】Output when you have material (else empty string/array/object):
  "actionLine": { "suggestion": "≤24 words", "stopLoss": "≤16 words", "catalyst": "≤20 words" }
  "keyEvents": [ { "date": "YYYY-MM-DD or TBD", "event": "≤28 words" } ] (0–6 items, full list)
  "leaderInsiderSummary": "≤40 words insider overview"
  "peerVsSectorLine": "one line: vs sector peers"`;
  }
  if (t === 'pro_plus') {
    ext += `

【Pro+ extra fields】Beyond Pro:
  "bullBearDebate": {
    "bull": [ { "reason": "full sentence, ≤120 words, do not truncate mid-word", "weight": "e.g. 60%" }, ...3 items ],
    "bear": [ { "reason": "full sentence, ≤120 words, do not truncate mid-word", "weight": "e.g. 40%" }, ...3 items ]
  }
  Each scenario (bull/base/bear) add "triggerPrice": number or null, "timeWindow": "e.g. 2026 Q3"
  Each supplyChain item add "analysis": "linkage to main ticker ≤50 words"
  "comparison": null`;
  }
  return ext;
}

function riskFocusPromptBlockEn(riskFocus) {
  const RISK_FOCUS_LABELS = {
    geo: 'Geopolitics & export controls',
    competition: 'Competition & substitutes',
    macro: 'Macro & rates',
    earnings: 'Earnings & margins',
  };
  const key = String(riskFocus || '').trim().toLowerCase();
  if (!key || !RISK_FOCUS_LABELS[key]) return '';
  return `\n【User risk focus】Prioritize: ${RISK_FOCUS_LABELS[key]}. Strengthen in relevant dimension notes, riskBlindSpot, and outlook; include counter-evidence.`;
}

function buildMainJsonPromptIntl({
  ticker,
  assetType,
  horizon,
  alphaContextBlock,
  listingCurrency,
  exchangeHint,
  tier = 'free',
  locale = 'en',
  riskFocus = '',
  dataAsOfAnchor = '',
}) {
  const loc = normalizeLocale(locale);
  const h = horizonLabel(horizon, loc);
  const a = assetLabel(assetType, loc);
  const anchor = String(dataAsOfAnchor || '').trim();
  const asOf =
    anchor ||
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  const stockSnip = assetType === 'stock' ? stockComplianceSnippetEn(ticker, asOf) : '';
  const sixthDimBlock = sixthDimensionPromptBlock(assetType, loc);
  const hw = horizonWeightHintEn(horizon);
  const av = alphaContextBlock ? `${alphaContextBlock}\n\n` : '';
  const curBlock = scenarioCurrencyPromptBlockEn(listingCurrency || 'USD', exchangeHint || '');
  const langBlock = outputLanguageInstruction(loc);
  const disc = defaultDisclaimer(loc).replace(/"/g, '\\"');

  return `${langBlock}
You are a professional equity analyst. Use web search to verify facts. **Be concise**: numbers, events, judgments only—no filler. Leave fields empty if no evidence; never write "not found / pending verification".

Ticker ${ticker} · ${a} · horizon ${h} · as of ${asOf}
${hw}
${curBlock}

${av}${stockSnip}

${dimensionBoundaryPromptBlock(assetType, loc)}

【Entity】identityCheck ≤28 words: legal name + listing venue/code must match ${ticker}.

【Writing】No URLs in text; cite tags only [SEC][Exchange][IR][News][Filing][Quote][Research]. **Each fact once** (summary / dimensions / detail / outlook must not repeat). Empty string if no data.

${sixthDimBlock}
${riskFocusPromptBlockEn(riskFocus)}
${etfSharePricePromptBlock(assetType, ticker, loc)}
${assetType === 'stock' ? stockPricePromptBlock(ticker, loc) : ''}
${searchIntegrityBlock(loc)}
${sourceFreshnessBlock(loc)}
${accuracyTrustPromptBlock(loc)}
${timeAnchorPromptBlock(loc)}

【Score consistency】Headline "score" MUST equal the rounded average of the six dimension scores (ignore dimensions with score 0 / insufficient). Maximum deviation 3 points. Align signal: BUY if score≥58, HOLD if 42-57, SELL if ≤41 unless riskBlindSpot states otherwise.

Output ONE valid JSON object only (no markdown fences, no text outside JSON).

JSON schema:
{
  "identityCheck": "≤28 words",
  "dataAsOf": "YYYY-MM-DD",
  "score": 0-100,
  "signal": "BUY" | "HOLD" | "SELL",
  "risk": "高" | "中" | "低",
  "riskReward": "e.g. 1:2.5; empty if unknown",
  "summary": "≤28 words, one-line conclusion",
  "coreConclusion": {
    "headline": "≤32 words: key catalyst (earnings/policy/product)",
    "ifBull": "if beats expectations → target range with $",
    "ifBear": "if misses → downside level with $",
    "action": "Buy/Hold/Watch + stop loss with $"
  },
  "riskBlindSpot": "≤48 words: one underweighted risk with source date tag",
  "keyLevels": [ { "price": 0, "label": "e.g. 120-day MA resistance; max 4, numeric price" } ],
  "analystPriceLine": "one line: target / spot / upside % (spot must match quote API; ETFs must not use spot gold price)",
  "dimensions": [ ${dimensionJsonSpec(assetType, loc)} ],
  "detailAnalysis": "180-260 chars; new facts only; escape quotes in JSON",
  "sources": [ { "text": "", "url": "https://...", "time": "", "credibility": "高|中|低", "cite": "SEC" } ],
  "supplyChain": [
    { "ticker": "TSM", "name": "TSMC", "exchange": "NYSE", "relation": "Leading foundry for NVDA AI GPUs", "score": 0-100 }
  ],
  "scenarios": {
    "bull": { "p": 0-100, "range": "range with correct currency", "trigger": "≤36 words" },
    "base": { "p": 0-100, "range": "…", "trigger": "≤36 words" },
    "bear": { "p": 0-100, "range": "…", "trigger": "≤36 words" }
  },
  "valuationBridge": "≤36 words or empty",
  "technicalSnapshot": "≤56 words; key levels as $price (source), e.g. $236.54 (120-day MA resistance)",
  "outlook": "≤72 words; aligned with horizon ${h}; do not repeat summary/dimensions",
  "disclaimer": "${disc}"
}

Hard rules: supplyChain ≥2 items, each **ticker required**. sources must be JSON array, not markdown tables. scenarios p sum = 100. valuationBridge ≤50 words.

【supplyChain.relation】10–20 words describing concrete upstream/downstream link to ${ticker}. Examples: TSM "Leading foundry for NVDA AI GPUs"; ASML "Lithography equipment supplier"; AMD "Direct GPU competitor". No placeholders like "TBD" or "to be updated".

【Target vs scenarios】Target in analystPriceLine must fall inside scenarios.bull range (adjust bull.range if needed). Bear < base < spot area < bull; ranges must not overlap heavily (gaps ≤20% of axis width).

【Completeness】Full sentences only; no trailing commas or fragments.${tierPromptExtensionsEn(tier)}

${outputLanguageInstruction(loc)}`;
}

module.exports = { buildMainJsonPromptIntl };
