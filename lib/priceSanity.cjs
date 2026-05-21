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
function isPlausibleQuote(price, overview, assetType) {
  if (!Number.isFinite(price) || price <= 0) return false;
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

function parseStopFromAction(data) {
  const sl = data?.actionLineObj?.stopLoss || '';
  const m = String(sl).match(/[\d,]+(?:\.\d+)?/);
  return m ? parseMoneyToken(m[0]) : NaN;
}

function recomputeRiskReward(data, currentPrice) {
  if (!data || typeof data !== 'object') return;
  const cur = Number(currentPrice);
  const stop = parseStopFromAction(data);
  let target = parsePricesFromLine(data.analystPriceLine || '', cur).target;
  if (!Number.isFinite(target) && data.scenarios?.bull?.range) {
    const nums = String(data.scenarios.bull.range || '').match(/[\d,]+(?:\.\d+)?/g);
    if (nums && nums.length >= 2) {
      const a = parseMoneyToken(nums[0]);
      const b = parseMoneyToken(nums[nums.length - 1]);
      if (Number.isFinite(a) && Number.isFinite(b)) target = Math.max(a, b);
    }
  }
  if (!Number.isFinite(cur) || !Number.isFinite(target) || !Number.isFinite(stop)) return;
  const reward = target - cur;
  const risk = cur - stop;
  if (reward <= 0 || risk <= 0) return;
  const ratio = reward / risk;
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 50) return;
  data.riskReward = `1:${ratio.toFixed(1)}`;
}

function sanitizeSupplyChain(data) {
  if (!data || !Array.isArray(data.supplyChain)) return;
  const bad = /虚拟|virtual|美元指数（虚拟/i;
  data.supplyChain = data.supplyChain
    .filter((c) => {
      if (!c || typeof c !== 'object') return false;
      const ticker = String(c.ticker || '')
        .trim()
        .toUpperCase();
      const name = String(c.name || '');
      const rel = String(c.relation || '');
      if (!ticker || bad.test(name) || bad.test(rel) || bad.test(ticker)) return false;
      if (!/^[A-Z][A-Z0-9.-]{0,11}$/.test(ticker)) return false;
      if (ticker === 'USDU' && /虚拟/.test(name + rel)) return false;
      return true;
    })
    .slice(0, 6);
}

function sanitizeKeyLevels(data, currentPrice, overview) {
  if (!data || !Array.isArray(data.keyLevels)) return;
  const cur = Number(currentPrice);
  const { high } = parseOverviewBounds(overview);
  let maxPlausible = Infinity;
  if (Number.isFinite(high) && high > 0) maxPlausible = high * 1.4;
  else if (Number.isFinite(cur) && cur > 0) maxPlausible = cur * 1.35;
  data.keyLevels = data.keyLevels
    .map((k) => ({
      price: Number(k?.price),
      label: String(k?.label || k?.source || '').trim(),
    }))
    .filter((k) => Number.isFinite(k.price) && k.price > 0 && k.price <= maxPlausible)
    .slice(0, 4);
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
  recomputeRiskReward,
  sanitizeSupplyChain,
  sanitizeKeyEventDates,
  sanitizeKeyLevels,
  etfSharePricePromptBlock,
  isPlausibleQuote,
};
