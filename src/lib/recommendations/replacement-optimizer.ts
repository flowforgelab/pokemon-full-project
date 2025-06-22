import { prisma } from '@/lib/db';
import type { Card, Deck, DeckCard } from '@prisma/client';
import { DeckAnalyzer } from '../analysis/deck-analyzer';
import type { DeckAnalysisResult } from '../analysis/types';
import { SynergyAnalyzer } from '../analysis/synergy-analyzer';
import type {
  CardChange,
  DeckRecommendation,
  ImpactAnalysis,
  AlternativeChange,
  CostBreakdown,
  RecommendationType,
  BuilderConfig,
  SynergyChange,
  CardCost,
  MatchupChange,
} from './types';

/**
 * Optimizes existing decks by recommending card replacements
 */
export class ReplacementOptimizer {
  private analyzer: DeckAnalyzer;
  private synergyAnalyzer: SynergyAnalyzer;
  private cardCache: Map<string, Card> = new Map();
  private priceCache: Map<string, number> = new Map();

  constructor() {
    this.analyzer = new DeckAnalyzer();
    this.synergyAnalyzer = new SynergyAnalyzer();
  }

  /**
   * Analyze deck and recommend replacements
   */
  async optimizeDeck(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    config: BuilderConfig
  ): Promise<DeckRecommendation> {
    // Analyze current deck
    const currentAnalysis = await this.analyzer.analyzeDeck(deck);

    // Identify underperforming cards
    const underperformers = await this.identifyUnderperformingCards(deck, currentAnalysis);

    // Find replacements for each underperformer
    const replacements = await this.findOptimalReplacements(
      deck,
      underperformers,
      currentAnalysis,
      config
    );

    // Calculate overall impact
    const impact = await this.calculateReplacementImpact(
      deck,
      replacements,
      currentAnalysis
    );

    // Calculate costs
    const costs = await this.calculateReplacementCosts(replacements);

    // Generate alternatives
    const alternatives = await this.generateAlternativeReplacements(
      deck,
      underperformers,
      currentAnalysis,
      config
    );

    return {
      id: `opt_${Date.now()}`,
      type: RecommendationType.OPTIMIZE_EXISTING,
      timestamp: new Date(),
      suggestedChanges: replacements,
      reasoning: this.generateOptimizationReasoning(deck, currentAnalysis, replacements),
      expectedImpact: impact,
      alternativeOptions: alternatives,
      costAnalysis: costs,
      difficultyRating: 3, // Replacements are usually easier than building from scratch
      metaRelevance: impact.metaRelevanceChange + currentAnalysis.scores.metaRelevance,
      confidence: this.calculateConfidence(replacements, impact),
    };
  }

  /**
   * Identify cards that are underperforming
   */
  private async identifyUnderperformingCards(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    analysis: DeckAnalysisResult
  ): Promise<(DeckCard & { card: Card })[]> {
    const underperformers: (DeckCard & { card: Card })[] = [];

    // Analyze each card's contribution
    for (const deckCard of deck.cards) {
      const performance = await this.evaluateCardPerformance(deckCard, deck, analysis);
      
      if (performance.score < 50) { // Below 50% performance
        underperformers.push(deckCard);
      }
    }

    // Sort by worst performance first
    return underperformers.sort((a, b) => {
      const aPerf = this.getCardPerformanceScore(a, analysis);
      const bPerf = this.getCardPerformanceScore(b, analysis);
      return aPerf - bPerf;
    });
  }

