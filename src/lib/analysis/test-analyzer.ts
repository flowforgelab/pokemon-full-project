import { DeckAnalyzer } from './deck-analyzer';
import { Deck, DeckCard, Card, Supertype, Rarity } from '@prisma/client';

// Create a test deck
function createTestDeck(): Deck & { cards: (DeckCard & { card: Card })[] } {
  const testCards: (DeckCard & { card: Card })[] = [
    // Basic Pokemon
    {
      id: 'dc1',
      deckId: 'test-deck',
      cardId: 'card1',
      quantity: 4,
      category: 'MAIN',
      position: 1,
      addedAt: new Date(),
      card: {
        id: 'card1',
        name: 'Pikachu V',
        number: '1',
        supertype: Supertype.POKEMON,
        subtypes: ['Basic', 'V'],
        types: ['Lightning'],
        hp: '210',
        evolvesFrom: null,
        evolvesTo: null,
        abilities: [],
        attacks: [{
          name: 'Thunder Shock',
          cost: ['Lightning', 'Lightning'],
          damage: '120',
          text: 'Flip a coin. If tails, this Pokémon also does 30 damage to itself.'
        }],
        weaknesses: [{ type: 'Fighting', value: '×2' }],
        resistances: [],
        retreatCost: ['Colorless'],
        rarity: Rarity.RARE_ULTRA,
        isLegalStandard: true,
        isLegalExpanded: true,
        isLegalUnlimited: true,
        rules: ['Pokémon V rule: When your Pokémon V is Knocked Out, your opponent takes 2 Prize cards.'],
        smallImage: '',
        largeImage: '',
        flavorText: null,
        nationalPokedexNumbers: [25],
        tcgplayerId: null,
        prices: [],
        setId: 'test-set',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    },
    // Energy
    {
      id: 'dc2',
      deckId: 'test-deck',
      cardId: 'card2',
      quantity: 12,
      category: 'MAIN',
      position: 2,
      addedAt: new Date(),
      card: {
        id: 'card2',
        name: 'Basic Lightning Energy',
        number: '2',
        supertype: Supertype.ENERGY,
        subtypes: ['Basic'],
        types: [],
        hp: null,
        evolvesFrom: null,
        evolvesTo: null,
        abilities: [],
        attacks: [],
        weaknesses: [],
        resistances: [],
        retreatCost: [],
        rarity: Rarity.COMMON,
        isLegalStandard: true,
        isLegalExpanded: true,
        isLegalUnlimited: true,
        rules: [],
        smallImage: '',
        largeImage: '',
        flavorText: null,
        nationalPokedexNumbers: [],
        tcgplayerId: null,
        prices: [],
        setId: 'test-set',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    },
    // Trainer - Supporter
    {
      id: 'dc3',
      deckId: 'test-deck',
      cardId: 'card3',
      quantity: 4,
      category: 'MAIN',
      position: 3,
      addedAt: new Date(),
      card: {
        id: 'card3',
        name: "Professor's Research",
        number: '3',
        supertype: Supertype.TRAINER,
        subtypes: ['Supporter'],
        types: [],
        hp: null,
        evolvesFrom: null,
        evolvesTo: null,
        abilities: [],
        attacks: [],
        weaknesses: [],
        resistances: [],
        retreatCost: [],
        rarity: Rarity.UNCOMMON,
        isLegalStandard: true,
        isLegalExpanded: true,
        isLegalUnlimited: true,
        rules: ['Discard your hand and draw 7 cards.'],
        smallImage: '',
        largeImage: '',
        flavorText: null,
        nationalPokedexNumbers: [],
        tcgplayerId: null,
        prices: [],
        setId: 'test-set',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
  ];

  const testDeck: Deck & { cards: (DeckCard & { card: Card })[] } = {
    id: 'test-deck',
    name: 'Test Lightning Deck',
    description: 'A test deck for analyzer validation',
    userId: 'test-user',
    formatId: 'standard',
    isPublic: false,
    tags: ['test'],
    notes: null,
    wins: 0,
    losses: 0,
    draws: 0,
    favoriteCount: 0,
    viewCount: 0,
    copyCount: 0,
    isTemplate: false,
    originalDeckId: null,
    version: 1,
    lastAnalysisAt: null,
    lastAnalysisScore: null,
    archetype: null,
    lastPlayedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    cards: testCards
  };

  return testDeck;
}

// Test the analyzer
export async function testDeckAnalyzer() {
  console.log('Testing DeckAnalyzer...\n');
  
  const analyzer = new DeckAnalyzer({ format: 'standard', includeRotation: true });
  const testDeck = createTestDeck();
  
  console.log('Test Deck:', {
    name: testDeck.name,
    totalCards: testDeck.cards.reduce((sum, dc) => sum + dc.quantity, 0),
    cardTypes: testDeck.cards.map(dc => ({
      name: dc.card.name,
      quantity: dc.quantity,
      type: dc.card.supertype
    }))
  });
  
  try {
    console.log('\nAnalyzing deck...');
    const result = await analyzer.analyzeDeck(testDeck);
    
    console.log('\n=== ANALYSIS RESULT STRUCTURE ===');
    console.log('Root keys:', Object.keys(result));
    
    console.log('\n1. Scores:', {
      overall: result.scores?.overall,
      consistency: result.scores?.consistency,
      power: result.scores?.power,
      speed: result.scores?.speed,
      hasBreakdown: !!result.scores?.breakdown
    });
    
    console.log('\n2. Consistency:', {
      overallConsistency: result.consistency?.overallConsistency,
      mulliganProbability: result.consistency?.mulliganProbability,
      hasEnergyRatio: !!result.consistency?.energyRatio,
      hasTrainerDistribution: !!result.consistency?.trainerDistribution
    });
    
    console.log('\n3. Archetype:', {
      primary: result.archetype?.primaryArchetype,
      secondary: result.archetype?.secondaryArchetype,
      confidence: result.archetype?.confidence
    });
    
    console.log('\n4. Warnings:', result.warnings?.map(w => ({
      severity: w.severity,
      message: w.message
    })));
    
    console.log('\n5. Recommendations:', result.recommendations?.slice(0, 3).map(r => ({
      type: r.type,
      priority: r.priority,
      reason: r.reason
    })));
    
    console.log('\n=== FULL RESULT ===');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

// Run the test if called directly
if (require.main === module) {
  testDeckAnalyzer().catch(console.error);
}