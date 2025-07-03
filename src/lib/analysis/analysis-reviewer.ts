/**
 * Analysis Reviewer - Meta-analyzer that reviews deck analysis output
 * 
 * This module evaluates the quality of deck analysis recommendations
 * and suggests improvements to make the analysis more accurate
 */

import { Card, DeckCard } from '@prisma/client';
import type { BasicDeckAnalysis } from './basic-deck-analyzer';
import type { DeckAnalysis } from './deck-analyzer';

export interface AnalysisReview {
  accuracyScore: number; // 0-100
  missedIssues: string[];
  incorrectRecommendations: string[];
  improvements: string[];
  contextualNotes: string[];
}

/**
 * Review a basic deck analysis for accuracy
 */
export function reviewBasicAnalysis(
  cards: Array<DeckCard & { card: Card }>,
  analysis: BasicDeckAnalysis
): AnalysisReview {
  const review: AnalysisReview = {
    accuracyScore: 100,
    missedIssues: [],
    incorrectRecommendations: [],
    improvements: [],
    contextualNotes: []
  };

  // Check for missed energy acceleration
  checkEnergyAcceleration(cards, analysis, review);
  
  // Check for inappropriate removal suggestions
  checkRemovalSuggestions(cards, analysis, review);
  
  // Check for energy balance issues
  checkEnergyBalance(cards, analysis, review);
  
  // Check for special card rules
  checkSpecialCardRules(cards, analysis, review);
  
  // Check for redundant recommendations
  checkRedundantRecommendations(cards, analysis, review);
  
  // Check evolution line analysis accuracy
  checkEvolutionAnalysis(cards, analysis, review);
  
  // Calculate accuracy score
  review.accuracyScore = calculateAccuracyScore(review);
  
  return review;
}

/**
 * Check if energy acceleration was properly detected
 */
function checkEnergyAcceleration(
  cards: Array<DeckCard & { card: Card }>,
  analysis: BasicDeckAnalysis,
  review: AnalysisReview
) {
  // Look for Pokemon with energy acceleration abilities
  const hasAcceleration = cards.some(dc => {
    if (dc.card.abilities) {
      return dc.card.abilities.some(ability => 
        ability.text?.toLowerCase().includes('attach') && 
        ability.text?.toLowerCase().includes('energy')
      );
    }
    return false;
  });
  
  // Check if analyzer warned about slow energy when acceleration exists
  const warnedAboutSlowEnergy = analysis.advice.some(advice => 
    advice.title.includes('Slow Energy')
  );
  
  if (hasAcceleration && warnedAboutSlowEnergy) {
    review.missedIssues.push('Deck has energy acceleration (check abilities) but analyzer warned about slow setup');
    review.improvements.push('Detect Pokemon abilities that attach extra energy');
  }
}

/**
 * Check if removal suggestions make sense
 */
function checkRemovalSuggestions(
  cards: Array<DeckCard & { card: Card }>,
  analysis: BasicDeckAnalysis,
  review: AnalysisReview
) {
  // Find main attackers (high HP, powerful attacks)
  const mainAttackers = cards.filter(dc => {
    const hp = parseInt(dc.card.hp || '0');
    const hasGoodAttacks = dc.card.attacks?.some(atk => 
      parseInt(atk.damage || '0') >= 100
    );
    return hp >= 170 && hasGoodAttacks;
  });
  
  // Check if analyzer suggested removing main attackers
  analysis.swapSuggestions?.forEach(swap => {
    swap.remove.forEach(removal => {
      if (mainAttackers.some(attacker => attacker.card.name === removal.name)) {
        review.incorrectRecommendations.push(
          `Suggested removing ${removal.name} which appears to be a main attacker`
        );
        review.improvements.push(
          'Avoid suggesting removal of high HP Pokemon with strong attacks'
        );
      }
    });
  });
}

/**
 * Check energy balance for multi-type decks
 */
