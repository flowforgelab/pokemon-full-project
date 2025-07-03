/**
 * Additional Test Decks
 * 
 * More edge cases and common scenarios for comprehensive testing
 */

import { TestDeck, TestDeckCard } from './types';
import { Card } from '@prisma/client';

// Helper functions (same as deck-data.ts)
function createCard(overrides: Partial<Card>): Card {
  return {
    id: overrides.id || '1',
    name: overrides.name || 'Test Card',
    supertype: overrides.supertype || 'POKEMON',
    subtypes: overrides.subtypes || [],
    types: overrides.types || null,
    hp: overrides.hp || null,
    evolvesFrom: overrides.evolvesFrom || null,
    attacks: overrides.attacks || null,
    weaknesses: overrides.weaknesses || null,
    resistances: overrides.resistances || null,
    retreatCost: overrides.retreatCost || null,
    setId: overrides.setId || 'test-set',
    tcgplayerPurchaseUrl: null,
    number: overrides.number || '1',
    artist: '',
    rarity: overrides.rarity || 'Common',
    flavorText: null,
    nationalPokedexNumbers: [],
    rules: overrides.rules || null,
    abilities: overrides.abilities || null,
  } as Card;
}

function createDeckCard(card: Card, quantity: number, id: string): TestDeckCard {
  return {
    id,
    deckId: 'test-deck',
    cardId: card.id,
    quantity,
    card
  };
}

