import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { prisma } from '@/server/db/prisma';
import { CollectionManager } from '@/lib/collection/collection-manager';

// GET /api/collection/export - Export collection
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

    // Parse export options
    const searchParams = req.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'csv') as 'csv' | 'json' | 'pdf';
    const includeValues = searchParams.get('includeValues') === 'true';
    const includeImages = searchParams.get('includeImages') === 'true';
    const groupBy = searchParams.get('groupBy') || undefined;

    // Export collection
    const manager = new CollectionManager();
    const { content, filename } = await manager.exportCollection(user.id, format, {
      includeValues,
      includeImages,
      groupBy,
    });

    // Set appropriate headers based on format
    const headers: HeadersInit = {
      'Content-Disposition': `attachment; filename="${filename}"`,
    };

    switch (format) {
      case 'csv':
        headers['Content-Type'] = 'text/csv';
        break;
      case 'json':
        headers['Content-Type'] = 'application/json';
        break;
      case 'pdf':
        headers['Content-Type'] = 'application/pdf';
        break;
    }

    return new Response(content, { headers });
  } catch (error) {
    console.error('Error exporting collection:', error);
    return NextResponse.json(
      { error: 'Failed to export collection' },
      { status: 500 }
    );
  }
}