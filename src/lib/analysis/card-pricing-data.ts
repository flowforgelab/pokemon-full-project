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

// Price categories for budget analysis
export const BUDGET_TIERS = {
  ULTRA_BUDGET: 50,    // $50 or less for entire deck
  BUDGET: 100,         // $100 or less
  COMPETITIVE: 250,    // $250 or less
  PREMIUM: 500,        // $500 or less
  UNLIMITED: Infinity  // No budget constraint
} as const;

export type BudgetTier = keyof typeof BUDGET_TIERS;

// Common competitive cards with approximate prices
export const CARD_PRICES: Record<string, CardPriceRange> = {
  // Draw Supporters
  "professor's research": { low: 0.25, market: 0.50, high: 1.00 },
  "marnie": { low: 1.00, market: 2.00, high: 3.00 },
  "cynthia": { low: 0.50, market: 1.00, high: 2.00 },
  "n": { low: 2.00, market: 3.50, high: 5.00 },
  "colress": { low: 3.00, market: 5.00, high: 8.00 },
  
  // Gust Effects
  "boss's orders": { low: 1.50, market: 2.50, high: 4.00 },
  "guzma": { low: 1.00, market: 2.00, high: 3.00 },
  "lysandre": { low: 0.50, market: 1.00, high: 2.00 },
  "cross switcher": { low: 8.00, market: 12.00, high: 18.00 },
  
  // Search Items
  "quick ball": { low: 1.00, market: 2.00, high: 3.00 },
  "ultra ball": { low: 3.00, market: 5.00, high: 8.00 },
  "level ball": { low: 0.50, market: 1.00, high: 2.00 },
  "nest ball": { low: 0.25, market: 0.50, high: 1.00 },
  "evolution incense": { low: 0.25, market: 0.50, high: 1.00 },
  
  // Stadiums
  "path to the peak": { low: 3.00, market: 5.00, high: 8.00 },
  "lost city": { low: 0.50, market: 1.00, high: 2.00 },
  "training court": { low: 0.50, market: 1.00, high: 2.00 },
  "sky field": { low: 15.00, market: 25.00, high: 40.00 },
  
  // Energy Acceleration
  "elesa's sparkle": { low: 0.50, market: 1.00, high: 2.00 },
  "welder": { low: 1.00, market: 2.00, high: 3.00 },
  "melony": { low: 0.25, market: 0.50, high: 1.00 },
  "dark patch": { low: 8.00, market: 12.00, high: 18.00 },
  "metal saucer": { low: 1.00, market: 2.00, high: 3.00 },
  
  // Special Energy
  "twin energy": { low: 1.00, market: 2.00, high: 3.00 },
  "double turbo energy": { low: 0.50, market: 1.00, high: 2.00 },
  "capture energy": { low: 0.50, market: 1.00, high: 2.00 },
  "horror energy": { low: 0.25, market: 0.50, high: 1.00 },
  
  // Consistency Pokemon
  "lumineon v": { low: 1.00, market: 2.00, high: 3.00 },
  "crobat v": { low: 2.00, market: 3.50, high: 5.00 },
  "dedenne-gx": { low: 5.00, market: 8.00, high: 12.00 },
  "tapu lele-gx": { low: 15.00, market: 25.00, high: 40.00 },
  "shaymin-ex": { low: 20.00, market: 35.00, high: 50.00 },
  "jirachi": { low: 3.00, market: 5.00, high: 8.00 },
  "bibarel": { low: 0.50, market: 1.00, high: 2.00 },
  "bidoof": { low: 0.25, market: 0.50, high: 1.00 },
  
  // Tech Cards
  "klefki": { low: 0.50, market: 1.00, high: 2.00 },
  "spiritomb": { low: 1.00, market: 2.00, high: 3.00 },
  "drapion v": { low: 1.00, market: 2.00, high: 3.00 },
  "radiant greninja": { low: 2.00, market: 3.50, high: 5.00 },
  
  // Tools
  "choice belt": { low: 0.50, market: 1.00, high: 2.00 },
  "air balloon": { low: 1.00, market: 2.00, high: 3.00 },
  "tool scrapper": { low: 0.25, market: 0.50, high: 1.00 },
  
  // Recovery
  "ordinary rod": { low: 0.25, market: 0.50, high: 1.00 },
  "rescue carrier": { low: 0.25, market: 0.50, high: 1.00 },
  "energy recycler": { low: 0.25, market: 0.50, high: 1.00 },
  "vs seeker": { low: 3.00, market: 5.00, high: 8.00 },
  
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