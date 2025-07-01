import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAllDeckTemplateIds, getDeckTemplate } from '@/data/deck-templates';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get template ID from query params if provided
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (templateId) {
      // Return specific template
      const template = getDeckTemplate(templateId);
      
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ template });
    }

    // Return all template IDs and basic info
    const templateIds = getAllDeckTemplateIds();
    const templates = templateIds.map(id => {
      const template = getDeckTemplate(id);
      return {
        id,
        name: template?.name,
        description: template?.description,
        format: template?.format,
        releaseDate: template?.releaseDate,
        cardCount: template?.cards.reduce((sum, card) => sum + card.quantity, 0) || 0,
      };
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching deck templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deck templates' },
      { status: 500 }
    );
  }
}