/**
 * Enhanced OpenAI Integration
 * 
 * Supports OpenAI Assistant API with specific assistant ID
 * and improved code parsing capabilities
 */

import { Card, DeckCard } from '@prisma/client';
import { DeckAnalysisResult } from './types';
import { BasicDeckAnalysis } from './basic-deck-analyzer';
import { DeckAnalysisPayload, OpenAIReviewResponse } from './openai-analysis-reviewer';

export interface EnhancedOpenAIConfig {
  apiKey: string;
  assistantId: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface CodeImprovement {
  file: string;
  function?: string;
  lineRange?: { start: number; end: number };
  oldCode: string;
  newCode: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
}

export interface EnhancedReviewResponse extends OpenAIReviewResponse {
  codeImprovements: CodeImprovement[];
  testCases: Array<{
    description: string;
    code: string;
    expectedBehavior: string;
  }>;
  configurationChanges?: Array<{
    file: string;
    key: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }>;
}

/**
 * Parse code blocks from OpenAI response
 */
export function parseCodeBlocks(content: string): Array<{
  language: string;
  code: string;
  file?: string;
  description?: string;
}> {
  const codeBlocks: Array<{ language: string; code: string; file?: string; description?: string }> = [];
  
  // Match code blocks with optional file path comments
  const codeBlockRegex = /```(\w+)(?:\n\/\/\s*(?:file:|File:)\s*([^\n]+))?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1];
    const file = match[2]?.trim();
    const code = match[3].trim();
    
    // Look for description before the code block
    const beforeBlock = content.substring(0, match.index);
    const lastNewline = beforeBlock.lastIndexOf('\n');
    const description = beforeBlock.substring(lastNewline + 1).trim();
    
    codeBlocks.push({
      language,
      code,
      file,
      description: description || undefined
    });
  }
  
  return codeBlocks;
}

/**
 * Extract code improvements from parsed response
 */
export function extractCodeImprovements(response: any): CodeImprovement[] {
  const improvements: CodeImprovement[] = [];
  
  // Check if response has codeImprovements array
  if (response.codeImprovements && Array.isArray(response.codeImprovements)) {
    return response.codeImprovements;
  }
  
  // Otherwise try to extract from other fields
  if (response.suggestedImprovements) {
    response.suggestedImprovements.forEach((improvement: any) => {
      if (typeof improvement === 'object' && improvement.code) {
        improvements.push({
          file: improvement.file || 'unknown',
          function: improvement.function,
          lineRange: improvement.lineRange,
          oldCode: improvement.oldCode || '',
          newCode: improvement.code,
          description: improvement.description || improvement.text || '',
          priority: improvement.priority || 'medium',
          category: improvement.category || 'general'
        });
      }
    });
  }
  
  return improvements;
}

/**
 * Call OpenAI Assistant API (not regular chat completion)
 */
export async function callOpenAIAssistant(
  payload: DeckAnalysisPayload,
  config: EnhancedOpenAIConfig
): Promise<EnhancedReviewResponse> {
  try {
    // Create a thread
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    if (!threadResponse.ok) {
      const errorData = await threadResponse.text();
      console.error('Thread creation error:', errorData);
      throw new Error(`Failed to create thread: ${threadResponse.statusText} - ${errorData}`);
    }
    
    const thread = await threadResponse.json();
    
    // Add message to thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: JSON.stringify(payload)
      })
    });
    
    if (!messageResponse.ok) {
      const errorData = await messageResponse.text();
      console.error('Message creation error:', errorData);
      throw new Error(`Failed to add message: ${messageResponse.statusText} - ${errorData}`);
    }
    
    // Run the assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: config.assistantId
        // o3-mini doesn't support temperature/top_p parameters
      })
    });
    
    if (!runResponse.ok) {
      const errorData = await runResponse.text();
      console.error('Run creation error:', errorData);
      throw new Error(`Failed to run assistant: ${runResponse.statusText} - ${errorData}`);
    }
    
    const run = await runResponse.json();
    
    // Poll for completion
    let runStatus = run.status;
    while (runStatus === 'queued' || runStatus === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(
        `https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`,
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        }
      );
      
      const statusData = await statusResponse.json();
      runStatus = statusData.status;
      
      if (runStatus === 'failed' || runStatus === 'cancelled' || runStatus === 'expired') {
        throw new Error(`Assistant run ${runStatus}: ${statusData.last_error?.message}`);
      }
    }
    
    // Get messages
    const messagesResponse = await fetch(
      `https://api.openai.com/v1/threads/${thread.id}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );
    
    if (!messagesResponse.ok) {
      throw new Error(`Failed to get messages: ${messagesResponse.statusText}`);
    }
    
    const messages = await messagesResponse.json();
    
    // Get the assistant's response (most recent message from assistant)
    const assistantMessage = messages.data.find((msg: any) => msg.role === 'assistant');
    
    if (!assistantMessage) {
      throw new Error('No response from assistant');
    }
    
    // Extract content
    const content = assistantMessage.content[0]?.text?.value || '';
    
    // Try to parse as JSON first
    let parsedResponse: any;
    try {
      // Find JSON in the content (might be wrapped in markdown)
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : content;
      parsedResponse = JSON.parse(jsonContent);
    } catch {
      // If not JSON, parse code blocks and create structured response
      const codeBlocks = parseCodeBlocks(content);
      parsedResponse = {
        accuracyScore: 70, // Default score
        overallAssessment: 'See detailed analysis below',
        goodPoints: [],
        missedIssues: [],
        incorrectRecommendations: [],
        suggestedImprovements: [],
        codeImprovements: codeBlocks.map(block => ({
          file: block.file || 'unknown',
          oldCode: '',
          newCode: block.code,
          description: block.description || '',
          priority: 'medium',
          category: 'improvement'
        }))
      };
    }
    
    // Extract code improvements
    const codeImprovements = extractCodeImprovements(parsedResponse);
    
    // Extract test cases if present
    const testCases = parsedResponse.testCases || [];
    
    // Build enhanced response
    const enhancedResponse: EnhancedReviewResponse = {
      accuracyScore: parsedResponse.accuracyScore || 0,
      missedIssues: parsedResponse.missedIssues || [],
      incorrectRecommendations: parsedResponse.incorrectRecommendations || [],
      goodPoints: parsedResponse.goodPoints || [],
      overallAssessment: parsedResponse.overallAssessment || '',
      suggestedImprovements: parsedResponse.suggestedImprovements || [],
      codeImprovements,
      testCases,
      configurationChanges: parsedResponse.configurationChanges
    };
    
    return enhancedResponse;
    
  } catch (error) {
    console.error('Error calling OpenAI Assistant:', error);
    throw error;
  }
}

