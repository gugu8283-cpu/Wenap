const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const ENV_PATH = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_PATH, override: true });

function readEnvFileTextSync() {
  const buf = fs.readFileSync(ENV_PATH);
  let raw;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    raw = buf.subarray(3).toString('utf8');
  } else if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    raw = buf.subarray(2).toString('utf16le');
  } else {
    raw = buf.toString('utf8');
  }
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return raw;
}

function mergeOpenRouterKeyFromDotenvFile() {
  try {
    const raw = readEnvFileTextSync();
    let best = '';
    for (let line of raw.split(/\r?\n/)) {
      line = line.replace(/^\uFEFF/, '').trim();
      if (!line || line.startsWith('#')) continue;
      const normalized = line.replace(/\uFF1D/g, '=');
      const m = normalized.match(/^(?:export\s+)?OPENROUTER_API_KEY\s*=\s*(.*)$/i);
      if (!m) continue;
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1).trim();
      if (v && v !== '你的key') best = v;
    }
    if (best) process.env.OPENROUTER_API_KEY = best;
    let bestAv = '';
    for (let line of raw.split(/\r?\n/)) {
      line = line.replace(/^\uFEFF/, '').trim();
      if (!line || line.startsWith('#')) continue;
      const normalized = line.replace(/\uFF1D/g, '=');
      const ma = normalized.match(/^(?:export\s+)?ALPHA_VANTAGE_API_KEY\s*=\s*(.*)$/i);
      if (!ma) continue;
      let v = ma[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1).trim();
      if (v) bestAv = v;
    }
    if (bestAv) process.env.ALPHA_VANTAGE_API_KEY = bestAv;
  } catch (e) {
    if (!mergeOpenRouterKeyFromDotenvFile._warned) {
      mergeOpenRouterKeyFromDotenvFile._warned = true;
      console.warn('[Wenap] 读取 .env 失败:', ENV_PATH, e?.code || e?.message || e);
    }
  }
}

mergeOpenRouterKeyFromDotenvFile();

function getAlphaVantageKey() {
  return (process.env.ALPHA_VANTAGE_API_KEY || '').trim().replace(/^["']+|["']+$/g, '').trim();
}

function getOpenRouterKey() {
  const raw = (
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTER_KEY ||
    ''
  )
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim();
  if (!raw || raw === '你的key') return '';
  return raw;
}

/** 限制补全长度，降低偶发超长输出成本；默认对质量影响极小（JSON 远小于上限） */
function openRouterMaxOutputTokensMain() {
  const n = Number.parseInt(String(process.env.OPENROUTER_MAX_OUTPUT_TOKENS_MAIN || '').trim(), 10);
  if (Number.isFinite(n) && n >= 2048 && n <= 128000) return n;
  return 4000;
}

function openRouterMaxOutputTokensLeader() {
  const n = Number.parseInt(String(process.env.OPENROUTER_MAX_OUTPUT_TOKENS_LEADER || '').trim(), 10);
  if (Number.isFinite(n) && n >= 512 && n <= 32000) return n;
  return 1024;
}

/** 政策法规维补刀（仅主模型该维不足时）默认不再二次联网 */
function openRouterLeaderUseWeb() {
  const v = String(process.env.OPENROUTER_LEADER_USE_WEB || '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function openRouterLeaderRetryEnabled() {
  const v = String(process.env.OPENROUTER_LEADER_RETRY || '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** 主模型政策法规维不足时，是否用同档主模型再补一次（默认开启；设 OPENROUTER_POLICY_FALLBACK=0 关闭） */
function openRouterPolicyFallbackEnabled() {
  const v = String(process.env.OPENROUTER_POLICY_FALLBACK ?? '1')
    .trim()
    .toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'no';
}

const app = express();
/** 生产或显式 SERVE_DIST=1：前端走同源 /api/*，并托管 dist/ */
const SPA_MODE = process.env.NODE_ENV === 'production' || process.env.SERVE_DIST === '1';

if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (corsOrigins.length) {
  app.use(cors({ origin: corsOrigins }));
} else {
  app.use(cors());
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '1mb' }));

if (SPA_MODE) {
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) return next();
    const newPath = req.path.replace(/^\/api/, '') || '/';
    const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = newPath + q;
    next();
  });
}

const PORT = Number.parseInt(String(process.env.PORT || '3002'), 10) || 3002;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** 普通用户：联网 + 低成本主模型（可用 OPENROUTER_MAIN_MODEL 覆盖） */
const MODEL_FLASH =
  String(process.env.OPENROUTER_MAIN_MODEL || '').trim() || 'google/gemini-2.5-flash-lite';
/** Pro+ 主分析模型 */
const MODEL_PRO_PLUS = 'anthropic/claude-haiku-4-5';

const MODEL_MAP = {
  free: MODEL_FLASH,
  pro: MODEL_FLASH,
  pro_plus: MODEL_PRO_PLUS,
  proplus: MODEL_PRO_PLUS,
};

/** 商业模式：免费每月次数；Pro / Pro+ 无限次（主模型按 tier） */
const FREE_MONTHLY_ANALYSIS_CAP = 5;
/** 试运行不限次：.env 设 WENAP_FREE_UNLIMITED=1 */
const FREE_ANALYSIS_UNLIMITED =
  process.env.WENAP_FREE_UNLIMITED === '1' || process.env.WENAP_FREE_UNLIMITED === 'true';
const PRICING_USD = { pro: 9.99, pro_plus: 19.99, currency: 'USD' };
const QUOTA_FILE = path.join(__dirname, 'data', 'quotas.json');
const WATCHLIST_FILE = path.join(__dirname, 'data', 'watchlist.json');
const HISTORY_DIR = path.join(__dirname, 'data', 'history');
const HISTORY_INDEX = path.join(HISTORY_DIR, 'index.json');

const store = require('./db/store.cjs');
const authDb = require('./db/auth.cjs');
const adminRouter = require('./routes/admin.cjs');
const authRouter = require('./routes/auth.cjs');
const publicAccuracyRouter = require('./routes/publicAccuracy.cjs');
const { requireAuth } = require('./middleware/requireAuth.cjs');
const { startVerifyCron } = require('./jobs/verifyPredictions.cjs');
const {
  normalizeLocale,
  outputLanguageInstruction,
  horizonLabel: horizonLabelLocale,
  assetLabel: assetLabelLocale,
  expectedDimensionNames,
  policyDimensionName,
  insufficientDataNote,
  defaultDisclaimer,
  dimensionJsonSpec,
  dimensionBoundaryPromptBlock,
  policyRegulationBlock,
  signalDisplayLabel,
} = require('./lib/outputLocale.cjs');
try {
  store.initDb();
  console.log(`[Wenap] SQLite 已初始化：${store.DB_PATH}`);
} catch (e) {
  console.warn('[Wenap] SQLite 初始化失败（预测追踪不可用）:', e.message);
}

