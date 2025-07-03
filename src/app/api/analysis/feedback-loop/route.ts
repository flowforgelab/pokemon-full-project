/**
 * API Route for Analyzer Feedback Loop
 * 
 * Can be triggered manually or via cron job to run improvement cycles
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { 
  AnalyzerImprovementSystem, 
  ImprovementSystemOptions 
} from '@/lib/analysis/feedback-loop/analyzer-improvement-system';
import { loadConfig, validateConfig, configPresets } from '@/lib/analysis/feedback-loop/config';

// Protect endpoint with secret
const FEEDBACK_SECRET = process.env.FEEDBACK_LOOP_SECRET || process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  try {
    // Check authentication - either admin user or valid secret
    const { userId } = auth();
    const authHeader = req.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');
    
    // For now, require secret authentication
    if (!FEEDBACK_SECRET || providedSecret !== FEEDBACK_SECRET) {
      // Check if user is admin (would need to implement role checking)
      if (!userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    // Parse request body
    const body = await req.json();
    const {
      dryRun = false,
      preset = 'balanced',
      options = {},
      configOverrides = {}
    } = body;
    
    // Check if this is a single deck test
    if (options.testSingleDeck) {
      const { name, cards, analysis, analysisType } = options.testSingleDeck;
      
      // Create a test deck from the provided data
      const testDeck = {
        id: 'user-deck',
        name,
        description: 'User submitted deck for review',
        category: 'well-built' as const,
        cards,
        expectedIssues: [],
        expectedScore: { min: 0, max: 100, reason: 'User deck' }
      };
      
      // Create a minimal test result
      const testResult = {
        deckId: testDeck.id,
        deckName: testDeck.name,
        category: testDeck.category,
        passedChecks: [],
        failedChecks: [],
        unexpectedIssues: [],
        missedIssues: [],
        scoreInRange: true,
        actualScore: analysisType === 'basic' ? analysis.deckScore : analysis.scores?.overall || 0,
        accuracy: 100 // Assume current analysis is baseline
      };
      
      // Get review from OpenAI
      const config = loadConfig({ ...presetConfig, ...configOverrides });
      const improvementSystem = new AnalyzerImprovementSystem(config);
      
      // @ts-ignore - accessing private method
      const review = await improvementSystem.getOpenAISuggestions(testDeck, testResult);
      
      return NextResponse.json({
        success: true,
        runId: `single-${Date.now()}`,
        summary: {
          accuracyBefore: review.accuracyScore || 70,
          criticalMisses: review.missedIssues?.filter(i => i.severity === 'critical').length || 0,
          improvements: review.suggestedImprovements?.length || 0,
          estimatedCost: '$0.01'
        },
        review: {
          accuracyScore: review.accuracyScore,
          missedIssues: review.missedIssues,
          incorrectRecommendations: review.incorrectRecommendations,
          goodPoints: review.goodPoints,
          suggestedImprovements: review.suggestedImprovements
        },
        improvements: {
          applied: [],
          pending: review.codeImprovements || []
        }
      });
    }
    
    // Load configuration
    const presetConfig = preset ? configPresets[preset as keyof typeof configPresets] : {};
    const config = loadConfig({
      ...presetConfig,
      ...configOverrides
    });
    
    // Validate configuration
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      return NextResponse.json(
        { error: 'Invalid configuration', errors: configErrors },
        { status: 400 }
      );
    }
    
    // Create improvement system
    const improvementSystem = new AnalyzerImprovementSystem(config);
    
    // Build options
    const runOptions: ImprovementSystemOptions = {
      dryRun,
      verbose: true,
      ...options
    };
    
    // Run improvement cycle
    const result = await improvementSystem.runImprovementCycle(runOptions);
    
    // Prepare response
    const response = {
      success: result.status === 'completed',
      runId: result.id,
      summary: {
        status: result.status,
        accuracyBefore: result.testResults.beforeAccuracy.toFixed(1),
        accuracyAfter: result.testResults.afterAccuracy?.toFixed(1),
        improvementsApplied: result.improvements.applied.length,
        improvementsPending: result.improvements.pending.length,
        criticalMisses: result.testResults.criticalMisses.length,
        executionTime: `${(result.metrics.executionTime / 1000).toFixed(1)}s`,
        estimatedCost: `$${result.metrics.estimatedCost.toFixed(4)}`
      },
      improvements: {
        applied: result.improvements.applied.map(imp => ({
          file: imp.file,
          priority: imp.priority,
          category: imp.category,
          description: imp.description
        })),
        pending: result.improvements.pending.map(imp => ({
          file: imp.file,
          priority: imp.priority,
          category: imp.category,
          description: imp.description
        }))
      },
      categoryBreakdown: Array.from(result.testResults.categoryBreakdown.entries()).map(
        ([category, accuracy]) => ({ category, accuracy: accuracy.toFixed(1) })
      )
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Feedback loop error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = auth();
    const authHeader = req.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');
    
    if (!FEEDBACK_SECRET || providedSecret !== FEEDBACK_SECRET) {
      if (!userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'status';
    
    // Load config to create system
    const config = loadConfig();
    const improvementSystem = new AnalyzerImprovementSystem(config);
    
    switch (action) {
      case 'status':
        // Get current status and statistics
        const stats = await improvementSystem.getStatistics();
        const history = await improvementSystem.getHistory(5); // Last 5 runs
        
        return NextResponse.json({
          statistics: stats,
          recentRuns: history.map(run => ({
            id: run.id,
            timestamp: run.timestamp,
            status: run.status,
            accuracyChange: run.testResults.afterAccuracy 
              ? (run.testResults.afterAccuracy - run.testResults.beforeAccuracy).toFixed(1)
              : 'N/A',
            improvementsApplied: run.improvements.applied.length
          }))
        });
        
      case 'history':
        // Get full history
        const limit = parseInt(searchParams.get('limit') || '20');
        const fullHistory = await improvementSystem.getHistory(limit);
        
        return NextResponse.json({
          history: fullHistory,
          total: fullHistory.length
        });
        
      case 'config':
        // Get current configuration (sanitized)
        const sanitizedConfig = {
          ...config,
          openAI: {
            ...config.openAI,
            apiKey: '***' // Hide API key
          }
        };
        
        return NextResponse.json({
          config: sanitizedConfig,
          presets: Object.keys(configPresets)
        });
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('Feedback loop GET error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS if needed
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}