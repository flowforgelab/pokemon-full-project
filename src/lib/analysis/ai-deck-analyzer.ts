/**
 * AI-Powered Deck Analyzer
 * 
 * Uses OpenAI GPT-4 for comprehensive, conversational deck analysis.
 * Provides nuanced insights that go beyond rule-based analysis.
 */

import { Card, DeckCard } from '@prisma/client';
import { CURRENT_STANDARD_META } from './meta-context';

export interface AIDeckAnalysis {
  overallRating: number; // 0-100
  tierRating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  executiveSummary: string;
  
  strengths: Array<{
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  
  weaknesses: Array<{
    title: string;
    description: string;
    severity: 'critical' | 'major' | 'minor';
    suggestion: string;
  }>;
  
  synergyAnalysis: {
    rating: number; // 0-100
    combos: Array<{
      cards: string[];
      description: string;
      frequency: 'consistent' | 'situational' | 'rare';
    }>;
    antiSynergies: Array<{
      cards: string[];
      issue: string;
    }>;
  };
  
  matchupAnalysis: Array<{
    opponent: string;
    winRate: number; // 0-100
    keyFactors: string[];
    techCards?: string[];
  }>;
  
  improvements: Array<{
    priority: 'immediate' | 'short-term' | 'long-term';
    category: 'consistency' | 'power' | 'speed' | 'resilience' | 'tech';
    suggestion: string;
    cardChanges: {
      remove?: Array<{ card: string; quantity: number; reason: string }>;
      add?: Array<{ card: string; quantity: number; reason: string }>;
    };
    expectedImpact: string;
  }>;
  
  budgetConsiderations?: {
    currentValue: number;
    budgetTier: 'budget' | 'mid-range' | 'competitive' | 'premium';
    upgradePath: Array<{
      step: number;
      cost: number;
      changes: string[];
      impact: string;
    }>;
  };
  
  playStyleNotes: {
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    keyPlays: string[];
    commonMistakes: string[];
    mulliganStrategy: string;
  };
  
  formatPositioning: {
    metaRelevance: 'tier1' | 'tier2' | 'tier3' | 'rogue' | 'casual';
    currentTrends: string[];
    futureOutlook: string;
  };
}

/**
 * Prepare deck data for AI analysis
 */
export function prepareDeckForAI(
  cards: Array<DeckCard & { card: Card }>,
  deckName: string = 'Unnamed Deck',
  format: 'STANDARD' | 'EXPANDED' = 'STANDARD'
): string {
  // Group cards by category
  const pokemon = cards.filter(dc => dc.card.supertype === 'POKEMON');
  const trainers = cards.filter(dc => dc.card.supertype === 'TRAINER');
  const energy = cards.filter(dc => dc.card.supertype === 'ENERGY');
  
  // Create structured deck list
  let deckList = `DECK NAME: ${deckName}\n`;
  deckList += `FORMAT: ${format}\n`;
  deckList += `TOTAL CARDS: ${cards.reduce((sum, dc) => sum + dc.quantity, 0)}\n\n`;
  
  // Pokemon section
  deckList += `POKEMON (${pokemon.reduce((sum, dc) => sum + dc.quantity, 0)}):\n`;
  pokemon.forEach(dc => {
    const c = dc.card;
    const types = c.types?.join('/') || 'Colorless';
    const stage = c.subtypes?.find(s => s.includes('Stage')) || 
                  (c.evolvesFrom ? 'Stage 1' : 'Basic');
    
    deckList += `${dc.quantity}x ${c.name} - ${types} - ${stage}`;
    if (c.hp) deckList += ` - HP: ${c.hp}`;
    if (c.abilities && c.abilities.length > 0) {
      deckList += ` - Ability: ${c.abilities[0].name}`;
    }
    if (c.attacks && c.attacks.length > 0) {
      const mainAttack = c.attacks[c.attacks.length - 1];
      deckList += ` - Attack: ${mainAttack.name} (${mainAttack.damage || '?'})`;
    }
    deckList += '\n';
  });
  
  // Trainers section
  deckList += `\nTRAINERS (${trainers.reduce((sum, dc) => sum + dc.quantity, 0)}):\n`;
  trainers.forEach(dc => {
    const subtype = dc.card.subtypes?.[0] || 'Item';
    deckList += `${dc.quantity}x ${dc.card.name} - ${subtype}\n`;
  });
  
  // Energy section
  deckList += `\nENERGY (${energy.reduce((sum, dc) => sum + dc.quantity, 0)}):\n`;
  energy.forEach(dc => {
    const subtype = dc.card.subtypes?.includes('Special') ? 'Special' : 'Basic';
    deckList += `${dc.quantity}x ${dc.card.name} - ${subtype}\n`;
  });
  
  // Add current meta context
  deckList += '\n\nCURRENT META CONTEXT:\n';
  deckList += `Top Decks: ${CURRENT_STANDARD_META.topDecks.slice(0, 5).map(d => d.name).join(', ')}\n`;
  deckList += `Speed: ${CURRENT_STANDARD_META.speed} (${CURRENT_STANDARD_META.averageGameLength})\n`;
  
  return deckList;
}

/**
 * Parse AI response into structured analysis
 */
export function parseAIAnalysis(aiResponse: string): AIDeckAnalysis {
  // This is a fallback parser - ideally the AI should return structured JSON
  // But this handles free-form responses as well
  
  const analysis: AIDeckAnalysis = {
    overallRating: 50,
    tierRating: 'C',
    executiveSummary: '',
    strengths: [],
    weaknesses: [],
    synergyAnalysis: {
      rating: 50,
      combos: [],
      antiSynergies: []
    },
    matchupAnalysis: [],
    improvements: [],
    playStyleNotes: {
      difficulty: 'intermediate',
      keyPlays: [],
      commonMistakes: [],
      mulliganStrategy: ''
    },
    formatPositioning: {
      metaRelevance: 'casual',
      currentTrends: [],
      futureOutlook: ''
    }
  };
  
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(aiResponse);
    return { ...analysis, ...parsed };
  } catch {
    // Fall back to text parsing
    const lines = aiResponse.split('\n');
    let currentSection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Detect sections
      if (trimmed.includes('OVERALL RATING:') || trimmed.includes('Rating:')) {
        const match = trimmed.match(/(\d+)/);
        if (match) analysis.overallRating = parseInt(match[1]);
      } else if (trimmed.includes('TIER:')) {
        const tierMatch = trimmed.match(/TIER:\s*([SABCDF])/i);
        if (tierMatch) analysis.tierRating = tierMatch[1].toUpperCase() as any;
      } else if (trimmed.toUpperCase().includes('SUMMARY')) {
        currentSection = 'summary';
      } else if (trimmed.toUpperCase().includes('STRENGTH')) {
        currentSection = 'strengths';
      } else if (trimmed.toUpperCase().includes('WEAKNESS')) {
        currentSection = 'weaknesses';
      } else if (trimmed.toUpperCase().includes('IMPROVEMENT')) {
        currentSection = 'improvements';
      } else if (trimmed.toUpperCase().includes('MATCHUP')) {
        currentSection = 'matchups';
      } else {
        // Add content to appropriate section
        switch (currentSection) {
          case 'summary':
            if (!trimmed.toUpperCase().includes('SUMMARY')) {
              analysis.executiveSummary += trimmed + ' ';
            }
            break;
          case 'strengths':
            if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
              analysis.strengths.push({
                title: trimmed.substring(1).trim(),
                description: '',
                impact: 'medium'
              });
            }
            break;
          case 'weaknesses':
            if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
              analysis.weaknesses.push({
                title: trimmed.substring(1).trim(),
                description: '',
                severity: 'major',
                suggestion: ''
              });
            }
            break;
        }
      }
    }
    
    analysis.executiveSummary = analysis.executiveSummary.trim();
  }
  
  return analysis;
}

