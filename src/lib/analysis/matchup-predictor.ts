/**
 * Matchup Prediction Engine
 * 
 * Predicts win rates and matchup favorability between decks
 * based on type advantages, speed, and strategy counters
 */

import { Card, DeckCard } from '@prisma/client';
import { MetaDeck, CURRENT_STANDARD_META } from './meta-context';
import { DeckArchetype } from './types';

export interface MatchupPrediction {
  opponentDeck: string;
  winRate: number; // 0-100%
  favorability: 'heavily unfavored' | 'unfavored' | 'even' | 'favored' | 'heavily favored';
  keyFactors: string[];
  gameplan: string;
  criticalCards: string[]; // Cards that swing the matchup
  mulliganPriority: string[]; // What to look for in opening hand
}

export interface TypeMatchup {
  attacking: string;
  defending: string;
  multiplier: number; // 2 for weakness, 0.5 for resistance
}

// Pokemon type effectiveness chart
const TYPE_MATCHUPS: TypeMatchup[] = [
  // Weaknesses (2x damage)
  { attacking: 'Fire', defending: 'Grass', multiplier: 2 },
  { attacking: 'Fire', defending: 'Metal', multiplier: 2 },
  { attacking: 'Water', defending: 'Fire', multiplier: 2 },
  { attacking: 'Lightning', defending: 'Water', multiplier: 2 },
  { attacking: 'Lightning', defending: 'Flying', multiplier: 2 },
  { attacking: 'Grass', defending: 'Water', multiplier: 2 },
  { attacking: 'Fighting', defending: 'Darkness', multiplier: 2 },
  { attacking: 'Fighting', defending: 'Lightning', multiplier: 2 },
  { attacking: 'Fighting', defending: 'Colorless', multiplier: 2 },
  { attacking: 'Psychic', defending: 'Fighting', multiplier: 2 },
  { attacking: 'Darkness', defending: 'Psychic', multiplier: 2 },
  { attacking: 'Metal', defending: 'Fairy', multiplier: 2 },
  { attacking: 'Fairy', defending: 'Dragon', multiplier: 2 },
  { attacking: 'Fairy', defending: 'Darkness', multiplier: 2 },
  { attacking: 'Fairy', defending: 'Fighting', multiplier: 2 },
  
  // Resistances (0.8x damage in TCG, represented as -20 damage)
  { attacking: 'Fighting', defending: 'Psychic', multiplier: 0.8 },
  { attacking: 'Lightning', defending: 'Metal', multiplier: 0.8 },
  { attacking: 'Darkness', defending: 'Fighting', multiplier: 0.8 },
];

/**
 * Predict matchup between two decks
 */
export function predictMatchup(
  yourDeck: Array<DeckCard & { card: Card }>,
  opponentArchetype: DeckArchetype | MetaDeck | string,
  yourArchetype?: DeckArchetype
): MatchupPrediction {
  // Convert string to MetaDeck if needed
  let opponentDeck: MetaDeck | null = null;
  let opponentName: string;
  
  if (typeof opponentArchetype === 'string') {
    // Try to find in meta
    opponentDeck = CURRENT_STANDARD_META.topDecks.find(d => 
      d.name.toLowerCase() === opponentArchetype.toLowerCase()
    ) || null;
    opponentName = opponentArchetype;
  } else if ('tierRating' in opponentArchetype) {
    // It's already a MetaDeck
    opponentDeck = opponentArchetype;
    opponentName = opponentDeck.name;
  } else {
    // It's a DeckArchetype enum
    opponentName = opponentArchetype;
  }
  
  let winRate = 50; // Start at even
  const keyFactors: string[] = [];
  const criticalCards: string[] = [];
  const mulliganPriority: string[] = [];
  
  // Factor 1: Type advantages
  const typeAdvantage = calculateTypeAdvantage(yourDeck, opponentDeck);
  winRate += typeAdvantage.advantage;
  if (Math.abs(typeAdvantage.advantage) > 10) {
    keyFactors.push(typeAdvantage.description);
  }
  
  // Factor 2: Speed differential
  const speedDiff = analyzeSpeedDifferential(yourDeck, opponentDeck);
  winRate += speedDiff.advantage;
  if (speedDiff.significant) {
    keyFactors.push(speedDiff.description);
  }
  
  // Factor 3: Counter cards
  const counters = analyzeCounterCards(yourDeck, opponentDeck);
  winRate += counters.advantage;
  criticalCards.push(...counters.criticalCards);
  if (counters.hasCounters) {
    keyFactors.push(counters.description);
  }
  
  // Factor 4: Prize trade efficiency
  const prizeTrade = analyzePrizeTrade(yourDeck, opponentDeck);
  winRate += prizeTrade.advantage;
  if (prizeTrade.significant) {
    keyFactors.push(prizeTrade.description);
  }
  
  // Factor 5: Archetype matchup (rock-paper-scissors)
  if (yourArchetype && opponentDeck) {
    const archetypeMatchup = getArchetypeMatchup(yourArchetype, opponentDeck.archetype);
    winRate += archetypeMatchup.advantage;
    if (archetypeMatchup.advantage !== 0) {
      keyFactors.push(archetypeMatchup.description);
    }
  }
  
  // Determine mulligan priority based on matchup
  if (speedDiff.advantage > 0) {
    mulliganPriority.push('Energy acceleration cards', 'Low cost attackers');
  } else {
    mulliganPriority.push('Defensive Pokemon', 'Healing cards');
  }
  
  if (counters.criticalCards.length > 0) {
    mulliganPriority.push(...counters.criticalCards.slice(0, 2));
  }
  
  // Clamp win rate
  winRate = Math.min(80, Math.max(20, winRate));
  
  // Determine favorability
  let favorability: MatchupPrediction['favorability'];
  if (winRate >= 65) favorability = 'heavily favored';
  else if (winRate >= 55) favorability = 'favored';
  else if (winRate >= 45) favorability = 'even';
  else if (winRate >= 35) favorability = 'unfavored';
  else favorability = 'heavily unfavored';
  
  // Generate gameplan
  const gameplan = generateGameplan(winRate, keyFactors, speedDiff, counters);
  
  return {
    opponentDeck: opponentName,
    winRate,
    favorability,
    keyFactors,
    gameplan,
    criticalCards,
    mulliganPriority: mulliganPriority.slice(0, 3) // Top 3 priorities
  };
}