if (process.env.SEED_TEST_ACCOUNTS === '1') {
  const { seedTestAccounts } = require('./lib/seedTestAccounts.cjs');
  seedTestAccounts()
    .then((emails) => {
      console.log('[Wenap] 测试账号已就绪（SEED_TEST_ACCOUNTS=1）：', emails.join(', '));
    })
    .catch((e) => {
      console.warn('[Wenap] 测试账号创建失败:', e?.message || e);
    });
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ensureQuotaDir() {
  const dir = path.dirname(QUOTA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readQuotaState() {
  try {
    const raw = fs.readFileSync(QUOTA_FILE, 'utf8');
    const j = JSON.parse(raw);
    if (!j.byUser || typeof j.byUser !== 'object') j.byUser = {};
    let dirty = false;
    for (const k of Object.keys(j.byUser)) {
      const u = j.byUser[k];
      if (!u || typeof u !== 'object') continue;
      if (!u.byMonth || typeof u.byMonth !== 'object') u.byMonth = {};
      if (u.lifetimeAnalyses != null && u.lifetimeAnalyses !== '') {
        const legacy = Number(u.lifetimeAnalyses);
        if (Number.isFinite(legacy) && legacy > 0) {
          const m = currentMonthKey();
          if (u.byMonth[m] == null) {
            u.byMonth[m] = Math.min(legacy, FREE_MONTHLY_ANALYSIS_CAP);
            dirty = true;
          }
        }
        delete u.lifetimeAnalyses;
        dirty = true;
      }
    }
    if (dirty) writeQuotaState(j);
    return j;
  } catch {
    return { version: 1, byUser: {} };
  }
}

function writeQuotaState(state) {
  ensureQuotaDir();
  fs.writeFileSync(QUOTA_FILE, JSON.stringify(state, null, 2), 'utf8');
}

/** 稳定用户键：登录后传 userId；未登录可传 anonId（设备指纹）；否则退回 IP（弱） */
function userQuotaKey(req) {
  const b = req.body || {};
  const uid = typeof b.userId === 'string' && b.userId.trim() ? b.userId.trim().slice(0, 128) : '';
  if (uid) return `uid:${uid}`;
  const anon = typeof b.anonId === 'string' && b.anonId.trim() ? b.anonId.trim().slice(0, 128) : '';
  if (anon) return `anon:${anon}`;
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/** free | pro | pro_plus；兼容旧字段 proPlus:true */
function resolveTier(body) {
  const t = String(body?.tier || '')
    .toLowerCase()
    .trim();
  if (t === 'pro_plus' || t === 'proplus' || body?.proPlus === true) return 'pro_plus';
  if (t === 'pro') return 'pro';
  return 'free';
}

function mainModelForTier(tier) {
  const t = String(tier || 'free').toLowerCase();
  return MODEL_MAP[t] || MODEL_MAP.free;
}

function freeQuotaCheck(userKey) {
  const month = currentMonthKey();
  if (FREE_ANALYSIS_UNLIMITED) {
    return {
      allowed: true,
      used: 0,
      remaining: null,
      skipped: false,
      month,
      unlimited: true,
    };
  }
  if (process.env.WENAP_SKIP_QUOTA === '1' || process.env.WENAP_SKIP_QUOTA === 'true') {
    return {
      allowed: true,
      used: 0,
      remaining: FREE_MONTHLY_ANALYSIS_CAP,
      skipped: true,
      month,
    };
  }
  const state = readQuotaState();
  const row = state.byUser[userKey] || {};
  if (!row.byMonth || typeof row.byMonth !== 'object') row.byMonth = {};
  const used = row.byMonth[month] || 0;
  const remaining = Math.max(0, FREE_MONTHLY_ANALYSIS_CAP - used);
  return { allowed: used < FREE_MONTHLY_ANALYSIS_CAP, used, remaining, skipped: false, month };
}

function incrementFreeMonthlyUsage(userKey) {
  if (FREE_ANALYSIS_UNLIMITED) return;
  if (process.env.WENAP_SKIP_QUOTA === '1' || process.env.WENAP_SKIP_QUOTA === 'true') return;
  const state = readQuotaState();
  const month = currentMonthKey();
  if (!state.byUser[userKey]) state.byUser[userKey] = { byMonth: {} };
  if (!state.byUser[userKey].byMonth || typeof state.byUser[userKey].byMonth !== 'object') {
    state.byUser[userKey].byMonth = {};
  }
  state.byUser[userKey].byMonth[month] = (state.byUser[userKey].byMonth[month] || 0) + 1;
  state.byUser[userKey].lastAt = new Date().toISOString();
  writeQuotaState(state);
}

function readWatchlist() {
  try {
    const j = JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
    if (!j.byUser || typeof j.byUser !== 'object') j.byUser = {};
    return j;
  } catch {
    return { version: 1, byUser: {} };
  }
}

function writeWatchlist(s) {
  ensureQuotaDir();
  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(s, null, 2), 'utf8');
}

function watchlistCap(tier) {
  if (tier === 'pro_plus') return 100;
  if (tier === 'pro') return 20;
  return 3;
}

function userKeyFromQuery(req) {
  const q = req.query || {};
  const uid = String(q.userId || '')
    .trim()
    .slice(0, 128);
  if (uid) return `uid:${uid}`;
  const anon = String(q.anonId || '')
    .trim()
    .slice(0, 128);
  if (anon) return `anon:${anon}`;
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

const ASSET_IDS = new Set(['stock', 'etf', 'reit', 'commodity_etf']);
const HORIZON_IDS = new Set(['1m', '3m', '6m', '1y', '2y']);

function normalizeWatchAssetType(a) {
  const s = String(a || '').trim();
  return ASSET_IDS.has(s) ? s : 'stock';
}

function normalizeWatchHorizon(h) {
  const s = String(h || '').trim();
  return HORIZON_IDS.has(s) ? s : '3m';
}

function ensureHistoryDir() {
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

function userKeyHash(k) {
  return crypto.createHash('sha1').update(k).digest('hex').slice(0, 16);
}

function readHistoryIndex() {
  try {
    const j = JSON.parse(fs.readFileSync(HISTORY_INDEX, 'utf8'));
    if (!j.byUser || typeof j.byUser !== 'object') j.byUser = {};
    return j;
  } catch {
    return { version: 1, byUser: {} };
  }
}

function writeHistoryIndex(s) {
  ensureHistoryDir();
  fs.writeFileSync(HISTORY_INDEX, JSON.stringify(s, null, 2), 'utf8');
}

function appendHistory(userKey, record) {
  ensureHistoryDir();
  const dir = path.join(HISTORY_DIR, userKeyHash(userKey));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${record.id}.json`), JSON.stringify(record, null, 2), 'utf8');
  const idx = readHistoryIndex();
  if (!idx.byUser[userKey]) idx.byUser[userKey] = [];
  idx.byUser[userKey].unshift({
    id: record.id,
    ts: record.ts,
    symbol: record.symbol,
    assetType: record.assetType,
    horizon: record.horizon,
    score: record.score,
    signal: record.signal,
    risk: record.risk,
    summary: record.summary,
  });
  idx.byUser[userKey] = idx.byUser[userKey].slice(0, 200);
  writeHistoryIndex(idx);
}

function writeSse(res, payload) {
  if (res.writableEnded || res.writableFinished) return false;
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
    return true;
  } catch (e) {
    console.warn('[Wenap] SSE write failed:', e.message);
    return false;
  }
}

/** 勿用 req.aborted：Express/代理在 body 读完后常误报，导致分析被提前中止 */
function sseClientGone(res) {
  if (res.writableEnded || res.writableFinished || res.destroyed) return true;
  const sock = res.socket;
  return Boolean(sock && sock.destroyed);
}

const SSE_KEEPALIVE_MS = 12_000;

function startSseKeepalive(res) {
  const timer = setInterval(() => {
    if (sseClientGone(res)) {
      clearInterval(timer);
      return;
    }
    writeSse(res, { type: 'keepalive', t: Date.now() });
  }, SSE_KEEPALIVE_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return () => clearInterval(timer);
}

function horizonLabel(horizon, locale = 'zh-CN') {
  return horizonLabelLocale(horizon, locale);
}

function assetLabel(assetType, locale = 'zh-CN') {
  return assetLabelLocale(assetType, locale);
}

const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';

async function alphaVantageJson(params, apiKey) {
  const u = new URL(ALPHA_VANTAGE_URL);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, String(v));
  }
  u.searchParams.set('apikey', apiKey);
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  return res.json();
}

function alphaVantageMetaError(data) {
  if (!data || typeof data !== 'object') return '无效响应';
  const n = data.Note ? String(data.Note) : '';
  const inf = data.Information ? String(data.Information) : '';
  if (/frequency|call per minute|limit/i.test(n)) return n;
  if (/frequency|call per minute|limit/i.test(inf)) return inf;
  if (data['Error Message']) return String(data['Error Message']);
  return null;
}

/** 同一标的短 TTL 复用 GLOBAL_QUOTE+OVERVIEW，减 AV 调用与 1.2s 间隔（分钟级行情足够） */
const alphaVantageBundleCache = new Map();

function alphaVantageCacheTtlMs() {
  const raw = String(process.env.ALPHA_VANTAGE_CACHE_MS || '').trim();
  if (raw === '0') return 0;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 0) return Math.min(Math.max(n, 0), 3_600_000);
  return 600_000;
}

function cacheAlphaVantageBundle(sym, bundle) {
  const ttl = alphaVantageCacheTtlMs();
  if (ttl <= 0) return;
  if (!sym || !bundle || typeof bundle !== 'object') return;
  if (alphaVantageBundleCache.size > 600) alphaVantageBundleCache.clear();
  alphaVantageBundleCache.set(sym, { t: Date.now(), bundle });
}

/** GLOBAL_QUOTE + OVERVIEW；两次请求间隔约 1.2s 以降低触发免费档频控 */
async function fetchAlphaVantageContextBundle(symbol, apiKey) {
  const sym = String(symbol || '').toUpperCase().replace(/[^A-Z0-9.-]/g, '').slice(0, 16);
  if (!sym) return { text: '', overview: null, globalQuote: null };
  const ttl = alphaVantageCacheTtlMs();
  if (ttl > 0) {
    const hit = alphaVantageBundleCache.get(sym);
    if (hit && Date.now() - hit.t < ttl && hit.bundle) return hit.bundle;
  }
  const quote = await alphaVantageJson({ function: 'GLOBAL_QUOTE', symbol: sym }, apiKey);
  const e1 = alphaVantageMetaError(quote);
  if (e1) return { text: `【Alpha Vantage】${e1}`, overview: null, globalQuote: null };
  await new Promise((r) => setTimeout(r, 1200));
  const overview = await alphaVantageJson({ function: 'OVERVIEW', symbol: sym }, apiKey);
  const e2 = alphaVantageMetaError(overview);
  const lines = [
    '【Alpha Vantage 已拉取】与联网交叉核对；价格与财务字段以本段为准写入 dataAsOf/technicalSnapshot 等。',
    '来源：https://www.alphavantage.co/',
  ];
  const gq = quote['Global Quote'];
  if (gq && typeof gq === 'object') {
    lines.push(
      `- 最新价：${gq['05. price'] ?? '—'} | 最近交易日：${gq['07. latest trading day'] ?? '—'}`,
    );
    lines.push(
      `- 前收：${gq['08. previous close'] ?? '—'} | 涨跌：${gq['09. change'] ?? '—'}（${gq['10. change percent'] ?? '—'}）`,
    );
    lines.push(`- 成交量：${gq['06. volume'] ?? '—'}`);
  }
  if (!e2 && overview && overview.Symbol) {
    lines.push(`- 名称：${overview.Name ?? '—'} | 交易所：${overview.Exchange ?? '—'}`);
    lines.push(`- 行业：${overview.Sector ?? '—'} / ${overview.Industry ?? '—'}`);
    if (overview['52WeekHigh'])
      lines.push(`- 52周高：${overview['52WeekHigh']} | 52周低：${overview['52WeekLow'] ?? '—'}`);
    if (overview['50DayMovingAverage'])
      lines.push(
        `- 50日均线：${overview['50DayMovingAverage']} | 200日均线：${overview['200DayMovingAverage'] ?? '—'}`,
      );
    if (overview.PERatio) lines.push(`- P/E：${overview.PERatio} | Forward P/E：${overview.ForwardPE ?? '—'}`);
    if (overview.EVToEBITDA || overview.EBITDA) {
      lines.push(
        `- EV/EBITDA：${overview.EVToEBITDA ?? '—'} | EBITDA：${overview.EBITDA ?? '—'}`,
      );
    }
    if (overview.MarketCapitalization)
      lines.push(`- 市值：${overview.MarketCapitalization}`);
    if (overview.AnalystTargetPrice)
      lines.push(`- 分析师目标价（第三方汇总）：${overview.AnalystTargetPrice}`);
  } else if (e2) {
    lines.push(`- OVERVIEW 不可用：${e2}`);
  }
  const bundle = {
    text: lines.join('\n'),
    overview: !e2 && overview && overview.Symbol ? overview : null,
    globalQuote: gq && typeof gq === 'object' ? gq : null,
  };
  if (!e1) cacheAlphaVantageBundle(sym, bundle);
  return bundle;
}

/** 从 Alpha GLOBAL_QUOTE 取最新价（数字）；失败返回 NaN */
function latestPriceFromGlobalQuote(gq) {
  if (!gq || typeof gq !== 'object') return NaN;
  const raw = gq['05. price'];
  const n = parseFloat(String(raw ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

/**
 * 仅当 Alpha OVERVIEW 的 API 字段**明确**为 ETF/ETN 时纠偏；识别失败一律按普通股。
 * 不依据 Industry/Sector 关键词（易误伤 PKG 等个股）。
 */
function overviewSuggestsEtfLike(overview) {
  if (!overview || typeof overview !== 'object') return false;
  const atRaw = String(overview.AssetType || overview['Asset Type'] || '').trim();
  const atU = atRaw.toUpperCase();
  if (/\bETF\b|\bETN\b/.test(atU)) return true;
  if (/EXCHANGE\s*TRADED\s*FUND|EXCHANGE-TRADED\s*FUND|ETF\/ETN/i.test(atRaw)) return true;
  const nameU = String(overview.Name || '').toUpperCase();
  if (/\bETF\b/.test(nameU) || /\bETN\b/.test(nameU)) return true;
  return false;
}

/** Alpha OVERVIEW 的 Currency / Exchange；无则根据代码后缀或数字代码猜测 */
function inferListingCurrency(overview, fallbackSymbol) {
  if (overview && typeof overview === 'object') {
    const cur = String(overview.Currency || '').trim().toUpperCase();
    if (cur && /^[A-Z]{3}$/.test(cur)) return cur;
    const ex = String(overview.Exchange || '').toUpperCase();
    if (/TOKYO|TSE|TYO|JPX|OSAKA|NAGOYA/.test(ex)) return 'JPY';
    if (/HKEX|HKG/.test(ex)) return 'HKD';
    if (/SHANGHAI|SHENZHEN|SSE|SZSE/.test(ex)) return 'CNY';
    const sym = String(overview.Symbol || '').toUpperCase();
    if (/\.T$|\.TOKYO|TYO:|JPX:/i.test(sym)) return 'JPY';
  }
  const fs = String(fallbackSymbol || '').toUpperCase().trim();
  if (/\.T$|\.TOKYO|TYO:|JPX:/i.test(fs)) return 'JPY';
  if (/\.HK$|\.HKEX/i.test(fs)) return 'HKD';
  if (/\.SS$|\.SZ$/i.test(fs)) return 'CNY';
  return 'USD';
}

function scenarioCurrencyPromptBlock(listingCurrency, exchangeHint) {
  const ex = String(exchangeHint || '').trim();
  const exLine = ex ? `\n交易所字段（仅供参考）：${ex}` : '';
  if (listingCurrency === 'JPY') {
    return `【报价货币·硬规则】标的为**日元计价**（JPY）。${exLine}
- scenarios.bull/base/bear 的 range **必须**用日元，如「4800–5200 円」或「¥4800–¥5200」；**禁止**用「$」表示日元股价。
- 若已宣布股票分割，区间数字须与**分割后单价口径**或公司披露一致，并在 trigger/outlook 中点明口径。
- analystPriceLine、actionLine 中的价位须用円（或 ¥），勿写 $。`;
  }
  if (listingCurrency === 'HKD') {
    return `【报价货币】港元（HKD）。${exLine} range 用「HK$xx–yy」或「xx–yy 港元」；勿用裸「$」与美元混淆。`;
  }
  if (listingCurrency === 'CNY') {
    return `【报价货币】人民币（CNY）。${exLine} range 用「xx–yy 元」或「¥xx–yy」；勿写成美元 $。`;
  }
  if (listingCurrency === 'USD') {
    return `【报价货币】美元（USD）。${exLine} range 可用「$低–$高」；须与行情货币一致。`;
  }
  return `【报价货币】行情货币为 **${listingCurrency}**。${exLine} range、analystPriceLine 须与该货币一致，**禁止**把非美元标的写成「$…」。`;
}

function formatListingPrice(n, currency) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  if (currency === 'JPY') return `${Math.round(x)} 円`;
  if (currency === 'KRW') return `${Math.round(x)} 韩元`;
  if (currency === 'HKD') return `HK$${x.toFixed(2)}`;
  if (currency === 'USD') return `$${x.toFixed(2)}`;
  if (currency === 'CNY') return `¥${x.toFixed(2)}`;
  return `${x.toFixed(2)} ${currency}`;
}

function formatListingDelta(gap, currency) {
  const g = Math.abs(Number(gap));
  if (!Number.isFinite(g)) return '';
  if (currency === 'JPY' || currency === 'KRW') {
    return currency === 'JPY' ? `${Math.round(g)} 円` : `${Math.round(g)} 韩元`;
  }
  const gStr = g >= 10 ? g.toFixed(0) : g.toFixed(2);
  if (currency === 'USD') return `$${gStr}`;
  if (currency === 'HKD') return `HK$${gStr}`;
  if (currency === 'CNY') return `${gStr} 元`;
  return `${gStr} ${currency}`;
}

/**
 * 模型误把日元区间写成 $4800（东证常见）；仅在行情侧为 JPY 时按数字重写为「円」。
 */
function repairMisattributedUsdScenarioRanges(data, listingCurrency) {
  if (listingCurrency !== 'JPY' || !data?.scenarios || typeof data.scenarios !== 'object') return;
  for (const k of ['bull', 'base', 'bear']) {
    const z = data.scenarios[k];
    if (!z || typeof z !== 'object') continue;
    let r = String(z.range || '').trim();
    if (!r || !/\$/.test(r)) continue;
    const nums = r.match(/\d[\d,]*(?:\.\d+)?/g);
    if (!nums || nums.length < 2) continue;
    const a = parseFloat(nums[0].replace(/,/g, ''));
    const b = parseFloat(nums[1].replace(/,/g, ''));
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (lo < 50 || hi > 2_000_000) continue;
    z.range = `${Math.round(lo)}–${Math.round(hi)} 円`;
  }
}

function stockComplianceSnippet(ticker, asOf) {
  return `【个股】有来源才写：拆股/上市规则/近90天重大事件；无则省略。${ticker} · ${asOf}。禁编造文号。`;
}


function horizonWeightHint(horizon) {
  if (horizon === '1m' || horizon === '3m') {
    return '期限较短：新闻情绪、市场情绪、与政策/监管者相关的权重应更高。';
  }
  if (horizon === '6m' || horizon === '1y' || horizon === '2y') {
    return '期限较长：宏观经济与行业趋势权重应更高。';
  }
  return '';
}

function tierPromptExtensions(tier) {
  const t = String(tier || 'free').toLowerCase();
  let ext = '';
  if (t === 'pro' || t === 'pro_plus') {
    ext += `

【Pro 附加字段】请额外输出（无材料则空串/空数组/空对象）：
  "actionLine": { "suggestion": "≤24字", "stopLoss": "≤16字", "catalyst": "≤20字" }
  "keyEvents": [ { "date": "YYYY-MM-DD或待公告", "event": "≤28字" } ]（完整列表，0–6 条）
  "leaderInsiderSummary": "≤40字内部人概况"
  "peerVsSectorLine": "单行：跑赢/跑输+行业对照"`;
  }
  if (t === 'pro_plus') {
    ext += `

【Pro+ 附加字段】在 Pro 字段之外再输出：
  "bullBearDebate": {
    "bull": [ { "reason": "≤36字", "weight": "如60%" }, ...共3条 ],
    "bear": [ { "reason": "≤36字", "weight": "如40%" }, ...共3条 ]
  }
  scenarios 每项（bull/base/bear）追加 "triggerPrice": 数字或 null、"timeWindow": "如2026 Q3"
  supplyChain 每项追加 "analysis": "与主标的联动逻辑≤50字"
  "comparison": null`;
  }
  return ext;
}

function buildMainJsonPrompt({
  ticker,
  assetType,
  horizon,
  alphaContextBlock,
  listingCurrency,
  exchangeHint,
  tier = 'free',
  locale = 'zh-CN',
}) {
  const loc = normalizeLocale(locale);
  const h = horizonLabel(horizon, loc);
  const a = assetLabel(assetType, loc);
  const asOf = new Date().toLocaleDateString(loc.startsWith('zh') ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const stockSnip = assetType === 'stock' ? stockComplianceSnippet(ticker, asOf) : '';
  const policyDimBlock = assetType === 'stock' ? policyRegulationBlock(loc) : '';
  const hw = horizonWeightHint(horizon);
  const av = alphaContextBlock ? `${alphaContextBlock}\n\n` : '';
  const curBlock = scenarioCurrencyPromptBlock(listingCurrency || 'USD', exchangeHint || '');

  const langBlock = outputLanguageInstruction(loc);

  return `${langBlock}
你是专业股票分析师。须联网核验。**极简：只写重点**——数字、事件、判断；删形容词、背景铺垫、同义重复。无材料则字段留空，禁止「未检索到/暂无/待核验」。

标的 ${ticker} · ${a} · ${h} · ${asOf}
${hw}
${curBlock}

${av}${stockSnip}

${dimensionBoundaryPromptBlock(loc)}

【实体】identityCheck≤28字：全称+上市地/代码是否与 ${ticker} 一致。

【书写】禁 URL；角标仅 [SEC][交易所][IR][新闻][披露][行情][研报]。**同一事实只出现一次**（summary/六维/detail/outlook 互斥，勿复述）。无数据填空串。

${policyDimBlock}
只输出一个合法 JSON（禁止 Markdown 围栏与 JSON 外字符）。

JSON 字段与要求：
{
  "identityCheck": "≤28字",
  "dataAsOf": "YYYY-MM-DD",
  "score": 0-100,
  "signal": "BUY" | "HOLD" | "SELL",
  "risk": "高" | "中" | "低",
  "riskReward": "如 1:2.5；无法估计留空",
  "summary": "≤28字，一句结论",
  "analystPriceLine": "单行：目标价/现价/空间%；无则空",
  "dimensions": [ ${dimensionJsonSpec(assetType, loc)} ],
  "detailAnalysis": "**260–360字**；仅写六维/summary 未覆盖的硬事实+1条反方；每句句号收束；禁复述六维",
  "sources": [ 最多 **5** 条 JSON 数组；每项 { "text": "≤40字", "url": "真实 http(s)", "time": "", "credibility": "高|中|低", "cite": "短角标" }；禁止 markdown 表格 ],
  "supplyChain": [
    { "ticker": "TSM", "name": "台积电", "exchange": "NYSE", "relation": "AI芯片代工制造，NVDA最大晶圆代工商", "score": 0-100 }
  ],
  "scenarios": {
    "bull": { "p": 0-100, "range": "区间+正确货币", "trigger": "≤36字" },
    "base": { "p": 0-100, "range": "…", "trigger": "≤36字" },
    "bear": { "p": 0-100, "range": "…", "trigger": "≤36字" }
  },
  "valuationBridge": "≤36字或空",
  "technicalSnapshot": "≤56字或空",
  "outlook": "≤120字；与期限 ${h} 一致",
  "disclaimer": "${defaultDisclaimer(loc).replace(/"/g, '\\"')}"
}

硬性：supplyChain≥2，每项 **ticker 必填**。sources 必须 JSON 数组，禁 markdown 表格。scenarios p 之和=100。valuationBridge/假设类字段≤50字。

【supplyChain·relation】每项 relation 必须描述该标的与被分析股票的具体上下游关系，10–20字，实质性内容。示例：TSM「AI芯片代工制造，NVDA最大晶圆代工商」；ASML「光刻机独家供应商，芯片制造核心设备」；AMD「GPU市场直接竞争对手」；MSFT「最大AI芯片采购客户之一」；QCOM「移动芯片竞争对手，AI端侧布局」；ASE「AI芯片封装与测试服务商」。严禁占位：「待结合年报与供应链披露补充」「同业或上下游代表」「暂无」「更新中」及任何含「待」「补充」「暂无」的敷衍句。

【目标价与情景一致性】analystPriceLine 中的目标价须落在 scenarios.bull 价格区间内（targetPrice ≥ bull区间下限且 ≤ bull区间上限）。若判断目标价超出原牛势区间，应调整 bull.range 以包含目标价，勿让目标价与牛势区间矛盾。逻辑：熊势区间 < 基准区间 < 当前价附近 < 牛势区间，且牛势区间应覆盖目标价。三个情景区间不得重叠，相邻区间空隙不得超过整轴宽度的 20%。

【输出完整性】所有字段须完整句子，不得以逗号或不完整语句结尾。${tierPromptExtensions(tier)}`;
}

async function openRouterChat(apiKey, { model, userContent, stream, useWeb, maxOutputTokens }) {
  const body = {
    model,
    messages: [{ role: 'user', content: userContent }],
    stream: Boolean(stream),
  };
  if (useWeb) body.plugins = [{ id: 'web' }];
  const cap =
    maxOutputTokens != null && Number.isFinite(maxOutputTokens) && maxOutputTokens >= 256
      ? Math.floor(maxOutputTokens)
      : null;
  if (cap) body.max_tokens = cap;
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Wenap',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 800)}`);
  }
  if (stream) return res;
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  const usage = data.usage && typeof data.usage === 'object' ? data.usage : null;
  return { content, usage };
}

function extractJsonObject(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('响应中无 JSON 对象');
  return JSON.parse(t.slice(start, end + 1));
}

const DETAIL_MARKDOWN_MAX_CHARS = 380;

function priceVsScenarioNote(priceNum, rangeStr, listingCurrency = 'USD') {
  const s = String(rangeStr || '').trim();
  const nums = s.match(/\d[\d,]*(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return '';
  const a = parseFloat(nums[0].replace(/,/g, ''));
  const b = parseFloat(nums[1].replace(/,/g, ''));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const curLabel = formatListingPrice(priceNum, listingCurrency);
  if (priceNum < lo) {
    const gap = lo - priceNum;
    const dStr = formatListingDelta(gap, listingCurrency);
    const tiny =
      listingCurrency === 'JPY' || listingCurrency === 'KRW'
        ? gap <= 0.5 || gap / Math.max(lo, 1e-6) < 0.002
        : gap <= 0.02 || gap / Math.max(lo, 1e-6) < 0.003;
    if (tiny) return `← 当前价${curLabel}，接近本区间下沿（低约 ${dStr}）`;
    return `← 当前价${curLabel}，低于本区间下沿约 ${dStr}`;
  }
  if (priceNum > hi) {
    const gap = priceNum - hi;
    const dStr = formatListingDelta(gap, listingCurrency);
    const tiny =
      listingCurrency === 'JPY' || listingCurrency === 'KRW'
        ? gap <= 0.5 || gap / Math.max(hi, 1e-6) < 0.002
        : gap <= 0.02 || gap / Math.max(hi, 1e-6) < 0.003;
    if (tiny) return `← 当前价${curLabel}，接近本区间上沿（高约 ${dStr}）`;
    return `← 当前价${curLabel}，高于本区间上沿约 ${dStr}`;
  }
  return `← 当前价${curLabel}，位于本区间内`;
}

function computeScenarioPriceNotes(priceNum, scenarios, listingCurrency = 'USD') {
  const out = { bull: '', base: '', bear: '' };
  if (!Number.isFinite(priceNum) || priceNum <= 0 || !scenarios || typeof scenarios !== 'object') return out;
  for (const k of ['bull', 'base', 'bear']) {
    const r = scenarios[k]?.range;
    out[k] = priceVsScenarioNote(priceNum, String(r || ''), listingCurrency);
  }
  return out;
}

function normalizeActionLineField(data) {
  if (!data || typeof data !== 'object') return;
  const al = data.actionLine;
  if (al && typeof al === 'object') {
    const suggestion = String(al.suggestion || '').trim();
    const stopLoss = String(al.stopLoss || '').trim();
    const catalyst = String(al.catalyst || '').trim();
    data.actionLineObj = { suggestion, stopLoss, catalyst };
    data.actionLine = [suggestion, stopLoss, catalyst].filter(Boolean).join('；');
    return;
  }
  const line = String(al || '').trim();
  data.actionLine = line;
  const mStop = /止损[：:]?\s*([^；]+)/.exec(line);
  const mCat = /催化剂[：:]?\s*([^；]+)/.exec(line);
  data.actionLineObj = {
    suggestion: line.split(/[；;]/)[0]?.replace(/^建议[：:]?\s*/, '').trim() || line.slice(0, 48),
    stopLoss: mStop ? mStop[1].trim() : '',
    catalyst: mCat ? mCat[1].trim() : '',
  };
}

function normalizeKeyEventsField(data) {
  if (!data || typeof data !== 'object') return;
  let ke = data.keyEvents;
  if (!Array.isArray(ke) || !ke.length) {
    const ct = Array.isArray(data.catalystTimeline) ? data.catalystTimeline : [];
    ke = ct.map((x) => ({
      date: String(x.eta || x.date || '').trim(),
      event: String(x.event || x.label || x.detail || '').trim(),
    }));
  }
  data.keyEvents = ke
    .filter((x) => x && typeof x === 'object')
    .slice(0, 6)
    .map((x) => ({
      date: String(x.date || x.eta || '').trim().slice(0, 36),
      event: String(x.event || x.label || '').trim().slice(0, 48),
    }))
    .filter((x) => x.date || x.event);
  data.catalystTimeline = data.keyEvents.map((x) => ({
    label: x.event.slice(0, 12),
    eta: x.date,
    detail: x.event,
  }));
}

function normalizeBullBearDebateField(data) {
  if (!data || typeof data !== 'object') return;
  const bb = data.bullBearDebate;
  if (!bb || typeof bb !== 'object') {
    data.bullBearDebate = { bull: [], bear: [] };
    return;
  }
  const normSide = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .slice(0, 3)
      .map((x) => {
        if (typeof x === 'string') return { reason: x.trim().slice(0, 72), weight: '' };
        return {
          reason: String(x?.reason || x?.text || '').trim().slice(0, 72),
          weight: String(x?.weight || x?.p || '').trim().slice(0, 12),
        };
      })
      .filter((x) => x.reason);
  data.bullBearDebate = { bull: normSide(bb.bull), bear: normSide(bb.bear) };
}

function normalizeScenarioProPlusFields(data) {
  if (!data || typeof data !== 'object' || !data.scenarios || typeof data.scenarios !== 'object') return;
  for (const k of ['bull', 'base', 'bear']) {
    const z = data.scenarios[k];
    if (!z || typeof z !== 'object') continue;
    const tp = Number(z.triggerPrice);
    z.triggerPrice = Number.isFinite(tp) && tp > 0 ? tp : null;
    z.timeWindow = String(z.timeWindow || '').trim().slice(0, 24);
  }
}

function normalizeSupplyChainProPlusFields(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.supplyChain)) return;
  data.supplyChain = data.supplyChain.map((c) => {
    if (!c || typeof c !== 'object') return c;
    const analysis = String(c.analysis || '').trim().slice(0, 80);
    const relation = String(c.relation || c.reason || '').trim().slice(0, 72);
    return { ...c, relation, analysis: analysis || relation };
  });
}

function normalizeReportExtensions(data, alphaOverview, latestPrice, listingCurrency = 'USD') {
  if (!data || typeof data !== 'object') return;
  normalizeActionLineField(data);
  normalizeKeyEventsField(data);
  normalizeBullBearDebateField(data);
  normalizeScenarioProPlusFields(data);
  normalizeSupplyChainProPlusFields(data);
  data.leaderInsiderSummary = String(data.leaderInsiderSummary || '').trim();
  data.peerVsSectorLine = String(data.peerVsSectorLine || '').trim();
  let apl = String(data.analystPriceLine || '').trim();
  if (!apl && alphaOverview) {
    const tpNum = parseFloat(String(alphaOverview.AnalystTargetPrice || '').replace(/[^\d.-]/g, ''));
    if (Number.isFinite(tpNum) && tpNum > 0 && Number.isFinite(latestPrice) && latestPrice > 0) {
      const pct = ((tpNum - latestPrice) / latestPrice) * 100;
      const sg = pct >= 0 ? '+' : '';
      const tpS = formatListingPrice(tpNum, listingCurrency);
      const curS = formatListingPrice(latestPrice, listingCurrency);
      apl = `分析师平均目标价 ${tpS} | 当前价 ${curS} | 空间 ${sg}${pct.toFixed(1)}%`;
    }
  }
  data.analystPriceLine = apl;
  data.scenarioPriceNotes = computeScenarioPriceNotes(latestPrice, data.scenarios, listingCurrency);
}

function mergePeerLineIntoDimensions(dimensions, peerLine) {
  const line = String(peerLine || '').trim();
  if (!line || !Array.isArray(dimensions)) return;
  const idx = dimensions.findIndex((d) => /市场情/.test(String(d?.name || '')));
  if (idx < 0) return;
  const note = String(dimensions[idx].note || '').trim();
  const short = clipToCompleteThought(line, 52, 0.25) || line;
  if (note.includes(short.slice(0, 8))) return;
  dimensions[idx].note = `${note} ${short}`.trim();
}

function markdownCatalystBlock(data) {
  const arr = Array.isArray(data.catalystTimeline) ? data.catalystTimeline : [];
  if (!arr.length) return '';
  let s = '\n**关键时间节点**\n\n';
  for (const x of arr) {
    const d = x.detail ? ` — ${x.detail}` : '';
    s += `- **${x.label || '—'}** ${x.eta || '待定'}${d}\n`;
  }
  return s;
}

/** 免费版正文不写明细，避免与顶部会员卡片「又藏又露」打架 */
function markdownCatalystForTier(data, tier) {
  const ke = Array.isArray(data.keyEvents) ? data.keyEvents : [];
  const arr = ke.length ? ke : Array.isArray(data.catalystTimeline) ? data.catalystTimeline : [];
  if (!arr.length) return '';
  if (tier === 'free') {
    return `\n**关键时间节点**\n\n已整理 **${arr.length}** 条节点（财报窗口、产品节奏等）。完整列表请升级 **Pro** 查看。\n`;
  }
  if (ke.length) {
    let s = '\n**关键时间节点**\n\n';
    ke.forEach((x, i) => {
      s += `${i + 1}. **${x.date || '待公告'}** — ${x.event || '—'}\n`;
    });
    return s;
  }
  return markdownCatalystBlock(data);
}

function buildDetailBodyForMarkdown(data) {
  let det = trimSuspensionSuffix(scrubNotFoundMetaPhrases(stripHttpUrls(String(data.detailAnalysis || ''))));
  if (!det) return '—';
  if ([...det].length <= DETAIL_MARKDOWN_MAX_CHARS) return det;
  return clipToCompleteThought(det, DETAIL_MARKDOWN_MAX_CHARS, 0.32);
}

function researchFooterLine(sourceCount) {
  const n = Math.max(0, Number(sourceCount) || 0);
  const hours = Math.min(6, Math.max(1, Math.round(n / 2)));
  return `本分析整合了 ${n} 个公开来源，约可节省 ${hours} 小时人工梳理（估算）。`;
}

function extractPolicyRegulationDimension(dimensions) {
  const arr = Array.isArray(dimensions) ? dimensions : [];
  const idx = arr.findIndex((d) =>
    /政策法规|政策法規|Policy|Regulation|規制|규제|Regulierung|监管|立法|领导人|治理/.test(
      String(d?.name || ''),
    ),
  );
  return idx >= 0 ? arr[idx] : arr[5] || null;
}

/** 主模型政策法规维已有可核验监管要点时，不再发起补刀调用 */
function mainPolicyDimensionSufficient(dim) {
  if (!dim || typeof dim !== 'object') return false;
  const score = Number(dim.score) || 0;
  const note = String(dim.note || '').trim();
  if (score < 45 || /数据不足|Insufficient data|データ不足|데이터 부족|Unzureichende/i.test(note) || note.length < 18)
    return false;
  if (/(管制|监管|立法|反垄断|出口限制|实体清单|禁令|执法|合规|税务|知识产权|AI Act|芯片禁令)/i.test(note))
    return true;
  if (/(regulation|antitrust|export control|sanction|compliance|entity list)/i.test(note)) return true;
  if (/(CEO|CFO|董事长|创始人|chair|director)/i.test(note) && !/(监管|管制|立法|反垄断)/.test(note))
    return false;
  return note.length >= 28;
}

async function fetchPolicyRegulationDimension(apiKey, ticker, hLabel, ctx = {}, model, locale = 'zh-CN') {
  const loc = normalizeLocale(locale);
  const policyName = policyDimensionName(loc);
  const insuf = insufficientDataNote(loc);
  const policyModel =
    String(model || '').trim() || MODEL_FLASH;
  const companyName = String(ctx.companyName || '').trim();
  const idc = String(ctx.identityCheck || '').trim().slice(0, 650);
  const hint = [
    companyName && `公司/行业（行情侧）：${companyName}`,
    idc && `主模型实体核验摘录：${idc}`,
  ]
    .filter(Boolean)
    .join('\n');

  const runOnce = async (retry) => {
    const retryBlock = retry
      ? `\n\n【再次尝试】上一轮 score=0；换检索词（出口管制、实体清单、反垄断、行业监管、AI 立法、SEC/FTC 执法）再试。仍无可核验监管信息才 score=0 且 note 仅「数据不足」。`
      : '';
    const prompt =
      loc === 'en'
        ? `${outputLanguageInstruction(loc)}
You are a regulatory policy analyst. Ticker: ${ticker}; horizon: ${hLabel}.
${hint ? `${hint}\n` : ''}
Dimension 6 "${policyName}": government/regulator risk (export controls, entity lists, AI regulation, antitrust, sector rules, tax, IP). Geopolitics ≠ ${policyName}. No CEO/management focus.
Rules: verifiable facts + [cite] in note≤72 words; ETFs/funds → score 0, note "${insuf}". No fabrication.${retryBlock}
Output JSON only: {"name":"${policyName}","score":0-100,"note":"…"}`
        : `你是监管政策分析师。标的：${ticker}；期限：${hLabel}。
${hint ? `${hint}\n` : ''}
第 6 维「${policyName}」：评估政府及监管机构对该公司或行业的定向干预风险，包括出口管制、AI 监管立法、反垄断、行业专项监管、税务政策变化、知识产权保护。
边界：地缘政治=国家 vs 国家；${policyName}=政府 vs 企业/行业。勿写 CEO/管理层人事。
规则：1）单一普通股/行业主体才写；note≤72字，可核验监管要点+角标。2）ETF/基金：score=0，note「${insuf}」。3）禁编造。${retryBlock}

只输出一个 JSON：{"name":"${policyName}","score":0-100,"note":"…"}`;
    const policyWeb = openRouterLeaderUseWeb();
    const { content: raw, usage } = await openRouterChat(apiKey, {
      model: policyModel,
      userContent: prompt,
      stream: false,
      useWeb: policyWeb,
      maxOutputTokens: openRouterMaxOutputTokensLeader(),
    });
    const obj = extractJsonObject(raw);
    return {
      name: policyName,
      score: Math.min(100, Math.max(0, Number(obj.score) || 0)),
      note: String(obj.note || insuf).trim() || insuf,
      _usage: usage,
      _usedWeb: policyWeb,
    };
  };

  let row = await runOnce(false);
  if (row.score === 0 && openRouterLeaderRetryEnabled()) {
    try {
      const second = await runOnce(true);
      if (second.score > 0) row = second;
    } catch {
      /* keep first */
    }
  }
  return row;
}

function mergePolicyRegulationIntoDimensions(dimensions, policyRow, locale = 'zh-CN') {
  const arr = Array.isArray(dimensions) ? dimensions.map((d) => ({ ...d })) : [];
  const idx = arr.findIndex((d) =>
    /政策法规|政策法規|Policy|Regulation|規制|규제|Regulierung|监管|立法|领导人|治理/.test(
      String(d?.name || ''),
    ),
  );
  const slot = {
    name: policyRow.name || policyDimensionName(locale),
    score: policyRow.score,
    note: policyRow.note,
  };
  if (idx >= 0) {
    arr[idx] = slot;
  } else if (arr.length >= 6) {
    arr[5] = slot;
  } else {
    while (arr.length < 5)
      arr.push({ name: '—', score: 0, note: insufficientDataNote(locale) });
    arr.push(slot);
  }
  return arr.slice(0, 6);
}

function stripHttpUrls(s) {
  return String(s || '')
    .replace(/https?:\/\/[^\s\])>,"'」]+/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function scrubNotFoundMetaPhrases(s) {
  let t = String(s || '');
  for (let pass = 0; pass < 8; pass++) {
    const u = t;
    t = t
      .replace(/（[^）]{0,120}未检索[^）]{0,120}）/g, '')
      .replace(/（[^）]{0,120}未找到[^）]{0,120}）/g, '')
      .replace(/（[^）]{0,120}没有检索[^）]{0,120}）/g, '')
      .replace(/（[^）]{0,120}未能检索[^）]{0,120}）/g, '')
      .replace(/（[^）]{0,120}暂无[^）]{0,120}）/g, '')
      .replace(/（[^）]{0,120}查无[^）]{0,120}）/g, '')
      .replace(/（[^）]{0,120}无公开信息[^）]{0,120}）/g, '')
      .replace(/（[^）]{0,120}未获取[^）]{0,120}）/g, '')
      .replace(/（[^）]{0,120}检索无果[^）]{0,120}）/g, '')
      .replace(/[^。;；\n]{0,100}未检索到[^。;；\n]{0,120}[。;；\n]?/g, '')
      .replace(/[^。;；\n]{0,100}未检索[^。;；\n]{0,120}[。;；\n]?/g, '')
      .replace(/[^。;；\n]{0,100}未找到[^。;；\n]{0,120}[。;；\n]?/g, '')
      .replace(/[^。;；\n]{0,100}没有检索[^。;；\n]{0,120}[。;；\n]?/g, '')
      .replace(/[^。;；\n]{0,100}未能检索[^。;；\n]{0,120}[。;；\n]?/g, '')
      .replace(/[^。;；\n]{0,100}暂无检索[^。;；\n]{0,120}[。;；\n]?/g, '')
      .replace(/[^。;；\n]{0,100}检索无果[^。;；\n]{0,120}[。;；\n]?/g, '')
      .replace(/[^。;；\n]{0,100}无公开依据[^。;；\n]{0,120}[。;；\n]?/g, '');
    if (t === u) break;
  }
  return t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '').trim();
}

