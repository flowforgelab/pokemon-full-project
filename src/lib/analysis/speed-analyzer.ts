import { Card, DeckCard, Supertype } from '@prisma/client';
import type {
  SpeedAnalysis,
  PrizeRaceAnalysis,
} from './types';

export class SpeedAnalyzer {
  private cards: Map<string, Card & { quantity: number }>;
  private deckList: (Card & { quantity: number })[];
  private totalCards: number;

  constructor(deckCards: (DeckCard & { card: Card })[]) {
    this.cards = new Map();
    this.deckList = [];
    this.totalCards = 0;

    deckCards.forEach(dc => {
      const cardWithQuantity = {
        ...dc.card,
        quantity: dc.quantity,
      };
      this.cards.set(dc.card.id, cardWithQuantity);
      this.deckList.push(cardWithQuantity);
      this.totalCards += dc.quantity;
    });
  }

  /**
   * Perform complete speed analysis
   */
  analyze(): SpeedAnalysis {
    const averageSetupTurn = this.calculateAverageSetupTurn();
    const energyAttachmentEfficiency = this.calculateEnergyEfficiency();
    const drawPowerRating = this.calculateDrawPower();
    const searchEffectiveness = this.calculateSearchEffectiveness();
    const firstTurnAdvantage = this.calculateFirstTurnAdvantage();
    const prizeRaceSpeed = this.analyzePrizeRace();
    const recoverySpeed = this.calculateRecoverySpeed();
    const lateGameSustainability = this.calculateLateGameSustainability();

    // Determine overall speed category
    const overallSpeed = this.determineOverallSpeed({
      averageSetupTurn,
      energyAttachmentEfficiency,
      drawPowerRating,
      firstTurnAdvantage,
      prizeRaceSpeed,
    });

    return {
      averageSetupTurn,
      energyAttachmentEfficiency,
      drawPowerRating,
      searchEffectiveness,
      firstTurnAdvantage,
      prizeRaceSpeed,
      recoverySpeed,
      lateGameSustainability,
      overallSpeed,
    };
  }

  /**
   * Calculate average turns needed for full setup
   */
  private calculateAverageSetupTurn(): number {
    let setupFactors = 0;
    let totalWeight = 0;

    // Check for setup acceleration cards
    const setupAccelerators = [
      { name: 'Battle VIP Pass', impact: -0.5, weight: 3 },
      { name: 'Quick Ball', impact: -0.3, weight: 2 },
      { name: 'Ultra Ball', impact: -0.3, weight: 2 },
      { name: 'Professor\'s Research', impact: -0.2, weight: 2 },
      { name: 'Irida', impact: -0.4, weight: 2 },
      { name: 'Nest Ball', impact: -0.2, weight: 1 },
    ];

    setupAccelerators.forEach(accelerator => {
      const count = this.countCard(accelerator.name);
      if (count > 0) {
        setupFactors += accelerator.impact * Math.min(count, 4);
        totalWeight += accelerator.weight;
      }
    });

    // Check for evolution requirements
    const evolutionStages = this.getHighestEvolutionStage();
    setupFactors += evolutionStages * 0.5;

    // Check for energy requirements
    const averageEnergyCost = this.getAverageEnergyCost();
    setupFactors += (averageEnergyCost - 1) * 0.3;

    // Base setup turn is 2-3
    const baseSetupTurn = 2.5;
    const adjustedSetupTurn = baseSetupTurn + setupFactors;

    return Math.max(1, Math.round(adjustedSetupTurn * 10) / 10);
  }

  /**
   * Calculate energy attachment efficiency
   */
  private calculateEnergyEfficiency(): number {
    let efficiency = 50; // Base efficiency

    // Energy acceleration cards
    const accelerators = [
      { name: 'Melony', boost: 15 },
      { name: 'Welder', boost: 20 },
      { name: 'Bede', boost: 12 },
      { name: 'Dark Patch', boost: 10 },
      { name: 'Metal Saucer', boost: 10 },
      { name: 'Twin Energy', boost: 8 },
      { name: 'Double Turbo Energy', boost: 8 },
      { name: 'Alpha Tauri', boost: 15 },
    ];

    accelerators.forEach(acc => {
      if (this.hasCard(acc.name)) {
        efficiency += acc.boost;
      }
    });

    // Check for Pokemon abilities that accelerate energy
    const energyAbilities = this.deckList.filter(card => {
      if (card.supertype !== Supertype.POKEMON || !card.abilities) return false;
      const abilities = card.abilities as any[];
      return abilities.some(ability => 
        ability.text?.toLowerCase().includes('attach') && 
        ability.text?.toLowerCase().includes('energy')
      );
    });

    efficiency += energyAbilities.length * 10;

    // Check energy search
    const energySearch = this.countEnergySearch();
    efficiency += Math.min(20, energySearch * 5);

    // Check for energy recycling
    const energyRecycling = this.countEnergyRecycling();
    efficiency += Math.min(10, energyRecycling * 3);

    return Math.min(100, efficiency);
  }

  /**
   * Calculate draw power rating
   */
  private calculateDrawPower(): number {
    let drawPower = 0;

    // Supporter draw cards
    const drawSupporters = [
      { name: 'Professor\'s Research', power: 7, maxCount: 4 },
      { name: 'Marnie', power: 5, maxCount: 4 },
      { name: 'Judge', power: 4, maxCount: 4 },
      { name: 'Cynthia', power: 6, maxCount: 4 },
      { name: 'Hop', power: 3, maxCount: 4 },
      { name: 'Iono', power: 5, maxCount: 4 },
      { name: 'Colress\'s Experiment', power: 6, maxCount: 4 },
    ];

    drawSupporters.forEach(supporter => {
      const count = Math.min(this.countCard(supporter.name), supporter.maxCount);
      drawPower += count * supporter.power;
    });

    // Item draw cards
    const drawItems = [
      { name: 'Acro Bike', power: 2 },
      { name: 'Cram-o-matic', power: 3 },
      { name: 'Trainers\' Mail', power: 2 },
    ];

    drawItems.forEach(item => {
      const count = this.countCard(item.name);
      drawPower += count * item.power;
    });

    // Pokemon draw abilities
    const drawAbilities = this.deckList.filter(card => {
      if (card.supertype !== Supertype.POKEMON || !card.abilities) return false;
      const abilities = card.abilities as any[];
      return abilities.some(ability => 
        ability.text?.toLowerCase().includes('draw')
      );
    });

    drawPower += drawAbilities.reduce((sum, card) => sum + card.quantity * 4, 0);

    // Normalize to 0-100 scale
    return Math.min(100, drawPower * 2);
  }

  /**
   * Calculate search effectiveness
   */
  private calculateSearchEffectiveness(): number {
    let searchPower = 0;

    // Pokemon search
    const pokemonSearch = [
      { name: 'Quick Ball', power: 10 },
      { name: 'Ultra Ball', power: 9 },
      { name: 'Level Ball', power: 7 },
      { name: 'Evolution Incense', power: 6 },
      { name: 'Nest Ball', power: 5 },
      { name: 'Battle VIP Pass', power: 8 },
      { name: 'Capturing Aroma', power: 6 },
    ];

    pokemonSearch.forEach(search => {
      const count = this.countCard(search.name);
      searchPower += count * search.power;
    });

    // Trainer search
    const trainerSearch = [
      { name: 'Trainers\' Mail', power: 4 },
      { name: 'Peonia', power: 5 },
      { name: 'Teammates', power: 6 },
      { name: 'Guzma & Hala', power: 5 },
    ];

    trainerSearch.forEach(search => {
      const count = this.countCard(search.name);
      searchPower += count * search.power;
    });

    // Energy search
    const energySearchPower = this.countEnergySearch() * 3;
    searchPower += energySearchPower;

    // Specific card tutors
    const tutors = this.deckList.filter(card => {
      const text = JSON.stringify(card).toLowerCase();
      return text.includes('search') && text.includes('deck');
    });

    searchPower += tutors.length * 5;

    return Math.min(100, searchPower);
  }

  /**
   * Calculate first turn advantage probability
   */
  private calculateFirstTurnAdvantage(): number {
    let advantage = 50; // Base

    // Turn 1 playable cards
    const turn1Cards = [
      { name: 'Battle VIP Pass', boost: 20 },
      { name: 'Snorlax', boost: 10 }, // Gormandize
      { name: 'Comfey', boost: 15 }, // Flower Selecting
      { name: 'Quick Ball', boost: 5 },
      { name: 'Energy Search', boost: 3 },
    ];

    turn1Cards.forEach(card => {
      if (this.hasCard(card.name)) {
        advantage += card.boost;
      }
    });

    // Check for basic Pokemon count
    const basicCount = this.deckList
      .filter(card => card.supertype === Supertype.POKEMON && !card.evolvesFrom)
      .reduce((sum, card) => sum + card.quantity, 0);

    if (basicCount >= 12) advantage += 10;
    else if (basicCount >= 8) advantage += 5;
    else advantage -= 10;

    // Check for low retreat cost basics
    const lowRetreatBasics = this.deckList.filter(card => 
      card.supertype === Supertype.POKEMON && 
      !card.evolvesFrom &&
      (card.convertedRetreatCost || 0) <= 1
    ).reduce((sum, card) => sum + card.quantity, 0);

    advantage += Math.min(10, lowRetreatBasics * 2);

    return Math.min(100, Math.max(0, advantage));
  }

