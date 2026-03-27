// Kalshi API response types

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  series_ticker: string;
  title: string;
  subtitle?: string;
  status: 'open' | 'closed' | 'settled';
  yes_bid: number;    // in cents (0-100)
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  volume_24h: number;
  open_interest: number;
  notional_value: number;
  category: string;
  close_time: string;
  expiration_time?: string;
  can_close_early?: boolean;
  result?: string;
  expected_expiration_time?: string;
}

export interface KalshiMarketsResponse {
  markets: KalshiMarket[];
  cursor?: string;
}

export interface KalshiOrderbook {
  yes: Array<[number, number]>; // [price_cents, quantity]
  no: Array<[number, number]>;
}

export interface KalshiOrderbookResponse {
  orderbook: KalshiOrderbook;
}

export interface KalshiEvent {
  event_ticker: string;
  series_ticker: string;
  title: string;
  sub_title?: string;
  status: string;
  markets?: KalshiMarket[];
  category: string;
}

export interface KalshiEventsResponse {
  events: KalshiEvent[];
  cursor?: string;
}

export interface KalshiSeries {
  ticker: string;
  title: string;
  category: string;
}

export interface KalshiSeriesResponse {
  series: KalshiSeries;
}

export interface KalshiTrade {
  trade_id: string;
  ticker: string;
  count: number;
  yes_price: number; // cents
  no_price: number;
  taker_side: 'yes' | 'no';
  created_time: string;
}

export interface KalshiTradesResponse {
  trades: KalshiTrade[];
  cursor?: string;
}

// Internal normalized market snapshot
export interface MarketSnapshot {
  market_ticker: string;
  series_ticker: string;
  category: string;
  title: string;
  timestamp: string;
  yes_price: number;     // 0-1 (dollars)
  yes_bid: number;
  yes_ask: number;
  spread: number;
  volume_24h: number;
  open_interest: number;
  last_trade_price: number;
  orderbook_depth_yes?: number;
  orderbook_depth_no?: number;
}

export interface VelocityWindow {
  delta: number;
  pct_change: number;
  direction: 'up' | 'down' | 'flat';
}

export interface VelocityResult {
  market_ticker: string;
  current_price: number;
  windows: {
    '5min': VelocityWindow;
    '1hr': VelocityWindow;
    '4hr': VelocityWindow;
    '24hr': VelocityWindow;
  };
  volume_spike: boolean;
  volume_z_score: number;
  spread_tightness: number;
  acceleration: 'increasing' | 'decreasing' | 'steady';
}

export interface AnomalyResult {
  market_ticker: string;
  series_ticker: string;
  title: string;
  category: string;
  current_price: number;
  anomaly_type: 'velocity' | 'volume_spike' | 'both';
  velocity_5min?: number;
  velocity_1hr?: number;
  volume_z_score?: number;
  confidence_score: number;
}

export interface ClusterSignal {
  cluster_name: string;
  cluster_key: string;
  description: string;
  markets_aligned: number;
  markets_total: number;
  trigger_score: number;
}

export interface AlertPayload {
  level: 'flash' | 'high' | 'medium' | 'info' | 'daily_digest';
  headline: string;
  confidence_score: number;
  primary_market: string;
  primary_market_title?: string;
  velocity_data: Partial<VelocityResult>;
  correlated_markets: Array<{
    ticker: string;
    title: string;
    direction: string;
    velocity_1hr_pct?: number;
  }>;
  cluster?: ClusterSignal;
  anomaly?: AnomalyResult;
}
