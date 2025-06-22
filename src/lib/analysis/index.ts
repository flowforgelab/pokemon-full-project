// Export all analysis components
export { DeckAnalyzer } from './deck-analyzer';
export { ConsistencyCalculator } from './consistency-calculator';
export { SynergyAnalyzer } from './synergy-analyzer';
export { MetaEvaluator } from './meta-evaluator';
export { SpeedAnalyzer } from './speed-analyzer';
export { ArchetypeClassifier } from './archetype-classifier';
export { ScoringSystem } from './scoring-system';

// Export types
export type {
  DeckAnalysisResult,
  ConsistencyAnalysis,
  SynergyAnalysis,
  MetaGameAnalysis,
  SpeedAnalysis,
  ArchetypeClassification,
  DeckScores,
  AnalysisConfig,
  Recommendation,
  AnalysisWarning,
  DeckArchetype,
  // Add more types as needed
} from './types';

// Export utility functions
export { analyzeDeck, compareDecks } from './utils';

// Version info
export const ANALYSIS_VERSION = '1.0.0';