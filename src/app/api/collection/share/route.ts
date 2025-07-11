import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { CollectionManager } from '@/lib/collection/collection-manager';
import { z } from 'zod';
import type { CollectionSharingConfig } from '@/lib/collection/types';

// Sharing config schema
const sharingConfigSchema = z.object({
  visibility: z.enum(['public', 'unlisted', 'private']),
  showValues: z.boolean().default(false),
  showQuantities: z.boolean().default(true),
  showConditions: z.boolean().default(true),
  showNotes: z.boolean().default(false),
  allowComments: z.boolean().default(false),
  requireAuth: z.boolean().default(false),
  expiresInDays: z.number().min(1).max(365).optional(),
});

// POST /api/collection/share - Create shared collection
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

    const body = await req.json();
    const validatedConfig = sharingConfigSchema.parse(body);

    // Calculate expiration date if specified
    const config: CollectionSharingConfig = {
      ...validatedConfig,
      expiresAt: validatedConfig.expiresInDays
        ? new Date(Date.now() + validatedConfig.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined,
    };

    // Create shared collection
    const manager = new CollectionManager();
    const sharedCollection = await manager.shareCollection(user.id, config);

    return NextResponse.json(sharedCollection);
  } catch (error) {
    console.error('Error sharing collection:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid sharing configuration', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to share collection' },
      { status: 500 }
    );
  }
}