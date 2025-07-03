/**
 * Analyzer Improvement System
 * 
 * Main orchestrator for the continuous improvement feedback loop
 */

import { DeckAnalyzer } from '../deck-analyzer';
import { analyzeBasicDeck } from '../basic-deck-analyzer';
import { 
  testDeckLibrary, 
  runAnalyzerTestSuite, 
  TestDeck, 
  TestDeckCategory,
  AnalyzerTestResult 
} from '../test-decks';
import { 
  reviewAnalysisWithAssistant,
  EnhancedReviewResponse,
  CodeImprovement,
  EnhancedOpenAIConfig
} from '../openai-enhanced-integration';
import { ImprovementTracker } from './improvement-tracker';
import { FeedbackLoopConfig } from './config';

export interface ImprovementRun {
  id: string;
  timestamp: Date;
  testResults: {
    beforeAccuracy: number;
    afterAccuracy?: number;
    categoryBreakdown: Map<TestDeckCategory, number>;
    criticalMisses: string[];
  };
  improvements: {
    applied: CodeImprovement[];
    pending: CodeImprovement[];
    rejected: CodeImprovement[];
  };
  metrics: {
    openAICalls: number;
    tokensUsed: number;
    estimatedCost: number;
    executionTime: number;
  };
  status: 'running' | 'completed' | 'failed' | 'rolled-back';
  error?: string;
}

export interface ImprovementSystemOptions {
  dryRun?: boolean;
  categories?: TestDeckCategory[];
  maxImprovements?: number;
  autoApplyThreshold?: number;
  testSampleSize?: number;
  verbose?: boolean;
}

export class AnalyzerImprovementSystem {
  private config: FeedbackLoopConfig;
  private tracker: ImprovementTracker;
  private currentRun?: ImprovementRun;
  
  constructor(config: FeedbackLoopConfig) {
    this.config = config;
    this.tracker = new ImprovementTracker();
  }
  
  /**
   * Run a complete improvement cycle
   */
  async runImprovementCycle(options: ImprovementSystemOptions = {}): Promise<ImprovementRun> {
    const startTime = Date.now();
    
    // Initialize run
    this.currentRun = {
      id: this.generateRunId(),
      timestamp: new Date(),
      testResults: {
        beforeAccuracy: 0,
        categoryBreakdown: new Map(),
        criticalMisses: []
      },
      improvements: {
        applied: [],
        pending: [],
        rejected: []
      },
      metrics: {
        openAICalls: 0,
        tokensUsed: 0,
        estimatedCost: 0,
        executionTime: 0
      },
      status: 'running'
    };
    
    try {
      // Step 1: Run baseline tests
      if (options.verbose) console.log('🧪 Running baseline analyzer tests...');
      const baselineResults = await this.runAnalyzerTests(options);
      this.currentRun.testResults.beforeAccuracy = baselineResults.overallAccuracy;
      this.currentRun.testResults.categoryBreakdown = baselineResults.categoryAccuracy;
      this.currentRun.testResults.criticalMisses = baselineResults.summary.criticalMisses;
      
      if (options.verbose) {
        console.log(`📊 Baseline accuracy: ${baselineResults.overallAccuracy.toFixed(1)}%`);
        console.log(`❌ Critical misses: ${baselineResults.summary.criticalMisses.length}`);
      }
      
      // Step 2: Collect improvement suggestions from OpenAI
      if (options.verbose) console.log('\n🤖 Collecting improvement suggestions from OpenAI...');
      const improvements = await this.collectImprovements(baselineResults.detailedResults, options);
      
      // Step 3: Categorize improvements
      const categorized = this.categorizeImprovements(improvements, options);
      this.currentRun.improvements = categorized;
      
      if (options.verbose) {
        console.log(`✅ Auto-apply: ${categorized.applied.length} improvements`);
        console.log(`⏳ Pending review: ${categorized.pending.length} improvements`);
        console.log(`❌ Rejected: ${categorized.rejected.length} improvements`);
      }
      
      // Step 4: Apply improvements (if not dry run)
      if (!options.dryRun && categorized.applied.length > 0) {
        if (options.verbose) console.log('\n🔧 Applying improvements...');
        const applied = await this.applyImprovements(categorized.applied);
        
        // Step 5: Re-run tests to measure improvement
        if (options.verbose) console.log('\n🧪 Re-running tests after improvements...');
        const afterResults = await this.runAnalyzerTests(options);
        this.currentRun.testResults.afterAccuracy = afterResults.overallAccuracy;
        
        const improvement = afterResults.overallAccuracy - baselineResults.overallAccuracy;
        if (options.verbose) {
          console.log(`📈 New accuracy: ${afterResults.overallAccuracy.toFixed(1)}%`);
          console.log(`${improvement >= 0 ? '✅' : '❌'} Change: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`);
        }
        
        // Rollback if accuracy decreased
        if (improvement < -5 && !options.dryRun) {
          if (options.verbose) console.log('\n⚠️  Accuracy decreased significantly, rolling back...');
          await this.rollbackImprovements(applied);
          this.currentRun.status = 'rolled-back';
        }
      }
      
      // Calculate metrics
      this.currentRun.metrics.executionTime = Date.now() - startTime;
      this.currentRun.status = this.currentRun.status === 'rolled-back' ? 'rolled-back' : 'completed';
      
      // Save run to tracker
      await this.tracker.saveRun(this.currentRun);
      
      return this.currentRun;
      
    } catch (error) {
      this.currentRun.status = 'failed';
      this.currentRun.error = error instanceof Error ? error.message : String(error);
      await this.tracker.saveRun(this.currentRun);
      throw error;
    }
  }
  
