/**
 * Sideboard Suggestions System
 * 
 * Generates 15-card sideboard recommendations for tournaments
 * based on meta matchups and deck weaknesses
 */

import { Card, DeckCard } from '@prisma/client';
import { analyzeMetaPosition, CURRENT_STANDARD_META } from './meta-context';
import { getMatchupTable } from './matchup-predictor';
import { DeckArchetype } from './types';

export interface SideboardCard {
  card: {
    name: string;
    quantity: number;
    category: string;
  };
  purpose: string[];
  targetsMatchups: string[];
  priority: 'essential' | 'high' | 'medium' | 'flex';
  swapsWith?: string[]; // Main deck cards to remove
}

export interface SideboardPlan {
  cards: SideboardCard[];
  totalCards: number;
  matchupPlans: Array<{
    opponent: string;
    swapIn: Array<{ card: string; quantity: number }>;
    swapOut: Array<{ card: string; quantity: number }>;
    strategy: string;
  }>;
  generalStrategy: string;
}

/**
 * Generate sideboard suggestions based on deck and meta
 */
export function generateSideboardSuggestions(
  mainDeck: Array<DeckCard & { card: Card }>,
  deckArchetype?: DeckArchetype
): SideboardPlan {
  // Analyze meta position and matchups
  const metaPosition = analyzeMetaPosition(mainDeck);
  const matchupTable = getMatchupTable(mainDeck, deckArchetype);
  
  // Identify deck's main weaknesses
  const weaknesses = identifyWeaknesses(mainDeck, matchupTable);
  
  // Generate sideboard cards
  const sideboardCards: SideboardCard[] = [];
  
  // 1. Add matchup-specific counters
  const matchupCounters = getMatchupCounters(weaknesses, mainDeck);
  sideboardCards.push(...matchupCounters);
  
  // 2. Add consistency options for slower matchups
  const consistencyOptions = getConsistencyOptions(mainDeck);
  sideboardCards.push(...consistencyOptions);
  
  // 3. Add disruption for combo matchups
  const disruptionOptions = getDisruptionOptions(mainDeck);
  sideboardCards.push(...disruptionOptions);
  
  // 4. Add tech cards for common situations
  const techOptions = getTechOptions(mainDeck, metaPosition);
  sideboardCards.push(...techOptions);
  
  // 5. Add energy hate if applicable
  const energyHate = getEnergyHateOptions(mainDeck);
  sideboardCards.push(...energyHate);
  
  // Trim to 15 cards total
  const finalSideboard = prioritizeSideboard(sideboardCards);
  
  // Generate matchup-specific swap plans
  const matchupPlans = generateMatchupPlans(finalSideboard, mainDeck, matchupTable);
  
  return {
    cards: finalSideboard,
    totalCards: finalSideboard.reduce((sum, sc) => sum + sc.card.quantity, 0),
    matchupPlans,
    generalStrategy: generateSideboardStrategy(finalSideboard, weaknesses)
  };
}

/**
 * Identify main weaknesses from matchup table
 */
function identifyWeaknesses(
  mainDeck: Array<DeckCard & { card: Card }>,
  matchupTable: ReturnType<typeof getMatchupTable>
): Array<{ matchup: string; issue: string; severity: number }> {
  const weaknesses: Array<{ matchup: string; issue: string; severity: number }> = [];
  
  matchupTable.forEach(matchup => {
    if (matchup.winRate < 40) {
      // Bad matchup - identify why
      const issues = matchup.analysis
        .filter(a => a.includes('disadvantage') || a.includes('weakness'))
        .slice(0, 1);
      
      weaknesses.push({
        matchup: matchup.deck,
        issue: issues[0] || 'General disadvantage',
        severity: 40 - matchup.winRate
      });
    }
  });
  
  return weaknesses.sort((a, b) => b.severity - a.severity);
}

/**
 * Get matchup-specific counter cards
 */
