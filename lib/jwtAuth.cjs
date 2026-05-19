const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'wenap-dev-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      tier: user.tier,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

module.exports = { signAccessToken, verifyAccessToken, JWT_EXPIRES };
