import { Deck, DeckCard, Card } from '@prisma/client';
import { ConsistencyCalculator } from './consistency-calculator';
import { SynergyAnalyzer } from './synergy-analyzer';
import { MetaEvaluator } from './meta-evaluator';
import { SpeedAnalyzer } from './speed-analyzer';
import { ArchetypeClassifier } from './archetype-classifier';
import { ScoringSystem } from './scoring-system';
import { cardCache } from '@/lib/api/cache';
import type {
  DeckAnalysisResult,
  AnalysisConfig,
  Recommendation,
  AnalysisWarning,
} from './types';

export class DeckAnalyzer {
  private config: AnalysisConfig;
  private scoringSystem: ScoringSystem;

  constructor(config: AnalysisConfig = { format: 'standard', includeRotation: true }) {
    this.config = config;
    this.scoringSystem = new ScoringSystem();
  }

  /**
   * Analyze a complete deck
   */
  async analyzeDeck(
    deck: Deck & { cards: (DeckCard & { card: Card })[] }
  ): Promise<DeckAnalysisResult> {
    // Check cache first
    const cacheKey = `deck-analysis:${deck.id}:${this.config.format}`;
    const cached = await cardCache.get(cacheKey);
    if (cached) {
      return cached as DeckAnalysisResult;
    }

    // Validate deck
    const warnings = this.validateDeck(deck);

    // Initialize analyzers
    const consistencyCalculator = new ConsistencyCalculator(deck.cards);
    const synergyAnalyzer = new SynergyAnalyzer(deck.cards);
    const speedAnalyzer = new SpeedAnalyzer(deck.cards);
    const archetypeClassifier = new ArchetypeClassifier(deck.cards);

    // Perform analyses
    const consistency = consistencyCalculator.analyze();
    const synergy = synergyAnalyzer.analyze();
    const speed = speedAnalyzer.analyze();
    const archetype = archetypeClassifier.classify();

    // Meta evaluation with identified archetype
    const metaEvaluator = new MetaEvaluator(deck.cards, this.config.format);
    const meta = metaEvaluator.analyze(archetype.primaryArchetype);

    // Calculate scores
    const scores = this.scoringSystem.calculateScores(
      consistency,
      synergy,
      speed,
      meta,
      archetype
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      consistency,
      synergy,
      speed,
      meta,
      archetype,
      scores
    );

    // Create analysis result
    const result: DeckAnalysisResult = {
      deckId: deck.id,
      timestamp: new Date(),
      consistency,
      synergy,
      meta,
      speed,
      matchups: meta.popularMatchups, // Using meta matchups for now
      archetype,
      performance: {
        tournamentPerformance: scores.overall,
        consistencyRating: Math.round(consistency.overallConsistency / 10),
        powerLevel: Math.round(scores.power / 10),
        metaViability: Math.round(scores.metaRelevance / 10),
        skillCeiling: Math.round(scores.difficulty / 10),
        budgetEfficiency: this.calculateBudgetEfficiency(deck.cards),
        futureProofing: 100 - meta.rotationImpact.impactScore,
        learningCurve: this.determineLearningCurve(scores.difficulty),
      },
      scores,
      recommendations,
      warnings,
    };

    // Cache the result
    await cardCache.set(cacheKey, result, 3600); // 1 hour cache

    return result;
  }

  /**
   * Validate deck configuration
   */
  private validateDeck(deck: Deck & { cards: (DeckCard & { card: Card })[] }): AnalysisWarning[] {
    const warnings: AnalysisWarning[] = [];

    // Check deck size
    const totalCards = deck.cards.reduce((sum, dc) => sum + dc.quantity, 0);
    if (totalCards !== 60) {
      warnings.push({
        severity: 'error',
        category: 'Deck Size',
        message: `Deck contains ${totalCards} cards, must be exactly 60`,
      });
    }

    // Check for basic Pokemon
    const basicPokemon = deck.cards.filter(
      dc => dc.card.supertype === 'POKEMON' && !dc.card.evolvesFrom
    );
    if (basicPokemon.length === 0) {
      warnings.push({
        severity: 'error',
        category: 'Basic Pokemon',
        message: 'Deck must contain at least one Basic Pokemon',
      });
    }

    // Check card limits
    const cardCounts = new Map<string, number>();
    deck.cards.forEach(dc => {
      if (dc.card.supertype !== 'ENERGY' || !this.isBasicEnergy(dc.card)) {
        cardCounts.set(dc.card.name, (cardCounts.get(dc.card.name) || 0) + dc.quantity);
      }
    });

    cardCounts.forEach((count, cardName) => {
      if (count > 4) {
        warnings.push({
          severity: 'error',
          category: 'Card Limit',
          message: `${cardName} exceeds 4 card limit (${count} copies)`,
          affectedCards: [cardName],
        });
      }
    });

    // Check format legality
    const illegalCards = deck.cards.filter(dc => {
      if (this.config.format === 'standard') {
        return !dc.card.isLegalStandard;
      } else {
        return !dc.card.isLegalExpanded;
      }
    });

    illegalCards.forEach(dc => {
      warnings.push({
        severity: 'error',
        category: 'Format Legality',
        message: `${dc.card.name} is not legal in ${this.config.format} format`,
        affectedCards: [dc.card.name],
      });
    });

    // Warnings (non-errors)
    
    // Low energy count
    const energyCount = deck.cards
      .filter(dc => dc.card.supertype === 'ENERGY')
      .reduce((sum, dc) => sum + dc.quantity, 0);
    
    if (energyCount < 8) {
      warnings.push({
        severity: 'warning',
        category: 'Energy Count',
        message: `Low energy count (${energyCount}), may cause consistency issues`,
        suggestion: 'Consider adding more energy cards',
      });
    } else if (energyCount > 20) {
      warnings.push({
        severity: 'warning',
        category: 'Energy Count',
        message: `High energy count (${energyCount}), may reduce deck options`,
        suggestion: 'Consider reducing energy count',
      });
    }

    // No draw support
    const drawSupport = deck.cards.filter(dc => {
      const cardText = JSON.stringify(dc.card).toLowerCase();
      return dc.card.supertype === 'TRAINER' && 
             dc.card.subtypes?.includes('Supporter') &&
             cardText.includes('draw');
    });

    if (drawSupport.length === 0) {
      warnings.push({
        severity: 'warning',
        category: 'Draw Support',
        message: 'No draw supporters detected',
        suggestion: 'Add Professor\'s Research, Marnie, or similar cards',
      });
    }

    return warnings;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    consistency: ConsistencyAnalysis,
    synergy: SynergyAnalysis,
    speed: SpeedAnalysis,
    meta: MetaGameAnalysis,
    archetype: ArchetypeClassification,
    scores: any
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Consistency recommendations
    if (consistency.overallConsistency < 70) {
      if (consistency.energyRatio.energyPercentage < consistency.energyRatio.recommendedRange.min) {
        recommendations.push({
          type: 'add',
          priority: 'high',
          card: 'Basic Energy',
          quantity: Math.ceil((consistency.energyRatio.recommendedRange.min - consistency.energyRatio.energyPercentage) / 100 * 60),
          reason: 'Energy count below recommended range',
          impact: 'Improved energy consistency and reduced dead hands',
        });
      }

      if (consistency.trainerDistribution.drawPower < 6) {
        recommendations.push({
          type: 'add',
          priority: 'high',
          card: 'Professor\'s Research',
          quantity: 4 - this.countCard('Professor\'s Research', []),
          reason: 'Insufficient draw power',
          impact: 'Better hand refresh and consistency',
          alternativeOptions: ['Colress\'s Experiment', 'Marnie'],
        });
      }

      if (consistency.mulliganProbability > 0.10) {
        recommendations.push({
          type: 'add',
          priority: 'high',
          card: 'Basic Pokemon',
          quantity: 2,
          reason: 'High mulligan probability',
          impact: 'Reduced mulligan rate and better starts',
        });
      }
    }

    // Speed recommendations
    if (speed.overallSpeed === 'slow' && archetype.primaryArchetype !== 'CONTROL') {
      if (speed.energyAttachmentEfficiency < 60) {
        recommendations.push({
          type: 'add',
          priority: 'medium',
          card: 'Energy acceleration',
          reason: 'Slow energy attachment',
          impact: 'Faster setup and earlier attacks',
          alternativeOptions: this.getEnergyAccelerationOptions(archetype),
        });
      }

      if (speed.firstTurnAdvantage < 40) {
        recommendations.push({
          type: 'add',
          priority: 'medium',
          card: 'Battle VIP Pass',
          quantity: 4,
          reason: 'Poor first turn setup',
          impact: 'Much better turn 1 plays',
        });
      }
    }

    // Meta recommendations
    meta.techRecommendations.forEach(tech => {
      if (recommendations.length < 10) { // Limit recommendations
        recommendations.push({
          type: 'add',
          priority: 'medium',
          card: tech.card,
          quantity: tech.slot,
          reason: tech.reason,
          impact: `Improves matchups vs ${tech.matchupImprovements.join(', ')}`,
        });
      }
    });

    // Synergy recommendations
    if (synergy.overallSynergy < 60) {
      recommendations.push({
        type: 'adjust',
        priority: 'low',
        reason: 'Low card synergy',
        impact: 'Better card interactions and combo potential',
        suggestion: 'Consider focusing on cards that work well together',
      });
    }

    // Archetype-specific recommendations
    const archetypeRecs = this.getArchetypeRecommendations(archetype, scores);
    recommendations.push(...archetypeRecs);

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations.slice(0, 10); // Top 10 recommendations
  }

