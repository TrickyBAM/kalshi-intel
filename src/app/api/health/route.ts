import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, boolean> = {};

  // Check Supabase connection
  try {
    const { error } = await supabase.from('alerts').select('id').limit(1);
    checks.supabase = !error;
  } catch {
    checks.supabase = false;
  }

  // Check Kalshi API
  try {
    const res = await fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=1&status=open', {
      next: { revalidate: 0 },
    });
    checks.kalshi = res.ok;
  } catch {
    checks.kalshi = false;
  }

  // Check Slack webhook config
  checks.slack_configured = !!(
    process.env.SLACK_WEBHOOK_URL &&
    !process.env.SLACK_WEBHOOK_URL.includes('placeholder')
  );

  const allHealthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    { status: allHealthy ? 200 : 207 }
  );
}
