import { Card, Supertype } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  DeckComposition,
  DeckSuggestion,
  BuildingPattern,
  CardEntry,
} from './types';
import { RecommendationEngine } from '../recommendations/recommendation-engine';

export class SmartSuggestionEngine {
  private recommendationEngine: RecommendationEngine;
  private userPatterns: Map<string, BuildingPattern> = new Map();

  constructor() {
    this.recommendationEngine = new RecommendationEngine();
  }

  async generateSuggestions(
    composition: DeckComposition,
    userId: string
  ): Promise<DeckSuggestion[]> {
    const suggestions: DeckSuggestion[] = [];
    
    // Load user patterns
    const pattern = await this.loadUserPattern(userId);
    
    // Analyze current deck state
    const analysis = await this.analyzeDeckState(composition);
    
    // Generate different types of suggestions
    const [
      cardSuggestions,
      strategySuggestions,
      fixSuggestions,
    ] = await Promise.all([
      this.generateCardSuggestions(composition, pattern, analysis),
      this.generateStrategySuggestions(composition, analysis),
      this.generateFixSuggestions(composition, analysis),
    ]);
    
    suggestions.push(...cardSuggestions, ...strategySuggestions, ...fixSuggestions);
    
    // Sort by priority and relevance
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private async generateCardSuggestions(
    composition: DeckComposition,
    pattern: BuildingPattern,
    analysis: any
  ): Promise<DeckSuggestion[]> {
    const suggestions: DeckSuggestion[] = [];
    
    // Check for missing key cards
    if (analysis.missingDrawSupport) {
      const drawSupporters = await this.findDrawSupporters(composition);
      if (drawSupporters.length > 0) {
        suggestions.push({
          type: 'card',
          priority: 'high',
          title: 'Add Draw Support',
          description: 'Your deck lacks consistent draw power. Consider adding these supporters.',
          cards: drawSupporters,
          impact: 'Improves consistency by 20-30%',
          implementation: [
            'Add 2-4 copies of Professor\'s Research',
            'Include 2-3 copies of Marnie or similar',
            'Consider adding draw-engine Pokémon like Bibarel',
          ],
        });
      }
    }
    
    // Check for missing search cards
    if (analysis.missingSearchCards) {
      const searchCards = await this.findSearchCards(composition);
      if (searchCards.length > 0) {
        suggestions.push({
          type: 'card',
          priority: 'high',
          title: 'Add Search Cards',
          description: 'Add Pokémon search cards to find your key pieces faster.',
          cards: searchCards,
          impact: 'Reduces setup time by 1-2 turns',
          implementation: [
            'Add 4 Quick Ball for Basic Pokémon',
            'Include Evolution Incense for evolution decks',
            'Consider Ultra Ball for versatility',
          ],
        });
      }
    }
    
    // Synergy-based suggestions
    const synergySuggestions = await this.findSynergyCards(composition, pattern);
    suggestions.push(...synergySuggestions);
    
    // Budget alternatives
    if (pattern.preferences.budgetRange.max < 200) {
      const budgetAlternatives = await this.findBudgetAlternatives(composition);
      suggestions.push(...budgetAlternatives);
    }
    
    return suggestions;
  }

  private async generateStrategySuggestions(
    composition: DeckComposition,
    analysis: any
  ): Promise<DeckSuggestion[]> {
    const suggestions: DeckSuggestion[] = [];
    
    // Energy balance suggestions
    if (analysis.energyImbalance) {
      suggestions.push({
        type: 'strategy',
        priority: 'medium',
        title: 'Adjust Energy Count',
        description: `Your energy count (${composition.energyCount}) may be ${analysis.energyImbalance}. Most decks run 8-12 energy.`,
        impact: 'Prevents energy drought or dead draws',
        implementation: analysis.energyImbalance === 'too high' 
          ? ['Remove 2-3 basic energy', 'Add more trainers for consistency']
          : ['Add 2-3 basic energy', 'Consider energy search cards'],
      });
    }
    
    // Evolution line suggestions
    if (analysis.evolutionIssues) {
      suggestions.push({
        type: 'strategy',
        priority: 'high',
        title: 'Fix Evolution Lines',
        description: 'Your evolution ratios need adjustment for better consistency.',
        impact: 'Reduces dead cards and improves setup',
        implementation: analysis.evolutionIssues.map((issue: any) => issue.fix),
      });
    }
    
    // Tech card suggestions
    const metaTechs = await this.suggestTechCards(composition);
    if (metaTechs.length > 0) {
      suggestions.push({
        type: 'strategy',
        priority: 'low',
        title: 'Consider Tech Cards',
        description: 'These tech cards could help in specific matchups.',
        cards: metaTechs,
        impact: 'Improves specific matchups by 10-20%',
      });
    }
    
    return suggestions;
  }

  private async generateFixSuggestions(
    composition: DeckComposition,
    analysis: any
  ): Promise<DeckSuggestion[]> {
    const suggestions: DeckSuggestion[] = [];
    
    // Deck size fix
    if (composition.totalCards !== 60) {
      const diff = 60 - composition.totalCards;
      suggestions.push({
        type: 'fix',
        priority: 'high',
        title: 'Fix Deck Size',
        description: `Your deck has ${composition.totalCards} cards. ${diff > 0 ? 'Add' : 'Remove'} ${Math.abs(diff)} cards.`,
        impact: 'Required for legal play',
        implementation: diff > 0 
          ? ['Add consistency trainers', 'Include more energy if needed']
          : ['Remove redundant cards', 'Cut down to 3-4 copies max'],
      });
    }
    
    // Card limit violations
    const violations = await this.findCardLimitViolations(composition);
    violations.forEach(violation => {
      suggestions.push({
        type: 'fix',
        priority: 'high',
        title: `Fix Card Limit: ${violation.cardName}`,
        description: `You have ${violation.count} copies of ${violation.cardName}. Maximum allowed is ${violation.maxAllowed}.`,
        impact: 'Required for tournament play',
        implementation: [`Remove ${violation.count - violation.maxAllowed} copies of ${violation.cardName}`],
      });
    });
    
    // Missing basic Pokémon
    if (analysis.noBasicPokemon) {
      suggestions.push({
        type: 'fix',
        priority: 'high',
        title: 'Add Basic Pokémon',
        description: 'Your deck has no Basic Pokémon. You need at least one to start the game.',
        impact: 'Required to play - prevents automatic loss',
        implementation: ['Add 8-12 Basic Pokémon', 'Consider your main attackers'],
      });
    }
    
    return suggestions;
  }

  private async analyzeDeckState(composition: DeckComposition) {
    const allCards = [
      ...composition.mainDeck.pokemon,
      ...composition.mainDeck.trainers,
      ...composition.mainDeck.energy,
    ];
    
    // Check for draw support
    const drawSupportCount = composition.mainDeck.trainers
      .filter(e => this.isDrawSupporter(e.card))
      .reduce((sum, e) => sum + e.quantity, 0);
    
    // Check for search cards
    const searchCardCount = composition.mainDeck.trainers
      .filter(e => this.isSearchCard(e.card))
      .reduce((sum, e) => sum + e.quantity, 0);
    
    // Check energy balance
    const energyRatio = composition.energyCount / composition.totalCards;
    let energyImbalance = null;
    if (energyRatio < 0.13) energyImbalance = 'too low';
    if (energyRatio > 0.25) energyImbalance = 'too high';
    
    // Check for basic Pokémon
    const basicPokemonCount = composition.mainDeck.pokemon
      .filter(e => e.card.subtypes?.includes('Basic'))
      .reduce((sum, e) => sum + e.quantity, 0);
    
    // Check evolution lines
    const evolutionIssues = this.checkEvolutionBalance(composition.mainDeck.pokemon);
    
    return {
      missingDrawSupport: drawSupportCount < 6,
      missingSearchCards: searchCardCount < 4,
      energyImbalance,
      noBasicPokemon: basicPokemonCount === 0,
      evolutionIssues: evolutionIssues.length > 0 ? evolutionIssues : null,
    };
  }

  private async loadUserPattern(userId: string): Promise<BuildingPattern> {
    // Check cache
    if (this.userPatterns.has(userId)) {
      return this.userPatterns.get(userId)!;
    }
    
    // Load from database (would need UserPreferences model)
    // For now, return default pattern
    const pattern: BuildingPattern = {
      userId,
      preferences: {
        favoriteTypes: [],
        budgetRange: { min: 0, max: 500 },
        preferredArchetypes: [],
        avoidedCards: [],
      },
      history: {
        recentDecks: [],
        commonIncludes: [],
        successfulDecks: [],
      },
    };
    
    this.userPatterns.set(userId, pattern);
    return pattern;
  }

  async recordFeedback(
    userId: string,
    suggestionId: string,
    accepted: boolean
  ): Promise<void> {
    // Record user feedback to improve future suggestions
    // This would update the user's pattern and preferences
    const pattern = await this.loadUserPattern(userId);
    
    // Update pattern based on feedback
    // For now, just log
    console.log(`User ${userId} ${accepted ? 'accepted' : 'rejected'} suggestion ${suggestionId}`);
  }

  // Helper methods
  private isDrawSupporter(card: Card): boolean {
    const drawSupporters = [
      'Professor\'s Research', 'Marnie', 'Cynthia', 'Hop',
      'Judge', 'N', 'Colress', 'Juniper', 'Sycamore',
    ];
    
    return card.supertype === Supertype.TRAINER &&
           card.subtypes?.includes('Supporter') &&
           drawSupporters.some(name => card.name.includes(name));
  }

  private isSearchCard(card: Card): boolean {
    const searchCards = [
      'Quick Ball', 'Ultra Ball', 'Great Ball', 'Level Ball',
      'Evolution Incense', 'Nest Ball', 'Timer Ball',
    ];
    
    return card.supertype === Supertype.TRAINER &&
           searchCards.some(name => card.name.includes(name));
  }

  private async findDrawSupporters(composition: DeckComposition): Promise<Card[]> {
    const existingNames = composition.mainDeck.trainers.map(e => e.card.name);
    
    const drawSupporters = await prisma.card.findMany({
      where: {
        supertype: Supertype.TRAINER,
        subtypes: { has: 'Supporter' },
        OR: [
          { name: { contains: 'Professor\'s Research' } },
          { name: { contains: 'Marnie' } },
          { name: { contains: 'Cynthia' } },
        ],
        NOT: {
          name: { in: existingNames },
        },
      },
      take: 5,
    });
    
    return drawSupporters;
  }

  private async findSearchCards(composition: DeckComposition): Promise<Card[]> {
    const existingNames = composition.mainDeck.trainers.map(e => e.card.name);
    
    const searchCards = await prisma.card.findMany({
      where: {
        supertype: Supertype.TRAINER,
        OR: [
          { name: { contains: 'Quick Ball' } },
          { name: { contains: 'Ultra Ball' } },
          { name: { contains: 'Evolution Incense' } },
        ],
        NOT: {
          name: { in: existingNames },
        },
      },
      take: 5,
    });
    
    return searchCards;
  }

  private async findSynergyCards(
    composition: DeckComposition,
    pattern: BuildingPattern
  ): Promise<DeckSuggestion[]> {
    const suggestions: DeckSuggestion[] = [];
    
    // Use recommendation engine to find synergistic cards
    const recommendations = await this.recommendationEngine.optimizeDeck(
      { cards: this.compositionToCardList(composition) } as any,
      { maxReplacements: 5 } as any
    );
    
    if (recommendations.replacements && recommendations.replacements.length > 0) {
      suggestions.push({
        type: 'card',
        priority: 'medium',
        title: 'Synergy Improvements',
        description: 'These cards would improve your deck\'s synergy.',
        cards: recommendations.replacements.map(r => r.newCard),
        impact: `Increases synergy score by ${Math.round(recommendations.improvement * 100)}%`,
      });
    }
    
    return suggestions;
  }

  private async findBudgetAlternatives(composition: DeckComposition): Promise<DeckSuggestion[]> {
    const suggestions: DeckSuggestion[] = [];
    const expensiveCards = composition.mainDeck.pokemon
      .concat(composition.mainDeck.trainers)
      .filter(e => e.price > 20)
      .sort((a, b) => b.price - a.price);
    
    if (expensiveCards.length > 0) {
      // Find cheaper alternatives
      const alternatives = await this.findCheaperAlternatives(expensiveCards.slice(0, 3));
      
      if (alternatives.length > 0) {
        suggestions.push({
          type: 'card',
          priority: 'low',
          title: 'Budget Alternatives',
          description: 'Consider these budget-friendly alternatives to expensive cards.',
          cards: alternatives,
          impact: `Saves $${expensiveCards.slice(0, 3).reduce((sum, e) => sum + e.price * e.quantity, 0).toFixed(2)}`,
        });
      }
    }
    
    return suggestions;
  }

  private async findCheaperAlternatives(expensiveCards: CardEntry[]): Promise<Card[]> {
    // This would use a sophisticated matching algorithm
    // For now, return empty array
    return [];
  }

  private async suggestTechCards(composition: DeckComposition): Promise<Card[]> {
    // Analyze meta and suggest tech cards
    // For now, return common tech cards
    const techCards = await prisma.card.findMany({
      where: {
        OR: [
          { name: { contains: 'Path to the Peak' } },
          { name: { contains: 'Lost City' } },
          { name: { contains: 'Spiritomb' } },
        ],
      },
      take: 3,
    });
    
    return techCards;
  }

  private checkEvolutionBalance(pokemon: CardEntry[]): any[] {
    const issues: any[] = [];
    const evolutionLines = new Map<string, { basics: number; stage1s: number; stage2s: number }>();
    
    // Group by evolution line
    pokemon.forEach(entry => {
      const baseName = entry.card.name.split(' ')[0]; // Simplified grouping
      
      if (!evolutionLines.has(baseName)) {
        evolutionLines.set(baseName, { basics: 0, stage1s: 0, stage2s: 0 });
      }
      
      const line = evolutionLines.get(baseName)!;
      
      if (entry.card.subtypes?.includes('Basic')) {
        line.basics += entry.quantity;
      } else if (entry.card.subtypes?.includes('Stage 1')) {
        line.stage1s += entry.quantity;
      } else if (entry.card.subtypes?.includes('Stage 2')) {
        line.stage2s += entry.quantity;
      }
    });
    
    // Check ratios
    evolutionLines.forEach((line, name) => {
      if (line.stage1s > 0 && line.basics === 0) {
        issues.push({
          pokemon: name,
          issue: 'Stage 1 without Basic',
          fix: `Add ${line.stage1s} Basic ${name}`,
        });
      }
      
      if (line.stage2s > 0 && line.stage1s === 0) {
        issues.push({
          pokemon: name,
          issue: 'Stage 2 without Stage 1',
          fix: `Add ${line.stage2s} Stage 1 ${name}`,
        });
      }
      
      if (line.stage1s > line.basics * 2) {
        issues.push({
          pokemon: name,
          issue: 'Too many evolutions',
          fix: `Reduce Stage 1 ${name} or add more Basics`,
        });
      }
    });
    
    return issues;
  }

  private async findCardLimitViolations(composition: DeckComposition): Promise<Array<{
    cardName: string;
    count: number;
    maxAllowed: number;
  }>> {
    const violations: Array<any> = [];
    const cardCounts = new Map<string, { name: string; count: number; isBasicEnergy: boolean }>();
    
    // Count all cards
    const allCards = [
      ...composition.mainDeck.pokemon,
      ...composition.mainDeck.trainers,
      ...composition.mainDeck.energy,
    ];
    
    allCards.forEach(entry => {
      const existing = cardCounts.get(entry.card.id);
      if (existing) {
        existing.count += entry.quantity;
      } else {
        cardCounts.set(entry.card.id, {
          name: entry.card.name,
          count: entry.quantity,
          isBasicEnergy: entry.card.supertype === Supertype.ENERGY && 
                        entry.card.subtypes?.includes('Basic'),
        });
      }
    });
    
    // Check limits
    cardCounts.forEach(({ name, count, isBasicEnergy }) => {
      if (!isBasicEnergy && count > 4) {
        violations.push({
          cardName: name,
          count,
          maxAllowed: 4,
        });
      }
    });
    
    return violations;
  }

  private compositionToCardList(composition: DeckComposition): Card[] {
    const cards: Card[] = [];
    
    const addCards = (entries: CardEntry[]) => {
      entries.forEach(entry => {
        for (let i = 0; i < entry.quantity; i++) {
          cards.push(entry.card);
        }
      });
    };
    
    addCards(composition.mainDeck.pokemon);
    addCards(composition.mainDeck.trainers);
    addCards(composition.mainDeck.energy);
    
    return cards;
  }
}