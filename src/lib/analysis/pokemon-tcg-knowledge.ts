/**
 * Pokemon TCG Knowledge Base
 * Core game understanding and constants for accurate analysis
 */

// Energy Types in Pokemon TCG
export const ENERGY_TYPES = {
  GRASS: 'Grass',
  FIRE: 'Fire', 
  WATER: 'Water',
  LIGHTNING: 'Lightning',
  PSYCHIC: 'Psychic',
  FIGHTING: 'Fighting',
  DARKNESS: 'Darkness',
  METAL: 'Metal',
  FAIRY: 'Fairy', // Rotated out but still in Expanded
  DRAGON: 'Dragon',
  COLORLESS: 'Colorless'
} as const;

// Type Effectiveness (Weakness/Resistance)
export const TYPE_EFFECTIVENESS = {
  [ENERGY_TYPES.FIRE]: {
    weakTo: [ENERGY_TYPES.WATER],
    resists: []
  },
  [ENERGY_TYPES.WATER]: {
    weakTo: [ENERGY_TYPES.LIGHTNING, ENERGY_TYPES.GRASS],
    resists: []
  },
  [ENERGY_TYPES.GRASS]: {
    weakTo: [ENERGY_TYPES.FIRE],
    resists: []
  },
  [ENERGY_TYPES.LIGHTNING]: {
    weakTo: [ENERGY_TYPES.FIGHTING],
    resists: []
  },
  [ENERGY_TYPES.PSYCHIC]: {
    weakTo: [ENERGY_TYPES.DARKNESS, ENERGY_TYPES.PSYCHIC],
    resists: []
  },
  [ENERGY_TYPES.FIGHTING]: {
    weakTo: [ENERGY_TYPES.PSYCHIC, ENERGY_TYPES.GRASS],
    resists: []
  },
  [ENERGY_TYPES.DARKNESS]: {
    weakTo: [ENERGY_TYPES.FIGHTING, ENERGY_TYPES.GRASS],
    resists: []
  },
  [ENERGY_TYPES.METAL]: {
    weakTo: [ENERGY_TYPES.FIRE],
    resists: []
  },
  [ENERGY_TYPES.DRAGON]: {
    weakTo: [], // No weakness typically
    resists: []
  },
  [ENERGY_TYPES.COLORLESS]: {
    weakTo: [ENERGY_TYPES.FIGHTING],
    resists: []
  }
};