/**
 * Calculate type advantage between decks
 */
function calculateTypeAdvantage(
  yourDeck: Array<DeckCard & { card: Card }>,
  opponentDeck: MetaDeck | null
): { advantage: number; description: string } {
  let advantage = 0;
  
  // Get your main attacker types
  const yourTypes = new Set<string>();
  yourDeck.forEach(dc => {
    if (dc.card.supertype === 'POKEMON' && dc.card.types) {
      dc.card.types.forEach(type => yourTypes.add(type));
    }
  });
  
  // Check specific matchups
  if (opponentDeck) {
    // Lugia is weak to Lightning
    if (opponentDeck.name.includes('Lugia') && yourTypes.has('Lightning')) {
      advantage += 20;
      return { advantage, description: 'Type advantage: Lightning vs Lugia (Flying weak to Lightning)' };
    }
    
    // Charizard is weak to Water
    if (opponentDeck.name.includes('Charizard') && yourTypes.has('Water')) {
      advantage += 20;
      return { advantage, description: 'Type advantage: Water vs Charizard' };
    }
    
    // Mew VMAX is weak to Darkness
    if (opponentDeck.name.includes('Mew') && yourTypes.has('Darkness')) {
      advantage += 25;
      return { advantage, description: 'Type advantage: Darkness vs Mew (Psychic weak to Dark)' };
    }
  }
  
  return { advantage, description: '' };
}

/**
 * Analyze speed differential between decks
 */
function analyzeSpeedDifferential(
  yourDeck: Array<DeckCard & { card: Card }>,
  opponentDeck: MetaDeck | null
): { advantage: number; significant: boolean; description: string } {
  // Count energy acceleration
  const yourAccel = yourDeck.filter(dc => {
    const name = dc.card.name.toLowerCase();
    return name.includes('elesa') || name.includes('mirage gate') || 
           name.includes('dark patch') || name.includes('melony');
  }).length;
  
  const opponentSpeed = opponentDeck?.avgSetupTurn || 2.5;
  const yourEstimatedSpeed = yourAccel > 2 ? 2 : yourAccel > 0 ? 2.5 : 3;
  
  const speedDiff = opponentSpeed - yourEstimatedSpeed;
  const advantage = speedDiff * 10; // Each turn difference = 10% win rate
  
  return {
    advantage,
    significant: Math.abs(speedDiff) >= 0.5,
    description: speedDiff > 0 ? 'Faster setup than opponent' : 
                 speedDiff < 0 ? 'Slower setup than opponent' : 
                 'Similar speed'
  };
}

/**
 * Analyze counter cards in the matchup
 */
function analyzeCounterCards(
  yourDeck: Array<DeckCard & { card: Card }>,
  opponentDeck: MetaDeck | null
): { advantage: number; hasCounters: boolean; description: string; criticalCards: string[] } {
  const criticalCards: string[] = [];
  let advantage = 0;
  let description = '';
  
  const cardNames = yourDeck.map(dc => dc.card.name.toLowerCase());
  
  // Path to the Peak counters ability-reliant decks
  if (cardNames.some(n => n.includes('path to the peak'))) {
    if (opponentDeck && ['Lugia VSTAR', 'Mew VMAX', 'Genesect V'].some(n => 
      opponentDeck.keyCards.some(kc => kc.includes(n))
    )) {
      advantage += 15;
      criticalCards.push('Path to the Peak');
      description = 'Path to the Peak shuts down V abilities';
    }
  }
  
  // Lost City counters single-prize strategies
  if (cardNames.some(n => n.includes('lost city'))) {
    if (opponentDeck?.name.includes('Lost Box')) {
      advantage -= 10; // Bad in mirror
      description = 'Lost City helps opponent';
    } else {
      advantage += 5;
      criticalCards.push('Lost City');
    }
  }
  
  // Spiritomb counters V Pokemon
  if (cardNames.some(n => n.includes('spiritomb'))) {
    if (opponentDeck && opponentDeck.keyCards.some(kc => kc.includes('V'))) {
      advantage += 10;
      criticalCards.push('Spiritomb');
      description = 'Spiritomb blocks V Pokemon attacks';
    }
  }
  
  return {
    advantage,
    hasCounters: criticalCards.length > 0,
    description,
    criticalCards
  };
}

