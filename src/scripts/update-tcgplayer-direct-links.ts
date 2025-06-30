#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PokemonTCGClient } from '../lib/api/pokemon-tcg-client';

const prisma = new PrismaClient();

async function updateTCGPlayerDirectLinks() {
  console.log('🔗 Updating TCGPlayer direct links...');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  
  const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
  
  try {
    // Get all cards that have search URLs (not direct links)
    const cardsWithSearchUrls = await prisma.card.findMany({
      where: {
        purchaseUrl: {
          contains: '/search/pokemon/product?'
        }
      },
      select: {
        id: true,
        pokemonTcgIoId: true,
        name: true,
        purchaseUrl: true,
        set: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log(`Found ${cardsWithSearchUrls.length} cards with search URLs`);
    
    let updated = 0;
    let errors = 0;
    
    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < cardsWithSearchUrls.length; i += batchSize) {
      const batch = cardsWithSearchUrls.slice(i, i + batchSize);
      console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardsWithSearchUrls.length / batchSize)}`);
      
      for (const card of batch) {
        try {
          // Fetch card data from API
          const apiResult = await client.getCardById(card.pokemonTcgIoId);
          
          if (!apiResult.success) {
            console.error(`❌ Failed to fetch ${card.name}: ${apiResult.error}`);
            errors++;
            continue;
          }
          
          const apiCard = apiResult.data.data;
          
          if (apiCard.tcgplayer?.url) {
            // Update with direct URL
            await prisma.card.update({
              where: { id: card.id },
              data: { purchaseUrl: apiCard.tcgplayer.url }
            });
            
            console.log(`✅ Updated ${card.name} with direct URL`);
            updated++;
          } else {
            console.log(`⚠️  No direct URL available for ${card.name}`);
          }
          
        } catch (error) {
          console.error(`❌ Error updating ${card.name}:`, error);
          errors++;
        }
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Updated: ${updated} cards`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`⚠️  No direct URL: ${cardsWithSearchUrls.length - updated - errors}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateTCGPlayerDirectLinks()
  .then(() => {
    console.log('\n✅ Direct link update completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });