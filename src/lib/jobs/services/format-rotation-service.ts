import { JobQueue, FormatRotationJobData, JobPriority } from '../types';
import { QueueManager } from '../queues';
import { prisma } from '@/lib/db/db';
import { recommendationEngine } from '@/lib/recommendations/recommendation-engine';

export interface FormatRotation {
  id: string;
  format: 'standard' | 'expanded';
  effectiveDate: Date;
  rotatedSets: string[];
  newLegalSets: string[];
  affectedDecks: number;
  affectedUsers: number;
  migrationOptions: RotationMigration[];
}

export interface RotationMigration {
  deckId: string;
  deckName: string;
  illegalCards: Array<{
    cardId: string;
    cardName: string;
    quantity: number;
    reason: string;
  }>;
  autoFixAvailable: boolean;
  estimatedCost: number;
  suggestedReplacements?: Array<{
    originalCardId: string;
    replacementCardId: string;
    replacementCardName: string;
    price: number;
  }>;
}

export class FormatRotationService {
  /**
   * Detect upcoming format rotations
   */
  async detectUpcomingRotations(): Promise<FormatRotation[]> {
    const rotations: FormatRotation[] = [];

    // Check Standard format (rotates yearly, usually in September)
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // If it's July-August, check for September rotation
    if (currentMonth >= 6 && currentMonth <= 7) {
      const rotationDate = new Date(currentYear, 8, 1); // September 1st
      
      // Get sets that would rotate (typically 4 oldest sets)
      const standardFormat = await prisma.format.findUnique({
        where: { code: 'standard' },
        include: {
          legalSets: {
            orderBy: { releaseDate: 'asc' },
            take: 4,
          },
        },
      });

      if (standardFormat && standardFormat.legalSets.length >= 4) {
        const rotatedSets = standardFormat.legalSets.map(s => s.code);
        
        // Count affected decks
        const affectedDecks = await this.countAffectedDecks('standard', rotatedSets);
        
        rotations.push({
          id: `standard-${currentYear}`,
          format: 'standard',
          effectiveDate: rotationDate,
          rotatedSets,
          newLegalSets: [],
          affectedDecks: affectedDecks.deckCount,
          affectedUsers: affectedDecks.userCount,
          migrationOptions: [],
        });
      }
    }

    return rotations;
  }

  /**
   * Process a format rotation
   */
  async processRotation(rotationId: string): Promise<string> {
    const rotation = await this.getRotationDetails(rotationId);
    
    if (!rotation) {
      throw new Error(`Rotation ${rotationId} not found`);
    }

    const jobData: FormatRotationJobData = {
      format: rotation.format,
      effectiveDate: rotation.effectiveDate,
      rotatedSets: rotation.rotatedSets,
      newLegalSets: rotation.newLegalSets,
      notifyUsers: true,
      generateMigrations: true,
    };

    const job = await QueueManager.addJob(
      JobQueue.FORMAT_ROTATION,
      `rotation-${rotationId}`,
      jobData,
      {
        priority: JobPriority.HIGH,
        scheduledBy: 'admin',
        reason: 'Process format rotation',
      }
    );

    return job.id!;
  }