  /**
   * Analyze prize race speed
   */
  private analyzePrizeRace(): PrizeRaceAnalysis {
    const attackers = this.getMainAttackers();
    let totalDamage = 0;
    let attackerCount = 0;
    let maxDamage = 0;

    attackers.forEach(attacker => {
      const attacks = attacker.card.attacks as any[];
      attacks.forEach(attack => {
        const damage = parseInt(attack.damage) || 0;
        if (damage > 0) {
          totalDamage += damage * attacker.quantity;
          attackerCount += attacker.quantity;
          maxDamage = Math.max(maxDamage, damage);
        }
      });
    });

    const averageDamage = attackerCount > 0 ? totalDamage / attackerCount : 0;
    const averagePrizesPerTurn = averageDamage / 120; // Assuming 120 HP average

    // Check for OHKO capability
    const ohkoCapability = maxDamage >= 280; // Can OHKO VMAXes

    // Check for 2HKO reliability
    const twoHitDamage = averageDamage * 2;
    const twoHitKoReliability = Math.min(100, (twoHitDamage / 280) * 100);

    // Comeback potential
    let comebackPotential = 50;
    
    // Single prize attackers help comeback potential
    const singlePrizeAttackers = attackers.filter(a => 
      !a.card.subtypes?.some(st => ['V', 'VMAX', 'VSTAR', 'ex'].includes(st))
    ).length;
    
    comebackPotential += singlePrizeAttackers * 10;

    // N or Reset Stamp for comeback
    if (this.hasCard('N') || this.hasCard('Reset Stamp')) {
      comebackPotential += 15;
    }

    // Boss's Orders for targeted KOs
    if (this.hasCard('Boss\'s Orders')) {
      comebackPotential += 10;
    }

    return {
      averagePrizesPerTurn: Math.round(averagePrizesPerTurn * 10) / 10,
      damageOutput: averageDamage,
      ohkoCapability,
      twoHitKoReliability,
      comebackPotential: Math.min(100, comebackPotential),
    };
  }

  /**
   * Calculate recovery speed after knockouts
   */
  private calculateRecoverySpeed(): number {
    let recoverySpeed = 50; // Base

    // Recovery cards
    const recoveryCards = [
      { name: 'Rescue Carrier', boost: 10 },
      { name: 'Ordinary Rod', boost: 8 },
      { name: 'Super Rod', boost: 8 },
      { name: 'Klara', boost: 12 },
      { name: 'Miriam', boost: 10 },
      { name: 'Revive', boost: 6 },
    ];

    recoveryCards.forEach(card => {
      const count = this.countCard(card.name);
      recoverySpeed += count * card.boost;
    });

    // Check for bench size
    const benchSitters = this.deckList.filter(card =>
      card.supertype === Supertype.POKEMON &&
      card.abilities &&
      !this.isMainAttacker(card)
    ).reduce((sum, card) => sum + card.quantity, 0);

    // More bench Pokemon = better recovery
    recoverySpeed += Math.min(20, benchSitters * 3);

    // Check for backup attackers
    const attackers = this.getMainAttackers();
    if (attackers.length >= 3) {
      recoverySpeed += 15;
    } else if (attackers.length >= 2) {
      recoverySpeed += 8;
    }

    return Math.min(100, recoverySpeed);
  }

