import { analyzeBasicDeck } from '../lib/analysis/basic-deck-analyzer';
import { getDeckTemplate } from '../data/deck-templates';
import { Card, DeckCard } from '@prisma/client';

// Convert deck template to the format expected by analyzer
function convertTemplateToDeckCards(template: any): Array<DeckCard & { card: Card }> {
  return template.cards.map((templateCard: any, index: number) => ({
    id: `card-${index}`,
    deckId: 'test-deck',
    cardId: `card-${index}`,
    quantity: templateCard.quantity,
    card: {
      id: `card-${index}`,
      name: templateCard.name,
      supertype: templateCard.category.toUpperCase() as any,
      subtypes: [],
      types: templateCard.category === 'energy' ? [templateCard.name.replace(' Energy', '')] : null,
      hp: null,
      evolvesFrom: null,
      attacks: null,
      weaknesses: null,
      resistances: null,
      retreatCost: null,
      setId: templateCard.set,
      tcgplayerPurchaseUrl: null,
      number: templateCard.number,
      artist: '',
      rarity: 'Common',
      flavorText: null,
      nationalPokedexNumbers: [],
      rules: null,
      abilities: null
    }
  }));
}

async function testRayquazaBasicAnalysis() {
  console.log('Testing Basic Analyzer with Real Rayquaza Deck\n');
  
  // Get the real Rayquaza deck template
  const template = getDeckTemplate('rayquaza-gx-battle-arena');
  
  if (!template) {
    console.error('Could not find Rayquaza GX Battle Arena deck template!');
    return;
  }
  
  // Convert to analyzer format
  const deckCards = convertTemplateToDeckCards(template);
  
  // Run basic analysis
  const analysis = analyzeBasicDeck(deckCards);
  
  console.log('Analysis Results:');
  console.log('================');
  console.log(`Score: ${analysis.deckScore}/100 ${analysis.scoreEmoji}`);
  console.log(`Overall: ${analysis.overallMessage}\n`);
  
  console.log('Advice:');
  analysis.advice.forEach(advice => {
    console.log(`\n${advice.icon} ${advice.title}`);
    console.log(`   ${advice.message}`);
    if (advice.tip) console.log(`   💡 ${advice.tip}`);
    if (advice.fixIt) console.log(`   🔧 ${advice.fixIt}`);
  });
  
  // Check specific issues
  console.log('\n\nDeck Composition:');
  console.log('=================');
  const pokemon = deckCards.filter(dc => dc.card.supertype === 'POKEMON');
  const trainers = deckCards.filter(dc => dc.card.supertype === 'TRAINER');
  const energy = deckCards.filter(dc => dc.card.supertype === 'ENERGY');
  
  console.log(`Pokemon: ${pokemon.reduce((sum, dc) => sum + dc.quantity, 0)}`);
  console.log(`Trainers: ${trainers.reduce((sum, dc) => sum + dc.quantity, 0)}`);
  console.log(`Energy: ${energy.reduce((sum, dc) => sum + dc.quantity, 0)}`);
  
  console.log('\nDraw Supporters in deck:');
  const drawSupporters = ['Cynthia', 'Erika\'s Hospitality', 'Lillie'];
  trainers.forEach(dc => {
    if (drawSupporters.includes(dc.card.name)) {
      console.log(`- ${dc.quantity}x ${dc.card.name}`);
    }
  });
  
  console.log('\nWhat the analyzer is checking for:');
  console.log('- Cards with "professor" in name');
  console.log('- Cards with "research" in name');
  console.log('- Cards with "hop" in name');
  
  console.log('\n❌ The analyzer is missing common draw supporters like Cynthia, Lillie, etc!');
}

// Run the test
testRayquazaBasicAnalysis().catch(console.error);