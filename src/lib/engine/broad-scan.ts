// Broad platform scan — checks ALL active Kalshi markets for anomalies
// Funnel: all markets → velocity/volume filter → confidence score → alert

import type { KalshiMarket, AnomalyResult } from '../kalshi/types';
import { THRESHOLDS } from '../config/thresholds';
import { WATCHLIST_SERIES_SET } from '../config/watchlist';
import { parsePrice, parseFp, seriesFromEvent } from '../kalshi/client';
import { calculateVolumeZScore } from './volume';

interface BroadScanContext {
  // Previous snapshots keyed by market_ticker for delta calculation
  prevSnapshots: Map<string, { price: number; volume: number; ts: number }>;
}

export function detectAnomalies(
  markets: KalshiMarket[],
  context: BroadScanContext,
  prevVolumeStats: Map<string, { avg: number; stddev: number }>
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const now = Date.now();

  for (const market of markets) {
    const series = seriesFromEvent(market.event_ticker);
    const isWatchlist = WATCHLIST_SERIES_SET.has(series);

    // Skip settled/closed markets
    if (market.status !== 'active') continue;

    const prev = context.prevSnapshots.get(market.ticker);
    const currentPrice = parsePrice(market.last_price_dollars);
    const currentVol = parseFp(market.volume_24h_fp);

    // Velocity (approximate — compare to last snapshot)
    let velocity5min = 0;
    if (prev) {
      const dtMinutes = (now - prev.ts) / 1000 / 60;
      if (dtMinutes > 0 && prev.price > 0) {
        const rawDelta = (currentPrice - prev.price) / prev.price;
        // Normalize to 5-min rate
        velocity5min = rawDelta * (5 / Math.max(dtMinutes, 1));
      }
    }

    // Volume Z-score
    const volStats = prevVolumeStats.get(market.ticker) || { avg: currentVol, stddev: currentVol * 0.3 || 1 };
    const zScore = calculateVolumeZScore(currentVol, volStats.avg, volStats.stddev);

    // Thresholds differ for watchlist vs broad scan
    const velThreshold = isWatchlist ? THRESHOLDS.FLASH_5MIN : THRESHOLDS.BROAD_SCAN_VELOCITY_5MIN;
    const volThreshold = isWatchlist ? THRESHOLDS.VOLUME_SPIKE_Z : THRESHOLDS.BROAD_SCAN_VOLUME_Z;

    const hasVelocityAnomaly = Math.abs(velocity5min) >= velThreshold;
    const hasVolumeAnomaly = zScore >= volThreshold;

    if (!hasVelocityAnomaly && !hasVolumeAnomaly) continue;

    // Quick confidence score for broad scan
    let confidence = 30;
    if (hasVelocityAnomaly) confidence += 30;
    if (hasVolumeAnomaly) confidence += 25;
    if (hasVelocityAnomaly && hasVolumeAnomaly) confidence += 15; // both = more signal
    if (currentVol < THRESHOLDS.VOLUME_FLOOR_24H) confidence -= 20; // thin market penalty

    anomalies.push({
      market_ticker: market.ticker,
      series_ticker: series,
      title: market.title,
      category: market.category || 'other',
      current_price: currentPrice,
      anomaly_type: hasVelocityAnomaly && hasVolumeAnomaly ? 'both'
        : hasVelocityAnomaly ? 'velocity' : 'volume_spike',
      velocity_5min: velocity5min,
      volume_z_score: zScore,
      confidence_score: Math.min(100, Math.max(0, confidence)),
    });
  }

  // Sort by confidence desc, return top 50
  return anomalies
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 50);
}

// Update in-memory snapshot context from fresh market data
export function updateScanContext(
  context: BroadScanContext,
  markets: KalshiMarket[]
): void {
  const now = Date.now();
  for (const m of markets) {
    context.prevSnapshots.set(m.ticker, {
      price: parsePrice(m.last_price_dollars),
      volume: parseFp(m.volume_24h_fp),
      ts: now,
    });
  }
}

// Build volume stats from current market data (bootstrap from single snapshot)
export function buildVolumeStats(
  markets: KalshiMarket[],
  existing: Map<string, { avg: number; stddev: number }>
): Map<string, { avg: number; stddev: number }> {
  const stats = new Map(existing);
  for (const m of markets) {
    const vol = parseFp(m.volume_24h_fp);
    if (!stats.has(m.ticker)) {
      // Bootstrap: assume ±30% stddev
      stats.set(m.ticker, { avg: vol, stddev: vol * 0.3 || 1 });
    } else {
      // Exponential moving average update
      const prev = stats.get(m.ticker)!;
      const alpha = 0.1; // slow update
      const newAvg = prev.avg * (1 - alpha) + vol * alpha;
      const diff = vol - newAvg;
      const newStddev = Math.sqrt(prev.stddev ** 2 * (1 - alpha) + diff ** 2 * alpha) || 1;
      stats.set(m.ticker, { avg: newAvg, stddev: newStddev });
    }
  }
  return stats;
}

export function createBroadScanContext(): BroadScanContext {
  return { prevSnapshots: new Map() };
}
