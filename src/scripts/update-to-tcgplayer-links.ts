#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateToTCGPlayerLinks() {
  console.log('🔗 Updating all cards to use TCGPlayer links...\n');

  try {
    // Get all cards with their sets
    const cards = await prisma.card.findMany({
      include: {
        set: true,
      },
    });

    console.log(`Found ${cards.length} cards to update`);

    let updated = 0;
    for (const card of cards) {
      // Generate TCGPlayer search URL
      const purchaseUrl = `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(card.name)}&view=grid&ProductTypeName=Cards&set=${encodeURIComponent(card.set.name)}`;
      
      // Update the card
      await prisma.card.update({
        where: { id: card.id },
        data: { purchaseUrl },
      });
      
      updated++;
      if (updated % 10 === 0) {
        console.log(`Updated ${updated}/${cards.length} cards...`);
      }
    }

    console.log(`\n✅ Successfully updated ${updated} cards with TCGPlayer links!`);
    
    // Show a sample
    const sample = await prisma.card.findFirst({
      where: { purchaseUrl: { not: null } },
      include: { set: true },
    });
    
    if (sample) {
      console.log(`\nSample TCGPlayer URL:`);
      console.log(`Card: ${sample.name} from ${sample.set.name}`);
      console.log(`URL: ${sample.purchaseUrl}`);
    }

  } catch (error) {
    console.error('Error updating links:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateToTCGPlayerLinks();