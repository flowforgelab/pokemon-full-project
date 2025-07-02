import { Deck, DeckCard, Card } from '@prisma/client';
import { DeckAnalysisResult, DeckArchetype } from './types';
import { calculateMulliganProbability, calculateDeadDrawProbability, calculatePrizeAtLeastOne } from './probability-calculator';
import { getCardQualityScore, analyzeTrainerQuality, categorizeCard, getUpgradeRecommendation } from './card-quality-database';
import { analyzeEvolutionLines, getEvolutionLineWarnings } from './evolution-line-analyzer';
import { validateDeckLegality, getDeckCompositionWarnings } from './deck-validator';
import { analyzeMetaPosition, CURRENT_STANDARD_META } from './meta-context';
import { getMatchupTable } from './matchup-predictor';
import { buildSynergyGraph, getSynergyRecommendations } from './synergy-graph';
import { calculateMultiFactorScore } from './multi-factor-scoring';
import { calculateDynamicSpeedRating } from './dynamic-speed-rating';
import { analyzePrizeTradeEconomy } from './prize-trade-analysis';
import { generateSmartWarnings, getWarningSummary } from './smart-warnings';
import { generateCardRecommendations } from './card-recommendations';

/**
 * SafeAnalyzer - A bulletproof deck analyzer that ALWAYS returns valid data
 * This analyzer prioritizes stability over accuracy
 */
export class SafeAnalyzer {
  /**
   * Analyze a deck and ALWAYS return valid results
   */
  async analyzeDeck(
    deck: Deck & { cards: (DeckCard & { card: Card })[] }
  ): Promise<DeckAnalysisResult> {
    try {
      // Extract basic deck info safely
      const cardCount = this.getCardCount(deck);
      const { pokemonCount, trainerCount, energyCount } = this.getCardTypes(deck);
      
      // Generate safe default values
      const timestamp = new Date();
      const deckId = deck.id || 'unknown';
      
      // Use Phase 3 multi-factor scoring
      const multiFactorAnalysis = calculateMultiFactorScore(deck.cards);
      
      // Extract scores from multi-factor analysis
      const consistencyScore = multiFactorAnalysis.scoreBreakdown.consistency;
      const powerScore = multiFactorAnalysis.scoreBreakdown.power;
      const speedScore = multiFactorAnalysis.scoreBreakdown.speed;
      const versatilityScore = multiFactorAnalysis.scoreBreakdown.versatility;
      const metaRelevanceScore = multiFactorAnalysis.scoreBreakdown.metaRelevance;
      
      // Use dynamic speed rating
      const dynamicSpeed = calculateDynamicSpeedRating(deck.cards);
      
      // Analyze prize trade economy
      const prizeTradeAnalysis = analyzePrizeTradeEconomy(deck.cards);
      
      // Build synergy graph
      const synergyGraph = buildSynergyGraph(deck.cards);
      const innovationScore = synergyGraph.synergyScore;
      
      // Get meta analysis (needed for meta field)
      const metaAnalysis = analyzeMetaPosition(deck.cards);
      
      // Calculate difficulty based on complexity
      const difficultyScore = this.calculateDifficultyScore(
        deck.cards,
        synergyGraph,
        dynamicSpeed
      );
      
      // Use multi-factor overall score
      const overallScore = multiFactorAnalysis.overallScore;

      // Build the complete result object with ALL required fields
      const result: DeckAnalysisResult = {
        deckId,
        timestamp,
        
        // Consistency analysis
        consistency: {
          energyRatio: {
            totalEnergy: energyCount,
            basicEnergy: Math.floor(energyCount * 0.7),
            specialEnergy: Math.ceil(energyCount * 0.3),
            energySearch: 0,
            energyPercentage: cardCount > 0 ? (energyCount / cardCount) * 100 : 0,
            recommendedRange: { min: 15, max: 25 },
            isOptimal: energyCount >= 10 && energyCount <= 20
          },
          trainerDistribution: {
            totalTrainers: trainerCount,
            drawPower: Math.min(8, Math.floor(trainerCount * 0.3)),
            search: Math.min(8, Math.floor(trainerCount * 0.3)),
            disruption: Math.min(4, Math.floor(trainerCount * 0.1)),
            utility: Math.max(0, trainerCount - Math.floor(trainerCount * 0.7)),
            stadiums: Math.min(3, Math.floor(trainerCount * 0.1)),
            tools: Math.min(4, Math.floor(trainerCount * 0.15)),
            supporters: Math.min(12, Math.floor(trainerCount * 0.4)),
            items: Math.max(0, trainerCount - Math.floor(trainerCount * 0.4)),
            balance: {
              draw: trainerCount >= 6,
              search: trainerCount >= 4,
              supporters: trainerCount >= 8,
              items: trainerCount >= 10,
              hasStadium: trainerCount >= 2
            }
          },
          pokemonRatio: {
            totalPokemon: pokemonCount,
            basics: Math.max(1, Math.floor(pokemonCount * 0.6)),
            evolutions: Math.max(0, pokemonCount - Math.floor(pokemonCount * 0.6)),
            attackers: Math.max(1, Math.floor(pokemonCount * 0.7)),
            support: Math.max(0, pokemonCount - Math.floor(pokemonCount * 0.7)),
            evolutionLines: [],
            pokemonBalance: pokemonCount >= 10 && pokemonCount <= 20
          },
          deckCurve: {
            averageEnergyCost: 2.5,
            energyDistribution: {},
            peakEnergyCost: 3,
            energyEfficiency: 75,
            accelerationNeeded: false,
            curve: 'medium' as const
          },
          mulliganProbability: calculateMulliganProbability(this.getBasicPokemonCount(deck)),
          setupProbabilities: [
            { turn: 1, probability: 0.6, keyCards: ['Basic Pokemon'], scenario: 'Basic setup' },
            { turn: 2, probability: 0.7, keyCards: ['Evolution'], scenario: 'Evolution setup' },
            { turn: 3, probability: 0.8, keyCards: ['Main attacker'], scenario: 'Full setup' }
          ],
          deadDrawProbability: this.calculateDeadDrawProbability(deck),
          prizeCardImpact: {
            keyCardVulnerability: 20,
            averageImpact: 15,
            criticalCards: [],
            resilience: 80
          },
          overallConsistency: consistencyScore
        },
        
        // Synergy analysis
        synergy: {
          typeSynergy: {
            weaknessCoverage: 70,
            resistanceUtilization: 30,
            typeBalance: true,
            vulnerabilities: []
          },
          abilityCombos: this.getAbilityCombos(deck.cards),
          trainerSynergy: this.getTrainerSynergies(synergyGraph),
          energySynergy: {
            accelerationMethods: this.getEnergyAcceleration(deck.cards),
            energyRecycling: [],
            efficiency: 70,
            consistency: 70
          },
          evolutionSynergy: {
            supportCards: this.getEvolutionSupport(deck.cards),
            evolutionSpeed: 60,
            reliability: 70
          },
          attackCombos: [],
          overallSynergy: synergyGraph.synergyScore,
          synergyGraph: synergyGraph.edges.slice(0, 10).map(edge => ({
            source: edge.source,
            target: edge.target,
            strength: edge.strength,
            type: edge.type
          }))
        },
        
        // Speed analysis
        speed: {
          averageSetupTurn: dynamicSpeed.fullSetupTurn,
          energyAttachmentEfficiency: dynamicSpeed.absoluteSpeed,
          drawPowerRating: Math.min(100, trainerCount * 5),
          searchEffectiveness: Math.min(100, trainerCount * 4),
          firstTurnAdvantage: dynamicSpeed.firstAttackTurn === 1 ? 80 : 50,
          prizeRaceSpeed: {
            averagePrizesPerTurn: prizeTradeAnalysis.averagePrizeValue,
            damageOutput: this.getAverageDamageOutput(deck.cards),
            ohkoCapability: this.hasOHKOPotential(deck.cards),
            twoHitKoReliability: 75,
            comebackPotential: prizeTradeAnalysis.strategy.primaryApproach === 'single-prize' ? 80 : 60
          },
          recoverySpeed: 60,
          lateGameSustainability: prizeTradeAnalysis.overallEfficiency,
          overallSpeed: dynamicSpeed.classification as 'slow' | 'medium' | 'fast'
        },
        
        // Meta analysis
        meta: {
          archetypeMatch: this.determineArchetype(deck),
          metaPosition: this.determineMetaTier(metaRelevanceScore),
          popularMatchups: getMatchupTable(deck.cards, this.determineArchetype(deck))
            .slice(0, 5)
            .map(m => ({
              deckName: m.opponentDeck,
              winRate: m.winRate,
              favorability: m.favorability,
              keyFactors: m.keyFactors
            })),
          counterStrategies: metaAnalysis.recommendations,
          weaknesses: this.getMetaWeaknesses(deck.cards),
          formatEvaluation: {
            format: 'standard',
            viability: metaRelevanceScore,
            legalityIssues: [],
            formatSpecificStrengths: this.getFormatStrengths(deck.cards, metaAnalysis)
          },
          rotationImpact: {
            cardsRotating: [],
            impactScore: 10,
            replacementSuggestions: {}
          },
          techRecommendations: this.getTechRecommendations(deck.cards, metaAnalysis)
        },
        
        // Archetype classification
        archetype: {
          primaryArchetype: this.determineArchetype(deck),
          secondaryArchetype: undefined,
          confidence: 70,
          characteristics: ['Balanced approach', 'Flexible strategy'],
          playstyle: 'Adapt to the matchup and play to your deck\'s strengths'
        },
        
        // Performance metrics
        performance: {
          tournamentPerformance: null,
          consistencyRating: consistencyScore,
          powerLevel: Math.round(powerScore / 10),
          metaViability: 5,
          skillCeiling: 5,
          budgetEfficiency: 70,
          futureProofing: 60,
          learningCurve: 'intermediate' as const
        },
        
        // Scores (NEVER NULL)
        scores: {
          overall: overallScore,
          consistency: consistencyScore,
          power: powerScore,
          speed: speedScore,
          versatility: versatilityScore,
          metaRelevance: metaRelevanceScore,
          innovation: innovationScore,
          difficulty: difficultyScore,
          breakdown: {
            strengths: multiFactorAnalysis.strengths,
            weaknesses: multiFactorAnalysis.weaknesses,
            coreStrategy: this.determineCoreStrategy(prizeTradeAnalysis, dynamicSpeed),
            winConditions: this.determineWinConditions(deck.cards, prizeTradeAnalysis)
          }
        },
        
        // Matchups
        matchups: [],
        
        // Recommendations
        recommendations: this.generateRecommendations(deck, cardCount),
        
        // Warnings
        warnings: this.generateWarnings(deck, cardCount, pokemonCount, energyCount, trainerCount)
      };

      return result;
      
    } catch (error) {
      console.error('SafeAnalyzer error:', error);
      
      // Return absolute minimal valid result even if everything fails
      return this.getEmergencyFallbackResult(deck.id);
    }
  }

  /**
   * Helper methods that NEVER throw
   */
  private getCardCount(deck: Deck & { cards: (DeckCard & { card: Card })[] }): number {
    try {
      return deck.cards?.reduce((sum, dc) => sum + (dc.quantity || 0), 0) || 0;
    } catch {
      return 0;
    }
  }

  private getCardTypes(deck: Deck & { cards: (DeckCard & { card: Card })[] }) {
    let pokemonCount = 0;
    let trainerCount = 0;
    let energyCount = 0;

    try {
      deck.cards?.forEach(dc => {
        const quantity = dc.quantity || 0;
        switch (dc.card?.supertype) {
          case 'POKEMON':
            pokemonCount += quantity;
            break;
          case 'TRAINER':
            trainerCount += quantity;
            break;
          case 'ENERGY':
            energyCount += quantity;
            break;
        }
      });
    } catch {
      // Ignore errors, return zeros
    }

    return { pokemonCount, trainerCount, energyCount };
  }

  private getBasicPokemonCount(deck: Deck & { cards: (DeckCard & { card: Card })[] }): number {
    try {
      return deck.cards?.reduce((sum, dc) => {
        if (dc.card?.supertype === 'POKEMON') {
          // Check if it's a basic Pokemon (no evolvesFrom)
          if (!dc.card.evolvesFrom) {
            return sum + (dc.quantity || 0);
          }
        }
        return sum;
      }, 0) || 0;
    } catch {
      return 0;
    }
  }

  private getDrawSupporterCount(deck: Deck & { cards: (DeckCard & { card: Card })[] }): number {
    try {
      const drawSupporters = [
        'professor', 'research', 'sonia', 'marnie', 'cynthia', 
        'lillie', 'hop', 'bianca', 'cheren', 'n', 'colress',
        'juniper', 'sycamore', 'kukui', 'hau', 'erika', 'oak',
        'tate & liza', 'tate', 'liza' // Tate & Liza is also a draw supporter
      ];
      
      return deck.cards?.reduce((sum, dc) => {
        if (dc.card?.supertype === 'TRAINER') {
          const name = dc.card.name?.toLowerCase() || '';
          if (drawSupporters.some(supporter => name.includes(supporter))) {
            return sum + (dc.quantity || 0);
          }
        }
        return sum;
      }, 0) || 0;
    } catch {
      return 0;
    }
  }

  private calculateDeadDrawProbability(deck: Deck & { cards: (DeckCard & { card: Card })[] }): number {
    try {
      const drawSupporters = this.getDrawSupporterCount(deck);
      if (drawSupporters === 0) return 1.0; // No draw supporters = always dead draw
      
      // Calculate probability of having NO draw supporters after drawing opening hand + 1 for turn
      // This uses hypergeometric distribution: what's the chance of drawing 0 supporters in 8 cards?
      const deckSize = 60;
      const cardsSeenByTurn1 = 8; // Opening hand (7) + draw for turn (1)
      
      // Probability of drawing exactly 0 draw supporters
      const probNoDrawSupporter = calculateMulliganProbability(drawSupporters, deckSize, cardsSeenByTurn1);
      
      return probNoDrawSupporter;
    } catch {
      return 0.3; // Default reasonable value
    }
  }

  private calculateConsistencyScore(deck: Deck & { cards: (DeckCard & { card: Card })[] }): number {
    try {
      const cardCount = this.getCardCount(deck);
      if (cardCount === 0) return 0;
      if (cardCount !== 60) return 30; // Penalize invalid deck size
      
      const { pokemonCount, trainerCount, energyCount } = this.getCardTypes(deck);
      
      // Start with base score
      let score = 0;
      
      // 1. Mulligan probability factor (0-25 points)
      const mulliganProb = calculateMulliganProbability(this.getBasicPokemonCount(deck));
      if (mulliganProb < 0.10) score += 25; // Excellent
      else if (mulliganProb < 0.15) score += 20; // Good
      else if (mulliganProb < 0.20) score += 15; // Acceptable
      else if (mulliganProb < 0.25) score += 10; // Poor
      else score += 5; // Very poor
      
      // 2. Draw power quality (0-25 points)
      const drawSupporters = deck.cards?.filter(dc => 
        dc.card.supertype === 'TRAINER' && 
        categorizeCard(dc.card.name, 'TRAINER') === 'draw'
      ) || [];
      
      const drawQuality = analyzeTrainerQuality(
        drawSupporters.map(dc => ({ name: dc.card.name, quantity: dc.quantity }))
      );
      
      score += Math.min(25, drawQuality.averageScore * 2.5);
      
      // 3. Search card quality (0-20 points)
      const searchCards = deck.cards?.filter(dc => 
        dc.card.supertype === 'TRAINER' && 
        categorizeCard(dc.card.name, 'TRAINER') === 'search'
      ) || [];
      
      const searchQuality = analyzeTrainerQuality(
        searchCards.map(dc => ({ name: dc.card.name, quantity: dc.quantity }))
      );
      
      score += Math.min(20, searchQuality.averageScore * 2);
      
      // 4. Dead draw probability (0-15 points)
      const deadDrawProb = this.calculateDeadDrawProbability(deck);
      if (deadDrawProb < 0.05) score += 15; // Excellent
      else if (deadDrawProb < 0.10) score += 12; // Good
      else if (deadDrawProb < 0.15) score += 8; // Acceptable
      else if (deadDrawProb < 0.20) score += 4; // Poor
      
      // 5. Card count ratios (0-15 points)
      if (pokemonCount >= 12 && pokemonCount <= 20) score += 5;
      if (trainerCount >= 28 && trainerCount <= 35) score += 5;
      if (energyCount >= 10 && energyCount <= 15) score += 5;
      
      return Math.min(100, Math.max(0, Math.round(score)));
    } catch {
      return 50; // Default middle score
    }
  }

  private calculatePowerScore(deck: Deck & { cards: (DeckCard & { card: Card })[] }): number {
    try {
      const { pokemonCount } = this.getCardTypes(deck);
      
      // Simple power calculation based on Pokemon count and assumed damage
      const basePower = Math.min(100, pokemonCount * 5);
      
      return Math.max(30, basePower); // Minimum 30 power
    } catch {
      return 60; // Default decent power
    }
  }

  private calculateSpeedScore(deck: Deck & { cards: (DeckCard & { card: Card })[] }): number {
    try {
      const { pokemonCount, trainerCount } = this.getCardTypes(deck);
      
      // More trainers = faster setup
      let speed = 40 + Math.min(40, trainerCount * 1.5);
      
      // Too many Pokemon slows down
      if (pokemonCount > 20) speed -= 10;
      
      return Math.min(100, Math.max(20, Math.round(speed)));
    } catch {
      return 60; // Default medium speed
    }
  }

  private calculateVersatilityScore(deck: Deck & { cards: (DeckCard & { card: Card })[] }): number {
    try {
      // Count unique cards for versatility
      const uniqueCards = new Set(deck.cards?.map(dc => dc.card?.id)).size;
      
      return Math.min(100, Math.max(40, uniqueCards * 3));
    } catch {
      return 70; // Default good versatility
    }
  }

  private determineArchetype(deck: Deck & { cards: (DeckCard & { card: Card })[] }): DeckArchetype {
    try {
      const { pokemonCount, energyCount } = this.getCardTypes(deck);
      
      if (pokemonCount > 20) return DeckArchetype.MIDRANGE;
      if (energyCount < 10) return DeckArchetype.TURBO;
      if (pokemonCount < 10) return DeckArchetype.CONTROL;
      
      return DeckArchetype.MIDRANGE; // Default safe choice
    } catch {
      return DeckArchetype.MIDRANGE;
    }
  }

  private getStrengths(overall: number, consistency: number, power: number, speed: number): string[] {
    const strengths: string[] = [];
    
    if (overall >= 80) strengths.push('Well-rounded deck');
    if (consistency >= 80) strengths.push('Highly consistent setup');
    if (power >= 80) strengths.push('Strong damage output');
    if (speed >= 80) strengths.push('Fast deck speed');
    
    if (strengths.length === 0) {
      strengths.push('Room for optimization');
    }
    
    return strengths;
  }

  private getWeaknesses(overall: number, consistency: number, power: number, speed: number): string[] {
    const weaknesses: string[] = [];
    
    if (consistency < 60) weaknesses.push('Inconsistent setup');
    if (power < 60) weaknesses.push('Low damage output');
    if (speed < 60) weaknesses.push('Slow setup speed');
    
    if (weaknesses.length === 0) {
      weaknesses.push('Could use more draw support');
    }
    
    return weaknesses;
  }

  private generateWarnings(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    cardCount: number,
    pokemonCount: number,
    energyCount: number,
    trainerCount: number
  ): Array<{ severity: 'error' | 'warning' | 'info', category: string, message: string, suggestion?: string }> {
    // Use the new smart warning system
    const smartWarnings = generateSmartWarnings(deck.cards);
    const warningSummary = getWarningSummary(smartWarnings);
    
    // Convert smart warnings to the expected format
    const warnings: Array<{ severity: 'error' | 'warning' | 'info', category: string, message: string, suggestion?: string }> = [];
    
    smartWarnings.forEach(warning => {
      // Map severity levels
      let severity: 'error' | 'warning' | 'info';
      if (warning.severity === 'critical') severity = 'error';
      else if (warning.severity === 'high' || warning.severity === 'medium') severity = 'warning';
      else severity = 'info';
      
      warnings.push({
        severity,
        category: warning.category.charAt(0).toUpperCase() + warning.category.slice(1),
        message: `${warning.title}: ${warning.description}`,
        suggestion: warning.suggestions[0] // Use first suggestion
      });
    });
    
    // Add summary warning if there are many issues
    if (warningSummary.total > 5) {
      warnings.unshift({
        severity: 'warning',
        category: 'Overall',
        message: `Deck has ${warningSummary.critical} critical, ${warningSummary.high} high, and ${warningSummary.medium} medium issues`,
        suggestion: `Estimated win rate impact: ${warningSummary.estimatedWinRateImpact.toFixed(0)}%. Focus on critical issues first.`
      });
    }

    return warnings;
  }

  private generateRecommendations(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    cardCount: number
  ): Array<{ type: 'add' | 'remove' | 'replace', priority: 'high' | 'medium' | 'low', reason: string, impact: string, suggestion?: string, card?: string }> {
    // Use the new card recommendations system
    const warnings = generateSmartWarnings(deck.cards);
    const cardRecs = generateCardRecommendations(deck.cards, warnings);
    
    const recommendations: Array<{ 
      type: 'add' | 'remove' | 'replace', 
      priority: 'high' | 'medium' | 'low', 
      reason: string, 
      impact: string, 
      suggestion?: string,
      card?: string 
    }> = [];
    
    // Convert immediate recommendations
    cardRecs.immediate.forEach(rec => {
      recommendations.push({
        type: rec.replaces ? 'replace' : 'add',
        priority: 'high',
        reason: rec.reasoning[0],
        impact: `${rec.estimatedImprovement}% improvement expected`,
        suggestion: `Add ${rec.card.quantity} ${rec.card.name}`,
        card: rec.card.name
      });
    });
    
    // Convert short-term recommendations
    cardRecs.shortTerm.slice(0, 3).forEach(rec => {
      recommendations.push({
        type: rec.replaces ? 'replace' : 'add',
        priority: 'medium',
        reason: rec.reasoning[0],
        impact: rec.reasoning[1] || 'Improved deck performance',
        suggestion: `Consider ${rec.card.quantity} ${rec.card.name}`,
        card: rec.card.name
      });
    });
    
    // Convert cuts
    cardRecs.cuts.slice(0, 3).forEach(cut => {
      recommendations.push({
        type: 'remove',
        priority: 'medium',
        reason: cut.reason,
        impact: cut.impact,
        suggestion: `Remove ${cut.quantity} ${cut.card}`,
        card: cut.card
      });
    });
    
    // Add deck size recommendation if needed
    if (cardCount !== 60) {
      recommendations.unshift({
        type: cardCount < 60 ? 'add' : 'remove',
        priority: 'high',
        reason: `Deck has ${cardCount} cards, needs exactly 60`,
        impact: 'Legal deck for tournament play',
        suggestion: cardCount < 60 ? 'Add more cards' : 'Remove extra cards'
      });
    }

    return recommendations;
  }

  /**
   * Absolute fallback - returns minimal valid structure
   */
  private getEmergencyFallbackResult(deckId: string): DeckAnalysisResult {
    const now = new Date();
    
    return {
      deckId,
      timestamp: now,
      consistency: {
        energyRatio: {
          totalEnergy: 0,
          basicEnergy: 0,
          specialEnergy: 0,
          energySearch: 0,
          energyPercentage: 0,
          recommendedRange: { min: 15, max: 25 },
          isOptimal: false
        },
        trainerDistribution: {
          totalTrainers: 0,
          drawPower: 0,
          search: 0,
          disruption: 0,
          utility: 0,
          stadiums: 0,
          tools: 0,
          supporters: 0,
          items: 0,
          balance: {
            draw: false,
            search: false,
            supporters: false,
            items: false,
            hasStadium: false
          }
        },
        pokemonRatio: {
          totalPokemon: 0,
          basics: 0,
          evolutions: 0,
          attackers: 0,
          support: 0,
          evolutionLines: [],
          pokemonBalance: false
        },
        deckCurve: {
          averageEnergyCost: 0,
          energyDistribution: {},
          peakEnergyCost: 0,
          energyEfficiency: 0,
          accelerationNeeded: false,
          curve: 'low' as const
        },
        mulliganProbability: 1,
        setupProbabilities: [],
        deadDrawProbability: 1,
        prizeCardImpact: {
          keyCardVulnerability: 100,
          averageImpact: 100,
          criticalCards: [],
          resilience: 0
        },
        overallConsistency: 0
      },
      synergy: {
        typeSynergy: {
          weaknessCoverage: 0,
          resistanceUtilization: 0,
          typeBalance: false,
          vulnerabilities: []
        },
        abilityCombos: [],
        trainerSynergy: [],
        energySynergy: {
          accelerationMethods: [],
          energyRecycling: [],
          efficiency: 0,
          consistency: 0
        },
        evolutionSynergy: {
          supportCards: [],
          evolutionSpeed: 0,
          reliability: 0
        },
        attackCombos: [],
        overallSynergy: 0,
        synergyGraph: []
      },
      speed: {
        averageSetupTurn: 99,
        energyAttachmentEfficiency: 0,
        drawPowerRating: 0,
        searchEffectiveness: 0,
        firstTurnAdvantage: 0,
        prizeRaceSpeed: {
          averagePrizesPerTurn: 0,
          damageOutput: 0,
          ohkoCapability: false,
          twoHitKoReliability: 0,
          comebackPotential: 0
        },
        recoverySpeed: 0,
        lateGameSustainability: 0,
        overallSpeed: 'slow' as const
      },
      meta: {
        archetypeMatch: 'Unknown',
        metaPosition: 'rogue' as const,
        popularMatchups: [],
        counterStrategies: [],
        weaknesses: [],
        formatEvaluation: {
          format: 'standard',
          viability: 0,
          legalityIssues: ['Unable to analyze deck'],
          formatSpecificStrengths: []
        },
        rotationImpact: {
          cardsRotating: [],
          impactScore: 0,
          replacementSuggestions: {}
        },
        techRecommendations: []
      },
      archetype: {
        primaryArchetype: DeckArchetype.MIDRANGE,
        secondaryArchetype: undefined,
        confidence: 0,
        characteristics: ['Unable to analyze'],
        playstyle: 'Unable to determine playstyle'
      },
      performance: {
        tournamentPerformance: null,
        consistencyRating: 0,
        powerLevel: 0,
        metaViability: 0,
        skillCeiling: 0,
        budgetEfficiency: 0,
        futureProofing: 0,
        learningCurve: 'unknown' as const
      },
      scores: {
        overall: 0,
        consistency: 0,
        power: 0,
        speed: 0,
        versatility: 0,
        metaRelevance: 0,
        innovation: 0,
        difficulty: 0,
        breakdown: {
          strengths: [],
          weaknesses: ['Unable to analyze deck'],
          coreStrategy: 'Unable to determine strategy',
          winConditions: []
        }
      },
      matchups: [],
      recommendations: [{
        type: 'add' as const,
        priority: 'high' as const,
        reason: 'Unable to analyze deck',
        impact: 'Please ensure deck data is valid',
        suggestion: 'Check that the deck has valid cards'
      }],
      warnings: [{
        severity: 'error',
        category: 'Analysis',
        message: 'Unable to analyze deck - using fallback values'
      }]
    };
  }

  /**
   * Determine meta tier based on relevance score
   */
  private determineMetaTier(metaRelevance: number): 'tier1' | 'tier2' | 'tier3' | 'rogue' {
    if (metaRelevance >= 80) return 'tier1';
    if (metaRelevance >= 65) return 'tier2';
    if (metaRelevance >= 50) return 'tier3';
    return 'rogue';
  }

  /**
   * Get meta weaknesses for the deck
   */
  private getMetaWeaknesses(cards: Array<DeckCard & { card: Card }>): string[] {
    const weaknesses: string[] = [];
    
    // Check for Path to the Peak vulnerability
    const hasVPokemon = cards.some(dc => 
      dc.card.supertype === 'POKEMON' && 
      dc.card.subtypes.some(st => ['V', 'VMAX', 'VSTAR'].includes(st))
    );
    
    if (hasVPokemon) {
      weaknesses.push('Vulnerable to Path to the Peak');
    }
    
    // Check for type weaknesses
    const types = new Set<string>();
    cards.forEach(dc => {
      if (dc.card.supertype === 'POKEMON' && dc.card.types) {
        dc.card.types.forEach(t => types.add(t));
      }
    });
    
    if (types.has('Lightning')) {
      weaknesses.push('Weak to Fighting types');
    }
    if (types.has('Water')) {
      weaknesses.push('Weak to Lightning types');
    }
    
    return weaknesses;
  }

  /**
   * Get format strengths
   */
  private getFormatStrengths(
    cards: Array<DeckCard & { card: Card }>,
    metaAnalysis: ReturnType<typeof analyzeMetaPosition>
  ): string[] {
    const strengths: string[] = [];
    
    if (metaAnalysis.speedRating === 'fast') {
      strengths.push('Fast setup speed');
    }
    
    const hasMetaCards = cards.some(dc => 
      CURRENT_STANDARD_META.keyPokemon.some(pokemon => 
        dc.card.name.toLowerCase().includes(pokemon.toLowerCase())
      )
    );
    
    if (hasMetaCards) {
      strengths.push('Uses meta-relevant Pokemon');
    }
    
    if (strengths.length === 0) {
      strengths.push('Flexible strategy');
    }
    
    return strengths;
  }

  /**
   * Get tech recommendations based on meta
   */
  private getTechRecommendations(
    cards: Array<DeckCard & { card: Card }>,
    metaAnalysis: ReturnType<typeof analyzeMetaPosition>
  ): Array<{ card: string; reason: string; impact: string }> {
    const recommendations: Array<{ card: string; reason: string; impact: string }> = [];
    
    // Check if needs Path to the Peak
    const hasPath = cards.some(dc => 
      dc.card.name.toLowerCase().includes('path to the peak')
    );
    
    if (!hasPath && metaAnalysis.metaRating < 70) {
      recommendations.push({
        card: 'Path to the Peak',
        reason: 'Counter V Pokemon abilities',
        impact: 'Improves matchups against Lugia VSTAR and Mew VMAX'
      });
    }
    
    // Check for Lost City
    const hasLostCity = cards.some(dc => 
      dc.card.name.toLowerCase().includes('lost city')
    );
    
    if (!hasLostCity) {
      recommendations.push({
        card: 'Lost City',
        reason: 'Counter single-prize attackers',
        impact: 'Prevents recycling of key Pokemon'
      });
    }
    
    return recommendations.slice(0, 3);
  }

  /**
   * Get ability combos from the deck
   */
  private getAbilityCombos(cards: Array<DeckCard & { card: Card }>): Array<{
    cards: string[];
    description: string;
    impact: string;
  }> {
    const combos: Array<{ cards: string[]; description: string; impact: string }> = [];
    
    // Check for Pokemon with abilities
    const abilityPokemon = cards.filter(dc => 
      dc.card.supertype === 'POKEMON' && 
      dc.card.abilities && 
      dc.card.abilities.length > 0
    );
    
    if (abilityPokemon.length >= 2) {
      combos.push({
        cards: abilityPokemon.slice(0, 2).map(dc => dc.card.name),
        description: 'Multiple ability Pokemon',
        impact: 'Consistent ability usage'
      });
    }
    
    return combos;
  }

  /**
   * Get trainer synergies from synergy graph
   */
  private getTrainerSynergies(graph: ReturnType<typeof buildSynergyGraph>): Array<{
    cards: string[];
    type: string;
    effect: string;
  }> {
    const synergies: Array<{ cards: string[]; type: string; effect: string }> = [];
    
    // Find trainer-related edges
    const trainerEdges = graph.edges.filter(edge => 
      edge.strength >= 60 && 
      (edge.type === 'searches' || edge.type === 'accelerates')
    );
    
    trainerEdges.slice(0, 3).forEach(edge => {
      synergies.push({
        cards: [edge.source, edge.target],
        type: edge.type,
        effect: edge.description
      });
    });
    
    return synergies;
  }

  /**
   * Get energy acceleration methods
   */
  private getEnergyAcceleration(cards: Array<DeckCard & { card: Card }>): string[] {
    const methods: string[] = [];
    
    const accelCards = [
      'elesa', 'melony', 'dark patch', 'mirage gate', 
      'metal saucer', 'welder', 'frosmoth', 'flaaffy'
    ];
    
    cards.forEach(dc => {
      const name = dc.card.name.toLowerCase();
      if (accelCards.some(accel => name.includes(accel))) {
        methods.push(dc.card.name);
      }
    });
    
    return methods;
  }

  /**
   * Get evolution support cards
   */
  private getEvolutionSupport(cards: Array<DeckCard & { card: Card }>): string[] {
    const support: string[] = [];
    
    const evolutionHelpers = ['rare candy', 'evolution incense', 'evosoda', 'wally'];
    
    cards.forEach(dc => {
      const name = dc.card.name.toLowerCase();
      if (evolutionHelpers.some(helper => name.includes(helper))) {
        support.push(dc.card.name);
      }
    });
    
    return support;
  }

  /**
   * Calculate difficulty score based on deck complexity
   */
  private calculateDifficultyScore(
    cards: Array<DeckCard & { card: Card }>,
    synergyGraph: ReturnType<typeof buildSynergyGraph>,
    speedRating: ReturnType<typeof calculateDynamicSpeedRating>
  ): number {
    let difficulty = 50; // Base difficulty
    
    // More synergies = more complex
    if (synergyGraph.edges.length > 20) difficulty += 10;
    if (synergyGraph.edges.length > 30) difficulty += 10;
    
    // Evolution lines add complexity
    const evolutionCount = cards.filter(dc => 
      dc.card.supertype === 'POKEMON' && dc.card.evolvesFrom
    ).length;
    difficulty += Math.min(20, evolutionCount * 2);
    
    // Slow decks are harder to pilot
    if (speedRating.classification === 'slow') difficulty += 10;
    
    return Math.min(100, difficulty);
  }

  /**
   * Get average damage output
   */
  private getAverageDamageOutput(cards: Array<DeckCard & { card: Card }>): number {
    const damages = cards
      .filter(dc => dc.card.supertype === 'POKEMON' && dc.card.attacks)
      .flatMap(dc => dc.card.attacks?.map(a => parseInt(a.damage) || 0) || []);
    
    if (damages.length === 0) return 50;
    
    return Math.round(damages.reduce((sum, d) => sum + d, 0) / damages.length);
  }

  /**
   * Check if deck has OHKO potential
   */
  private hasOHKOPotential(cards: Array<DeckCard & { card: Card }>): boolean {
    return cards.some(dc => 
      dc.card.attacks?.some(a => (parseInt(a.damage) || 0) >= 280)
    );
  }

  /**
   * Determine core strategy based on analysis
   */
  private determineCoreStrategy(
    prizeTradeAnalysis: ReturnType<typeof analyzePrizeTradeEconomy>,
    speedRating: ReturnType<typeof calculateDynamicSpeedRating>
  ): string {
    if (prizeTradeAnalysis.strategy.primaryApproach === 'single-prize') {
      return 'Force favorable prize trades with single-prize attackers';
    }
    
    if (speedRating.classification === 'turbo' || speedRating.classification === 'fast') {
      return 'Race to victory with aggressive early attacks';
    }
    
    if (prizeTradeAnalysis.averagePrizeValue >= 2) {
      return 'Overpower opponents with high-impact multi-prize Pokemon';
    }
    
    return 'Build consistent board state and adapt to matchup';
  }

  /**
   * Determine win conditions
   */
  private determineWinConditions(
    cards: Array<DeckCard & { card: Card }>,
    prizeTradeAnalysis: ReturnType<typeof analyzePrizeTradeEconomy>
  ): string[] {
    const conditions: string[] = [];
    
    // Check for specific win conditions
    const hasStarRequiem = cards.some(dc => 
      dc.card.attacks?.some(a => a.name?.includes('Star Requiem'))
    );
    if (hasStarRequiem) {
      conditions.push('Star Requiem instant KO (Lost Zone requirement)');
    }
    
    // Prize trade based conditions
    if (prizeTradeAnalysis.strategy.primaryApproach === 'single-prize') {
      conditions.push('Win 2-for-1 prize trades throughout the game');
    } else {
      conditions.push('Take 6 prizes quickly with powerful attackers');
    }
    
    // Check for mill/deck out
    const hasMillCards = cards.some(dc => {
      const name = dc.card.name.toLowerCase();
      return name.includes('team rocket') || name.includes('durant');
    });
    if (hasMillCards) {
      conditions.push('Deck out opponent with mill strategy');
    }
    
    return conditions.length > 0 ? conditions : ['Take 6 prizes through consistent attacks'];
  }
}