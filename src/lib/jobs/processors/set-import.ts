import { Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { PokemonTCGClient } from '@/lib/api/pokemon-tcg-client';
import { TCGPlayerClient } from '@/lib/api/tcgplayer-client';
import { normalizeSetData, normalizeCardData, mapTCGPlayerIds } from '@/lib/api/transformers';
import { setCache, cardCache } from '@/lib/api/cache';
import type { JobData, JobResult } from '@/lib/api/types';

export async function processSetImportJob(job: Job<JobData>): Promise<JobResult> {
  const { setCode, includeCards = true } = job.data.payload;
  
  try {
    const pokemonClient = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
    const tcgPlayerClient = new TCGPlayerClient(
      process.env.TCGPLAYER_API_PUBLIC_KEY!,
      process.env.TCGPLAYER_API_PRIVATE_KEY!
    );

    await job.updateProgress(5);

    // Fetch set data
    console.log(`Fetching set data for ${setCode}`);
    const setResult = await pokemonClient.getSetByCode(setCode);
    
    if (setResult.error) {
      throw new Error(`Failed to fetch set: ${setResult.error.message}`);
    }
    
    if (!setResult.data) {
      throw new Error('No set data returned');
    }

    const setData = setResult.data.data;
    await job.updateProgress(10);

    // Import or update set
    const normalizedSet = normalizeSetData(setData);
    
    await prisma.set.upsert({
      where: { id: setData.id },
      update: normalizedSet,
      create: normalizedSet,
    });

    // Clear set cache
    await setCache.delete(`set:${setData.id}`);
    
    console.log(`Set ${setData.name} imported successfully`);
    await job.updateProgress(20);

    let importedCards = 0;
    let failedCards = 0;
    const errors: string[] = [];

    if (includeCards) {
      // Fetch all cards in the set
      console.log(`Fetching cards for set ${setCode}`);
      let page = 1;
      let hasMore = true;
      const allCards = [];

      while (hasMore) {
        const cardsResult = await pokemonClient.getCardsBySet(setCode, page, 250);
        
        if (cardsResult.error) {
          errors.push(`Failed to fetch cards page ${page}: ${cardsResult.error.message}`);
          hasMore = false;
          continue;
        }

        if (!cardsResult.data) {
          hasMore = false;
          continue;
        }

        allCards.push(...cardsResult.data.data);
        
        if (cardsResult.data.data.length < 250 || allCards.length >= cardsResult.data.totalCount) {
          hasMore = false;
        } else {
          page++;
        }

        const progress = 20 + (allCards.length / cardsResult.data.totalCount) * 30;
        await job.updateProgress(Math.min(progress, 50));
      }

      console.log(`Found ${allCards.length} cards in set ${setCode}`);

      // Get TCGPlayer mappings if available
      let tcgPlayerMapping = new Map<string, number>();
      
      try {
        // Search for TCGPlayer products for this set
        const groupsResult = await tcgPlayerClient.getAllGroups();
        if (groupsResult.data) {
          const setGroup = groupsResult.data.find(
            group => group.name.toLowerCase() === setData.name.toLowerCase()
          );
          
          if (setGroup) {
            // Update set with TCGPlayer group ID
            await prisma.set.update({
              where: { id: setData.id },
              data: { tcgplayerGroupId: setGroup.groupId },
            });
          }
        }
      } catch (error) {
        console.warn('Failed to get TCGPlayer mappings:', error);
      }

      await job.updateProgress(60);

      // Import cards in batches
      const batchSize = 50;
      for (let i = 0; i < allCards.length; i += batchSize) {
        const batch = allCards.slice(i, i + batchSize);
        
        for (const cardData of batch) {
          try {
            const normalizedCard = normalizeCardData(cardData);
            
            await prisma.card.upsert({
              where: { id: cardData.id },
              update: normalizedCard,
              create: normalizedCard,
            });

            // Clear card cache
            await cardCache.delete(`card:${cardData.id}`);
            
            importedCards++;
          } catch (error) {
            console.error(`Failed to import card ${cardData.id}:`, error);
            errors.push(`Card ${cardData.id} (${cardData.name}): ${error}`);
            failedCards++;
          }
        }

        const progress = 60 + ((i + batchSize) / allCards.length) * 35;
        await job.updateProgress(Math.min(progress, 95));
      }
    }

    await job.updateProgress(100);

    return {
      success: true,
      message: `Set import completed for ${setData.name}`,
      data: {
        setId: setData.id,
        setName: setData.name,
        totalCards: setData.total,
        importedCards,
        failedCards,
        errors: errors.slice(0, 10), // Return first 10 errors
      },
    };
  } catch (error) {
    console.error('Set import job failed:', error);
    return {
      success: false,
      message: 'Set import job failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}