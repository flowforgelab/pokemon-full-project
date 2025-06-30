// Load environment variables FIRST
import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PokemonTCGClient } from '../lib/api/pokemon-tcg-client';
import { transformAndValidateCard } from '../lib/api/transformers';

const prisma = new PrismaClient();

// Progress tracking file
const PROGRESS_FILE = path.join(process.cwd(), 'import-progress.json');

interface ImportProgress {
  lastProcessedSetId?: string;
  processedSets: string[];
  totalSets: number;
  totalCardsImported: number;
  totalPricesImported: number;
  errors: Array<{ setId: string; error: string; timestamp: string }>;
  startedAt: string;
  lastUpdatedAt: string;
}

function loadProgress(): ImportProgress | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
  return null;
}

function saveProgress(progress: ImportProgress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

async function importAllCards() {
  console.log('🚀 Starting comprehensive card import...\n');
  
  const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
  
  // Load or initialize progress
  let progress = loadProgress();
  if (progress) {
    console.log('📊 Found existing progress:');
    console.log(`  - Processed sets: ${progress.processedSets.length}/${progress.totalSets}`);
    console.log(`  - Cards imported: ${progress.totalCardsImported}`);
    console.log(`  - Prices imported: ${progress.totalPricesImported}`);
    console.log(`  - Last updated: ${progress.lastUpdatedAt}\n`);
    
    const resume = process.argv.includes('--resume');
    if (!resume) {
      console.log('💡 Tip: Use --resume flag to continue from last progress');
      console.log('🔄 Starting fresh import...\n');
      progress = null;
    } else {
      console.log('🔄 Resuming from last progress...\n');
    }
  }
  
  if (!progress) {
    progress = {
      processedSets: [],
      totalSets: 0,
      totalCardsImported: 0,
      totalPricesImported: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  try {
    // Get all sets
    console.log('📦 Fetching all sets...');
    const setsResult = await client.getAllSets();
    if (!setsResult.success) {
      throw new Error('Failed to fetch sets: ' + setsResult.error);
    }
    const allSets = setsResult.data.data.sort((a, b) => 
      new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    );
    
    progress.totalSets = allSets.length;
    console.log(`📊 Found ${allSets.length} sets to process\n`);

    // Filter out already processed sets if resuming
    const setsToProcess = progress.processedSets.length > 0
      ? allSets.filter(set => !progress.processedSets.includes(set.id))
      : allSets;

    console.log(`🎯 Processing ${setsToProcess.length} sets...\n`);

    for (const [index, set] of setsToProcess.entries()) {
      const setNumber = progress.processedSets.length + index + 1;
      console.log(`\n📦 [${setNumber}/${allSets.length}] Processing ${set.name} (${set.id})`);
      console.log(`  - Series: ${set.series}`);
      console.log(`  - Release Date: ${set.releaseDate}`);
      console.log(`  - Total Cards: ${set.total}`);

      try {
        // Check if set exists, create if not
        let dbSet = await prisma.set.findUnique({
          where: { pokemonTcgIoId: set.id },
        });

        if (!dbSet) {
          dbSet = await prisma.set.create({
            data: {
              pokemonTcgIoId: set.id,
              name: set.name,
              series: set.series,
              printedTotal: set.printedTotal,
              total: set.total,
              releaseDate: set.releaseDate,
              ptcgoCode: set.ptcgoCode || null,
              images: {
                symbol: set.images.symbol,
                logo: set.images.logo,
              },
            },
          });
          console.log(`  ✅ Set created in database`);
        } else {
          console.log(`  ℹ️  Set already exists in database`);
        }

        // Get all cards for this set
        console.log(`  🃏 Fetching cards...`);
        let page = 1;
        let hasMore = true;
        let setCardCount = 0;
        let setPriceCount = 0;

        while (hasMore) {
          try {
            const cardsResult = await client.getCardsBySet(set.id, page, 250);
            if (!cardsResult.success) {
              console.error(`    ❌ Failed to fetch cards: ${cardsResult.error}`);
              hasMore = false;
              break;
            }

            const cards = cardsResult.data.data;
            console.log(`    - Page ${page}: ${cards.length} cards`);

            if (cards.length === 0) {
              hasMore = false;
              break;
            }

            // Process cards in batches
            for (let i = 0; i < cards.length; i += 50) {
              const batch = cards.slice(i, i + 50);
              
              await prisma.$transaction(async (tx) => {
                for (const apiCard of batch) {
                  try {
                    // Check if card exists
                    const existingCard = await tx.card.findUnique({
                      where: { pokemonTcgIoId: apiCard.id },
                    });

                    if (existingCard) {
                      // Update prices only
                      const transformResult = transformAndValidateCard(apiCard, dbSet.id);
                      const validPrices = transformResult.prices.filter(price => price.source !== undefined);
                      
                      if (validPrices.length > 0) {
                        // Delete old prices and insert new ones
                        await tx.cardPrice.deleteMany({
                          where: { cardId: existingCard.id },
                        });
                        
                        await tx.cardPrice.createMany({
                          data: validPrices.map(price => ({
                            ...price,
                            cardId: existingCard.id,
                          })),
                        });
                        
                        setPriceCount += validPrices.length;
                      }
                    } else {
                      // Create new card
                      const transformResult = transformAndValidateCard(apiCard, dbSet.id);
                      const { prices, ...cardData } = transformResult;
                      
                      const newCard = await tx.card.create({
                        data: cardData,
                      });
                      
                      // Add prices
                      const validPrices = prices.filter(price => price.source !== undefined);
                      if (validPrices.length > 0) {
                        await tx.cardPrice.createMany({
                          data: validPrices.map(price => ({
                            ...price,
                            cardId: newCard.id,
                          })),
                        });
                        setPriceCount += validPrices.length;
                      }
                      
                      setCardCount++;
                    }
                  } catch (cardError) {
                    console.error(`      ❌ Error processing card ${apiCard.id}:`, cardError);
                  }
                }
              });
            }

            // Rate limiting - Pokemon TCG API allows 1000 requests/day without key, 20000 with key
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between requests

            page++;
            hasMore = cardsResult.data.page * cardsResult.data.pageSize < cardsResult.data.totalCount;
          } catch (pageError) {
            console.error(`    ❌ Error fetching page ${page}:`, pageError);
            hasMore = false;
          }
        }

        console.log(`  ✅ Set complete: ${setCardCount} new cards, ${setPriceCount} prices`);
        
        // Update progress
        progress.processedSets.push(set.id);
        progress.totalCardsImported += setCardCount;
        progress.totalPricesImported += setPriceCount;
        progress.lastProcessedSetId = set.id;
        progress.lastUpdatedAt = new Date().toISOString();
        saveProgress(progress);

      } catch (setError) {
        console.error(`  ❌ Error processing set:`, setError);
        progress.errors.push({
          setId: set.id,
          error: setError instanceof Error ? setError.message : String(setError),
          timestamp: new Date().toISOString(),
        });
        saveProgress(progress);
      }

      // Show overall progress
      console.log(`\n📊 Overall Progress: ${progress.processedSets.length}/${progress.totalSets} sets (${Math.round((progress.processedSets.length / progress.totalSets) * 100)}%)`);
      console.log(`   Total cards imported: ${progress.totalCardsImported}`);
      console.log(`   Total prices imported: ${progress.totalPricesImported}`);
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ Import completed successfully!\n');
    console.log('📊 Final Statistics:');
    console.log(`  - Sets processed: ${progress.processedSets.length}/${progress.totalSets}`);
    console.log(`  - Cards imported: ${progress.totalCardsImported}`);
    console.log(`  - Prices imported: ${progress.totalPricesImported}`);
    console.log(`  - Errors encountered: ${progress.errors.length}`);
    console.log(`  - Started at: ${progress.startedAt}`);
    console.log(`  - Completed at: ${new Date().toISOString()}`);

    if (progress.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      progress.errors.forEach(err => {
        console.log(`  - ${err.setId}: ${err.error} (${err.timestamp})`);
      });
    }

    // Clean up progress file
    try {
      fs.unlinkSync(PROGRESS_FILE);
      console.log('\n🧹 Cleaned up progress file');
    } catch (error) {
      console.error('Error cleaning up progress file:', error);
    }

  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
    saveProgress(progress);
    console.log('\n💡 Run with --resume flag to continue from where it left off');
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importAllCards()
  .then(() => {
    console.log('\n👋 Import process finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });