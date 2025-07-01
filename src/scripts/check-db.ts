#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    // Check sets
    const sets = await prisma.set.findMany({
      take: 5,
      select: {
        id: true,
        code: true,
        name: true,
        _count: {
          select: { cards: true }
        }
      }
    });
    
    console.log('Sets in database:');
    sets.forEach(set => {
      console.log(`- ${set.name} (id: ${set.id}, code: ${set.code}) - ${set._count.cards} cards`);
    });
    
    // Check cards
    const cards = await prisma.card.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        set: {
          select: { name: true }
        }
      }
    });
    
    console.log('\nSample cards:');
    cards.forEach(card => {
      console.log(`- ${card.name} from ${card.set.name} (id: ${card.id})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Overall stats
    const totalSets = await prisma.set.count();
    const totalCards = await prisma.card.count();
    const totalPrices = await prisma.cardPrice.count();
    const totalUsers = await prisma.user.count();
    const totalDecks = await prisma.deck.count();
    const totalCollections = await prisma.userCollection.count();
    
    console.log('\nDatabase totals:');
    console.log(`- Total users: ${totalUsers}`);
    console.log(`- Total sets: ${totalSets}`);
    console.log(`- Total cards: ${totalCards}`);
    console.log(`- Total prices: ${totalPrices}`);
    console.log(`- Total decks: ${totalDecks}`);
    console.log(`- Total collection items: ${totalCollections}`);
    
    // User breakdown by subscription tier
    const usersByTier = await prisma.user.groupBy({
      by: ['subscriptionTier'],
      _count: true,
    });
    
    console.log('\nUsers by subscription tier:');
    usersByTier.forEach(tier => {
      console.log(`- ${tier.subscriptionTier}: ${tier._count} users`);
    });
    
    await prisma.$disconnect();
  }
}

checkDatabase();