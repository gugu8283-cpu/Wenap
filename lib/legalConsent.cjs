const crypto = require('crypto');
const { initDb } = require('../db/store.cjs');
const { currentVersions, versionForDoc } = require('./legalVersions.cjs');

function uuid() {
  return crypto.randomUUID();
}

function migrateLegalConsentSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS legal_consent_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      version TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(
    'CREATE INDEX IF NOT EXISTS ix_legal_consent_user ON legal_consent_log(user_id, doc_type, created_at)',
  );

  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  const addCol = (sql) => {
    try {
      db.exec(sql);
    } catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  };
  if (!cols.includes('terms_accepted_at')) addCol('ALTER TABLE users ADD COLUMN terms_accepted_at TEXT');
  if (!cols.includes('terms_version')) addCol('ALTER TABLE users ADD COLUMN terms_version TEXT');
  if (!cols.includes('privacy_accepted_at')) addCol('ALTER TABLE users ADD COLUMN privacy_accepted_at TEXT');
  if (!cols.includes('privacy_version')) addCol('ALTER TABLE users ADD COLUMN privacy_version TEXT');
  if (!cols.includes('disclaimer_accepted_at')) addCol('ALTER TABLE users ADD COLUMN disclaimer_accepted_at TEXT');
  if (!cols.includes('disclaimer_version')) addCol('ALTER TABLE users ADD COLUMN disclaimer_version TEXT');
  if (!cols.includes('subscription_terms_accepted_at')) {
    addCol('ALTER TABLE users ADD COLUMN subscription_terms_accepted_at TEXT');
  }
  if (!cols.includes('subscription_terms_version')) {
    addCol('ALTER TABLE users ADD COLUMN subscription_terms_version TEXT');
  }
}

function clientMeta(req) {
  return {
    ip: String(
      req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
        req?.ip ||
        req?.socket?.remoteAddress ||
        '',
    ).slice(0, 45),
    userAgent: String(req?.headers?.['user-agent'] || '').slice(0, 512),
  };
}

function isAccepted(user, docType) {
  if (!user) return false;
  const cur = versionForDoc(docType);
  if (docType === 'terms') {
    return user.terms_version === cur && Boolean(user.terms_accepted_at);
  }
  if (docType === 'privacy') {
    return user.privacy_version === cur && Boolean(user.privacy_accepted_at);
  }
  if (docType === 'disclaimer') {
    return user.disclaimer_version === cur && Boolean(user.disclaimer_accepted_at);
  }
  if (docType === 'subscription') {
    return user.subscription_terms_version === cur && Boolean(user.subscription_terms_accepted_at);
  }
  return false;
}

function missingConsents(user) {
  const missing = [];
  if (!isAccepted(user, 'terms')) missing.push('terms');
  if (!isAccepted(user, 'privacy')) missing.push('privacy');
  if (!isAccepted(user, 'disclaimer')) missing.push('disclaimer');
  return missing;
}

function legalStatusForUser(user) {
  const missing = missingConsents(user);
  return {
    current: currentVersions(),
    accepted: {
      terms: user?.terms_version || null,
      privacy: user?.privacy_version || null,
      disclaimer: user?.disclaimer_version || null,
      subscription: user?.subscription_terms_version || null,
    },
    missing,
    needsReaccept: missing.length > 0,
    canSubscribe: isAccepted(user, 'terms') && isAccepted(user, 'privacy') && isAccepted(user, 'disclaimer'),
  };
}

function appendConsentLog(db, { userId, docType, version, ip, userAgent }) {
  db.prepare(
    `INSERT INTO legal_consent_log (id, user_id, doc_type, version, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(uuid(), userId, docType, version, ip || null, userAgent || null);
}

function recordConsent(db, userId, docType, { ip, userAgent } = {}) {
  const version = versionForDoc(docType);
  if (!version) throw new Error('INVALID_DOC_TYPE');
  const now = new Date().toISOString();

  if (docType === 'terms') {
    db.prepare(
      `UPDATE users SET terms_accepted_at = ?, terms_version = ? WHERE id = ?`,
    ).run(now, version, userId);
  } else if (docType === 'privacy') {
    db.prepare(
      `UPDATE users SET privacy_accepted_at = ?, privacy_version = ? WHERE id = ?`,
    ).run(now, version, userId);
  } else if (docType === 'disclaimer') {
    db.prepare(
      `UPDATE users SET disclaimer_accepted_at = ?, disclaimer_version = ? WHERE id = ?`,
    ).run(now, version, userId);
  } else if (docType === 'subscription') {
    db.prepare(
      `UPDATE users SET subscription_terms_accepted_at = ?, subscription_terms_version = ? WHERE id = ?`,
    ).run(now, version, userId);
  }

  appendConsentLog(db, { userId, docType, version, ip, userAgent });
}

function recordConsents(userId, docTypes, meta = {}) {
  const db = initDb();
  migrateLegalConsentSchema(db);
  const list = Array.isArray(docTypes) ? docTypes : [];
  for (const docType of list) {
    recordConsent(db, userId, docType, meta);
  }
}

function validateRegistrationConsents(body) {
  const agreeTerms = Boolean(body?.agreeTerms);
  const agreePrivacy = Boolean(body?.agreePrivacy);
  const agreeDisclaimer = Boolean(body?.agreeDisclaimer);
  if (!agreeTerms || !agreePrivacy || !agreeDisclaimer) {
    const err = new Error('LEGAL_CONSENT_REQUIRED');
    err.code = 'LEGAL_CONSENT_REQUIRED';
    err.missing = [
      !agreeTerms && 'terms',
      !agreePrivacy && 'privacy',
      !agreeDisclaimer && 'disclaimer',
    ].filter(Boolean);
    throw err;
  }
  return true;
}

module.exports = {
  migrateLegalConsentSchema,
  clientMeta,
  currentVersions,
  legalStatusForUser,
  missingConsents,
  isAccepted,
  recordConsents,
  recordConsent,
  validateRegistrationConsents,
};
