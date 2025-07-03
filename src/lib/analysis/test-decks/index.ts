/**
 * Test Deck Library
 * 
 * Main entry point for accessing test decks for analyzer validation
 */

import { TestDeck, TestDeckCategory, TestDeckLibrary, AnalyzerTestResult } from './types';
import { testDecks } from './deck-data';
import { additionalTestDecks } from './additional-decks';
import { DeckAnalysisResult } from '../types';
import { BasicDeckAnalysis } from '../basic-deck-analyzer';

// Combine all test decks
const allTestDecks: TestDeck[] = [...testDecks, ...additionalTestDecks];

/**
 * Test Deck Library Implementation
 */
class TestDeckLibraryImpl implements TestDeckLibrary {
  decks: TestDeck[];

  constructor() {
    this.decks = allTestDecks;
  }

  getByCategory(category: TestDeckCategory): TestDeck[] {
    return this.decks.filter(deck => deck.category === category);
  }

  getById(id: string): TestDeck | undefined {
    return this.decks.find(deck => deck.id === id);
  }

  getAllCategories(): TestDeckCategory[] {
    const categories = new Set(this.decks.map(deck => deck.category));
    return Array.from(categories);
  }

  getRandomDeck(category?: TestDeckCategory): TestDeck {
    const eligibleDecks = category 
      ? this.getByCategory(category)
      : this.decks;
    
    if (eligibleDecks.length === 0) {
      throw new Error(`No decks found for category: ${category}`);
    }
    
    const randomIndex = Math.floor(Math.random() * eligibleDecks.length);
    return eligibleDecks[randomIndex];
  }
}

// Singleton instance
export const testDeckLibrary = new TestDeckLibraryImpl();

/**
 * Evaluate analyzer performance against a test deck
 */
export function evaluateAnalyzerAccuracy(
  testDeck: TestDeck,
  analysisResult: DeckAnalysisResult | BasicDeckAnalysis
): AnalyzerTestResult {
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  const unexpectedIssues: string[] = [];
  const missedIssues = [...testDeck.expectedIssues];
  
  // Check if analysis is basic or advanced
  const isBasicAnalysis = 'advice' in analysisResult;
  
  // Get actual score
  let actualScore: number;
  if (isBasicAnalysis) {
    actualScore = (analysisResult as BasicDeckAnalysis).deckScore;
  } else {
    actualScore = (analysisResult as DeckAnalysisResult).scores?.overall || 0;
  }
  
  // Check if score is in expected range
  const scoreInRange = actualScore >= testDeck.expectedScore.min && 
                      actualScore <= testDeck.expectedScore.max;
  
  if (scoreInRange) {
    passedChecks.push(`Score ${actualScore} is within expected range ${testDeck.expectedScore.min}-${testDeck.expectedScore.max}`);
  } else {
    failedChecks.push(`Score ${actualScore} is outside expected range ${testDeck.expectedScore.min}-${testDeck.expectedScore.max}`);
  }
  
  // Check expected issues
  const foundIssues: string[] = [];
  
  if (isBasicAnalysis) {
    const basicAnalysis = analysisResult as BasicDeckAnalysis;
    basicAnalysis.advice.forEach(advice => {
      foundIssues.push(`${advice.category}: ${advice.message}`);
    });
  } else {
    const advancedAnalysis = analysisResult as DeckAnalysisResult;
    advancedAnalysis.warnings?.forEach(warning => {
      foundIssues.push(`${warning.category}: ${warning.message}`);
    });
  }
  
  // Match found issues against expected
  testDeck.expectedIssues.forEach(expectedIssue => {
    const found = foundIssues.some(issue => 
      issue.toLowerCase().includes(expectedIssue.description.toLowerCase()) ||
      issue.includes(expectedIssue.category)
    );
    
    if (found) {
      passedChecks.push(`Correctly detected: ${expectedIssue.description}`);
      // Remove from missed issues
      const index = missedIssues.findIndex(i => i === expectedIssue);
      if (index > -1) missedIssues.splice(index, 1);
    } else if (expectedIssue.mustDetect) {
      failedChecks.push(`Failed to detect critical issue: ${expectedIssue.description}`);
    }
  });
  
  // Check for unexpected issues (false positives)
  foundIssues.forEach(issue => {
    const expected = testDeck.expectedIssues.some(expectedIssue =>
      issue.toLowerCase().includes(expectedIssue.description.toLowerCase()) ||
      issue.includes(expectedIssue.category)
    );
    
    if (!expected && !testDeck.knownProblems?.some(p => issue.toLowerCase().includes(p.toLowerCase()))) {
      unexpectedIssues.push(issue);
    }
  });
  
  // Calculate accuracy
  const totalChecks = passedChecks.length + failedChecks.length + unexpectedIssues.length;
  const accuracy = totalChecks > 0 ? (passedChecks.length / totalChecks) * 100 : 0;
  
  return {
    deckId: testDeck.id,
    deckName: testDeck.name,
    category: testDeck.category,
    passedChecks,
    failedChecks,
    unexpectedIssues,
    missedIssues: missedIssues.filter(i => i.mustDetect),
    scoreInRange,
    actualScore,
    accuracy
  };
}

