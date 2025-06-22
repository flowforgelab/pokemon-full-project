import { Card, Supertype } from '@prisma/client';
import {
  DeckComposition,
  TestingSession,
  SimulatedHand,
  HandAnalysis,
  TestingStatistics,
  CardEntry,
} from './types';
import crypto from 'crypto';

export class DeckTestingSimulator {
  private readonly HAND_SIZE = 7;
  private readonly PRIZE_SIZE = 6;
  private readonly MAX_MULLIGANS = 10;

  async simulateHands(
    deck: DeckComposition,
    numberOfHands: number = 10
  ): Promise<TestingSession> {
    const sessionId = crypto.randomUUID();
    const hands: SimulatedHand[] = [];
    
    // Convert deck to array of cards for simulation
    const deckArray = this.deckToArray(deck);
    
    for (let i = 0; i < numberOfHands; i++) {
      const hand = this.simulateSingleHand(deckArray, deck);
      hands.push(hand);
    }
    
    const statistics = this.calculateStatistics(hands);
    
    return {
      id: sessionId,
      deckId: '', // Will be set when saving
      startTime: new Date(),
      hands,
      statistics,
    };
  }

  private simulateSingleHand(
    deckArray: Card[],
    deckComposition: DeckComposition
  ): SimulatedHand {
    let shuffledDeck = [...deckArray];
    let hand: Card[] = [];
    let mulligan = false;
    let mulliganCount = 0;
    
    // Keep drawing until we get a basic Pokemon or hit max mulligans
    do {
      shuffledDeck = this.shuffleArray(shuffledDeck);
      hand = shuffledDeck.slice(0, this.HAND_SIZE);
      
      const hasBasic = hand.some(card => 
        card.supertype === Supertype.POKEMON && 
        card.subtypes?.includes('Basic')
      );
      
      if (!hasBasic) {
        mulligan = true;
        mulliganCount++;
      } else {
        break;
      }
    } while (mulliganCount < this.MAX_MULLIGANS);
    
    // Set up remaining deck and prizes
    const remainingDeck = shuffledDeck.slice(this.HAND_SIZE);
    const prizes = remainingDeck.slice(0, this.PRIZE_SIZE);
    const drawDeck = remainingDeck.slice(this.PRIZE_SIZE);
    
    // Simulate first 5 turns of draws
    const turnDraws: Card[][] = [];
    for (let turn = 0; turn < 5; turn++) {
      const startIndex = turn * 1; // 1 card per turn
      const endIndex = startIndex + 1;
      turnDraws.push(drawDeck.slice(startIndex, endIndex));
    }
    
    const analysis = this.analyzeHand(hand, deckComposition);
    
    return {
      cards: hand,
      mulligan,
      turnDraws,
      prizes,
      analysis,
    };
  }

  private analyzeHand(hand: Card[], deck: DeckComposition): HandAnalysis {
    const hasBasicPokemon = hand.some(card => 
      card.supertype === Supertype.POKEMON && 
      card.subtypes?.includes('Basic')
    );
    
    const energyCount = hand.filter(card => 
      card.supertype === Supertype.ENERGY
    ).length;
    
    const setupPotential = this.calculateSetupPotential(hand);
    const idealTurn1Play = this.determineIdealTurn1Play(hand);
    const problems = this.identifyHandProblems(hand);
    
    return {
      hasBasicPokemon,
      energyCount,
      setupPotential,
      idealTurn1Play,
      problems,
    };
  }

  private calculateSetupPotential(hand: Card[]): number {
    let score = 0;
    
    // Basic Pokemon contribute to setup
    const basicPokemon = hand.filter(card => 
      card.supertype === Supertype.POKEMON && 
      card.subtypes?.includes('Basic')
    );
    score += basicPokemon.length * 20;
    
    // Energy cards help setup
    const energy = hand.filter(card => card.supertype === Supertype.ENERGY);
    score += Math.min(energy.length * 15, 30);
    
    // Search cards improve setup
    const searchCards = hand.filter(card => this.isSearchCard(card));
    score += searchCards.length * 25;
    
    // Draw supporters improve consistency
    const drawSupporters = hand.filter(card => this.isDrawSupporter(card));
    score += drawSupporters.length * 20;
    
    return Math.min(score, 100);
  }

  private determineIdealTurn1Play(hand: Card[]): string | undefined {
    // Check for ideal turn 1 plays
    const plays: string[] = [];
    
    // Look for Quick Ball to find a Pokemon
    if (hand.some(card => card.name.includes('Quick Ball'))) {
      plays.push('Quick Ball for Basic Pokémon');
    }
    
    // Look for Professor's Research
    if (hand.some(card => card.name.includes('Professor\'s Research'))) {
      plays.push('Professor\'s Research to draw 7');
    }
    
    // Look for Battle VIP Pass (if applicable)
    if (hand.some(card => card.name.includes('Battle VIP Pass'))) {
      plays.push('Battle VIP Pass for Basic Pokémon');
    }
    
    // Look for energy attachment options
    const energy = hand.filter(card => card.supertype === Supertype.ENERGY);
    const basicPokemon = hand.filter(card => 
      card.supertype === Supertype.POKEMON && 
      card.subtypes?.includes('Basic')
    );
    
    if (energy.length > 0 && basicPokemon.length > 0) {
      plays.push(`Attach Energy to ${basicPokemon[0].name}`);
    }
    
    return plays.length > 0 ? plays.join(', then ') : undefined;
  }

  private identifyHandProblems(hand: Card[]): string[] {
    const problems: string[] = [];
    
    // No Basic Pokemon
    const basicPokemon = hand.filter(card => 
      card.supertype === Supertype.POKEMON && 
      card.subtypes?.includes('Basic')
    );
    if (basicPokemon.length === 0) {
      problems.push('No Basic Pokémon - Mulligan required');
    }
    
    // No energy
    const energy = hand.filter(card => card.supertype === Supertype.ENERGY);
    if (energy.length === 0) {
      problems.push('No Energy cards in opening hand');
    }
    
    // No draw support
    const drawCards = hand.filter(card => 
      this.isDrawSupporter(card) || this.isDrawCard(card)
    );
    if (drawCards.length === 0) {
      problems.push('No draw support to maintain hand size');
    }
    
    // Too many Pokemon
    const pokemon = hand.filter(card => card.supertype === Supertype.POKEMON);
    if (pokemon.length >= 5) {
      problems.push('Hand clogged with Pokémon cards');
    }
    
    // Too many energy
    if (energy.length >= 4) {
      problems.push('Too many Energy cards in opening hand');
    }
    
    // Dead cards (evolution without basic)
    const evolutions = hand.filter(card => 
      card.supertype === Supertype.POKEMON && 
      (card.subtypes?.includes('Stage 1') || card.subtypes?.includes('Stage 2'))
    );
    if (evolutions.length > 0 && basicPokemon.length === 0) {
      problems.push('Evolution cards without Basic Pokémon');
    }
    
    return problems;
  }

  private calculateStatistics(hands: SimulatedHand[]): TestingStatistics {
    const totalHands = hands.length;
    const mulliganCount = hands.filter(h => h.mulligan).length;
    
    // Calculate average setup turn
    const setupTurns = hands.map(hand => this.estimateSetupTurn(hand));
    const averageSetupTurn = setupTurns.reduce((a, b) => a + b, 0) / totalHands;
    
    // Calculate energy drought rate
    const energyDroughts = hands.filter(hand => 
      hand.cards.filter(c => c.supertype === Supertype.ENERGY).length === 0
    ).length;
    
    // Calculate dead draw rate
    const deadDraws = hands.filter(hand => 
      hand.analysis.problems.length >= 3
    ).length;
    
    // Calculate combo success rates
    const comboSuccessRate = this.calculateComboRates(hands);
    
    return {
      totalHands,
      mulliganRate: (mulliganCount / totalHands) * 100,
      averageSetupTurn,
      energyDroughtRate: (energyDroughts / totalHands) * 100,
      deadDrawRate: (deadDraws / totalHands) * 100,
      comboSuccessRate,
    };
  }

  private estimateSetupTurn(hand: SimulatedHand): number {
    // Estimate how many turns to set up based on hand
    let turns = 1;
    
    // Factors that speed up setup
    if (hand.cards.some(c => this.isSearchCard(c))) {
      turns -= 0.5;
    }
    if (hand.cards.filter(c => c.supertype === Supertype.ENERGY).length >= 2) {
      turns -= 0.25;
    }
    
    // Factors that slow down setup
    if (hand.mulligan) {
      turns += 1;
    }
    if (hand.analysis.energyCount === 0) {
      turns += 0.5;
    }
    if (hand.analysis.problems.length >= 2) {
      turns += 0.5;
    }
    
    return Math.max(1, Math.min(4, turns));
  }

  private calculateComboRates(hands: SimulatedHand[]): { [combo: string]: number } {
    const combos: { [combo: string]: number } = {};
    
    // Track specific combos
    const comboChecks = [
      {
        name: 'Turn 1 Supporter',
        check: (hand: SimulatedHand) => 
          hand.cards.some(c => c.subtypes?.includes('Supporter')),
      },
      {
        name: 'Basic + Energy',
        check: (hand: SimulatedHand) => 
          hand.cards.some(c => c.supertype === Supertype.POKEMON && c.subtypes?.includes('Basic')) &&
          hand.cards.some(c => c.supertype === Supertype.ENERGY),
      },
      {
        name: 'Search Card Turn 1',
        check: (hand: SimulatedHand) => 
          hand.cards.some(c => this.isSearchCard(c)),
      },
    ];
    
    comboChecks.forEach(combo => {
      const successCount = hands.filter(hand => combo.check(hand)).length;
      combos[combo.name] = (successCount / hands.length) * 100;
    });
    
    return combos;
  }

  // Utility methods
  private deckToArray(deck: DeckComposition): Card[] {
    const cards: Card[] = [];
    
    const addCards = (entries: CardEntry[]) => {
      entries.forEach(entry => {
        for (let i = 0; i < entry.quantity; i++) {
          cards.push(entry.card);
        }
      });
    };
    
    addCards(deck.mainDeck.pokemon);
    addCards(deck.mainDeck.trainers);
    addCards(deck.mainDeck.energy);
    
    return cards;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private isSearchCard(card: Card): boolean {
    const searchCards = [
      'Quick Ball', 'Ultra Ball', 'Great Ball', 'Level Ball',
      'Evolution Incense', 'Nest Ball', 'Timer Ball',
    ];
    
    return card.supertype === Supertype.TRAINER &&
           searchCards.some(name => card.name.includes(name));
  }

  private isDrawSupporter(card: Card): boolean {
    const drawSupporters = [
      'Professor\'s Research', 'Marnie', 'Cynthia', 'Hop',
      'Juniper', 'Sycamore', 'N', 'Colress',
    ];
    
    return card.supertype === Supertype.TRAINER &&
           card.subtypes?.includes('Supporter') &&
           drawSupporters.some(name => card.name.includes(name));
  }

  private isDrawCard(card: Card): boolean {
    const drawCards = [
      'Acro Bike', 'Trainer\'s Mail', 'Bicycle',
      'Oranguru', 'Bibarel', 'Octillery',
    ];
    
    return drawCards.some(name => card.name.includes(name));
  }

  // Advanced testing features
  async simulateTurnSequence(
    deck: DeckComposition,
    turns: number = 10
  ): Promise<{
    turnData: Array<{
      turn: number;
      hand: Card[];
      board: Card[];
      prizes: number;
      energyAttached: number;
    }>;
    winProbability: number;
  }> {
    // This would simulate full game sequences
    // Placeholder for now
    return {
      turnData: [],
      winProbability: 0.5,
    };
  }

  async simulateMatchup(
    deck1: DeckComposition,
    deck2: DeckComposition,
    games: number = 100
  ): Promise<{
    deck1Wins: number;
    deck2Wins: number;
    averageTurns: number;
    keyMoments: string[];
  }> {
    // This would simulate matchups between decks
    // Placeholder for now
    return {
      deck1Wins: 50,
      deck2Wins: 50,
      averageTurns: 8,
      keyMoments: [],
    };
  }

  calculateProbability(
    deck: DeckComposition,
    scenario: {
      cardsNeeded: string[];
      byTurn: number;
      inHand?: boolean;
      onBoard?: boolean;
    }
  ): number {
    // Calculate probability of specific scenarios
    const deckSize = deck.totalCards;
    const cardsDrawn = this.HAND_SIZE + (scenario.byTurn - 1);
    
    // Simplified probability calculation
    // Would need more sophisticated math for complex scenarios
    return 0.5;
  }
}