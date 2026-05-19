const { verifyAccessToken } = require('../lib/jwtAuth.cjs');
const { getUserById, publicUser } = require('../db/auth.cjs');

function extractBearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return '';
}

function requireAuth(req, res, next) {
  const token = extractBearer(req);
  const payload = verifyAccessToken(token);
  if (!payload?.sub) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '请先登录' });
  }
  const user = getUserById(payload.sub);
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
    const user = getUserById(payload.sub);
    if (user && !user.is_banned) {
      req.authUser = user;
      req.authPublic = publicUser(user);
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, extractBearer };
