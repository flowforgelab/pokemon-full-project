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

// Current Standard Format Meta (as of 2024-2025 season)
export const CURRENT_STANDARD_META: MetaContext = {
  format: 'standard',
  lastUpdated: new Date('2024-12-01'),
  formatSpeed: 'fast',
  avgGameLength: 6.5,
  powerCreepIndex: 8, // High power creep with VSTARs and ex Pokemon
  dominantStrategies: [
    'Single Prize attackers with high damage',
    'VSTAR Pokemon with powerful abilities',
    'Energy acceleration strategies',
    'Lost Box toolbox decks',
    'Path to the Peak stadium control'
  ],
  keyTrainers: [
    "Professor's Research",
    "Boss's Orders",
    "Quick Ball",
    "Ultra Ball",
    "Path to the Peak",
    "Lost City",
    "Colress's Experiment",
    "Cross Switcher",
    "Battle VIP Pass",
    "Irida"
  ],
  keyPokemon: [
    "Lugia VSTAR",
    "Lost Box attackers",
    "Giratina VSTAR", 
    "Mew VMAX",
    "Arceus VSTAR",
    "Palkia VSTAR",
    "Charizard ex",
    "Miraidon ex",
    "Gardevoir ex"
  ],
  topDecks: [
    {
      name: "Lugia VSTAR",
      archetype: 'turbo',
      tierRating: 1,
      avgSetupTurn: 2,
      keyCards: ["Lugia VSTAR", "Archeops", "Lumineon V", "Professor's Research"],
      winCondition: "Accelerate energy with Archeops, take OHKOs with Lugia",
      popularity: 15,
      avgPrizesTakenPerTurn: 2,
      weaknesses: ["Path to the Peak", "Lightning weakness"],
      strengths: ["Consistent setup", "High damage output", "Single prize attackers"]
    },
    {
      name: "Lost Box",
      archetype: 'control',
      tierRating: 1,
      avgSetupTurn: 2,
      keyCards: ["Comfey", "Colress's Experiment", "Mirage Gate", "Sableye"],
      winCondition: "Control board with Lost Box toolbox, take efficient KOs",
      popularity: 18,
      avgPrizesTakenPerTurn: 1.5,
      weaknesses: ["Slow starts", "Lost Zone requirements"],
      strengths: ["Versatility", "Comeback potential", "Efficient attackers"]
    },
    {
      name: "Giratina VSTAR", 
      archetype: 'combo',
      tierRating: 1,
      avgSetupTurn: 3,
      keyCards: ["Giratina VSTAR", "Comfey", "Mirage Gate", "Star Requiem"],
      winCondition: "Set up Lost Zone for Star Requiem instant KO",
      popularity: 12,
      avgPrizesTakenPerTurn: 2,
      weaknesses: ["Dark weakness", "Reliance on Lost Zone"],
      strengths: ["OHKO any Pokemon", "Tanky with high HP"]
    },
    {
      name: "Mew VMAX",
      archetype: 'aggro',
      tierRating: 2,
      avgSetupTurn: 2,
      keyCards: ["Mew VMAX", "Genesect V", "Fusion Strike Energy", "Cross Fusion Strike"],
      winCondition: "Copy powerful attacks with Mew, draw through deck with Genesect",
      popularity: 8,
      avgPrizesTakenPerTurn: 2,
      weaknesses: ["Dark weakness", "Path to the Peak"],
      strengths: ["Consistency", "Flexibility", "Draw power"]
    },
    {
      name: "Charizard ex",
      archetype: 'midrange',
      tierRating: 2,
      avgSetupTurn: 3,
      keyCards: ["Charizard ex", "Pidgeot ex", "Rare Candy", "Burning Darkness"],
      winCondition: "Set up Charizard ex for consistent 330 damage attacks",
      popularity: 10,
      avgPrizesTakenPerTurn: 2,
      weaknesses: ["Water weakness", "Stage 2 consistency"],
      strengths: ["High damage", "Prize trade", "Search with Pidgeot"]
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