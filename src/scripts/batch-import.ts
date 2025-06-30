#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PokemonTCGClient } from '../lib/api/pokemon-tcg-client';
import { transformAndValidateCard } from '../lib/api/transformers';

const prisma = new PrismaClient();

// Configure batch size based on environment
const MAX_RUNTIME_MS = process.env.VERCEL ? 4 * 60 * 1000 : 30 * 60 * 1000; // 4 minutes on Vercel, 30 minutes locally
const SETS_PER_BATCH = process.env.VERCEL ? 3 : 10; // Process fewer sets on Vercel

export async function runBatchImport() {
  const startTime = Date.now();
  console.log('📦 Starting batch import...');
  console.log(`⏱️  Max runtime: ${MAX_RUNTIME_MS / 1000} seconds`);
  console.log(`📊 Sets per batch: ${SETS_PER_BATCH}`);
  
  const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
  
  try {
    // Get all sets from API
    const setsResult = await client.getAllSets(1, 250);
    if (!setsResult || setsResult.error) {
      throw new Error('Failed to fetch sets from API');
    }
    
    const allSets = setsResult.data.data;
    console.log(`📚 Total sets available: ${allSets.length}`);
    
    // Get sets already in database
    const existingSets = await prisma.set.findMany({
      select: { 
        id: true,
        code: true,
        _count: {
          select: { cards: true }
        }
      }
    });
    
    const existingSetMap = new Map(
      existingSets.map(s => [s.code, s._count.cards])
    );
    
    // Find sets that need processing (no cards or incomplete)
    const setsToProcess = allSets.filter(apiSet => {
      const cardCount = existingSetMap.get(apiSet.id) || 0;
      return cardCount < apiSet.total;
    });
    
    console.log(`📋 Sets needing import: ${setsToProcess.length}`);
    
    // Sort by release date (newest first for higher relevance)
    setsToProcess.sort((a, b) => 
      new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    );
    
    let setsProcessed = 0;
    let totalCardsImported = 0;
    let totalPricesImported = 0;
    
    // Process sets in batch
    for (const apiSet of setsToProcess.slice(0, SETS_PER_BATCH)) {
      // Check if we're approaching time limit
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log('\n⏰ Approaching time limit, stopping batch');
        break;
      }
      
      console.log(`\n📦 Processing ${apiSet.name} (${apiSet.id})`);
      console.log(`  - Release Date: ${apiSet.releaseDate}`);
      console.log(`  - Total Cards: ${apiSet.total}`);
      
      try {
        // Ensure set exists in database
        let dbSet = await prisma.set.findUnique({
          where: { code: apiSet.id }
        });
        
        if (!dbSet) {
          dbSet = await prisma.set.create({
            data: {
              id: apiSet.id, // Using the API ID as our primary key
              code: apiSet.id,
              name: apiSet.name,
              series: apiSet.series,
              printedTotal: apiSet.printedTotal,
              total: apiSet.total,
              releaseDate: new Date(apiSet.releaseDate),
              ptcgoCode: apiSet.ptcgoCode || null,
              logoUrl: apiSet.images.logo,
              symbolUrl: apiSet.images.symbol,
            },
          });
          console.log(`  ✅ Set created in database`);
        }
        
        // Get existing cards for this set
        const existingCardIds = await prisma.card.findMany({
          where: { setId: dbSet.id },
          select: { id: true }
        });
        const existingCardIdSet = new Set(existingCardIds.map(c => c.id));
        
        // Fetch cards from API
        let page = 1;
        let hasMore = true;
        let setCardCount = 0;
        let setPriceCount = 0;
        
        while (hasMore) {
          const cardsResult = await client.getCardsBySet(apiSet.id, page, 250);
          
          if (!cardsResult || cardsResult.error) {
            console.error(`  ❌ Failed to fetch cards page ${page}`);
            break;
          }
          
          const cards = cardsResult.data.data;
          if (cards.length === 0) {
            hasMore = false;
            break;
          }
          
          // Process only new cards
          const newCards = cards.filter(c => !existingCardIdSet.has(c.id));
          console.log(`  - Page ${page}: ${newCards.length} new cards (of ${cards.length} total)`);
          
          // Import new cards
          for (const apiCard of newCards) {
            try {
              const transformResult = transformAndValidateCard(apiCard, dbSet.id);
              const { prices, ...cardData } = transformResult;
              
              const newCard = await prisma.card.create({
                data: {
                  id: apiCard.id, // Use the Pokemon TCG IO ID
                  ...cardData,
                },
              });
              
              // Add prices
              if (prices && prices.length > 0) {
                const validPrices = prices.filter(p => p.source !== undefined);
                if (validPrices.length > 0) {
                  await prisma.cardPrice.createMany({
                    data: validPrices.map(p => ({ ...p, cardId: newCard.id })),
                  });
                  setPriceCount += validPrices.length;
                }
              }
              
              setCardCount++;
            } catch (error) {
              console.error(`    ❌ Error importing ${apiCard.name}: ${error}`);
            }
          }
          
          page++;
          hasMore = cards.length === 250; // Continue if we got a full page
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`  ✅ Set complete: ${setCardCount} new cards, ${setPriceCount} prices`);
        totalCardsImported += setCardCount;
        totalPricesImported += setPriceCount;
        setsProcessed++;
        
      } catch (error) {
        console.error(`  ❌ Error processing set ${apiSet.name}: ${error}`);
      }
    }
    
    // Summary
    const runtime = Math.round((Date.now() - startTime) / 1000);
    console.log('\n' + '='.repeat(80));
    console.log('📊 Batch Import Summary:');
    console.log(`⏱️  Runtime: ${runtime} seconds`);
    console.log(`📦 Sets processed: ${setsProcessed}`);
    console.log(`🃏 Cards imported: ${totalCardsImported}`);
    console.log(`💰 Prices imported: ${totalPricesImported}`);
    console.log(`📋 Sets remaining: ${setsToProcess.length - setsProcessed}`);
    
    // Check completion
    const totalCardsInDB = await prisma.card.count();
    const totalSetsInDB = await prisma.set.count();
    
    console.log('\n📊 Database Status:');
    console.log(`💾 Total cards: ${totalCardsInDB}`);
    console.log(`📦 Total sets: ${totalSetsInDB}`);
    
    return {
      setsProcessed,
      cardsImported: totalCardsImported,
      pricesImported: totalPricesImported,
      runtime
    };
    
  } catch (error) {
    console.error('❌ Fatal error during batch import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  runBatchImport()
    .then((result) => {
      console.log('\n✅ Batch import completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}