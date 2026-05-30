/**
 * Market data for crypto, forex, and commodity spot assets.
 * Returns a snapshot shape compatible with buildAlphaMarketSnapshot.
 */

const { currentPricePromptBlock, dataFreshnessPromptBlock } = require('./alphaMarketSnapshot.cjs');
const { isPlausibleAssetPrice } = require('./priceSanity.cjs');

const ALTERNATIVE_ASSET_TYPES = new Set(['crypto', 'forex', 'commodities']);

const CRYPTO_COINGECKO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  MATIC: 'matic-network',
  LTC: 'litecoin',
};

const COMMODITY_ALIASES = {
  GOLD: 'XAU',
  SILVER: 'XAG',
  OIL: 'WTI',
  CRUDE: 'WTI',
  BRENT: 'BRENT',
};

function isAlternativeAssetType(assetType) {
  return ALTERNATIVE_ASSET_TYPES.has(String(assetType || '').trim().toLowerCase());
}

function normalizeAltSymbol(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function parseForexPair(symbol) {
  const s = normalizeAltSymbol(symbol);
  if (s.length === 6) {
    return { base: s.slice(0, 3), quote: s.slice(3, 6), pair: s };
  }
  const m = /^([A-Z]{3})([A-Z]{3})$/.exec(s);
  if (m) return { base: m[1], quote: m[2], pair: `${m[1]}${m[2]}` };
  return null;
}

function coingeckoIdForSymbol(symbol) {
  const sym = normalizeAltSymbol(symbol);
  if (CRYPTO_COINGECKO_IDS[sym]) return CRYPTO_COINGECKO_IDS[sym];
  return sym.toLowerCase();
}

async function fetchJson(url, timeoutMs = 15000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, { signal: ctrl?.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function formatPriceUsd(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function buildSnapshotBase({
  currentPrice,
  tradingDay,
  priceSource,
  sourceLabel,
  listingCurrency,
  locale,
  warnings = [],
  assetMeta = null,
  exchangeHint = '',
}) {
  const fetchedAtIso = new Date().toISOString();
  const priceAsOfDisplay = tradingDay
    ? `${tradingDay} ${new Date(fetchedAtIso).toISOString().slice(11, 16)} UTC`
    : fetchedAtIso.slice(0, 16).replace('T', ' ');
  return {
    currentPrice,
    tradingDay: tradingDay || todayYmd(),
    priceAsOfDisplay,
    priceSource,
    priceAgeDays: 0,
    priceStaleOver7Days: false,
    priceStaleNotice: '',
    fieldMeta: {},
    fieldFreshnessWarnings: [],
    warnings,
    fetchedAtIso,
    sourceLabel,
    promptPriceBlock:
      Number.isFinite(currentPrice) && currentPrice > 0
        ? currentPricePromptBlock(currentPrice, listingCurrency || 'USD', locale)
        : '',
    promptFreshnessBlock: dataFreshnessPromptBlock(locale),
    listingCurrency: listingCurrency || 'USD',
    exchangeHint,
    assetMeta,
  };
}

function fail(code, message) {
  return { ok: false, code, message };
}

async function fetchCryptoMarketData(symbol, locale) {
  const sym = normalizeAltSymbol(symbol);
  if (!sym) return fail('INVALID_TICKER', 'Invalid crypto symbol');

  const coinId = coingeckoIdForSymbol(sym);
  let priceData;
  try {
    const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
    priceData = await fetchJson(priceUrl);
  } catch (e) {
    return fail('MARKET_DATA_UNAVAILABLE', `Could not fetch crypto price (${e.message})`);
  }

  const row = priceData?.[coinId];
  const price = Number(row?.usd);
  if (!Number.isFinite(price) || !isPlausibleAssetPrice(price, 'crypto')) {
    return fail('MARKET_DATA_UNAVAILABLE', `No market data found for ${sym}`);
  }

  let detail = {};
  try {
    const detailUrl = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
    detail = await fetchJson(detailUrl);
  } catch {
    /* optional enrichment */
  }

  const md = detail.market_data || {};
  const name = String(detail.name || sym).trim();
  const change24h = Number(row.usd_24h_change);
  const change7d = Number(md.price_change_percentage_7d_in_currency?.usd);
  const marketCap = Number(row.usd_market_cap ?? md.market_cap?.usd);
  const volume24h = Number(row.usd_24h_vol ?? md.total_volume?.usd);
  const ath = Number(md.ath?.usd);
  const circ = Number(md.circulating_supply);

  const zh = String(locale || '').startsWith('zh');
  const lines = [
    zh ? `【加密货币行情·CoinGecko】${name} (${sym})` : `【Crypto · CoinGecko】${name} (${sym})`,
    zh
      ? `现价 ${formatPriceUsd(price)}${Number.isFinite(change24h) ? `，24h ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : ''}`
      : `Spot ${formatPriceUsd(price)}${Number.isFinite(change24h) ? `, 24h ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : ''}`,
  ];
  if (Number.isFinite(change7d)) {
    lines.push(zh ? `7日涨跌 ${change7d.toFixed(2)}%` : `7d change ${change7d.toFixed(2)}%`);
  }
  if (Number.isFinite(marketCap)) {
    lines.push(zh ? `市值 ${formatPriceUsd(marketCap)}` : `Market cap ${formatPriceUsd(marketCap)}`);
  }
  if (Number.isFinite(volume24h)) {
    lines.push(zh ? `24h 成交额 ${formatPriceUsd(volume24h)}` : `24h volume ${formatPriceUsd(volume24h)}`);
  }
  if (Number.isFinite(ath)) {
    lines.push(zh ? `历史高点 ${formatPriceUsd(ath)}` : `ATH ${formatPriceUsd(ath)}`);
  }

  const snapshot = buildSnapshotBase({
    currentPrice: price,
    tradingDay: todayYmd(),
    priceSource: 'coingecko_simple',
    sourceLabel: 'CoinGecko',
    listingCurrency: 'USD',
    locale,
    assetMeta: {
      type: 'crypto',
      name,
      change24h: Number.isFinite(change24h) ? change24h : null,
      change7d: Number.isFinite(change7d) ? change7d : null,
      marketCap: Number.isFinite(marketCap) ? marketCap : null,
      volume24h: Number.isFinite(volume24h) ? volume24h : null,
    },
    exchangeHint: 'Crypto',
  });

  return { ok: true, snapshot, contextText: lines.join('\n'), listingCurrency: 'USD', exchangeHint: 'Crypto' };
}

async function fetchForexMarketData(symbol, locale) {
  const pair = parseForexPair(symbol);
  if (!pair) {
    return fail('INVALID_TICKER', 'Forex pair must be 6 letters, e.g. EURUSD');
  }

  let data;
  try {
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(pair.base)}`;
    data = await fetchJson(url);
  } catch (e) {
    return fail('MARKET_DATA_UNAVAILABLE', `Could not fetch forex rate (${e.message})`);
  }

  if (data?.result !== 'success') {
    return fail('MARKET_DATA_UNAVAILABLE', `Forex API error for ${pair.pair}`);
  }

  const rate = Number(data.rates?.[pair.quote]);
  if (!Number.isFinite(rate) || !isPlausibleAssetPrice(rate, 'forex')) {
    return fail('MARKET_DATA_UNAVAILABLE', `No rate for ${pair.base}/${pair.quote}`);
  }

  const zh = String(locale || '').startsWith('zh');
  const lines = [
    zh
      ? `【外汇行情·ExchangeRate-API】${pair.base}/${pair.quote}`
      : `【Forex · ExchangeRate-API】${pair.base}/${pair.quote}`,
    zh ? `汇率 ${rate.toFixed(5)} ${pair.quote} per 1 ${pair.base}` : `Rate ${rate.toFixed(5)} ${pair.quote} per 1 ${pair.base}`,
    data.time_last_update_utc
      ? zh
        ? `报价更新 ${data.time_last_update_utc}`
        : `Quote updated ${data.time_last_update_utc}`
      : '',
  ].filter(Boolean);

  const snapshot = buildSnapshotBase({
    currentPrice: rate,
    tradingDay: todayYmd(),
    priceSource: 'open_er_api',
    sourceLabel: 'ExchangeRate-API',
    listingCurrency: pair.quote,
    locale,
    assetMeta: {
      type: 'forex',
      base: pair.base,
      quote: pair.quote,
      pair: pair.pair,
      rate,
    },
    exchangeHint: 'FX',
  });

  return {
    ok: true,
    snapshot,
    contextText: lines.join('\n'),
    listingCurrency: pair.quote,
    exchangeHint: 'FX',
  };
}

async function fetchCommodityViaAlpha(symbol, apiKey, alphaVantageJson) {
  const sym = COMMODITY_ALIASES[symbol] || symbol;
  const av = typeof alphaVantageJson === 'function' ? alphaVantageJson : null;
  if (!apiKey || !av) return null;

  if (sym === 'WTI' || sym === 'BRENT') {
    try {
      const fn = sym === 'BRENT' ? 'BRENT' : 'WTI';
      const j = await av({ function: fn }, apiKey);
      const val = parseFloat(String(j?.data?.value || j?.value || '').replace(/,/g, ''));
      const date = String(j?.data?.date || j?.date || '').trim();
      if (Number.isFinite(val) && val > 0) {
        return { price: val, tradingDay: date || todayYmd(), unit: 'USD/barrel', source: `alphavantage_${fn}` };
      }
    } catch {
      /* fall through */
    }
  }

  const from = sym === 'XAG' ? 'XAG' : 'XAU';
  try {
    const j = await av(
      {
        function: 'CURRENCY_EXCHANGE_RATE',
        from_currency: from,
        to_currency: 'USD',
      },
      apiKey,
    );
    const rate = parseFloat(
      String(j?.['Realtime Currency Exchange Rate']?.['5. Exchange Rate'] || '').replace(/,/g, ''),
    );
    const ts = String(j?.['Realtime Currency Exchange Rate']?.['6. Last Refreshed'] || '').trim();
    if (Number.isFinite(rate) && rate > 0) {
      return {
        price: rate,
        tradingDay: ts.slice(0, 10) || todayYmd(),
        unit: sym === 'XAG' ? 'USD/troy oz' : 'USD/troy oz',
        source: 'alphavantage_fx',
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}

async function fetchCommodityMarketData(symbol, apiKey, alphaVantageJson, locale) {
  let sym = normalizeAltSymbol(symbol);
  sym = COMMODITY_ALIASES[sym] || sym;

  let row = await fetchCommodityViaAlpha(sym, apiKey, alphaVantageJson);

  if (!row && (sym === 'XAU' || sym === 'XAG')) {
    const fxSym = sym === 'XAG' ? 'XAGUSD' : 'XAUUSD';
    const fx = await fetchForexMarketData(fxSym, locale);
    if (fx.ok) {
      row = {
        price: fx.snapshot.currentPrice,
        tradingDay: fx.snapshot.tradingDay,
        unit: 'USD/troy oz',
        source: 'forex_proxy',
      };
    }
  }

  if (!row || !Number.isFinite(row.price) || !isPlausibleAssetPrice(row.price, 'commodities')) {
    return fail('MARKET_DATA_UNAVAILABLE', `No spot data for commodity ${sym}`);
  }

  const label =
    sym === 'XAU'
      ? 'Gold'
      : sym === 'XAG'
        ? 'Silver'
        : sym === 'WTI'
          ? 'WTI crude'
          : sym === 'BRENT'
            ? 'Brent crude'
            : sym;

  const zh = String(locale || '').startsWith('zh');
  const lines = [
    zh ? `【大宗商品现货】${label} (${sym})` : `【Commodity spot】${label} (${sym})`,
    zh
      ? `现货 ${formatPriceUsd(row.price)} · ${row.unit || 'USD'}`
      : `Spot ${formatPriceUsd(row.price)} · ${row.unit || 'USD'}`,
    row.tradingDay ? (zh ? `报价日期 ${row.tradingDay}` : `As of ${row.tradingDay}`) : '',
  ].filter(Boolean);

  const snapshot = buildSnapshotBase({
    currentPrice: row.price,
    tradingDay: row.tradingDay || todayYmd(),
    priceSource: row.source,
    sourceLabel: row.source.startsWith('alphavantage') ? 'Alpha Vantage' : 'Market data',
    listingCurrency: 'USD',
    locale,
    assetMeta: {
      type: 'commodities',
      symbol: sym,
      label,
      unit: row.unit || 'USD',
    },
    exchangeHint: 'Commodity',
  });

  return {
    ok: true,
    snapshot,
    contextText: lines.join('\n'),
    listingCurrency: 'USD',
    exchangeHint: 'Commodity',
  };
}

async function fetchAlternativeAssetMarketData({
  symbol,
  assetType,
  apiKey = '',
  alphaVantageJson = null,
  locale = 'en',
}) {
  const at = String(assetType || '').trim().toLowerCase();
  if (at === 'crypto') return fetchCryptoMarketData(symbol, locale);
  if (at === 'forex') return fetchForexMarketData(symbol, locale);
  if (at === 'commodities') {
    return fetchCommodityMarketData(symbol, apiKey, alphaVantageJson, locale);
  }
  return fail('UNSUPPORTED_ASSET', 'Unsupported asset type');
}

module.exports = {
  ALTERNATIVE_ASSET_TYPES,
  isAlternativeAssetType,
  fetchAlternativeAssetMarketData,
  fetchCryptoMarketData,
  fetchForexMarketData,
  fetchCommodityMarketData,
};
