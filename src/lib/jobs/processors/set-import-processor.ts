import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/db/db';
import { pokemonTCGClient } from '@/lib/api/pokemon-tcg-client';
import { tcgPlayerClient } from '@/lib/api/tcgplayer-client';
import { redisCache } from '@/lib/cache/redis-cache';
import { 
  SetImportJobData, 
  SetImportResult,
  SetImportError,
  JobQueue,
  JobPriority
} from '../types';
import { QueueManager } from '../queues';

export class SetImportProcessor {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      JobQueue.SET_IMPORT,
      this.process.bind(this),
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
        },
        concurrency: 1, // Process one set import at a time
      }
    );

    this.setupEventHandlers();
  }

  private async process(job: Job<SetImportJobData>): Promise<SetImportResult> {
    const startTime = Date.now();
    const errors: SetImportError[] = [];
    
    try {
      await job.log(`Starting set import: ${job.data.setCode}`);
      
      // Check if this is just a detection check
      if (job.data.checkOnly) {
        return await this.checkForNewSets();
      }

      // Import the specific set
      const result = await this.importSet(job.data, job);
      
      await job.log(`Set import completed: ${result.cardsImported} cards imported`);
      
      return result;
      
    } catch (error) {
      await job.log(`Fatal error in set import: ${error}`);
      throw error;
    }
  }

  private async checkForNewSets(): Promise<SetImportResult> {
    try {
      // Get all sets from Pokemon TCG API
      const apiSets = await pokemonTCGClient.sets.all();
      
      // Get existing sets from database
      const dbSets = await prisma.set.findMany({
        select: { code: true, updatedAt: true },
      });
      
      const dbSetCodes = new Set(dbSets.map(s => s.code));
      const newSets = apiSets.filter(set => !dbSetCodes.has(set.id));
      
      // If new sets found, schedule import jobs
      if (newSets.length > 0) {
        for (const newSet of newSets) {
          await QueueManager.addJob(
            JobQueue.SET_IMPORT,
            `import-set-${newSet.id}`,
            {
              setCode: newSet.id,
              setId: newSet.id,
              includeImages: true,
              initializePrices: true,
              notifyUsers: true,
            },
            {
              priority: JobPriority.HIGH,
              scheduledBy: 'system',
              reason: 'New set detected',
            }
          );
        }
        
        // Send notification about new sets
        await this.notifyNewSetsDetected(newSets);
      }
      
      return {
        setCode: 'detection-check',
        setName: 'Set Detection Check',
        releaseDate: new Date(),
        cardsImported: 0,
        cardsUpdated: 0,
        imagesProcessed: 0,
        legalityUpdated: false,
        pricesInitialized: false,
        notificationsSent: newSets.length,
        errors: [],
      };
      
    } catch (error) {
      throw new Error(`Failed to check for new sets: ${error}`);
    }
  }

  private async importSet(data: SetImportJobData, job: Job): Promise<SetImportResult> {
    const errors: SetImportError[] = [];
    let cardsImported = 0;
    let cardsUpdated = 0;
    let imagesProcessed = 0;
    
    try {
      // Get set details from API
      const setData = await pokemonTCGClient.sets.get(data.setCode);
      
      if (!setData) {
        throw new Error(`Set ${data.setCode} not found in Pokemon TCG API`);
      }
      
      await job.log(`Importing set: ${setData.name} (${setData.total} cards)`);
      
      // Create or update set in database
      const dbSet = await prisma.set.upsert({
        where: { code: setData.id },
        create: {
          code: setData.id,
          name: setData.name,
          series: setData.series,
          totalCards: setData.total,
          printedTotal: setData.printedTotal,
          ptcgoCode: setData.ptcgoCode,
          releaseDate: new Date(setData.releaseDate),
          images: {
            symbol: setData.images.symbol,
            logo: setData.images.logo,
          },
        },
        update: {
          name: setData.name,
          totalCards: setData.total,
          printedTotal: setData.printedTotal,
          updatedAt: new Date(),
        },
      });
      
      await job.updateProgress(10);
      
      // Get all cards in the set
      const cards = await pokemonTCGClient.cards.all({ q: `set.id:${setData.id}` });
      await job.log(`Found ${cards.length} cards in set ${setData.name}`);
      
      // Import cards in batches
      const batchSize = 20;
      for (let i = 0; i < cards.length; i += batchSize) {
        const batch = cards.slice(i, i + batchSize);
        
        for (const cardData of batch) {
          try {
            // Check if card exists
            const existingCard = await prisma.card.findUnique({
              where: { id: cardData.id },
            });
            
            if (existingCard) {
              // Update existing card
              await prisma.card.update({
                where: { id: cardData.id },
                data: await this.transformCardData(cardData, dbSet.id),
              });
              cardsUpdated++;
            } else {
              // Create new card
              await prisma.card.create({
                data: await this.transformCardData(cardData, dbSet.id),
              });
              cardsImported++;
            }
            
            // Process images if requested
            if (data.includeImages) {
              await this.validateAndStoreImages(cardData);
              imagesProcessed++;
            }
            
          } catch (error) {
            errors.push({
              cardNumber: cardData.number,
              error: error instanceof Error ? error.message : 'Unknown error',
              details: { cardId: cardData.id, cardName: cardData.name },
            });
          }
        }
        
        // Update progress
        const progress = 10 + Math.floor(((i + batch.length) / cards.length) * 70);
        await job.updateProgress(progress);
        await job.log(`Processed ${i + batch.length}/${cards.length} cards`);
      }
      
      // Update format legality
      let legalityUpdated = false;
      if (setData.legalities) {
        await this.updateFormatLegality(dbSet.id, setData.legalities);
        legalityUpdated = true;
      }
      
      await job.updateProgress(85);
      
      // Initialize prices if requested
      let pricesInitialized = false;
      if (data.initializePrices) {
        await this.initializeSetPrices(dbSet.id);
        pricesInitialized = true;
      }
      
      await job.updateProgress(95);
      
      // Send notifications if requested
      let notificationsSent = 0;
      if (data.notifyUsers) {
        notificationsSent = await this.notifyUsersOfNewSet(dbSet);
      }
      
      await job.updateProgress(100);
      
      // Clear relevant caches
      await redisCache.deletePattern('card:*');
      await redisCache.deletePattern('set:*');
      
      return {
        setCode: setData.id,
        setName: setData.name,
        releaseDate: dbSet.releaseDate,
        cardsImported,
        cardsUpdated,
        imagesProcessed,
        legalityUpdated,
        pricesInitialized,
        notificationsSent,
        errors,
      };
      
    } catch (error) {
      throw new Error(`Failed to import set ${data.setCode}: ${error}`);
    }
  }

  private async transformCardData(cardData: any, setId: string): Promise<any> {
    // Map Pokemon TCG API data to our database schema
    return {
      id: cardData.id,
      name: cardData.name,
      setId,
      setCode: cardData.set.id,
      number: cardData.number,
      artist: cardData.artist,
      rarity: this.mapRarity(cardData.rarity),
      flavorText: cardData.flavorText,
      nationalPokedexNumbers: cardData.nationalPokedexNumbers || [],
      legalities: cardData.legalities || {},
      imageUrlSmall: cardData.images?.small || '',
      imageUrlLarge: cardData.images?.large || '',
      tcgplayerProductId: cardData.tcgplayer?.productId?.toString() || null,
      supertype: this.mapSupertype(cardData.supertype),
      subtypes: cardData.subtypes || [],
      level: cardData.level,
      hp: cardData.hp ? parseInt(cardData.hp) : null,
      types: cardData.types || [],
      evolvesFrom: cardData.evolvesFrom,
      evolvesTo: cardData.evolvesTo || [],
      rules: cardData.rules || [],
      ancientTrait: cardData.ancientTrait,
      abilities: cardData.abilities || [],
      attacks: cardData.attacks || [],
      weaknesses: cardData.weaknesses || [],
      resistances: cardData.resistances || [],
      retreatCost: cardData.retreatCost || [],
      convertedRetreatCost: cardData.convertedRetreatCost || 0,
      regulation: cardData.regulationMark,
    };
  }

  private mapRarity(rarity: string): string {
    // Map to our enum values
    const rarityMap: Record<string, string> = {
      'Common': 'COMMON',
      'Uncommon': 'UNCOMMON',
      'Rare': 'RARE',
      'Rare Holo': 'RARE_HOLO',
      'Rare Holo EX': 'RARE_HOLO_EX',
      'Rare Holo GX': 'RARE_HOLO_GX',
      'Rare Holo V': 'RARE_HOLO_V',
      'Rare Holo VMAX': 'RARE_HOLO_VMAX',
      'Rare Ultra': 'RARE_ULTRA',
      'Rare Secret': 'RARE_SECRET',
      'Amazing Rare': 'AMAZING_RARE',
      'Promo': 'PROMO',
    };
    
    return rarityMap[rarity] || 'COMMON';
  }

  private mapSupertype(supertype: string): string {
    const supertypeMap: Record<string, string> = {
      'Pokémon': 'POKEMON',
      'Trainer': 'TRAINER',
      'Energy': 'ENERGY',
    };
    
    return supertypeMap[supertype] || 'POKEMON';
  }

  private async validateAndStoreImages(cardData: any): Promise<void> {
    // Validate image URLs
    const imageUrls = [cardData.images?.small, cardData.images?.large].filter(Boolean);
    
    for (const url of imageUrls) {
      try {
        // Simple URL validation
        new URL(url);
        
        // Could add actual image validation here (check if URL returns valid image)
        // For now, we'll trust the Pokemon TCG API URLs
      } catch (error) {
        throw new Error(`Invalid image URL for card ${cardData.id}: ${url}`);
      }
    }
  }

  private async updateFormatLegality(setId: string, legalities: any): Promise<void> {
    // Update format legality for the set
    const updates = [];
    
    if (legalities.standard === 'Legal') {
      updates.push(
        prisma.format.update({
          where: { code: 'standard' },
          data: {
            legalSets: {
              connect: { id: setId },
            },
          },
        })
      );
    }
    
    if (legalities.expanded === 'Legal') {
      updates.push(
        prisma.format.update({
          where: { code: 'expanded' },
          data: {
            legalSets: {
              connect: { id: setId },
            },
          },
        })
      );
    }
    
    if (legalities.unlimited === 'Legal') {
      updates.push(
        prisma.format.update({
          where: { code: 'unlimited' },
          data: {
            legalSets: {
              connect: { id: setId },
            },
          },
        })
      );
    }
    
    await Promise.all(updates);
  }

  private async initializeSetPrices(setId: string): Promise<void> {
    // Get all cards in the set with TCGPlayer product IDs
    const cards = await prisma.card.findMany({
      where: {
        setId,
        tcgplayerProductId: { not: null },
      },
      select: {
        id: true,
        tcgplayerProductId: true,
      },
    });
    
    if (cards.length > 0) {
      // Schedule price update job for these cards
      await QueueManager.addJob(
        JobQueue.PRICE_UPDATE,
        'new-set-price-init',
        {
          type: 'specific',
          cardIds: cards.map(c => c.id),
          force: true,
        },
        {
          priority: JobPriority.HIGH,
          scheduledBy: 'system',
          reason: 'New set price initialization',
        }
      );
    }
  }

  private async notifyUsersOfNewSet(set: any): Promise<number> {
    // Get users who want new set notifications
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
      },
    });
    
    // Create notifications for each user
    for (const user of users) {
      // TODO: Send actual email/push notification
      console.log(`Notifying user ${user.username} about new set: ${set.name}`);
    }
    
    return users.length;
  }

  private async notifyNewSetsDetected(sets: any[]): Promise<void> {
    // Log and potentially send admin notifications
    console.log(`Detected ${sets.length} new sets:`, sets.map(s => s.name).join(', '));
    
    // Create audit log entry
    await QueueManager.addJob(
      JobQueue.AUDIT,
      'new-sets-detected',
      {
        setCount: sets.length,
        sets: sets.map(s => ({ id: s.id, name: s.name })),
        detectedAt: new Date(),
      }
    );
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`Set import job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Set import job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Set import worker error:', err);
    });
  }

  async shutdown() {
    await this.worker.close();
  }
}

// Create and export processor instance
export const setImportProcessor = new SetImportProcessor();