const DIMENSION_NOTE_FALLBACK = '可结合公司公告与公开报道自行判断。';

/** 去掉模型/内审残留用语，勿对用户展示 */
function scrubInternalDraftMarks(s) {
  let t = String(s || '');
  for (let pass = 0; pass < 4; pass++) {
    const u = t;
    t = t
      .replace(/（[^）]{0,40}待核验[^）]{0,40}）/g, '')
      .replace(/（[^）]{0,40}待核实[^）]{0,40}）/g, '')
      .replace(/[【\[]\s*待核验\s*[】\]]/gi, '')
      .replace(/[，,]\s*待核验\b/g, '')
      .replace(/\b待核验\b/g, '')
      .replace(/\b待核实\b/g, '')
      .replace(/\b未核验\b/g, '')
      .replace(/\b尚待核验\b/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/[，,]\s*[，,]/g, '，')
      .trim();
    if (t === u) break;
  }
  return t;
}

/** 风险收益比：占位/未知不写入 Markdown 与 viz，避免顶部仍显示「未知」 */
function sanitizeRiskRewardField(data) {
  if (!data || typeof data !== 'object') return;
  const r = String(data.riskReward ?? '').trim();
  if (
    !r ||
    /^未知$/i.test(r) ||
    /^不确定$/i.test(r) ||
    /^n\/?a$/i.test(r) ||
    /^[-—….]+$/i.test(r) ||
    /^none$/i.test(r) ||
    /^待定$/i.test(r) ||
    /^tbd$/i.test(r)
  ) {
    data.riskReward = '';
    return;
  }
  data.riskReward = r;
}

