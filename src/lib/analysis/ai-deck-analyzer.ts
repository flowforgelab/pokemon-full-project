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
 * Generate AI analysis using OpenAI
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
  
  // Use custom system prompt or default
  const systemPrompt = options.systemPrompt || `You are an expert Pokemon Trading Card Game analyst and coach. Analyze the provided deck and give comprehensive feedback. Return your analysis as a JSON object matching the AIDeckAnalysis interface structure. Be specific, actionable, and consider both competitive and casual perspectives.`;
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please analyze this Pokemon TCG deck:\n\n${deckData}` }
        ],
        temperature: options.temperature || 0.7,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    return parseAIAnalysis(aiResponse);
    
  } catch (error) {
    console.error('AI analysis error:', error);
    throw error;
  }
}