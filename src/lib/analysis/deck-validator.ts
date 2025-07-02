import { Card, DeckCard } from '@prisma/client';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  category: 'legality' | 'consistency' | 'optimization';
  cardName?: string;
  message: string;
  suggestion?: string;
}

export interface DeckValidation {
  isLegal: boolean;
  totalCards: number;
  issues: ValidationIssue[];
}

/**
 * Validate deck legality according to Pokemon TCG rules
 */
export function validateDeckLegality(
  cards: Array<DeckCard & { card: Card }>
): DeckValidation {
  const issues: ValidationIssue[] = [];
  let totalCards = 0;
  
  // Count cards by name
  const cardCounts = new Map<string, { quantity: number; card: Card }>();
  
  cards.forEach(deckCard => {
    totalCards += deckCard.quantity;
    const existing = cardCounts.get(deckCard.card.name);
    if (existing) {
      existing.quantity += deckCard.quantity;
    } else {
      cardCounts.set(deckCard.card.name, {
        quantity: deckCard.quantity,
        card: deckCard.card
      });
    }
  });
  
  // Check deck size
  if (totalCards !== 60) {
    issues.push({
      severity: 'error',
      category: 'legality',
      message: `Deck has ${totalCards} cards, must have exactly 60`,
      suggestion: totalCards < 60 
        ? `Add ${60 - totalCards} more cards` 
        : `Remove ${totalCards - 60} cards`
    });
  }
  
  // Check for at least one basic Pokemon
  const hasBasicPokemon = cards.some(dc => 
    dc.card.supertype === 'POKEMON' && 
    (!dc.card.evolvesFrom || dc.card.subtypes.includes('Basic'))
  );
  
  if (!hasBasicPokemon) {
    issues.push({
      severity: 'error',
      category: 'legality',
      message: 'Deck must contain at least one Basic Pokemon',
      suggestion: 'Add Basic Pokemon cards to your deck'
    });
  }
  
  // Check card quantity limits
  for (const [cardName, { quantity, card }] of cardCounts) {
    if (isBasicEnergy(card)) {
      // Basic energy has no limit - this is valid
      continue;
    }
    
    // Special rule for Arceus (any Arceus card)
    if (cardName.toLowerCase().includes('arceus')) {
      // Arceus rule: You may have as many cards named Arceus in your deck
      continue;
    }
    
    // Check for 4-card limit
    if (quantity > 4) {
      issues.push({
        severity: 'error',
        category: 'legality',
        cardName,
        message: `${cardName} has ${quantity} copies, maximum allowed is 4`,
        suggestion: `Remove ${quantity - 4} copies of ${cardName}`
      });
    }
  }
  
  // Check for banned cards (simplified - would need actual ban list)
  const bannedCards = [
    'lysandre\'s trump card',
    'forest of giant plants',
    'hex maniac', // Banned in some formats
    'ghetsis', // Banned in some formats
    'wally', // Banned in some formats
  ];
  
  for (const [cardName, _] of cardCounts) {
    if (bannedCards.some(banned => cardName.toLowerCase().includes(banned))) {
      issues.push({
        severity: 'error',
        category: 'legality',
        cardName,
        message: `${cardName} is banned in Standard format`,
        suggestion: `Remove ${cardName} and replace with a legal card`
      });
    }
  }
  
  return {
    isLegal: issues.filter(i => i.severity === 'error').length === 0,
    totalCards,
    issues
  };
}

/**
 * Check if a card is a basic energy
 */