// Current Meta Archetypes (2024-2025 Standard Format)
export const META_ARCHETYPES = {
  // Tier 1 Decks
  CHARIZARD_EX: {
    name: 'Charizard ex',
    tier: 1,
    keyCards: ['Charizard ex', 'Pidgeot ex', 'Rotom V', 'Radiant Charizard'],
    strategy: 'Ramp energy with Charizard ex ability, sweep with Burning Darkness',
    avgSetupTurn: 2,
    weaknesses: ['Water types', 'Lost City'],
    strengths: ['Consistent', 'High damage', 'Energy acceleration']
  },
  LOST_BOX: {
    name: 'Lost Box',
    tier: 1,
    keyCards: ['Comfey', 'Colress\'s Experiment', 'Sableye', 'Radiant Greninja', 'Cramorant'],
    strategy: 'Use Lost Zone engine to power up various attackers',
    avgSetupTurn: 1,
    weaknesses: ['Path to the Peak', 'Spiritomb'],
    strengths: ['Versatile', 'Fast', 'Multiple attackers']
  },
  GARDEVOIR_EX: {
    name: 'Gardevoir ex',
    tier: 1,
    keyCards: ['Gardevoir ex', 'Kirlia', 'Ralts', 'Zacian V'],
    strategy: 'Accelerate energy with Psychic Embrace, attack with various Pokemon',
    avgSetupTurn: 2,
    weaknesses: ['Metal types', 'Spiritomb'],
    strengths: ['Energy acceleration', 'Flexible attackers', 'High HP']
  },
  MIRAIDON_EX: {
    name: 'Miraidon ex',
    tier: 1,
    keyCards: ['Miraidon ex', 'Raikou V', 'Flaaffy', 'Iron Hands ex'],
    strategy: 'Fill bench with Tandem Unit, power up with Flaaffy',
    avgSetupTurn: 1,
    weaknesses: ['Fighting types', 'Path to the Peak'],
    strengths: ['Explosive starts', 'Consistent', 'Spread damage']
  },
  
  // Tier 2 Decks
  GIRATINA_VSTAR: {
    name: 'Giratina VSTAR',
    tier: 2,
    keyCards: ['Giratina VSTAR', 'Comfey', 'Colress\'s Experiment', 'Radiant Greninja'],
    strategy: 'Lost Zone engine into Giratina VSTAR Star Requiem',
    avgSetupTurn: 3,
    weaknesses: ['Fast aggressive decks', 'Lost City'],
    strengths: ['OHKO potential', 'Consistent engine', 'Good vs single prize']
  },
  LUGIA_VSTAR: {
    name: 'Lugia VSTAR',
    tier: 2,
    keyCards: ['Lugia VSTAR', 'Archeops', 'Lumineon V', 'Double Turbo Energy'],
    strategy: 'Use Summoning Star to get Archeops, sweep with powered attackers',
    avgSetupTurn: 2,
    weaknesses: ['Lightning types', 'Path to the Peak'],
    strengths: ['Powerful ability', 'Versatile', 'Good recovery']
  },
  IRON_THORNS_EX: {
    name: 'Iron Thorns ex',
    tier: 2,
    keyCards: ['Iron Thorns ex', 'Gholdengo ex', 'Future Booster Energy Capsule'],
    strategy: 'Mill opponent\'s deck while dealing damage',
    avgSetupTurn: 2,
    weaknesses: ['Fire types', 'Energy recovery'],
    strengths: ['Alternative win condition', 'Tanky', 'Disruption']
  },
  
  // Tier 3 Decks  
  CHIEN_PAO_EX: {
    name: 'Chien-Pao ex',
    tier: 3,
    keyCards: ['Chien-Pao ex', 'Baxcalibur', 'Irida', 'Superior Energy Retrieval'],
    strategy: 'Accelerate Water energy with Baxcalibur, OHKO with Hail Blade',
    avgSetupTurn: 3,
    weaknesses: ['Metal types', 'Ability lock'],
    strengths: ['OHKO potential', 'Energy acceleration', 'Prize trade']
  },
  ARCEUS_VARIANTS: {
    name: 'Arceus Variants',
    tier: 3,
    keyCards: ['Arceus VSTAR', 'Bidoof', 'Bibarel', 'Double Turbo Energy'],
    strategy: 'Trinity Nova to accelerate energy to various attackers',
    avgSetupTurn: 2,
    weaknesses: ['Fighting types', 'Special energy hate'],
    strengths: ['Flexible', 'Consistent', 'Good vs single prize']
  }
};

// Key Trainer Cards by Category
export const TRAINER_CATEGORIES = {
  DRAW_SUPPORTERS: [
    { name: 'Professor\'s Research', effect: 'Discard hand, draw 7', power: 10 },
    { name: 'Iono', effect: 'Shuffle hands, draw equal to prizes', power: 8 },
    { name: 'Colress\'s Experiment', effect: 'Look at 5, take 3, Lost Zone 2', power: 9 },
    { name: 'Judge', effect: 'Both shuffle and draw 4', power: 6 },
    { name: 'Marnie', effect: 'Opponent shuffles and draws 4', power: 7 }
  ],
  SEARCH_ITEMS: [
    { name: 'Ultra Ball', effect: 'Discard 2, search any Pokemon', power: 10 },
    { name: 'Quick Ball', effect: 'Discard 1, search Basic Pokemon', power: 9 },
    { name: 'Battle VIP Pass', effect: 'Turn 1 only, search 2 Basic Pokemon', power: 10 },
    { name: 'Nest Ball', effect: 'Search Basic Pokemon', power: 7 },
    { name: 'Level Ball', effect: 'Search Pokemon with 90 HP or less', power: 6 }
  ],
  ENERGY_ACCELERATION: [
    { name: 'Melony', effect: 'Attach Water from discard, draw 3', type: ENERGY_TYPES.WATER },
    { name: 'Bede', effect: 'Attach Psychic from hand, heal 30', type: ENERGY_TYPES.PSYCHIC },
    { name: 'Elesa\'s Sparkle', effect: 'Attach 2 Lightning to Fusion Strike', type: ENERGY_TYPES.LIGHTNING },
    { name: 'Dark Patch', effect: 'Attach Dark from discard to Bench', type: ENERGY_TYPES.DARKNESS },
    { name: 'Metal Saucer', effect: 'Attach Metal from discard to Bench', type: ENERGY_TYPES.METAL }
  ],
  STADIUMS: [
    { name: 'Path to the Peak', effect: 'Rule Box Pokemon have no abilities', power: 9 },
    { name: 'Lost City', effect: 'KO\'d Pokemon go to Lost Zone', power: 8 },
    { name: 'Temple of Sinnoh', effect: 'Special Energy provide Colorless only', power: 7 },
    { name: 'Collapsed Stadium', effect: '4 Bench slots', power: 6 },
    { name: 'Magma Basin', effect: 'Attach Fire from discard, take 20 damage', power: 7 }
  ],
  DISRUPTION: [
    { name: 'Boss\'s Orders', effect: 'Switch opponent\'s Active', power: 10 },
    { name: 'Crushing Hammer', effect: 'Flip to discard energy', power: 6 },
    { name: 'Lost Vacuum', effect: 'Remove Tool/Stadium to Lost Zone', power: 8 },
    { name: 'Cross Switcher', effect: 'Play 2 to switch both Active', power: 7 },
    { name: 'Iono', effect: 'Hand disruption based on prizes', power: 8 }
  ]
};

