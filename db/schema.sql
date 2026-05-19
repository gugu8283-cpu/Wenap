-- Wenap 预测追踪与管理（SQLite；生产可迁 PostgreSQL）

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  external_key TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  tier TEXT DEFAULT 'free',
  free_trials_used INTEGER DEFAULT 0,
  free_trials_limit INTEGER DEFAULT 5,
  stripe_customer_id TEXT,
  is_banned INTEGER DEFAULT 0,
  ban_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_active_at TEXT
);

CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  ticker TEXT NOT NULL,
  analyzed_at TEXT NOT NULL,
  tendency TEXT NOT NULL,
  score INTEGER NOT NULL,
  current_price REAL NOT NULL,
  target_price REAL,
  scenario_bull_prob INTEGER,
  scenario_bull_min REAL,
  scenario_bull_max REAL,
  scenario_base_prob INTEGER,
  scenario_base_min REAL,
  scenario_base_max REAL,
  scenario_bear_prob INTEGER,
  scenario_bear_min REAL,
  scenario_bear_max REAL,
  verify_at TEXT NOT NULL,
  verified_at TEXT,
  status TEXT DEFAULT 'pending',
  is_backtest INTEGER DEFAULT 0,
  skip_reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prediction_results (
  id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL REFERENCES predictions(id),
  verified_at TEXT NOT NULL,
  actual_price REAL NOT NULL,
  price_change_pct REAL NOT NULL,
  tendency_correct INTEGER NOT NULL,
  scenario_hit TEXT,
  target_price_hit INTEGER NOT NULL,
  fetch_source TEXT DEFAULT 'alpha_vantage',
  error_detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analysis_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  ticker TEXT NOT NULL,
  tier TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd REAL,
  duration_ms INTEGER,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_predictions_ticker_analyzed
  ON predictions(ticker, analyzed_at);

CREATE INDEX IF NOT EXISTS idx_predictions_status_verify ON predictions(status, verify_at);
CREATE INDEX IF NOT EXISTS idx_predictions_ticker ON predictions(ticker);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_created ON analysis_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_external ON users(external_key);
