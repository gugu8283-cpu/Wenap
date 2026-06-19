/** Exclude test / internal users from public-facing stats (social proof, accuracy page). */

function excludedUsersWhere(alias = '') {
  const p = alias ? `${alias}.` : '';
  return `(
    COALESCE(${p}exclude_from_public_stats, 0) = 1
    OR LOWER(COALESCE(${p}email, '')) LIKE '%@wenap.test'
    OR COALESCE(${p}external_key, '') LIKE 'demo-%'
    OR (
      COALESCE(${p}external_key, '') LIKE 'uid:%'
      AND TRIM(COALESCE(${p}email, '')) = ''
    )
  )`;
}

function excludedUserIdsSubquery() {
  return `SELECT id FROM users WHERE ${excludedUsersWhere()}`;
}

function userIncludedInPublicStats(userIdCol) {
  return `(${userIdCol} IS NULL OR ${userIdCol} NOT IN (${excludedUserIdsSubquery()}))`;
}

function predictionIncludedInPublicStats(userAlias = 'p') {
  return userIncludedInPublicStats(`${userAlias}.user_id`);
}

function analysisLogIncludedInPublicStats(logAlias = '') {
  const col = logAlias ? `${logAlias}.user_id` : 'user_id';
  return userIncludedInPublicStats(col);
}

function markAutoExcludedTestUsers(db) {
  db.prepare(
    `UPDATE users SET exclude_from_public_stats = 1
     WHERE LOWER(COALESCE(email, '')) LIKE '%@wenap.test'
        OR COALESCE(external_key, '') LIKE 'demo-%'`,
  ).run();
}

module.exports = {
  excludedUsersWhere,
  excludedUserIdsSubquery,
  userIncludedInPublicStats,
  predictionIncludedInPublicStats,
  analysisLogIncludedInPublicStats,
  markAutoExcludedTestUsers,
};