/**
 * Analyze prize trade efficiency
 */
function analyzePrizeTrade(
  yourDeck: Array<DeckCard & { card: Card }>,
  opponentDeck: MetaDeck | null
): { advantage: number; significant: boolean; description: string } {
  // Count multi-prize Pokemon
  const yourMultiPrizers = yourDeck.filter(dc => 
    dc.card.supertype === 'POKEMON' && 
    dc.card.subtypes.some(st => ['V', 'VMAX', 'VSTAR', 'ex', 'EX', 'GX'].includes(st))
  ).length;
  
  const yourSinglePrizers = yourDeck.filter(dc => 
    dc.card.supertype === 'POKEMON' && 
    !dc.card.subtypes.some(st => ['V', 'VMAX', 'VSTAR', 'ex', 'EX', 'GX'].includes(st))
  ).length;
  
  const opponentAvgPrizes = opponentDeck?.avgPrizesTakenPerTurn || 1.5;
  
  // Single prize attackers are good against 2-3 prize Pokemon
  let advantage = 0;
  if (yourSinglePrizers > yourMultiPrizers && opponentAvgPrizes >= 2) {
    advantage = 15;
    return {
      advantage,
      significant: true,
      description: 'Favorable prize trade with single-prize attackers'
    };
  } else if (yourMultiPrizers > yourSinglePrizers && opponentAvgPrizes < 1.5) {
    advantage = -10;
    return {
      advantage,
      significant: true,
      description: 'Unfavorable prize trade with multi-prize Pokemon'
    };
  }
  
  return { advantage: 0, significant: false, description: '' };
}

/**
 * Get archetype matchup (rock-paper-scissors)
 */
function getArchetypeMatchup(
  yourArchetype: DeckArchetype,
  opponentArchetype: string
): { advantage: number; description: string } {
  // Convert string to our archetype enum
  const opponentType = opponentArchetype.toLowerCase();
  
  // Aggro beats Control
  if (yourArchetype === DeckArchetype.AGGRO && opponentType === 'control') {
    return { advantage: 15, description: 'Aggro beats Control - too fast to control' };
  }
  
  // Control beats Midrange
  if (yourArchetype === DeckArchetype.CONTROL && opponentType === 'midrange') {
    return { advantage: 10, description: 'Control beats Midrange - disrupts setup' };
  }
  
  // Midrange beats Aggro
  if (yourArchetype === DeckArchetype.MIDRANGE && opponentType === 'aggro') {
    return { advantage: 10, description: 'Midrange beats Aggro - better late game' };
  }
  
  // Combo is volatile
  if (yourArchetype === DeckArchetype.COMBO || opponentType === 'combo') {
    return { advantage: 0, description: 'Combo matchup - depends on setup' };
  }
  
  return { advantage: 0, description: '' };
}

/**
 * Generate strategic gameplan for the matchup
 */
function generateGameplan(
  winRate: number,
  keyFactors: string[],
  speedDiff: { advantage: number; description: string },
  counters: { criticalCards: string[] }
): string {
  const plans: string[] = [];
  
  if (winRate >= 60) {
    plans.push('Play to your advantages and close out the game quickly');
  } else if (winRate <= 40) {
    plans.push('Play defensively and look for opponent mistakes');
  } else {
    plans.push('Focus on consistent execution of your strategy');
  }
  
  if (speedDiff.advantage > 0) {
    plans.push('Pressure early before opponent sets up');
  } else if (speedDiff.advantage < 0) {
    plans.push('Survive early game and win in the late game');
  }
  
  if (counters.criticalCards.length > 0) {
    plans.push(`Prioritize getting ${counters.criticalCards[0]} into play`);
  }
  
  if (keyFactors.some(f => f.includes('Type advantage'))) {
    plans.push('Exploit type advantage with your attackers');
  }
  
  return plans.slice(0, 2).join('. ') + '.';
}

/**
 * Get matchup table against all meta decks
 */
export function getMatchupTable(
  yourDeck: Array<DeckCard & { card: Card }>,
  yourArchetype?: DeckArchetype
): MatchupPrediction[] {
  return CURRENT_STANDARD_META.topDecks.map(metaDeck => 
    predictMatchup(yourDeck, metaDeck, yourArchetype)
  ).sort((a, b) => b.winRate - a.winRate); // Best matchups first
}