/**
 * Prize Trade Economy Analysis
 * 
 * Analyzes how efficiently a deck trades prizes with opponents
 * and calculates the economic value of each knockout
 */

import { Card, DeckCard } from '@prisma/client';

export interface PrizeTradeScenario {
  yourAttacker: string;
  yourPrizeValue: number; // How many prizes you give up
  opponentTarget: string;
  opponentPrizeValue: number; // How many prizes you take
  tradeRatio: number; // Higher is better (their prizes / your prizes)
  evaluation: 'excellent' | 'favorable' | 'even' | 'unfavorable' | 'terrible';
}

export interface PrizeEconomy {
  overallEfficiency: number; // 0-100
  averagePrizeValue: number; // Average prizes your Pokemon give up
  prizeLiability: number; // Total prizes opponent can take
  bestTraders: Array<{
    pokemon: string;
    prizeValue: number;
    maxDamage: number;
    efficiency: number;
  }>;
  worstLiabilities: Array<{
    pokemon: string;
    prizeValue: number;
    hp: number;
    risk: string;
  }>;
  scenarios: PrizeTradeScenario[];
  strategy: {
    primaryApproach: 'single-prize' | 'multi-prize' | 'mixed';
    idealGameplan: string;
    criticalTurns: number[]; // Turns where prize trades matter most
  };
  recommendations: string[];
}

/**
 * Analyze prize trade economy
 */
export function analyzePrizeTradeEconomy(
  cards: Array<DeckCard & { card: Card }>
): PrizeEconomy {
  // Categorize Pokemon by prize value
  const pokemonByPrizes = categorizePokemonByPrizes(cards);
  
  // Calculate average prize value
  const averagePrizeValue = calculateAveragePrizeValue(pokemonByPrizes);
  
  // Calculate total prize liability
  const prizeLiability = calculatePrizeLiability(pokemonByPrizes);
  
  // Identify best and worst traders
  const bestTraders = identifyBestTraders(cards);
  const worstLiabilities = identifyWorstLiabilities(cards);
  
  // Generate trade scenarios
  const scenarios = generateTradeScenarios(cards);
  
  // Determine strategy
  const strategy = determineStrategy(pokemonByPrizes, scenarios);
  
  // Calculate overall efficiency
  const overallEfficiency = calculateOverallEfficiency(
    averagePrizeValue,
    bestTraders,
    scenarios
  );
  
  // Generate recommendations
  const recommendations = generatePrizeTradeRecommendations(
    overallEfficiency,
    averagePrizeValue,
    strategy
  );
  
  return {
    overallEfficiency,
    averagePrizeValue,
    prizeLiability,
    bestTraders,
    worstLiabilities,
    scenarios,
    strategy,
    recommendations
  };
}

/**
 * Categorize Pokemon by prize value
 */
function categorizePokemonByPrizes(
  cards: Array<DeckCard & { card: Card }>
): Map<number, Array<DeckCard & { card: Card }>> {
  const categorized = new Map<number, Array<DeckCard & { card: Card }>>();
  
  cards
    .filter(dc => dc.card.supertype === 'POKEMON')
    .forEach(dc => {
      const prizes = getPrizeValue(dc.card);
      
      if (!categorized.has(prizes)) {
        categorized.set(prizes, []);
      }
      categorized.get(prizes)!.push(dc);
    });
  
  return categorized;
}

/**
 * Get prize value for a Pokemon
 */
function getPrizeValue(card: Card): number {
  const subtypes = card.subtypes || [];
  
  // Check for multi-prize Pokemon
  if (subtypes.some(st => ['VMAX', 'VSTAR'].includes(st))) return 3;
  if (subtypes.some(st => ['V', 'ex', 'EX'].includes(st))) return 2;
  if (subtypes.some(st => ['GX', 'BREAK'].includes(st))) return 2;
  
  // Prism Star and special Pokemon
  if (card.name.includes('◇') || card.name.includes('Prism Star')) return 1;
  
  // Default single prize
  return 1;
}

/**
 * Calculate average prize value
 */
function calculateAveragePrizeValue(
  pokemonByPrizes: Map<number, Array<DeckCard & { card: Card }>>
): number {
  let totalPrizes = 0;
  let totalPokemon = 0;
  
  pokemonByPrizes.forEach((pokemon, prizeValue) => {
    const count = pokemon.reduce((sum, dc) => sum + dc.quantity, 0);
    totalPrizes += prizeValue * count;
    totalPokemon += count;
  });
  
  return totalPokemon > 0 ? totalPrizes / totalPokemon : 1;
}

/**
 * Calculate total prize liability
 */
