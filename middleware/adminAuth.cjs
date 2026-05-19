function getAdminSecret() {
  return String(process.env.ADMIN_SECRET || '').trim();
}

function requireAdmin(req, res, next) {
  const secret = getAdminSecret();
  if (!secret) {
    return res.status(503).json({ error: 'ADMIN_SECRET 未配置' });
  }
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) {
    return res.status(401).json({ error: '未授权' });
  }
  return next();
}

module.exports = { requireAdmin, getAdminSecret };
