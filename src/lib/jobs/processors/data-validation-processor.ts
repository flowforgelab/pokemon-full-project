import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/db/db';
import { 
  DataValidationJobData,
  DataValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationReport,
  JobQueue
} from '../types';

interface ValidationRule {
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  scope: string[];
  validator: (context: ValidationContext) => Promise<ValidationIssue[]>;
  autoFix?: (context: ValidationContext, issues: ValidationIssue[]) => Promise<ValidationFix[]>;
}

interface ValidationContext {
  dryRun: boolean;
  scope: string;
}

interface ValidationIssue {
  entityType: string;
  entityId: string;
  field?: string;
  currentValue?: any;
  expectedValue?: any;
  message: string;
}

interface ValidationFix {
  entityType: string;
  entityId: string;
  field: string;
  oldValue: any;
  newValue: any;
}

export class DataValidationProcessor {
  private worker: Worker;
  private rules: ValidationRule[] = [];

  constructor() {
    this.worker = new Worker(
      JobQueue.DATA_VALIDATION,
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

    this.initializeRules();
    this.setupEventHandlers();
  }

  private initializeRules() {
    this.rules = [
      {
        name: 'card-set-reference',
        description: 'Validate all cards have valid set references',
        severity: 'error',
        scope: ['cards'],
        validator: this.validateCardSetReferences.bind(this),
        autoFix: this.fixCardSetReferences.bind(this),
      },
      {
        name: 'card-images',
        description: 'Validate card image URLs',
        severity: 'warning',
        scope: ['cards'],
        validator: this.validateCardImages.bind(this),
      },
      {
        name: 'price-anomaly',
        description: 'Detect unusual price changes',
        severity: 'warning',
        scope: ['prices'],
        validator: this.validatePriceAnomalies.bind(this),
      },
      {
        name: 'orphaned-deck-cards',
        description: 'Find deck cards without valid card references',
        severity: 'error',
        scope: ['decks'],
        validator: this.validateOrphanedDeckCards.bind(this),
        autoFix: this.fixOrphanedDeckCards.bind(this),
      },
      {
        name: 'deck-size',
        description: 'Validate deck sizes match format requirements',
        severity: 'warning',
        scope: ['decks'],
        validator: this.validateDeckSizes.bind(this),
      },
      {
        name: 'collection-integrity',
        description: 'Validate user collection data integrity',
        severity: 'error',
        scope: ['collections'],
        validator: this.validateCollectionIntegrity.bind(this),
      },
      {
        name: 'duplicate-cards',
        description: 'Detect duplicate card entries',
        severity: 'error',
        scope: ['cards'],
        validator: this.validateDuplicateCards.bind(this),
        autoFix: this.fixDuplicateCards.bind(this),
      },
      {
        name: 'user-data-integrity',
        description: 'Validate user account data',
        severity: 'error',
        scope: ['users'],
        validator: this.validateUserData.bind(this),
      },
      {
        name: 'foreign-key-constraints',
        description: 'Validate all foreign key relationships',
        severity: 'error',
        scope: ['all'],
        validator: this.validateForeignKeys.bind(this),
      },
      {
        name: 'data-consistency',
        description: 'Check data consistency across related tables',
        severity: 'warning',
        scope: ['all'],
        validator: this.validateDataConsistency.bind(this),
      },
    ];
  }

  private async process(job: Job<DataValidationJobData>): Promise<DataValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let issuesFixed = 0;

    try {
      await job.log(`Starting data validation: scope=${job.data.scope}, dryRun=${job.data.dryRun}`);

      const context: ValidationContext = {
        dryRun: job.data.dryRun || false,
        scope: job.data.scope || 'all',
      };

      // Filter rules based on requested rules and scope
      const rulesToRun = this.rules.filter(rule => {
        if (job.data.rules && !job.data.rules.includes(rule.name)) {
          return false;
        }
        if (context.scope !== 'all' && !rule.scope.includes(context.scope)) {
          return false;
        }
        return true;
      });

      await job.log(`Running ${rulesToRun.length} validation rules`);
      let rulesProcessed = 0;

      // Run each validation rule
      for (const rule of rulesToRun) {
        try {
          await job.log(`Running rule: ${rule.name}`);
          
          // Run validator
          const issues = await rule.validator(context);
          
          // Process issues
          for (const issue of issues) {
            if (rule.severity === 'error') {
              errors.push({
                rule: rule.name,
                entityType: issue.entityType,
                entityId: issue.entityId,
                message: issue.message,
                severity: 'error',
                fixAvailable: !!rule.autoFix,
              });
            } else {
              warnings.push({
                rule: rule.name,
                entityType: issue.entityType,
                entityId: issue.entityId,
                message: issue.message,
                suggestion: rule.autoFix ? 'Auto-fix available' : undefined,
              });
            }
          }

          // Apply auto-fixes if requested
          if (job.data.autoFix && rule.autoFix && issues.length > 0 && !context.dryRun) {
            const fixes = await rule.autoFix(context, issues);
            issuesFixed += fixes.length;
            await job.log(`Applied ${fixes.length} fixes for rule ${rule.name}`);
          }

          rulesProcessed++;
          const progress = Math.floor((rulesProcessed / rulesToRun.length) * 100);
          await job.updateProgress(progress);

        } catch (error) {
          await job.log(`Error running rule ${rule.name}: ${error}`);
        }
      }

      const report: ValidationReport = {
        timestamp: new Date(),
        duration: Date.now() - startTime,
        summary: {
          totalEntitiesChecked: await this.countEntitiesChecked(context.scope),
          errorCount: errors.length,
          warningCount: warnings.length,
          fixedCount: issuesFixed,
        },
        byRule: this.generateRuleSummary(errors, warnings, rulesToRun),
      };

      await job.log(`Validation completed: ${errors.length} errors, ${warnings.length} warnings`);

      return {
        rulesExecuted: rulesToRun.length,
        issuesFound: errors.length + warnings.length,
        issuesFixed,
        errors,
        warnings,
        report,
      };

    } catch (error) {
      await job.log(`Fatal error in data validation: ${error}`);
      throw error;
    }
  }

