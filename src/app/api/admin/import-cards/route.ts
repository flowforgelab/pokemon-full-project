import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PokemonTCGClient } from '@/lib/api/pokemon-tcg-client';
import { prisma } from '@/server/db/prisma';
import { normalizeSetData, transformAndValidateCard } from '@/lib/api/transformers';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (for now, we'll allow any authenticated user)
    // TODO: Add proper admin check
    
    const { action, setLimit = 3 } = await req.json();
    
    const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
    
    if (action === 'import-sets') {
      // Import just the sets first
      console.log('Fetching Pokemon sets...');
      const setsResult = await client.sets.all();
      
      if (setsResult.error || !setsResult.data) {
        return NextResponse.json({ 
          error: `Failed to fetch sets: ${setsResult.error}` 
        }, { status: 500 });
      }
      
      const sets = setsResult.data.data;
      sets.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
      
      let importedCount = 0;
      const errors: string[] = [];
      
      for (const apiSet of sets.slice(0, setLimit)) {
        try {
          const normalizedSet = normalizeSetData(apiSet);
          
          await prisma.set.upsert({
            where: { code: apiSet.id },
            update: normalizedSet,
            create: normalizedSet,
          });
          
          importedCount++;
        } catch (error) {
          errors.push(`Failed to import set ${apiSet.name}: ${error}`);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Imported ${importedCount} sets`,
        errors: errors.length > 0 ? errors : undefined,
      });
      
    } else if (action === 'import-cards') {
      // Import cards for existing sets
      const sets = await prisma.set.findMany({
        take: setLimit,
        orderBy: { releaseDate: 'desc' },
      });
      
      if (sets.length === 0) {
        return NextResponse.json({ 
          error: 'No sets found. Import sets first.' 
        }, { status: 400 });
      }
      
      let totalImported = 0;
      let totalErrors = 0;
      const results: any[] = [];
      
      for (const set of sets) {
        let setCardCount = 0;
        let setErrors = 0;
        
        // Get first page to check if we have cards
        const cardsResult = await client.getCardsBySet(set.code, 1, 50);
        
        if (cardsResult.error || !cardsResult.data) {
          results.push({
            set: set.name,
            error: `Failed to fetch cards: ${cardsResult.error}`,
          });
          continue;
        }
        
        const cards = cardsResult.data.data;
        
        // Import cards from first page only (for testing)
        for (const apiCard of cards) {
          try {
            const transformResult = await transformAndValidateCard(apiCard);
            
            if (!transformResult.isValid || !transformResult.data) {
              setErrors++;
              continue;
            }
            
            await prisma.$transaction(async (tx) => {
              await tx.card.upsert({
                where: { id: apiCard.id },
                update: transformResult.data,
                create: transformResult.data,
              });
              
              if (transformResult.prices && transformResult.prices.length > 0) {
                await tx.cardPrice.deleteMany({
                  where: { cardId: apiCard.id }
                });
                
                await tx.cardPrice.createMany({
                  data: transformResult.prices,
                });
              }
            });
            
            setCardCount++;
            totalImported++;
          } catch (error) {
            setErrors++;
            totalErrors++;
          }
        }
        
        results.push({
          set: set.name,
          imported: setCardCount,
          errors: setErrors,
          total: cardsResult.data.totalCount,
        });
      }
      
      const stats = await prisma.card.count();
      
      return NextResponse.json({
        success: true,
        message: `Imported ${totalImported} cards`,
        totalErrors,
        results,
        totalCardsInDb: stats,
      });
      
    } else if (action === 'get-stats') {
      // Get current database statistics
      const [setCount, cardCount, priceCount] = await Promise.all([
        prisma.set.count(),
        prisma.card.count(),
        prisma.cardPrice.count(),
      ]);
      
      const recentSets = await prisma.set.findMany({
        take: 5,
        orderBy: { releaseDate: 'desc' },
        select: {
          name: true,
          code: true,
          totalCards: true,
          _count: {
            select: { cards: true }
          }
        }
      });
      
      return NextResponse.json({
        success: true,
        stats: {
          sets: setCount,
          cards: cardCount,
          prices: priceCount,
          apiKey: process.env.POKEMON_TCG_API_KEY ? 'configured' : 'not configured',
        },
        recentSets,
      });
    }
    
    return NextResponse.json({ 
      error: 'Invalid action. Use: import-sets, import-cards, or get-stats' 
    }, { status: 400 });
    
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ 
      error: `Import failed: ${error}` 
    }, { status: 500 });
  }
}