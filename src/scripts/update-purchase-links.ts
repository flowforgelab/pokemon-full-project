import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function updatePurchaseLinks() {
  console.log('🔗 Updating purchase links for all cards...\n');

  try {
    // Get all cards
    const cards = await prisma.card.findMany({
      include: {
        set: true,
      },
    });

    console.log(`Found ${cards.length} cards to update`);

    let updated = 0;
    for (const card of cards) {
      // Generate purchase URL
      const purchaseUrl = `https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/detail-search/?cardName=${encodeURIComponent(card.name)}&setName=${encodeURIComponent(card.set.name)}`;
      
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

    console.log(`\n✅ Successfully updated ${updated} cards with purchase links!`);
    
    // Show a sample
    const sample = await prisma.card.findFirst({
      where: { purchaseUrl: { not: null } },
    });
    
    if (sample) {
      console.log(`\nSample purchase URL:`);
      console.log(`Card: ${sample.name}`);
      console.log(`URL: ${sample.purchaseUrl}`);
    }

  } catch (error) {
    console.error('Error updating purchase links:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePurchaseLinks();