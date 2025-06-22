import { Card, Supertype, Rarity } from '@prisma/client';
import {
  DeckComposition,
  DeckStatistics,
  EnergyCurveData,
  TypeDistribution,
  TrainerBreakdown,
  PokemonRole,
  RarityCount,
  SetCount,
  OwnershipStats,
  PriceStats,
  ConsistencyMetrics,
  ComparativeStats,
  CardEntry,
} from './types';
import { prisma } from '@/server/db/prisma';

export class DeckStatisticsAnalyzer {
  async analyzeDeck(
    deck: DeckComposition,
    userId?: string
  ): Promise<DeckStatistics> {
    const allCards = this.getAllCards(deck);
    
    const [
      energyCurve,
      typeDistribution,
      trainerBreakdown,
      pokemonRoles,
      rarityDistribution,
      setDistribution,
      ownedVsNeeded,
      priceBreakdown,
      consistencyMetrics,
      comparativeAnalysis,
    ] = await Promise.all([
      this.calculateEnergyCurve(deck.mainDeck.pokemon),
      this.calculateTypeDistribution(allCards),
      this.calculateTrainerBreakdown(deck.mainDeck.trainers),
      this.analyzePokemonRoles(deck.mainDeck.pokemon),
      this.calculateRarityDistribution(allCards),
      this.calculateSetDistribution(allCards),
      userId ? this.calculateOwnershipStats(allCards, userId) : this.getDefaultOwnershipStats(),
      this.calculatePriceBreakdown(allCards),
      this.calculateConsistencyMetrics(deck),
      this.performComparativeAnalysis(deck),
    ]);

    return {
      energyCurve,
      typeDistribution,
      trainerBreakdown,
      pokemonRoles,
      rarityDistribution,
      setDistribution,
      ownedVsNeeded,
      priceBreakdown,
      consistencyMetrics,
      comparativeAnalysis,
    };
  }

  private getAllCards(deck: DeckComposition): CardEntry[] {
    return [
      ...deck.mainDeck.pokemon,
      ...deck.mainDeck.trainers,
      ...deck.mainDeck.energy,
    ];
  }

  private calculateEnergyCurve(pokemon: CardEntry[]): EnergyCurveData[] {
    const energyCurve = new Map<number, { count: number; cards: Card[] }>();
    
    pokemon.forEach(entry => {
      const card = entry.card;
      if (card.attacks && Array.isArray(card.attacks)) {
        (card.attacks as any[]).forEach(attack => {
          const cost = attack.cost?.length || 0;
          if (cost > 0) {
            const existing = energyCurve.get(cost) || { count: 0, cards: [] };
            existing.count += entry.quantity;
            existing.cards.push(card);
            energyCurve.set(cost, existing);
          }
        });
      }
    });
    
    // Convert to array and calculate percentages
    const totalAttacks = Array.from(energyCurve.values())
      .reduce((sum, data) => sum + data.count, 0);
    
    return Array.from(energyCurve.entries())
      .map(([cost, data]) => ({
        cost,
        count: data.count,
        percentage: totalAttacks > 0 ? (data.count / totalAttacks) * 100 : 0,
        cards: data.cards,
      }))
      .sort((a, b) => a.cost - b.cost);
  }

  private calculateTypeDistribution(cards: CardEntry[]): TypeDistribution[] {
    const typeCount = new Map<string, number>();
    let totalTypedCards = 0;
    
    cards.forEach(entry => {
      if (entry.card.types && entry.card.types.length > 0) {
        totalTypedCards += entry.quantity;
        entry.card.types.forEach(type => {
          typeCount.set(type, (typeCount.get(type) || 0) + entry.quantity);
        });
      }
    });
    
    return Array.from(typeCount.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalTypedCards > 0 ? (count / totalTypedCards) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateTrainerBreakdown(trainers: CardEntry[]): TrainerBreakdown {
    const breakdown: TrainerBreakdown = {
      draw: 0,
      search: 0,
      disruption: 0,
      utility: 0,
      stadium: 0,
      tool: 0,
    };
    
    trainers.forEach(entry => {
      const card = entry.card;
      const quantity = entry.quantity;
      
      // Categorize based on card name and subtypes
      if (card.subtypes?.includes('Stadium')) {
        breakdown.stadium += quantity;
      } else if (card.subtypes?.includes('Tool')) {
        breakdown.tool += quantity;
      } else if (this.isDrawCard(card)) {
        breakdown.draw += quantity;
      } else if (this.isSearchCard(card)) {
        breakdown.search += quantity;
      } else if (this.isDisruptionCard(card)) {
        breakdown.disruption += quantity;
      } else {
        breakdown.utility += quantity;
      }
    });
    
    return breakdown;
  }

  private analyzePokemonRoles(pokemon: CardEntry[]): PokemonRole[] {
    const roles: Map<string, { count: number; cards: Card[] }> = new Map([
      ['attacker', { count: 0, cards: [] }],
      ['support', { count: 0, cards: [] }],
      ['tech', { count: 0, cards: [] }],
      ['starter', { count: 0, cards: [] }],
    ]);
    
    pokemon.forEach(entry => {
      const card = entry.card;
      const role = this.determinePokemonRole(card);
      
      const roleData = roles.get(role)!;
      roleData.count += entry.quantity;
      roleData.cards.push(card);
    });
    
    return Array.from(roles.entries()).map(([role, data]) => ({
      role: role as 'attacker' | 'support' | 'tech' | 'starter',
      count: data.count,
      cards: data.cards,
    }));
  }

  private calculateRarityDistribution(cards: CardEntry[]): RarityCount[] {
    const rarityCount = new Map<Rarity, number>();
    let totalCards = 0;
    
    cards.forEach(entry => {
      if (entry.card.rarity) {
        rarityCount.set(
          entry.card.rarity,
          (rarityCount.get(entry.card.rarity) || 0) + entry.quantity
        );
        totalCards += entry.quantity;
      }
    });
    
    return Array.from(rarityCount.entries())
      .map(([rarity, count]) => ({
        rarity,
        count,
        percentage: totalCards > 0 ? (count / totalCards) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateSetDistribution(cards: CardEntry[]): SetCount[] {
    const setCount = new Map<string, { name: string; count: number; cards: Card[] }>();
    
    cards.forEach(entry => {
      const setId = entry.card.setId;
      const existing = setCount.get(setId) || {
        name: entry.card.set?.name || setId,
        count: 0,
        cards: [],
      };
      
      existing.count += entry.quantity;
      if (!existing.cards.find(c => c.id === entry.card.id)) {
        existing.cards.push(entry.card);
      }
      
      setCount.set(setId, existing);
    });
    
    return Array.from(setCount.entries())
      .map(([setId, data]) => ({
        setId,
        setName: data.name,
        count: data.count,
        cards: data.cards,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private async calculateOwnershipStats(
    cards: CardEntry[],
    userId: string
  ): Promise<OwnershipStats> {
    // Get user's collection
    const ownedCards = await prisma.userCollection.findMany({
      where: {
        userId,
        cardId: { in: cards.map(c => c.card.id) },
      },
      include: {
        card: {
          include: {
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    
    const ownedMap = new Map(ownedCards.map(oc => [oc.cardId, oc.quantity]));
    
    let owned = 0;
    let needed = 0;
    let ownedValue = 0;
    let neededValue = 0;
    
    cards.forEach(entry => {
      const ownedQuantity = ownedMap.get(entry.card.id) || 0;
      const neededQuantity = Math.max(0, entry.quantity - ownedQuantity);
      
      owned += Math.min(ownedQuantity, entry.quantity);
      needed += neededQuantity;
      
      const price = entry.price || 0;
      ownedValue += Math.min(ownedQuantity, entry.quantity) * price;
      neededValue += neededQuantity * price;
    });
    
    const totalCards = cards.reduce((sum, e) => sum + e.quantity, 0);
    
    return {
      owned,
      needed,
      ownedValue,
      neededValue,
      completionPercentage: totalCards > 0 ? (owned / totalCards) * 100 : 0,
    };
  }

  private getDefaultOwnershipStats(): OwnershipStats {
    return {
      owned: 0,
      needed: 0,
      ownedValue: 0,
      neededValue: 0,
      completionPercentage: 0,
    };
  }

  private calculatePriceBreakdown(cards: CardEntry[]): PriceStats {
    let totalValue = 0;
    const byRarity = new Map<Rarity, number>();
    const cardValues: Array<{ entry: CardEntry; totalValue: number }> = [];
    
    cards.forEach(entry => {
      const cardValue = entry.price * entry.quantity;
      totalValue += cardValue;
      
      if (entry.card.rarity) {
        byRarity.set(
          entry.card.rarity,
          (byRarity.get(entry.card.rarity) || 0) + cardValue
        );
      }
      
      cardValues.push({ entry, totalValue: cardValue });
    });
    
    // Get most expensive cards
    const mostExpensive = cardValues
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10)
      .map(cv => cv.entry);
    
    // Find budget alternatives (would need more sophisticated logic)
    const budgetAlternatives = this.findBudgetAlternatives(mostExpensive);
    
    return {
      totalValue,
      ownedValue: 0, // Will be calculated with ownership data
      neededValue: totalValue, // Will be adjusted with ownership data
      byRarity: Array.from(byRarity.entries()).map(([rarity, value]) => ({
        rarity,
        value,
      })),
      mostExpensive,
      budgetAlternatives,
    };
  }

  private calculateConsistencyMetrics(deck: DeckComposition): ConsistencyMetrics {
    const pokemon = deck.mainDeck.pokemon;
    const totalCards = deck.totalCards;
    
    // Calculate mulligan probability (no basic Pokemon in opening hand)
    const basicPokemonCount = pokemon
      .filter(e => e.card.subtypes?.includes('Basic'))
      .reduce((sum, e) => sum + e.quantity, 0);
    
    const mulliganProbability = this.calculateHypergeometric(
      totalCards,
      basicPokemonCount,
      7,
      0
    );
    
    // Calculate energy draw probability
    const energyCount = deck.energyCount;
    const energyDrawProbability = 1 - this.calculateHypergeometric(
      totalCards,
      energyCount,
      7,
      0
    );
    
    // Calculate key combos probability
    const keyCombosProbability = this.calculateKeyComboProbabilities(deck);
    
    // Calculate setup speed (turns to get main attacker ready)
    const setupSpeed = this.calculateSetupSpeed(deck);
    
    // Calculate recovery potential
    const recoveryPotential = this.calculateRecoveryPotential(deck);
    
    // Calculate overall consistency score
    const score = this.calculateConsistencyScore({
      mulliganProbability,
      energyDrawProbability,
      keyCombosProbability,
      setupSpeed,
      recoveryPotential,
    });
    
    return {
      mulliganProbability: mulliganProbability * 100,
      energyDrawProbability: energyDrawProbability * 100,
      keyCombosProbability,
      setupSpeed,
      recoveryPotential,
      score,
    };
  }

  private async performComparativeAnalysis(
    deck: DeckComposition
  ): Promise<ComparativeStats | undefined> {
    // This would compare against meta decks
    // For now, return undefined
    return undefined;
  }

  // Helper methods
  private isDrawCard(card: Card): boolean {
    const drawKeywords = [
      'draw', 'Research', 'Marnie', 'Cynthia', 'Hop',
      'Juniper', 'Sycamore', 'N', 'Colress', 'Lillie',
    ];
    
    return drawKeywords.some(keyword => 
      card.name.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isSearchCard(card: Card): boolean {
    const searchKeywords = [
      'Ball', 'search', 'Evolution Incense', 'Computer Search',
      'Trainer\'s Mail', 'Adventurer\'s Discovery',
    ];
    
    return searchKeywords.some(keyword => 
      card.name.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isDisruptionCard(card: Card): boolean {
    const disruptionKeywords = [
      'Marnie', 'Reset Stamp', 'Judge', 'Team Flare Grunt',
      'Crushing Hammer', 'Enhanced Hammer', 'Boss\'s Orders',
    ];
    
    return disruptionKeywords.some(keyword => 
      card.name.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private determinePokemonRole(card: Card): string {
    // Check if it's a starter (low cost, basic)
    if (card.subtypes?.includes('Basic') && card.hp && card.hp <= 70) {
      return 'starter';
    }
    
    // Check if it's support (has abilities)
    if (card.abilities && card.abilities.length > 0) {
      return 'support';
    }
    
    // Check if it's tech (specific counter)
    if (card.attacks && (card.attacks as any[]).some(a => 
      a.text?.toLowerCase().includes('weakness') ||
      a.text?.toLowerCase().includes('special energy')
    )) {
      return 'tech';
    }
    
    // Default to attacker
    return 'attacker';
  }

  private findBudgetAlternatives(
    expensiveCards: CardEntry[]
  ): Array<{ original: Card; alternatives: Card[] }> {
    // This would need a sophisticated recommendation system
    // For now, return empty array
    return [];
  }

  private calculateHypergeometric(
    populationSize: number,
    successStates: number,
    sampleSize: number,
    desiredSuccesses: number
  ): number {
    // Hypergeometric distribution calculation
    const choose = (n: number, k: number): number => {
      if (k > n) return 0;
      if (k === 0 || k === n) return 1;
      
      let result = 1;
      for (let i = 0; i < k; i++) {
        result = result * (n - i) / (i + 1);
      }
      return result;
    };
    
    const numerator = choose(successStates, desiredSuccesses) * 
                     choose(populationSize - successStates, sampleSize - desiredSuccesses);
    const denominator = choose(populationSize, sampleSize);
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  private calculateKeyComboProbabilities(
    deck: DeckComposition
  ): Array<{ combo: string; probability: number }> {
    const combos: Array<{ combo: string; probability: number }> = [];
    
    // Example: Calculate probability of getting a basic + energy in opening hand
    const basicCount = deck.mainDeck.pokemon
      .filter(e => e.card.subtypes?.includes('Basic'))
      .reduce((sum, e) => sum + e.quantity, 0);
    
    const prob = 1 - (
      this.calculateHypergeometric(deck.totalCards, basicCount, 7, 0) +
      this.calculateHypergeometric(deck.totalCards, deck.energyCount, 7, 0) -
      this.calculateHypergeometric(deck.totalCards, basicCount + deck.energyCount, 7, 0)
    );
    
    combos.push({
      combo: 'Basic Pokémon + Energy',
      probability: prob * 100,
    });
    
    return combos;
  }

  private calculateSetupSpeed(deck: DeckComposition): number {
    // Simplified calculation based on energy requirements
    const avgEnergyCost = this.calculateAverageEnergyCost(deck.mainDeck.pokemon);
    const energyPerTurn = 1; // Assume 1 energy attachment per turn
    const drawSupport = deck.mainDeck.trainers
      .filter(e => this.isDrawCard(e.card))
      .reduce((sum, e) => sum + e.quantity, 0);
    
    // Factor in draw support for faster setup
    const drawFactor = Math.min(1.5, 1 + drawSupport / 20);
    
    return Math.max(1, Math.ceil(avgEnergyCost / (energyPerTurn * drawFactor)));
  }

  private calculateAverageEnergyCost(pokemon: CardEntry[]): number {
    let totalCost = 0;
    let attackCount = 0;
    
    pokemon.forEach(entry => {
      if (entry.card.attacks && Array.isArray(entry.card.attacks)) {
        (entry.card.attacks as any[]).forEach(attack => {
          if (attack.cost) {
            totalCost += attack.cost.length;
            attackCount++;
          }
        });
      }
    });
    
    return attackCount > 0 ? totalCost / attackCount : 2;
  }

  private calculateRecoveryPotential(deck: DeckComposition): number {
    // Look for recovery cards
    const recoveryCards = [
      'Ordinary Rod', 'Rescue Carrier', 'Super Rod',
      'Pal Pad', 'Energy Recycler', 'Brock\'s Grit',
    ];
    
    const recoveryCount = deck.mainDeck.trainers
      .filter(e => recoveryCards.some(name => e.card.name.includes(name)))
      .reduce((sum, e) => sum + e.quantity, 0);
    
    // Scale from 0-100
    return Math.min(100, recoveryCount * 20);
  }

  private calculateConsistencyScore(metrics: {
    mulliganProbability: number;
    energyDrawProbability: number;
    keyCombosProbability: Array<{ combo: string; probability: number }>;
    setupSpeed: number;
    recoveryPotential: number;
  }): number {
    // Weight different factors
    const mulliganScore = (1 - metrics.mulliganProbability / 100) * 25;
    const energyScore = (metrics.energyDrawProbability / 100) * 20;
    const comboScore = metrics.keyCombosProbability.length > 0
      ? (metrics.keyCombosProbability[0].probability / 100) * 20
      : 10;
    const setupScore = Math.max(0, 20 - metrics.setupSpeed * 4);
    const recoveryScore = (metrics.recoveryPotential / 100) * 15;
    
    return Math.round(mulliganScore + energyScore + comboScore + setupScore + recoveryScore);
  }
}