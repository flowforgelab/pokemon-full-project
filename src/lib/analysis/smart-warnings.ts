/**
 * Smart Warning System
 * 
 * Provides intelligent warnings with severity levels and context-aware recommendations
 */

import { Card, DeckCard } from '@prisma/client';
import { calculateMulliganProbability, calculateDeadDrawProbability } from './probability-calculator';
import { analyzeEvolutionLines } from './evolution-line-analyzer';
import { validateDeckLegality } from './deck-validator';
import { analyzeMetaPosition } from './meta-context';
import { buildSynergyGraph } from './synergy-graph';
import { calculateDynamicSpeedRating } from './dynamic-speed-rating';
import { analyzePrizeTradeEconomy } from './prize-trade-analysis';

export type WarningSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface DeckWarning {
  id: string;
  severity: WarningSeverity;
  category: 'legality' | 'consistency' | 'power' | 'speed' | 'matchup' | 'economy';
  title: string;
  description: string;
  impact: string;
  suggestions: string[];
  priority: number; // 1-10, higher = more important
  autoFixable: boolean;
  estimatedImpact: {
    winRate: number; // Estimated win rate impact in percentage points
    consistency: number; // Consistency impact
    speed: number; // Speed impact in turns
  };
}

/**
 * Generate smart warnings for a deck
 */
export function generateSmartWarnings(
  cards: Array<DeckCard & { card: Card }>
): DeckWarning[] {
  const warnings: DeckWarning[] = [];
  
  // 1. Check deck legality first
  const legalityWarnings = checkLegalityWarnings(cards);
  warnings.push(...legalityWarnings);
  
  // 2. Check consistency issues
  const consistencyWarnings = checkConsistencyWarnings(cards);
  warnings.push(...consistencyWarnings);
  
  // 3. Check power level issues
  const powerWarnings = checkPowerWarnings(cards);
  warnings.push(...powerWarnings);
  
  // 4. Check speed issues
  const speedWarnings = checkSpeedWarnings(cards);
  warnings.push(...speedWarnings);
  
  // 5. Check matchup issues
  const matchupWarnings = checkMatchupWarnings(cards);
  warnings.push(...matchupWarnings);
  
  // 6. Check prize trade economy
  const economyWarnings = checkEconomyWarnings(cards);
  warnings.push(...economyWarnings);
  
  // Sort by priority and severity
  return warnings.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.priority - a.priority;
  });
}

/**
 * Check for deck legality issues
 */
function checkLegalityWarnings(cards: Array<DeckCard & { card: Card }>): DeckWarning[] {
  const warnings: DeckWarning[] = [];
  const validation = validateDeckLegality(cards);
  
  if (!validation.isLegal && validation.issues) {
    validation.issues.filter(issue => issue.severity === 'error').forEach((error, index) => {
      warnings.push({
        id: `legality-${index}`,
        severity: 'critical',
        category: 'legality',
        title: 'Deck is Illegal',
        description: error.message,
        impact: 'Deck cannot be used in tournaments',
        suggestions: [
          'Fix this issue before any other optimizations',
          'Check card counts and format restrictions'
        ],
        priority: 10,
        autoFixable: false,
        estimatedImpact: {
          winRate: -100, // Can't play = can't win
          consistency: 0,
          speed: 0
        }
      });
    });
  }
  
  return warnings;
}

/**
 * Check for consistency issues
 */
function checkConsistencyWarnings(cards: Array<DeckCard & { card: Card }>): DeckWarning[] {
  const warnings: DeckWarning[] = [];
  
  // Basic Pokemon count
  const basicPokemon = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' && !dc.card.evolvesFrom
  );
  const basicCount = basicPokemon.reduce((sum, dc) => sum + dc.quantity, 0);
  
  // Mulligan probability
  const mulliganProb = calculateMulliganProbability(basicCount);
  if (mulliganProb > 0.15) {
    warnings.push({
      id: 'consistency-mulligan',
      severity: mulliganProb > 0.25 ? 'critical' : 'high',
      category: 'consistency',
      title: 'High Mulligan Risk',
      description: `${(mulliganProb * 100).toFixed(1)}% chance of mulligan (ideal: <10%)`,
      impact: 'Gives opponents free cards and slows your setup',
      suggestions: [
        `Add ${Math.max(4, 12 - basicCount)} more Basic Pokemon`,
        'Consider Pokemon with "Once during your turn" abilities',
        'Add Pokemon search cards like Quick Ball or Ultra Ball'
      ],
      priority: 9,
      autoFixable: false,
      estimatedImpact: {
        winRate: -10 * mulliganProb,
        consistency: -20,
        speed: 0.5
      }
    });
  }
  
  // Draw support
  const drawSupporters = cards.filter(dc => {
    const name = dc.card.name.toLowerCase();
    return dc.card.supertype === 'TRAINER' && 
           dc.card.subtypes?.includes('Supporter') &&
           (name.includes('research') || name.includes('marnie') || 
            name.includes('cynthia') || name.includes('n'));
  });
  const drawSupportCount = drawSupporters.reduce((sum, dc) => sum + dc.quantity, 0);
  
  if (drawSupportCount < 6) {
    warnings.push({
      id: 'consistency-draw',
      severity: drawSupportCount < 4 ? 'critical' : 'high',
      category: 'consistency',
      title: 'Insufficient Draw Support',
      description: `Only ${drawSupportCount} draw Supporters (minimum: 6, ideal: 8-10)`,
      impact: 'Will frequently dead draw and fail to set up',
      suggestions: [
        'Add 4 Professor\'s Research',
        'Add 2-3 Marnie or similar shuffle-draw',
        'Consider draw engines like Bibarel or Crobat V'
      ],
      priority: 8,
      autoFixable: false,
      estimatedImpact: {
        winRate: -15,
        consistency: -30,
        speed: 1
      }
    });
  }
  
  // Evolution line issues
  const evolutionAnalysis = analyzeEvolutionLines(cards);
  evolutionAnalysis.lines.forEach(line => {
    if (!line.isValid && line.bottleneck !== 'none') {
      warnings.push({
        id: `consistency-evolution-${line.name}`,
        severity: 'medium',
        category: 'consistency',
        title: `${line.name} Evolution Line Issue`,
        description: `Bottleneck at ${line.bottleneck} (${line.structure})`,
        impact: 'Evolution line will be inconsistent',
        suggestions: [
          ...(line.recommendations.length > 0 ? line.recommendations : ['Adjust evolution line counts']),
          'Add Rare Candy for Stage 2 lines',
          'Consider Twin Energy for faster attacks'
        ],
        priority: 6,
        autoFixable: false,
        estimatedImpact: {
          winRate: -5,
          consistency: -15,
          speed: 0.5
        }
      });
    }
  });
  
  // Energy balance
  const energyCards = cards.filter(dc => dc.card.supertype === 'ENERGY');
  const energyCount = energyCards.reduce((sum, dc) => sum + dc.quantity, 0);
  const attackingPokemon = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' && dc.card.attacks && dc.card.attacks.length > 0
  );
  
  if (attackingPokemon.length > 0) {
    const avgEnergyCost = attackingPokemon.reduce((sum, dc) => {
      const costs = dc.card.attacks?.map(a => a.cost?.length || 0) || [0];
      return sum + Math.min(...costs);
    }, 0) / attackingPokemon.length;
    
    const idealEnergyCount = Math.ceil(avgEnergyCost * 4 + 8);
    
    if (energyCount < idealEnergyCount - 3) {
      warnings.push({
        id: 'consistency-energy',
        severity: 'medium',
        category: 'consistency',
        title: 'Low Energy Count',
        description: `${energyCount} energy may be too low for consistent attacks`,
        impact: 'Will struggle to power up attackers consistently',
        suggestions: [
          `Consider ${idealEnergyCount} total energy`,
          'Add energy search/recovery cards',
          'Include Special Energy for acceleration'
        ],
        priority: 5,
        autoFixable: false,
        estimatedImpact: {
          winRate: -8,
          consistency: -20,
          speed: 0.5
        }
      });
    }
  }
  
  return warnings;
}

/**
 * Check for power level issues
 */
function checkPowerWarnings(cards: Array<DeckCard & { card: Card }>): DeckWarning[] {
  const warnings: DeckWarning[] = [];
  
  // Check for outdated attackers
  const attackers = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' && 
    dc.card.attacks && 
    dc.card.attacks.length > 0
  );
  
  const maxDamage = Math.max(...attackers.flatMap(dc => 
    dc.card.attacks?.map(a => parseInt(a.damage) || 0) || [0]
  ));
  
  if (maxDamage < 200) {
    warnings.push({
      id: 'power-damage',
      severity: maxDamage < 150 ? 'high' : 'medium',
      category: 'power',
      title: 'Low Damage Output',
      description: `Maximum damage is only ${maxDamage} (modern decks hit 250-300+)`,
      impact: 'Cannot efficiently KO modern Pokemon VSTAR/VMAX',
      suggestions: [
        'Add modern attackers that hit 250+ damage',
        'Include damage modifiers like Choice Belt',
        'Consider Pokemon with damage scaling abilities'
      ],
      priority: 7,
      autoFixable: false,
      estimatedImpact: {
        winRate: -20,
        consistency: 0,
        speed: 1
      }
    });
  }
  
  // Check for boss/gust effects
  const gustEffects = cards.filter(dc => {
    const name = dc.card.name.toLowerCase();
    return name.includes('boss') || name.includes('guzma') || 
           name.includes('lysandre') || name.includes('cross');
  });
  
  if (gustEffects.length === 0) {
    warnings.push({
      id: 'power-gust',
      severity: 'high',
      category: 'power',
      title: 'No Gust Effects',
      description: 'Deck has no way to target opponent\'s benched Pokemon',
      impact: 'Cannot take easy prizes or disrupt opponent\'s setup',
      suggestions: [
        'Add 2-4 Boss\'s Orders',
        'Consider Cross Switcher for item-based gusting',
        'Include Pokemon with gust abilities'
      ],
      priority: 8,
      autoFixable: false,
      estimatedImpact: {
        winRate: -15,
        consistency: 0,
        speed: 0
      }
    });
  }
  
  return warnings;
}

/**
 * Check for speed issues
 */
function checkSpeedWarnings(cards: Array<DeckCard & { card: Card }>): DeckWarning[] {
  const warnings: DeckWarning[] = [];
  const speedRating = calculateDynamicSpeedRating(cards);
  
  if (speedRating.classification === 'slow' || speedRating.classification === 'glacial') {
    warnings.push({
      id: 'speed-overall',
      severity: speedRating.classification === 'glacial' ? 'critical' : 'high',
      category: 'speed',
      title: `Deck is Too Slow (${speedRating.classification.toUpperCase()})`,
      description: `First attack turn ${speedRating.firstAttackTurn}, full setup turn ${speedRating.fullSetupTurn}`,
      impact: 'Will lose to fast meta decks before setting up',
      suggestions: speedRating.recommendations,
      priority: 9,
      autoFixable: false,
      estimatedImpact: {
        winRate: -25,
        consistency: -10,
        speed: 2
      }
    });
  }
  
  // Check for energy acceleration
  const hasAccel = cards.some(dc => {
    const name = dc.card.name.toLowerCase();
    return name.includes('elesa') || name.includes('welder') || 
           name.includes('dark patch') || name.includes('metal saucer');
  });
  
  if (!hasAccel && speedRating.firstAttackTurn > 2) {
    warnings.push({
      id: 'speed-acceleration',
      severity: 'medium',
      category: 'speed',
      title: 'No Energy Acceleration',
      description: 'Deck relies on manual attachments only',
      impact: 'Setup is slower than necessary',
      suggestions: [
        'Add type-specific acceleration (Elesa\'s Sparkle, Dark Patch, etc.)',
        'Include Twin Energy or Double Turbo Energy',
        'Consider Pokemon with energy acceleration abilities'
      ],
      priority: 6,
      autoFixable: false,
      estimatedImpact: {
        winRate: -10,
        consistency: 0,
        speed: 1
      }
    });
  }
  
  return warnings;
}

/**
 * Check for matchup issues
 */
function checkMatchupWarnings(cards: Array<DeckCard & { card: Card }>): DeckWarning[] {
  const warnings: DeckWarning[] = [];
  const metaAnalysis = analyzeMetaPosition(cards);
  
  // Check for auto-losses
  const autoLosses = metaAnalysis.matchupSpread.filter(m => m.favorability < -60);
  if (autoLosses.length > 0) {
    warnings.push({
      id: 'matchup-autolosses',
      severity: autoLosses.length > 2 ? 'high' : 'medium',
      category: 'matchup',
      title: `${autoLosses.length} Auto-Loss Matchups`,
      description: `Near-unwinnable against: ${autoLosses.map(m => m.deck).join(', ')}`,
      impact: 'Will struggle in tournaments where these decks are popular',
      suggestions: [
        'Add tech cards to improve these matchups',
        'Consider a different deck archetype',
        'Include flexible attackers with different types'
      ],
      priority: 7,
      autoFixable: false,
      estimatedImpact: {
        winRate: -5 * autoLosses.length,
        consistency: 0,
        speed: 0
      }
    });
  }
  
  // Check for weakness coverage
  const types = new Set(cards
    .filter(dc => dc.card.supertype === 'POKEMON')
    .flatMap(dc => dc.card.types || [])
  );
  
  if (types.size === 1) {
    warnings.push({
      id: 'matchup-weakness',
      severity: 'medium',
      category: 'matchup',
      title: 'No Type Diversity',
      description: 'All Pokemon share the same type/weakness',
      impact: 'Vulnerable to decks that exploit your weakness',
      suggestions: [
        'Add 1-2 Pokemon of different types',
        'Include Weakness Guard Energy',
        'Consider techs that hit for weakness against popular decks'
      ],
      priority: 5,
      autoFixable: false,
      estimatedImpact: {
        winRate: -10,
        consistency: 0,
        speed: 0
      }
    });
  }
  
  return warnings;
}

/**
 * Check for prize trade economy issues
 */
function checkEconomyWarnings(cards: Array<DeckCard & { card: Card }>): DeckWarning[] {
  const warnings: DeckWarning[] = [];
  const prizeEconomy = analyzePrizeTradeEconomy(cards);
  
  if (prizeEconomy.overallEfficiency < 60) {
    warnings.push({
      id: 'economy-efficiency',
      severity: prizeEconomy.overallEfficiency < 40 ? 'high' : 'medium',
      category: 'economy',
      title: 'Poor Prize Trade Efficiency',
      description: `Only ${prizeEconomy.overallEfficiency}/100 efficiency score`,
      impact: 'Will lose the prize race against efficient decks',
      suggestions: [
        'Add more single-prize attackers',
        'Include hit-and-run strategies',
        'Avoid playing down unnecessary multi-prize Pokemon'
      ],
      priority: 6,
      autoFixable: false,
      estimatedImpact: {
        winRate: -15,
        consistency: 0,
        speed: 0
      }
    });
  }
  
  // Check for liabilities
  const bigLiabilities = prizeEconomy.worstLiabilities.filter(l => 
    l.prizeValue >= 2 && l.risk === 'high'
  );
  
  if (bigLiabilities.length > 2) {
    warnings.push({
      id: 'economy-liabilities',
      severity: 'medium',
      category: 'economy',
      title: 'Too Many Prize Liabilities',
      description: `${bigLiabilities.length} high-risk multi-prize Pokemon`,
      impact: 'Easy targets for opponent to take multiple prizes',
      suggestions: [
        'Reduce support Pokemon that give up 2+ prizes',
        'Replace with single-prize alternatives',
        'Only bench multi-prize Pokemon when necessary'
      ],
      priority: 5,
      autoFixable: false,
      estimatedImpact: {
        winRate: -10,
        consistency: 0,
        speed: 0
      }
    });
  }
  
  return warnings;
}

/**
 * Get a summary of warnings by severity
 */
export function getWarningSummary(warnings: DeckWarning[]): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  estimatedWinRateImpact: number;
} {
  const summary = {
    total: warnings.length,
    critical: warnings.filter(w => w.severity === 'critical').length,
    high: warnings.filter(w => w.severity === 'high').length,
    medium: warnings.filter(w => w.severity === 'medium').length,
    low: warnings.filter(w => w.severity === 'low').length,
    info: warnings.filter(w => w.severity === 'info').length,
    estimatedWinRateImpact: 0
  };
  
  // Calculate cumulative win rate impact (with diminishing returns)
  const impacts = warnings.map(w => w.estimatedImpact.winRate);
  let cumulativeImpact = 0;
  let factor = 1;
  
  impacts.sort((a, b) => a - b); // Sort negative first
  impacts.forEach(impact => {
    cumulativeImpact += impact * factor;
    factor *= 0.8; // Each additional issue has less impact
  });
  
  summary.estimatedWinRateImpact = Math.max(-90, cumulativeImpact);
  
  return summary;
}