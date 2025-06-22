import { prisma } from '@/server/db/prisma';
import type { Card, Deck, DeckCard, UserCollection, User } from '@prisma/client';
import { DeckArchetype } from '../analysis/types';
import { ArchetypeGenerator } from './archetype-generator';
import { DeckAnalyzer } from '../analysis/deck-analyzer';
import type {
  BuilderConfig,
  DeckRecommendation,
  CardChange,
  RecommendationType,
  ImpactAnalysis,
  AlternativeChange,
  CostBreakdown,
} from './types';

interface CollectionCard extends UserCollection {
  card: Card;
}

interface CollectionAnalysis {
  totalCards: number;
  uniqueCards: number;
  totalValue: number;
  completeSets: string[];
  strongArchetypes: DeckArchetype[];
  missingStaples: Card[];
  tradeableCards: CollectionCard[];
}

/**
 * Builds decks using user's owned card collection
 */
export class CollectionBuilder {
  private archetypeGenerator: ArchetypeGenerator;
  private analyzer: DeckAnalyzer;
  private collectionCache: Map<string, CollectionCard[]> = new Map();

  constructor() {
    this.archetypeGenerator = new ArchetypeGenerator();
    this.analyzer = new DeckAnalyzer();
  }

  /**
   * Build best possible deck from collection
   */
  async buildFromCollection(
    userId: string,
    config: BuilderConfig
  ): Promise<DeckRecommendation> {
    // Load user collection
    const collection = await this.loadUserCollection(userId);
    
    // Analyze collection
    const analysis = await this.analyzeCollection(collection);

    // Find best archetype for collection
    const bestArchetype = await this.findBestArchetypeForCollection(
      collection,
      analysis,
      config
    );

    // Build deck from owned cards
    const deck = await this.buildDeckFromOwnedCards(
      collection,
      bestArchetype,
      config
    );

    // Identify missing cards for optimization
    const missingCards = await this.identifyMissingCards(deck, bestArchetype);

    return {
      ...deck,
      type: RecommendationType.COLLECTION_BUILD,
      reasoning: [
        ...deck.reasoning,
        `Built from your collection of ${analysis.totalCards} cards`,
        `Selected ${bestArchetype} as most viable archetype`,
        analysis.totalValue > 500 ? 'Your collection has high value cards' : 'Budget-friendly collection utilized',
        missingCards.length > 0 ? `${missingCards.length} cards would complete this deck` : 'Deck is complete with owned cards',
      ],
      alternativeOptions: await this.generateCollectionAlternatives(collection, analysis, config),
    };
  }

