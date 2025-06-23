import { Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { PokemonTCGClient } from '@/lib/api/pokemon-tcg-client';
import { normalizeCardData, normalizeSetData, transformAndValidateCard } from '@/lib/api/transformers';
import { cardCache, setCache } from '@/lib/api/cache';
import type { JobData, JobResult } from '@/lib/api/types';

export async function processCardSyncJob(job: Job<JobData>): Promise<JobResult> {
  const { scope } = job.data.payload;
  
  try {
    const pokemonClient = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
    
    await job.updateProgress(5);

    let setsToSync;
    
    if (scope === 'recent') {
      // Sync sets released in the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      setsToSync = await prisma.set.findMany({
        where: {
          releaseDate: { gte: sixMonthsAgo }
        },
        orderBy: { releaseDate: 'desc' },
      });
    } else if (scope === 'all') {
      // Sync all sets
      setsToSync = await prisma.set.findMany({
        orderBy: { releaseDate: 'desc' },
      });
    } else {
      // Sync specific sets
      const setIds = job.data.payload.setIds as string[];
      setsToSync = await prisma.set.findMany({
        where: { id: { in: setIds } },
      });
    }

    await job.updateProgress(10);

    console.log(`Syncing ${setsToSync.length} sets`);

    let totalUpdated = 0;
    let totalAdded = 0;
    let totalErrors = 0;
    const errors: string[] = [];

    for (let setIndex = 0; setIndex < setsToSync.length; setIndex++) {
      const set = setsToSync[setIndex];
      
      try {
        // Update set information
        const setResult = await pokemonClient.getSetByCode(set.code);
        if (setResult.data) {
          const normalizedSet = normalizeSetData(setResult.data.data);
          await prisma.set.update({
            where: { id: set.id },
            data: normalizedSet,
          });
          await setCache.delete(`set:${set.id}`);
        }

        // Get all cards in the set
        let page = 1;
        let hasMore = true;
        const existingCardIds = new Set(
          (await prisma.card.findMany({
            where: { setId: set.id },
            select: { id: true },
          })).map(c => c.id)
        );

        while (hasMore) {
          const cardsResult = await pokemonClient.getCardsBySet(set.code, page, 250);
          
          if (cardsResult.error) {
            errors.push(`Set ${set.name}: Failed to fetch cards page ${page}`);
            hasMore = false;
            continue;
          }

          if (!cardsResult.data || cardsResult.data.data.length === 0) {
            hasMore = false;
            continue;
          }

          // Process cards in this page
          for (const cardData of cardsResult.data.data) {
            try {
              const transformResult = await transformAndValidateCard(cardData);
              
              if (!transformResult.isValid || !transformResult.data) {
                totalErrors++;
                errors.push(`Card ${cardData.id}: Validation failed - ${transformResult.errors?.join(', ')}`);
                continue;
              }
              
              const isNew = !existingCardIds.has(cardData.id);
              
              // Use transaction to save card and pricing data atomically
              await prisma.$transaction(async (tx) => {
                // Upsert card
                await tx.card.upsert({
                  where: { id: cardData.id },
                  update: transformResult.data,
                  create: transformResult.data,
                });
                
                // Delete existing prices for this card
                await tx.cardPrice.deleteMany({
                  where: { cardId: cardData.id }
                });
                
                // Insert new prices if available
                if (transformResult.prices && transformResult.prices.length > 0) {
                  await tx.cardPrice.createMany({
                    data: transformResult.prices,
                  });
                  
                  // Also add to price history
                  const priceHistoryData = transformResult.prices.map(price => ({
                    cardId: price.cardId,
                    source: price.source,
                    priceType: price.priceType,
                    amount: price.amount,
                    currency: price.currency,
                    foil: price.foil,
                    condition: price.condition,
                    date: new Date(),
                  }));
                  
                  await tx.priceHistory.createMany({
                    data: priceHistoryData,
                  });
                }
              });

              await cardCache.delete(`card:${cardData.id}`);
              
              if (isNew) {
                totalAdded++;
              } else {
                totalUpdated++;
              }
            } catch (error) {
              totalErrors++;
              errors.push(`Card ${cardData.id}: ${error}`);
            }
          }

          if (cardsResult.data.data.length < 250) {
            hasMore = false;
          } else {
            page++;
          }
        }

      } catch (error) {
        console.error(`Error syncing set ${set.name}:`, error);
        errors.push(`Set ${set.name}: ${error}`);
      }

      // Update progress
      const progress = 10 + ((setIndex + 1) / setsToSync.length) * 85;
      await job.updateProgress(Math.min(progress, 95));
    }

    // Check for new sets
    console.log('Checking for new sets...');
    const allSetsResult = await pokemonClient.getAllSets(1, 100);
    
    if (allSetsResult.data) {
      const existingSetIds = new Set(
        (await prisma.set.findMany({ select: { id: true } })).map(s => s.id)
      );
      
      const newSets = allSetsResult.data.data.filter(set => !existingSetIds.has(set.id));
      
      if (newSets.length > 0) {
        console.log(`Found ${newSets.length} new sets`);
        
        // Queue import jobs for new sets
        const { setImportQueue } = await import('../queue');
        
        for (const newSet of newSets) {
          await setImportQueue.add(
            `import-set-${newSet.id}`,
            {
              type: 'IMPORT_SET',
              payload: { setCode: newSet.id, includeCards: true },
            },
            {
              delay: 5000, // 5 second delay between imports
            }
          );
        }
      }
    }

    await job.updateProgress(100);

    return {
      success: true,
      message: 'Card sync completed',
      data: {
        setsProcessed: setsToSync.length,
        cardsAdded: totalAdded,
        cardsUpdated: totalUpdated,
        errors: totalErrors,
        errorDetails: errors.slice(0, 20),
      },
    };
  } catch (error) {
    console.error('Card sync job failed:', error);
    return {
      success: false,
      message: 'Card sync job failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}