export function isBasicEnergy(card: Card): boolean {
  if (card.supertype !== 'ENERGY') return false;
  
  const name = card.name.toLowerCase();
  
  // List of all basic energy types
  const basicEnergyNames = [
    'grass energy',
    'fire energy',
    'water energy',
    'lightning energy',
    'psychic energy',
    'fighting energy',
    'darkness energy',
    'metal energy',
    'fairy energy',
    'dragon energy',
    // Some sets have "basic" in the name
    'basic grass energy',
    'basic fire energy',
    'basic water energy',
    'basic lightning energy',
    'basic psychic energy',
    'basic fighting energy',
    'basic darkness energy',
    'basic metal energy',
    'basic fairy energy',
    'basic dragon energy'
  ];
  
  // Check if it's a basic energy by name
  if (basicEnergyNames.includes(name)) return true;
  
  // Alternative check: if it has "basic" in subtypes
  if (card.subtypes.some(subtype => subtype.toLowerCase() === 'basic')) return true;
  
  // Alternative check: if name is just "{Type} Energy" with no other text
  const simpleEnergyPattern = /^(grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy|dragon)\s+energy$/i;
  if (simpleEnergyPattern.test(name)) return true;
  
  // If it's an energy card with no special text/abilities, it's likely basic
  // Special energies usually have additional words like "Double", "Twin", "Special", etc.
  const hasSpecialWords = [
    'double', 'twin', 'triple', 'special', 'rainbow', 'aurora', 
    'capture', 'horror', 'shield', 'weakness', 'guard', 'heal',
    'lucky', 'recycle', 'rescue', 'scramble', 'boost', 'delta'
  ].some(word => name.includes(word));
  
  return !hasSpecialWords;
}

/**
 * Score basic energy appropriately
 * Basic energy should get consistent scores since they're fundamental
 */
export function getBasicEnergyScore(card: Card): number {
  if (!isBasicEnergy(card)) {
    throw new Error('Not a basic energy card');
  }
  
  // All basic energy gets the same score - they're all equally necessary
  // Score of 7 reflects that they're essential but not "powerful" cards
  return 7;
}

/**
 * Get validation warnings for deck composition
 */
export function getDeckCompositionWarnings(
  cards: Array<DeckCard & { card: Card }>
): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];
  
  // Count card types
  let pokemonCount = 0;
  let trainerCount = 0;
  let energyCount = 0;
  let basicEnergyCount = 0;
  let specialEnergyCount = 0;
  
  cards.forEach(dc => {
    const quantity = dc.quantity;
    switch (dc.card.supertype) {
      case 'POKEMON':
        pokemonCount += quantity;
        break;
      case 'TRAINER':
        trainerCount += quantity;
        break;
      case 'ENERGY':
        energyCount += quantity;
        if (isBasicEnergy(dc.card)) {
          basicEnergyCount += quantity;
        } else {
          specialEnergyCount += quantity;
        }
        break;
    }
  });
  
  // Check for reasonable ratios
  const totalCards = pokemonCount + trainerCount + energyCount;
  
  if (totalCards === 60) {
    // Pokemon ratio check
    if (pokemonCount < 10) {
      warnings.push({
        severity: 'warning',
        category: 'consistency',
        message: `Very low Pokemon count (${pokemonCount}). Most decks run 12-20 Pokemon`,
        suggestion: 'Consider adding more Pokemon for consistency'
      });
    } else if (pokemonCount > 25) {
      warnings.push({
        severity: 'warning',
        category: 'consistency',
        message: `Very high Pokemon count (${pokemonCount}). Most decks run 12-20 Pokemon`,
        suggestion: 'Consider reducing Pokemon count for more trainers'
      });
    }
    
    // Trainer ratio check
    if (trainerCount < 25) {
      warnings.push({
        severity: 'warning',
        category: 'consistency',
        message: `Low trainer count (${trainerCount}). Most competitive decks run 28-35 trainers`,
        suggestion: 'Add more trainer cards for better consistency'
      });
    }
    
    // Energy ratio check
    if (energyCount < 8 && basicEnergyCount < 6) {
      warnings.push({
        severity: 'warning',
        category: 'consistency',
        message: `Very low energy count (${energyCount}). Most decks need at least 10 energy`,
        suggestion: 'Add more basic energy cards'
      });
    } else if (energyCount > 20) {
      warnings.push({
        severity: 'warning',
        category: 'optimization',
        message: `High energy count (${energyCount}). Most decks run 10-15 energy`,
        suggestion: 'Consider reducing energy count for more trainers'
      });
    }
    
    // Special energy check
    if (specialEnergyCount > 8) {
      warnings.push({
        severity: 'warning',
        category: 'consistency',
        message: `High special energy count (${specialEnergyCount}). Special energy can be less reliable`,
        suggestion: 'Consider replacing some special energy with basic energy'
      });
    }
  }
  
  return warnings;
}