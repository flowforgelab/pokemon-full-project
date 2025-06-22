import { Card, DeckCard, Supertype } from '@prisma/client';
import type {
  ConsistencyAnalysis,
  EnergyRatioAnalysis,
  TrainerDistribution,
  PokemonRatioAnalysis,
  DeckCurveAnalysis,
  SetupProbability,
  PrizeCardImpact,
  EvolutionLine,
} from './types';

export class ConsistencyCalculator {
  private cards: Map<string, Card & { quantity: number }>;
  private totalCards: number;

  constructor(deckCards: (DeckCard & { card: Card })[]) {
    this.cards = new Map();
    this.totalCards = 0;

    deckCards.forEach(dc => {
      this.cards.set(dc.card.id, {
        ...dc.card,
        quantity: dc.quantity,
      });
      this.totalCards += dc.quantity;
    });
  }

  /**
   * Perform complete consistency analysis
   */
  analyze(): ConsistencyAnalysis {
    const energyRatio = this.analyzeEnergyRatio();
    const trainerDistribution = this.analyzeTrainerDistribution();
    const pokemonRatio = this.analyzePokemonRatio();
    const deckCurve = this.analyzeDeckCurve();
    const mulliganProbability = this.calculateMulliganProbability();
    const setupProbabilities = this.calculateSetupProbabilities();
    const deadDrawProbability = this.calculateDeadDrawProbability();
    const prizeCardImpact = this.analyzePrizeCardImpact();

    // Calculate overall consistency score
    const overallConsistency = this.calculateOverallConsistency({
      energyRatio,
      trainerDistribution,
      pokemonRatio,
      deckCurve,
      mulliganProbability,
      deadDrawProbability,
      prizeCardImpact,
    });

    return {
      energyRatio,
      trainerDistribution,
      pokemonRatio,
      deckCurve,
      mulliganProbability,
      setupProbabilities,
      deadDrawProbability,
      prizeCardImpact,
      overallConsistency,
    };
  }

  /**
   * Analyze energy ratios in the deck
   */
  private analyzeEnergyRatio(): EnergyRatioAnalysis {
    let totalEnergy = 0;
    let basicEnergy = 0;
    let specialEnergy = 0;
    let energySearch = 0;

    this.cards.forEach((card) => {
      if (card.supertype === Supertype.ENERGY) {
        totalEnergy += card.quantity;
        
        // Check if it's basic energy (no abilities or special effects)
        if (this.isBasicEnergy(card)) {
          basicEnergy += card.quantity;
        } else {
          specialEnergy += card.quantity;
        }
      } else if (this.isEnergySearch(card)) {
        energySearch += card.quantity;
      }
    });

    const energyPercentage = (totalEnergy / this.totalCards) * 100;
    const recommendedRange = this.getRecommendedEnergyRange();
    const isOptimal = energyPercentage >= recommendedRange.min && 
                     energyPercentage <= recommendedRange.max;

    return {
      totalEnergy,
      basicEnergy,
      specialEnergy,
      energySearch,
      energyPercentage,
      recommendedRange,
      isOptimal,
    };
  }

  /**
   * Analyze trainer card distribution
   */
  private analyzeTrainerDistribution(): TrainerDistribution {
    let totalTrainers = 0;
    let drawPower = 0;
    let search = 0;
    let disruption = 0;
    let utility = 0;
    let stadiums = 0;
    let tools = 0;
    let supporters = 0;
    let items = 0;

    this.cards.forEach((card) => {
      if (card.supertype === Supertype.TRAINER) {
        totalTrainers += card.quantity;

        // Categorize by subtype
        if (card.subtypes.includes('Supporter')) {
          supporters += card.quantity;
        } else if (card.subtypes.includes('Item')) {
          items += card.quantity;
        } else if (card.subtypes.includes('Stadium')) {
          stadiums += card.quantity;
        } else if (card.subtypes.includes('Tool')) {
          tools += card.quantity;
        }

        // Categorize by function (this would need more detailed card data)
        const category = this.categorizeTrainer(card);
        switch (category) {
          case 'draw':
            drawPower += card.quantity;
            break;
          case 'search':
            search += card.quantity;
            break;
          case 'disruption':
            disruption += card.quantity;
            break;
          case 'utility':
            utility += card.quantity;
            break;
        }
      }
    });

    // Check balance
    const balance = {
      draw: drawPower >= 6,
      search: search >= 4,
      supporters: supporters >= 8 && supporters <= 14,
      items: items >= 15,
      hasStadium: stadiums > 0,
    };

    return {
      totalTrainers,
      drawPower,
      search,
      disruption,
      utility,
      stadiums,
      tools,
      supporters,
      items,
      balance,
    };
  }

