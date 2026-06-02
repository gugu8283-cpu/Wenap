/**
 * SEC EDGAR — CIK lookup, filings, Form 4 insider activity summaries.
 * https://www.sec.gov/os/accessing-edgar-data
 */
const { getCachedJson, setCachedJson } = require('./cacheClient.cjs');
const { secUserAgent } = require('./fredClient.cjs');

const TTL_SEC = 900;
let tickerMapCache = null;
let tickerMapLoadedAt = 0;

function sanitizeSymbol(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 16);
}

function padCik(n) {
  return String(n).replace(/\D/g, '').padStart(10, '0');
}

async function secFetch(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': secUserAgent(),
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`SEC HTTP ${res.status}`);
  return res.json();
}

async function loadTickerMap() {
  if (tickerMapCache && Date.now() - tickerMapLoadedAt < 24 * 3600 * 1000) return tickerMapCache;
  const hit = await getCachedJson('sec:company_tickers');
  if (hit?.map) {
    tickerMapCache = hit.map;
    tickerMapLoadedAt = Date.now();
    return tickerMapCache;
  }
  const j = await secFetch('https://www.sec.gov/files/company_tickers.json');
  const map = {};
  for (const row of Object.values(j || {})) {
    const t = String(row.ticker || '').toUpperCase();
    if (!t) continue;
    map[t] = padCik(row.cik_str || row.cik);
  }
  tickerMapCache = map;
  tickerMapLoadedAt = Date.now();
  await setCachedJson('sec:company_tickers', { map }, 86400);
  return map;
}

async function resolveCik(symbol) {
  const sym = sanitizeSymbol(symbol);
  if (!sym) return null;
  const map = await loadTickerMap();
  return map[sym] || null;
}

async function fetchSubmissions(cik) {
  const id = padCik(cik);
  const cacheKey = `sec:sub:${id}`;
  const hit = await getCachedJson(cacheKey);
  if (hit) return hit;
  const j = await secFetch(`https://data.sec.gov/submissions/CIK${id}.json`);
  await setCachedJson(cacheKey, j, TTL_SEC);
  return j;
}

function recentFilings(submissions, { forms = null, limit = 12 } = {}) {
  const r = submissions?.filings?.recent;
  if (!r || !Array.isArray(r.form)) return [];
  const want = forms ? new Set(forms.map((f) => String(f).toUpperCase())) : null;
  const out = [];
  for (let i = 0; i < r.form.length && out.length < limit; i++) {
    const form = String(r.form[i] || '').toUpperCase();
    if (want && !want.has(form)) continue;
    out.push({
      form,
      filingDate: String(r.filingDate[i] || ''),
      reportDate: String(r.reportDate?.[i] || ''),
      accessionNumber: String(r.accessionNumber[i] || ''),
      primaryDocument: String(r.primaryDocument?.[i] || ''),
      description: String(r.primaryDocDescription?.[i] || form),
    });
  }
  return out;
}

async function fetchInsiderSummary(symbol) {
  const sym = sanitizeSymbol(symbol);
  const cik = await resolveCik(sym);
  if (!cik) {
    return { symbol: sym, configured: true, cik: null, filings: [], source: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/' };
  }
  const sub = await fetchSubmissions(cik);
  const filings = recentFilings(sub, { forms: ['4', '3', '5'], limit: 8 });
  const name = String(sub?.name || '').trim();
  return {
    symbol: sym,
    configured: true,
    cik,
    companyName: name,
    filings,
    source: 'SEC EDGAR (Form 3/4/5)',
    sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=4`,
    disclaimer:
      'Filings list only; not a trade recommendation. Verify on SEC EDGAR before acting.',
  };
}

async function fetchEarningsFilings(symbol) {
  const sym = sanitizeSymbol(symbol);
  const cik = await resolveCik(sym);
  if (!cik) {
    return { symbol: sym, events: [], source: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/' };
  }
  const sub = await fetchSubmissions(cik);
  const q = recentFilings(sub, { forms: ['10-Q', '10-K', '8-K'], limit: 16 });
  const events = q.map((f) => ({
    date: f.filingDate,
    reportDate: f.reportDate,
    form: f.form,
    label: f.description || f.form,
    timezoneNote: 'US Eastern (SEC filing date)',
  }));
  return {
    symbol: sym,
    companyName: String(sub?.name || '').trim(),
    events,
    source: 'SEC EDGAR',
    sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`,
  };
}

module.exports = {
  sanitizeSymbol,
  resolveCik,
  fetchInsiderSummary,
  fetchEarningsFilings,
  recentFilings,
};
