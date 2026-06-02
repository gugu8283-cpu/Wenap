/**
 * FRED (Federal Reserve Economic Data) — macro series for Pro macro blocks.
 * https://fred.stlouisfed.org/docs/api/api_key.html
 */
const { getCachedJson, setCachedJson } = require('./cacheClient.cjs');

const FRED_BASE = 'https://api.stlouisfed.org/fred';
const TTL_SEC = 3600;

const MACRO_SERIES = [
  { id: 'FEDFUNDS', labelEn: 'Fed funds rate', labelZh: '联邦基金利率' },
  { id: 'CPIAUCSL', labelEn: 'CPI (all urban)', labelZh: 'CPI 通胀' },
  { id: 'UNRATE', labelEn: 'Unemployment rate', labelZh: '失业率' },
  { id: 'DGS10', labelEn: '10Y Treasury yield', labelZh: '10年期国债收益率' },
  { id: 'GDP', labelEn: 'Real GDP', labelZh: '实际 GDP' },
];

function fredApiKey() {
  return String(process.env.FRED_API_KEY || '').trim();
}

function fredConfigured() {
  return Boolean(fredApiKey());
}

function secUserAgent() {
  return String(process.env.SEC_USER_AGENT || 'Wenap/1.0 (contact@wenap.app)').trim();
}

async function fredJson(path, params = {}) {
  const key = fredApiKey();
  if (!key) throw new Error('FRED_NOT_CONFIGURED');
  const u = new URL(`${FRED_BASE}/${path.replace(/^\//, '')}`);
  u.searchParams.set('api_key', key);
  u.searchParams.set('file_type', 'json');
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`FRED HTTP ${res.status}`);
  const j = await res.json();
  return j;
}

async function fetchSeriesLatest(seriesId, limit = 6) {
  const sid = String(seriesId || '').trim();
  if (!sid) return null;
  const cacheKey = `fred:${sid}:${limit}`;
  const hit = await getCachedJson(cacheKey);
  if (hit) return hit;
  const j = await fredJson('series/observations', {
    series_id: sid,
    sort_order: 'desc',
    limit,
  });
  const obs = Array.isArray(j?.observations) ? j.observations : [];
  const points = obs
    .filter((o) => o.value != null && o.value !== '.' && Number.isFinite(Number(o.value)))
    .map((o) => ({ date: o.date, value: Number(o.value) }))
    .reverse();
  const latest = points.length ? points[points.length - 1] : null;
  const prev = points.length >= 2 ? points[points.length - 2] : null;
  const out = { seriesId: sid, latest, prev, points };
  await setCachedJson(cacheKey, out, TTL_SEC);
  return out;
}

async function fetchMacroSummary(locale = 'en') {
  const zh = String(locale || '').startsWith('zh');
  if (!fredConfigured()) {
    return { configured: false, series: [], source: 'FRED', sourceUrl: 'https://fred.stlouisfed.org/' };
  }
  const defs = MACRO_SERIES;
  const rows = [];
  for (const def of defs) {
    try {
      const s = await fetchSeriesLatest(def.id, 8);
      if (!s?.latest) continue;
      const chg =
        s.prev && Number.isFinite(s.prev.value) && s.prev.value !== 0
          ? ((s.latest.value - s.prev.value) / Math.abs(s.prev.value)) * 100
          : null;
      rows.push({
        id: def.id,
        label: zh ? def.labelZh : def.labelEn,
        date: s.latest.date,
        value: s.latest.value,
        changePct: Number.isFinite(chg) ? chg : null,
      });
    } catch (e) {
      console.warn(`[FRED] ${def.id}:`, e.message);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return {
    configured: true,
    series: rows,
    asOf: rows.length ? rows.map((r) => r.date).sort().pop() : '',
    source: 'FRED',
    sourceUrl: 'https://fred.stlouisfed.org/',
  };
}

function macroPromptBlock(summary, locale = 'en') {
  const zh = String(locale || '').startsWith('zh');
  if (!summary?.configured || !summary.series?.length) return '';
  const lines = [
    zh
      ? '【FRED 宏观数据】分析宏观维时须引用以下数字（勿编造）：'
      : '[FRED macro data] Use these figures for macro dimension (do not invent):',
    `Source: ${summary.source} (${summary.sourceUrl})`,
  ];
  for (const r of summary.series) {
    const chg =
      r.changePct != null
        ? zh
          ? `，环比约 ${r.changePct >= 0 ? '+' : ''}${r.changePct.toFixed(2)}%`
          : `, ~${r.changePct >= 0 ? '+' : ''}${r.changePct.toFixed(2)}% vs prior`
        : '';
    lines.push(
      zh
        ? `- ${r.label}（${r.id}）：${r.value}（截至 ${r.date}）${chg}`
        : `- ${r.label} (${r.id}): ${r.value} (as of ${r.date})${chg}`,
    );
  }
  return lines.join('\n');
}

module.exports = {
  fredConfigured,
  fredApiKey,
  fetchMacroSummary,
  macroPromptBlock,
  secUserAgent,
};
