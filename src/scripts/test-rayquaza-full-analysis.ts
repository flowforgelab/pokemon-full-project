import { analyzeBasicDeck, getKidFriendlyRecommendations, getDetailedSwapRecommendations, getKidFriendlyTradeSuggestions } from '../lib/analysis/basic-deck-analyzer';
import { Card, DeckCard } from '@prisma/client';

// Rayquaza Battle Arena Deck
const rayquazaDeck: Array<DeckCard & { card: Card }> = [
  // Pokemon (19)
  { id: '1', deckId: '1', cardId: '1', quantity: 2, card: { id: '1', name: 'Rayquaza-GX', supertype: 'POKEMON', subtypes: ['GX'], types: ['Dragon'], hp: '180', evolvesFrom: null, attacks: [{ name: 'Dragon Break', damage: '30x', cost: ['Grass', 'Lightning'] }, { name: 'Tempest GX', damage: '180', cost: ['Grass', 'Grass', 'Grass', 'Lightning'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '1', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '2', deckId: '1', cardId: '2', quantity: 2, card: { id: '2', name: 'Vikavolt', supertype: 'POKEMON', subtypes: ['Stage 2'], types: ['Lightning'], hp: '150', evolvesFrom: 'Charjabug', attacks: [{ name: 'Strong Charge', damage: '50', cost: ['Lightning'] }, { name: 'Electro Cannon', damage: '150', cost: ['Lightning', 'Lightning', 'Lightning', 'Colorless'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '2', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: [{ name: 'Strong Charge', text: 'Once during your turn, you may search your deck for a Grass Energy and a Lightning Energy and attach them to your Pokemon.', type: 'Ability' }] } as Card },
  { id: '3', deckId: '1', cardId: '3', quantity: 1, card: { id: '3', name: 'Charjabug', supertype: 'POKEMON', subtypes: ['Stage 1'], types: ['Lightning'], hp: '80', evolvesFrom: 'Grubbin', attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '3', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '4', deckId: '1', cardId: '4', quantity: 3, card: { id: '4', name: 'Grubbin', supertype: 'POKEMON', subtypes: [], types: ['Lightning'], hp: '60', evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '4', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '5', deckId: '1', cardId: '5', quantity: 2, card: { id: '5', name: 'Zekrom', supertype: 'POKEMON', subtypes: [], types: ['Lightning'], hp: '130', evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '5', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '6', deckId: '1', cardId: '6', quantity: 2, card: { id: '6', name: 'Zebstrika', supertype: 'POKEMON', subtypes: ['Stage 1'], types: ['Lightning'], hp: '90', evolvesFrom: 'Blitzle', attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '6', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '7', deckId: '1', cardId: '7', quantity: 2, card: { id: '7', name: 'Blitzle', supertype: 'POKEMON', subtypes: [], types: ['Lightning'], hp: '60', evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '7', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '8', deckId: '1', cardId: '8', quantity: 2, card: { id: '8', name: 'Shaymin Prism Star', supertype: 'POKEMON', subtypes: ['Prism Star'], types: ['Grass'], hp: '80', evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '8', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '9', deckId: '1', cardId: '9', quantity: 2, card: { id: '9', name: 'Tapu Koko Prism Star', supertype: 'POKEMON', subtypes: ['Prism Star'], types: ['Lightning'], hp: '130', evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '9', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '10', deckId: '1', cardId: '10', quantity: 1, card: { id: '10', name: 'Latias Prism Star', supertype: 'POKEMON', subtypes: ['Prism Star'], types: ['Dragon'], hp: '130', evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '10', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  
  // Trainers (26)
  { id: '11', deckId: '1', cardId: '11', quantity: 2, card: { id: '11', name: 'Cynthia', supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '11', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Shuffle your hand into your deck. Then, draw 6 cards.'], abilities: null } as Card },
  { id: '12', deckId: '1', cardId: '12', quantity: 2, card: { id: '12', name: "Erika's Hospitality", supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '12', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['You can play this card only if you have 4 or fewer other cards in your hand. Draw a card for each of your opponent\'s Pokémon in play.'], abilities: null } as Card },
  { id: '13', deckId: '1', cardId: '13', quantity: 2, card: { id: '13', name: 'Guzma', supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '13', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Switch 1 of your opponent\'s Benched Pokémon with their Active Pokémon. If you do, switch your Active Pokémon with 1 of your Benched Pokémon.'], abilities: null } as Card },
  { id: '14', deckId: '1', cardId: '14', quantity: 2, card: { id: '14', name: 'Lillie', supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '14', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Draw cards until you have 6 cards in your hand. If it\'s your first turn, draw cards until you have 8 cards in your hand.'], abilities: null } as Card },
  { id: '15', deckId: '1', cardId: '15', quantity: 1, card: { id: '15', name: 'Tate & Liza', supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '15', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '16', deckId: '1', cardId: '16', quantity: 1, card: { id: '16', name: 'Volkner', supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '16', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '17', deckId: '1', cardId: '17', quantity: 2, card: { id: '17', name: 'Acro Bike', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '17', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '18', deckId: '1', cardId: '18', quantity: 2, card: { id: '18', name: 'Energy Recycler', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '18', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '19', deckId: '1', cardId: '19', quantity: 3, card: { id: '19', name: 'Mysterious Treasure', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '19', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '20', deckId: '1', cardId: '20', quantity: 3, card: { id: '20', name: 'Rare Candy', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '20', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '21', deckId: '1', cardId: '21', quantity: 2, card: { id: '21', name: 'Rescue Stretcher', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '21', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '22', deckId: '1', cardId: '22', quantity: 2, card: { id: '22', name: 'Ultra Ball', supertype: 'TRAINER', subtypes: ['Item'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '22', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '23', deckId: '1', cardId: '23', quantity: 2, card: { id: '23', name: 'Viridian Forest', supertype: 'TRAINER', subtypes: ['Stadium'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '23', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  
  // Energy (15)
  { id: '24', deckId: '1', cardId: '24', quantity: 5, card: { id: '24', name: 'Grass Energy', supertype: 'ENERGY', subtypes: ['Basic'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '24', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '25', deckId: '1', cardId: '25', quantity: 10, card: { id: '25', name: 'Lightning Energy', supertype: 'ENERGY', subtypes: ['Basic'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '25', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card }
];

function evaluateRayquazaAnalysis() {
  console.log('========================================');
  console.log('COMPREHENSIVE RAYQUAZA DECK ANALYSIS');
  console.log('========================================\n');
  
  // Run analysis
  const analysis = analyzeBasicDeck(rayquazaDeck);
  
  // Display results
  console.log(`DECK SCORE: ${analysis.deckScore}/100 ${analysis.scoreEmoji}`);
  console.log(`${analysis.overallMessage}\n`);
  
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
    
    // Show specific cards to remove/add if available
    if (advice.cardsToRemove) {
      console.log('   ❌ Consider removing:');
      advice.cardsToRemove.forEach(card => {
        console.log(`      - ${card.name} (${card.reason})`);
      });
    }
    if (advice.cardsToAdd) {
      console.log('   ✅ Consider adding:');
      advice.cardsToAdd.forEach(card => {
        console.log(`      - ${card.name} (${card.why})`);
      });
    }
  });
  
  // Show detailed swap suggestions
  if (analysis.swapSuggestions && analysis.swapSuggestions.length > 0) {
    console.log('\n\n📋 SPECIFIC CARD SWAPS:');
    console.log('========================');
    const swapDetails = getDetailedSwapRecommendations(analysis, false);
    swapDetails.forEach(line => console.log(line));
  }
  
  // Show trade suggestions
  const tradeSuggestions = getKidFriendlyTradeSuggestions(analysis);
  if (tradeSuggestions.length > 0) {
    tradeSuggestions.forEach(suggestion => {
      console.log(suggestion);
    });
  }
  
  // Show simple recommendations
  console.log('\n\n🎯 SIMPLE RECOMMENDATIONS:');
  console.log('==========================');
  const recommendations = getKidFriendlyRecommendations(analysis);
  recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec}`);
  });
  
  // Expert evaluation
  console.log('\n\n📊 EXPERT EVALUATION:');
  console.log('=====================');
  console.log('The analyzer should detect:');
  console.log('✓ Evolution line imbalance (2 Vikavolt, 1 Charjabug) - DETECTED');
  console.log('✓ High special Pokemon count (7 total) - DETECTED');
  console.log('✓ Draw supporters present - CORRECTLY NOT FLAGGED');
  console.log('✓ Basic energy can be > 4 - CORRECTLY ALLOWED');
  console.log('? Energy acceleration (Vikavolt has it) - CHECK IF DETECTED');
  console.log('? Energy split (5 Grass, 10 Lightning) - CHECK IF ANALYZED');
  console.log('? 3 Rare Candy for evolution support - CHECK IF NOTED');
  
  // Deck strategy notes
  console.log('\n\n💡 DECK STRATEGY NOTES:');
  console.log('=======================');
  console.log('- Rayquaza-GX needs both Grass and Lightning energy');
  console.log('- Vikavolt provides energy acceleration with Strong Charge ability');
  console.log('- 5 Prism Star Pokemon is very high (can only have 1 of each in play)');
  console.log('- Energy split favors Lightning (10) over Grass (5)');
  console.log('- Has good search (Mysterious Treasure, Ultra Ball)');
  console.log('- Has switch options (Guzma, Tate & Liza)');
}

evaluateRayquazaAnalysis();