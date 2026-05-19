/**
 * Billing database helper - manages the `billing` table for Stripe subscriptions.
 * Uses the same SQLite DB as auth.cjs (via store.cjs).
 */
const { initDb } = require('../db/store.cjs');

let _migrated = false;

function getDb() {
  const db = initDb();
  if (!_migrated) {
    migrateBillingSchema(db);
    _migrated = true;
  }
  return db;
}

function migrateBillingSchema(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS billing (
        user_id TEXT PRIMARY KEY,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        tier TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active',
        subscription_renews_at TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch (e) {
    if (!/already exists/i.test(e.message)) throw e;
  }

  // Add columns if missing (for existing DBs)
  const cols = db.prepare('PRAGMA table_info(billing)').all().map((c) => c.name);
  const addCol = (sql) => {
    try { db.exec(sql); } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }
  };
  if (!cols.includes('subscription_renews_at')) {
    addCol('ALTER TABLE billing ADD COLUMN subscription_renews_at TEXT');
  }
  if (!cols.includes('status')) {
    addCol('ALTER TABLE billing ADD COLUMN status TEXT DEFAULT \'active\'');
  }
}

function getBillingByUserId(userId) {
  return getDb().prepare('SELECT * FROM billing WHERE user_id = ?').get(userId);
}

module.exports = { getDb, getBillingByUserId };
