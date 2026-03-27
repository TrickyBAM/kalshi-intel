'use client';

interface AnomalyResult {
  market_ticker: string;
  series_ticker: string;
  title: string;
  category: string;
  current_price: number;
  anomaly_type: string;
  velocity_5min?: number;
  volume_z_score?: number;
  confidence_score: number;
}

interface BroadScanPanelProps {
  anomalies: AnomalyResult[];
  totalScanned: number;
}

const ANOMALY_COLORS = {
  velocity:     '#f59e0b',
  volume_spike: '#3b82f6',
  both:         '#8b5cf6',
};

export function BroadScanPanel({ anomalies, totalScanned }: BroadScanPanelProps) {
  const top = anomalies.slice(0, 10);

  return (
    <div>
      {/* Header stat */}
      <div className="flex items-center gap-2 mb-3">
        <div className="live-dot animate-pulse-glow" />
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Scanning <span className="font-semibold ticker-number" style={{ color: 'var(--text-primary)' }}>
            {totalScanned.toLocaleString()}
          </span> markets platform-wide
        </span>
      </div>

      {top.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No anomalies detected in this cycle</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {top.map((anomaly, i) => {
            const color = ANOMALY_COLORS[anomaly.anomaly_type as keyof typeof ANOMALY_COLORS] ?? '#888';
            const vel = anomaly.velocity_5min
              ? `${(anomaly.velocity_5min * 100 > 0 ? '+' : '')}${(anomaly.velocity_5min * 100).toFixed(1)}%`
              : null;
            const zScore = anomaly.volume_z_score
              ? `Z=${anomaly.volume_z_score.toFixed(1)}`
              : null;

            return (
              <div
                key={`${anomaly.market_ticker}-${i}`}
                className={`flex items-center gap-3 p-2 rounded animate-fade-in-up delay-${Math.min(i, 8)}`}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {/* Type indicator */}
                <div
                  className="w-1 h-6 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {anomaly.title || anomaly.market_ticker}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {anomaly.series_ticker}
                    </span>
                    {vel && (
                      <span
                        className="text-[10px] ticker-number"
                        style={{ color: anomaly.velocity_5min! > 0 ? '#22d3a6' : '#ff5555' }}
                      >
                        {vel}
                      </span>
                    )}
                    {zScore && (
                      <span className="text-[10px] ticker-number" style={{ color }}>
                        {zScore}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price + confidence */}
                <div className="text-right flex-shrink-0">
                  <div className="text-xs ticker-number font-medium" style={{ color: 'var(--text-primary)' }}>
                    {(anomaly.current_price * 100).toFixed(0)}¢
                  </div>
                  <div
                    className="text-[10px] ticker-number"
                    style={{ color: anomaly.confidence_score >= 60 ? color : 'var(--text-muted)' }}
                  >
                    {anomaly.confidence_score}%
                  </div>
                </div>

                {/* Anomaly type badge */}
                <span
                  className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ color, background: `${color}15` }}
                >
                  {anomaly.anomaly_type === 'both' ? 'VEL+VOL' : anomaly.anomaly_type === 'velocity' ? 'VEL' : 'VOL'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
