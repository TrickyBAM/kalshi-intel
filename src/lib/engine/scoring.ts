import type { VelocityResult, ClusterSignal } from '../kalshi/types';
import {
  SCORE_WEIGHTS,
  velocityScore,
  volumeScore,
  spreadScore,
  correlationScore,
  THRESHOLDS,
} from '../config/thresholds';

export interface ConfidenceScore {
  total: number;           // 0-100
  components: {
    velocity: number;
    volume: number;
    correlation: number;
    spread: number;
    pattern: number;
  };
  alert_level: 'flash' | 'high' | 'medium' | 'info' | null;
}

export function scoreConfidence(
  velocity: VelocityResult,
  cluster?: ClusterSignal,
  volume_24h?: number
): ConfidenceScore {
  // Velocity component (use 1hr as primary)
  const vel1hr = Math.abs(velocity.windows['1hr'].pct_change);
  const vel5min = Math.abs(velocity.windows['5min'].pct_change);
  // Use whichever window shows more action
  const velScore = Math.max(velocityScore(vel1hr), velocityScore(vel5min) * 0.7);

  // Volume component
  const volScore = volumeScore(velocity.volume_z_score);

  // Correlation component (from cluster detection)
  const corrScore = cluster
    ? correlationScore(cluster.markets_aligned, cluster.markets_total)
    : 0;

  // Spread component
  const sprdScore = spreadScore(1 - velocity.spread_tightness);

  // Pattern component (no historical data in v1, use acceleration as proxy)
  const patternScore = velocity.acceleration === 'increasing' ? 0.7
    : velocity.acceleration === 'steady' ? 0.4
    : 0.2;

  const total = Math.round(
    (velScore * SCORE_WEIGHTS.velocity +
     volScore * SCORE_WEIGHTS.volume +
     corrScore * SCORE_WEIGHTS.correlation +
     sprdScore * SCORE_WEIGHTS.spread +
     patternScore * SCORE_WEIGHTS.pattern) * 100
  );

  // Determine alert level
  const is5minFlash = vel5min >= THRESHOLDS.FLASH_5MIN;
  const hasVolumeFloor = !volume_24h || volume_24h >= THRESHOLDS.VOLUME_FLOOR_24H;

  let alert_level: ConfidenceScore['alert_level'] = null;

  if (is5minFlash && hasVolumeFloor) {
    alert_level = 'flash';
  } else if (total >= THRESHOLDS.HIGH_MIN_CONFIDENCE && hasVolumeFloor && (vel1hr >= THRESHOLDS.HIGH_1HR || (cluster?.markets_aligned ?? 0) >= THRESHOLDS.CLUSTER_MIN_ALIGNED)) {
    alert_level = 'high';
  } else if (total >= THRESHOLDS.MEDIUM_MIN_CONFIDENCE) {
    alert_level = 'medium';
  } else if (total > 20) {
    alert_level = 'info';
  }

  return {
    total: Math.min(100, Math.max(0, total)),
    components: {
      velocity: Math.round(velScore * 100),
      volume: Math.round(volScore * 100),
      correlation: Math.round(corrScore * 100),
      spread: Math.round(sprdScore * 100),
      pattern: Math.round(patternScore * 100),
    },
    alert_level,
  };
}
