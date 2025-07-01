#!/usr/bin/env tsx
/**
 * Script to add the missing Tapu Koko Prism Star to collection and deck
 */

import { PrismaClient, CardCondition, StorageLocation, AcquisitionSource, DeckCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function addMissingTapuKoko() {
  console.log('⚡ Adding missing Tapu Koko ◇ (Prism Star) to collection and deck...\n');

  try {
    // Get the user
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('No user found in database!');
    }

    // Find Tapu Koko Prism Star (with diamond symbol)
    const tapuKoko = await prisma.card.findUnique({
      where: { id: 'sm9-51' }
    });

    if (!tapuKoko) {
      throw new Error('Tapu Koko ◇ card not found!');
    }

    console.log(`✅ Found card: ${tapuKoko.name} (${tapuKoko.id})`);

    // Add to collection
    const existingEntry = await prisma.userCollection.findFirst({
      where: {
        userId: user.id,
        cardId: tapuKoko.id,
        condition: CardCondition.NEAR_MINT,
        location: StorageLocation.BINDER
      }
    });

    if (!existingEntry) {
      await prisma.userCollection.create({
        data: {
          userId: user.id,
          cardId: tapuKoko.id,
          quantity: 1,
          quantityFoil: 0,
          condition: CardCondition.NEAR_MINT,
          language: 'EN',
          onWishlist: false,
          forTrade: false,
          source: AcquisitionSource.OTHER,
          location: StorageLocation.BINDER,
          notes: `Added from Rayquaza GX Battle Arena deck`,
          acquiredAt: new Date()
        }
      });
      console.log('✅ Added to collection');
    } else {
      console.log('ℹ️  Already in collection');
    }

    // Add to deck
    const deck = await prisma.deck.findFirst({
      where: {
        userId: user.id,
        name: 'Rayquaza-GX Battle Arena Deck'
      }
    });

    if (!deck) {
      throw new Error('Rayquaza deck not found!');
    }

    // Check if already in deck
    const existingDeckCard = await prisma.deckCard.findFirst({
      where: {
        deckId: deck.id,
        cardId: tapuKoko.id
      }
    });

    if (!existingDeckCard) {
      await prisma.deckCard.create({
        data: {
          deckId: deck.id,
          cardId: tapuKoko.id,
          quantity: 1,
          category: DeckCategory.MAIN,
          addedAt: new Date()
        }
      });
      console.log('✅ Added to deck');

      // Update deck counts
      await prisma.deck.update({
        where: { id: deck.id },
        data: {
          pokemonCount: deck.pokemonCount + 1,
          isComplete: true,
          updatedAt: new Date()
        }
      });
      console.log('✅ Deck is now complete with 60 cards!');
    } else {
      console.log('ℹ️  Already in deck');
    }

    // Show final deck stats
    const deckCards = await prisma.deckCard.findMany({
      where: { deckId: deck.id },
      include: { card: true }
    });

    const totalCards = deckCards.reduce((sum, dc) => sum + dc.quantity, 0);
    console.log(`\n📊 Final deck: ${totalCards} cards`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addMissingTapuKoko()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });