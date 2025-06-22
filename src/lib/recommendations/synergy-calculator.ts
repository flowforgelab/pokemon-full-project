import type { Card } from '@prisma/client';
import type {
  SynergyMatrix,
  SynergyScore,
  SynergyType,
  ComboChain,
  AntiSynergy,
} from './types';

/**
 * Advanced synergy calculation system for card interactions
 */
export class SynergyCalculator {
  private synergyRules: Map<string, SynergyRule[]> = new Map();
  private comboPatterns: ComboPattern[] = [];

  constructor() {
    this.initializeSynergyRules();
    this.initializeComboPatterns();
  }

  /**
   * Calculate complete synergy matrix for a deck
   */
  calculateSynergyMatrix(cards: Card[]): SynergyMatrix {
    const cardPairs = new Map<string, Map<string, SynergyScore>>();
    const combos: ComboChain[] = [];
    const antiSynergies: AntiSynergy[] = [];

    // Calculate pairwise synergies
    for (let i = 0; i < cards.length; i++) {
      const card1 = cards[i];
      if (!cardPairs.has(card1.id)) {
        cardPairs.set(card1.id, new Map());
      }

      for (let j = i + 1; j < cards.length; j++) {
        const card2 = cards[j];
        
        const synergy = this.calculatePairSynergy(card1, card2);
        cardPairs.get(card1.id)!.set(card2.id, synergy);

        // Check for anti-synergies
        if (synergy.score < -0.3) {
          antiSynergies.push({
            card1Id: card1.id,
            card2Id: card2.id,
            severity: Math.abs(synergy.score) * 10,
            reasoning: synergy.description,
            canCoexist: synergy.score > -0.7,
          });
        }
      }
    }

    // Find combo chains
    combos.push(...this.findComboChains(cards));

    // Calculate overall coherence
    const overallCoherence = this.calculateOverallCoherence(cardPairs, cards.length);

    return {
      cardPairs,
      combos,
      antiSynergies,
      overallCoherence,
    };
  }

  /**
   * Calculate synergy between two cards
   */
  calculatePairSynergy(card1: Card, card2: Card): SynergyScore {
    let totalScore = 0;
    const synergies: { type: SynergyType; score: number; description: string }[] = [];

    // Check ability synergies
    const abilitySynergy = this.checkAbilitySynergy(card1, card2);
    if (abilitySynergy.score !== 0) {
      synergies.push(abilitySynergy);
      totalScore += abilitySynergy.score;
    }

    // Check type synergies
    const typeSynergy = this.checkTypeSynergy(card1, card2);
    if (typeSynergy.score !== 0) {
      synergies.push(typeSynergy);
      totalScore += typeSynergy.score;
    }

    // Check energy synergies
    const energySynergy = this.checkEnergySynergy(card1, card2);
    if (energySynergy.score !== 0) {
      synergies.push(energySynergy);
      totalScore += energySynergy.score;
    }

    // Check strategy synergies
    const strategySynergy = this.checkStrategySynergy(card1, card2);
    if (strategySynergy.score !== 0) {
      synergies.push(strategySynergy);
      totalScore += strategySynergy.score;
    }

    // Check search/setup synergies
    const searchSynergy = this.checkSearchSynergy(card1, card2);
    if (searchSynergy.score !== 0) {
      synergies.push(searchSynergy);
      totalScore += searchSynergy.score;
    }

    // Check combo potential
    const comboScore = this.checkComboPotential(card1, card2);
    if (comboScore > 0) {
      totalScore += comboScore * 0.2;
    }

    // Determine primary synergy type
    const primarySynergy = synergies.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];

