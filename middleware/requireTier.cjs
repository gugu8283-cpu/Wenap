const authDb = require('../db/auth.cjs');

const RANK = { free: 0, pro: 1, pro_plus: 2, proplus: 2 };

function tierRank(tier) {
  const t = String(tier || 'free').toLowerCase();
  return RANK[t] ?? 0;
}

function requireTier(minTier) {
  const min = tierRank(minTier);
  return (req, res, next) => {
    if (!req.authUser?.id) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    const tier = authDb.normalizeTier(req.authUser.tier);
    if (tierRank(tier) < min) {
      return res.status(403).json({
        error: 'TIER_REQUIRED',
        required: minTier,
        tier,
      });
    }
    req.authTier = tier;
    return next();
  };
}

module.exports = { requireTier, tierRank };
