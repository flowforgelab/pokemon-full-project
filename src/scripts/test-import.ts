#!/usr/bin/env tsx
/**
 * Test script to import a small number of Pokemon cards
 * Run with: npx tsx src/scripts/test-import.ts
 */

import { PokemonTCGClient } from '@/lib/api/pokemon-tcg-client';
import { prisma } from '@/server/db/prisma';
import { normalizeSetData, transformAndValidateCard } from '@/lib/api/transformers';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../../.env.local') });

// Test parameters - VERY LIMITED for testing
const MAX_SETS = 2; // Only import 2 sets
const MAX_CARDS_PER_SET = 10; // Only import 10 cards per set

async function testImport() {
  console.log('🧪 Starting Pokemon card TEST import (limited data)...');
  console.log(`📊 Test Parameters:`);
  console.log(`  - Max sets to import: ${MAX_SETS}`);
  console.log(`  - Max cards per set: ${MAX_CARDS_PER_SET}`);
  console.log(`  - Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown'}`);
  console.log(`  - API Key: ${process.env.POKEMON_TCG_API_KEY ? '✅ Found' : '❌ Not found'}`);
  
  try {
    const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
    
    // Check current database state
    console.log('\n📊 Current Database State:');
    const currentStats = await Promise.all([
      prisma.set.count(),
      prisma.card.count(),
      prisma.cardPrice.count(),
    ]);
    console.log(`  - Sets: ${currentStats[0]}`);
    console.log(`  - Cards: ${currentStats[1]}`);
    console.log(`  - Prices: ${currentStats[2]}`);
    
    // Fetch recent sets
    console.log('\n📦 Fetching recent Pokemon sets...');
    const setsResult = await client.sets.all();
    
    if (setsResult.error || !setsResult.data) {
      throw new Error(`Failed to fetch sets: ${setsResult.error}`);
    }
    
    const sets = setsResult.data.data;
    // Sort by release date (newest first)
    sets.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
    
    console.log(`Found ${sets.length} total sets, will import ${MAX_SETS} most recent`);
    
    // Import limited sets
    for (let i = 0; i < Math.min(MAX_SETS, sets.length); i++) {
      const apiSet = sets[i];
      try {
        const normalizedSet = normalizeSetData(apiSet);
        
        await prisma.set.upsert({
          where: { code: apiSet.id },
          update: normalizedSet,
          create: normalizedSet,
        });
        
        console.log(`\n✅ Imported set: ${apiSet.name} (${apiSet.id})`);
        console.log(`  - Released: ${apiSet.releaseDate}`);
        console.log(`  - Total cards in set: ${apiSet.total}`);
      } catch (error) {
        console.error(`❌ Failed to import set ${apiSet.name}:`, error);
      }
    }
    
    // Import limited cards from each set
    console.log('\n🎴 Starting card import (limited)...');
    
    const setsToProcess = await prisma.set.findMany({
      take: MAX_SETS,
      orderBy: { releaseDate: 'desc' },
    });
    
    let totalCardsImported = 0;
    let totalPricesImported = 0;
    
    for (const set of setsToProcess) {
      console.log(`\n📂 Processing set: ${set.name} (${set.code})`);
      
      // Get only first page with limited results
      const cardsResult = await client.getCardsBySet(set.code, 1, MAX_CARDS_PER_SET);
      
      if (cardsResult.error || !cardsResult.data) {
        console.error(`❌ Failed to fetch cards:`, cardsResult.error);
        continue;
      }
      
      const cards = cardsResult.data.data;
      console.log(`  - Fetched ${cards.length} cards (out of ${cardsResult.data.totalCount} total)`);
      
      for (const apiCard of cards) {
        try {
          const transformResult = await transformAndValidateCard(apiCard);
          
          if (!transformResult.isValid || !transformResult.data) {
            console.error(`  ❌ Invalid card: ${apiCard.id} - ${apiCard.name}`);
            continue;
          }
          
          // Save card and prices
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
              
              totalPricesImported += transformResult.prices.length;
            }
          });
          
          console.log(`  ✅ ${apiCard.name} (${apiCard.id}) - ${transformResult.prices?.length || 0} prices`);
          totalCardsImported++;
        } catch (error) {
          console.error(`  ❌ Failed to import ${apiCard.name}:`, error);
        }
      }
    }
    
    // Final statistics
    console.log('\n🎉 Test import completed!');
    console.log(`✅ Cards imported: ${totalCardsImported}`);
    console.log(`💰 Prices imported: ${totalPricesImported}`);
    
    const finalStats = await Promise.all([
      prisma.set.count(),
      prisma.card.count(),
      prisma.cardPrice.count(),
    ]);
    
    console.log('\n📊 Final Database Statistics:');
    console.log(`  - Total sets: ${finalStats[0]} (was ${currentStats[0]})`);
    console.log(`  - Total cards: ${finalStats[1]} (was ${currentStats[1]})`);
    console.log(`  - Total prices: ${finalStats[2]} (was ${currentStats[2]})`);
    
    // Show sample card with prices
    const sampleCard = await prisma.card.findFirst({
      where: {
        prices: {
          some: {}
        }
      },
      include: {
        prices: true,
        set: true,
      }
    });
    
    if (sampleCard) {
      console.log('\n📄 Sample Card with Prices:');
      console.log(`  - Name: ${sampleCard.name}`);
      console.log(`  - Set: ${sampleCard.set.name}`);
      console.log(`  - Prices:`);
      sampleCard.prices.forEach(price => {
        console.log(`    - ${price.source} ${price.priceType}: ${price.currency} ${price.amount}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Test import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testImport()
  .then(() => {
    console.log('\n✨ Test import finished successfully');
    console.log('📝 To run full import, use: npx tsx src/scripts/import-cards.ts');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test import failed:', error);
    process.exit(1);
  });