const { verifyAccessToken } = require('../lib/jwtAuth.cjs');
const { getUserById, publicUser, enforceReferralProExpiryIfNeeded } = require('../db/auth.cjs');
const MSG = require('../lib/apiMessages.cjs');

function extractBearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return '';
}

function requireAuth(req, res, next) {
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
    return res.status(401).json({ error: 'UNAUTHORIZED', message: MSG.UNAUTHORIZED });
  }
  const user = enforceReferralProExpiryIfNeeded(getUserById(payload.sub));
  if (!user) {
    return res.status(401).json({
      error: 'SESSION_STALE',
      message: MSG.SESSION_STALE,
    });
  }
  if (user.is_banned) {
    return res.status(403).json({ error: 'BANNED', message: MSG.BANNED });
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
