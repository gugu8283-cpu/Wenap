/**
 * US House stock transaction disclosures (public dataset).
 * Source: House Stock Watcher public export — not EDGAR.
 */
const { getCachedJson, setCachedJson } = require('./cacheClient.cjs');

const DATA_URL =
  'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json';
const TTL_SEC = 3600;

function sanitizeSymbol(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 16);
}

async function loadAllTransactions() {
  const hit = await getCachedJson('congress:all_tx');
  if (hit?.rows) return hit.rows;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
  const res = await fetch(DATA_URL, { signal: ctrl?.signal });
  if (timer) clearTimeout(timer);
  if (!res.ok) throw new Error(`Congress data HTTP ${res.status}`);
  const j = await res.json();
  const rows = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
  await setCachedJson('congress:all_tx', { rows }, TTL_SEC);
  return rows;
}

function rowTicker(row) {
  const t =
    row?.ticker ||
    row?.asset_description ||
    row?.assetDescription ||
    row?.symbol ||
    '';
  return String(t)
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 16);
}

async function fetchCongressTradesForSymbol(symbol, limit = 10) {
  const sym = sanitizeSymbol(symbol);
  if (!sym) return { symbol: sym, trades: [], source: 'House disclosures', configured: false };
  try {
    const rows = await loadAllTransactions();
    const trades = [];
    for (const row of rows) {
      const t = rowTicker(row);
      if (t !== sym && !t.includes(sym)) continue;
      trades.push({
        representative:
          row.representative || row.politician || row.name || row.member_name || '—',
        transactionDate: row.transaction_date || row.transactionDate || row.date || '',
        disclosureDate: row.disclosure_date || row.disclosureDate || '',
        type: row.type || row.transaction_type || row.purchase_or_sale || '',
        amount: row.amount || row.range || row.value || '',
        ticker: t || sym,
      });
      if (trades.length >= limit) break;
    }
    trades.sort((a, b) => String(b.transactionDate).localeCompare(String(a.transactionDate)));
    return {
      symbol: sym,
      trades: trades.slice(0, limit),
      configured: true,
      source: 'US House financial disclosures (public export)',
      sourceUrl: 'https://housestockwatcher.com/',
      disclaimer:
        'Congressional trades are disclosed filings, not recommendations. Data may lag and be incomplete.',
    };
  } catch (e) {
    console.warn('[Congress]', e.message);
    return {
      symbol: sym,
      trades: [],
      configured: false,
      error: e.message,
      source: 'US House financial disclosures',
      sourceUrl: 'https://housestockwatcher.com/',
    };
  }
}

module.exports = {
  fetchCongressTradesForSymbol,
};
