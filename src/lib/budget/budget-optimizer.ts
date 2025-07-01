import type { Card, Deck, DeckCard } from '@prisma/client';
import type { DeckAnalysisResult } from '@/lib/analysis/types';
import { logger } from '@/lib/logger';

interface OptimizationRequest {
  deck: Deck & { cards: (DeckCard & { card: Card & { prices: any[] } })[] };
  budget: number;
  priorityMode: 'power' | 'consistency' | 'speed';
  ownedCards: string[];
  maxChanges: number;
  originalAnalysis: DeckAnalysisResult;
}

interface OptimizationResult {
  optimizedDeck: any;
  totalCost: number;
  changes: DeckChange[];
  warnings: string[];
  tradeoffs: {
    maintained: string[];
    compromised: string[];
    lost: string[];
  };
  recommendation: string;
}

interface DeckChange {
  action: 'replace' | 'remove' | 'add' | 'adjust';
  cardId?: string;
  oldCardId?: string;
  newCardId?: string;
  oldCard?: string;
  newCard?: string;
  quantity?: number;
  oldQuantity?: number;
  newQuantity?: number;
  reason?: string;
  savings?: number;
}

interface CardAlternative {
  card: Card & { prices: any[] };
  price: number;
  performanceLoss: number;
  reason: string;
  similarity: number;
}

interface UpgradeTier {
  name: string;
  budget: number;
  performanceGain: number;
  cards: {
    name: string;
    quantity: number;
    price: number;
    impact: string;
  }[];
  description: string;
}

export class BudgetOptimizer {
  private readonly PRICE_WEIGHT = 0.4;
  private readonly PERFORMANCE_WEIGHT = 0.6;
  
  // Card role classifications for optimization
  private readonly CARD_ROLES = {
    PRIMARY_ATTACKER: ['main attacker', 'primary damage dealer'],
    SECONDARY_ATTACKER: ['backup attacker', 'secondary damage'],
    ENGINE: ['draw support', 'energy acceleration', 'search'],
    UTILITY: ['switch', 'healing', 'stadium'],
    TECH: ['counter', 'meta call', 'situational'],
  };

  /**
   * Optimize a deck for a given budget
   */
  async optimizeDeck(request: OptimizationRequest): Promise<OptimizationResult> {
    const { deck, budget, priorityMode, ownedCards, maxChanges, originalAnalysis } = request;

    logger.info('Starting budget optimization', {
      deckId: deck.id,
      budget,
      priorityMode,
      currentValue: this.calculateDeckValue(deck),
    });

    // Sort cards by optimization priority
    const sortedCards = this.sortCardsByPriority(deck.cards, priorityMode, originalAnalysis);
    
    // Initialize optimization state
    const changes: DeckChange[] = [];
    const optimizedCards = [...deck.cards];
    let currentCost = this.calculateDeckValue(deck);
    let changeCount = 0;

    // Process cards for optimization
    for (const deckCard of sortedCards) {
      if (currentCost <= budget || changeCount >= maxChanges) break;

      const cardPrice = this.getCardPrice(deckCard.card);
      
      // Skip owned cards if specified
      if (ownedCards.includes(deckCard.card.id)) continue;
      
      // Skip essential cards based on role
      if (this.isEssentialCard(deckCard.card, priorityMode)) continue;

      // Find alternatives
      const alternatives = await this.findAlternatives({
        card: deckCard.card,
        maxPrice: cardPrice * 0.7, // Look for 30% cheaper alternatives
        limit: 5,
      });

      if (alternatives.length > 0) {
        const bestAlternative = this.selectBestAlternative(
          alternatives,
          priorityMode,
          budget - (currentCost - cardPrice * deckCard.quantity)
        );

        if (bestAlternative) {
          // Apply change
          const savings = (cardPrice - bestAlternative.price) * deckCard.quantity;
          changes.push({
            action: 'replace',
            oldCardId: deckCard.card.id,
            newCardId: bestAlternative.card.id,
            oldCard: deckCard.card.name,
            newCard: bestAlternative.card.name,
            quantity: deckCard.quantity,
            reason: bestAlternative.reason,
            savings,
          });

          currentCost -= savings;
          changeCount++;

          // Update optimized cards list
          const index = optimizedCards.findIndex(c => c.card.id === deckCard.card.id);
          if (index !== -1) {
            optimizedCards[index] = {
              ...optimizedCards[index],
              card: bestAlternative.card,
            };
          }
        }
      }
    }

    // Generate tradeoffs analysis
    const tradeoffs = this.analyzeTradeoffs(deck.cards, optimizedCards, originalAnalysis);

    // Generate warnings
    const warnings = this.generateWarnings(changes, tradeoffs);

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      currentCost,
      budget,
      changes.length,
      tradeoffs
    );

