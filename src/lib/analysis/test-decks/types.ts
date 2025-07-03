/**
 * Test Deck Types and Interfaces
 * 
 * Defines the structure for test decks used in the analyzer feedback loop
 */

import { Card, DeckCard } from '@prisma/client';

export interface TestDeckCard extends DeckCard {
  card: Card;
}

export interface TestDeck {
  id: string;
  name: string;
  description: string;
  category: TestDeckCategory;
  cards: TestDeckCard[];
  expectedIssues: ExpectedIssue[];
  expectedScore: {
    min: number;
    max: number;
    reason: string;
  };
  knownGoodFeatures?: string[];
  knownProblems?: string[];
  meta?: {
    archetype?: string;
    tier?: number;
    popular?: boolean;
  };
}

export type TestDeckCategory = 
  | 'well-built'        // Meta decks, tournament winners
  | 'fundamentally-broken' // Missing basics, illegal cards
  | 'consistency-issues'   // Poor draw/search
  | 'energy-problems'      // Wrong energy, no acceleration
  | 'evolution-heavy'      // Complex evolution lines
  | 'ability-dependent'    // Relies on abilities for function
  | 'prize-trade-poor'     // Too many multi-prizers
  | 'budget-friendly'      // Good budget options
  | 'edge-case'           // Rare Candy lines, special rules
  | 'beginner-mistake';    // Common new player errors

export interface ExpectedIssue {
  category: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  mustDetect: boolean; // If true, analyzer MUST catch this
}

export interface TestDeckLibrary {
  decks: TestDeck[];
  getByCategory(category: TestDeckCategory): TestDeck[];
  getById(id: string): TestDeck | undefined;
  getAllCategories(): TestDeckCategory[];
  getRandomDeck(category?: TestDeckCategory): TestDeck;
}

export interface AnalyzerTestResult {
  deckId: string;
  deckName: string;
  category: TestDeckCategory;
  passedChecks: string[];
  failedChecks: string[];
  unexpectedIssues: string[];
  missedIssues: ExpectedIssue[];
  scoreInRange: boolean;
  actualScore: number;
  accuracy: number; // 0-100
}