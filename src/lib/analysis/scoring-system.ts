import type {
  DeckScores,
  ScoreBreakdown,
  ConsistencyAnalysis,
  SynergyAnalysis,
  SpeedAnalysis,
  MetaGameAnalysis,
  ArchetypeClassification,
  DeckArchetype,
} from './types';

export class ScoringSystem {
  /**
   * Calculate comprehensive deck scores
   */
  calculateScores(
    consistency: ConsistencyAnalysis,
    synergy: SynergyAnalysis,
    speed: SpeedAnalysis,
    meta: MetaGameAnalysis,
    archetype: ArchetypeClassification
  ): DeckScores {
    // Calculate individual scores
    const consistencyScore = this.calculateConsistencyScore(consistency);
    const powerScore = this.calculatePowerScore(speed, archetype);
    const speedScore = this.calculateSpeedScore(speed);
    const versatilityScore = this.calculateVersatilityScore(meta, archetype);
    const metaRelevanceScore = this.calculateMetaRelevanceScore(meta);
    const innovationScore = this.calculateInnovationScore(meta, archetype);
    const difficultyScore = this.calculateDifficultyScore(archetype, synergy);

    // Calculate overall score with archetype-specific weights
    const overallScore = this.calculateOverallScore(
      {
        consistency: consistencyScore,
        power: powerScore,
        speed: speedScore,
        versatility: versatilityScore,
        metaRelevance: metaRelevanceScore,
        innovation: innovationScore,
        difficulty: difficultyScore,
      },
      archetype.primaryArchetype
    );

    // Generate score breakdown
    const breakdown = this.generateBreakdown(
      consistency,
      synergy,
      speed,
      meta,
      archetype,
      {
        consistency: consistencyScore,
        power: powerScore,
        speed: speedScore,
        versatility: versatilityScore,
        metaRelevance: metaRelevanceScore,
        innovation: innovationScore,
        difficulty: difficultyScore,
      }
    );

    return {
      overall: overallScore,
      consistency: consistencyScore,
      power: powerScore,
      speed: speedScore,
      versatility: versatilityScore,
      metaRelevance: metaRelevanceScore,
      innovation: innovationScore,
      difficulty: difficultyScore,
      breakdown,
    };
  }

  /**
   * Calculate consistency score
   */
  private calculateConsistencyScore(consistency: ConsistencyAnalysis): number {
    // Already calculated in consistency analysis
    return consistency.overallConsistency;
  }

  /**
   * Calculate power score
   */
  private calculatePowerScore(
    speed: SpeedAnalysis,
    archetype: ArchetypeClassification
  ): number {
    let powerScore = 50; // Base

    // Damage output
    const damageOutput = speed.prizeRaceSpeed.damageOutput;
    if (damageOutput >= 200) powerScore += 30;
    else if (damageOutput >= 150) powerScore += 25;
    else if (damageOutput >= 120) powerScore += 20;
    else if (damageOutput >= 90) powerScore += 15;
    else if (damageOutput >= 60) powerScore += 10;

    // OHKO capability
    if (speed.prizeRaceSpeed.ohkoCapability) {
      powerScore += 15;
    }

    // Prize race efficiency
    const prizesPerTurn = speed.prizeRaceSpeed.averagePrizesPerTurn;
    powerScore += Math.min(20, prizesPerTurn * 15);

    // Archetype adjustments
    if (archetype.primaryArchetype === DeckArchetype.CONTROL ||
        archetype.primaryArchetype === DeckArchetype.STALL ||
        archetype.primaryArchetype === DeckArchetype.MILL) {
      // These archetypes have different power metrics
      powerScore = Math.max(50, powerScore - 20);
      
      // Add disruption power instead
      powerScore += 30; // Placeholder for disruption analysis
    }

    return Math.min(100, Math.round(powerScore));
  }

  /**
   * Calculate speed score
   */
  private calculateSpeedScore(speed: SpeedAnalysis): number {
    let score = 0;

    // Overall speed rating
    switch (speed.overallSpeed) {
      case 'turbo':
        score = 90;
        break;
      case 'fast':
        score = 75;
        break;
      case 'medium':
        score = 50;
        break;
      case 'slow':
        score = 25;
        break;
    }

    // Adjust based on specific factors
    
    // Setup speed
    if (speed.averageSetupTurn <= 1.5) score += 10;
    else if (speed.averageSetupTurn <= 2) score += 5;
    else if (speed.averageSetupTurn >= 3) score -= 10;

    // First turn advantage
    score += (speed.firstTurnAdvantage - 50) / 10; // Convert 0-100 to -5 to +5

    // Energy efficiency
    score += (speed.energyAttachmentEfficiency - 50) / 20; // Convert 0-100 to -2.5 to +2.5

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Calculate versatility score
   */
  private calculateVersatilityScore(
    meta: MetaGameAnalysis,
    archetype: ArchetypeClassification
  ): number {
    let versatility = 50; // Base

    // Multiple win conditions
    if (archetype.secondaryArchetype) {
      versatility += 15;
    }

    // Good matchup spread
    const goodMatchups = meta.popularMatchups.filter(m => m.winRate >= 50).length;
    const totalMatchups = meta.popularMatchups.length;
    
    if (totalMatchups > 0) {
      const matchupRatio = goodMatchups / totalMatchups;
      versatility += matchupRatio * 30;
    }

    // Tech card slots
    versatility += Math.min(15, meta.techRecommendations.length * 3);

    // Archetype bonuses
    if (archetype.primaryArchetype === DeckArchetype.TOOLBOX) {
      versatility += 20;
    } else if (archetype.primaryArchetype === DeckArchetype.MIDRANGE) {
      versatility += 10;
    }

    // Recovery ability
    if (meta.popularMatchups.some(m => m.keyFactors.includes('Comeback potential'))) {
      versatility += 10;
    }

    return Math.min(100, Math.round(versatility));
  }

  /**
   * Calculate meta relevance score
   */
  private calculateMetaRelevanceScore(meta: MetaGameAnalysis): number {
    let relevance = 0;

    // Meta position
    switch (meta.metaPosition) {
      case 'tier1':
        relevance = 90;
        break;
      case 'tier2':
        relevance = 70;
        break;
      case 'tier3':
        relevance = 50;
        break;
      case 'rogue':
        relevance = 30;
        break;
    }

    // Matchup performance
    const avgWinRate = meta.popularMatchups.reduce((sum, m) => sum + m.winRate, 0) / 
                      (meta.popularMatchups.length || 1);
    
    if (avgWinRate >= 55) relevance += 10;
    else if (avgWinRate >= 50) relevance += 5;
    else if (avgWinRate <= 45) relevance -= 10;

    // Format viability
    relevance = (relevance * meta.formatEvaluation.viability) / 100;

    // Rotation resistance
    if (meta.rotationImpact.impactScore <= 20) {
      relevance += 5;
    } else if (meta.rotationImpact.impactScore >= 50) {
      relevance -= 10;
    }

    return Math.min(100, Math.max(0, Math.round(relevance)));
  }

  /**
   * Calculate innovation score
   */
  private calculateInnovationScore(
    meta: MetaGameAnalysis,
    archetype: ArchetypeClassification
  ): number {
    let innovation = 50; // Base

    // Rogue deck bonus
    if (meta.metaPosition === 'rogue') {
      innovation += 30;
    }

    // Unique archetype combination
    if (archetype.secondaryArchetype) {
      innovation += 15;
    }

    // Not matching known meta deck
    if (meta.archetypeMatch === 'Rogue Deck') {
      innovation += 20;
    }

    // Low confidence in archetype (unique strategy)
    if (archetype.confidence < 70) {
      innovation += 10;
    }

    // Counter-meta positioning
    if (meta.counterStrategies.length >= 3) {
      innovation += 15;
    }

    return Math.min(100, Math.round(innovation));
  }

  /**
   * Calculate difficulty score
   */
  private calculateDifficultyScore(
    archetype: ArchetypeClassification,
    synergy: SynergyAnalysis
  ): number {
    let difficulty = 50; // Base

    // Archetype difficulty
    const archetypeDifficulty: { [key in DeckArchetype]: number } = {
      [DeckArchetype.AGGRO]: 30,
      [DeckArchetype.TURBO]: 40,
      [DeckArchetype.MIDRANGE]: 50,
      [DeckArchetype.TOOLBOX]: 70,
      [DeckArchetype.SPREAD]: 60,
      [DeckArchetype.COMBO]: 80,
      [DeckArchetype.CONTROL]: 85,
      [DeckArchetype.MILL]: 75,
      [DeckArchetype.STALL]: 65,
    };

    difficulty = archetypeDifficulty[archetype.primaryArchetype] || 50;

    // Complex synergies
    if (synergy.abilityCombos.length >= 3) {
      difficulty += 10;
    }

    // Multiple attack combos
    if (synergy.attackCombos.length >= 2) {
      difficulty += 10;
    }

    // Resource management complexity
    if (synergy.overallSynergy >= 80) {
      difficulty += 5; // High synergy often means complex interactions
    }

    // Secondary archetype adds complexity
    if (archetype.secondaryArchetype) {
      difficulty += 10;
    }

    return Math.min(100, Math.round(difficulty));
  }

  /**
   * Calculate overall score with archetype weights
   */
  private calculateOverallScore(
    scores: {
      consistency: number;
      power: number;
      speed: number;
      versatility: number;
      metaRelevance: number;
      innovation: number;
      difficulty: number;
    },
    archetype: DeckArchetype
  ): number {
    // Archetype-specific weights
    const weights = this.getArchetypeWeights(archetype);

    let weightedScore = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([key, weight]) => {
      if (key !== 'difficulty' && key !== 'innovation') {
        weightedScore += scores[key as keyof typeof scores] * weight;
        totalWeight += weight;
      }
    });

    // Innovation is a bonus, not a requirement
    const innovationBonus = (scores.innovation - 50) * 0.1; // -5 to +5 bonus

    const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 50;
    
    return Math.min(100, Math.max(0, Math.round(baseScore + innovationBonus)));
  }

  /**
   * Get archetype-specific weights
   */
  private getArchetypeWeights(archetype: DeckArchetype): Record<string, number> {
    const weights: { [key in DeckArchetype]: Record<string, number> } = {
      [DeckArchetype.AGGRO]: {
        consistency: 0.20,
        power: 0.30,
        speed: 0.35,
        versatility: 0.05,
        metaRelevance: 0.10,
      },
      [DeckArchetype.CONTROL]: {
        consistency: 0.30,
        power: 0.15,
        speed: 0.10,
        versatility: 0.25,
        metaRelevance: 0.20,
      },
      [DeckArchetype.COMBO]: {
        consistency: 0.35,
        power: 0.30,
        speed: 0.15,
        versatility: 0.10,
        metaRelevance: 0.10,
      },
      [DeckArchetype.MIDRANGE]: {
        consistency: 0.25,
        power: 0.20,
        speed: 0.20,
        versatility: 0.20,
        metaRelevance: 0.15,
      },
      [DeckArchetype.MILL]: {
        consistency: 0.30,
        power: 0.10,
        speed: 0.15,
        versatility: 0.20,
        metaRelevance: 0.25,
      },
      [DeckArchetype.STALL]: {
        consistency: 0.35,
        power: 0.05,
        speed: 0.10,
        versatility: 0.25,
        metaRelevance: 0.25,
      },
      [DeckArchetype.TOOLBOX]: {
        consistency: 0.20,
        power: 0.15,
        speed: 0.15,
        versatility: 0.35,
        metaRelevance: 0.15,
      },
      [DeckArchetype.TURBO]: {
        consistency: 0.25,
        power: 0.25,
        speed: 0.40,
        versatility: 0.05,
        metaRelevance: 0.05,
      },
      [DeckArchetype.SPREAD]: {
        consistency: 0.25,
        power: 0.20,
        speed: 0.20,
        versatility: 0.20,
        metaRelevance: 0.15,
      },
    };

    return weights[archetype] || weights[DeckArchetype.MIDRANGE];
  }

