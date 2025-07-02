/**
 * Card Quality Database
 * 
 * Assigns quality scores to cards based on their competitive strength.
 * Scores range from 1-10, with 10 being the best cards in the format.
 */

import { Card } from '@prisma/client';
import { isBasicEnergy, getBasicEnergyScore } from './deck-validator';

export interface CardQualityEntry {
  name: string;
  score: number;
  category: 'draw' | 'search' | 'energy' | 'disruption' | 'recovery' | 'stadium' | 'tool' | 'special' | 'pokemon';
  notes?: string;
}

// Draw Supporters (how good they are at drawing cards)
export const drawSupporterScores: Record<string, number> = {
  // Top Tier (9-10)
  "professor's research": 10,
  "professor juniper": 10,
  "professor sycamore": 10,
  "professor oak": 10,
  "n": 9,
  "colress": 9,
  "marnie": 9,
  
  // Good Tier (7-8)
  "cynthia": 8,
  "cynthia & caitlin": 8,
  "korrina's focus": 7,
  "hop": 7,
  "bianca": 7,
  
  // Mid Tier (5-6)
  "shauna": 6,
  "tierno": 6,
  "bruno": 6,
  "lillie": 6, // Good turn 1, bad later
  "erika's hospitality": 5, // Conditional
  "hau": 5,
  
  // Low Tier (3-4)
  "tate & liza": 4, // Draw OR switch, not both
  "judge": 4, // Disruption, not pure draw
  "wicke": 3,
  
  // Situational (1-2)
  "kiawe": 2, // Energy acceleration, not draw
  "sonia": 2, // Search, not draw
};

// Search Cards (Pokemon and Trainer search)
export const searchCardScores: Record<string, number> = {
  // Top Tier Items (9-10)
  "quick ball": 10,
  "ultra ball": 10,
  "computer search": 10, // ACE SPEC
  "nest ball": 9,
  "level ball": 9,
  "dive ball": 8, // Water only
  "heavy ball": 8, // Heavy Pokemon only
  
  // Good Tier Items (6-8)
  "pokemon communication": 7,
  "evolution incense": 7,
  "great ball": 6,
  "timer ball": 6, // Flip based
  "repeat ball": 6,
  
  // Supporters (5-7)
  "pokemon fan club": 5, // Uses supporter for turn
  "brigette": 7, // Multiple basics
  "pokemon collector": 7,
  "ball guy": 6,
  
  // Low Tier (3-4)
  "poke ball": 4,
  "friend ball": 4,
  "luxury ball": 4,
};

// Energy Acceleration
export const energyAccelerationScores: Record<string, number> = {
  // Top Tier (9-10)
  "max elixir": 9,
  "dark patch": 9,
  "aqua patch": 9,
  "metal saucer": 9,
  "welder": 10, // Fire support
  "raihan": 8,
  
  // Good Tier (6-8)
  "energy switch": 7,
  "twin energy": 8,
  "triple acceleration energy": 8,
  "double dragon energy": 8,
  "double colorless energy": 7,
  
  // Mid Tier (4-6)
  "energy spinner": 5,
  "energy retrieval": 6,
  "energy recycler": 6,
  "brock's grit": 5,
  "fisherman": 5,
  
  // Low Tier (1-3)
  "energy search": 3,
  "professor's letter": 4,
};

// Disruption Cards
export const disruptionScores: Record<string, number> = {
  // Top Tier (8-10)
  "boss's orders": 10,
  "guzma": 10,
  "lysandre": 10,
  "reset stamp": 9,
  "marnie": 8, // Also draw
  
  // Good Tier (6-7)
  "judge": 7,
  "team flare grunt": 7,
  "enhanced hammer": 7,
  "crushing hammer": 6, // Flip
  "team skull grunt": 6,
  
  // Mid Tier (4-5)
  "team rocket's handiwork": 5,
  "plumeria": 5,
  "parallel city": 5, // Stadium
  
  // Low Tier (1-3)
  "trick shovel": 3,
  "bellelba & brycen-man": 3,
};

// Stadium Cards
export const stadiumScores: Record<string, number> = {
  // Top Tier (8-10)
  "thunder mountain ◇": 9, // Prism Star
  "giant hearth": 8,
  "dimension valley": 8,
  "silent lab": 8,
  
  // Good Tier (6-7)
  "brooklet hill": 7,
  "rough seas": 7,
  "virbank city gym": 7,
  "sky field": 7,
  
  // Mid Tier (4-5)
  "parallel city": 5,
  "altar of the moone": 5,
  "altar of the sunne": 5,
  
  // Low Tier (1-3)
  "scorched earth": 3,
  "mountain ring": 3,
};

// Utility Trainers
export const utilityTrainerScores: Record<string, number> = {
  // Top Tier (8-10)
  "vs seeker": 10,
  "trainer's mail": 9,
  "acro bike": 8,
  "battle compressor": 9,
  "rare candy": 9,
  
  // Good Tier (6-7)
  "switch": 7,
  "escape rope": 7,
  "field blower": 7,
  "tool scrapper": 6,
  "rescue stretcher": 7,
  
  // Mid Tier (4-5)
  "ordinary rod": 5,
  "super rod": 5,
  "town map": 4,
  "pal pad": 5,
  
  // Low Tier (1-3)
  "potion": 2,
  "pokemon center lady": 3,
};

// Tool Cards
export const toolScores: Record<string, number> = {
  // Top Tier (8-10)
  "float stone": 9,
  "muscle band": 8,
  "choice band": 9,
  "air balloon": 8,
  
  // Good Tier (6-7)
  "weakness policy": 7,
  "vitality band": 6,
  "big charm": 7,
  "cape of toughness": 7,
  
  // Mid Tier (4-5)
  "lucky helmet": 5,
  "exp. share": 5,
  "leftovers": 4,
  
  // Low Tier (1-3)
  "healing scarf": 3,
  "rocky helmet": 3,
};