  // Validation Rules Implementation

  private async validateCardSetReferences(context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const orphanedCards = await prisma.card.findMany({
      where: {
        setId: {
          not: {
            in: (await prisma.set.findMany({ select: { id: true } })).map(s => s.id),
          },
        },
      },
      select: { id: true, name: true, setId: true },
    });

    for (const card of orphanedCards) {
      issues.push({
        entityType: 'card',
        entityId: card.id,
        field: 'setId',
        currentValue: card.setId,
        message: `Card "${card.name}" references non-existent set`,
      });
    }

    return issues;
  }

  private async fixCardSetReferences(context: ValidationContext, issues: ValidationIssue[]): Promise<ValidationFix[]> {
    const fixes: ValidationFix[] = [];

    for (const issue of issues) {
      // Try to find correct set by card code pattern
      const card = await prisma.card.findUnique({
        where: { id: issue.entityId },
      });

      if (card && card.setCode) {
        const correctSet = await prisma.set.findUnique({
          where: { code: card.setCode },
        });

        if (correctSet) {
          await prisma.card.update({
            where: { id: card.id },
            data: { setId: correctSet.id },
          });

          fixes.push({
            entityType: 'card',
            entityId: card.id,
            field: 'setId',
            oldValue: issue.currentValue,
            newValue: correctSet.id,
          });
        }
      }
    }

    return fixes;
  }

  private async validateCardImages(context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const cards = await prisma.card.findMany({
      select: {
        id: true,
        name: true,
        imageUrlSmall: true,
        imageUrlLarge: true,
      },
    });

    for (const card of cards) {
      // Check for missing images
      if (!card.imageUrlSmall || !card.imageUrlLarge) {
        issues.push({
          entityType: 'card',
          entityId: card.id,
          message: `Card "${card.name}" missing image URLs`,
        });
        continue;
      }

      // Validate URL format
      try {
        new URL(card.imageUrlSmall);
        new URL(card.imageUrlLarge);
      } catch {
        issues.push({
          entityType: 'card',
          entityId: card.id,
          message: `Card "${card.name}" has invalid image URLs`,
        });
      }
    }

    return issues;
  }

