import { JobQueue, SetImportJobData, JobPriority } from '../types';
import { QueueManager } from '../queues';
import { prisma } from '@/server/db/prisma';
import { pokemonTCGClient } from '@/lib/api/pokemon-tcg-client';
import { redisCache } from '@/server/db/redis';

export interface PokemonSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  total: number;
  legalities?: Record<string, string>;
  images: {
    symbol: string;
    logo: string;
  };
}

export class SetImportService {
  /**
   * Detect new sets from Pokemon TCG API
   */
  async detectNewSets(): Promise<PokemonSet[]> {
    try {
      // Get all sets from API
      const apiSets = await pokemonTCGClient.sets.all();
      
      // Get existing set codes from database
      const dbSets = await prisma.set.findMany({
        select: { code: true },
      });
      
      const existingCodes = new Set(dbSets.map(s => s.code));
      
      // Filter new sets
      const newSets = apiSets.filter(set => !existingCodes.has(set.id));
      
      // Sort by release date (newest first)
      newSets.sort((a, b) => 
        new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
      );
      
      return newSets;
      
    } catch (error) {
      throw new Error(`Failed to detect new sets: ${error}`);
    }
  }

  /**
   * Import a specific set
   */
  async importSet(setCode: string, options?: {
    includeImages?: boolean;
    initializePrices?: boolean;
    notifyUsers?: boolean;
  }): Promise<string> {
    const jobData: SetImportJobData = {
      setCode,
      includeImages: options?.includeImages ?? true,
      initializePrices: options?.initializePrices ?? true,
      notifyUsers: options?.notifyUsers ?? true,
    };

    const job = await QueueManager.addJob(
      JobQueue.SET_IMPORT,
      `import-set-${setCode}`,
      jobData,
      {
        priority: JobPriority.HIGH,
        scheduledBy: 'admin',
        reason: 'Manual set import',
      }
    );

    return job.id!;
  }

  /**
   * Process set images
   */
  async processSetImages(setCode: string): Promise<void> {
    const cards = await prisma.card.findMany({
      where: { setCode },
      select: {
        id: true,
        imageUrlSmall: true,
        imageUrlLarge: true,
      },
    });

    // Validate all image URLs
    const invalidImages: string[] = [];
    
    for (const card of cards) {
      const urls = [card.imageUrlSmall, card.imageUrlLarge].filter(Boolean);
      
      for (const url of urls) {
        try {
          new URL(url);
        } catch {
          invalidImages.push(`Card ${card.id}: Invalid URL ${url}`);
        }
      }
    }

    if (invalidImages.length > 0) {
      throw new Error(`Invalid image URLs found:\n${invalidImages.join('\n')}`);
    }

    // Could add image optimization/caching here
  }

  /**
   * Update format legality for a set
   */
  async updateFormatLegality(setCode: string): Promise<void> {
    const set = await prisma.set.findUnique({
      where: { code: setCode },
    });

    if (!set) {
      throw new Error(`Set ${setCode} not found in database`);
    }

    // Get set details from API
    const apiSet = await pokemonTCGClient.sets.get(setCode);
    
    if (!apiSet?.legalities) {
      throw new Error(`No legality data found for set ${setCode}`);
    }

    // Update format connections
    const updates = [];

    for (const [format, legality] of Object.entries(apiSet.legalities)) {
      if (legality === 'Legal') {
        updates.push(
          prisma.format.update({
            where: { code: format.toLowerCase() },
            data: {
              legalSets: {
                connect: { id: set.id },
              },
            },
          })
        );
      }
    }

    await Promise.all(updates);
    
    // Clear format cache
    await redisCache.deletePattern('format:*');
  }

  /**
   * Initialize card prices for a set
   */
  async initializeCardPrices(setCode: string): Promise<void> {
    const cards = await prisma.card.findMany({
      where: {
        setCode,
        tcgplayerProductId: { not: null },
        prices: { none: {} },
      },
      select: { id: true },
    });

    if (cards.length === 0) {
      console.log(`No cards needing price initialization in set ${setCode}`);
      return;
    }

    // Schedule price update job
    await QueueManager.addJob(
      JobQueue.PRICE_UPDATE,
      `set-price-init-${setCode}`,
      {
        type: 'specific',
        cardIds: cards.map(c => c.id),
        force: true,
      },
      {
        priority: JobPriority.HIGH,
        scheduledBy: 'system',
        reason: `Initialize prices for set ${setCode}`,
      }
    );
  }