function getMatchupCounters(
  weaknesses: ReturnType<typeof identifyWeaknesses>,
  mainDeck: Array<DeckCard & { card: Card }>
): SideboardCard[] {
  const counters: SideboardCard[] = [];
  const addedCards = new Set<string>();
  
  weaknesses.forEach(weakness => {
    // Lost Box matchup
    if (weakness.matchup.includes('Lost Box')) {
      if (!addedCards.has('klefki')) {
        counters.push({
          card: { name: 'Klefki', quantity: 1, category: 'pokemon' },
          purpose: ['Blocks Comfey ability', 'Disrupts Lost Box engine'],
          targetsMatchups: ['Lost Box'],
          priority: 'high',
          swapsWith: ['1 basic energy']
        });
        addedCards.add('klefki');
      }
      
      if (!addedCards.has('lost-vacuum')) {
        counters.push({
          card: { name: 'Lost Vacuum', quantity: 2, category: 'item' },
          purpose: ['Removes Colress\'s Experiment', 'Lost Zone synergy'],
          targetsMatchups: ['Lost Box', 'Any Stadium deck'],
          priority: 'medium',
          swapsWith: ['2 Switch/Escape Rope']
        });
        addedCards.add('lost-vacuum');
      }
    }
    
    // Lugia VSTAR matchup
    if (weakness.matchup.includes('Lugia')) {
      if (!addedCards.has('collapsed-stadium')) {
        counters.push({
          card: { name: 'Collapsed Stadium', quantity: 2, category: 'stadium' },
          purpose: ['Limits bench to 4', 'Forces Lugia to discard Archeops'],
          targetsMatchups: ['Lugia VSTAR', 'Any bench-heavy deck'],
          priority: 'essential',
          swapsWith: ['2 other stadiums or items']
        });
        addedCards.add('collapsed-stadium');
      }
    }
    
    // Mew VMAX matchup  
    if (weakness.matchup.includes('Mew')) {
      if (!addedCards.has('drapion-v')) {
        counters.push({
          card: { name: 'Drapion V', quantity: 1, category: 'pokemon' },
          purpose: ['Dark type hits Mew for weakness', 'Single prize attacker option'],
          targetsMatchups: ['Mew VMAX', 'Psychic decks'],
          priority: 'high',
          swapsWith: ['1 utility Pokemon']
        });
        addedCards.add('drapion-v');
      }
    }
    
    // Regidrago matchup
    if (weakness.matchup.includes('Regidrago')) {
      if (!addedCards.has('lord-charizard')) {
        counters.push({
          card: { name: 'Radiant Charizard', quantity: 1, category: 'pokemon' },
          purpose: ['Prize denial', 'Non-V attacker'],
          targetsMatchups: ['Regidrago VSTAR'],
          priority: 'medium',
          swapsWith: ['1 other attacker']
        });
        addedCards.add('lord-charizard');
      }
    }
  });
  
  return counters;
}

/**
 * Get consistency options for control matchups
 */
function getConsistencyOptions(
  mainDeck: Array<DeckCard & { card: Card }>
): SideboardCard[] {
  const options: SideboardCard[] = [];
  
  // Check current supporter count
  const supporterCount = mainDeck.filter(dc => 
    dc.card.supertype === 'TRAINER' && dc.card.subtypes?.includes('Supporter')
  ).reduce((sum, dc) => sum + dc.quantity, 0);
  
  if (supporterCount < 12) {
    options.push({
      card: { name: 'Iono', quantity: 2, category: 'supporter' },
      purpose: ['Hand refresh', 'Disruption in late game'],
      targetsMatchups: ['Control decks', 'Slow matchups'],
      priority: 'medium',
      swapsWith: ['2 items or energy']
    });
  }
  
  // Lost Zone counter
  options.push({
    card: { name: 'Pal Pad', quantity: 1, category: 'item' },
    purpose: ['Recover supporters', 'Counter Lost Zone'],
    targetsMatchups: ['Control', 'Mill'],
    priority: 'flex',
    swapsWith: ['1 recovery card']
  });
  
  return options;
}

/**
 * Get disruption options
 */
function getDisruptionOptions(
  mainDeck: Array<DeckCard & { card: Card }>
): SideboardCard[] {
  const options: SideboardCard[] = [];
  
  // Check if we have Judge/Marnie
  const hasHandDisruption = mainDeck.some(dc => 
    dc.card.name.toLowerCase().includes('judge') ||
    dc.card.name.toLowerCase().includes('marnie') ||
    dc.card.name.toLowerCase().includes('iono')
  );
  
  if (!hasHandDisruption) {
    options.push({
      card: { name: 'Judge', quantity: 2, category: 'supporter' },
      purpose: ['Reset both hands', 'Disrupt combo decks'],
      targetsMatchups: ['Combo decks', 'Setup decks'],
      priority: 'high',
      swapsWith: ['2 draw supporters']
    });
  }
  
  // Stadium removal
  options.push({
    card: { name: 'Lost City', quantity: 1, category: 'stadium' },
    purpose: ['Remove KO\'d Pokemon', 'Counter recycling'],
    targetsMatchups: ['Single prize decks', 'Recovery-heavy decks'],
    priority: 'medium',
    swapsWith: ['1 other stadium']
  });
  
  // Tool removal
  options.push({
    card: { name: 'Tool Scrapper', quantity: 1, category: 'item' },
    purpose: ['Remove tools', 'Counter Choice Belt'],
    targetsMatchups: ['Tool-heavy decks'],
    priority: 'flex',
    swapsWith: ['1 utility item']
  });
  
  return options;
}

/**
 * Get tech options based on meta
 */
function getTechOptions(
  mainDeck: Array<DeckCard & { card: Card }>,
  metaPosition: ReturnType<typeof analyzeMetaPosition>
): SideboardCard[] {
  const options: SideboardCard[] = [];
  
  // Weakness Guard Energy for bad type matchups
  const hasWeaknessGuard = mainDeck.some(dc => 
    dc.card.name.toLowerCase().includes('weakness guard')
  );
  
  if (!hasWeaknessGuard) {
    options.push({
      card: { name: 'Weakness Guard Energy', quantity: 2, category: 'energy' },
      purpose: ['Prevent weakness damage', 'Improve bad matchups'],
      targetsMatchups: ['Type disadvantage matchups'],
      priority: 'medium',
      swapsWith: ['2 basic energy']
    });
  }
  
  // Spiritomb for ability lock
  options.push({
    card: { name: 'Spiritomb', quantity: 1, category: 'pokemon' },
    purpose: ['Block V abilities', 'Slow down setup'],
    targetsMatchups: ['Ability-heavy decks'],
    priority: 'medium',
    swapsWith: ['1 consistency card']
  });
  
  // Canceling Cologne for evolution denial
  options.push({
    card: { name: 'Canceling Cologne', quantity: 1, category: 'item' },
    purpose: ['Devolve Pokemon', 'Disrupt evolution decks'],
    targetsMatchups: ['Evolution decks'],
    priority: 'flex',
    swapsWith: ['1 utility item']
  });
  
  return options;
}

/**
 * Get energy hate options
 */
function getEnergyHateOptions(
  mainDeck: Array<DeckCard & { card: Card }>
): SideboardCard[] {
  const options: SideboardCard[] = [];
  
  // Crushing Hammer for energy denial
  options.push({
    card: { name: 'Crushing Hammer', quantity: 2, category: 'item' },
    purpose: ['Energy denial', 'Slow down attackers'],
    targetsMatchups: ['Single attachment decks', 'Special energy decks'],
    priority: 'flex',
    swapsWith: ['2 consistency cards']
  });
  
  // Enhanced Hammer for special energy
  options.push({
    card: { name: 'Enhanced Hammer', quantity: 1, category: 'item' },
    purpose: ['Remove special energy', 'Counter Twin/Double Turbo'],
    targetsMatchups: ['Special energy decks'],
    priority: 'flex',
    swapsWith: ['1 utility item']
  });
  
  return options;
}

/**
 * Prioritize sideboard to 15 cards
 */
function prioritizeSideboard(cards: SideboardCard[]): SideboardCard[] {
  // Sort by priority
  const priorityOrder = { essential: 0, high: 1, medium: 2, flex: 3 };
  cards.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  const finalSideboard: SideboardCard[] = [];
  let totalCards = 0;
  
  for (const card of cards) {
    if (totalCards + card.card.quantity <= 15) {
      finalSideboard.push(card);
      totalCards += card.card.quantity;
    } else if (totalCards < 15) {
      // Partial add
      const remaining = 15 - totalCards;
      finalSideboard.push({
        ...card,
        card: { ...card.card, quantity: remaining }
      });
      break;
    }
  }
  
  return finalSideboard;
}

/**
 * Generate matchup-specific swap plans
 */
function generateMatchupPlans(
  sideboard: SideboardCard[],
  mainDeck: Array<DeckCard & { card: Card }>,
  matchupTable: ReturnType<typeof getMatchupTable>
): SideboardPlan['matchupPlans'] {
  const plans: SideboardPlan['matchupPlans'] = [];
  
  // Get unique opponent types
  const opponents = new Set(matchupTable.map(m => m.deck));
  
  opponents.forEach(opponent => {
    const swapIn: Array<{ card: string; quantity: number }> = [];
    const swapOut: Array<{ card: string; quantity: number }> = [];
    let strategy = '';
    
    // Find relevant sideboard cards for this matchup
    sideboard.forEach(sb => {
      if (opponent && sb.targetsMatchups.some(target => opponent.includes(target))) {
        swapIn.push({ card: sb.card.name, quantity: sb.card.quantity });
        
        // Add swap out suggestions
        if (sb.swapsWith) {
          sb.swapsWith.forEach(swap => {
            const match = swap.match(/(\d+)\s+(.+)/);
            if (match) {
              swapOut.push({ 
                card: match[2], 
                quantity: parseInt(match[1]) 
              });
            }
          });
        }
      }
    });
    
    // Generate strategy based on matchup
    if (opponent && opponent.includes('Lost Box')) {
      strategy = 'Disrupt their Comfey engine and remove stadiums';
    } else if (opponent && opponent.includes('Lugia')) {
      strategy = 'Limit bench space and target Archeops';
    } else if (opponent && opponent.includes('Control')) {
      strategy = 'Add consistency and recovery options';
    } else {
      strategy = 'Adjust for specific weaknesses and maintain tempo';
    }
    
    if (swapIn.length > 0) {
      plans.push({ opponent, swapIn, swapOut, strategy });
    }
  });
  
  return plans;
}

/**
 * Generate overall sideboard strategy
 */
function generateSideboardStrategy(
  sideboard: SideboardCard[],
  weaknesses: ReturnType<typeof identifyWeaknesses>
): string {
  const categories = {
    matchupCounters: 0,
    consistency: 0,
    disruption: 0,
    tech: 0
  };
  
  sideboard.forEach(card => {
    if (card.targetsMatchups.length > 0) categories.matchupCounters += card.card.quantity;
    else if (card.card.category === 'supporter') categories.consistency += card.card.quantity;
    else if (card.purpose.some(p => p.includes('disrupt'))) categories.disruption += card.card.quantity;
    else categories.tech += card.card.quantity;
  });
  
  let strategy = 'Sideboard focuses on ';
  const focuses: string[] = [];
  
  if (categories.matchupCounters >= 6) focuses.push('countering bad matchups');
  if (categories.consistency >= 4) focuses.push('improving consistency');
  if (categories.disruption >= 3) focuses.push('disrupting opponent strategies');
  if (categories.tech >= 3) focuses.push('flexible tech options');
  
  strategy += focuses.join(', ');
  
  if (weaknesses.length > 0) {
    strategy += `. Primary targets: ${weaknesses.slice(0, 2).map(w => w.matchup).join(', ')}`;
  }
  
  return strategy;
}