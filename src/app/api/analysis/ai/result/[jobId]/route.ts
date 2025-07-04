/**
 * API Route for retrieving AI analysis results
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';

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

    // Check if analysis is completed
    if (analysis.status !== 'COMPLETED') {
      return NextResponse.json(
        { 
          error: 'Analysis not completed',
          status: analysis.status,
          message: analysis.status === 'FAILED' 
            ? `Analysis failed: ${analysis.error}` 
            : 'Analysis is still in progress'
        },
        { status: 400 }
      );
    }

    // Return completed analysis
    return NextResponse.json({
      success: true,
      analysisId: analysis.id,
      analysis: analysis.result,
      deck: analysis.deck,
      metadata: {
        model: analysis.model,
        focusAreas: analysis.focusAreas,
        userAge: analysis.userAge,
        createdAt: analysis.createdAt,
        completedAt: analysis.completedAt,
        processingTime: analysis.completedAt && analysis.startedAt
          ? new Date(analysis.completedAt).getTime() - new Date(analysis.startedAt).getTime()
          : null
      }
    });

  } catch (error) {
    console.error('Result retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get analysis result',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}