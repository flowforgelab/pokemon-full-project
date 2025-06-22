import { prisma } from '@/server/db/prisma';
import type { Deck, DeckCard, Card, User } from '@prisma/client';
import { ArchetypeGenerator } from './archetype-generator';
import { ReplacementOptimizer } from './replacement-optimizer';
import { BudgetBuilder } from './budget-builder';
import { CollectionBuilder } from './collection-builder';
import { SynergyCalculator } from './synergy-calculator';
import { MetaAnalyzer } from './meta-analyzer';
import { DeckAnalyzer } from '../analysis/deck-analyzer';
import type {
  BuilderConfig,
  DeckRecommendation,
  OptimizationRequest,
  OptimizationResult,
  BatchOptimizationRequest,
  BatchOptimizationResult,
  RecommendationFilter,
  RecommendationType,
  DeckVariant,
  VariantType,
  OptimizationGoal,
  RecommendationFeedback,
  LearningPattern,
} from './types';
import { DeckArchetype } from '../analysis/types';

/**
 * Main recommendation engine that orchestrates all recommendation systems
 */
export class RecommendationEngine {
  private archetypeGenerator: ArchetypeGenerator;
  private replacementOptimizer: ReplacementOptimizer;
  private budgetBuilder: BudgetBuilder;
  private collectionBuilder: CollectionBuilder;
  private synergyCalculator: SynergyCalculator;
  private metaAnalyzer: MetaAnalyzer;
  private deckAnalyzer: DeckAnalyzer;
  
  // Learning system
  private userPatterns: Map<string, LearningPattern[]> = new Map();
  private feedbackHistory: Map<string, RecommendationFeedback[]> = new Map();

  constructor() {
    this.archetypeGenerator = new ArchetypeGenerator();
    this.replacementOptimizer = new ReplacementOptimizer();
    this.budgetBuilder = new BudgetBuilder();
    this.collectionBuilder = new CollectionBuilder();
    this.synergyCalculator = new SynergyCalculator();
    this.metaAnalyzer = new MetaAnalyzer();
    this.deckAnalyzer = new DeckAnalyzer();
  }

  /**
   * Get personalized recommendations for a user
   */
  async getPersonalizedRecommendations(
    userId: string,
    filter?: RecommendationFilter
  ): Promise<DeckRecommendation[]> {
    // Load user preferences and patterns
    const config = await this.loadUserConfig(userId);
    const patterns = await this.loadUserPatterns(userId);
    
    // Apply learned preferences
    const adjustedConfig = this.applyLearnedPreferences(config, patterns);

    const recommendations: DeckRecommendation[] = [];

    // 1. Collection-based recommendations
    const collectionRecs = await this.collectionBuilder.buildFromCollection(
      userId,
      adjustedConfig
    );
    recommendations.push(collectionRecs);

    // 2. Budget-aware recommendations
    if (adjustedConfig.constraints.maxBudget) {
      const budgetRecs = await this.budgetBuilder.buildBudgetDeck(
        adjustedConfig.constraints.maxBudget,
        adjustedConfig
      );
      recommendations.push(budgetRecs);
    }

    // 3. Meta-informed recommendations
    const metaRecs = await this.metaAnalyzer.getMetaRecommendations(
      adjustedConfig,
      adjustedConfig.preferences.favoriteArchetypes[0]
    );
    recommendations.push(...metaRecs);

    // 4. Archetype-based recommendations
    const archetypeRecs = await this.archetypeGenerator.generateArchetypeOptions(
      adjustedConfig,
      2
    );
    recommendations.push(...archetypeRecs);

    // Apply filters
    const filtered = filter ? this.applyFilters(recommendations, filter) : recommendations;

    // Sort by relevance
    return this.sortByRelevance(filtered, patterns);
  }

  /**
   * Optimize an existing deck
   */
  async optimizeDeck(request: OptimizationRequest): Promise<OptimizationResult> {
    const { deck, config, optimizationGoal } = request;

    let optimizedDeck: DeckRecommendation;

    switch (optimizationGoal) {
      case OptimizationGoal.MAXIMIZE_WIN_RATE:
        optimizedDeck = await this.optimizeForWinRate(deck, config);
        break;
      
      case OptimizationGoal.MINIMIZE_COST:
        optimizedDeck = await this.optimizeForBudget(deck, config);
        break;
      
      case OptimizationGoal.IMPROVE_CONSISTENCY:
        optimizedDeck = await this.optimizeForConsistency(deck, config);
        break;
      
      case OptimizationGoal.COUNTER_META:
        optimizedDeck = await this.optimizeForMeta(deck, config);
        break;
      
      case OptimizationGoal.BALANCE_ALL:
      default:
        optimizedDeck = await this.balancedOptimization(deck, config);
        break;
    }

    // Generate variants
    const variants = await this.generateDeckVariants(optimizedDeck, config);

    return {
      originalDeck: deck,
      optimizedDeck: optimizedDeck.suggestedChanges.map(c => c.card),
      changes: optimizedDeck.suggestedChanges,
      improvements: optimizedDeck.expectedImpact,
      cost: optimizedDeck.costAnalysis,
      alternatives: variants,
      explanation: optimizedDeck.reasoning,
    };
  }

  /**
   * Build deck from scratch
   */
  async buildDeckFromScratch(config: BuilderConfig): Promise<DeckRecommendation[]> {
    const recommendations: DeckRecommendation[] = [];

    // 1. Budget-first approach
    if (config.constraints.maxBudget && config.constraints.maxBudget < 100) {
      const budgetDeck = await this.budgetBuilder.buildBudgetDeck(
        config.constraints.maxBudget,
        config
      );
      recommendations.push(budgetDeck);
    }

    // 2. Collection-first approach
    if (config.constraints.onlyOwnedCards) {
      const collectionDeck = await this.collectionBuilder.buildFromCollection(
        config.userId,
        config
      );
      recommendations.push(collectionDeck);
    }

    // 3. Archetype-based approach
    const archetypeOptions = await this.archetypeGenerator.generateArchetypeOptions(
      config,
      3
    );
    recommendations.push(...archetypeOptions);

    // 4. Meta-counter approach
    const metaOptions = await this.metaAnalyzer.getMetaRecommendations(config);
    recommendations.push(...metaOptions);

    return recommendations;
  }

  /**
   * Batch optimize multiple decks
   */
  async batchOptimize(request: BatchOptimizationRequest): Promise<BatchOptimizationResult> {
    const results: OptimizationResult[] = [];
    const sharedCards = new Set<string>();
    let totalCost = 0;

    // Track card usage across decks if sharing pool
    const cardUsage = new Map<string, number>();

    for (const deck of request.decks) {
      const optimizationRequest: OptimizationRequest = {
        deck,
        config: request.sharedConfig,
        optimizationGoal: OptimizationGoal.BALANCE_ALL,
        acceptableChanges: 10,
      };

      // Consider shared card pool
      if (request.sharedCardPool) {
        // Adjust config based on already used cards
        optimizationRequest.config = this.adjustConfigForSharedPool(
          request.sharedConfig,
          cardUsage
        );
      }

      const result = await this.optimizeDeck(optimizationRequest);
      results.push(result);

      // Track shared cards
      for (const change of result.changes) {
        sharedCards.add(change.card.id);
        if (request.sharedCardPool) {
          cardUsage.set(
            change.card.id,
            (cardUsage.get(change.card.id) || 0) + change.quantity
          );
        }
      }

      totalCost += result.cost.totalCost;
    }

    // Calculate collection efficiency
    const uniqueCards = sharedCards.size;
    const totalCards = results.reduce(
      (sum, r) => sum + r.changes.reduce((s, c) => s + c.quantity, 0),
      0
    );
    const collectionEfficiency = uniqueCards / totalCards;

    return {
      optimizedDecks: results,
      sharedCards: Array.from(sharedCards),
      totalCost,
      collectionEfficiency,
    };
  }

  /**
   * Record user feedback for learning
   */
  async recordFeedback(feedback: RecommendationFeedback): Promise<void> {
    const userId = feedback.userId;
    
    // Store feedback
    if (!this.feedbackHistory.has(userId)) {
      this.feedbackHistory.set(userId, []);
    }
    this.feedbackHistory.get(userId)!.push(feedback);

    // Update learning patterns
    await this.updateLearningPatterns(userId, feedback);

    // Persist to database
    await this.persistFeedback(feedback);
  }

