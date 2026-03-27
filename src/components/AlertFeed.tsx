'use client';

import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
  alert_level: string;
  headline: string;
  confidence_score: number;
  primary_market: string;
  created_at: string;
  slack_sent: boolean;
  cluster_data?: { cluster_name?: string };
}

interface AlertFeedProps {
  alerts: Alert[];
}

const LEVEL_CONFIG = {
  flash:  { color: '#ff3b3b', bg: 'rgba(255,59,59,0.1)',   label: 'FLASH',  dot: true },
  high:   { color: '#ff7c2a', bg: 'rgba(255,124,42,0.08)', label: 'HIGH',   dot: false },
  medium: { color: '#f5c518', bg: 'rgba(245,197,24,0.07)', label: 'MED',    dot: false },
  info:   { color: '#4488ff', bg: 'rgba(68,136,255,0.06)', label: 'SCAN',   dot: false },
  daily_digest: { color: '#888', bg: 'rgba(136,136,136,0.06)', label: 'DIGEST', dot: false },
};

export function AlertFeed({ alerts }: AlertFeedProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div style={{ color: 'var(--text-muted)', fontSize: 24 }}>◎</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No alerts yet. Pipeline is watching.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert, i) => {
        const cfg = LEVEL_CONFIG[alert.alert_level as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.info;
        const timeAgo = formatDistanceToNow(new Date(alert.created_at), { addSuffix: true });

        return (
          <div
            key={alert.id}
            className={`card p-3 animate-fade-in-left delay-${Math.min(i, 8)}`}
            style={{
              borderLeft: `3px solid ${cfg.color}`,
              background: cfg.bg,
              borderColor: `${cfg.color}40`,
            }}
          >
            <div className="flex items-start gap-2">
              {/* Level badge */}
              <div className="flex-shrink-0 mt-0.5">
                <span
                  className="level-badge"
                  style={{ color: cfg.color, background: `${cfg.color}15` }}
                >
                  {cfg.label}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {alert.headline}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {timeAgo}
                  </span>
                  {alert.confidence_score != null && (
                    <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      {alert.confidence_score}/100 confidence
                    </span>
                  )}
                  {alert.cluster_data && (
                    <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      ⬡ cluster
                    </span>
                  )}
                  {alert.slack_sent && (
                    <span className="text-[10px]" style={{ color: '#22d3a6' }}>✓ slack</span>
                  )}
                </div>
              </div>

              {/* Confidence bar */}
              {alert.confidence_score != null && (
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="text-[10px] ticker-number" style={{ color: cfg.color }}>
                    {alert.confidence_score}
                  </span>
                  <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${alert.confidence_score}%`, background: cfg.color }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
