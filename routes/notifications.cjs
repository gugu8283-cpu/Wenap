const express = require('express');
const { requireAuth } = require('../middleware/requireAuth.cjs');
const { initDb } = require('../db/store.cjs');

const router = express.Router();

function getDb() { return initDb(); }

function ensureNotificationsTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      body TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      data TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at);
  `);
}

try { ensureNotificationsTable(); } catch (e) { console.warn('[Notifications] Schema init failed:', e.message); }

// GET /notifications – list unread (and recent read) notifications
router.get('/', requireAuth, (req, res) => {
  try {
    ensureNotificationsTable();
    const db = getDb();
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const rows = db.prepare(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(req.authUser.id, limit);
    const unreadCount = rows.filter((r) => !r.read).length;
    res.json({ notifications: rows, unreadCount });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

// POST /notifications/:id/read – mark single notification read
router.post('/:id/read', requireAuth, (req, res) => {
  try {
    ensureNotificationsTable();
    const db = getDb();
    db.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`).run(req.params.id, req.authUser.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// POST /notifications/read-all – mark all read
router.post('/read-all', requireAuth, (req, res) => {
  try {
    ensureNotificationsTable();
    const db = getDb();
    db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`).run(req.authUser.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Helper: push a notification (for internal use)
function pushNotification({ userId, type, title, body, data }) {
  try {
    ensureNotificationsTable();
    const db = getDb();
    const crypto = require('crypto');
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), userId, type, title || '', body || '', data ? JSON.stringify(data) : null);
  } catch (e) {
    console.warn('[Notifications] push failed:', e.message);
  }
}

module.exports = router;
module.exports.pushNotification = pushNotification;
