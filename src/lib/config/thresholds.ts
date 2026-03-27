// Alert thresholds and scoring weights

export const THRESHOLDS = {
  // Velocity thresholds (as decimal, e.g., 0.10 = 10% move)
  FLASH_5MIN: 0.10,       // 10% move in 5 min = FLASH
  HIGH_1HR: 0.05,         // 5% move in 1hr = HIGH candidate
  MEDIUM_1HR: 0.02,       // 2% move in 1hr = MEDIUM candidate

  // Volume thresholds
  VOLUME_SPIKE_Z: 2.5,    // Z-score > 2.5 = volume spike
  VOLUME_FLOOR_24H: 50000, // Min $50K volume_24h to fire HIGH/FLASH

  // Confidence thresholds
  FLASH_MIN_CONFIDENCE: 70,
  HIGH_MIN_CONFIDENCE: 75,
  MEDIUM_MIN_CONFIDENCE: 50,

  // Alert cadence (ms)
  FLASH_COOLDOWN_MS: 15 * 60 * 1000,   // 15 min cooldown per market
  HIGH_COOLDOWN_MS: 30 * 60 * 1000,    // 30 min cooldown per market
  MEDIUM_BATCH_INTERVAL_MS: 30 * 60 * 1000,

  // Daily caps
  MAX_HIGH_ALERTS_PER_DAY: 5,
  MAX_FLASH_ALERTS_PER_DAY: 10,

  // Broad scan: any non-watchlist market with these thresholds gets flagged
  BROAD_SCAN_VELOCITY_5MIN: 0.08,   // 8% in 5 min
  BROAD_SCAN_VELOCITY_1HR: 0.12,    // 12% in 1hr
  BROAD_SCAN_VOLUME_Z: 3.0,         // Stronger volume spike for unknowns

  // Correlation cluster threshold
  CLUSTER_MIN_ALIGNED: 3,           // 3+ markets in a cluster must align
};

// Confidence score weights
export const SCORE_WEIGHTS = {
  velocity: 0.30,
  volume: 0.25,
  correlation: 0.25,
  spread: 0.10,
  pattern: 0.10,
};

// Velocity score → 0-1 based on 1hr move
export function velocityScore(pct_change_1hr: number): number {
  const abs = Math.abs(pct_change_1hr);
  if (abs >= 0.05) return 1.0;
  if (abs >= 0.02) return 0.5 + (abs - 0.02) / 0.03 * 0.5;
  return abs / 0.02 * 0.5;
}

// Volume score → 0-1 based on Z-score
export function volumeScore(z_score: number): number {
  if (z_score >= THRESHOLDS.VOLUME_SPIKE_Z) return 1.0;
  if (z_score >= 1.0) return 0.5 + (z_score - 1.0) / 1.5 * 0.5;
  return Math.max(0, z_score / 1.0 * 0.5);
}

// Spread score → 0-1 (tighter = better)
export function spreadScore(spread_decimal: number): number {
  if (spread_decimal <= 0.02) return 1.0;
  if (spread_decimal <= 0.10) return 1.0 - (spread_decimal - 0.02) / 0.08;
  return 0;
}

// Correlation score → 0-1 based on aligned markets count
export function correlationScore(aligned: number, total: number): number {
  if (total === 0) return 0;
  const ratio = aligned / total;
  if (aligned >= 3) return 1.0;
  if (aligned >= 2) return 0.5;
  return ratio * 0.3;
}