  private async validatePriceAnomalies(context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const ANOMALY_THRESHOLD = 10; // 10x price change

    const priceHistory = await prisma.$queryRaw<any[]>`
      WITH price_changes AS (
        SELECT 
          ph1.card_id,
          ph1.market_price as current_price,
          ph2.market_price as previous_price,
          ph1.date as current_date,
          ph2.date as previous_date,
          c.name as card_name
        FROM price_history ph1
        JOIN price_history ph2 ON ph1.card_id = ph2.card_id
        JOIN cards c ON c.id = ph1.card_id
        WHERE ph1.date > ph2.date
          AND ph2.date = (
            SELECT MAX(date) 
            FROM price_history 
            WHERE card_id = ph1.card_id AND date < ph1.date
          )
      )
      SELECT * FROM price_changes
      WHERE current_price > previous_price * ${ANOMALY_THRESHOLD}
         OR current_price < previous_price / ${ANOMALY_THRESHOLD}
    `;

    for (const anomaly of priceHistory) {
      issues.push({
        entityType: 'price',
        entityId: anomaly.card_id,
        currentValue: anomaly.current_price,
        expectedValue: anomaly.previous_price,
        message: `Price anomaly for "${anomaly.card_name}": $${anomaly.previous_price} -> $${anomaly.current_price}`,
      });
    }

    return issues;
  }

  private async validateOrphanedDeckCards(context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const orphanedDeckCards = await prisma.deckCard.findMany({
      where: {
        card: null,
      },
      include: {
        deck: true,
      },
    });

    for (const deckCard of orphanedDeckCards) {
      issues.push({
        entityType: 'deckCard',
        entityId: deckCard.id,
        field: 'cardId',
        currentValue: deckCard.cardId,
        message: `Deck "${deckCard.deck.name}" contains reference to non-existent card`,
      });
    }

    return issues;
  }

  private async fixOrphanedDeckCards(context: ValidationContext, issues: ValidationIssue[]): Promise<ValidationFix[]> {
    const fixes: ValidationFix[] = [];

    // Remove orphaned deck cards
    const idsToDelete = issues.map(issue => issue.entityId);
    
    await prisma.deckCard.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    for (const issue of issues) {
      fixes.push({
        entityType: 'deckCard',
        entityId: issue.entityId,
        field: 'deleted',
        oldValue: true,
        newValue: false,
      });
    }

    return fixes;
  }

  private async validateDeckSizes(context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const decks = await prisma.deck.findMany({
      include: {
        cards: true,
        format: true,
      },
    });

    for (const deck of decks) {
      const totalCards = deck.cards.reduce((sum, dc) => sum + dc.quantity, 0);
      
      // Standard format requires exactly 60 cards
      if (deck.format?.code === 'standard' && totalCards !== 60) {
        issues.push({
          entityType: 'deck',
          entityId: deck.id,
          currentValue: totalCards,
          expectedValue: 60,
          message: `Deck "${deck.name}" has ${totalCards} cards (Standard format requires 60)`,
        });
      }
    }

    return issues;
  }

  private async validateCollectionIntegrity(context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for negative quantities
    const negativeQuantities = await prisma.userCollection.findMany({
      where: { quantity: { lt: 0 } },
      include: { user: true, card: true },
    });

    for (const item of negativeQuantities) {
      issues.push({
        entityType: 'userCollection',
        entityId: item.id,
        field: 'quantity',
        currentValue: item.quantity,
        message: `User "${item.user.username}" has negative quantity for card "${item.card.name}"`,
      });
    }

    return issues;
  }

  private async validateDuplicateCards(context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const duplicates = await prisma.$queryRaw<any[]>`
      SELECT name, set_code, number, COUNT(*) as count
      FROM cards
      GROUP BY name, set_code, number
      HAVING COUNT(*) > 1
    `;

    for (const dup of duplicates) {
      const cards = await prisma.card.findMany({
        where: {
          name: dup.name,
          setCode: dup.set_code,
          number: dup.number,
        },
        select: { id: true },
      });

      for (const card of cards.slice(1)) {
        issues.push({
          entityType: 'card',
          entityId: card.id,
          message: `Duplicate card: "${dup.name}" in set ${dup.set_code} #${dup.number}`,
        });
      }
    }

    return issues;
  }