/**
 * Enhanced review function that uses the Assistant API
 */
export async function reviewAnalysisWithAssistant(
  deck: Array<DeckCard & { card: Card }>,
  analysis: DeckAnalysisResult | BasicDeckAnalysis,
  config: EnhancedOpenAIConfig
): Promise<EnhancedReviewResponse> {
  // Prepare comprehensive payload
  const analysisType = 'advice' in analysis ? 'basic' : 'advanced';
  
  // Create a detailed prompt with all analysis data
  let detailedPrompt = `Please review this Pokemon TCG deck analysis and provide detailed feedback on its accuracy and completeness.

DECK COMPOSITION:
${deck.map(dc => `${dc.quantity}x ${dc.card.name}`).join('\n')}

ANALYSIS TYPE: ${analysisType}

`;

  if (analysisType === 'basic') {
    const basicAnalysis = analysis as BasicDeckAnalysis;
    detailedPrompt += `BASIC ANALYSIS RESULTS:
Score: ${basicAnalysis.deckScore}/100
Overall Message: ${basicAnalysis.overallMessage}

ISSUES FOUND:
${basicAnalysis.advice.map(a => `
- ${a.icon} ${a.title} (${a.category})
  Message: ${a.message}
  ${a.tip ? `Tip: ${a.tip}` : ''}
  ${a.fixIt ? `Fix: ${a.fixIt}` : ''}
`).join('\n')}

${basicAnalysis.swapSuggestions?.length > 0 ? `SWAP SUGGESTIONS:
${basicAnalysis.swapSuggestions.map(s => `- Remove ${s.removeCard} → Add ${s.addCard} (${s.reason})`).join('\n')}` : ''}

${basicAnalysis.tradeSuggestions?.length > 0 ? `TRADE SUGGESTIONS:
${basicAnalysis.tradeSuggestions.map(t => `- Trade away ${t.tradeAway} for ${t.tradeFor}`).join('\n')}` : ''}
`;
  } else {
    const advAnalysis = analysis as DeckAnalysisResult;
    detailedPrompt += `ADVANCED ANALYSIS RESULTS:
Overall Score: ${advAnalysis.scores?.overall || 0}/100
Consistency: ${advAnalysis.scores?.consistency || 0}/100
Power: ${advAnalysis.scores?.power || 0}/100
Speed: ${advAnalysis.scores?.speed || 0}/100
Recovery: ${advAnalysis.scores?.recovery || 0}/100

ARCHETYPE: ${advAnalysis.archetype?.primaryArchetype || 'Unknown'} (${advAnalysis.archetype?.confidence || 0}% confidence)

CONSISTENCY METRICS:
- Mulligan Rate: ${advAnalysis.consistency?.mulliganProbability || 0}%
- Basic Count: ${advAnalysis.consistency?.basicPokemonCount || 0}
- Draw/Search Cards: ${advAnalysis.consistency?.drawSupportCount || 0}
- Energy Consistency: ${advAnalysis.consistency?.energyConsistency || 0}/10

WARNINGS:
${advAnalysis.warnings?.map(w => `
- [${w.severity}] ${w.category}: ${w.message}
  ${w.suggestion ? `Suggestion: ${w.suggestion}` : ''}
`).join('\n') || 'None'}

RECOMMENDATIONS:
${advAnalysis.recommendations?.cards?.map(r => `
- Add ${r.card.name}: ${r.reason} (Priority: ${r.priority})
`).join('\n') || 'None'}
`;
  }

  detailedPrompt += `
Please provide:
1. An accuracy score (0-100) for this analysis
2. What the analyzer correctly identified
3. Important issues the analyzer missed
4. Any incorrect recommendations
5. Specific suggestions to improve the analyzer's accuracy

Be specific and detailed in your feedback.`;

  // Send as a text message to the assistant
  const response = await fetch('https://api.openai.com/v1/threads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    }
  });
  
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to create thread: ${response.statusText} - ${errorData}`);
  }
  
  const thread = await response.json();
  
  // Add message with detailed prompt
  const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      role: 'user',
      content: detailedPrompt
    })
  });
  
  if (!messageResponse.ok) {
    throw new Error(`Failed to add message: ${messageResponse.statusText}`);
  }
  
  // Run the assistant
  const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      assistant_id: config.assistantId
    })
  });
  
  if (!runResponse.ok) {
    throw new Error(`Failed to run assistant: ${runResponse.statusText}`);
  }
  
  const run = await runResponse.json();
  
  // Poll for completion
  let runStatus = run.status;
  while (runStatus === 'queued' || runStatus === 'in_progress') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const statusResponse = await fetch(
      `https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );
    
    const statusData = await statusResponse.json();
    runStatus = statusData.status;
    
    if (runStatus === 'failed' || runStatus === 'cancelled' || runStatus === 'expired') {
      throw new Error(`Assistant run ${runStatus}: ${statusData.last_error?.message}`);
    }
  }
  
  // Get messages
  const messagesResponse = await fetch(
    `https://api.openai.com/v1/threads/${thread.id}/messages`,
    {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    }
  );
  
  const messages = await messagesResponse.json();
  const assistantMessage = messages.data.find((msg: any) => msg.role === 'assistant');
  
  if (!assistantMessage) {
    throw new Error('No response from assistant');
  }
  
  const content = assistantMessage.content[0]?.text?.value || '';
  
  // Parse the response to extract structured feedback
  const response = parseAssistantResponse(content);
  
  return {
    accuracyScore: response.accuracyScore || 70,
    missedIssues: response.missedIssues || [],
    incorrectRecommendations: response.incorrectRecommendations || [],
    goodPoints: response.goodPoints || [],
    overallAssessment: response.overallAssessment || content,
    suggestedImprovements: response.suggestedImprovements || [],
    codeImprovements: [],
    testCases: []
  };
}

