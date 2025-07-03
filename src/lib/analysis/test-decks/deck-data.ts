/**
 * Test Deck Data
 * 
 * Comprehensive collection of test decks for analyzer validation
 */

import { TestDeck, TestDeckCard } from './types';
import { Card } from '@prisma/client';

// Helper to create test cards
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

// Helper to create deck cards
function createDeckCard(card: Card, quantity: number, id: string): TestDeckCard {
  return {
    id,
    deckId: 'test-deck',
    cardId: card.id,
    quantity,
    card
  };
}

// Well-built meta deck example
export const charizardExDeck: TestDeck = {
  id: 'charizard-ex-meta',
  name: 'Charizard ex Meta Deck',
  description: 'Top tier competitive Charizard ex deck',
  category: 'well-built',
  cards: [
    // Pokemon (13)
    createDeckCard(createCard({
      id: 'char1',
      name: 'Charizard ex',
      supertype: 'POKEMON',
      subtypes: ['ex', 'Stage 2'],
      types: ['Fire'],
      hp: '330',
      evolvesFrom: 'Charmeleon',
      attacks: [{
        name: 'Burning Darkness',
        cost: ['Fire', 'Fire'],
        damage: '180'
      }]
    }), 3, '1'),
    
    createDeckCard(createCard({
      id: 'char2',
      name: 'Charmeleon',
      supertype: 'POKEMON',
      subtypes: ['Stage 1'],
      types: ['Fire'],
      hp: '90',
      evolvesFrom: 'Charmander'
    }), 1, '2'),
    
    createDeckCard(createCard({
      id: 'char3',
      name: 'Charmander',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      types: ['Fire'],
      hp: '70'
    }), 4, '3'),
    
    createDeckCard(createCard({
      id: 'pid1',
      name: 'Pidgeot ex',
      supertype: 'POKEMON',
      subtypes: ['ex', 'Stage 2'],
      types: ['Colorless'],
      hp: '280',
      evolvesFrom: 'Pidgeotto',
      abilities: [{
        name: 'Quick Search',
        text: 'Once during your turn, you may search your deck for any 1 card and put it into your hand.',
        type: 'Ability'
      }]
    }), 2, '4'),
    
    createDeckCard(createCard({
      id: 'pid2',
      name: 'Pidgey',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      types: ['Colorless'],
      hp: '60'
    }), 3, '5'),
    
    // Trainers (35)
    createDeckCard(createCard({
      id: 'prof1',
      name: "Professor's Research",
      supertype: 'TRAINER',
      subtypes: ['Supporter'],
      rules: ['Discard your hand and draw 7 cards.']
    }), 4, '6'),
    
    createDeckCard(createCard({
      id: 'boss1',
      name: "Boss's Orders",
      supertype: 'TRAINER',
      subtypes: ['Supporter'],
      rules: ["Switch 1 of your opponent's Benched Pokemon with their Active Pokemon."]
    }), 3, '7'),
    
    createDeckCard(createCard({
      id: 'arven1',
      name: 'Arven',
      supertype: 'TRAINER',
      subtypes: ['Supporter'],
      rules: ['Search your deck for an Item card and a Pokemon Tool card, reveal them, and put them into your hand.']
    }), 4, '8'),
    
    createDeckCard(createCard({
      id: 'candy1',
      name: 'Rare Candy',
      supertype: 'TRAINER',
      subtypes: ['Item'],
      rules: ['Choose 1 of your Basic Pokemon in play. If you have a Stage 2 card in your hand that evolves from that Pokemon, put that card onto the Basic Pokemon to evolve it.']
    }), 4, '9'),
    
    createDeckCard(createCard({
      id: 'ultra1',
      name: 'Ultra Ball',
      supertype: 'TRAINER',
      subtypes: ['Item'],
      rules: ['Discard 2 cards from your hand. If you do, search your deck for a Pokemon, reveal it, and put it into your hand.']
    }), 4, '10'),
    
    createDeckCard(createCard({
      id: 'nest1',
      name: 'Nest Ball',
      supertype: 'TRAINER',
      subtypes: ['Item'],
      rules: ['Search your deck for a Basic Pokemon and put it onto your Bench.']
    }), 4, '11'),
    
    createDeckCard(createCard({
      id: 'switch1',
      name: 'Switch',
      supertype: 'TRAINER',
      subtypes: ['Item'],
      rules: ['Switch your Active Pokemon with 1 of your Benched Pokemon.']
    }), 3, '12'),
    
    createDeckCard(createCard({
      id: 'super1',
      name: 'Super Rod',
      supertype: 'TRAINER',
      subtypes: ['Item'],
      rules: ['Shuffle up to 3 in any combination of Pokemon and basic Energy cards from your discard pile into your deck.']
    }), 2, '13'),
    
    createDeckCard(createCard({
      id: 'lost1',
      name: 'Lost Vacuum',
      supertype: 'TRAINER',
      subtypes: ['Item'],
      rules: ['You can use this card only if you put another card from your hand in the Lost Zone.']
    }), 2, '14'),
    
    createDeckCard(createCard({
      id: 'belt1',
      name: 'Choice Belt',
      supertype: 'TRAINER',
      subtypes: ['Tool'],
      rules: ["The attacks of the Pokemon this card is attached to do 30 more damage to your opponent's Active Pokemon V."]
    }), 2, '15'),
    
    createDeckCard(createCard({
      id: 'forest1',
      name: 'Forest Seal Stone',
      supertype: 'TRAINER',
      subtypes: ['Tool'],
      rules: ['The Pokemon V this card is attached to can use the VSTAR Power on this card.']
    }), 1, '16'),
    
    // Energy (12)
    createDeckCard(createCard({
      id: 'fire1',
      name: 'Fire Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 10, '17'),
    
    createDeckCard(createCard({
      id: 'twin1',
      name: 'Twin Energy',
      supertype: 'ENERGY',
      subtypes: ['Special'],
      rules: ['This card provides Colorless Colorless Energy. This card provides no Energy while attached to Pokemon-GX or Pokemon V.']
    }), 2, '18'),
  ],
  expectedIssues: [],
  expectedScore: {
    min: 85,
    max: 95,
    reason: 'Well-constructed meta deck with strong consistency'
  },
  knownGoodFeatures: [
    'Pidgeot ex provides consistent search',
    'Good evolution line ratios with Rare Candy',
    'Strong draw supporter count',
    'Adequate energy for attackers'
  ],
  meta: {
    archetype: 'Charizard ex',
    tier: 1,
    popular: true
  }
};

// Fundamentally broken deck - no basics
export const noBasisDeck: TestDeck = {
  id: 'no-basics',
  name: 'No Basic Pokemon Deck',
  description: 'Illegal deck with only evolution Pokemon',
  category: 'fundamentally-broken',
  cards: [
    // Only evolution Pokemon (12)
    createDeckCard(createCard({
      id: 'evo1',
      name: 'Alakazam',
      supertype: 'POKEMON',
      subtypes: ['Stage 2'],
      evolvesFrom: 'Kadabra',
      hp: '140'
    }), 4, '1'),
    
    createDeckCard(createCard({
      id: 'evo2',
      name: 'Kadabra',
      supertype: 'POKEMON',
      subtypes: ['Stage 1'],
      evolvesFrom: 'Abra',
      hp: '90'
    }), 4, '2'),
    
    createDeckCard(createCard({
      id: 'evo3',
      name: 'Machamp',
      supertype: 'POKEMON',
      subtypes: ['Stage 2'],
      evolvesFrom: 'Machoke',
      hp: '160'
    }), 4, '3'),
    
    // Fill with trainers (48)
    createDeckCard(createCard({
      id: 'filler1',
      name: 'Potion',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 48, '4'),
  ],
  expectedIssues: [
    {
      category: 'Basic Pokemon',
      severity: 'critical',
      description: 'Deck has 0 Basic Pokemon - will auto-lose every game',
      mustDetect: true
    }
  ],
  expectedScore: {
    min: 0,
    max: 0,
    reason: 'Unplayable deck - cannot start a game'
  },
  knownProblems: [
    'No Basic Pokemon',
    '100% mulligan rate',
    'Illegal deck configuration'
  ]
};

// Poor energy balance deck
export const energyImbalanceDeck: TestDeck = {
  id: 'energy-imbalance',
  name: 'Energy Imbalance Deck',
  description: 'Deck with severe energy problems',
  category: 'energy-problems',
  cards: [
    // High cost attackers (10)
    createDeckCard(createCard({
      id: 'mewtwo1',
      name: 'Mewtwo VMAX',
      supertype: 'POKEMON',
      subtypes: ['VMAX'],
      evolvesFrom: 'Mewtwo V',
      hp: '330',
      attacks: [{
        name: 'Max Miracle',
        cost: ['Psychic', 'Psychic', 'Psychic'],
        damage: '200'
      }]
    }), 3, '1'),
    
    createDeckCard(createCard({
      id: 'mewtwo2',
      name: 'Mewtwo V',
      supertype: 'POKEMON',
      subtypes: ['V', 'Basic'],
      hp: '220'
    }), 3, '2'),
    
    createDeckCard(createCard({
      id: 'zekrom1',
      name: 'Zekrom',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '130',
      attacks: [{
        name: 'Bolt Strike',
        cost: ['Lightning', 'Lightning', 'Lightning', 'Colorless'],
        damage: '150'
      }]
    }), 4, '3'),
    
    // Some trainers (45)
    createDeckCard(createCard({
      id: 'oak1',
      name: "Professor Oak's Research",
      supertype: 'TRAINER',
      subtypes: ['Supporter']
    }), 45, '4'),
    
    // Only 5 energy!
    createDeckCard(createCard({
      id: 'psyenergy',
      name: 'Psychic Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 3, '5'),
    
    createDeckCard(createCard({
      id: 'lightenergy',
      name: 'Lightning Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 2, '6'),
  ],
  expectedIssues: [
    {
      category: 'Energy',
      severity: 'critical',
      description: 'Only 5 energy for attackers requiring 3-4 energy each',
      mustDetect: true
    },
    {
      category: 'Energy Types',
      severity: 'major',
      description: 'Split energy types without enough of either',
      mustDetect: true
    }
  ],
  expectedScore: {
    min: 10,
    max: 25,
    reason: 'Severe energy shortage makes deck unplayable'
  },
  knownProblems: [
    'Insufficient energy count',
    'No energy acceleration',
    'Split energy types',
    'High attack costs'
  ]
};

// Evolution-heavy deck with Rare Candy
export const evolutionHeavyDeck: TestDeck = {
  id: 'evolution-rare-candy',
  name: 'Evolution Rare Candy Deck',
  description: 'Tests detection of 4-0-3 evolution lines',
  category: 'evolution-heavy',
  cards: [
    // 4-0-3 Gardevoir line
    createDeckCard(createCard({
      id: 'ralts1',
      name: 'Ralts',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '60'
    }), 4, '1'),
    
    // No Kirlia!
    
    createDeckCard(createCard({
      id: 'garde1',
      name: 'Gardevoir ex',
      supertype: 'POKEMON',
      subtypes: ['ex', 'Stage 2'],
      evolvesFrom: 'Kirlia',
      hp: '310',
      abilities: [{
        name: 'Psychic Embrace',
        text: 'As often as you like during your turn, you may attach a Basic Psychic Energy card from your discard pile to 1 of your Psychic Pokemon.',
        type: 'Ability'
      }]
    }), 3, '2'),
    
    createDeckCard(createCard({
      id: 'candy2',
      name: 'Rare Candy',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 4, '3'),
    
    // Other basics
    createDeckCard(createCard({
      id: 'zacian1',
      name: 'Zacian V',
      supertype: 'POKEMON',
      subtypes: ['V', 'Basic'],
      hp: '220'
    }), 3, '4'),
    
    // Standard trainers (30)
    createDeckCard(createCard({
      id: 'research2',
      name: "Professor's Research",
      supertype: 'TRAINER',
      subtypes: ['Supporter']
    }), 4, '5'),
    
    createDeckCard(createCard({
      id: 'marnie1',
      name: 'Marnie',
      supertype: 'TRAINER',
      subtypes: ['Supporter']
    }), 4, '6'),
    
    createDeckCard(createCard({
      id: 'quick1',
      name: 'Quick Ball',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 4, '7'),
    
    createDeckCard(createCard({
      id: 'ultra2',
      name: 'Ultra Ball',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 4, '8'),
    
    createDeckCard(createCard({
      id: 'ordinary1',
      name: 'Ordinary Rod',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 2, '9'),
    
    createDeckCard(createCard({
      id: 'train1',
      name: 'Training Court',
      supertype: 'TRAINER',
      subtypes: ['Stadium']
    }), 3, '10'),
    
    createDeckCard(createCard({
      id: 'switch2',
      name: 'Switch',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 3, '11'),
    
    createDeckCard(createCard({
      id: 'cape1',
      name: 'Cape of Toughness',
      supertype: 'TRAINER',
      subtypes: ['Tool']
    }), 2, '12'),
    
    // Energy (16)
    createDeckCard(createCard({
      id: 'psychic1',
      name: 'Psychic Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 13, '13'),
    
    createDeckCard(createCard({
      id: 'twin2',
      name: 'Twin Energy',
      supertype: 'ENERGY',
      subtypes: ['Special']
    }), 3, '14'),
  ],
  expectedIssues: [],
  expectedScore: {
    min: 70,
    max: 85,
    reason: 'Valid 4-0-3 line with Rare Candy should not be penalized'
  },
  knownGoodFeatures: [
    'Valid 4-0-3 evolution line with Rare Candy',
    'Psychic Embrace energy acceleration',
    'Good draw/search engine',
    'Adequate energy count'
  ],
  meta: {
    archetype: 'Gardevoir ex',
    tier: 2
  }
};

// Ability-dependent deck
export const abilityDependentDeck: TestDeck = {
  id: 'ability-vikavolt',
  name: 'Vikavolt Acceleration Deck',
  description: 'Tests detection of ability-based energy acceleration',
  category: 'ability-dependent',
  cards: [
    createDeckCard(createCard({
      id: 'vik1',
      name: 'Vikavolt',
      supertype: 'POKEMON',
      subtypes: ['Stage 2'],
      evolvesFrom: 'Charjabug',
      hp: '150',
      abilities: [{
        name: 'Strong Charge',
        text: 'Once during your turn, you may search your deck for a Grass Energy card and a Lightning Energy card and attach them to your Pokemon in any way you like.',
        type: 'Ability'
      }]
    }), 3, '1'),
    
    createDeckCard(createCard({
      id: 'char1',
      name: 'Charjabug',
      supertype: 'POKEMON',
      subtypes: ['Stage 1'],
      evolvesFrom: 'Grubbin',
      hp: '80'
    }), 2, '2'),
    
    createDeckCard(createCard({
      id: 'grub1',
      name: 'Grubbin',
      supertype: 'POKEMON',
      subtypes: ['Basic'],
      hp: '60'
    }), 4, '3'),
    
    createDeckCard(createCard({
      id: 'ray1',
      name: 'Rayquaza GX',
      supertype: 'POKEMON',
      subtypes: ['GX', 'Basic'],
      hp: '180',
      attacks: [{
        name: 'Dragon Break',
        cost: ['Grass', 'Lightning'],
        damage: '30x'
      }]
    }), 3, '4'),
    
    // Rest of deck...
    createDeckCard(createCard({
      id: 'nest2',
      name: 'Nest Ball',
      supertype: 'TRAINER',
      subtypes: ['Item']
    }), 40, '5'),
    
    createDeckCard(createCard({
      id: 'grass1',
      name: 'Grass Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 4, '6'),
    
    createDeckCard(createCard({
      id: 'light1',
      name: 'Lightning Energy',
      supertype: 'ENERGY',
      subtypes: ['Basic']
    }), 4, '7'),
  ],
  expectedIssues: [],
  expectedScore: {
    min: 65,
    max: 80,
    reason: 'Lower energy count is justified by Strong Charge ability'
  },
  knownGoodFeatures: [
    'Strong Charge provides energy acceleration',
    'Energy count appropriate with acceleration',
    'Dual type synergy'
  ]
};

// Export all test decks
export const testDecks: TestDeck[] = [
  charizardExDeck,
  noBasisDeck,
  energyImbalanceDeck,
  evolutionHeavyDeck,
  abilityDependentDeck
];