  /**
   * Generate score breakdown
   */
  private generateBreakdown(
    consistency: ConsistencyAnalysis,
    synergy: SynergyAnalysis,
    speed: SpeedAnalysis,
    meta: MetaGameAnalysis,
    archetype: ArchetypeClassification,
    scores: Record<string, number>
  ): ScoreBreakdown {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Identify strengths
    if (scores.consistency >= 80) {
      strengths.push('Highly consistent setup');
    }
    if (scores.power >= 80) {
      strengths.push('Powerful damage output');
    }
    if (scores.speed >= 80) {
      strengths.push('Very fast deck');
    }
    if (scores.versatility >= 80) {
      strengths.push('Highly versatile strategy');
    }
    if (scores.metaRelevance >= 80) {
      strengths.push('Strong meta positioning');
    }
    if (synergy.overallSynergy >= 80) {
      strengths.push('Excellent card synergies');
    }
    if (speed.prizeRaceSpeed.ohkoCapability) {
      strengths.push('Can OHKO VMAXes');
    }

    // Identify weaknesses
    if (scores.consistency <= 60) {
      weaknesses.push('Inconsistent setup');
    }
    if (scores.power <= 60 && archetype.primaryArchetype !== DeckArchetype.CONTROL) {
      weaknesses.push('Low damage output');
    }
    if (scores.speed <= 40) {
      weaknesses.push('Slow deck speed');
    }
    if (consistency.mulliganProbability > 0.15) {
      weaknesses.push('High mulligan rate');
    }
    if (meta.weaknesses.some(w => w.severity === 'high')) {
      weaknesses.push('Vulnerable to meta threats');
    }
    if (speed.lateGameSustainability <= 60) {
      weaknesses.push('Poor late game');
    }

    // Core strategy
    const coreStrategy = this.identifyCoreStrategy(archetype, synergy, speed);

    // Win conditions
    const winConditions = this.identifyWinConditions(archetype, speed, meta);

    return {
      strengths,
      weaknesses,
      coreStrategy,
      winConditions,
    };
  }

  /**
   * Identify core strategy
   */
  private identifyCoreStrategy(
    archetype: ArchetypeClassification,
    synergy: SynergyAnalysis,
    speed: SpeedAnalysis
  ): string {
    // Start with archetype base
    let strategy = archetype.playstyle;

    // Add specific synergy details
    if (synergy.abilityCombos.length > 0) {
      const topCombo = synergy.abilityCombos[0];
      strategy += ` Key combo: ${topCombo.description}.`;
    }

    // Add speed context
    if (speed.overallSpeed === 'turbo' || speed.overallSpeed === 'fast') {
      strategy += ' Aims to set up and attack quickly.';
    } else if (speed.overallSpeed === 'slow') {
      strategy += ' Takes time to set up powerful board state.';
    }

    return strategy;
  }

  /**
   * Identify win conditions
   */
  private identifyWinConditions(
    archetype: ArchetypeClassification,
    speed: SpeedAnalysis,
    meta: MetaGameAnalysis
  ): string[] {
    const conditions: string[] = [];

    // Primary win condition based on archetype
    switch (archetype.primaryArchetype) {
      case DeckArchetype.AGGRO:
      case DeckArchetype.TURBO:
        conditions.push('Take 6 prizes quickly through aggressive attacks');
        break;
      case DeckArchetype.CONTROL:
        conditions.push('Control the board and win through resource advantage');
        break;
      case DeckArchetype.COMBO:
        conditions.push('Execute key combo for game-winning damage');
        break;
      case DeckArchetype.MILL:
        conditions.push('Deck out opponent by discarding their cards');
        break;
      case DeckArchetype.STALL:
        conditions.push('Win on time or deck out while preventing opponent from taking prizes');
        break;
      case DeckArchetype.SPREAD:
        conditions.push('Set up multiple knockouts with spread damage');
        break;
      default:
        conditions.push('Take 6 prizes through consistent attacks');
    }

    // Secondary conditions
    if (speed.prizeRaceSpeed.ohkoCapability) {
      conditions.push('One-shot key threats for tempo advantage');
    }

    if (speed.prizeRaceSpeed.comebackPotential >= 70) {
      conditions.push('Come back from behind with efficient trades');
    }

    if (meta.counterStrategies.length > 0) {
      conditions.push('Exploit opponent\'s weaknesses with tech cards');
    }

    return conditions;
  }
}