/**
 * Test script for AI deck analyzer
 */

import { analyzeWithAI, prepareDeckForAI } from '../lib/analysis/ai-deck-analyzer';
import { DeckCard, Card } from '@prisma/client';

// Mock deck data for testing
const createMockCard = (
  name: string,
  supertype: 'POKEMON' | 'TRAINER' | 'ENERGY',
  subtypes: string[] = [],
  types: string[] = [],
  hp?: string,
  attacks?: any[],
  abilities?: any[]
): DeckCard & { card: Card } => ({
  id: 'test',
  deckId: 'test',
  cardId: 'test',
  quantity: 1,
  card: {
    id: 'test',
    apiId: 'test',
    name,
    supertype,
    subtypes,
    types,
    hp: hp || null,
    evolvesFrom: null,
    evolvesTo: [],
    rules: [],
    ancientTrait: null,
    abilities: abilities || [],
    attacks: attacks || [],
    weaknesses: [],
    resistances: [],
    retreatCost: [],
    convertedRetreatCost: null,
    number: '1',
    artist: 'Test',
    rarity: 'RARE',
    flavorText: null,
    nationalPokedexNumbers: [],
    regulationMark: null,
    setId: 'test',
    createdAt: new Date(),
    updatedAt: new Date()
  }
});

// Create a sample Charizard ex deck
const sampleDeck: Array<DeckCard & { card: Card }> = [
  // Pokemon (15)
  { ...createMockCard('Charmander', 'POKEMON', ['Basic'], ['Fire'], '60'), quantity: 4 },
  { ...createMockCard('Charmeleon', 'POKEMON', ['Stage 1'], ['Fire'], '90'), quantity: 2 },
  { ...createMockCard('Charizard ex', 'POKEMON', ['Stage 2', 'ex'], ['Fire'], '330',
    [{ name: 'Burning Darkness', cost: ['Fire', 'Fire'], damage: '180', text: 'This Pokemon is now Burned.' }]), quantity: 3 },
  { ...createMockCard('Radiant Charizard', 'POKEMON', ['Basic', 'Radiant'], ['Fire'], '160',
    [{ name: 'Combustion Blast', cost: ['Fire'], damage: '250', text: 'This Pokemon can\'t use this attack next turn.' }]), quantity: 1 },
  { ...createMockCard('Pidgey', 'POKEMON', ['Basic'], ['Colorless'], '60'), quantity: 2 },
  { ...createMockCard('Pidgeot ex', 'POKEMON', ['Stage 2', 'ex'], ['Colorless'], '280',
    [], [{ name: 'Quick Search', text: 'Once during your turn, you may search your deck for a card and put it into your hand.', type: 'Ability' }]), quantity: 2 },
  { ...createMockCard('Lumineon V', 'POKEMON', ['Basic', 'V'], ['Water'], '170'), quantity: 1 },
  
  // Trainers (31)
  { ...createMockCard("Professor's Research", 'TRAINER', ['Supporter']), quantity: 4 },
  { ...createMockCard('Boss\'s Orders', 'TRAINER', ['Supporter']), quantity: 3 },
  { ...createMockCard('Quick Ball', 'TRAINER', ['Item']), quantity: 4 },
  { ...createMockCard('Ultra Ball', 'TRAINER', ['Item']), quantity: 2 },
  { ...createMockCard('Rare Candy', 'TRAINER', ['Item']), quantity: 4 },
  { ...createMockCard('Switch', 'TRAINER', ['Item']), quantity: 3 },
  { ...createMockCard('Lost City', 'TRAINER', ['Stadium']), quantity: 2 },
  { ...createMockCard('Iono', 'TRAINER', ['Supporter']), quantity: 3 },
  { ...createMockCard('Super Rod', 'TRAINER', ['Item']), quantity: 2 },
  { ...createMockCard('Forest Seal Stone', 'TRAINER', ['Tool']), quantity: 2 },
  { ...createMockCard('Choice Belt', 'TRAINER', ['Tool']), quantity: 2 },
  
  // Energy (14)
  { ...createMockCard('Fire Energy', 'ENERGY', ['Basic']), quantity: 11 },
  { ...createMockCard('Luminous Energy', 'ENERGY', ['Special']), quantity: 3 }
];

async function testAIAnalyzer() {
  console.log('🤖 Testing AI Deck Analyzer\n');
  
  // Test deck preparation
  console.log('1. Testing deck preparation...');
  const deckData = prepareDeckForAI(sampleDeck, 'Charizard ex Control');
  console.log('Deck data prepared:');
  console.log(deckData.substring(0, 500) + '...\n');
  
  // Test AI analysis (requires OpenAI API key)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⚠️  No OpenAI API key found. Set OPENAI_API_KEY to test full analysis.');
    console.log('Example: OPENAI_API_KEY=sk-... npx tsx src/scripts/test-ai-analyzer.ts');
    return;
  }
  
  console.log('2. Running AI analysis...');
  try {
    const analysis = await analyzeWithAI(sampleDeck, 'Charizard ex Control', {
      apiKey,
      model: 'gpt-3.5-turbo', // Use cheaper model for testing
      temperature: 0.7
    });
    
    console.log('\n✅ Analysis Complete!\n');
    console.log(`Overall Rating: ${analysis.overallRating}/100 (Tier ${analysis.tierRating})`);
    console.log(`Summary: ${analysis.executiveSummary}\n`);
    
    console.log('Strengths:');
    analysis.strengths.forEach(s => {
      console.log(`  - ${s.title} (${s.impact} impact)`);
    });
    
    console.log('\nWeaknesses:');
    analysis.weaknesses.forEach(w => {
      console.log(`  - ${w.title} (${w.severity})`);
      console.log(`    Fix: ${w.suggestion}`);
    });
    
    console.log('\nTop Improvement:');
    if (analysis.improvements.length > 0) {
      const top = analysis.improvements[0];
      console.log(`  Priority: ${top.priority}`);
      console.log(`  ${top.suggestion}`);
      console.log(`  Impact: ${top.expectedImpact}`);
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

// Run the test
testAIAnalyzer().catch(console.error);