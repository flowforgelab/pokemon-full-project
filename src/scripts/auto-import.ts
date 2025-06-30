#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PokemonTCGClient } from '../lib/api/pokemon-tcg-client';
import { runDailyImport } from './smart-daily-import';
import { runBatchImport } from './batch-import';

const prisma = new PrismaClient();

async function getTotalCardsInAPI(): Promise<number> {
  const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
  
  const setsResult = await client.getAllSets(1, 250);
  if (!setsResult || setsResult.error) {
    throw new Error('Failed to fetch sets from API');
  }
  
  // Sum up all cards from all sets
  const allSets = setsResult.data.data;
  return allSets.reduce((sum, set) => sum + set.total, 0);
}

export async function runAutoImport() {
  console.log('🤖 Auto Import Starting...');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🔑 API Key: ${process.env.POKEMON_TCG_API_KEY ? 'Present' : 'Not configured'}`);
  
  try {
    // Get total cards in API
    const totalCardsInAPI = await getTotalCardsInAPI();
    
    // Get current database stats
    const totalCardsInDB = await prisma.card.count();
    const totalSetsInDB = await prisma.set.count();
    
    // Calculate completion percentage
    const completionPercentage = (totalCardsInDB / totalCardsInAPI) * 100;
    
    console.log('\n📊 Current Status:');
    console.log(`🌐 Total cards in API: ${totalCardsInAPI.toLocaleString()}`);
    console.log(`💾 Total cards in DB: ${totalCardsInDB.toLocaleString()}`);
    console.log(`📦 Total sets in DB: ${totalSetsInDB}`);
    console.log(`📈 Completion: ${completionPercentage.toFixed(2)}%`);
    
    // Decision logic
    if (completionPercentage < 100) {
      console.log('\n🚀 Running BATCH IMPORT (less than 100% complete)');
      console.log(`📝 Need to import ${(totalCardsInAPI - totalCardsInDB).toLocaleString()} more cards`);
      
      // Use batch import for Vercel's time limits
      const result = await runBatchImport();
      console.log(`\n✅ Batch complete: ${result.cardsImported} cards imported in ${result.runtime}s`);
      
    } else {
      console.log('\n✅ Database is 100% complete!');
      console.log('🔄 Running SMART UPDATE to refresh prices and check for new cards');
      
      // Run the smart daily import
      await runDailyImport();
    }
    
    // Get final stats
    const finalCardsInDB = await prisma.card.count();
    const finalCompletionPercentage = (finalCardsInDB / totalCardsInAPI) * 100;
    
    console.log('\n📊 Final Status:');
    console.log(`💾 Total cards in DB: ${finalCardsInDB.toLocaleString()}`);
    console.log(`📈 Completion: ${finalCompletionPercentage.toFixed(2)}%`);
    
  } catch (error) {
    console.error('❌ Auto import error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  runAutoImport()
    .then(() => {
      console.log('\n✅ Auto import completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}