  /**
   * Notify users of new set availability
   */
  async notifyUsersOfNewSet(setCode: string): Promise<number> {
    const set = await prisma.set.findUnique({
      where: { code: setCode },
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });

    if (!set) {
      throw new Error(`Set ${setCode} not found`);
    }

    // Get users with new set notifications enabled
    const users = await prisma.user.findMany({
      where: {
        preferences: {
          path: ['notifications', 'newSets'],
          equals: true,
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
        clerkId: true,
      },
    });

    // Create in-app notifications
    const notifications = await Promise.all(
      users.map(user =>
        prisma.notification.create({
          data: {
            userId: user.id,
            type: 'NEW_SET',
            title: `New Set Available: ${set.name}`,
            message: `${set.name} from the ${set.series} series is now available with ${set._count.cards} cards!`,
            data: {
              setCode: set.code,
              setName: set.name,
              cardCount: set._count.cards,
            },
          },
        })
      )
    );

    // TODO: Send email notifications
    // TODO: Send push notifications

    return notifications.length;
  }

  /**
   * Get set import status
   */
  async getSetImportStatus(jobId: string) {
    return await QueueManager.getJobStatus(JobQueue.SET_IMPORT, jobId);
  }

  /**
   * Get recent set imports
   */
  async getRecentImports(limit = 10): Promise<any[]> {
    const sets = await prisma.set.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });

    return sets.map(set => ({
      code: set.code,
      name: set.name,
      series: set.series,
      releaseDate: set.releaseDate,
      cardCount: set._count.cards,
      importedAt: set.createdAt,
      lastUpdated: set.updatedAt,
    }));
  }

  /**
   * Check set completion for all users
   */
  async updateSetCompletion(setCode: string): Promise<void> {
    // Get all cards in the set
    const setCards = await prisma.card.findMany({
      where: { setCode },
      select: { id: true },
    });

    const cardIds = new Set(setCards.map(c => c.id));

    // Get all users with cards from this set
    const usersWithCards = await prisma.userCollection.findMany({
      where: {
        cardId: { in: Array.from(cardIds) },
      },
      distinct: ['userId'],
      select: { userId: true },
    });

    // Update completion stats for each user
    for (const { userId } of usersWithCards) {
      const ownedCards = await prisma.userCollection.count({
        where: {
          userId,
          cardId: { in: Array.from(cardIds) },
          quantity: { gt: 0 },
        },
      });

      const completionPercentage = (ownedCards / cardIds.size) * 100;

      // Store completion stat (could be in user preferences or separate table)
      await prisma.user.update({
        where: { id: userId },
        data: {
          collectionStats: {
            update: {
              setCompletion: {
                [setCode]: completionPercentage,
              },
            },
          },
        },
      });
    }
  }

  /**
   * Generate set preview for marketing
   */
  async generateSetPreview(setCode: string): Promise<any> {
    const set = await prisma.set.findUnique({
      where: { code: setCode },
      include: {
        cards: {
          where: {
            OR: [
              { rarity: 'RARE_SECRET' },
              { rarity: 'RARE_ULTRA' },
              { rarity: 'RARE_HOLO_VMAX' },
            ],
          },
          take: 10,
          orderBy: { number: 'asc' },
        },
      },
    });

    if (!set) {
      throw new Error(`Set ${setCode} not found`);
    }

    return {
      set: {
        code: set.code,
        name: set.name,
        series: set.series,
        releaseDate: set.releaseDate,
        totalCards: set.totalCards,
        images: set.images,
      },
      featuredCards: set.cards.map(card => ({
        id: card.id,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        imageUrl: card.imageUrlLarge,
        types: card.types,
      })),
    };
  }
}

// Export singleton instance
export const setImportService = new SetImportService();