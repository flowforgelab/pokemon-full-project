/**
 * Multi-Factor Scoring System
 * 
 * Replaces binary scoring with nuanced analysis that considers
 * multiple factors and their interactions
 */

import { Card, DeckCard } from '@prisma/client';
import { calculateMulliganProbability, calculateSetupProbability } from './probability-calculator';
import { analyzeMetaPosition } from './meta-context';
import { buildSynergyGraph } from './synergy-graph';
import { analyzeEvolutionLines } from './evolution-line-analyzer';
import { getCardQualityScore } from './card-quality-database';

export interface ScoringFactor {
  name: string;
  category: 'consistency' | 'power' | 'speed' | 'versatility' | 'meta';
  rawScore: number; // 0-100
  weight: number; // How important this factor is
  confidence: number; // 0-1, how confident we are in this score
  details: string[];
}

export interface MultiFactorScore {
  overallScore: number; // 0-100
  factors: ScoringFactor[];
  strengths: string[];
  weaknesses: string[];
  confidenceLevel: number; // 0-1
  scoreBreakdown: {
    consistency: number;
    power: number;
    speed: number;
    versatility: number;
    metaRelevance: number;
  };
}

/**
 * Calculate multi-factor score for a deck
 */
export function calculateMultiFactorScore(
  cards: Array<DeckCard & { card: Card }>
): MultiFactorScore {
  const factors: ScoringFactor[] = [];
  
  // 1. Consistency Factors
  const consistencyFactors = analyzeConsistencyFactors(cards);
  factors.push(...consistencyFactors);
  
  // 2. Power Factors
  const powerFactors = analyzePowerFactors(cards);
  factors.push(...powerFactors);
  
  // 3. Speed Factors
  const speedFactors = analyzeSpeedFactors(cards);
  factors.push(...speedFactors);
  
  // 4. Versatility Factors
  const versatilityFactors = analyzeVersatilityFactors(cards);
  factors.push(...versatilityFactors);
  
  // 5. Meta Factors
  const metaFactors = analyzeMetaFactors(cards);
  factors.push(...metaFactors);
  
  // Calculate weighted scores for each category
  const categoryScores = calculateCategoryScores(factors);
  
  // Calculate overall score with dynamic weighting
  const overallScore = calculateDynamicOverallScore(categoryScores, factors);
  
  // Identify strengths and weaknesses
  const { strengths, weaknesses } = identifyStrengthsWeaknesses(factors);
  
  // Calculate confidence level
  const confidenceLevel = calculateConfidence(factors);
  
  return {
    overallScore,
    factors,
    strengths,
    weaknesses,
    confidenceLevel,
    scoreBreakdown: categoryScores
  };
}

/**
 * Analyze consistency factors
 */
