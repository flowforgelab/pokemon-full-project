import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { deckBuilderManager } from '@/lib/deck-builder/deck-builder-manager';
import { prisma } from '@/server/db/prisma';

const exportFormatSchema = z.object({
  format: z.enum(['text', 'json', 'ptcgo', 'pdf', 'image']),
  includeStats: z.boolean().default(false),
  includePrices: z.boolean().default(false),
  includeNotes: z.boolean().default(false),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { deckId: string } }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validation = exportFormatSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const exportFormat = validation.data;

    // Load deck composition
    const composition = await deckBuilderManager.loadDeck(
      params.deckId,
      user.id
    );

    // Export deck
    const exportData = await deckBuilderManager.exportDeck(
      composition,
      exportFormat
    );

    // Set appropriate headers based on format
    const headers: HeadersInit = {};
    let responseData: any = exportData;

    switch (exportFormat.format) {
      case 'text':
      case 'ptcgo':
        headers['Content-Type'] = 'text/plain';
        headers['Content-Disposition'] = `attachment; filename="deck-${params.deckId}.txt"`;
        break;
      case 'json':
        headers['Content-Type'] = 'application/json';
        headers['Content-Disposition'] = `attachment; filename="deck-${params.deckId}.json"`;
        break;
      case 'pdf':
        headers['Content-Type'] = 'application/pdf';
        headers['Content-Disposition'] = `attachment; filename="deck-${params.deckId}.pdf"`;
        responseData = exportData; // Buffer
        break;
      case 'image':
        headers['Content-Type'] = 'image/png';
        headers['Content-Disposition'] = `attachment; filename="deck-${params.deckId}.png"`;
        responseData = exportData; // Buffer
        break;
    }

    return new NextResponse(responseData, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Error exporting deck:', error);
    
    if (error.message === 'Deck not found') {
      return NextResponse.json(
        { error: 'Deck not found' },
        { status: 404 }
      );
    }
    
    if (error.message === 'Unauthorized access to deck') {
      return NextResponse.json(
        { error: 'Unauthorized access to deck' },
        { status: 403 }
      );
    }
    
    if (error.message.includes('not yet implemented')) {
      return NextResponse.json(
        { error: 'Export format not yet implemented' },
        { status: 501 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to export deck' },
      { status: 500 }
    );
  }
}