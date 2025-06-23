import { Worker, Job } from 'bullmq';
import { prisma } from '@/server/db/prisma';
import { 
  FormatRotationJobData,
  FormatRotationResult,
  JobQueue,
  JobPriority
} from '../types';
import { QueueManager } from '../queues';
import { recommendationEngine } from '@/lib/recommendations/recommendation-engine';

export class FormatRotationProcessor {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      JobQueue.FORMAT_ROTATION,
      this.process.bind(this),
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
        },
        concurrency: 1,
      }
    );

    this.setupEventHandlers();
  }

  private async process(job: Job<FormatRotationJobData>): Promise<FormatRotationResult> {
    try {
      await job.log(`Starting format rotation: ${job.data.format}`);

      // Check if this is just a detection check
      if (job.data.checkOnly) {
        return await this.checkForRotations();
      }

      // Process the rotation
      const result = await this.processRotation(job.data, job);
      
      await job.log(`Format rotation completed: ${result.affectedDecks} decks affected`);
      
      return result;
      
    } catch (error) {
      await job.log(`Fatal error in format rotation: ${error}`);
      throw error;
    }
  }

  private async checkForRotations(): Promise<FormatRotationResult> {
    // In a real implementation, this would check official Pokemon TCG announcements
    // For now, we'll simulate by checking if any sets are approaching rotation age
    
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const oldSets = await prisma.set.findMany({
      where: {
        releaseDate: { lt: twoYearsAgo },
        formats: {
          some: {
            code: 'standard',
          },
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        releaseDate: true,
      },
    });

    if (oldSets.length > 0) {
      // Schedule rotation job
      await QueueManager.addJob(
        JobQueue.FORMAT_ROTATION,
        'process-rotation',
        {
          format: 'standard',
          effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          rotatedSets: oldSets.map(s => s.code),
          newLegalSets: [],
          notifyUsers: true,
          generateMigrations: true,
        },
        {
          priority: JobPriority.HIGH,
          scheduledBy: 'system',
          reason: 'Format rotation detected',
        }
      );
    }

    return {
      format: 'standard',
      effectiveDate: new Date(),
      affectedDecks: 0,
      affectedUsers: 0,
      migrationsGenerated: 0,
      notificationsSent: 0,
      errors: [],
    };
  }

  private async processRotation(data: FormatRotationJobData, job: Job): Promise<FormatRotationResult> {
    const errors: Array<{ deckId: string; error: string }> = [];
    let affectedDecks = 0;
    let affectedUsers = 0;
    let migrationsGenerated = 0;
    let notificationsSent = 0;

    try {
      // Get the format
      const format = await prisma.format.findUnique({
        where: { code: data.format },
        include: { legalSets: true },
      });

      if (!format) {
        throw new Error(`Format ${data.format} not found`);
      }

      await job.updateProgress(10);

      // Remove rotated sets from format
      if (data.rotatedSets.length > 0) {
        const rotatedSetIds = await prisma.set.findMany({
          where: { code: { in: data.rotatedSets } },
          select: { id: true },
        });

        await prisma.format.update({
          where: { id: format.id },
          data: {
            legalSets: {
              disconnect: rotatedSetIds.map(s => ({ id: s.id })),
            },
          },
        });
      }

      // Add new legal sets
      if (data.newLegalSets.length > 0) {
        const newSetIds = await prisma.set.findMany({
          where: { code: { in: data.newLegalSets } },
          select: { id: true },
        });

        await prisma.format.update({
          where: { id: format.id },
          data: {
            legalSets: {
              connect: newSetIds.map(s => ({ id: s.id })),
            },
          },
        });
      }

      await job.updateProgress(20);

      // Find all decks affected by the rotation
      const affectedDeckData = await this.findAffectedDecks(format.id, data.rotatedSets);
      affectedDecks = affectedDeckData.length;
      
      const uniqueUsers = new Set(affectedDeckData.map(d => d.userId));
      affectedUsers = uniqueUsers.size;

      await job.log(`Found ${affectedDecks} affected decks from ${affectedUsers} users`);
      await job.updateProgress(40);

      // Process each affected deck
      let decksProcessed = 0;
      for (const deck of affectedDeckData) {
        try {
          // Update deck legality status
          await prisma.deck.update({
            where: { id: deck.id },
            data: {
              isLegal: false,
              rotationNotes: {
                rotationDate: data.effectiveDate,
                rotatedSets: data.rotatedSets,
                illegalCards: deck.illegalCards,
              },
            },
          });

          // Generate migration suggestions if requested
          if (data.generateMigrations) {
            const migration = await this.generateMigration(deck);
            if (migration) {
              await prisma.deckMigration.create({
                data: {
                  deckId: deck.id,
                  formatRotationDate: data.effectiveDate,
                  illegalCards: migration.illegalCards,
                  suggestedReplacements: migration.suggestedReplacements,
                  estimatedCost: migration.estimatedCost,
                  autoFixAvailable: migration.autoFixAvailable,
                },
              });
              migrationsGenerated++;
            }
          }

          decksProcessed++;
          const progress = 40 + Math.floor((decksProcessed / affectedDecks) * 40);
          await job.updateProgress(progress);

        } catch (error) {
          errors.push({
            deckId: deck.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      await job.updateProgress(80);

      // Send notifications if requested
      if (data.notifyUsers) {
        notificationsSent = await this.notifyAffectedUsers(
          Array.from(uniqueUsers),
          data.format,
          data.effectiveDate,
          affectedDeckData
        );
      }

      await job.updateProgress(100);

      return {
        format: data.format,
        effectiveDate: data.effectiveDate,
        affectedDecks,
        affectedUsers,
        migrationsGenerated,
        notificationsSent,
        errors,
      };

    } catch (error) {
      throw new Error(`Failed to process format rotation: ${error}`);
    }
  }

  private async findAffectedDecks(formatId: string, rotatedSets: string[]) {
    // Get all cards from rotated sets
    const rotatedCards = await prisma.card.findMany({
      where: {
        setCode: { in: rotatedSets },
      },
      select: { id: true },
    });

    const rotatedCardIds = new Set(rotatedCards.map(c => c.id));

    // Find decks that contain these cards
    const affectedDecks = await prisma.deck.findMany({
      where: {
        formatId,
        cards: {
          some: {
            cardId: { in: Array.from(rotatedCardIds) },
          },
        },
      },
      include: {
        cards: {
          include: { card: true },
        },
        user: true,
      },
    });

    // Identify illegal cards for each deck
    return affectedDecks.map(deck => ({
      id: deck.id,
      name: deck.name,
      userId: deck.userId,
      username: deck.user.username,
      illegalCards: deck.cards
        .filter(dc => rotatedCardIds.has(dc.cardId))
        .map(dc => ({
          cardId: dc.cardId,
          cardName: dc.card.name,
          quantity: dc.quantity,
        })),
    }));
  }

  private async generateMigration(deck: any) {
    try {
      const illegalCards = deck.illegalCards;
      const suggestedReplacements: any[] = [];
      let estimatedCost = 0;

      for (const illegalCard of illegalCards) {
        // Find similar legal cards
        const suggestions = await recommendationEngine.findSimilarCards(
          illegalCard.cardId,
          {
            formatLegal: true,
            formatId: deck.formatId,
            limit: 3,
          }
        );

        if (suggestions.length > 0) {
          const replacement = suggestions[0];
          const price = await prisma.cardPrice.findFirst({
            where: { cardId: replacement.id },
            orderBy: { updatedAt: 'desc' },
          });

          suggestedReplacements.push({
            originalCardId: illegalCard.cardId,
            originalCardName: illegalCard.cardName,
            replacementCardId: replacement.id,
            replacementCardName: replacement.name,
            quantity: illegalCard.quantity,
            price: price?.marketPrice || 0,
            similarity: replacement.similarity,
          });

          estimatedCost += (price?.marketPrice || 0) * illegalCard.quantity;
        }
      }

      return {
        illegalCards,
        suggestedReplacements,
        estimatedCost,
        autoFixAvailable: suggestedReplacements.length === illegalCards.length,
      };

    } catch (error) {
      console.error('Error generating migration:', error);
      return null;
    }
  }

  private async notifyAffectedUsers(
    userIds: string[],
    format: string,
    effectiveDate: Date,
    affectedDecks: any[]
  ): Promise<number> {
    const notifications = [];

    for (const userId of userIds) {
      const userDecks = affectedDecks.filter(d => d.userId === userId);
      
      notifications.push(
        prisma.notification.create({
          data: {
            userId,
            type: 'FORMAT_ROTATION',
            title: `Format Rotation Alert: ${format}`,
            message: `${userDecks.length} of your decks will be affected by the ${format} format rotation effective ${effectiveDate.toDateString()}.`,
            data: {
              format,
              effectiveDate,
              affectedDeckIds: userDecks.map(d => d.id),
              affectedDeckNames: userDecks.map(d => d.name),
            },
          },
        })
      );
    }

    await Promise.all(notifications);
    return notifications.length;
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`Format rotation job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Format rotation job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Format rotation worker error:', err);
    });
  }

  async shutdown() {
    await this.worker.close();
  }
}

// Create and export processor instance
export const formatRotationProcessor = new FormatRotationProcessor();