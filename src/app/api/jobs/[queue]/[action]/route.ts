import { NextRequest, NextResponse } from 'next/server';
import {
  priceUpdateQueue,
  setImportQueue,
  cardSyncQueue,
  dataCleanupQueue,
  reportQueue,
  collectionIndexQueue,
  aiAnalysisQueue,
  pauseQueue,
  resumeQueue,
  clearQueue
} from '@/lib/jobs/queue';

const queueMap = {
  priceUpdates: priceUpdateQueue,
  setImports: setImportQueue,
  cardSync: cardSyncQueue,
  dataCleanup: dataCleanupQueue,
  reports: reportQueue,
  collectionIndex: collectionIndexQueue,
  aiAnalysis: aiAnalysisQueue,
};

export async function POST(
  request: NextRequest,
  { params }: { params: { queue: string; action: string } }
) {
  const { queue: queueName, action } = params;

  // Get the queue instance
  const queuePromise = queueMap[queueName as keyof typeof queueMap];
  if (!queuePromise) {
    return NextResponse.json(
      { error: 'Queue not found' },
      { status: 404 }
    );
  }

  try {
    const queue = await queuePromise;

    switch (action) {
      case 'pause':
        await pauseQueue(queue);
        return NextResponse.json({ message: `Queue ${queueName} paused` });
      
      case 'resume':
        await resumeQueue(queue);
        return NextResponse.json({ message: `Queue ${queueName} resumed` });
      
      case 'clean':
        // Clean completed jobs older than 1 hour
        await clearQueue(queue, 'completed');
        // Clean failed jobs older than 24 hours
        await clearQueue(queue, 'failed');
        return NextResponse.json({ message: `Queue ${queueName} cleaned` });
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Failed to ${action} queue ${queueName}:`, error);
    return NextResponse.json(
      { error: `Failed to ${action} queue` },
      { status: 500 }
    );
  }
}