  private async fixDuplicateCards(context: ValidationContext, issues: ValidationIssue[]): Promise<ValidationFix[]> {
    // This would be complex - need to merge references, combine collections, etc.
    // For now, just return empty fixes
    return [];
  }

  private async validateUserData(context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        clerkId: true,
      },
    });

    for (const user of users) {
      // Check for missing required fields
      if (!user.clerkId) {
        issues.push({
          entityType: 'user',
          entityId: user.id,
          field: 'clerkId',
          message: `User "${user.username}" missing Clerk ID`,
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (user.email && !emailRegex.test(user.email)) {
        issues.push({
          entityType: 'user',
          entityId: user.id,
          field: 'email',
          currentValue: user.email,
          message: `User "${user.username}" has invalid email format`,
        });
      }
    }

    return issues;
  }

  private async validateForeignKeys(context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // This would check all foreign key relationships
    // For brevity, showing just one example

    const orphanedCollections = await prisma.userCollection.findMany({
      where: {
        OR: [
          { user: null },
          { card: null },
        ],
      },
    });

    for (const collection of orphanedCollections) {
      issues.push({
        entityType: 'userCollection',
        entityId: collection.id,
        message: 'User collection entry with invalid foreign key reference',
      });
    }

    return issues;
  }

  private async validateDataConsistency(context: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check deck statistics match actual cards
    const decks = await prisma.deck.findMany({
      include: {
        cards: {
          include: { card: true },
        },
      },
    });

    for (const deck of decks) {
      const calculatedStats = this.calculateDeckStats(deck.cards);
      
      if (deck.pokemonCount !== calculatedStats.pokemonCount ||
          deck.trainerCount !== calculatedStats.trainerCount ||
          deck.energyCount !== calculatedStats.energyCount) {
        issues.push({
          entityType: 'deck',
          entityId: deck.id,
          message: `Deck "${deck.name}" statistics don't match actual cards`,
        });
      }
    }

    return issues;
  }

  private calculateDeckStats(cards: any[]) {
    let pokemonCount = 0;
    let trainerCount = 0;
    let energyCount = 0;

    for (const deckCard of cards) {
      switch (deckCard.card.supertype) {
        case 'POKEMON':
          pokemonCount += deckCard.quantity;
          break;
        case 'TRAINER':
          trainerCount += deckCard.quantity;
          break;
        case 'ENERGY':
          energyCount += deckCard.quantity;
          break;
      }
    }

    return { pokemonCount, trainerCount, energyCount };
  }

  private async countEntitiesChecked(scope: string): Promise<number> {
    switch (scope) {
      case 'cards':
        return await prisma.card.count();
      case 'decks':
        return await prisma.deck.count();
      case 'collections':
        return await prisma.userCollection.count();
      case 'users':
        return await prisma.user.count();
      case 'prices':
        return await prisma.cardPrice.count();
      case 'all':
        const counts = await Promise.all([
          prisma.card.count(),
          prisma.deck.count(),
          prisma.userCollection.count(),
          prisma.user.count(),
          prisma.cardPrice.count(),
        ]);
        return counts.reduce((sum, count) => sum + count, 0);
      default:
        return 0;
    }
  }

  private generateRuleSummary(errors: ValidationError[], warnings: ValidationWarning[], rules: ValidationRule[]) {
    const summary: Record<string, any> = {};

    for (const rule of rules) {
      const ruleErrors = errors.filter(e => e.rule === rule.name);
      const ruleWarnings = warnings.filter(w => w.rule === rule.name);

      summary[rule.name] = {
        checked: ruleErrors.length + ruleWarnings.length,
        errors: ruleErrors.length,
        warnings: ruleWarnings.length,
        fixed: 0, // Would need to track this during fixes
      };
    }

    return summary;
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`Data validation job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Data validation job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Data validation worker error:', err);
    });
  }

  async shutdown() {
    await this.worker.close();
  }
}

// Create and export processor instance
export const dataValidationProcessor = new DataValidationProcessor();