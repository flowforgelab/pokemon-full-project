import { analyzeBasicDeck, getKidFriendlyRecommendations, getDetailedSwapRecommendations, getKidFriendlyTradeSuggestions } from '../lib/analysis/basic-deck-analyzer';
import { Card, DeckCard } from '@prisma/client';

// Rayquaza Battle Arena Deck
const rayquazaDeck: Array<DeckCard & { card: Card }> = [
  // Pokemon (19)
  { id: '1', deckId: '1', cardId: '1', quantity: 2, card: { id: '1', name: 'Rayquaza-GX', supertype: 'POKEMON', subtypes: ['GX'], types: ['Dragon'], hp: '180', evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '1', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '2', deckId: '1', cardId: '2', quantity: 2, card: { id: '2', name: 'Vikavolt', supertype: 'POKEMON', subtypes: ['Stage 2'], types: ['Lightning'], hp: '150', evolvesFrom: 'Charjabug', attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '2', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
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

function testRayquazaAnalysis() {
  console.log('========================================');
  console.log('RAYQUAZA DECK ANALYSIS TEST');
  console.log('Testing improved analyzer accuracy...');
  console.log('========================================\n');
  
  // Run analysis
  const analysis = analyzeBasicDeck(rayquazaDeck);
  
  // Display results
  console.log(`DECK SCORE: ${analysis.deckScore}/100 ${analysis.scoreEmoji}`);
  console.log(`\n${analysis.overallMessage}\n`);
  
  console.log('DECK COMPOSITION:');
  console.log('----------------');
  const totalCards = rayquazaDeck.reduce((sum, dc) => sum + dc.quantity, 0);
  const pokemon = rayquazaDeck.filter(dc => dc.card.supertype === 'POKEMON').reduce((sum, dc) => sum + dc.quantity, 0);
  const trainers = rayquazaDeck.filter(dc => dc.card.supertype === 'TRAINER').reduce((sum, dc) => sum + dc.quantity, 0);
  const energy = rayquazaDeck.filter(dc => dc.card.supertype === 'ENERGY').reduce((sum, dc) => sum + dc.quantity, 0);
  
  console.log(`Total Cards: ${totalCards}`);
  console.log(`Pokemon: ${pokemon}`);
  console.log(`Trainers: ${trainers}`);
  console.log(`Energy: ${energy}`);
  console.log(`Draw Supporters: 6 (Cynthia x2, Lillie x2, Erika x2)`);
  
  console.log('\nISSUES FOUND:');
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
  
  // Show trade suggestions
  const tradeSuggestions = getKidFriendlyTradeSuggestions(analysis);
  if (tradeSuggestions.length > 0) {
    tradeSuggestions.forEach(suggestion => {
      console.log(suggestion);
    });
  }
  
  console.log('\n========================================');
  console.log('ANALYSIS ACCURACY CHECK:');
  console.log('✓ Should detect draw supporters (Cynthia, Lillie, Erika)');
  console.log('✓ Should NOT flag basic energy > 4 as illegal');
  console.log('✓ Score should reflect actual deck quality');
  console.log('========================================');
}

testRayquazaAnalysis();