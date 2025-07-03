/**
 * Feedback Loop Configuration
 * 
 * Configuration settings for the analyzer improvement system
 */

export interface FeedbackLoopConfig {
  // OpenAI settings
  openAI: {
    apiKey: string;
    assistantId: string;
    temperature: number;
    topP: number;
    maxTokens?: number;
  };
  
  // Improvement application settings
  autoApplyThreshold: number; // 0-100, minimum confidence to auto-apply
  maxImprovementsPerRun: number;
  requireTestsPass: boolean;
  
  // Test settings
  testSettings: {
    sampleSize: number; // Number of test decks to use
    categories?: string[]; // Specific categories to test
    parallelTests: boolean;
    timeout: number; // Max time per test in ms
  };
  
  // Safety settings
  safety: {
    allowCriticalFileChanges: boolean;
    maxCodeChangeSize: number; // Max lines of code per improvement
    requireBackup: boolean;
    rollbackThreshold: number; // Accuracy decrease % to trigger rollback
  };
  
  // Improvement categories to process
  improvementCategories: {
    bugFixes: boolean;
    performance: boolean;
    accuracy: boolean;
    newFeatures: boolean;
    refactoring: boolean;
    documentation: boolean;
  };
  
  // File patterns
  filePatterns: {
    include: string[]; // Glob patterns for files to consider
    exclude: string[]; // Glob patterns for files to exclude
  };
  
  // Notification settings
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    onRollback: boolean;
    webhookUrl?: string;
  };
  
  // Cost controls
  costControls: {
    maxCostPerRun: number; // Maximum $ to spend per run
    maxMonthlyBudget: number; // Maximum $ to spend per month
    pauseOnBudgetExceeded: boolean;
  };
}

/**
 * Default configuration
 */
export const defaultConfig: FeedbackLoopConfig = {
  openAI: {
    apiKey: '', // Will be loaded at runtime
    assistantId: 'asst_P2cUMxaYYnH1O6naiuRqAC72',
    temperature: 0.3,
    topP: 0.9,
    maxTokens: 2000
  },
  
  autoApplyThreshold: 85, // Only auto-apply if 85%+ confident
  maxImprovementsPerRun: 10,
  requireTestsPass: true,
  
  testSettings: {
    sampleSize: 20, // Test 20 decks per run
    parallelTests: true,
    timeout: 5000 // 5 seconds per test
  },
  
  safety: {
    allowCriticalFileChanges: false,
    maxCodeChangeSize: 100, // Max 100 lines per improvement
    requireBackup: true,
    rollbackThreshold: 5 // Rollback if accuracy drops 5%+
  },
  
  improvementCategories: {
    bugFixes: true,
    performance: true,
    accuracy: true,
    newFeatures: false, // Don't auto-add features
    refactoring: false, // Don't auto-refactor
    documentation: true
  },
  
  filePatterns: {
    include: [
      'src/lib/analysis/**/*.ts',
      '!src/lib/analysis/test-decks/**', // Don't modify test data
      '!src/lib/analysis/feedback-loop/**' // Don't modify self
    ],
    exclude: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/types.ts',
      '**/index.ts'
    ]
  },
  
  notifications: {
    onSuccess: true,
    onFailure: true,
    onRollback: true
  },
  
  costControls: {
    maxCostPerRun: 1.00, // $1 per run
    maxMonthlyBudget: 30.00, // $30 per month
    pauseOnBudgetExceeded: true
  }
};

/**
 * Load configuration from environment or file
 */
export function loadConfig(overrides?: Partial<FeedbackLoopConfig>): FeedbackLoopConfig {
  const config = { ...defaultConfig };
  
  // Override with environment variables if present
  if (process.env.OPENAI_API_KEY) {
    config.openAI.apiKey = process.env.OPENAI_API_KEY;
  }
  
  if (process.env.OPENAI_ASSISTANT_ID) {
    config.openAI.assistantId = process.env.OPENAI_ASSISTANT_ID;
  }
  
  if (process.env.FEEDBACK_AUTO_APPLY_THRESHOLD) {
    config.autoApplyThreshold = parseInt(process.env.FEEDBACK_AUTO_APPLY_THRESHOLD);
  }
  
  if (process.env.FEEDBACK_MAX_COST_PER_RUN) {
    config.costControls.maxCostPerRun = parseFloat(process.env.FEEDBACK_MAX_COST_PER_RUN);
  }
  
  // Apply any provided overrides
  if (overrides) {
    return mergeConfig(config, overrides);
  }
  
  return config;
}

/**
 * Validate configuration
 */
export function validateConfig(config: FeedbackLoopConfig): string[] {
  const errors: string[] = [];
  
  // Check required fields
  if (!config.openAI.apiKey) {
    errors.push('OpenAI API key is required');
  }
  
  // Assistant ID is now optional - can use chat API instead
  // if (!config.openAI.assistantId) {
  //   errors.push('OpenAI Assistant ID is required');
  // }
  
  // Check value ranges
  if (config.autoApplyThreshold < 0 || config.autoApplyThreshold > 100) {
    errors.push('autoApplyThreshold must be between 0 and 100');
  }
  
  if (config.openAI.temperature < 0 || config.openAI.temperature > 2) {
    errors.push('temperature must be between 0 and 2');
  }
  
  if (config.openAI.topP < 0 || config.openAI.topP > 1) {
    errors.push('topP must be between 0 and 1');
  }
  
  if (config.safety.rollbackThreshold < 0) {
    errors.push('rollbackThreshold must be positive');
  }
  
  if (config.costControls.maxCostPerRun > config.costControls.maxMonthlyBudget) {
    errors.push('maxCostPerRun cannot exceed maxMonthlyBudget');
  }
  
  return errors;
}

/**
 * Deep merge configuration objects
 */
function mergeConfig(
  base: FeedbackLoopConfig,
  overrides: Partial<FeedbackLoopConfig>
): FeedbackLoopConfig {
  const merged = { ...base };
  
  // Merge each section
  if (overrides.openAI) {
    merged.openAI = { ...base.openAI, ...overrides.openAI };
  }
  
  if (overrides.testSettings) {
    merged.testSettings = { ...base.testSettings, ...overrides.testSettings };
  }
  
  if (overrides.safety) {
    merged.safety = { ...base.safety, ...overrides.safety };
  }
  
  if (overrides.improvementCategories) {
    merged.improvementCategories = { 
      ...base.improvementCategories, 
      ...overrides.improvementCategories 
    };
  }
  
  if (overrides.filePatterns) {
    merged.filePatterns = { ...base.filePatterns, ...overrides.filePatterns };
  }
  
  if (overrides.notifications) {
    merged.notifications = { ...base.notifications, ...overrides.notifications };
  }
  
  if (overrides.costControls) {
    merged.costControls = { ...base.costControls, ...overrides.costControls };
  }
  
  // Merge simple fields
  if (overrides.autoApplyThreshold !== undefined) {
    merged.autoApplyThreshold = overrides.autoApplyThreshold;
  }
  
  if (overrides.maxImprovementsPerRun !== undefined) {
    merged.maxImprovementsPerRun = overrides.maxImprovementsPerRun;
  }
  
  if (overrides.requireTestsPass !== undefined) {
    merged.requireTestsPass = overrides.requireTestsPass;
  }
  
  return merged;
}

/**
 * Configuration presets for different use cases
 */
export const configPresets = {
  // Conservative: Only apply very confident bug fixes
  conservative: {
    autoApplyThreshold: 95,
    maxImprovementsPerRun: 3,
    improvementCategories: {
      bugFixes: true,
      performance: false,
      accuracy: false,
      newFeatures: false,
      refactoring: false,
      documentation: false
    },
    safety: {
      allowCriticalFileChanges: false,
      maxCodeChangeSize: 50,
      requireBackup: true,
      rollbackThreshold: 2
    }
  } as Partial<FeedbackLoopConfig>,
  
  // Balanced: Apply most improvements with reasonable safety
  balanced: {
    autoApplyThreshold: 85,
    maxImprovementsPerRun: 10,
    improvementCategories: {
      bugFixes: true,
      performance: true,
      accuracy: true,
      newFeatures: false,
      refactoring: false,
      documentation: true
    }
  } as Partial<FeedbackLoopConfig>,
  
  // Aggressive: Apply many improvements, accept more risk
  aggressive: {
    autoApplyThreshold: 70,
    maxImprovementsPerRun: 20,
    improvementCategories: {
      bugFixes: true,
      performance: true,
      accuracy: true,
      newFeatures: true,
      refactoring: true,
      documentation: true
    },
    safety: {
      allowCriticalFileChanges: true,
      maxCodeChangeSize: 200,
      requireBackup: true,
      rollbackThreshold: 10
    }
  } as Partial<FeedbackLoopConfig>,
  
  // Testing: Dry run mode for testing
  testing: {
    autoApplyThreshold: 50,
    maxImprovementsPerRun: 5,
    testSettings: {
      sampleSize: 5,
      parallelTests: false,
      timeout: 10000
    },
    costControls: {
      maxCostPerRun: 0.10,
      maxMonthlyBudget: 1.00,
      pauseOnBudgetExceeded: true
    }
  } as Partial<FeedbackLoopConfig>
};