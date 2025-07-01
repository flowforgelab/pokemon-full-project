import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const prisma = new PrismaClient();

async function checkCards() {
  // Check for AZ cards
  const azCards = await prisma.card.findMany({
    where: {
      name: {
        contains: 'AZ',
        mode: 'insensitive'
      }
    },
    include: {
      set: true
    },
    take: 10
  });
  
  console.log('Found AZ cards:', azCards.length);
  azCards.forEach(card => {
    console.log(`- ${card.name} (${card.id}) - ${card.set.name} ${card.collectorNumber}/${card.set.totalPrint}`);
  });
  
  // Check specific Phantom Forces cards
  const phantomForces = await prisma.card.findMany({
    where: {
      set: {
        name: 'Phantom Forces'
      },
      OR: [
        { collectorNumber: '91' },
        { collectorNumber: '117' }
      ]
    },
    include: {
      set: true
    }
  });
  
  console.log('\nPhantom Forces specific cards:');
  phantomForces.forEach(card => {
    console.log(`- ${card.name} (${card.id}) - ${card.collectorNumber}/${card.set.totalPrint}`);
  });
  
  // Check by exact name
  const exactAZ = await prisma.card.findMany({
    where: {
      name: 'AZ'
    },
    include: {
      set: true
    }
  });
  
  console.log('\nExact name "AZ" cards:', exactAZ.length);
  exactAZ.forEach(card => {
    console.log(`- ${card.name} (${card.id}) - ${card.set.name} ${card.collectorNumber}/${card.set.totalPrint}`);
  });
}

checkCards()
  .catch(console.error)
  .finally(() => prisma.$disconnect());