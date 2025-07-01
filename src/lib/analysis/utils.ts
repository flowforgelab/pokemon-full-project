import { DeckAnalyzer } from './deck-analyzer';
import type { Deck, DeckCard, Card } from '@prisma/client';
import { DeckArchetype } from './types';
import type { 
  DeckAnalysisResult, 
  AnalysisConfig
} from './types';

/**
 * Analyze a deck with default configuration
 */
export async function analyzeDeck(
  deck: Deck & { cards: (DeckCard & { card: Card })[] },
  config?: Partial<AnalysisConfig>
): Promise<DeckAnalysisResult> {
  const analyzer = new DeckAnalyzer({
    format: config?.format || 'standard',
    includeRotation: config?.includeRotation ?? true,
    ...config,
  });

  return analyzer.analyzeDeck(deck);
}

/**
 * Compare two decks and return detailed comparison
 */
export async function compareDecks(
  deckA: Deck & { cards: (DeckCard & { card: Card })[] },
  deckB: Deck & { cards: (DeckCard & { card: Card })[] },
  config?: Partial<AnalysisConfig>
): Promise<{
  analysisA: DeckAnalysisResult;
  analysisB: DeckAnalysisResult;
  comparison: {
    overallWinner: string;
    scoreComparison: Record<string, { winner: string; difference: number }>;
    matchupPrediction: {
      favoredDeck: string;
      winRate: number;
      keyFactors: string[];
    };
    recommendations: {
      forDeckA: string[];
      forDeckB: string[];
    };
  };
}> {
  const analyzer = new DeckAnalyzer({
    format: config?.format || 'standard',
    includeRotation: config?.includeRotation ?? true,
    ...config,
  });

  // Analyze both decks
  const [analysisA, analysisB] = await Promise.all([
    analyzer.analyzeDeck(deckA),
    analyzer.analyzeDeck(deckB),
  ]);

  // Compare scores
  const scoreComparison: Record<string, { winner: string; difference: number }> = {};
  const scoreKeys = ['overall', 'consistency', 'power', 'speed', 'versatility', 'metaRelevance'];

  scoreKeys.forEach(key => {
    const scoreA = analysisA.scores[key as keyof typeof analysisA.scores];
    const scoreB = analysisB.scores[key as keyof typeof analysisB.scores];
    const difference = Math.abs(scoreA - scoreB);
    
    scoreComparison[key] = {
      winner: scoreA > scoreB ? deckA.name : scoreB > scoreA ? deckB.name : 'Tie',
      difference,
    };
  });

  // Predict matchup
  const matchupPrediction = predictMatchup(analysisA, analysisB, deckA.name, deckB.name);

  // Generate recommendations
  const recommendations = {
    forDeckA: generateComparativeRecommendations(analysisA, analysisB),
    forDeckB: generateComparativeRecommendations(analysisB, analysisA),
  };

  return {
    analysisA,
    analysisB,
    comparison: {
      overallWinner: scoreComparison.overall.winner,
      scoreComparison,
      matchupPrediction,
      recommendations,
    },
  };
}

/**
 * Predict matchup between two analyzed decks
 */
function predictMatchup(
  analysisA: DeckAnalysisResult,
  analysisB: DeckAnalysisResult,
  nameA: string,
  nameB: string
): {
  favoredDeck: string;
  winRate: number;
  keyFactors: string[];
} {
  let winRateA = 50;
  const keyFactors: string[] = [];

  // Speed advantage
  const speedAdvantage = getSpeedAdvantage(analysisA.speed.overallSpeed, analysisB.speed.overallSpeed);
  winRateA += speedAdvantage.modifier;
  if (speedAdvantage.factor) keyFactors.push(speedAdvantage.factor);

  // Archetype matchup
  const archetypeMatchup = getArchetypeMatchup(
    analysisA.archetype.primaryArchetype,
    analysisB.archetype.primaryArchetype
  );
  winRateA += archetypeMatchup.modifier;
  if (archetypeMatchup.factor) keyFactors.push(archetypeMatchup.factor);

  // Power difference
  const powerDiff = analysisA.scores.power - analysisB.scores.power;
  if (Math.abs(powerDiff) > 20) {
    winRateA += powerDiff / 4;
    keyFactors.push(powerDiff > 0 ? 'Significant power advantage' : 'Significant power disadvantage');
  }

  // Consistency advantage
  const consistencyDiff = analysisA.scores.consistency - analysisB.scores.consistency;
  if (Math.abs(consistencyDiff) > 15) {
    winRateA += consistencyDiff / 5;
    keyFactors.push(consistencyDiff > 0 ? 'More consistent setup' : 'Less consistent setup');
  }

  // Normalize win rate
  winRateA = Math.max(20, Math.min(80, winRateA));

  return {
    favoredDeck: winRateA >= 50 ? nameA : nameB,
    winRate: winRateA >= 50 ? winRateA : 100 - winRateA,
    keyFactors,
  };
}