  /**
   * Generate migration suggestions for a deck
   */
  async generateMigrationSuggestions(deckId: string): Promise<RotationMigration> {
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          include: { card: true },
        },
        format: {
          include: { legalSets: true },
        },
      },
    });

    if (!deck) {
      throw new Error(`Deck ${deckId} not found`);
    }

    // Get legal set IDs
    const legalSetIds = new Set(deck.format?.legalSets.map(s => s.id) || []);

    // Find illegal cards
    const illegalCards = [];
    const suggestedReplacements = [];
    let estimatedCost = 0;

    for (const deckCard of deck.cards) {
      const cardSet = await prisma.set.findUnique({
        where: { id: deckCard.card.setId },
      });

      if (cardSet && !legalSetIds.has(cardSet.id)) {
        illegalCards.push({
          cardId: deckCard.card.id,
          cardName: deckCard.card.name,
          quantity: deckCard.quantity,
          reason: `Set "${cardSet.name}" is not legal in ${deck.format?.name}`,
        });

        // Find replacement suggestions
        const suggestions = await recommendationEngine.findSimilarCards(
          deckCard.card.id,
          {
            formatLegal: true,
            formatId: deck.formatId!,
            limit: 1,
          }
        );

        if (suggestions.length > 0) {
          const replacement = suggestions[0];
          const price = await prisma.cardPrice.findFirst({
            where: { cardId: replacement.id },
            orderBy: { updatedAt: 'desc' },
          });

          suggestedReplacements.push({
            originalCardId: deckCard.card.id,
            replacementCardId: replacement.id,
            replacementCardName: replacement.name,
            price: price?.marketPrice || 0,
          });

          estimatedCost += (price?.marketPrice || 0) * deckCard.quantity;
        }
      }
    }

    return {
      deckId: deck.id,
      deckName: deck.name,
      illegalCards,
      autoFixAvailable: suggestedReplacements.length === illegalCards.length,
      estimatedCost,
      suggestedReplacements,
    };
  }

  /**
   * Apply migration suggestions to a deck
   */
  async applyMigration(deckId: string, migration: RotationMigration): Promise<void> {
    if (!migration.autoFixAvailable || !migration.suggestedReplacements) {
      throw new Error('Auto-fix not available for this migration');
    }

    // Create a map of replacements
    const replacementMap = new Map(
      migration.suggestedReplacements.map(r => [r.originalCardId, r.replacementCardId])
    );

    // Update deck cards
    const deckCards = await prisma.deckCard.findMany({
      where: { deckId },
    });

    for (const deckCard of deckCards) {
      const replacementId = replacementMap.get(deckCard.cardId);
      
      if (replacementId) {
        // Remove old card
        await prisma.deckCard.delete({
          where: { id: deckCard.id },
        });

        // Add replacement card
        await prisma.deckCard.create({
          data: {
            deckId,
            cardId: replacementId,
            quantity: deckCard.quantity,
          },
        });
      }
    }

    // Update deck legality
    await prisma.deck.update({
      where: { id: deckId },
      data: {
        isLegal: true,
        rotationNotes: null,
        updatedAt: new Date(),
      },
    });

    // Create migration record
    await prisma.deckMigration.create({
      data: {
        deckId,
        formatRotationDate: new Date(),
        appliedAt: new Date(),
        illegalCards: migration.illegalCards,
        suggestedReplacements: migration.suggestedReplacements,
        estimatedCost: migration.estimatedCost,
        autoFixAvailable: true,
        wasApplied: true,
      },
    });
  }

  /**
   * Notify affected users about rotation
   */
  async notifyAffectedUsers(rotationId: string): Promise<number> {
    const rotation = await this.getRotationDetails(rotationId);
    
    if (!rotation) {
      throw new Error(`Rotation ${rotationId} not found`);
    }

    const affectedUsers = await this.getAffectedUsers(rotation.format, rotation.rotatedSets);
    
    const notifications = await Promise.all(
      affectedUsers.map(user =>
        prisma.notification.create({
          data: {
            userId: user.id,
            type: 'FORMAT_ROTATION',
            title: `Upcoming ${rotation.format} Format Rotation`,
            message: `The ${rotation.format} format will rotate on ${rotation.effectiveDate.toDateString()}. ${user.affectedDeckCount} of your decks will be affected.`,
            data: {
              rotationId,
              format: rotation.format,
              effectiveDate: rotation.effectiveDate,
              affectedDecks: user.affectedDeckIds,
            },
          },
        })
      )
    );

    return notifications.length;
  }

  /**
   * Update deck legality after rotation
   */
  async updateDeckLegality(rotationId: string): Promise<void> {
    const rotation = await this.getRotationDetails(rotationId);
    
    if (!rotation) {
      throw new Error(`Rotation ${rotationId} not found`);
    }

    // Get all cards from rotated sets
    const rotatedCards = await prisma.card.findMany({
      where: {
        setCode: { in: rotation.rotatedSets },
      },
      select: { id: true },
    });

    const rotatedCardIds = rotatedCards.map(c => c.id);

    // Update all decks containing rotated cards
    await prisma.deck.updateMany({
      where: {
        format: { code: rotation.format },
        cards: {
          some: {
            cardId: { in: rotatedCardIds },
          },
        },
      },
      data: {
        isLegal: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get rotation details
   */
  private async getRotationDetails(rotationId: string): Promise<FormatRotation | null> {
    // In a real implementation, this would fetch from a database or API
    // For now, parse the rotation ID to reconstruct details
    const [format, year] = rotationId.split('-');
    
    if (format === 'standard') {
      const standardFormat = await prisma.format.findUnique({
        where: { code: 'standard' },
        include: {
          legalSets: {
            orderBy: { releaseDate: 'asc' },
            take: 4,
          },
        },
      });

      if (standardFormat) {
        const rotatedSets = standardFormat.legalSets.map(s => s.code);
        const affectedDecks = await this.countAffectedDecks('standard', rotatedSets);
        
        return {
          id: rotationId,
          format: 'standard',
          effectiveDate: new Date(parseInt(year), 8, 1),
          rotatedSets,
          newLegalSets: [],
          affectedDecks: affectedDecks.deckCount,
          affectedUsers: affectedDecks.userCount,
          migrationOptions: [],
        };
      }
    }

    return null;
  }

  /**
   * Count affected decks and users
   */
  private async countAffectedDecks(format: string, rotatedSets: string[]) {
    const rotatedCards = await prisma.card.findMany({
      where: {
        setCode: { in: rotatedSets },
      },
      select: { id: true },
    });

    const rotatedCardIds = rotatedCards.map(c => c.id);

    const affectedDecks = await prisma.deck.findMany({
      where: {
        format: { code: format },
        cards: {
          some: {
            cardId: { in: rotatedCardIds },
          },
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    const uniqueUsers = new Set(affectedDecks.map(d => d.userId));

    return {
      deckCount: affectedDecks.length,
      userCount: uniqueUsers.size,
    };
  }

  /**
   * Get affected users with deck details
   */
  private async getAffectedUsers(format: string, rotatedSets: string[]) {
    const rotatedCards = await prisma.card.findMany({
      where: {
        setCode: { in: rotatedSets },
      },
      select: { id: true },
    });

    const rotatedCardIds = rotatedCards.map(c => c.id);

    const affectedDecks = await prisma.deck.findMany({
      where: {
        format: { code: format },
        cards: {
          some: {
            cardId: { in: rotatedCardIds },
          },
        },
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    // Group by user
    const userMap = new Map<string, any>();
    
    for (const deck of affectedDecks) {
      if (!userMap.has(deck.userId)) {
        userMap.set(deck.userId, {
          id: deck.userId,
          username: deck.user.username,
          email: deck.user.email,
          affectedDeckIds: [],
          affectedDeckCount: 0,
        });
      }
      
      const user = userMap.get(deck.userId)!;
      user.affectedDeckIds.push(deck.id);
      user.affectedDeckCount++;
    }

    return Array.from(userMap.values());
  }
}

// Export singleton instance
export const formatRotationService = new FormatRotationService();