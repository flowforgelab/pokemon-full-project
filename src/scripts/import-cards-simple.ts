#!/usr/bin/env tsx

// Load environment variables at the very start
import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

// Now import everything else
import { PrismaClient } from '@prisma/client';
import { PokemonTCGClient } from '../lib/api/pokemon-tcg-client';
import { transformAndValidateCard } from '../lib/api/transformers';

const prisma = new PrismaClient();

async function importCards() {
  console.log('🚀 Starting Pokemon card import...');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🔑 API Key: ${process.env.POKEMON_TCG_API_KEY ? '✅ Found' : '❌ Not found'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ Not connected'}\n`);

  const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);

  try {
    // Get current database state
    const existingSets = await prisma.set.count();
    const existingCards = await prisma.card.count();
    console.log(`📊 Current database state:`);
    console.log(`  - Sets: ${existingSets}`);
    console.log(`  - Cards: ${existingCards}\n`);

    // Fetch all sets
    console.log('📦 Fetching all sets from Pokemon TCG API...');
    const setsResult = await client.getAllSets(1, 250);
    
    // The API client returns { data } or { error }
    if (!setsResult || setsResult.error) {
      console.error('Failed to fetch sets:', setsResult?.error);
      throw new Error(`Failed to fetch sets: ${setsResult?.error?.message || 'Unknown error'}`);
    }

    const allSets = setsResult.data.data;
    console.log(`✅ Found ${allSets.length} sets in the API\n`);

    // Sort sets by release date (newest first)
    allSets.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());

    let totalCardsImported = 0;
    let totalPricesImported = 0;
    let setsProcessed = 0;

    // Process each set
    for (const apiSet of allSets) {
      console.log(`\n📦 Processing ${apiSet.name} (${apiSet.id})`);
      console.log(`  - Series: ${apiSet.series}`);
      console.log(`  - Release Date: ${apiSet.releaseDate}`);
      console.log(`  - Total Cards: ${apiSet.total}`);

      try {
        // Check if set exists
        let dbSet = await prisma.set.findUnique({
          where: { code: apiSet.id },
        });

        if (!dbSet) {
          // Create the set
          dbSet = await prisma.set.create({
            data: {
              id: apiSet.id, // Using the API ID as our primary key
              code: apiSet.id,
              name: apiSet.name,
              series: apiSet.series,
              printedTotal: apiSet.printedTotal,
              total: apiSet.total,
              releaseDate: new Date(apiSet.releaseDate),
              ptcgoCode: apiSet.ptcgoCode || null,
              logoUrl: apiSet.images.logo,
              symbolUrl: apiSet.images.symbol,
            },
          });
          console.log(`  ✅ Set created in database`);
        } else {
          console.log(`  ℹ️  Set already exists in database`);
        }

        // Fetch cards for this set
        console.log(`  🃏 Fetching cards...`);
        let page = 1;
        let hasMore = true;
        let setCardCount = 0;
        let setPriceCount = 0;

        while (hasMore) {
          const cardsResult = await client.getCardsBySet(apiSet.id, page, 250);
          
          if (!cardsResult || cardsResult.error) {
            console.error(`    ❌ Failed to fetch cards page ${page}: ${cardsResult?.error?.message}`);
            break;
          }

          const cards = cardsResult.data.data;
          console.log(`    - Page ${page}: ${cards.length} cards`);

          if (cards.length === 0) {
            hasMore = false;
            break;
          }

          // Process cards in batches
          for (const apiCard of cards) {
            try {
              // Check if card already exists
              const existingCard = await prisma.card.findUnique({
                where: { id: apiCard.id },
              });

              if (!existingCard) {
                // Transform and create card
                const transformResult = await transformAndValidateCard(apiCard);
                
                // Check if transform failed
                if (!transformResult.isValid || !transformResult.data) {
                  if (setCardCount === 0) {
                    console.error(`      ❌ DETAILED ERROR for ${apiCard.name}:`, JSON.stringify(transformResult, null, 2));
                  }
                  console.error(`      ❌ Invalid card data for ${apiCard.name}:`, transformResult.errors);
                  continue;
                }
                
                const { prices } = transformResult;
                const cardData = transformResult.data;

                const newCard = await prisma.card.create({
                  data: {
                    id: apiCard.id, // Use the Pokemon TCG IO ID
                    ...cardData,
                    set: {
                      connect: { id: dbSet.id } // Connect to the set
                    },
                  },
                });

                // Add prices
                if (prices && prices.length > 0) {
                  const validPrices = prices.filter(p => p.source !== undefined);
                  if (validPrices.length > 0) {
                    await prisma.cardPrice.createMany({
                      data: validPrices.map(p => ({ ...p, cardId: newCard.id })),
                    });
                    setPriceCount += validPrices.length;
                  }
                }

                setCardCount++;
              }
            } catch (cardError) {
              if (setCardCount === 0 && cards.indexOf(apiCard) === 0) {
                // Show full error for first card
                console.error(`      ❌ FIRST ERROR - Card ${apiCard.name}:`, cardError);
              } else {
                console.error(`      ❌ Error processing card ${apiCard.name}: ${cardError}`);
              }
            }
          }

          // Check if there are more pages
          hasMore = cardsResult.data.page * cardsResult.data.pageSize < cardsResult.data.totalCount;
          page++;

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`  ✅ Set complete: ${setCardCount} new cards, ${setPriceCount} prices`);
        totalCardsImported += setCardCount;
        totalPricesImported += setPriceCount;
        setsProcessed++;

        // Show progress
        console.log(`\n📊 Overall Progress: ${setsProcessed}/${allSets.length} sets processed`);
        console.log(`   Total cards imported: ${totalCardsImported}`);
        console.log(`   Total prices imported: ${totalPricesImported}`);

        // Remove test limit - process all sets
        // if (setsProcessed >= 2) {
        //   console.log('\n⚠️  Stopping after 2 sets for testing');
        //   break;
        // }

      } catch (setError) {
        console.error(`  ❌ Error processing set ${apiSet.name}: ${setError}`);
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ Import completed successfully!\n');
    console.log('📊 Final Statistics:');
    console.log(`  - Sets processed: ${setsProcessed}`);
    console.log(`  - Cards imported: ${totalCardsImported}`);
    console.log(`  - Prices imported: ${totalPricesImported}`);
    
    // Get final database state
    const finalSets = await prisma.set.count();
    const finalCards = await prisma.card.count();
    const finalPrices = await prisma.cardPrice.count();
    
    console.log(`\n📊 Final database state:`);
    console.log(`  - Total sets: ${finalSets}`);
    console.log(`  - Total cards: ${finalCards}`);
    console.log(`  - Total prices: ${finalPrices}`);

  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importCards()
  .then(() => {
    console.log('\n👋 Import process finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });