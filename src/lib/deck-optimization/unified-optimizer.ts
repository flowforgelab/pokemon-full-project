import type { Card, Deck, DeckCard, UserCollection } from '@prisma/client';
import type { DeckAnalysisResult, AnalysisWarning, Recommendation } from '@/lib/analysis/types';
import { DeckAnalyzer } from '@/lib/analysis/deck-analyzer';
import { BudgetOptimizer } from '@/lib/budget/budget-optimizer';
import { logger } from '@/lib/logger';
import { prisma } from '@/server/db/prisma';

export interface UnifiedOptimizationRequest {
  deck: Deck & { cards: (DeckCard & { card: Card & { prices?: any[] } })[] };
  userId: string;
  options: {
    budget?: number;
    useCollection?: boolean;
    priorityMode?: 'power' | 'consistency' | 'speed' | 'budget';
    maxChanges?: number;
    maintainArchetype?: boolean;
    targetScore?: number;
  };
}

export interface UnifiedOptimizationResult {
  analysis: DeckAnalysisResult;
  optimizations: OptimizationRecommendation[];
  upgradePath: UpgradeTier[];
  estimatedScore: number;
  totalCost: number;
  collectionValue: number;
  missingCards: MissingCard[];
  summary: OptimizationSummary;
}

export interface OptimizationRecommendation {
  id: string;
  type: 'add' | 'remove' | 'replace' | 'adjust';
  priority: 'critical' | 'high' | 'medium' | 'low';
  card?: string;
  targetCard?: string;
  quantity?: number;
  oldQuantity?: number;
  newQuantity?: number;
  reason: string;
  impact: string;
  cost?: number;
  inCollection?: boolean;
  scoreImprovement?: number;
  tags: string[];
}

export interface UpgradeTier {
  tier: number;
  name: string;
  budget: number;
  cards: {
    name: string;
    quantity: number;
    price: number;
    impact: string;
    inCollection: boolean;
  }[];
  estimatedScoreImprovement: number;
  description: string;
}

export interface MissingCard {
  cardId: string;
  cardName: string;
  quantity: number;
  price: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  alternatives: CardAlternative[];
}

export interface CardAlternative {
  cardId: string;
  cardName: string;
  price: number;
  inCollection: boolean;
  performanceRatio: number;
  reason: string;
}

export interface OptimizationSummary {
  totalRecommendations: number;
  criticalIssues: number;
  potentialScoreImprovement: number;
  budgetRequired: number;
  cardsFromCollection: number;
  cardsNeeded: number;
  estimatedPlacements: string;
}

export class UnifiedOptimizer {
  private analyzer: DeckAnalyzer;
  private budgetOptimizer: BudgetOptimizer;

  constructor() {
    this.analyzer = new DeckAnalyzer();
    this.budgetOptimizer = new BudgetOptimizer();
  }

  /**
   * Perform unified analysis and optimization
   */
  async optimizeDeck(request: UnifiedOptimizationRequest): Promise<UnifiedOptimizationResult> {
    const { deck, userId, options } = request;

    logger.info('Starting unified deck optimization', {
      deckId: deck.id,
      userId,
      options,
    });

    // Step 1: Analyze the current deck
    const analysis = await this.analyzer.analyzeDeck(deck);

    // Step 2: Get user's collection if requested
    let userCollection: (UserCollection & { card: Card & { prices?: any[] } })[] = [];
    if (options.useCollection) {
      userCollection = await this.getUserCollection(userId);
    }

    // Step 3: Generate optimization recommendations
    const optimizations = await this.generateOptimizations(deck, analysis, userCollection, options);

    // Step 4: Create upgrade path
    const upgradePath = await this.createUpgradePath(deck, optimizations, userCollection, options);

    // Step 5: Calculate missing cards and costs
    const missingCards = await this.calculateMissingCards(optimizations, userCollection);

    // Step 6: Estimate improvements
    const estimatedScore = this.estimateScoreImprovement(analysis, optimizations);

    // Step 7: Calculate costs
    const { totalCost, collectionValue } = await this.calculateCosts(deck, optimizations, userCollection);

    // Step 8: Generate summary
    const summary = this.generateSummary(analysis, optimizations, missingCards, estimatedScore);

    return {
      analysis,
      optimizations,
      upgradePath,
      estimatedScore,
      totalCost,
      collectionValue,
      missingCards,
      summary,
    };
  }