// Energy Acceleration Methods by Type
export const ENERGY_ACCELERATION = {
  [ENERGY_TYPES.WATER]: ['Melony', 'Baxcalibur', 'Frosmoth', 'Palkia VSTAR'],
  [ENERGY_TYPES.FIRE]: ['Magma Basin', 'Charizard ex', 'Delphox V', 'Entei V'],
  [ENERGY_TYPES.PSYCHIC]: ['Gardevoir ex', 'Bede', 'Shadow Rider Calyrex', 'Mewtwo VUNION'],
  [ENERGY_TYPES.LIGHTNING]: ['Flaaffy', 'Elesa\'s Sparkle', 'Tapu Koko Prism', 'Zeraora'],
  [ENERGY_TYPES.DARKNESS]: ['Dark Patch', 'Galarian Moltres V', 'Darkrai VSTAR'],
  [ENERGY_TYPES.METAL]: ['Metal Saucer', 'Magnezone', 'Bronzong'],
  [ENERGY_TYPES.GRASS]: ['Cherrim', 'Rillaboom', 'Tsareena ex'],
  [ENERGY_TYPES.FIGHTING]: ['Gutsy Pickaxe', 'Garchomp ex', 'Koraidon ex'],
  GENERAL: ['Double Turbo Energy', 'Twin Energy', 'Triple Acceleration Energy']
};

// Card Evaluation Metrics
export const CARD_POWER_RATINGS = {
  // Damage efficiency (damage per energy)
  DAMAGE_EFFICIENCY: {
    EXCELLENT: 80, // 80+ damage per energy
    GOOD: 60,      // 60-79 damage per energy  
    AVERAGE: 40,   // 40-59 damage per energy
    POOR: 20       // Below 40 damage per energy
  },
  
  // HP Thresholds
  HP_THRESHOLDS: {
    VSTAR_VMAX: 280,
    EX_V: 220,
    STAGE_2: 170,
    STAGE_1: 130,
    BASIC: 90
  },
  
  // Setup speed
  SETUP_SPEED: {
    IMMEDIATE: 0,  // Can attack turn 1
    FAST: 1,       // Can attack turn 2
    MODERATE: 2,   // Can attack turn 3
    SLOW: 3        // Turn 4+
  }
};

// Deck Building Rules
export const DECK_RULES = {
  TOTAL_CARDS: 60,
  MAX_COPIES: 4, // Except basic energy
  MIN_BASIC_POKEMON: 1,
  
  // Recommended ratios
  RECOMMENDED_RATIOS: {
    POKEMON: { min: 12, max: 20, optimal: 15 },
    TRAINERS: { min: 25, max: 40, optimal: 32 },
    ENERGY: { min: 8, max: 18, optimal: 13 }
  },
  
  // Card count recommendations by deck type
  DECK_TYPE_RATIOS: {
    AGGRO: { pokemon: 10, trainers: 38, energy: 12 },
    CONTROL: { pokemon: 15, trainers: 35, energy: 10 },
    MIDRANGE: { pokemon: 18, trainers: 30, energy: 12 },
    COMBO: { pokemon: 12, trainers: 40, energy: 8 },
    MILL: { pokemon: 8, trainers: 42, energy: 10 }
  }
};

