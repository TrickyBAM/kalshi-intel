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

// Fetch active markets with full pagination
// maxPages=1 for fast mode (Vercel Hobby 10s limit), use higher for dedicated workers
export async function getAllActiveMarkets(maxPages = 5): Promise<KalshiMarket[]> {
  const allMarkets: KalshiMarket[] = [];
  let cursor: string | undefined;
  let pages = 0;

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
    pages++;

    // Safety: stop if no cursor, no markets, or page limit reached
    if (!cursor || data.markets.length === 0 || pages >= maxPages) break;

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

// Parse a Kalshi price string to a number (prices are already 0.0–1.0 scale)
export function parsePrice(s: string | undefined): number {
  return parseFloat(s || '0') || 0;
}

// Parse a Kalshi volume/fp string to a number
export function parseFp(s: string | undefined): number {
  return parseFloat(s || '0') || 0;
}

// Derive the series ticker from an event_ticker (e.g. "KXFEDDECISION-26MAY07" → "KXFEDDECISION")
export function seriesFromEvent(eventTicker: string): string {
  return eventTicker.split('-')[0];
}

// Normalize a market's prices to numbers
export function normalizeMarket(m: KalshiMarket) {
  return {
    ...m,
    yes_bid_num: parsePrice(m.yes_bid_dollars),
    yes_ask_num: parsePrice(m.yes_ask_dollars),
    last_price_num: parsePrice(m.last_price_dollars),
    spread_num: parsePrice(m.yes_ask_dollars) - parsePrice(m.yes_bid_dollars),
    volume_24h_num: parseFp(m.volume_24h_fp),
    open_interest_num: parseFp(m.open_interest_fp),
    series_ticker: seriesFromEvent(m.event_ticker),
  };
}