function analyzeConsistencyFactors(cards: Array<DeckCard & { card: Card }>): ScoringFactor[] {
  const factors: ScoringFactor[] = [];
  
  // 1. Mulligan Rate Factor
  const basicCount = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' && !dc.card.evolvesFrom
  ).reduce((sum, dc) => sum + dc.quantity, 0);
  
  const mulliganProb = calculateMulliganProbability(basicCount);
  const mulliganScore = 100 - (mulliganProb * 200); // 0% = 100, 50% = 0
  
  factors.push({
    name: 'Mulligan Rate',
    category: 'consistency',
    rawScore: Math.max(0, mulliganScore),
    weight: 0.25,
    confidence: 1.0, // Math is certain
    details: [
      `${(mulliganProb * 100).toFixed(1)}% mulligan chance`,
      `${basicCount} Basic Pokemon in deck`
    ]
  });
  
  // 2. Draw Power Quality
  const drawSupporters = cards.filter(dc => {
    const name = dc.card.name.toLowerCase();
    return dc.card.supertype === 'TRAINER' && (
      name.includes('research') || name.includes('marnie') || 
      name.includes('cynthia') || name.includes('lillie')
    );
  });
  
  const drawQuality = drawSupporters.reduce((sum, dc) => {
    return sum + (getCardQualityScore(dc.card) * dc.quantity);
  }, 0) / Math.max(1, drawSupporters.reduce((sum, dc) => sum + dc.quantity, 0));
  
  const drawCount = drawSupporters.reduce((sum, dc) => sum + dc.quantity, 0);
  const drawScore = Math.min(100, (drawQuality * 10) * (Math.min(10, drawCount) / 10));
  
  factors.push({
    name: 'Draw Power',
    category: 'consistency',
    rawScore: drawScore,
    weight: 0.30,
    confidence: 0.9,
    details: [
      `${drawCount} draw supporters`,
      `Average quality: ${drawQuality.toFixed(1)}/10`
    ]
  });
  
  // 3. Evolution Line Consistency
  const evolutionAnalysis = analyzeEvolutionLines(cards);
  const evolutionScore = evolutionAnalysis.overallScore;
  
  factors.push({
    name: 'Evolution Consistency',
    category: 'consistency',
    rawScore: evolutionScore,
    weight: 0.20,
    confidence: 0.85,
    details: evolutionAnalysis.lines.map(line => 
      `${line.name}: ${line.structure} (${(line.consistency.turnTwoStage1 * 100).toFixed(0)}% T2)`
    )
  });
  
  // 4. Energy Consistency
  const energyCount = cards.filter(dc => dc.card.supertype === 'ENERGY')
    .reduce((sum, dc) => sum + dc.quantity, 0);
  const totalCards = cards.reduce((sum, dc) => sum + dc.quantity, 0);
  const energyRatio = energyCount / totalCards;
  
  const energyScore = energyRatio >= 0.15 && energyRatio <= 0.25 ? 100 : 
                      energyRatio >= 0.10 && energyRatio <= 0.30 ? 80 : 
                      energyRatio >= 0.08 && energyRatio <= 0.35 ? 60 : 40;
  
  factors.push({
    name: 'Energy Balance',
    category: 'consistency',
    rawScore: energyScore,
    weight: 0.15,
    confidence: 0.8,
    details: [
      `${energyCount} energy (${(energyRatio * 100).toFixed(0)}% of deck)`,
      energyScore >= 80 ? 'Optimal ratio' : 'Suboptimal ratio'
    ]
  });
  
  // 5. Search Card Access
  const searchCards = cards.filter(dc => {
    const name = dc.card.name.toLowerCase();
    return name.includes('ball') || name.includes('communication') || 
           name.includes('search') || name.includes('radar');
  });
  
  const searchCount = searchCards.reduce((sum, dc) => sum + dc.quantity, 0);
  const searchScore = Math.min(100, searchCount * 12.5); // 8 cards = 100
  
  factors.push({
    name: 'Search Options',
    category: 'consistency',
    rawScore: searchScore,
    weight: 0.10,
    confidence: 0.9,
    details: [
      `${searchCount} search cards`,
      searchCount >= 6 ? 'Good search engine' : 'Limited search'
    ]
  });
  
  return factors;
}

/**
 * Analyze power factors
 */
function analyzePowerFactors(cards: Array<DeckCard & { card: Card }>): ScoringFactor[] {
  const factors: ScoringFactor[] = [];
  
  // 1. Maximum Damage Output
  const attackers = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' && 
    dc.card.attacks && 
    dc.card.attacks.length > 0
  );
  
  const maxDamage = Math.max(...attackers.flatMap(dc => 
    dc.card.attacks?.map(a => parseInt(a.damage) || 0) || [0]
  ));
  
  const damageScore = maxDamage >= 300 ? 100 :
                      maxDamage >= 250 ? 90 :
                      maxDamage >= 200 ? 80 :
                      maxDamage >= 150 ? 70 :
                      maxDamage >= 100 ? 60 : 40;
  
  factors.push({
    name: 'Damage Output',
    category: 'power',
    rawScore: damageScore,
    weight: 0.35,
    confidence: 0.9,
    details: [
      `Max damage: ${maxDamage}`,
      damageScore >= 80 ? 'OHKO potential' : 'Two-hit KO deck'
    ]
  });
  
  // 2. Energy Efficiency
  const avgDamagePerEnergy = calculateAverageDamagePerEnergy(attackers);
  const efficiencyScore = Math.min(100, avgDamagePerEnergy * 2); // 50 damage/energy = 100
  
  factors.push({
    name: 'Energy Efficiency',
    category: 'power',
    rawScore: efficiencyScore,
    weight: 0.25,
    confidence: 0.85,
    details: [
      `${avgDamagePerEnergy.toFixed(0)} damage per energy`,
      efficiencyScore >= 80 ? 'Highly efficient' : 'Energy hungry'
    ]
  });
  
  // 3. Attack Versatility
  const uniqueAttacks = new Set(attackers.flatMap(dc => 
    dc.card.attacks?.map(a => a.name) || []
  )).size;
  
  const attackVersatilityScore = Math.min(100, uniqueAttacks * 10);
  
  factors.push({
    name: 'Attack Options',
    category: 'power',
    rawScore: attackVersatilityScore,
    weight: 0.20,
    confidence: 0.8,
    details: [
      `${uniqueAttacks} unique attacks`,
      uniqueAttacks >= 8 ? 'Versatile' : 'Limited options'
    ]
  });
  
  // 4. Special Conditions
  const statusAttacks = attackers.filter(dc => 
    dc.card.attacks?.some(a => 
      a.text?.toLowerCase().includes('paralyzed') ||
      a.text?.toLowerCase().includes('asleep') ||
      a.text?.toLowerCase().includes('confused') ||
      a.text?.toLowerCase().includes('burned')
    )
  ).length;
  
  const statusScore = Math.min(100, statusAttacks * 25);
  
  factors.push({
    name: 'Disruption Effects',
    category: 'power',
    rawScore: statusScore,
    weight: 0.20,
    confidence: 0.7,
    details: [
      `${statusAttacks} Pokemon with status effects`,
      statusScore > 0 ? 'Has disruption' : 'No status effects'
    ]
  });
  
  return factors;
}

