/**
 * Card Recommendation Engine
 * 
 * Provides specific card suggestions with detailed reasoning
 */

import { Card, DeckCard } from '@prisma/client';
import { DeckWarning } from './smart-warnings';
import { getCardQualityScore, categorizeCard } from './card-quality-database';
import { buildSynergyGraph, getSynergyRecommendations } from './synergy-graph';
import { analyzeMetaPosition } from './meta-context';
import { analyzeDeckBudget, makeBudgetAware, getBudgetUpgrades, BudgetAnalysis } from './budget-recommendations';
import { generateSideboardSuggestions, SideboardPlan } from './sideboard-suggestions';

export interface CardRecommendation {
  card: {
    name: string;
    set?: string;
    quantity: number;
    category: string;
  };
  reasoning: string[];
  priority: 'essential' | 'high' | 'medium' | 'low';
  impact: {
    consistency?: number;
    power?: number;
    speed?: number;
    matchups?: string[];
  };
  replaces?: {
    card: string;
    quantity: number;
    reason: string;
  };
  synergiesWith: string[];
  estimatedImprovement: number; // 0-100 score improvement
}

export interface RecommendationSet {
  immediate: CardRecommendation[]; // Add these right away
  shortTerm: CardRecommendation[]; // Add within 1-2 weeks
  longTerm: CardRecommendation[]; // Future upgrades
  cuts: Array<{
    card: string;
    quantity: number;
    reason: string;
    impact: string;
  }>;
  budget?: BudgetAnalysis;
  budgetUpgrades?: CardRecommendation[];
  sideboard?: SideboardPlan;
}

/**
 * Generate specific card recommendations based on deck analysis
 */
export function generateCardRecommendations(
  cards: Array<DeckCard & { card: Card }>,
  warnings: DeckWarning[]
): RecommendationSet {
  const recommendations: CardRecommendation[] = [];
  const cuts: RecommendationSet['cuts'] = [];
  
  // Analyze current deck composition
  const composition = analyzeDeckComposition(cards);
  const synergyGraph = buildSynergyGraph(cards);
  const metaPosition = analyzeMetaPosition(cards);
  
  // Generate recommendations based on warnings
  warnings.forEach(warning => {
    const warningRecs = getRecommendationsForWarning(warning, composition, cards);
    recommendations.push(...warningRecs);
  });
  
  // Add synergy-based recommendations
  const synergyRecs = getSynergyBasedRecommendations(cards, synergyGraph);
  recommendations.push(...synergyRecs);
  
  // Add meta-based recommendations
  const metaRecs = getMetaBasedRecommendations(cards, metaPosition);
  recommendations.push(...metaRecs);
  
  // Identify cards to cut
  const cutsIdentified = identifyCardsToCut(cards, recommendations);
  cuts.push(...cutsIdentified);
  
  // Remove duplicates and prioritize
  const uniqueRecs = deduplicateRecommendations(recommendations);
  
  // Sort into immediate/short/long term
  return {
    immediate: uniqueRecs.filter(r => r.priority === 'essential'),
    shortTerm: uniqueRecs.filter(r => r.priority === 'high'),
    longTerm: uniqueRecs.filter(r => r.priority === 'medium' || r.priority === 'low'),
    cuts
  };
}

/**
 * Generate comprehensive recommendations with budget and sideboard
 */
export function generateComprehensiveRecommendations(
  cards: Array<DeckCard & { card: Card }>,
  warnings: DeckWarning[],
  options?: {
    targetBudget?: number;
    includeSideboard?: boolean;
    maxBudgetUpgrades?: number;
  }
): RecommendationSet {
  // Get base recommendations
  const recommendations = generateCardRecommendations(cards, warnings);
  
  // Add budget analysis
  const budgetAnalysis = analyzeDeckBudget(cards, options?.targetBudget);
  recommendations.budget = budgetAnalysis;
  
  // Add budget-aware versions if requested
  if (options?.targetBudget) {
    const budgetAwareRecs = makeBudgetAware(
      [...recommendations.immediate, ...recommendations.shortTerm],
      options.targetBudget,
      budgetAnalysis.currentDeckPrice
    );
    
    // Update recommendations with budget info
    recommendations.immediate = budgetAwareRecs.filter(r => r.priority === 'essential');
    recommendations.shortTerm = budgetAwareRecs.filter(r => r.priority === 'high');
  }
  
  // Add budget upgrades
  const maxBudget = options?.maxBudgetUpgrades || 20;
  recommendations.budgetUpgrades = getBudgetUpgrades(cards, maxBudget);
  
  // Add sideboard suggestions
  if (options?.includeSideboard) {
    recommendations.sideboard = generateSideboardSuggestions(cards);
  }
  
  return recommendations;
}

/**
 * Analyze deck composition
 */
function analyzeDeckComposition(cards: Array<DeckCard & { card: Card }>) {
  const composition = {
    pokemon: {
      basic: 0,
      stage1: 0,
      stage2: 0,
      v: 0,
      vmax: 0,
      vstar: 0,
      ex: 0,
      gx: 0
    },
    trainers: {
      supporters: 0,
      items: 0,
      stadiums: 0,
      tools: 0
    },
    energy: {
      basic: 0,
      special: 0
    },
    categories: {
      draw: 0,
      search: 0,
      acceleration: 0,
      disruption: 0,
      recovery: 0,
      switching: 0
    }
  };
  
  cards.forEach(dc => {
    const card = dc.card;
    const quantity = dc.quantity;
    
    if (card.supertype === 'POKEMON') {
      if (!card.evolvesFrom) composition.pokemon.basic += quantity;
      if (card.subtypes?.includes('Stage 1')) composition.pokemon.stage1 += quantity;
      if (card.subtypes?.includes('Stage 2')) composition.pokemon.stage2 += quantity;
      if (card.subtypes?.includes('V')) composition.pokemon.v += quantity;
      if (card.subtypes?.includes('VMAX')) composition.pokemon.vmax += quantity;
      if (card.subtypes?.includes('VSTAR')) composition.pokemon.vstar += quantity;
      if (card.subtypes?.includes('EX')) composition.pokemon.ex += quantity;
      if (card.subtypes?.includes('GX')) composition.pokemon.gx += quantity;
    } else if (card.supertype === 'TRAINER') {
      if (card.subtypes?.includes('Supporter')) composition.trainers.supporters += quantity;
      else if (card.subtypes?.includes('Stadium')) composition.trainers.stadiums += quantity;
      else if (card.subtypes?.includes('Tool')) composition.trainers.tools += quantity;
      else composition.trainers.items += quantity;
      
      // Categorize by function
      const category = categorizeCard(card.name);
      if (category === 'draw') composition.categories.draw += quantity;
      else if (category === 'search') composition.categories.search += quantity;
      else if (category === 'acceleration') composition.categories.acceleration += quantity;
      else if (category === 'disruption') composition.categories.disruption += quantity;
      else if (category === 'recovery') composition.categories.recovery += quantity;
      else if (category === 'switching') composition.categories.switching += quantity;
    } else if (card.supertype === 'ENERGY') {
      if (card.subtypes?.includes('Special')) composition.energy.special += quantity;
      else composition.energy.basic += quantity;
    }
  });
  
  return composition;
}

/**
 * Get recommendations for a specific warning
 */
function getRecommendationsForWarning(
  warning: DeckWarning,
  composition: ReturnType<typeof analyzeDeckComposition>,
  cards: Array<DeckCard & { card: Card }>
): CardRecommendation[] {
  const recommendations: CardRecommendation[] = [];
  
  switch (warning.id) {
    case 'consistency-mulligan':
      // Recommend basic Pokemon
      recommendations.push({
        card: { name: "Lumineon V", set: "Brilliant Stars", quantity: 2, category: "pokemon" },
        reasoning: [
          "Provides consistency with Luminous Sign ability",
          "Searches for any Supporter card",
          "Counts as Basic Pokemon to reduce mulligans"
        ],
        priority: 'essential',
        impact: { consistency: 15 },
        synergiesWith: ["Professor's Research", "Marnie"],
        estimatedImprovement: 10
      });
      
      if (!hasCard(cards, "Quick Ball")) {
        recommendations.push({
          card: { name: "Quick Ball", quantity: 4, category: "search" },
          reasoning: [
            "Essential for finding Basic Pokemon",
            "Reduces mulligan chance significantly",
            "Universal in every competitive deck"
          ],
          priority: 'essential',
          impact: { consistency: 20 },
          synergiesWith: ["All Basic Pokemon"],
          estimatedImprovement: 15
        });
      }
      break;
      
    case 'consistency-draw':
      if (composition.categories.draw < 8) {
        recommendations.push({
          card: { name: "Professor's Research", quantity: 4, category: "draw" },
          reasoning: [
            "Best draw power in the game",
            "Draw 7 cards unconditionally",
            "Staple in 95% of competitive decks"
          ],
          priority: 'essential',
          impact: { consistency: 25 },
          synergiesWith: ["Any deck"],
          estimatedImprovement: 20
        });
        
        recommendations.push({
          card: { name: "Marnie", quantity: 3, category: "draw" },
          reasoning: [
            "Shuffle-draw that disrupts opponent",
            "Great for comebacks",
            "Doesn't discard resources"
          ],
          priority: 'high',
          impact: { consistency: 15 },
          synergiesWith: ["Path to the Peak", "Reset Stamp"],
          estimatedImprovement: 10
        });
      }
      break;
      
    case 'power-gust':
      recommendations.push({
        card: { name: "Boss's Orders", quantity: 3, category: "disruption" },
        reasoning: [
          "Target opponent's benched Pokemon",
          "Take easy prizes on support Pokemon",
          "Win condition in many games"
        ],
        priority: 'essential',
        impact: { power: 20, matchups: ["All"] },
        synergiesWith: ["High damage attackers"],
        estimatedImprovement: 15
      });
      
      recommendations.push({
        card: { name: "Cross Switcher", quantity: 2, category: "disruption" },
        reasoning: [
          "Item-based gust effect",
          "Can be used multiple times per turn",
          "Great with Irida or other item search"
        ],
        priority: 'medium',
        impact: { power: 10, speed: 5 },
        synergiesWith: ["Irida", "Trainers' Mail"],
        estimatedImprovement: 8
      });
      break;
      
    case 'speed-acceleration':
      const types = getMainTypes(cards);
      if (types.includes('Lightning')) {
        recommendations.push({
          card: { name: "Elesa's Sparkle", quantity: 3, category: "acceleration" },
          reasoning: [
            "Attach 2 Lightning energy from hand",
            "Accelerates Lightning Pokemon significantly",
            "Key for Lightning-type decks"
          ],
          priority: 'high',
          impact: { speed: 20 },
          synergiesWith: ["All Lightning Pokemon"],
          estimatedImprovement: 15
        });
      } else if (types.includes('Fire')) {
        recommendations.push({
          card: { name: "Magma Basin", quantity: 2, category: "acceleration" },
          reasoning: [
            "Attach Fire energy from discard",
            "Stadium that provides consistent acceleration",
            "Works well with Professor's Research"
          ],
          priority: 'high',
          impact: { speed: 15 },
          synergiesWith: ["Fire Pokemon", "Professor's Research"],
          estimatedImprovement: 12
        });
      }
      
      // Universal acceleration
      recommendations.push({
        card: { name: "Twin Energy", quantity: 2, category: "acceleration" },
        reasoning: [
          "Provides 2 Colorless energy",
          "Perfect for non-V/GX attackers",
          "Immediate acceleration"
        ],
        priority: 'medium',
        impact: { speed: 10 },
        synergiesWith: ["Single-prize attackers"],
        estimatedImprovement: 8
      });
      break;
  }
  
  return recommendations;
}

