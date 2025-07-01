import { Card, DeckCard, Deck } from '@prisma/client';
import { DeckArchetype } from './types';
import type {
  MetaGameAnalysis,
  PopularMatchup,
  CounterStrategy,
  MetaWeakness,
  FormatEvaluation,
  RotationImpact,
  TechCardRecommendation
} from './types';

interface MetaDeck {
  id: string;
  name: string;
  archetype: DeckArchetype;
  popularity: number;
  keyCards: string[];
  strategy: string;
  weaknesses: string[];
}

export class MetaEvaluator {
  private cards: Map<string, Card & { quantity: number }>;
  private deckList: (Card & { quantity: number })[];
  private format: 'standard' | 'expanded';
  
  // Top meta decks (would be loaded from database in production)
  private metaDecks: MetaDeck[] = [
    {
      id: 'lost-box',
      name: 'Lost Box',
      archetype: DeckArchetype.TOOLBOX,
      popularity: 15,
      keyCards: ['Comfey', 'Sableye', 'Lost City'],
      strategy: 'Use Lost Zone engine for versatile attacks',
      weaknesses: ['Path to the Peak', 'Early pressure'],
    },
    {
      id: 'mew-vmax',
      name: 'Mew VMAX',
      archetype: DeckArchetype.COMBO,
      popularity: 12,
      keyCards: ['Mew VMAX', 'Genesect V', 'Cross Fusion Strike'],
      strategy: 'Copy attacks from benched Fusion Strike Pokemon',
      weaknesses: ['Dark types', 'Path to the Peak'],
    },
    {
      id: 'lugia-vstar',
      name: 'Lugia VSTAR',
      archetype: DeckArchetype.AGGRO,
      popularity: 14,
      keyCards: ['Lugia VSTAR', 'Archeops', 'Powerful Colorless Energy'],
      strategy: 'Accelerate energy with Archeops for big attacks',
      weaknesses: ['Lightning types', 'Lost Vacuum'],
    },
    {
      id: 'arceus-vstar',
      name: 'Arceus VSTAR',
      archetype: DeckArchetype.MIDRANGE,
      popularity: 10,
      keyCards: ['Arceus VSTAR', 'Bibarel', 'Double Turbo Energy'],
      strategy: 'Consistent setup with Trinity Nova acceleration',
      weaknesses: ['Fighting types', 'Slow early game'],
    },
    {
      id: 'gardevoir-ex',
      name: 'Gardevoir ex',
      archetype: DeckArchetype.CONTROL,
      popularity: 11,
      keyCards: ['Gardevoir ex', 'Kirlia', 'Reversal Energy'],
      strategy: 'Psychic energy scaling damage',
      weaknesses: ['Metal types', 'Spiritomb'],
    },
  ];

  constructor(
    deckCards: (DeckCard & { card: Card })[],
    format: 'standard' | 'expanded' = 'standard'
  ) {
    this.cards = new Map();
    this.deckList = [];
    this.format = format;

    deckCards.forEach(dc => {
      const cardWithQuantity = {
        ...dc.card,
        quantity: dc.quantity,
      };
      this.cards.set(dc.card.id, cardWithQuantity);
      this.deckList.push(cardWithQuantity);
    });
  }

  /**
   * Perform complete meta-game analysis
   */
  analyze(archetype: DeckArchetype): MetaGameAnalysis {
    const archetypeMatch = this.identifyArchetypeMatch(archetype);
    const metaPosition = this.evaluateMetaPosition(archetype);
    const popularMatchups = this.analyzePopularMatchups(archetype);
    const counterStrategies = this.identifyCounterStrategies();
    const weaknesses = this.identifyMetaWeaknesses();
    const formatEvaluation = this.evaluateFormat();
    const rotationImpact = this.assessRotationImpact();
    const techRecommendations = this.recommendTechCards(popularMatchups, weaknesses);

    return {
      archetypeMatch,
      metaPosition,
      popularMatchups,
      counterStrategies,
      weaknesses,
      formatEvaluation,
      rotationImpact,
      techRecommendations,
    };
  }

