import type { VelocityResult, MarketSnapshot } from '../kalshi/types';

// Calculate velocity across all windows given sorted snapshots (newest first)
export function calculateVelocity(
  marketTicker: string,
  currentPrice: number,
  snapshots: MarketSnapshot[],
  currentVolumeZ: number
): VelocityResult {
  const now = Date.now();

  function getPriceAt(windowMs: number): number | null {
    const cutoff = now - windowMs;
    // Find snapshot closest to cutoff (oldest snapshot within window)
    const inWindow = snapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff);
    if (inWindow.length === 0) return null;
    // Get the oldest one (furthest back) within the window
    return inWindow[inWindow.length - 1].yes_price;
  }

  function calcWindow(windowMs: number) {
    const oldPrice = getPriceAt(windowMs);
    if (oldPrice === null || oldPrice === 0) {
      return { delta: 0, pct_change: 0, direction: 'flat' as const };
    }
    const delta = currentPrice - oldPrice;
    const pct_change = delta / oldPrice;
    return {
      delta,
      pct_change,
      direction: Math.abs(pct_change) < 0.001 ? 'flat' as const
        : delta > 0 ? 'up' as const : 'down' as const,
    };
  }

  const w5min = calcWindow(5 * 60 * 1000);
  const w1hr = calcWindow(60 * 60 * 1000);
  const w4hr = calcWindow(4 * 60 * 60 * 1000);
  const w24hr = calcWindow(24 * 60 * 60 * 1000);

  // Acceleration: compare 5min velocity to previous 5min velocity
  const w10min = getPriceAt(10 * 60 * 1000);
  const w5minAgo = getPriceAt(5 * 60 * 1000);
  let acceleration: 'increasing' | 'decreasing' | 'steady' = 'steady';
  if (w10min && w5minAgo && w5minAgo !== 0) {
    const prevVelocity = (w5minAgo - w10min) / w10min;
    const currVelocity = w5min.pct_change;
    if (Math.abs(currVelocity) > Math.abs(prevVelocity) * 1.2) acceleration = 'increasing';
    else if (Math.abs(currVelocity) < Math.abs(prevVelocity) * 0.8) acceleration = 'decreasing';
  }

  // Spread tightness from latest snapshot
  const latestSpread = snapshots[0]?.spread ?? 0.10;
  const spread_tightness = Math.max(0, 1 - latestSpread / 0.10);

  return {
    market_ticker: marketTicker,
    current_price: currentPrice,
    windows: {
      '5min': w5min,
      '1hr': w1hr,
      '4hr': w4hr,
      '24hr': w24hr,
    },
    volume_spike: currentVolumeZ > 2.5,
    volume_z_score: currentVolumeZ,
    spread_tightness,
    acceleration,
  };
}
