import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { CollectionManager } from '@/lib/collection/collection-manager';
import { z } from 'zod';

// Tag schema
const tagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

// Folder schema
const folderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false),
});

// POST /api/collection/organize/tags - Create tag
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const pathname = req.nextUrl.pathname;

    if (pathname.endsWith('/tags')) {
      // Create tag
      const body = await req.json();
      const validated = tagSchema.parse(body);

      const manager = new CollectionManager();
      const tag = await manager.organizationManager.createTag(user.id, validated);

      return NextResponse.json(tag);
    } else if (pathname.endsWith('/folders')) {
      // Create folder
      const body = await req.json();
      const validated = folderSchema.parse(body);

      const manager = new CollectionManager();
      const folder = await manager.createFolder(user.id, validated);

      return NextResponse.json(folder);
    } else if (pathname.endsWith('/apply-tags')) {
      // Apply tags to cards
      const body = await req.json();
      const { collectionIds, tags } = body;

      if (!Array.isArray(collectionIds) || !Array.isArray(tags)) {
        return NextResponse.json(
          { error: 'Collection IDs and tags are required' },
          { status: 400 }
        );
      }

      const manager = new CollectionManager();
      const count = await manager.applyTags(user.id, collectionIds, tags);

      return NextResponse.json({ updated: count });
    } else if (pathname.endsWith('/favorite')) {
      // Toggle favorite
      const body = await req.json();
      const { collectionIds } = body;

      if (!Array.isArray(collectionIds)) {
        return NextResponse.json(
          { error: 'Collection IDs are required' },
          { status: 400 }
        );
      }

      const manager = new CollectionManager();
      const count = await manager.toggleFavorite(user.id, collectionIds);

      return NextResponse.json({ toggled: count });
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
  } catch (error) {
    console.error('Error organizing collection:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to organize collection' },
      { status: 500 }
    );
  }
}

// GET /api/collection/organize/tags - Get tags
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const pathname = req.nextUrl.pathname;

    if (pathname.endsWith('/tags')) {
      // Get tags
      const tags = await prisma.collectionTag.findMany({
        where: { userId: user.id },
        orderBy: { name: 'asc' },
      });

      // Update card counts
      for (const tag of tags) {
        const count = await prisma.userCollection.count({
          where: {
            userId: user.id,
            tags: { has: tag.name },
          },
        });
        tag.cardCount = count;
      }

      return NextResponse.json(tags);
    } else if (pathname.endsWith('/folders')) {
      // Get folders
      const folders = await prisma.collectionFolder.findMany({
        where: { userId: user.id },
        orderBy: { name: 'asc' },
      });

      return NextResponse.json(folders);
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
  } catch (error) {
    console.error('Error getting organization data:', error);
    return NextResponse.json(
      { error: 'Failed to get organization data' },
      { status: 500 }
    );
  }
}