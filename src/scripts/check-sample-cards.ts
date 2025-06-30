#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PokemonTCGClient } from '../lib/api/pokemon-tcg-client';

const prisma = new PrismaClient();

async function checkSampleCards() {
  const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
  
  try {
    // Get a few sample cards
    const sampleCards = await prisma.card.findMany({
      take: 3,
      select: {
        id: true,
        name: true,
        set: {
          select: { name: true }
        }
      }
    });
    
    console.log('🔍 Checking TCGPlayer URLs for sample cards:\n');
    
    for (const card of sampleCards) {
      console.log(`📇 Card: ${card.name} (${card.set.name})`);
      console.log(`   ID: ${card.id}`);
      
      // Fetch from API
      const result = await client.getCardById(card.id);
      
      if (result && result.data && result.data.data) {
        const apiCard = result.data.data;
        console.log(`   Raw TCGPlayer data:`, JSON.stringify(apiCard.tcgplayer, null, 2));
        
        if (apiCard.tcgplayer) {
          console.log(`   TCGPlayer URL: ${apiCard.tcgplayer.url || 'Not provided'}`);
          console.log(`   Has prices: ${apiCard.tcgplayer.prices ? 'Yes' : 'No'}`);
        } else {
          console.log(`   TCGPlayer data: Not available`);
        }
      } else {
        console.log(`   No data received from API`);
      }
      console.log();
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSampleCards();