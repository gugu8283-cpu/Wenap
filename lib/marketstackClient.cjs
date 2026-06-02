const { getCachedJson, setCachedJson } = require('./cacheClient.cjs');

const MARKETSTACK_BASE = 'http://api.marketstack.com/v1';
const DEFAULT_TTL_SEC = 900;

function getMarketstackKey() {
  return String(process.env.MARKETSTACK_API_KEY || '').trim();
}

function marketstackConfigured() {
  return Boolean(getMarketstackKey());
}

function marketDataProvider() {
  const p = String(process.env.MARKET_DATA_PROVIDER || 'alphavantage')
    .trim()
    .toLowerCase();
  return p === 'marketstack' ? 'marketstack' : 'alphavantage';
}

function sanitizeSymbol(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 24);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

async function marketstackJson(path, params = {}, apiKey) {
  const key = String(apiKey || getMarketstackKey() || '').trim();
  if (!key) throw new Error('MARKETSTACK_NOT_CONFIGURED');
  const u = new URL(`${MARKETSTACK_BASE}/${String(path || '').replace(/^\//, '')}`);
  u.searchParams.set('access_key', key);
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null || v === '') continue;
    u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`Marketstack HTTP ${res.status}`);
  const j = await res.json();
  if (j?.error) {
    const msg = String(j.error?.message || j.error?.code || 'marketstack error');
    throw new Error(`Marketstack ${msg}`);
  }
  return j;
}

function avg(list) {
  if (!Array.isArray(list) || !list.length) return NaN;
  const vals = list.map((x) => num(x)).filter((x) => Number.isFinite(x));
  if (!vals.length) return NaN;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function summarizeFromEodRows(rows) {
  const arr = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const latest = sorted[0] || {};
  const close = num(latest.close);
  const volume = num(latest.volume);
  const tradingDay = String(latest.date || '').slice(0, 10);
  const highs = sorted.map((r) => num(r.high)).filter((x) => Number.isFinite(x));
  const lows = sorted.map((r) => num(r.low)).filter((x) => Number.isFinite(x));
  const closes = sorted.map((r) => num(r.close)).filter((x) => Number.isFinite(x));
  const ma50 = avg(closes.slice(0, 50));
  const ma200 = avg(closes.slice(0, 200));
  return {
    close,
    volume,
    tradingDay,
    high52: highs.length ? Math.max(...highs) : NaN,
    low52: lows.length ? Math.min(...lows) : NaN,
    ma50,
    ma200,
    exchange: String(latest.exchange || '').trim(),
    currency: String(latest.currency || '').trim().toUpperCase(),
  };
}

async function fetchMarketstackContextBundle(symbol, locale = 'zh-CN', apiKey = '') {
  const sym = sanitizeSymbol(symbol);
  if (!sym) return { text: '', overview: null, globalQuote: null, sourceLabel: 'Marketstack' };

  const cacheKey = `ms:eod:${sym}`;
  let payload = await getCachedJson(cacheKey);
  if (!payload) {
    const eod = await marketstackJson(
      'eod',
      { symbols: sym, limit: 260, sort: 'DESC' },
      apiKey,
    );
    payload = { eodRows: Array.isArray(eod?.data) ? eod.data : [] };
    await setCachedJson(cacheKey, payload, DEFAULT_TTL_SEC);
  }

  const sum = summarizeFromEodRows(payload.eodRows);
  if (!sum || !Number.isFinite(sum.close) || sum.close <= 0) {
    return { text: '【Marketstack】未找到有效行情', overview: null, globalQuote: null, sourceLabel: 'Marketstack' };
  }

  const globalQuote = {
    '05. price': String(sum.close),
    '06. volume': Number.isFinite(sum.volume) ? String(sum.volume) : '',
    '07. latest trading day': sum.tradingDay || '',
    '08. previous close': '',
    '09. change': '',
    '10. change percent': '',
  };

  const overview = {
    Symbol: sym,
    Name: sym,
    Exchange: sum.exchange || '—',
    Currency: sum.currency || 'USD',
    Sector: '',
    Industry: '',
    '52WeekHigh': Number.isFinite(sum.high52) ? String(sum.high52) : '',
    '52WeekLow': Number.isFinite(sum.low52) ? String(sum.low52) : '',
    '50DayMovingAverage': Number.isFinite(sum.ma50) ? String(sum.ma50.toFixed(4)) : '',
    '200DayMovingAverage': Number.isFinite(sum.ma200) ? String(sum.ma200.toFixed(4)) : '',
    Volume: Number.isFinite(sum.volume) ? String(sum.volume) : '',
  };

  const zh = String(locale || '').startsWith('zh');
  const lines = [
    zh
      ? '【Marketstack 已拉取】EOD/延迟行情；分析必须以本段价格与日期为准。'
      : '[Marketstack loaded] EOD/delayed quote; analysis must anchor to this price/date.',
    'Source: https://marketstack.com/',
    zh
      ? `- 最新收盘：${sum.close} | 最近交易日：${sum.tradingDay || '—'}`
      : `- Latest close: ${sum.close} | Last session: ${sum.tradingDay || '—'}`,
    zh
      ? `- 交易所：${sum.exchange || '—'} | 货币：${sum.currency || 'USD'}`
      : `- Exchange: ${sum.exchange || '—'} | Currency: ${sum.currency || 'USD'}`,
  ];
  if (Number.isFinite(sum.high52) && Number.isFinite(sum.low52)) {
    lines.push(
      zh
        ? `- 52周区间：${sum.low52} ~ ${sum.high52}`
        : `- 52w range: ${sum.low52} ~ ${sum.high52}`,
    );
  }
  if (Number.isFinite(sum.ma50) && Number.isFinite(sum.ma200)) {
    lines.push(
      zh
        ? `- 50/200日均线：${sum.ma50.toFixed(2)} / ${sum.ma200.toFixed(2)}`
        : `- 50/200D MA: ${sum.ma50.toFixed(2)} / ${sum.ma200.toFixed(2)}`,
    );
  }

  return {
    text: lines.join('\n'),
    overview,
    globalQuote,
    sourceLabel: 'Marketstack',
    dataDelayLabel: 'EOD/delayed',
  };
}

/** Daily OHLC rows, oldest → newest (for indicators / alerts). */
async function fetchEodClosesOldestFirst(symbol, limit = 260, withVolume = false) {
  const sym = sanitizeSymbol(symbol);
  if (!sym) return [];
  const cacheKey = `ms:eod:ohlc:${sym}:${limit}:${withVolume ? 1 : 0}`;
  let payload = await getCachedJson(cacheKey);
  if (!payload) {
    const eod = await marketstackJson('eod', { symbols: sym, limit, sort: 'DESC' }, '');
    payload = { eodRows: Array.isArray(eod?.data) ? eod.data : [] };
    await setCachedJson(cacheKey, payload, DEFAULT_TTL_SEC);
  }
  const sorted = [...(payload.eodRows || [])].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || '')),
  );
  return sorted
    .map((r) => ({
      date: String(r.date || '').slice(0, 10),
      close: num(r.close),
      volume: num(r.volume),
      high: num(r.high),
      low: num(r.low),
    }))
    .filter((r) => Number.isFinite(r.close) && r.close > 0);
}

module.exports = {
  marketDataProvider,
  marketstackConfigured,
  getMarketstackKey,
  fetchMarketstackContextBundle,
  fetchEodClosesOldestFirst,
};
