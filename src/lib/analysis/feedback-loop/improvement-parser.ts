/**
 * Improvement Parser
 * 
 * Parses and validates code improvements from OpenAI
 */

import * as ts from 'typescript';
import { CodeImprovement } from '../openai-enhanced-integration';

export interface ParsedImprovement extends CodeImprovement {
  isValid: boolean;
  validationErrors: string[];
  ast?: ts.SourceFile;
  imports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
  dependencies: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  risk: 'low' | 'medium' | 'high';
}

export class ImprovementParser {
  private compilerOptions: ts.CompilerOptions;
  
  constructor() {
    this.compilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      jsx: ts.JsxEmit.React,
      lib: ['es2020', 'dom']
    };
  }
  
  /**
   * Parse a code improvement
   */
  parseImprovement(improvement: CodeImprovement): ParsedImprovement {
    const parsed: ParsedImprovement = {
      ...improvement,
      isValid: false,
      validationErrors: [],
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      dependencies: []
    };
    
    try {
      // Create AST from new code
      const sourceFile = ts.createSourceFile(
        improvement.file,
        improvement.newCode,
        ts.ScriptTarget.ES2020,
        true,
        ts.ScriptKind.TS
      );
      
      parsed.ast = sourceFile;
      
      // Extract metadata
      this.extractMetadata(sourceFile, parsed);
      
      // Validate the code
      const validation = this.validateCode(improvement);
      parsed.isValid = validation.isValid;
      parsed.validationErrors = validation.errors;
      
    } catch (error) {
      parsed.validationErrors.push(`Parse error: ${error}`);
    }
    
    return parsed;
  }
  
  /**
   * Validate code improvement
   */
  validateCode(improvement: CodeImprovement): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let risk: 'low' | 'medium' | 'high' = 'low';
    
    // Check for syntax errors
    const syntaxErrors = this.checkSyntax(improvement.newCode);
    errors.push(...syntaxErrors);
    
    // Check for dangerous patterns
    const dangerousPatterns = this.checkDangerousPatterns(improvement.newCode);
    if (dangerousPatterns.length > 0) {
      warnings.push(...dangerousPatterns);
      risk = 'high';
    }
    
    // Check for type errors (basic)
    const typeErrors = this.checkTypes(improvement.newCode);
    errors.push(...typeErrors);
    
    // Check complexity
    const complexity = this.calculateComplexity(improvement.newCode);
    if (complexity > 20) {
      warnings.push(`High complexity: ${complexity}`);
      risk = risk === 'low' ? 'medium' : risk;
    }
    
    // Check if removing required code
    if (improvement.oldCode && !improvement.newCode.includes('export')) {
      const oldExports = this.extractExports(improvement.oldCode);
      const newExports = this.extractExports(improvement.newCode);
      
      const removedExports = oldExports.filter(e => !newExports.includes(e));
      if (removedExports.length > 0) {
        errors.push(`Removes exports: ${removedExports.join(', ')}`);
        risk = 'high';
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      risk
    };
  }
  
  /**
   * Check syntax errors
   */
  private checkSyntax(code: string): string[] {
    const errors: string[] = [];
    
    try {
      const sourceFile = ts.createSourceFile(
        'temp.ts',
        code,
        ts.ScriptTarget.ES2020,
        true,
        ts.ScriptKind.TS
      );
      
      // Check for syntax errors
      const syntaxErrors = (sourceFile as any).parseDiagnostics || [];
      syntaxErrors.forEach((diag: ts.Diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        errors.push(`Syntax error: ${message}`);
      });
      
    } catch (error) {
      errors.push(`Failed to parse: ${error}`);
    }
    
    return errors;
  }
  
  /**
   * Check for dangerous patterns
   */
  private checkDangerousPatterns(code: string): string[] {
    const warnings: string[] = [];
    
    // Check for eval
    if (code.includes('eval(')) {
      warnings.push('Contains eval() - potential security risk');
    }
    
    // Check for dynamic requires
    if (code.match(/require\s*\([^'"]/)) {
      warnings.push('Contains dynamic require - potential security risk');
    }
    
    // Check for file system operations
    if (code.match(/\b(readFile|writeFile|unlink|rmdir)\b/)) {
      warnings.push('Contains file system operations');
    }
    
    // Check for process operations
    if (code.match(/\bprocess\.(exit|env|argv)/)) {
      warnings.push('Contains process operations');
    }
    
    // Check for network operations
    if (code.match(/\b(fetch|axios|http|request)\b/)) {
      warnings.push('Contains network operations');
    }
    
    // Check for infinite loops
    if (code.match(/while\s*\(\s*true\s*\)/)) {
      warnings.push('Contains potential infinite loop');
    }
    
    return warnings;
  }
  
  /**
   * Basic type checking
   */
  private checkTypes(code: string): string[] {
    const errors: string[] = [];
    
    // Create a simple program to check types
    const host = ts.createCompilerHost(this.compilerOptions);
    
    // Override to provide our source
    const originalGetSourceFile = host.getSourceFile;
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      if (fileName === 'temp.ts') {
        return ts.createSourceFile(fileName, code, languageVersion, true);
      }
      return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    };
    
    const program = ts.createProgram(['temp.ts'], this.compilerOptions, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    
    diagnostics.forEach(diagnostic => {
      if (diagnostic.file) {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        errors.push(`Type error: ${message}`);
      }
    });
    
    return errors;
  }
  
  /**
   * Calculate cyclomatic complexity
   */
  private calculateComplexity(code: string): number {
    let complexity = 1; // Base complexity
    
    // Count decision points
    const decisionPatterns = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bdo\b/g,
      /\bcatch\b/g,
      /\?\s*[^:]+:/g, // Ternary operator
      /\&\&/g, // Logical AND
      /\|\|/g  // Logical OR
    ];
    
    decisionPatterns.forEach(pattern => {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }
  
  /**
   * Extract metadata from AST
   */
  private extractMetadata(sourceFile: ts.SourceFile, parsed: ParsedImprovement): void {
    const visit = (node: ts.Node) => {
      // Extract imports
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          parsed.imports.push(moduleSpecifier.text);
          if (!moduleSpecifier.text.startsWith('.')) {
            parsed.dependencies.push(moduleSpecifier.text);
          }
        }
      }
      
      // Extract exports
      if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
        parsed.exports.push(node.getText(sourceFile));
      }
      
      // Extract function declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        parsed.functions.push(node.name.getText(sourceFile));
      }
      
      // Extract class declarations
      if (ts.isClassDeclaration(node) && node.name) {
        parsed.classes.push(node.name.getText(sourceFile));
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(sourceFile);
  }
  
  /**
   * Extract exports from code string
   */
  private extractExports(code: string): string[] {
    const exports: string[] = [];
    
    // Match export statements
    const exportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
    let match;
    
    while ((match = exportRegex.exec(code)) !== null) {
      exports.push(match[1]);
    }
    
    // Match default exports
    if (code.includes('export default')) {
      exports.push('default');
    }
    
    return exports;
  }
  
  /**
   * Compare two code blocks and identify changes
   */
  compareCode(oldCode: string, newCode: string): {
    additions: string[];
    deletions: string[];
    modifications: string[];
  } {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    
    const additions: string[] = [];
    const deletions: string[] = [];
    const modifications: string[] = [];
    
    // Simple line-based comparison
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (!oldLine && newLine) {
        additions.push(`Line ${i + 1}: ${newLine.trim()}`);
      } else if (oldLine && !newLine) {
        deletions.push(`Line ${i + 1}: ${oldLine.trim()}`);
      } else if (oldLine !== newLine) {
        modifications.push(`Line ${i + 1}: ${oldLine.trim()} → ${newLine.trim()}`);
      }
    }
    
    return { additions, deletions, modifications };
  }
  
  /**
   * Generate a safety report for an improvement
   */
  generateSafetyReport(parsed: ParsedImprovement): {
    riskLevel: 'low' | 'medium' | 'high';
    concerns: string[];
    recommendations: string[];
  } {
    const concerns: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    // Check validation errors
    if (parsed.validationErrors.length > 0) {
      concerns.push(`${parsed.validationErrors.length} validation errors`);
      riskLevel = 'high';
    }
    
    // Check removed exports
    if (parsed.oldCode) {
      const oldExports = this.extractExports(parsed.oldCode);
      const removedExports = oldExports.filter(e => !parsed.exports.includes(e));
      if (removedExports.length > 0) {
        concerns.push(`Removes ${removedExports.length} exports`);
        recommendations.push('Ensure removed exports are not used elsewhere');
        riskLevel = 'high';
      }
    }
    
    // Check new dependencies
    if (parsed.dependencies.length > 0) {
      concerns.push(`Adds ${parsed.dependencies.length} dependencies`);
      recommendations.push('Verify all dependencies are already installed');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
    
    // Check code size
    const lineCount = parsed.newCode.split('\n').length;
    if (lineCount > 100) {
      concerns.push(`Large change: ${lineCount} lines`);
      recommendations.push('Consider breaking into smaller improvements');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
    
    // Check complexity
    const complexity = this.calculateComplexity(parsed.newCode);
    if (complexity > 20) {
      concerns.push(`High complexity: ${complexity}`);
      recommendations.push('Consider simplifying the logic');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
    
    return { riskLevel, concerns, recommendations };
  }
}