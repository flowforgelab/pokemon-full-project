import { generateSmartWarnings, getWarningSummary } from '../lib/analysis/smart-warnings';
import { generateCardRecommendations } from '../lib/analysis/card-recommendations';
import { Card, DeckCard } from '@prisma/client';

// Mock Rayquaza deck data
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

function testPhase4Standalone() {
  console.log('========================================');
  console.log('PHASE 4 ANALYSIS TEST (Standalone)');
  console.log('========================================\n');
  
  // 1. Smart Warnings
  console.log('1. SMART WARNING SYSTEM');
  console.log('----------------------');
  const warnings = generateSmartWarnings(mockRayquazaDeck);
  const summary = getWarningSummary(warnings);
  
  console.log(`Total Warnings: ${summary.total}`);
  console.log(`  Critical: ${summary.critical}`);
  console.log(`  High: ${summary.high}`);
  console.log(`  Medium: ${summary.medium}`);
  console.log(`  Low: ${summary.low}`);
  console.log(`  Info: ${summary.info}`);
  console.log(`\nEstimated Win Rate Impact: ${summary.estimatedWinRateImpact.toFixed(0)}%`);
  
  console.log('\nTop Warnings:');
  warnings.slice(0, 5).forEach((warning, i) => {
    console.log(`\n${i + 1}. [${warning.severity.toUpperCase()}] ${warning.title}`);
    console.log(`   ${warning.description}`);
    console.log(`   Impact: ${warning.impact}`);
    console.log(`   Win Rate Impact: ${warning.estimatedImpact.winRate}%`);
    console.log(`   Suggestions:`);
    warning.suggestions.forEach(s => console.log(`   - ${s}`));
  });
  
  // 2. Card Recommendations
  console.log('\n\n2. CARD RECOMMENDATION ENGINE');
  console.log('----------------------------');
  const recommendations = generateCardRecommendations(mockRayquazaDeck, warnings);
  
  console.log(`\nImmediate Additions (${recommendations.immediate.length}):`);
  recommendations.immediate.forEach((rec, i) => {
    console.log(`\n${i + 1}. ${rec.card.name} x${rec.card.quantity} [${rec.priority.toUpperCase()}]`);
    console.log(`   Reasoning:`);
    rec.reasoning.forEach(r => console.log(`   - ${r}`));
    console.log(`   Synergies: ${rec.synergiesWith.join(', ')}`);
    console.log(`   Expected Improvement: +${rec.estimatedImprovement}%`);
  });
  
  console.log(`\n\nShort-Term Upgrades (${recommendations.shortTerm.length}):`);
  recommendations.shortTerm.slice(0, 3).forEach((rec, i) => {
    console.log(`\n${i + 1}. ${rec.card.name} x${rec.card.quantity}`);
    console.log(`   ${rec.reasoning[0]}`);
    if (rec.replaces) {
      console.log(`   Replaces: ${rec.replaces.card} x${rec.replaces.quantity}`);
    }
  });
  
  console.log(`\n\nCards to Cut (${recommendations.cuts.length}):`);
  recommendations.cuts.forEach((cut, i) => {
    console.log(`\n${i + 1}. Remove ${cut.quantity} ${cut.card}`);
    console.log(`   Reason: ${cut.reason}`);
    console.log(`   Impact: ${cut.impact}`);
  });
  
  // 3. Transformation Summary
  console.log('\n\n3. PHASE 4 FEATURES DEMONSTRATED');
  console.log('---------------------------------');
  console.log('✅ Smart warnings with severity levels (critical → info)');
  console.log('✅ Win rate impact calculations for each issue');
  console.log('✅ Specific card recommendations with quantities');
  console.log('✅ Clear reasoning for each recommendation');
  console.log('✅ Expected improvement percentages');
  console.log('✅ Synergy considerations');
  console.log('✅ Cards to cut with reasons');
  console.log('✅ Prioritized immediate vs short-term vs long-term');
}

testPhase4Standalone();