  /**
   * Get smart recommendations based on context
   */
  async getSmartRecommendations(
    userId: string,
    context: {
      currentDeck?: Deck & { cards: (DeckCard & { card: Card })[] };
      recentMatches?: any[];
      goals?: string[];
    }
  ): Promise<DeckRecommendation[]> {
    const recommendations: DeckRecommendation[] = [];

    // Analyze current performance if deck provided
    if (context.currentDeck) {
      const analysis = await this.deckAnalyzer.analyzeDeck(context.currentDeck);
      
      // Recommend improvements based on weaknesses
      if (analysis.scores.consistency < 70) {
        const consistencyFix = await this.optimizeForConsistency(
          context.currentDeck,
          await this.loadUserConfig(userId)
        );
        recommendations.push(consistencyFix);
      }

      if (analysis.scores.power < 70) {
        const powerFix = await this.optimizeForWinRate(
          context.currentDeck,
          await this.loadUserConfig(userId)
        );
        recommendations.push(powerFix);
      }
    }

    // Analyze recent match performance
    if (context.recentMatches && context.recentMatches.length > 0) {
      const matchupTrends = this.analyzeMatchupTrends(context.recentMatches);
      
      // Recommend counters to problem matchups
      for (const problemMatchup of matchupTrends.problemMatchups) {
        const counterRec = await this.buildCounterDeck(
          problemMatchup,
          await this.loadUserConfig(userId)
        );
        if (counterRec) {
          recommendations.push(counterRec);
        }
      }
    }

    // Goal-based recommendations
    if (context.goals) {
      for (const goal of context.goals) {
        const goalRecs = await this.getGoalBasedRecommendations(
          userId,
          goal
        );
        recommendations.push(...goalRecs);
      }
    }

    return recommendations;
  }