  /**
   * Calculate budget efficiency (simplified)
   */
  private calculateBudgetEfficiency(cards: (DeckCard & { card: Card })[]): number {
    // This would need actual price data in production
    // For now, use rarity as a proxy
    let totalValue = 0;
    let totalCards = 0;

    const rarityValues: Record<string, number> = {
      'COMMON': 0.25,
      'UNCOMMON': 0.50,
      'RARE': 2,
      'RARE_HOLO': 5,
      'RARE_ULTRA': 20,
      'RARE_SECRET': 50,
    };

    cards.forEach(dc => {
      const value = rarityValues[dc.card.rarity || 'COMMON'] || 1;
      totalValue += value * dc.quantity;
      totalCards += dc.quantity;
    });

    const avgValue = totalValue / totalCards;
    
    // Lower average value = better budget efficiency
    if (avgValue <= 2) return 90;
    if (avgValue <= 5) return 70;
    if (avgValue <= 10) return 50;
    if (avgValue <= 20) return 30;
    return 10;
  }

  /**
   * Determine learning curve
   */
  private determineLearningCurve(difficulty: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    if (difficulty <= 30) return 'beginner';
    if (difficulty <= 50) return 'intermediate';
    if (difficulty <= 75) return 'advanced';
    return 'expert';
  }

  /**
   * Get energy acceleration options
   */
  private getEnergyAccelerationOptions(archetype: ArchetypeClassification): string[] {
    // Type-specific acceleration
    const options = [
      'Melony', // Water
      'Welder', // Fire
      'Bede', // Psychic
      'Raihan', // Dragon
      'Metal Saucer', // Metal
      'Dark Patch', // Dark
      'Twin Energy', // Colorless
      'Double Turbo Energy', // General
    ];

    return options;
  }

  /**
   * Get archetype-specific recommendations
   */
  private getArchetypeRecommendations(
    archetype: ArchetypeClassification,
    scores: any
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    switch (archetype.primaryArchetype) {
      case 'AGGRO':
        if (scores.speed < 70) {
          recommendations.push({
            type: 'adjust',
            priority: 'high',
            reason: 'Aggro deck is too slow',
            impact: 'Match archetype speed requirements',
            suggestion: 'Remove high-cost attackers for faster options',
          });
        }
        break;

      case 'CONTROL':
        if (scores.versatility < 60) {
          recommendations.push({
            type: 'add',
            priority: 'medium',
            card: 'Disruption cards',
            reason: 'Control deck lacks disruption',
            impact: 'Better opponent disruption',
            alternativeOptions: ['Marnie', 'Judge', 'Crushing Hammer'],
          });
        }
        break;

      case 'COMBO':
        if (scores.consistency < 70) {
          recommendations.push({
            type: 'add',
            priority: 'high',
            card: 'Search cards',
            reason: 'Combo deck needs to find pieces',
            impact: 'More reliable combo execution',
            alternativeOptions: ['Quick Ball', 'Ultra Ball', 'Trainers\' Mail'],
          });
        }
        break;
    }

    return recommendations;
  }

  /**
   * Helper to check if card is basic energy
   */
  private isBasicEnergy(card: Card): boolean {
    const basicEnergyNames = ['Basic Fire', 'Basic Water', 'Basic Grass', 
                             'Basic Lightning', 'Basic Psychic', 'Basic Fighting',
                             'Basic Darkness', 'Basic Metal', 'Basic Fairy'];
    return basicEnergyNames.some(name => card.name.includes(name));
  }

  /**
   * Helper to count specific card
   */
  private countCard(cardName: string, cards: (DeckCard & { card: Card })[]): number {
    return cards
      .filter(dc => dc.card.name.includes(cardName))
      .reduce((sum, dc) => sum + dc.quantity, 0);
  }
}