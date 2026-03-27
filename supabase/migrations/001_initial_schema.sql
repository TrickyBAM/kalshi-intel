-- Kalshi Intel — Initial Database Schema
-- Run this in Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── markets: Watchlist configuration ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_ticker TEXT NOT NULL UNIQUE,
  market_ticker TEXT,
  event_ticker TEXT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'paused')),
  alert_threshold_5min DECIMAL DEFAULT 0.05,
  alert_threshold_1hr DECIMAL DEFAULT 0.08,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── snapshots: Time-series market data ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_ticker TEXT NOT NULL,
  series_ticker TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  yes_price DECIMAL,
  yes_bid DECIMAL,
  yes_ask DECIMAL,
  spread DECIMAL,
  volume_24h BIGINT,
  open_interest BIGINT,
  last_trade_price DECIMAL,
  orderbook_depth_yes DECIMAL,
  orderbook_depth_no DECIMAL,
  source TEXT DEFAULT 'kalshi'
);

-- Indexes for velocity calculations
CREATE INDEX IF NOT EXISTS idx_snapshots_ticker_time ON snapshots(market_ticker, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_category_time ON snapshots(category, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_series_time ON snapshots(series_ticker, timestamp DESC);

-- ── alerts: Alert history and accuracy tracking ───────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_level TEXT NOT NULL CHECK (alert_level IN ('flash', 'high', 'medium', 'info', 'daily_digest')),
  headline TEXT NOT NULL,
  confidence_score INTEGER,
  primary_market TEXT NOT NULL,
  correlated_markets JSONB,
  velocity_data JSONB,
  cluster_data JSONB,
  anomaly_data JSONB,
  slack_sent BOOLEAN DEFAULT FALSE,
  slack_message_ts TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Accuracy tracking (filled in after settlement)
  outcome_correct BOOLEAN,
  outcome_notes TEXT,
  resolved_at TIMESTAMPTZ
);

-- Indexes for alert queries
CREATE INDEX IF NOT EXISTS idx_alerts_market_level ON alerts(primary_market, alert_level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(alert_level, created_at DESC);

-- ── broad_scan_anomalies: Track non-watchlist anomalies ───────────────────────
CREATE TABLE IF NOT EXISTS broad_scan_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_ticker TEXT NOT NULL,
  series_ticker TEXT NOT NULL,
  title TEXT,
  category TEXT,
  current_price DECIMAL,
  anomaly_type TEXT,
  velocity_5min DECIMAL,
  volume_z_score DECIMAL,
  confidence_score INTEGER,
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broad_anomalies_time ON broad_scan_anomalies(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_broad_anomalies_confidence ON broad_scan_anomalies(confidence_score DESC, scanned_at DESC);

-- ── View: latest snapshot per market ─────────────────────────────────────────
CREATE OR REPLACE VIEW snapshots_latest AS
SELECT DISTINCT ON (market_ticker)
  *
FROM snapshots
ORDER BY market_ticker, timestamp DESC;

-- ── RLS Policies (disable for service role access) ────────────────────────────
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broad_scan_anomalies ENABLE ROW LEVEL SECURITY;

-- Allow anon read on all tables (dashboard reads)
CREATE POLICY "anon_read_markets" ON markets FOR SELECT USING (true);
CREATE POLICY "anon_read_snapshots" ON snapshots FOR SELECT USING (true);
CREATE POLICY "anon_read_alerts" ON alerts FOR SELECT USING (true);
CREATE POLICY "anon_read_anomalies" ON broad_scan_anomalies FOR SELECT USING (true);

-- Service role has full access (bypasses RLS by default)
