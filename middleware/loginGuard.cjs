/** Login brute-force guard: lock IP after repeated failed logins. */
const MAX = Math.min(20, Math.max(3, Number(process.env.LOGIN_LOCKOUT_MAX) || 10));
const LOCK_MS = Math.max(60_000, Number(process.env.LOGIN_LOCKOUT_MS) || 30 * 60_000);
const failByIp = new Map();

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function isLoginLocked(ip) {
  const row = failByIp.get(ip);
  if (!row?.lockedUntil) return false;
  if (Date.now() < row.lockedUntil) return true;
  failByIp.delete(ip);
  return false;
}

function recordLoginFail(ip) {
  const row = failByIp.get(ip) || { count: 0, lockedUntil: 0 };
  row.count += 1;
  if (row.count >= MAX) {
    row.lockedUntil = Date.now() + LOCK_MS;
    row.count = 0;
  }
  failByIp.set(ip, row);
}

function clearLoginFail(ip) {
  failByIp.delete(ip);
}

module.exports = { clientIp, isLoginLocked, recordLoginFail, clearLoginFail };
