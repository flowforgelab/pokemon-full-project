import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { deckBuilderManager } from '@/lib/deck-builder/deck-builder-manager';
import { prisma } from '@/server/db/prisma';

const suggestionsSchema = z.object({
  query: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validation = suggestionsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { query } = validation.data;

    // Get search suggestions
    const suggestions = await deckBuilderManager.getSearchSuggestions(query);

    return NextResponse.json({
      suggestions,
    });
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to get search suggestions' },
      { status: 500 }
    );
  }
}