  /**
   * Run analyzer tests on test deck library
   */
  private async runAnalyzerTests(options: ImprovementSystemOptions) {
    const analyzer = new DeckAnalyzer();
    
    // Filter test decks by category if specified
    let testDecks = testDeckLibrary.decks;
    if (options.categories && options.categories.length > 0) {
      testDecks = testDecks.filter(deck => options.categories!.includes(deck.category));
    }
    
    // Limit sample size if specified
    if (options.testSampleSize && options.testSampleSize < testDecks.length) {
      testDecks = this.selectRepresentativeSample(testDecks, options.testSampleSize);
    }
    
    // Create temporary test deck structure
    const testDeckStructures = testDecks.map(deck => ({
      ...deck,
      cards: deck.cards
    }));
    
    // Run both analyzers
    const results = await runAnalyzerTestSuite(async (cards) => {
      // Randomly choose between basic and advanced analyzer
      if (Math.random() < 0.5) {
        return analyzeBasicDeck(cards);
      } else {
        // Create a minimal deck structure for advanced analyzer
        const deck = {
          id: 'test',
          userId: 'test',
          name: 'Test Deck',
          description: null,
          format: 'STANDARD' as const,
          category: 'OTHER' as const,
          tags: [],
          isPublic: false,
          wins: 0,
          losses: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          cards: cards
        };
        return analyzer.analyzeDeck(deck);
      }
    });
    
    return results;
  }
  
  /**
   * Collect improvement suggestions from OpenAI
   */
  private async collectImprovements(
    testResults: AnalyzerTestResult[],
    options: ImprovementSystemOptions
  ): Promise<CodeImprovement[]> {
    const improvements: CodeImprovement[] = [];
    
    // Group failed tests by issue type
    const issueGroups = this.groupFailedTests(testResults);
    
    // Get suggestions for each issue group
    for (const [issueType, failedTests] of issueGroups) {
      if (options.maxImprovements && improvements.length >= options.maxImprovements) {
        break;
      }
      
      // Select representative test for this issue
      const representativeTest = failedTests[0];
      const testDeck = testDeckLibrary.getById(representativeTest.deckId);
      
      if (!testDeck) continue;
      
      // Call OpenAI for improvement suggestions
      const response = await this.getOpenAISuggestions(testDeck, representativeTest);
      
      if (response.codeImprovements) {
        improvements.push(...response.codeImprovements);
      }
      
      this.currentRun!.metrics.openAICalls++;
      this.currentRun!.metrics.tokensUsed += this.estimateTokens(response);
    }
    
    // Estimate cost
    this.currentRun!.metrics.estimatedCost = this.calculateCost(
      this.currentRun!.metrics.tokensUsed
    );
    
    return improvements;
  }
  
  /**
   * Get improvement suggestions from OpenAI
   */
  private async getOpenAISuggestions(
    testDeck: TestDeck,
    testResult: AnalyzerTestResult
  ): Promise<EnhancedReviewResponse> {
    // Create a mock analysis result for the review
    const mockAnalysis = {
      deckScore: testResult.actualScore,
      advice: testResult.failedChecks.map(check => ({
        category: 'Issue',
        title: check,
        message: check,
        fixIt: 'Needs improvement'
      })),
      swapSuggestions: []
    };
    
    // Use standard chat API if no assistant ID
    if (!this.config.openAI.assistantId) {
      const { prepareDeckAnalysisPayload, reviewAnalysisWithOpenAI } = await import('../openai-analysis-reviewer');
      
      const payload = prepareDeckAnalysisPayload(
        testDeck.name,
        testDeck.cards,
        mockAnalysis,
        'basic'
      );
      
      const review = await reviewAnalysisWithOpenAI(
        payload,
        this.config.openAI.apiKey,
        undefined,
        {
          model: 'gpt-4o-mini',
          temperature: this.config.openAI.temperature,
          topP: this.config.openAI.topP,
          maxTokens: this.config.openAI.maxTokens
        }
      );
      
      // Convert to enhanced response format
      return {
        ...review,
        codeImprovements: [],
        testCases: []
      };
    }
    
    // Otherwise use assistant API
    const openAIConfig: EnhancedOpenAIConfig = {
      apiKey: this.config.openAI.apiKey,
      assistantId: this.config.openAI.assistantId,
      temperature: this.config.openAI.temperature,
      topP: this.config.openAI.topP
    };
    
    return reviewAnalysisWithAssistant(
      testDeck.cards,
      mockAnalysis,
      openAIConfig
    );
  }
  
  /**
   * Categorize improvements based on confidence and rules
   */
  private categorizeImprovements(
    improvements: CodeImprovement[],
    options: ImprovementSystemOptions
  ): {
    applied: CodeImprovement[];
    pending: CodeImprovement[];
    rejected: CodeImprovement[];
  } {
    const threshold = options.autoApplyThreshold ?? this.config.autoApplyThreshold;
    
    const applied: CodeImprovement[] = [];
    const pending: CodeImprovement[] = [];
    const rejected: CodeImprovement[] = [];
    
    improvements.forEach(improvement => {
      // Check if improvement meets auto-apply criteria
      const confidence = this.calculateImprovementConfidence(improvement);
      const isSafe = this.isImprovementSafe(improvement);
      
      if (confidence >= threshold && isSafe && improvement.priority !== 'low') {
        applied.push(improvement);
      } else if (improvement.priority === 'critical' || improvement.priority === 'high') {
        pending.push(improvement);
      } else if (confidence < 50 || !isSafe) {
        rejected.push(improvement);
      } else {
        pending.push(improvement);
      }
    });
    
    return { applied, pending, rejected };
  }
  
  /**
   * Apply improvements to the codebase
   */
  private async applyImprovements(improvements: CodeImprovement[]): Promise<string[]> {
    // This is a placeholder - actual implementation would modify files
    // For now, just track what would be applied
    const appliedFiles: string[] = [];
    
    for (const improvement of improvements) {
      appliedFiles.push(improvement.file);
      // In real implementation:
      // 1. Create backup
      // 2. Apply code changes
      // 3. Validate syntax
      // 4. Run tests
    }
    
    return appliedFiles;
  }
  