/**
 * Run a comprehensive test suite against all test decks
 */
export async function runAnalyzerTestSuite(
  analyzeFunction: (deck: any) => Promise<DeckAnalysisResult | BasicDeckAnalysis> | DeckAnalysisResult | BasicDeckAnalysis
): Promise<{
  overallAccuracy: number;
  categoryAccuracy: Map<TestDeckCategory, number>;
  detailedResults: AnalyzerTestResult[];
  summary: {
    totalDecks: number;
    passedDecks: number;
    failedDecks: number;
    criticalMisses: string[];
  };
}> {
  const detailedResults: AnalyzerTestResult[] = [];
  const categoryAccuracy = new Map<TestDeckCategory, number[]>();
  const criticalMisses: string[] = [];
  
  // Test each deck
  for (const testDeck of allTestDecks) {
    const analysisResult = await analyzeFunction(testDeck.cards);
    const testResult = evaluateAnalyzerAccuracy(testDeck, analysisResult);
    
    detailedResults.push(testResult);
    
    // Track category accuracy
    if (!categoryAccuracy.has(testDeck.category)) {
      categoryAccuracy.set(testDeck.category, []);
    }
    categoryAccuracy.get(testDeck.category)!.push(testResult.accuracy);
    
    // Track critical misses
    testResult.missedIssues.forEach(missed => {
      criticalMisses.push(`${testDeck.name}: ${missed.description}`);
    });
  }
  
  // Calculate overall accuracy
  const overallAccuracy = detailedResults.reduce((sum, r) => sum + r.accuracy, 0) / detailedResults.length;
  
  // Calculate category averages
  const categoryAverages = new Map<TestDeckCategory, number>();
  categoryAccuracy.forEach((accuracies, category) => {
    const avg = accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;
    categoryAverages.set(category, avg);
  });
  
  // Count passed/failed decks
  const passedDecks = detailedResults.filter(r => r.accuracy >= 70 && r.scoreInRange).length;
  const failedDecks = detailedResults.length - passedDecks;
  
  return {
    overallAccuracy,
    categoryAccuracy: categoryAverages,
    detailedResults,
    summary: {
      totalDecks: detailedResults.length,
      passedDecks,
      failedDecks,
      criticalMisses
    }
  };
}

// Export test deck categories for easy access
export const TEST_DECK_CATEGORIES: TestDeckCategory[] = [
  'well-built',
  'fundamentally-broken',
  'consistency-issues',
  'energy-problems',
  'evolution-heavy',
  'ability-dependent',
  'prize-trade-poor',
  'budget-friendly',
  'edge-case',
  'beginner-mistake'
];

// Export specific test decks for direct access
export {
  charizardExDeck,
  noBasisDeck,
  energyImbalanceDeck,
  evolutionHeavyDeck,
  abilityDependentDeck,
  prizeTradePoorDeck,
  consistencyIssuesDeck,
  budgetFriendlyDeck,
  beginnerMistakeDeck,
  specialRulesDeck
} from './deck-data';

export type { TestDeck, TestDeckCategory, AnalyzerTestResult } from './types';