  /**
   * Identify which meta archetype this deck most closely matches
   */
  private identifyArchetypeMatch(archetype: DeckArchetype): string {
    // Check for key cards that match meta decks
    let bestMatch = 'Rogue Deck';
    let highestMatchScore = 0;

    this.metaDecks.forEach(metaDeck => {
      let matchScore = 0;
      
      // Check archetype match
      if (metaDeck.archetype === archetype) {
        matchScore += 30;
      }

      // Check key card matches
      metaDeck.keyCards.forEach(keyCard => {
        if (this.deckList.some(card => card.name.includes(keyCard))) {
          matchScore += 20;
        }
      });

      if (matchScore > highestMatchScore) {
        highestMatchScore = matchScore;
        bestMatch = metaDeck.name;
      }
    });

    return highestMatchScore >= 50 ? bestMatch : 'Rogue Deck';
  }

  /**
   * Evaluate deck's position in the meta
   */
  private evaluateMetaPosition(archetype: DeckArchetype): 'tier1' | 'tier2' | 'tier3' | 'rogue' {
    // Check if deck matches a popular meta deck
    const matchedMetaDeck = this.metaDecks.find(md => 
      md.keyCards.every(keyCard => 
        this.deckList.some(card => card.name.includes(keyCard))
      )
    );

    if (matchedMetaDeck) {
      if (matchedMetaDeck.popularity >= 15) return 'tier1';
      if (matchedMetaDeck.popularity >= 10) return 'tier2';
      return 'tier3';
    }

    // Check for meta-relevant cards
    const metaRelevantCards = this.countMetaRelevantCards();
    
    if (metaRelevantCards >= 10) return 'tier2';
    if (metaRelevantCards >= 5) return 'tier3';
    
    return 'rogue';
  }

  /**
   * Analyze matchups against popular decks
   */
  private analyzePopularMatchups(archetype: DeckArchetype): PopularMatchup[] {
    const matchups: PopularMatchup[] = [];

    this.metaDecks.forEach(metaDeck => {
      const matchup = this.calculateMatchup(archetype, metaDeck);
      matchups.push(matchup);
    });

    // Sort by popularity
    return matchups.sort((a, b) => {
      const aDeck = this.metaDecks.find(d => d.name === a.opponentArchetype);
      const bDeck = this.metaDecks.find(d => d.name === b.opponentArchetype);
      return (bDeck?.popularity || 0) - (aDeck?.popularity || 0);
    });
  }

  /**
   * Calculate specific matchup
   */
  private calculateMatchup(playerArchetype: DeckArchetype, opponent: MetaDeck): PopularMatchup {
    let winRate = 50; // Base win rate
    const keyFactors: string[] = [];
    let strategy = '';

    // Type advantage/disadvantage
    const typeAdvantage = this.calculateTypeAdvantage(opponent);
    winRate += typeAdvantage;
    if (Math.abs(typeAdvantage) >= 10) {
      keyFactors.push(typeAdvantage > 0 ? 'Type advantage' : 'Type disadvantage');
    }

    // Speed comparison
    const speedAdvantage = this.compareSpeed(playerArchetype, opponent.archetype);
    winRate += speedAdvantage;
    if (Math.abs(speedAdvantage) >= 5) {
      keyFactors.push(speedAdvantage > 0 ? 'Faster setup' : 'Slower setup');
    }

    // Check for counter cards
    const counterCards = this.checkCounterCards(opponent);
    winRate += counterCards.score;
    if (counterCards.cards.length > 0) {
      keyFactors.push(`Counter cards: ${counterCards.cards.join(', ')}`);
    }

    // Archetype matchup
    const archetypeMatchup = this.getArchetypeMatchup(playerArchetype, opponent.archetype);
    winRate += archetypeMatchup.score;
    strategy = archetypeMatchup.strategy;

    // Specific meta deck interactions
    const specificInteractions = this.checkSpecificInteractions(opponent);
    winRate += specificInteractions.score;
    if (specificInteractions.factors.length > 0) {
      keyFactors.push(...specificInteractions.factors);
    }

    // Normalize win rate
    winRate = Math.max(20, Math.min(80, winRate));

    return {
      opponentArchetype: opponent.name,
      winRate,
      keyFactors,
      strategy,
    };
  }

  /**
   * Identify counter strategies in the deck
   */
  private identifyCounterStrategies(): CounterStrategy[] {
    const strategies: CounterStrategy[] = [];

    // Check for specific counter cards
    const counterCards = [
      { card: 'Path to the Peak', targets: ['Mew VMAX', 'Lost Box'], effectiveness: 75 },
      { card: 'Spiritomb', targets: ['Lugia VSTAR', 'Item-heavy decks'], effectiveness: 70 },
      { card: 'Lost Vacuum', targets: ['Stadium reliant', 'Tool reliant'], effectiveness: 65 },
      { card: 'Collapsed Stadium', targets: ['Bench-heavy decks'], effectiveness: 60 },
      { card: 'Canceling Cologne', targets: ['Ability reliant'], effectiveness: 70 },
    ];

    counterCards.forEach(counter => {
      if (this.deckList.some(card => card.name.includes(counter.card))) {
        counter.targets.forEach(target => {
          strategies.push({
            targetArchetype: target,
            cards: [counter.card],
            effectiveness: counter.effectiveness,
          });
        });
      }
    });

    // Check for type-based counters
    this.checkTypeCounters(strategies);

    return strategies;
  }

  /**
   * Identify meta weaknesses
   */
  private identifyMetaWeaknesses(): MetaWeakness[] {
    const weaknesses: MetaWeakness[] = [];

    // Check for common meta threats
    const threats = [
      { 
        weakness: 'Path to the Peak vulnerability',
        check: () => this.hasHighAbilityReliance(),
        severity: 'high' as const,
        exploits: ['Path to the Peak', 'Canceling Cologne'],
      },
      {
        weakness: 'Special Energy reliance',
        check: () => this.hasHighSpecialEnergyReliance(),
        severity: 'medium' as const,
        exploits: ['Enhanced Hammer', 'Giacomo'],
      },
      {
        weakness: 'Bench space dependency',
        check: () => this.hasHighBenchDependency(),
        severity: 'medium' as const,
        exploits: ['Collapsed Stadium', 'Avery'],
      },
      {
        weakness: 'Slow setup',
        check: () => this.hasSlowSetup(),
        severity: 'high' as const,
        exploits: ['Aggressive early game decks', 'Marnie chains'],
      },
      {
        weakness: 'Low HP Pokemon',
        check: () => this.hasLowHPPokemon(),
        severity: 'medium' as const,
        exploits: ['Quick Shooting', 'Damage spread'],
      },
    ];

    threats.forEach(threat => {
      if (threat.check()) {
        weaknesses.push({
          weakness: threat.weakness,
          severity: threat.severity,
          commonExploits: threat.exploits,
        });
      }
    });

    return weaknesses;
  }

  /**
   * Evaluate format legality and strength
   */
  private evaluateFormat(): FormatEvaluation {
    const legalityIssues: string[] = [];
    const formatSpecificStrengths: string[] = [];
    let viability = 70; // Base viability

    // Check card legality
    this.deckList.forEach(card => {
      if (this.format === 'standard' && !card.isLegalStandard) {
        legalityIssues.push(`${card.name} is not legal in Standard`);
        viability = 0; // Illegal deck
      } else if (this.format === 'expanded' && !card.isLegalExpanded) {
        legalityIssues.push(`${card.name} is not legal in Expanded`);
        viability = 0; // Illegal deck
      }
    });

    // Format-specific evaluations
    if (this.format === 'standard') {
      // Standard format strengths
      if (this.hasModernConsistencyCards()) {
        formatSpecificStrengths.push('Uses modern consistency engines');
        viability += 10;
      }
      if (this.hasCurrentSetCards()) {
        formatSpecificStrengths.push('Includes cards from recent sets');
        viability += 5;
      }
    } else {
      // Expanded format strengths
      if (this.hasExpandedPowerCards()) {
        formatSpecificStrengths.push('Uses powerful Expanded-only cards');
        viability += 15;
      }
      if (this.hasExpandedConsistency()) {
        formatSpecificStrengths.push('Enhanced consistency with Expanded cards');
        viability += 10;
      }
    }

    return {
      format: this.format,
      viability: Math.min(100, viability),
      legalityIssues,
      formatSpecificStrengths,
    };
  }

  /**
   * Assess rotation impact
   */
  private assessRotationImpact(): RotationImpact {
    const cardsRotating: string[] = [];
    const replacementSuggestions: { [cardId: string]: string[] } = {};
    let impactScore = 0;

    // Check for cards that will rotate (simplified - would use actual rotation data)
    this.deckList.forEach(card => {
      if (this.isRotatingCard(card)) {
        cardsRotating.push(card.name);
        impactScore += card.quantity * (this.isKeyCard(card) ? 10 : 5);
        
        // Suggest replacements
        replacementSuggestions[card.id] = this.suggestReplacements(card);
      }
    });

    return {
      cardsRotating,
      impactScore: Math.min(100, impactScore),
      replacementSuggestions,
    };
  }

  /**
   * Recommend tech cards based on meta
   */
  private recommendTechCards(
    matchups: PopularMatchup[],
    weaknesses: MetaWeakness[]
  ): TechCardRecommendation[] {
    const recommendations: TechCardRecommendation[] = [];

    // Analyze bad matchups
    const badMatchups = matchups.filter(m => m.winRate < 40);
    
    badMatchups.forEach(matchup => {
      const techOptions = this.getTechOptionsForMatchup(matchup.opponentArchetype);
      techOptions.forEach(tech => {
        if (!this.deckList.some(card => card.name === tech.card)) {
          recommendations.push(tech);
        }
      });
    });

    // Address weaknesses
    weaknesses.forEach(weakness => {
      const techOptions = this.getTechOptionsForWeakness(weakness);
      techOptions.forEach(tech => {
        if (!this.deckList.some(card => card.name === tech.card) &&
            !recommendations.some(r => r.card === tech.card)) {
          recommendations.push(tech);
        }
      });
    });

    // Sort by importance and deduplicate
    return recommendations
      .sort((a, b) => b.matchupImprovements.length - a.matchupImprovements.length)
      .slice(0, 5); // Top 5 recommendations
  }

  // Helper methods

  private countMetaRelevantCards(): number {
    const metaCards = [
      'Professor\'s Research', 'Boss\'s Orders', 'Quick Ball',
      'Ultra Ball', 'Battle VIP Pass', 'Cross Switcher',
      'Path to the Peak', 'Lost City', 'Training Court',
    ];

    return this.deckList.filter(card => 
      metaCards.some(metaCard => card.name.includes(metaCard))
    ).reduce((sum, card) => sum + card.quantity, 0);
  }

  private calculateTypeAdvantage(opponent: MetaDeck): number {
    // Simplified type advantage calculation
    const typeMatchups: { [key: string]: { [key: string]: number } } = {
      'Dark': { 'Psychic': 20 },
      'Lightning': { 'Water': 20, 'Flying': 20 },
      'Fighting': { 'Darkness': 20, 'Colorless': 20 },
      'Metal': { 'Fairy': 20, 'Water': -20 },
      'Fire': { 'Metal': 20, 'Grass': 20 },
      'Water': { 'Fire': 20, 'Ground': 20 },
      'Grass': { 'Water': 20, 'Fighting': 20 },
      'Psychic': { 'Fighting': 20, 'Dark': -20 },
    };

    let advantage = 0;
    const playerTypes = new Set<string>();
    
    this.deckList.forEach(card => {
      if (card.supertype === 'POKEMON' && card.types) {
        card.types.forEach(type => playerTypes.add(type));
      }
    });

    // Check against known opponent types
    playerTypes.forEach(playerType => {
      const matchup = typeMatchups[playerType];
      if (matchup) {
        // This would check actual opponent Pokemon types
        advantage += matchup[opponent.archetype] || 0;
      }
    });

    return advantage;
  }

  private compareSpeed(playerArchetype: DeckArchetype, opponentArchetype: DeckArchetype): number {
    const speedRankings: { [key in DeckArchetype]: number } = {
      [DeckArchetype.TURBO]: 5,
      [DeckArchetype.AGGRO]: 4,
      [DeckArchetype.COMBO]: 3,
      [DeckArchetype.MIDRANGE]: 3,
      [DeckArchetype.TOOLBOX]: 2,
      [DeckArchetype.SPREAD]: 2,
      [DeckArchetype.CONTROL]: 1,
      [DeckArchetype.MILL]: 1,
      [DeckArchetype.STALL]: 0,
    };

    const speedDiff = speedRankings[playerArchetype] - speedRankings[opponentArchetype];
    return speedDiff * 5; // Convert to win rate impact
  }

  private checkCounterCards(opponent: MetaDeck): { score: number; cards: string[] } {
    const counterCards: string[] = [];
    let score = 0;

    // Check for specific counters to opponent
    opponent.weaknesses.forEach(weakness => {
      this.deckList.forEach(card => {
        if (card.name.includes(weakness)) {
          counterCards.push(card.name);
          score += 10;
        }
      });
    });

    return { score, cards: counterCards };
  }

  private getArchetypeMatchup(
    player: DeckArchetype,
    opponent: DeckArchetype
  ): { score: number; strategy: string } {
    // Simplified archetype matchup matrix
    const matchups: { [key: string]: { [key: string]: { score: number; strategy: string } } } = {
      [DeckArchetype.AGGRO]: {
        [DeckArchetype.CONTROL]: { score: 15, strategy: 'Apply early pressure before control setup' },
        [DeckArchetype.STALL]: { score: -10, strategy: 'Break through stall tactics quickly' },
        [DeckArchetype.COMBO]: { score: 10, strategy: 'Race to knock out combo pieces' },
      },
      [DeckArchetype.CONTROL]: {
        [DeckArchetype.AGGRO]: { score: -15, strategy: 'Survive early game and stabilize' },
        [DeckArchetype.MIDRANGE]: { score: 10, strategy: 'Disrupt their resource management' },
        [DeckArchetype.COMBO]: { score: 15, strategy: 'Prevent combo setup with disruption' },
      },
      [DeckArchetype.COMBO]: {
        [DeckArchetype.CONTROL]: { score: -15, strategy: 'Execute combo before disruption' },
        [DeckArchetype.AGGRO]: { score: -10, strategy: 'Setup quickly under pressure' },
        [DeckArchetype.STALL]: { score: 5, strategy: 'Combo through stall tactics' },
      },
    };

    const playerMatchups = matchups[player] || {};
    const specific = playerMatchups[opponent] || { score: 0, strategy: 'Play to deck strengths' };
    
    return specific;
  }

  private checkSpecificInteractions(opponent: MetaDeck): { score: number; factors: string[] } {
    const factors: string[] = [];
    let score = 0;

    // Check for specific card interactions
    if (opponent.name === 'Lost Box' && this.hasCard('Path to the Peak')) {
      factors.push('Path shuts down Comfey engine');
      score += 15;
    }

    if (opponent.name === 'Lugia VSTAR' && this.hasCard('Lost Vacuum')) {
      factors.push('Lost Vacuum removes Powerful Energy');
      score += 10;
    }

    if (opponent.name === 'Mew VMAX' && this.hasType('Dark')) {
      factors.push('Dark type advantage vs Psychic');
      score += 20;
    }

    return { score, factors };
  }

  private checkTypeCounters(strategies: CounterStrategy[]): void {
    const typeCounters: { [key: string]: string[] } = {
      'Psychic': ['Dark types counter Psychic weakness'],
      'Fighting': ['Psychic types counter Fighting weakness'],
      'Dark': ['Fighting types counter Dark weakness'],
      'Dragon': ['Fairy types counter Dragon weakness'],
      'Metal': ['Fire types counter Metal weakness'],
    };

    const playerTypes = new Set<string>();
    this.deckList.forEach(card => {
      if (card.supertype === 'POKEMON' && card.types) {
        card.types.forEach(type => playerTypes.add(type));
      }
    });

    playerTypes.forEach(type => {
      const counters = typeCounters[type];
      if (counters) {
        strategies.push({
          targetArchetype: `${type} weak decks`,
          cards: Array.from(playerTypes),
          effectiveness: 80,
        });
      }
    });
  }

  private hasHighAbilityReliance(): boolean {
    const abilityPokemon = this.deckList.filter(
      card => card.supertype === 'POKEMON' && card.abilities
    ).reduce((sum, card) => sum + card.quantity, 0);

    return abilityPokemon >= 10;
  }

  private hasHighSpecialEnergyReliance(): boolean {
    const specialEnergy = this.deckList.filter(
      card => card.supertype === 'ENERGY' && !this.isBasicEnergy(card)
    ).reduce((sum, card) => sum + card.quantity, 0);

    return specialEnergy >= 8;
  }

  private hasHighBenchDependency(): boolean {
    const benchSitters = this.deckList.filter(
      card => card.supertype === 'POKEMON' && 
      card.abilities && 
      !card.attacks?.length
    ).reduce((sum, card) => sum + card.quantity, 0);

    return benchSitters >= 6;
  }

  private hasSlowSetup(): boolean {
    const stage2Pokemon = this.deckList.filter(
      card => card.supertype === 'POKEMON' && 
      card.subtypes?.includes('Stage 2')
    ).reduce((sum, card) => sum + card.quantity, 0);

    return stage2Pokemon >= 4;
  }

  private hasLowHPPokemon(): boolean {
    const lowHP = this.deckList.filter(
      card => card.supertype === 'POKEMON' && 
      card.hp && 
      parseInt(card.hp) <= 90
    ).reduce((sum, card) => sum + card.quantity, 0);

    return lowHP >= 8;
  }

  private hasModernConsistencyCards(): boolean {
    const modernCards = ['Battle VIP Pass', 'Irida', 'Arven'];
    return modernCards.some(card => this.hasCard(card));
  }

  private hasCurrentSetCards(): boolean {
    // Check if deck has cards from sets released in last 6 months
    // Simplified for this example
    return true;
  }

  private hasExpandedPowerCards(): boolean {
    const expandedPowers = ['Computer Search', 'Battle Compressor', 'VS Seeker'];
    return expandedPowers.some(card => this.hasCard(card));
  }

  private hasExpandedConsistency(): boolean {
    const expandedConsistency = ['Tapu Lele-GX', 'Shaymin-EX', 'Dedenne-GX'];
    return expandedConsistency.some(card => this.hasCard(card));
  }

  private isRotatingCard(card: Card): boolean {
    // Simplified - would check actual rotation dates
    return card.set?.releaseDate < new Date('2022-01-01');
  }

  private isKeyCard(card: Card): boolean {
    return card.quantity === 1 || 
           card.supertype === 'POKEMON' && card.quantity <= 2;
  }

  private suggestReplacements(card: Card): string[] {
    const replacements: { [key: string]: string[] } = {
      'Professor\'s Research': ['Professor Turo', 'Professor Sada'],
      'Quick Ball': ['Ultra Ball', 'Nest Ball'],
      'Marnie': ['Judge', 'Iono'],
      'Boss\'s Orders': ['Cross Switcher', 'Prime Catcher'],
    };

    return replacements[card.name] || ['No direct replacement available'];
  }

  private getTechOptionsForMatchup(opponent: string): TechCardRecommendation[] {
    const techOptions: { [key: string]: TechCardRecommendation[] } = {
      'Lost Box': [
        {
          card: 'Path to the Peak',
          reason: 'Shuts down Comfey draw engine',
          matchupImprovements: ['Lost Box'],
          slot: 1,
        },
        {
          card: 'Klefki',
          reason: 'Prevents Sableye damage',
          matchupImprovements: ['Lost Box'],
          slot: 1,
        },
      ],
      'Mew VMAX': [
        {
          card: 'Drapion V',
          reason: 'Dark type with no weakness',
          matchupImprovements: ['Mew VMAX', 'Gardevoir ex'],
          slot: 1,
        },
      ],
      'Lugia VSTAR': [
        {
          card: 'Lost Vacuum',
          reason: 'Remove Powerful Energy',
          matchupImprovements: ['Lugia VSTAR'],
          slot: 2,
        },
      ],
    };

    return techOptions[opponent] || [];
  }

  private getTechOptionsForWeakness(weakness: MetaWeakness): TechCardRecommendation[] {
    const techOptions: { [key: string]: TechCardRecommendation[] } = {
      'Path to the Peak vulnerability': [
        {
          card: 'Lost Vacuum',
          reason: 'Remove opponent stadiums',
          matchupImprovements: ['Path decks'],
          slot: 2,
        },
        {
          card: 'Stadium Nav',
          reason: 'Find your stadiums consistently',
          matchupImprovements: ['Path decks'],
          slot: 1,
        },
      ],
      'Special Energy reliance': [
        {
          card: 'Basic Energy',
          reason: 'Mix in basics for Enhanced Hammer protection',
          matchupImprovements: ['Hammer decks'],
          slot: 3,
        },
      ],
    };

    return techOptions[weakness.weakness] || [];
  }

  private hasCard(cardName: string): boolean {
    return this.deckList.some(card => card.name.includes(cardName));
  }

  private hasType(type: string): boolean {
    return this.deckList.some(
      card => card.supertype === 'POKEMON' && card.types?.includes(type)
    );
  }

  private isBasicEnergy(card: Card): boolean {
    const basicEnergyNames = ['Basic Fire', 'Basic Water', 'Basic Grass', 
                             'Basic Lightning', 'Basic Psychic', 'Basic Fighting',
                             'Basic Darkness', 'Basic Metal'];
    return basicEnergyNames.some(name => card.name.includes(name));
  }
}