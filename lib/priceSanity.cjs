/**
 * Price sanity: ETF share price vs commodity spot confusion, RR recompute, supply chain filter.
 */

const { parsePricesFromLine, parseMoneyToken } = require('./parsePrices.cjs');

const TICKER_ALIASES = {
  黄金: 'GLD',
  金子: 'GLD',
  GOLD: 'GLD',
  白银: 'SLV',
  SILVER: 'SLV',
  原油: 'USO',
  OIL: 'USO',
  石油: 'USO',
  铜: 'CPER',
};

/** Chinese commodity names → tradable ticker */
function resolveTickerInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const upper = s.toUpperCase().replace(/[^A-Z0-9.-]/g, '');
  if (/^[A-Z][A-Z0-9.-]{0,14}$/.test(upper)) return upper;
  const zh = s.replace(/\s+/g, '');
  if (TICKER_ALIASES[zh]) return TICKER_ALIASES[zh];
  if (TICKER_ALIASES[s]) return TICKER_ALIASES[s];
  return upper || s.toUpperCase();
}

function parseOverviewBounds(overview) {
  if (!overview || typeof overview !== 'object') return { low: NaN, high: NaN };
  const low = parseMoneyToken(overview['52WeekLow']);
  const high = parseMoneyToken(overview['52WeekHigh']);
  return { low, high };
}

/**
 * If quote is outside plausible range vs 52w band, prefer quote only when line looks like spot gold.
 * For ETF/commodity_etf: price > high*2 or price > 1500 with high < 800 → suspect spot gold on ETF ticker.
 */
function isPlausibleAssetPrice(price, assetType) {
  if (!Number.isFinite(price) || price <= 0) return false;
  const at = String(assetType || '').toLowerCase();
  if (at === 'crypto') return price <= 10_000_000;
  if (at === 'forex') return price <= 1000;
  if (at === 'commodities') return price <= 100_000;
  return true;
}

function isPlausibleQuote(price, overview, assetType) {
  if (!Number.isFinite(price) || price <= 0) return false;
  if (!isPlausibleAssetPrice(price, assetType)) return false;
  const { low, high } = parseOverviewBounds(overview);
  const at = String(assetType || '').toLowerCase();
  if (Number.isFinite(high) && high > 0) {
    if (price > high * 2.5) return false;
    if (price < low * 0.25 && Number.isFinite(low) && low > 0) return false;
  }
  if ((at === 'etf' || at === 'commodity_etf') && price > 1200) {
    if (!Number.isFinite(high) || high < 600) return false;
  }
  return true;
}

/**
 * Pick authoritative current price: AV quote wins; line only if quote missing or implausible.
 */
function reconcileCurrentPrice({ quotePrice, analystPriceLine, overview, assetType }) {
  const parsed = parsePricesFromLine(analystPriceLine, NaN);
  let current = NaN;
  if (Number.isFinite(quotePrice) && quotePrice > 0 && isPlausibleQuote(quotePrice, overview, assetType)) {
    current = quotePrice;
  } else if (Number.isFinite(quotePrice) && quotePrice > 0) {
    current = quotePrice;
  } else if (Number.isFinite(parsed.current) && isPlausibleQuote(parsed.current, overview, assetType)) {
    current = parsed.current;
  }
  return current;
}

function pickBullScenarioTarget(scenarios, prefer = 'high') {
  const range = scenarios?.bull?.range;
  if (!range) return NaN;
  const nums = String(range).match(/[\d,]+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return NaN;
  const vals = nums.map((n) => parseMoneyToken(n)).filter((n) => Number.isFinite(n) && n > 0);
  if (!vals.length) return NaN;
  return prefer === 'mid' ? (Math.min(...vals) + Math.max(...vals)) / 2 : Math.max(...vals);
}

/**
 * Target must be same order of magnitude as current (catches $12.10 vs $435 TSM-style errors).
 */
function isPlausibleTargetPair(target, current, overview, signal = 'HOLD') {
  if (!Number.isFinite(target) || !Number.isFinite(current) || current <= 0 || target <= 0) {
    return false;
  }
  if (target < 5 && current > 50) return false;
  const ratio = target / current;
  const sig = String(signal || '').toUpperCase();
  if (sig === 'BUY' && ratio < 0.88) return false;
  if (sig === 'SELL' && ratio > 1.12) return false;
  if (ratio < 0.25 || ratio > 2.8) return false;
  const { low, high } = parseOverviewBounds(overview);
  if (Number.isFinite(high) && high > 0 && target > high * 1.55) return false;
  if (Number.isFinite(low) && low > 0 && target < low * 0.45) return false;
  if (Number.isFinite(high) && high > 0 && current > high * 1.55) return false;
  return true;
}

function resolveTargetPrice({ targetFromLine, current, overview, scenarios, signal }) {
  if (isPlausibleTargetPair(targetFromLine, current, overview, signal)) {
    return targetFromLine;
  }
  const fromBull = pickBullScenarioTarget(scenarios, 'high');
  if (isPlausibleTargetPair(fromBull, current, overview, signal)) return fromBull;
  const avTp = parseMoneyToken(overview?.AnalystTargetPrice);
  if (isPlausibleTargetPair(avTp, current, overview, signal)) return avTp;
  if (Number.isFinite(current) && current > 0) {
    const sig = String(signal || '').toUpperCase();
    if (sig === 'BUY') return Math.round(current * 1.12 * 100) / 100;
    if (sig === 'SELL') return Math.round(current * 0.9 * 100) / 100;
  }
  return NaN;
}

function parseStopFromAction(data) {
  const sl = data?.actionLineObj?.stopLoss || '';
  const m = String(sl).match(/[\d,]+(?:\.\d+)?/);
  return m ? parseMoneyToken(m[0]) : NaN;
}

function recomputeRiskReward(data, currentPrice, overview) {
  if (!data || typeof data !== 'object') return;
  const cur = Number(currentPrice);
  const stop = parseStopFromAction(data);
  const signal = data.signal || 'HOLD';
  let target = parsePricesFromLine(data.analystPriceLine || '', cur).target;
  target = resolveTargetPrice({
    targetFromLine: target,
    current: cur,
    overview,
    scenarios: data.scenarios,
    signal,
  });
  if (!Number.isFinite(cur) || !Number.isFinite(target) || !Number.isFinite(stop)) return;
  const reward = target - cur;
  const risk = cur - stop;
  if (reward <= 0 || risk <= 0) return;
  const ratio = reward / risk;
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 50) return;
  data.riskReward = `1:${ratio.toFixed(1)}`;
}

function isValidSupplyTicker(ticker, assetType) {
  const t = String(ticker || '')
    .trim()
    .toUpperCase();
  if (!t) return false;
  const at = String(assetType || '').toLowerCase();
  if (at === 'forex') return /^[A-Z]{3,6}$/.test(t);
  if (at === 'crypto') return /^[A-Z0-9]{2,12}$/.test(t);
  if (at === 'commodities') return /^[A-Z0-9]{2,12}$/.test(t);
  return /^[A-Z][A-Z0-9.-]{0,11}$/.test(t);
}

function sanitizeSupplyChain(data, assetType = 'stock') {
  if (!data || !Array.isArray(data.supplyChain)) return;
  const bad = /虚拟|virtual|美元指数（虚拟/i;
  const at = String(assetType || data.assetType || 'stock').toLowerCase();
  data.supplyChain = data.supplyChain
    .filter((c) => {
      if (!c || typeof c !== 'object') return false;
      const ticker = String(c.ticker || '')
        .trim()
        .toUpperCase();
      const name = String(c.name || '');
      const rel = String(c.relation || '');
      if (!ticker || bad.test(name) || bad.test(rel) || bad.test(ticker)) return false;
      if (!isValidSupplyTicker(ticker, at)) return false;
      if (ticker === 'USDU' && /虚拟/.test(name + rel)) return false;
      return true;
    })
    .slice(0, 6);
}

