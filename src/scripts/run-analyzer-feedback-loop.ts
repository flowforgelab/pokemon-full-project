#!/usr/bin/env node

/**
 * Automated Test Runner for Analyzer Feedback Loop
 * 
 * CLI script to run the analyzer improvement system
 * 
 * Usage:
 *   npm run analyzer:feedback -- [options]
 *   npx tsx src/scripts/run-analyzer-feedback-loop.ts [options]
 * 
 * Options:
 *   --dry-run              Run without applying changes
 *   --preset=<name>        Use configuration preset (conservative, balanced, aggressive, testing)
 *   --auto-apply           Apply improvements automatically (with threshold)
 *   --threshold=<0-100>    Confidence threshold for auto-apply (default: 85)
 *   --categories=<list>    Comma-separated list of test deck categories
 *   --max=<number>         Maximum improvements to apply
 *   --verbose              Show detailed output
 *   --config=<file>        Path to custom config file
 */

import { parseArgs } from 'util';
import { 
  AnalyzerImprovementSystem, 
  ImprovementSystemOptions 
} from '../lib/analysis/feedback-loop/analyzer-improvement-system';
import { 
  loadConfig, 
  validateConfig, 
  configPresets,
  FeedbackLoopConfig 
} from '../lib/analysis/feedback-loop/config';
import { TestDeckCategory } from '../lib/analysis/test-decks';
import * as fs from 'fs/promises';
import * as path from 'path';

// Parse command line arguments
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'dry-run': {
      type: 'boolean',
      default: false
    },
    'preset': {
      type: 'string',
      default: 'balanced'
    },
    'auto-apply': {
      type: 'boolean',
      default: false
    },
    'threshold': {
      type: 'string',
      default: '85'
    },
    'categories': {
      type: 'string'
    },
    'max': {
      type: 'string'
    },
    'verbose': {
      type: 'boolean',
      default: false
    },
    'config': {
      type: 'string'
    },
    'help': {
      type: 'boolean',
      default: false
    }
  },
  strict: true,
  allowPositionals: true
});

// Show help if requested
if (values.help) {
  console.log(`
Analyzer Feedback Loop Runner
=============================

This tool runs the automated improvement system for the Pokemon TCG deck analyzer.

Usage:
  npm run analyzer:feedback -- [options]
  npx tsx src/scripts/run-analyzer-feedback-loop.ts [options]

Options:
  --dry-run              Run without applying changes (simulation mode)
  --preset=<name>        Use configuration preset:
                         - conservative: Only high-confidence bug fixes
                         - balanced: Most improvements with safety checks (default)
                         - aggressive: All improvements with higher risk tolerance
                         - testing: Minimal run for testing
  --auto-apply           Apply improvements automatically
  --threshold=<0-100>    Confidence threshold for auto-apply (default: 85)
  --categories=<list>    Test specific deck categories (comma-separated):
                         ${['well-built', 'fundamentally-broken', 'consistency-issues', 
                            'energy-problems', 'evolution-heavy', 'ability-dependent',
                            'prize-trade-poor', 'budget-friendly', 'edge-case', 
                            'beginner-mistake'].join(', ')}
  --max=<number>         Maximum improvements to apply per run
  --verbose              Show detailed output during execution
  --config=<file>        Path to custom JSON config file
  --help                 Show this help message

Examples:
  # Dry run with conservative settings
  npm run analyzer:feedback -- --dry-run --preset=conservative

  # Apply improvements for specific categories
  npm run analyzer:feedback -- --auto-apply --categories=energy-problems,consistency-issues

  # Test with limited improvements
  npm run analyzer:feedback -- --preset=testing --max=3 --verbose

  # Use custom configuration
  npm run analyzer:feedback -- --config=./my-feedback-config.json
`);
  process.exit(0);
}

