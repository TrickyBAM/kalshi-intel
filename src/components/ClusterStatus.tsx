'use client';

interface ClusterSignal {
  cluster_name: string;
  cluster_key: string;
  description: string;
  markets_aligned: number;
  markets_total: number;
  trigger_score: number;
}

interface ClusterStatusProps {
  clusters: ClusterSignal[];
}

const CLUSTER_COLORS: Record<string, string> = {
  bearish_macro:      '#ef4444',
  geopolitical_risk:  '#8b5cf6',
  risk_on:            '#10b981',
  fed_pivot:          '#3b82f6',
  inflation_fear:     '#f59e0b',
};

export function ClusterStatus({ clusters }: ClusterStatusProps) {
  if (clusters.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4">
        <div className="live-dot" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>No active clusters detected</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {clusters.map((cluster, i) => {
        const color = CLUSTER_COLORS[cluster.cluster_key] ?? '#888';
        const pct = (cluster.trigger_score * 100).toFixed(0);
        const strength = cluster.trigger_score >= 0.8 ? 'STRONG' : cluster.trigger_score >= 0.5 ? 'FORMING' : 'WEAK';
        const strengthColor = cluster.trigger_score >= 0.8 ? color : 'var(--text-secondary)';

        return (
          <div
            key={cluster.cluster_key}
            className={`animate-fade-in-up delay-${i} p-3 rounded-lg`}
            style={{ background: `${color}08`, border: `1px solid ${color}25` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: color }}
                />
                <span
                  className="font-display text-sm tracking-wide"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {cluster.cluster_name}
                </span>
              </div>
              <span
                className="text-[10px] font-semibold tracking-widest"
                style={{ color: strengthColor }}
              >
                {strength}
              </span>
            </div>

            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              {cluster.description}
            </p>

            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="cluster-fill"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}66, ${color})` }}
                />
              </div>
              <span className="text-[11px] ticker-number" style={{ color }}>
                {cluster.markets_aligned}/{cluster.markets_total}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
