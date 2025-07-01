#!/usr/bin/env tsx
/**
 * Script to create Rayquaza GX Battle Arena deck
 */

import { PrismaClient, DeckType, DeckCategory } from '@prisma/client';
import battleArenaDecks from '../data/deck-templates/battle-arena-decks.json';

const prisma = new PrismaClient();

async function createRayquazaDeck() {
  console.log('🐉 Creating Rayquaza GX Battle Arena deck...\n');

  try {
    // Get the Rayquaza deck template
    const rayquazaDeck = battleArenaDecks['rayquaza-gx-battle-arena'];
    if (!rayquazaDeck) {
      throw new Error('Rayquaza GX deck template not found!');
    }

    // Get the first (and only) user
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('No user found in database!');
    }

    console.log(`📧 Creating deck for user: ${user.email || 'Unknown'}`);

    // Check if deck already exists
    const existingDeck = await prisma.deck.findFirst({
      where: {
        userId: user.id,
        name: rayquazaDeck.name
      }
    });

    if (existingDeck) {
      console.log('⚠️  Deck already exists. Deleting old deck...');
      await prisma.deckCard.deleteMany({
        where: { deckId: existingDeck.id }
      });
      await prisma.deck.delete({
        where: { id: existingDeck.id }
      });
    }

    // Create the deck
    const deck = await prisma.deck.create({
      data: {
        userId: user.id,
        name: rayquazaDeck.name,
        description: rayquazaDeck.description,
        deckType: DeckType.CONSTRUCTED,
        category: DeckCategory.STANDARD,
        isPublic: false,
        isComplete: true,
        tags: ['rayquaza', 'electric', 'dragon', 'battle-arena'],
        pokemonCount: 0,
        trainerCount: 0,
        energyCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`✅ Created deck: ${deck.name} (${deck.id})\n`);

    // Add cards to the deck
    let pokemonCount = 0;
    let trainerCount = 0;
    let energyCount = 0;
    let addedCount = 0;
    let errorCount = 0;

    for (const deckCard of rayquazaDeck.cards) {
      try {
        // Find the card in the database
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
                releaseDate: 'desc'
              }
            }
          });
        }

        if (!card) {
          console.log(`❌ Card not found: ${deckCard.name} (${deckCard.set || 'Any set'})`);
          errorCount++;
          continue;
        }

        // Add card to deck
        await prisma.deckCard.create({
          data: {
            deckId: deck.id,
            cardId: card.id,
            quantity: deckCard.quantity,
            category: DeckCategory.MAIN,
            addedAt: new Date()
          }
        });

        // Update counts
        if (card.supertype === 'POKEMON') {
          pokemonCount += deckCard.quantity;
        } else if (card.supertype === 'TRAINER') {
          trainerCount += deckCard.quantity;
        } else if (card.supertype === 'ENERGY') {
          energyCount += deckCard.quantity;
        }

        console.log(`✅ Added: ${deckCard.name} x${deckCard.quantity}`);
        addedCount++;
      } catch (error) {
        console.log(`❌ Error adding ${deckCard.name}: ${error}`);
        errorCount++;
      }
    }

    // Update deck counts
    await prisma.deck.update({
      where: { id: deck.id },
      data: {
        pokemonCount,
        trainerCount,
        energyCount,
        updatedAt: new Date()
      }
    });

    console.log('\n📊 Deck Summary:');
    console.log(`✅ Successfully added: ${addedCount} unique cards`);
    console.log(`❌ Errors: ${errorCount} cards`);
    console.log(`\n📈 Deck Composition:`);
    console.log(`Pokémon: ${pokemonCount}`);
    console.log(`Trainers: ${trainerCount}`);
    console.log(`Energy: ${energyCount}`);
    console.log(`Total Cards: ${pokemonCount + trainerCount + energyCount}/60`);

    // Verify deck completeness
    const totalCards = pokemonCount + trainerCount + energyCount;
    if (totalCards === 60) {
      console.log('\n✅ Deck is complete with exactly 60 cards!');
    } else if (totalCards < 60) {
      console.log(`\n⚠️  Deck is incomplete: ${60 - totalCards} cards missing`);
    } else {
      console.log(`\n⚠️  Deck has too many cards: ${totalCards - 60} cards over the limit`);
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createRayquazaDeck()
  .then(() => {
    console.log('\n✨ Done! Rayquaza GX deck created successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });