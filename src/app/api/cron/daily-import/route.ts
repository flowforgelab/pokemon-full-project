import { NextResponse } from 'next/server';
import { runAutoImport } from '@/scripts/auto-import';

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
    console.log('Starting auto import via cron job...');
    
    // Run the auto import (decides between batch import or smart update)
    runAutoImport().catch(error => {
      console.error('Auto import error:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Auto import started (will run batch import or smart update based on completion)',
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