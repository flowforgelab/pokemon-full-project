import { Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { TCGPlayerClient } from '@/lib/api/tcgplayer-client';
import { priceCache } from '@/lib/api/cache';
import type { JobData, JobResult } from '@/lib/api/types';
import { Prisma } from '@prisma/client';

export async function processPriceUpdateJob(job: Job<JobData>): Promise<JobResult> {
  const { scope } = job.data.payload;
  
  try {
    // Initialize TCGPlayer client
    const tcgPlayerClient = new TCGPlayerClient(
      process.env.TCGPLAYER_API_PUBLIC_KEY!,
      process.env.TCGPLAYER_API_PRIVATE_KEY!
    );

    // Update job progress
    await job.updateProgress(5);

    let cardsToUpdate;
    
    if (scope === 'all') {
      // Get all cards with TCGPlayer IDs
      cardsToUpdate = await prisma.card.findMany({
        where: {
          tcgplayerId: { not: null }
        },
        select: {
          id: true,
          tcgplayerId: true,
          name: true,
        },
      });
    } else if (scope === 'popular') {
      // Get most popular cards (in most decks)
      cardsToUpdate = await prisma.card.findMany({
        where: {
          tcgplayerId: { not: null },
          deckCards: {
            some: {}
          }
        },
        select: {
          id: true,
          tcgplayerId: true,
          name: true,
          _count: {
            select: { deckCards: true }
          }
        },
        orderBy: {
          deckCards: {
            _count: 'desc'
          }
        },
        take: 1000,
      });
    } else {
      // Update specific cards
      const cardIds = job.data.payload.cardIds as string[];
      cardsToUpdate = await prisma.card.findMany({
        where: {
          id: { in: cardIds },
          tcgplayerId: { not: null }
        },
        select: {
          id: true,
          tcgplayerId: true,
          name: true,
        },
      });
    }

    await job.updateProgress(10);

    console.log(`Updating prices for ${cardsToUpdate.length} cards`);

    // Process in batches of 250 (TCGPlayer API limit)
    const batchSize = 250;
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
      const batch = cardsToUpdate.slice(i, i + batchSize);
      const tcgPlayerIds = batch
        .map(card => card.tcgplayerId ? parseInt(card.tcgplayerId) : null)
        .filter((id): id is number => id !== null);

      if (tcgPlayerIds.length === 0) continue;

      try {
        // Fetch prices from TCGPlayer
        const priceResult = await tcgPlayerClient.getCardPrices(tcgPlayerIds);
        
        if (priceResult.error) {
          errors.push(`Batch ${i / batchSize}: ${priceResult.error.message}`);
          errorCount += batch.length;
          continue;
        }

        if (!priceResult.data) continue;

        // Create price updates
        const priceUpdates: Prisma.CardPriceCreateManyInput[] = [];
        const priceHistoryUpdates: Prisma.PriceHistoryCreateManyInput[] = [];
        
        for (const priceData of priceResult.data) {
          const card = batch.find(c => c.tcgplayerId === priceData.productId.toString());
          if (!card) continue;

          // Update current prices
          if (priceData.marketPrice) {
            priceUpdates.push({
              cardId: card.id,
              source: 'TCGPLAYER',
              priceType: 'MARKET',
              price: new Prisma.Decimal(priceData.marketPrice),
              currency: 'USD',
            });

            // Add to price history
            priceHistoryUpdates.push({
              cardId: card.id,
              date: new Date(),
              source: 'TCGPLAYER',
              priceType: 'MARKET',
              price: new Prisma.Decimal(priceData.marketPrice),
              currency: 'USD',
            });
          }

          if (priceData.lowPrice) {
            priceUpdates.push({
              cardId: card.id,
              source: 'TCGPLAYER',
              priceType: 'LOW',
              price: new Prisma.Decimal(priceData.lowPrice),
              currency: 'USD',
            });
          }

          if (priceData.midPrice) {
            priceUpdates.push({
              cardId: card.id,
              source: 'TCGPLAYER',
              priceType: 'MID',
              price: new Prisma.Decimal(priceData.midPrice),
              currency: 'USD',
            });
          }

          if (priceData.highPrice) {
            priceUpdates.push({
              cardId: card.id,
              source: 'TCGPLAYER',
              priceType: 'HIGH',
              price: new Prisma.Decimal(priceData.highPrice),
              currency: 'USD',
            });
          }

          // Clear price cache for this card
          await priceCache.delete(`price:${card.id}`);
          
          successCount++;
        }

        // Bulk upsert prices
        if (priceUpdates.length > 0) {
          await prisma.$transaction([
            // Delete old prices for these cards
            prisma.cardPrice.deleteMany({
              where: {
                cardId: { in: batch.map(c => c.id) },
                source: 'TCGPLAYER',
              },
            }),
            // Insert new prices
            prisma.cardPrice.createMany({
              data: priceUpdates,
              skipDuplicates: true,
            }),
            // Insert price history
            prisma.priceHistory.createMany({
              data: priceHistoryUpdates,
              skipDuplicates: true,
            }),
          ]);
        }

      } catch (error) {
        console.error(`Error processing batch ${i / batchSize}:`, error);
        errors.push(`Batch ${i / batchSize}: ${error}`);
        errorCount += batch.length;
      }

      // Update progress
      const progress = 10 + ((i + batchSize) / cardsToUpdate.length) * 85;
      await job.updateProgress(Math.min(progress, 95));
    }

    // Clean up old price history (keep last 90 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    await prisma.priceHistory.deleteMany({
      where: {
        date: { lt: cutoffDate }
      }
    });

    await job.updateProgress(100);

    return {
      success: true,
      message: `Price update completed. Success: ${successCount}, Errors: ${errorCount}`,
      data: {
        totalCards: cardsToUpdate.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10), // Return first 10 errors
      },
    };
  } catch (error) {
    console.error('Price update job failed:', error);
    return {
      success: false,
      message: 'Price update job failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}