/**
 * Analyze speed factors
 */
function analyzeSpeedFactors(cards: Array<DeckCard & { card: Card }>): ScoringFactor[] {
  const factors: ScoringFactor[] = [];
  
  // 1. Energy Acceleration
  const accelCards = cards.filter(dc => {
    const name = dc.card.name.toLowerCase();
    return name.includes('elesa') || name.includes('welder') || 
           name.includes('melony') || name.includes('dark patch') ||
           name.includes('twin energy') || name.includes('double');
  });
  
  const accelScore = Math.min(100, accelCards.reduce((sum, dc) => sum + dc.quantity, 0) * 15);
  
  factors.push({
    name: 'Energy Acceleration',
    category: 'speed',
    rawScore: accelScore,
    weight: 0.40,
    confidence: 0.9,
    details: [
      `${accelCards.length} acceleration options`,
      accelScore >= 60 ? 'Fast energy' : 'Manual attachments only'
    ]
  });
  
  // 2. Setup Speed
  const basicAttackers = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' && 
    !dc.card.evolvesFrom &&
    dc.card.attacks && 
    dc.card.attacks.some(a => (parseInt(a.damage) || 0) >= 50)
  ).length;
  
  const setupScore = Math.min(100, basicAttackers * 25);
  
  factors.push({
    name: 'Setup Speed',
    category: 'speed',
    rawScore: setupScore,
    weight: 0.30,
    confidence: 0.85,
    details: [
      `${basicAttackers} immediate attackers`,
      setupScore >= 50 ? 'Fast setup' : 'Needs evolution'
    ]
  });
  
  // 3. Switching Options
  const switchCards = cards.filter(dc => {
    const name = dc.card.name.toLowerCase();
    return name.includes('switch') || name.includes('rope') || 
           name.includes('bird keeper') || name.includes('escape');
  });
  
  const switchScore = Math.min(100, switchCards.reduce((sum, dc) => sum + dc.quantity, 0) * 20);
  
  factors.push({
    name: 'Mobility',
    category: 'speed',
    rawScore: switchScore,
    weight: 0.20,
    confidence: 0.9,
    details: [
      `${switchCards.reduce((sum, dc) => sum + dc.quantity, 0)} switch effects`,
      switchScore >= 60 ? 'High mobility' : 'Limited switching'
    ]
  });
  
  // 4. Prize Race Speed
  const metaAnalysis = analyzeMetaPosition(cards);
  const prizeSpeedScore = metaAnalysis.speedRating === 'fast' ? 90 :
                          metaAnalysis.speedRating === 'competitive' ? 70 : 40;
  
  factors.push({
    name: 'Prize Race',
    category: 'speed',
    rawScore: prizeSpeedScore,
    weight: 0.10,
    confidence: 0.7,
    details: [
      `${metaAnalysis.speedRating} speed rating`,
      'Compared to current meta'
    ]
  });
  
  return factors;
}

/**
 * Analyze versatility factors
 */
function analyzeVersatilityFactors(cards: Array<DeckCard & { card: Card }>): ScoringFactor[] {
  const factors: ScoringFactor[] = [];
  
  // 1. Type Coverage
  const types = new Set(cards.flatMap(dc => 
    dc.card.supertype === 'POKEMON' ? dc.card.types || [] : []
  ));
  
  const typeScore = Math.min(100, types.size * 30);
  
  factors.push({
    name: 'Type Coverage',
    category: 'versatility',
    rawScore: typeScore,
    weight: 0.30,
    confidence: 0.9,
    details: [
      `${types.size} different types`,
      Array.from(types).join(', ')
    ]
  });
  
  // 2. Win Condition Diversity
  const synergy = buildSynergyGraph(cards);
  const winConditions = synergy.clusters.filter(c => c.importance >= 70).length;
  const winConditionScore = Math.min(100, winConditions * 35);
  
  factors.push({
    name: 'Win Conditions',
    category: 'versatility',
    rawScore: winConditionScore,
    weight: 0.35,
    confidence: 0.8,
    details: [
      `${winConditions} viable strategies`,
      winConditions >= 2 ? 'Multiple paths' : 'Single strategy'
    ]
  });
  
  // 3. Tech Card Flexibility
  const techSlots = 60 - cards.reduce((sum, dc) => sum + dc.quantity, 0);
  const flexScore = Math.min(100, techSlots * 10);
  
  factors.push({
    name: 'Tech Flexibility',
    category: 'versatility',
    rawScore: flexScore,
    weight: 0.20,
    confidence: 0.7,
    details: [
      `${techSlots} flex slots available`,
      flexScore >= 50 ? 'Room for tech' : 'Tight list'
    ]
  });
  
  // 4. Recovery Options
  const recoveryCards = cards.filter(dc => {
    const name = dc.card.name.toLowerCase();
    return name.includes('rescue') || name.includes('ordinary rod') || 
           name.includes('super rod') || name.includes('brock');
  });
  
  const recoveryScore = Math.min(100, recoveryCards.reduce((sum, dc) => sum + dc.quantity, 0) * 25);
  
  factors.push({
    name: 'Recovery',
    category: 'versatility',
    rawScore: recoveryScore,
    weight: 0.15,
    confidence: 0.85,
    details: [
      `${recoveryCards.length} recovery options`,
      recoveryScore > 0 ? 'Can recover resources' : 'No recovery'
    ]
  });
  
  return factors;
}

/**
 * Analyze meta factors
 */
function analyzeMetaFactors(cards: Array<DeckCard & { card: Card }>): ScoringFactor[] {
  const factors: ScoringFactor[] = [];
  const metaAnalysis = analyzeMetaPosition(cards);
  
  // 1. Meta Relevance
  factors.push({
    name: 'Meta Position',
    category: 'meta',
    rawScore: metaAnalysis.metaRating,
    weight: 0.40,
    confidence: 0.75,
    details: [
      `${metaAnalysis.metaRating}/100 meta score`,
      `Speed: ${metaAnalysis.speedRating}`
    ]
  });
  
  // 2. Matchup Spread
  const goodMatchups = metaAnalysis.matchupSpread.filter(m => m.favorability > 10).length;
  const matchupScore = (goodMatchups / metaAnalysis.matchupSpread.length) * 100;
  
  factors.push({
    name: 'Matchup Spread',
    category: 'meta',
    rawScore: matchupScore,
    weight: 0.35,
    confidence: 0.7,
    details: [
      `${goodMatchups}/${metaAnalysis.matchupSpread.length} favorable`,
      'Against top meta decks'
    ]
  });
  
  // 3. Counter Resistance
  const hasVulnerableCards = cards.some(dc => 
    dc.card.subtypes?.some(st => ['V', 'VMAX', 'VSTAR'].includes(st))
  );
  
  const counterScore = hasVulnerableCards ? 60 : 90;
  
  factors.push({
    name: 'Counter Resistance',
    category: 'meta',
    rawScore: counterScore,
    weight: 0.25,
    confidence: 0.8,
    details: [
      hasVulnerableCards ? 'Vulnerable to Path' : 'Path resistant',
      'Meta tech consideration'
    ]
  });
  
  return factors;
}

/**
 * Calculate average damage per energy
 */
function calculateAverageDamagePerEnergy(
  attackers: Array<DeckCard & { card: Card }>
): number {
  let totalDamage = 0;
  let totalCost = 0;
  
  attackers.forEach(dc => {
    dc.card.attacks?.forEach(attack => {
      const damage = parseInt(attack.damage) || 0;
      const cost = attack.cost?.length || 1;
      totalDamage += damage;
      totalCost += cost;
    });
  });
  
  return totalCost > 0 ? totalDamage / totalCost : 30;
}

/**
 * Calculate category scores
 */
function calculateCategoryScores(factors: ScoringFactor[]): {
  consistency: number;
  power: number;
  speed: number;
  versatility: number;
  metaRelevance: number;
} {
  const categories = {
    consistency: 0,
    power: 0,
    speed: 0,
    versatility: 0,
    metaRelevance: 0
  };
  
  // Group factors by category
  const grouped = factors.reduce((acc, factor) => {
    if (!acc[factor.category]) acc[factor.category] = [];
    acc[factor.category].push(factor);
    return acc;
  }, {} as Record<string, ScoringFactor[]>);
  
  // Calculate weighted score for each category
  Object.entries(grouped).forEach(([category, factors]) => {
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedSum = factors.reduce((sum, f) => sum + (f.rawScore * f.weight), 0);
    
    const categoryScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    if (category === 'meta') {
      categories.metaRelevance = Math.round(categoryScore);
    } else {
      categories[category as keyof typeof categories] = Math.round(categoryScore);
    }
  });
  
  return categories;
}

/**
 * Calculate dynamic overall score
 */
function calculateDynamicOverallScore(
  categoryScores: ReturnType<typeof calculateCategoryScores>,
  factors: ScoringFactor[]
): number {
  // Dynamic weights based on deck characteristics
  let weights = {
    consistency: 0.25,
    power: 0.20,
    speed: 0.20,
    versatility: 0.15,
    metaRelevance: 0.20
  };
  
  // Adjust weights based on deck type
  const highPower = categoryScores.power >= 80;
  const highSpeed = categoryScores.speed >= 80;
  const highConsistency = categoryScores.consistency >= 80;
  
  if (highPower && highSpeed) {
    // Aggro deck - speed matters more
    weights.speed = 0.30;
    weights.power = 0.25;
    weights.consistency = 0.20;
    weights.versatility = 0.10;
    weights.metaRelevance = 0.15;
  } else if (highConsistency && categoryScores.versatility >= 70) {
    // Control deck - consistency and versatility matter
    weights.consistency = 0.30;
    weights.versatility = 0.25;
    weights.metaRelevance = 0.20;
    weights.power = 0.15;
    weights.speed = 0.10;
  }
  
  // Calculate weighted overall score
  const overallScore = 
    categoryScores.consistency * weights.consistency +
    categoryScores.power * weights.power +
    categoryScores.speed * weights.speed +
    categoryScores.versatility * weights.versatility +
    categoryScores.metaRelevance * weights.metaRelevance;
  
  return Math.round(overallScore);
}

/**
 * Identify strengths and weaknesses
 */
function identifyStrengthsWeaknesses(factors: ScoringFactor[]): {
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  
  // Sort factors by score
  const sortedFactors = [...factors].sort((a, b) => b.rawScore - a.rawScore);
  
  // Top 3 factors above 70 are strengths
  sortedFactors
    .filter(f => f.rawScore >= 70)
    .slice(0, 3)
    .forEach(f => {
      strengths.push(`${f.name}: ${f.details[0]}`);
    });
  
  // Bottom 3 factors below 60 are weaknesses
  sortedFactors
    .reverse()
    .filter(f => f.rawScore < 60)
    .slice(0, 3)
    .forEach(f => {
      weaknesses.push(`${f.name}: ${f.details[0]}`);
    });
  
  // Ensure we always have something
  if (strengths.length === 0) {
    strengths.push('Balanced deck with no standout strengths');
  }
  if (weaknesses.length === 0) {
    weaknesses.push('Well-rounded deck with minor improvements needed');
  }
  
  return { strengths, weaknesses };
}

/**
 * Calculate confidence level
 */
function calculateConfidence(factors: ScoringFactor[]): number {
  const avgConfidence = factors.reduce((sum, f) => sum + f.confidence, 0) / factors.length;
  return Math.round(avgConfidence * 100) / 100;
}