#!/usr/bin/env tsx
/**
 * Add basic energy cards to all user collections
 * Each user gets unlimited quantity of basic energy cards
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env.local') });

const prisma = new PrismaClient();

// Basic energy card names to search for
const BASIC_ENERGY_TYPES = [
  'Grass Energy',
  'Fire Energy',
  'Water Energy',
  'Lightning Energy',
  'Psychic Energy',
  'Fighting Energy',
  'Darkness Energy',
  'Metal Energy',
  'Fairy Energy',
];

async function addBasicEnergyCards() {
  try {
    console.log('🔋 Adding basic energy cards to all collections...\n');

    // Find all basic energy cards
    const basicEnergyCards = await prisma.card.findMany({
      where: {
        OR: BASIC_ENERGY_TYPES.map(name => ({
          name: {
            equals: name,
          },
        })),
        supertype: 'ENERGY',
        // Get the most recent version of each energy type
      },
      orderBy: {
        set: {
          releaseDate: 'desc',
        },
      },
      distinct: ['name'],
      include: {
        set: true,
      },
    });

    console.log(`Found ${basicEnergyCards.length} basic energy cards:`);
    basicEnergyCards.forEach(card => {
      console.log(`- ${card.name} from ${card.set.name}`);
    });

    if (basicEnergyCards.length === 0) {
      console.log('❌ No basic energy cards found. Make sure cards are imported first.');
      return;
    }

    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, username: true },
    });

    console.log(`\nAdding energy cards to ${users.length} users...`);

    let totalAdded = 0;

    // Add energy cards to each user's collection
    for (const user of users) {
      console.log(`\nProcessing user: ${user.username || user.id}`);
      
      for (const energyCard of basicEnergyCards) {
        // Check if user already has this energy card
        const existing = await prisma.userCollection.findFirst({
          where: {
            userId: user.id,
            cardId: energyCard.id,
            isWishlist: false,
          },
        });

        if (!existing) {
          // Add with "unlimited" quantity (9999)
          await prisma.userCollection.create({
            data: {
              userId: user.id,
              cardId: energyCard.id,
              quantity: 9999,
              quantityFoil: 0,
              condition: 'NEAR_MINT',
              language: 'EN',
              isWishlist: false,
              isForTrade: false,
              acquiredDate: new Date(),
              notes: 'Basic energy - unlimited quantity',
            },
          });
          totalAdded++;
          console.log(`  ✅ Added ${energyCard.name}`);
        } else {
          // Update to unlimited quantity if needed
          if (existing.quantity < 9999) {
            await prisma.userCollection.update({
              where: { id: existing.id },
              data: { 
                quantity: 9999,
                notes: 'Basic energy - unlimited quantity',
              },
            });
            console.log(`  📈 Updated ${energyCard.name} to unlimited quantity`);
          } else {
            console.log(`  ⏭️  ${energyCard.name} already in collection`);
          }
        }
      }
    }

    console.log(`\n✅ Successfully added ${totalAdded} energy cards to collections!`);

  } catch (error) {
    console.error('❌ Error adding basic energy cards:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addBasicEnergyCards()
  .then(() => {
    console.log('\n🎉 Basic energy cards added to all collections!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });