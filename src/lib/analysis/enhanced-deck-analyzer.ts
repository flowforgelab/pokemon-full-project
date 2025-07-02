import { Deck, DeckCard, Card } from '@prisma/client';
import { ConsistencyCalculator } from './consistency-calculator';
import { EnhancedSynergyAnalyzer } from './enhanced-synergy-analyzer';
import { MetaEvaluator } from './meta-evaluator';
import { CardCategorizer } from './card-categorizer';
import { 
  META_ARCHETYPES, 
  DECK_RULES, 
  ENERGY_ACCELERATION,
  TECH_CARDS,
} from './pokemon-tcg-knowledge';
import { DeckArchetype } from './types';
import type {
  DeckAnalysisResult,
  AnalysisConfig,
  Recommendation,
  AnalysisWarning,
} from './types';

export class EnhancedDeckAnalyzer {
  private config: AnalysisConfig;
  private categorizer: CardCategorizer;

  constructor(config: AnalysisConfig = { format: 'standard', includeRotation: true }) {
    this.config = config;
    this.categorizer = new CardCategorizer();
  }

  /**
   * Analyze a deck with real Pokemon TCG knowledge
   */
  async analyzeDeck(
    deck: Deck & { cards: (DeckCard & { card: Card })[] }
  ): Promise<DeckAnalysisResult> {
    // Start with comprehensive validation
    const warnings = this.validateDeck(deck);
    
    // Categorize all cards for deeper analysis
    const categorizedCards = this.categorizer.categorizeCards(
      deck.cards.map(dc => dc.card)
    );
    
    // Perform enhanced analyses
    const consistencyCalculator = new ConsistencyCalculator(deck.cards);
    const consistency = consistencyCalculator.analyze();
    
    // Enhanced analysis with categorized cards
    const enhancedConsistency = this.enhanceConsistencyAnalysis(
      consistency,
      deck.cards,
      categorizedCards
    );
    
    // Synergy with real combos
    const synergyAnalyzer = new EnhancedSynergyAnalyzer(deck.cards);
    const synergy = synergyAnalyzer.analyze();
    
    // Speed analysis with setup understanding
    const speed = this.analyzeSpeedWithArchetypes(deck.cards, categorizedCards);
    
    // Archetype detection with meta knowledge
    const archetype = this.detectRealArchetype(deck.cards, categorizedCards);
    
    // Meta evaluation
    const metaEvaluator = new MetaEvaluator(deck.cards, this.config.format);
    const meta = this.enhanceMetaAnalysis(
      metaEvaluator.analyze(archetype.primaryArchetype),
      archetype,
      deck.cards
    );
    
    // Calculate meaningful scores
    const scores = this.calculateMeaningfulScores(
      enhancedConsistency,
      synergy,
      speed,
      meta,
      archetype,
      deck.cards
    );
    
    // Generate specific recommendations
    const recommendations = this.generateSpecificRecommendations(
      deck,
      enhancedConsistency,
      synergy,
      speed,
      meta,
      archetype,
      scores,
      categorizedCards
    );
    
    // Add deck composition info
    const deckComposition = this.analyzeDeckComposition(deck.cards);
    
    // Build comprehensive result
    const result: DeckAnalysisResult = {
      deckId: deck.id,
      timestamp: new Date(),
      consistency: enhancedConsistency,
      synergy,
      meta,
      speed,
      matchups: this.generateMatchupPredictions(archetype, meta),
      archetype,
      performance: {
        tournamentPerformance: this.calculateTournamentPerformance(scores, archetype) ?? 50,
        consistencyRating: Math.round(enhancedConsistency.overallConsistency / 10),
        powerLevel: Math.round(scores.power / 10),
        metaViability: Math.round(scores.metaRelevance / 10),
        skillCeiling: this.calculateSkillCeiling(archetype, deck.cards),
        budgetEfficiency: await this.calculateRealBudgetEfficiency(deck.cards),
        futureProofing: 100 - meta.rotationImpact.impactScore,
        learningCurve: this.determineLearningCurve(archetype, scores.difficulty),
      },
      scores,
      recommendations,
      warnings,
      // Add deck composition as additional data
      deckInfo: deckComposition
    };
    
    return result;
  }
  
  /**
   * Enhanced consistency analysis with real understanding
   */
  private enhanceConsistencyAnalysis(
    baseConsistency: any,
    deckCards: (DeckCard & { card: Card })[],
    categorizedCards: Map<string, any>
  ): any {
    // Count actual draw supporters
    let drawSupporterCount = 0;
    let searchItemCount = 0;
    let energySearchCount = 0;
    
    deckCards.forEach(dc => {
      const category = categorizedCards.get(dc.card.id);
      if (category?.trainerType === 'draw') {
        drawSupporterCount += dc.quantity;
      } else if (category?.trainerType === 'search') {
        searchItemCount += dc.quantity;
      } else if (category?.trainerType === 'energy_accel' || 
                 dc.card.name.includes('Energy Search')) {
        energySearchCount += dc.quantity;
      }
    });
    
    // Override generic values with real counts
    baseConsistency.trainerDistribution.drawPower = drawSupporterCount;
    baseConsistency.trainerDistribution.search = searchItemCount;
    baseConsistency.energyRatio.energySearch = energySearchCount;
    
    // Recalculate balance based on actual needs
    baseConsistency.trainerDistribution.balance = {
      draw: drawSupporterCount >= 8,
      search: searchItemCount >= 8,
      supporters: baseConsistency.trainerDistribution.supporters >= 10,
      items: baseConsistency.trainerDistribution.items >= 15,
      hasStadium: baseConsistency.trainerDistribution.stadiums > 0
    };
    
    // Add Pokemon setup analysis
    const basicPokemonCount = deckCards
      .filter(dc => dc.card.supertype === 'POKEMON' && !dc.card.evolvesFrom)
      .reduce((sum, dc) => sum + dc.quantity, 0);
    
    // Recalculate mulligan probability with Battle VIP Pass consideration
    const hasVIPPass = deckCards.some(dc => dc.card.name === 'Battle VIP Pass');
    if (hasVIPPass && basicPokemonCount >= 8) {
      baseConsistency.mulliganProbability *= 0.7; // VIP Pass reduces impact
    }
    
    return baseConsistency;
  }
  
  
  /**
   * Analyze speed with archetype knowledge
   */
  private analyzeSpeedWithArchetypes(
    deckCards: (DeckCard & { card: Card })[],
    categorizedCards: Map<string, any>
  ): any {
    let setupTurn = 3; // Default
    let energyEfficiency = 50;
    
    // Check for speed cards
    const hasVIPPass = deckCards.some(dc => dc.card.name === 'Battle VIP Pass');
    const hasIrida = deckCards.some(dc => dc.card.name === 'Irida');
    const hasQuickBall = deckCards.some(dc => dc.card.name === 'Quick Ball');
    
    if (hasVIPPass && hasQuickBall) {
      setupTurn = Math.max(1, setupTurn - 1);
    }
    
    // Check for energy acceleration
    const energyAccelCards = deckCards.filter(dc => {
      const category = categorizedCards.get(dc.card.id);
      return category?.trainerType === 'energy_accel' ||
             ENERGY_ACCELERATION.GENERAL.includes(dc.card.name);
    });
    
    if (energyAccelCards.length > 0) {
      energyEfficiency += energyAccelCards.length * 10;
      setupTurn = Math.max(1, setupTurn - 0.5);
    }
    
    // Check for main attackers
    const mainAttackers = Array.from(categorizedCards.entries())
      .filter(([_, cat]) => cat.role === 'main_attacker')
      .map(([cardId, _]) => deckCards.find(dc => dc.card.id === cardId))
      .filter(Boolean);
    
    const avgAttackCost = mainAttackers.reduce((sum, dc) => {
      const attacks = (dc!.card.attacks as any[]) || [];
      const minCost = Math.min(...attacks.map(a => a.cost?.length || 3));
      return sum + minCost;
    }, 0) / Math.max(1, mainAttackers.length);
    
    return {
      averageSetupTurn: setupTurn,
      energyAttachmentEfficiency: Math.min(100, energyEfficiency),
      drawPowerRating: deckCards.filter(dc => 
        categorizedCards.get(dc.card.id)?.trainerType === 'draw'
      ).length * 12,
      searchEffectiveness: deckCards.filter(dc => 
        categorizedCards.get(dc.card.id)?.trainerType === 'search'
      ).length * 10,
      firstTurnAdvantage: hasVIPPass ? 80 : 40,
      prizeRaceSpeed: {
        averagePrizesPerTurn: avgAttackCost <= 2 ? 1.5 : 1,
        damageOutput: this.calculateAverageDamage(mainAttackers),
        ohkoCapability: mainAttackers.some(dc => {
          const attacks = (dc!.card.attacks as any[]) || [];
          return attacks.some(a => parseInt(a.damage) >= 280);
        }),
        twoHitKoReliability: 80,
        comebackPotential: 60
      },
      recoverySpeed: 60,
      lateGameSustainability: 70,
      overallSpeed: setupTurn <= 1.5 ? 'fast' : setupTurn <= 2.5 ? 'medium' : 'slow'
    };
  }
  
  /**
   * Detect real archetype based on key cards
   */
  private detectRealArchetype(
    deckCards: (DeckCard & { card: Card })[],
    categorizedCards: Map<string, any>
  ): any {
    const cardNames = deckCards.map(dc => dc.card.name);
    
    // Check each known archetype
    for (const [archetypeKey, archetypeData] of Object.entries(META_ARCHETYPES)) {
      const matchingCards = archetypeData.keyCards.filter(keyCard =>
        cardNames.some(name => name.includes(keyCard))
      );
      
      const matchPercentage = (matchingCards.length / archetypeData.keyCards.length) * 100;
      
      if (matchPercentage >= 60) {
        return {
          primaryArchetype: this.mapArchetypeToEnum(archetypeData.name),
          secondaryArchetype: undefined,
          confidence: matchPercentage,
          characteristics: archetypeData.strengths,
          playstyle: archetypeData.strategy,
          description: `This deck appears to be ${archetypeData.name}, a Tier ${archetypeData.tier} deck. ${archetypeData.strategy}`
        };
      }
    }
    
    // Fallback to generic archetype detection
    const mainAttackers = Array.from(categorizedCards.values())
      .filter(cat => cat.role === 'main_attacker').length;
    const controlCards = deckCards.filter(dc => 
      dc.card.name.includes('Crushing Hammer') ||
      dc.card.name.includes('Judge') ||
      dc.card.name.includes('Marnie')
    ).length;
    
    if (controlCards >= 8) {
      return {
        primaryArchetype: DeckArchetype.CONTROL,
        confidence: 60,
        characteristics: ['Disruption focused', 'Resource denial'],
        playstyle: 'Disrupt opponent while setting up win condition',
        description: 'Control deck focused on disruption'
      };
    } else if (mainAttackers >= 4) {
      return {
        primaryArchetype: DeckArchetype.AGGRO,
        confidence: 70,
        characteristics: ['Multiple attackers', 'Aggressive'],
        playstyle: 'Apply constant pressure with efficient attackers',
        description: 'Aggressive deck with multiple threats'
      };
    }
    
    return {
      primaryArchetype: DeckArchetype.MIDRANGE,
      confidence: 50,
      characteristics: ['Balanced', 'Flexible'],
      playstyle: 'Adapt to the matchup',
      description: 'This deck does not match any known meta archetype'
    };
  }
  
  /**
   * Enhanced meta analysis
   */
  private enhanceMetaAnalysis(baseMeta: any, archetype: any, deckCards: any[]): any {
    // Add real matchup data
    const archetypeKey = this.findArchetypeKey(archetype.primaryArchetype);
    if (archetypeKey && META_ARCHETYPES[archetypeKey]) {
      const archetypeData = META_ARCHETYPES[archetypeKey];
      baseMeta.weaknesses = archetypeData.weaknesses;
      baseMeta.metaPosition = `tier${archetypeData.tier}` as any;
    }
    
    // Add tech card recommendations
    baseMeta.techRecommendations = this.generateTechRecommendations(
      archetype.primaryArchetype,
      deckCards
    );
    
    return baseMeta;
  }
  
  /**
   * Calculate meaningful scores
   */
  private calculateMeaningfulScores(
    consistency: any,
    synergy: any,
    speed: any,
    meta: any,
    archetype: any,
    deckCards: any[]
  ): any {
    // Base scores on actual analysis
    const scores = {
      consistency: consistency.overallConsistency,
      power: this.calculatePowerScore(deckCards),
      speed: speed.overallSpeed === 'fast' ? 85 : speed.overallSpeed === 'medium' ? 65 : 45,
      versatility: this.calculateVersatilityScore(deckCards, archetype),
      metaRelevance: this.calculateMetaRelevance(archetype),
      innovation: this.calculateInnovationScore(archetype, deckCards),
      difficulty: this.calculateDifficultyScore(archetype, deckCards),
      overall: 0,
      breakdown: {
        strengths: [],
        weaknesses: [],
        coreStrategy: '',
        winConditions: []
      }
    };
    
    // Calculate weighted overall
    scores.overall = Math.round(
      scores.consistency * 0.25 +
      scores.power * 0.20 +
      scores.speed * 0.20 +
      scores.versatility * 0.15 +
      scores.metaRelevance * 0.20
    );
    
    // Generate breakdown
    scores.breakdown = this.generateScoreBreakdown(scores, archetype, deckCards);
    
    return scores;
  }
  
  /**
   * Generate specific recommendations
   */
  private generateSpecificRecommendations(
    deck: any,
    consistency: any,
    synergy: any,
    speed: any,
    meta: any,
    archetype: any,
    scores: any,
    categorizedCards: Map<string, any>
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const deckCards = deck.cards;
    
    // Check card counts
    const totalCards = deckCards.reduce((sum: number, dc: any) => sum + dc.quantity, 0);
    if (totalCards !== 60) {
      recommendations.push({
        type: totalCards < 60 ? 'add' : 'remove',
        priority: 'high',
        reason: `Deck has ${totalCards} cards, must have exactly 60`,
        impact: 'Legal deck for tournament play',
        suggestion: totalCards < 60 ? 
          `Add ${60 - totalCards} more cards` : 
          `Remove ${totalCards - 60} cards`
      });
    }
    
    // Check draw support
    const drawSupport = deckCards.filter((dc: any) => 
      categorizedCards.get(dc.card.id)?.trainerType === 'draw'
    ).reduce((sum: number, dc: any) => sum + dc.quantity, 0);
    
    if (drawSupport < 8) {
      const currentResearch = deckCards.filter((dc: any) => 
        dc.card.name === "Professor's Research"
      ).reduce((sum: number, dc: any) => sum + dc.quantity, 0);
      
      if (currentResearch < 4) {
        recommendations.push({
          type: 'add',
          priority: 'high',
          card: "Professor's Research",
          quantity: 4 - currentResearch,
          reason: 'Insufficient draw support',
          impact: 'Dramatically improved consistency',
          alternativeOptions: ['Iono', "Colress's Experiment"]
        });
      }
    }
    
    // Check for Quick Ball
    const quickBallCount = deckCards.filter((dc: any) => 
      dc.card.name === 'Quick Ball'
    ).reduce((sum: number, dc: any) => sum + dc.quantity, 0);
    
    if (quickBallCount < 4) {
      recommendations.push({
        type: 'add',
        priority: 'high',
        card: 'Quick Ball',
        quantity: 4 - quickBallCount,
        reason: 'Essential search card for consistency',
        impact: 'Find Pokemon reliably'
      });
    }
    
    // Archetype-specific recommendations
    if (archetype.primaryArchetype && META_ARCHETYPES[archetype.primaryArchetype]) {
      const archetypeData = META_ARCHETYPES[archetype.primaryArchetype];
      
      // Check for missing key cards
      for (const keyCard of archetypeData.keyCards) {
        const hasCard = deckCards.some((dc: any) => dc.card.name.includes(keyCard));
        if (!hasCard) {
          recommendations.push({
            type: 'add',
            priority: 'medium',
            card: keyCard,
            quantity: 1,
            reason: `Key card for ${archetypeData.name} archetype`,
            impact: 'Essential for deck strategy'
          });
        }
      }
    }
    
    // Tech card recommendations based on meta
    const techRecs = this.generateTechRecommendations(
      archetype.primaryArchetype,
      deckCards
    );
    
    techRecs.slice(0, 2).forEach(tech => {
      recommendations.push({
        type: 'add',
        priority: 'low',
        card: tech.card,
        quantity: tech.count,
        reason: tech.reason,
        impact: `Improves matchups vs ${tech.matchupImprovements.join(', ')}`
      });
    });
    
    return recommendations.slice(0, 10); // Top 10 recommendations
  }
  
  // Helper methods
  
  
  private generateMatchupPredictions(archetype: any, meta: any): any[] {
    const matchups: any[] = [];
    
    const archetypeKey = this.findArchetypeKey(archetype.primaryArchetype);
    if (archetypeKey && META_ARCHETYPES[archetypeKey]) {
      const myArchetype = META_ARCHETYPES[archetypeKey];
      
      // Generate matchups vs other top decks
      for (const [oppArchetype, oppData] of Object.entries(META_ARCHETYPES)) {
        if (oppArchetype !== archetype.primaryArchetype && oppData.tier <= 2) {
          let winRate = 50; // Base
          
          // Check type advantages
          if (myArchetype.weaknesses.some(w => oppData.name.toLowerCase().includes(w.toLowerCase()))) {
            winRate -= 15;
          }
          
          // Speed advantage
          if (myArchetype.avgSetupTurn < oppData.avgSetupTurn) {
            winRate += 10;
          }
          
          matchups.push({
            opponent: oppData.name,
            winRate: Math.max(25, Math.min(75, winRate)),
            keyFactors: [`${oppData.strategy}`],
            techCards: TECH_CARDS[`VS_${oppArchetype}`] || []
          });
        }
      }
    }
    
    return matchups;
  }
  
  private calculatePowerScore(deckCards: any[]): number {
    let totalDamage = 0;
    let attackerCount = 0;
    
    deckCards.forEach(dc => {
      if (dc.card.attacks && (dc.card.attacks as any[]).length > 0) {
        const maxDamage = Math.max(...(dc.card.attacks as any[]).map(a => 
          parseInt(a.damage) || 0
        ));
        if (maxDamage > 0) {
          totalDamage += maxDamage * dc.quantity;
          attackerCount += dc.quantity;
        }
      }
    });
    
    const avgDamage = attackerCount > 0 ? totalDamage / attackerCount : 0;
    
    if (avgDamage >= 200) return 90;
    if (avgDamage >= 150) return 75;
    if (avgDamage >= 100) return 60;
    if (avgDamage >= 70) return 45;
    return 30;
  }
  
  private calculateVersatilityScore(deckCards: any[], archetype: any): number {
    const uniqueAttackers = new Set(
      deckCards
        .filter(dc => dc.card.attacks && (dc.card.attacks as any[]).length > 0)
        .map(dc => dc.card.name)
    ).size;
    
    const hasMultipleWinCons = uniqueAttackers >= 3;
    const hasBackupPlan = deckCards.some(dc => 
      dc.card.name.includes('Lost City') || 
      dc.card.name.includes('Path to the Peak')
    );
    
    let score = 50;
    if (hasMultipleWinCons) score += 25;
    if (hasBackupPlan) score += 15;
    if (archetype.primaryArchetype === 'LOST_BOX') score += 10; // Lost Box is inherently versatile
    
    return Math.min(100, score);
  }
  
  private calculateMetaRelevance(archetype: any): number {
    if (!archetype.primaryArchetype || !META_ARCHETYPES[archetype.primaryArchetype]) {
      return 30; // Unknown archetype
    }
    
    const tier = META_ARCHETYPES[archetype.primaryArchetype].tier;
    
    switch (tier) {
      case 1: return 90;
      case 2: return 70;
      case 3: return 50;
      default: return 30;
    }
  }
  
  private calculateInnovationScore(archetype: any, deckCards: any[]): number {
    // Check for unusual tech choices
    let techCount = 0;
    const commonCards = new Set([
      "Professor's Research", "Quick Ball", "Ultra Ball", 
      "Switch", "Boss's Orders"
    ]);
    
    deckCards.forEach(dc => {
      if (!commonCards.has(dc.card.name) && dc.quantity === 1) {
        techCount++;
      }
    });
    
    return Math.min(100, 50 + (techCount * 5));
  }
  
  private calculateDifficultyScore(archetype: any, deckCards: any[]): number {
    let difficulty = 50;
    
    // Complex archetypes
    if (archetype.primaryArchetype === 'LOST_BOX') difficulty += 20;
    if (archetype.primaryArchetype === 'CONTROL') difficulty += 15;
    
    // Many one-ofs increase difficulty
    const oneOfs = deckCards.filter(dc => dc.quantity === 1).length;
    difficulty += Math.min(20, oneOfs * 2);
    
    return Math.min(100, difficulty);
  }
  
  private generateScoreBreakdown(scores: any, archetype: any, deckCards: any[]): any {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    // Analyze scores
    if (scores.consistency >= 75) {
      strengths.push('Highly consistent setup');
    } else if (scores.consistency < 60) {
      weaknesses.push('Inconsistent draws');
    }
    
    if (scores.power >= 75) {
      strengths.push('Strong damage output');
    } else if (scores.power < 60) {
      weaknesses.push('Low damage potential');
    }
    
    if (scores.speed >= 75) {
      strengths.push('Fast setup');
    } else if (scores.speed < 60) {
      weaknesses.push('Slow to set up');
    }
    
    if (scores.metaRelevance >= 70) {
      strengths.push('Strong meta positioning');
    } else if (scores.metaRelevance < 50) {
      weaknesses.push('Weak in current meta');
    }
    
    // Get strategy from archetype
    let coreStrategy = 'Establish board control and win the prize trade';
    let winConditions = ['Take 6 prizes efficiently'];
    
    if (archetype.primaryArchetype && META_ARCHETYPES[archetype.primaryArchetype]) {
      const archetypeData = META_ARCHETYPES[archetype.primaryArchetype];
      coreStrategy = archetypeData.strategy;
      winConditions = [
        `Execute ${archetypeData.name} game plan`,
        'Exploit opponent weaknesses'
      ];
    }
    
    return {
      strengths,
      weaknesses,
      coreStrategy,
      winConditions
    };
  }
  
  private generateTechRecommendations(archetype: string, deckCards: any[]): any[] {
    const recommendations: any[] = [];
    const currentCards = new Set(deckCards.map((dc: any) => dc.card.name));
    
    // General tech cards everyone should consider
    const generalTech = TECH_CARDS.GENERAL.filter(card => !currentCards.has(card));
    
    generalTech.forEach(card => {
      recommendations.push({
        card,
        count: 1,
        reason: 'Versatile tech card for multiple matchups',
        matchupImprovements: ['General']
      });
    });
    
    // Specific counters based on meta
    if (archetype !== 'CHARIZARD_EX') {
      TECH_CARDS.VS_CHARIZARD
        .filter(card => !currentCards.has(card))
        .forEach(card => {
          recommendations.push({
            card,
            count: 1,
            reason: 'Counter to Charizard ex',
            matchupImprovements: ['Charizard ex']
          });
        });
    }
    
    return recommendations;
  }
  
  private calculateTournamentPerformance(scores: any, archetype: any): number | null {
    if (!archetype.primaryArchetype || !META_ARCHETYPES[archetype.primaryArchetype]) {
      return null;
    }
    
    const tier = META_ARCHETYPES[archetype.primaryArchetype].tier;
    const basePerformance = tier === 1 ? 80 : tier === 2 ? 60 : 40;
    
    // Adjust based on scores
    const consistencyModifier = (scores.consistency - 70) * 0.3;
    const powerModifier = (scores.power - 70) * 0.2;
    
    return Math.max(0, Math.min(100, basePerformance + consistencyModifier + powerModifier));
  }
  
  private calculateSkillCeiling(archetype: any, deckCards: any[]): number {
    let skillCeiling = 5;
    
    if (archetype.primaryArchetype === 'LOST_BOX') skillCeiling = 9;
    else if (archetype.primaryArchetype === 'CONTROL') skillCeiling = 8;
    else if (archetype.primaryArchetype === 'GARDEVOIR_EX') skillCeiling = 7;
    
    // Many one-ofs increase skill ceiling
    const oneOfs = deckCards.filter((dc: any) => dc.quantity === 1).length;
    skillCeiling = Math.min(10, skillCeiling + Math.floor(oneOfs / 5));
    
    return skillCeiling;
  }
  
  private async calculateRealBudgetEfficiency(deckCards: any[]): Promise<number> {
    // In real implementation, would use actual price data
    // For now, estimate based on rarity
    let totalValue = 0;
    
    deckCards.forEach(dc => {
      let cardValue = 1; // Base value
      
      if (dc.card.name.includes('ex')) cardValue = 25;
      else if (dc.card.name.includes('VSTAR')) cardValue = 15;
      else if (dc.card.name.includes(' V')) cardValue = 10;
      else if (dc.card.rarity === 'RARE_SECRET') cardValue = 30;
      else if (dc.card.rarity === 'RARE_ULTRA') cardValue = 20;
      
      totalValue += cardValue * dc.quantity;
    });
    
    // Lower total value = better budget efficiency
    if (totalValue <= 100) return 90;
    if (totalValue <= 200) return 70;
    if (totalValue <= 400) return 50;
    if (totalValue <= 600) return 30;
    return 10;
  }
  
  private determineLearningCurve(archetype: any, difficulty: number): 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    if (archetype.primaryArchetype === 'LOST_BOX' || archetype.primaryArchetype === 'CONTROL') {
      return difficulty > 70 ? 'expert' : 'advanced';
    }
    
    if (difficulty <= 40) return 'beginner';
    if (difficulty <= 60) return 'intermediate';
    if (difficulty <= 80) return 'advanced';
    return 'expert';
  }
  
  private calculateAverageDamage(attackers: any[]): number {
    if (attackers.length === 0) return 0;
    
    let totalDamage = 0;
    let count = 0;
    
    attackers.forEach(dc => {
      if (dc && dc.card.attacks) {
        const attacks = dc.card.attacks as any[];
        attacks.forEach(attack => {
          const damage = parseInt(attack.damage) || 0;
          if (damage > 0) {
            totalDamage += damage;
            count++;
          }
        });
      }
    });
    
    return count > 0 ? Math.round(totalDamage / count) : 0;
  }
  
  /**
   * Full deck validation with Pokemon TCG rules
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
        suggestion: totalCards < 60 ? 
          `Add ${60 - totalCards} more cards` : 
          `Remove ${totalCards - 60} cards`
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
        suggestion: 'Add Basic Pokemon cards'
      });
    } else {
      const basicCount = basicPokemon.reduce((sum, dc) => sum + dc.quantity, 0);
      if (basicCount < 8) {
        warnings.push({
          severity: 'warning',
          category: 'Basic Pokemon',
          message: `Low Basic Pokemon count (${basicCount})`,
          suggestion: 'Consider adding more Basic Pokemon to reduce mulligan chance'
        });
      }
    }
    
    // Check card limits
    const cardCounts = new Map<string, number>();
    deck.cards.forEach(dc => {
      const isBasicEnergy = this.isBasicEnergyCard(dc.card);
      if (!isBasicEnergy) {
        cardCounts.set(dc.card.name, (cardCounts.get(dc.card.name) || 0) + dc.quantity);
      }
    });
    
    cardCounts.forEach((count, cardName) => {
      if (count > 4) {
        warnings.push({
          severity: 'error',
          category: 'Card Limit',
          message: `${cardName} exceeds 4 card limit (${count} copies)`,
          affectedCards: [cardName]
        });
      }
    });
    
    // Check energy balance
    const energyCount = deck.cards
      .filter(dc => dc.card.supertype === 'ENERGY')
      .reduce((sum, dc) => sum + dc.quantity, 0);
    
    const { min, max } = DECK_RULES.RECOMMENDED_RATIOS.ENERGY;
    if (energyCount < min) {
      warnings.push({
        severity: 'warning',
        category: 'Energy Count',
        message: `Low energy count (${energyCount})`,
        suggestion: `Consider ${min}-${max} energy cards for consistency`
      });
    } else if (energyCount > max) {
      warnings.push({
        severity: 'warning',
        category: 'Energy Count',
        message: `High energy count (${energyCount})`,
        suggestion: `Consider reducing to ${max} or fewer energy cards`
      });
    }
    
    // Check trainer balance
    const trainerCount = deck.cards
      .filter(dc => dc.card.supertype === 'TRAINER')
      .reduce((sum, dc) => sum + dc.quantity, 0);
    
    const trainerMin = DECK_RULES.RECOMMENDED_RATIOS.TRAINERS.min;
    if (trainerCount < trainerMin) {
      warnings.push({
        severity: 'warning',
        category: 'Trainer Count',
        message: `Low trainer count (${trainerCount})`,
        suggestion: `Most competitive decks run ${trainerMin}+ trainers`
      });
    }
    
    // Check for draw support
    const drawSupport = deck.cards.filter(dc => {
      const category = this.categorizer.categorizeCard(dc.card);
      return category.trainerType === 'draw';
    });
    
    if (drawSupport.length === 0) {
      warnings.push({
        severity: 'warning',
        category: 'Draw Support',
        message: 'No draw supporters detected',
        suggestion: "Add Professor's Research, Iono, or similar cards"
      });
    }
    
    // Check for Pokemon search
    const searchCards = deck.cards.filter(dc => {
      const category = this.categorizer.categorizeCard(dc.card);
      return category.trainerType === 'search' && 
             dc.card.name.includes('Ball');
    });
    
    if (searchCards.length === 0) {
      warnings.push({
        severity: 'warning',
        category: 'Pokemon Search',
        message: 'No Pokemon search cards detected',
        suggestion: 'Add Quick Ball, Ultra Ball, or similar cards'
      });
    }
    
    return warnings;
  }
  
  /**
   * Analyze deck composition with card quantities
   */
  private analyzeDeckComposition(deckCards: (DeckCard & { card: Card })[]) {
    const totalCards = deckCards.reduce((sum, dc) => sum + dc.quantity, 0);
    const uniqueCards = deckCards.length;
    
    // Count by quantity
    const quantityDistribution: Record<number, number> = {};
    deckCards.forEach(dc => {
      quantityDistribution[dc.quantity] = (quantityDistribution[dc.quantity] || 0) + 1;
    });
    
    // Get most common cards
    const cardsByQuantity = deckCards
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(dc => ({
        name: dc.card.name,
        quantity: dc.quantity,
        type: dc.card.supertype
      }));
    
    // Energy breakdown
    const energyCards = deckCards.filter(dc => dc.card.supertype === 'ENERGY');
    const basicEnergyCount = energyCards
      .filter(dc => this.isBasicEnergyCard(dc.card))
      .reduce((sum, dc) => sum + dc.quantity, 0);
    const specialEnergyCount = energyCards
      .filter(dc => !this.isBasicEnergyCard(dc.card))
      .reduce((sum, dc) => sum + dc.quantity, 0);
    
    // Count by supertype
    const pokemonCount = deckCards
      .filter(dc => dc.card.supertype === 'POKEMON' || dc.card.supertype === Supertype.POKEMON)
      .reduce((sum, dc) => sum + dc.quantity, 0);
    
    const trainerCount = deckCards
      .filter(dc => dc.card.supertype === 'TRAINER' || dc.card.supertype === Supertype.TRAINER)
      .reduce((sum, dc) => sum + dc.quantity, 0);
    
    const energyCount = deckCards
      .filter(dc => dc.card.supertype === 'ENERGY' || dc.card.supertype === Supertype.ENERGY)
      .reduce((sum, dc) => sum + dc.quantity, 0);

    return {
      totalCards,
      uniqueCards,
      pokemonCount,
      trainerCount,
      energyCount,
      quantityDistribution,
      cardsByQuantity,
      energyBreakdown: {
        basic: basicEnergyCount,
        special: specialEnergyCount,
        total: basicEnergyCount + specialEnergyCount
      }
    };
  }
  
  /**
   * Helper to check if a card is basic energy
   */
  private isBasicEnergyCard(card: Card): boolean {
    const basicEnergyNames = [
      'Basic Fire Energy', 'Basic Water Energy', 'Basic Grass Energy', 
      'Basic Lightning Energy', 'Basic Psychic Energy', 'Basic Fighting Energy', 
      'Basic Darkness Energy', 'Basic Metal Energy', 'Basic Fairy Energy',
      'Fire Energy', 'Water Energy', 'Grass Energy',
      'Lightning Energy', 'Psychic Energy', 'Fighting Energy',
      'Darkness Energy', 'Metal Energy', 'Fairy Energy'
    ];
    
    return basicEnergyNames.some(name => 
      card.name === name || 
      (card.name.includes(name) && !card.name.includes('Special'))
    );
  }

  /**
   * Map archetype names to enum values
   */
  private mapArchetypeToEnum(archetypeName: string): DeckArchetype {
    // Map specific archetypes to general categories
    const mappings: Record<string, DeckArchetype> = {
      'Charizard ex': DeckArchetype.MIDRANGE,
      'Lost Box': DeckArchetype.TOOLBOX,
      'Gardevoir ex': DeckArchetype.COMBO,
      'Miraidon ex': DeckArchetype.TURBO,
      'Giratina VSTAR': DeckArchetype.COMBO,
      'Lugia VSTAR': DeckArchetype.MIDRANGE,
      'Iron Thorns ex': DeckArchetype.MILL,
      'Chien-Pao ex': DeckArchetype.AGGRO,
      'Arceus Variants': DeckArchetype.MIDRANGE
    };
    
    return mappings[archetypeName] || DeckArchetype.MIDRANGE;
  }
  
  /**
   * Find archetype key from enum value
   */
  private findArchetypeKey(archetype: DeckArchetype): string | null {
    // Reverse mapping from enum to key
    const reverseMap: Record<DeckArchetype, string[]> = {
      [DeckArchetype.MIDRANGE]: ['CHARIZARD_EX', 'LUGIA_VSTAR', 'ARCEUS_VARIANTS'],
      [DeckArchetype.TOOLBOX]: ['LOST_BOX'],
      [DeckArchetype.COMBO]: ['GARDEVOIR_EX', 'GIRATINA_VSTAR'],
      [DeckArchetype.TURBO]: ['MIRAIDON_EX'],
      [DeckArchetype.MILL]: ['IRON_THORNS_EX'],
      [DeckArchetype.AGGRO]: ['CHIEN_PAO_EX'],
      [DeckArchetype.CONTROL]: [],
      [DeckArchetype.STALL]: [],
      [DeckArchetype.SPREAD]: []
    };
    
    const keys = reverseMap[archetype] || [];
    return keys[0] || null;
  }
}