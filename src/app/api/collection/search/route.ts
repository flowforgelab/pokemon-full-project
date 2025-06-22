import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { CollectionManager } from '@/lib/collection/collection-manager';
import { z } from 'zod';
import type { CollectionSearchFilters } from '@/lib/collection/types';

// Search filters schema
const searchSchema = z.object({
  text: z.string().optional(),
  sets: z.array(z.string()).optional(),
  types: z.array(z.string()).optional(),
  rarities: z.array(z.string()).optional(),
  formats: z.array(z.string()).optional(),
  energyCost: z.object({
    min: z.number(),
    max: z.number(),
  }).optional(),
  hp: z.object({
    min: z.number(),
    max: z.number(),
  }).optional(),
  owned: z.boolean().optional(),
  conditions: z.array(z.string()).optional(),
  quantities: z.object({
    min: z.number(),
    max: z.number(),
  }).optional(),
  value: z.object({
    min: z.number(),
    max: z.number(),
  }).optional(),
  tradable: z.boolean().optional(),
  inDeck: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  storageLocations: z.array(z.string()).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

// GET /api/collection/search - Search collection
export async function GET(req: NextRequest) {
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

    // Parse search params
    const searchParams = req.nextUrl.searchParams;
    const filters: any = {};

    // Text search
    if (searchParams.get('text')) {
      filters.text = searchParams.get('text');
    }

    // Array filters
    ['sets', 'types', 'rarities', 'formats', 'conditions', 'tags', 'storageLocations'].forEach(key => {
      const values = searchParams.getAll(key);
      if (values.length > 0) {
        filters[key] = values;
      }
    });

    // Boolean filters
    ['owned', 'tradable', 'inDeck'].forEach(key => {
      const value = searchParams.get(key);
      if (value !== null) {
        filters[key] = value === 'true';
      }
    });

    // Range filters
    ['energyCost', 'hp', 'quantities', 'value'].forEach(key => {
      const min = searchParams.get(`${key}Min`);
      const max = searchParams.get(`${key}Max`);
      if (min !== null || max !== null) {
        filters[key] = {};
        if (min !== null) filters[key].min = parseFloat(min);
        if (max !== null) filters[key].max = parseFloat(max);
      }
    });

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // Validate filters
    const validatedFilters = searchSchema.parse({ ...filters, page, pageSize });

    // Search collection
    const manager = new CollectionManager();
    const results = await manager.searchCollection(
      user.id,
      validatedFilters as CollectionSearchFilters,
      validatedFilters.page,
      validatedFilters.pageSize
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching collection:', error);
    return NextResponse.json(
      { error: 'Failed to search collection' },
      { status: 500 }
    );
  }
}

// POST /api/collection/search/save - Save a search
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

    const body = await req.json();
    const { name, filters } = body;

    if (!name || !filters) {
      return NextResponse.json(
        { error: 'Name and filters are required' },
        { status: 400 }
      );
    }

    // Save search
    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId: user.id,
        name,
        filters,
        useCount: 0,
      },
    });

    return NextResponse.json(savedSearch);
  } catch (error) {
    console.error('Error saving search:', error);
    return NextResponse.json(
      { error: 'Failed to save search' },
      { status: 500 }
    );
  }
}