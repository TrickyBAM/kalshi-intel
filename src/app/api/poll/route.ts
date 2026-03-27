import { NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/lib/engine/pipeline';

// This route is triggered by Vercel Cron or external cron
// Protected by a shared secret

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runPipeline();
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/poll] Pipeline error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Also support POST for webhook-style triggers
export async function POST(req: NextRequest) {
  return GET(req);
}
