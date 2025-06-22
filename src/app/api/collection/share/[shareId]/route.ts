import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { CollectionManager } from '@/lib/collection/collection-manager';
import type { CollectionSharingConfig } from '@/lib/collection/types';

// GET /api/collection/share/[shareId] - Get shared collection
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;

    if (!shareId) {
      return NextResponse.json(
        { error: 'Share ID is required' },
        { status: 400 }
      );
    }

    // Check if authentication is required
    const shared = await prisma.sharedCollection.findUnique({
      where: { id: shareId },
    });

    if (!shared) {
      return NextResponse.json(
        { error: 'Shared collection not found' },
        { status: 404 }
      );
    }

    const config = shared.config as CollectionSharingConfig;

    if (config.requireAuth) {
      const { userId } = auth();
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // Get shared collection
    const manager = new CollectionManager();
    const result = await manager.getSharedCollection(shareId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error getting shared collection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get shared collection' },
      { status: 500 }
    );
  }
}