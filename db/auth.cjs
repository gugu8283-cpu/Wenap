const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { initDb } = require('./store.cjs');

function getDb() {
  return initDb();
}

const BCRYPT_ROUNDS = 12;
const FREE_MONTHLY_CAP = 5;
const DEVICE_FREE_CAP = 10;
/** 设为 1 启用设备指纹累计免费次数限制（默认关闭） */
const DEVICE_FINGERPRINT_ENABLED =
  process.env.WENAP_DEVICE_FINGERPRINT === '1' || process.env.WENAP_DEVICE_FINGERPRINT === 'true';
const IP_REGISTER_DAILY_CAP = 3;
const IP_ANALYSIS_HOURLY_CAP = 20;
const VERIFY_TTL_MS = Number(process.env.EMAIL_VERIFY_TTL_MS) || 24 * 60 * 60 * 1000;

function uuid() {
  return crypto.randomUUID();
}

function utcMonthStartIso() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString();
}

function normalizeTier(tier) {
  const t = String(tier || 'free').toLowerCase();
  if (t === 'pro_plus' || t === 'proplus') return 'pro_plus';
  if (t === 'pro') return 'pro';
  return 'free';
}

function migrateAuthSchema(dbIn) {
  const db = dbIn || getDb();
  const userCols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  const addCol = (sql) => {
    try {
      db.exec(sql);
    } catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  };
  if (!userCols.includes('email_verified')) addCol('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
  if (!userCols.includes('email_verify_token')) addCol('ALTER TABLE users ADD COLUMN email_verify_token TEXT');
  if (!userCols.includes('email_verify_expires')) addCol('ALTER TABLE users ADD COLUMN email_verify_expires TEXT');
  if (!userCols.includes('google_id')) addCol('ALTER TABLE users ADD COLUMN google_id TEXT');
  if (!userCols.includes('password_hash')) addCol('ALTER TABLE users ADD COLUMN password_hash TEXT');
  if (!userCols.includes('phone_verified')) addCol('ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0');
  if (!userCols.includes('free_trials_reset_at')) {
    addCol(`ALTER TABLE users ADD COLUMN free_trials_reset_at TEXT DEFAULT '${utcMonthStartIso()}'`);
  }
  if (!userCols.includes('device_fingerprint')) addCol('ALTER TABLE users ADD COLUMN device_fingerprint TEXT');
  if (!userCols.includes('verify_email_sent_at')) addCol('ALTER TABLE users ADD COLUMN verify_email_sent_at TEXT');
  if (!userCols.includes('referrer_id')) addCol('ALTER TABLE users ADD COLUMN referrer_id TEXT');
  if (!userCols.includes('referral_bonus_until')) addCol('ALTER TABLE users ADD COLUMN referral_bonus_until TEXT');
  if (!userCols.includes('register_ip')) addCol('ALTER TABLE users ADD COLUMN register_ip TEXT');
  if (!userCols.includes('country_code')) addCol('ALTER TABLE users ADD COLUMN country_code TEXT');
  try {
    require('../lib/legalConsent.cjs').migrateLegalConsentSchema(db);
  } catch (e) {
    console.warn('[Wenap] legal consent schema migrate:', e.message);
  }

  try {
    db.exec(`CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      referee_id TEXT NOT NULL,
      rewarded INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  } catch (e) {
    if (!/already exists/i.test(e.message)) throw e;
  }
  try {
    const refCols = db.prepare('PRAGMA table_info(referrals)').all().map((c) => c.name);
    if (refCols.length && !refCols.includes('rewarded')) {
      addCol('ALTER TABLE referrals ADD COLUMN rewarded INTEGER DEFAULT 0');
    }
  } catch {
    /* ignore */
  }
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_referrals_referee ON referrals(referee_id)');
  } catch {
    /* ignore */
  }

  const authSql = require('fs').readFileSync(require('path').join(__dirname, 'schema-auth.sql'), 'utf8');
  db.exec(authSql);
}

function getUserById(id) {
  initDb();
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getUserByEmail(email) {
  initDb();
  return getDb()
    .prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
    .get(String(email || '').trim());
}

function resetMonthlyFreeIfNeeded(user) {
  const db = getDb();
  const monthStart = utcMonthStartIso();
  const resetAt = user.free_trials_reset_at || '';
  if (!resetAt || resetAt < monthStart) {
    db.prepare(
      `UPDATE users SET free_trials_used = 0, free_trials_reset_at = ? WHERE id = ?`,
    ).run(monthStart, user.id);
    return { ...user, free_trials_used: 0, free_trials_reset_at: monthStart };
  }
  return user;
}

function hasPaidStripeSubscription(userId) {
  if (!userId) return false;
  try {
    const { getBillingByUserId } = require('../routes/billingDb.cjs');
    const b = getBillingByUserId(userId);
    if (!b?.stripe_subscription_id) return false;
    const st = String(b.status || '').toLowerCase();
    return st === 'active' || st === 'trialing' || st === 'past_due';
  } catch {
    return false;
  }
}

/** Downgrade referral-granted Pro when bonus window ended (Stripe Pro unchanged). */
function enforceReferralProExpiryIfNeeded(user) {
  if (!user) return user;
  const tier = normalizeTier(user.tier);
  if (tier !== 'pro') return user;
  if (!user.referral_bonus_until) return user;
  if (hasPaidStripeSubscription(user.id)) return user;
  const now = new Date().toISOString();
  if (user.referral_bonus_until >= now) return user;
  getDb().prepare(`UPDATE users SET tier = 'free', referral_bonus_until = NULL WHERE id = ?`).run(user.id);
  return getUserById(user.id);
}

function recordPendingReferral({ refereeId, referrerId }) {
  if (!refereeId || !referrerId || refereeId === referrerId) return;
  initDb();
  const db = getDb();
  db.prepare(`UPDATE users SET referrer_id = ? WHERE id = ?`).run(referrerId, refereeId);
  try {
    db.prepare(
      `INSERT OR IGNORE INTO referrals (id, referrer_id, referee_id, rewarded, created_at)
       VALUES (?, ?, ?, 0, datetime('now'))`,
    ).run(uuid(), referrerId, refereeId);
  } catch (e) {
    if (!/UNIQUE|unique/i.test(e.message)) console.warn('[Wenap] recordPendingReferral:', e.message);
  }
}

function applyReferralRewardsOnVerify(refereeId) {
  initDb();
  const db = getDb();
  const refUser = getUserById(refereeId);
  if (!refUser?.referrer_id) return;
  const refRow = db
    .prepare('SELECT * FROM referrals WHERE referee_id = ? AND (rewarded IS NULL OR rewarded = 0)')
    .get(refereeId);
  if (!refRow) return;

  /** 关闭推荐送 Pro：不占额度、不写 tier；仍标记已处理避免重复跑 */
  const rewardsOff = ['0', 'false', 'off', 'no'].includes(String(process.env.WENAP_REFERRAL_REWARDS || '').trim().toLowerCase());
  if (rewardsOff) {
    db.prepare(`UPDATE referrals SET rewarded = 1 WHERE id = ?`).run(refRow.id);
    return;
  }

  const referrer = getUserById(refUser.referrer_id);
  if (!referrer || referrer.id === refereeId) return;

  const defaultUntil = new Date(Date.now() + 30 * 86400000).toISOString();

  function grantOrExtend(u) {
    if (!u) return;
    if (normalizeTier(u.tier) === 'pro_plus') return;
    if (hasPaidStripeSubscription(u.id)) return;
    const t = normalizeTier(u.tier);
    if (t === 'free') {
      db.prepare(
        `UPDATE users SET tier = 'pro', referral_bonus_until = ?, last_active_at = datetime('now') WHERE id = ?`,
      ).run(defaultUntil, u.id);
      return;
    }
    if (t === 'pro') {
      const prevMs = u.referral_bonus_until ? new Date(u.referral_bonus_until).getTime() : 0;
      const nextUntil = new Date(Math.max(Date.now(), prevMs) + 30 * 86400000).toISOString();
      db.prepare(
        `UPDATE users SET tier = 'pro', referral_bonus_until = ?, last_active_at = datetime('now') WHERE id = ?`,
      ).run(nextUntil, u.id);
    }
  }

  grantOrExtend(referrer);
  grantOrExtend(refUser);
  db.prepare(`UPDATE referrals SET rewarded = 1 WHERE id = ?`).run(refRow.id);
}

function publicUser(row) {
  if (!row) return null;
  const tier = normalizeTier(row.tier);
  let u = resetMonthlyFreeIfNeeded(row);
  const limit = tier === 'free' ? FREE_MONTHLY_CAP : Number(u.free_trials_limit) || 999999;
  const used = Number(u.free_trials_used) || 0;
  const remaining = tier === 'free' ? Math.max(0, limit - used) : null;
  return {
    id: u.id,
    email: u.email,
    tier,
    emailVerified: Boolean(u.email_verified),
    freeTrialsUsed: used,
    freeTrialsLimit: limit,
    freeTrialsRemaining: remaining,
    freeTrialsResetAt: u.free_trials_reset_at,
    createdAt: u.created_at,
    legal: require('../lib/legalConsent.cjs').legalStatusForUser(u),
  };
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim().slice(0, 45);
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 45);
}

function utcDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function utcHourKey() {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

function checkIpRegisterLimit(ip) {
  initDb();
  const db = getDb();
  const today = utcDateStr();
  const row = db
    .prepare('SELECT register_count FROM ip_register_daily WHERE ip = ? AND register_date = ?')
    .get(ip, today);
  const count = row?.register_count || 0;
  if (count >= IP_REGISTER_DAILY_CAP) {
    return { allowed: false, count, cap: IP_REGISTER_DAILY_CAP };
  }
  return { allowed: true, count, cap: IP_REGISTER_DAILY_CAP };
}

function incrementIpRegister(ip) {
  initDb();
  const db = getDb();
  const today = utcDateStr();
  db.prepare(
    `INSERT INTO ip_register_daily (ip, register_date, register_count) VALUES (?, ?, 1)
     ON CONFLICT(ip, register_date) DO UPDATE SET register_count = register_count + 1`,
  ).run(ip, today);
}

function checkIpAnalysisLimit(ip) {
  initDb();
  const db = getDb();
  const hour = utcHourKey();
  const rows = db
    .prepare('SELECT analysis_count AS c FROM ip_analysis_hourly WHERE ip = ? AND analysis_hour = ?')
    .get(ip, hour);
  const count = rows?.c || 0;
  if (count >= IP_ANALYSIS_HOURLY_CAP) {
    return { allowed: false, count, cap: IP_ANALYSIS_HOURLY_CAP };
  }
  return { allowed: true, count, cap: IP_ANALYSIS_HOURLY_CAP };
}

function incrementIpAnalysis(ip) {
  initDb();
  const db = getDb();
  const hour = utcHourKey();
  db.prepare(
    `INSERT INTO ip_analysis_hourly (ip, analysis_hour, analysis_count) VALUES (?, ?, 1)
     ON CONFLICT(ip, analysis_hour) DO UPDATE SET analysis_count = analysis_count + 1`,
  ).run(ip, hour);
}

function checkDeviceFreeLimit(fingerprint) {
  if (!fingerprint) return { allowed: true, used: 0, cap: DEVICE_FREE_CAP };
  initDb();
  const db = getDb();
  const row = db
    .prepare('SELECT total_free_used FROM device_fingerprints WHERE fingerprint = ?')
    .get(fingerprint);
  const used = row?.total_free_used || 0;
  if (used >= DEVICE_FREE_CAP) {
    return { allowed: false, used, cap: DEVICE_FREE_CAP };
  }
  return { allowed: true, used, cap: DEVICE_FREE_CAP };
}

function touchDeviceFingerprint(fingerprint) {
  if (!fingerprint) return;
  initDb();
  const db = getDb();
  db.prepare(
    `INSERT INTO device_fingerprints (fingerprint, total_free_used, first_seen_at, last_seen_at)
     VALUES (?, 0, datetime('now'), datetime('now'))
     ON CONFLICT(fingerprint) DO UPDATE SET last_seen_at = datetime('now')`,
  ).run(fingerprint.slice(0, 64));
}

function incrementDeviceFreeUsage(fingerprint) {
  if (!fingerprint) return;
  initDb();
  const db = getDb();
  touchDeviceFingerprint(fingerprint);
  db.prepare(
    `UPDATE device_fingerprints SET total_free_used = total_free_used + 1, last_seen_at = datetime('now')
     WHERE fingerprint = ?`,
  ).run(fingerprint.slice(0, 64));
}

function bindUserDevice(userId, fingerprint) {
  if (!fingerprint) return;
  initDb();
  getDb()
    .prepare(`UPDATE users SET device_fingerprint = ?, last_active_at = datetime('now') WHERE id = ?`)
    .run(fingerprint.slice(0, 64), userId);
}

function canResendVerifyEmail(user) {
  if (!user?.verify_email_sent_at) return true;
  const last = new Date(user.verify_email_sent_at).getTime();
  return Date.now() - last >= 60_000;
}

async function createUserWithPassword({ email, password, ip, countryCode }) {
  initDb();
  const db = getDb();
  const existing = getUserByEmail(email);
  if (existing) {
    const err = new Error('EMAIL_EXISTS');
    err.code = 'EMAIL_EXISTS';
    throw err;
  }
  const ipCheck = checkIpRegisterLimit(ip);
  if (!ipCheck.allowed) {
    const err = new Error('IP_REGISTER_LIMIT');
    err.code = 'IP_REGISTER_LIMIT';
    throw err;
  }
  const id = uuid();
  const passwordHash = await hashPassword(password);
  const verifyToken = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + VERIFY_TTL_MS).toISOString();
  const monthStart = utcMonthStartIso();
  const externalKey = `email:${email.toLowerCase()}`;

  const regIp = String(ip || '').slice(0, 45);
  const cc = countryCode ? String(countryCode).slice(0, 2).toUpperCase() : null;

  db.prepare(
    `INSERT INTO users (
      id, external_key, email, password_hash, tier, email_verified,
      email_verify_token, email_verify_expires, free_trials_used, free_trials_limit,
      free_trials_reset_at, verify_email_sent_at, register_ip, country_code,
      created_at, last_active_at
    ) VALUES (?, ?, ?, ?, 'free', 0, ?, ?, 0, ?, ?, datetime('now'), ?, ?, datetime('now'), datetime('now'))`,
  ).run(
    id,
    externalKey,
    email.toLowerCase(),
    passwordHash,
    verifyToken,
    expires,
    FREE_MONTHLY_CAP,
    monthStart,
    regIp || null,
    cc,
  );

  incrementIpRegister(ip);
  return { user: getUserById(id), verifyToken };
}

function setVerifyEmailSent(userId) {
  initDb();
  getDb()
    .prepare(`UPDATE users SET verify_email_sent_at = datetime('now') WHERE id = ?`)
    .run(userId);
}

function refreshVerifyToken(userId) {
  initDb();
  const verifyToken = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + VERIFY_TTL_MS).toISOString();
  getDb()
    .prepare(
      `UPDATE users SET email_verify_token = ?, email_verify_expires = ?, verify_email_sent_at = datetime('now') WHERE id = ?`,
    )
    .run(verifyToken, expires, userId);
  return verifyToken;
}

function verifyEmailByToken(token) {
  initDb();
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM users WHERE email_verify_token = ?')
    .get(String(token || '').trim());
  if (!row) {
    const err = new Error('INVALID_TOKEN');
    err.code = 'INVALID_TOKEN';
    throw err;
  }
  if (row.email_verified) return getUserById(row.id);
  if (row.email_verify_expires && row.email_verify_expires < new Date().toISOString()) {
    const err = new Error('TOKEN_EXPIRED');
    err.code = 'TOKEN_EXPIRED';
    throw err;
  }
  db.prepare(
    `UPDATE users SET email_verified = 1, email_verify_token = NULL, email_verify_expires = NULL WHERE id = ?`,
  ).run(row.id);
  try {
    applyReferralRewardsOnVerify(row.id);
  } catch (e) {
    console.warn('[Wenap] referral reward:', e.message);
  }
  return getUserById(row.id);
}

function incrementUserFreeUsage(userId) {
  initDb();
  getDb()
    .prepare(
      `UPDATE users SET free_trials_used = free_trials_used + 1, last_active_at = datetime('now') WHERE id = ?`,
    )
    .run(userId);
}

const PRO_PLUS_MONTHLY_CAP =
  parseInt(String(process.env.WENAP_PRO_PLUS_MONTHLY_CAP || '1000'), 10) || 1000;
const PRO_MONTHLY_PROFIT_THRESHOLD =
  parseInt(String(process.env.WENAP_PRO_MONTHLY_PROFIT_THRESHOLD || '500'), 10) || 500;
const PRO_PLUS_MONTHLY_PROFIT_THRESHOLD =
  parseInt(String(process.env.WENAP_PRO_PLUS_MONTHLY_PROFIT_THRESHOLD || '450'), 10) || 450;
const PRO_HOURLY_LIMIT_AFTER_THRESHOLD =
  parseInt(String(process.env.WENAP_PRO_HOURLY_LIMIT_AFTER_THRESHOLD || '40'), 10) || 40;
const PRO_PLUS_HOURLY_LIMIT_AFTER_THRESHOLD =
  parseInt(String(process.env.WENAP_PRO_PLUS_HOURLY_LIMIT_AFTER_THRESHOLD || '25'), 10) || 25;
const PAID_COOLDOWN_MINUTES =
  parseInt(String(process.env.WENAP_PAID_COOLDOWN_MINUTES || '20'), 10) || 20;

function toUtcDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function checkProPlusMonthlyLimit(userId) {
  const db = getDb();
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM in UTC
  const row = db
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM analysis_logs
       WHERE user_id = ?
         AND strftime('%Y-%m', created_at) = ?`,
    )
    .get(userId, month);
  const cnt = Number(row?.cnt || 0);
  if (cnt >= PRO_PLUS_MONTHLY_CAP) {
    return { allowed: false, used: cnt, cap: PRO_PLUS_MONTHLY_CAP };
  }
  return { allowed: true, used: cnt, cap: PRO_PLUS_MONTHLY_CAP };
}

function checkPaidThrottle(userId, tier) {
  const t = normalizeTier(tier);
  if (t !== 'pro' && t !== 'pro_plus') return { allowed: true };
  const db = getDb();
  const month = new Date().toISOString().slice(0, 7);
  const monthRow = db
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM analysis_logs
       WHERE user_id = ?
         AND strftime('%Y-%m', created_at) = ?`,
    )
    .get(userId, month);
  const monthlyUsed = Number(monthRow?.cnt || 0);
  const threshold = t === 'pro_plus' ? PRO_PLUS_MONTHLY_PROFIT_THRESHOLD : PRO_MONTHLY_PROFIT_THRESHOLD;
  if (monthlyUsed < threshold) return { allowed: true, monthlyUsed, threshold, throttled: false };

  const hourlyCap = t === 'pro_plus' ? PRO_PLUS_HOURLY_LIMIT_AFTER_THRESHOLD : PRO_HOURLY_LIMIT_AFTER_THRESHOLD;
  const hourRow = db
    .prepare(
      `SELECT COUNT(*) as cnt, MAX(created_at) as latest
       FROM analysis_logs
       WHERE user_id = ?
         AND datetime(created_at) >= datetime('now', '-60 minutes')`,
    )
    .get(userId);
  const hourCount = Number(hourRow?.cnt || 0);
  if (hourCount < hourlyCap) {
    return { allowed: true, monthlyUsed, threshold, throttled: true, hourCount, hourlyCap };
  }
  const latest = toUtcDate(hourRow?.latest);
  if (!latest) {
    return { allowed: false, monthlyUsed, threshold, throttled: true, hourCount, hourlyCap, waitMinutes: PAID_COOLDOWN_MINUTES };
  }
  const cooldownUntil = new Date(latest.getTime() + PAID_COOLDOWN_MINUTES * 60 * 1000);
  const waitMs = cooldownUntil.getTime() - Date.now();
  const waitMinutes = Math.max(1, Math.ceil(waitMs / 60000));
  if (waitMs > 0) {
    return { allowed: false, monthlyUsed, threshold, throttled: true, hourCount, hourlyCap, waitMinutes };
  }
  return { allowed: true, monthlyUsed, threshold, throttled: true, hourCount, hourlyCap };
}

function checkUserCanAnalyze(user, fingerprint, ip) {
  const tier = normalizeTier(user.tier);
  const unlimited =
    process.env.WENAP_FREE_UNLIMITED === '1' || process.env.WENAP_FREE_UNLIMITED === 'true';
  if (unlimited) {
    return { allowed: true, tier, reason: null };
  }
  if (tier === 'pro_plus') {
    const monthlyCheck = checkProPlusMonthlyLimit(user.id);
    if (!monthlyCheck.allowed) {
      return {
        allowed: false,
        tier,
        error: 'PRO_PLUS_MONTHLY_CAP',
        message: `Pro+ monthly limit reached (${monthlyCheck.cap} analyses/month). Resets on the 1st of each UTC month.`,
      };
    }
    const throttle = checkPaidThrottle(user.id, tier);
    if (!throttle.allowed) {
      return {
        allowed: false,
        tier,
        error: 'PAID_COOLDOWN',
        message: `High-frequency usage detected. Please retry in about ${throttle.waitMinutes || PAID_COOLDOWN_MINUTES} minutes.`,
      };
    }
    return { allowed: true, tier, reason: null };
  }
  if (tier === 'pro') {
    const throttle = checkPaidThrottle(user.id, tier);
    if (!throttle.allowed) {
      return {
        allowed: false,
        tier,
        error: 'PAID_COOLDOWN',
        message: `High-frequency usage detected. Please retry in about ${throttle.waitMinutes || PAID_COOLDOWN_MINUTES} minutes.`,
      };
    }
    return { allowed: true, tier, reason: null };
  }
  const u = resetMonthlyFreeIfNeeded(user);
  const monthlyUsed = Number(u.free_trials_used) || 0;
  if (monthlyUsed >= FREE_MONTHLY_CAP) {
    return {
      allowed: false,
      tier,
      error: 'FREE_QUOTA_EXCEEDED',
      message: `本月免费分析次数已用尽（${FREE_MONTHLY_CAP} 次/月，每月 1 日 UTC 重置）。升级 Pro 继续使用。`,
    };
  }
  if (DEVICE_FINGERPRINT_ENABLED) {
    const dev = checkDeviceFreeLimit(fingerprint);
    if (!dev.allowed) {
      return {
        allowed: false,
        tier,
        error: 'DEVICE_FREE_EXCEEDED',
        message: '此设备免费次数已用完，请升级',
      };
    }
  }
  const ipLim = checkIpAnalysisLimit(ip);
  if (!ipLim.allowed) {
    return {
      allowed: false,
      tier,
      error: 'RATE_LIMIT',
      message: '请求过于频繁，请稍后再试',
    };
  }
  if (!user.email_verified) {
    return {
      allowed: false,
      tier,
      error: 'EMAIL_NOT_VERIFIED',
      message: '请先验证邮箱后再使用分析功能',
    };
  }
  return { allowed: true, tier, remaining: FREE_MONTHLY_CAP - monthlyUsed };
}

function recordFreeAnalysisUsage(userId, fingerprint, ip) {
  const db = getDb();
  const run = db.transaction(() => {
    incrementUserFreeUsage(userId);
    if (DEVICE_FINGERPRINT_ENABLED) {
      incrementDeviceFreeUsage(fingerprint);
      bindUserDevice(userId, fingerprint);
    }
    incrementIpAnalysis(ip);
  });
  run();
}

async function createTestUser({ email, password, tier, emailVerified = true }) {
  initDb();
  const db = getDb();
  const existing = getUserByEmail(email);
  if (existing) {
    db.prepare(
      `UPDATE users SET password_hash = ?, tier = ?, email_verified = ?, free_trials_used = 0,
       free_trials_limit = ?, email_verify_token = NULL, email_verify_expires = NULL WHERE id = ?`,
    ).run(
      await hashPassword(password),
      normalizeTier(tier),
      emailVerified ? 1 : 0,
      tier === 'free' ? FREE_MONTHLY_CAP : 999999,
      existing.id,
    );
    return getUserById(existing.id);
  }
  const id = uuid();
  const passwordHash = await hashPassword(password);
  const limit = tier === 'free' ? FREE_MONTHLY_CAP : 999999;
  db.prepare(
    `INSERT INTO users (
      id, external_key, email, password_hash, tier, email_verified,
      free_trials_used, free_trials_limit, free_trials_reset_at, created_at, last_active_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'), datetime('now'))`,
  ).run(
    id,
    `email:${email.toLowerCase()}`,
    email.toLowerCase(),
    passwordHash,
    normalizeTier(tier),
    emailVerified ? 1 : 0,
    limit,
    utcMonthStartIso(),
  );
  return getUserById(id);
}

module.exports = {
  migrateAuthSchema,
  FREE_MONTHLY_CAP,
  DEVICE_FREE_CAP,
  DEVICE_FINGERPRINT_ENABLED,
  getUserById,
  getUserByEmail,
  publicUser,
  hashPassword,
  verifyPassword,
  getClientIp,
  checkIpRegisterLimit,
  createUserWithPassword,
  setVerifyEmailSent,
  refreshVerifyToken,
  verifyEmailByToken,
  canResendVerifyEmail,
  checkUserCanAnalyze,
  recordFreeAnalysisUsage,
  touchDeviceFingerprint,
  normalizeTier,
  createTestUser,
  utcMonthStartIso,
  setPasswordResetToken,
  getUserByPasswordResetToken,
  consumePasswordResetToken,
  recordPendingReferral,
  enforceReferralProExpiryIfNeeded,
};

function setPasswordResetToken(userId, token) {
  const db = getDb();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare(
    `UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?`,
  ).run(token, expires, userId);
}

function getUserByPasswordResetToken(token) {
  const db = getDb();
  // Ensure columns exist
  try {
    db.exec(`ALTER TABLE users ADD COLUMN password_reset_token TEXT`);
  } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN password_reset_expires TEXT`);
  } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }
  if (!token) return null;
  const row = db.prepare(`SELECT * FROM users WHERE password_reset_token = ?`).get(token);
  if (!row) return null;
  if (row.password_reset_expires && new Date(row.password_reset_expires) < new Date()) return null;
  return row;
}

function consumePasswordResetToken(userId, newPasswordHash) {
  const db = getDb();
  db.prepare(
    `UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?`,
  ).run(newPasswordHash, userId);
}
