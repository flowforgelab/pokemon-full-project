#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPurchaseUrl() {
  try {
    // Get a few sample cards
    const cards = await prisma.card.findMany({
      take: 5,
      where: { purchaseUrl: { not: null } },
      include: { set: true },
    });
    
    console.log('Sample TCGPlayer URLs:\n');
    
    for (const card of cards) {
      console.log(`Card: ${card.name}`);
      console.log(`Set: ${card.set.name}`);
      console.log(`URL: ${card.purchaseUrl}`);
      console.log('---');
    }
    
    console.log('\nThese URLs will search TCGPlayer for:');
    console.log('- The specific card name');
    console.log('- Within the correct set');
    console.log('- Showing only single cards (not sealed products)');
    console.log('\nUsers can then see all available listings and prices from different sellers.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPurchaseUrl();