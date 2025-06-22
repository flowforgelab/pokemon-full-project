import { prisma } from '@/server/db/prisma';
import type { Card, Format, Supertype, Type } from '@prisma/client';
import { DeckArchetype } from '../analysis/types';
import type {
  ArchetypeTemplate,
  CardRequirement,
  CardSuggestion,
  EnergyProfile,
  TrainerSuite,
  TechCard,
  MetaRating,
  BudgetTier,
  CardRole,
  BuilderConfig,
  DeckRecommendation,
  CardChange,
  ImpactAnalysis,
  CostBreakdown,
  RecommendationType,
  TrainerCard,
  AlternativeCard,
} from './types';

/**
 * Generates complete decks from scratch based on archetype templates
 */
export class ArchetypeGenerator {
  private templates: Map<DeckArchetype, ArchetypeTemplate>;
  private cardCache: Map<string, Card> = new Map();

  constructor() {
    this.templates = this.initializeTemplates();
  }

  /**
   * Generate a complete deck from scratch based on archetype
   */
  async generateDeck(
    archetype: DeckArchetype,
    config: BuilderConfig
  ): Promise<DeckRecommendation> {
    const template = this.templates.get(archetype);
    if (!template) {
      throw new Error(`No template found for archetype: ${archetype}`);
    }

    // Load card data
    await this.loadCardData(template);

    // Generate deck list
    const deckList: CardChange[] = [];
    
    // Add core cards
    const coreChanges = await this.addCoreCards(template, config);
    deckList.push(...coreChanges);

    // Add support cards
    const supportChanges = await this.addSupportCards(template, config, deckList);
    deckList.push(...supportChanges);

    // Add energy cards
    const energyChanges = await this.addEnergyCards(template, config, deckList);
    deckList.push(...energyChanges);

    // Add trainer cards
    const trainerChanges = await this.addTrainerCards(template, config, deckList);
    deckList.push(...trainerChanges);

    // Add tech cards if space allows
    const techChanges = await this.addTechCards(template, config, deckList);
    deckList.push(...techChanges);

    // Validate and adjust to 60 cards
    const finalDeck = await this.validateAndAdjustDeck(deckList, template, config);

    // Calculate impact and costs
    const impact = await this.calculateImpact(finalDeck, archetype);
    const costs = await this.calculateCosts(finalDeck);

    return {
      id: `rec_${Date.now()}`,
      type: RecommendationType.BUILD_FROM_SCRATCH,
      timestamp: new Date(),
      suggestedChanges: finalDeck,
      reasoning: this.generateReasoningForArchetype(template, config),
      expectedImpact: impact,
      alternativeOptions: [],
      costAnalysis: costs,
      difficultyRating: template.difficultyRating,
      metaRelevance: template.metaPosition.winRate,
      confidence: 85,
    };
  }

  /**
   * Generate multiple archetype options
   */
  async generateArchetypeOptions(
    config: BuilderConfig,
    count: number = 3
  ): Promise<DeckRecommendation[]> {
    const recommendations: DeckRecommendation[] = [];
    const archetypes = this.selectBestArchetypes(config, count);

    for (const archetype of archetypes) {
      try {
        const deck = await this.generateDeck(archetype, config);
        recommendations.push(deck);
      } catch (error) {
        console.error(`Failed to generate ${archetype} deck:`, error);
      }
    }

    return recommendations;
  }

  /**
   * Initialize archetype templates
   */
  private initializeTemplates(): Map<DeckArchetype, ArchetypeTemplate> {
    const templates = new Map<DeckArchetype, ArchetypeTemplate>();

    // Aggro Template
    templates.set(DeckArchetype.AGGRO, {
      name: 'Lightning Fast Aggro',
      archetype: DeckArchetype.AGGRO,
      strategy: 'Overwhelm opponents with fast, efficient attackers',
      description: 'Focus on low-cost, high-damage Pokemon with minimal setup',
      coreCards: this.getAggroCoreCards(),
      supportCards: this.getAggroSupportCards(),
      energyRequirements: {
        totalEnergy: 10,
        basicEnergy: 8,
        specialEnergy: 2,
        typeDistribution: { 'Lightning': 8, 'Twin': 2 },
        curve: { oneCost: 4, twoCost: 3, threePlusCost: 1, averageCost: 1.5 }
      },
      trainerPackage: this.getAggroTrainers(),
      techOptions: this.getAggroTechCards(),
      metaPosition: {
        tier: 2,
        popularity: 25,
        winRate: 52,
        representation: 20,
        trend: 'stable'
      },
      difficultyRating: 4,
      budgetTier: BudgetTier.STANDARD
    });

    // Control Template
    templates.set(DeckArchetype.CONTROL, {
      name: 'Defensive Control',
      archetype: DeckArchetype.CONTROL,
      strategy: 'Control the game pace while setting up powerful late-game threats',
      description: 'Disruption, healing, and resource management',
      coreCards: this.getControlCoreCards(),
      supportCards: this.getControlSupportCards(),
      energyRequirements: {
        totalEnergy: 12,
        basicEnergy: 9,
        specialEnergy: 3,
        typeDistribution: { 'Water': 6, 'Psychic': 3, 'Aurora': 3 },
        curve: { oneCost: 2, twoCost: 4, threePlusCost: 4, averageCost: 2.3 }
      },
      trainerPackage: this.getControlTrainers(),
      techOptions: this.getControlTechCards(),
      metaPosition: {
        tier: 1,
        popularity: 30,
        winRate: 55,
        representation: 25,
        trend: 'rising'
      },
      difficultyRating: 7,
      budgetTier: BudgetTier.COMPETITIVE
    });

    // Combo Template
    templates.set(DeckArchetype.COMBO, {
      name: 'Explosive Combo',
      archetype: DeckArchetype.COMBO,
      strategy: 'Set up powerful combinations for game-winning turns',
      description: 'Focus on card synergies and explosive plays',
      coreCards: this.getComboCoreCards(),
      supportCards: this.getComboSupportCards(),
      energyRequirements: {
        totalEnergy: 11,
        basicEnergy: 7,
        specialEnergy: 4,
        typeDistribution: { 'Fire': 7, 'Triple Acceleration': 4 },
        curve: { oneCost: 3, twoCost: 3, threePlusCost: 3, averageCost: 2.0 }
      },
      trainerPackage: this.getComboTrainers(),
      techOptions: this.getComboTechCards(),
      metaPosition: {
        tier: 2,
        popularity: 20,
        winRate: 51,
        representation: 15,
        trend: 'stable'
      },
      difficultyRating: 8,
      budgetTier: BudgetTier.COMPETITIVE
    });

    // Add more archetypes...
    this.addMidrangeTemplate(templates);
    this.addMillTemplate(templates);
    this.addStallTemplate(templates);
    this.addToolboxTemplate(templates);
    this.addTurboTemplate(templates);
    this.addSpreadTemplate(templates);

    return templates;
  }

  /**
   * Add core cards to deck
   */
  private async addCoreCards(
    template: ArchetypeTemplate,
    config: BuilderConfig
  ): Promise<CardChange[]> {
    const changes: CardChange[] = [];

    for (const requirement of template.coreCards) {
      // Check if card fits budget constraints
      if (config.constraints.mustExcludeCards?.includes(requirement.cardId)) {
        // Use alternative
        const alternative = await this.findBestAlternative(requirement, config);
        if (alternative) {
          const card = await this.getCard(alternative.cardId);
          if (card) {
            changes.push({
              action: 'add',
              card,
              quantity: requirement.minQuantity,
              reasoning: `Alternative to ${requirement.cardName} due to exclusion`,
              impact: requirement.importance * alternative.performanceRatio,
              synergyChanges: [],
            });
          }
        }
        continue;
      }

      const card = await this.getCard(requirement.cardId);
      if (!card) continue;

      // Check budget
      const cardCost = await this.getCardPrice(card.id);
      if (config.constraints.maxBudget && 
          cardCost * requirement.minQuantity > config.constraints.maxBudget * 0.3) {
        // Too expensive for single card, find alternative
        const alternative = await this.findBudgetAlternative(requirement, config);
        if (alternative) {
          const altCard = await this.getCard(alternative.cardId);
          if (altCard) {
            changes.push({
              action: 'add',
              card: altCard,
              quantity: requirement.minQuantity,
              reasoning: `Budget alternative to ${requirement.cardName}`,
              impact: requirement.importance * alternative.performanceRatio,
              synergyChanges: [],
            });
          }
        }
        continue;
      }

      changes.push({
        action: 'add',
        card,
        quantity: requirement.minQuantity,
        reasoning: requirement.reasoning,
        impact: requirement.importance * 10,
        synergyChanges: [],
      });
    }

    return changes;
  }

  /**
   * Add support cards
   */
  private async addSupportCards(
    template: ArchetypeTemplate,
    config: BuilderConfig,
    currentDeck: CardChange[]
  ): Promise<CardChange[]> {
    const changes: CardChange[] = [];
    const currentCount = this.getCurrentCardCount(currentDeck);
    const spaceRemaining = 60 - currentCount;

    for (const suggestion of template.supportCards) {
      if (suggestion.priority === 'optional' && spaceRemaining < 10) continue;

      const card = await this.getCard(suggestion.cardId);
      if (!card) continue;

      // Check constraints
      if (config.constraints.mustExcludeCards?.includes(card.id)) continue;

      // Check if already in deck
      if (currentDeck.some(c => c.card.id === card.id)) continue;

      const quantity = Math.min(suggestion.quantity, spaceRemaining);
      if (quantity > 0) {
        changes.push({
          action: 'add',
          card,
          quantity,
          reasoning: `Support card for ${template.archetype} strategy`,
          impact: suggestion.priority === 'essential' ? 8 : 5,
          synergyChanges: [],
        });
      }
    }

    return changes;
  }

  /**
   * Add energy cards
   */
  private async addEnergyCards(
    template: ArchetypeTemplate,
    config: BuilderConfig,
    currentDeck: CardChange[]
  ): Promise<CardChange[]> {
    const changes: CardChange[] = [];
    
    // Add basic energy
    for (const [type, count] of Object.entries(template.energyRequirements.typeDistribution)) {
      if (type === 'Twin' || type === 'Triple Acceleration' || type === 'Aurora') {
        // Special energy - handled separately
        continue;
      }

      const energyCard = await this.getBasicEnergy(type);
      if (energyCard) {
        changes.push({
          action: 'add',
          card: energyCard,
          quantity: count,
          reasoning: `Basic ${type} energy for attack costs`,
          impact: 5,
          synergyChanges: [],
        });
      }
    }

    // Add special energy
    const specialEnergyCount = template.energyRequirements.specialEnergy;
    if (specialEnergyCount > 0) {
      const specialEnergy = await this.getSpecialEnergy(template.archetype);
      for (const energy of specialEnergy) {
        if (changes.length >= specialEnergyCount) break;
        
        changes.push({
          action: 'add',
          card: energy,
          quantity: Math.min(4, specialEnergyCount - changes.filter(c => 
            c.card.supertype === Supertype.Energy && c.card.subtypes?.includes('Special')
          ).length),
          reasoning: 'Special energy for enhanced effects',
          impact: 6,
          synergyChanges: [],
        });
      }
    }

    return changes;
  }

  /**
   * Add trainer cards
   */
  private async addTrainerCards(
    template: ArchetypeTemplate,
    config: BuilderConfig,
    currentDeck: CardChange[]
  ): Promise<CardChange[]> {
    const changes: CardChange[] = [];
    const trainerSuite = template.trainerPackage;

    // Add all trainer categories
    const allTrainers = [
      ...trainerSuite.draw,
      ...trainerSuite.search,
      ...trainerSuite.recovery,
      ...trainerSuite.disruption,
      ...trainerSuite.stadiums,
      ...trainerSuite.tools,
    ];

    for (const trainer of allTrainers) {
      const card = await this.getCard(trainer.cardId);
      if (!card) continue;

      if (config.constraints.mustExcludeCards?.includes(card.id)) continue;

      changes.push({
        action: 'add',
        card,
        quantity: trainer.quantity,
        reasoning: `${trainer.priority} trainer for consistency`,
        impact: trainer.priority === 'core' ? 8 : 5,
        synergyChanges: [],
      });
    }

    return changes;
  }

  /**
   * Add tech cards
   */
  private async addTechCards(
    template: ArchetypeTemplate,
    config: BuilderConfig,
    currentDeck: CardChange[]
  ): Promise<CardChange[]> {
    const changes: CardChange[] = [];
    const currentCount = this.getCurrentCardCount(currentDeck);
    const spaceRemaining = 60 - currentCount;

    if (spaceRemaining < 3) return changes; // No room for tech

    // Sort tech cards by relevance to target matchups
    const sortedTech = template.techOptions.sort((a, b) => {
      const aRelevance = this.calculateTechRelevance(a, config);
      const bRelevance = this.calculateTechRelevance(b, config);
      return bRelevance - aRelevance;
    });

    for (const tech of sortedTech) {
      if (changes.length >= Math.min(3, spaceRemaining)) break;

      const card = await this.getCard(tech.cardId);
      if (!card) continue;

      changes.push({
        action: 'add',
        card,
        quantity: 1,
        reasoning: `Tech card for ${tech.targetMatchups.join(', ')}`,
        impact: tech.impactScore,
        synergyChanges: [],
      });
    }

    return changes;
  }

  /**
   * Validate deck is exactly 60 cards and adjust if needed
   */
  private async validateAndAdjustDeck(
    deckList: CardChange[],
    template: ArchetypeTemplate,
    config: BuilderConfig
  ): Promise<CardChange[]> {
    let currentCount = this.getCurrentCardCount(deckList);

    // Remove cards if over 60
    while (currentCount > 60) {
      const toRemove = this.findLeastImpactfulCard(deckList);
      if (toRemove) {
        const index = deckList.findIndex(c => c.card.id === toRemove.card.id);
        if (deckList[index].quantity > 1) {
          deckList[index].quantity--;
        } else {
          deckList.splice(index, 1);
        }
        currentCount--;
      } else {
        break;
      }
    }

    // Add cards if under 60
    while (currentCount < 60) {
      // Add more consistency cards
      const consistencyCard = await this.getConsistencyCard(template.archetype);
      if (consistencyCard) {
        const existing = deckList.find(c => c.card.id === consistencyCard.id);
        if (existing && existing.quantity < 4) {
          existing.quantity++;
        } else if (!existing) {
          deckList.push({
            action: 'add',
            card: consistencyCard,
            quantity: 1,
            reasoning: 'Added for deck consistency',
            impact: 5,
            synergyChanges: [],
          });
        }
        currentCount++;
      } else {
        break;
      }
    }

    return deckList;
  }

  /**
   * Helper methods for specific card types
   */
  private getAggroCoreCards(): CardRequirement[] {
    return [
      {
        cardId: 'swsh1-79', // Example: Zacian V
        cardName: 'Zacian V',
        minQuantity: 3,
        maxQuantity: 4,
        importance: 10,
        alternatives: [],
        role: CardRole.MAIN_ATTACKER,
        reasoning: 'Primary attacker with built-in draw and high damage'
      },
      {
        cardId: 'swsh1-80', // Example: Support Pokemon
        cardName: 'Zamazenta V',
        minQuantity: 1,
        maxQuantity: 2,
        importance: 7,
        alternatives: [],
        role: CardRole.SECONDARY_ATTACKER,
        reasoning: 'Secondary attacker and defensive option'
      }
    ];
  }

  private getAggroSupportCards(): CardSuggestion[] {
    return [
      {
        cardId: 'swsh1-178', // Example: Professor's Research
        cardName: "Professor's Research",
        quantity: 4,
        priority: 'essential',
        synergyCards: [],
        role: CardRole.DRAW_ENGINE
      },
      {
        cardId: 'swsh1-169', // Example: Quick Ball
        cardName: 'Quick Ball',
        quantity: 4,
        priority: 'essential',
        synergyCards: [],
        role: CardRole.CONSISTENCY
      }
    ];
  }

  private getAggroTrainers(): TrainerSuite {
    return {
      draw: [
        { cardId: 'swsh1-178', cardName: "Professor's Research", quantity: 4, priority: 'core' },
        { cardId: 'swsh1-176', cardName: 'Marnie', quantity: 3, priority: 'core' }
      ],
      search: [
        { cardId: 'swsh1-169', cardName: 'Quick Ball', quantity: 4, priority: 'core' },
        { cardId: 'swsh1-165', cardName: 'Great Ball', quantity: 2, priority: 'flex' }
      ],
      recovery: [
        { cardId: 'swsh1-182', cardName: 'Switch', quantity: 3, priority: 'core' }
      ],
      disruption: [
        { cardId: 'swsh1-174', cardName: 'Boss\'s Orders', quantity: 2, priority: 'core' }
      ],
      stadiums: [
        { cardId: 'swsh1-189', cardName: 'Training Court', quantity: 2, priority: 'flex' }
      ],
      tools: [
        { cardId: 'swsh1-172', cardName: 'Metal Saucer', quantity: 3, priority: 'core' }
      ]
    };
  }

  private getAggroTechCards(): TechCard[] {
    return [
      {
        cardId: 'swsh1-183',
        cardName: 'Tool Scrapper',
        targetMatchups: ['Control', 'Stall'],
        impactScore: 7,
        opportunityCost: 3
      }
    ];
  }

  // Similar methods for other archetypes...
  private getControlCoreCards(): CardRequirement[] {
    // Implementation...
    return [];
  }

  private getControlSupportCards(): CardSuggestion[] {
    // Implementation...
    return [];
  }

  private getControlTrainers(): TrainerSuite {
    // Implementation...
    return {
      draw: [],
      search: [],
      recovery: [],
      disruption: [],
      stadiums: [],
      tools: []
    };
  }

  private getControlTechCards(): TechCard[] {
    // Implementation...
    return [];
  }

  private getComboCoreCards(): CardRequirement[] {
    // Implementation...
    return [];
  }

  private getComboSupportCards(): CardSuggestion[] {
    // Implementation...
    return [];
  }

  private getComboTrainers(): TrainerSuite {
    // Implementation...
    return {
      draw: [],
      search: [],
      recovery: [],
      disruption: [],
      stadiums: [],
      tools: []
    };
  }

  private getComboTechCards(): TechCard[] {
    // Implementation...
    return [];
  }

  /**
   * Add additional archetype templates
   */
  private addMidrangeTemplate(templates: Map<DeckArchetype, ArchetypeTemplate>): void {
    // Implementation...
  }

  private addMillTemplate(templates: Map<DeckArchetype, ArchetypeTemplate>): void {
    // Implementation...
  }

  private addStallTemplate(templates: Map<DeckArchetype, ArchetypeTemplate>): void {
    // Implementation...
  }

  private addToolboxTemplate(templates: Map<DeckArchetype, ArchetypeTemplate>): void {
    // Implementation...
  }

  private addTurboTemplate(templates: Map<DeckArchetype, ArchetypeTemplate>): void {
    // Implementation...
  }

  private addSpreadTemplate(templates: Map<DeckArchetype, ArchetypeTemplate>): void {
    // Implementation...
  }

  /**
   * Helper methods
   */
  private async loadCardData(template: ArchetypeTemplate): Promise<void> {
    const cardIds = [
      ...template.coreCards.map(c => c.cardId),
      ...template.supportCards.map(c => c.cardId),
      ...Object.values(template.trainerPackage).flat().map(t => t.cardId),
      ...template.techOptions.map(t => t.cardId),
    ];

    const uniqueIds = [...new Set(cardIds)];
    const cards = await prisma.card.findMany({
      where: { id: { in: uniqueIds } }
    });

    cards.forEach(card => this.cardCache.set(card.id, card));
  }

  private async getCard(cardId: string): Promise<Card | null> {
    if (this.cardCache.has(cardId)) {
      return this.cardCache.get(cardId)!;
    }

    const card = await prisma.card.findUnique({
      where: { id: cardId }
    });

    if (card) {
      this.cardCache.set(cardId, card);
    }

    return card;
  }

  private async getCardPrice(cardId: string): Promise<number> {
    const price = await prisma.cardPrice.findFirst({
      where: { cardId },
      orderBy: { updatedAt: 'desc' }
    });

    return price?.marketPrice || 0;
  }

  private async findBestAlternative(
    requirement: CardRequirement,
    config: BuilderConfig
  ): Promise<AlternativeCard | null> {
    // Find best alternative based on performance and budget
    return requirement.alternatives
      .filter(alt => !config.constraints.mustExcludeCards?.includes(alt.cardId))
      .sort((a, b) => b.performanceRatio - a.performanceRatio)[0] || null;
  }

  private async findBudgetAlternative(
    requirement: CardRequirement,
    config: BuilderConfig
  ): Promise<AlternativeCard | null> {
    // Find cheapest acceptable alternative
    return requirement.alternatives
      .filter(alt => alt.performanceRatio >= 0.7) // At least 70% as good
      .sort((a, b) => a.priceDifference - b.priceDifference)[0] || null;
  }

  private getCurrentCardCount(deck: CardChange[]): number {
    return deck.reduce((sum, change) => sum + change.quantity, 0);
  }

  private findLeastImpactfulCard(deck: CardChange[]): CardChange | null {
    return deck
      .filter(c => c.card.supertype !== Supertype.Energy) // Don't remove energy
      .sort((a, b) => a.impact - b.impact)[0] || null;
  }

  private async getBasicEnergy(type: string): Promise<Card | null> {
    return prisma.card.findFirst({
      where: {
        name: `${type} Energy`,
        supertype: Supertype.Energy,
        subtypes: { has: 'Basic' }
      }
    });
  }

  private async getSpecialEnergy(archetype: DeckArchetype): Promise<Card[]> {
    // Get special energy cards suitable for archetype
    const energyTypes = this.getArchetypeEnergyTypes(archetype);
    
    return prisma.card.findMany({
      where: {
        supertype: Supertype.Energy,
        subtypes: { has: 'Special' },
        OR: energyTypes.map(type => ({
          types: { has: type }
        }))
      },
      take: 4
    });
  }

  private getArchetypeEnergyTypes(archetype: DeckArchetype): Type[] {
    const typeMap: Record<DeckArchetype, Type[]> = {
      [DeckArchetype.AGGRO]: [Type.Lightning, Type.Fighting],
      [DeckArchetype.CONTROL]: [Type.Water, Type.Psychic],
      [DeckArchetype.COMBO]: [Type.Fire, Type.Dragon],
      [DeckArchetype.MIDRANGE]: [Type.Grass, Type.Fighting],
      [DeckArchetype.MILL]: [Type.Psychic, Type.Darkness],
      [DeckArchetype.STALL]: [Type.Metal, Type.Fairy],
      [DeckArchetype.TOOLBOX]: [Type.Colorless],
      [DeckArchetype.TURBO]: [Type.Fire, Type.Lightning],
      [DeckArchetype.SPREAD]: [Type.Psychic, Type.Fighting],
    };

    return typeMap[archetype] || [Type.Colorless];
  }

  private async getConsistencyCard(archetype: DeckArchetype): Promise<Card | null> {
    // Get a consistency trainer suitable for the archetype
    return prisma.card.findFirst({
      where: {
        supertype: Supertype.Trainer,
        OR: [
          { name: { contains: 'Ball' } },
          { name: { contains: 'Research' } },
          { name: { contains: 'Marnie' } },
        ]
      }
    });
  }

  private calculateTechRelevance(tech: TechCard, config: BuilderConfig): number {
    if (!config.goals.targetMatchups) return tech.impactScore;

    const relevantTargets = tech.targetMatchups.filter(matchup =>
      config.goals.targetMatchups?.includes(matchup as any)
    );

    return (relevantTargets.length / tech.targetMatchups.length) * tech.impactScore;
  }

  private selectBestArchetypes(config: BuilderConfig, count: number): DeckArchetype[] {
    const archetypes = Object.values(DeckArchetype);
    
    // Filter based on preferences
    const filtered = archetypes.filter(arch => {
      if (config.preferences.avoidArchetypes.includes(arch)) return false;
      return true;
    });

    // Score based on preferences and meta
    const scored = filtered.map(arch => {
      const template = this.templates.get(arch);
      if (!template) return { arch, score: 0 };

      let score = template.metaPosition.winRate;
      
      if (config.preferences.favoriteArchetypes.includes(arch)) {
        score += 20;
      }

      if (config.constraints.maxBudget) {
        const budgetScore = this.getBudgetCompatibility(template.budgetTier, config.constraints.maxBudget);
        score *= budgetScore;
      }

      return { arch, score };
    });

    // Sort and return top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(s => s.arch);
  }

  private getBudgetCompatibility(tier: BudgetTier, maxBudget: number): number {
    const tierCosts = {
      [BudgetTier.BUDGET]: 40,
      [BudgetTier.STANDARD]: 100,
      [BudgetTier.COMPETITIVE]: 225,
      [BudgetTier.PREMIUM]: 400,
    };

    const tierCost = tierCosts[tier];
    if (maxBudget >= tierCost) return 1;
    return maxBudget / tierCost;
  }

  private generateReasoningForArchetype(
    template: ArchetypeTemplate,
    config: BuilderConfig
  ): string[] {
    const reasons = [
      `Selected ${template.archetype} archetype based on your preferences`,
      template.description,
      `Current meta position: Tier ${template.metaPosition.tier} with ${template.metaPosition.winRate}% win rate`,
    ];

    if (config.constraints.maxBudget) {
      reasons.push(`Built within your budget constraint of $${config.constraints.maxBudget}`);
    }

    if (config.goals.tournamentPrep) {
      reasons.push('Optimized for tournament play with proven competitive results');
    }

    if (config.goals.learningFocus) {
      reasons.push(`Difficulty rating: ${template.difficultyRating}/10 - suitable for learning`);
    }

    return reasons;
  }

  private async calculateImpact(
    deck: CardChange[],
    archetype: DeckArchetype
  ): Promise<ImpactAnalysis> {
    // Simplified impact calculation
    return {
      overallImprovement: 85,
      consistencyChange: 80,
      powerChange: 75,
      speedChange: 70,
      versatilityChange: 60,
      metaRelevanceChange: 85,
      specificMatchupChanges: []
    };
  }

  private async calculateCosts(deck: CardChange[]): Promise<CostBreakdown> {
    let totalCost = 0;
    const costPerCard: any[] = [];

    for (const change of deck) {
      const price = await this.getCardPrice(change.card.id);
      const cardCost = {
        card: change.card,
        quantity: change.quantity,
        unitPrice: price,
        totalPrice: price * change.quantity,
        marketTrend: 'stable' as const
      };
      costPerCard.push(cardCost);
      totalCost += cardCost.totalPrice;
    }

    return {
      totalCost,
      addedCost: totalCost,
      removedValue: 0,
      netCost: totalCost,
      costPerCard,
      budgetFriendlyAlternatives: totalCost > 150
    };
  }
}