/**
 * Test script for OpenAI deck analysis review
 * 
 * This demonstrates how to use the OpenAI integration
 * to review deck analysis quality
 */

import { analyzeBasicDeck } from '../lib/analysis/basic-deck-analyzer';
import { prepareDeckAnalysisPayload } from '../lib/analysis/openai-analysis-reviewer';
import { BASIC_ANALYZER_REVIEW_PROMPT } from '../lib/analysis/review-system-prompts';
import { Card, DeckCard } from '@prisma/client';

// Use the same Rayquaza deck from previous tests
const rayquazaDeck: Array<DeckCard & { card: Card }> = [
  // Pokemon (19)
  { id: '1', deckId: '1', cardId: '1', quantity: 2, card: { id: '1', name: 'Rayquaza-GX', supertype: 'POKEMON', subtypes: ['GX'], types: ['Dragon'], hp: '180', evolvesFrom: null, attacks: [{ name: 'Dragon Break', damage: '30x', cost: ['Grass', 'Lightning'] }], weaknesses: null, resistances: null, retreatCost: ['Colorless', 'Colorless', 'Colorless'], setId: '1', tcgplayerPurchaseUrl: null, number: '1', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '2', deckId: '1', cardId: '2', quantity: 2, card: { id: '2', name: 'Vikavolt', supertype: 'POKEMON', subtypes: ['Stage 2'], types: ['Lightning'], hp: '150', evolvesFrom: 'Charjabug', attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '2', artist: '', rarity: 'Rare', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: [{ name: 'Strong Charge', text: 'Once during your turn, you may search your deck for a Grass Energy and a Lightning Energy and attach them to your Pokemon.', type: 'Ability' }] } as Card },
  { id: '3', deckId: '1', cardId: '3', quantity: 1, card: { id: '3', name: 'Charjabug', supertype: 'POKEMON', subtypes: ['Stage 1'], types: ['Lightning'], hp: '80', evolvesFrom: 'Grubbin', attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '3', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '4', deckId: '1', cardId: '4', quantity: 3, card: { id: '4', name: 'Grubbin', supertype: 'POKEMON', subtypes: [], types: ['Lightning'], hp: '60', evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '4', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  
  // ... Additional cards would go here ...
  
  // Trainers (26)
  { id: '11', deckId: '1', cardId: '11', quantity: 2, card: { id: '11', name: 'Cynthia', supertype: 'TRAINER', subtypes: ['Supporter'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '11', artist: '', rarity: 'Uncommon', flavorText: null, nationalPokedexNumbers: [], rules: ['Shuffle your hand into your deck. Then, draw 6 cards.'], abilities: null } as Card },
  
  // Energy (15)
  { id: '24', deckId: '1', cardId: '24', quantity: 5, card: { id: '24', name: 'Grass Energy', supertype: 'ENERGY', subtypes: ['Basic'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '24', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card },
  { id: '25', deckId: '1', cardId: '25', quantity: 10, card: { id: '25', name: 'Lightning Energy', supertype: 'ENERGY', subtypes: ['Basic'], types: null, hp: null, evolvesFrom: null, attacks: null, weaknesses: null, resistances: null, retreatCost: null, setId: '1', tcgplayerPurchaseUrl: null, number: '25', artist: '', rarity: 'Common', flavorText: null, nationalPokedexNumbers: [], rules: null, abilities: null } as Card }
];

async function testOpenAIReview() {
  console.log('========================================');
  console.log('OPENAI ANALYSIS REVIEW TEST');
  console.log('========================================\n');

  // Step 1: Run the basic analyzer
  console.log('1. Running basic deck analysis...');
  const analysis = analyzeBasicDeck(rayquazaDeck);
  console.log(`   Score: ${analysis.deckScore}/100`);
  console.log(`   Issues found: ${analysis.advice.length}\n`);

  // Step 2: Prepare the payload for OpenAI
  console.log('2. Preparing payload for OpenAI review...');
  const payload = prepareDeckAnalysisPayload(
    'Rayquaza Test Deck',
    rayquazaDeck,
    analysis,
    'basic'
  );
  
  console.log('   Payload structure:');
  console.log(`   - Deck cards: ${payload.deckCards.length} unique cards`);
  console.log(`   - Analysis score: ${payload.analysisOutput.score}`);
  console.log(`   - Issues reported: ${payload.analysisOutput.issues.length}\n`);

  // Step 3: Show what would be sent to OpenAI
  console.log('3. Example API call configuration:');
  console.log('   Model: gpt-4.1-mini (recommended)');
  console.log('   Estimated tokens:');
  console.log(`   - Input: ~${JSON.stringify(payload).length / 4} tokens`);
  console.log('   - Output: ~500 tokens');
  console.log(`   - Estimated cost: ~$0.0016 per review\n`);

  // Step 4: Show example request
  console.log('4. Example API request:');
  console.log('```typescript');
  console.log('const review = await reviewAnalysisWithOpenAI(');
  console.log('  payload,');
  console.log('  process.env.OPENAI_API_KEY,');
  console.log('  BASIC_ANALYZER_REVIEW_PROMPT,');
  console.log('  { model: "gpt-4.1-mini", temperature: 0.3 }');
  console.log(');');
  console.log('```\n');

  // Step 5: Show expected response format
  console.log('5. Expected response format:');
  const exampleResponse = {
    accuracyScore: 75,
    overallAssessment: "The analyzer correctly identified evolution line issues but missed energy acceleration from Vikavolt's ability.",
    goodPoints: [
      "Detected 2 Vikavolt with only 1 Charjabug",
      "Recognized high special Pokemon count",
      "Properly allowed unlimited basic energy"
    ],
    missedIssues: [
      {
        issue: "Vikavolt has Strong Charge ability for energy acceleration",
        severity: "major" as const,
        suggestion: "Check Pokemon abilities before warning about slow energy"
      }
    ],
    incorrectRecommendations: [
      {
        recommendation: "Remove Rayquaza-GX",
        reason: "It's the main attacker of the deck",
        betterSuggestion: "Remove weaker Prism Star Pokemon instead"
      }
    ],
    suggestedImprovements: [
      "Add ability text parsing for energy acceleration",
      "Consider deck archetype when suggesting removals"
    ]
  };
  
  console.log(JSON.stringify(exampleResponse, null, 2));

  console.log('\n========================================');
  console.log('To use this in your app:');
  console.log('1. Add OPENAI_API_KEY to .env.local');
  console.log('2. Use the AnalysisReview component');
  console.log('3. Call requestReview() from useAnalysisReview hook');
  console.log('========================================');
}

// Run the test
testOpenAIReview().catch(console.error);