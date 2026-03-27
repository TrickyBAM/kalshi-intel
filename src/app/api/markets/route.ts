import { NextResponse } from 'next/server';
import { getLatestSnapshots } from '@/lib/db/snapshots';
import { WATCHLIST, CATEGORY_META } from '@/lib/config/watchlist';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshots = await getLatestSnapshots();

    // Merge watchlist config with latest snapshot data
    const markets = WATCHLIST.map(entry => {
      const snap = snapshots.find(s => s.series_ticker === entry.series_ticker);
      return {
        series_ticker: entry.series_ticker,
        category: entry.category,
        category_label: CATEGORY_META[entry.category].label,
        category_color: CATEGORY_META[entry.category].color,
        title: entry.title,
        description: entry.description,
        latest: snap ? {
          market_ticker: snap.market_ticker,
          yes_price: snap.yes_price,
          yes_bid: snap.yes_bid,
          yes_ask: snap.yes_ask,
          spread: snap.spread,
          volume_24h: snap.volume_24h,
          open_interest: snap.open_interest,
          timestamp: snap.timestamp,
        } : null,
      };
    });

    // Group by category
    const grouped = Object.entries(CATEGORY_META).map(([cat, meta]) => ({
      category: cat,
      label: meta.label,
      color: meta.color,
      icon: meta.icon,
      markets: markets.filter(m => m.category === cat),
    }));

    return NextResponse.json({
      total: markets.length,
      last_updated: new Date().toISOString(),
      categories: grouped,
      markets,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
