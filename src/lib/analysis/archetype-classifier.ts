import { Card, DeckCard, Supertype } from '@prisma/client';
import type { ArchetypeClassification, DeckArchetype } from './types';

interface ArchetypeFeatures {
  attackerCount: number;
  averageDamage: number;
  setupSpeed: number;
  disruptionCount: number;
  healingCount: number;
  drawPower: number;
  energyAcceleration: number;
  benchSize: number;
  averageRetreatCost: number;
  specialConditions: number;
  millCards: number;
  spreadDamage: number;
  comboComponents: number;
  singlePrizeRatio: number;
}

export class ArchetypeClassifier {
  private cards: Map<string, Card & { quantity: number }>;
  private deckList: (Card & { quantity: number })[];
  private features: ArchetypeFeatures;

  constructor(deckCards: (DeckCard & { card: Card })[]) {
    this.cards = new Map();
    this.deckList = [];

    deckCards.forEach(dc => {
      const cardWithQuantity = {
        ...dc.card,
        quantity: dc.quantity,
      };
      this.cards.set(dc.card.id, cardWithQuantity);
      this.deckList.push(cardWithQuantity);
    });

    this.features = this.extractFeatures();
  }

  /**
   * Classify the deck archetype
   */
  classify(): ArchetypeClassification {
    // Calculate scores for each archetype
    const scores = new Map<DeckArchetype, number>();
    
    scores.set(DeckArchetype.AGGRO, this.calculateAggroScore());
    scores.set(DeckArchetype.CONTROL, this.calculateControlScore());
    scores.set(DeckArchetype.COMBO, this.calculateComboScore());
    scores.set(DeckArchetype.MIDRANGE, this.calculateMidrangeScore());
    scores.set(DeckArchetype.MILL, this.calculateMillScore());
    scores.set(DeckArchetype.STALL, this.calculateStallScore());
    scores.set(DeckArchetype.TOOLBOX, this.calculateToolboxScore());
    scores.set(DeckArchetype.TURBO, this.calculateTurboScore());
    scores.set(DeckArchetype.SPREAD, this.calculateSpreadScore());

    // Find primary archetype
    let primaryArchetype = DeckArchetype.MIDRANGE;
    let highestScore = 0;
    let secondArchetype: DeckArchetype | undefined;
    let secondScore = 0;

    scores.forEach((score, archetype) => {
      if (score > highestScore) {
        secondArchetype = primaryArchetype;
        secondScore = highestScore;
        primaryArchetype = archetype;
        highestScore = score;
      } else if (score > secondScore) {
        secondArchetype = archetype;
        secondScore = score;
      }
    });

    // Calculate confidence
    const confidence = this.calculateConfidence(highestScore, secondScore);

    // Get characteristics
    const characteristics = this.getArchetypeCharacteristics(primaryArchetype);

    // Get playstyle description
    const playstyle = this.getPlaystyleDescription(primaryArchetype);

    return {
      primaryArchetype,
      secondaryArchetype: secondScore > 40 ? secondArchetype : undefined,
      confidence,
      characteristics,
      playstyle,
    };
  }

