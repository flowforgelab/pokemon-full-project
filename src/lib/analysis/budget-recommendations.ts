/**
 * Budget-Aware Recommendations System
 * 
 * Provides card recommendations based on budget constraints
 */

import { Card, DeckCard } from '@prisma/client';
import { CardRecommendation } from './card-recommendations';
import { 
  getCardPrice, 
  calculateTotalPrice, 
  getBudgetTier,
  getBudgetAlternative,
  BUDGET_TIERS,
  BudgetTier
} from './card-pricing-data';

export interface BudgetRecommendation extends CardRecommendation {
  price: {
    low: number;
    market: number;
    high: number;
    total: number; // quantity * market price
  };
  budgetAlternative?: {
    name: string;
    price: number;
    savings: number;
    tradeoff: string;
  };
}

export interface BudgetAnalysis {
  currentDeckPrice: number;
  currentBudgetTier: BudgetTier;
  recommendedBudget: number;
  potentialSavings: number;
  budgetBreakdown: {
    pokemon: number;
    trainers: number;
    energy: number;
  };
}

/**
 * Analyze deck budget and provide recommendations
 */
export function analyzeDeckBudget(
  cards: Array<DeckCard & { card: Card }>,
  targetBudget?: number
): BudgetAnalysis {
  // Calculate current deck price
  const cardList = cards.map(dc => ({
    name: dc.card.name,
    quantity: dc.quantity
  }));
  
  const currentDeckPrice = calculateTotalPrice(cardList);
  const currentBudgetTier = getBudgetTier(currentDeckPrice);
  
  // Calculate price breakdown by type
  const pokemonCards = cards.filter(dc => dc.card.supertype === 'POKEMON');
  const trainerCards = cards.filter(dc => dc.card.supertype === 'TRAINER');
  const energyCards = cards.filter(dc => dc.card.supertype === 'ENERGY');
  
  const budgetBreakdown = {
    pokemon: calculateTotalPrice(pokemonCards.map(dc => ({
      name: dc.card.name,
      quantity: dc.quantity
    }))),
    trainers: calculateTotalPrice(trainerCards.map(dc => ({
      name: dc.card.name,
      quantity: dc.quantity
    }))),
    energy: calculateTotalPrice(energyCards.map(dc => ({
      name: dc.card.name,
      quantity: dc.quantity
    })))
  };
  
  // Determine recommended budget based on deck competitiveness
  let recommendedBudget = BUDGET_TIERS.COMPETITIVE;
  if (currentDeckPrice < BUDGET_TIERS.BUDGET) {
    recommendedBudget = BUDGET_TIERS.BUDGET;
  } else if (currentDeckPrice > BUDGET_TIERS.PREMIUM) {
    recommendedBudget = BUDGET_TIERS.PREMIUM;
  }
  
  // Use target budget if provided
  if (targetBudget) {
    recommendedBudget = targetBudget;
  }
  
  // Calculate potential savings
  const potentialSavings = Math.max(0, currentDeckPrice - recommendedBudget);
  
  return {
    currentDeckPrice,
    currentBudgetTier,
    recommendedBudget,
    potentialSavings,
    budgetBreakdown
  };
}

/**
 * Convert recommendations to budget-aware versions
 */
export function makeBudgetAware(
  recommendations: CardRecommendation[],
  targetBudget: number,
  currentDeckPrice: number
): BudgetRecommendation[] {
  const budgetRecommendations: BudgetRecommendation[] = [];
  let runningTotal = currentDeckPrice;
  
  recommendations.forEach(rec => {
    const price = getCardPrice(rec.card.name);
    const totalPrice = price.market * rec.card.quantity;
    
    const budgetRec: BudgetRecommendation = {
      ...rec,
      price: {
        low: price.low,
        market: price.market,
        high: price.high,
        total: totalPrice
      }
    };
    
    // Check if this would exceed budget
    if (runningTotal + totalPrice > targetBudget) {
      // Look for budget alternative
      const alternative = getBudgetAlternative(rec.card.name);
      if (alternative) {
        const altPrice = getCardPrice(alternative);
        const altTotal = altPrice.market * rec.card.quantity;
        const savings = totalPrice - altTotal;
        
        budgetRec.budgetAlternative = {
          name: alternative,
          price: altTotal,
          savings,
          tradeoff: getTradeoffDescription(rec.card.name, alternative)
        };
      }
    }
    
    budgetRecommendations.push(budgetRec);
    runningTotal += totalPrice;
  });
  
  return budgetRecommendations;
}

/**
 * Get budget-friendly deck upgrades
 */
export function getBudgetUpgrades(
  cards: Array<DeckCard & { card: Card }>,
  maxBudget: number = 20
): BudgetRecommendation[] {
  const upgrades: BudgetRecommendation[] = [];
  
  // Check for missing staples under budget
  const staples = [
    { name: "Professor's Research", quantity: 4, category: "draw" },
    { name: "Quick Ball", quantity: 4, category: "search" },
    { name: "Ordinary Rod", quantity: 1, category: "recovery" },
    { name: "Switch", quantity: 2, category: "switching" }
  ];
  
  let totalCost = 0;
  
  staples.forEach(staple => {
    // Check if deck already has this card
    const existing = cards.find(dc => 
      dc.card.name.toLowerCase().includes(staple.name.toLowerCase())
    );
    
    if (!existing || existing.quantity < staple.quantity) {
      const needed = existing ? staple.quantity - existing.quantity : staple.quantity;
      const price = getCardPrice(staple.name);
      const cost = price.market * needed;
      
      if (totalCost + cost <= maxBudget) {
        upgrades.push({
          card: {
            name: staple.name,
            quantity: needed,
            category: staple.category
          },
          reasoning: [
            `Essential ${staple.category} card for consistency`,
            "Budget-friendly staple",
            "Used in 90%+ of competitive decks"
          ],
          priority: 'essential',
          impact: { consistency: 10 },
          synergiesWith: ["Any deck"],
          estimatedImprovement: 5,
          price: {
            low: price.low,
            market: price.market,
            high: price.high,
            total: cost
          }
        });
        
        totalCost += cost;
      }
    }
  });
  
  return upgrades;
}

/**
 * Get ultra-budget deck skeleton
 */
export function getUltraBudgetSkeleton(): Array<{
  card: string;
  quantity: number;
  price: number;
  purpose: string;
}> {
  return [
    // Draw Support (Ultra Budget)
    { card: "Professor's Research", quantity: 4, price: 2.00, purpose: "Primary draw engine" },
    { card: "Cynthia", quantity: 2, price: 2.00, purpose: "Additional draw support" },
    
    // Search (Ultra Budget)
    { card: "Nest Ball", quantity: 4, price: 2.00, purpose: "Basic Pokemon search" },
    { card: "Evolution Incense", quantity: 2, price: 1.00, purpose: "Evolution search" },
    
    // Switching (Ultra Budget)
    { card: "Switch", quantity: 3, price: 1.50, purpose: "Manual switching" },
    
    // Recovery (Ultra Budget)
    { card: "Ordinary Rod", quantity: 2, price: 1.00, purpose: "Pokemon/Energy recovery" },
    
    // Stadium (Ultra Budget)
    { card: "Training Court", quantity: 2, price: 2.00, purpose: "Energy recovery" },
    
    // Total: ~$13.50 for trainer core
  ];
}

/**
 * Describe tradeoff between expensive card and budget alternative
 */
function getTradeoffDescription(expensive: string, alternative: string): string {
  const tradeoffs: Record<string, string> = {
    "dedenne-gx:lumineon v": "Less draw power but provides supporter search",
    "dedenne-gx:bibarel": "Stage 1 instead of Basic, but reusable ability",
    "crobat v:lumineon v": "Searches supporters instead of drawing cards",
    "ultra ball:quick ball": "Only searches Basic Pokemon",
    "cross switcher:boss's orders": "Supporter instead of Item",
    "computer search:dowsing machine": "Only recovers trainers from discard",
    "dark patch:energy switch": "Moves energy instead of accelerating",
    "max elixir:twin energy": "Special energy with restrictions"
  };
  
  const key = `${expensive.toLowerCase()}:${alternative.toLowerCase()}`;
  return tradeoffs[key] || "Slightly less powerful but much more affordable";
}

/**
 * Get budget tier recommendations
 */
export function getBudgetTierRecommendations(tier: BudgetTier): string[] {
  switch (tier) {
    case 'ULTRA_BUDGET':
      return [
        "Focus on single-prize attackers",
        "Use budget trainer staples (Nest Ball, Switch)",
        "Avoid expensive tech cards",
        "Consider theme deck as starting point",
        "Trade for cards instead of buying"
      ];
      
    case 'BUDGET':
      return [
        "Add key consistency cards (Quick Ball, Marnie)",
        "Include 1-2 budget V Pokemon",
        "Use common stadiums (Training Court)",
        "Focus on one strategy",
        "Buy singles instead of packs"
      ];
      
    case 'COMPETITIVE':
      return [
        "Invest in draw engine Pokemon (Lumineon V, Bibarel)",
        "Add meta-relevant stadiums",
        "Include gust effects (Boss's Orders)",
        "Consider Special Energy acceleration",
        "Buy playsets of staples"
      ];
      
    case 'PREMIUM':
      return [
        "Add premium consistency cards (Crobat V)",
        "Include multiple tech options",
        "Use optimal counts of all staples",
        "Consider alternate art versions",
        "Build multiple deck variants"
      ];
      
    case 'UNLIMITED':
      return [
        "Use optimal cards regardless of price",
        "Include luxury tech cards",
        "Max rarity for style points",
        "Build complete gauntlet of decks",
        "Experiment with unique strategies"
      ];
  }
}