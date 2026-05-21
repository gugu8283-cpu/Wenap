/**
 * Admin API auth: Bearer ADMIN_SECRET + optional IP allowlist, PIN (2nd factor), lockout after failed attempts.
 */
function getAdminSecret() {
  return String(process.env.ADMIN_SECRET || '').trim();
}

function getAdminPin() {
  return String(process.env.ADMIN_PIN || '').trim();
}

function parseIpAllowlist() {
  const raw = String(process.env.ADMIN_IP_ALLOWLIST || '').trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeIp(ip) {
  const s = String(ip || '').trim();
  if (s.startsWith('::ffff:')) return s.slice(7);
  return s;
}

function ipAllowed(clientIp, allowlist) {
  if (!allowlist.length) return true;
  const ip = normalizeIp(clientIp);
  return allowlist.some((entry) => entry === ip || ip === entry);
}

const LOCKOUT_MAX = Math.min(20, Math.max(3, Number(process.env.ADMIN_LOCKOUT_MAX) || 10));
const LOCKOUT_MS = Math.max(60_000, Number(process.env.ADMIN_LOCKOUT_MS) || 30 * 60_000);
const failByIp = new Map();

function getClientIp(req) {
  return normalizeIp(req.ip || req.socket?.remoteAddress || 'unknown');
}

function isLocked(ip) {
  const row = failByIp.get(ip);
  if (!row) return false;
  if (row.lockedUntil && Date.now() < row.lockedUntil) return true;
  if (row.lockedUntil && Date.now() >= row.lockedUntil) {
    failByIp.delete(ip);
    return false;
  }
  return false;
}

function recordFailure(ip) {
  const row = failByIp.get(ip) || { count: 0, lockedUntil: 0 };
  row.count += 1;
  if (row.count >= LOCKOUT_MAX) {
    row.lockedUntil = Date.now() + LOCKOUT_MS;
    row.count = 0;
  }
  failByIp.set(ip, row);
}

function clearFailures(ip) {
  failByIp.delete(ip);
}

/** Gate /admin SPA + /admin-api — IP allowlist only (no secret on GET HTML). */
function adminPathIpGate(req, res, next) {
  const allowlist = parseIpAllowlist();
  if (!allowlist.length) return next();
  const ip = getClientIp(req);
  if (!ipAllowed(ip, allowlist)) {
    return res.status(403).json({ error: 'ADMIN_IP_FORBIDDEN', message: 'Forbidden' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  const secret = getAdminSecret();
  if (!secret) {
    return res.status(503).json({ error: 'ADMIN_SECRET 未配置' });
  }

  const ip = getClientIp(req);
  const allowlist = parseIpAllowlist();
  if (allowlist.length && !ipAllowed(ip, allowlist)) {
    return res.status(403).json({ error: 'ADMIN_IP_FORBIDDEN', message: 'Forbidden' });
  }

  if (isLocked(ip)) {
    return res.status(429).json({ error: 'ADMIN_LOCKED', message: 'Too many failed attempts' });
  }

  const pinRequired = getAdminPin();
  if (pinRequired) {
    const pin = String(req.headers['x-admin-pin'] || '').trim();
    if (pin !== pinRequired) {
      recordFailure(ip);
      return res.status(401).json({ error: '未授权' });
    }
  }

  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) {
    recordFailure(ip);
    return res.status(401).json({ error: '未授权' });
  }

  clearFailures(ip);
  return next();
}

module.exports = {
  requireAdmin,
  adminPathIpGate,
  getAdminSecret,
  parseIpAllowlist,
  getClientIp,
};
