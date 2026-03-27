import type { VelocityResult, ClusterSignal } from '../kalshi/types';

interface ClusterDef {
  key: string;
  name: string;
  description: string;
  // series_ticker → expected direction when cluster fires
  expectations: Record<string, 'up' | 'down'>;
}

const CLUSTERS: ClusterDef[] = [
  {
    key: 'bearish_macro',
    name: 'Bearish Macro Cluster',
    description: 'Recession fear building across indicators',
    expectations: {
      KXRECSSNBER: 'up',
      INX: 'up',          // Oil up = cost pressure
      INXD: 'down',       // S&P down
      TREASURY10Y: 'up',  // Yields up = risk-off
      KXFEDDECISION: 'up', // Rate cut hopes fading
    },
  },
  {
    key: 'geopolitical_risk',
    name: 'Geopolitical Risk Cluster',
    description: 'Conflict escalation driving risk-off move',
    expectations: {
      KXCLOSEHORMUZ: 'up',
      KXIRANWAR: 'up',
      INX: 'up',     // Oil up on supply fears
      GOLD: 'up',    // Gold up = safe haven
      INXD: 'down',  // S&P down
    },
  },
  {
    key: 'risk_on',
    name: 'Risk-On Cluster',
    description: 'De-escalation or dovish shift driving optimism',
    expectations: {
      KXIRANNUS: 'up',    // Ceasefire more likely
      KXRECSSNBER: 'down', // Recession less likely
      INXD: 'up',          // S&P up
      INX: 'down',         // Oil down on peace
      GOLD: 'down',        // Gold down = less safe haven
    },
  },
  {
    key: 'fed_pivot',
    name: 'Fed Pivot Cluster',
    description: 'Monetary policy shift toward cuts',
    expectations: {
      KXFEDDECISION: 'up',  // Rate cut prob up
      KXFEDCUTS: 'up',      // More cuts expected
      TREASURY10Y: 'down',  // Yields fall on cut expectations
      INXD: 'up',           // S&P up on dovish news
    },
  },
  {
    key: 'inflation_fear',
    name: 'Inflation Fear Cluster',
    description: 'CPI surprise triggering hawkish re-pricing',
    expectations: {
      KXCPI: 'up',           // CPI beats to upside
      KXFEDDECISION: 'down', // Cut less likely
      TREASURY10Y: 'up',     // Yields up
      INXD: 'down',          // S&P down
    },
  },
];

// Check all clusters given current velocity results
export function detectClusters(
  velocities: Map<string, VelocityResult>
): ClusterSignal[] {
  const signals: ClusterSignal[] = [];

  for (const cluster of CLUSTERS) {
    let aligned = 0;
    const total = Object.keys(cluster.expectations).length;

    for (const [seriesTicker, expectedDir] of Object.entries(cluster.expectations)) {
      // Find any velocity result whose ticker contains the series ticker
      for (const [ticker, vel] of velocities.entries()) {
        if (ticker.startsWith(seriesTicker) || ticker.includes(seriesTicker)) {
          const dir = vel.windows['1hr'].direction;
          if (dir === expectedDir) aligned++;
          break;
        }
      }
    }

    if (aligned >= 2) { // At least 2 aligned to flag as "forming"
      signals.push({
        cluster_name: cluster.name,
        cluster_key: cluster.key,
        description: cluster.description,
        markets_aligned: aligned,
        markets_total: total,
        trigger_score: aligned / total,
      });
    }
  }

  // Sort by trigger score desc
  return signals.sort((a, b) => b.trigger_score - a.trigger_score);
}
