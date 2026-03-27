'use client';

import { VelocityBadge } from './VelocityBadge';
import { CATEGORY_META, type Category } from '@/lib/config/watchlist';

interface MarketData {
  series_ticker: string;
  category: string;
  title: string;
  description: string;
  latest: {
    market_ticker: string;
    yes_price: number;
    yes_bid: number;
    yes_ask: number;
    spread: number;
    volume_24h: number;
    timestamp: string;
  } | null;
  velocity?: {
    '5min'?: { pct_change: number; direction: string };
    '1hr'?: { pct_change: number; direction: string };
  };
}

interface MarketCardProps {
  market: MarketData;
  index: number;
  alertLevel?: 'flash' | 'high' | 'medium' | null;
}

export function MarketCard({ market, index, alertLevel }: MarketCardProps) {
  const catMeta = CATEGORY_META[market.category as Category] ?? { color: '#888', label: market.category, icon: '•' };
  const price = market.latest?.yes_price ?? null;
  const vol24h = market.latest?.volume_24h ?? 0;
  const spread = market.latest?.spread ?? 0;

  const vel5min = market.velocity?.['5min']?.pct_change ?? 0;
  const vel1hr = market.velocity?.['1hr']?.pct_change ?? 0;

  const glowClass = alertLevel === 'flash' ? 'glow-flash'
    : alertLevel === 'high' ? 'glow-high'
    : alertLevel === 'medium' ? 'glow-medium' : '';

  const delayClass = `delay-${Math.min(index, 10)}`;

  const formatVol = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v}`;
  };

  return (
    <div
      className={`card p-4 animate-fade-in-up ${delayClass} ${glowClass} relative overflow-hidden cursor-default select-none`}
    >
      {/* Category color accent strip */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
        style={{ background: `linear-gradient(90deg, ${catMeta.color}, transparent)` }}
      />

      {/* Alert flash indicator */}
      {alertLevel === 'flash' && (
        <div className="absolute top-2 right-2">
          <div className="live-dot-red" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="cat-pill"
              style={{ color: catMeta.color, borderColor: `${catMeta.color}40` }}
            >
              {catMeta.icon} {catMeta.label}
            </span>
          </div>
          <h3
            className="font-display text-base leading-tight"
            style={{ color: 'var(--text-primary)', letterSpacing: '0.03em' }}
          >
            {market.title}
          </h3>
        </div>

        {/* Price */}
        {price !== null && (
          <div className="text-right flex-shrink-0">
            <div
              className="font-display text-2xl ticker-number leading-none"
              style={{ color: catMeta.color }}
            >
              {(price * 100).toFixed(0)}¢
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {(price * 100).toFixed(0)}% YES
            </div>
          </div>
        )}

        {price === null && (
          <div className="text-right">
            <div className="font-display text-lg" style={{ color: 'var(--text-muted)' }}>—</div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>no data</div>
          </div>
        )}
      </div>

      {/* Velocity badges */}
      {(vel5min !== 0 || vel1hr !== 0) && (
        <div className="flex items-center gap-1.5 mb-3">
          <VelocityBadge pct_change={vel5min} window="5m" />
          <VelocityBadge pct_change={vel1hr} window="1h" />
        </div>
      )}

      {/* Spread bar */}
      {price !== null && (
        <div className="mb-2">
          <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(price * 100, 100)}%`,
                background: `linear-gradient(90deg, ${catMeta.color}66, ${catMeta.color})`,
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Bid {((market.latest?.yes_bid ?? 0) * 100).toFixed(0)}¢
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Ask {((market.latest?.yes_ask ?? 0) * 100).toFixed(0)}¢
            </span>
          </div>
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>VOL 24H </span>
          <span className="text-[11px] font-medium ticker-number" style={{ color: 'var(--text-secondary)' }}>
            {formatVol(vol24h)}
          </span>
        </div>
        <div>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>SPREAD </span>
          <span className="text-[11px] ticker-number" style={{ color: spread > 0.05 ? '#888' : '#22d3a6' }}>
            {(spread * 100).toFixed(1)}¢
          </span>
        </div>
      </div>
    </div>
  );
}