// Prize trade poor deck - too many multi-prizers
export const prizeTradePoorDeck: TestDeck = {
  id: 'prize-trade-poor',
  name: 'Prize Trade Poor Deck',
  description: 'Deck with too many multi-prize Pokemon',
  category: 'prize-trade-poor',
  cards: [
    // 16 multi-prize Pokemon!
    createDeckCard(createCard({
      id: 'vmax1',
      name: 'Eternatus VMAX',
      supertype: 'POKEMON',
      subtypes: ['VMAX'],
      evolvesFrom: 'Eternatus V',
      hp: '340'
    }), 4, '1'),
    
    createDeckCard(createCard({
      id: 'v1',
      name: 'Eternatus V',
      supertype: 'POKEMON',
      subtypes: ['V', 'Basic'],
      hp: '220'
    }), 4, '2'),
    
    createDeckCard(createCard({
      id: 'vmax2',
      name: 'Crobat VMAX',
      supertype: 'POKEMON',
      subtypes: ['VMAX'],
      evolvesFrom: 'Crobat V',
      hp: '300'
    }), 4, '3'),
    
    createDeckCard(createCard({
      id: 'v2',
      name: 'Crobat V',
      supertype: 'POKEMON',
      subtypes: ['V', 'Basic'],
      hp: '180',
      abilities: [{
        name: 'Dark Asset',
        text: 'When you play this Pokemon from your hand onto your Bench during your turn, you may draw cards until you have 6 cards in your hand.',
        type: 'Ability'
      }]
    }), 4, '4'),
    
    // Minimal trainers (29)
    createDeckCard(createCard({
      id: 'prof3',
      name: "Professor's Research",
      supertype: 'TRAINER',
      subtypes: ['Supporter']
    }), 29, '5'),
    
    // Energy (15)
    createDeckCard(createCard({
      id: 'dark1',
      name: 'Darkness Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 15, '6'),
  ],
  expectedIssues: [
    {
      category: 'Prize Trade',
      severity: 'major',
      description: 'Deck gives up 3 prizes per KO with VMAX Pokemon',
      mustDetect: true
    },
    {
      category: 'Pokemon Balance',
      severity: 'major',
      description: 'All Pokemon are multi-prizers',
      mustDetect: true
    }
  ],
  expectedScore: {
    min: 25,
    max: 40,
    reason: 'Poor prize trade economics'
  },
  knownProblems: [
    '100% multi-prize Pokemon',
    'Gives up 3 prizes per VMAX KO',
    'No single prizers for sacrifice plays'
  ]
};

// Consistency issues deck
export const consistencyIssuesDeck: TestDeck = {
  id: 'consistency-poor',
  name: 'Poor Consistency Deck',
  description: 'Deck with insufficient draw and search',
  category: 'consistency-issues',
  cards: [
    // Decent Pokemon line (12)
    createDeckCard(createCard({
      id: 'blast1',
      name: 'Blastoise',
      supertype: 'POKEMON',
      subtypes: ['Stage 2'],
      evolvesFrom: 'Wartortle',
      hp: '170'
    }), 3, '1'),
    
    createDeckCard(createCard({
      id: 'wart1',
      name: 'Wartortle',
      supertype: 'POKEMON',
      subtypes: ['Stage 1'],
      evolvesFrom: 'Squirtle',
      hp: '90'
    }), 2, '2'),
    
    createDeckCard(createCard({
      id: 'squirt1',
      name: 'Squirtle',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '60'
    }), 4, '3'),
    
    createDeckCard(createCard({
      id: 'lap1',
      name: 'Lapras',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '120'
    }), 3, '4'),
    
    // Very few draw supporters (only 3!)
    createDeckCard(createCard({
      id: 'hop1',
      name: 'Hop',
      supertype: 'TRAINER',
      subtypes: ['Supporter'],
      rules: ['Draw 3 cards.']
    }), 3, '5'),
    
    // No search cards!
    
    // Random items (32)
    createDeckCard(createCard({
      id: 'potion1',
      name: 'Potion',
      supertype: 'TRAINER',
      subtypes: ['Item'],
      rules: ['Heal 30 damage from 1 of your Pokemon.']
    }), 20, '6'),
    
    createDeckCard(createCard({
      id: 'xspeed1',
      name: 'X Speed',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 12, '7'),
    
    // Energy (13)
    createDeckCard(createCard({
      id: 'water1',
      name: 'Water Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 13, '8'),
  ],
  expectedIssues: [
    {
      category: 'Draw Support',
      severity: 'critical',
      description: 'Only 3 draw supporters (need 6-10)',
      mustDetect: true
    },
    {
      category: 'Search Cards',
      severity: 'critical',
      description: 'No Pokemon search cards',
      mustDetect: true
    },
    {
      category: 'Trainer Balance',
      severity: 'major',
      description: 'Too many healing items, not enough consistency',
      mustDetect: false
    }
  ],
  expectedScore: {
    min: 20,
    max: 35,
    reason: 'Severe consistency problems'
  },
  knownProblems: [
    'Insufficient draw support',
    'No search cards',
    'Will brick frequently'
  ]
};

// Budget-friendly deck
export const budgetFriendlyDeck: TestDeck = {
  id: 'budget-friendly',
  name: 'Budget Blissey Deck',
  description: 'Competitive budget deck under $75',
  category: 'budget-friendly',
  cards: [
    // Pokemon (12)
    createDeckCard(createCard({
      id: 'bliss1',
      name: 'Blissey V',
      supertype: 'POKEMON',
      subtypes: ['V', 'Basic'],
      hp: '250',
      attacks: [{
        name: 'Blissful Blast',
        cost: ['Colorless', 'Colorless', 'Colorless'],
        damage: '120'
      }]
    }), 3, '1'),
    
    createDeckCard(createCard({
      id: 'milt1',
      name: 'Miltank',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '100',
      attacks: [{
        name: 'Rout',
        cost: ['Colorless', 'Colorless'],
        damage: '10+'
      }]
    }), 4, '2'),
    
    createDeckCard(createCard({
      id: 'bibar1',
      name: 'Bibarel',
      supertype: 'POKEMON',
      subtypes: ['Stage 1'],
      evolvesFrom: 'Bidoof',
      hp: '120',
      abilities: [{
        name: 'Industrious Incisors',
        text: 'Once during your turn, you may draw cards until you have 5 cards in your hand.',
        type: 'Ability'
      }]
    }), 3, '3'),
    
    createDeckCard(createCard({
      id: 'bidoof1',
      name: 'Bidoof',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '70'
    }), 4, '4'),
    
    // Trainers (34)
    createDeckCard(createCard({
      id: 'prof4',
      name: "Professor's Research",
      supertype: 'TRAINER',
      subtypes: ['Supporter']
    }), 4, '5'),
    
    createDeckCard(createCard({
      id: 'cheren1',
      name: "Cheren's Care",
      supertype: 'TRAINER',
      subtypes: ['Supporter']
    }), 3, '6'),
    
    createDeckCard(createCard({
      id: 'quick2',
      name: 'Quick Ball',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 4, '7'),
    
    createDeckCard(createCard({
      id: 'level1',
      name: 'Level Ball',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 4, '8'),
    
    createDeckCard(createCard({
      id: 'twin3',
      name: 'Twin Energy',
      supertype: 'ENERGY',
      subtypes: ['Special']
    }), 4, '9'),
    
    createDeckCard(createCard({
      id: 'cape2',
      name: 'Cape of Toughness',
      supertype: 'TRAINER',
      subtypes: ['Tool']
    }), 3, '10'),
    
    createDeckCard(createCard({
      id: 'ord1',
      name: 'Ordinary Rod',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 3, '11'),
    
    createDeckCard(createCard({
      id: 'path1',
      name: 'Path to the Peak',
      supertype: 'TRAINER',
      subtypes: ['Stadium']
    }), 3, '12'),
    
    createDeckCard(createCard({
      id: 'switch3',
      name: 'Switch',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 4, '13'),
    
    createDeckCard(createCard({
      id: 'poke1',
      name: 'Pokegear 3.0',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 2, '14'),
    
    // Energy (14)
    createDeckCard(createCard({
      id: 'powerful1',
      name: 'Powerful Colorless Energy',
      supertype: 'ENERGY',
      subtypes: ['Special']
    }), 4, '15'),
    
    createDeckCard(createCard({
      id: 'aurora1',
      name: 'Aurora Energy',
      supertype: 'ENERGY',
      subtypes: ['Special']
    }), 2, '16'),
    
    createDeckCard(createCard({
      id: 'psychic2',
      name: 'Psychic Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 8, '17'),
  ],
  expectedIssues: [],
  expectedScore: {
    min: 65,
    max: 75,
    reason: 'Solid budget deck with good consistency'
  },
  knownGoodFeatures: [
    'Bibarel provides consistent draw',
    'Path to the Peak disrupts Rule Box Pokemon',
    'Good energy package for Colorless attackers',
    'Under $75 budget'
  ],
  meta: {
    archetype: 'Blissey V Budget',
    tier: 3
  }
};

// Beginner mistake deck
export const beginnerMistakeDeck: TestDeck = {
  id: 'beginner-mistake',
  name: 'Beginner Mistake Deck',
  description: 'Common new player deck building errors',
  category: 'beginner-mistake',
  cards: [
    // Too many different Pokemon lines (20)
    createDeckCard(createCard({
      id: 'pika1',
      name: 'Pikachu',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '60'
    }), 1, '1'),
    
    createDeckCard(createCard({
      id: 'rai1',
      name: 'Raichu',
      supertype: 'POKEMON',
      subtypes: ['Stage 1'],
      evolvesFrom: 'Pikachu',
      hp: '120'
    }), 1, '2'),
    
    createDeckCard(createCard({
      id: 'char4',
      name: 'Charmander',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '60'
    }), 1, '3'),
    
    createDeckCard(createCard({
      id: 'char5',
      name: 'Charmeleon',
      supertype: 'POKEMON',
      subtypes: ['Stage 1'],
      evolvesFrom: 'Charmander',
      hp: '90'
    }), 1, '4'),
    
    createDeckCard(createCard({
      id: 'char6',
      name: 'Charizard',
      supertype: 'POKEMON',
      subtypes: ['Stage 2'],
      evolvesFrom: 'Charmeleon',
      hp: '170'
    }), 1, '5'),
    
    createDeckCard(createCard({
      id: 'bulb1',
      name: 'Bulbasaur',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '70'
    }), 1, '6'),
    
    createDeckCard(createCard({
      id: 'ivy1',
      name: 'Ivysaur',
      supertype: 'POKEMON',
      subtypes: ['Stage 1'],
      evolvesFrom: 'Bulbasaur',
      hp: '100'
    }), 1, '7'),
    
    createDeckCard(createCard({
      id: 'venu1',
      name: 'Venusaur',
      supertype: 'POKEMON',
      subtypes: ['Stage 2'],
      evolvesFrom: 'Ivysaur',
      hp: '180'
    }), 1, '8'),
    
    createDeckCard(createCard({
      id: 'squirt2',
      name: 'Squirtle',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '60'
    }), 1, '9'),
    
    createDeckCard(createCard({
      id: 'blast2',
      name: 'Blastoise',
      supertype: 'POKEMON',
      subtypes: ['Stage 2'],
      evolvesFrom: 'Wartortle',
      hp: '170'
    }), 1, '10'),
    
    // Random other Pokemon
    createDeckCard(createCard({
      id: 'mew1',
      name: 'Mew',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '60'
    }), 2, '11'),
    
    createDeckCard(createCard({
      id: 'snor1',
      name: 'Snorlax',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '160'
    }), 2, '12'),
    
    createDeckCard(createCard({
      id: 'eevee1',
      name: 'Eevee',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '60'
    }), 4, '13'),
    
    createDeckCard(createCard({
      id: 'vap1',
      name: 'Vaporeon',
      supertype: 'POKEMON',
      subtypes: ['Stage 1'],
      evolvesFrom: 'Eevee',
      hp: '110'
    }), 1, '14'),
    
    createDeckCard(createCard({
      id: 'jolt1',
      name: 'Jolteon',
      supertype: 'POKEMON',
      subtypes: ['Stage 1'],
      evolvesFrom: 'Eevee',
      hp: '110'
    }), 1, '15'),
    
    // Very few trainers (15)
    createDeckCard(createCard({
      id: 'pokeball1',
      name: 'Poke Ball',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 4, '16'),
    
    createDeckCard(createCard({
      id: 'pot2',
      name: 'Potion',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 6, '17'),
    
    createDeckCard(createCard({
      id: 'revive1',
      name: 'Revive',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 3, '18'),
    
    createDeckCard(createCard({
      id: 'bill1',
      name: "Bill's Analysis",
      supertype: 'TRAINER',
      subtypes: ['Supporter']
    }), 2, '19'),
    
    // Too many different energy types (25)
    createDeckCard(createCard({
      id: 'fire2',
      name: 'Fire Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 5, '20'),
    
    createDeckCard(createCard({
      id: 'water2',
      name: 'Water Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 5, '21'),
    
    createDeckCard(createCard({
      id: 'grass2',
      name: 'Grass Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 5, '22'),
    
    createDeckCard(createCard({
      id: 'light2',
      name: 'Lightning Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 5, '23'),
    
    createDeckCard(createCard({
      id: 'psychic3',
      name: 'Psychic Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 5, '24'),
  ],
  expectedIssues: [
    {
      category: 'Pokemon Lines',
      severity: 'critical',
      description: 'Too many different evolution lines',
      mustDetect: true
    },
    {
      category: 'Energy Types',
      severity: 'critical',
      description: 'Too many different energy types (5!)',
      mustDetect: true
    },
    {
      category: 'Evolution Ratios',
      severity: 'major',
      description: 'Incomplete evolution lines',
      mustDetect: true
    },
    {
      category: 'Trainer Count',
      severity: 'major',
      description: 'Insufficient trainer cards',
      mustDetect: true
    }
  ],
  expectedScore: {
    min: 5,
    max: 20,
    reason: 'Multiple fundamental deck building errors'
  },
  knownProblems: [
    'Too many Pokemon lines',
    '5 different energy types',
    'Incomplete evolutions',
    'No focus or strategy'
  ]
};

// Edge case - Special rules deck
export const specialRulesDeck: TestDeck = {
  id: 'special-rules',
  name: 'Special Rules Deck',
  description: 'Tests ACE SPEC, Prism Star, and Radiant rules',
  category: 'edge-case',
  cards: [
    // Special rule cards
    createDeckCard(createCard({
      id: 'comp1',
      name: 'Computer Search',
      supertype: 'TRAINER',
      subtypes: ['Item', 'ACE SPEC'],
      rules: ['ACE SPEC: You can only have 1 ACE SPEC card in your deck.']
    }), 1, '1'),
    
    createDeckCard(createCard({
      id: 'ditto1',
      name: 'Ditto Prism Star',
      supertype: 'POKEMON',
      subtypes: ['Basic', 'Prism Star'],
      hp: '40',
      rules: ['You can only have 1 Prism Star card with the same name in your deck.']
    }), 1, '2'),
    
    createDeckCard(createCard({
      id: 'rad1',
      name: 'Radiant Charizard',
      supertype: 'POKEMON',
      subtypes: ['Basic', 'Radiant'],
      hp: '160',
      rules: ['You can only have 1 Radiant Pokemon in your deck.']
    }), 1, '3'),
    
    // Regular Pokemon
    createDeckCard(createCard({
      id: 'arc1',
      name: 'Arceus V',
      supertype: 'POKEMON',
      subtypes: ['V', 'Basic'],
      hp: '220'
    }), 4, '4'),
    
    createDeckCard(createCard({
      id: 'arc2',
      name: 'Arceus VSTAR',
      supertype: 'POKEMON',
      subtypes: ['VSTAR'],
      evolvesFrom: 'Arceus V',
      hp: '280'
    }), 3, '5'),
    
    createDeckCard(createCard({
      id: 'bibar2',
      name: 'Bibarel',
      supertype: 'POKEMON',
      subtypes: ['Stage 1'],
      evolvesFrom: 'Bidoof',
      hp: '120'
    }), 2, '6'),
    
    createDeckCard(createCard({
      id: 'bid2',
      name: 'Bidoof',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '70'
    }), 4, '7'),
    
    // Standard trainers (32)
    createDeckCard(createCard({
      id: 'prof5',
      name: "Professor's Research",
      supertype: 'TRAINER',
      subtypes: ['Supporter']
    }), 4, '8'),
    
    createDeckCard(createCard({
      id: 'boss2',
      name: "Boss's Orders",
      supertype: 'TRAINER',
      subtypes: ['Supporter']
    }), 3, '9'),
    
    createDeckCard(createCard({
      id: 'quick3',
      name: 'Quick Ball',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 4, '10'),
    
    createDeckCard(createCard({
      id: 'ultra3',
      name: 'Ultra Ball',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 4, '11'),
    
    createDeckCard(createCard({
      id: 'choice1',
      name: 'Choice Belt',
      supertype: 'TRAINER',
      subtypes: ['Tool']
    }), 3, '12'),
    
    createDeckCard(createCard({
      id: 'switch4',
      name: 'Switch',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 4, '13'),
    
    createDeckCard(createCard({
      id: 'path2',
      name: 'Path to the Peak',
      supertype: 'TRAINER',
      subtypes: ['Stadium']
    }), 2, '14'),
    
    createDeckCard(createCard({
      id: 'ord2',
      name: 'Ordinary Rod',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 2, '15'),
    
    createDeckCard(createCard({
      id: 'train2',
      name: 'Training Court',
      supertype: 'TRAINER',
      subtypes: ['Stadium']
    }), 2, '16'),
    
    // Energy (12)
    createDeckCard(createCard({
      id: 'double1',
      name: 'Double Turbo Energy',
      supertype: 'ENERGY',
      subtypes: ['Special']
    }), 4, '17'),
    
    createDeckCard(createCard({
      id: 'metal1',
      name: 'Metal Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 8, '18'),
  ],
  expectedIssues: [],
  expectedScore: {
    min: 75,
    max: 85,
    reason: 'Legal deck with special rule cards'
  },
  knownGoodFeatures: [
    'Legal use of ACE SPEC (1 copy)',
    'Legal use of Prism Star (1 copy)',
    'Legal use of Radiant (1 copy)',
    'Good consistency engine'
  ],
  meta: {
    archetype: 'Arceus VSTAR',
    tier: 2
  }
};

export const additionalTestDecks: TestDeck[] = [
  prizeTradePoorDeck,
  consistencyIssuesDeck,
  budgetFriendlyDeck,
  beginnerMistakeDeck,
  specialRulesDeck
];