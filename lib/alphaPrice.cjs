const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';
const { marketstackConfigured, fetchClosePriceAsOf } = require('./marketstackClient.cjs');

function getAvKey() {
  return (process.env.ALPHA_VANTAGE_API_KEY || '').trim().replace(/^["']+|["']+$/g, '');
}

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

async function fetchClosePriceAlpha(ticker, asOfDate) {
  const apiKey = getAvKey();
  if (!apiKey) throw new Error('未配置 ALPHA_VANTAGE_API_KEY');
  const sym = String(ticker || '')
    .trim()
    .toUpperCase();
  const target = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);
  const targetYmd = target.toISOString().slice(0, 10);

  const daily = await alphaVantageJson({ function: 'TIME_SERIES_DAILY', symbol: sym, outputsize: 'compact' }, apiKey);
  const series = daily['Time Series (Daily)'];
  if (!series || typeof series !== 'object') {
    const quote = await alphaVantageJson({ function: 'GLOBAL_QUOTE', symbol: sym }, apiKey);
    const p = parseFloat(String(quote['Global Quote']?.['05. price'] || '').replace(/,/g, ''));
    if (Number.isFinite(p) && p > 0) return { price: p, source: 'alpha_vantage' };
    throw new Error('无法获取收盘价');
  }
  const dates = Object.keys(series).sort().reverse();
  for (const d of dates) {
    if (d <= targetYmd) {
      const close = parseFloat(String(series[d]['4. close'] || '').replace(/,/g, ''));
      if (Number.isFinite(close) && close > 0) return { price: close, source: 'alpha_vantage' };
    }
  }
  const latest = dates[0];
  const close = parseFloat(String(series[latest]['4. close'] || '').replace(/,/g, ''));
  if (Number.isFinite(close) && close > 0) return { price: close, source: 'alpha_vantage' };
  throw new Error('无法解析收盘价');
}

/** 取指定日期或之前最近交易日的收盘价；AV 失败时尝试 Marketstack */
async function fetchClosePrice(ticker, asOfDate = new Date()) {
  let lastErr;
  if (getAvKey()) {
    try {
      return await fetchClosePriceAlpha(ticker, asOfDate);
    } catch (e) {
      lastErr = e;
    }
  }
  if (marketstackConfigured()) {
    try {
      const price = await fetchClosePriceAsOf(ticker, asOfDate);
      return { price, source: 'marketstack' };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('未配置行情 API（ALPHA_VANTAGE_API_KEY 或 MARKETSTACK_API_KEY）');
}

module.exports = { fetchClosePrice, getAvKey };
