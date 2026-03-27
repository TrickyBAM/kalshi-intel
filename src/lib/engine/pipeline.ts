// Main polling pipeline orchestrator
// Flow: Poll Kalshi → Store Watchlist Snapshots → Calculate Velocity → Check Clusters → Score → Alert

import { getAllActiveMarkets } from '../kalshi/client';
import type { KalshiMarket, MarketSnapshot, VelocityResult } from '../kalshi/types';
import { WATCHLIST, WATCHLIST_SERIES_SET } from '../config/watchlist';
import { THRESHOLDS } from '../config/thresholds';
import { storeSnapshots, getRecentSnapshots, getVolumeStats } from '../db/snapshots';
import { storeAlert, isInCooldown, countAlertsToday, markAlertSlackSent } from '../db/alerts';
import { calculateVelocity } from './velocity';
import { calculateVolumeZScore } from './volume';
import { detectClusters } from './correlation';
import { scoreConfidence } from './scoring';
import { detectAnomalies, updateScanContext, buildVolumeStats, createBroadScanContext } from './broad-scan';
import { sendSlackAlert } from '../notifications/slack';

// In-memory state for broad scan (resets on cold start, that's fine)
const broadScanContext = createBroadScanContext();
let volumeStats = new Map<string, { avg: number; stddev: number }>();

export interface PipelineResult {
  timestamp: string;
  markets_scanned: number;
  watchlist_markets: number;
  snapshots_stored: number;
  anomalies_detected: number;
  alerts_fired: number;
  clusters_detected: string[];
  errors: string[];
  duration_ms: number;
}

