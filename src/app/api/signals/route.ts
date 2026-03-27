import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get latest broad scan anomalies
    const { data: anomalies } = await supabaseAdmin
      .from('broad_scan_anomalies')
      .select('*')
      .order('scanned_at', { ascending: false })
      .limit(50);

    // Get active alerts from last 1hr
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentAlerts } = await supabaseAdmin
      .from('alerts')
      .select('*')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      anomalies: anomalies || [],
      recent_alerts: recentAlerts || [],
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
