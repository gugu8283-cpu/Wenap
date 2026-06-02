const Redis = require('ioredis');

const mem = new Map();
let redis = null;
let redisReady = false;
let warned = false;
let connectStarted = false;

function redisUrl() {
  return String(process.env.REDIS_URL || '').trim();
}

function redisConfigured() {
  return Boolean(redisUrl());
}

function ensureRedis() {
  if (!redisConfigured()) return null;
  if (redis) return redis;
  const url = redisUrl();
  try {
    redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: 4000,
    });
    redis.on('ready', () => {
      redisReady = true;
    });
    redis.on('error', (e) => {
      redisReady = false;
      if (!warned) {
        warned = true;
        console.warn('[Wenap] Redis error, fallback to memory cache:', e?.message || e);
      }
    });
    if (!connectStarted) {
      connectStarted = true;
      redis.connect().catch(() => {
        /* will fall back to memory and retry on demand */
      });
    }
  } catch (e) {
    if (!warned) {
      warned = true;
      console.warn('[Wenap] Redis init failed, fallback to memory cache:', e?.message || e);
    }
    redis = null;
  }
  return redis;
}

async function getCachedJson(key) {
  const k = String(key || '').trim();
  if (!k) return null;
  const r = ensureRedis();
  if (r) {
    try {
      if (r.status !== 'ready') {
        await r.connect();
      }
      const raw = await r.get(k);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed;
    } catch {
      // fall through
    }
  }
  const hit = mem.get(k);
  if (!hit) return null;
  if (Date.now() > hit.expAt) {
    mem.delete(k);
    return null;
  }
  return hit.value;
}

async function setCachedJson(key, value, ttlSec = 900) {
  const k = String(key || '').trim();
  if (!k) return;
  const ttl = Math.max(10, Number.parseInt(String(ttlSec || 900), 10) || 900);
  const r = ensureRedis();
  if (r) {
    try {
      if (r.status !== 'ready') {
        await r.connect();
      }
      await r.set(k, JSON.stringify(value), 'EX', ttl);
      return;
    } catch {
      // fall through
    }
  }
  if (mem.size > 1500) mem.clear();
  mem.set(k, { expAt: Date.now() + ttl * 1000, value });
}

function cacheBackendLabel() {
  if (!redisConfigured()) return 'memory';
  return redisReady ? 'redis' : 'redis_connecting';
}

module.exports = {
  redisConfigured,
  getCachedJson,
  setCachedJson,
  cacheBackendLabel,
};
