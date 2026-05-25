/**
 * Short-TTL cache so repeat analysis of the same ticker returns consistent results.
 */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

function cacheTtlMs() {
  const raw = String(process.env.WENAP_ANALYSIS_CACHE_MS || '').trim();
  if (raw === '0') return 0;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 0) return Math.min(n, 24 * 60 * 60 * 1000);
  return DEFAULT_TTL_MS;
}

/** @type {Map<string, { t: number, payload: object }>} */
const store = new Map();

function cacheKey({ symbol, assetType, horizon, locale, tier }) {
  const sym = String(symbol || '')
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 16);
  return [sym, String(assetType || 'stock'), String(horizon || '3m'), String(locale || 'en'), String(tier || 'free')].join('|');
}

function getCachedAnalysis(key) {
  const ttl = cacheTtlMs();
  if (ttl <= 0 || !key) return null;
  const hit = store.get(key);
  if (!hit || Date.now() - hit.t > ttl) {
    if (hit) store.delete(key);
    return null;
  }
  return { ...hit.payload, cacheAgeMs: Date.now() - hit.t };
}

function setCachedAnalysis(key, payload) {
  const ttl = cacheTtlMs();
  if (ttl <= 0 || !key || !payload) return;
  if (store.size > 400) store.clear();
  store.set(key, { t: Date.now(), payload });
}

module.exports = {
  cacheTtlMs,
  cacheKey,
  getCachedAnalysis,
  setCachedAnalysis,
};
