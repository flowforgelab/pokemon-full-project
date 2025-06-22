import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/prisma';
import { DeckAnalyzer } from '@/lib/analysis/deck-analyzer';
import type { AnalysisConfig, DeckAnalysisResult } from '@/lib/analysis/types';

interface ComparisonResult {
  deckA: {
    id: string;
    name: string;
    scores: any;
    archetype: string;
  };
  deckB: {
    id: string;
    name: string;
    scores: any;
    archetype: string;
  };
  comparison: {
    overallWinner: string;
    categoryWinners: Record<string, string>;
    headToHead: {
      winRate: number;
      keyFactors: string[];
      strategy: string;
    };
    recommendations: string[];
  };
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { deckIdA, deckIdB, format = 'standard' } = body;

    if (!deckIdA || !deckIdB) {
      return NextResponse.json(
        { error: 'Both deck IDs are required' },
        { status: 400 }
      );
    }

    // Fetch both decks
    const [deckA, deckB] = await Promise.all([
      prisma.deck.findUnique({
        where: { id: deckIdA },
        include: {
          cards: { include: { card: true } },
          user: { select: { id: true, clerkUserId: true } },
        },
      }),
      prisma.deck.findUnique({
        where: { id: deckIdB },
        include: {
          cards: { include: { card: true } },
          user: { select: { id: true, clerkUserId: true } },
        },
      }),
    ]);

    // Validate decks exist and user has access
    if (!deckA || !deckB) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    const hasAccessA = deckA.isPublic || deckA.user.clerkUserId === session.userId;
    const hasAccessB = deckB.isPublic || deckB.user.clerkUserId === session.userId;

    if (!hasAccessA || !hasAccessB) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Analyze both decks
    const analyzer = new DeckAnalyzer({ format, includeRotation: true });
    const [analysisA, analysisB] = await Promise.all([
      analyzer.analyzeDeck(deckA),
      analyzer.analyzeDeck(deckB),
    ]);

    // Compare results
    const comparison = compareDecks(deckA, deckB, analysisA, analysisB);

    return NextResponse.json({ comparison });
  } catch (error) {
    console.error('Deck comparison error:', error);
    return NextResponse.json(
      { error: 'Failed to compare decks' },
      { status: 500 }
    );
  }
}

function compareDecks(
  deckA: any,
  deckB: any,
  analysisA: DeckAnalysisResult,
  analysisB: DeckAnalysisResult
): ComparisonResult {
  // Determine category winners
  const categoryWinners: Record<string, string> = {};
  const categories = ['consistency', 'power', 'speed', 'versatility', 'metaRelevance'];

  let deckAWins = 0;
  let deckBWins = 0;

  categories.forEach(category => {
    const scoreA = analysisA.scores[category as keyof typeof analysisA.scores];
    const scoreB = analysisB.scores[category as keyof typeof analysisB.scores];
    
    if (scoreA > scoreB) {
      categoryWinners[category] = deckA.name;
      deckAWins++;
    } else if (scoreB > scoreA) {
      categoryWinners[category] = deckB.name;
      deckBWins++;
    } else {
      categoryWinners[category] = 'Tie';
    }
  });

  const overallWinner = analysisA.scores.overall > analysisB.scores.overall ? deckA.name :
                       analysisB.scores.overall > analysisA.scores.overall ? deckB.name : 'Tie';

  // Head-to-head matchup simulation
  const headToHead = simulateMatchup(analysisA, analysisB);

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (analysisA.scores.overall < analysisB.scores.overall) {
    recommendations.push(`${deckA.name} could improve by adopting some of ${deckB.name}'s strategies`);
  }
  
  if (analysisA.archetype.primaryArchetype === analysisB.archetype.primaryArchetype) {
    recommendations.push('Both decks share the same archetype - consider differentiating strategies');
  }

  // Specific improvement suggestions
  if (analysisA.scores.consistency < analysisB.scores.consistency - 20) {
    recommendations.push(`${deckA.name} needs better consistency cards`);
  }
  
  if (analysisA.scores.speed < analysisB.scores.speed - 20) {
    recommendations.push(`${deckA.name} should focus on faster setup`);
  }

  return {
    deckA: {
      id: deckA.id,
      name: deckA.name,
      scores: analysisA.scores,
      archetype: analysisA.archetype.primaryArchetype,
    },
    deckB: {
      id: deckB.id,
      name: deckB.name,
      scores: analysisB.scores,
      archetype: analysisB.archetype.primaryArchetype,
    },
    comparison: {
      overallWinner,
      categoryWinners,
      headToHead,
      recommendations,
    },
  };
}

function simulateMatchup(
  analysisA: DeckAnalysisResult,
  analysisB: DeckAnalysisResult
): { winRate: number; keyFactors: string[]; strategy: string } {
  let winRate = 50; // Base win rate
  const keyFactors: string[] = [];

  // Speed comparison
  if (analysisA.speed.overallSpeed === 'turbo' && analysisB.speed.overallSpeed === 'slow') {
    winRate += 20;
    keyFactors.push('Significant speed advantage');
  } else if (analysisA.speed.overallSpeed === 'slow' && analysisB.speed.overallSpeed === 'turbo') {
    winRate -= 20;
    keyFactors.push('Significant speed disadvantage');
  }

  // Archetype matchup
  const archetypeAdvantage = getArchetypeMatchup(
    analysisA.archetype.primaryArchetype,
    analysisB.archetype.primaryArchetype
  );
  
  winRate += archetypeAdvantage.advantage;
  if (archetypeAdvantage.advantage !== 0) {
    keyFactors.push(archetypeAdvantage.reason);
  }

  // Power comparison
  if (analysisA.scores.power > analysisB.scores.power + 20) {
    winRate += 10;
    keyFactors.push('Higher damage output');
  } else if (analysisB.scores.power > analysisA.scores.power + 20) {
    winRate -= 10;
    keyFactors.push('Lower damage output');
  }

  // Consistency factor
  const consistencyDiff = analysisA.scores.consistency - analysisB.scores.consistency;
  winRate += consistencyDiff / 10; // +/- 10% based on consistency

  // Normalize win rate
  winRate = Math.max(20, Math.min(80, winRate));

  const strategy = generateMatchupStrategy(analysisA, analysisB);

  return { winRate, keyFactors, strategy };
}

function getArchetypeMatchup(
  archetypeA: string,
  archetypeB: string
): { advantage: number; reason: string } {
  // Simplified archetype matchup matrix
  const matchups: Record<string, Record<string, { advantage: number; reason: string }>> = {
    'aggro': {
      'control': { advantage: 15, reason: 'Aggro beats control before setup' },
      'stall': { advantage: -10, reason: 'Stall counters aggro strategies' },
      'combo': { advantage: 10, reason: 'Can pressure combo before setup' },
    },
    'control': {
      'aggro': { advantage: -15, reason: 'Struggles against early aggression' },
      'combo': { advantage: 15, reason: 'Can disrupt combo pieces' },
      'midrange': { advantage: 10, reason: 'Controls the pace vs midrange' },
    },
    'combo': {
      'control': { advantage: -15, reason: 'Vulnerable to disruption' },
      'aggro': { advantage: -10, reason: 'Struggles to setup under pressure' },
      'stall': { advantage: 10, reason: 'Can break through stall' },
    },
  };

  const matchup = matchups[archetypeA]?.[archetypeB];
  return matchup || { advantage: 0, reason: 'Even archetype matchup' };
}

function generateMatchupStrategy(
  analysisA: DeckAnalysisResult,
  analysisB: DeckAnalysisResult
): string {
  const strategies: string[] = [];

  // Speed-based strategy
  if (analysisA.speed.overallSpeed === 'turbo' || analysisA.speed.overallSpeed === 'fast') {
    strategies.push('Apply early pressure before opponent sets up');
  } else if (analysisA.speed.overallSpeed === 'slow') {
    strategies.push('Survive early game and stabilize');
  }

  // Archetype-based strategy
  if (analysisA.archetype.primaryArchetype === 'control') {
    strategies.push('Disrupt opponent\'s key cards');
  } else if (analysisA.archetype.primaryArchetype === 'combo') {
    strategies.push('Focus on assembling combo pieces quickly');
  }

  // Weakness exploitation
  if (analysisB.meta.weaknesses.some(w => w.severity === 'high')) {
    strategies.push('Exploit opponent\'s meta weaknesses');
  }

  return strategies.join('. ') || 'Play to deck\'s strengths and adapt to opponent';
}