  /**
   * Extract features from deck
   */
  private extractFeatures(): ArchetypeFeatures {
    let attackerCount = 0;
    let totalDamage = 0;
    let damageCount = 0;
    let disruptionCount = 0;
    let healingCount = 0;
    let drawPower = 0;
    let energyAcceleration = 0;
    let benchSize = 0;
    let totalRetreatCost = 0;
    let retreatCount = 0;
    let specialConditions = 0;
    let millCards = 0;
    let spreadDamage = 0;
    let comboComponents = 0;
    let singlePrizeCount = 0;
    let totalPokemon = 0;

    this.deckList.forEach(card => {
      const cardText = JSON.stringify(card).toLowerCase();

      if (card.supertype === Supertype.POKEMON) {
        totalPokemon += card.quantity;

        // Count single prize Pokemon
        if (!card.subtypes?.some(st => ['V', 'VMAX', 'VSTAR', 'ex', 'GX', 'EX'].includes(st))) {
          singlePrizeCount += card.quantity;
        }

        // Analyze attacks
        if (card.attacks) {
          const attacks = card.attacks as any[];
          let hasGoodAttack = false;

          attacks.forEach(attack => {
            const damage = parseInt(attack.damage) || 0;
            const text = attack.text?.toLowerCase() || '';

            if (damage > 0) {
              totalDamage += damage;
              damageCount++;
              if (damage >= 60) {
                hasGoodAttack = true;
              }
            }

            // Check for special conditions
            if (text.includes('asleep') || text.includes('paralyzed') || 
                text.includes('confused') || text.includes('burned')) {
              specialConditions++;
            }

            // Check for spread damage
            if (text.includes('bench') && (text.includes('damage') || damage > 0)) {
              spreadDamage++;
            }

            // Check for mill
            if (text.includes('discard') && text.includes('opponent') && 
                text.includes('deck')) {
              millCards++;
            }
          });

          if (hasGoodAttack) {
            attackerCount += card.quantity;
          }
        }

        // Analyze abilities
        if (card.abilities) {
          const abilities = card.abilities as any[];
          abilities.forEach(ability => {
            const text = ability.text?.toLowerCase() || '';

            if (text.includes('heal')) {
              healingCount++;
            }
            if (text.includes('prevent') && text.includes('damage')) {
              healingCount++;
            }
            if (!card.attacks || (card.attacks as any[]).length === 0) {
              benchSize++; // Likely a bench sitter
            }
          });
        }

        // Retreat cost
        if (card.convertedRetreatCost !== null && card.convertedRetreatCost !== undefined) {
          totalRetreatCost += card.convertedRetreatCost * card.quantity;
          retreatCount += card.quantity;
        }
      } else if (card.supertype === Supertype.TRAINER) {
        // Disruption
        if (cardText.includes('discard') && cardText.includes('opponent')) {
          disruptionCount += card.quantity;
        }
        if (cardText.includes('shuffle') && cardText.includes('opponent')) {
          disruptionCount += card.quantity;
        }

        // Draw power
        if (cardText.includes('draw')) {
          drawPower += card.quantity;
        }

        // Healing
        if (cardText.includes('heal')) {
          healingCount += card.quantity;
        }

        // Mill
        if (cardText.includes('discard') && cardText.includes('opponent') && 
            cardText.includes('deck')) {
          millCards += card.quantity;
        }

        // Energy acceleration
        if (cardText.includes('attach') && cardText.includes('energy')) {
          energyAcceleration += card.quantity;
        }

        // Combo pieces
        if (card.name.includes('Magnezone') || card.name.includes('Electrode') ||
            card.name.includes('Coalossal') || card.name.includes('Archeops')) {
          comboComponents += card.quantity;
        }
      } else if (card.supertype === Supertype.ENERGY) {
        // Special energy that accelerates
        if (cardText.includes('provides 2') || card.name.includes('Double') ||
            card.name.includes('Twin')) {
          energyAcceleration += card.quantity;
        }
      }
    });

    const averageDamage = damageCount > 0 ? totalDamage / damageCount : 0;
    const averageRetreatCost = retreatCount > 0 ? totalRetreatCost / retreatCount : 0;
    const singlePrizeRatio = totalPokemon > 0 ? singlePrizeCount / totalPokemon : 0;

    // Setup speed (simplified - based on Stage 2 count and energy requirements)
    const stage2Count = this.deckList.filter(card => 
      card.subtypes?.includes('Stage 2')
    ).reduce((sum, card) => sum + card.quantity, 0);
    
    const setupSpeed = 100 - (stage2Count * 15) - (averageRetreatCost * 10);

    return {
      attackerCount,
      averageDamage,
      setupSpeed,
      disruptionCount,
      healingCount,
      drawPower,
      energyAcceleration,
      benchSize,
      averageRetreatCost,
      specialConditions,
      millCards,
      spreadDamage,
      comboComponents,
      singlePrizeRatio,
    };
  }