/** 模型未给 RR 时补一行带「推演」标签的占位，满足产品展示且不冒充精确测算 */
function fillRiskRewardIfEmpty(data) {
  if (!data || typeof data !== 'object') return;
  if (String(data.riskReward || '').trim()) return;
  const sig = String(data.signal || '').toUpperCase();
  const risk = String(data.risk || '').trim();
  let rr = '约 1:1.8（推演）';
  if (sig === 'BUY') rr = risk === '高' ? '约 1:2.2（推演）' : '约 1:2.5（推演）';
  else if (sig === 'HOLD') rr = '约 1:1.5（推演）';
  else if (sig === 'SELL') rr = '约 1:1（推演）';
  data.riskReward = rr;
}

function alignDimensionSlots(dimensions, assetType, locale = 'zh-CN') {
  const loc = normalizeLocale(locale);
  const names = expectedDimensionNames(assetType, loc);
  const insuf = insufficientDataNote(loc);
  const src = Array.isArray(dimensions) ? dimensions : [];
  return names.map((canonical, i) => {
    const d = src[i] || {};
    let score = Number(d.score);
    if (!Number.isFinite(score)) score = 0;
    score = Math.min(100, Math.max(0, Math.round(score)));
    let note = String(d.note || '').trim();
    if (score === 0) {
      note = insuf;
    } else {
      note = stripHttpUrls(note);
      note = scrubNotFoundMetaPhrases(note);
      note = scrubInternalDraftMarks(note);
      if (!note) note = DIMENSION_NOTE_FALLBACK;
    }
    return { name: canonical, score, note };
  });
}

