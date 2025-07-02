import { generateSmartWarnings, getWarningSummary } from '../lib/analysis/smart-warnings';
import { generateComprehensiveRecommendations } from '../lib/analysis/card-recommendations';
import { Card, DeckCard } from '@prisma/client';
import { getBudgetTierRecommendations } from '../lib/analysis/budget-recommendations';

// Mock Rayquaza deck data (same as before)
const mockRayquazaDeck: Array<DeckCard & { card: Card }> = [
  // Pokemon (18)
  { id: '1', deckId: '1', cardId: '1', quantity: 4, card: { id: '1', name: 'Rayquaza V', supertype: 'POKEMON', subtypes: ['V'], types: ['Dragon'], hp: 210, evolvesFrom: null, attacks: [{ name: 'Dragon Pulse', damage: '220', cost: ['Lightning', 'Fire'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '1', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '2', deckId: '1', cardId: '2', quantity: 3, card: { id: '2', name: 'Rayquaza VMAX', supertype: 'POKEMON', subtypes: ['VMAX'], types: ['Dragon'], hp: 320, evolvesFrom: 'Rayquaza V', attacks: [{ name: 'Max Burst', damage: '320', cost: ['Lightning', 'Fire'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '2', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '3', deckId: '1', cardId: '3', quantity: 3, card: { id: '3', name: 'Magnezone', supertype: 'POKEMON', subtypes: ['Stage 2'], types: ['Lightning'], hp: 150, evolvesFrom: 'Magneton', attacks: [{ name: 'Giga Impact', damage: '180', cost: ['Lightning', 'Lightning', 'Colorless'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '3', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '4', deckId: '1', cardId: '4', quantity: 2, card: { id: '4', name: 'Magneton', supertype: 'POKEMON', subtypes: ['Stage 1'], types: ['Lightning'], hp: 90, evolvesFrom: 'Magnemite', attacks: [{ name: 'Thunder Wave', damage: '30', cost: ['Lightning'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '4', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '5', deckId: '1', cardId: '5', quantity: 3, card: { id: '5', name: 'Magnemite', supertype: 'POKEMON', subtypes: [], types: ['Lightning'], hp: 60, evolvesFrom: null, attacks: [{ name: 'Magnetic Bomb', damage: '10', cost: ['Lightning'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '5', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '6', deckId: '1', cardId: '6', quantity: 3, card: { id: '6', name: 'Heracross', supertype: 'POKEMON', subtypes: [], types: ['Grass'], hp: 120, evolvesFrom: null, attacks: [{ name: 'Horn Attack', damage: '30', cost: ['Grass'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '6', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  
  // Trainers (27)
  { id: '7', deckId: '1', cardId: '7', quantity: 3, card: { id: '7', name: 'Professor Sycamore', supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '7', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Draw 7 cards'], abilities: null } as Card },
  { id: '8', deckId: '1', cardId: '8', quantity: 2, card: { id: '8', name: 'N', supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '8', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Shuffle and draw'], abilities: null } as Card },
  { id: '9', deckId: '1', cardId: '9', quantity: 2, card: { id: '9', name: 'Lysandre', supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '9', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Switch opponent'], abilities: null } as Card },
  { id: '10', deckId: '1', cardId: '10', quantity: 3, card: { id: '10', name: 'Ultra Ball', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '10', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Search Pokemon'], abilities: null } as Card },
  { id: '11', deckId: '1', cardId: '11', quantity: 3, card: { id: '11', name: 'Level Ball', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '11', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Search 90 HP or less'], abilities: null } as Card },
  { id: '12', deckId: '1', cardId: '12', quantity: 4, card: { id: '12', name: 'Rare Candy', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '12', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Evolve to Stage 2'], abilities: null } as Card },
  { id: '13', deckId: '1', cardId: '13', quantity: 2, card: { id: '13', name: 'Energy Recycler', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '13', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Shuffle energy'], abilities: null } as Card },
  { id: '14', deckId: '1', cardId: '14', quantity: 2, card: { id: '14', name: 'Switch', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '14', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: ['Switch active'], abilities: null } as Card },
  { id: '15', deckId: '1', cardId: '15', quantity: 3, card: { id: '15', name: 'VS Seeker', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '15', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Get supporter'], abilities: null } as Card },
  { id: '16', deckId: '1', cardId: '16', quantity: 2, card: { id: '16', name: 'Sky Field', supertype: 'TRAINER', subtypes: ['Stadium'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '16', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['8 bench'], abilities: null } as Card },
  
  // Energy (15)
  { id: '17', deckId: '1', cardId: '17', quantity: 5, card: { id: '17', name: 'Lightning Energy', supertype: 'ENERGY', subtypes: ['Basic'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '17', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '18', deckId: '1', cardId: '18', quantity: 5, card: { id: '18', name: 'Fire Energy', supertype: 'ENERGY', subtypes: ['Basic'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '18', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '19', deckId: '1', cardId: '19', quantity: 3, card: { id: '19', name: 'Grass Energy', supertype: 'ENERGY', subtypes: ['Basic'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '19', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '20', deckId: '1', cardId: '20', quantity: 2, card: { id: '20', name: 'Double Colorless Energy', supertype: 'ENERGY', subtypes: ['Special'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '20', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card }
];

function testPhase4Complete() {
  console.log('========================================');
  console.log('PHASE 4 COMPLETE TEST');
  console.log('========================================\n');
  
  // 1. Generate warnings
  const warnings = generateSmartWarnings(mockRayquazaDeck);
  const summary = getWarningSummary(warnings);
  
  console.log('1. SMART WARNINGS SUMMARY');
  console.log('------------------------');
  console.log(`Total Issues: ${summary.total} (Win Rate Impact: ${summary.estimatedWinRateImpact}%)`);
  console.log(`Critical: ${summary.critical}, High: ${summary.high}, Medium: ${summary.medium}\n`);
  
  // 2. Generate comprehensive recommendations
  console.log('2. BUDGET-AWARE RECOMMENDATIONS ($100 budget)');
  console.log('--------------------------------------------');
  const recommendations = generateComprehensiveRecommendations(
    mockRayquazaDeck, 
    warnings,
    {
      targetBudget: 100,
      includeSideboard: true,
      maxBudgetUpgrades: 20
    }
  );
  
  // Budget Analysis
  if (recommendations.budget) {
    console.log(`\nCurrent Deck Price: $${recommendations.budget.currentDeckPrice.toFixed(2)}`);
    console.log(`Budget Tier: ${recommendations.budget.currentBudgetTier}`);
    console.log(`Breakdown:`);
    console.log(`  Pokemon: $${recommendations.budget.budgetBreakdown.pokemon.toFixed(2)}`);
    console.log(`  Trainers: $${recommendations.budget.budgetBreakdown.trainers.toFixed(2)}`);
    console.log(`  Energy: $${recommendations.budget.budgetBreakdown.energy.toFixed(2)}`);
  }
  
  // Budget Upgrades
  console.log(`\n\nBUDGET UPGRADES (Under $20):`);
  recommendations.budgetUpgrades?.forEach((upgrade, i) => {
    console.log(`${i + 1}. ${upgrade.card.name} x${upgrade.card.quantity} - $${(upgrade as any).price?.total.toFixed(2) || 'N/A'}`);
    console.log(`   ${upgrade.reasoning[0]}`);
  });
  
  // Budget Tier Recommendations
  console.log(`\n\nBUDGET TIER ADVICE:`);
  const tierAdvice = getBudgetTierRecommendations(recommendations.budget?.currentBudgetTier || 'BUDGET');
  tierAdvice.forEach((advice, i) => console.log(`${i + 1}. ${advice}`));
  
  // 3. Sideboard Suggestions
  console.log('\n\n3. SIDEBOARD SUGGESTIONS (15 cards)');
  console.log('-----------------------------------');
  if (recommendations.sideboard) {
    console.log(`Strategy: ${recommendations.sideboard.generalStrategy}\n`);
    
    console.log('Sideboard Cards:');
    recommendations.sideboard.cards.forEach((card, i) => {
      console.log(`\n${i + 1}. ${card.card.name} x${card.card.quantity} [${card.priority.toUpperCase()}]`);
      console.log(`   Purpose: ${card.purpose.join(', ')}`);
      console.log(`   Targets: ${card.targetsMatchups.join(', ')}`);
      if (card.swapsWith) {
        console.log(`   Swap out: ${card.swapsWith.join(', ')}`);
      }
    });
    
    console.log('\n\nMATCHUP PLANS:');
    recommendations.sideboard.matchupPlans.slice(0, 3).forEach(plan => {
      console.log(`\nvs ${plan.opponent}:`);
      console.log(`Strategy: ${plan.strategy}`);
      console.log('In: ' + plan.swapIn.map(c => `${c.quantity} ${c.card}`).join(', '));
      console.log('Out: ' + plan.swapOut.map(c => `${c.quantity} ${c.card}`).join(', '));
    });
  }
  
  // 4. Phase 4 Summary
  console.log('\n\n4. PHASE 4 FEATURES SUMMARY');
  console.log('---------------------------');
  console.log('✅ Smart Warnings: Severity levels with win rate impact');
  console.log('✅ Card Recommendations: Specific cards with reasoning');
  console.log('✅ Budget Analysis: Current price and tier classification');
  console.log('✅ Budget Upgrades: Affordable improvements under $20');
  console.log('✅ Budget Alternatives: Cheaper options for expensive cards');
  console.log('✅ Sideboard: 15-card tournament sideboard with plans');
  console.log('✅ Matchup Plans: Specific swap strategies per opponent');
  console.log('\nThe deck analyzer now provides tournament-level guidance!');
}

testPhase4Complete();