import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { CollectionManager } from '@/lib/collection/collection-manager';

// GET /api/collection/dashboard - Get collection dashboard
export async function GET(_req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get collection dashboard
    const manager = new CollectionManager();
    const dashboard = await manager.getCollectionDashboard(user.id);

    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('Error getting collection dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to get collection dashboard' },
      { status: 500 }
    );
  }
}