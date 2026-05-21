const assert = require('assert');
const { parsePricesFromLine } = require('../lib/parsePrices.cjs');
const {
  resolveTickerInput,
  reconcileCurrentPrice,
  recomputeRiskReward,
  resolveTargetPrice,
  sanitizeSupplyChain,
  isPlausibleQuote,
} = require('../lib/priceSanity.cjs');

// Quote locked: line must not overwrite AV GLD price
const p1 = parsePricesFromLine('当前价 $4790 | 目标价 $4980', 245.5);
assert.strictEqual(p1.current, 245.5, 'quote should lock current');

// Reconcile prefers plausible quote over spot in line
const cur = reconcileCurrentPrice({
  quotePrice: 245.5,
  analystPriceLine: '当前价 $4790 | 目标价 $280',
  overview: { '52WeekHigh': '260', '52WeekLow': '180' },
  assetType: 'commodity_etf',
});
assert.strictEqual(cur, 245.5, 'reconcile uses AV quote');

// Implausible spot on GLD
assert.strictEqual(isPlausibleQuote(4790, { '52WeekHigh': '260', '52WeekLow': '180' }, 'etf'), false);

// RR recompute
const data = {
  analystPriceLine: '当前价 $245 | 目标价 $280',
  actionLineObj: { stopLoss: '$230', suggestion: 'hold', catalyst: '' },
  scenarios: { bull: { range: '$270 - $290' } },
};
recomputeRiskReward(data, 245);
assert.match(data.riskReward, /^1:2\./, `RR should be ~2.3 got ${data.riskReward}`);

// Ticker alias
assert.strictEqual(resolveTickerInput('黄金'), 'GLD');

// Virtual supply chain removed
const d2 = {
  supplyChain: [
    { ticker: 'USDU', name: '美元指数（虚拟标的）', relation: 'x' },
    { ticker: 'TLT', name: 'TLT', relation: 'bonds' },
  ],
};
sanitizeSupplyChain(d2);
assert.strictEqual(d2.supplyChain.length, 1);
assert.strictEqual(d2.supplyChain[0].ticker, 'TLT');

// TSM-style bogus target $12.10 with current $435 → use bull $460
const tsmTarget = resolveTargetPrice({
  targetFromLine: 12.1,
  current: 435,
  overview: { '52WeekLow': '320', '52WeekHigh': '460' },
  scenarios: { bull: { range: '$420 - $460' } },
  signal: 'BUY',
});
assert.strictEqual(tsmTarget, 460, 'bogus low target should fall back to bull high');

console.log('[test-price-sanity] OK');
