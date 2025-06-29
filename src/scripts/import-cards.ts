#!/usr/bin/env tsx
/**
 * Script to import Pokemon cards from the Pokemon TCG API
 * Run with: npx tsx src/scripts/import-cards.ts
 */

import { PokemonTCGClient } from '@/lib/api/pokemon-tcg-client';
import { prisma } from '@/server/db/prisma';
import { normalizeSetData, transformAndValidateCard } from '@/lib/api/transformers';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../../.env.local') });

const BATCH_SIZE = 250; // Max cards per API request
const DELAY_BETWEEN_REQUESTS = 500; // 500ms delay to respect rate limits
const MAX_SETS_TO_IMPORT = 5; // Start with 5 sets for initial test

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function importCards() {
  console.log('🚀 Starting Pokemon card import...');
  console.log(`API Key: ${process.env.POKEMON_TCG_API_KEY ? '✅ Found' : '❌ Not found'}`);
  
  try {
    const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
    
    // First, import all sets
    console.log('\n📦 Fetching Pokemon sets...');
    const setsResult = await client.sets.all();
    
    if (setsResult.error || !setsResult.data) {
      throw new Error(`Failed to fetch sets: ${setsResult.error}`);
    }
    
    const sets = setsResult.data.data;
    console.log(`Found ${sets.length} sets`);
    
    // Sort sets by release date (newest first)
    sets.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
    
    // Import sets to database
    let importedSetsCount = 0;
    for (const apiSet of sets.slice(0, MAX_SETS_TO_IMPORT)) {
      try {
        const normalizedSet = normalizeSetData(apiSet);
        
        await prisma.set.upsert({
          where: { code: apiSet.id },
          update: normalizedSet,
          create: normalizedSet,
        });
        
        importedSetsCount++;
        console.log(`✅ Imported set: ${apiSet.name} (${apiSet.id})`);
      } catch (error) {
        console.error(`❌ Failed to import set ${apiSet.name}:`, error);
      }
    }
    
    console.log(`\n📊 Imported ${importedSetsCount} sets`);
    
    // Now import cards for each set
    console.log('\n🎴 Starting card import...');
    
    let totalCardsImported = 0;
    let totalErrors = 0;
    
    const setsToProcess = await prisma.set.findMany({
      take: MAX_SETS_TO_IMPORT,
      orderBy: { releaseDate: 'desc' },
    });
    
    for (const set of setsToProcess) {
      console.log(`\n📂 Processing set: ${set.name} (${set.code})`);
      
      let page = 1;
      let hasMore = true;
      let setCardCount = 0;
      
      while (hasMore) {
        await sleep(DELAY_BETWEEN_REQUESTS); // Rate limiting
        
        const cardsResult = await client.getCardsBySet(set.code, page, BATCH_SIZE);
        
        if (cardsResult.error || !cardsResult.data) {
          console.error(`❌ Failed to fetch cards for page ${page}:`, cardsResult.error);
          hasMore = false;
          continue;
        }
        
        const cards = cardsResult.data.data;
        
        if (cards.length === 0) {
          hasMore = false;
          continue;
        }
        
        console.log(`  📄 Processing page ${page} (${cards.length} cards)...`);
        
        // Process cards in batches
        for (const apiCard of cards) {
          try {
            const transformResult = await transformAndValidateCard(apiCard);
            
            if (!transformResult.isValid || !transformResult.data) {
              totalErrors++;
              console.error(`  ❌ Invalid card data: ${apiCard.id}`);
              continue;
            }
            
            // Use transaction to save card and pricing data
            await prisma.$transaction(async (tx) => {
              // Upsert card
              await tx.card.upsert({
                where: { id: apiCard.id },
                update: transformResult.data,
                create: transformResult.data,
              });
              
              // Handle pricing data if available
              if (transformResult.prices && transformResult.prices.length > 0) {
                // Delete old prices
                await tx.cardPrice.deleteMany({
                  where: { cardId: apiCard.id }
                });
                
                // Insert new prices
                await tx.cardPrice.createMany({
                  data: transformResult.prices,
                });
                
                // Add to price history
                const priceHistoryData = transformResult.prices.map(price => ({
                  cardId: price.cardId,
                  source: price.source,
                  priceType: price.priceType,
                  amount: price.amount,
                  currency: price.currency,
                  foil: price.foil,
                  condition: price.condition,
                  date: new Date(),
                }));
                
                await tx.priceHistory.createMany({
                  data: priceHistoryData,
                  skipDuplicates: true,
                });
              }
            });
            
            setCardCount++;
            totalCardsImported++;
            
            if (totalCardsImported % 100 === 0) {
              console.log(`  ✅ Imported ${totalCardsImported} cards so far...`);
            }
          } catch (error) {
            totalErrors++;
            console.error(`  ❌ Failed to import card ${apiCard.id}:`, error);
          }
        }
        
        // Check if there are more pages
        if (cardsResult.data.totalCount && page * BATCH_SIZE < cardsResult.data.totalCount) {
          page++;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`✅ Completed ${set.name}: ${setCardCount} cards imported`);
    }
    
    console.log('\n🎉 Import completed!');
    console.log(`✅ Total cards imported: ${totalCardsImported}`);
    console.log(`❌ Total errors: ${totalErrors}`);
    
    // Show some stats
    const cardCount = await prisma.card.count();
    const setCount = await prisma.set.count();
    const priceCount = await prisma.cardPrice.count();
    
    console.log('\n📊 Database Statistics:');
    console.log(`  - Total sets: ${setCount}`);
    console.log(`  - Total cards: ${cardCount}`);
    console.log(`  - Total prices: ${priceCount}`);
    
  } catch (error) {
    console.error('💥 Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importCards()
  .then(() => {
    console.log('\n✨ Import script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Import script failed:', error);
    process.exit(1);
  });