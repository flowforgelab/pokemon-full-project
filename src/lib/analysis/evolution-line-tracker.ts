import { Card, DeckCard } from '@prisma/client';
import type { EvolutionLine } from './types';

export class EvolutionLineTracker {
  private deckCards: Map<string, { card: Card; quantity: number }>;
  
  constructor(deckCards: (DeckCard & { card: Card })[]) {
    this.deckCards = new Map();
    deckCards.forEach(dc => {
      this.deckCards.set(dc.card.name, {
        card: dc.card,
        quantity: dc.quantity
      });
    });
  }
  
  /**
   * Build proper evolution lines from the deck
   */
  buildEvolutionLines(): EvolutionLine[] {
    const evolutionLines: EvolutionLine[] = [];
    const processedCards = new Set<string>();
    
    // First, find all basic Pokemon that have evolutions in the deck
    this.deckCards.forEach((data, cardName) => {
      const card = data.card;
      
      // Skip if already processed or not a basic Pokemon
      if (processedCards.has(cardName) || card.evolvesFrom) {
        return;
      }
      
      // Check if this basic has any evolutions in the deck
      const stage1Cards = this.findEvolutions(card.name);
      
      if (stage1Cards.length > 0 || this.hasEvolutionPotential(card)) {
        const line = this.buildEvolutionLine(card, data.quantity);
        evolutionLines.push(line);
        
        // Mark all cards in this line as processed
        processedCards.add(card.name);
        line.stage1.forEach(name => processedCards.add(name));
        line.stage2.forEach(name => processedCards.add(name));
      }
    });
    
    // Also check for incomplete evolution lines (Stage 1/2 without basics)
    this.deckCards.forEach((data, cardName) => {
      const card = data.card;
      
      if (!processedCards.has(cardName) && card.evolvesFrom) {
        // This is an evolution without its basic in the deck
        const line: EvolutionLine = {
          basePokemon: `${card.evolvesFrom} (MISSING)`,
          stage1: card.stage === 1 ? [cardName] : [],
          stage2: card.stage === 2 ? [cardName] : [],
          completeness: 0, // Incomplete line
          consistency: 0
        };
        evolutionLines.push(line);
        processedCards.add(cardName);
      }
    });
    
    return evolutionLines;
  }
  
  /**
   * Build a complete evolution line starting from a basic Pokemon
   */
  private buildEvolutionLine(basicCard: Card, basicQuantity: number): EvolutionLine {
    const line: EvolutionLine = {
      basePokemon: basicCard.name,
      stage1: [],
      stage2: [],
      completeness: 100,
      consistency: 100
    };
    
    // Find Stage 1 evolutions
    const stage1Data = this.findEvolutions(basicCard.name);
    stage1Data.forEach(({ card, quantity }) => {
      line.stage1.push(card.name);
      
      // Find Stage 2 evolutions of this Stage 1
      const stage2Data = this.findEvolutions(card.name);
      stage2Data.forEach(({ card: stage2Card }) => {
        line.stage2.push(stage2Card.name);
      });
    });
    
    // Calculate completeness and consistency
    line.completeness = this.calculateCompleteness(line);
    line.consistency = this.calculateConsistency(
      basicQuantity,
      stage1Data.map(d => d.quantity),
      line.stage2.length > 0
    );
    
    return line;
  }
  
  /**
   * Find all Pokemon that evolve from the given Pokemon name
   */
  private findEvolutions(evolvesFrom: string): { card: Card; quantity: number }[] {
    const evolutions: { card: Card; quantity: number }[] = [];
    
    this.deckCards.forEach((data) => {
      if (data.card.evolvesFrom === evolvesFrom) {
        evolutions.push(data);
      }
    });
    
    return evolutions;
  }
  
  /**
   * Check if a basic Pokemon typically has evolutions (heuristic)
   */
  private hasEvolutionPotential(card: Card): boolean {
    // Some Pokemon are known to have evolutions even if not in this deck
    const evolvingBasics = [
      'Charmander', 'Squirtle', 'Bulbasaur', 'Pikachu', 'Magikarp',
      'Ralts', 'Beldum', 'Dratini', 'Larvitar', 'Gible', 'Axew',
      'Magnemite', 'Gastly', 'Abra', 'Machop', 'Geodude', 'Blitzle'
    ];
    
    return evolvingBasics.some(name => card.name.includes(name));
  }
  
  /**
   * Calculate how complete an evolution line is
   */
  private calculateCompleteness(line: EvolutionLine): number {
    // Check if we have the basic
    if (line.basePokemon.includes('MISSING')) {
      return 0;
    }
    
    // For Pokemon that typically have Stage 2 forms
    const stage2Lines = [
      'Charizard', 'Blastoise', 'Venusaur', 'Gardevoir', 'Garchomp',
      'Dragonite', 'Tyranitar', 'Salamence', 'Metagross', 'Magnezone'
    ];
    
    const expectsStage2 = stage2Lines.some(name => 
      line.stage1.some(s1 => s1.includes(name.slice(0, -2))) // Rough check
    );
    
    if (expectsStage2 && line.stage2.length === 0) {
      return 66; // Has Stage 1 but missing Stage 2
    }
    
    if (line.stage1.length === 0 && this.hasEvolutionPotential({ name: line.basePokemon } as Card)) {
      return 33; // Only has basic
    }
    
    return 100;
  }
  
  /**
   * Calculate the consistency of an evolution line based on card ratios
   */
  private calculateConsistency(
    basicCount: number,
    stage1Counts: number[],
    hasStage2: boolean
  ): number {
    if (stage1Counts.length === 0) {
      return 100; // No evolutions needed
    }
    
    const totalStage1 = stage1Counts.reduce((sum, count) => sum + count, 0);
    
    // Ideal ratios:
    // 4-3-2 for Stage 2 lines
    // 4-3 or 3-2 for Stage 1 lines
    let idealBasicCount = hasStage2 ? 4 : 3;
    let idealStage1Count = hasStage2 ? 3 : 2;
    
    // Scale down for smaller counts
    if (basicCount <= 2) {
      idealBasicCount = 2;
      idealStage1Count = 1;
    }
    
    // Calculate how close we are to ideal ratios
    const basicRatio = Math.min(1, basicCount / idealBasicCount);
    const stage1Ratio = totalStage1 > 0 ? Math.min(1, totalStage1 / idealStage1Count) : 0;
    
    // Penalize if Stage 1 count exceeds basic count
    const balancePenalty = totalStage1 > basicCount ? 0.7 : 1;
    
    return Math.round(((basicRatio + stage1Ratio) / 2) * balancePenalty * 100);
  }
  
  /**
   * Get a summary of evolution lines for display
   */
  getEvolutionSummary(): {
    completeLines: number;
    incompleteLines: number;
    totalEvolutionPokemon: number;
    averageConsistency: number;
  } {
    const lines = this.buildEvolutionLines();
    
    const completeLines = lines.filter(l => l.completeness === 100).length;
    const incompleteLines = lines.filter(l => l.completeness < 100).length;
    
    const totalEvolutionPokemon = lines.reduce((sum, line) => {
      let count = line.basePokemon.includes('MISSING') ? 0 : 1;
      count += line.stage1.length;
      count += line.stage2.length;
      return sum + count;
    }, 0);
    
    const averageConsistency = lines.length > 0
      ? Math.round(lines.reduce((sum, l) => sum + l.consistency, 0) / lines.length)
      : 0;
    
    return {
      completeLines,
      incompleteLines,
      totalEvolutionPokemon,
      averageConsistency
    };
  }
}