function sanitizeKeyLevels(data, currentPrice, overview) {
  if (!data || !Array.isArray(data.keyLevels)) return;
  const cur = Number(currentPrice);
  const { high, low } = parseOverviewBounds(overview);
  let maxPlausible = Infinity;
  let minPlausible = 0;
  if (Number.isFinite(high) && high > 0) maxPlausible = high * 1.4;
  else if (Number.isFinite(cur) && cur > 0) maxPlausible = cur * 1.35;
  if (Number.isFinite(low) && low > 0) minPlausible = low * 0.45;
  else if (Number.isFinite(cur) && cur > 0) minPlausible = cur * 0.55;
  data.keyLevels = data.keyLevels
    .map((k) => ({
      price: Number(k?.price),
      label: String(k?.label || k?.source || '').trim(),
    }))
    .filter(
      (k) =>
        Number.isFinite(k.price) &&
        k.price > 0 &&
        k.price >= minPlausible &&
        k.price <= maxPlausible,
    )
    .slice(0, 4);
}

function stockPricePromptBlock(ticker, loc) {
  const zh = loc.startsWith('zh');
  const sym = String(ticker || '').toUpperCase();
  if (zh) {
    return `
【${sym} 股价口径·硬性】analystPriceLine 的「目标价」必须与 scenarios.bull 区间一致（目标价落在牛势区间内）。
禁止把 EPS、毛利率(如66.2)、PE倍数等当成股价。目标价与现价必须为同一币种（美元报价）。
若 signal=BUY，目标价须高于现价；止损须低于现价。`;
  }
  return `
【${sym} price basis】Target in analystPriceLine must align with scenarios.bull range (same currency as spot quote).
Do NOT use EPS, margins, or PE as share price. If BUY, target > current; stop < current.`;
}

function sanitizeKeyEventDates(data) {
  if (!data || !Array.isArray(data.keyEvents)) return;
  data.keyEvents = data.keyEvents.map((x) => {
    let date = String(x.date || '').trim();
    if (/XX/i.test(date) || /YYYY/i.test(date)) date = '待公告';
    if (/^\d{4}-\d{2}$/.test(date)) date = date;
    return { ...x, date: date.slice(0, 36) };
  });
}

function etfSharePricePromptBlock(assetType, ticker, loc) {
  const at = String(assetType || '').toLowerCase();
  if (at !== 'etf' && at !== 'commodity_etf' && at !== 'reit') return '';
  const zh = loc.startsWith('zh');
  const sym = String(ticker || '').toUpperCase();
  if (zh) {
    return `
【${sym} 价格口径·硬性】analystPriceLine、keyLevels、scenarios 区间必须使用 **${sym} 股票/基金份额价格**（与行情 API 一致），禁止把国际现货金价（美元/盎司，如 4500–5000）当作 ${sym} 的「当前价」。
黄金 ETF（GLD/IAU）每股通常约为现货金的 1/10 量级；若现价上千美元而 GLD 应在数百美元，即属错误。
riskReward 须与建议止损、目标价、当前价可算一致。`;
  }
  return `
【${sym} price basis】Use **${sym} fund/share prices** only in analystPriceLine, keyLevels, and scenario ranges—NOT spot gold/silver per-oz quotes.
riskReward must match stop, target, and current share price.`;
}

module.exports = {
  resolveTickerInput,
  reconcileCurrentPrice,
  resolveTargetPrice,
  isPlausibleTargetPair,
  isPlausibleAssetPrice,
  pickBullScenarioTarget,
  recomputeRiskReward,
  sanitizeSupplyChain,
  sanitizeKeyEventDates,
  sanitizeKeyLevels,
  etfSharePricePromptBlock,
  stockPricePromptBlock,
  isPlausibleQuote,
  isValidSupplyTicker,
};
