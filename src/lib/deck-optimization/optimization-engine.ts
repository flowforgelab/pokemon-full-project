import type { Card, DeckCard, UserCollection } from '@prisma/client';
import type { DeckAnalysisResult } from '@/lib/analysis/types';
import { logger } from '@/lib/logger';

interface OptimizationRule {
  id: string;
  name: string;
  priority: number;
  condition: (analysis: DeckAnalysisResult, deck: DeckCard[]) => boolean;
  action: (analysis: DeckAnalysisResult, deck: DeckCard[]) => OptimizationAction[];
  tags: string[];
}

interface OptimizationAction {
  type: 'add' | 'remove' | 'replace' | 'adjust';
  card?: string;
  targetCard?: string;
  quantity?: number;
  reason: string;
  impact: string;
  scoreImprovement: number;
}

interface OptimizationContext {
  analysis: DeckAnalysisResult;
  deck: DeckCard[];
  userCollection?: UserCollection[];
  budget?: number;
  priorityMode?: 'power' | 'consistency' | 'speed' | 'budget';
  constraints?: OptimizationConstraints;
}

interface OptimizationConstraints {
  maintainArchetype?: boolean;
  maxChanges?: number;
  preserveCore?: string[];
  bannedCards?: string[];
  requiredCards?: string[];
  minPokemonTypes?: number;
}

interface CardSuggestion {
  cardName: string;
  reason: string;
  priority: number;
  alternatives: string[];
  synergyCards: string[];
}

export class OptimizationEngine {
  private rules: OptimizationRule[] = [];
  private cardDatabase: Map<string, CardSuggestion> = new Map();

  constructor() {
    this.initializeRules();
    this.initializeCardDatabase();
  }

  /**
   * Initialize optimization rules
   */
  private initializeRules() {
    // Critical rules (must fix)
    this.rules.push({
      id: 'deck-size',
      name: 'Fix Deck Size',
      priority: 100,
      condition: (_, deck) => {
        const total = deck.reduce((sum, dc) => sum + dc.quantity, 0);
        return total !== 60;
      },
      action: (_, deck) => {
        const total = deck.reduce((sum, dc) => sum + dc.quantity, 0);
        const actions: OptimizationAction[] = [];
        
        if (total < 60) {
          actions.push({
            type: 'add',
            card: 'Professor\'s Research',
            quantity: Math.min(4, 60 - total),
            reason: 'Deck must have exactly 60 cards',
            impact: 'Makes deck tournament legal',
            scoreImprovement: 20,
          });
        }
        
        return actions;
      },
      tags: ['critical', 'legality'],
    });

    this.rules.push({
      id: 'basic-pokemon',
      name: 'Ensure Basic Pokemon',
      priority: 99,
      condition: (_, deck) => {
        return !deck.some(dc => dc.card.subtypes?.includes('Basic'));
      },
      action: () => [{
        type: 'add',
        card: 'Snorlax',
        quantity: 4,
        reason: 'Deck must contain Basic Pokemon',
        impact: 'Prevents automatic loss',
        scoreImprovement: 30,
      }],
      tags: ['critical', 'legality'],
    });

    // Consistency rules
    this.rules.push({
      id: 'draw-support',
      name: 'Add Draw Support',
      priority: 80,
      condition: (analysis) => {
        return (analysis.consistency?.trainerDistribution?.drawPower || 0) < 8;
      },
      action: (analysis, deck) => {
        const actions: OptimizationAction[] = [];
        const hasResearch = deck.some(dc => dc.card.name.includes('Professor\'s Research'));
        
        if (!hasResearch) {
          actions.push({
            type: 'add',
            card: 'Professor\'s Research',
            quantity: 4,
            reason: 'Essential draw support',
            impact: 'Draw 7 cards per turn',
            scoreImprovement: 15,
          });
        }
        
        return actions;
      },
      tags: ['consistency', 'draw'],
    });

    this.rules.push({
      id: 'pokemon-search',
      name: 'Add Pokemon Search',
      priority: 75,
      condition: (analysis) => {
        return (analysis.consistency?.trainerDistribution?.search || 0) < 6;
      },
      action: (_, deck) => {
        const actions: OptimizationAction[] = [];
        const hasQuickBall = deck.some(dc => dc.card.name === 'Quick Ball');
        
        if (!hasQuickBall) {
          actions.push({
            type: 'add',
            card: 'Quick Ball',
            quantity: 4,
            reason: 'Essential Pokemon search',
            impact: 'Find Basic Pokemon quickly',
            scoreImprovement: 12,
          });
        }
        
        return actions;
      },
      tags: ['consistency', 'search'],
    });

    // Speed rules
    this.rules.push({
      id: 'energy-acceleration',
      name: 'Add Energy Acceleration',
      priority: 60,
      condition: (analysis) => {
        return (analysis.speed?.energyEfficiency || 0) < 0.7;
      },
      action: (_, deck) => {
        const actions: OptimizationAction[] = [];
        const hasTwinEnergy = deck.some(dc => dc.card.name === 'Twin Energy');
        
        if (!hasTwinEnergy) {
          actions.push({
            type: 'add',
            card: 'Twin Energy',
            quantity: 2,
            reason: 'Accelerate energy attachment',
            impact: 'Setup 1-2 turns faster',
            scoreImprovement: 10,
          });
        }
        
        return actions;
      },
      tags: ['speed', 'energy'],
    });

    // Power rules
    this.rules.push({
      id: 'damage-boost',
      name: 'Add Damage Modifiers',
      priority: 50,
      condition: (analysis) => {
        return analysis.archetype?.primaryArchetype === 'aggro';
      },
      action: (_, deck) => {
        const actions: OptimizationAction[] = [];
        const hasChoiceBelt = deck.some(dc => dc.card.name === 'Choice Belt');
        
        if (!hasChoiceBelt) {
          actions.push({
            type: 'add',
            card: 'Choice Belt',
            quantity: 2,
            reason: 'Increase damage output',
            impact: '+30 damage vs V Pokemon',
            scoreImprovement: 8,
          });
        }
        
        return actions;
      },
      tags: ['power', 'damage'],
    });

    // Optimization rules
    this.rules.push({
      id: 'trainer-upgrade',
      name: 'Upgrade Suboptimal Trainers',
      priority: 40,
      condition: (_, deck) => {
        return deck.some(dc => 
          ['Hop', 'Poké Ball', 'Pokémon Catcher'].includes(dc.card.name)
        );
      },
      action: (_, deck) => {
        const actions: OptimizationAction[] = [];
        
        if (deck.some(dc => dc.card.name === 'Hop')) {
          actions.push({
            type: 'replace',
            targetCard: 'Hop',
            card: 'Professor\'s Research',
            reason: 'Strictly better draw power',
            impact: 'Draw 7 instead of 3',
            scoreImprovement: 10,
          });
        }
        
        if (deck.some(dc => dc.card.name === 'Poké Ball')) {
          actions.push({
            type: 'replace',
            targetCard: 'Poké Ball',
            card: 'Quick Ball',
            reason: 'More reliable search',
            impact: 'Search entire deck',
            scoreImprovement: 8,
          });
        }
        
        return actions;
      },
      tags: ['optimization', 'upgrade'],
    });

    // Energy balance rules
    this.rules.push({
      id: 'energy-ratio',
      name: 'Fix Energy Ratio',
      priority: 70,
      condition: (analysis) => {
        const ratio = analysis.consistency?.energyRatio || 0;
        return ratio < 0.15 || ratio > 0.25;
      },
      action: (analysis, deck) => {
        const actions: OptimizationAction[] = [];
        const energyCount = deck
          .filter(dc => dc.card.supertype === 'ENERGY')
          .reduce((sum, dc) => sum + dc.quantity, 0);
        
        const totalCards = 60;
        const targetEnergy = Math.round(totalCards * 0.2);
        
        if (energyCount < targetEnergy) {
          actions.push({
            type: 'add',
            card: 'Basic Fire Energy',
            quantity: targetEnergy - energyCount,
            reason: 'Insufficient energy',
            impact: 'Improve attack consistency',
            scoreImprovement: 8,
          });
        } else if (energyCount > targetEnergy + 2) {
          actions.push({
            type: 'remove',
            card: 'Basic Energy',
            quantity: energyCount - targetEnergy,
            reason: 'Too many energy cards',
            impact: 'More room for trainers',
            scoreImprovement: 5,
          });
        }
        
        return actions;
      },
      tags: ['consistency', 'energy'],
    });
  }