function calculatePrizeLiability(
  pokemonByPrizes: Map<number, Array<DeckCard & { card: Card }>>
): number {
  let totalLiability = 0;
  
  pokemonByPrizes.forEach((pokemon, prizeValue) => {
    const count = pokemon.reduce((sum, dc) => sum + dc.quantity, 0);
    totalLiability += prizeValue * count;
  });
  
  // Cap at 6 (max prizes in a game)
  return Math.min(totalLiability, 6);
}

/**
 * Identify best prize traders
 */
function identifyBestTraders(
  cards: Array<DeckCard & { card: Card }>
): PrizeEconomy['bestTraders'] {
  const traders: PrizeEconomy['bestTraders'] = [];
  
  cards
    .filter(dc => 
      dc.card.supertype === 'POKEMON' && 
      dc.card.attacks && 
      dc.card.attacks.length > 0
    )
    .forEach(dc => {
      const prizeValue = getPrizeValue(dc.card);
      const maxDamage = Math.max(
        ...dc.card.attacks.map(a => parseInt(a.damage) || 0)
      );
      
      // Calculate efficiency (damage per prize given up)
      const efficiency = maxDamage / prizeValue;
      
      traders.push({
        pokemon: dc.card.name,
        prizeValue,
        maxDamage,
        efficiency
      });
    });
  
  // Sort by efficiency and return top 5
  return traders
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 5);
}

/**
 * Identify worst prize liabilities
 */
function identifyWorstLiabilities(
  cards: Array<DeckCard & { card: Card }>
): PrizeEconomy['worstLiabilities'] {
  const liabilities: PrizeEconomy['worstLiabilities'] = [];
  
  cards
    .filter(dc => dc.card.supertype === 'POKEMON')
    .forEach(dc => {
      const prizeValue = getPrizeValue(dc.card);
      const hp = dc.card.hp || 0;
      
      // High prize, low HP is bad
      if (prizeValue >= 2 && hp < 250) {
        let risk = 'Fragile multi-prize Pokemon';
        
        if (hp < 200) risk = 'Extremely fragile for prize value';
        if (prizeValue === 3 && hp < 300) risk = 'VMAX/VSTAR with low HP';
        
        liabilities.push({
          pokemon: dc.card.name,
          prizeValue,
          hp,
          risk
        });
      }
      
      // Support Pokemon that give up prizes
      if (prizeValue >= 2 && !dc.card.attacks?.length) {
        liabilities.push({
          pokemon: dc.card.name,
          prizeValue,
          hp,
          risk: 'Multi-prize support Pokemon (liability)'
        });
      }
    });
  
  // Sort by risk (prize value / HP ratio)
  return liabilities
    .sort((a, b) => (b.prizeValue / b.hp) - (a.prizeValue / a.hp))
    .slice(0, 5);
}

/**
 * Generate prize trade scenarios
 */
function generateTradeScenarios(
  cards: Array<DeckCard & { card: Card }>
): PrizeTradeScenario[] {
  const scenarios: PrizeTradeScenario[] = [];
  
  // Get attackers
  const attackers = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' && 
    dc.card.attacks?.length > 0
  );
  
  // Common meta targets
  const metaTargets = [
    { name: 'Lugia VSTAR', prizes: 3, hp: 280 },
    { name: 'Giratina VSTAR', prizes: 3, hp: 280 },
    { name: 'Arceus VSTAR', prizes: 3, hp: 280 },
    { name: 'Mew VMAX', prizes: 3, hp: 310 },
    { name: 'Charizard ex', prizes: 2, hp: 260 },
    { name: 'Lost Box attackers', prizes: 1, hp: 110 }
  ];
  
  attackers.forEach(attacker => {
    const yourPrizes = getPrizeValue(attacker.card);
    const maxDamage = Math.max(
      ...attacker.card.attacks!.map(a => parseInt(a.damage) || 0)
    );
    
    metaTargets.forEach(target => {
      // Can we OHKO?
      const turnsToKO = Math.ceil(target.hp / Math.max(1, maxDamage));
      
      // Only consider reasonable scenarios (3 turns or less)
      if (turnsToKO <= 3) {
        const tradeRatio = target.prizes / yourPrizes;
        
        scenarios.push({
          yourAttacker: attacker.card.name,
          yourPrizeValue: yourPrizes,
          opponentTarget: target.name,
          opponentPrizeValue: target.prizes,
          tradeRatio,
          evaluation: evaluateTrade(tradeRatio, turnsToKO)
        });
      }
    });
  });
  
  // Sort by trade ratio (best first)
  return scenarios
    .sort((a, b) => b.tradeRatio - a.tradeRatio)
    .slice(0, 10); // Top 10 scenarios
}

