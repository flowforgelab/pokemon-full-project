/**
 * Meta Game Context System
 * 
 * Provides understanding of the current competitive Pokemon TCG environment
 * including format speed, top decks, and power creep analysis
 */

import { Card, DeckCard } from '@prisma/client';

export interface MetaDeck {
  name: string;
  archetype: 'aggro' | 'control' | 'combo' | 'midrange' | 'turbo';
  tierRating: 1 | 2 | 3 | 4; // 1 = Tier 1 (best), 4 = Rogue
  avgSetupTurn: number; // Average turn to set up win condition
  keyCards: string[]; // Main cards that define the deck
  winCondition: string;
  popularity: number; // % of tournament field
  avgPrizesTakenPerTurn: number;
  weaknesses: string[]; // What this deck struggles against
  strengths: string[]; // What this deck beats
}

export interface MetaContext {
  format: 'standard' | 'expanded' | 'unlimited';
  lastUpdated: Date;
  formatSpeed: 'fast' | 'medium' | 'slow'; // How quickly games end
  avgGameLength: number; // In turns
  topDecks: MetaDeck[];
  powerCreepIndex: number; // 1-10, how much power has increased
  dominantStrategies: string[];
  keyTrainers: string[]; // Most played trainer cards
  keyPokemon: string[]; // Most played Pokemon
}

// Current Standard Format Meta (as of H-on Regulation Mark, 2024-2025)
export const CURRENT_STANDARD_META: MetaContext = {
  format: 'standard',
  lastUpdated: new Date('2025-01-02'),
  formatSpeed: 'medium', // Slower than previous with more setup decks
  avgGameLength: 7.5,
  powerCreepIndex: 9, // ex Pokemon with 280-330 HP dominate
  dominantStrategies: [
    'ex Pokemon with high HP and damage',
    'Energy acceleration engines',
    'Lost Zone engines for consistency',
    'Hand disruption with Iono',
    'Stadium wars with multiple options'
  ],
  keyTrainers: [
    "Professor's Research",
    "Iono",
    "Boss's Orders",
    "Arven",
    "Ultra Ball",
    "Nest Ball",
    "Super Rod",
    "Lost Vacuum",
    "Switch Cart",
    "Temple of Sinnoh",
    "Lost City",
    "Collapsed Stadium"
  ],
  keyPokemon: [
    "Charizard ex",
    "Gardevoir ex",
    "Lugia VSTAR",
    "Lost Box (Sableye, Comfey, Cramorant)",
    "Miraidon ex",
    "Chien-Pao ex",
    "Giratina VSTAR",
    "Roaring Moon ex",
    "Iron Hands ex"
  ],
  topDecks: [
    {
      name: "Charizard ex",
      archetype: 'midrange',
      tierRating: 1,
      avgSetupTurn: 3,
      keyCards: ["Charizard ex", "Pidgeot ex", "Rare Candy", "Arven"],
      winCondition: "Set up multiple Charizard ex for consistent 330 damage",
      popularity: 20,
      avgPrizesTakenPerTurn: 2,
      weaknesses: ["Water weakness", "Setup disruption", "Iono to 2"],
      strengths: ["Highest damage output", "Prize trade", "Pidgeot consistency"]
    },
    {
      name: "Gardevoir ex",
      archetype: 'control',
      tierRating: 1,
      avgSetupTurn: 3,
      keyCards: ["Gardevoir ex", "Kirlia", "Refinement", "Psychic Embrace"],
      winCondition: "Accelerate energy with ability, sweep with high damage",
      popularity: 15,
      avgPrizesTakenPerTurn: 2,
      weaknesses: ["Metal weakness", "Ability lock", "Slow setup"],
      strengths: ["Energy acceleration", "Consistency", "Recovery options"]
    },
    {
      name: "Lost Box",
      archetype: 'control',
      tierRating: 1,
      avgSetupTurn: 2,
      keyCards: ["Comfey", "Sableye", "Cramorant", "Mirage Gate"],
      winCondition: "Control board with toolbox attackers, efficient KOs",
      popularity: 18,
      avgPrizesTakenPerTurn: 1.5,
      weaknesses: ["Iron Hands ex", "Spiritomb", "Slow Lost Zone"],
      strengths: ["Versatility", "Prize denial", "Comeback potential"]
    },
    {
      name: "Lugia VSTAR",
      archetype: 'turbo',
      tierRating: 2,
      avgSetupTurn: 2,
      keyCards: ["Lugia VSTAR", "Archeops", "Lost Vacuum", "Professor's Research"],
      winCondition: "Accelerate with Archeops, OHKO with Lugia",
      popularity: 12,
      avgPrizesTakenPerTurn: 2,
      weaknesses: ["Lightning weakness", "Collapsed Stadium", "Temple of Sinnoh"],
      strengths: ["Explosive turns", "Colorless typing", "High damage"]
    },
    {
      name: "Miraidon ex",
      archetype: 'aggro',
      tierRating: 2,
      avgSetupTurn: 1,
      keyCards: ["Miraidon ex", "Flaaffy", "Electric Generator", "Raikou V"],
      winCondition: "Turbo setup with Tandem Unit, sweep with attackers",
      popularity: 10,
      avgPrizesTakenPerTurn: 2,
      weaknesses: ["Fighting weakness", "Spiritomb", "Path disruption"],
      strengths: ["Fastest setup", "Energy acceleration", "Bench filling"]
    },
    {
      name: "Chien-Pao ex",
      archetype: 'aggro',
      tierRating: 2,
      avgSetupTurn: 2,
      keyCards: ["Chien-Pao ex", "Baxcalibur", "Irida", "Superior Energy Retrieval"],
      winCondition: "Accelerate with Baxcalibur, OHKO everything",
      popularity: 8,
      avgPrizesTakenPerTurn: 2,
      weaknesses: ["Metal weakness", "Ability lock", "Prize race"],
      strengths: ["Unlimited damage", "Energy acceleration", "Irida consistency"]
    },
    {
      name: "Giratina VSTAR", 
      archetype: 'combo',
      tierRating: 3,
      avgSetupTurn: 3,
      keyCards: ["Giratina VSTAR", "Comfey", "Colress's Experiment", "Star Requiem"],
      winCondition: "Set up 10 Lost Zone for Star Requiem KO",
      popularity: 5,
      avgPrizesTakenPerTurn: 2,
      weaknesses: ["Darkness weakness", "Lost Vacuum", "Speed"],
      strengths: ["OHKO any Pokemon", "280 HP bulk", "Lost Impact damage"]
    },
    {
      name: "Roaring Moon ex",
      archetype: 'midrange',
      tierRating: 3,
      avgSetupTurn: 2,
      keyCards: ["Roaring Moon ex", "Dark Patch", "Professor Sada's Vitality", "Frenzied Gouging"],
      winCondition: "Set up Roaring Moon, take OHKOs with Calamity Storm",
      popularity: 6,
      avgPrizesTakenPerTurn: 2,
      weaknesses: ["Grass weakness", "Special Energy reliance", "Setup"],
      strengths: ["High damage", "Dark Patch acceleration", "Bulk"]
    }
  ]
};

/**
 * Analyze how a deck matches up against the current meta
 */
export function analyzeMetaPosition(
  cards: Array<DeckCard & { card: Card }>,
  metaContext: MetaContext = CURRENT_STANDARD_META
): {
  metaRating: number; // 0-100
  speedRating: 'too slow' | 'competitive' | 'fast';
  matchupSpread: Array<{ deck: string; favorability: number }>; // -100 to +100
  recommendations: string[];
} {
  // Count key meta cards in the deck
  const cardNames = cards.map(dc => dc.card.name.toLowerCase());
  const hasMetaTrainers = metaContext.keyTrainers.filter(trainer => 
    cardNames.some(name => name.includes(trainer.toLowerCase()))
  ).length;
  
  const hasMetaPokemon = metaContext.keyPokemon.filter(pokemon => 
    cardNames.some(name => name.includes(pokemon.toLowerCase()))
  ).length;
  
  // Base meta rating on presence of key cards
  let metaRating = 50; // Start at average
  metaRating += hasMetaTrainers * 5; // Each meta trainer adds 5 points
  metaRating += hasMetaPokemon * 8; // Each meta Pokemon adds 8 points
  
  // Estimate deck speed
  const hasEnergyAccel = cardNames.some(name => 
    name.includes('elesa') || name.includes('dark patch') || 
    name.includes('mirage gate') || name.includes('archeops')
  );
  
  const avgPokemonCost = calculateAverageAttackCost(cards);
  let speedRating: 'too slow' | 'competitive' | 'fast' = 'competitive';
  
  if (avgPokemonCost > 2.5 && !hasEnergyAccel) {
    speedRating = 'too slow';
    metaRating -= 20;
  } else if (avgPokemonCost < 2 || hasEnergyAccel) {
    speedRating = 'fast';
    metaRating += 10;
  }
  
  // Calculate matchup spread
  const matchupSpread = metaContext.topDecks.map(metaDeck => {
    let favorability = 0; // Even matchup
    
    // Check for type advantages/disadvantages
    const hasLightning = cards.some(dc => 
      dc.card.supertype === 'POKEMON' && 
      dc.card.types?.includes('Lightning')
    );
    
    const hasDarkness = cards.some(dc => 
      dc.card.supertype === 'POKEMON' && 
      dc.card.types?.includes('Darkness')
    );
    
    // Specific matchup logic
    if (metaDeck.name === 'Lugia VSTAR' && hasLightning) {
      favorability += 30; // Type advantage
    }
    if (metaDeck.name === 'Mew VMAX' && hasDarkness) {
      favorability += 40; // Type advantage
    }
    
    // Check for counter cards
    const hasPathToPeak = cardNames.some(name => name.includes('path to the peak'));
    if (hasPathToPeak && ['Lugia VSTAR', 'Mew VMAX'].includes(metaDeck.name)) {
      favorability += 20; // Good stadium counter
    }
    
    return {
      deck: metaDeck.name,
      favorability
    };
  });
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (speedRating === 'too slow') {
    recommendations.push('Deck is too slow for current meta - add energy acceleration');
  }
  
  if (hasMetaTrainers < 3) {
    recommendations.push("Add more meta trainers like Boss's Orders or Cross Switcher");
  }
  
  const hasPathToPeak = cardNames.some(name => name.includes('path to the peak'));
  if (!hasPathToPeak && metaRating < 70) {
    recommendations.push('Consider adding Path to the Peak to counter V Pokemon abilities');
  }
  
  const hasGustEffect = cardNames.some(name => 
    name.includes("boss's orders") || name.includes('cross switcher')
  );
  if (!hasGustEffect) {
    recommendations.push("Add gust effects (Boss's Orders) to target opponent's bench");
  }
  
  return {
    metaRating: Math.min(100, Math.max(0, metaRating)),
    speedRating,
    matchupSpread,
    recommendations
  };
}