  /**
   * Evaluate individual card performance
   */
  private async evaluateCardPerformance(
    deckCard: DeckCard & { card: Card },
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    analysis: DeckAnalysisResult
  ): Promise<{ score: number; reasons: string[] }> {
    const reasons: string[] = [];
    let score = 50; // Start at neutral

    // Check synergy with other cards
    const synergies = analysis.synergy.cardInteractions.filter(
      interaction => interaction.card1 === deckCard.card.name || 
                    interaction.card2 === deckCard.card.name
    );
    
    if (synergies.length === 0) {
      score -= 20;
      reasons.push('No significant synergies with other cards');
    } else {
      const avgSynergy = synergies.reduce((sum, s) => sum + s.strength, 0) / synergies.length;
      score += avgSynergy * 20;
    }

    // Check if card fits archetype
    const archetypeCards = this.getArchetypeStaples(analysis.archetype.primaryArchetype);
    if (!archetypeCards.includes(deckCard.card.id)) {
      score -= 10;
      reasons.push(`Not typical for ${analysis.archetype.primaryArchetype} archetype`);
    }

    // Check card efficiency
    if (deckCard.card.supertype === 'Pokémon') {
      const efficiency = this.calculatePokemonEfficiency(deckCard.card);
      if (efficiency < 0.6) {
        score -= 15;
        reasons.push('Low damage-to-energy ratio');
      }
    }

    // Check meta relevance
    const metaScore = await this.getCardMetaScore(deckCard.card);
    if (metaScore < 30) {
      score -= 15;
      reasons.push('Low meta relevance');
    }

    // Check duplicates that might be excessive
    const cardCount = deck.cards.filter(c => c.card.id === deckCard.card.id)
      .reduce((sum, c) => sum + c.quantity, 0);
    if (cardCount > 3 && deckCard.card.supertype !== 'Energy') {
      score -= 10;
      reasons.push('Potentially excessive copies');
    }

    return { score: Math.max(0, Math.min(100, score)), reasons };
  }

  /**
   * Find optimal replacements for underperforming cards
   */
  private async findOptimalReplacements(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    underperformers: (DeckCard & { card: Card })[],
    analysis: DeckAnalysisResult,
    config: BuilderConfig
  ): Promise<CardChange[]> {
    const replacements: CardChange[] = [];

    for (const underperformer of underperformers.slice(0, 5)) { // Limit to 5 changes
      const replacement = await this.findBestReplacement(
        underperformer,
        deck,
        analysis,
        config
      );

      if (replacement) {
        replacements.push(replacement);
      }
    }

    return replacements;
  }

  /**
   * Find the best replacement for a specific card
   */
  private async findBestReplacement(
    toReplace: DeckCard & { card: Card },
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    analysis: DeckAnalysisResult,
    config: BuilderConfig
  ): Promise<CardChange | null> {
    // Find similar cards that might perform better
    const candidates = await this.findReplacementCandidates(toReplace.card, config);

    let bestReplacement: Card | null = null;
    let bestScore = 0;
    let bestReasoning = '';

    for (const candidate of candidates) {
      // Skip if already in deck
      if (deck.cards.some(dc => dc.card.id === candidate.id)) continue;

      // Evaluate replacement
      const score = await this.evaluateReplacement(
        toReplace.card,
        candidate,
        deck,
        analysis,
        config
      );

      if (score.totalScore > bestScore) {
        bestScore = score.totalScore;
        bestReplacement = candidate;
        bestReasoning = score.reasoning;
      }
    }

    if (!bestReplacement) return null;

    // Calculate synergy changes
    const synergyChanges = await this.calculateSynergyChanges(
      toReplace.card,
      bestReplacement,
      deck
    );

    return {
      action: 'replace',
      card: bestReplacement,
      currentCard: toReplace.card,
      quantity: toReplace.quantity,
      reasoning: bestReasoning,
      impact: bestScore,
      synergyChanges,
      alternatives: candidates.slice(0, 3), // Top 3 alternatives
    };
  }

  /**
   * Find potential replacement candidates
   */
  private async findReplacementCandidates(
    cardToReplace: Card,
    config: BuilderConfig
  ): Promise<Card[]> {
    const candidates: Card[] = [];

    // Find cards with similar role
    const whereClause: any = {
      supertype: cardToReplace.supertype,
      id: { not: cardToReplace.id },
    };

    // Add budget constraint
    if (config.constraints.maxBudget) {
      const currentPrice = await this.getCardPrice(cardToReplace.id);
      const maxReplacementPrice = currentPrice + (config.constraints.maxBudget * 0.1); // 10% of budget max
      
      // This would need price filtering logic
    }

    // Add format constraint
    if (config.constraints.format) {
      whereClause.legalities = {
        path: [config.constraints.format],
        equals: 'Legal'
      };
    }

    // Must exclude cards
    if (config.constraints.mustExcludeCards?.length) {
      whereClause.id = {
        ...whereClause.id,
        notIn: config.constraints.mustExcludeCards
      };
    }

    // Find similar cards
    if (cardToReplace.supertype === 'Pokémon') {
      // Similar Pokemon
      const pokemon = await prisma.card.findMany({
        where: {
          ...whereClause,
          types: { hasSome: cardToReplace.types || [] },
          hp: {
            gte: (parseInt(cardToReplace.hp || '0') - 30).toString(),
            lte: (parseInt(cardToReplace.hp || '0') + 30).toString(),
          }
        },
        take: 20,
      });
      candidates.push(...pokemon);
    } else if (cardToReplace.supertype === 'Trainer') {
      // Similar trainers
      const trainers = await prisma.card.findMany({
        where: {
          ...whereClause,
          subtypes: { hasSome: cardToReplace.subtypes || [] },
        },
        take: 20,
      });
      candidates.push(...trainers);
    }

    // Add meta-relevant cards
    const metaCards = await this.getMetaRelevantCards(cardToReplace.supertype, config.constraints.format);
    candidates.push(...metaCards);

    // Remove duplicates
    const uniqueCandidates = Array.from(new Map(candidates.map(c => [c.id, c])).values());

    return uniqueCandidates;
  }

  /**
   * Evaluate how good a replacement would be
   */
  private async evaluateReplacement(
    current: Card,
    replacement: Card,
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    analysis: DeckAnalysisResult,
    config: BuilderConfig
  ): Promise<{ totalScore: number; reasoning: string }> {
    let score = 50; // Start neutral
    const reasons: string[] = [];

    // Compare basic stats
    if (current.supertype === 'Pokémon' && replacement.supertype === 'Pokémon') {
      // HP comparison
      const hpDiff = parseInt(replacement.hp || '0') - parseInt(current.hp || '0');
      if (hpDiff > 0) {
        score += Math.min(hpDiff / 10, 10);
        reasons.push(`+${hpDiff} HP`);
      }

      // Attack efficiency
      const currentEff = this.calculatePokemonEfficiency(current);
      const replacementEff = this.calculatePokemonEfficiency(replacement);
      if (replacementEff > currentEff) {
        score += (replacementEff - currentEff) * 50;
        reasons.push('Better damage efficiency');
      }
    }

    // Synergy improvement
    const synergyImprovement = await this.calculateSynergyImprovement(
      current,
      replacement,
      deck
    );
    score += synergyImprovement * 20;
    if (synergyImprovement > 0) {
      reasons.push('Improved deck synergy');
    }

    // Meta relevance
    const currentMeta = await this.getCardMetaScore(current);
    const replacementMeta = await this.getCardMetaScore(replacement);
    if (replacementMeta > currentMeta) {
      score += (replacementMeta - currentMeta) / 2;
      reasons.push('Higher meta relevance');
    }

    // Cost consideration
    const currentPrice = await this.getCardPrice(current.id);
    const replacementPrice = await this.getCardPrice(replacement.id);
    const priceDiff = replacementPrice - currentPrice;

    if (config.constraints.maxBudget) {
      if (priceDiff > config.constraints.maxBudget * 0.2) {
        score -= 30;
        reasons.push('Significantly more expensive');
      } else if (priceDiff < 0) {
        score += 10;
        reasons.push('More budget-friendly');
      }
    }

    // Archetype fit
    if (this.fitsArchetype(replacement, analysis.archetype.primaryArchetype)) {
      score += 15;
      reasons.push(`Better fit for ${analysis.archetype.primaryArchetype}`);
    }

    const reasoning = reasons.join(', ');
    return { totalScore: Math.max(0, Math.min(100, score)), reasoning };
  }

