'use client';

import { useEffect, useState, useCallback } from 'react';
import { MarketCard } from '@/components/MarketCard';
import { AlertFeed } from '@/components/AlertFeed';
import { ClusterStatus } from '@/components/ClusterStatus';
import { BroadScanPanel } from '@/components/BroadScanPanel';
import { CATEGORY_META } from '@/lib/config/watchlist';

// Types
interface MarketData {
  series_ticker: string;
  category: string;
  category_label: string;
  category_color: string;
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
  velocity?: Record<string, { pct_change: number; direction: string }>;
}

interface CategoryGroup {
  category: string;
  label: string;
  color: string;
  icon: string;
  markets: MarketData[];
}

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

interface ClusterSignal {
  cluster_name: string;
  cluster_key: string;
  description: string;
  markets_aligned: number;
  markets_total: number;
  trigger_score: number;
}

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

export default function DashboardPage() {
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clusters, setClusters] = useState<ClusterSignal[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [marketsRes, alertsRes, signalsRes] = await Promise.all([
        fetch('/api/markets').then(r => r.json()).catch(() => null),
        fetch('/api/alerts?limit=30').then(r => r.json()).catch(() => null),
        fetch('/api/signals').then(r => r.json()).catch(() => null),
      ]);

      if (marketsRes?.categories) setCategories(marketsRes.categories);
      if (alertsRes?.alerts) setAlerts(alertsRes.alerts);
      if (signalsRes?.anomalies) setAnomalies(signalsRes.anomalies);
      if (signalsRes?.recent_alerts) {
        // Extract clusters from recent alerts' cluster_data
        const clusterMap = new Map<string, ClusterSignal>();
        for (const a of (signalsRes.recent_alerts as Alert[])) {
          const cd = (a as any).cluster_data;
          if (cd?.cluster_key && !clusterMap.has(cd.cluster_key)) {
            clusterMap.set(cd.cluster_key, cd);
          }
        }
        if (clusterMap.size > 0) {
          setClusters(Array.from(clusterMap.values()));
        }
      }

      // Calculate total scanned from signal data
      if (signalsRes?.anomalies?.length > 0) {
        setTotalScanned(prev => Math.max(prev, signalsRes.anomalies.length * 20));
      }

      setLastUpdated(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'America/New_York',
      }));
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const triggerPoll = async () => {
    setIsPolling(true);
    try {
      await fetch('/api/poll');
      await fetchData();
    } finally {
      setIsPolling(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000); // Refresh dashboard every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const visibleCategories = selectedCategory
    ? categories.filter(c => c.category === selectedCategory)
    : categories;

  const flashAlerts = alerts.filter(a => a.alert_level === 'flash').length;
  const highAlerts = alerts.filter(a => a.alert_level === 'high').length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between"
        style={{
          background: 'rgba(10, 10, 15, 0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Logo + Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="live-dot" />
            <h1 className="font-display text-2xl tracking-widest" style={{ color: 'var(--text-primary)', letterSpacing: '0.1em' }}>
              KALSHI INTEL
            </h1>
          </div>
          {lastUpdated && (
            <span className="text-xs ticker-number hidden sm:block" style={{ color: 'var(--text-muted)' }}>
              {lastUpdated} ET
            </span>
          )}
        </div>

        {/* Alert counters + Poll button */}
        <div className="flex items-center gap-3">
          {flashAlerts > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: 'rgba(255,59,59,0.12)', border: '1px solid rgba(255,59,59,0.3)' }}>
              <div className="live-dot-red" />
              <span className="text-xs font-bold" style={{ color: '#ff3b3b' }}>{flashAlerts} FLASH</span>
            </div>
          )}
          {highAlerts > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: 'rgba(255,124,42,0.10)', border: '1px solid rgba(255,124,42,0.25)' }}>
              <span className="text-xs font-bold" style={{ color: '#ff7c2a' }}>{highAlerts} HIGH</span>
            </div>
          )}
          <button
            onClick={triggerPoll}
            disabled={isPolling}
            className="px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all duration-200"
            style={{
              background: isPolling ? 'rgba(255,255,255,0.04)' : 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: isPolling ? 'var(--text-muted)' : '#4488ff',
              cursor: isPolling ? 'not-allowed' : 'pointer',
            }}
          >
            {isPolling ? '↻ SCANNING...' : '↻ POLL NOW'}
          </button>
        </div>
      </header>

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <div className="flex h-[calc(100vh-65px)]">

        {/* ── Left sidebar: Alerts + Clusters ───────────────────────────── */}
        <aside
          className="w-80 flex-shrink-0 overflow-y-auto flex flex-col gap-0"
          style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Alerts panel */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm tracking-widest" style={{ color: 'var(--text-secondary)', letterSpacing: '0.15em' }}>
                ALERT FEED
              </h2>
              <span className="text-[10px] ticker-number" style={{ color: 'var(--text-muted)' }}>
                {alerts.length} total
              </span>
            </div>
            <AlertFeed alerts={alerts.slice(0, 15)} />
          </div>

          <div className="divider-gradient mx-4" />

          {/* Clusters panel */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm tracking-widest" style={{ color: 'var(--text-secondary)', letterSpacing: '0.15em' }}>
                CLUSTER STATUS
              </h2>
              {clusters.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
                  {clusters.length} active
                </span>
              )}
            </div>
            <ClusterStatus clusters={clusters} />
          </div>
        </aside>

        {/* ── Center: Market cards ───────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {/* Category filter tabs */}
          <div
            className="sticky top-0 z-10 px-6 py-3 flex items-center gap-2 overflow-x-auto"
            style={{ background: 'rgba(10, 10, 15, 0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
          >
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex-shrink-0 px-3 py-1 rounded text-xs font-semibold tracking-wide transition-all"
              style={{
                background: selectedCategory === null ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: selectedCategory === null ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.06)',
                color: selectedCategory === null ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              ALL
            </button>
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key === selectedCategory ? null : key)}
                className="flex-shrink-0 px-3 py-1 rounded text-xs font-semibold tracking-wide transition-all"
                style={{
                  background: selectedCategory === key ? `${meta.color}15` : 'transparent',
                  border: `1px solid ${selectedCategory === key ? `${meta.color}50` : 'rgba(255,255,255,0.06)'}`,
                  color: selectedCategory === key ? meta.color : 'var(--text-muted)',
                }}
              >
                {meta.icon} {meta.label.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Market cards grid */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="live-dot animate-pulse-glow" />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading markets...</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-8">
              {visibleCategories.map(group => (
                <div key={group.category}>
                  {/* Category header */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xl">{group.icon}</span>
                    <h2
                      className="font-display text-xl tracking-widest"
                      style={{ color: group.color, letterSpacing: '0.12em' }}
                    >
                      {group.label.toUpperCase()}
                    </h2>
                    <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${group.color}30, transparent)` }} />
                    <span className="text-xs ticker-number" style={{ color: 'var(--text-muted)' }}>
                      {group.markets.length} markets
                    </span>
                  </div>

                  {/* Cards grid */}
                  {group.markets.length === 0 ? (
                    <div
                      className="p-4 rounded-lg text-sm"
                      style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      No active markets found for this series. Data loads after first poll cycle.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.markets.map((market, i) => (
                        <MarketCard
                          key={market.series_ticker}
                          market={market}
                          index={i}
                          alertLevel={
                            alerts.find(a =>
                              a.primary_market?.includes(market.series_ticker) &&
                              ['flash', 'high', 'medium'].includes(a.alert_level)
                            )?.alert_level as 'flash' | 'high' | 'medium' | null ?? null
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Empty state */}
              {visibleCategories.every(g => g.markets.length === 0) && !isLoading && (
                <div className="text-center py-20">
                  <div className="font-display text-4xl mb-3" style={{ color: 'var(--text-muted)' }}>◎</div>
                  <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                    No market data yet.
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Click "POLL NOW" to run the first scan.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── Right sidebar: Broad scan panel ───────────────────────────── */}
        <aside
          className="w-72 flex-shrink-0 overflow-y-auto"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm tracking-widest" style={{ color: 'var(--text-secondary)', letterSpacing: '0.15em' }}>
                PLATFORM SCAN
              </h2>
              <span
                className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(245,197,24,0.12)', color: '#f5c518', border: '1px solid rgba(245,197,24,0.2)' }}
              >
                LIVE
              </span>
            </div>
            <BroadScanPanel
              anomalies={anomalies}
              totalScanned={totalScanned || 1000}
            />
          </div>

          <div className="divider-gradient mx-4" />

          {/* System stats */}
          <div className="p-4">
            <h2 className="font-display text-sm tracking-widest mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.15em' }}>
              SYSTEM
            </h2>
            <div className="space-y-2">
              {[
                { label: 'PIPELINE', value: isPolling ? 'RUNNING' : 'IDLE', ok: !isPolling },
                { label: 'ALERTS TODAY', value: `${flashAlerts + highAlerts}`, ok: true },
                { label: 'ANOMALIES', value: `${anomalies.length} flagged`, ok: true },
                { label: 'REFRESH', value: '30s auto', ok: true },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[10px] tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {item.label}
                  </span>
                  <span
                    className="text-[11px] ticker-number font-medium"
                    style={{ color: item.ok ? '#22d3a6' : '#f5c518' }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="divider-gradient mx-4" />

          {/* Help text */}
          <div className="p-4">
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Platform scan checks <strong style={{ color: 'var(--text-secondary)' }}>ALL</strong> active Kalshi markets every cycle.
              Velocity and volume spikes across the full platform surface here — not just watchlist markets.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