  /**
   * Initialize card suggestion database
   */
  private initializeCardDatabase() {
    // Draw support cards
    this.cardDatabase.set('Professor\'s Research', {
      cardName: 'Professor\'s Research',
      reason: 'Best draw support in format',
      priority: 90,
      alternatives: ['Hop', 'Cynthia', 'Marnie'],
      synergyCards: ['Quick Ball', 'Ultra Ball'],
    });

    // Search cards
    this.cardDatabase.set('Quick Ball', {
      cardName: 'Quick Ball',
      reason: 'Essential Basic Pokemon search',
      priority: 85,
      alternatives: ['Ultra Ball', 'Great Ball', 'Level Ball'],
      synergyCards: ['Professor\'s Research', 'Battle VIP Pass'],
    });

    // Gust effects
    this.cardDatabase.set('Boss\'s Orders', {
      cardName: 'Boss\'s Orders',
      reason: 'Essential gust effect',
      priority: 80,
      alternatives: ['Guzma', 'Pokemon Catcher', 'Cross Switcher'],
      synergyCards: ['Switch', 'Escape Rope'],
    });

    // Energy acceleration
    this.cardDatabase.set('Twin Energy', {
      cardName: 'Twin Energy',
      reason: 'Accelerates non-V/GX attackers',
      priority: 70,
      alternatives: ['Double Colorless Energy', 'Triple Acceleration Energy'],
      synergyCards: ['Snorlax', 'Cinccino'],
    });

    // Switching cards
    this.cardDatabase.set('Switch', {
      cardName: 'Switch',
      reason: 'Basic switching option',
      priority: 60,
      alternatives: ['Escape Rope', 'Bird Keeper', 'Switch Cart'],
      synergyCards: ['Boss\'s Orders', 'Manaphy'],
    });

    // Stadium cards
    this.cardDatabase.set('Path to the Peak', {
      cardName: 'Path to the Peak',
      reason: 'Shuts down Rule Box abilities',
      priority: 65,
      alternatives: ['Collapsed Stadium', 'Temple of Sinnoh'],
      synergyCards: ['Single Prize attackers'],
    });

    // Recovery cards
    this.cardDatabase.set('Ordinary Rod', {
      cardName: 'Ordinary Rod',
      reason: 'Pokemon and energy recovery',
      priority: 55,
      alternatives: ['Rescue Carrier', 'Energy Retrieval', 'Pal Pad'],
      synergyCards: ['Professor\'s Research', 'Quick Ball'],
    });

    // Damage modifiers
    this.cardDatabase.set('Choice Belt', {
      cardName: 'Choice Belt',
      reason: '+30 damage to V Pokemon',
      priority: 60,
      alternatives: ['Muscle Band', 'Choice Band', 'Powerful Colorless Energy'],
      synergyCards: ['Single Prize attackers', 'Radiant Pokemon'],
    });
  }

  /**
   * Run optimization engine
   */
  async optimize(context: OptimizationContext): Promise<OptimizationAction[]> {
    const { analysis, deck, priorityMode, constraints } = context;
    const actions: OptimizationAction[] = [];
    const appliedRules = new Set<string>();

    logger.info('Running optimization engine', {
      deckSize: deck.length,
      priorityMode,
      constraints,
    });

    // Sort rules by priority
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);

    // Apply rules based on priority mode
    const modeMultipliers = this.getModeMultipliers(priorityMode);

    for (const rule of sortedRules) {
      // Check constraints
      if (constraints?.maxChanges && actions.length >= constraints.maxChanges) {
        break;
      }

      // Apply mode multiplier to priority
      const effectivePriority = this.calculateEffectivePriority(rule, modeMultipliers);
      
      // Skip low priority rules based on mode
      if (effectivePriority < 30) continue;

      // Check rule condition
      if (rule.condition(analysis, deck)) {
        const ruleActions = rule.action(analysis, deck);
        
        // Filter actions based on constraints
        const filteredActions = this.filterActionsByConstraints(ruleActions, constraints);
        
        if (filteredActions.length > 0) {
          actions.push(...filteredActions);
          appliedRules.add(rule.id);
          
          logger.debug('Applied optimization rule', {
            ruleId: rule.id,
            actions: filteredActions.length,
          });
        }
      }
    }

    // Apply collection-aware optimizations if available
    if (context.userCollection) {
      const collectionActions = this.applyCollectionOptimizations(actions, context.userCollection);
      actions.push(...collectionActions);
    }

    // Sort actions by score improvement
    actions.sort((a, b) => b.scoreImprovement - a.scoreImprovement);

