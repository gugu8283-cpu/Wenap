-- Wenap 预测追踪（PostgreSQL）
-- 用法: psql $DATABASE_URL -f db/schema.postgres.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key VARCHAR(128) UNIQUE,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  tier VARCHAR(10) DEFAULT 'free',
  free_trials_used INTEGER DEFAULT 0,
  free_trials_limit INTEGER DEFAULT 5,
  stripe_customer_id VARCHAR(255),
  is_banned BOOLEAN DEFAULT false,
  ban_reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  ticker VARCHAR(10) NOT NULL,
  analyzed_at DATE NOT NULL,
  tendency VARCHAR(10) NOT NULL,
  score INTEGER NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  target_price DECIMAL(10, 2),
  scenario_bull_prob INTEGER,
  scenario_bull_min DECIMAL(10, 2),
  scenario_bull_max DECIMAL(10, 2),
  scenario_base_prob INTEGER,
  scenario_base_min DECIMAL(10, 2),
  scenario_base_max DECIMAL(10, 2),
  scenario_bear_prob INTEGER,
  scenario_bear_min DECIMAL(10, 2),
  scenario_bear_max DECIMAL(10, 2),
  verify_at DATE NOT NULL,
  verified_at TIMESTAMPTZ,
  status VARCHAR(10) DEFAULT 'pending',
  is_backtest BOOLEAN DEFAULT false,
  skip_reason VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ticker, analyzed_at)
);

CREATE TABLE IF NOT EXISTS prediction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ NOT NULL,
  actual_price DECIMAL(10, 2) NOT NULL,
  price_change_pct DECIMAL(6, 2) NOT NULL,
  tendency_correct BOOLEAN NOT NULL,
  scenario_hit VARCHAR(10),
  target_price_hit BOOLEAN NOT NULL,
  fetch_source VARCHAR(20) DEFAULT 'alpha_vantage',
  error_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  ticker VARCHAR(10) NOT NULL,
  tier VARCHAR(10) NOT NULL,
  model VARCHAR(50) NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(8, 6),
  duration_ms INTEGER,
  status VARCHAR(10) DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_status_verify ON predictions(status, verify_at);
CREATE INDEX IF NOT EXISTS idx_predictions_ticker ON predictions(ticker);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_created ON analysis_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_external ON users(external_key);