    return {
      card1Id: card1.id,
      card2Id: card2.id,
      score: Math.max(-1, Math.min(1, totalScore)),
      type: primarySynergy?.type || SynergyType.STRATEGY,
      description: this.generateSynergyDescription(card1, card2, synergies),
      comboRating: comboScore,
    };
  }

  /**
   * Find combo chains in the deck
   */
  findComboChains(cards: Card[]): ComboChain[] {
    const chains: ComboChain[] = [];

    for (const pattern of this.comboPatterns) {
      const matchingChains = this.findPatternMatches(cards, pattern);
      chains.push(...matchingChains);
    }

    // Sort by impact and reliability
    return chains.sort((a, b) => (b.impact * b.reliability) - (a.impact * a.reliability));
  }

  /**
   * Check ability synergies between cards
   */
  private checkAbilitySynergy(card1: Card, card2: Card): {
    type: SynergyType;
    score: number;
    description: string;
  } {
    let score = 0;
    const descriptions: string[] = [];

    // Both have abilities
    if (card1.abilities?.length && card2.abilities?.length) {
      for (const ability1 of card1.abilities as any[]) {
        for (const ability2 of card2.abilities as any[]) {
          // Check for draw synergies
          if (ability1.text?.includes('draw') && ability2.text?.includes('draw')) {
            score += 0.3;
            descriptions.push('Both provide card draw');
          }

          // Check for energy acceleration
          if (ability1.text?.includes('Energy') && ability2.text?.includes('Energy')) {
            score += 0.4;
            descriptions.push('Energy acceleration combo');
          }

          // Check for damage boost
          if ((ability1.text?.includes('damage') && ability2.text?.includes('more damage')) ||
              (ability2.text?.includes('damage') && ability1.text?.includes('more damage'))) {
            score += 0.5;
            descriptions.push('Damage amplification synergy');
          }

          // Check for protection synergies
          if ((ability1.text?.includes('prevent') || ability1.text?.includes('reduce')) &&
              (ability2.text?.includes('prevent') || ability2.text?.includes('reduce'))) {
            score += 0.3;
            descriptions.push('Defensive synergy');
          }
        }
      }
    }

    // Check ability + trainer synergies
    if (card1.abilities?.length && card2.supertype === 'Trainer') {
      if (card2.text?.includes('Ability') || card2.text?.includes('abilities')) {
        score += 0.4;
        descriptions.push('Trainer enhances abilities');
      }
    }

    return {
      type: SynergyType.ABILITY,
      score: Math.min(1, score),
      description: descriptions.join(', ') || 'No ability synergy',
    };
  }

  /**
   * Check type synergies
   */
  private checkTypeSynergy(card1: Card, card2: Card): {
    type: SynergyType;
    score: number;
    description: string;
  } {
    let score = 0;
    const descriptions: string[] = [];

    // Pokemon type matching
    if (card1.types && card2.types) {
      const sharedTypes = card1.types.filter(t => card2.types?.includes(t));
      if (sharedTypes.length > 0) {
        score += 0.3 * sharedTypes.length;
        descriptions.push(`Share ${sharedTypes.join(', ')} type(s)`);
      }
    }

    // Energy type matching with Pokemon
    if (card1.supertype === 'Pokémon' && card2.supertype === 'Energy') {
      if (card1.types?.some(t => card2.name.toLowerCase().includes(t.toLowerCase()))) {
        score += 0.5;
        descriptions.push('Energy matches Pokemon type');
      }
    }

    // Trainer type support
    if (card1.supertype === 'Pokémon' && card2.supertype === 'Trainer') {
      if (card2.text && card1.types?.some(t => card2.text.toLowerCase().includes(t.toLowerCase()))) {
        score += 0.4;
        descriptions.push('Trainer supports Pokemon type');
      }
    }

    // Weakness coverage
    if (card1.supertype === 'Pokémon' && card2.supertype === 'Pokémon') {
      if (card1.weaknesses && card2.resistances) {
        const covered = card1.weaknesses.some((w: any) => 
          card2.resistances?.some((r: any) => r.type === w.type)
        );
        if (covered) {
          score += 0.3;
          descriptions.push('Covers weakness');
        }
      }
    }

    return {
      type: SynergyType.TYPE,
      score: Math.min(1, score),
      description: descriptions.join(', ') || 'No type synergy',
    };
  }

  /**
   * Check energy synergies
   */
  private checkEnergySynergy(card1: Card, card2: Card): {
    type: SynergyType;
    score: number;
    description: string;
  } {
    let score = 0;
    const descriptions: string[] = [];

    // Energy acceleration
    if (card1.text?.includes('attach') && card1.text.includes('Energy')) {
      if (card2.supertype === 'Pokémon' && card2.attacks?.length) {
        score += 0.4;
        descriptions.push('Accelerates energy for attacks');
      }
    }

    // Special energy synergies
    if (card1.supertype === 'Energy' && card1.subtypes?.includes('Special')) {
      if (card2.text?.includes('Special Energy')) {
        score += 0.5;
        descriptions.push('Special energy synergy');
      }
    }

    // Energy recovery
    if (card1.text?.includes('Energy') && card1.text?.includes('discard pile')) {
      if (card2.supertype === 'Pokémon' && card2.attacks?.some((a: any) => 
        a.cost?.length > 2
      )) {
        score += 0.3;
        descriptions.push('Energy recovery for heavy attackers');
      }
    }

    // Energy efficiency
    if (card1.abilities?.some((a: any) => a.text?.includes('less Energy'))) {
      if (card2.supertype === 'Pokémon') {
        score += 0.4;
        descriptions.push('Reduces energy requirements');
      }
    }

    return {
      type: SynergyType.ENERGY,
      score: Math.min(1, score),
      description: descriptions.join(', ') || 'No energy synergy',
    };
  }

  /**
   * Check strategy synergies
   */
  private checkStrategySynergy(card1: Card, card2: Card): {
    type: SynergyType;
    score: number;
    description: string;
  } {
    let score = 0;
    const descriptions: string[] = [];

    // Mill strategy
    if ((card1.text?.includes('discard') && card1.text?.includes("opponent's deck")) ||
        (card2.text?.includes('discard') && card2.text?.includes("opponent's deck"))) {
      if ((card1.text?.includes('discard') && card1.text?.includes("opponent's deck")) &&
          (card2.text?.includes('discard') && card2.text?.includes("opponent's deck"))) {
        score += 0.6;
        descriptions.push('Mill strategy synergy');
      }
    }

    // Spread damage
    if (card1.attacks?.some((a: any) => a.text?.includes('all')) || 
        card2.attacks?.some((a: any) => a.text?.includes('all'))) {
      if (card1.text?.includes('damage counter') || card2.text?.includes('damage counter')) {
        score += 0.5;
        descriptions.push('Spread damage synergy');
      }
    }

    // Control elements
    if ((card1.text?.includes('switch') || card1.text?.includes('retreat')) &&
        (card2.text?.includes('switch') || card2.text?.includes('retreat'))) {
      score += 0.4;
      descriptions.push('Control synergy');
    }

    // Status conditions
    const statuses = ['Asleep', 'Burned', 'Confused', 'Paralyzed', 'Poisoned'];
    const card1Status = statuses.find(s => card1.text?.includes(s));
    const card2Status = statuses.find(s => card2.text?.includes(s));
    
    if (card1Status && card2Status) {
      if (card1Status === card2Status) {
        score += 0.4;
        descriptions.push(`${card1Status} condition synergy`);
      } else {
        score += 0.2;
        descriptions.push('Multiple status conditions');
      }
    }

    return {
      type: SynergyType.STRATEGY,
      score: Math.min(1, score),
      description: descriptions.join(', ') || 'No strategy synergy',
    };
  }

  /**
   * Check search and setup synergies
   */
  private checkSearchSynergy(card1: Card, card2: Card): {
    type: SynergyType;
    score: number;
    description: string;
  } {
    let score = 0;
    const descriptions: string[] = [];

    // Search synergies
    if (card1.supertype === 'Trainer' && card1.text?.includes('search')) {
      if (card2.supertype === 'Pokémon') {
        if (card1.text?.includes('Pokémon') && !card1.text?.includes('Item')) {
          score += 0.5;
          descriptions.push('Searches for this Pokemon');
        }
      }
    }

    // Ball search chains
    if (card1.name.includes('Ball') && card2.name.includes('Ball')) {
      score += 0.3;
      descriptions.push('Search consistency');
    }

    // Evolution search
    if (card1.text?.includes('Evolution') && card2.evolvesFrom) {
      score += 0.4;
      descriptions.push('Evolution search synergy');
    }

    // Setup synergies
    if (card1.text?.includes('from your deck') && card2.text?.includes('from your deck')) {
      score -= 0.2; // Competing for deck resources
      descriptions.push('Compete for deck thinning');
    }

    return {
      type: SynergyType.SEARCH,
      score: Math.max(-1, Math.min(1, score)),
      description: descriptions.join(', ') || 'No search synergy',
    };
  }

  /**
   * Check combo potential between cards
   */
  private checkComboPotential(card1: Card, card2: Card): number {
    let comboScore = 0;

    // Ability combos
    if (card1.abilities?.length && card2.abilities?.length) {
      // Check for infinite loops (dangerous but powerful)
      if (card1.abilities.some((a: any) => a.text?.includes('use this Ability again')) ||
          card2.abilities.some((a: any) => a.text?.includes('use this Ability again'))) {
        comboScore += 8;
      }

      // Check for turn-based combos
      if (card1.abilities.some((a: any) => a.text?.includes('once during your turn')) &&
          card2.abilities.some((a: any) => a.text?.includes('once during your turn'))) {
        comboScore += 5;
      }
    }

    // Attack + Ability combos
    if (card1.abilities?.length && card2.attacks?.length) {
      const ability = card1.abilities[0] as any;
      const attack = card2.attacks?.[0] as any;
      
      if (ability.text?.includes('damage') && attack.damage) {
        comboScore += 6;
      }
    }

    // Trainer + Pokemon combos
    if (card1.supertype === 'Trainer' && card2.supertype === 'Pokémon') {
      if (card1.text?.includes(card2.name)) {
        comboScore += 9; // Direct reference
      }
    }

    return Math.min(10, comboScore);
  }

  /**
   * Initialize synergy rules
   */
  private initializeSynergyRules(): void {
    // Draw engine rules
    this.synergyRules.set('draw', [
      {
        condition: (c1, c2) => c1.text?.includes('draw') && c2.text?.includes('draw'),
        score: 0.4,
        description: 'Draw engine synergy',
      },
    ]);

    // Energy acceleration rules
    this.synergyRules.set('energy', [
      {
        condition: (c1, c2) => 
          c1.text?.includes('attach') && c1.text?.includes('Energy') &&
          c2.supertype === 'Pokémon',
        score: 0.5,
        description: 'Energy acceleration',
      },
    ]);

    // Add more rules as needed...
  }

  /**
   * Initialize combo patterns
   */
  private initializeComboPatterns(): void {
    // Basic combo patterns
    this.comboPatterns = [
      {
        name: 'Draw Engine',
        requiredCards: 2,
        cardConditions: [
          (c: Card) => c.text?.includes('draw') || c.abilities?.some((a: any) => a.text?.includes('draw')),
          (c: Card) => c.text?.includes('draw') || c.name.includes('Research'),
        ],
        comboType: 'setup',
        impact: 7,
        reliability: 0.8,
        description: 'Consistent card draw engine',
      },
      {
        name: 'Energy Acceleration',
        requiredCards: 2,
        cardConditions: [
          (c: Card) => c.text?.includes('attach') && c.text?.includes('Energy'),
          (c: Card) => c.supertype === 'Pokémon' && c.attacks?.some((a: any) => a.cost?.length >= 3),
        ],
        comboType: 'setup',
        impact: 8,
        reliability: 0.7,
        description: 'Fast energy setup for powerful attacks',
      },
      {
        name: 'Lock Combo',
        requiredCards: 2,
        cardConditions: [
          (c: Card) => c.text?.includes("can't retreat"),
          (c: Card) => c.text?.includes("can't attack") || c.text?.includes("can't use"),
        ],
        comboType: 'lock',
        impact: 9,
        reliability: 0.5,
        description: 'Prevents opponent from playing',
      },
      {
        name: 'Damage Amplification',
        requiredCards: 2,
        cardConditions: [
          (c: Card) => c.text?.includes('more damage') || c.abilities?.some((a: any) => a.text?.includes('more damage')),
          (c: Card) => c.supertype === 'Pokémon' && c.attacks?.length > 0,
        ],
        comboType: 'damage',
        impact: 8,
        reliability: 0.8,
        description: 'Increases damage output significantly',
      },
      // Add more patterns...
    ];
  }

  /**
   * Find pattern matches in cards
   */
  private findPatternMatches(cards: Card[], pattern: ComboPattern): ComboChain[] {
    const chains: ComboChain[] = [];
    
    // Find all cards matching each condition
    const matchingSets: Card[][] = pattern.cardConditions.map(condition =>
      cards.filter(condition)
    );

    // Check if we have enough cards for the combo
    if (matchingSets.every(set => set.length > 0)) {
      // Generate combinations
      const combinations = this.generateCombinations(matchingSets, pattern.requiredCards);
      
      for (const combo of combinations) {
        chains.push({
          cards: combo.map(c => c.id),
          comboType: pattern.comboType,
          reliability: pattern.reliability,
          impact: pattern.impact,
          description: pattern.description,
        });
      }
    }

    return chains;
  }

  /**
   * Generate combinations of cards
   */
  private generateCombinations(sets: Card[][], required: number): Card[][] {
    if (sets.length === 0) return [];
    if (sets.length === 1) return sets[0].map(c => [c]);

    const combinations: Card[][] = [];
    const [first, ...rest] = sets;
    const restCombinations = this.generateCombinations(rest, required - 1);

    for (const card of first) {
      for (const combo of restCombinations) {
        if (!combo.includes(card)) { // Avoid duplicates
          combinations.push([card, ...combo]);
        }
      }
    }

    return combinations;
  }

  /**
   * Calculate overall deck coherence
   */
  private calculateOverallCoherence(
    cardPairs: Map<string, Map<string, SynergyScore>>,
    totalCards: number
  ): number {
    let totalSynergy = 0;
    let pairCount = 0;

    for (const [card1, synergies] of cardPairs) {
      for (const [card2, synergy] of synergies) {
        totalSynergy += synergy.score;
        pairCount++;
      }
    }

    // Average synergy score normalized by card count
    const avgSynergy = pairCount > 0 ? totalSynergy / pairCount : 0;
    const coherence = (avgSynergy + 1) / 2; // Normalize to 0-1

    return Math.max(0, Math.min(1, coherence));
  }

  /**
   * Generate description for synergy
   */
  private generateSynergyDescription(
    card1: Card,
    card2: Card,
    synergies: { type: SynergyType; score: number; description: string }[]
  ): string {
    if (synergies.length === 0) {
      return `${card1.name} and ${card2.name} have neutral interaction`;
    }

    const descriptions = synergies
      .filter(s => s.score !== 0)
      .map(s => s.description)
      .filter(Boolean);

    if (descriptions.length === 0) {
      return `${card1.name} and ${card2.name} have minimal synergy`;
    }

    return descriptions.join('; ');
  }

  /**
   * Identify negative synergies that should be avoided
   */
  identifyAntiSynergies(cards: Card[]): AntiSynergy[] {
    const antiSynergies: AntiSynergy[] = [];

    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const anti = this.checkAntiSynergy(cards[i], cards[j]);
        if (anti) {
          antiSynergies.push(anti);
        }
      }
    }

    return antiSynergies;
  }

  /**
   * Check for anti-synergies between two cards
   */
  private checkAntiSynergy(card1: Card, card2: Card): AntiSynergy | null {
    // Stadium conflicts
    if (card1.subtypes?.includes('Stadium') && card2.subtypes?.includes('Stadium')) {
      return {
        card1Id: card1.id,
        card2Id: card2.id,
        severity: 5,
        reasoning: 'Stadium cards replace each other',
        canCoexist: true, // Can be in deck but not in play together
      };
    }

    // Ability conflicts
    if (card1.abilities?.some((a: any) => a.text?.includes("can't use")) &&
        card2.abilities?.length) {
      return {
        card1Id: card1.id,
        card2Id: card2.id,
        severity: 8,
        reasoning: 'Ability prevention conflict',
        canCoexist: false,
      };
    }

    // Energy type conflicts
    if (card1.supertype === 'Pokémon' && card2.supertype === 'Pokémon') {
      const types1 = card1.types || [];
      const types2 = card2.types || [];
      
      // Check if they require completely different energy types
      if (types1.length > 0 && types2.length > 0 && 
          !types1.some(t => types2.includes(t)) &&
          !types1.includes('Colorless') && !types2.includes('Colorless')) {
        
        const attacks1RequireSpecific = card1.attacks?.some((a: any) => 
          a.cost?.some((c: string) => c !== 'Colorless')
        );
        const attacks2RequireSpecific = card2.attacks?.some((a: any) => 
          a.cost?.some((c: string) => c !== 'Colorless')
        );

        if (attacks1RequireSpecific && attacks2RequireSpecific) {
          return {
            card1Id: card1.id,
            card2Id: card2.id,
            severity: 6,
            reasoning: 'Incompatible energy requirements',
            canCoexist: true, // Can work but not optimal
          };
        }
      }
    }

    return null;
  }

  /**
   * Get synergy recommendations for a card
   */
  getSynergyRecommendations(card: Card, availableCards: Card[]): {
    card: Card;
    synergyScore: number;
    reasons: string[];
  }[] {
    const recommendations: {
      card: Card;
      synergyScore: number;
      reasons: string[];
    }[] = [];

    for (const candidate of availableCards) {
      if (candidate.id === card.id) continue;

      const synergy = this.calculatePairSynergy(card, candidate);
      if (synergy.score > 0.5) {
        recommendations.push({
          card: candidate,
          synergyScore: synergy.score,
          reasons: [synergy.description],
        });
      }
    }

    return recommendations.sort((a, b) => b.synergyScore - a.synergyScore);
  }
}

// Type definitions for internal use
interface SynergyRule {
  condition: (card1: Card, card2: Card) => boolean;
  score: number;
  description: string;
}

interface ComboPattern {
  name: string;
  requiredCards: number;
  cardConditions: ((card: Card) => boolean)[];
  comboType: 'setup' | 'damage' | 'lock' | 'mill' | 'other';
  impact: number;
  reliability: number;
  description: string;
}