/**
 * Calculate average energy cost of attacks
 */
function calculateAverageAttackCost(cards: Array<DeckCard & { card: Card }>): number {
  const attackers = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' && 
    dc.card.attacks && 
    dc.card.attacks.length > 0
  );
  
  if (attackers.length === 0) return 2.5; // Default
  
  let totalCost = 0;
  let attackCount = 0;
  
  attackers.forEach(dc => {
    dc.card.attacks?.forEach(attack => {
      // Count energy symbols in cost array
      const cost = attack.cost?.length || 0;
      totalCost += cost * dc.quantity;
      attackCount += dc.quantity;
    });
  });
  
  return attackCount > 0 ? totalCost / attackCount : 2.5;
}

/**
 * Get power creep analysis for a card
 */
export function analyzePowerCreep(card: Card): {
  powerLevel: number; // 1-10
  era: 'vintage' | 'classic' | 'modern' | 'current';
  comparison: string;
} {
  const year = new Date(card.releaseDate).getFullYear();
  const hp = card.hp || 0;
  const attacks = card.attacks || [];
  
  // Determine era
  let era: 'vintage' | 'classic' | 'modern' | 'current';
  if (year < 2010) era = 'vintage';
  else if (year < 2017) era = 'classic';
  else if (year < 2022) era = 'modern';
  else era = 'current';
  
  // Calculate power level based on era expectations
  let powerLevel = 5; // Start average
  
  // HP comparison
  if (card.supertype === 'POKEMON') {
    // Basic Pokemon HP expectations by era
    const expectedHP = {
      vintage: { basic: 50, stage1: 80, stage2: 120 },
      classic: { basic: 60, stage1: 90, stage2: 140 },
      modern: { basic: 70, stage1: 120, stage2: 170 },
      current: { basic: 80, stage1: 140, stage2: 200 }
    };
    
    const stage = card.subtypes.includes('Stage 2') ? 'stage2' : 
                  card.subtypes.includes('Stage 1') ? 'stage1' : 'basic';
    
    const expected = expectedHP[era][stage];
    if (hp > expected * 1.2) powerLevel += 2;
    else if (hp > expected) powerLevel += 1;
    else if (hp < expected * 0.8) powerLevel -= 2;
  }
  
  // Attack damage comparison
  if (attacks.length > 0) {
    const maxDamage = Math.max(...attacks.map(a => parseInt(a.damage) || 0));
    const avgCost = attacks.reduce((sum, a) => sum + (a.cost?.length || 0), 0) / attacks.length;
    const damagePerEnergy = maxDamage / Math.max(1, avgCost);
    
    // Modern cards do 50+ damage per energy
    if (damagePerEnergy > 60) powerLevel += 2;
    else if (damagePerEnergy > 40) powerLevel += 1;
    else if (damagePerEnergy < 20) powerLevel -= 2;
  }
  
  // V/VMAX/VSTAR bonus
  if (card.subtypes.some(st => ['V', 'VMAX', 'VSTAR', 'ex'].includes(st))) {
    powerLevel += 2;
  }
  
  powerLevel = Math.min(10, Math.max(1, powerLevel));
  
  const comparison = powerLevel >= 8 ? 'Significantly above curve for its era' :
                     powerLevel >= 6 ? 'Competitive for its era' :
                     powerLevel >= 4 ? 'Average for its era' :
                     'Below curve for its era';
  
  return { powerLevel, era, comparison };
}