export async function runPipeline(): Promise<PipelineResult> {
  const start = Date.now();
  const result: PipelineResult = {
    timestamp: new Date().toISOString(),
    markets_scanned: 0,
    watchlist_markets: 0,
    snapshots_stored: 0,
    anomalies_detected: 0,
    alerts_fired: 0,
    clusters_detected: [],
    errors: [],
    duration_ms: 0,
  };

  try {
    // ── Step 1: Fetch ALL active markets ───────────────────────────────────
    console.log('[Pipeline] Fetching all active markets...');
    const allMarkets = await getAllActiveMarkets();
    result.markets_scanned = allMarkets.length;
    console.log(`[Pipeline] Fetched ${allMarkets.length} markets`);

    // ── Step 2: Separate watchlist vs broad scan ───────────────────────────
    const watchlistMarkets = allMarkets.filter(m =>
      WATCHLIST_SERIES_SET.has(m.series_ticker)
    );
    const broadMarkets = allMarkets; // Use all for broad scan
    result.watchlist_markets = watchlistMarkets.length;

    // ── Step 3: Store snapshots for watchlist markets ──────────────────────
    const now = new Date().toISOString();
    const snapshots: MarketSnapshot[] = watchlistMarkets.map(m => ({
      market_ticker: m.ticker,
      series_ticker: m.series_ticker,
      category: getCategoryForSeries(m.series_ticker),
      title: m.title,
      timestamp: now,
      yes_price: m.last_price / 100,
      yes_bid: m.yes_bid / 100,
      yes_ask: m.yes_ask / 100,
      spread: (m.yes_ask - m.yes_bid) / 100,
      volume_24h: m.volume_24h,
      open_interest: m.open_interest,
      last_trade_price: m.last_price / 100,
    }));

    if (snapshots.length > 0) {
      await storeSnapshots(snapshots);
      result.snapshots_stored = snapshots.length;
    }

    // ── Step 4: Calculate velocity for watchlist markets ──────────────────
    const velocities = new Map<string, VelocityResult>();

    for (const market of watchlistMarkets) {
      try {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentSnaps = await getRecentSnapshots(market.ticker, since24h);
        const volStats = await getVolumeStats(market.ticker);
        const zScore = calculateVolumeZScore(market.volume_24h, volStats.avg, volStats.stddev);
        const currentPrice = market.last_price / 100;
        const vel = calculateVelocity(market.ticker, currentPrice, recentSnaps, zScore);
        velocities.set(market.series_ticker, vel);
        velocities.set(market.ticker, vel);
      } catch (err) {
        result.errors.push(`Velocity error for ${market.ticker}: ${err}`);
      }
    }

    // ── Step 5: Detect correlation clusters ───────────────────────────────
    const clusters = detectClusters(velocities);
    result.clusters_detected = clusters.map(c => c.cluster_key);

    // ── Step 6: Broad platform scan for anomalies ─────────────────────────
    volumeStats = buildVolumeStats(broadMarkets, volumeStats);
    const anomalies = detectAnomalies(broadMarkets, broadScanContext, volumeStats);
    updateScanContext(broadScanContext, broadMarkets);
    result.anomalies_detected = anomalies.length;

    // Store top broad-scan anomalies as low-confidence alerts
    for (const anomaly of anomalies.slice(0, 5)) {
      if (anomaly.confidence_score >= 50 && !WATCHLIST_SERIES_SET.has(anomaly.series_ticker)) {
        try {
          await storeAlert({
            level: 'info',
            headline: `Broad scan: ${anomaly.title} — ${anomaly.anomaly_type} detected`,
            confidence_score: anomaly.confidence_score,
            primary_market: anomaly.market_ticker,
            velocity_data: {},
            correlated_markets: [],
            anomaly,
          });
        } catch (e) {
          result.errors.push(`Anomaly store error: ${e}`);
        }
      }
    }

    // ── Step 7: Score and fire alerts for watchlist markets ───────────────
    const flashCount = await countAlertsToday('flash');
    const highCount = await countAlertsToday('high');

    for (const market of watchlistMarkets) {
      const vel = velocities.get(market.ticker);
      if (!vel) continue;

      // Find relevant cluster
      const relevantCluster = clusters.find(c =>
        c.cluster_key === getClusterForSeries(market.series_ticker)
      );

      const score = scoreConfidence(vel, relevantCluster, market.volume_24h);
      if (!score.alert_level || score.alert_level === 'info') continue;

      // Volume floor check
      if (market.volume_24h < THRESHOLDS.VOLUME_FLOOR_24H) continue;

      // Daily caps
      if (score.alert_level === 'flash' && flashCount >= THRESHOLDS.MAX_FLASH_ALERTS_PER_DAY) continue;
      if ((score.alert_level === 'high' || score.alert_level === 'medium') && highCount >= THRESHOLDS.MAX_HIGH_ALERTS_PER_DAY) continue;

      // Cooldown check
      const cooldown = score.alert_level === 'flash'
        ? THRESHOLDS.FLASH_COOLDOWN_MS
        : THRESHOLDS.HIGH_COOLDOWN_MS;
      const inCooldown = await isInCooldown(market.ticker, cooldown, ['flash', 'high']);
      if (inCooldown) continue;

      // Build correlated market context
      const corrMarkets = watchlistMarkets
        .filter(m => m.ticker !== market.ticker)
        .slice(0, 4)
        .map(m => {
          const v = velocities.get(m.ticker);
          return {
            ticker: m.ticker,
            title: m.title,
            direction: v?.windows['1hr'].direction ?? 'flat',
            velocity_1hr_pct: v?.windows['1hr'].pct_change,
          };
        });

      const alertPayload = {
        level: score.alert_level,
        headline: buildHeadline(market, vel, score.alert_level),
        confidence_score: score.total,
        primary_market: market.ticker,
        primary_market_title: market.title,
        velocity_data: vel,
        correlated_markets: corrMarkets,
        cluster: relevantCluster,
      };

      try {
        const stored = await storeAlert(alertPayload);
        result.alerts_fired++;

        // Send to Slack (with fallback to DB-only)
        const slackResult = await sendSlackAlert(alertPayload);
        if (stored && slackResult.sent && slackResult.ts) {
          await markAlertSlackSent(stored.id, slackResult.ts);
        }
      } catch (e) {
        result.errors.push(`Alert fire error: ${e}`);
      }
    }

  } catch (err) {
    result.errors.push(`Pipeline error: ${err}`);
    console.error('[Pipeline] Fatal error:', err);
  }

  result.duration_ms = Date.now() - start;
  console.log(`[Pipeline] Done in ${result.duration_ms}ms. Alerts: ${result.alerts_fired}, Anomalies: ${result.anomalies_detected}`);

  return result;
}

function getCategoryForSeries(seriesTicker: string): string {
  return WATCHLIST.find(w => w.series_ticker === seriesTicker)?.category ?? 'other';
}

function getClusterForSeries(seriesTicker: string): string {
  // Map series to their primary cluster
  const map: Record<string, string> = {
    KXRECSSNBER: 'bearish_macro',
    KXCLOSEHORMUZ: 'geopolitical_risk',
    KXIRANWAR: 'geopolitical_risk',
    KXIRANNUS: 'risk_on',
    KXFEDDECISION: 'fed_pivot',
    KXFEDCUTS: 'fed_pivot',
    KXCPI: 'inflation_fear',
  };
  return map[seriesTicker] ?? '';
}

function buildHeadline(
  market: KalshiMarket,
  vel: VelocityResult,
  level: string
): string {
  const dir = vel.windows['5min'].direction === 'up' ? 'surging' : 'dropping';
  const pct5 = (Math.abs(vel.windows['5min'].pct_change) * 100).toFixed(1);
  const pct1h = (Math.abs(vel.windows['1hr'].pct_change) * 100).toFixed(1);

  if (level === 'flash') {
    return `${market.title} ${dir} ${pct5}% in 5 min`;
  }
  return `${market.title} — ${pct1h}% move in 1hr${vel.volume_spike ? ' with volume spike' : ''}`;
}