  /**
   * Calculate archetype scores
   */
  private calculateAggroScore(): number {
    let score = 0;

    // High damage output
    if (this.features.averageDamage >= 120) score += 30;
    else if (this.features.averageDamage >= 90) score += 20;
    else if (this.features.averageDamage >= 60) score += 10;

    // Fast setup
    if (this.features.setupSpeed >= 80) score += 20;
    else if (this.features.setupSpeed >= 60) score += 10;

    // High attacker count
    if (this.features.attackerCount >= 12) score += 20;
    else if (this.features.attackerCount >= 8) score += 10;

    // Low retreat cost
    if (this.features.averageRetreatCost <= 1.5) score += 10;

    // Energy acceleration
    if (this.features.energyAcceleration >= 8) score += 10;

    // Low disruption (aggro focuses on damage)
    if (this.features.disruptionCount <= 2) score += 10;

    return score;
  }

  private calculateControlScore(): number {
    let score = 0;

    // High disruption
    if (this.features.disruptionCount >= 10) score += 30;
    else if (this.features.disruptionCount >= 6) score += 20;
    else if (this.features.disruptionCount >= 3) score += 10;

    // Special conditions
    if (this.features.specialConditions >= 4) score += 20;
    else if (this.features.specialConditions >= 2) score += 10;

    // Healing/damage prevention
    if (this.features.healingCount >= 6) score += 15;
    else if (this.features.healingCount >= 3) score += 8;

    // Lower damage (control wins slowly)
    if (this.features.averageDamage <= 80) score += 10;

    // Good draw power
    if (this.features.drawPower >= 12) score += 10;

    // Single prize attackers
    if (this.features.singlePrizeRatio >= 0.7) score += 15;

    return score;
  }

  private calculateComboScore(): number {
    let score = 0;

    // Combo components
    if (this.features.comboComponents >= 6) score += 30;
    else if (this.features.comboComponents >= 3) score += 20;

    // High damage potential
    if (this.features.averageDamage >= 150) score += 20;
    else if (this.features.averageDamage >= 120) score += 10;

    // Energy acceleration (combos need energy)
    if (this.features.energyAcceleration >= 10) score += 20;
    else if (this.features.energyAcceleration >= 6) score += 10;

    // Draw power (to find pieces)
    if (this.features.drawPower >= 15) score += 15;
    else if (this.features.drawPower >= 10) score += 8;

    // Bench size (combo pieces on bench)
    if (this.features.benchSize >= 4) score += 15;

    return score;
  }

  private calculateMidrangeScore(): number {
    let score = 40; // Base score for balanced decks

    // Balanced damage
    if (this.features.averageDamage >= 70 && this.features.averageDamage <= 110) {
      score += 20;
    }

    // Moderate setup speed
    if (this.features.setupSpeed >= 50 && this.features.setupSpeed <= 75) {
      score += 15;
    }

    // Some disruption
    if (this.features.disruptionCount >= 2 && this.features.disruptionCount <= 6) {
      score += 10;
    }

    // Balanced attacker count
    if (this.features.attackerCount >= 6 && this.features.attackerCount <= 10) {
      score += 15;
    }

    // Mix of prize cards
    if (this.features.singlePrizeRatio >= 0.3 && this.features.singlePrizeRatio <= 0.7) {
      score += 10;
    }

    return score;
  }

