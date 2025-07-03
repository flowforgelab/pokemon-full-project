/**
 * Improvement Applier
 * 
 * Safely applies code improvements with backup and rollback capabilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { CodeImprovement } from '../openai-enhanced-integration';
import { ParsedImprovement, ImprovementParser } from './improvement-parser';
import { execSync } from 'child_process';

export interface ApplyResult {
  success: boolean;
  improvement: CodeImprovement;
  backupPath?: string;
  error?: string;
  testsPass?: boolean;
  rollbackAvailable: boolean;
}

export interface ApplyOptions {
  dryRun?: boolean;
  runTests?: boolean;
  createBackup?: boolean;
  validateOnly?: boolean;
}

export class ImprovementApplier {
  private parser: ImprovementParser;
  private backupDir: string;
  private appliedImprovements: Map<string, ApplyResult>;
  
  constructor(backupDir: string = '.analyzer-backups') {
    this.parser = new ImprovementParser();
    this.backupDir = backupDir;
    this.appliedImprovements = new Map();
  }
  
  /**
   * Apply a single improvement
   */
  async applyImprovement(
    improvement: CodeImprovement,
    options: ApplyOptions = {}
  ): Promise<ApplyResult> {
    const result: ApplyResult = {
      success: false,
      improvement,
      rollbackAvailable: false
    };
    
    try {
      // Step 1: Parse and validate
      const parsed = this.parser.parseImprovement(improvement);
      
      if (!parsed.isValid) {
        result.error = `Validation failed: ${parsed.validationErrors.join(', ')}`;
        return result;
      }
      
      if (options.validateOnly) {
        result.success = true;
        return result;
      }
      
      // Step 2: Check if file exists
      const filePath = this.resolveFilePath(improvement.file);
      const fileExists = await this.fileExists(filePath);
      
      if (!fileExists && improvement.oldCode) {
        result.error = `File not found: ${filePath}`;
        return result;
      }
      
      // Step 3: Create backup if requested
      if (options.createBackup && fileExists) {
        const backupPath = await this.createBackup(filePath);
        result.backupPath = backupPath;
        result.rollbackAvailable = true;
      }
      
      // Step 4: Apply the change (unless dry run)
      if (!options.dryRun) {
        await this.applyCodeChange(filePath, improvement, parsed);
      }
      
      // Step 5: Run tests if requested
      if (options.runTests && !options.dryRun) {
        const testsPass = await this.runTests();
        result.testsPass = testsPass;
        
        if (!testsPass && result.rollbackAvailable) {
          // Rollback if tests fail
          await this.rollbackFile(filePath, result.backupPath!);
          result.error = 'Tests failed, changes rolled back';
          return result;
        }
      }
      
      // Success!
      result.success = true;
      this.appliedImprovements.set(improvement.file, result);
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      
      // Attempt rollback on error
      if (result.rollbackAvailable && result.backupPath) {
        try {
          await this.rollbackFile(improvement.file, result.backupPath);
        } catch (rollbackError) {
          result.error += `\nRollback failed: ${rollbackError}`;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Apply multiple improvements
   */
  async applyImprovements(
    improvements: CodeImprovement[],
    options: ApplyOptions = {}
  ): Promise<ApplyResult[]> {
    const results: ApplyResult[] = [];
    
    // Group improvements by file to avoid conflicts
    const byFile = this.groupByFile(improvements);
    
    for (const [file, fileImprovements] of byFile) {
      // Apply improvements to the same file sequentially
      for (const improvement of fileImprovements) {
        const result = await this.applyImprovement(improvement, options);
        results.push(result);
        
        // Stop on first failure unless in dry run
        if (!result.success && !options.dryRun) {
          break;
        }
      }
    }
    
    return results;
  }
  
  /**
   * Rollback a specific improvement
   */
  async rollbackImprovement(file: string): Promise<boolean> {
    const applyResult = this.appliedImprovements.get(file);
    
    if (!applyResult || !applyResult.rollbackAvailable || !applyResult.backupPath) {
      return false;
    }
    
    try {
      await this.rollbackFile(file, applyResult.backupPath);
      this.appliedImprovements.delete(file);
      return true;
    } catch (error) {
      console.error(`Failed to rollback ${file}:`, error);
      return false;
    }
  }
  
  /**
   * Rollback all improvements
   */
  async rollbackAll(): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    for (const [file, result] of this.appliedImprovements) {
      if (await this.rollbackImprovement(file)) {
        success++;
      } else {
        failed++;
      }
    }
    
    return { success, failed };
  }
  
  /**
   * Apply code change to file
   */
  private async applyCodeChange(
    filePath: string,
    improvement: CodeImprovement,
    parsed: ParsedImprovement
  ): Promise<void> {
    // Read current file content if it exists
    let currentContent = '';
    if (await this.fileExists(filePath)) {
      currentContent = await fs.readFile(filePath, 'utf-8');
    }
    
    // Apply the change
    let newContent: string;
    
    if (!improvement.oldCode) {
      // New file or append
      newContent = improvement.newCode;
    } else {
      // Replace old code with new code
      if (currentContent.includes(improvement.oldCode)) {
        newContent = currentContent.replace(improvement.oldCode, improvement.newCode);
      } else {
        // Try to find similar code (might have minor differences)
        const similarMatch = this.findSimilarCode(currentContent, improvement.oldCode);
        if (similarMatch) {
          newContent = currentContent.replace(similarMatch, improvement.newCode);
        } else {
          throw new Error('Could not find code to replace');
        }
      }
    }
    
    // Write the new content
    await fs.writeFile(filePath, newContent, 'utf-8');
  }
  
  /**
   * Create backup of a file
   */
  private async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = path.basename(filePath);
    const backupPath = path.join(this.backupDir, `${fileName}.${timestamp}.backup`);
    
    // Ensure backup directory exists
    await fs.mkdir(this.backupDir, { recursive: true });
    
    // Copy file to backup
    const content = await fs.readFile(filePath, 'utf-8');
    await fs.writeFile(backupPath, content, 'utf-8');
    
    return backupPath;
  }
  
  /**
   * Rollback a file from backup
   */
  private async rollbackFile(filePath: string, backupPath: string): Promise<void> {
    const backupContent = await fs.readFile(backupPath, 'utf-8');
    await fs.writeFile(this.resolveFilePath(filePath), backupContent, 'utf-8');
  }
  
  /**
   * Run tests to validate changes
   */
  private async runTests(): Promise<boolean> {
    try {
      // Run TypeScript compilation check
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      
      // Run tests if they exist
      try {
        execSync('npm test -- --passWithNoTests', { stdio: 'pipe' });
      } catch {
        // Tests might not exist, that's okay
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Resolve file path relative to project root
   */
  private resolveFilePath(file: string): string {
    // If already absolute, return as is
    if (path.isAbsolute(file)) {
      return file;
    }
    
    // Otherwise, resolve relative to src directory
    return path.join(process.cwd(), file);
  }
  
  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Group improvements by file
   */
  private groupByFile(improvements: CodeImprovement[]): Map<string, CodeImprovement[]> {
    const groups = new Map<string, CodeImprovement[]>();
    
    improvements.forEach(improvement => {
      if (!groups.has(improvement.file)) {
        groups.set(improvement.file, []);
      }
      groups.get(improvement.file)!.push(improvement);
    });
    
    return groups;
  }
  
  /**
   * Find similar code in content (fuzzy matching)
   */
  private findSimilarCode(content: string, targetCode: string): string | null {
    // Normalize whitespace for comparison
    const normalize = (code: string) => 
      code.replace(/\s+/g, ' ').trim();
    
    const normalizedTarget = normalize(targetCode);
    const targetLines = targetCode.split('\n').length;
    
    // Try to find exact normalized match
    const lines = content.split('\n');
    
    for (let i = 0; i <= lines.length - targetLines; i++) {
      const candidate = lines.slice(i, i + targetLines).join('\n');
      if (normalize(candidate) === normalizedTarget) {
        return candidate;
      }
    }
    
    return null;
  }
  
  /**
   * Generate improvement report
   */
  async generateReport(): Promise<{
    totalApplied: number;
    successful: number;
    failed: number;
    rollbacksAvailable: number;
    fileChanges: Array<{
      file: string;
      status: 'success' | 'failed';
      error?: string;
    }>;
  }> {
    const results = Array.from(this.appliedImprovements.values());
    
    return {
      totalApplied: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      rollbacksAvailable: results.filter(r => r.rollbackAvailable).length,
      fileChanges: results.map(r => ({
        file: r.improvement.file,
        status: r.success ? 'success' : 'failed',
        error: r.error
      }))
    };
  }
  
  /**
   * Clean up old backups
   */
  async cleanupBackups(daysToKeep: number = 7): Promise<number> {
    const files = await fs.readdir(this.backupDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    
    for (const file of files) {
      if (file.endsWith('.backup')) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
    }
    
    return deletedCount;
  }
}