/**
 * Parse assistant's text response into structured format
 */
function parseAssistantResponse(content: string): Partial<EnhancedReviewResponse> {
  const response: Partial<EnhancedReviewResponse> = {};
  
  // Try to extract accuracy score
  const scoreMatch = content.match(/accuracy\s*[:=]\s*(\d+)/i) || 
                     content.match(/score\s*[:=]\s*(\d+)/i) ||
                     content.match(/(\d+)\s*(?:%|\/100)/);
  if (scoreMatch) {
    response.accuracyScore = parseInt(scoreMatch[1]);
  }
  
  // Extract sections using common patterns
  const sections = content.split(/\n(?=[A-Z])/);
  
  sections.forEach(section => {
    const lowerSection = section.toLowerCase();
    
    if (lowerSection.includes('correctly identified') || lowerSection.includes('got right')) {
      response.goodPoints = extractBulletPoints(section);
    } else if (lowerSection.includes('missed') || lowerSection.includes('overlooked')) {
      response.missedIssues = extractBulletPoints(section).map(issue => ({
        issue,
        severity: determineSeverity(issue)
      }));
    } else if (lowerSection.includes('incorrect') || lowerSection.includes('wrong')) {
      response.incorrectRecommendations = extractBulletPoints(section).map(rec => ({
        recommendation: rec,
        correction: ''
      }));
    } else if (lowerSection.includes('suggestion') || lowerSection.includes('improve')) {
      response.suggestedImprovements = extractBulletPoints(section);
    }
  });
  
  // Use full content as overall assessment if not much was parsed
  if (!response.goodPoints?.length && !response.missedIssues?.length) {
    response.overallAssessment = content;
  }
  
  return response;
}