async function main() {
  console.log('🔄 Pokemon TCG Analyzer Feedback Loop');
  console.log('=====================================\n');

  try {
    // Load configuration
    let config: FeedbackLoopConfig;
    
    if (values.config) {
      // Load custom config file
      const configPath = path.resolve(values.config);
      console.log(`📋 Loading config from: ${configPath}`);
      
      const configContent = await fs.readFile(configPath, 'utf-8');
      const customConfig = JSON.parse(configContent);
      config = loadConfig(customConfig);
    } else {
      // Use preset or default
      const preset = values.preset || 'balanced';
      console.log(`📋 Using preset: ${preset}`);
      
      const presetConfig = configPresets[preset as keyof typeof configPresets];
      if (!presetConfig) {
        throw new Error(`Invalid preset: ${preset}`);
      }
      
      config = loadConfig(presetConfig);
    }
    
    // Apply command line overrides
    if (values['auto-apply']) {
      config.autoApplyThreshold = parseInt(values.threshold || '85');
    }
    
    if (values.max) {
      config.maxImprovementsPerRun = parseInt(values.max);
    }
    
    // Validate configuration
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      console.error('❌ Configuration errors:');
      configErrors.forEach(error => console.error(`   - ${error}`));
      process.exit(1);
    }
    
    // Build run options
    const runOptions: ImprovementSystemOptions = {
      dryRun: values['dry-run'] || false,
      verbose: values.verbose || false,
      autoApplyThreshold: config.autoApplyThreshold
    };
    
    // Parse categories if provided
    if (values.categories) {
      runOptions.categories = values.categories.split(',') as TestDeckCategory[];
      console.log(`🎯 Testing categories: ${runOptions.categories.join(', ')}`);
    }
    
    // Show run configuration
    console.log('\n📊 Run Configuration:');
    console.log(`   Mode: ${runOptions.dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
    console.log(`   Auto-apply threshold: ${config.autoApplyThreshold}%`);
    console.log(`   Max improvements: ${config.maxImprovementsPerRun}`);
    console.log(`   Test sample size: ${config.testSettings.sampleSize} decks`);
    
    if (!runOptions.dryRun) {
      console.log('\n⚠️  WARNING: This will modify code files!');
      console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Create improvement system
    const improvementSystem = new AnalyzerImprovementSystem(config);
    
    // Run improvement cycle
    console.log('\n🚀 Starting improvement cycle...\n');
    const startTime = Date.now();
    
    const result = await improvementSystem.runImprovementCycle(runOptions);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Display results
    console.log('\n📊 Results Summary');
    console.log('==================');
    console.log(`Status: ${result.status}`);
    console.log(`Duration: ${duration}s`);
    console.log(`\nAccuracy:`);
    console.log(`   Before: ${result.testResults.beforeAccuracy.toFixed(1)}%`);
    if (result.testResults.afterAccuracy !== undefined) {
      console.log(`   After:  ${result.testResults.afterAccuracy.toFixed(1)}%`);
      const change = result.testResults.afterAccuracy - result.testResults.beforeAccuracy;
      console.log(`   Change: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`);
    }
    
    console.log(`\nImprovements:`);
    console.log(`   Applied: ${result.improvements.applied.length}`);
    console.log(`   Pending: ${result.improvements.pending.length}`);
    console.log(`   Rejected: ${result.improvements.rejected.length}`);
    
    if (result.testResults.criticalMisses.length > 0) {
      console.log(`\n⚠️  Critical Issues Remaining: ${result.testResults.criticalMisses.length}`);
      if (runOptions.verbose) {
        result.testResults.criticalMisses.forEach(miss => {
          console.log(`   - ${miss}`);
        });
      }
    }
    
    console.log(`\n💰 Estimated Cost: $${result.metrics.estimatedCost.toFixed(4)}`);
    console.log(`   API Calls: ${result.metrics.openAICalls}`);
    console.log(`   Tokens Used: ${result.metrics.tokensUsed}`);
    
    // Show category breakdown
    console.log('\n📈 Accuracy by Category:');
    result.testResults.categoryBreakdown.forEach((accuracy, category) => {
      console.log(`   ${category}: ${accuracy.toFixed(1)}%`);
    });
    
    // Show applied improvements
    if (result.improvements.applied.length > 0 && runOptions.verbose) {
      console.log('\n✅ Applied Improvements:');
      result.improvements.applied.forEach((imp, idx) => {
        console.log(`\n${idx + 1}. ${imp.description}`);
        console.log(`   File: ${imp.file}`);
        console.log(`   Priority: ${imp.priority}`);
        console.log(`   Category: ${imp.category}`);
      });
    }
    
    // Show pending improvements
    if (result.improvements.pending.length > 0) {
      console.log('\n⏳ Pending Improvements (require manual review):');
      result.improvements.pending.forEach((imp, idx) => {
        console.log(`\n${idx + 1}. ${imp.description}`);
        console.log(`   File: ${imp.file}`);
        console.log(`   Priority: ${imp.priority}`);
        console.log(`   Category: ${imp.category}`);
      });
    }
    
    // Get historical statistics
    const stats = await improvementSystem.getStatistics();
    console.log('\n📊 Historical Statistics:');
    console.log(`   Total runs: ${stats.totalRuns}`);
    console.log(`   Average improvement: ${stats.averageAccuracyImprovement.toFixed(1)}%`);
    console.log(`   Success rate: ${stats.successRate.toFixed(1)}%`);
    console.log(`   Total cost: $${stats.totalCost.toFixed(2)}`);
    
    // Exit with appropriate code
    if (result.status === 'failed') {
      process.exit(1);
    } else if (result.status === 'rolled-back') {
      console.log('\n⚠️  Changes were rolled back due to test failures');
      process.exit(2);
    }
    
    console.log('\n✅ Feedback loop completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});