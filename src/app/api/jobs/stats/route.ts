import { NextResponse } from 'next/server';
import { getAllQueuesStats } from '@/lib/jobs/queue';

export async function GET() {
  try {
    const stats = await getAllQueuesStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    return NextResponse.json(
      { error: 'Failed to get queue statistics' },
      { status: 500 }
    );
  }
}