// Prize Trade Evaluation
export const PRIZE_TRADES = {
  FAVORABLE: {
    'VSTAR/VMAX_VS_SINGLE': -2, // You KO 3-prize, they KO 1-prize
    'EX_V_VS_SINGLE': -1,        // You KO 2-prize, they KO 1-prize  
    'SINGLE_VS_MULTI': 2         // You KO 1-prize, they KO 2-3 prize
  },
  EVEN: {
    'VSTAR_VS_VSTAR': 0,
    'EX_VS_EX': 0,
    'SINGLE_VS_SINGLE': 0
  },
  UNFAVORABLE: {
    'SINGLE_VS_EX': 1,           // You KO 1-prize, they KO 2-prize
    'SINGLE_VS_VSTAR': 2,        // You KO 1-prize, they KO 3-prize
    'EX_VS_VSTAR': 1             // You KO 2-prize, they KO 3-prize
  }
};

// Common Synergies and Combos
export const CARD_SYNERGIES = {
  DRAW_ENGINES: [
    ['Bibarel', 'Skwovet', 'Ultra Ball'], // Discard for Bibarel ability
    ['Radiant Greninja', 'Concealed Cards', 'Quick Ball'], // Discard for draw
    ['Comfey', 'Colress\'s Experiment', 'Lost City'] // Lost Zone engine
  ],
  ENERGY_ENGINES: [
    ['Gardevoir ex', 'Psychic Energy', 'Fog Crystal'], // Psychic acceleration
    ['Baxcalibur', 'Superior Energy Retrieval', 'Irida'], // Water acceleration  
    ['Charizard ex', 'Fire Energy', 'Magma Basin'], // Fire acceleration
    ['Flaaffy', 'Lightning Energy', 'Quick Ball'] // Lightning acceleration
  ],
  SEARCH_CHAINS: [
    ['Battle VIP Pass', 'Lumineon V', 'Professor\'s Research'], // Turn 1 setup
    ['Irida', 'Evolution Incense', 'Rare Candy'], // Evolution search
    ['Adventurer\'s Discovery', 'Quick Ball', 'Ultra Ball'] // Pokemon search
  ],
  DAMAGE_COMBOS: [
    ['Radiant Hawlucha', 'Lost Zone cards', 'Sableye'], // Damage boost
    ['Defiance Band', 'Single Prize attackers', 'Boss\'s Orders'], // OHKO setup
    ['Choice Belt', 'V Pokemon', 'Escape Rope'] // Damage boost vs V
  ]
};

// Format Legality and Rotation
export const FORMAT_INFO = {
  STANDARD: {
    sets: ['F', 'G', 'H'], // Regulation marks
    banList: ['Scoop Up Net', 'Shady Dealings Drizzile'],
    description: 'Most recent 2 years of sets'
  },
  EXPANDED: {
    sets: ['BW', 'XY', 'SM', 'SWSH', 'SV'], // All modern sets
    banList: ['Archeops NVI', 'Chip-Chip Ice Axe', 'Delinquent', 'Flabébé FLI', 'Forest of Giant Plants'],
    description: 'Black & White onwards'
  }
};

// Meta Game Cycles
export const META_CYCLES = {
  AGGRO_BEATS_COMBO: 'Fast pressure beats setup decks',
  CONTROL_BEATS_AGGRO: 'Disruption and healing beats aggression',
  COMBO_BEATS_CONTROL: 'Overwhelming resources beat disruption',
  
  // Specific type advantages in current meta
  WATER_BEATS_FIRE: 'Chien-Pao beats Charizard',
  METAL_BEATS_WATER: 'Gholdengo beats Chien-Pao',
  FIRE_BEATS_METAL: 'Charizard beats Gholdengo'
};

// Tech Card Recommendations by Matchup
export const TECH_CARDS = {
  VS_CHARIZARD: ['Canceling Cologne', 'Temple of Sinnoh', 'Radiant Alakazam'],
  VS_LOST_BOX: ['Spiritomb', 'Klefki', 'Radiant Jirachi'],
  VS_GARDEVOIR: ['Spiritomb', 'Iron Thorns ex', 'Mimikyu'],
  VS_MIRAIDON: ['Spiritomb', 'Path to the Peak', 'Manaphy'],
  VS_LUGIA: ['Canceling Cologne', 'Yveltal', 'Spiritomb'],
  GENERAL: ['Lost Vacuum', 'Switch Cart', 'Pal Pad', 'Super Rod']
};