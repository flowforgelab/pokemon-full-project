import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { prisma } from '@/lib/db/prisma';
import { CollectionStatisticsAnalyzer } from '@/lib/collection/statistics-analyzer';

// GET /api/collection/stats - Get collection statistics
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'overview';

    const analyzer = new CollectionStatisticsAnalyzer();

    switch (type) {
      case 'overview':
        const stats = await analyzer.getCollectionStats(user.id);
        return NextResponse.json(stats);

      case 'completion':
        const completion = await analyzer.getSetCompletion(user.id);
        return NextResponse.json(completion);

      case 'insights':
        const insights = await analyzer.getCollectionInsights(user.id);
        return NextResponse.json(insights);

      default:
        return NextResponse.json(
          { error: 'Invalid statistics type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error getting collection statistics:', error);
    return NextResponse.json(
      { error: 'Failed to get collection statistics' },
      { status: 500 }
    );
  }
}