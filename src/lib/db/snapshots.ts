import { supabaseAdmin } from './client';
import type { MarketSnapshot } from '../kalshi/types';

// Store a batch of market snapshots
export async function storeSnapshots(snapshots: MarketSnapshot[]): Promise<void> {
  if (snapshots.length === 0) return;

  const { error } = await supabaseAdmin
    .from('snapshots')
    .insert(snapshots.map(s => ({
      market_ticker: s.market_ticker,
      series_ticker: s.series_ticker,
      category: s.category,
      title: s.title,
      timestamp: s.timestamp,
      yes_price: s.yes_price,
      yes_bid: s.yes_bid,
      yes_ask: s.yes_ask,
      spread: s.spread,
      volume_24h: s.volume_24h,
      open_interest: s.open_interest,
      last_trade_price: s.last_trade_price,
      orderbook_depth_yes: s.orderbook_depth_yes,
      orderbook_depth_no: s.orderbook_depth_no,
    })));

  if (error) throw new Error(`Failed to store snapshots: ${error.message}`);
}

// Get recent snapshots for a market (for velocity calculation)
export async function getRecentSnapshots(
  marketTicker: string,
  since: Date
): Promise<MarketSnapshot[]> {
  const { data, error } = await supabaseAdmin
    .from('snapshots')
    .select('*')
    .eq('market_ticker', marketTicker)
    .gte('timestamp', since.toISOString())
    .order('timestamp', { ascending: false })
    .limit(100);

  if (error) throw new Error(`Failed to get snapshots: ${error.message}`);
  return data || [];
}

// Get snapshot closest to a specific time
export async function getSnapshotAt(
  marketTicker: string,
  targetTime: Date
): Promise<MarketSnapshot | null> {
  const windowStart = new Date(targetTime.getTime() - 3 * 60 * 1000); // ±3 min window
  const windowEnd = new Date(targetTime.getTime() + 3 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from('snapshots')
    .select('*')
    .eq('market_ticker', marketTicker)
    .gte('timestamp', windowStart.toISOString())
    .lte('timestamp', windowEnd.toISOString())
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

// Get all latest snapshots per market (for dashboard)
export async function getLatestSnapshots(): Promise<MarketSnapshot[]> {
  const { data, error } = await supabaseAdmin
    .from('snapshots_latest')
    .select('*')
    .order('category', { ascending: true });

  if (error) {
    // Fallback: distinct query
    const { data: fallback } = await supabaseAdmin
      .from('snapshots')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500);

    if (!fallback) return [];

    // Deduplicate by market_ticker keeping latest
    const seen = new Map<string, MarketSnapshot>();
    for (const row of fallback) {
      if (!seen.has(row.market_ticker)) seen.set(row.market_ticker, row);
    }
    return Array.from(seen.values());
  }
  return data || [];
}

// Get volume stats for Z-score calculation (24hr rolling)
export async function getVolumeStats(marketTicker: string): Promise<{ avg: number; stddev: number }> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from('snapshots')
    .select('volume_24h')
    .eq('market_ticker', marketTicker)
    .gte('timestamp', since24h.toISOString())
    .order('timestamp', { ascending: true });

  if (error || !data || data.length < 2) return { avg: 0, stddev: 1 };

  const volumes = data.map(r => r.volume_24h).filter(Boolean);
  const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const variance = volumes.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / volumes.length;
  const stddev = Math.sqrt(variance) || 1;

  return { avg, stddev };
}