function extractBulletPoints(text: string): string[] {
  const lines = text.split('\n');
  const points: string[] = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+\.\s/)) {
      points.push(trimmed.replace(/^[-•*]\s/, '').replace(/^\d+\.\s/, ''));
    }
  });
  
  return points;
}

function determineSeverity(issue: string): 'critical' | 'high' | 'medium' | 'low' {
  const lower = issue.toLowerCase();
  if (lower.includes('critical') || lower.includes('major') || lower.includes('severe')) {
    return 'critical';
  } else if (lower.includes('high') || lower.includes('important')) {
    return 'high';
  } else if (lower.includes('low') || lower.includes('minor')) {
    return 'low';
  }
  return 'medium';
}

/**
 * Format code improvements for display
 */
export function formatCodeImprovements(improvements: CodeImprovement[]): string {
  const lines: string[] = ['📝 CODE IMPROVEMENTS', '===================', ''];
  
  // Group by priority
  const byPriority = improvements.reduce((acc, imp) => {
    if (!acc[imp.priority]) acc[imp.priority] = [];
    acc[imp.priority].push(imp);
    return acc;
  }, {} as Record<string, CodeImprovement[]>);
  
  const priorities: Array<keyof typeof byPriority> = ['critical', 'high', 'medium', 'low'];
  
  priorities.forEach(priority => {
    const imps = byPriority[priority];
    if (!imps || imps.length === 0) return;
    
    const emoji = priority === 'critical' ? '🔴' :
                  priority === 'high' ? '🟡' :
                  priority === 'medium' ? '🟢' : '⚪';
    
    lines.push(`${emoji} ${priority.toUpperCase()} Priority:`);
    lines.push('');
    
    imps.forEach((imp, idx) => {
      lines.push(`${idx + 1}. ${imp.description}`);
      lines.push(`   File: ${imp.file}`);
      if (imp.function) lines.push(`   Function: ${imp.function}`);
      lines.push('   ```typescript');
      lines.push(imp.newCode.split('\n').map(l => '   ' + l).join('\n'));
      lines.push('   ```');
      lines.push('');
    });
  });
  
  return lines.join('\n');
}