  /**
   * Calculate synergy changes from replacement
   */
  private async calculateSynergyChanges(
    oldCard: Card,
    newCard: Card,
    deck: Deck & { cards: (DeckCard & { card: Card })[] }
  ): Promise<SynergyChange[]> {
    const changes: SynergyChange[] = [];

    // Analyze synergy with each other card in deck
    for (const deckCard of deck.cards) {
      if (deckCard.card.id === oldCard.id) continue;

      const oldSynergy = this.calculateCardPairSynergy(oldCard, deckCard.card);
      const newSynergy = this.calculateCardPairSynergy(newCard, deckCard.card);

      if (Math.abs(newSynergy - oldSynergy) > 0.1) {
        changes.push({
          affectedCard: deckCard.card.name,
          previousSynergy: oldSynergy,
          newSynergy: newSynergy,
          impact: newSynergy > oldSynergy ? 'positive' : 'negative',
        });
      }
    }

    return changes;
  }

  /**
   * Calculate synergy between two cards
   */
  private calculateCardPairSynergy(card1: Card, card2: Card): number {
    let synergy = 0.5; // Neutral

    // Type synergy
    if (card1.types && card2.types) {
      const sharedTypes = card1.types.filter(t => card2.types?.includes(t));
      if (sharedTypes.length > 0) {
        synergy += 0.2;
      }
    }

    // Energy synergy (Pokemon + Energy)
    if (card1.supertype === 'Pokémon' && card2.supertype === 'Energy') {
      if (card1.types?.some(t => card2.name.toLowerCase().includes(t.toLowerCase()))) {
        synergy += 0.3;
      }
    }

    // Trainer synergy
    if (card1.supertype === 'Trainer' && card2.supertype === 'Pokémon') {
      // Check if trainer mentions Pokemon type/name
      if (card1.text && card2.types?.some(t => card1.text.toLowerCase().includes(t.toLowerCase()))) {
        synergy += 0.2;
      }
    }

    // Ability synergy
    if (card1.abilities && card2.abilities) {
      // Simple check - would need more sophisticated analysis
      synergy += 0.1;
    }

    return Math.min(1, synergy);
  }

  /**
   * Calculate overall impact of replacements
   */
  private async calculateReplacementImpact(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    replacements: CardChange[],
    currentAnalysis: DeckAnalysisResult
  ): Promise<ImpactAnalysis> {
    // Create hypothetical deck with replacements
    const modifiedDeck = this.applyReplacements(deck, replacements);

    // Analyze modified deck
    const newAnalysis = await this.analyzer.analyzeDeck(modifiedDeck);

    // Calculate changes
    const impact: ImpactAnalysis = {
      overallImprovement: newAnalysis.scores.overall - currentAnalysis.scores.overall,
      consistencyChange: newAnalysis.scores.consistency - currentAnalysis.scores.consistency,
      powerChange: newAnalysis.scores.power - currentAnalysis.scores.power,
      speedChange: newAnalysis.scores.speed - currentAnalysis.scores.speed,
      versatilityChange: newAnalysis.scores.versatility - currentAnalysis.scores.versatility,
      metaRelevanceChange: newAnalysis.scores.metaRelevance - currentAnalysis.scores.metaRelevance,
      specificMatchupChanges: await this.calculateMatchupChanges(currentAnalysis, newAnalysis),
    };

    return impact;
  }

  /**
   * Apply replacements to create modified deck
   */
  private applyReplacements(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    replacements: CardChange[]
  ): Deck & { cards: (DeckCard & { card: Card })[] } {
    // Deep clone deck
    const modifiedDeck = {
      ...deck,
      cards: deck.cards.map(dc => ({ ...dc, card: { ...dc.card } }))
    };

    for (const replacement of replacements) {
      if (replacement.action === 'replace' && replacement.currentCard) {
        // Find and replace
        const index = modifiedDeck.cards.findIndex(
          dc => dc.card.id === replacement.currentCard!.id
        );
        if (index !== -1) {
          modifiedDeck.cards[index] = {
            ...modifiedDeck.cards[index],
            card: replacement.card,
          };
        }
      }
    }

    return modifiedDeck;
  }

  /**
   * Calculate matchup changes
   */
  private async calculateMatchupChanges(
    currentAnalysis: DeckAnalysisResult,
    newAnalysis: DeckAnalysisResult
  ): Promise<MatchupChange[]> {
    const changes: MatchupChange[] = [];

    // Compare meta matchups
    for (const currentMatchup of currentAnalysis.meta.popularMatchups) {
      const newMatchup = newAnalysis.meta.popularMatchups.find(
        m => m.archetype === currentMatchup.archetype
      );

      if (newMatchup) {
        const winRateDiff = newMatchup.estimatedWinRate - currentMatchup.estimatedWinRate;
        if (Math.abs(winRateDiff) > 5) { // Significant change
          changes.push({
            archetype: currentMatchup.archetype,
            previousWinRate: currentMatchup.estimatedWinRate,
            newWinRate: newMatchup.estimatedWinRate,
            reasoning: winRateDiff > 0 ? 'Improved matchup' : 'Weakened matchup',
          });
        }
      }
    }

    return changes;
  }

  /**
   * Calculate replacement costs
   */
  private async calculateReplacementCosts(replacements: CardChange[]): Promise<CostBreakdown> {
    let addedCost = 0;
    let removedValue = 0;
    const costPerCard: CardCost[] = [];

    for (const replacement of replacements) {
      const newPrice = await this.getCardPrice(replacement.card.id);
      const newCost: CardCost = {
        card: replacement.card,
        quantity: replacement.quantity,
        unitPrice: newPrice,
        totalPrice: newPrice * replacement.quantity,
        marketTrend: await this.getMarketTrend(replacement.card.id),
      };
      costPerCard.push(newCost);
      addedCost += newCost.totalPrice;

      if (replacement.currentCard) {
        const oldPrice = await this.getCardPrice(replacement.currentCard.id);
        removedValue += oldPrice * replacement.quantity;
      }
    }

    return {
      totalCost: addedCost,
      addedCost,
      removedValue,
      netCost: addedCost - removedValue,
      costPerCard,
      budgetFriendlyAlternatives: addedCost > 100,
    };
  }

  /**
   * Generate alternative replacement options
   */
  private async generateAlternativeReplacements(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    underperformers: (DeckCard & { card: Card })[],
    analysis: DeckAnalysisResult,
    config: BuilderConfig
  ): Promise<AlternativeChange[]> {
    const alternatives: AlternativeChange[] = [];

    // Budget alternative - replace with cheaper options
    const budgetChanges = await this.generateBudgetAlternative(
      deck,
      underperformers,
      analysis,
      config
    );
    if (budgetChanges.length > 0) {
      alternatives.push({
        changes: budgetChanges,
        totalImpact: budgetChanges.reduce((sum, c) => sum + c.impact, 0) / budgetChanges.length,
        totalCost: await this.calculateTotalCost(budgetChanges),
        reasoning: 'Budget-friendly replacements with good performance',
        tradeoffs: ['Slightly lower power level', 'May need more setup'],
      });
    }

    // Power alternative - maximize performance
    const powerChanges = await this.generatePowerAlternative(
      deck,
      underperformers,
      analysis,
      config
    );
    if (powerChanges.length > 0) {
      alternatives.push({
        changes: powerChanges,
        totalImpact: powerChanges.reduce((sum, c) => sum + c.impact, 0) / powerChanges.length,
        totalCost: await this.calculateTotalCost(powerChanges),
        reasoning: 'Maximum performance replacements',
        tradeoffs: ['Higher cost', 'May be harder to obtain'],
      });
    }

    // Synergy alternative - maximize deck cohesion
    const synergyChanges = await this.generateSynergyAlternative(
      deck,
      underperformers,
      analysis,
      config
    );
    if (synergyChanges.length > 0) {
      alternatives.push({
        changes: synergyChanges,
        totalImpact: synergyChanges.reduce((sum, c) => sum + c.impact, 0) / synergyChanges.length,
        totalCost: await this.calculateTotalCost(synergyChanges),
        reasoning: 'Maximize synergy with existing cards',
        tradeoffs: ['May not address all weaknesses', 'Focused on specific combos'],
      });
    }

    return alternatives;
  }

