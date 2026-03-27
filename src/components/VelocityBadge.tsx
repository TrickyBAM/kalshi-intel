'use client';

interface VelocityBadgeProps {
  pct_change: number;
  window: string;
  size?: 'sm' | 'md';
}

export function VelocityBadge({ pct_change, window, size = 'sm' }: VelocityBadgeProps) {
  const abs = Math.abs(pct_change * 100);
  const isUp = pct_change > 0.001;
  const isDown = pct_change < -0.001;
  const isFlat = !isUp && !isDown;

  const arrow = isUp ? '▲' : isDown ? '▼' : '—';
  const color = isUp ? '#22d3a6' : isDown ? '#ff5555' : '#888';
  const bg = isUp ? 'rgba(34, 211, 166, 0.08)' : isDown ? 'rgba(255, 85, 85, 0.08)' : 'rgba(136, 136, 136, 0.06)';

  const textSize = size === 'md' ? 'text-sm' : 'text-xs';
  const padding = size === 'md' ? 'px-2 py-1' : 'px-1.5 py-0.5';

  if (isFlat) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded font-body ${textSize} ${padding} ticker-number`}
        style={{ color, background: bg }}
      >
        <span>—</span>
        <span className="text-[10px] opacity-60">{window}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-body ${textSize} ${padding} ticker-number font-medium`}
      style={{ color, background: bg }}
    >
      <span style={{ fontSize: size === 'md' ? '10px' : '8px' }}>{arrow}</span>
      <span>{abs.toFixed(1)}%</span>
      <span className="text-[10px] opacity-50">{window}</span>
    </span>
  );
}