const SUPPLY_CHAIN_PLACEHOLDER_RE = /待结合|待补充|上下游代表|暂无|更新中|待公告/;

/** 角标以 url 为准；忽略模型返回的长 cite，避免「Venture Glob」类截断 */
function guessSourceCite(src) {
  const u = String(src?.url || '').trim();
  const low = u.toLowerCase();
  if (/^https?:\/\//i.test(u)) {
    if (/sec\.gov/.test(low)) return 'SEC';
    if (/nasdaq\.com|nyse\.com|cboe\.com|hkex\.com|sse\.com|szse\.cn/.test(low)) return '交易所';
    if (/investor\.|ir\.|\/investor|\/investors|shareholder|edf\.google/.test(low)) return 'IR';
    if (/ventureglobal\.com/.test(low)) return 'IR';
    if (/stocktitan\.net/.test(low)) return '披露';
    if (/finance\.sina|sina\.com\.cn/.test(low)) return '新闻';
    if (/wsj\.com|ft\.com|bloomberg|reuters|cnbc|marketwatch|fool\.com/.test(low)) return '新闻';
    if (/arxiv|ssrn|doi\.org|researchgate/.test(low)) return '研报';
    if (
      /trefis\.com|fairvaluelabs\.com|simplywall\.st|gurufocus\.com|seekingalpha\.com|tipranks\.com|zacks\.com|morningstar\.com|sentieo\.com/.test(
        low,
      )
    )
      return '研报';
    if (/tradingkey\.com|investing\.com|finviz\.com|barchart\.com|benzinga\.com/.test(low)) return '新闻';
    if (/alphavantage\.co/.test(low)) return '行情';
    if (/yahoo\.|finance\.yahoo/.test(low)) return '新闻';
    if (/eastmoney|163\.com|qq\.com\/finance/.test(low)) return '新闻';
    return '来源';
  }
  const raw = String(src?.cite || '').trim();
  if (raw.length > 0 && raw.length <= 6 && !/\s/.test(raw)) return raw.slice(0, 6);
  return '来源';
}

const BRACKET_CANON = new Set([
  'sec',
  'ir',
  '新闻',
  '行情',
  '研报',
  '交易所',
  '披露',
  '来源',
  '官网',
  '媒体',
]);

function buildBracketAliasMap(sources) {
  const m = new Map();
  const add = (key, cite) => {
    const k = String(key || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (k.length < 2 || k.length > 80) return;
    if (!m.has(k)) m.set(k, cite);
  };
  for (const s of sources || []) {
    if (!s || typeof s !== 'object') continue;
    const cite = String(s.cite || guessSourceCite(s)).trim() || '来源';
    const url = String(s.url || '').toLowerCase();
    const text = String(s.text || '');

    if (/ventureglobal\.com/.test(url)) {
      add('venture global', cite);
      add('ventureglobal', cite);
    }
    if (/yahoo\.|finance\.yahoo/.test(url)) {
      add('yahoo finance', cite);
      add('yahoo', cite);
    }
    if (/stocktitan\.net/.test(url)) {
      add('stocktitan', cite);
      add('stock titan', cite);
    }
    if (/finance\.sina|sina\.com\.cn/.test(url)) {
      add('sina finance', cite);
      add('sina', cite);
      add('新浪财经', cite);
    }
    if (/sec\.gov/.test(url)) add('sec filing', cite);
    if (/trefis\.com/.test(url)) add('trefis', cite);
    if (/tradingkey\.com/.test(url)) add('tradingkey', cite);
    if (/fairvaluelabs\.com/.test(url)) {
      add('fairvaluelabs', cite);
      add('fair value labs', cite);
    }

    const head = text.split(/[｜|·•]/)[0]?.trim();
    if (head && head.length >= 6 && head.length <= 80) add(head, cite);
  }
  return m;
}

/** 将正文中的 [hostname.tld] 或 [Yahoo Finance] 等换成与 sources 一致的短角标 */
function buildHostCitationMap(sources) {
  const m = new Map();
  for (const s of sources || []) {
    if (!s || typeof s !== 'object') continue;
    const rawU = String(s.url || '').trim();
    if (!/^https?:\/\//i.test(rawU)) continue;
    let host = '';
    try {
      host = new URL(rawU).hostname.toLowerCase();
    } catch {
      continue;
    }
    const cite = String(s.cite || guessSourceCite(s)).trim() || '来源';
    const bare = host.replace(/^www\./, '');
    if (!m.has(host)) m.set(host, cite);
    if (!m.has(bare)) m.set(bare, cite);
  }
  return m;
}

function rewriteBracketCitations(text, hostMap, aliasMap) {
  let t = String(text || '');
  t = t.replace(/\[([a-z0-9][a-z0-9.-]*\.[a-z]{2,24})\]/gi, (_, host) => {
    const h = String(host).toLowerCase();
    const cite = hostMap.get(h) || hostMap.get(h.replace(/^www\./, ''));
    return cite ? `[${cite}]` : '';
  });
  t = t.replace(/\[([^\]]+)\]/g, (full, inner) => {
    const raw = String(inner).trim();
    const low = raw.toLowerCase().replace(/\s+/g, ' ');
    if (BRACKET_CANON.has(low)) {
      if (low === 'sec') return '[SEC]';
      if (low === 'ir') return '[IR]';
      return full;
    }
    if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}$/i.test(raw)) return full;
    const cite = aliasMap.get(low);
    if (cite) return `[${cite}]`;
    if (/^[a-zA-Z\s,&'.-]+$/.test(raw) && raw.length >= 28) return '';
    return full;
  });
  for (let pass = 0; pass < 6; pass++) {
    const u = t;
    t = t
      .replace(/(\[[^\]]+])\s*[,，]\s*\1/g, '$1')
      .replace(/\s*[,，]\s*([，。；;])/g, '$1')
      .replace(/(^|[（(])\s*[,，]/g, '$1')
      .replace(/[,，]\s*([)）])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([，。])/g, '$1');
    if (t === u) break;
  }
  return t.trim();
}

function polishDomainBracketCites(data) {
  const hostMap = buildHostCitationMap(data.sources);
  const aliasMap = buildBracketAliasMap(data.sources);
  const keys = [
    'identityCheck',
    'summary',
    'detailAnalysis',
    'outlook',
    'technicalSnapshot',
    'valuationBridge',
  ];
  for (const k of keys) {
    if (typeof data[k] === 'string') {
      data[k] = rewriteBracketCitations(data[k], hostMap, aliasMap);
    }
  }
  const dims = Array.isArray(data.dimensions) ? data.dimensions : [];
  for (const d of dims) {
    if (d && typeof d === 'object' && typeof d.note === 'string') {
      d.note = rewriteBracketCitations(d.note, hostMap, aliasMap);
    }
  }
  if (data.scenarios && typeof data.scenarios === 'object') {
    for (const k of ['bull', 'base', 'bear']) {
      const z = data.scenarios[k];
      if (!z || typeof z !== 'object') continue;
      if (typeof z.trigger === 'string') z.trigger = rewriteBracketCitations(z.trigger, hostMap, aliasMap);
      if (typeof z.range === 'string') z.range = rewriteBracketCitations(z.range, hostMap, aliasMap);
    }
  }
  const chain = Array.isArray(data.supplyChain) ? data.supplyChain : [];
  for (const c of chain) {
    if (c && typeof c === 'object' && typeof c.reason === 'string') {
      c.reason = rewriteBracketCitations(c.reason, hostMap, aliasMap);
    }
  }
}

function enrichSourcesForOutput(data) {
  const arr = Array.isArray(data.sources) ? data.sources : [];
  data.sources = arr.map((s) => {
    if (!s || typeof s !== 'object') return s;
    const cite = guessSourceCite(s);
    return { ...s, cite };
  });
}

function isFlimsySupplyChainEntry(c) {
  const r = String(c?.reason || '');
  const name = String(c?.name || '');
  const blob = `${r} ${name}`;
  if (/西蒙地产|购物中心|商业地产|零售地产|写字楼物业/.test(blob)) return true;
  if (/\b租户\b/.test(r) && /\b间接\b/.test(r)) return true;
  if (/仅靠.*间接|弱关|牵强/.test(r)) return true;
  return false;
}

function ensureSupplyChainAndScenarios(data, ticker) {
  const sym = String(ticker || '标的').trim() || '标的';
  let chain = Array.isArray(data.supplyChain) ? data.supplyChain.filter((c) => c && typeof c === 'object') : [];
  chain = chain.filter((c) => !isFlimsySupplyChainEntry(c));
  while (chain.length < 2) {
    chain.push({
      ticker: '—',
      name:
        chain.length === 0
          ? `与「${sym}」相关的产业链主体`
          : `产业链关联主体`,
      relation: '',
      reason: '',
      score: 50,
    });
  }
  data.supplyChain = chain.map((c) => {
    let s = Number(c.score);
    if (!Number.isFinite(s)) s = 50;
    else s = Math.min(100, Math.max(0, Math.round(s)));
    let relation = scrubNotFoundMetaPhrases(
      stripHttpUrls(String(c.relation || c.reason || '').trim()),
    );
    relation = clipToCompleteThought(relation, 72, 0.22);
    if (relation && SUPPLY_CHAIN_PLACEHOLDER_RE.test(relation)) {
      relation = '';
    }
    return {
      ticker: String(c.ticker ?? '—').trim() || '—',
      name: String(c.name || '').trim() || '未命名主体',
      relation,
      reason: relation,
      score: s,
    };
  });

  const raw = data.scenarios && typeof data.scenarios === 'object' ? data.scenarios : {};
  const keys = ['bull', 'base', 'bear'];
  const slot = (k) => {
    const x = raw[k];
    const o = x && typeof x === 'object' ? x : {};
    return {
      p: Number(o.p),
      range: String(o.range || '').trim(),
      trigger: String(o.trigger || '').trim(),
    };
  };
  let bull = slot('bull');
  let base = slot('base');
  let bear = slot('bear');
  const sumP = [bull, base, bear].reduce((a, x) => a + (Number.isFinite(x.p) ? x.p : 0), 0);
  const badSum = sumP < 99.5 || sumP > 100.5 || keys.some((k) => !Number.isFinite(slot(k).p));
  if (badSum) {
    bull = { ...bull, p: 35 };
    base = { ...base, p: 40 };
    bear = { ...bear, p: 25 };
  } else {
    const s = bull.p + base.p + bear.p;
    if (Math.abs(s - 100) > 0.05) {
      const f = 100 / s;
      const r1 = Math.round(bull.p * f * 10) / 10;
      const r2 = Math.round(base.p * f * 10) / 10;
      const r3 = Math.round((100 - r1 - r2) * 10) / 10;
      bull = { ...bull, p: r1 };
      base = { ...base, p: r2 };
      bear = { ...bear, p: r3 };
    }
  }
  const scenFallback = '待观察。';
  const rangeFb = '—';
  data.scenarios = {
    bull: {
      p: bull.p,
      range: bull.range || rangeFb,
      trigger: bull.trigger || scenFallback,
    },
    base: {
      p: base.p,
      range: base.range || rangeFb,
      trigger: base.trigger || scenFallback,
    },
    bear: {
      p: bear.p,
      range: bear.range || rangeFb,
      trigger: bear.trigger || scenFallback,
    },
  };
  if (!String(data.outlook || '').trim()) {
    data.outlook = '';
  }
  for (const k of keys) {
    const z = data.scenarios[k];
    if (z && typeof z === 'object') {
      z.range = scrubNotFoundMetaPhrases(stripHttpUrls(String(z.range || '')));
      z.trigger = scrubNotFoundMetaPhrases(stripHttpUrls(String(z.trigger || '')));
    }
  }
}

