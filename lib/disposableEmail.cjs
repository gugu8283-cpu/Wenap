const domains = new Set(require('disposable-email-domains'));

function isDisposableEmail(email) {
  const parts = String(email || '')
    .trim()
    .toLowerCase()
    .split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return true;
  return domains.has(parts[1]);
}

module.exports = { isDisposableEmail };
