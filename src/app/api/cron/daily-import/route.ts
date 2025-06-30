import { NextResponse } from 'next/server';
import { runDailyImport } from '@/scripts/smart-daily-import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: Request) {
  // Verify this is from Vercel Cron (or allow local development)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting daily import via cron job...');
    
    // Run the import asynchronously to avoid timeout
    runDailyImport().catch(error => {
      console.error('Daily import error:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Daily import started',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}