/**
 * Get speed advantage modifier
 */
function getSpeedAdvantage(
  speedA: 'slow' | 'medium' | 'fast' | 'turbo',
  speedB: 'slow' | 'medium' | 'fast' | 'turbo'
): { modifier: number; factor?: string } {
  const speedValues = { slow: 1, medium: 2, fast: 3, turbo: 4 };
  const difference = speedValues[speedA] - speedValues[speedB];

  if (difference >= 2) return { modifier: 15, factor: 'Significant speed advantage' };
  if (difference === 1) return { modifier: 7, factor: 'Slight speed advantage' };
  if (difference === -1) return { modifier: -7, factor: 'Slight speed disadvantage' };
  if (difference <= -2) return { modifier: -15, factor: 'Significant speed disadvantage' };
  
  return { modifier: 0 };
}

/**
 * Get archetype matchup modifier
 */
function getArchetypeMatchup(
  archetypeA: DeckArchetype,
  archetypeB: DeckArchetype
): { modifier: number; factor?: string } {
  // Simplified matchup matrix
  const favorable: Record<DeckArchetype, DeckArchetype[]> = {
    [DeckArchetype.AGGRO]: [DeckArchetype.COMBO, DeckArchetype.CONTROL],
    [DeckArchetype.CONTROL]: [DeckArchetype.MIDRANGE, DeckArchetype.COMBO],
    [DeckArchetype.COMBO]: [DeckArchetype.STALL, DeckArchetype.MIDRANGE],
    [DeckArchetype.MIDRANGE]: [DeckArchetype.AGGRO],
    [DeckArchetype.MILL]: [DeckArchetype.CONTROL, DeckArchetype.STALL],
    [DeckArchetype.STALL]: [DeckArchetype.AGGRO],
    [DeckArchetype.TOOLBOX]: [],
    [DeckArchetype.TURBO]: [DeckArchetype.CONTROL, DeckArchetype.STALL],
    [DeckArchetype.SPREAD]: [DeckArchetype.TOOLBOX],
  };

  const unfavorable: Record<DeckArchetype, DeckArchetype[]> = {
    [DeckArchetype.AGGRO]: [DeckArchetype.STALL, DeckArchetype.MIDRANGE],
    [DeckArchetype.CONTROL]: [DeckArchetype.AGGRO, DeckArchetype.TURBO],
    [DeckArchetype.COMBO]: [DeckArchetype.CONTROL, DeckArchetype.AGGRO],
    [DeckArchetype.MIDRANGE]: [DeckArchetype.CONTROL],
    [DeckArchetype.MILL]: [DeckArchetype.AGGRO, DeckArchetype.TURBO],
    [DeckArchetype.STALL]: [DeckArchetype.COMBO, DeckArchetype.MILL],
    [DeckArchetype.TOOLBOX]: [DeckArchetype.SPREAD],
    [DeckArchetype.TURBO]: [DeckArchetype.MILL],
    [DeckArchetype.SPREAD]: [DeckArchetype.AGGRO],
  };

  if (favorable[archetypeA]?.includes(archetypeB)) {
    return { modifier: 10, factor: 'Favorable archetype matchup' };
  }
  
  if (unfavorable[archetypeA]?.includes(archetypeB)) {
    return { modifier: -10, factor: 'Unfavorable archetype matchup' };
  }

  return { modifier: 0 };
}

