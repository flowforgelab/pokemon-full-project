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
        'OpenAI-Beta': 'assistants=v1'
      }
    });
    
    if (!threadResponse.ok) {
      throw new Error(`Failed to create thread: ${threadResponse.statusText}`);
    }
    
    const thread = await threadResponse.json();
    
    // Add message to thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'OpenAI-Beta': 'assistants=v1'
      },
      body: JSON.stringify({
        role: 'user',
        content: JSON.stringify(payload)
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
        'OpenAI-Beta': 'assistants=v1'
      },
      body: JSON.stringify({
        assistant_id: config.assistantId,
        temperature: config.temperature ?? 0.3,
        top_p: config.topP ?? 0.9,
        max_prompt_tokens: config.maxTokens
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
            'OpenAI-Beta': 'assistants=v1'
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
          'OpenAI-Beta': 'assistants=v1'
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
  // Prepare payload
  const analysisType = 'advice' in analysis ? 'basic' : 'advanced';
  const payload: DeckAnalysisPayload = {
    deckName: 'Test Deck',
    deckCards: deck.map(dc => ({
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
    })),
    analysisOutput: analysisType === 'basic' ? {
      score: (analysis as BasicDeckAnalysis).deckScore,
      issues: (analysis as BasicDeckAnalysis).advice.map(advice => ({
        category: advice.category,
        title: advice.title,
        message: advice.message,
        recommendation: advice.fixIt
      })),
      swapSuggestions: (analysis as BasicDeckAnalysis).swapSuggestions
    } : {
      score: (analysis as DeckAnalysisResult).scores?.overall || 0,
      issues: (analysis as DeckAnalysisResult).warnings?.map(w => ({
        category: w.severity,
        title: w.title || w.category,
        message: w.message,
        recommendation: w.suggestion
      })) || []
    },
    analysisType
  };
  
  return callOpenAIAssistant(payload, config);
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