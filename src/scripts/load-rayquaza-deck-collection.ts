#!/usr/bin/env tsx
/**
 * Script to load Rayquaza GX Battle Arena deck cards into user's collection
 */

import { PrismaClient, CardCondition, StorageLocation, AcquisitionSource } from '@prisma/client';
import battleArenaDecks from '../data/deck-templates/battle-arena-decks.json';

const prisma = new PrismaClient();

async function loadRayquazaDeckToCollection() {
  console.log('🐉 Loading Rayquaza GX Battle Arena deck cards into collection...\n');

  try {
    // Get the Rayquaza deck data
    const rayquazaDeck = battleArenaDecks['rayquaza-gx-battle-arena'];
    if (!rayquazaDeck) {
      throw new Error('Rayquaza GX deck template not found!');
    }

    // Get the first (and only) user
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('No user found in database!');
    }

    console.log(`📧 Loading cards for user: ${user.email || 'Unknown'}`);
    console.log(`📊 Total cards to load: ${rayquazaDeck.cards.length}\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each card in the deck
    for (const deckCard of rayquazaDeck.cards) {
      try {
        // Search for the card in the database
        // Try exact match with set code first
        let card = await prisma.card.findFirst({
          where: {
            name: deckCard.name,
            set: {
              ptcgoCode: deckCard.set || undefined
            }
          }
        });

        // If no exact match, try just by name
        if (!card && deckCard.name) {
          card = await prisma.card.findFirst({
            where: {
              name: deckCard.name
            },
            orderBy: {
              set: {
                releaseDate: 'desc' // Get newest version
              }
            }
          });
        }

        if (!card) {
          errors.push(`❌ Card not found: ${deckCard.name} (${deckCard.set || 'Any set'})`);
          errorCount++;
          continue;
        }

        // Check if already in collection with default condition and location
        const existingEntry = await prisma.userCollection.findFirst({
          where: {
            userId: user.id,
            cardId: card.id,
            condition: CardCondition.NEAR_MINT,
            location: StorageLocation.BINDER
          }
        });

        if (existingEntry) {
          // Update quantity
          await prisma.userCollection.update({
            where: {
              id: existingEntry.id
            },
            data: {
              quantity: existingEntry.quantity + deckCard.quantity,
              updatedAt: new Date()
            }
          });
          console.log(`✅ Updated: ${deckCard.name} (added ${deckCard.quantity}, total: ${existingEntry.quantity + deckCard.quantity})`);
        } else {
          // Create new collection entry
          await prisma.userCollection.create({
            data: {
              userId: user.id,
              cardId: card.id,
              quantity: deckCard.quantity,
              quantityFoil: 0,
              condition: CardCondition.NEAR_MINT,
              language: 'EN',
              onWishlist: false,
              forTrade: false,
              source: AcquisitionSource.OTHER,
              location: StorageLocation.BINDER,
              notes: `Added from Rayquaza GX Battle Arena deck`,
              acquiredAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          console.log(`✅ Added: ${deckCard.name} x${deckCard.quantity}`);
        }
        
        successCount++;
      } catch (error) {
        errors.push(`❌ Error processing ${deckCard.name}: ${error}`);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Successfully added: ${successCount} cards`);
    console.log(`❌ Errors: ${errorCount} cards`);
    
    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach(err => console.log(err));
    }

    // Show collection stats
    const collectionCount = await prisma.userCollection.count({
      where: { userId: user.id }
    });
    
    const totalQuantity = await prisma.userCollection.aggregate({
      where: { userId: user.id },
      _sum: {
        quantity: true,
        quantityFoil: true
      }
    });

    console.log('\n📈 Collection Statistics:');
    console.log(`Total unique cards: ${collectionCount}`);
    console.log(`Total card quantity: ${(totalQuantity._sum.quantity || 0) + (totalQuantity._sum.quantityFoil || 0)}`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
loadRayquazaDeckToCollection()
  .then(() => {
    console.log('\n✨ Done! Rayquaza GX deck cards loaded into collection.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });