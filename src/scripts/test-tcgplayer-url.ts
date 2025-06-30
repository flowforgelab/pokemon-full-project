#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PokemonTCGClient } from '../lib/api/pokemon-tcg-client';

async function testTCGPlayerUrl() {
  const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
  
  try {
    // Test with a popular card that should have TCGPlayer data
    const testCardId = 'base1-4'; // Charizard from Base Set
    
    console.log(`🔍 Testing card: ${testCardId}`);
    
    const result = await client.getCardById(testCardId);
    
    if (!result.success) {
      console.error('Failed to fetch card:', result.error);
      return;
    }
    
    const card = result.data.data;
    
    console.log(`\n📇 Card: ${card.name} (${card.set.name})`);
    console.log(`🔗 TCGPlayer data:`, JSON.stringify(card.tcgplayer, null, 2));
    
    if (card.tcgplayer?.url) {
      console.log(`\n✅ Direct URL found: ${card.tcgplayer.url}`);
    } else {
      console.log(`\n❌ No direct URL available`);
    }
    
    // Try a newer card
    const newCardId = 'sv1-1'; // From a recent set
    console.log(`\n🔍 Testing newer card: ${newCardId}`);
    
    const newResult = await client.getCardById(newCardId);
    if (newResult.success) {
      const newCard = newResult.data.data;
      console.log(`📇 Card: ${newCard.name} (${newCard.set.name})`);
      console.log(`🔗 TCGPlayer data:`, JSON.stringify(newCard.tcgplayer, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testTCGPlayerUrl();