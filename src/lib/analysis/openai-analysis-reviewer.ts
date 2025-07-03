/**
 * OpenAI Analysis Reviewer
 * 
 * Integrates with OpenAI API to review deck analysis quality
 * and provide expert feedback on the analyzer's recommendations
 */

import { Card, DeckCard } from '@prisma/client';
import type { BasicDeckAnalysis } from './basic-deck-analyzer';
import type { DeckAnalysis } from './deck-analyzer';

export interface OpenAIReviewResponse {
  accuracyScore: number; // 0-100
  missedIssues: Array<{
    issue: string;
    severity: 'critical' | 'major' | 'minor';
    suggestion: string;
  }>;
  incorrectRecommendations: Array<{
    recommendation: string;
    reason: string;
    betterSuggestion: string;
  }>;
  goodPoints: string[];
  overallAssessment: string;
  suggestedImprovements: string[];
}

export interface DeckAnalysisPayload {
  deckName: string;
  deckCards: Array<{
    name: string;
    quantity: number;
    type: string;
    subtype?: string;
    hp?: string;
    evolvesFrom?: string;
    abilities?: Array<{ name: string; text: string }>;
    attacks?: Array<{ name: string; cost: string[]; damage: string }>;
  }>;
  analysisOutput: {
    score: number;
    issues: Array<{
      category: string;
      title: string;
      message: string;
      recommendation?: string;
    }>;
    swapSuggestions?: Array<{
      remove: Array<{ name: string; quantity: number; reason: string }>;
      add: Array<{ name: string; quantity: number; reason: string }>;
    }>;
  };
  analysisType: 'basic' | 'advanced';
}

/**
 * Prepare deck data for OpenAI review
 */
export function prepareDeckAnalysisPayload(
  deckName: string,
  cards: Array<DeckCard & { card: Card }>,
  analysis: BasicDeckAnalysis | DeckAnalysis,
  analysisType: 'basic' | 'advanced' = 'basic'
): DeckAnalysisPayload {
  // Transform cards into a simpler format
  const deckCards = cards.map(dc => ({
    name: dc.card.name,
    quantity: dc.quantity,
    type: dc.card.supertype,
    subtype: dc.card.subtypes?.join(', '),
    hp: dc.card.hp || undefined,
    evolvesFrom: dc.card.evolvesFrom || undefined,
    abilities: dc.card.abilities?.map(a => ({
      name: a.name,
      text: a.text || ''
    })),
    attacks: dc.card.attacks?.map(a => ({
      name: a.name,
      cost: a.cost || [],
      damage: a.damage || '0'
    }))
  }));

  // Transform analysis output
  let analysisOutput: DeckAnalysisPayload['analysisOutput'];
  
  if (analysisType === 'basic' && 'advice' in analysis) {
    const basicAnalysis = analysis as BasicDeckAnalysis;
    analysisOutput = {
      score: basicAnalysis.deckScore,
      issues: basicAnalysis.advice.map(advice => ({
        category: advice.category,
        title: advice.title,
        message: advice.message,
        recommendation: advice.fixIt
      })),
      swapSuggestions: basicAnalysis.swapSuggestions?.map(swap => ({
        remove: swap.remove,
        add: swap.add.map(a => ({
          name: a.name,
          quantity: a.quantity,
          reason: a.why
        }))
      }))
    };
  } else {
    const advancedAnalysis = analysis as DeckAnalysis;
    analysisOutput = {
      score: advancedAnalysis.scores?.overall || 0,
      issues: advancedAnalysis.warnings?.map(warning => ({
        category: warning.severity,
        title: warning.title,
        message: warning.message,
        recommendation: warning.suggestion
      })) || []
    };
  }

  return {
    deckName,
    deckCards,
    analysisOutput,
    analysisType
  };
}

export interface OpenAIModelConfig {
  model: 'gpt-4.1-mini' | 'gpt-4o-mini' | 'gpt-4o' | 'gpt-4-turbo';
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  assistantId?: string; // Optional: Use Assistant API instead of chat completion
}

/**
 * Call OpenAI API to review the analysis
 * 
 * @param payload - The deck and analysis data
 * @param apiKey - OpenAI API key
 * @param systemPrompt - System prompt (ignored if using assistant)
 * @param modelConfig - Model configuration including optional assistantId
 */
