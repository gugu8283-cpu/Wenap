/**
 * Single source of truth for Alpha Vantage spot price + per-field as-of metadata.
 */

const { parseYmd } = require('./reportAccuracy.cjs');

const PRICE_MAX_AGE_DAYS = 7;
const FIELD_STALE_DAYS = 3;
const SOURCE_LABEL = 'Alpha Vantage';

function formatYmd(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function todayYmdUtc() {
  return formatYmd(new Date());
}

function daysSinceYmd(ymd) {
  const d = parseYmd(ymd);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function parsePositivePrice(raw) {
  const n = parseFloat(String(raw ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

function latestPriceFromGlobalQuote(gq) {
  if (!gq || typeof gq !== 'object') return NaN;
  return parsePositivePrice(gq['05. price']);
}

function tradingDayFromGlobalQuote(gq) {
  if (!gq || typeof gq !== 'object') return '';
  return String(gq['07. latest trading day'] || '').trim();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Display "YYYY-MM-DD HH:MM" for hero / trust UI */
function formatPriceAsOfDisplay(tradingDay, fetchedAtIso) {
  const ymd = String(tradingDay || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const d = new Date(fetchedAtIso || Date.now());
    return `${formatYmd(d)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  if (ymd === todayYmdUtc()) {
    const d = new Date(fetchedAtIso || Date.now());
    return `${ymd} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  return `${ymd} 16:00`;
}

async function fetchDailyCloseFallback(symbol, apiKey, alphaVantageJson) {
  const sym = String(symbol || '')
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 16);
  if (!sym || !apiKey) return { price: NaN, tradingDay: '', source: '' };
  const daily = await alphaVantageJson({ function: 'TIME_SERIES_DAILY', symbol: sym, outputsize: 'compact' }, apiKey);
  const series = daily['Time Series (Daily)'];
  if (!series || typeof series !== 'object') {
    return { price: NaN, tradingDay: '', source: '' };
  }
  const dates = Object.keys(series).sort().reverse();
  const today = todayYmdUtc();
  for (const d of dates) {
    if (d <= today) {
      const close = parsePositivePrice(series[d]['4. close']);
      if (Number.isFinite(close)) {
        const src = d === today ? 'daily_today' : 'daily_recent';
        return { price: close, tradingDay: d, source: src };
      }
    }
  }
  const latest = dates[0];
  const close = parsePositivePrice(series[latest]?.['4. close']);
  return Number.isFinite(close)
    ? { price: close, tradingDay: latest, source: 'daily_recent' }
    : { price: NaN, tradingDay: '', source: '' };
}

function buildFieldMeta(overview, globalQuote, tradingDay, fetchedAtIso) {
  const session = String(tradingDay || '').trim() || formatYmd(new Date(fetchedAtIso));
  const volDay = tradingDayFromGlobalQuote(globalQuote) || session;
  const fields = {};

  const price = latestPriceFromGlobalQuote(globalQuote);
  if (Number.isFinite(price)) {
    fields.price = { asOf: volDay, source: 'global_quote', label: 'price' };
  }

  if (overview && typeof overview === 'object') {
    const map = [
      ['ma50', '50DayMovingAverage'],
      ['ma200', '200DayMovingAverage'],
      ['high52', '52WeekHigh'],
      ['low52', '52WeekLow'],
      ['volumeAvg', 'Volume'],
    ];
    for (const [key, ovKey] of map) {
      const raw = overview[ovKey];
      if (raw == null || String(raw).trim() === '' || String(raw).trim() === '—') continue;
      fields[key] = { asOf: session, source: 'overview', label: key };
    }
  }

  if (globalQuote && fieldPresent(globalQuote['06. volume'])) {
    fields.volume = { asOf: volDay, source: 'global_quote', label: 'volume' };
  }

  return fields;
}

function fieldPresent(raw) {
  if (raw == null) return false;
  const s = String(raw).trim();
  return Boolean(s && s !== '—' && s !== '-' && s !== 'None' && s !== 'null');
}

function fieldLabel(key, zh) {
  const labels = zh
    ? {
        ma50: '50日均线',
        ma200: '200日均线',
        high52: '52周高',
        low52: '52周低',
        volume: '成交量',
        volumeAvg: '成交量',
        price: '现价',
      }
    : {
        ma50: '50-day MA',
        ma200: '200-day MA',
        high52: '52-week high',
        low52: '52-week low',
        volume: 'Volume',
        volumeAvg: 'Volume',
        price: 'Price',
      };
  return labels[key] || key;
}

function buildFieldFreshnessWarnings(fieldMeta, locale) {
  const zh = String(locale || '').startsWith('zh');
  const out = [];
  for (const meta of Object.values(fieldMeta || {})) {
    if (!meta || !meta.asOf) continue;
    const age = daysSinceYmd(meta.asOf);
    if (age == null || age <= FIELD_STALE_DAYS) continue;
    const label = fieldLabel(meta.label || meta.source, zh);
    out.push(
      zh
        ? `${label} 数据截至 ${meta.asOf}（${age} 天前）`
        : `${label} as of ${meta.asOf} (${age}d old)`,
    );
  }
  return out;
}

function buildPriceStaleNotice(tradingDay, priceAgeDays, locale) {
  const zh = String(locale || '').startsWith('zh');
  const ymd = String(tradingDay || '').trim();
  if (!ymd) return '';
  const today = todayYmdUtc();
  if (ymd >= today) return '';
  if (priceAgeDays != null && priceAgeDays > 0) {
    return zh
      ? `⚠️ 最近可用价格为 ${ymd} 的数据，此后行情可能已变动。`
      : `⚠️ Most recent available price is from ${ymd}. Market may have moved since then.`;
  }
  return '';
}

function currentPricePromptBlock(currentPrice, listingCurrency, locale) {
  const loc = String(locale || 'zh-CN');
  const zh = loc.startsWith('zh');
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return '';
  const cur =
    listingCurrency === 'JPY'
      ? `${Math.round(currentPrice)} 円`
      : listingCurrency === 'USD'
        ? `$${currentPrice.toFixed(2)}`
        : `${currentPrice.toFixed(2)} ${listingCurrency || 'USD'}`;
  if (zh) {
    return `
【现价唯一口径·硬性】当前价为 ${cur}（${SOURCE_LABEL}，分析管线锁定）。
禁止改写、覆盖或另估现价；analystPriceLine、keyLevels、scenarios、technicalSnapshot 中的目标价/止损/技术位均须相对该现价计算。
analystPriceLine 中的「现价」必须与 ${cur} 一致（允许四舍五入到分）。`;
  }
  return `
【Authoritative spot price】Current price is ${cur} (${SOURCE_LABEL}, locked for this run).
Do NOT override or modify this figure. All targets, stops, key levels, and scenario ranges must be relative to this exact price.
The "current" in analystPriceLine must match ${cur} (minor rounding allowed).`;
}

function dataFreshnessPromptBlock(locale) {
  const zh = String(locale || '').startsWith('zh');
  if (zh) {
    return `
【数据时效·硬性】优先使用所提供数据中时间戳最新的一项；同一指标多源时取最近日期。
若最近数据早于 7 天，须在分析中写明日期，禁止把陈旧数据写成「当前/最新」。
示例：不说「当前营收为 X」，应写「截至 YYYY-MM-DD，营收为 X」。`;
  }
  return `
【Data freshness】Always use the most recent timestamped figure provided. If multiple values exist for one metric, pick the newest.
If the newest data is older than 7 days, state the as-of date explicitly—never present stale figures as current.
Example: write "as of YYYY-MM-DD, revenue was X" instead of "current revenue is X".`;
}

/**
 * Resolve immutable current price + metadata (may add one TIME_SERIES_DAILY call).
 * @param {{ symbol: string, apiKey: string, globalQuote?: object|null, overview?: object|null, alphaVantageJson: Function, locale?: string }} input
 */
async function buildAlphaMarketSnapshot(input) {
  const {
    symbol,
    apiKey,
    globalQuote = null,
    overview = null,
    alphaVantageJson,
    locale = 'zh-CN',
  } = input || {};
  const fetchedAtIso = new Date().toISOString();
  const zh = String(locale).startsWith('zh');

  let price = latestPriceFromGlobalQuote(globalQuote);
  let tradingDay = tradingDayFromGlobalQuote(globalQuote);
  let priceSource = Number.isFinite(price) ? 'global_quote' : '';
  let priceAgeDays = tradingDay ? daysSinceYmd(tradingDay) : null;

  const needDaily =
    !Number.isFinite(price) ||
    price <= 0 ||
    (priceAgeDays != null && priceAgeDays > PRICE_MAX_AGE_DAYS);

  if (needDaily && apiKey && typeof alphaVantageJson === 'function') {
    await new Promise((r) => setTimeout(r, 1200));
    const fb = await fetchDailyCloseFallback(symbol, apiKey, alphaVantageJson);
    if (Number.isFinite(fb.price) && fb.price > 0) {
      price = fb.price;
      tradingDay = fb.tradingDay || tradingDay;
      priceSource = fb.source || 'daily_recent';
      priceAgeDays = tradingDay ? daysSinceYmd(tradingDay) : null;
    }
  }

  const warnings = [];
  if (!Number.isFinite(price) || price <= 0) {
    return {
      currentPrice: NaN,
      tradingDay: tradingDay || '',
      priceAsOfDisplay: '',
      priceSource: '',
      priceAgeDays: null,
      priceStaleOver7Days: false,
      priceStaleNotice: '',
      fieldMeta: {},
      fieldFreshnessWarnings: [],
      warnings: [zh ? '未能解析 Alpha Vantage 现价' : 'Could not resolve Alpha Vantage spot price'],
      fetchedAtIso,
      sourceLabel: SOURCE_LABEL,
      promptPriceBlock: '',
      promptFreshnessBlock: dataFreshnessPromptBlock(locale),
    };
  }

  if (priceAgeDays != null && priceAgeDays > PRICE_MAX_AGE_DAYS) {
    warnings.push(
      zh
        ? `⚠️ 现价最近交易日为 ${tradingDay}（${priceAgeDays} 天前），超过 7 天阈值`
        : `⚠️ Spot price session ${tradingDay} is ${priceAgeDays}d old (>7d threshold)`,
    );
  }

  const priceStaleNotice = buildPriceStaleNotice(tradingDay, priceAgeDays, locale);
  const fieldMeta = buildFieldMeta(overview, globalQuote, tradingDay, fetchedAtIso);
  if (!fieldMeta.price) {
    fieldMeta.price = { asOf: tradingDay, source: priceSource || 'resolved', label: 'price' };
  }
  const fieldFreshnessWarnings = buildFieldFreshnessWarnings(fieldMeta, locale);

  const priceAsOfDisplay = formatPriceAsOfDisplay(tradingDay, fetchedAtIso);

  const snapshot = {
    currentPrice: price,
    tradingDay,
    priceAsOfDisplay,
    priceSource,
    priceAgeDays,
    priceStaleOver7Days: priceAgeDays != null && priceAgeDays > PRICE_MAX_AGE_DAYS,
    priceStaleNotice,
    fieldMeta,
    fieldFreshnessWarnings,
    warnings,
    fetchedAtIso,
    sourceLabel: SOURCE_LABEL,
    promptPriceBlock: currentPricePromptBlock(price, input?.listingCurrency || 'USD', locale),
    promptFreshnessBlock: dataFreshnessPromptBlock(locale),
  };

  Object.freeze(snapshot);
  Object.defineProperty(snapshot, 'currentPrice', { writable: false, configurable: false });
  return snapshot;
}

function appendSnapshotLinesToAlphaText(text, snapshot, overview, globalQuote) {
  const lines = [String(text || '').trim()];
  if (!snapshot || !Number.isFinite(snapshot.currentPrice)) return lines.filter(Boolean).join('\n');

  lines.push(
    `- 锁定现价（唯一口径）：${snapshot.currentPrice} | 截至：${snapshot.priceAsOfDisplay}（${snapshot.sourceLabel}）`,
  );
  if (snapshot.priceStaleNotice) lines.push(`- ${snapshot.priceStaleNotice}`);
  if (overview && fieldPresent(overview['50DayMovingAverage'])) {
    lines.push(
      `- 50日均线：${overview['50DayMovingAverage']}（截至 ${snapshot.tradingDay || snapshot.priceAsOfDisplay?.slice(0, 10)}）`,
    );
  }
  if (overview && fieldPresent(overview['200DayMovingAverage'])) {
    lines.push(
      `- 200日均线：${overview['200DayMovingAverage']}（截至 ${snapshot.tradingDay || snapshot.priceAsOfDisplay?.slice(0, 10)}）`,
    );
  }
  if (globalQuote && fieldPresent(globalQuote['06. volume'])) {
    lines.push(`- 成交量：${globalQuote['06. volume']}（截至 ${snapshot.tradingDay || '—'}）`);
  }
  return lines.filter(Boolean).join('\n');
}

module.exports = {
  SOURCE_LABEL,
  PRICE_MAX_AGE_DAYS,
  FIELD_STALE_DAYS,
  latestPriceFromGlobalQuote,
  tradingDayFromGlobalQuote,
  buildAlphaMarketSnapshot,
  currentPricePromptBlock,
  dataFreshnessPromptBlock,
  appendSnapshotLinesToAlphaText,
  formatPriceAsOfDisplay,
};