  /**
   * Find decks that are almost complete
   */
  async findAlmostCompleteDecks(
    userId: string,
    completionThreshold: number = 80
  ): Promise<DeckRecommendation[]> {
    const collection = await this.loadUserCollection(userId);
    const recommendations: DeckRecommendation[] = [];

    // Check each archetype
    for (const archetype of Object.values(DeckArchetype)) {
      const completionRate = await this.calculateArchetypeCompletion(
        collection,
        archetype
      );

      if (completionRate >= completionThreshold) {
        const config: BuilderConfig = {
          userId,
          preferences: {
            favoriteArchetypes: [archetype],
            avoidArchetypes: [],
            playstylePreference: 'balanced',
            complexityPreference: 'moderate',
            budgetFlexibility: 0.5,
          },
          constraints: {
            format: 'Standard' as any,
            onlyOwnedCards: true,
          },
          goals: {
            targetTier: 2,
            learningFocus: false,
            innovationDesired: false,
          },
        };

        const deck = await this.buildDeckFromOwnedCards(collection, archetype, config);
        const missingCards = await this.identifyMissingCards(deck, archetype);

        recommendations.push({
          ...deck,
          reasoning: [
            ...deck.reasoning,
            `${completionRate.toFixed(0)}% complete - only ${missingCards.length} cards needed`,
            `Total cost to complete: $${await this.calculateCompletionCost(missingCards)}`,
          ],
        });
      }
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Optimize collection for specific goals
   */
  async optimizeCollection(
    userId: string,
    goals: string[]
  ): Promise<{
    recommendations: DeckRecommendation[];
    tradeSuggestions: TradeSuggestion[];
    acquisitionTargets: AcquisitionTarget[];
  }> {
    const collection = await this.loadUserCollection(userId);
    const analysis = await this.analyzeCollection(collection);

    // Generate deck recommendations
    const recommendations = await this.generateGoalBasedRecommendations(
      collection,
      analysis,
      goals
    );

    // Find cards to trade away
    const tradeSuggestions = await this.findTradeableCar

(collection, analysis, goals);

    // Find cards to acquire
    const acquisitionTargets = await this.findAcquisitionTargets(
      collection,
      recommendations,
      goals
    );

    return {
      recommendations,
      tradeSuggestions,
      acquisitionTargets,
    };
  }

  /**
   * Generate want list for deck completion
   */
  async generateWantList(
    userId: string,
    targetDeck: Deck & { cards: (DeckCard & { card: Card })[] }
  ): Promise<WantListItem[]> {
    const collection = await this.loadUserCollection(userId);
    const wantList: WantListItem[] = [];

    for (const deckCard of targetDeck.cards) {
      const owned = collection.find(c => c.cardId === deckCard.card.id);
      const ownedQuantity = owned?.quantity || 0;
      const needed = deckCard.quantity - ownedQuantity;

      if (needed > 0) {
        const price = await this.getCardPrice(deckCard.card.id);
        const priority = await this.calculateCardPriority(deckCard.card, targetDeck);

        wantList.push({
          card: deckCard.card,
          quantityNeeded: needed,
          quantityOwned: ownedQuantity,
          estimatedCost: price * needed,
          priority,
          alternatives: await this.findOwnedAlternatives(deckCard.card, collection),
        });
      }
    }

    return wantList.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Load user's collection
   */
  private async loadUserCollection(userId: string): Promise<CollectionCard[]> {
    if (this.collectionCache.has(userId)) {
      return this.collectionCache.get(userId)!;
    }

    const collection = await prisma.userCollection.findMany({
      where: { userId },
      include: { card: true },
    });

    this.collectionCache.set(userId, collection);
    return collection;
  }

  /**
   * Analyze collection for insights
   */
  private async analyzeCollection(collection: CollectionCard[]): Promise<CollectionAnalysis> {
    const totalCards = collection.reduce((sum, c) => sum + c.quantity, 0);
    const uniqueCards = collection.length;
    
    // Calculate total value
    let totalValue = 0;
    for (const item of collection) {
      const price = await this.getCardPrice(item.card.id);
      totalValue += price * item.quantity;
    }

    // Find complete sets
    const completeSets = await this.findCompleteSets(collection);

    // Identify strong archetypes based on owned cards
    const strongArchetypes = await this.identifyStrongArchetypes(collection);

    // Find missing staples
    const missingStaples = await this.findMissingStaples(collection);

    // Find tradeable cards (extras, high value non-used)
    const tradeableCards = this.findTradeableCards(collection);

    return {
      totalCards,
      uniqueCards,
      totalValue,
      completeSets,
      strongArchetypes,
      missingStaples,
      tradeableCards,
    };
  }

  /**
   * Find best archetype based on collection
   */
  private async findBestArchetypeForCollection(
    collection: CollectionCard[],
    analysis: CollectionAnalysis,
    config: BuilderConfig
  ): Promise<DeckArchetype> {
    let bestArchetype = DeckArchetype.MIDRANGE;
    let bestScore = 0;

    for (const archetype of Object.values(DeckArchetype)) {
      // Skip if user wants to avoid
      if (config.preferences.avoidArchetypes.includes(archetype)) continue;

      const score = await this.scoreArchetypeForCollection(
        collection,
        archetype,
        config
      );

      // Bonus for user preferences
      if (config.preferences.favoriteArchetypes.includes(archetype)) {
        score * 1.3;
      }

      // Bonus if identified as strong
      if (analysis.strongArchetypes.includes(archetype)) {
        score * 1.2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestArchetype = archetype;
      }
    }

    return bestArchetype;
  }

  /**
   * Build deck using only owned cards
   */
  private async buildDeckFromOwnedCards(
    collection: CollectionCard[],
    archetype: DeckArchetype,
    config: BuilderConfig
  ): Promise<DeckRecommendation> {
    // Get archetype template
    const template = await this.getArchetypeTemplate(archetype);

    const deckCards: CardChange[] = [];
    const usedCards = new Map<string, number>(); // Track used quantities

    // Add core cards from collection
    for (const requirement of template.coreCards) {
      const owned = collection.find(c => c.cardId === requirement.cardId);
      if (owned) {
        const available = owned.quantity - (usedCards.get(owned.cardId) || 0);
        const toUse = Math.min(available, requirement.minQuantity);
        
        if (toUse > 0) {
          deckCards.push({
            action: 'add',
            card: owned.card,
            quantity: toUse,
            reasoning: requirement.reasoning,
            impact: requirement.importance * 10,
            synergyChanges: [],
          });
          usedCards.set(owned.cardId, (usedCards.get(owned.cardId) || 0) + toUse);
        }
      } else {
        // Try alternatives
        for (const alt of requirement.alternatives) {
          const altOwned = collection.find(c => c.cardId === alt.cardId);
          if (altOwned) {
            const available = altOwned.quantity - (usedCards.get(altOwned.cardId) || 0);
            const toUse = Math.min(available, requirement.minQuantity);
            
            if (toUse > 0) {
              deckCards.push({
                action: 'add',
                card: altOwned.card,
                quantity: toUse,
                reasoning: `Alternative for ${requirement.cardName}`,
                impact: requirement.importance * alt.performanceRatio * 10,
                synergyChanges: [],
              });
              usedCards.set(altOwned.cardId, (usedCards.get(altOwned.cardId) || 0) + toUse);
              break;
            }
          }
        }
      }
    }

    // Add support cards from collection
    for (const support of template.supportCards) {
      const owned = collection.find(c => c.cardId === support.cardId);
      if (owned && deckCards.reduce((sum, c) => sum + c.quantity, 0) < 60) {
        const available = owned.quantity - (usedCards.get(owned.cardId) || 0);
        const toUse = Math.min(available, support.quantity);
        
        if (toUse > 0) {
          deckCards.push({
            action: 'add',
            card: owned.card,
            quantity: toUse,
            reasoning: `Support card for ${archetype}`,
            impact: support.priority === 'essential' ? 8 : 5,
            synergyChanges: [],
          });
          usedCards.set(owned.cardId, (usedCards.get(owned.cardId) || 0) + toUse);
        }
      }
    }

    // Fill remaining slots with best available cards
    const remainingSlots = 60 - deckCards.reduce((sum, c) => sum + c.quantity, 0);
    if (remainingSlots > 0) {
      const fillerCards = await this.findBestFillerCards(
        collection,
        usedCards,
        archetype,
        remainingSlots
      );
      deckCards.push(...fillerCards);
    }

    // Calculate impact and costs
    const impact = await this.calculateCollectionDeckImpact(deckCards, archetype);
    const costs = await this.calculateCollectionDeckCosts(deckCards, collection);

    return {
      id: `collection_${Date.now()}`,
      type: RecommendationType.COLLECTION_BUILD,
      timestamp: new Date(),
      suggestedChanges: deckCards,
      reasoning: [
        `Built ${archetype} deck from your collection`,
        `Using ${deckCards.length} different cards from your collection`,
        `Deck completion: ${((deckCards.reduce((sum, c) => sum + c.quantity, 0) / 60) * 100).toFixed(0)}%`,
      ],
      expectedImpact: impact,
      alternativeOptions: [],
      costAnalysis: costs,
      difficultyRating: 4,
      metaRelevance: 60,
      confidence: 75,
    };
  }

  /**
   * Calculate archetype completion rate
   */
  private async calculateArchetypeCompletion(
    collection: CollectionCard[],
    archetype: DeckArchetype
  ): Promise<number> {
    const template = await this.getArchetypeTemplate(archetype);
    let totalRequired = 0;
    let totalOwned = 0;

    // Check core cards
    for (const requirement of template.coreCards) {
      totalRequired += requirement.minQuantity;
      const owned = collection.find(c => c.cardId === requirement.cardId);
      if (owned) {
        totalOwned += Math.min(owned.quantity, requirement.minQuantity);
      } else {
        // Check alternatives
        for (const alt of requirement.alternatives) {
          const altOwned = collection.find(c => c.cardId === alt.cardId);
          if (altOwned) {
            totalOwned += Math.min(altOwned.quantity, requirement.minQuantity) * alt.performanceRatio;
            break;
          }
        }
      }
    }

    // Check essential support cards
    for (const support of template.supportCards.filter(s => s.priority === 'essential')) {
      totalRequired += support.quantity;
      const owned = collection.find(c => c.cardId === support.cardId);
      if (owned) {
        totalOwned += Math.min(owned.quantity, support.quantity);
      }
    }

    return (totalOwned / totalRequired) * 100;
  }

  /**
   * Helper methods
   */
  private async getCardPrice(cardId: string): Promise<number> {
    const price = await prisma.cardPrice.findFirst({
      where: { cardId },
      orderBy: { updatedAt: 'desc' },
    });
    return price?.marketPrice || 0;
  }

  private async findCompleteSets(collection: CollectionCard[]): Promise<string[]> {
    // Group by set
    const setGroups = new Map<string, CollectionCard[]>();
    for (const item of collection) {
      const setId = item.card.setId;
      if (!setGroups.has(setId)) {
        setGroups.set(setId, []);
      }
      setGroups.get(setId)!.push(item);
    }

    const completeSets: string[] = [];
    
    for (const [setId, cards] of setGroups) {
      const set = await prisma.set.findUnique({ where: { id: setId } });
      if (set && cards.length >= set.totalCards * 0.9) { // 90% complete
        completeSets.push(set.name);
      }
    }

    return completeSets;
  }

  private async identifyStrongArchetypes(
    collection: CollectionCard[]
  ): Promise<DeckArchetype[]> {
    const archetypeScores = new Map<DeckArchetype, number>();

    for (const archetype of Object.values(DeckArchetype)) {
      const score = await this.scoreArchetypeForCollection(
        collection,
        archetype,
        {} as BuilderConfig
      );
      archetypeScores.set(archetype, score);
    }

    // Return top 3 archetypes
    return Array.from(archetypeScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([archetype]) => archetype);
  }

  private async findMissingStaples(collection: CollectionCard[]): Promise<Card[]> {
    // Get common staple cards
    const staples = await prisma.card.findMany({
      where: {
        OR: [
          { name: { in: ["Professor's Research", "Boss's Orders", "Quick Ball"] } },
          { name: { contains: "Energy" }, supertype: 'Energy' },
        ],
      },
    });

    const missingStaples: Card[] = [];
    for (const staple of staples) {
      const owned = collection.find(c => c.cardId === staple.id);
      if (!owned || owned.quantity < 2) {
        missingStaples.push(staple);
      }
    }

    return missingStaples;
  }

  private findTradeableCards(collection: CollectionCard[]): CollectionCard[] {
    return collection.filter(item => {
      // Tradeable if: more than 4 copies, or high value with multiple copies
      return item.quantity > 4 || 
             (item.tradeable && item.quantity > 1);
    });
  }

  private async scoreArchetypeForCollection(
    collection: CollectionCard[],
    archetype: DeckArchetype,
    config: BuilderConfig
  ): Promise<number> {
    const template = await this.getArchetypeTemplate(archetype);
    let score = 0;

    // Score based on owned core cards
    for (const requirement of template.coreCards) {
      const owned = collection.find(c => c.cardId === requirement.cardId);
      if (owned) {
        score += requirement.importance * Math.min(owned.quantity / requirement.minQuantity, 1);
      }
    }

    // Score based on owned support cards
    for (const support of template.supportCards) {
      const owned = collection.find(c => c.cardId === support.cardId);
      if (owned) {
        score += support.priority === 'essential' ? 5 : 2;
      }
    }

    return score;
  }

  private async getArchetypeTemplate(archetype: DeckArchetype): Promise<any> {
    // Would retrieve from archetype generator
    // Simplified for example
    return {
      coreCards: [],
      supportCards: [],
      energyRequirements: {},
      trainerPackage: {},
      techOptions: [],
    };
  }

  private async identifyMissingCards(
    deck: DeckRecommendation,
    archetype: DeckArchetype
  ): Promise<Card[]> {
    const template = await this.getArchetypeTemplate(archetype);
    const missingCards: Card[] = [];

    // Check core cards
    for (const requirement of template.coreCards) {
      const inDeck = deck.suggestedChanges.find(c => c.card.id === requirement.cardId);
      if (!inDeck || inDeck.quantity < requirement.minQuantity) {
        const card = await prisma.card.findUnique({ where: { id: requirement.cardId } });
        if (card) missingCards.push(card);
      }
    }

    return missingCards;
  }

  private async calculateCompletionCost(missingCards: Card[]): Promise<number> {
    let totalCost = 0;
    for (const card of missingCards) {
      totalCost += await this.getCardPrice(card.id);
    }
    return totalCost;
  }

  private async generateCollectionAlternatives(
    collection: CollectionCard[],
    analysis: CollectionAnalysis,
    config: BuilderConfig
  ): Promise<AlternativeChange[]> {
    const alternatives: AlternativeChange[] = [];

    // Alternative 1: Different archetype
    if (analysis.strongArchetypes.length > 1) {
      const altArchetype = analysis.strongArchetypes[1];
      const altDeck = await this.buildDeckFromOwnedCards(collection, altArchetype, config);
      
      alternatives.push({
        changes: altDeck.suggestedChanges,
        totalImpact: 70,
        totalCost: 0, // Using owned cards
        reasoning: `Alternative ${altArchetype} deck from collection`,
        tradeoffs: ['Different playstyle', 'May need different skills'],
      });
    }

    // Alternative 2: Budget completion
    if (analysis.missingStaples.length > 0) {
      const stapleAdditions: CardChange[] = analysis.missingStaples.slice(0, 5).map(card => ({
        action: 'add' as const,
        card,
        quantity: 2,
        reasoning: 'Essential staple card',
        impact: 15,
        synergyChanges: [],
      }));

      alternatives.push({
        changes: stapleAdditions,
        totalImpact: 30,
        totalCost: await this.calculateTotalCost(stapleAdditions),
        reasoning: 'Add missing staples to improve any deck',
        tradeoffs: ['Small investment needed', 'Universal improvements'],
      });
    }

    return alternatives;
  }

  private async generateGoalBasedRecommendations(
    collection: CollectionCard[],
    analysis: CollectionAnalysis,
    goals: string[]
  ): Promise<DeckRecommendation[]> {
    const recommendations: DeckRecommendation[] = [];

    for (const goal of goals) {
      const config: BuilderConfig = {
        userId: collection[0]?.userId || '',
        preferences: {
          favoriteArchetypes: analysis.strongArchetypes,
          avoidArchetypes: [],
          playstylePreference: this.getPlaystyleForGoal(goal),
          complexityPreference: 'moderate',
          budgetFlexibility: 0.3,
        },
        constraints: {
          format: 'Standard' as any,
          onlyOwnedCards: goal.includes('budget'),
        },
        goals: {
          targetTier: goal.includes('competitive') ? 1 : 2,
          tournamentPrep: goal.includes('tournament'),
          learningFocus: goal.includes('learn'),
          innovationDesired: goal.includes('creative'),
        },
      };

      const archetype = await this.findBestArchetypeForCollection(collection, analysis, config);
      const deck = await this.buildDeckFromOwnedCards(collection, archetype, config);
      
      recommendations.push({
        ...deck,
        reasoning: [
          ...deck.reasoning,
          `Optimized for goal: ${goal}`,
        ],
      });
    }

    return recommendations;
  }

  private async findTradeableCards(
    collection: CollectionCard[],
    analysis: CollectionAnalysis,
    goals: string[]
  ): Promise<TradeSuggestion[]> {
    const suggestions: TradeSuggestion[] = [];

    for (const item of analysis.tradeableCards) {
      // Don't trade if needed for goals
      const neededForGoals = await this.isNeededForGoals(item.card, goals);
      if (neededForGoals) continue;

      const value = await this.getCardPrice(item.card.id);
      
      suggestions.push({
        card: item.card,
        quantity: item.quantity - 4, // Keep playset
        estimatedValue: value * (item.quantity - 4),
        reasoning: item.quantity > 4 ? 'Excess copies' : 'High value duplicate',
        targetCards: await this.findGoodTradeTargets(value, goals),
      });
    }

    return suggestions;
  }

  private async findAcquisitionTargets(
    collection: CollectionCard[],
    recommendations: DeckRecommendation[],
    goals: string[]
  ): Promise<AcquisitionTarget[]> {
    const targets: AcquisitionTarget[] = [];
    const neededCards = new Map<string, number>();

    // Collect all needed cards from recommendations
    for (const rec of recommendations) {
      for (const change of rec.suggestedChanges) {
        const owned = collection.find(c => c.cardId === change.card.id);
        const ownedQty = owned?.quantity || 0;
        const needed = change.quantity - ownedQty;
        
        if (needed > 0) {
          neededCards.set(
            change.card.id,
            Math.max(neededCards.get(change.card.id) || 0, needed)
          );
        }
      }
    }

    // Create acquisition targets
    for (const [cardId, quantity] of neededCards) {
      const card = await prisma.card.findUnique({ where: { id: cardId } });
      if (!card) continue;

      const price = await this.getCardPrice(cardId);
      const priority = await this.calculateAcquisitionPriority(card, recommendations);

      targets.push({
        card,
        quantity,
        estimatedCost: price * quantity,
        priority,
        appearsInDecks: recommendations.filter(r => 
          r.suggestedChanges.some(c => c.card.id === cardId)
        ).length,
        alternatives: await this.findAcquisitionAlternatives(card, collection),
      });
    }

    return targets.sort((a, b) => b.priority - a.priority);
  }

  private async findBestFillerCards(
    collection: CollectionCard[],
    usedCards: Map<string, number>,
    archetype: DeckArchetype,
    slots: number
  ): Promise<CardChange[]> {
    const fillers: CardChange[] = [];
    
    // Sort collection by relevance to archetype
    const scoredCards = collection
      .filter(item => {
        const used = usedCards.get(item.cardId) || 0;
        return item.quantity > used;
      })
      .map(item => ({
        item,
        score: this.scoreCardForArchetype(item.card, archetype),
        available: item.quantity - (usedCards.get(item.cardId) || 0),
      }))
      .sort((a, b) => b.score - a.score);

    let slotsRemaining = slots;
    for (const scored of scoredCards) {
      if (slotsRemaining <= 0) break;

      const toAdd = Math.min(scored.available, 4, slotsRemaining);
      if (toAdd > 0) {
        fillers.push({
          action: 'add',
          card: scored.item.card,
          quantity: toAdd,
          reasoning: 'Filler card from collection',
          impact: scored.score,
          synergyChanges: [],
        });
        slotsRemaining -= toAdd;
      }
    }

    return fillers;
  }

  private scoreCardForArchetype(card: Card, archetype: DeckArchetype): number {
    // Simplified scoring based on card type and archetype
    let score = 50;

    // Type matching
    const archetypeTypes: Record<DeckArchetype, string[]> = {
      [DeckArchetype.AGGRO]: ['Lightning', 'Fighting'],
      [DeckArchetype.CONTROL]: ['Water', 'Psychic'],
      [DeckArchetype.COMBO]: ['Fire', 'Dragon'],
      [DeckArchetype.MIDRANGE]: ['Grass', 'Fighting'],
      [DeckArchetype.MILL]: ['Psychic', 'Darkness'],
      [DeckArchetype.STALL]: ['Metal', 'Fairy'],
      [DeckArchetype.TOOLBOX]: ['Colorless'],
      [DeckArchetype.TURBO]: ['Fire', 'Lightning'],
      [DeckArchetype.SPREAD]: ['Psychic', 'Fighting'],
    };

    const preferredTypes = archetypeTypes[archetype] || [];
    if (card.types?.some(t => preferredTypes.includes(t))) {
      score += 20;
    }

    // Trainer cards are generally useful
    if (card.supertype === 'Trainer') {
      score += 15;
    }

    // Energy cards
    if (card.supertype === 'Energy') {
      score += 10;
    }

    return score;
  }

  private async calculateCollectionDeckImpact(
    deckCards: CardChange[],
    archetype: DeckArchetype
  ): Promise<ImpactAnalysis> {
    // Simplified impact for collection decks
    const cardCount = deckCards.reduce((sum, c) => sum + c.quantity, 0);
    const completeness = cardCount / 60;

    return {
      overallImprovement: completeness * 70,
      consistencyChange: completeness * 60,
      powerChange: completeness * 50,
      speedChange: 50, // Neutral
      versatilityChange: 40, // Slightly lower due to limited options
      metaRelevanceChange: 30, // Lower meta relevance
      specificMatchupChanges: [],
    };
  }

  private async calculateCollectionDeckCosts(
    deckCards: CardChange[],
    collection: CollectionCard[]
  ): Promise<CostBreakdown> {
    // Collection decks have no additional cost
    return {
      totalCost: 0,
      addedCost: 0,
      removedValue: 0,
      netCost: 0,
      costPerCard: [],
      budgetFriendlyAlternatives: false,
    };
  }

  private getPlaystyleForGoal(goal: string): 'aggressive' | 'defensive' | 'balanced' | 'combo' {
    if (goal.includes('aggressive') || goal.includes('fast')) return 'aggressive';
    if (goal.includes('control') || goal.includes('defensive')) return 'defensive';
    if (goal.includes('combo')) return 'combo';
    return 'balanced';
  }

  private async isNeededForGoals(card: Card, goals: string[]): Promise<boolean> {
    // Check if card is important for any goal
    for (const goal of goals) {
      if (goal.includes('competitive') && card.subtypes?.some(s => ['V', 'VMAX', 'ex'].includes(s))) {
        return true;
      }
      if (goal.includes('staple') && ['Quick Ball', "Professor's Research", "Boss's Orders"].includes(card.name)) {
        return true;
      }
    }
    return false;
  }

  private async findGoodTradeTargets(value: number, goals: string[]): Promise<Card[]> {
    // Find cards of similar value that match goals
    return prisma.card.findMany({
      where: {
        prices: {
          some: {
            marketPrice: {
              gte: value * 0.8,
              lte: value * 1.2,
            },
          },
        },
      },
      include: {
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      take: 5,
    });
  }

  private async calculateCardPriority(card: Card, deck: Deck): Promise<number> {
    // Priority based on card role and importance
    let priority = 50;

    if (card.supertype === 'Pokémon') {
      if (card.subtypes?.some(s => ['V', 'VMAX', 'ex'].includes(s))) {
        priority += 30; // High-impact Pokemon
      } else {
        priority += 20;
      }
    } else if (card.supertype === 'Trainer') {
      if (card.name.includes('Ball') || card.name.includes('Research')) {
        priority += 25; // Consistency cards
      } else {
        priority += 15;
      }
    } else if (card.supertype === 'Energy') {
      if (card.subtypes?.includes('Special')) {
        priority += 20;
      } else {
        priority += 10;
      }
    }

    return Math.min(100, priority);
  }

  private async findOwnedAlternatives(
    card: Card,
    collection: CollectionCard[]
  ): Promise<Card[]> {
    // Find similar owned cards that could substitute
    return collection
      .filter(item => 
        item.card.supertype === card.supertype &&
        item.card.id !== card.id &&
        item.quantity > 0
      )
      .map(item => item.card)
      .slice(0, 3);
  }

  private async calculateAcquisitionPriority(
    card: Card,
    recommendations: DeckRecommendation[]
  ): Promise<number> {
    // Priority based on how many decks need it and card importance
    const appearanceCount = recommendations.filter(r =>
      r.suggestedChanges.some(c => c.card.id === card.id)
    ).length;

    return Math.min(100, 50 + (appearanceCount * 20));
  }

  private async findAcquisitionAlternatives(
    card: Card,
    collection: CollectionCard[]
  ): Promise<Card[]> {
    // Find cheaper alternatives or owned substitutes
    const owned = await this.findOwnedAlternatives(card, collection);
    
    const cheaper = await prisma.card.findMany({
      where: {
        supertype: card.supertype,
        id: { not: card.id },
        prices: {
          some: {
            marketPrice: { lt: 5 }, // Budget alternatives
          },
        },
      },
      take: 3,
    });

    return [...owned, ...cheaper].slice(0, 5);
  }

  private async calculateTotalCost(changes: CardChange[]): Promise<number> {
    let total = 0;
    for (const change of changes) {
      const price = await this.getCardPrice(change.card.id);
      total += price * change.quantity;
    }
    return total;
  }
}

// Type definitions for collection-specific features
interface TradeSuggestion {
  card: Card;
  quantity: number;
  estimatedValue: number;
  reasoning: string;
  targetCards: Card[];
}

interface AcquisitionTarget {
  card: Card;
  quantity: number;
  estimatedCost: number;
  priority: number;
  appearsInDecks: number;
  alternatives: Card[];
}

interface WantListItem {
  card: Card;
  quantityNeeded: number;
  quantityOwned: number;
  estimatedCost: number;
  priority: number;
  alternatives: Card[];
}