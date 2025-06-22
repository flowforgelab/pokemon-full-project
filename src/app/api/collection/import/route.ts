import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { CollectionManager } from '@/lib/collection/collection-manager';
import { z } from 'zod';
import type { CollectionImportData, ImportOptions } from '@/lib/collection/types';

// Import options schema
const importOptionsSchema = z.object({
  updateExisting: z.boolean().default(false),
  skipDuplicates: z.boolean().default(true),
  validatePrices: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

// POST /api/collection/import - Import collection data
export async function POST(req: NextRequest) {
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

    // Handle multipart form data or JSON
    const contentType = req.headers.get('content-type');
    let importData: CollectionImportData;

    if (contentType?.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const format = formData.get('format') as string;
      const options = JSON.parse(formData.get('options') as string || '{}');

      if (!file || !format) {
        return NextResponse.json(
          { error: 'File and format are required' },
          { status: 400 }
        );
      }

      const data = await file.text();
      importData = {
        format: format as any,
        data,
        options: importOptionsSchema.parse(options),
      };
    } else {
      // Handle JSON data
      const body = await req.json();
      importData = {
        format: body.format,
        data: body.data,
        options: importOptionsSchema.parse(body.options || {}),
      };
    }

    // Import collection
    const manager = new CollectionManager();
    const result = await manager.importCollection(user.id, importData);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error importing collection:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to import collection' },
      { status: 500 }
    );
  }
}

// GET /api/collection/import/templates - Get import templates
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = [
      {
        format: 'csv',
        name: 'Standard CSV',
        template: 'Card Name,Set Code,Quantity,Condition,Purchase Price,Location,Tags,Notes',
        example: 'Charizard ex,PAL,2,NEAR_MINT,250.00,BINDER,"favorite,competitive",My first pull',
        instructions: 'Use this format for general imports. Condition values: MINT, NEAR_MINT, LIGHTLY_PLAYED, MODERATELY_PLAYED, HEAVILY_PLAYED, DAMAGED',
      },
      {
        format: 'tcgplayer',
        name: 'TCGPlayer Collection',
        template: 'Product Name,Set Name,Number,Condition,Quantity,Price',
        example: 'Charizard ex,Paldea Evolved,199,Near Mint,2,250.00',
        instructions: 'Export your collection from TCGPlayer and import directly',
      },
      {
        format: 'ptcgo',
        name: 'PTCGO Export',
        template: '* <quantity> <card name> <set code> <collector number>',
        example: '* 2 Charizard ex PAL 199',
        instructions: 'Copy your PTCGO deck list format',
      },
      {
        format: 'json',
        name: 'JSON Format',
        template: JSON.stringify({
          collection: [
            {
              cardName: 'string',
              setCode: 'string',
              quantity: 'number',
              condition: 'string',
              purchasePrice: 'number',
              notes: 'string',
            },
          ],
        }, null, 2),
        example: JSON.stringify({
          collection: [
            {
              cardName: 'Charizard ex',
              setCode: 'PAL',
              quantity: 2,
              condition: 'NEAR_MINT',
              purchasePrice: 250.00,
              notes: 'Tournament prize',
            },
          ],
        }, null, 2),
        instructions: 'Use JSON format for programmatic imports',
      },
    ];

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error getting import templates:', error);
    return NextResponse.json(
      { error: 'Failed to get import templates' },
      { status: 500 }
    );
  }
}