  /**
   * Rollback improvements
   */
  private async rollbackImprovements(files: string[]): Promise<void> {
    // Placeholder - would restore from backups
    console.log('Rolling back files:', files);
  }
  
  /**
   * Group failed tests by issue type
   */
  private groupFailedTests(
    results: AnalyzerTestResult[]
  ): Map<string, AnalyzerTestResult[]> {
    const groups = new Map<string, AnalyzerTestResult[]>();
    
    results.forEach(result => {
      if (result.failedChecks.length > 0 || result.missedIssues.length > 0) {
        // Use first failed check or missed issue as group key
        const key = result.failedChecks[0] || result.missedIssues[0]?.description || 'unknown';
        
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(result);
      }
    });
    
    return groups;
  }
  
  /**
   * Select representative sample of test decks
   */
  private selectRepresentativeSample(decks: TestDeck[], size: number): TestDeck[] {
    // Ensure at least one deck from each category
    const byCategory = new Map<TestDeckCategory, TestDeck[]>();
    decks.forEach(deck => {
      if (!byCategory.has(deck.category)) {
        byCategory.set(deck.category, []);
      }
      byCategory.get(deck.category)!.push(deck);
    });
    
    const sample: TestDeck[] = [];
    const categoriesCount = byCategory.size;
    const perCategory = Math.max(1, Math.floor(size / categoriesCount));
    
    byCategory.forEach(categoryDecks => {
      const selected = categoryDecks.slice(0, perCategory);
      sample.push(...selected);
    });
    
    return sample.slice(0, size);
  }
  
  /**
   * Calculate confidence score for an improvement
   */
  private calculateImprovementConfidence(improvement: CodeImprovement): number {
    let confidence = 70; // Base confidence
    
    // Adjust based on priority
    if (improvement.priority === 'critical') confidence += 20;
    else if (improvement.priority === 'high') confidence += 10;
    else if (improvement.priority === 'low') confidence -= 20;
    
    // Adjust based on category
    if (improvement.category === 'bug-fix') confidence += 15;
    else if (improvement.category === 'performance') confidence += 5;
    else if (improvement.category === 'refactor') confidence -= 10;
    
    // Adjust based on code complexity
    const linesChanged = improvement.newCode.split('\n').length;
    if (linesChanged < 5) confidence += 10;
    else if (linesChanged > 50) confidence -= 20;
    
    return Math.max(0, Math.min(100, confidence));
  }
  
  /**
   * Check if an improvement is safe to auto-apply
   */
  private isImprovementSafe(improvement: CodeImprovement): boolean {
    // Don't auto-apply if it modifies critical files
    const criticalFiles = ['deck-analyzer.ts', 'types.ts', 'index.ts'];
    if (criticalFiles.some(f => improvement.file.includes(f))) {
      return false;
    }
    
    // Don't auto-apply if it removes code
    if (improvement.oldCode && !improvement.newCode) {
      return false;
    }
    
    // Don't auto-apply large changes
    if (improvement.newCode.length > 1000) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Estimate tokens used in OpenAI response
   */
  private estimateTokens(response: any): number {
    // Rough estimation: 1 token ≈ 4 characters
    const responseText = JSON.stringify(response);
    return Math.ceil(responseText.length / 4);
  }
  
  /**
   * Calculate cost based on tokens
   */
  private calculateCost(tokens: number): number {
    // GPT-4 mini pricing (as of 2024)
    const costPer1kTokens = 0.0075; // $0.0075 per 1K tokens
    return (tokens / 1000) * costPer1kTokens;
  }
  
  /**
   * Generate unique run ID
   */
  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get improvement history
   */
  async getHistory(limit?: number): Promise<ImprovementRun[]> {
    return this.tracker.getHistory(limit);
  }
  
  /**
   * Get improvement statistics
   */
  async getStatistics(): Promise<{
    totalRuns: number;
    averageAccuracyImprovement: number;
    totalImprovementsApplied: number;
    totalCost: number;
    successRate: number;
  }> {
    return this.tracker.getStatistics();
  }
}