    return actions;
  }

  /**
   * Get mode-specific priority multipliers
   */
  private getModeMultipliers(mode?: 'power' | 'consistency' | 'speed' | 'budget'): Record<string, number> {
    switch (mode) {
      case 'consistency':
        return {
          consistency: 1.5,
          draw: 1.4,
          search: 1.3,
          energy: 1.2,
          power: 0.8,
          speed: 0.9,
        };
      case 'speed':
        return {
          speed: 1.5,
          energy: 1.3,
          search: 1.2,
          consistency: 1.0,
          power: 0.9,
          draw: 0.9,
        };
      case 'power':
        return {
          power: 1.5,
          damage: 1.4,
          speed: 1.1,
          consistency: 1.0,
          draw: 0.9,
          search: 0.9,
        };
      case 'budget':
        return {
          consistency: 1.2,
          draw: 1.1,
          search: 1.0,
          power: 0.7,
          speed: 0.8,
          damage: 0.6,
        };
      default:
        return {
          consistency: 1.0,
          draw: 1.0,
          search: 1.0,
          power: 1.0,
          speed: 1.0,
          damage: 1.0,
        };
    }
  }

  /**
   * Calculate effective priority based on mode
   */
  private calculateEffectivePriority(rule: OptimizationRule, multipliers: Record<string, number>): number {
    let effectivePriority = rule.priority;

    for (const tag of rule.tags) {
      if (multipliers[tag]) {
        effectivePriority *= multipliers[tag];
      }
    }

    return effectivePriority;
  }

  /**
   * Filter actions based on constraints
   */
  private filterActionsByConstraints(
    actions: OptimizationAction[],
    constraints?: OptimizationConstraints
  ): OptimizationAction[] {
    if (!constraints) return actions;

    return actions.filter(action => {
      // Check banned cards
      if (constraints.bannedCards && action.card && constraints.bannedCards.includes(action.card)) {
        return false;
      }

      // Check preserve core
      if (constraints.preserveCore && action.type === 'remove' && action.card) {
        if (constraints.preserveCore.includes(action.card)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply collection-aware optimizations
   */
  private applyCollectionOptimizations(
    actions: OptimizationAction[],
    userCollection: UserCollection[]
  ): OptimizationAction[] {
    const collectionActions: OptimizationAction[] = [];
    const collectionCardNames = new Set(userCollection.map(uc => uc.card.name));

    // Check for upgrade opportunities in collection
    for (const [cardName, suggestion] of this.cardDatabase.entries()) {
      if (collectionCardNames.has(cardName)) {
        // User owns this premium card, suggest using it
        for (const alternative of suggestion.alternatives) {
          if (actions.some(a => a.card === alternative)) {
            collectionActions.push({
              type: 'replace',
              targetCard: alternative,
              card: cardName,
              reason: `You own ${cardName} - use it instead of ${alternative}`,
              impact: 'Free upgrade from your collection',
              scoreImprovement: 5,
            });
          }
        }
      }
    }

    return collectionActions;
  }

  /**
   * Get card suggestions for a specific need
   */
  getCardSuggestions(need: string): CardSuggestion[] {
    const suggestions: CardSuggestion[] = [];
    
    for (const [_, suggestion] of this.cardDatabase.entries()) {
      if (suggestion.reason.toLowerCase().includes(need.toLowerCase()) ||
          suggestion.synergyCards.some(card => card.toLowerCase().includes(need.toLowerCase()))) {
        suggestions.push(suggestion);
      }
    }

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Validate optimization actions
   */
  validateActions(actions: OptimizationAction[], deck: DeckCard[]): boolean {
    const tempDeck = [...deck];
    
    for (const action of actions) {
      switch (action.type) {
        case 'add':
          // Check if adding would exceed 60 cards
          const totalAfterAdd = tempDeck.reduce((sum, dc) => sum + dc.quantity, 0) + (action.quantity || 1);
          if (totalAfterAdd > 60) return false;
          break;

        case 'remove':
          // Check if card exists to remove
          const cardToRemove = tempDeck.find(dc => dc.card.name === action.card);
          if (!cardToRemove || cardToRemove.quantity < (action.quantity || 1)) return false;
          break;

        case 'replace':
          // Check if target card exists
          const cardToReplace = tempDeck.find(dc => dc.card.name === action.targetCard);
          if (!cardToReplace) return false;
          break;
      }
    }

    return true;
  }
}