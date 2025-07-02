import { analyzeBasicDeck, getKidFriendlyRecommendations, getDetailedSwapRecommendations, getKidFriendlyTradeSuggestions } from '../lib/analysis/basic-deck-analyzer-v2';
import { Card, DeckCard } from '@prisma/client';

// Create a beginner's deck with common issues
const beginnerDeck: Array<DeckCard & { card: Card }> = [
  // Pokemon (30 - too many!)
  { id: '1', deckId: '1', cardId: '1', quantity: 4, card: { id: '1', name: 'Pikachu', supertype: 'POKEMON', subtypes: [], types: ['Lightning'], hp: 60, evolvesFrom: null, attacks: [{ name: 'Thunder Shock', damage: '10', cost: ['Lightning'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '1', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '2', deckId: '1', cardId: '2', quantity: 3, card: { id: '2', name: 'Raichu', supertype: 'POKEMON', subtypes: ['Stage 1'], types: ['Lightning'], hp: 120, evolvesFrom: 'Pikachu', attacks: [{ name: 'Thunder', damage: '120', cost: ['Lightning', 'Lightning', 'Colorless'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '2', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '3', deckId: '1', cardId: '3', quantity: 4, card: { id: '3', name: 'Charmander', supertype: 'POKEMON', subtypes: [], types: ['Fire'], hp: 60, evolvesFrom: null, attacks: [{ name: 'Ember', damage: '30', cost: ['Fire', 'Colorless'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '3', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '4', deckId: '1', cardId: '4', quantity: 2, card: { id: '4', name: 'Charmeleon', supertype: 'POKEMON', subtypes: ['Stage 1'], types: ['Fire'], hp: 90, evolvesFrom: 'Charmander', attacks: [{ name: 'Flamethrower', damage: '80', cost: ['Fire', 'Fire', 'Colorless'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '4', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '5', deckId: '1', cardId: '5', quantity: 1, card: { id: '5', name: 'Charizard', supertype: 'POKEMON', subtypes: ['Stage 2'], types: ['Fire'], hp: 170, evolvesFrom: 'Charmeleon', attacks: [{ name: 'Fire Blast', damage: '170', cost: ['Fire', 'Fire', 'Fire', 'Colorless'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '5', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '6', deckId: '1', cardId: '6', quantity: 3, card: { id: '6', name: 'Squirtle', supertype: 'POKEMON', subtypes: [], types: ['Water'], hp: 60, evolvesFrom: null, attacks: [{ name: 'Bubble', damage: '10', cost: ['Water'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '6', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '7', deckId: '1', cardId: '7', quantity: 2, card: { id: '7', name: 'Wartortle', supertype: 'POKEMON', subtypes: ['Stage 1'], types: ['Water'], hp: 90, evolvesFrom: 'Squirtle', attacks: [{ name: 'Water Gun', damage: '40', cost: ['Water', 'Colorless'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '7', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '8', deckId: '1', cardId: '8', quantity: 4, card: { id: '8', name: 'Caterpie', supertype: 'POKEMON', subtypes: [], types: ['Grass'], hp: 50, evolvesFrom: null, attacks: [{ name: 'String Shot', damage: '10', cost: ['Grass'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '8', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '9', deckId: '1', cardId: '9', quantity: 3, card: { id: '9', name: 'Metapod', supertype: 'POKEMON', subtypes: ['Stage 1'], types: ['Grass'], hp: 70, evolvesFrom: 'Caterpie', attacks: [{ name: 'Harden', damage: '0', cost: ['Colorless'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '9', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '10', deckId: '1', cardId: '10', quantity: 2, card: { id: '10', name: 'Butterfree', supertype: 'POKEMON', subtypes: ['Stage 2'], types: ['Grass'], hp: 130, evolvesFrom: 'Metapod', attacks: [{ name: 'Gust', damage: '80', cost: ['Grass', 'Colorless', 'Colorless'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '10', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  
  // Trainers (10 - not enough!)
  { id: '11', deckId: '1', cardId: '11', quantity: 2, card: { id: '11', name: 'Potion', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '11', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: ['Heal 30 damage'], abilities: null } as Card },
  { id: '12', deckId: '1', cardId: '12', quantity: 2, card: { id: '12', name: 'Poke Ball', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '12', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Search for Pokemon'], abilities: null } as Card },
  { id: '13', deckId: '1', cardId: '13', quantity: 2, card: { id: '13', name: 'Energy Retrieval', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '13', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: ['Get 2 basic Energy'], abilities: null } as Card },
  { id: '14', deckId: '1', cardId: '14', quantity: 2, card: { id: '14', name: 'Hop', supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '14', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Draw 3 cards'], abilities: null } as Card },
  { id: '15', deckId: '1', cardId: '15', quantity: 2, card: { id: '15', name: 'Pokemon Center Lady', supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '15', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Heal 60 damage'], abilities: null } as Card },
  
  // Energy (20 - good amount but wrong types!)
  { id: '16', deckId: '1', cardId: '16', quantity: 5, card: { id: '16', name: 'Lightning Energy', supertype: 'ENERGY', subtypes: ['Basic'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '16', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '17', deckId: '1', cardId: '17', quantity: 5, card: { id: '17', name: 'Fire Energy', supertype: 'ENERGY', subtypes: ['Basic'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '17', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '18', deckId: '1', cardId: '18', quantity: 5, card: { id: '18', name: 'Water Energy', supertype: 'ENERGY', subtypes: ['Basic'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '18', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '19', deckId: '1', cardId: '19', quantity: 5, card: { id: '19', name: 'Grass Energy', supertype: 'ENERGY', subtypes: ['Basic'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '19', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card }
];

function testBasicAnalyzer() {
  console.log('========================================');
  console.log('BASIC DECK ANALYZER V2 TEST');
  console.log('Now with specific card swap suggestions!');
  console.log('========================================\n');
  
  // Run analysis
  const analysis = analyzeBasicDeck(beginnerDeck);
  
  // Display results
  console.log(`DECK SCORE: ${analysis.deckScore}/100 ${analysis.scoreEmoji}`);
  console.log(`\n${analysis.overallMessage}\n`);
  
  console.log('ISSUES FOUND:');
  console.log('-------------');
  
  analysis.advice.forEach((advice, index) => {
    console.log(`\n${index + 1}. ${advice.icon} [${advice.category.toUpperCase()}] ${advice.title}`);
    console.log(`   ${advice.message}`);
    if (advice.tip) {
      console.log(`   💡 TIP: ${advice.tip}`);
    }
    if (advice.fixIt) {
      console.log(`   ✅ HOW TO FIX: ${advice.fixIt}`);
    }
  });
  
  // Show swap suggestions
  if (analysis.swapSuggestions && analysis.swapSuggestions.length > 0) {
    console.log('\n\n📋 SPECIFIC CARD SWAP SUGGESTIONS:');
    console.log('=====================================');
    
    // Show all suggestions
    console.log('\n--- ALL FIXES ---');
    const swapRecommendations = getDetailedSwapRecommendations(analysis, false);
    swapRecommendations.forEach(recommendation => {
      console.log(recommendation);
    });
    
    // Show step-by-step mode
    console.log('\n\n--- STEP-BY-STEP MODE (One fix at a time) ---');
    const stepByStepRecommendations = getDetailedSwapRecommendations(analysis, true);
    stepByStepRecommendations.forEach(recommendation => {
      console.log(recommendation);
    });
  }
  
  // Show trade suggestions
  const tradeSuggestions = getKidFriendlyTradeSuggestions(analysis);
  if (tradeSuggestions.length > 0) {
    tradeSuggestions.forEach(suggestion => {
      console.log(suggestion);
    });
  }
  
  // Get simple recommendations
  const recommendations = getKidFriendlyRecommendations(analysis);
  
  console.log('\n\nQUICK TIPS:');
  console.log('-----------');
  recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec}`);
  });
  
  if (analysis.funFact) {
    console.log(`\n${analysis.funFact}`);
  }
  
  console.log('\n========================================');
  console.log('NEW FEATURES:');
  console.log('✓ Priority-based recommendations (🔴🟡🟢)');
  console.log('✓ Step-by-step mode for beginners');
  console.log('✓ Card rarity information');
  console.log('✓ Trade suggestions for extras');
  console.log('✓ Duplicate removal prevention');
  console.log('========================================');
}

testBasicAnalyzer();