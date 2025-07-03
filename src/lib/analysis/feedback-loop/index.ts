/**
 * Analyzer Feedback Loop System
 * 
 * Automated continuous improvement system for the deck analyzer
 */

export { 
  AnalyzerImprovementSystem,
  type ImprovementRun,
  type ImprovementSystemOptions 
} from './analyzer-improvement-system';

export { 
  ImprovementTracker,
  type ImprovementHistory,
  type ImprovementStatistics 
} from './improvement-tracker';

export { 
  ImprovementParser,
  type ParsedImprovement,
  type ValidationResult 
} from './improvement-parser';

export { 
  ImprovementApplier,
  type ApplyResult,
  type ApplyOptions 
} from './improvement-applier';

export {
  loadConfig,
  validateConfig,
  defaultConfig,
  configPresets,
  type FeedbackLoopConfig
} from './config';

// Re-export test deck types for convenience
export type { 
  TestDeck, 
  TestDeckCategory, 
  AnalyzerTestResult 
} from '../test-decks';