function signalToZh(s) {
  const u = String(s || '').toUpperCase();
  if (u === 'BUY') return '买入';
  if (u === 'SELL') return '卖出';
  return '持有';
}

/** 超长时在句号/分号等处收束，**不加省略号**，避免「…」半句感 */
function clipToCompleteThought(s, maxChars, minRatio = 0.45) {
  const t = String(s || '').trim();
  if (!t || maxChars <= 0) return t;
  const chars = [...t];
  if (chars.length <= maxChars) return t;
  const slice = chars.slice(0, maxChars).join('');
  const minLen = Math.max(8, Math.floor(maxChars * minRatio));
  for (let i = slice.length - 1; i >= minLen; i--) {
    if (/[。！？；]/.test(slice[i])) return slice.slice(0, i + 1).trim();
  }
  const nl = slice.lastIndexOf('\n');
  if (nl >= minLen) return slice.slice(0, nl).trim();
  const cc = slice.lastIndexOf('，');
  if (cc >= minLen) return slice.slice(0, cc + 1).trim();
  return slice.replace(/\s+$/u, '').trim();
}

/** 去掉段尾人为「…」或未写完的省略号感 */
function trimSuspensionSuffix(s) {
  return String(s || '')
    .replace(/\s*…{1,}\s*$/u, '')
    .replace(/\s*\.{3,}\s*$/u, '')
    .trim();
}

function clampVerboseChineseFields(data) {
  if (!data || typeof data !== 'object') return;
  data.identityCheck = clipToCompleteThought(data.identityCheck, 56);
  data.summary = clipToCompleteThought(data.summary, 36);
  data.technicalSnapshot = clipToCompleteThought(data.technicalSnapshot, 64);
  data.detailAnalysis = clipToCompleteThought(String(data.detailAnalysis || '').trim(), DETAIL_MARKDOWN_MAX_CHARS);
  data.outlook = clipToCompleteThought(data.outlook, 120);
  data.valuationBridge = clipToCompleteThought(data.valuationBridge, 44);
  data.leaderInsiderSummary = clipToCompleteThought(data.leaderInsiderSummary, 48);
  const ct = Array.isArray(data.catalystTimeline) ? data.catalystTimeline : [];
  data.catalystTimeline = ct.slice(0, 4).map((x) => {
    if (!x || typeof x !== 'object') return x;
    return {
      ...x,
      label: clipToCompleteThought(String(x.label || '').trim(), 16),
      detail: clipToCompleteThought(String(x.detail || '').trim(), 24),
    };
  });
  const dims = Array.isArray(data.dimensions) ? data.dimensions : [];
  for (const d of dims) {
    if (!d || typeof d !== 'object') continue;
    const sc = Number(d.score);
    if (!Number.isFinite(sc) || sc === 0) continue;
    d.note = scrubInternalDraftMarks(clipToCompleteThought(String(d.note || '').trim(), 56));
  }
  const chain = Array.isArray(data.supplyChain) ? data.supplyChain : [];
  for (const c of chain) {
    if (c && typeof c === 'object') {
      c.reason = clipToCompleteThought(String(c.reason || '').trim(), 44);
    }
  }
  if (data.scenarios && typeof data.scenarios === 'object') {
    for (const k of ['bull', 'base', 'bear']) {
      const z = data.scenarios[k];
      if (!z || typeof z !== 'object') continue;
      z.trigger = clipToCompleteThought(String(z.trigger || '').trim(), 44);
      z.range = clipToCompleteThought(String(z.range || '').trim(), 40);
    }
  }
  if (Array.isArray(data.sources)) {
    data.sources = data.sources.slice(0, 5).map((s) => {
      if (!s || typeof s !== 'object') return s;
      return { ...s, text: clipToCompleteThought(String(s.text || '').trim(), 48) };
    });
  }
}

function jsonToMarkdownFourParts(data, tier = 'free', locale = 'zh-CN') {
  const loc = normalizeLocale(locale);
  const sig = signalDisplayLabel(data.signal, loc);
  const insuf = insufficientDataNote(loc);
  const L =
    loc === 'en'
      ? {
          dataAsOf: 'Data as of',
          identity: 'Entity & ticker check',
          score: 'Actionability score',
          tendency: 'Stance',
          risk: 'Risk level',
          rr: 'Risk/reward',
          price: 'Price vs target',
          tech: 'Technical snapshot',
          dims: 'Six dimensions',
          sources: 'Sources',
          chain: 'Supply chain / related names',
          scenarios: 'Scenarios & probabilities',
          val: 'Valuation bridge (illustrative)',
          outlook: 'Outlook',
        }
      : {
          dataAsOf: '数据与事实口径截至',
          identity: '实体与代码核验',
          score: '可买性评分',
          tendency: '投资倾向',
          risk: '风险等级',
          rr: '风险收益比',
          price: '价格与目标价',
          tech: '行情/技术面快照',
          dims: '六维评分',
          sources: '信息来源',
          chain: '产业链 / 关联标的',
          scenarios: '情景与概率',
          val: '估值反推（推演，非目标价）',
          outlook: '走势预判',
        };
  const idc = trimSuspensionSuffix(scrubNotFoundMetaPhrases(stripHttpUrls(String(data.identityCheck || ''))));
  const summ = trimSuspensionSuffix(scrubNotFoundMetaPhrases(stripHttpUrls(String(data.summary || ''))));
  let ts = scrubNotFoundMetaPhrases(stripHttpUrls(String(data.technicalSnapshot || '')));
  if (!ts.replace(/[—\-\s.]/g, '')) ts = '';

  let s1 = `${L.dataAsOf}: ${data.dataAsOf || '—'}\n\n${L.identity}: ${idc || '—'}\n\n**${L.score}: ${data.score}/100**\n**${L.tendency}: ${sig}**\n**${L.risk}: ${data.risk || '—'}**\n`;
  if (data.riskReward) {
    const rr = scrubNotFoundMetaPhrases(stripHttpUrls(String(data.riskReward)));
    if (rr) s1 += `**${L.rr}:** ${rr}\n`;
  }
  const apl = trimSuspensionSuffix(String(data.analystPriceLine || '').trim());
  if (apl) s1 += `\n**${L.price}:** ${apl}\n`;
  if (summ) s1 += `\n${summ}\n`;
  if (ts) s1 += `\n**${L.tech}:**\n${ts}\n`;
  s1 += markdownCatalystForTier(data, tier);

  let s2 = `**${L.dims}:**\n\n`;
  (data.dimensions || []).forEach((d, i) => {
    const name = d.name || '—';
    const sc = Math.min(100, Math.max(0, Math.round(Number(d.score) || 0)));
    if (sc === 0) {
      s2 += `${i + 1}. **${name}** — ${insuf}\n`;
    } else {
      const note = trimSuspensionSuffix(String(d.note || '').trim());
      s2 += `${i + 1}. **${name} ${sc}** — ${note}\n`;
    }
  });

  const detBody = buildDetailBodyForMarkdown(data);

  let s3 = `${detBody}\n\n**${L.sources}**\n\n`;
  s3 += '| 角标 | 摘要 | 时间 | 可信度 | 链接 |\n';
  s3 += '| --- | --- | --- | --- | --- |\n';
  (data.sources || []).forEach((src) => {
    if (!src || typeof src !== 'object') return;
    const cite = src.cite || guessSourceCite(src);
    const text = String(src.text || '')
      .replace(/\|/g, '｜')
      .replace(/\r?\n/g, ' ')
      .slice(0, 100);
    const ti = String(src.time || '—').replace(/\|/g, '');
    const cred = String(src.credibility || '中').replace(/\|/g, '');
    const url = String(src.url || '—').replace(/\|/g, '');
    s3 += `| ${cite} | ${text} | ${ti} | ${cred} | ${url} |\n`;
  });

  let s4 = `**${L.chain}:**\n`;
  (data.supplyChain || []).forEach((c) => {
    let reason = stripHttpUrls(String(c.reason || '')).trim();
    reason = reason.replace(/[。.；;、，,\s]+$/u, '');
    s4 += `- **${c.ticker || '—'}** ${c.name || ''}（关联：${reason}；评分 ${c.score}/100）\n`;
  });
  s4 += `\n**${L.scenarios}:**\n`;
  const sc = data.scenarios;
  const notes = data.scenarioPriceNotes && typeof data.scenarioPriceNotes === 'object' ? data.scenarioPriceNotes : {};
  if (sc && typeof sc === 'object') {
    const rows =
      loc === 'en'
        ? [
            ['Bull', sc.bull, 'bull'],
            ['Base', sc.base, 'base'],
            ['Bear', sc.bear, 'bear'],
          ]
        : [
            ['牛势', sc.bull, 'bull'],
            ['基准', sc.base, 'base'],
            ['熊势', sc.bear, 'bear'],
          ];
    rows.forEach(([label, x, key]) => {
      if (x && typeof x === 'object') {
        const ann = String(notes[key] || '').trim();
        const tail = ann ? ` ${ann}` : '';
        s4 += `- **${label}**（概率 ${x.p ?? '—'}%）：区间 ${x.range || '—'}；触发：${x.trigger || '—'}${tail}\n`;
      }
    });
  } else {
    s4 += '—\n';
  }
  let vb = trimSuspensionSuffix(scrubNotFoundMetaPhrases(stripHttpUrls(String(data.valuationBridge || '').trim())));
  if (vb) {
    s4 += `\n**${L.val}:** ${vb}\n`;
  }
  const out = trimSuspensionSuffix(scrubNotFoundMetaPhrases(stripHttpUrls(String(data.outlook || '').trim())));
  s4 += `\n**${L.outlook}:**\n${out || '—'}\n`;
  s4 += `\n${data.disclaimer || defaultDisclaimer(loc)}\n`;
  const srcN = Array.isArray(data.sources) ? data.sources.length : 0;
  s4 += `\n${researchFooterLine(srcN)}\n`;
  if (tier === 'free') {
    s4 += '\n**会员提示**：Pro 解锁操作建议、时间节点、内部人与同行对标；Pro+ 解锁多空对撞与情景细化。\n';
  }

  return `<<<WENAP_S1>>>\n${s1.trim()}\n<<<WENAP_S2>>>\n${s2.trim()}\n<<<WENAP_S3>>>\n${s3.trim()}\n<<<WENAP_S4>>>\n${s4.trim()}\n`;
}

