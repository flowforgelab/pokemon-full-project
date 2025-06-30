#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PokemonTCGClient } from '../lib/api/pokemon-tcg-client';

const prisma = new PrismaClient();

async function checkTotalCards() {
  console.log('🔍 Checking total cards available in Pokemon TCG API...\n');
  
  const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
  
  try {
    // Get total cards by fetching all sets and summing their totals
    console.log('Fetching all sets to calculate total cards...');
    const setsResult = await client.getAllSets(1, 250);
    
    if (!setsResult || setsResult.error) {
      console.error('Failed to fetch sets from API:', setsResult?.error || 'Unknown error');
      return;
    }
    
    // Sum up all cards from all sets
    const allSets = setsResult.data.data;
    const totalCardsInAPI = allSets.reduce((sum, set) => sum + set.total, 0);
    console.log(`Found ${allSets.length} sets in the API\n`);
    
    // Get current database stats
    const totalCardsInDB = await prisma.card.count();
    const totalSetsInDB = await prisma.set.count();
    
    // Calculate percentage
    const percentage = ((totalCardsInDB / totalCardsInAPI) * 100).toFixed(2);
    
    console.log('📊 Pokemon TCG Database Status:');
    console.log('================================');
    console.log(`🌐 Total cards in API: ${totalCardsInAPI.toLocaleString()}`);
    console.log(`💾 Total cards in DB: ${totalCardsInDB.toLocaleString()}`);
    console.log(`📦 Total sets in DB: ${totalSetsInDB}`);
    console.log(`📈 Completion: ${percentage}%`);
    console.log(`📝 Cards remaining: ${(totalCardsInAPI - totalCardsInDB).toLocaleString()}`);
    
    // Recommendation
    console.log('\n💡 Recommendation:');
    if (totalCardsInDB < totalCardsInAPI) {
      console.log(`You need to import ${(totalCardsInAPI - totalCardsInDB).toLocaleString()} more cards.`);
      console.log('Run: npx tsx src/scripts/import-cards-simple.ts');
    } else {
      console.log('✅ All cards imported! You can switch to smart daily updates.');
      console.log('The smart-daily-import.ts will keep prices updated.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTotalCards();