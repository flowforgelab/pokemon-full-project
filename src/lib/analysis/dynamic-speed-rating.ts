/**
 * Dynamic Speed Rating System
 * 
 * Rates deck speed relative to the current meta game
 * and provides turn-by-turn setup analysis
 */

import { Card, DeckCard } from '@prisma/client';
import { CURRENT_STANDARD_META } from './meta-context';
import { calculateSetupProbability } from './probability-calculator';

export interface TurnSetup {
  turn: number;
  setupProbability: number;
  damageOutput: number;
  energyAttached: number;
  cardsDrawn: number;
  description: string;
}

export interface SpeedRating {
  absoluteSpeed: number; // 0-100, how fast in absolute terms
  relativeSpeed: number; // 0-100, how fast compared to meta
  classification: 'turbo' | 'fast' | 'medium' | 'slow' | 'glacial';
  firstAttackTurn: number; // Expected turn for first attack
  fullSetupTurn: number; // Expected turn for full setup
  turnByTurnAnalysis: TurnSetup[];
  metaComparison: {
    fasterThan: string[]; // Meta decks this is faster than
    slowerThan: string[]; // Meta decks this is slower than
    comparable: string[]; // Similar speed decks
  };
  recommendations: string[];
}

/**
 * Calculate dynamic speed rating for a deck
 */
export function calculateDynamicSpeedRating(
  cards: Array<DeckCard & { card: Card }>
): SpeedRating {
  // Analyze turn-by-turn setup
  const turnByTurn = analyzeTurnByTurn(cards);
  
  // Calculate when deck can first attack
  const firstAttackTurn = calculateFirstAttackTurn(cards, turnByTurn);
  
  // Calculate when deck is fully set up
  const fullSetupTurn = calculateFullSetupTurn(cards, turnByTurn);
  
  // Calculate absolute speed score
  const absoluteSpeed = calculateAbsoluteSpeed(firstAttackTurn, fullSetupTurn, cards);
  
  // Compare to meta decks
  const metaComparison = compareToMeta(firstAttackTurn, fullSetupTurn);
  
  // Calculate relative speed
  const relativeSpeed = calculateRelativeSpeed(metaComparison, fullSetupTurn);
  
  // Classify speed
  const classification = classifySpeed(absoluteSpeed, relativeSpeed);
  
  // Generate recommendations
  const recommendations = generateSpeedRecommendations(
    classification, 
    firstAttackTurn, 
    cards
  );
  
  return {
    absoluteSpeed,
    relativeSpeed,
    classification,
    firstAttackTurn,
    fullSetupTurn,
    turnByTurnAnalysis: turnByTurn,
    metaComparison,
    recommendations
  };
}

/**
 * Analyze setup progression turn by turn
 */
function analyzeTurnByTurn(cards: Array<DeckCard & { card: Card }>): TurnSetup[] {
  const analysis: TurnSetup[] = [];
  
  // Get deck characteristics
  const hasEnergyAccel = hasEnergyAcceleration(cards);
  const drawPower = calculateDrawPower(cards);
  const basicAttackers = getBasicAttackers(cards);
  const evolutionLines = getEvolutionLines(cards);
  
  // Simulate first 5 turns
  for (let turn = 1; turn <= 5; turn++) {
    const setup: TurnSetup = {
      turn,
      setupProbability: 0,
      damageOutput: 0,
      energyAttached: 0,
      cardsDrawn: 0,
      description: ''
    };
    
    // Calculate cards drawn by this turn
    setup.cardsDrawn = 7 + turn + Math.floor(drawPower * turn);
    
    // Calculate energy attached
    if (hasEnergyAccel) {
      setup.energyAttached = turn + Math.floor(turn * 0.5); // 1.5x normal
    } else {
      setup.energyAttached = turn;
    }
    
    // Calculate setup probability
    if (turn === 1) {
      // Turn 1 - can only use basics
      setup.setupProbability = basicAttackers.length > 0 ? 0.8 : 0.2;
      setup.damageOutput = basicAttackers.length > 0 ? 30 : 0;
      setup.description = 'Setting up basics, attaching energy';
    } else if (turn === 2) {
      // Turn 2 - might have Stage 1
      const stage1Count = evolutionLines.filter(e => e.stage === 1).length;
      const stage1Prob = stage1Count > 0 ? 0.7 : 0.5;
      setup.setupProbability = stage1Prob;
      setup.damageOutput = hasEnergyAccel ? 120 : 80;
      setup.description = 'Evolving to Stage 1, possible first attack';
    } else if (turn === 3) {
      // Turn 3 - should be attacking
      setup.setupProbability = 0.85;
      setup.damageOutput = hasEnergyAccel ? 200 : 150;
      setup.description = 'Main attacker online, taking prizes';
    } else {
      // Turn 4+ - full setup
      setup.setupProbability = 0.95;
      setup.damageOutput = getMaxDamageOutput(cards);
      setup.description = 'Full setup, executing win condition';
    }
    
    analysis.push(setup);
  }
  
  return analysis;
}

/**
 * Calculate when deck can first attack meaningfully
 */
function calculateFirstAttackTurn(
  cards: Array<DeckCard & { card: Card }>,
  turnAnalysis: TurnSetup[]
): number {
  // Look for first turn with 50+ damage
  const meaningfulDamage = 50;
  const firstMeaningful = turnAnalysis.find(t => t.damageOutput >= meaningfulDamage);
  
  if (firstMeaningful) {
    return firstMeaningful.turn;
  }
  
  // Check if we have any single-energy attackers
  const singleEnergyAttackers = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' &&
    dc.card.attacks?.some(a => (a.cost?.length || 0) <= 1)
  );
  
  return singleEnergyAttackers.length > 0 ? 1 : 2;
}

/**
 * Calculate when deck reaches full setup
 */
function calculateFullSetupTurn(
  cards: Array<DeckCard & { card: Card }>,
  turnAnalysis: TurnSetup[]
): number {
  // Look for 90%+ setup probability
  const fullSetup = turnAnalysis.find(t => t.setupProbability >= 0.9);
  
  if (fullSetup) {
    return fullSetup.turn;
  }
  
  // Check evolution requirements
  const hasStage2 = cards.some(dc => 
    dc.card.subtypes?.includes('Stage 2')
  );
  
  return hasStage2 ? 4 : 3;
}

/**
 * Calculate absolute speed score
 */
function calculateAbsoluteSpeed(
  firstAttack: number,
  fullSetup: number,
  cards: Array<DeckCard & { card: Card }>
): number {
  let score = 100;
  
  // Deduct points for slow first attack
  score -= (firstAttack - 1) * 20;
  
  // Deduct points for slow full setup
  score -= (fullSetup - 2) * 15;
  
  // Bonus for energy acceleration
  if (hasEnergyAcceleration(cards)) {
    score += 10;
  }
  
  // Bonus for high draw power
  const drawPower = calculateDrawPower(cards);
  score += Math.min(10, drawPower * 2);
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Compare to meta deck speeds
 */
function compareToMeta(
  firstAttack: number,
  fullSetup: number
): SpeedRating['metaComparison'] {
  const fasterThan: string[] = [];
  const slowerThan: string[] = [];
  const comparable: string[] = [];
  
  CURRENT_STANDARD_META.topDecks.forEach(metaDeck => {
    const metaSetup = metaDeck.avgSetupTurn;
    
    if (fullSetup < metaSetup - 0.5) {
      fasterThan.push(metaDeck.name);
    } else if (fullSetup > metaSetup + 0.5) {
      slowerThan.push(metaDeck.name);
    } else {
      comparable.push(metaDeck.name);
    }
  });
  
  return { fasterThan, slowerThan, comparable };
}

/**
 * Calculate relative speed compared to meta
 */
function calculateRelativeSpeed(
  comparison: SpeedRating['metaComparison'],
  fullSetup: number
): number {
  const totalDecks = comparison.fasterThan.length + 
                     comparison.slowerThan.length + 
                     comparison.comparable.length;
  
  if (totalDecks === 0) return 50;
  
  // Score based on how many decks we're faster than
  const fasterRatio = comparison.fasterThan.length / totalDecks;
  const baseScore = 50 + (fasterRatio * 50) - (comparison.slowerThan.length / totalDecks * 50);
  
  // Adjust based on meta average
  const metaAvgSetup = CURRENT_STANDARD_META.topDecks.reduce(
    (sum, d) => sum + d.avgSetupTurn, 0
  ) / CURRENT_STANDARD_META.topDecks.length;
  
  const setupDiff = metaAvgSetup - fullSetup;
  const adjustedScore = baseScore + (setupDiff * 10);
  
  return Math.max(0, Math.min(100, adjustedScore));
}

/**
 * Classify deck speed
 */
function classifySpeed(absolute: number, relative: number): SpeedRating['classification'] {
  const avgSpeed = (absolute + relative) / 2;
  
  if (avgSpeed >= 85) return 'turbo';
  if (avgSpeed >= 70) return 'fast';
  if (avgSpeed >= 50) return 'medium';
  if (avgSpeed >= 30) return 'slow';
  return 'glacial';
}

/**
 * Check if deck has energy acceleration
 */
function hasEnergyAcceleration(cards: Array<DeckCard & { card: Card }>): boolean {
  const accelCards = [
    'elesa', 'welder', 'melony', 'dark patch', 'metal saucer',
    'twin energy', 'double turbo', 'mirage gate', 'archeops'
  ];
  
  return cards.some(dc => 
    accelCards.some(accel => 
      dc.card.name.toLowerCase().includes(accel)
    )
  );
}

/**
 * Calculate draw power rating
 */
function calculateDrawPower(cards: Array<DeckCard & { card: Card }>): number {
  const drawCards = cards.filter(dc => {
    const name = dc.card.name.toLowerCase();
    return name.includes('research') || name.includes('marnie') ||
           name.includes('cynthia') || name.includes('dedenne') ||
           name.includes('crobat') || name.includes('bibarel');
  });
  
  return Math.min(10, drawCards.reduce((sum, dc) => sum + dc.quantity, 0));
}

/**
 * Get basic Pokemon that can attack
 */
function getBasicAttackers(cards: Array<DeckCard & { card: Card }>): Array<DeckCard & { card: Card }> {
  return cards.filter(dc => 
    dc.card.supertype === 'POKEMON' &&
    !dc.card.evolvesFrom &&
    dc.card.attacks &&
    dc.card.attacks.length > 0
  );
}

/**
 * Get evolution lines in deck
 */
function getEvolutionLines(cards: Array<DeckCard & { card: Card }>): Array<{
  name: string;
  stage: number;
  quantity: number;
}> {
  return cards
    .filter(dc => dc.card.supertype === 'POKEMON' && dc.card.evolvesFrom)
    .map(dc => ({
      name: dc.card.name,
      stage: dc.card.subtypes.includes('Stage 2') ? 2 : 1,
      quantity: dc.quantity
    }));
}

/**
 * Get maximum damage output
 */
function getMaxDamageOutput(cards: Array<DeckCard & { card: Card }>): number {
  const damages = cards.flatMap(dc => 
    dc.card.attacks?.map(a => parseInt(a.damage) || 0) || [0]
  );
  
  return Math.max(...damages, 150); // Default to 150 if no attacks
}

/**
 * Generate speed recommendations
 */
function generateSpeedRecommendations(
  classification: SpeedRating['classification'],
  firstAttack: number,
  cards: Array<DeckCard & { card: Card }>
): string[] {
  const recommendations: string[] = [];
  
  if (classification === 'slow' || classification === 'glacial') {
    recommendations.push('Deck is too slow for current meta - needs acceleration');
    
    if (!hasEnergyAcceleration(cards)) {
      recommendations.push('Add energy acceleration (Elesa\'s Sparkle, Dark Patch, etc.)');
    }
    
    if (firstAttack > 2) {
      recommendations.push('Add single-prize attackers that can attack turn 1-2');
    }
    
    recommendations.push('Consider adding more draw supporters');
  }
  
  if (classification === 'medium') {
    recommendations.push('Speed is acceptable but could be improved');
    recommendations.push('Consider adding 1-2 more acceleration cards');
  }
  
  if (classification === 'turbo' || classification === 'fast') {
    recommendations.push('Excellent speed - maintain momentum');
    recommendations.push('Ensure you have recovery options for late game');
  }
  
  return recommendations;
}