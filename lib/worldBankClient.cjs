/**
 * World Bank Indicators API — global macro (free; many datasets under CC BY 4.0).
 * Terms summary: https://data.worldbank.org/summary-terms-of-use
 * License info: https://datacatalog.worldbank.org/public-licenses
 *
 * Compliance notes:
 * - Always display attribution to The World Bank and link back to indicator pages.
 * - Some indicators may come from third parties with different terms; we use core WB indicators.
 */
const { getCachedJson, setCachedJson } = require('./cacheClient.cjs');

const WB_BASE = 'https://api.worldbank.org/v2';

// Core, widely available indicators:
// - Inflation, consumer prices (annual %) — FP.CPI.TOTL.ZG
// - Unemployment, total (% of total labor force) — SL.UEM.TOTL.ZS
// - GDP growth (annual %) — NY.GDP.MKTP.KD.ZG
const INDICATORS = [
  {
    id: 'FP.CPI.TOTL.ZG',
    labelEn: 'Inflation (CPI, annual %)',
    labelZh: '通胀（CPI 年率%）',
    page: 'https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG',
  },
  {
    id: 'SL.UEM.TOTL.ZS',
    labelEn: 'Unemployment rate (%)',
    labelZh: '失业率（%）',
    page: 'https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS',
  },
  {
    id: 'NY.GDP.MKTP.KD.ZG',
    labelEn: 'GDP growth (annual %)',
    labelZh: 'GDP 增长（年率%）',
    page: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG',
  },
];

function normalizeCountry(raw) {
  const s = String(raw || '').trim().toUpperCase();
  // ISO3 or WB country code; default USA
  if (/^[A-Z]{3}$/.test(s)) return s;
  if (/^[A-Z]{2}$/.test(s)) return s;
  return 'USA';
}

async function wbFetchJson(url, timeoutMs = 15000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, { signal: ctrl?.signal });
    if (!res.ok) throw new Error(`WorldBank HTTP ${res.status}`);
    return res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Pick the row with the highest year that has a numeric value (WB may return empty future years). */
function pickLatestRowWithValue(rows) {
  const valid = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.value != null && Number.isFinite(Number(r.value)))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return valid[0] || null;
}

function formatMacroValue(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

async function fetchIndicatorLatest({ country = 'USA', indicatorId }) {
  const c = normalizeCountry(country);
  const id = String(indicatorId || '').trim();
  if (!id) return null;

  const cacheKey = `wb:${c}:${id}`;
  const hit = await getCachedJson(cacheKey);
  if (hit) return hit;

  const u = new URL(`${WB_BASE}/country/${encodeURIComponent(c)}/indicator/${encodeURIComponent(id)}`);
  u.searchParams.set('format', 'json');
  u.searchParams.set('per_page', '60');
  const j = await wbFetchJson(u.toString(), 18000);
  // Shape: [meta, [{date,value,...}, ...]]
  const arr = Array.isArray(j) ? j[1] : null;
  const rows = Array.isArray(arr) ? arr : [];
  const latest = pickLatestRowWithValue(rows);
  const out = latest
    ? {
        country: c,
        indicatorId: id,
        year: String(latest.date || ''),
        value: formatMacroValue(latest.value),
        fetchedAt: new Date().toISOString(),
      }
    : { country: c, indicatorId: id, year: '', value: null, fetchedAt: new Date().toISOString() };

  // Annual macro changes slowly; cache longer
  await setCachedJson(cacheKey, out, 6 * 3600);
  return out;
}

async function fetchWorldBankMacroSummary(country = 'USA', locale = 'en') {
  const c = normalizeCountry(country);
  const zh = String(locale || '').startsWith('zh');
  const series = [];
  for (const def of INDICATORS) {
    try {
      const r = await fetchIndicatorLatest({ country: c, indicatorId: def.id });
      if (!r || r.value == null) continue;
      series.push({
        id: def.id,
        label: zh ? def.labelZh : def.labelEn,
        year: r.year,
        value: r.value,
        url: def.page,
      });
    } catch (e) {
      console.warn('[WorldBank]', def.id, e.message);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  const currentYear = new Date().getUTCFullYear();
  const years = series.map((s) => Number.parseInt(String(s.year), 10)).filter((y) => Number.isFinite(y));
  const maxYear = years.length ? Math.max(...years) : null;
  const vintageNote =
    maxYear != null && maxYear < currentYear
      ? zh
        ? `世界银行年度指标：当前日历年为 ${currentYear}，下列为各指标已发布的最新年份（空年份已跳过，非 Wenap 缓存过期）。`
        : `World Bank annual indicators: calendar year ${currentYear}; figures below are the latest published year per series (empty future years skipped — not a Wenap stale cache).`
      : '';

  return {
    configured: true,
    country: c,
    series,
    source: 'World Bank Data',
    sourceUrl: 'https://data.worldbank.org/',
    license: 'CC BY 4.0 (check indicator metadata for exceptions)',
    licenseUrl: 'https://data.worldbank.org/summary-terms-of-use',
    asOfYear: series.map((s) => s.year).filter(Boolean).sort().pop() || '',
    vintageNote,
    fetchedAt: new Date().toISOString(),
    attribution:
      'Source: The World Bank (World Development Indicators). License: CC BY 4.0. No endorsement implied.',
  };
}

function worldBankPromptBlock(summary, locale = 'en') {
  if (!summary?.series?.length) return '';
  const zh = String(locale || '').startsWith('zh');
  const lines = [
    zh
      ? '【全球宏观（World Bank）】以下数据来自世界银行指标（请按数值解释，不得杜撰）：'
      : '[Global macro (World Bank)] Use these figures (do not invent):',
    summary.attribution,
  ];
  for (const r of summary.series) {
    lines.push(
      zh
        ? `- ${r.label}：${r.value}（年份 ${r.year}）${r.url ? ` 来源 ${r.url}` : ''}`
        : `- ${r.label}: ${r.value} (year ${r.year})${r.url ? ` source ${r.url}` : ''}`,
    );
  }
  return lines.join('\n');
}

module.exports = {
  fetchWorldBankMacroSummary,
  worldBankPromptBlock,
  normalizeCountry,
};

