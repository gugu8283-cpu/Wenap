const { initDb } = require('../db/store.cjs');
const { createTestUser } = require('../db/auth.cjs');

const TEST_ACCOUNTS = [
  { email: 'free@wenap.test', password: 'Wenap2026Free!', tier: 'free' },
  { email: 'pro@wenap.test', password: 'Wenap2026Pro!', tier: 'pro' },
  { email: 'proplus@wenap.test', password: 'Wenap2026ProPlus!', tier: 'pro_plus' },
];

async function seedTestAccounts() {
  initDb();
  for (const a of TEST_ACCOUNTS) {
    await createTestUser({ ...a, emailVerified: true });
  }
  return TEST_ACCOUNTS.map((a) => a.email);
}

module.exports = { TEST_ACCOUNTS, seedTestAccounts };