/** 供前端图表用，控制体积 */
function stripDataForViz(data, { tier = 'free', latestPrice = NaN } = {}) {
  const detailFull = trimSuspensionSuffix(String(data.detailAnalysis || '').trim());
  const detailPreview = clipToCompleteThought(detailFull, DETAIL_MARKDOWN_MAX_CHARS, 0.32);
  const detailNeedsFold = [...detailFull].length > DETAIL_MARKDOWN_MAX_CHARS;
  const srcArr = Array.isArray(data.sources) ? data.sources : [];
  const snap = {
    score: data.score,
    signal: data.signal,
    risk: data.risk,
    riskReward: data.riskReward,
    summary: data.summary,
    dataAsOf: data.dataAsOf,
    reportTier: tier,
    latestPriceUsd: Number.isFinite(latestPrice) && latestPrice > 0 ? latestPrice : null,
    actionLine: String(data.actionLine || '').trim(),
    actionLineObj:
      data.actionLineObj && typeof data.actionLineObj === 'object'
        ? {
            suggestion: String(data.actionLineObj.suggestion || '').trim(),
            stopLoss: String(data.actionLineObj.stopLoss || '').trim(),
            catalyst: String(data.actionLineObj.catalyst || '').trim(),
          }
        : { suggestion: '', stopLoss: '', catalyst: '' },
    keyEvents: Array.isArray(data.keyEvents) ? data.keyEvents.slice(0, 6) : [],
    leaderInsiderSummary: String(data.leaderInsiderSummary || '').trim(),
    analystPriceLine: String(data.analystPriceLine || '').trim(),
    peerVsSectorLine: String(data.peerVsSectorLine || '').trim(),
    bullBearDebate:
      data.bullBearDebate && typeof data.bullBearDebate === 'object'
        ? data.bullBearDebate
        : { bull: [], bear: [] },
    catalystTimeline: Array.isArray(data.catalystTimeline) ? data.catalystTimeline.slice(0, 6) : [],
    scenarioPriceNotes: data.scenarioPriceNotes && typeof data.scenarioPriceNotes === 'object' ? data.scenarioPriceNotes : {},
    detailAnalysisFull: detailFull,
    detailAnalysisPreview: detailPreview,
    detailNeedsFold,
    sourcesCount: srcArr.length,
    researchFooterLine: researchFooterLine(srcArr.length),
    identityCheck: String(data.identityCheck || '').trim().slice(0, 200),
    technicalSnapshot: String(data.technicalSnapshot || '').trim().slice(0, 200),
    outlook: String(data.outlook || '').trim().slice(0, 1200),
    valuationBridge: String(data.valuationBridge || '').trim().slice(0, 200),
    dimensions: (data.dimensions || []).map((d) => ({
      name: d.name,
      score: d.score,
      note: String(d.note || '').trim().slice(0, 220),
    })),
    scenarios: data.scenarios && typeof data.scenarios === 'object' ? data.scenarios : null,
    supplyChain: Array.isArray(data.supplyChain) ? data.supplyChain : [],
    sources: srcArr.slice(0, 5).map((s) => ({
      text: s.text,
      url: s.url,
      time: s.time,
      credibility: s.credibility,
      cite: s.cite || guessSourceCite(s),
    })),
  };
  const proHints = {
    hasActionLine: Boolean(
      snap.actionLineObj?.suggestion || snap.actionLineObj?.stopLoss || snap.actionLine,
    ),
    catalystCount: (snap.keyEvents || snap.catalystTimeline || []).length,
    hasInsider: Boolean(snap.leaderInsiderSummary),
    hasPeer: Boolean(snap.peerVsSectorLine),
  };
  const proPlusHints = {
    hasBullBear:
      (snap.bullBearDebate?.bull?.length || 0) + (snap.bullBearDebate?.bear?.length || 0) > 0,
    hasScenarioDetail: Boolean(
      snap.scenarios?.bull?.triggerPrice ||
        snap.scenarios?.base?.triggerPrice ||
        snap.scenarios?.bull?.timeWindow ||
        snap.scenarios?.base?.timeWindow,
    ),
    hasSupplyDetail: (snap.supplyChain || []).some((c) => String(c?.analysis || '').trim()),
  };

  if (tier === 'free') {
    return {
      ...snap,
      actionLine: '',
      actionLineObj: { suggestion: '', stopLoss: '', catalyst: '' },
      keyEvents: [],
      catalystTimeline: [],
      leaderInsiderSummary: '',
      peerVsSectorLine: '',
      bullBearDebate: { bull: [], bear: [] },
      proFieldHints: proHints,
      proPlusFieldHints: proPlusHints,
    };
  }
  if (tier === 'pro') {
    const scenarios = snap.scenarios && typeof snap.scenarios === 'object' ? { ...snap.scenarios } : null;
    if (scenarios) {
      for (const k of ['bull', 'base', 'bear']) {
        if (scenarios[k]) {
          scenarios[k] = { ...scenarios[k], triggerPrice: null, timeWindow: '' };
        }
      }
    }
    const supplyChain = (snap.supplyChain || []).map((c) => ({
      ...c,
      analysis: '',
    }));
    return {
      ...snap,
      scenarios,
      supplyChain,
      bullBearDebate: { bull: [], bear: [] },
      proFieldHints: { hasActionLine: false, catalystCount: 0, hasInsider: false, hasPeer: false },
      proPlusFieldHints: proPlusHints,
    };
  }
  return {
    ...snap,
    proFieldHints: { hasActionLine: false, catalystCount: 0, hasInsider: false, hasPeer: false },
    proPlusFieldHints: { hasBullBear: false, hasScenarioDetail: false, hasSupplyDetail: false },
  };
}

async function streamChunkedMarkdown(res, markdown) {
  const step = 80;
  const markerHead = /^<<<WENAP_S[1-4]>>>/;
  const lookBack = 24;
  let i = 0;
  while (i < markdown.length) {
    let end = Math.min(i + step, markdown.length);
    if (end < markdown.length) {
      const win0 = Math.max(i, end - lookBack);
      const tail = markdown.slice(win0, end);
      const rel = tail.lastIndexOf('<<<');
      if (rel !== -1) {
        const absOpen = win0 + rel;
        const probe = markdown.slice(absOpen, Math.min(absOpen + 20, markdown.length));
        if (!markerHead.test(probe)) {
          end = absOpen;
        }
      }
    }
    if (end <= i) {
      end = Math.min(i + 1, markdown.length);
    }
    if (!writeSse(res, { type: 'token', text: markdown.slice(i, end) })) break;
    i = end;
  }
}

async function runAnalyzePipeline(
  res,
  apiKey,
  { symbol, assetType, horizon, tier, userKey, authContext = null, locale = 'zh-CN' },
) {
  const mainModel = mainModelForTier(tier);
  const pipelineStarted = Date.now();
  const stopKeepalive = startSseKeepalive(res);
  const usageLog = { main: null, leader: null, leaderSkipped: false };
  const bailIfClientGone = (stage) => {
    if (!sseClientGone(res)) return false;
    console.warn(`[Wenap] ${symbol}：客户端已断开（${stage}），跳过后续步骤`);
    return true;
  };
  try {
    mergeOpenRouterKeyFromDotenvFile();
    if (bailIfClientGone('start')) return;
    const avKey = getAlphaVantageKey();
    let alphaBlock = '';
    let alphaOverview = null;
    let latestPrice = NaN;
    if (avKey) {
      try {
        if (bailIfClientGone('alpha')) return;
        const bundle = await fetchAlphaVantageContextBundle(symbol, avKey);
        alphaBlock = bundle.text;
        alphaOverview = bundle.overview;
        latestPrice = latestPriceFromGlobalQuote(bundle.globalQuote);
      } catch (e) {
        console.warn('[Wenap] Alpha Vantage:', e.message);
      }
    }
    const looksLikeFund = assetType === 'stock' && overviewSuggestsEtfLike(alphaOverview);
    const effectiveAssetType = looksLikeFund ? 'etf' : assetType;
    const listingCurrency = inferListingCurrency(alphaOverview, symbol);
    const exchangeHint = alphaOverview ? String(alphaOverview.Exchange || '').trim() : '';
    if (looksLikeFund) {
      console.warn(
        `[Wenap] 代码 ${symbol}：OVERVIEW 似为基金/ETF，已按 ETF 维度分析（原请求 assetType=stock）。`,
      );
    }
    const mainPrompt = buildMainJsonPrompt({
      ticker: symbol,
      assetType: effectiveAssetType,
      horizon,
      alphaContextBlock: alphaBlock,
      listingCurrency,
      exchangeHint,
      tier,
      locale: normalizeLocale(locale),
    });
    if (bailIfClientGone('main-prompt')) return;
    const mainResult = await openRouterChat(apiKey, {
      model: mainModel,
      userContent: mainPrompt,
      stream: false,
      useWeb: true,
      maxOutputTokens: openRouterMaxOutputTokensMain(),
    });
    usageLog.main = mainResult.usage;
    const data = extractJsonObject(mainResult.content);
    if (assetType === 'stock' && !looksLikeFund) {
      const mainPolicy = extractPolicyRegulationDimension(data.dimensions);
      if (mainPolicyDimensionSufficient(mainPolicy)) {
        usageLog.leaderSkipped = true;
        console.log(`[Wenap] ${symbol}：主模型政策法规维已达标，无需补刀`);
      } else if (openRouterPolicyFallbackEnabled()) {
        try {
          if (bailIfClientGone('policy-reg')) return;
          const policyRow = await fetchPolicyRegulationDimension(
            apiKey,
            symbol,
            horizonLabel(horizon, locale),
            {
              identityCheck: data.identityCheck,
              companyName: alphaOverview?.Name ? String(alphaOverview.Name).trim() : '',
            },
            mainModel,
            locale,
          );
          usageLog.leader = policyRow._usage || null;
          data.dimensions = mergePolicyRegulationIntoDimensions(data.dimensions, policyRow, locale);
          console.log(`[Wenap] ${symbol}：政策法规维补刀（${mainModel}）`);
        } catch (e) {
          console.warn('[Wenap] 政策法规维补刀失败，保留主模型结果：', e.message);
        }
      } else {
        usageLog.leaderSkipped = true;
        console.log(`[Wenap] ${symbol}：政策法规维未达标，补刀已关闭（OPENROUTER_POLICY_FALLBACK=0）`);
      }
    }
    ensureSupplyChainAndScenarios(data, symbol);
    enrichSourcesForOutput(data);
    polishDomainBracketCites(data);
    data.dimensions = alignDimensionSlots(data.dimensions, effectiveAssetType, locale);
    if (tier === 'pro' || tier === 'pro_plus') {
      mergePeerLineIntoDimensions(data.dimensions, data.peerVsSectorLine);
    }
    repairMisattributedUsdScenarioRanges(data, listingCurrency);
    normalizeReportExtensions(data, alphaOverview, latestPrice, listingCurrency);
    clampVerboseChineseFields(data);
    sanitizeRiskRewardField(data);
    fillRiskRewardIfEmpty(data);
    const md = jsonToMarkdownFourParts(data, tier, locale);
    const vizSnapshot = stripDataForViz(data, { tier, latestPrice });
    if (!writeSse(res, { type: 'viz', snapshot: vizSnapshot })) return;
    if (bailIfClientGone('before-stream')) return;
    await streamChunkedMarkdown(res, md);
    const recId = `${Date.now()}-${symbol}`;
    appendHistory(userKey, {
      id: recId,
      ts: new Date().toISOString(),
      symbol,
      assetType: effectiveAssetType,
      horizon,
      tier,
      model: mainModel,
      score: data.score,
      signal: data.signal,
      risk: data.risk,
      summary: data.summary,
      data,
      markdown: md,
      vizSnapshot,
    });
    if (tier === 'free' && !FREE_ANALYSIS_UNLIMITED) {
      if (authContext?.userId) {
        authDb.recordFreeAnalysisUsage(
          authContext.userId,
          authContext.fingerprint,
          authContext.ip,
        );
      } else {
        incrementFreeMonthlyUsage(userKey);
      }
    }
    store.recordAnalysisSuccess({
      userKey,
      tier,
      model: mainModel,
      symbol,
      data,
      latestPriceUsd: latestPrice,
      usage: usageLog,
      durationMs: Date.now() - pipelineStarted,
    });
    const sumTokens = (u) =>
      u && typeof u === 'object' ? (Number(u.total_tokens) || Number(u.prompt_tokens) + Number(u.completion_tokens) || 0) : 0;
    writeSse(res, {
      type: 'done',
      usage: {
        mainTokens: sumTokens(usageLog.main),
        leaderTokens: usageLog.leaderSkipped ? 0 : sumTokens(usageLog.leader),
        leaderSkipped: usageLog.leaderSkipped,
        leaderWeb: openRouterLeaderUseWeb(),
      },
    });
    if (usageLog.main || usageLog.leader) {
      console.log(
        `[Wenap] ${symbol} token 用量 main=${sumTokens(usageLog.main)} leader=${usageLog.leaderSkipped ? 'skipped' : sumTokens(usageLog.leader)}`,
      );
    }
  } catch (e) {
    store.recordAnalysisFailure({
      userKey,
      tier,
      model: mainModel,
      symbol,
      errorMessage: e?.message,
      durationMs: Date.now() - pipelineStarted,
    });
    if (!sseClientGone(res)) {
      writeSse(res, {
        type: 'error',
        message: e?.message || '分析管线失败',
      });
    } else {
      console.warn('[Wenap] 分析失败且客户端已断开:', e.message);
    }
  } finally {
    stopKeepalive();
    res.end();
  }
}

