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
  if (!user || user.is_banned) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: '账号无效或已封禁' });
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