/**
 * Evaluate a prize trade
 */
function evaluateTrade(ratio: number, turnsToKO: number): PrizeTradeScenario['evaluation'] {
  // Adjust ratio based on turns needed
  const adjustedRatio = ratio / turnsToKO;
  
  if (adjustedRatio >= 2) return 'excellent';
  if (adjustedRatio >= 1.5) return 'favorable';
  if (adjustedRatio >= 0.8) return 'even';
  if (adjustedRatio >= 0.5) return 'unfavorable';
  return 'terrible';
}

/**
 * Determine prize trade strategy
 */
function determineStrategy(
  pokemonByPrizes: Map<number, Array<DeckCard & { card: Card }>>,
  scenarios: PrizeTradeScenario[]
): PrizeEconomy['strategy'] {
  // Count Pokemon by prize value
  const singlePrizers = pokemonByPrizes.get(1)?.reduce((sum, dc) => sum + dc.quantity, 0) || 0;
  const multiPrizers = 
    (pokemonByPrizes.get(2)?.reduce((sum, dc) => sum + dc.quantity, 0) || 0) +
    (pokemonByPrizes.get(3)?.reduce((sum, dc) => sum + dc.quantity, 0) || 0);
  
  // Determine primary approach
  let primaryApproach: 'single-prize' | 'multi-prize' | 'mixed';
  if (singlePrizers > multiPrizers * 2) {
    primaryApproach = 'single-prize';
  } else if (multiPrizers > singlePrizers * 2) {
    primaryApproach = 'multi-prize';
  } else {
    primaryApproach = 'mixed';
  }
  
  // Determine ideal gameplan
  let idealGameplan: string;
  if (primaryApproach === 'single-prize') {
    idealGameplan = 'Force unfavorable prize trades with single-prize attackers';
  } else if (primaryApproach === 'multi-prize') {
    idealGameplan = 'Race to take prizes quickly with powerful multi-prize Pokemon';
  } else {
    idealGameplan = 'Adapt prize trades based on matchup, use both strategies';
  }
  
  // Critical turns (when prize math matters most)
  const criticalTurns = primaryApproach === 'multi-prize' ? [2, 3, 4] : [3, 4, 5];
  
  return {
    primaryApproach,
    idealGameplan,
    criticalTurns
  };
}

/**
 * Calculate overall prize trade efficiency
 */
function calculateOverallEfficiency(
  avgPrizeValue: number,
  bestTraders: PrizeEconomy['bestTraders'],
  scenarios: PrizeTradeScenario[]
): number {
  let score = 50; // Base score
  
  // Lower average prize value is better
  if (avgPrizeValue <= 1.3) score += 20;
  else if (avgPrizeValue <= 1.6) score += 10;
  else if (avgPrizeValue >= 2.0) score -= 10;
  
  // High efficiency traders boost score
  const avgEfficiency = bestTraders.reduce((sum, t) => sum + t.efficiency, 0) / 
                       Math.max(1, bestTraders.length);
  
  if (avgEfficiency >= 150) score += 20; // 150+ damage per prize
  else if (avgEfficiency >= 100) score += 10;
  else if (avgEfficiency < 50) score -= 10;
  
  // Good trade scenarios boost score
  const goodTrades = scenarios.filter(s => 
    s.evaluation === 'excellent' || s.evaluation === 'favorable'
  ).length;
  
  score += Math.min(20, goodTrades * 4);
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate prize trade recommendations
 */
function generatePrizeTradeRecommendations(
  efficiency: number,
  avgPrizeValue: number,
  strategy: PrizeEconomy['strategy']
): string[] {
  const recommendations: string[] = [];
  
  if (efficiency < 60) {
    recommendations.push('Poor prize trade efficiency - deck gives up too many prizes');
    
    if (avgPrizeValue > 1.7) {
      recommendations.push('Add more single-prize attackers to improve trades');
    }
    
    if (strategy.primaryApproach === 'multi-prize') {
      recommendations.push('Consider Echoing Horn or Boss to target opponent liabilities');
    }
  }
  
  if (strategy.primaryApproach === 'single-prize') {
    recommendations.push('Maintain single-prize strategy - force 2-for-1 or 3-for-1 trades');
    recommendations.push('Add recovery cards to sustain single-prize attackers');
  } else if (strategy.primaryApproach === 'multi-prize') {
    recommendations.push('Focus on speed - take prizes before opponent sets up');
    recommendations.push('Include gust effects to target weak bench Pokemon');
  }
  
  if (efficiency >= 80) {
    recommendations.push('Excellent prize trading - maintain current strategy');
  }
  
  return recommendations;
}