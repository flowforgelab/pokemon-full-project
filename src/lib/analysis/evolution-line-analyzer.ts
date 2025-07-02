import { Card, DeckCard } from '@prisma/client';
import { calculateEvolutionLineConsistency } from './probability-calculator';

export interface EvolutionLine {
  name: string; // e.g., "Magnemite"
  basic: { card: Card; quantity: number } | null;
  stage1: { card: Card; quantity: number } | null;
  stage2: { card: Card; quantity: number } | null;
  structure: string; // e.g., "3-2-3"
  isValid: boolean;
  bottleneck: 'basic' | 'stage1' | 'stage2' | 'none';
  issues: string[];
  recommendations: string[];
  consistency: {
    turnTwoStage1: number;
    turnThreeStage2: number;
  };
}

export interface EvolutionLineAnalysis {
  lines: EvolutionLine[];
  totalIssues: number;
  recommendations: string[];
  overallScore: number;
}

/**
 * Analyze all evolution lines in a deck
 */
export function analyzeEvolutionLines(
  cards: Array<DeckCard & { card: Card }>
): EvolutionLineAnalysis {
  const evolutionLines = buildEvolutionLines(cards);
  const lines: EvolutionLine[] = [];
  let totalIssues = 0;
  const allRecommendations: string[] = [];
  
  for (const [lineName, lineCards] of evolutionLines) {
    const analysis = analyzeEvolutionLine(lineName, lineCards);
    lines.push(analysis);
    totalIssues += analysis.issues.length;
    allRecommendations.push(...analysis.recommendations);
  }
  
  // Calculate overall score (100 = perfect, 0 = terrible)
  const avgConsistency = lines.length > 0
    ? lines.reduce((sum, line) => {
        if (line.stage2) return sum + line.consistency.turnThreeStage2;
        if (line.stage1) return sum + line.consistency.turnTwoStage1;
        return sum + 1; // Basic only = perfect consistency
      }, 0) / lines.length
    : 1;
  
  const overallScore = Math.round(avgConsistency * 100);
  
  return {
    lines,
    totalIssues,
    recommendations: [...new Set(allRecommendations)], // Remove duplicates
    overallScore
  };
}

/**
 * Build evolution lines from deck cards
 */
function buildEvolutionLines(
  cards: Array<DeckCard & { card: Card }>
): Map<string, Array<DeckCard & { card: Card }>> {
  const lines = new Map<string, Array<DeckCard & { card: Card }>>();
  
  // First, find all Pokemon cards
  const pokemonCards = cards.filter(dc => dc.card.supertype === 'POKEMON');
  
  // Group cards by evolution line
  pokemonCards.forEach(deckCard => {
    const card = deckCard.card;
    let lineName = getEvolutionLineName(card, pokemonCards);
    
    if (!lines.has(lineName)) {
      lines.set(lineName, []);
    }
    lines.get(lineName)!.push(deckCard);
  });
  
  return lines;
}

/**
 * Get the base name of an evolution line
 */
function getEvolutionLineName(
  card: Card,
  allCards: Array<DeckCard & { card: Card }>
): string {
  // If it's a basic, use its name
  if (!card.evolvesFrom) {
    return card.name;
  }
  
  // Otherwise, find the basic it evolves from
  let currentCard = card;
  let depth = 0; // Prevent infinite loops
  
  while (currentCard.evolvesFrom && depth < 3) {
    const prevCard = allCards.find(dc => 
      dc.card.name === currentCard.evolvesFrom
    );
    
    if (!prevCard) {
      // If we can't find the previous evolution, use the earliest we know
      return currentCard.evolvesFrom;
    }
    
    currentCard = prevCard.card;
    depth++;
  }
  
  return currentCard.name;
}

/**
 * Analyze a single evolution line
 */
function analyzeEvolutionLine(
  lineName: string,
  lineCards: Array<DeckCard & { card: Card }>
): EvolutionLine {
  // Sort cards by evolution stage using subtypes
  const basic = lineCards.find(dc => 
    !dc.card.evolvesFrom || dc.card.subtypes.includes('Basic')
  );
  const stage1 = lineCards.find(dc => 
    dc.card.subtypes.includes('Stage 1')
  );
  const stage2 = lineCards.find(dc => 
    dc.card.subtypes.includes('Stage 2')
  );
  
  // Build structure string (e.g., "3-2-3")
  const structure = [
    basic?.quantity || 0,
    stage1?.quantity || 0,
    stage2?.quantity || 0
  ].filter((q, i) => i === 0 || q > 0).join('-');
  
  // Analyze the line
  const issues: string[] = [];
  const recommendations: string[] = [];
  let bottleneck: 'basic' | 'stage1' | 'stage2' | 'none' = 'none';
  
  // Check for common issues
  if (basic && stage1) {
    if (basic.quantity < stage1.quantity) {
      issues.push(`Not enough ${basic.card.name} for ${stage1.card.name}`);
      recommendations.push(`Increase ${basic.card.name} to at least ${stage1.quantity}`);
      bottleneck = 'basic';
    }
  }
  
  if (stage1 && stage2) {
    if (stage1.quantity < stage2.quantity) {
      issues.push(`Evolution bottleneck: only ${stage1.quantity} ${stage1.card.name} for ${stage2.quantity} ${stage2.card.name}`);
      recommendations.push(`Balance the line: use ${stage2.quantity}-${stage2.quantity}-${stage2.quantity} or ${stage2.quantity + 1}-${stage2.quantity}-${stage2.quantity}`);
      bottleneck = 'stage1';
    }
  }
  
  // Check for optimal patterns
  if (basic && stage1 && stage2) {
    const b = basic.quantity;
    const s1 = stage1.quantity;
    const s2 = stage2.quantity;
    
    // Common good patterns: 4-3-3, 3-2-2, 4-2-3 (with Rare Candy)
    const isGoodPattern = 
      (b === 4 && s1 === 3 && s2 === 3) ||
      (b === 3 && s1 === 2 && s2 === 2) ||
      (b === 4 && s1 === 2 && s2 === 3) ||
      (b === s2 + 1 && s1 === s2);
    
    if (!isGoodPattern && issues.length === 0) {
      issues.push(`Evolution line ${structure} could be more consistent`);
      if (s2 >= 3) {
        recommendations.push(`Consider 4-3-3 for maximum consistency`);
      } else {
        recommendations.push(`Consider ${s2 + 1}-${s2}-${s2} for better consistency`);
      }
    }
  }
  
  // Calculate consistency probabilities
  const consistency = calculateEvolutionLineConsistency(
    basic?.quantity || 0,
    stage1?.quantity || 0,
    stage2?.quantity || 0
  );
  
  // Add probability-based recommendations
  if (stage1 && consistency.turnTwoStage1 < 0.60) {
    issues.push(`Low Turn 2 ${stage1.card.name} probability: ${(consistency.turnTwoStage1 * 100).toFixed(1)}%`);
  }
  
  if (stage2 && consistency.turnThreeStage2 < 0.50) {
    issues.push(`Low Turn 3 ${stage2.card.name} probability: ${(consistency.turnThreeStage2 * 100).toFixed(1)}%`);
  }
  
  return {
    name: lineName,
    basic: basic ? { card: basic.card, quantity: basic.quantity } : null,
    stage1: stage1 ? { card: stage1.card, quantity: stage1.quantity } : null,
    stage2: stage2 ? { card: stage2.card, quantity: stage2.quantity } : null,
    structure,
    isValid: issues.length === 0,
    bottleneck: consistency.bottleneck,
    issues,
    recommendations,
    consistency: {
      turnTwoStage1: consistency.turnTwoStage1,
      turnThreeStage2: consistency.turnThreeStage2
    }
  };
}

/**
 * Get a summary of evolution line issues for warnings
 */
export function getEvolutionLineWarnings(
  analysis: EvolutionLineAnalysis
): Array<{ severity: 'error' | 'warning' | 'info'; message: string; suggestion: string }> {
  const warnings: Array<{ severity: 'error' | 'warning' | 'info'; message: string; suggestion: string }> = [];
  
  // Check each line for issues
  analysis.lines.forEach(line => {
    if (line.bottleneck !== 'none') {
      warnings.push({
        severity: 'warning',
        message: `${line.name} evolution line has a ${line.bottleneck} bottleneck (${line.structure})`,
        suggestion: line.recommendations[0] || 'Balance the evolution line counts'
      });
    }
    
    // Check for very low consistency
    if (line.stage2 && line.consistency.turnThreeStage2 < 0.40) {
      warnings.push({
        severity: 'warning',
        message: `${line.name} line has poor Stage 2 consistency (${(line.consistency.turnThreeStage2 * 100).toFixed(0)}% by turn 3)`,
        suggestion: 'Increase counts or add more search/draw cards'
      });
    }
  });
  
  return warnings;
}

/**
 * Check if the deck has Rare Candy (affects evolution recommendations)
 */
export function hasRareCandy(cards: Array<DeckCard & { card: Card }>): boolean {
  return cards.some(dc => 
    dc.card.name.toLowerCase().includes('rare candy') && dc.quantity > 0
  );
}