function checkEnergyBalance(
  cards: Array<DeckCard & { card: Card }>,
  analysis: BasicDeckAnalysis,
  review: AnalysisReview
) {
  // Count energy by type
  const energyCounts = new Map<string, number>();
  cards.forEach(dc => {
    if (dc.card.supertype === 'ENERGY' && dc.card.subtypes?.includes('Basic')) {
      const type = dc.card.name.replace(' Energy', '');
      energyCounts.set(type, dc.quantity);
    }
  });
  
  // Check if any Pokemon need multiple energy types
  const multiTypeAttackers = cards.filter(dc => {
    if (dc.card.attacks) {
      return dc.card.attacks.some(attack => {
        const uniqueTypes = new Set(attack.cost);
        return uniqueTypes.size > 1 && !uniqueTypes.has('Colorless');
      });
    }
    return false;
  });
  
  if (multiTypeAttackers.length > 0 && energyCounts.size > 1) {
    // Check if energy split matches attack requirements
    const types = Array.from(energyCounts.entries());
    const maxDiff = Math.max(...types.map(t => t[1])) - Math.min(...types.map(t => t[1]));
    
    if (maxDiff > 5 && !analysis.advice.some(a => a.message.includes('Energy split'))) {
      review.missedIssues.push(
        `Energy imbalance detected (${types.map(t => `${t[1]} ${t[0]}`).join(', ')}) for multi-type attackers`
      );
      review.improvements.push(
        'Analyze energy requirements for multi-type Pokemon attacks'
      );
    }
  }
}

/**
 * Check special card rules
 */
function checkSpecialCardRules(
  cards: Array<DeckCard & { card: Card }>,
  analysis: BasicDeckAnalysis,
  review: AnalysisReview
) {
  // Check Prism Star rules
  const prismStars = cards.filter(dc => 
    dc.card.subtypes?.includes('Prism Star')
  );
  
  if (prismStars.length > 0) {
    const prismStarNames = new Map<string, number>();
    prismStars.forEach(dc => {
      prismStarNames.set(dc.card.name, dc.quantity);
    });
    
    // Check if any Prism Star has quantity > 1
    const duplicatePrisms = Array.from(prismStarNames.entries())
      .filter(([_, qty]) => qty > 1);
    
    if (duplicatePrisms.length > 0) {
      const mentioned = analysis.advice.some(a => 
        a.message.includes('Prism Star') && a.message.includes('only have 1')
      );
      
      if (!mentioned) {
        review.missedIssues.push(
          `Multiple copies of Prism Star cards detected (${duplicatePrisms.map(d => d[0]).join(', ')})`
        );
        review.contextualNotes.push(
          'Prism Star rule: You can only have 1 copy of each Prism Star card in a deck'
        );
      }
    }
  }
}

/**
 * Check for redundant recommendations
 */
function checkRedundantRecommendations(
  cards: Array<DeckCard & { card: Card }>,
  analysis: BasicDeckAnalysis,
  review: AnalysisReview
) {
  // Count draw supporters
  const drawSupporters = cards.filter(dc => {
    if (dc.card.supertype === 'TRAINER' && dc.card.subtypes?.includes('Supporter')) {
      return dc.card.rules?.some(rule => 
        rule.toLowerCase().includes('draw')
      ) || false;
    }
    return false;
  });
  
  const totalDrawSupport = drawSupporters.reduce((sum, dc) => sum + dc.quantity, 0);
  
  // Check if analyzer recommended adding draw when plenty exists
  const recommendedDraw = analysis.advice.some(a => 
    a.fixIt?.includes("Professor's Research") || 
    a.cardsToAdd?.some(c => c.name.includes("Research"))
  );
  
  if (totalDrawSupport >= 6 && recommendedDraw) {
    review.incorrectRecommendations.push(
      `Recommended adding draw support when deck already has ${totalDrawSupport} draw supporters`
    );
    review.improvements.push(
      'Only recommend cards that are actually missing from the deck'
    );
  }
}

/**
 * Check evolution line analysis
 */
function checkEvolutionAnalysis(
  cards: Array<DeckCard & { card: Card }>,
  analysis: BasicDeckAnalysis,
  review: AnalysisReview
) {
  // Check for Rare Candy in evolution decks
  const hasStage2 = cards.some(dc => dc.card.subtypes?.includes('Stage 2'));
  const rareCandy = cards.find(dc => dc.card.name === 'Rare Candy');
  
  if (hasStage2 && rareCandy && rareCandy.quantity >= 3) {
    review.contextualNotes.push(
      'Deck uses Rare Candy strategy for Stage 2 evolution - may need fewer Stage 1s'
    );
  }
}

/**
 * Calculate accuracy score based on issues found
 */
function calculateAccuracyScore(review: AnalysisReview): number {
  let score = 100;
  
  // Deduct for missed issues
  score -= review.missedIssues.length * 10;
  
  // Deduct for incorrect recommendations
  score -= review.incorrectRecommendations.length * 15;
  
  // Small bonus for contextual understanding
  score += Math.min(review.contextualNotes.length * 2, 10);
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate a formatted review report
 */
export function formatAnalysisReview(review: AnalysisReview): string {
  const lines: string[] = [];
  
  lines.push('📊 ANALYSIS REVIEW REPORT');
  lines.push('========================');
  lines.push(`Accuracy Score: ${review.accuracyScore}/100`);
  lines.push('');
  
  if (review.missedIssues.length > 0) {
    lines.push('❌ Missed Issues:');
    review.missedIssues.forEach(issue => {
      lines.push(`   • ${issue}`);
    });
    lines.push('');
  }
  
  if (review.incorrectRecommendations.length > 0) {
    lines.push('⚠️  Incorrect Recommendations:');
    review.incorrectRecommendations.forEach(rec => {
      lines.push(`   • ${rec}`);
    });
    lines.push('');
  }
  
  if (review.improvements.length > 0) {
    lines.push('💡 Suggested Improvements:');
    review.improvements.forEach(imp => {
      lines.push(`   • ${imp}`);
    });
    lines.push('');
  }
  
  if (review.contextualNotes.length > 0) {
    lines.push('📝 Contextual Notes:');
    review.contextualNotes.forEach(note => {
      lines.push(`   • ${note}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Review advanced deck analysis
 */
export function reviewAdvancedAnalysis(
  cards: Array<DeckCard & { card: Card }>,
  analysis: DeckAnalysis
): AnalysisReview {
  const review: AnalysisReview = {
    accuracyScore: 100,
    missedIssues: [],
    incorrectRecommendations: [],
    improvements: [],
    contextualNotes: []
  };
  
  // Check meta positioning accuracy
  checkMetaAnalysis(cards, analysis, review);
  
  // Check synergy detection
  checkSynergyAnalysis(cards, analysis, review);
  
  // Check budget calculations
  checkBudgetAnalysis(cards, analysis, review);
  
  // Calculate accuracy score
  review.accuracyScore = calculateAccuracyScore(review);
  
  return review;
}

/**
 * Check meta analysis accuracy
 */
function checkMetaAnalysis(
  cards: Array<DeckCard & { card: Card }>,
  analysis: DeckAnalysis,
  review: AnalysisReview
) {
  // Check if deck archetype makes sense
  const hasControlElements = cards.some(dc => 
    dc.card.name.includes('Reset Stamp') || 
    dc.card.name.includes('Marnie') ||
    dc.card.name.includes('Judge')
  );
  
  if (hasControlElements && analysis.archetype?.primaryArchetype !== 'control') {
    review.contextualNotes.push(
      'Deck contains control elements but may not be classified as control archetype'
    );
  }
}

/**
 * Check synergy analysis
 */
function checkSynergyAnalysis(
  cards: Array<DeckCard & { card: Card }>,
  analysis: DeckAnalysis,
  review: AnalysisReview
) {
  // Look for obvious synergies that might be missed
  const hasWelder = cards.some(dc => dc.card.name === 'Welder');
  const hasFirePokemon = cards.some(dc => 
    dc.card.types?.includes('Fire')
  );
  
  if (hasWelder && !hasFirePokemon) {
    review.incorrectRecommendations.push(
      'Deck has Welder but no Fire Pokemon to benefit from it'
    );
  }
}

/**
 * Check budget analysis accuracy
 */
function checkBudgetAnalysis(
  cards: Array<DeckCard & { card: Card }>,
  analysis: DeckAnalysis,
  review: AnalysisReview
) {
  // Rough check for obviously expensive cards
  const expensiveCards = cards.filter(dc => 
    dc.card.rarity === 'Secret Rare' || 
    dc.card.rarity === 'Hyper Rare' ||
    (dc.card.name.includes('Gold') && dc.card.subtypes?.includes('Item'))
  );
  
  if (expensiveCards.length > 5 && analysis.budget?.totalCost < 100) {
    review.missedIssues.push(
      'Budget calculation seems too low for deck with multiple secret/hyper rare cards'
    );
  }
}