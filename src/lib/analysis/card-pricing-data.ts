/**
 * Card Pricing Data for Budget Analysis
 * 
 * Approximate market prices for common competitive cards
 * Prices in USD based on TCGPlayer market prices
 */

export interface CardPriceRange {
  low: number;    // Near mint low
  market: number; // Market price
  high: number;   // Near mint high
}

// Price categories for budget analysis (2024 realistic values)
export const BUDGET_TIERS = {
  ULTRA_BUDGET: 75,    // $75 or less for entire deck
  BUDGET: 150,         // $150 or less
  COMPETITIVE: 400,    // $400 or less (realistic competitive)
  PREMIUM: 800,        // $800 or less
  UNLIMITED: Infinity  // No budget constraint
} as const;

export type BudgetTier = keyof typeof BUDGET_TIERS;

// Common competitive cards with approximate prices
export const CARD_PRICES: Record<string, CardPriceRange> = {
  // Draw Supporters
  "professor's research": { low: 0.25, market: 0.50, high: 1.00 },
  "professor sycamore": { low: 0.25, market: 0.50, high: 1.00 }, // Same as Research
  "marnie": { low: 0.50, market: 1.00, high: 2.00 }, // Rotated
  "iono": { low: 3.00, market: 5.00, high: 7.00 }, // Current staple
  "cynthia": { low: 0.25, market: 0.50, high: 1.00 }, // Rotated
  "n": { low: 1.00, market: 2.00, high: 3.00 }, // Expanded only
  "colress": { low: 2.00, market: 3.00, high: 5.00 }, // Expanded
  
  // Gust Effects
  "boss's orders": { low: 2.00, market: 3.00, high: 5.00 },
  "guzma": { low: 0.50, market: 1.00, high: 2.00 }, // Expanded
  "lysandre": { low: 0.25, market: 0.50, high: 1.00 }, // Expanded
  "cross switcher": { low: 2.00, market: 3.00, high: 5.00 },
  
  // Search Items
  "quick ball": { low: 0.50, market: 1.00, high: 2.00 }, // Rotated
  "ultra ball": { low: 2.00, market: 3.00, high: 5.00 },
  "level ball": { low: 0.25, market: 0.50, high: 1.00 }, // Rotated
  "nest ball": { low: 1.00, market: 2.00, high: 3.00 },
  "evolution incense": { low: 0.25, market: 0.50, high: 1.00 }, // Rotated
  "battle vip pass": { low: 3.00, market: 5.00, high: 7.00 },
  
  // Stadiums
  "path to the peak": { low: 0.50, market: 1.00, high: 2.00 },
  "lost city": { low: 3.00, market: 5.00, high: 7.00 },
  "training court": { low: 0.25, market: 0.50, high: 1.00 },
  "sky field": { low: 3.00, market: 5.00, high: 8.00 }, // Expanded
  "temple of sinnoh": { low: 2.00, market: 3.00, high: 5.00 },
  "collapsed stadium": { low: 1.00, market: 2.00, high: 3.00 },
  
  // Energy Acceleration
  "elesa's sparkle": { low: 0.50, market: 1.00, high: 2.00 },
  "welder": { low: 0.50, market: 1.00, high: 2.00 }, // Rotated
  "melony": { low: 0.25, market: 0.50, high: 1.00 },
  "dark patch": { low: 2.00, market: 3.00, high: 5.00 }, // Expanded
  "metal saucer": { low: 0.50, market: 1.00, high: 2.00 },
  
  // Special Energy
  "twin energy": { low: 0.50, market: 1.00, high: 2.00 },
  "double turbo energy": { low: 2.00, market: 3.00, high: 4.00 },
  "double colorless energy": { low: 0.25, market: 0.50, high: 1.00 }, // Expanded
  "jet energy": { low: 3.00, market: 5.00, high: 7.00 },
  "luminous energy": { low: 2.00, market: 3.00, high: 4.00 },
  "reversal energy": { low: 2.00, market: 3.00, high: 4.00 },
  "powerful colorless energy": { low: 0.50, market: 1.00, high: 2.00 }, // Rotated
  "capture energy": { low: 0.50, market: 1.00, high: 2.00 },
  "horror energy": { low: 0.25, market: 0.50, high: 1.00 },
  
  // Basic Energy (basically free)
  "lightning energy": { low: 0.05, market: 0.10, high: 0.25 },
  "fire energy": { low: 0.05, market: 0.10, high: 0.25 },
  "water energy": { low: 0.05, market: 0.10, high: 0.25 },
  "grass energy": { low: 0.05, market: 0.10, high: 0.25 },
  "psychic energy": { low: 0.05, market: 0.10, high: 0.25 },
  "fighting energy": { low: 0.05, market: 0.10, high: 0.25 },
  "darkness energy": { low: 0.05, market: 0.10, high: 0.25 },
  "metal energy": { low: 0.05, market: 0.10, high: 0.25 },
  "fairy energy": { low: 0.10, market: 0.25, high: 0.50 }, // Discontinued
  
  // Consistency Pokemon
  "lumineon v": { low: 1.00, market: 2.00, high: 3.00 },
  "crobat v": { low: 8.00, market: 12.00, high: 18.00 },
  "dedenne-gx": { low: 3.00, market: 5.00, high: 8.00 }, // Rotated, price dropped
  "tapu lele-gx": { low: 8.00, market: 12.00, high: 18.00 }, // Expanded
  "shaymin-ex": { low: 10.00, market: 15.00, high: 25.00 }, // Expanded
  "jirachi": { low: 2.00, market: 3.00, high: 5.00 },
  "bibarel": { low: 1.00, market: 2.00, high: 3.00 },
  "bidoof": { low: 0.25, market: 0.50, high: 1.00 },
  
  // Modern Pokemon ex
  "charizard ex": { low: 35.00, market: 50.00, high: 70.00 },
  "gardevoir ex": { low: 20.00, market: 30.00, high: 40.00 },
  "miraidon ex": { low: 15.00, market: 22.00, high: 30.00 },
  "chien-pao ex": { low: 8.00, market: 12.00, high: 18.00 },
  "lugia vstar": { low: 25.00, market: 35.00, high: 45.00 },
  "giratina vstar": { low: 20.00, market: 30.00, high: 40.00 },
  "arceus vstar": { low: 15.00, market: 22.00, high: 30.00 },
  "arceus v": { low: 12.00, market: 18.00, high: 25.00 },
  
  // Tech Cards
  "klefki": { low: 0.50, market: 1.00, high: 2.00 },
  "spiritomb": { low: 1.00, market: 2.00, high: 3.00 },
  "drapion v": { low: 1.00, market: 2.00, high: 3.00 },
  "radiant greninja": { low: 3.00, market: 5.00, high: 7.00 },
  
  // Tools
  "choice belt": { low: 0.50, market: 1.00, high: 2.00 },
  "air balloon": { low: 1.00, market: 2.00, high: 3.00 },
  "tool scrapper": { low: 0.25, market: 0.50, high: 1.00 },
  
  // Recovery
  "ordinary rod": { low: 0.10, market: 0.25, high: 0.50 }, // Rotated
  "super rod": { low: 2.00, market: 3.00, high: 4.00 },
  "rescue carrier": { low: 0.25, market: 0.50, high: 1.00 }, // Rotated
  "energy recycler": { low: 0.10, market: 0.25, high: 0.50 },
  "energy retrieval": { low: 0.10, market: 0.25, high: 0.50 },
  "vs seeker": { low: 1.00, market: 2.00, high: 3.00 }, // Expanded
  "pal pad": { low: 0.25, market: 0.50, high: 1.00 },
  
  // Switching
  "switch": { low: 0.25, market: 0.50, high: 1.00 },
  "escape rope": { low: 0.50, market: 1.00, high: 2.00 },
  "switch cart": { low: 0.25, market: 0.50, high: 1.00 },
  
  // Default for unknown cards
  "default": { low: 0.50, market: 1.00, high: 2.00 }
};

/**
 * Get price for a specific card
 */
export function getCardPrice(cardName: string): CardPriceRange {
  const normalizedName = cardName.toLowerCase();
  
  // Special handling for basic energy
  if (normalizedName.includes('energy') && !normalizedName.includes('special')) {
    const energyTypes = ['lightning', 'fire', 'water', 'grass', 'psychic', 'fighting', 'darkness', 'metal', 'fairy'];
    for (const type of energyTypes) {
      if (normalizedName.includes(type)) {
        return CARD_PRICES[`${type} energy`] || CARD_PRICES.default;
      }
    }
  }
  
  // Check exact match first
  if (CARD_PRICES[normalizedName]) {
    return CARD_PRICES[normalizedName];
  }
  
  // Check partial matches
  for (const [key, price] of Object.entries(CARD_PRICES)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return price;
    }
  }
  
  // Return default price
  return CARD_PRICES.default;
}

/**
 * Calculate total price for a list of cards
 */
export function calculateTotalPrice(
  cards: Array<{ name: string; quantity: number }>,
  useMarketPrice: boolean = true
): number {
  return cards.reduce((total, card) => {
    const price = getCardPrice(card.name);
    const unitPrice = useMarketPrice ? price.market : price.low;
    return total + (unitPrice * card.quantity);
  }, 0);
}

/**
 * Get budget tier from price
 */
export function getBudgetTier(totalPrice: number): BudgetTier {
  if (totalPrice <= BUDGET_TIERS.ULTRA_BUDGET) return 'ULTRA_BUDGET';
  if (totalPrice <= BUDGET_TIERS.BUDGET) return 'BUDGET';
  if (totalPrice <= BUDGET_TIERS.COMPETITIVE) return 'COMPETITIVE';
  if (totalPrice <= BUDGET_TIERS.PREMIUM) return 'PREMIUM';
  return 'UNLIMITED';
}

/**
 * Get budget-friendly alternatives for expensive cards
 */
export const BUDGET_ALTERNATIVES: Record<string, string[]> = {
  // Expensive draw support
  "dedenne-gx": ["lumineon v", "bibarel", "oranguru"],
  "crobat v": ["lumineon v", "bibarel", "cinccino"],
  "tapu lele-gx": ["lumineon v", "jirachi"],
  "shaymin-ex": ["oranguru", "octillery"],
  
  // Expensive search
  "computer search": ["dowsing machine", "master ball"],
  "ultra ball": ["quick ball", "level ball", "evolution incense"],
  
  // Expensive gust
  "cross switcher": ["boss's orders", "guzma"],
  
  // Expensive stadiums
  "sky field": ["lost city", "training court"],
  "tropical beach": ["training court", "brooklet hill"],
  
  // Expensive energy acceleration  
  "max elixir": ["energy switch", "twin energy"],
  "dark patch": ["energy switch", "dark city"],
  
  // General alternatives
  "ace spec": ["regular trainer"],
  "gold card": ["regular version"],
  "secret rare": ["regular print"]
};

/**
 * Get budget alternative for a card
 */
export function getBudgetAlternative(cardName: string): string | null {
  const normalizedName = cardName.toLowerCase();
  
  for (const [expensive, alternatives] of Object.entries(BUDGET_ALTERNATIVES)) {
    if (normalizedName.includes(expensive)) {
      return alternatives[0]; // Return first alternative
    }
  }
  
  return null;
}