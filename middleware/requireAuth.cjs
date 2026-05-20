const { verifyAccessToken } = require('../lib/jwtAuth.cjs');
const { getUserById, publicUser, enforceReferralProExpiryIfNeeded } = require('../db/auth.cjs');

function extractBearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return '';
}

function requireAuth(req, res, next) {
  /** Scheduled jobs: X-Wenap-Cron-Secret + CRON_SERVICE_USER_ID (no JWT). */
  const cronSecret = String(process.env.WENAP_CRON_SECRET || '').trim();
  const cronUserId = String(process.env.CRON_SERVICE_USER_ID || '').trim();
  const hdr = String(req.headers['x-wenap-cron-secret'] || '').trim();
  if (cronSecret.length >= 8 && cronUserId && hdr === cronSecret) {
    const user = enforceReferralProExpiryIfNeeded(getUserById(cronUserId));
    if (!user || user.is_banned) {
      return res.status(403).json({ error: 'CRON_AUTH_FAILED', message: 'Invalid cron service user' });
    }
    req.authUser = user;
    req.authPublic = publicUser(user);
    req.authCron = true;
    return next();
  }

  const token = extractBearer(req);
  const payload = verifyAccessToken(token);
  if (!payload?.sub) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '请先登录' });
  }
  const user = enforceReferralProExpiryIfNeeded(getUserById(payload.sub));
  if (!user) {
    return res.status(401).json({
      error: 'SESSION_STALE',
      message: '登录已失效，请重新登录（内测环境重新部署后需重新登录）',
    });
  }
  if (user.is_banned) {
    return res.status(403).json({ error: 'BANNED', message: '账号已被限制' });
  }
  req.authUser = user;
  req.authPublic = publicUser(user);
  next();
}

function optionalAuth(req, res, next) {
  const token = extractBearer(req);
  const payload = verifyAccessToken(token);
  if (payload?.sub) {
    const user = enforceReferralProExpiryIfNeeded(getUserById(payload.sub));
    if (user && !user.is_banned) {
      req.authUser = user;
      req.authPublic = publicUser(user);
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, extractBearer };