export async function reviewAnalysisWithOpenAI(
  payload: DeckAnalysisPayload,
  apiKey: string,
  systemPrompt?: string,
  modelConfig?: Partial<OpenAIModelConfig>
): Promise<OpenAIReviewResponse> {
  // If assistant ID is provided, use the enhanced integration
  if (modelConfig?.assistantId) {
    const { reviewAnalysisWithAssistant } = await import('./openai-enhanced-integration');
    const result = await reviewAnalysisWithAssistant(
      [], // Note: This would need the actual deck cards
      { deckScore: payload.analysisOutput.score } as any,
      {
        apiKey,
        assistantId: modelConfig.assistantId,
        temperature: modelConfig.temperature,
        topP: modelConfig.topP,
        maxTokens: modelConfig.maxTokens
      }
    );
    
    // Convert enhanced response to basic response
    return {
      accuracyScore: result.accuracyScore,
      missedIssues: result.missedIssues,
      incorrectRecommendations: result.incorrectRecommendations,
      goodPoints: result.goodPoints,
      overallAssessment: result.overallAssessment,
      suggestedImprovements: result.suggestedImprovements
    };
  }
  const defaultSystemPrompt = `You are an expert Pokemon TCG deck analyst reviewer. Your job is to evaluate how well a deck analysis tool performed its analysis.

You will receive:
1. The deck composition (cards and quantities)
2. The analysis output from the tool

Your task is to:
1. Identify any issues the analyzer missed
2. Spot incorrect or harmful recommendations
3. Note what the analyzer did well
4. Suggest improvements

Consider:
- Evolution line balance
- Energy requirements vs energy provided
- Draw/search engine adequacy
- Prize trade economics
- Meta relevance
- Card synergies
- Format legality
- Budget considerations

Return your assessment in the specified JSON format.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig?.model || 'gpt-4.1-mini', // Default to GPT-4.1 mini
        messages: [
          {
            role: 'system',
            content: systemPrompt || defaultSystemPrompt
          },
          {
            role: 'user',
            content: JSON.stringify(payload)
          }
        ],
        response_format: { type: 'json_object' },
        temperature: modelConfig?.temperature ?? 0.3,
        max_tokens: modelConfig?.maxTokens ?? 1500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const reviewContent = data.choices[0]?.message?.content;
    
    if (!reviewContent) {
      throw new Error('No response content from OpenAI');
    }

    return JSON.parse(reviewContent) as OpenAIReviewResponse;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Format OpenAI review for display
 */
export function formatOpenAIReview(review: OpenAIReviewResponse): string {
  const lines: string[] = [];
  
  lines.push('🤖 AI ANALYSIS REVIEW');
  lines.push('====================');
  lines.push(`Accuracy Score: ${review.accuracyScore}/100`);
  lines.push('');
  lines.push(`📝 Overall Assessment: ${review.overallAssessment}`);
  lines.push('');
  
  if (review.goodPoints.length > 0) {
    lines.push('✅ What the Analyzer Did Well:');
    review.goodPoints.forEach(point => {
      lines.push(`   • ${point}`);
    });
    lines.push('');
  }
  
  if (review.missedIssues.length > 0) {
    lines.push('❌ Missed Issues:');
    review.missedIssues.forEach(issue => {
      const severityEmoji = 
        issue.severity === 'critical' ? '🔴' :
        issue.severity === 'major' ? '🟡' : '🟢';
      lines.push(`   ${severityEmoji} ${issue.issue}`);
      lines.push(`      → Suggestion: ${issue.suggestion}`);
    });
    lines.push('');
  }
  
  if (review.incorrectRecommendations.length > 0) {
    lines.push('⚠️  Incorrect Recommendations:');
    review.incorrectRecommendations.forEach(rec => {
      lines.push(`   • ${rec.recommendation}`);
      lines.push(`     Why it's wrong: ${rec.reason}`);
      lines.push(`     Better: ${rec.betterSuggestion}`);
    });
    lines.push('');
  }
  
  if (review.suggestedImprovements.length > 0) {
    lines.push('💡 Suggested Improvements for the Analyzer:');
    review.suggestedImprovements.forEach(imp => {
      lines.push(`   • ${imp}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Create a React-friendly version of the review
 */
export function formatOpenAIReviewForUI(review: OpenAIReviewResponse) {
  return {
    accuracyScore: review.accuracyScore,
    scoreColor: 
      review.accuracyScore >= 80 ? 'green' :
      review.accuracyScore >= 60 ? 'yellow' : 'red',
    summary: review.overallAssessment,
    sections: [
      {
        title: 'What Worked Well',
        type: 'success',
        items: review.goodPoints
      },
      {
        title: 'Missed Issues',
        type: 'error',
        items: review.missedIssues.map(issue => ({
          text: issue.issue,
          severity: issue.severity,
          detail: issue.suggestion
        }))
      },
      {
        title: 'Incorrect Recommendations',
        type: 'warning',
        items: review.incorrectRecommendations.map(rec => ({
          text: rec.recommendation,
          detail: `${rec.reason}. Better: ${rec.betterSuggestion}`
        }))
      },
      {
        title: 'Improvement Suggestions',
        type: 'info',
        items: review.suggestedImprovements.map(imp => ({ text: imp }))
      }
    ].filter(section => section.items.length > 0)
  };
}