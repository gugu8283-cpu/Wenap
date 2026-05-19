const { getAvKey } = require('./alphaPrice.cjs');

const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';
const cache = new Map();
const CACHE_MS = Number(process.env.ALPHA_VANTAGE_CACHE_MS) || 600000;

async function alphaVantageJson(params, apiKey) {
  const u = new URL(ALPHA_VANTAGE_URL);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  u.searchParams.set('apikey', apiKey);
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const j = await res.json();
  if (j.Note || j.Information) throw new Error(String(j.Note || j.Information).slice(0, 120));
  if (j['Error Message']) throw new Error(String(j['Error Message']).slice(0, 120));
  return j;
}

/** 最近 N 个交易日收盘价（升序，最早在前） */
async function fetchSparklineCloses(ticker, days = 7) {
  const apiKey = getAvKey();
  if (!apiKey) throw new Error('未配置 ALPHA_VANTAGE_API_KEY');
  const sym = String(ticker || '')
    .trim()
    .toUpperCase();
  if (!sym) throw new Error('缺少 ticker');

  const cacheKey = `${sym}:${days}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.points;

  const daily = await alphaVantageJson(
    { function: 'TIME_SERIES_DAILY', symbol: sym, outputsize: 'compact' },
    apiKey,
  );
  const series = daily['Time Series (Daily)'];
  if (!series || typeof series !== 'object') {
    const quote = await alphaVantageJson({ function: 'GLOBAL_QUOTE', symbol: sym }, apiKey);
    const p = parseFloat(String(quote['Global Quote']?.['05. price'] || '').replace(/,/g, ''));
    if (Number.isFinite(p) && p > 0) {
      const points = Array(days).fill(p);
      cache.set(cacheKey, { t: Date.now(), points });
      return points;
    }
    throw new Error('无法获取行情序列');
  }

  const dates = Object.keys(series).sort().reverse().slice(0, days).reverse();
  const points = dates
    .map((d) => parseFloat(String(series[d]['4. close'] || '').replace(/,/g, '')))
    .filter((p) => Number.isFinite(p) && p > 0);

  if (points.length < 2) throw new Error('收盘价数据不足');
  cache.set(cacheKey, { t: Date.now(), points });
  return points;
}

module.exports = { fetchSparklineCloses };
