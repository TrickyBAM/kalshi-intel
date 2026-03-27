import { supabaseAdmin } from './client';

export interface WatchlistMarket {
  id: string;
  series_ticker: string;
  market_ticker?: string;
  event_ticker?: string;
  category: string;
  title: string;
  status: string;
  alert_threshold_5min: number;
  alert_threshold_1hr: number;
  created_at: string;
  updated_at: string;
}

// Upsert watchlist markets (run on startup to sync with config)
export async function upsertWatchlistMarkets(
  entries: Array<{
    series_ticker: string;
    market_ticker?: string;
    category: string;
    title: string;
  }>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('markets')
    .upsert(
      entries.map(e => ({
        series_ticker: e.series_ticker,
        market_ticker: e.market_ticker,
        category: e.category,
        title: e.title,
        status: 'active',
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'series_ticker' }
    );

  if (error) console.error('Failed to upsert watchlist:', error.message);
}

// Update the current market ticker for a series
export async function updateMarketTicker(
  seriesTicker: string,
  marketTicker: string
): Promise<void> {
  await supabaseAdmin
    .from('markets')
    .update({ market_ticker: marketTicker, updated_at: new Date().toISOString() })
    .eq('series_ticker', seriesTicker);
}

export async function getActiveWatchlist(): Promise<WatchlistMarket[]> {
  const { data } = await supabaseAdmin
    .from('markets')
    .select('*')
    .eq('status', 'active');

  return data || [];
}
