import { supabaseAdmin } from './client';
import type { AlertPayload } from '../kalshi/types';

export interface StoredAlert {
  id: string;
  alert_level: string;
  headline: string;
  confidence_score: number;
  primary_market: string;
  correlated_markets: unknown;
  velocity_data: unknown;
  cluster_data: unknown;
  anomaly_data: unknown;
  slack_sent: boolean;
  slack_message_ts?: string;
  created_at: string;
  outcome_correct?: boolean;
  outcome_notes?: string;
  resolved_at?: string;
}

export async function storeAlert(payload: AlertPayload): Promise<StoredAlert | null> {
  const { data, error } = await supabaseAdmin
    .from('alerts')
    .insert({
      alert_level: payload.level,
      headline: payload.headline,
      confidence_score: payload.confidence_score,
      primary_market: payload.primary_market,
      correlated_markets: payload.correlated_markets,
      velocity_data: payload.velocity_data,
      cluster_data: payload.cluster || null,
      anomaly_data: payload.anomaly || null,
      slack_sent: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to store alert:', error.message);
    return null;
  }
  return data;
}

export async function markAlertSlackSent(id: string, ts: string): Promise<void> {
  await supabaseAdmin
    .from('alerts')
    .update({ slack_sent: true, slack_message_ts: ts })
    .eq('id', id);
}

export async function getRecentAlerts(limit = 50): Promise<StoredAlert[]> {
  const { data, error } = await supabaseAdmin
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

export async function getAlertsByMarket(marketTicker: string, limit = 20): Promise<StoredAlert[]> {
  const { data, error } = await supabaseAdmin
    .from('alerts')
    .select('*')
    .eq('primary_market', marketTicker)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

// Check cooldown: has an alert fired for this market within the window?
export async function isInCooldown(
  marketTicker: string,
  cooldownMs: number,
  levels: string[]
): Promise<boolean> {
  const since = new Date(Date.now() - cooldownMs);

  const { data } = await supabaseAdmin
    .from('alerts')
    .select('id')
    .eq('primary_market', marketTicker)
    .in('alert_level', levels)
    .gte('created_at', since.toISOString())
    .limit(1);

  return (data?.length ?? 0) > 0;
}

// Count alerts by level today
export async function countAlertsToday(level: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('alert_level', level)
    .gte('created_at', startOfDay.toISOString());

  return count ?? 0;
}
