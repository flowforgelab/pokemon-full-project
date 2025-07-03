/**
 * Improvement Tracker
 * 
 * Tracks and manages the history of analyzer improvements
 */

import { ImprovementRun } from './analyzer-improvement-system';
import { CodeImprovement } from '../openai-enhanced-integration';

export interface ImprovementHistory {
  runs: ImprovementRun[];
  totalImprovements: number;
  successfulImprovements: number;
  failedImprovements: number;
  rollbacks: number;
}

export interface ImprovementStatistics {
  totalRuns: number;
  averageAccuracyImprovement: number;
  totalImprovementsApplied: number;
  totalCost: number;
  successRate: number;
}

export class ImprovementTracker {
  private static STORAGE_KEY = 'analyzer-improvement-history';
  private history: ImprovementHistory;
  
  constructor() {
    this.history = this.loadHistory();
  }
  
  /**
   * Save an improvement run
   */
  async saveRun(run: ImprovementRun): Promise<void> {
    this.history.runs.push(run);
    
    // Update counters
    if (run.status === 'completed') {
      this.history.totalImprovements += run.improvements.applied.length;
      
      // Check if improvements were successful
      if (run.testResults.afterAccuracy && 
          run.testResults.afterAccuracy > run.testResults.beforeAccuracy) {
        this.history.successfulImprovements += run.improvements.applied.length;
      } else {
        this.history.failedImprovements += run.improvements.applied.length;
      }
    } else if (run.status === 'rolled-back') {
      this.history.rollbacks++;
      this.history.failedImprovements += run.improvements.applied.length;
    }
    
    this.saveHistory();
  }
  
  /**
   * Get improvement history
   */
  async getHistory(limit?: number): Promise<ImprovementRun[]> {
    const runs = [...this.history.runs];
    runs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return limit ? runs.slice(0, limit) : runs;
  }
  
  /**
   * Get improvement statistics
   */
  async getStatistics(): Promise<ImprovementStatistics> {
    const runs = this.history.runs.filter(r => r.status === 'completed');
    
    // Calculate average accuracy improvement
    let totalImprovement = 0;
    let improvementCount = 0;
    
    runs.forEach(run => {
      if (run.testResults.afterAccuracy !== undefined) {
        const improvement = run.testResults.afterAccuracy - run.testResults.beforeAccuracy;
        totalImprovement += improvement;
        improvementCount++;
      }
    });
    
    const averageAccuracyImprovement = improvementCount > 0 
      ? totalImprovement / improvementCount 
      : 0;
    
    // Calculate total cost
    const totalCost = this.history.runs.reduce(
      (sum, run) => sum + run.metrics.estimatedCost,
      0
    );
    
    // Calculate success rate
    const successRate = this.history.totalImprovements > 0
      ? (this.history.successfulImprovements / this.history.totalImprovements) * 100
      : 0;
    
    return {
      totalRuns: this.history.runs.length,
      averageAccuracyImprovement,
      totalImprovementsApplied: this.history.totalImprovements,
      totalCost,
      successRate
    };
  }
  
  /**
   * Get improvements by category
   */
  async getImprovementsByCategory(): Promise<Map<string, CodeImprovement[]>> {
    const byCategory = new Map<string, CodeImprovement[]>();
    
    this.history.runs.forEach(run => {
      run.improvements.applied.forEach(improvement => {
        if (!byCategory.has(improvement.category)) {
          byCategory.set(improvement.category, []);
        }
        byCategory.get(improvement.category)!.push(improvement);
      });
    });
    
    return byCategory;
  }
  
  /**
   * Get improvements by file
   */
  async getImprovementsByFile(): Promise<Map<string, CodeImprovement[]>> {
    const byFile = new Map<string, CodeImprovement[]>();
    
    this.history.runs.forEach(run => {
      run.improvements.applied.forEach(improvement => {
        if (!byFile.has(improvement.file)) {
          byFile.set(improvement.file, []);
        }
        byFile.get(improvement.file)!.push(improvement);
      });
    });
    
    return byFile;
  }
  
  /**
   * Find runs with specific characteristics
   */
  async findRuns(filter: {
    minAccuracyImprovement?: number;
    maxAccuracyImprovement?: number;
    status?: ImprovementRun['status'];
    afterDate?: Date;
    beforeDate?: Date;
  }): Promise<ImprovementRun[]> {
    return this.history.runs.filter(run => {
      if (filter.status && run.status !== filter.status) return false;
      
      if (filter.afterDate && run.timestamp < filter.afterDate) return false;
      if (filter.beforeDate && run.timestamp > filter.beforeDate) return false;
      
      if (run.testResults.afterAccuracy !== undefined) {
        const improvement = run.testResults.afterAccuracy - run.testResults.beforeAccuracy;
        
        if (filter.minAccuracyImprovement !== undefined && 
            improvement < filter.minAccuracyImprovement) return false;
        
        if (filter.maxAccuracyImprovement !== undefined && 
            improvement > filter.maxAccuracyImprovement) return false;
      }
      
      return true;
    });
  }
  
  /**
   * Get most successful improvements
   */
  async getTopImprovements(limit: number = 10): Promise<{
    improvement: CodeImprovement;
    accuracyGain: number;
    runId: string;
  }[]> {
    const improvements: Array<{
      improvement: CodeImprovement;
      accuracyGain: number;
      runId: string;
    }> = [];
    
    this.history.runs.forEach(run => {
      if (run.testResults.afterAccuracy !== undefined) {
        const gain = run.testResults.afterAccuracy - run.testResults.beforeAccuracy;
        
        run.improvements.applied.forEach(imp => {
          improvements.push({
            improvement: imp,
            accuracyGain: gain / run.improvements.applied.length, // Attribute gain equally
            runId: run.id
          });
        });
      }
    });
    
    // Sort by accuracy gain
    improvements.sort((a, b) => b.accuracyGain - a.accuracyGain);
    
    return improvements.slice(0, limit);
  }
  
  /**
   * Clear history (use with caution)
   */
  async clearHistory(): Promise<void> {
    this.history = {
      runs: [],
      totalImprovements: 0,
      successfulImprovements: 0,
      failedImprovements: 0,
      rollbacks: 0
    };
    this.saveHistory();
  }
  
  /**
   * Export history as JSON
   */
  async exportHistory(): Promise<string> {
    return JSON.stringify(this.history, null, 2);
  }
  
  /**
   * Import history from JSON
   */
  async importHistory(json: string): Promise<void> {
    try {
      const imported = JSON.parse(json);
      
      // Validate structure
      if (!imported.runs || !Array.isArray(imported.runs)) {
        throw new Error('Invalid history format');
      }
      
      // Convert date strings back to Date objects
      imported.runs.forEach((run: any) => {
        run.timestamp = new Date(run.timestamp);
      });
      
      this.history = imported;
      this.saveHistory();
    } catch (error) {
      throw new Error(`Failed to import history: ${error}`);
    }
  }
  
  /**
   * Load history from storage
   */
  private loadHistory(): ImprovementHistory {
    if (typeof window === 'undefined') {
      // Server-side: return empty history
      return {
        runs: [],
        totalImprovements: 0,
        successfulImprovements: 0,
        failedImprovements: 0,
        rollbacks: 0
      };
    }
    
    try {
      const stored = localStorage.getItem(ImprovementTracker.STORAGE_KEY);
      if (stored) {
        const history = JSON.parse(stored);
        
        // Convert date strings back to Date objects
        history.runs.forEach((run: any) => {
          run.timestamp = new Date(run.timestamp);
        });
        
        return history;
      }
    } catch (error) {
      console.error('Failed to load improvement history:', error);
    }
    
    return {
      runs: [],
      totalImprovements: 0,
      successfulImprovements: 0,
      failedImprovements: 0,
      rollbacks: 0
    };
  }
  
  /**
   * Save history to storage
   */
  private saveHistory(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(
        ImprovementTracker.STORAGE_KEY,
        JSON.stringify(this.history)
      );
    } catch (error) {
      console.error('Failed to save improvement history:', error);
    }
  }
}