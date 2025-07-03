/**
 * Simple test of the feedback loop with just one deck
 */

import { AnalyzerImprovementSystem } from '../lib/analysis/feedback-loop/analyzer-improvement-system';
import { loadConfig } from '../lib/analysis/feedback-loop/config';
import { noBasisDeck } from '../lib/analysis/test-decks';
import { analyzeBasicDeck } from '../lib/analysis/basic-deck-analyzer';

async function testSimpleFeedback() {
  console.log('Simple Feedback Loop Test\n');
  
  // Load config
  const config = loadConfig();
  console.log('Using Assistant ID:', config.openAI.assistantId);
  
  // Create system
  const system = new AnalyzerImprovementSystem(config);
  
  // Analyze one deck
  console.log('\n1. Analyzing deck:', noBasisDeck.name);
  const analysis = analyzeBasicDeck(noBasisDeck.cards);
  console.log('   Score:', analysis.deckScore);
  console.log('   Issues:', analysis.advice.length);
  
  // Get suggestions from OpenAI
  console.log('\n2. Getting suggestions from OpenAI Assistant...');
  
  try {
    const testResult = {
      deckId: noBasisDeck.id,
      deckName: noBasisDeck.name,
      category: noBasisDeck.category,
      passedChecks: [],
      failedChecks: ['Deck has 0 Basic Pokemon'],
      unexpectedIssues: [],
      missedIssues: noBasisDeck.expectedIssues,
      scoreInRange: false,
      actualScore: analysis.deckScore,
      accuracy: 0
    };
    
    // @ts-ignore - accessing private method for testing
    const response = await system.getOpenAISuggestions(noBasisDeck, testResult);
    
    console.log('\n3. Response received!');
    console.log('   Accuracy Score:', response.accuracyScore);
    console.log('   Code Improvements:', response.codeImprovements.length);
    
    if (response.codeImprovements.length > 0) {
      console.log('\n4. First improvement:');
      const first = response.codeImprovements[0];
      console.log('   Description:', first.description);
      console.log('   File:', first.file);
      console.log('   Priority:', first.priority);
      console.log('   Code length:', first.newCode.length, 'chars');
    }
    
    console.log('\n✅ Success! The feedback loop is working with o3-mini!');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

// Run test
testSimpleFeedback().catch(console.error);