// Slack webhook sender with Block Kit formatting

import type { AlertPayload, VelocityResult, ClusterSignal } from '../kalshi/types';

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

export interface SlackResult {
  sent: boolean;
  ts?: string;
  error?: string;
}

// Send a Block Kit message to Slack
export async function sendSlackAlert(payload: AlertPayload): Promise<SlackResult> {
  if (!WEBHOOK_URL || WEBHOOK_URL.includes('placeholder')) {
    console.log('[Slack] No webhook configured, logging alert to DB only');
    return { sent: false, error: 'No webhook URL configured' };
  }

  const blocks = buildBlocks(payload);
  const message = { blocks, text: payload.headline };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      const body = await res.text();
      return { sent: false, error: `Slack error ${res.status}: ${body}` };
    }

    return { sent: true, ts: Date.now().toString() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { sent: false, error: msg };
  }
}

function buildBlocks(payload: AlertPayload): unknown[] {
  const levelEmoji = {
    flash: '🔴',
    high: '🟠',
    medium: '🟡',
    info: '🔵',
    daily_digest: '📋',
  }[payload.level] ?? '⚪';

  const levelLabel = payload.level.toUpperCase();
  const vel = payload.velocity_data as Partial<VelocityResult>;
  const cluster = payload.cluster as ClusterSignal | undefined;

  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${levelEmoji} ${levelLabel} — ${payload.headline}`,
        emoji: true,
      },
    },
    { type: 'divider' },
  ];

  // Primary signal section
  const fields: unknown[] = [];

  if (vel?.current_price !== undefined) {
    fields.push({
      type: 'mrkdwn',
      text: `*Current Price:* ${(vel.current_price * 100).toFixed(1)}¢`,
    });
  }

  if (vel?.windows?.['5min']?.pct_change !== undefined) {
    const p5 = (vel.windows['5min'].pct_change * 100).toFixed(1);
    const d5 = vel.windows['5min'].direction === 'up' ? '⬆️' : vel.windows['5min'].direction === 'down' ? '⬇️' : '→';
    fields.push({ type: 'mrkdwn', text: `*5min:* ${p5}% ${d5}` });
  }

  if (vel?.windows?.['1hr']?.pct_change !== undefined) {
    const p1h = (vel.windows['1hr'].pct_change * 100).toFixed(1);
    const d1h = vel.windows['1hr'].direction === 'up' ? '⬆️' : vel.windows['1hr'].direction === 'down' ? '⬇️' : '→';
    fields.push({ type: 'mrkdwn', text: `*1hr:* ${p1h}% ${d1h}` });
  }

  if (vel?.volume_z_score !== undefined) {
    const zs = vel.volume_z_score.toFixed(1);
    const spikeLabel = vel.volume_spike ? ' 🔥 SPIKE' : '';
    fields.push({ type: 'mrkdwn', text: `*Volume Z-score:* ${zs}${spikeLabel}` });
  }

  fields.push({
    type: 'mrkdwn',
    text: `*Confidence:* ${payload.confidence_score}/100`,
  });

  if (fields.length > 0) {
    blocks.push({ type: 'section', fields });
  }

  // Correlated markets
  if (payload.correlated_markets?.length > 0) {
    const corrText = payload.correlated_markets
      .slice(0, 4)
      .map(m => {
        const dir = m.direction === 'up' ? '⬆️' : m.direction === 'down' ? '⬇️' : '→';
        const vel = m.velocity_1hr_pct != null ? ` (${(m.velocity_1hr_pct * 100).toFixed(1)}%)` : '';
        return `• ${m.title || m.ticker}${vel} ${dir}`;
      })
      .join('\n');

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Related moves:*\n${corrText}` },
    });
  }

  // Cluster info
  if (cluster) {
    const clusterBar = '█'.repeat(cluster.markets_aligned) + '░'.repeat(cluster.markets_total - cluster.markets_aligned);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Cluster: ${cluster.cluster_name}*\n${clusterBar} ${cluster.markets_aligned}/${cluster.markets_total} aligned\n_${cluster.description}_`,
      },
    });
  }

  // Footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Kalshi Intel • ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })} ET • Market: ${payload.primary_market}`,
      },
    ],
  });

  return blocks;
}

// Daily digest format
export async function sendDailyDigest(data: {
  topMovers: Array<{ title: string; delta_24h: number; current_price: number }>;
  clusters: ClusterSignal[];
  alertStats: { flash: number; high: number; medium: number };
  date: string;
}): Promise<SlackResult> {
  if (!WEBHOOK_URL || WEBHOOK_URL.includes('placeholder')) {
    return { sent: false, error: 'No webhook configured' };
  }

  const moversText = data.topMovers
    .slice(0, 5)
    .map((m, i) => {
      const d = (m.delta_24h * 100).toFixed(1);
      const dir = m.delta_24h > 0 ? '⬆️' : '⬇️';
      return `${i + 1}. ${m.title}: ${(m.current_price * 100).toFixed(0)}¢ (${d >= '0' ? '+' : ''}${d}%) ${dir}`;
    })
    .join('\n');

  const clustersText = data.clusters.length > 0
    ? data.clusters.map(c => `• ${c.cluster_name}: ${c.markets_aligned}/${c.markets_total} aligned`).join('\n')
    : 'No active clusters';

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📋 DAILY DIGEST — ${data.date}`, emoji: true },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Top Movers (24hr):*\n${moversText || 'No significant moves'}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Active Clusters:*\n${clustersText}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*🔴 Flash:* ${data.alertStats.flash}` },
        { type: 'mrkdwn', text: `*🟠 High:* ${data.alertStats.high}` },
        { type: 'mrkdwn', text: `*🟡 Medium:* ${data.alertStats.medium}` },
      ],
    },
  ];

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks, text: `Daily Digest — ${data.date}` }),
    });
    return res.ok ? { sent: true } : { sent: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Unknown' };
  }
}
