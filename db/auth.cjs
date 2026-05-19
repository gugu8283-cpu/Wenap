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

async function createUserWithPassword({ email, password, ip }) {
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
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const monthStart = utcMonthStartIso();
  const externalKey = `email:${email.toLowerCase()}`;

  db.prepare(
    `INSERT INTO users (
      id, external_key, email, password_hash, tier, email_verified,
      email_verify_token, email_verify_expires, free_trials_used, free_trials_limit,
      free_trials_reset_at, verify_email_sent_at, created_at, last_active_at
    ) VALUES (?, ?, ?, ?, 'free', 0, ?, ?, 0, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
  ).run(id, externalKey, email.toLowerCase(), passwordHash, verifyToken, expires, FREE_MONTHLY_CAP, monthStart);

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
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
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

const PRO_PLUS_DAILY_CAP = parseInt(String(process.env.WENAP_PRO_PLUS_DAILY_CAP || '30'), 10) || 30;

function checkProPlusDailyLimit(userId) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM analysis_logs WHERE user_id = ? AND DATE(created_at) = ?`,
    )
    .get(userId, today);
  const cnt = Number(row?.cnt || 0);
  if (cnt >= PRO_PLUS_DAILY_CAP) {
    return { allowed: false, used: cnt, cap: PRO_PLUS_DAILY_CAP };
  }
  return { allowed: true, used: cnt, cap: PRO_PLUS_DAILY_CAP };
}

function checkUserCanAnalyze(user, fingerprint, ip) {
  const tier = normalizeTier(user.tier);
  const unlimited =
    process.env.WENAP_FREE_UNLIMITED === '1' || process.env.WENAP_FREE_UNLIMITED === 'true';
  if (unlimited) {
    return { allowed: true, tier, reason: null };
  }
  if (tier === 'pro_plus') {
    const dailyCheck = checkProPlusDailyLimit(user.id);
    if (!dailyCheck.allowed) {
      return {
        allowed: false,
        tier,
        error: 'PRO_PLUS_DAILY_CAP',
        message: `Pro+ daily limit reached (${dailyCheck.cap} analyses/day). Resets at midnight UTC.`,
      };
    }
    return { allowed: true, tier, reason: null };
  }
  if (tier === 'pro') {
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
  incrementUserFreeUsage(userId);
  if (DEVICE_FINGERPRINT_ENABLED) {
    incrementDeviceFreeUsage(fingerprint);
    bindUserDevice(userId, fingerprint);
  }
  incrementIpAnalysis(ip);
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
  FREE_MONTHLY_CAP,
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
