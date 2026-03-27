// Volume spike detection using Z-score

export function calculateVolumeZScore(
  currentVolume: number,
  avg: number,
  stddev: number
): number {
  if (stddev === 0 || avg === 0) return 0;
  return (currentVolume - avg) / stddev;
}

export function isVolumeSpike(zScore: number, threshold = 2.5): boolean {
  return zScore > threshold;
}

// Simple rolling stats calculator for in-memory use
export class RollingStats {
  private values: number[] = [];
  private maxSize: number;

  constructor(maxSize = 288) { // 288 = 24hr at 5min intervals
    this.maxSize = maxSize;
  }

  push(value: number): void {
    this.values.push(value);
    if (this.values.length > this.maxSize) {
      this.values.shift();
    }
  }

  get avg(): number {
    if (this.values.length === 0) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  get stddev(): number {
    if (this.values.length < 2) return 1;
    const mean = this.avg;
    const variance = this.values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.values.length;
    return Math.sqrt(variance) || 1;
  }

  zScore(value: number): number {
    return calculateVolumeZScore(value, this.avg, this.stddev);
  }
}
