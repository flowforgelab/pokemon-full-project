#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixTCGPlayerSearchUrls() {
  console.log('🔧 Fixing TCGPlayer search URLs...');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  
  try {
    // Get all cards with the old URL format (contains &set= parameter or %20 instead of +)
    const cardsWithOldUrls = await prisma.card.findMany({
      where: {
        OR: [
          {
            purchaseUrl: {
              contains: '&set='
            }
          },
          {
            purchaseUrl: {
              contains: '%20'
            }
          }
        ]
      },
      select: {
        id: true,
        name: true,
        purchaseUrl: true,
        set: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log(`Found ${cardsWithOldUrls.length} cards with old URL format`);
    
    if (cardsWithOldUrls.length === 0) {
      console.log('No cards need updating!');
      return;
    }
    
    // Update in batches
    const batchSize = 50;
    let updated = 0;
    
    for (let i = 0; i < cardsWithOldUrls.length; i += batchSize) {
      const batch = cardsWithOldUrls.slice(i, i + batchSize);
      console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardsWithOldUrls.length / batchSize)}`);
      
      // Process each card in the batch individually
      for (const card of batch) {
        try {
          // Generate new URL with card name + set name in query (using + for spaces)
          const searchQuery = `${card.name} ${card.set.name}`.replace(/ /g, '+');
          const newUrl = `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${searchQuery}&view=grid`;
          
          await prisma.card.update({
            where: { id: card.id },
            data: { purchaseUrl: newUrl }
          });
          
          updated++;
        } catch (error) {
          console.error(`Failed to update ${card.name}:`, error);
        }
      }
      
      console.log(`✅ Updated ${updated} cards so far...`);
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Fixed: ${updated} card URLs`);
    
    // Show a sample of the new URLs
    const samples = await prisma.card.findMany({
      take: 3,
      select: {
        name: true,
        purchaseUrl: true,
        set: { select: { name: true } }
      }
    });
    
    console.log('\n📋 Sample URLs:');
    samples.forEach(card => {
      console.log(`\n${card.name} (${card.set.name}):`);
      console.log(`${card.purchaseUrl}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixTCGPlayerSearchUrls()
  .then(() => {
    console.log('\n✅ URL fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });