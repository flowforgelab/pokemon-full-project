/**
 * Test OpenAI Assistant API directly
 */

import { callOpenAIAssistant } from '../lib/analysis/openai-enhanced-integration';
import { noBasisDeck } from '../lib/analysis/test-decks';
import { analyzeBasicDeck } from '../lib/analysis/basic-deck-analyzer';
import { prepareDeckAnalysisPayload } from '../lib/analysis/openai-analysis-reviewer';

async function testAssistantAPI() {
  console.log('Testing OpenAI Assistant API...\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  const assistantId = 'asst_P2cUMxaYYnH1O6naiuRqAC72';
  
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY');
    return;
  }
  
  // Analyze a test deck
  const analysis = analyzeBasicDeck(noBasisDeck.cards);
  
  console.log('Deck:', noBasisDeck.name);
  console.log('Score:', analysis.deckScore);
  console.log('Issues found:', analysis.advice.length);
  
  // Prepare payload
  const payload = prepareDeckAnalysisPayload(
    noBasisDeck.name,
    noBasisDeck.cards,
    analysis,
    'basic'
  );
  
  console.log('\nCalling Assistant API...');
  console.log('Assistant ID:', assistantId);
  
  try {
    const response = await callOpenAIAssistant(payload, {
      apiKey,
      assistantId,
      temperature: 0.3,
      topP: 0.9
    });
    
    console.log('\nResponse received!');
    console.log('Accuracy Score:', response.accuracyScore);
    console.log('Overall Assessment:', response.overallAssessment);
    
    if (response.codeImprovements?.length > 0) {
      console.log('\nCode Improvements:');
      response.codeImprovements.forEach((imp, idx) => {
        console.log(`\n${idx + 1}. ${imp.description}`);
        console.log(`   File: ${imp.file}`);
        console.log(`   Priority: ${imp.priority}`);
        if (imp.newCode) {
          console.log(`   Code Preview: ${imp.newCode.substring(0, 100)}...`);
        }
      });
    }
    
  } catch (error) {
    console.error('\nError:', error);
    
    // Try to get more details
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Run test
testAssistantAPI().catch(console.error);