function serverInfoPayload() {
  return {
    status: 'Wenap server running',
    apiVersion: 9,
    adminApiMount: '/admin-api',
    adminSpaPaths: ['/admin', '/admin/*'],
    openRouterKeyConfigured: Boolean(getOpenRouterKey()),
    alphaVantageConfigured: Boolean(getAlphaVantageKey()),
    pricing: PRICING_USD,
    billing: {
      free: {
        mainModel: MODEL_FLASH,
        policyFallback: 'same as main when dim insufficient',
        ...(FREE_ANALYSIS_UNLIMITED
          ? { monthlyUnlimited: true, note: '试运行：免费暂不限次' }
          : {
              monthlyAnalysesCap: FREE_MONTHLY_ANALYSIS_CAP,
              note: '需传 userId 或 anonId 计次；仅 IP 时多台设备易共用额度',
            }),
      },
      pro: {
        mainModel: MODEL_FLASH,
        policyFallback: 'same as main when dim insufficient',
        monthlyUnlimited: true,
        note: '与免费相同主模型，付费解锁次数',
      },
      pro_plus: {
        mainModel: MODEL_PRO_PLUS,
        policyFallback: 'same as main when dim insufficient',
        monthlyUnlimited: true,
      },
    },
    models: {
      main: MODEL_FLASH,
      proPlusMain: MODEL_PRO_PLUS,
      policyFallback: 'same as main',
    },
  };
}

/** 负载均衡 / 运维探活（不受 SPA 托管影响） */
app.get('/health', (req, res) => {
  mergeOpenRouterKeyFromDotenvFile();
  res.json({ ok: true, ...serverInfoPayload() });
});

/** 仅 API 模式（本地 vite 代理时）保留根路径 JSON */
if (!SPA_MODE) {
  app.get('/', (req, res) => {
    mergeOpenRouterKeyFromDotenvFile();
    res.json(serverInfoPayload());
  });
}

app.get('/watchlist', (req, res) => {
  const tier = resolveTier(req.query || {});
  const userKey = userKeyFromQuery(req);
  const w = readWatchlist();
  const items = Array.isArray(w.byUser[userKey]) ? w.byUser[userKey] : [];
  res.json({ items, cap: watchlistCap(tier), tier });
});

/** 免费额度与套餐摘要（首页展示「还剩几次」、促订阅） */
app.get('/market/sparkline', async (req, res) => {
  const ticker = String(req.query?.ticker || '').trim().toUpperCase();
  if (!ticker) return res.status(400).json({ error: '需要 ticker' });
  try {
    const { fetchSparklineCloses } = require('./lib/sparkline.cjs');
    const points = await fetchSparklineCloses(ticker, 7);
    res.json({ ticker, points });
  } catch (e) {
    res.status(502).json({ error: e.message || 'sparkline failed' });
  }
});

app.get('/quota', requireAuth, (req, res) => {
  const u = req.authPublic;
  const tier = u.tier;
  if (tier !== 'free' || FREE_ANALYSIS_UNLIMITED) {
    return res.json({
      tier,
      unlimited: tier !== 'free' || FREE_ANALYSIS_UNLIMITED,
      watchlistCap: watchlistCap(tier),
      historyFull: tier !== 'free',
      pricing: PRICING_USD,
      user: u,
    });
  }
  const remaining = u.freeTrialsRemaining ?? 0;
  res.json({
    tier: 'free',
    used: u.freeTrialsUsed,
    remaining,
    freeTrialsLeft: remaining,
    monthlyCap: authDb.FREE_MONTHLY_CAP,
    resetAt: u.freeTrialsResetAt,
    watchlistCap: watchlistCap('free'),
    historyFull: false,
    pricing: PRICING_USD,
    user: u,
  });
});

app.post('/watchlist', (req, res) => {
  const tier = resolveTier(req.body || {});
  const userKey = userQuotaKey(req);
  const cap = watchlistCap(tier);
  const sym = String(req.body?.symbol || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 16);
  if (!sym) {
    return res.status(400).json({ error: 'Symbol required' });
  }
  const assetType = normalizeWatchAssetType(req.body?.assetType);
  const horizon = normalizeWatchHorizon(req.body?.horizon);
  const state = readWatchlist();
  if (!state.byUser[userKey]) state.byUser[userKey] = [];
  const list = state.byUser[userKey];
  const exists = list.some((x) => x.symbol === sym && x.assetType === assetType);
  if (!exists) {
    const distinctCount = new Set(list.map((x) => `${x.symbol}\t${x.assetType}`)).size;
    if (distinctCount >= cap) {
      return res.status(403).json({ error: 'WATCHLIST_CAP', cap });
    }
  }
  const entry = { symbol: sym, assetType, horizon, addedAt: new Date().toISOString() };
  const idx = list.findIndex((x) => x.symbol === sym && x.assetType === assetType);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...entry };
  } else {
    list.push(entry);
  }
  writeWatchlist(state);
  res.json({ items: state.byUser[userKey], cap });
});

app.delete('/watchlist/:symbol', (req, res) => {
  const raw = decodeURIComponent(String(req.params.symbol || ''));
  const sym = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 16);
  const userKey = userKeyFromQuery(req);
  const state = readWatchlist();
  if (!state.byUser[userKey]) state.byUser[userKey] = [];
  state.byUser[userKey] = state.byUser[userKey].filter((x) => x.symbol !== sym);
  writeWatchlist(state);
  res.json({ items: state.byUser[userKey] });
});

app.get('/history', (req, res) => {
  const tier = resolveTier(req.query || {});
  const userKey = userKeyFromQuery(req);
  const idx = readHistoryIndex();
  const all = Array.isArray(idx.byUser[userKey]) ? idx.byUser[userKey] : [];
  if (tier === 'free') {
    return res.json({
      items: all.slice(0, 30).map((row, i) => ({ ...row, locked: i > 0 })),
      tier,
      free_limit: 1,
      locked: true,
    });
  }
  res.json({ items: all, tier, free_limit: 1, locked: false });
});

app.get('/history/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const tier = resolveTier(req.query || {});
  const userKey = userKeyFromQuery(req);
  const idx = readHistoryIndex();
  const list = Array.isArray(idx.byUser[userKey]) ? idx.byUser[userKey] : [];
  const row = list.find((x) => x.id === id);
  if (!row) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  if (tier === 'free' && list.length && list[0].id !== id) {
    return res.status(403).json({ error: 'HISTORY_LOCKED' });
  }
  const filePath = path.join(HISTORY_DIR, userKeyHash(userKey), `${id}.json`);
  try {
    const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return res.json(record);
  } catch {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
});

app.post('/analyze', requireAuth, async (req, res) => {
  const { ticker, assetType, horizon } = req.body || {};
  const symbol = typeof ticker === 'string' ? ticker.trim().toUpperCase() : '';
  if (!symbol) {
    return res.status(400).json({ error: 'Ticker required' });
  }

  const apiKey = getOpenRouterKey();
  mergeOpenRouterKeyFromDotenvFile();
  if (!apiKey) {
    return res.status(503).json({
      error:
        '未配置有效的 OPENROUTER_API_KEY。请在 wenap/.env 中填写后重启后端。',
    });
  }

  const ip = authDb.getClientIp(req);
  const tier = authDb.normalizeTier(req.authUser.tier);
  const userKey = `uid:${req.authUser.id}`;

  if (tier === 'free' && !FREE_ANALYSIS_UNLIMITED) {
    const check = authDb.checkUserCanAnalyze(req.authUser, '', ip);
    if (!check.allowed) {
      return res.status(403).json({
        error: check.error || 'FORBIDDEN',
        tier,
        message: check.message,
        pricing: { pro: '9.99', pro_plus: '19.99', currency: 'USD' },
      });
    }
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const ast = assetType || 'stock';
  const hor = horizon || '3m';
  const locale = normalizeLocale(req.body?.locale);
  const mainModel = mainModelForTier(tier);
  const qMeta =
    tier === 'free' && !FREE_ANALYSIS_UNLIMITED
      ? {
          used: req.authPublic.freeTrialsUsed,
          remaining: req.authPublic.freeTrialsRemaining,
          month: req.authPublic.freeTrialsResetAt,
        }
      : null;

  writeSse(res, {
    type: 'meta',
    ticker: symbol,
    assetType: ast,
    horizon: hor,
    tier,
    model: mainModel,
    models: {
      main: mainModel,
      policyFallback: ast === 'stock' ? 'same as main when insufficient' : null,
    },
    quota:
      tier === 'free' && FREE_ANALYSIS_UNLIMITED
        ? { monthlyUnlimited: true }
        : tier === 'free' && qMeta
          ? {
              monthlyCap: FREE_MONTHLY_ANALYSIS_CAP,
              month: qMeta.month,
              usedBeforeThisRequest: qMeta.used,
              remainingAfterThisRequest: Math.max(0, qMeta.remaining - 1),
              skipped: qMeta.skipped,
            }
          : tier === 'pro'
          ? { monthlyUnlimited: true, sameModelAsFree: true }
          : tier === 'pro_plus'
            ? { monthlyUnlimited: true, premiumMainModel: true }
            : null,
    startedAt: new Date().toISOString(),
  });

  await runAnalyzePipeline(res, apiKey, {
    symbol,
    assetType: ast,
    horizon: hor,
    tier,
    userKey,
    locale,
    authContext: { userId: req.authUser.id, fingerprint: '', ip },
  });
});

/** 生产环境：/admin 为 React 管理页，必须在任何管理 API 之前返回 index.html */
if (SPA_MODE) {
  const distIndex = path.join(__dirname, 'dist', 'index.html');
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!/^\/admin(\/.*)?$/.test(req.path || '')) return next();
    if (!fs.existsSync(distIndex)) return next();
    return res.sendFile(distIndex);
  });
}

app.use('/auth', authRouter);
/** 管理 API 勿挂在 /admin（会与 SPA 路由 /admin 冲突）；前端请求 /api/admin-api/... */
app.use('/admin-api', adminRouter);
app.use('/accuracy', (req, res, next) => {
  const sub = req.path || '/';
  if ((req.method === 'GET' || req.method === 'HEAD') && (sub === '/' || sub === '')) {
    return next();
  }
  return publicAccuracyRouter(req, res, next);
});
startVerifyCron();

if (SPA_MODE) {
  const distPath = path.join(__dirname, 'dist');
  if (!fs.existsSync(distPath)) {
    console.warn(
      `[Wenap] 未找到 ${distPath}。上架前请执行：npm run build（或设置 SERVE_DIST=0 仅用 API 模式）。`,
    );
  } else {
    app.use(
      express.static(distPath, {
        index: false,
        fallthrough: true,
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const idxFile = path.join(distPath, 'index.html');
      if (!fs.existsSync(idxFile)) return next();
      const p = req.path || '';
      if (
        /^\/admin(\/.*)?$/.test(p) ||
        /^\/(accuracy|login|register|verify-email)(\/.*)?$/.test(p)
      ) {
        return res.sendFile(idxFile);
      }
      if (!p.includes('.')) return res.sendFile(idxFile);
      return next();
    });
  }
}

app.listen(PORT, () => {
  const key = getOpenRouterKey();
  console.log(`Wenap listening on :${PORT}${SPA_MODE ? '（托管 dist + 剥离 /api 前缀）' : '（仅 API，请配合 Vite 代理）'}`);
  const freeBilling = FREE_ANALYSIS_UNLIMITED
    ? `免费暂不限次(主${MODEL_FLASH})`
    : `免费≤${FREE_MONTHLY_ANALYSIS_CAP}次/月(主${MODEL_FLASH})`;
  console.log(
    `[Wenap] 计费：${freeBilling}；Pro无限/月(主${MODEL_FLASH})；Pro+主模${MODEL_PRO_PLUS}；政策法规不足时同模补刀`,
  );
  if (key) {
    if (SPA_MODE) {
      console.log('[Wenap] OPENROUTER_API_KEY 已配置');
    } else {
      console.log(`[Wenap] OPENROUTER_API_KEY 已载入（长度 ${key.length}）`);
    }
  } else {
    console.warn(
      `[Wenap] OPENROUTER_API_KEY 未载入。请检查 ${ENV_PATH}（UTF-8、OPENROUTER_API_KEY=...）并重启本进程。`,
    );
  }
  const av = getAlphaVantageKey();
  if (av) {
    console.log(`[Wenap] ALPHA_VANTAGE_API_KEY 已载入（长度 ${av.length}），分析前将拉取 GLOBAL_QUOTE+OVERVIEW`);
  } else {
    console.log('[Wenap] 未配置 ALPHA_VANTAGE_API_KEY，跳过行情快照（可在 .env 添加）');
  }
});