  /**
   * Calculate late game sustainability
   */
  private calculateLateGameSustainability(): number {
    let sustainability = 50; // Base

    // Energy recycling
    const energyRecycling = this.countEnergyRecycling();
    sustainability += energyRecycling * 8;

    // Draw power that doesn't rely on hand size
    if (this.hasCard('Professor\'s Research') || this.hasCard('Colress\'s Experiment')) {
      sustainability += 10;
    }

    // Late game shuffle draw
    if (this.hasCard('Cynthia') || this.hasCard('Judge')) {
      sustainability += 8;
    }

    // Resource management
    const resourceManagement = [
      'Pal Pad',
      'VS Seeker',
      'Trainers\' Mail',
      'Dowsing Machine',
    ];

    resourceManagement.forEach(card => {
      if (this.hasCard(card)) {
        sustainability += 10;
      }
    });

    // Check deck thickness (more cards = better late game)
    if (this.totalCards === 60) {
      sustainability += 5;
    }

    // Single prize attackers for late game
    const singlePrizeAttackers = this.getMainAttackers().filter(a => 
      !a.card.subtypes?.some(st => ['V', 'VMAX', 'VSTAR', 'ex'].includes(st))
    ).length;

    sustainability += singlePrizeAttackers * 5;

    return Math.min(100, sustainability);
  }

  /**
   * Determine overall deck speed
   */
  private determineOverallSpeed(factors: {
    averageSetupTurn: number;
    energyAttachmentEfficiency: number;
    drawPowerRating: number;
    firstTurnAdvantage: number;
    prizeRaceSpeed: PrizeRaceAnalysis;
  }): 'slow' | 'medium' | 'fast' | 'turbo' {
    // Calculate speed score
    let speedScore = 0;

    // Setup speed (inverse relationship)
    speedScore += (4 - factors.averageSetupTurn) * 20;

    // Energy efficiency
    speedScore += factors.energyAttachmentEfficiency * 0.15;

    // Draw power
    speedScore += factors.drawPowerRating * 0.15;

    // First turn advantage
    speedScore += factors.firstTurnAdvantage * 0.1;

    // Prize race speed
    speedScore += factors.prizeRaceSpeed.averagePrizesPerTurn * 25;

    // Determine category
    if (speedScore >= 85) return 'turbo';
    if (speedScore >= 65) return 'fast';
    if (speedScore >= 45) return 'medium';
    return 'slow';
  }

  // Helper methods

  private countCard(cardName: string): number {
    return this.deckList
      .filter(card => card.name.includes(cardName))
      .reduce((sum, card) => sum + card.quantity, 0);
  }

  private hasCard(cardName: string): boolean {
    return this.deckList.some(card => card.name.includes(cardName));
  }

  private getHighestEvolutionStage(): number {
    let highest = 0;
    
    this.deckList.forEach(card => {
      if (card.supertype === Supertype.POKEMON) {
        if (card.subtypes?.includes('Stage 2')) {
          highest = Math.max(highest, 2);
        } else if (card.subtypes?.includes('Stage 1')) {
          highest = Math.max(highest, 1);
        }
      }
    });

    return highest;
  }

  private getAverageEnergyCost(): number {
    let totalCost = 0;
    let attackCount = 0;

    this.deckList.forEach(card => {
      if (card.supertype === Supertype.POKEMON && card.attacks) {
        const attacks = card.attacks as any[];
        attacks.forEach(attack => {
          if (attack.cost) {
            totalCost += attack.cost.length;
            attackCount++;
          }
        });
      }
    });

    return attackCount > 0 ? totalCost / attackCount : 0;
  }

  private countEnergySearch(): number {
    const energySearchCards = [
      'Energy Search',
      'Energy Spinner',
      'Professor\'s Letter',
      'Energy Loto',
      'Lady',
    ];

    return energySearchCards.reduce((sum, cardName) => 
      sum + this.countCard(cardName), 0
    );
  }

  private countEnergyRecycling(): number {
    const recyclingCards = [
      'Energy Recycler',
      'Energy Retrieval',
      'Superior Energy Retrieval',
      'Ordinary Rod',
      'Super Rod',
      'Fisherman',
    ];

    return recyclingCards.reduce((sum, cardName) => 
      sum + this.countCard(cardName), 0
    );
  }

  private getMainAttackers(): { card: Card & { quantity: number }; quantity: number }[] {
    return this.deckList
      .filter(card => this.isMainAttacker(card))
      .map(card => ({ card, quantity: card.quantity }));
  }

  private isMainAttacker(card: Card): boolean {
    if (card.supertype !== Supertype.POKEMON || !card.attacks) return false;
    
    const attacks = card.attacks as any[];
    return attacks.some(attack => {
      const damage = parseInt(attack.damage) || 0;
      return damage >= 60; // Minimum damage threshold for main attacker
    });
  }
}