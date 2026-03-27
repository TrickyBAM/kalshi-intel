import { NextRequest, NextResponse } from 'next/server';
import { getRecentAlerts } from '@/lib/db/alerts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  try {
    const alerts = await getRecentAlerts(Math.min(limit, 200));
    return NextResponse.json({ alerts, count: alerts.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