  /**
   * Generate optimization recommendations based on analysis
   */
  private async generateOptimizations(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    analysis: DeckAnalysisResult,
    userCollection: (UserCollection & { card: Card })[], 
    options: UnifiedOptimizationRequest['options']
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    let idCounter = 0;

    // Fix critical errors first
    if (analysis.warnings) {
      for (const warning of analysis.warnings.filter(w => w.severity === 'error')) {
        recommendations.push(...this.createRecommendationsFromWarning(warning, deck, userCollection, ++idCounter));
      }
    }

    // Add high-priority recommendations from analysis
    if (analysis.recommendations) {
      for (const rec of analysis.recommendations.filter(r => r.priority === 'high')) {
        recommendations.push(this.convertAnalysisRecommendation(rec, userCollection, ++idCounter));
      }
    }

    // Budget-specific optimizations
    if (options.budget) {
      const budgetRecs = await this.generateBudgetOptimizations(deck, analysis, options.budget, userCollection);
      recommendations.push(...budgetRecs.map(r => ({ ...r, id: String(++idCounter) })));
    }

    // Collection-aware optimizations
    if (options.useCollection) {
      const collectionRecs = this.generateCollectionOptimizations(deck, analysis, userCollection);
      recommendations.push(...collectionRecs.map(r => ({ ...r, id: String(++idCounter) })));
    }

    // Mode-specific optimizations
    if (options.priorityMode) {
      const modeRecs = this.generateModeOptimizations(deck, analysis, options.priorityMode);
      recommendations.push(...modeRecs.map(r => ({ ...r, id: String(++idCounter) })));
    }

    // Sort by priority and score improvement
    recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return (b.scoreImprovement || 0) - (a.scoreImprovement || 0);
    });

    // Limit to maxChanges if specified
    if (options.maxChanges) {
      return recommendations.slice(0, options.maxChanges);
    }

    return recommendations;
  }

  /**
   * Create recommendations from analysis warnings
   */
  private createRecommendationsFromWarning(
    warning: AnalysisWarning,
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    userCollection: (UserCollection & { card: Card })[],
    idStart: number
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    switch (warning.category) {
      case 'Deck Size':
        const totalCards = deck.cards.reduce((sum, dc) => sum + dc.quantity, 0);
        if (totalCards < 60) {
          recommendations.push({
            id: String(idStart),
            type: 'add',
            priority: 'critical',
            card: 'Professor\'s Research',
            quantity: Math.min(4, 60 - totalCards),
            reason: 'Deck must have exactly 60 cards',
            impact: 'Makes deck tournament legal',
            scoreImprovement: 20,
            tags: ['legality', 'consistency'],
            cost: 2.50 * Math.min(4, 60 - totalCards),
            inCollection: userCollection.some(uc => uc.card.name === 'Professor\'s Research'),
          });
        }
        break;

      case 'Basic Pokemon':
        if (!deck.cards.some(dc => dc.card.subtypes?.includes('Basic'))) {
          recommendations.push({
            id: String(idStart),
            type: 'add',
            priority: 'critical',
            card: 'Snorlax',
            quantity: 4,
            reason: 'Deck must contain at least one Basic Pokemon',
            impact: 'Prevents automatic game loss',
            scoreImprovement: 30,
            tags: ['legality', 'consistency'],
            cost: 1.00 * 4,
            inCollection: userCollection.some(uc => uc.card.name === 'Snorlax'),
          });
        }
        break;

      case 'Energy Balance':
        const energyCount = deck.cards
          .filter(dc => dc.card.supertype === 'ENERGY')
          .reduce((sum, dc) => sum + dc.quantity, 0);
        
        if (energyCount < 8) {
          recommendations.push({
            id: String(idStart),
            type: 'add',
            priority: 'high',
            card: 'Basic Fire Energy',
            quantity: 8 - energyCount,
            reason: 'Insufficient energy cards',
            impact: 'Improves attack consistency',
            scoreImprovement: 15,
            tags: ['consistency', 'energy'],
            cost: 0,
            inCollection: true,
          });
        }
        break;
    }

    return recommendations;
  }

  /**
   * Convert analysis recommendation to optimization recommendation
   */
  private convertAnalysisRecommendation(
    rec: Recommendation,
    userCollection: (UserCollection & { card: Card })[],
    id: number
  ): OptimizationRecommendation {
    const inCollection = rec.card ? 
      userCollection.some(uc => uc.card.name === rec.card) : false;

    return {
      id: String(id),
      type: rec.type as any,
      priority: rec.priority as any,
      card: rec.card,
      targetCard: rec.targetCard,
      quantity: rec.quantity,
      reason: rec.reason,
      impact: rec.impact || 'Improves deck performance',
      scoreImprovement: this.estimateRecommendationScore(rec),
      tags: this.generateTags(rec),
      cost: rec.cost || 0,
      inCollection,
    };
  }

  /**
   * Generate budget-aware optimizations
   */
  private async generateBudgetOptimizations(
    deck: Deck & { cards: (DeckCard & { card: Card & { prices?: any[] } })[] },
    analysis: DeckAnalysisResult,
    budget: number,
    userCollection: (UserCollection & { card: Card })[]
  ): Promise<Partial<OptimizationRecommendation>[]> {
    const optimizations: Partial<OptimizationRecommendation>[] = [];

    // Use budget optimizer for expensive cards
    const budgetResult = await this.budgetOptimizer.optimizeDeck({
      deck,
      budget,
      priorityMode: 'consistency',
      ownedCards: userCollection.map(uc => uc.cardId),
      maxChanges: 10,
      originalAnalysis: analysis,
    });

    // Convert budget changes to optimization recommendations
    for (const change of budgetResult.changes) {
      optimizations.push({
        type: change.action,
        priority: 'medium',
        card: change.newCard,
        targetCard: change.oldCard,
        quantity: change.quantity,
        reason: `Budget optimization: ${change.reason}`,
        impact: `Saves $${change.savings?.toFixed(2)} while maintaining performance`,
        scoreImprovement: -5, // Small penalty for budget replacements
        tags: ['budget', 'value'],
        cost: -change.savings,
        inCollection: userCollection.some(uc => uc.card.name === change.newCard),
      });
    }

    return optimizations;
  }

  /**
   * Generate collection-aware optimizations
   */
  private generateCollectionOptimizations(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    analysis: DeckAnalysisResult,
    userCollection: (UserCollection & { card: Card })[]
  ): Partial<OptimizationRecommendation>[] {
    const optimizations: Partial<OptimizationRecommendation>[] = [];

    // Find cards in collection that could improve the deck
    const collectionMap = new Map(userCollection.map(uc => [uc.card.name, uc]));

    // Check for better trainers in collection
    const trainerUpgrades = [
      { from: 'Hop', to: 'Professor\'s Research', score: 10 },
      { from: 'Pokémon Catcher', to: 'Boss\'s Orders', score: 15 },
      { from: 'Poké Ball', to: 'Quick Ball', score: 12 },
      { from: 'Energy Search', to: 'Energy Retrieval', score: 5 },
    ];

    for (const upgrade of trainerUpgrades) {
      const hasOld = deck.cards.some(dc => dc.card.name === upgrade.from);
      const hasNew = collectionMap.has(upgrade.to);
      
      if (hasOld && hasNew && !deck.cards.some(dc => dc.card.name === upgrade.to)) {
        optimizations.push({
          type: 'replace',
          priority: 'medium',
          card: upgrade.to,
          targetCard: upgrade.from,
          quantity: deck.cards.find(dc => dc.card.name === upgrade.from)?.quantity || 1,
          reason: `You own ${upgrade.to} which is strictly better`,
          impact: 'Free upgrade using your collection',
          scoreImprovement: upgrade.score,
          tags: ['collection', 'upgrade'],
          cost: 0,
          inCollection: true,
        });
      }
    }

    return optimizations;
  }

  /**
   * Generate mode-specific optimizations
   */
  private generateModeOptimizations(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    analysis: DeckAnalysisResult,
    mode: 'power' | 'consistency' | 'speed' | 'budget'
  ): Partial<OptimizationRecommendation>[] {
    const optimizations: Partial<OptimizationRecommendation>[] = [];

    switch (mode) {
      case 'consistency':
        // Add draw support
        if (!deck.cards.some(dc => dc.card.name === 'Professor\'s Research')) {
          optimizations.push({
            type: 'add',
            priority: 'high',
            card: 'Professor\'s Research',
            quantity: 4,
            reason: 'Essential draw support for consistency',
            impact: 'Significantly improves hand quality',
            scoreImprovement: 15,
            tags: ['consistency', 'draw'],
          });
        }

        // Add search cards
        if (!deck.cards.some(dc => dc.card.name === 'Quick Ball')) {
          optimizations.push({
            type: 'add',
            priority: 'high',
            card: 'Quick Ball',
            quantity: 4,
            reason: 'Essential Pokemon search',
            impact: 'Reduces setup time and improves consistency',
            scoreImprovement: 12,
            tags: ['consistency', 'search'],
          });
        }
        break;

      case 'speed':
        // Add energy acceleration
        if (!deck.cards.some(dc => dc.card.name === 'Twin Energy')) {
          optimizations.push({
            type: 'add',
            priority: 'medium',
            card: 'Twin Energy',
            quantity: 2,
            reason: 'Accelerates energy attachment',
            impact: 'Reduces setup time by 1-2 turns',
            scoreImprovement: 10,
            tags: ['speed', 'energy'],
          });
        }
        break;

      case 'power':
        // Add damage modifiers
        if (!deck.cards.some(dc => dc.card.name === 'Choice Belt')) {
          optimizations.push({
            type: 'add',
            priority: 'medium',
            card: 'Choice Belt',
            quantity: 2,
            reason: 'Increases damage output',
            impact: '+30 damage to V Pokemon',
            scoreImprovement: 8,
            tags: ['power', 'damage'],
          });
        }
        break;
    }

    return optimizations;
  }

  /**
   * Create upgrade path tiers
   */
  private async createUpgradePath(
    deck: Deck & { cards: (DeckCard & { card: Card & { prices?: any[] } })[] },
    optimizations: OptimizationRecommendation[],
    userCollection: (UserCollection & { card: Card })[],
    options: UnifiedOptimizationRequest['options']
  ): Promise<UpgradeTier[]> {
    const tiers: UpgradeTier[] = [];

    // Tier 1: Critical fixes (free or very cheap)
    const criticalOptimizations = optimizations.filter(o => o.priority === 'critical');
    if (criticalOptimizations.length > 0) {
      tiers.push({
        tier: 1,
        name: 'Critical Fixes',
        budget: criticalOptimizations.reduce((sum, o) => sum + (o.cost || 0), 0),
        cards: criticalOptimizations.map(o => ({
          name: o.card || o.targetCard || 'Unknown',
          quantity: o.quantity || 1,
          price: o.cost || 0,
          impact: o.impact,
          inCollection: o.inCollection || false,
        })),
        estimatedScoreImprovement: criticalOptimizations.reduce((sum, o) => sum + (o.scoreImprovement || 0), 0),
        description: 'Essential changes to make your deck tournament legal',
      });
    }

    // Tier 2: High-impact improvements
    const highOptimizations = optimizations.filter(o => o.priority === 'high' && (o.cost || 0) <= 20);
    if (highOptimizations.length > 0) {
      tiers.push({
        tier: 2,
        name: 'Core Improvements',
        budget: highOptimizations.reduce((sum, o) => sum + (o.cost || 0), 0),
        cards: highOptimizations.slice(0, 5).map(o => ({
          name: o.card || o.targetCard || 'Unknown',
          quantity: o.quantity || 1,
          price: o.cost || 0,
          impact: o.impact,
          inCollection: o.inCollection || false,
        })),
        estimatedScoreImprovement: highOptimizations.slice(0, 5).reduce((sum, o) => sum + (o.scoreImprovement || 0), 0),
        description: 'High-impact upgrades for competitive play',
      });
    }

    // Tier 3: Premium upgrades
    const premiumOptimizations = optimizations.filter(o => (o.cost || 0) > 20);
    if (premiumOptimizations.length > 0) {
      tiers.push({
        tier: 3,
        name: 'Premium Upgrades',
        budget: premiumOptimizations.reduce((sum, o) => sum + (o.cost || 0), 0),
        cards: premiumOptimizations.slice(0, 3).map(o => ({
          name: o.card || o.targetCard || 'Unknown',
          quantity: o.quantity || 1,
          price: o.cost || 0,
          impact: o.impact,
          inCollection: o.inCollection || false,
        })),
        estimatedScoreImprovement: premiumOptimizations.slice(0, 3).reduce((sum, o) => sum + (o.scoreImprovement || 0), 0),
        description: 'Top-tier upgrades for tournament optimization',
      });
    }

    return tiers;
  }

  /**
   * Calculate missing cards from optimizations
   */
  private async calculateMissingCards(
    optimizations: OptimizationRecommendation[],
    userCollection: (UserCollection & { card: Card & { prices?: any[] } })[]
  ): Promise<MissingCard[]> {
    const missingCards: MissingCard[] = [];
    const collectionMap = new Map(userCollection.map(uc => [uc.card.name, uc]));

    for (const opt of optimizations) {
      if (opt.type === 'add' || opt.type === 'replace') {
        const cardName = opt.card;
        if (cardName && !collectionMap.has(cardName)) {
          // Find alternatives in collection
          const alternatives = await this.findCollectionAlternatives(cardName, userCollection);

          missingCards.push({
            cardId: `missing-${cardName}`,
            cardName,
            quantity: opt.quantity || 1,
            price: opt.cost || 0,
            priority: opt.priority,
            alternatives,
          });
        }
      }
    }

    return missingCards;
  }

  /**
   * Find alternatives in user's collection
   */
  private async findCollectionAlternatives(
    targetCard: string,
    userCollection: (UserCollection & { card: Card & { prices?: any[] } })[]
  ): Promise<CardAlternative[]> {
    const alternatives: CardAlternative[] = [];

    // Simple alternative mapping
    const alternativeMap: Record<string, string[]> = {
      'Professor\'s Research': ['Hop', 'Cynthia', 'N', 'Marnie'],
      'Boss\'s Orders': ['Guzma', 'Lysandre', 'Pokemon Catcher'],
      'Quick Ball': ['Ultra Ball', 'Level Ball', 'Great Ball'],
      'Choice Belt': ['Muscle Band', 'Choice Band'],
    };

    const possibleAlts = alternativeMap[targetCard] || [];
    
    for (const altName of possibleAlts) {
      const inCollection = userCollection.find(uc => uc.card.name === altName);
      if (inCollection) {
        alternatives.push({
          cardId: inCollection.cardId,
          cardName: altName,
          price: 0,
          inCollection: true,
          performanceRatio: 0.7 + Math.random() * 0.2,
          reason: 'Similar effect from your collection',
        });
      }
    }

    return alternatives;
  }

  /**
   * Estimate score improvement from optimizations
   */
  private estimateScoreImprovement(
    analysis: DeckAnalysisResult,
    optimizations: OptimizationRecommendation[]
  ): number {
    const baseScore = analysis.scores.overall;
    const totalImprovement = optimizations.reduce((sum, opt) => sum + (opt.scoreImprovement || 0), 0);
    
    // Apply diminishing returns
    const effectiveImprovement = totalImprovement * (1 - (totalImprovement / 100) * 0.5);
    
    return Math.min(100, Math.round(baseScore + effectiveImprovement));
  }

  /**
   * Calculate total costs
   */
  private async calculateCosts(
    deck: Deck & { cards: (DeckCard & { card: Card & { prices?: any[] } })[] },
    optimizations: OptimizationRecommendation[],
    userCollection: (UserCollection & { card: Card & { prices?: any[] } })[]
  ): Promise<{ totalCost: number; collectionValue: number }> {
    const totalCost = optimizations.reduce((sum, opt) => {
      if (opt.inCollection) return sum;
      return sum + (opt.cost || 0);
    }, 0);

    const collectionValue = userCollection.reduce((sum, uc) => {
      const price = this.getCardPrice(uc.card);
      return sum + (price * uc.quantity);
    }, 0);

    return { totalCost, collectionValue };
  }

  /**
   * Generate optimization summary
   */
  private generateSummary(
    analysis: DeckAnalysisResult,
    optimizations: OptimizationRecommendation[],
    missingCards: MissingCard[],
    estimatedScore: number
  ): OptimizationSummary {
    const criticalIssues = optimizations.filter(o => o.priority === 'critical').length;
    const cardsFromCollection = optimizations.filter(o => o.inCollection).length;
    const budgetRequired = missingCards.reduce((sum, mc) => sum + mc.price, 0);

    let estimatedPlacements = 'Casual play ready';
    if (estimatedScore >= 90) {
      estimatedPlacements = 'Tournament champion potential';
    } else if (estimatedScore >= 80) {
      estimatedPlacements = 'Top 8 tournament potential';
    } else if (estimatedScore >= 70) {
      estimatedPlacements = 'Competitive tournament ready';
    } else if (estimatedScore >= 60) {
      estimatedPlacements = 'Local tournament ready';
    }

    return {
      totalRecommendations: optimizations.length,
      criticalIssues,
      potentialScoreImprovement: estimatedScore - analysis.scores.overall,
      budgetRequired,
      cardsFromCollection,
      cardsNeeded: missingCards.length,
      estimatedPlacements,
    };
  }

  /**
   * Get user's collection
   */
  private async getUserCollection(userId: string): Promise<(UserCollection & { card: Card & { prices?: any[] } })[]> {
    return prisma.userCollection.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            prices: {
              where: { isCurrentPrice: true },
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
  }

  /**
   * Get card price helper
   */
  private getCardPrice(card: Card & { prices?: any[] }): number {
    if (!card.prices || card.prices.length === 0) return 0;
    const usdPrice = card.prices.find(p => p.currency === 'USD');
    return Number(usdPrice?.price || 0);
  }

  /**
   * Estimate recommendation score improvement
   */
  private estimateRecommendationScore(rec: Recommendation): number {
    const baseScores: Record<string, number> = {
      'add draw support': 15,
      'add search': 12,
      'add energy': 10,
      'replace trainer': 8,
      'add pokemon': 10,
      'remove duplicate': 5,
    };

    // Try to match recommendation type
    for (const [key, score] of Object.entries(baseScores)) {
      if (rec.reason.toLowerCase().includes(key)) {
        return score;
      }
    }

    // Default based on priority
    return rec.priority === 'high' ? 10 : rec.priority === 'medium' ? 5 : 2;
  }

  /**
   * Generate tags for recommendation
   */
  private generateTags(rec: Recommendation): string[] {
    const tags: string[] = [];

    // Category tags
    if (rec.category) tags.push(rec.category.toLowerCase());

    // Type tags
    if (rec.reason.toLowerCase().includes('consistency')) tags.push('consistency');
    if (rec.reason.toLowerCase().includes('draw')) tags.push('draw');
    if (rec.reason.toLowerCase().includes('search')) tags.push('search');
    if (rec.reason.toLowerCase().includes('energy')) tags.push('energy');
    if (rec.reason.toLowerCase().includes('damage')) tags.push('damage');
    if (rec.reason.toLowerCase().includes('speed')) tags.push('speed');

    // Priority tag
    tags.push(rec.priority);

    return tags;
  }
}