  private calculateMillScore(): number {
    let score = 0;

    // Mill cards
    if (this.features.millCards >= 8) score += 40;
    else if (this.features.millCards >= 4) score += 25;
    else if (this.features.millCards >= 2) score += 10;

    // Disruption (mill often disrupts)
    if (this.features.disruptionCount >= 8) score += 20;
    else if (this.features.disruptionCount >= 4) score += 10;

    // Low damage (mill doesn't attack much)
    if (this.features.averageDamage <= 50) score += 15;

    // Healing/stall elements
    if (this.features.healingCount >= 4) score += 15;

    // Control elements
    if (this.features.specialConditions >= 2) score += 10;

    return score;
  }

  private calculateStallScore(): number {
    let score = 0;

    // High healing
    if (this.features.healingCount >= 10) score += 30;
    else if (this.features.healingCount >= 6) score += 20;
    else if (this.features.healingCount >= 3) score += 10;

    // Very low damage
    if (this.features.averageDamage <= 30) score += 20;
    else if (this.features.averageDamage <= 50) score += 10;

    // High disruption
    if (this.features.disruptionCount >= 8) score += 15;

    // Single prize Pokemon
    if (this.features.singlePrizeRatio >= 0.9) score += 20;

    // Special conditions (paralysis/sleep for stalling)
    if (this.features.specialConditions >= 3) score += 15;

    // Low attacker count
    if (this.features.attackerCount <= 4) score += 10;

    return score;
  }

  private calculateToolboxScore(): number {
    let score = 0;

    // Variety of attackers
    const uniqueAttackers = new Set(
      this.deckList.filter(card => 
        card.supertype === Supertype.POKEMON && 
        card.attacks && 
        (card.attacks as any[]).some(a => parseInt(a.damage) >= 60)
      ).map(card => card.name)
    ).size;

    if (uniqueAttackers >= 5) score += 30;
    else if (uniqueAttackers >= 3) score += 20;

    // Single prize attackers (toolbox flexibility)
    if (this.features.singlePrizeRatio >= 0.6) score += 20;

    // Moderate everything
    if (this.features.averageDamage >= 60 && this.features.averageDamage <= 100) {
      score += 15;
    }

    // Some tech cards
    if (this.features.disruptionCount >= 2 && this.features.disruptionCount <= 6) {
      score += 15;
    }

    // Variety of energy types
    const energyTypes = new Set(
      this.deckList.filter(card => card.supertype === Supertype.ENERGY)
        .map(card => card.types?.[0])
        .filter(Boolean)
    ).size;

    if (energyTypes >= 3) score += 20;

    return score;
  }

  private calculateTurboScore(): number {
    let score = 0;

    // Very high energy acceleration
    if (this.features.energyAcceleration >= 15) score += 35;
    else if (this.features.energyAcceleration >= 10) score += 25;
    else if (this.features.energyAcceleration >= 6) score += 15;

    // High damage
    if (this.features.averageDamage >= 150) score += 25;
    else if (this.features.averageDamage >= 120) score += 15;

    // Fast setup
    if (this.features.setupSpeed >= 85) score += 20;

    // Draw power
    if (this.features.drawPower >= 15) score += 10;

    // Focus on few attackers
    if (this.features.attackerCount <= 6 && this.features.attackerCount >= 3) {
      score += 10;
    }

    return score;
  }

  private calculateSpreadScore(): number {
    let score = 0;

    // Spread damage attacks
    if (this.features.spreadDamage >= 6) score += 40;
    else if (this.features.spreadDamage >= 3) score += 25;
    else if (this.features.spreadDamage >= 1) score += 10;

    // Moderate main damage
    if (this.features.averageDamage >= 50 && this.features.averageDamage <= 90) {
      score += 20;
    }

    // Bench targeting abilities
    const benchTargeting = this.deckList.filter(card => {
      const text = JSON.stringify(card).toLowerCase();
      return text.includes('bench') && text.includes('damage');
    }).length;

    if (benchTargeting >= 4) score += 20;

    // Multiple attackers (to spread damage around)
    if (this.features.attackerCount >= 8) score += 10;

    return score;
  }

