/**
 * Alpha Vantage bundle completeness checks before report generation.
 */

function parsePositiveNumber(raw) {
  const n = parseFloat(String(raw ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fieldPresent(raw) {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s || s === '—' || s === '-' || s === 'None' || s === 'null') return false;
  if (/^0\.?0*$/.test(s.replace(/,/g, ''))) return false;
  return true;
}

/**
 * @param {{ overview?: object|null, globalQuote?: object|null }} bundle
 * @param {{ assetType?: string, ticker?: string, locale?: string }} ctx
 */
function assessAlphaVantageCompleteness(bundle, ctx = {}) {
  const assetType = String(ctx.assetType || 'stock').toLowerCase();
  const ticker = String(ctx.ticker || '').toUpperCase();
  const isEtfLike = assetType === 'etf' || assetType === 'commodity_etf';
  const gq = bundle?.globalQuote && typeof bundle.globalQuote === 'object' ? bundle.globalQuote : null;
  const ov = bundle?.overview && typeof bundle.overview === 'object' ? bundle.overview : null;

  const price = parsePositiveNumber(gq?.['05. price']);
  const volume = fieldPresent(gq?.['06. volume']) ? gq['06. volume'] : null;
  const ma50 = fieldPresent(ov?.['50DayMovingAverage']) ? ov['50DayMovingAverage'] : null;
  const ma200 = fieldPresent(ov?.['200DayMovingAverage']) ? ov['200DayMovingAverage'] : null;
  const high52 = fieldPresent(ov?.['52WeekHigh']) ? ov['52WeekHigh'] : null;
  const low52 = fieldPresent(ov?.['52WeekLow']) ? ov['52WeekLow'] : null;
  const nav = fieldPresent(ov?.NetAssetValue) ? ov.NetAssetValue : null;
  const expense = fieldPresent(ov?.ExpenseRatio) ? ov.ExpenseRatio : null;

  const checks = isEtfLike
    ? {
        currentPrice: price,
        ma50,
        ma200,
        volume,
      }
    : {
        currentPrice: price,
        ma50,
        ma200,
        high52,
        low52,
        volume,
      };

  const missing = [];
  for (const [key, val] of Object.entries(checks)) {
    if (val == null && !fieldPresent(val)) missing.push(key);
  }

  if (!price) {
    return {
      ok: false,
      abort: true,
      code: 'ALPHA_NO_PRICE',
      message: `We couldn't retrieve price data for ${ticker}. Please verify the ticker and try again.`,
      missing,
      optionalEtf: { nav, expense },
    };
  }

  if (missing.length > 2) {
    return {
      ok: false,
      abort: false,
      code: 'ALPHA_DATA_INCOMPLETE',
      message: `Limited public data is available for ${ticker}. The analysis may be incomplete or unreliable. Do you want to proceed anyway?`,
      missing,
      optionalEtf: { nav, expense },
    };
  }

  return {
    ok: true,
    abort: false,
    code: null,
    message: null,
    missing,
    optionalEtf: { nav, expense },
  };
}

const LIMITED_DATA_NOTICE =
  '⚠️ Data coverage for this ticker is limited. Treat this analysis with extra caution.';

module.exports = {
  assessAlphaVantageCompleteness,
  LIMITED_DATA_NOTICE,
};
