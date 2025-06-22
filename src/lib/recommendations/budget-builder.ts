import { prisma } from '@/server/db/prisma';
import type { Card, Deck, DeckCard, Format } from '@prisma/client';
import { DeckArchetype } from '../analysis/types';
import { ArchetypeGenerator } from './archetype-generator';
import type {
  BuilderConfig,
  DeckRecommendation,
  CardChange,
  CostBreakdown,
  RecommendationType,
  BudgetTier,
  CardRole,
  ImpactAnalysis,
  AlternativeChange,
  CardCost,
} from './types';

/**
 * Builds decks with sophisticated budget constraints and optimization
 */
export class BudgetBuilder {
  private archetypeGenerator: ArchetypeGenerator;
  private priceCache: Map<string, number> = new Map();
  private valueCards: Map<string, number> = new Map(); // cardId -> value score

  constructor() {
    this.archetypeGenerator = new ArchetypeGenerator();
  }

  /**
   * Build a deck within budget constraints
   */
  async buildBudgetDeck(
    maxBudget: number,
    config: BuilderConfig
  ): Promise<DeckRecommendation> {
    // Determine budget tier
    const budgetTier = this.getBudgetTier(maxBudget);

    // Find suitable archetypes for budget
    const suitableArchetypes = await this.findBudgetArchetypes(maxBudget, budgetTier);

    // Generate budget-optimized deck
    const deck = await this.generateBudgetOptimizedDeck(
      suitableArchetypes[0], // Best archetype for budget
      maxBudget,
      config
    );

    // Create upgrade path
    const upgradePath = await this.createUpgradePath(deck, maxBudget, config);

    return {
      ...deck,
      type: RecommendationType.BUDGET_BUILD,
      reasoning: [
        ...deck.reasoning,
        `Built within $${maxBudget} budget constraint`,
        `Selected ${suitableArchetypes[0]} as most viable archetype for budget`,
        'Included upgrade path for future improvements',
      ],
      alternativeOptions: upgradePath,
    };
  }

  /**
   * Optimize cost/performance ratio
   */
  async optimizeCostPerformance(
    targetBudget: number,
    config: BuilderConfig
  ): Promise<DeckRecommendation[]> {
    const recommendations: DeckRecommendation[] = [];

    // Generate options at different budget points
    const budgetPoints = [
      targetBudget * 0.7,  // Budget option
      targetBudget,        // Target option
      targetBudget * 1.3,  // Premium option
    ];

    for (const budget of budgetPoints) {
      try {
        const deck = await this.buildBudgetDeck(budget, config);
        
        // Calculate value score
        const valueScore = await this.calculateValueScore(deck);
        
        recommendations.push({
          ...deck,
          reasoning: [
            ...deck.reasoning,
            `Value score: ${valueScore.toFixed(2)} (performance per dollar)`,
          ],
        });
      } catch (error) {
        console.error(`Failed to build deck at $${budget}:`, error);
      }
    }

    // Sort by value score
    return recommendations.sort((a, b) => {
      const aValue = this.calculateValueScore(a);
      const bValue = this.calculateValueScore(b);
      return bValue - aValue;
    });
  }

  /**
   * Find hidden value cards
   */
  async findValueCards(
    format: Format,
    maxPrice: number = 5
  ): Promise<Card[]> {
    // Load value card data
    await this.loadValueCards();

    // Find underpriced high-performance cards
    const valueCards = await prisma.card.findMany({
      where: {
        legalities: {
          path: [format],
          equals: 'Legal'
        }
      },
      include: {
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1
        }
      }
    });

    // Filter and score by value
    const scoredCards = valueCards
      .filter(card => {
        const price = card.prices[0]?.marketPrice || 0;
        return price <= maxPrice && price > 0;
      })
      .map(card => ({
        card,
        valueScore: this.calculateCardValue(card),
        price: card.prices[0]?.marketPrice || 0
      }))
      .filter(item => item.valueScore > 0.7) // High value threshold
      .sort((a, b) => b.valueScore - a.valueScore);

    return scoredCards.slice(0, 20).map(item => item.card);
  }

  /**
   * Create budget variants of expensive decks
   */
  async createBudgetVariant(
    expensiveDeck: Deck & { cards: (DeckCard & { card: Card })[] },
    targetBudget: number
  ): Promise<DeckRecommendation> {
    // Analyze expensive deck
    const deckCost = await this.calculateDeckCost(expensiveDeck);
    const costReduction = deckCost.totalCost - targetBudget;

    if (costReduction <= 0) {
      // Already within budget
      return this.createRecommendationFromDeck(expensiveDeck);
    }

    // Find budget replacements
    const replacements = await this.findBudgetReplacements(
      expensiveDeck,
      costReduction
    );

    // Apply replacements
    const budgetDeck = this.applyBudgetReplacements(expensiveDeck, replacements);

    // Calculate impact
    const impact = await this.calculateBudgetImpact(expensiveDeck, budgetDeck);

    return {
      id: `budget_${Date.now()}`,
      type: RecommendationType.BUDGET_BUILD,
      timestamp: new Date(),
      suggestedChanges: replacements,
      reasoning: [
        `Created budget version of ${expensiveDeck.name}`,
        `Reduced cost from $${deckCost.totalCost.toFixed(2)} to $${targetBudget}`,
        'Maintained core strategy while using budget alternatives',
        `Performance retained: ${(100 - impact.performanceLoss).toFixed(0)}%`,
      ],
      expectedImpact: impact,
      alternativeOptions: [],
      costAnalysis: await this.calculateDeckCost(budgetDeck),
      difficultyRating: 5,
      metaRelevance: 70,
      confidence: 80,
    };
  }

  /**
   * Generate budget-optimized deck for archetype
   */
  private async generateBudgetOptimizedDeck(
    archetype: DeckArchetype,
    maxBudget: number,
    config: BuilderConfig
  ): Promise<DeckRecommendation> {
    // Start with archetype template
    const baseConfig: BuilderConfig = {
      ...config,
      constraints: {
        ...config.constraints,
        maxBudget,
      },
    };

    // Generate initial deck
    let deck = await this.archetypeGenerator.generateDeck(archetype, baseConfig);

    // Check if under budget
    let currentCost = deck.costAnalysis.totalCost;
    let iterations = 0;

    while (currentCost > maxBudget && iterations < 10) {
      // Find most expensive cards
      const expensiveCards = deck.suggestedChanges
        .sort((a, b) => {
          const aCost = this.getCardTotalCost(a, deck.costAnalysis);
          const bCost = this.getCardTotalCost(b, deck.costAnalysis);
          return bCost - aCost;
        })
        .slice(0, 3); // Top 3 most expensive

      // Replace with budget alternatives
      for (const expensive of expensiveCards) {
        const budgetAlternative = await this.findBudgetAlternativeCard(
          expensive.card,
          expensive.quantity,
          maxBudget * 0.1 // Max 10% of budget per card type
        );

        if (budgetAlternative) {
          // Replace in deck
          const index = deck.suggestedChanges.findIndex(
            c => c.card.id === expensive.card.id
          );
          if (index !== -1) {
            deck.suggestedChanges[index] = budgetAlternative;
          }
        }
      }

      // Recalculate cost
      deck.costAnalysis = await this.recalculateCosts(deck.suggestedChanges);
      currentCost = deck.costAnalysis.totalCost;
      iterations++;
    }

    return deck;
  }

  /**
   * Create upgrade path for budget deck
   */
  private async createUpgradePath(
    budgetDeck: DeckRecommendation,
    currentBudget: number,
    config: BuilderConfig
  ): Promise<AlternativeChange[]> {
    const upgradePath: AlternativeChange[] = [];

    // Tier 1: +$25 upgrade
    const tier1Changes = await this.findUpgrades(
      budgetDeck,
      currentBudget + 25,
      'Essential upgrades for consistency'
    );
    if (tier1Changes.length > 0) {
      upgradePath.push({
        changes: tier1Changes,
        totalImpact: 15,
        totalCost: currentBudget + 25,
        reasoning: 'First priority upgrades - consistency and speed',
        tradeoffs: ['Minimal cost increase', 'Significant consistency improvement'],
      });
    }

    // Tier 2: +$50 upgrade
    const tier2Changes = await this.findUpgrades(
      budgetDeck,
      currentBudget + 50,
      'Power level improvements'
    );
    if (tier2Changes.length > 0) {
      upgradePath.push({
        changes: tier2Changes,
        totalImpact: 25,
        totalCost: currentBudget + 50,
        reasoning: 'Secondary upgrades - power and versatility',
        tradeoffs: ['Moderate cost increase', 'Better matchup spread'],
      });
    }

    // Tier 3: +$100 upgrade
    const tier3Changes = await this.findUpgrades(
      budgetDeck,
      currentBudget + 100,
      'Competitive optimization'
    );
    if (tier3Changes.length > 0) {
      upgradePath.push({
        changes: tier3Changes,
        totalImpact: 40,
        totalCost: currentBudget + 100,
        reasoning: 'Full competitive upgrade - tournament ready',
        tradeoffs: ['Significant investment', 'Top tier performance'],
      });
    }

    return upgradePath;
  }

  /**
   * Find specific upgrades within budget
   */
  private async findUpgrades(
    deck: DeckRecommendation,
    newBudget: number,
    focus: string
  ): Promise<CardChange[]> {
    const upgrades: CardChange[] = [];
    const budgetRemaining = newBudget - deck.costAnalysis.totalCost;

    // Identify upgrade targets based on focus
    const targets = deck.suggestedChanges.filter(change => {
      if (focus.includes('consistency')) {
        return change.card.supertype === 'Trainer' || 
               change.reasoning.includes('consistency');
      } else if (focus.includes('power')) {
        return change.card.supertype === 'Pokémon' &&
               change.card.subtypes?.includes('V') === false; // Non-V Pokemon to upgrade
      } else {
        return true; // All cards for competitive
      }
    });

    // Find upgrades for each target
    for (const target of targets) {
      const upgrade = await this.findCardUpgrade(
        target.card,
        budgetRemaining / targets.length
      );

      if (upgrade) {
        upgrades.push({
          action: 'replace',
          card: upgrade,
          currentCard: target.card,
          quantity: target.quantity,
          reasoning: `Upgrade for ${focus}`,
          impact: 20,
          synergyChanges: [],
        });
      }
    }

    return upgrades;
  }

  /**
   * Calculate value score (performance per dollar)
   */
  private async calculateValueScore(deck: DeckRecommendation): Promise<number> {
    const performance = deck.expectedImpact.overallImprovement + 70; // Base performance
    const cost = deck.costAnalysis.totalCost || 1; // Avoid division by zero
    
    return performance / cost;
  }

  /**
   * Load value card database
   */
  private async loadValueCards(): Promise<void> {
    // In production, this would load from a curated database
    // For now, we'll calculate value scores dynamically
    
    const recentCards = await prisma.card.findMany({
      where: {
        releaseDate: {
          gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
        }
      },
      include: {
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1
        }
      },
      take: 1000
    });

    // Calculate and cache value scores
    for (const card of recentCards) {
      const valueScore = this.calculateCardValue(card);
      this.valueCards.set(card.id, valueScore);
    }
  }

  /**
   * Calculate individual card value
   */
  private calculateCardValue(card: Card & { prices?: any[] }): number {
    let value = 0.5; // Base value

    const price = card.prices?.[0]?.marketPrice || 1;

    // Pokemon value factors
    if (card.supertype === 'Pokémon') {
      // HP to cost ratio
      const hp = parseInt(card.hp || '0');
      if (hp > 0) {
        value += (hp / price) / 100;
      }

      // Attack efficiency
      if (card.attacks && Array.isArray(card.attacks)) {
        const bestAttack = (card.attacks as any[]).reduce((best, attack) => {
          const damage = parseInt(attack.damage?.replace(/\D/g, '') || '0');
          const cost = attack.cost?.length || 1;
          const efficiency = damage / cost;
          return efficiency > best ? efficiency : best;
        }, 0);
        value += bestAttack / 100;
      }

      // Ability bonus
      if (card.abilities && card.abilities.length > 0) {
        value += 0.2;
      }
    }

    // Trainer value factors
    if (card.supertype === 'Trainer') {
      // Universal trainers are more valuable
      if (card.text?.includes('draw') || card.text?.includes('search')) {
        value += 0.3;
      }
      
      // Low cost trainers
      if (price < 2) {
        value += 0.2;
      }
    }

    // Energy value
    if (card.supertype === 'Energy') {
      // Special energy value
      if (card.subtypes?.includes('Special')) {
        value += 0.2;
      }
    }

    // Rarity discount (commons/uncommons are better value)
    if (card.rarity === 'Common' || card.rarity === 'Uncommon') {
      value += 0.1;
    }

    return Math.min(1, value);
  }

  /**
   * Find budget replacements for expensive cards
   */
  private async findBudgetReplacements(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    costReduction: number
  ): Promise<CardChange[]> {
    const replacements: CardChange[] = [];
    let savedAmount = 0;

    // Sort cards by price descending
    const sortedCards = await this.sortCardsByPrice(deck.cards);

    for (const deckCard of sortedCards) {
      if (savedAmount >= costReduction) break;

      const cardPrice = await this.getCardPrice(deckCard.card.id);
      
      // Skip if already cheap
      if (cardPrice < 5) continue;

      // Find budget alternative
      const alternative = await this.findBudgetAlternativeCard(
        deckCard.card,
        deckCard.quantity,
        cardPrice * 0.3 // Target 30% of original price
      );

      if (alternative) {
        const alternativePrice = await this.getCardPrice(alternative.card.id);
        const savings = (cardPrice - alternativePrice) * deckCard.quantity;

        replacements.push({
          action: 'replace',
          card: alternative.card,
          currentCard: deckCard.card,
          quantity: deckCard.quantity,
          reasoning: `Budget alternative saves $${savings.toFixed(2)}`,
          impact: -10, // Some performance loss
          synergyChanges: [],
        });

        savedAmount += savings;
      }
    }

    return replacements;
  }

  /**
   * Find budget alternative for specific card
   */
  private async findBudgetAlternativeCard(
    card: Card,
    quantity: number,
    maxPricePerCard: number
  ): Promise<CardChange | null> {
    // Find similar cards within budget
    const alternatives = await prisma.card.findMany({
      where: {
        supertype: card.supertype,
        types: card.types ? { hasSome: card.types } : undefined,
        id: { not: card.id },
      },
      include: {
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      take: 20,
    });

    // Filter by price and sort by value
    const budgetAlternatives = alternatives
      .filter(alt => {
        const price = alt.prices[0]?.marketPrice || 0;
        return price <= maxPricePerCard && price > 0;
      })
      .map(alt => ({
        card: alt,
        value: this.calculateCardValue(alt),
        similarity: this.calculateSimilarity(card, alt),
      }))
      .sort((a, b) => (b.value + b.similarity) - (a.value + a.similarity));

    if (budgetAlternatives.length === 0) return null;

    const best = budgetAlternatives[0];
    
    return {
      action: 'add',
      card: best.card,
      quantity,
      reasoning: 'Budget-friendly alternative',
      impact: 70 * best.similarity, // Impact based on similarity
      synergyChanges: [],
    };
  }

  /**
   * Calculate similarity between two cards
   */
  private calculateSimilarity(card1: Card, card2: Card): number {
    let similarity = 0;

    // Same supertype
    if (card1.supertype === card2.supertype) similarity += 0.3;

    // Same types
    if (card1.types && card2.types) {
      const sharedTypes = card1.types.filter(t => card2.types?.includes(t));
      similarity += (sharedTypes.length / card1.types.length) * 0.2;
    }

    // Similar HP (for Pokemon)
    if (card1.hp && card2.hp) {
      const hpDiff = Math.abs(parseInt(card1.hp) - parseInt(card2.hp));
      similarity += Math.max(0, (100 - hpDiff) / 100) * 0.2;
    }

    // Similar retreat cost
    if (card1.retreatCost && card2.retreatCost) {
      const retreatDiff = Math.abs(card1.retreatCost.length - card2.retreatCost.length);
      similarity += Math.max(0, (3 - retreatDiff) / 3) * 0.1;
    }

    // Similar attack count
    if (card1.attacks && card2.attacks) {
      const attackDiff = Math.abs(card1.attacks.length - card2.attacks.length);
      similarity += Math.max(0, (2 - attackDiff) / 2) * 0.2;
    }

    return similarity;
  }

  /**
   * Helper methods
   */
  private getBudgetTier(budget: number): BudgetTier {
    if (budget < 50) return BudgetTier.BUDGET;
    if (budget < 150) return BudgetTier.STANDARD;
    if (budget < 300) return BudgetTier.COMPETITIVE;
    return BudgetTier.PREMIUM;
  }

  private async findBudgetArchetypes(
    maxBudget: number,
    tier: BudgetTier
  ): Promise<DeckArchetype[]> {
    // Some archetypes are more budget-friendly
    const budgetFriendlyArchetypes: Record<BudgetTier, DeckArchetype[]> = {
      [BudgetTier.BUDGET]: [
        DeckArchetype.AGGRO,
        DeckArchetype.SPREAD,
      ],
      [BudgetTier.STANDARD]: [
        DeckArchetype.AGGRO,
        DeckArchetype.MIDRANGE,
        DeckArchetype.SPREAD,
        DeckArchetype.TOOLBOX,
      ],
      [BudgetTier.COMPETITIVE]: [
        DeckArchetype.CONTROL,
        DeckArchetype.COMBO,
        DeckArchetype.MIDRANGE,
        DeckArchetype.TURBO,
      ],
      [BudgetTier.PREMIUM]: Object.values(DeckArchetype),
    };

    return budgetFriendlyArchetypes[tier] || [DeckArchetype.AGGRO];
  }

  private async getCardPrice(cardId: string): Promise<number> {
    if (this.priceCache.has(cardId)) {
      return this.priceCache.get(cardId)!;
    }

    const price = await prisma.cardPrice.findFirst({
      where: { cardId },
      orderBy: { updatedAt: 'desc' },
    });

    const marketPrice = price?.marketPrice || 0;
    this.priceCache.set(cardId, marketPrice);
    return marketPrice;
  }

  private async calculateDeckCost(
    deck: Deck & { cards: (DeckCard & { card: Card })[] }
  ): Promise<CostBreakdown> {
    let totalCost = 0;
    const costPerCard: CardCost[] = [];

    for (const deckCard of deck.cards) {
      const price = await this.getCardPrice(deckCard.card.id);
      const cardCost: CardCost = {
        card: deckCard.card,
        quantity: deckCard.quantity,
        unitPrice: price,
        totalPrice: price * deckCard.quantity,
        marketTrend: 'stable',
      };
      costPerCard.push(cardCost);
      totalCost += cardCost.totalPrice;
    }

    return {
      totalCost,
      addedCost: totalCost,
      removedValue: 0,
      netCost: totalCost,
      costPerCard,
      budgetFriendlyAlternatives: false,
    };
  }

  private getCardTotalCost(change: CardChange, costs: CostBreakdown): number {
    const cardCost = costs.costPerCard.find(c => c.card.id === change.card.id);
    return cardCost?.totalPrice || 0;
  }

  private async recalculateCosts(changes: CardChange[]): Promise<CostBreakdown> {
    let totalCost = 0;
    const costPerCard: CardCost[] = [];

    for (const change of changes) {
      const price = await this.getCardPrice(change.card.id);
      const cardCost: CardCost = {
        card: change.card,
        quantity: change.quantity,
        unitPrice: price,
        totalPrice: price * change.quantity,
        marketTrend: 'stable',
      };
      costPerCard.push(cardCost);
      totalCost += cardCost.totalPrice;
    }

    return {
      totalCost,
      addedCost: totalCost,
      removedValue: 0,
      netCost: totalCost,
      costPerCard,
      budgetFriendlyAlternatives: false,
    };
  }

  private createRecommendationFromDeck(
    deck: Deck & { cards: (DeckCard & { card: Card })[] }
  ): DeckRecommendation {
    const changes: CardChange[] = deck.cards.map(dc => ({
      action: 'add' as const,
      card: dc.card,
      quantity: dc.quantity,
      reasoning: 'Part of original deck',
      impact: 0,
      synergyChanges: [],
    }));

    return {
      id: `rec_${Date.now()}`,
      type: RecommendationType.BUDGET_BUILD,
      timestamp: new Date(),
      suggestedChanges: changes,
      reasoning: ['Deck is already within budget'],
      expectedImpact: {
        overallImprovement: 0,
        consistencyChange: 0,
        powerChange: 0,
        speedChange: 0,
        versatilityChange: 0,
        metaRelevanceChange: 0,
        specificMatchupChanges: [],
      },
      alternativeOptions: [],
      costAnalysis: {
        totalCost: 0,
        addedCost: 0,
        removedValue: 0,
        netCost: 0,
        costPerCard: [],
        budgetFriendlyAlternatives: false,
      },
      difficultyRating: 5,
      metaRelevance: 70,
      confidence: 90,
    };
  }

  private applyBudgetReplacements(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    replacements: CardChange[]
  ): Deck & { cards: (DeckCard & { card: Card })[] } {
    const modifiedDeck = {
      ...deck,
      cards: [...deck.cards],
    };

    for (const replacement of replacements) {
      if (replacement.action === 'replace' && replacement.currentCard) {
        const index = modifiedDeck.cards.findIndex(
          dc => dc.card.id === replacement.currentCard!.id
        );
        if (index !== -1) {
          modifiedDeck.cards[index] = {
            ...modifiedDeck.cards[index],
            card: replacement.card,
          };
        }
      }
    }

    return modifiedDeck;
  }

  private async calculateBudgetImpact(
    originalDeck: Deck & { cards: (DeckCard & { card: Card })[] },
    budgetDeck: Deck & { cards: (DeckCard & { card: Card })[] }
  ): Promise<ImpactAnalysis> {
    // Simplified impact calculation
    const replacementCount = budgetDeck.cards.filter(
      dc => !originalDeck.cards.some(odc => odc.card.id === dc.card.id)
    ).length;

    const performanceLoss = replacementCount * 5; // 5% per replacement

    return {
      overallImprovement: -performanceLoss,
      consistencyChange: -Math.floor(performanceLoss * 0.5),
      powerChange: -performanceLoss,
      speedChange: -Math.floor(performanceLoss * 0.3),
      versatilityChange: -Math.floor(performanceLoss * 0.4),
      metaRelevanceChange: -Math.floor(performanceLoss * 0.8),
      specificMatchupChanges: [],
    };
  }

  private async sortCardsByPrice(
    cards: (DeckCard & { card: Card })[]
  ): Promise<(DeckCard & { card: Card })[]> {
    const priced = await Promise.all(
      cards.map(async (dc) => ({
        deckCard: dc,
        price: await this.getCardPrice(dc.card.id),
      }))
    );

    return priced
      .sort((a, b) => b.price - a.price)
      .map(p => p.deckCard);
  }

  private async findCardUpgrade(
    card: Card,
    maxPrice: number
  ): Promise<Card | null> {
    // Find direct upgrades within budget
    const upgrades = await prisma.card.findMany({
      where: {
        name: { contains: card.name.split(' ')[0] }, // Same Pokemon family
        supertype: card.supertype,
        id: { not: card.id },
      },
      include: {
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    // Filter by price and power level
    const viableUpgrades = upgrades
      .filter(up => {
        const price = up.prices[0]?.marketPrice || 0;
        return price <= maxPrice && this.isPowerUpgrade(card, up);
      })
      .sort((a, b) => {
        // Sort by power level
        const aPower = this.getCardPowerLevel(a);
        const bPower = this.getCardPowerLevel(b);
        return bPower - aPower;
      });

    return viableUpgrades[0] || null;
  }

  private isPowerUpgrade(original: Card, upgrade: Card): boolean {
    // Check if upgrade is more powerful
    if (original.hp && upgrade.hp) {
      if (parseInt(upgrade.hp) > parseInt(original.hp)) return true;
    }

    // Check for V, VMAX, ex upgrades
    if (upgrade.subtypes?.some(s => ['V', 'VMAX', 'ex'].includes(s)) &&
        !original.subtypes?.some(s => ['V', 'VMAX', 'ex'].includes(s))) {
      return true;
    }

    return false;
  }

  private getCardPowerLevel(card: Card): number {
    let power = 50;

    // HP contribution
    if (card.hp) {
      power += parseInt(card.hp) / 10;
    }

    // Special subtypes
    if (card.subtypes?.includes('VMAX')) power += 30;
    else if (card.subtypes?.includes('V')) power += 20;
    else if (card.subtypes?.includes('ex')) power += 25;
    else if (card.subtypes?.includes('GX')) power += 20;

    // Attack power
    if (card.attacks && Array.isArray(card.attacks)) {
      const maxDamage = Math.max(...(card.attacks as any[]).map(a => 
        parseInt(a.damage?.replace(/\D/g, '') || '0')
      ));
      power += maxDamage / 10;
    }

    return power;
  }
}