// Special Energy
export const specialEnergyScores: Record<string, number> = {
  // Top Tier (8-10)
  "double colorless energy": 8,
  "twin energy": 9,
  "triple acceleration energy": 8,
  "double dragon energy": 9,
  "beast energy ◇": 9, // Prism Star
  
  // Good Tier (6-7)
  "aurora energy": 7,
  "rainbow energy": 7,
  "capture energy": 7,
  "horror psychic energy": 7,
  
  // Mid Tier (4-5)
  "weakness guard energy": 5,
  "shield energy": 5,
  "recycle energy": 5,
  
  // Low Tier (1-3)
  "heal energy": 3,
  "lucky energy": 3,
};

/**
 * Get the quality score for a card
 * Can be called with either a card name or a full Card object
 */
export function getCardQualityScore(cardNameOrCard: string | Card): number {
  // Handle Card object
  if (typeof cardNameOrCard === 'object' && 'name' in cardNameOrCard) {
    const card = cardNameOrCard as Card;
    
    // Special handling for basic energy
    if (card.supertype === 'ENERGY' && isBasicEnergy(card)) {
      return getBasicEnergyScore(card);
    }
    
    // Continue with normal scoring using the card name
    return getCardQualityScore(card.name);
  }
  
  // Handle string (card name)
  const name = cardNameOrCard.toLowerCase();
  
  // Check all databases
  const databases = [
    drawSupporterScores,
    searchCardScores,
    energyAccelerationScores,
    disruptionScores,
    stadiumScores,
    utilityTrainerScores,
    toolScores,
    specialEnergyScores
  ];
  
  for (const db of databases) {
    // Try exact match first
    if (db[name] !== undefined) {
      return db[name];
    }
    
    // Try partial match
    for (const [key, score] of Object.entries(db)) {
      if (name.includes(key) || key.includes(name)) {
        return score;
      }
    }
  }
  
  // Default scores based on card type patterns
  if (name.includes('professor')) return 7; // Most professors are decent
  if (name.includes('ball')) return 6; // Most ball cards are decent
  if (name.includes('potion')) return 2; // Healing items are weak
  
  // Note: We don't give a default score for "energy" here anymore
  // because basic energy should be handled by the Card object path
  
  return 5; // Default middle score
}

/**
 * Categorize a card based on its name and type
 */
export function categorizeCard(cardName: string, supertype: string): string {
  const name = cardName.toLowerCase();
  
  if (supertype === 'POKEMON') return 'pokemon';
  if (supertype === 'ENERGY') {
    if (name.includes('basic')) return 'basic-energy';
    return 'special-energy';
  }
  
  // Trainer categorization
  if (name.includes('ball') || name.includes('communication')) return 'search';
  if (name.includes('energy') && !name.includes('guard')) return 'energy-acceleration';
  if (name.includes('boss') || name.includes('guzma') || name.includes('lysandre')) return 'disruption';
  if (name.includes('stadium') || stadiumScores[name]) return 'stadium';
  if (toolScores[name]) return 'tool';
  
  // Check if it's a draw supporter
  if (drawSupporterScores[name]) return 'draw';
  
  // Check for specific patterns
  if (name.includes('professor') || name.includes('cynthia') || name.includes('marnie')) return 'draw';
  if (name.includes('hammer') || name.includes('stamp')) return 'disruption';
  if (name.includes('rope') || name.includes('switch')) return 'utility';
  
  return 'utility'; // Default for trainers
}

/**
 * Get a recommendation for improving a card slot
 */
export function getUpgradeRecommendation(currentCard: string, category: string): string | null {
  const currentScore = getCardQualityScore(currentCard);
  
  // Find better alternatives in the same category
  const alternatives: Array<[string, number]> = [];
  
  switch (category) {
    case 'draw':
      Object.entries(drawSupporterScores).forEach(([card, score]) => {
        if (score > currentScore) alternatives.push([card, score]);
      });
      break;
    case 'search':
      Object.entries(searchCardScores).forEach(([card, score]) => {
        if (score > currentScore) alternatives.push([card, score]);
      });
      break;
    case 'energy-acceleration':
      Object.entries(energyAccelerationScores).forEach(([card, score]) => {
        if (score > currentScore) alternatives.push([card, score]);
      });
      break;
    // ... etc
  }
  
  if (alternatives.length === 0) return null;
  
  // Sort by score and return the best alternative
  alternatives.sort((a, b) => b[1] - a[1]);
  return alternatives[0][0];
}

/**
 * Analyze the overall quality of trainers in a deck
 */
export function analyzeTrainerQuality(trainers: Array<{ name: string; quantity: number }>): {
  averageScore: number;
  weakCards: string[];
  strongCards: string[];
  recommendations: string[];
} {
  let totalScore = 0;
  let totalCards = 0;
  const weakCards: string[] = [];
  const strongCards: string[] = [];
  const recommendations: string[] = [];
  
  trainers.forEach(({ name, quantity }) => {
    const score = getCardQualityScore(name);
    totalScore += score * quantity;
    totalCards += quantity;
    
    if (score <= 4) {
      weakCards.push(name);
      const category = categorizeCard(name, 'TRAINER');
      const upgrade = getUpgradeRecommendation(name, category);
      if (upgrade) {
        recommendations.push(`Replace ${name} with ${upgrade}`);
      }
    } else if (score >= 8) {
      strongCards.push(name);
    }
  });
  
  return {
    averageScore: totalCards > 0 ? totalScore / totalCards : 0,
    weakCards,
    strongCards,
    recommendations: recommendations.slice(0, 5) // Top 5 recommendations
  };
}