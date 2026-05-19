-- Wenap 账号认证（SQLite）

CREATE TABLE IF NOT EXISTS device_fingerprints (
  fingerprint TEXT PRIMARY KEY,
  total_free_used INTEGER DEFAULT 0,
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ip_register_daily (
  ip TEXT NOT NULL,
  register_date TEXT NOT NULL,
  register_count INTEGER DEFAULT 0,
  PRIMARY KEY (ip, register_date)
);

CREATE TABLE IF NOT EXISTS ip_analysis_hourly (
  ip TEXT NOT NULL,
  analysis_hour TEXT NOT NULL,
  analysis_count INTEGER DEFAULT 0,
  PRIMARY KEY (ip, analysis_hour)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users(email) WHERE email IS NOT NULL AND email != '';
