// Kalshi REST API client — typed TypeScript, handles full pagination

import type {
  KalshiMarket,
  KalshiMarketsResponse,
  KalshiOrderbook,
  KalshiOrderbookResponse,
  KalshiEventsResponse,
} from './types';

const BASE_URL = process.env.KALSHI_API_BASE || 'https://api.elections.kalshi.com/trade-api/v2';

const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
};

async function fetchKalshi<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: DEFAULT_HEADERS,
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Kalshi API error ${res.status} at ${path}: ${body}`);
  }

  return res.json();
}

// Fetch ALL active markets with full pagination
export async function getAllActiveMarkets(): Promise<KalshiMarket[]> {
  const allMarkets: KalshiMarket[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = {
      status: 'open',
      limit: '1000',
    };
    if (cursor) params.cursor = cursor;

    const data = await fetchKalshi<KalshiMarketsResponse>('/markets', params);

    if (data.markets && data.markets.length > 0) {
      allMarkets.push(...data.markets);
    }

    cursor = data.cursor;

    // Safety: stop if no cursor (no more pages) or we've collected enough
    if (!cursor || data.markets.length === 0) break;

    // Rate limit courtesy — 50ms between pages
    await new Promise(r => setTimeout(r, 50));
  } while (cursor);

  return allMarkets;
}

// Fetch markets for a specific series ticker
export async function getMarketsBySeries(seriesTicker: string): Promise<KalshiMarket[]> {
  const allMarkets: KalshiMarket[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = {
      series_ticker: seriesTicker,
      status: 'open',
      limit: '200',
    };
    if (cursor) params.cursor = cursor;

    const data = await fetchKalshi<KalshiMarketsResponse>('/markets', params);
    if (data.markets) allMarkets.push(...data.markets);
    cursor = data.cursor;
    if (!cursor || data.markets.length === 0) break;
  } while (cursor);

  return allMarkets;
}

// Fetch a single market
export async function getMarket(ticker: string): Promise<KalshiMarket> {
  const data = await fetchKalshi<{ market: KalshiMarket }>(`/markets/${ticker}`);
  return data.market;
}

// Fetch orderbook for a market
export async function getOrderbook(ticker: string): Promise<KalshiOrderbook> {
  const data = await fetchKalshi<KalshiOrderbookResponse>(`/markets/${ticker}/orderbook`);
  return data.orderbook;
}

// Fetch a batch of specific markets efficiently
export async function getMarketsForTickers(tickers: string[]): Promise<KalshiMarket[]> {
  // Batch into groups of 20 concurrent requests
  const results: KalshiMarket[] = [];
  const chunkSize = 20;

  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    const settled = await Promise.allSettled(
      chunk.map(t => getMarket(t))
    );
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
    if (i + chunkSize < tickers.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
}

// Get events with their markets (useful for discovering series tickers)
export async function getEvents(seriesTicker?: string): Promise<KalshiEventsResponse> {
  const params: Record<string, string> = { status: 'open', limit: '100' };
  if (seriesTicker) params.series_ticker = seriesTicker;
  return fetchKalshi<KalshiEventsResponse>('/events', params);
}

// Convert Kalshi price from cents (0-100) to decimal (0-1)
export function centsToDecimal(cents: number): number {
  return cents / 100;
}

// Normalize a market's prices to decimal
export function normalizeMarket(m: KalshiMarket) {
  return {
    ...m,
    yes_bid_decimal: centsToDecimal(m.yes_bid),
    yes_ask_decimal: centsToDecimal(m.yes_ask),
    last_price_decimal: centsToDecimal(m.last_price),
    spread_decimal: centsToDecimal(m.yes_ask - m.yes_bid),
  };
}