  /**
   * Calculate confidence in classification
   */
  private calculateConfidence(primaryScore: number, secondaryScore: number): number {
    // Higher primary score = more confidence
    let confidence = Math.min(100, primaryScore);

    // Large gap between primary and secondary = more confidence
    const gap = primaryScore - secondaryScore;
    if (gap >= 30) confidence = Math.min(100, confidence + 20);
    else if (gap >= 20) confidence = Math.min(100, confidence + 10);
    else if (gap <= 10) confidence = Math.max(50, confidence - 20);

    return Math.round(confidence);
  }

  /**
   * Get archetype characteristics
   */
  private getArchetypeCharacteristics(archetype: DeckArchetype): string[] {
    const characteristics: { [key in DeckArchetype]: string[] } = {
      [DeckArchetype.AGGRO]: [
        'Fast, aggressive gameplay',
        'High damage output',
        'Minimal setup time',
        'Pressure from turn 1',
        'Weak to control strategies',
      ],
      [DeckArchetype.CONTROL]: [
        'Disrupts opponent\'s strategy',
        'Wins through resource denial',
        'Heavy use of trainer cards',
        'Longer games',
        'Weak to fast aggro',
      ],
      [DeckArchetype.COMBO]: [
        'Relies on specific card combinations',
        'Explosive turns',
        'Requires setup time',
        'Vulnerable to disruption',
        'High damage ceiling',
      ],
      [DeckArchetype.MIDRANGE]: [
        'Balanced approach',
        'Flexible game plan',
        'Good against most decks',
        'Adapts to opponent',
        'Jack of all trades',
      ],
      [DeckArchetype.MILL]: [
        'Wins by decking out opponent',
        'Minimal attacking',
        'Heavy disruption',
        'Unique win condition',
        'Weak to aggressive decks',
      ],
      [DeckArchetype.STALL]: [
        'Prevents opponent from winning',
        'Heavy healing and protection',
        'Wins in time',
        'Frustrating to play against',
        'Weak to one-shot strategies',
      ],
      [DeckArchetype.TOOLBOX]: [
        'Multiple attackers for different situations',
        'Flexible strategy',
        'Good matchup spread',
        'Requires game knowledge',
        'Can adapt mid-game',
      ],
      [DeckArchetype.TURBO]: [
        'Extremely fast energy acceleration',
        'Powers up one main attacker',
        'Aims for quick knockouts',
        'All-in strategy',
        'Weak to energy denial',
      ],
      [DeckArchetype.SPREAD]: [
        'Damages multiple Pokemon at once',
        'Sets up multiple knockouts',
        'Good against bench-heavy decks',
        'Slower win condition',
        'Weak to healing',
      ],
    };

    return characteristics[archetype] || ['Unknown archetype'];
  }

  /**
   * Get playstyle description
   */
  private getPlaystyleDescription(archetype: DeckArchetype): string {
    const descriptions: { [key in DeckArchetype]: string } = {
      [DeckArchetype.AGGRO]: 'Apply immediate pressure with fast attackers and overwhelm before opponent can set up.',
      [DeckArchetype.CONTROL]: 'Disrupt opponent\'s strategy while slowly building your win condition.',
      [DeckArchetype.COMBO]: 'Set up specific card combinations for powerful, game-winning turns.',
      [DeckArchetype.MIDRANGE]: 'Play flexibly, adapting strategy based on matchup and game state.',
      [DeckArchetype.MILL]: 'Force opponent to run out of cards by discarding from their deck.',
      [DeckArchetype.STALL]: 'Prevent opponent from taking prizes while winning on time or deck out.',
      [DeckArchetype.TOOLBOX]: 'Use different attackers and strategies based on the matchup.',
      [DeckArchetype.TURBO]: 'Accelerate energy as fast as possible to power up big attacks.',
      [DeckArchetype.SPREAD]: 'Damage multiple targets to set up multi-prize turns.',
    };

    return descriptions[archetype] || 'Unique strategy that doesn\'t fit standard archetypes.';
  }
}