    return {
      optimizedDeck: {
        ...deck,
        cards: optimizedCards,
        changes,
      },
      totalCost: currentCost,
      changes,
      warnings,
      tradeoffs,
      recommendation,
    };
  }

  /**
   * Find alternatives for a specific card
   */
  async findAlternatives(params: {
    card: Card & { prices?: any[] };
    maxPrice: number;
    limit: number;
  }): Promise<CardAlternative[]> {
    const { card, maxPrice, limit } = params;
    const alternatives: CardAlternative[] = [];

    // This is a simplified implementation
    // In a real app, this would query the database for similar cards
    // based on type, energy cost, effects, etc.

    // Mock alternatives based on card type
    if (card.supertype === 'Trainer') {
      // Trainer alternatives
      if (card.name.includes("Professor's Research")) {
        alternatives.push({
          card: { 
            ...card, 
            id: 'alt-1', 
            name: 'Hop',
            prices: [{ price: 0.25, currency: 'USD', isCurrentPrice: true }]
          } as any,
          price: 0.25,
          performanceLoss: 15,
          reason: 'Draw 3 instead of 7',
          similarity: 0.7,
        });
      } else if (card.name.includes("Boss's Orders")) {
        alternatives.push({
          card: {
            ...card,
            id: 'alt-2',
            name: 'Escape Rope',
            prices: [{ price: 0.50, currency: 'USD', isCurrentPrice: true }]
          } as any,
          price: 0.50,
          performanceLoss: 25,
          reason: 'Both players switch',
          similarity: 0.6,
        });
      }
    } else if (card.supertype === 'Pokémon') {
      // Pokemon alternatives would be based on similar attacks, HP, type, etc.
      // This would require more complex matching logic
    }

    return alternatives.filter(alt => alt.price <= maxPrice).slice(0, limit);
  }

  /**
   * Generate upgrade path for a deck
   */
  async generateUpgradePath(params: {
    deck: Deck & { cards: (DeckCard & { card: Card & { prices: any[] } })[] };
    maxBudget: number;
    steps: number;
  }): Promise<{ tiers: UpgradeTier[] }> {
    const { deck, maxBudget, steps } = params;
    const tiers: UpgradeTier[] = [];

    // Calculate budget increments
    const budgetIncrement = maxBudget / steps;

    // Essential upgrades (Tier 1)
    tiers.push({
      name: 'Essential Upgrades',
      budget: budgetIncrement,
      performanceGain: 15,
      cards: [
        { name: "Professor's Research", quantity: 2, price: 5.00, impact: 'Consistency +10%' },
        { name: 'Quick Ball', quantity: 2, price: 6.00, impact: 'Setup speed +15%' },
      ],
      description: 'Core consistency improvements',
    });

    // Competitive upgrades (Tier 2)
    if (steps >= 2) {
      tiers.push({
        name: 'Competitive Edge',
        budget: budgetIncrement * 2,
        performanceGain: 25,
        cards: [
          { name: 'Path to the Peak', quantity: 2, price: 15.00, impact: 'Meta counter +20%' },
          { name: 'Cross Switcher', quantity: 2, price: 10.00, impact: 'Flexibility +12%' },
        ],
        description: 'Strategic upgrades for competitive play',
      });
    }

    // Add more tiers as needed...

    return { tiers };
  }

  /**
   * Calculate total deck value
   */
  private calculateDeckValue(deck: Deck & { cards: (DeckCard & { card: Card & { prices?: any[] } })[] }): number {
    return deck.cards.reduce((total, dc) => {
      const price = this.getCardPrice(dc.card);
      return total + (price * dc.quantity);
    }, 0);
  }

  /**
   * Get card price (with fallback)
   */
  private getCardPrice(card: Card & { prices?: any[] }): number {
    if (!card.prices || card.prices.length === 0) return 0;
    const usdPrice = card.prices.find(p => p.currency === 'USD' && p.isCurrentPrice);
    return Number(usdPrice?.price || 0);
  }

  /**
   * Sort cards by optimization priority
   */
  private sortCardsByPriority(
    cards: (DeckCard & { card: Card & { prices?: any[] } })[],
    priorityMode: string,
    analysis: DeckAnalysisResult
  ): (DeckCard & { card: Card & { prices?: any[] } })[] {
    return [...cards].sort((a, b) => {
      const priceA = this.getCardPrice(a.card);
      const priceB = this.getCardPrice(b.card);

      // Always prioritize keeping cheaper cards
      if (priorityMode === 'consistency') {
        // Keep trainers and energy, optimize expensive Pokemon
        const typeScoreA = a.card.supertype === 'Trainer' ? 0 : a.card.supertype === 'Energy' ? 1 : 2;
        const typeScoreB = b.card.supertype === 'Trainer' ? 0 : b.card.supertype === 'Energy' ? 1 : 2;
        
        if (typeScoreA !== typeScoreB) return typeScoreA - typeScoreB;
      }

      // Sort by price descending (optimize expensive cards first)
      return priceB - priceA;
    });
  }

  /**
   * Check if a card is essential based on deck strategy
   */
  private isEssentialCard(card: Card, priorityMode: string): boolean {
    // Essential trainers that shouldn't be replaced
    const essentialTrainers = [
      'Professor\'s Research',
      'Boss\'s Orders',
      'Quick Ball',
      'Ultra Ball',
    ];

    if (card.supertype === 'Trainer' && essentialTrainers.some(name => card.name.includes(name))) {
      return priorityMode === 'consistency';
    }

    // Keep all basic energy
    if (card.supertype === 'Energy' && card.subtypes?.includes('Basic')) {
      return true;
    }

    return false;
  }

  /**
   * Select best alternative based on mode
   */
  private selectBestAlternative(
    alternatives: CardAlternative[],
    priorityMode: string,
    remainingBudget: number
  ): CardAlternative | null {
    const affordableAlternatives = alternatives.filter(alt => alt.price <= remainingBudget);
    
    if (affordableAlternatives.length === 0) return null;

    // Score alternatives based on price/performance ratio
    const scored = affordableAlternatives.map(alt => ({
      ...alt,
      score: (alt.similarity * this.PERFORMANCE_WEIGHT) + 
             ((1 - alt.price / remainingBudget) * this.PRICE_WEIGHT),
    }));

    // Sort by score and return best
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  /**
   * Analyze tradeoffs of optimization
   */
  private analyzeTradeoffs(
    originalCards: any[],
    optimizedCards: any[],
    analysis: DeckAnalysisResult
  ): { maintained: string[]; compromised: string[]; lost: string[] } {
    const maintained: string[] = [];
    const compromised: string[] = [];
    const lost: string[] = [];

    // Check what was maintained
    if (optimizedCards.some(c => c.card.supertype === 'Pokémon')) {
      maintained.push('Core Pokemon lineup');
    }
    if (optimizedCards.filter(c => c.card.supertype === 'Trainer').length >= 20) {
      maintained.push('Strong trainer engine');
    }

    // Check what was compromised
    const removedExpensiveCards = originalCards.filter(
      oc => !optimizedCards.find(nc => nc.card.id === oc.card.id) && this.getCardPrice(oc.card) > 10
    );
    
    if (removedExpensiveCards.length > 0) {
      compromised.push('Some premium cards replaced with budget alternatives');
    }

    // Check what was lost
    if (analysis.scores.consistency > 80 && optimizedCards.length < originalCards.length) {
      lost.push('Some deck consistency for cost savings');
    }

    return { maintained, compromised, lost };
  }

  /**
   * Generate optimization warnings
   */
  private generateWarnings(changes: DeckChange[], tradeoffs: any): string[] {
    const warnings: string[] = [];

    if (changes.length > 10) {
      warnings.push('Significant deck changes may require playtesting to ensure synergy');
    }

    if (changes.some(c => c.oldCard?.includes('Boss\'s Orders'))) {
      warnings.push('Replacing gust effects may reduce late-game closing power');
    }

    if (tradeoffs.lost.length > 0) {
      warnings.push('Some competitive advantages were traded for budget considerations');
    }

    return warnings;
  }

  /**
   * Generate recommendation text
   */
  private generateRecommendation(
    finalCost: number,
    budget: number,
    changeCount: number,
    tradeoffs: any
  ): string {
    const savingsPercent = ((budget - finalCost) / budget * 100).toFixed(0);

    if (changeCount === 0) {
      return 'Your deck is already optimized for this budget!';
    }

    if (changeCount <= 5 && tradeoffs.maintained.length > tradeoffs.lost.length) {
      return `Excellent optimization! Made ${changeCount} strategic changes while maintaining core deck strength. You're ${savingsPercent}% under budget.`;
    }

    if (changeCount <= 10) {
      return `Good optimization with ${changeCount} changes. The deck maintains most of its competitive edge while achieving significant savings.`;
    }

    return `Aggressive optimization with ${changeCount} changes. Consider testing thoroughly before competitive play. Saved ${savingsPercent}% from budget target.`;
  }
}