  /**
   * Private helper methods
   */
  private async loadUserConfig(userId: string): Promise<BuilderConfig> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Convert user preferences to builder config
    return {
      userId,
      preferences: {
        favoriteArchetypes: user.preferences?.favoriteArchetypes as DeckArchetype[] || [DeckArchetype.MIDRANGE],
        avoidArchetypes: user.preferences?.avoidArchetypes as DeckArchetype[] || [],
        playstylePreference: user.preferences?.playstyle as any || 'balanced',
        complexityPreference: user.preferences?.complexity as any || 'moderate',
        budgetFlexibility: 0.5,
      },
      constraints: {
        maxBudget: user.preferences?.maxBudget || undefined,
        format: 'Standard' as any,
      },
      goals: {
        targetTier: 2,
        learningFocus: user.preferences?.learningFocus || false,
        innovationDesired: false,
      },
    };
  }

  private async loadUserPatterns(userId: string): Promise<LearningPattern[]> {
    if (this.userPatterns.has(userId)) {
      return this.userPatterns.get(userId)!;
    }

    // Load from database (simplified)
    const patterns: LearningPattern[] = [];
    
    // Analyze feedback history
    const feedback = this.feedbackHistory.get(userId) || [];
    
    if (feedback.length > 5) {
      // Card preference pattern
      const acceptedCards = new Set<string>();
      const rejectedCards = new Set<string>();
      
      for (const fb of feedback) {
        if (fb.accepted) {
          fb.implemented.forEach(change => acceptedCards.add(change.card.id));
        } else {
          // Track rejected suggestions
        }
      }

      patterns.push({
        pattern: 'card_preference',
        userId,
        data: { accepted: Array.from(acceptedCards), rejected: Array.from(rejectedCards) },
        confidence: Math.min(feedback.length / 10, 1),
        lastUpdated: new Date(),
      });
    }

    this.userPatterns.set(userId, patterns);
    return patterns;
  }

  private applyLearnedPreferences(
    config: BuilderConfig,
    patterns: LearningPattern[]
  ): BuilderConfig {
    const adjusted = { ...config };

    for (const pattern of patterns) {
      switch (pattern.pattern) {
        case 'card_preference':
          // Adjust must include/exclude based on preferences
          if (pattern.data.rejected?.length > 0) {
            adjusted.constraints.mustExcludeCards = [
              ...(adjusted.constraints.mustExcludeCards || []),
              ...pattern.data.rejected,
            ];
          }
          break;

        case 'archetype_success':
          // Prefer successful archetypes
          if (pattern.data.successful) {
            adjusted.preferences.favoriteArchetypes.unshift(pattern.data.successful);
          }
          break;

        case 'budget_sensitivity':
          // Adjust budget flexibility
          if (pattern.data.sensitivity === 'high') {
            adjusted.preferences.budgetFlexibility = 0.2;
          } else if (pattern.data.sensitivity === 'low') {
            adjusted.preferences.budgetFlexibility = 0.8;
          }
          break;

        case 'complexity_preference':
          // Adjust complexity preference
          adjusted.preferences.complexityPreference = pattern.data.preference || 'moderate';
          break;
      }
    }

    return adjusted;
  }

  private async optimizeForWinRate(
    deck: Deck & { cards: (DeckCard & { card: Card })[] } | undefined,
    config: BuilderConfig
  ): Promise<DeckRecommendation> {
    if (deck) {
      // Optimize existing deck
      return this.replacementOptimizer.optimizeDeck(deck, config);
    } else {
      // Build new power deck
      const powerArchetypes = [DeckArchetype.TURBO, DeckArchetype.AGGRO, DeckArchetype.COMBO];
      const bestArchetype = powerArchetypes.find(a => 
        !config.preferences.avoidArchetypes.includes(a)
      ) || DeckArchetype.MIDRANGE;
      
      return this.archetypeGenerator.generateDeck(bestArchetype, config);
    }
  }

  private async optimizeForBudget(
    deck: Deck & { cards: (DeckCard & { card: Card })[] } | undefined,
    config: BuilderConfig
  ): Promise<DeckRecommendation> {
    const budget = config.constraints.maxBudget || 100;
    
    if (deck) {
      // Create budget variant
      return this.budgetBuilder.createBudgetVariant(deck, budget);
    } else {
      // Build new budget deck
      return this.budgetBuilder.buildBudgetDeck(budget, config);
    }
  }

  private async optimizeForConsistency(
    deck: Deck & { cards: (DeckCard & { card: Card })[] } | undefined,
    config: BuilderConfig
  ): Promise<DeckRecommendation> {
    if (!deck) {
      // Build consistent archetype
      const consistentArchetypes = [DeckArchetype.CONTROL, DeckArchetype.MIDRANGE];
      const archetype = consistentArchetypes.find(a => 
        !config.preferences.avoidArchetypes.includes(a)
      ) || DeckArchetype.MIDRANGE;
      
      return this.archetypeGenerator.generateDeck(archetype, config);
    }

    // Focus on consistency improvements
    const analysis = await this.deckAnalyzer.analyzeDeck(deck);
    const recommendation = await this.replacementOptimizer.optimizeDeck(deck, config);

    // Prioritize consistency cards
    recommendation.suggestedChanges = recommendation.suggestedChanges.filter(change => 
      change.reasoning.toLowerCase().includes('consistency') ||
      change.card.supertype === 'Trainer' ||
      change.impact > 0
    );

    recommendation.reasoning.unshift('Optimized for maximum consistency');
    
    return recommendation;
  }

  private async optimizeForMeta(
    deck: Deck & { cards: (DeckCard & { card: Card })[] } | undefined,
    config: BuilderConfig
  ): Promise<DeckRecommendation> {
    const metaRecs = await this.metaAnalyzer.getMetaRecommendations(config);
    
    if (metaRecs.length > 0) {
      return metaRecs[0];
    }

    // Fallback to general optimization
    return this.balancedOptimization(deck, config);
  }

  private async balancedOptimization(
    deck: Deck & { cards: (DeckCard & { card: Card })[] } | undefined,
    config: BuilderConfig
  ): Promise<DeckRecommendation> {
    if (deck) {
      return this.replacementOptimizer.optimizeDeck(deck, config);
    } else {
      const options = await this.archetypeGenerator.generateArchetypeOptions(config, 1);
      return options[0];
    }
  }

  private async generateDeckVariants(
    baseDeck: DeckRecommendation,
    config: BuilderConfig
  ): Promise<DeckVariant[]> {
    const variants: DeckVariant[] = [];

    // Budget variant
    if (config.constraints.maxBudget) {
      const budgetChanges = baseDeck.suggestedChanges.filter(c => {
        // Filter to cheaper alternatives
        return true; // Simplified
      });

      variants.push({
        name: 'Budget Version',
        type: VariantType.BUDGET,
        description: 'More affordable version with similar strategy',
        changes: budgetChanges,
        targetAudience: 'Budget-conscious players',
        pros: ['Lower cost', 'Easier to build', 'Good starting point'],
        cons: ['Slightly less powerful', 'May struggle against top tier'],
        estimatedCost: config.constraints.maxBudget * 0.5,
        difficultyRating: 4,
      });
    }

    // Competitive variant
    variants.push({
      name: 'Tournament Version',
      type: VariantType.COMPETITIVE,
      description: 'Optimized for competitive play',
      changes: baseDeck.suggestedChanges,
      targetAudience: 'Tournament players',
      pros: ['Maximum power', 'Best matchup spread', 'Proven results'],
      cons: ['Higher cost', 'Requires skill to pilot'],
      estimatedCost: baseDeck.costAnalysis.totalCost * 1.5,
      difficultyRating: 8,
    });

    // Beginner variant
    const beginnerChanges = baseDeck.suggestedChanges.filter(c => {
      // Simplify complex cards
      return !c.card.text?.includes('complicated') && c.card.abilities?.length === 0;
    });

    variants.push({
      name: 'Beginner Friendly',
      type: VariantType.BEGINNER,
      description: 'Simplified version for new players',
      changes: beginnerChanges,
      targetAudience: 'New players',
      pros: ['Easy to learn', 'Clear game plan', 'Forgiving of mistakes'],
      cons: ['Lower ceiling', 'Less flexibility'],
      estimatedCost: baseDeck.costAnalysis.totalCost * 0.7,
      difficultyRating: 3,
    });

    return variants;
  }

  private applyFilters(
    recommendations: DeckRecommendation[],
    filter: RecommendationFilter
  ): DeckRecommendation[] {
    return recommendations.filter(rec => {
      // Price filter
      if (filter.priceRange) {
        if (rec.costAnalysis.totalCost < filter.priceRange.min ||
            rec.costAnalysis.totalCost > filter.priceRange.max) {
          return false;
        }
      }

      // Complexity filter
      if (filter.complexityLimit && rec.difficultyRating > filter.complexityLimit) {
        return false;
      }

      // Meta tier filter
      if (filter.metaTierRequirement && rec.metaRelevance < filter.metaTierRequirement * 25) {
        return false;
      }

      return true;
    });
  }

  private sortByRelevance(
    recommendations: DeckRecommendation[],
    patterns: LearningPattern[]
  ): DeckRecommendation[] {
    return recommendations.sort((a, b) => {
      // Sort by confidence and meta relevance
      const scoreA = a.confidence + a.metaRelevance;
      const scoreB = b.confidence + b.metaRelevance;
      
      // Apply learned preferences boost
      const boostA = this.calculatePreferenceBoost(a, patterns);
      const boostB = this.calculatePreferenceBoost(b, patterns);
      
      return (scoreB + boostB) - (scoreA + boostA);
    });
  }

  private calculatePreferenceBoost(
    recommendation: DeckRecommendation,
    patterns: LearningPattern[]
  ): number {
    let boost = 0;

    for (const pattern of patterns) {
      if (pattern.pattern === 'card_preference' && pattern.data.accepted) {
        // Boost if contains preferred cards
        const hasPreferred = recommendation.suggestedChanges.some(c =>
          pattern.data.accepted.includes(c.card.id)
        );
        if (hasPreferred) boost += 10;
      }
    }

    return boost;
  }

  private adjustConfigForSharedPool(
    config: BuilderConfig,
    cardUsage: Map<string, number>
  ): BuilderConfig {
    const adjusted = { ...config };
    
    // Add cards that are already maxed out to exclusion list
    const maxedCards = Array.from(cardUsage.entries())
      .filter(([cardId, count]) => count >= 4)
      .map(([cardId]) => cardId);

    adjusted.constraints.mustExcludeCards = [
      ...(adjusted.constraints.mustExcludeCards || []),
      ...maxedCards,
    ];

    return adjusted;
  }

  private async updateLearningPatterns(
    userId: string,
    feedback: RecommendationFeedback
  ): Promise<void> {
    const patterns = await this.loadUserPatterns(userId);

    // Update card preferences
    const cardPrefPattern = patterns.find(p => p.pattern === 'card_preference');
    if (cardPrefPattern) {
      if (feedback.accepted) {
        feedback.implemented.forEach(change => {
          if (!cardPrefPattern.data.accepted.includes(change.card.id)) {
            cardPrefPattern.data.accepted.push(change.card.id);
          }
        });
      }
      cardPrefPattern.confidence = Math.min(1, cardPrefPattern.confidence + 0.1);
      cardPrefPattern.lastUpdated = new Date();
    }

    // Update archetype success
    if (feedback.performanceAfter && feedback.performanceAfter.winRate > 0.6) {
      // Track successful archetypes
      // Would need to determine archetype from deck
    }

    this.userPatterns.set(userId, patterns);
  }

  private async persistFeedback(feedback: RecommendationFeedback): Promise<void> {
    // In production, would save to database
    // For now, kept in memory
  }

  private analyzeMatchupTrends(matches: any[]): {
    problemMatchups: DeckArchetype[];
    strongMatchups: DeckArchetype[];
  } {
    // Analyze win rates by opponent archetype
    const matchupStats = new Map<DeckArchetype, { wins: number; losses: number }>();

    // Simplified analysis
    const problemMatchups: DeckArchetype[] = [];
    const strongMatchups: DeckArchetype[] = [];

    return { problemMatchups, strongMatchups };
  }

  private async buildCounterDeck(
    targetArchetype: DeckArchetype,
    config: BuilderConfig
  ): Promise<DeckRecommendation | null> {
    // Find archetype that counters target
    const counterArchetypes: Record<DeckArchetype, DeckArchetype[]> = {
      [DeckArchetype.AGGRO]: [DeckArchetype.STALL, DeckArchetype.CONTROL],
      [DeckArchetype.CONTROL]: [DeckArchetype.AGGRO, DeckArchetype.TURBO],
      [DeckArchetype.COMBO]: [DeckArchetype.AGGRO, DeckArchetype.CONTROL],
      [DeckArchetype.MIDRANGE]: [DeckArchetype.CONTROL, DeckArchetype.COMBO],
      [DeckArchetype.MILL]: [DeckArchetype.AGGRO, DeckArchetype.TURBO],
      [DeckArchetype.STALL]: [DeckArchetype.MILL, DeckArchetype.COMBO],
      [DeckArchetype.TOOLBOX]: [DeckArchetype.SPREAD],
      [DeckArchetype.TURBO]: [DeckArchetype.CONTROL, DeckArchetype.MILL],
      [DeckArchetype.SPREAD]: [DeckArchetype.AGGRO],
    };

    const counters = counterArchetypes[targetArchetype] || [];
    const viableCounter = counters.find(c => !config.preferences.avoidArchetypes.includes(c));

    if (viableCounter) {
      return this.archetypeGenerator.generateDeck(viableCounter, config);
    }

    return null;
  }

  private async getGoalBasedRecommendations(
    userId: string,
    goal: string
  ): Promise<DeckRecommendation[]> {
    const config = await this.loadUserConfig(userId);
    const recommendations: DeckRecommendation[] = [];

    if (goal.includes('competitive') || goal.includes('tournament')) {
      config.goals.tournamentPrep = true;
      config.goals.targetTier = 1;
      
      const competitiveRecs = await this.archetypeGenerator.generateArchetypeOptions(
        config,
        2
      );
      recommendations.push(...competitiveRecs);
    }

    if (goal.includes('budget')) {
      const budgetRec = await this.budgetBuilder.buildBudgetDeck(
        config.constraints.maxBudget || 50,
        config
      );
      recommendations.push(budgetRec);
    }

    if (goal.includes('learn') || goal.includes('beginner')) {
      config.goals.learningFocus = true;
      config.preferences.complexityPreference = 'simple';
      
      const learnerRec = await this.archetypeGenerator.generateDeck(
        DeckArchetype.MIDRANGE, // Good for learning
        config
      );
      recommendations.push(learnerRec);
    }

    return recommendations;
  }
}