  /**
   * Analyze Pokemon ratios and evolution lines
   */
  private analyzePokemonRatio(): PokemonRatioAnalysis {
    let totalPokemon = 0;
    let basics = 0;
    let evolutions = 0;
    let attackers = 0;
    let support = 0;
    const evolutionLineMap = new Map<string, EvolutionLine>();

    this.cards.forEach((card) => {
      if (card.supertype === Supertype.POKEMON) {
        totalPokemon += card.quantity;

        // Count basics vs evolutions
        if (!card.evolvesFrom) {
          basics += card.quantity;
        } else {
          evolutions += card.quantity;
        }

        // Categorize as attacker or support
        if (this.isAttacker(card)) {
          attackers += card.quantity;
        } else {
          support += card.quantity;
        }

        // Track evolution lines
        this.trackEvolutionLine(card, evolutionLineMap);
      }
    });

    const evolutionLines = Array.from(evolutionLineMap.values());
    const pokemonBalance = basics >= 8 && basics <= 20 && 
                          totalPokemon >= 12 && totalPokemon <= 20;

    return {
      totalPokemon,
      basics,
      evolutions,
      attackers,
      support,
      evolutionLines,
      pokemonBalance,
    };
  }

  /**
   * Analyze deck energy curve
   */
  private analyzeDeckCurve(): DeckCurveAnalysis {
    const energyDistribution = new Map<number, number>();
    let totalAttackCost = 0;
    let attackCount = 0;
    let peakEnergyCost = 0;

    this.cards.forEach((card) => {
      if (card.supertype === Supertype.POKEMON && card.attacks) {
        const attacks = card.attacks as any[];
        
        attacks.forEach(attack => {
          const cost = attack.cost?.length || 0;
          if (cost > 0) {
            energyDistribution.set(cost, (energyDistribution.get(cost) || 0) + card.quantity);
            totalAttackCost += cost * card.quantity;
            attackCount += card.quantity;
            peakEnergyCost = Math.max(peakEnergyCost, cost);
          }
        });
      }
    });

    const averageEnergyCost = attackCount > 0 ? totalAttackCost / attackCount : 0;
    const energyEfficiency = this.calculateEnergyEfficiency(averageEnergyCost);
    const accelerationNeeded = peakEnergyCost > 3 || averageEnergyCost > 2.5;
    
    let curve: 'low' | 'balanced' | 'high' = 'balanced';
    if (averageEnergyCost < 2) curve = 'low';
    else if (averageEnergyCost > 3) curve = 'high';

    return {
      averageEnergyCost,
      energyDistribution,
      peakEnergyCost,
      energyEfficiency,
      accelerationNeeded,
      curve,
    };
  }

  /**
   * Calculate mulligan probability
   */
  private calculateMulliganProbability(): number {
    const basicPokemonCount = Array.from(this.cards.values())
      .filter(card => card.supertype === Supertype.POKEMON && !card.evolvesFrom)
      .reduce((sum, card) => sum + card.quantity, 0);

    // Hypergeometric probability of NOT drawing a basic in 7 cards
    return this.hypergeometricProbability(
      this.totalCards,
      basicPokemonCount,
      7,
      0
    );
  }

  /**
   * Calculate setup probabilities for turns 1-3
   */
  private calculateSetupProbabilities(): SetupProbability[] {
    const probabilities: SetupProbability[] = [];

    // Turn 1 setup (basic + energy)
    const turn1Basic = this.calculateDrawProbability(['basic'], 8); // 7 + 1 draw
    const turn1Energy = this.calculateDrawProbability(['energy'], 8);
    probabilities.push({
      turn: 1,
      probability: turn1Basic * turn1Energy,
      keyCards: ['Basic Pokemon', 'Energy'],
      scenario: 'Basic setup with energy attachment',
    });

    // Turn 2 setup (evolution ready)
    const turn2Evolution = this.calculateDrawProbability(['stage1'], 9); // +1 draw
    const turn2Trainer = this.calculateDrawProbability(['search'], 9);
    probabilities.push({
      turn: 2,
      probability: turn2Evolution * turn2Trainer * 0.8, // Factor in previous turn
      keyCards: ['Stage 1 Pokemon', 'Search Cards'],
      scenario: 'Evolution setup with search',
    });

    // Turn 3 full setup
    const turn3Full = this.calculateDrawProbability(['attacker', 'energy', 'energy'], 10);
    probabilities.push({
      turn: 3,
      probability: turn3Full * 0.7, // Factor in previous turns
      keyCards: ['Main Attacker', 'Multiple Energy'],
      scenario: 'Full attacking setup',
    });

    return probabilities;
  }

  /**
   * Calculate dead draw probability
   */
  private calculateDeadDrawProbability(): number {
    // Dead draw = no playable cards (no Pokemon, no draw supporters)
    const playableCards = Array.from(this.cards.values())
      .filter(card => 
        card.supertype === Supertype.POKEMON ||
        this.categorizeTrainer(card) === 'draw'
      )
      .reduce((sum, card) => sum + card.quantity, 0);

    // Probability of drawing no playable cards in hand
    return this.hypergeometricProbability(
      this.totalCards,
      this.totalCards - playableCards,
      7,
      7
    );
  }

  /**
   * Analyze prize card impact
   */
  private analyzePrizeCardImpact(): PrizeCardImpact {
    const criticalCards: string[] = [];
    let totalVulnerability = 0;
    let cardCount = 0;

    this.cards.forEach((card) => {
      // Single copy cards are critical
      if (card.quantity === 1) {
        criticalCards.push(card.name);
        totalVulnerability += 0.1; // 10% chance to prize
      }
      // Low count important cards
      else if (card.quantity === 2 && this.isImportantCard(card)) {
        totalVulnerability += 0.033; // ~3.3% chance to prize both
      }
      cardCount++;
    });

    const keyCardVulnerability = totalVulnerability;
    const averageImpact = totalVulnerability / cardCount;
    const resilience = 100 - (keyCardVulnerability * 100);

    return {
      keyCardVulnerability,
      averageImpact,
      criticalCards,
      resilience,
    };
  }

  /**
   * Calculate overall consistency score
   */
  private calculateOverallConsistency(components: any): number {
    const weights = {
      energy: 0.15,
      trainers: 0.20,
      pokemon: 0.15,
      curve: 0.10,
      mulligan: 0.15,
      deadDraw: 0.15,
      prizes: 0.10,
    };

    let score = 0;

    // Energy score
    score += weights.energy * (components.energyRatio.isOptimal ? 100 : 70);

    // Trainer score
    const trainerScore = Object.values(components.trainerDistribution.balance)
      .filter(Boolean).length / Object.keys(components.trainerDistribution.balance).length * 100;
    score += weights.trainers * trainerScore;

    // Pokemon score
    score += weights.pokemon * (components.pokemonRatio.pokemonBalance ? 100 : 60);

    // Curve score
    score += weights.curve * components.deckCurve.energyEfficiency;

    // Mulligan score (inverse)
    score += weights.mulligan * (100 - components.mulliganProbability * 100);

    // Dead draw score (inverse)
    score += weights.deadDraw * (100 - components.deadDrawProbability * 100);

    // Prize resilience score
    score += weights.prizes * components.prizeCardImpact.resilience;

    return Math.round(score);
  }

  // Helper methods

  private isBasicEnergy(card: Card): boolean {
    const basicEnergyNames = ['Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy'];
    return basicEnergyNames.some(name => card.name.includes(`Basic ${name} Energy`));
  }

  private isEnergySearch(card: Card): boolean {
    if (card.supertype !== Supertype.TRAINER) return false;
    const searchTerms = ['energy', 'Energy'];
    const cardText = JSON.stringify(card);
    return searchTerms.some(term => cardText.toLowerCase().includes(term.toLowerCase()));
  }

  private categorizeTrainer(card: Card): 'draw' | 'search' | 'disruption' | 'utility' {
    const cardText = JSON.stringify(card).toLowerCase();
    
    if (cardText.includes('draw') || cardText.includes('cards from')) return 'draw';
    if (cardText.includes('search') || cardText.includes('look for')) return 'search';
    if (cardText.includes('discard') && cardText.includes('opponent')) return 'disruption';
    
    return 'utility';
  }

  private isAttacker(card: Card): boolean {
    if (!card.attacks) return false;
    const attacks = card.attacks as any[];
    return attacks.some(attack => {
      const damage = parseInt(attack.damage) || 0;
      return damage >= 30;
    });
  }

  private isImportantCard(card: Card): boolean {
    // Cards that are typically important
    return card.supertype === Supertype.POKEMON && this.isAttacker(card) ||
           this.categorizeTrainer(card) === 'search' ||
           this.categorizeTrainer(card) === 'draw';
  }

  private trackEvolutionLine(card: Card, lineMap: Map<string, EvolutionLine>) {
    // This is simplified - would need full evolution data
    if (!card.evolvesFrom) {
      // Basic Pokemon - start of evolution line
      if (!lineMap.has(card.name)) {
        lineMap.set(card.name, {
          basePokemon: card.name,
          stage1: [],
          stage2: [],
          completeness: 100,
          consistency: 100,
        });
      }
    }
  }

  private calculateEnergyEfficiency(averageCost: number): number {
    if (averageCost <= 1.5) return 100;
    if (averageCost <= 2.0) return 90;
    if (averageCost <= 2.5) return 80;
    if (averageCost <= 3.0) return 70;
    return 60;
  }

  private calculateDrawProbability(cardTypes: string[], handSize: number): number {
    // Simplified probability calculation
    // In reality, this would need to check specific card types
    return Math.min(0.95, handSize * 0.1);
  }

  private hypergeometricProbability(
    population: number,
    successes: number,
    draws: number,
    desired: number
  ): number {
    // Hypergeometric distribution calculation
    return this.combination(successes, desired) *
           this.combination(population - successes, draws - desired) /
           this.combination(population, draws);
  }

  private combination(n: number, k: number): number {
    if (k > n || k < 0) return 0;
    if (k === 0 || k === n) return 1;
    
    let result = 1;
    for (let i = 1; i <= k; i++) {
      result *= (n - i + 1) / i;
    }
    return result;
  }

  private getRecommendedEnergyRange(): { min: number; max: number } {
    // This could be more sophisticated based on deck archetype
    return { min: 15, max: 25 };
  }
}