  /**
   * Helper methods
   */
  private getCardPerformanceScore(
    deckCard: DeckCard & { card: Card },
    analysis: DeckAnalysisResult
  ): number {
    // Simplified scoring
    let score = 50;

    // Check if card appears in weaknesses
    if (analysis.consistency.weaknesses.some(w => 
      w.toLowerCase().includes(deckCard.card.name.toLowerCase())
    )) {
      score -= 20;
    }

    // Check if card is in synergies
    const synergies = analysis.synergy.cardInteractions.filter(
      i => i.card1 === deckCard.card.name || i.card2 === deckCard.card.name
    );
    score += synergies.length * 5;

    return Math.max(0, Math.min(100, score));
  }

  private getArchetypeStaples(archetype: string): string[] {
    // Return common cards for archetype - would be data-driven
    const staples: Record<string, string[]> = {
      'Aggro': ['swsh1-79', 'swsh1-169', 'swsh1-178'], // Example IDs
      'Control': ['swsh1-80', 'swsh1-176', 'swsh1-182'],
      // ... more archetypes
    };

    return staples[archetype] || [];
  }

  private calculatePokemonEfficiency(card: Card): number {
    if (!card.attacks || card.attacks.length === 0) return 0;

    // Calculate damage per energy
    let bestEfficiency = 0;
    for (const attack of card.attacks as any[]) {
      const energyCost = attack.cost?.length || 1;
      const damage = parseInt(attack.damage?.replace(/\D/g, '') || '0');
      const efficiency = damage / energyCost;
      bestEfficiency = Math.max(bestEfficiency, efficiency);
    }

    return bestEfficiency / 100; // Normalize
  }

  private async getCardMetaScore(card: Card): Promise<number> {
    // Would query meta data - simplified for now
    const popularCards = ['swsh1-79', 'swsh1-169', 'swsh1-178']; // Example
    if (popularCards.includes(card.id)) return 80;
    return 30;
  }

  private async getCardPrice(cardId: string): Promise<number> {
    if (this.priceCache.has(cardId)) {
      return this.priceCache.get(cardId)!;
    }

    const price = await prisma.cardPrice.findFirst({
      where: { cardId },
      orderBy: { updatedAt: 'desc' }
    });

    const marketPrice = price?.marketPrice || 1;
    this.priceCache.set(cardId, marketPrice);
    return marketPrice;
  }

  private async getMetaRelevantCards(supertype: string, format?: any): Promise<Card[]> {
    // Would query meta data - simplified
    return prisma.card.findMany({
      where: { supertype: supertype as any },
      take: 10,
      orderBy: { releaseDate: 'desc' }
    });
  }

  private async calculateSynergyImprovement(
    current: Card,
    replacement: Card,
    deck: Deck & { cards: (DeckCard & { card: Card })[] }
  ): Promise<number> {
    let improvement = 0;

    for (const deckCard of deck.cards) {
      if (deckCard.card.id === current.id) continue;

      const currentSynergy = this.calculateCardPairSynergy(current, deckCard.card);
      const newSynergy = this.calculateCardPairSynergy(replacement, deckCard.card);
      improvement += (newSynergy - currentSynergy);
    }

    return improvement / deck.cards.length; // Average improvement
  }

  private fitsArchetype(card: Card, archetype: string): boolean {
    // Check if card fits archetype style
    const archetypeTraits: Record<string, string[]> = {
      'Aggro': ['Quick', 'Fast', 'Rush'],
      'Control': ['Disrupt', 'Heal', 'Stall'],
      'Combo': ['When', 'If you', 'This ability'],
      // ... more
    };

    const traits = archetypeTraits[archetype] || [];
    const cardText = (card.text || '') + ' ' + (card.abilities?.map((a: any) => a.text).join(' ') || '');
    
    return traits.some(trait => cardText.toLowerCase().includes(trait.toLowerCase()));
  }

  private async getMarketTrend(cardId: string): Promise<'rising' | 'stable' | 'falling'> {
    // Would analyze price history - simplified
    return 'stable';
  }

  private async calculateTotalCost(changes: CardChange[]): Promise<number> {
    let total = 0;
    for (const change of changes) {
      const price = await this.getCardPrice(change.card.id);
      total += price * change.quantity;
    }
    return total;
  }

  private generateOptimizationReasoning(
    deck: Deck,
    analysis: DeckAnalysisResult,
    replacements: CardChange[]
  ): string[] {
    const reasons = [
      `Analyzing ${deck.name} for optimization opportunities`,
      `Current deck scores: Overall ${analysis.scores.overall}/100`,
      `Identified ${replacements.length} cards for potential replacement`,
    ];

    // Add specific improvements
    const improvements = replacements.map(r => r.reasoning).filter(Boolean);
    reasons.push(...improvements);

    // Add expected outcomes
    if (replacements.length > 0) {
      reasons.push(`Expected to improve consistency and power level`);
    }

    return reasons;
  }

  private calculateConfidence(replacements: CardChange[], impact: ImpactAnalysis): number {
    let confidence = 70; // Base confidence

    // Higher confidence with more positive impact
    if (impact.overallImprovement > 10) confidence += 10;
    if (impact.overallImprovement > 20) confidence += 10;

    // Lower confidence with many changes
    if (replacements.length > 5) confidence -= 10;

    // Higher confidence if all changes are synergistic
    const positiveSynergies = replacements.every(r => 
      r.synergyChanges.filter(s => s.impact === 'positive').length > 
      r.synergyChanges.filter(s => s.impact === 'negative').length
    );
    if (positiveSynergies) confidence += 5;

    return Math.max(0, Math.min(100, confidence));
  }

  private async generateBudgetAlternative(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    underperformers: (DeckCard & { card: Card })[],
    analysis: DeckAnalysisResult,
    config: BuilderConfig
  ): Promise<CardChange[]> {
    // Find cheap replacements
    const budgetConfig = {
      ...config,
      constraints: {
        ...config.constraints,
        maxBudget: 50, // Force budget constraint
      }
    };

    return this.findOptimalReplacements(deck, underperformers, analysis, budgetConfig);
  }

  private async generatePowerAlternative(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    underperformers: (DeckCard & { card: Card })[],
    analysis: DeckAnalysisResult,
    config: BuilderConfig
  ): Promise<CardChange[]> {
    // Find most powerful replacements regardless of cost
    const powerConfig = {
      ...config,
      constraints: {
        ...config.constraints,
        maxBudget: undefined, // Remove budget constraint
      }
    };

    return this.findOptimalReplacements(deck, underperformers, analysis, powerConfig);
  }

  private async generateSynergyAlternative(
    deck: Deck & { cards: (DeckCard & { card: Card })[] },
    underperformers: (DeckCard & { card: Card })[],
    analysis: DeckAnalysisResult,
    config: BuilderConfig
  ): Promise<CardChange[]> {
    // Focus on synergy improvements
    const changes: CardChange[] = [];

    for (const underperformer of underperformers.slice(0, 3)) {
      // Find cards that synergize with existing core cards
      const coreCards = deck.cards.filter(dc => 
        !underperformers.includes(dc) && dc.quantity >= 3
      );

      const synergyReplacement = await this.findBestSynergyReplacement(
        underperformer,
        coreCards,
        config
      );

      if (synergyReplacement) {
        changes.push(synergyReplacement);
      }
    }

    return changes;
  }

  private async findBestSynergyReplacement(
    toReplace: DeckCard & { card: Card },
    coreCards: (DeckCard & { card: Card })[],
    config: BuilderConfig
  ): Promise<CardChange | null> {
    // Find replacement that synergizes with core cards
    const candidates = await this.findReplacementCandidates(toReplace.card, config);
    
    let bestCard: Card | null = null;
    let bestSynergy = 0;

    for (const candidate of candidates) {
      let totalSynergy = 0;
      for (const coreCard of coreCards) {
        totalSynergy += this.calculateCardPairSynergy(candidate, coreCard.card);
      }
      
      if (totalSynergy > bestSynergy) {
        bestSynergy = totalSynergy;
        bestCard = candidate;
      }
    }

    if (!bestCard) return null;

    return {
      action: 'replace',
      card: bestCard,
      currentCard: toReplace.card,
      quantity: toReplace.quantity,
      reasoning: 'Maximizes synergy with core cards',
      impact: 70,
      synergyChanges: [],
    };
  }
}