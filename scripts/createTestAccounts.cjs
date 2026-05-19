/**
 * 创建测试账号（跳过邮箱验证）
 * 用法：node scripts/createTestAccounts.cjs
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initDb } = require('../db/store.cjs');
const { createTestUser } = require('../db/auth.cjs');

const ACCOUNTS = [
  {
    email: 'free@wenap.test',
    password: 'Wenap2026Free!',
    tier: 'free',
  },
  {
    email: 'pro@wenap.test',
    password: 'Wenap2026Pro!',
    tier: 'pro',
  },
  {
    email: 'proplus@wenap.test',
    password: 'Wenap2026ProPlus!',
    tier: 'pro_plus',
  },
];

async function main() {
  initDb();
  for (const a of ACCOUNTS) {
    await createTestUser({ ...a, emailVerified: true });
  }
  console.log('✓ 免费账号：free@wenap.test / Wenap2026Free!');
  console.log('✓ Pro账号：pro@wenap.test / Wenap2026Pro!');
  console.log('✓ Pro+账号：proplus@wenap.test / Wenap2026ProPlus!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
