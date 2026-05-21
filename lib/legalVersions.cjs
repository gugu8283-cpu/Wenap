/** Bump when legal text changes materially — users must re-accept. */
const TERMS_VERSION = process.env.LEGAL_TERMS_VERSION || '2026-05-21-v1';
const PRIVACY_VERSION = process.env.LEGAL_PRIVACY_VERSION || '2026-05-21-v1';
const DISCLAIMER_VERSION = process.env.LEGAL_DISCLAIMER_VERSION || '2026-05-21-v1';

const DOC_TYPES = ['terms', 'privacy', 'disclaimer', 'subscription'];

function currentVersions() {
  return {
    terms: TERMS_VERSION,
    privacy: PRIVACY_VERSION,
    disclaimer: DISCLAIMER_VERSION,
    subscription: TERMS_VERSION,
  };
}

function versionForDoc(docType) {
  const v = currentVersions();
  if (docType === 'terms') return v.terms;
  if (docType === 'privacy') return v.privacy;
  if (docType === 'disclaimer') return v.disclaimer;
  if (docType === 'subscription') return v.subscription;
  return null;
}

module.exports = {
  TERMS_VERSION,
  PRIVACY_VERSION,
  DISCLAIMER_VERSION,
  DOC_TYPES,
  currentVersions,
  versionForDoc,
};