/**
 * Get synergy-based recommendations
 */
function getSynergyBasedRecommendations(
  cards: Array<DeckCard & { card: Card }>,
  synergyGraph: ReturnType<typeof buildSynergyGraph>
): CardRecommendation[] {
  const recommendations: CardRecommendation[] = [];
  const synergyRecs = getSynergyRecommendations(synergyGraph);
  
  // Convert synergy recommendations to card recommendations
  synergyRecs.slice(0, 3).forEach(rec => {
    // Map generic recommendations to specific cards
    if (rec.includes("draw engine")) {
      if (!hasCard(cards, "Bibarel")) {
        recommendations.push({
          card: { name: "Bibarel", quantity: 2, category: "pokemon" },
          reasoning: [
            "Industrious Incisors draws up to 5 cards",
            "Consistent draw engine",
            "Single-prize support Pokemon"
          ],
          priority: 'medium',
          impact: { consistency: 20 },
          synergiesWith: ["Bidoof", "Level Ball"],
          estimatedImprovement: 12
        });
      }
    } else if (rec.includes("energy search")) {
      recommendations.push({
        card: { name: "Energy Search", quantity: 2, category: "search" },
        reasoning: [
          "Finds any basic energy",
          "Helps hit energy attachments",
          "Deck thinning"
        ],
        priority: 'low',
        impact: { consistency: 5 },
        synergiesWith: ["Basic Energy"],
        estimatedImprovement: 3
      });
    }
  });
  
  return recommendations;
}

/**
 * Get meta-based recommendations
 */
function getMetaBasedRecommendations(
  cards: Array<DeckCard & { card: Card }>,
  metaPosition: ReturnType<typeof analyzeMetaPosition>
): CardRecommendation[] {
  const recommendations: CardRecommendation[] = [];
  
  // Check for bad matchups and recommend counters
  metaPosition.matchupSpread.forEach(matchup => {
    if (matchup.favorability < -20) {
      // Recommend tech cards for bad matchups
      if (matchup.deck.includes("Lost Box")) {
        recommendations.push({
          card: { name: "Klefki", set: "Silver Tempest", quantity: 1, category: "pokemon" },
          reasoning: [
            "Mischievous Lock prevents VSTAR Powers",
            "Disrupts Lost Box's Comfey engine",
            "Low investment tech card"
          ],
          priority: 'medium',
          impact: { matchups: ["Lost Box"] },
          synergiesWith: ["Switching cards"],
          estimatedImprovement: 5
        });
      } else if (matchup.deck.includes("Lugia")) {
        recommendations.push({
          card: { name: "Collapsed Stadium", quantity: 1, category: "stadium" },
          reasoning: [
            "Limits bench to 4 Pokemon",
            "Disrupts Lugia's multi-prize strategy",
            "Forces them to discard benched Pokemon"
          ],
          priority: 'medium',
          impact: { matchups: ["Lugia VSTAR"] },
          synergiesWith: ["Single-prize decks"],
          estimatedImprovement: 5
        });
      }
    }
  });
  
  // Add Path to the Peak if facing ability-heavy meta
  if (metaPosition.metaRating < 50 && !hasCard(cards, "Path to the Peak")) {
    recommendations.push({
      card: { name: "Path to the Peak", quantity: 2, category: "stadium" },
      reasoning: [
        "Shuts down V/VMAX/VSTAR abilities",
        "Levels playing field against powerful decks",
        "Budget-friendly disruption"
      ],
      priority: 'high',
      impact: { matchups: ["All V-based decks"] },
      synergiesWith: ["Single-prize attackers"],
      estimatedImprovement: 10
    });
  }
  
  return recommendations;
}