/**
 * Generate comparative recommendations
 */
function generateComparativeRecommendations(
  myAnalysis: DeckAnalysisResult,
  opponentAnalysis: DeckAnalysisResult
): string[] {
  const recommendations: string[] = [];

  // Speed recommendations
  if (myAnalysis.speed.overallSpeed === 'slow' && 
      (opponentAnalysis.speed.overallSpeed === 'fast' || opponentAnalysis.speed.overallSpeed === 'turbo')) {
    recommendations.push('Consider adding speed cards to compete with faster opponent');
  }

  // Consistency recommendations
  if (myAnalysis.scores.consistency < opponentAnalysis.scores.consistency - 15) {
    recommendations.push('Improve consistency to match opponent\'s reliability');
  }

  // Power recommendations
  if (myAnalysis.scores.power < opponentAnalysis.scores.power - 20) {
    recommendations.push('Consider stronger attackers or damage enhancement');
  }

  // Meta recommendations
  if (myAnalysis.scores.metaRelevance < opponentAnalysis.scores.metaRelevance - 20) {
    recommendations.push('Update deck with more meta-relevant cards');
  }

  // Archetype-specific
  if (myAnalysis.archetype.primaryArchetype === opponentAnalysis.archetype.primaryArchetype) {
    recommendations.push('Differentiate strategy from opponent\'s similar archetype');
  }

  return recommendations.slice(0, 5); // Top 5 recommendations
}

/**
 * Get deck archetype emoji for display
 */
export function getArchetypeEmoji(archetype: DeckArchetype): string {
  const emojis: Record<DeckArchetype, string> = {
    [DeckArchetype.AGGRO]: '⚡',
    [DeckArchetype.CONTROL]: '🛡️',
    [DeckArchetype.COMBO]: '🔄',
    [DeckArchetype.MIDRANGE]: '⚖️',
    [DeckArchetype.MILL]: '📚',
    [DeckArchetype.STALL]: '⏰',
    [DeckArchetype.TOOLBOX]: '🧰',
    [DeckArchetype.TURBO]: '🚀',
    [DeckArchetype.SPREAD]: '💫',
  };

  return emojis[archetype] || '❓';
}

/**
 * Get score grade for display
 */
export function getScoreGrade(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: 'S', color: 'text-purple-600' };
  if (score >= 80) return { grade: 'A', color: 'text-green-600' };
  if (score >= 70) return { grade: 'B', color: 'text-blue-600' };
  if (score >= 60) return { grade: 'C', color: 'text-yellow-600' };
  if (score >= 50) return { grade: 'D', color: 'text-orange-600' };
  return { grade: 'F', color: 'text-red-600' };
}

/**
 * Format analysis for export
 */
export function formatAnalysisForExport(analysis: DeckAnalysisResult): string {
  const lines: string[] = [
    '# Pokemon TCG Deck Analysis Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Overall Scores',
    `- Overall: ${analysis.scores.overall}/100 (${getScoreGrade(analysis.scores.overall).grade})`,
    `- Consistency: ${analysis.scores.consistency}/100`,
    `- Power: ${analysis.scores.power}/100`,
    `- Speed: ${analysis.scores.speed}/100`,
    `- Versatility: ${analysis.scores.versatility}/100`,
    `- Meta Relevance: ${analysis.scores.metaRelevance}/100`,
    '',
    '## Deck Classification',
    `- Primary Archetype: ${analysis.archetype.primaryArchetype}`,
    `- Confidence: ${analysis.archetype.confidence}%`,
    `- Playstyle: ${analysis.archetype.playstyle}`,
    '',
    '## Key Strengths',
    ...analysis.scores.breakdown.strengths.map(s => `- ${s}`),
    '',
    '## Key Weaknesses',
    ...analysis.scores.breakdown.weaknesses.map(w => `- ${w}`),
    '',
    '## Recommendations',
    ...analysis.recommendations.map(r => 
      `- [${r.priority.toUpperCase()}] ${r.reason} - ${r.impact}`
    ),
  ];

  return lines.join('\n');
}