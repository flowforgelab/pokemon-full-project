/**
 * API Route for checking AI analysis status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { aiAnalysisQueue } from '@/lib/jobs/queue';

interface RouteParams {
  params: Promise<{
    jobId: string;
  }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the jobId from params
    const { jobId } = await params;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Find analysis by jobId
    const analysis = await prisma.analysis.findFirst({
      where: {
        jobId: jobId,
        userId: user.id
      },
      include: {
        deck: {
          select: {
            id: true,
            name: true,
            formatId: true
          }
        }
      }
    });

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Get job status from queue if still processing
    let queueStatus = null;
    if (analysis.status === 'PENDING' || analysis.status === 'PROCESSING') {
      const queue = await aiAnalysisQueue;
      const job = await queue.getJob(jobId);
      
      if (job) {
        const state = await job.getState();
        queueStatus = {
          state,
          progress: job.progress,
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade
        };
      }
    }

    // Return analysis status
    return NextResponse.json({
      analysisId: analysis.id,
      status: analysis.status,
      model: analysis.model,
      focusAreas: analysis.focusAreas,
      userAge: analysis.userAge,
      deck: analysis.deck,
      createdAt: analysis.createdAt,
      startedAt: analysis.startedAt,
      completedAt: analysis.completedAt,
      error: analysis.error,
      result: analysis.result,
      queueStatus
    });

  } catch (error) {
    console.error('Status check error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get analysis status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}