/**
 * Identify cards to cut
 */
function identifyCardsToCut(
  cards: Array<DeckCard & { card: Card }>,
  recommendations: CardRecommendation[]
): RecommendationSet['cuts'] {
  const cuts: RecommendationSet['cuts'] = [];
  const totalCards = cards.reduce((sum, dc) => sum + dc.quantity, 0);
  const spacesNeeded = recommendations.reduce((sum, rec) => sum + rec.card.quantity, 0);
  
  if (totalCards + spacesNeeded <= 60) {
    return cuts; // No cuts needed
  }
  
  // Sort cards by quality score
  const scoredCards = cards.map(dc => ({
    card: dc.card,
    quantity: dc.quantity,
    score: getCardQualityScore(dc.card.name),
    category: categorizeCard(dc.card.name)
  })).sort((a, b) => a.score - b.score);
  
  let spacesFreed = 0;
  const targetSpaces = totalCards + spacesNeeded - 60;
  
  // First pass: cut low-quality cards
  for (const scored of scoredCards) {
    if (spacesFreed >= targetSpaces) break;
    
    if (scored.score < 5 && scored.category === 'other') {
      const cutQuantity = Math.min(scored.quantity, targetSpaces - spacesFreed);
      cuts.push({
        card: scored.card.name,
        quantity: cutQuantity,
        reason: "Low impact card with better alternatives",
        impact: "Minimal - card provides little value"
      });
      spacesFreed += cutQuantity;
    }
  }
  
  // Second pass: reduce redundant cards
  const categoryCounts: Record<string, number> = {};
  cards.forEach(dc => {
    const category = categorizeCard(dc.card.name);
    categoryCounts[category] = (categoryCounts[category] || 0) + dc.quantity;
  });
  
  if (categoryCounts['recovery'] > 4) {
    const recoveryCards = cards.filter(dc => categorizeCard(dc.card.name) === 'recovery');
    const lowestScored = recoveryCards.sort((a, b) => 
      getCardQualityScore(a.card.name) - getCardQualityScore(b.card.name)
    )[0];
    
    if (lowestScored && spacesFreed < targetSpaces) {
      cuts.push({
        card: lowestScored.card.name,
        quantity: 1,
        reason: "Excessive recovery cards",
        impact: "Other recovery options available"
      });
      spacesFreed += 1;
    }
  }
  
  return cuts;
}

/**
 * Deduplicate recommendations
 */
function deduplicateRecommendations(recommendations: CardRecommendation[]): CardRecommendation[] {
  const seen = new Map<string, CardRecommendation>();
  
  recommendations.forEach(rec => {
    const key = rec.card.name;
    const existing = seen.get(key);
    
    if (!existing || rec.priority === 'essential' && existing.priority !== 'essential') {
      seen.set(key, rec);
    } else if (existing && rec.card.quantity > existing.card.quantity) {
      // Keep the higher quantity recommendation
      existing.card.quantity = rec.card.quantity;
      existing.reasoning = [...new Set([...existing.reasoning, ...rec.reasoning])];
    }
  });
  
  return Array.from(seen.values());
}

/**
 * Check if deck has a specific card
 */
function hasCard(cards: Array<DeckCard & { card: Card }>, cardName: string): boolean {
  return cards.some(dc => dc.card.name.toLowerCase().includes(cardName.toLowerCase()));
}

/**
 * Get main types in deck
 */
function getMainTypes(cards: Array<DeckCard & { card: Card }>): string[] {
  const typeCounts: Record<string, number> = {};
  
  cards.forEach(dc => {
    if (dc.card.supertype === 'POKEMON' && dc.card.types) {
      dc.card.types.forEach(type => {
        typeCounts[type] = (typeCounts[type] || 0) + dc.quantity;
      });
    }
  });
  
  return Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([type]) => type);
}