/**
 * Generate AI analysis using OpenAI Assistant API
 */
export async function analyzeWithAI(
  cards: Array<DeckCard & { card: Card }>,
  deckName: string,
  options: {
    apiKey: string;
    model?: string;
    temperature?: number;
    systemPrompt?: string;
  }
): Promise<AIDeckAnalysis> {
  const deckData = prepareDeckForAI(cards, deckName);
  
  // Build the full prompt including all context
  let fullPrompt = `Please analyze this Pokemon TCG deck:\n\n${deckData}`;
  
  // Extract age context if present
  if (options.systemPrompt && options.systemPrompt.includes('USER AGE CONTEXT:')) {
    const ageSection = options.systemPrompt.split('USER AGE CONTEXT:')[1].split('FOCUS AREAS:')[0];
    // Put age instructions at the very beginning and make them very clear
    fullPrompt = `🚨 CRITICAL INSTRUCTION 🚨\n${ageSection.trim()}\n\nREMEMBER: You MUST follow the age-appropriate language guidelines above!\n\n${fullPrompt}`;
  }
  
  // Add focus areas if present
  if (options.systemPrompt && options.systemPrompt.includes('FOCUS AREAS:')) {
    fullPrompt += '\n\n' + options.systemPrompt.split('FOCUS AREAS:')[1];
  }
  
  try {
    // Use the OpenAI Assistant API
    const assistantId = 'asst_6zlH4JsbKRq10am9JTAULmRP';
    
    // Validate API key
    if (!options.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    // Create a thread
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    if (!threadResponse.ok) {
      const errorData = await threadResponse.json().catch(() => ({}));
      console.error('Thread creation error:', errorData);
      throw new Error(`Failed to create thread: ${threadResponse.statusText} - ${JSON.stringify(errorData)}`);
    }
    
    const thread = await threadResponse.json();
    
    // Add message to thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        role: 'user',
        content: fullPrompt
      })
    });
    
    if (!messageResponse.ok) {
      const errorData = await messageResponse.json().catch(() => ({}));
      console.error('Message creation error:', errorData);
      throw new Error(`Failed to add message: ${messageResponse.statusText} - ${JSON.stringify(errorData)}`);
    }
    
    // Run the assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: assistantId
        // Note: model and temperature are configured on the assistant itself
      })
    });
    
    if (!runResponse.ok) {
      const errorData = await runResponse.json().catch(() => ({}));
      console.error('Assistant run error:', errorData);
      throw new Error(`Failed to run assistant: ${runResponse.statusText} - ${JSON.stringify(errorData)}`);
    }
    
    const run = await runResponse.json();
    
    // Poll for completion with timeout
    let runStatus = run;
    const maxAttempts = 60; // 60 seconds timeout
    let attempts = 0;
    
    while (runStatus.status !== 'completed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      const statusResponse = await fetch(
        `https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`,
        {
          headers: {
            'Authorization': `Bearer ${options.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        }
      );
      
      if (!statusResponse.ok) {
        const errorData = await statusResponse.json().catch(() => ({}));
        throw new Error(`Failed to check run status: ${statusResponse.statusText} - ${JSON.stringify(errorData)}`);
      }
      
      runStatus = await statusResponse.json();
      console.log(`Run status: ${runStatus.status} (attempt ${attempts})`);
      
      if (runStatus.status === 'failed' || runStatus.status === 'cancelled') {
        console.error('Run failed:', runStatus);
        throw new Error(`Assistant run ${runStatus.status}: ${runStatus.last_error?.message || 'Unknown error'}`);
      }
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('Assistant run timed out after 60 seconds');
    }
    
    // Get messages
    const messagesResponse = await fetch(
      `https://api.openai.com/v1/threads/${thread.id}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );
    
    if (!messagesResponse.ok) {
      throw new Error(`Failed to get messages: ${messagesResponse.statusText}`);
    }
    
    const messages = await messagesResponse.json();
    const assistantMessage = messages.data.find((m: any) => m.role === 'assistant');
    
    if (!assistantMessage || !assistantMessage.content[0] || assistantMessage.content[0].type !== 'text') {
      throw new Error('No response from assistant');
    }
    
    const aiResponse = assistantMessage.content[0].text.value;
    
    return parseAIAnalysis(aiResponse);
    
  } catch (error) {
    console.error('AI analysis error:', error);
    throw error;
  }
}