/**
 * Probability calculations for Pokemon TCG using hypergeometric distribution
 */

/**
 * Calculate binomial coefficient (n choose k)
 * Uses logarithms to avoid overflow for large numbers
 */
function logBinomialCoefficient(n: number, k: number): number {
  if (k > n || k < 0) return -Infinity;
  if (k === 0 || k === n) return 0;
  
  // Use symmetry property: C(n,k) = C(n,n-k)
  if (k > n - k) {
    k = n - k;
  }
  
  let result = 0;
  for (let i = 0; i < k; i++) {
    result += Math.log(n - i) - Math.log(i + 1);
  }
  return result;
}

/**
 * Calculate hypergeometric probability
 * P(X = k) = C(K, k) * C(N-K, n-k) / C(N, n)
 * where:
 * - N = population size (deck size)
 * - K = number of success states in population (e.g., number of basics)
 * - n = number of draws (hand size)
 * - k = number of observed successes (e.g., basics in hand)
 */
export function hypergeometricProbability(
  k: number,      // successes in sample
  N: number,      // population size
  K: number,      // successes in population
  n: number       // sample size
): number {
  if (k > K || k > n || n - k > N - K) return 0;
  
  const logNumerator = logBinomialCoefficient(K, k) + logBinomialCoefficient(N - K, n - k);
  const logDenominator = logBinomialCoefficient(N, n);
  
  return Math.exp(logNumerator - logDenominator);
}

/**
 * Calculate the probability of drawing AT LEAST one success
 * This is 1 - P(X = 0)
 */
export function probabilityAtLeastOne(
  N: number,      // population size
  K: number,      // successes in population
  n: number       // sample size
): number {
  return 1 - hypergeometricProbability(0, N, K, n);
}

/**
 * Calculate mulligan probability for Pokemon TCG
 * This is the probability of drawing 0 basic Pokemon in opening hand
 */
export function calculateMulliganProbability(
  basicPokemonCount: number,
  deckSize: number = 60,
  handSize: number = 7
): number {
  if (basicPokemonCount === 0) return 1;
  if (basicPokemonCount >= deckSize) return 0;
  
  return hypergeometricProbability(0, deckSize, basicPokemonCount, handSize);
}

/**
 * Calculate the probability of drawing a specific number of a card type
 * in your opening hand
 */
export function calculateDrawProbability(
  copiesInDeck: number,
  numberDesired: number,
  deckSize: number = 60,
  handSize: number = 7
): number {
  return hypergeometricProbability(numberDesired, deckSize, copiesInDeck, handSize);
}

/**
 * Calculate the probability of drawing AT LEAST a certain number of cards
 */
export function calculateDrawProbabilityAtLeast(
  copiesInDeck: number,
  minimumDesired: number,
  deckSize: number = 60,
  handSize: number = 7
): number {
  let probability = 0;
  const maxPossible = Math.min(copiesInDeck, handSize);
  
  for (let i = minimumDesired; i <= maxPossible; i++) {
    probability += hypergeometricProbability(i, deckSize, copiesInDeck, handSize);
  }
  
  return probability;
}

/**
 * Calculate the probability of prizing all copies of a card
 */
export function calculatePrizeProbability(
  copiesInDeck: number,
  prizeCount: number = 6,
  deckSize: number = 60
): number {
  if (copiesInDeck > prizeCount) return 0;
  return hypergeometricProbability(copiesInDeck, deckSize, copiesInDeck, prizeCount);
}

/**
 * Calculate the probability of prizing at least one copy of a card
 */
export function calculatePrizeAtLeastOne(
  copiesInDeck: number,
  prizeCount: number = 6,
  deckSize: number = 60
): number {
  return 1 - hypergeometricProbability(0, deckSize, copiesInDeck, prizeCount);
}

/**
 * Calculate dead draw probability (no draw supporters in hand)
 * after drawing for turn
 */
export function calculateDeadDrawProbability(
  drawSupporterCount: number,
  currentDeckSize: number,
  cardsDrawn: number = 1
): number {
  // After drawing for turn, what's the chance of having no draw supporters?
  return hypergeometricProbability(0, currentDeckSize, drawSupporterCount, cardsDrawn);
}

/**
 * Calculate setup probabilities for specific card combinations
 */
export interface SetupRequirement {
  cardCount: number;
  copiesNeeded: number;
}

export function calculateSetupProbability(
  requirements: SetupRequirement[],
  deckSize: number = 60,
  handSize: number = 7
): number {
  // For simplicity, calculate as if independent (not perfect but reasonable approximation)
  let probability = 1;
  
  for (const req of requirements) {
    const reqProb = calculateDrawProbabilityAtLeast(
      req.cardCount,
      req.copiesNeeded,
      deckSize,
      handSize
    );
    probability *= reqProb;
  }
  
  return probability;
}

/**
 * Calculate evolution line consistency
 */
export function calculateEvolutionLineConsistency(
  basicCount: number,
  stage1Count: number,
  stage2Count: number | null = null,
  deckSize: number = 60
): {
  turnTwoStage1: number;
  turnThreeStage2: number;
  bottleneck: 'basic' | 'stage1' | 'stage2' | 'none';
  recommendation: string;
} {
  // Simplified model: assume we see ~15 cards by turn 2, ~20 by turn 3
  const cardsByTurn2 = 15;
  const cardsByTurn3 = 20;
  
  // Probability of having at least one of each by specific turns
  const basicByTurn1 = probabilityAtLeastOne(deckSize, basicCount, 7);
  const stage1ByTurn2 = probabilityAtLeastOne(deckSize, stage1Count, cardsByTurn2);
  const stage2ByTurn3 = stage2Count ? probabilityAtLeastOne(deckSize, stage2Count, cardsByTurn3) : 1;
  
  // Combined probabilities (need basic first)
  const turnTwoStage1 = basicByTurn1 * stage1ByTurn2;
  const turnThreeStage2 = turnTwoStage1 * stage2ByTurn3;
  
  // Determine bottleneck
  let bottleneck: 'basic' | 'stage1' | 'stage2' | 'none' = 'none';
  let recommendation = 'Evolution line is well balanced';
  
  if (stage2Count) {
    if (basicCount < stage2Count) {
      bottleneck = 'basic';
      recommendation = `Increase basic count to at least ${stage2Count}`;
    } else if (stage1Count < stage2Count) {
      bottleneck = 'stage1';
      recommendation = `Increase Stage 1 count to at least ${stage2Count}`;
    } else if (basicCount === stage1Count && stage1Count === stage2Count) {
      recommendation = 'Consider 4-3-3 or 3-2-2 for better consistency';
    }
  } else if (stage1Count) {
    if (basicCount < stage1Count) {
      bottleneck = 'basic';
      recommendation = `Increase basic count to at least ${stage1Count}`;
    }
  }
  
  return {
    turnTwoStage1,
    turnThreeStage2,
    bottleneck,
    recommendation
  };
}