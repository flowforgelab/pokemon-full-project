/**
 * Basic test of feedback loop without Assistant API
 */

import { analyzeBasicDeck } from '../lib/analysis/basic-deck-analyzer';
import { noBasisDeck } from '../lib/analysis/test-decks';
import { prepareDeckAnalysisPayload, reviewAnalysisWithOpenAI } from '../lib/analysis/openai-analysis-reviewer';

async function testBasicFeedback() {
  console.log('Testing feedback loop with standard OpenAI API...\n');
  
  // Analyze a test deck
  const analysis = analyzeBasicDeck(noBasisDeck.cards);
  
  console.log('Deck:', noBasisDeck.name);
  console.log('Score:', analysis.deckScore);
  console.log('Issues found:', analysis.advice.length);
  console.log('\nSending to OpenAI for review...\n');
  
  // Prepare payload
  const payload = prepareDeckAnalysisPayload(
    noBasisDeck.name,
    noBasisDeck.cards,
    analysis,
    'basic'
  );
  
  try {
    // Use standard chat completion
    const review = await reviewAnalysisWithOpenAI(
      payload,
      process.env.OPENAI_API_KEY || '',
      undefined,
      { 
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 1500
      }
    );
    
    console.log('Review received!');
    console.log('Raw response:', JSON.stringify(review, null, 2));
    console.log('Accuracy Score:', review.accuracyScore);
    console.log('\nOverall Assessment:', review.overallAssessment);
    
    if (review.goodPoints.length > 0) {
      console.log('\nGood Points:');
      review.goodPoints.forEach(point => console.log('  ✓', point));
    }
    
    if (review.missedIssues.length > 0) {
      console.log('\nMissed Issues:');
      review.missedIssues.forEach(issue => {
        console.log(`  ❌ ${issue.issue} (${issue.severity})`);
        console.log(`     → ${issue.suggestion}`);
      });
    }
    
    if (review.suggestedImprovements.length > 0) {
      console.log('\nSuggested Improvements:');
      review.suggestedImprovements.forEach(imp => console.log('  •', imp));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run with env vars loaded
testBasicFeedback().catch(console.error);