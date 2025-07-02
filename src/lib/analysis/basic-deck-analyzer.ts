/**
 * Basic Deck Analyzer for Kids (Ages 6-8) - Version 2
 * 
 * Provides simple, friendly advice about Pokemon TCG decks
 * using language and concepts that young players can understand
 * Now includes specific card replacement recommendations!
 */

import { Card, DeckCard } from '@prisma/client';

export interface KidFriendlyAdvice {
  category: 'great' | 'good' | 'needs-help' | 'oops';
  icon: '🌟' | '👍' | '🤔' | '❌';
  title: string;
  message: string;
  tip?: string;
  fixIt?: string;
  cardsToRemove?: Array<{name: string, reason: string}>;
  cardsToAdd?: Array<{name: string, why: string}>;
}

export interface BasicDeckAnalysis {
  deckScore: number; // 0-100
  scoreEmoji: string;
  overallMessage: string;
  advice: KidFriendlyAdvice[];
  funFact?: string;
  swapSuggestions?: Array<{
    title: string;
    priority: 'high' | 'medium' | 'low';
    remove: Array<{name: string, quantity: number, reason: string}>;
    add: Array<{name: string, quantity: number, why: string, rarity?: string}>;
  }>;
  stepByStepMode?: boolean;
  tradeSuggestions?: Array<{card: string, quantity: number, reason: string}>;
}

/**
 * Analyze deck for kids with simple, encouraging feedback
 */
export function analyzeBasicDeck(cards: Array<DeckCard & { card: Card }>): BasicDeckAnalysis {
  const advice: KidFriendlyAdvice[] = [];
  const swapSuggestions: BasicDeckAnalysis['swapSuggestions'] = [];
  
  // Count different types of cards
  const counts = countCardTypes(cards);
  
  // 1. Check if deck has exactly 60 cards
  const totalCards = cards.reduce((sum, dc) => sum + dc.quantity, 0);
  if (totalCards !== 60) {
    advice.push({
      category: 'oops',
      icon: '❌',
      title: totalCards < 60 ? 'Not Enough Cards!' : 'Too Many Cards!',
      message: `Your deck has ${totalCards} cards, but it needs exactly 60 cards to play!`,
      fixIt: totalCards < 60 
        ? `Add ${60 - totalCards} more cards to your deck.`
        : `Take out ${totalCards - 60} cards from your deck.`
    });
  }
  
  // 2. Check Pokemon balance
  checkPokemonBalance(counts, advice, cards, swapSuggestions);
  
  // 3. Check energy cards
  checkEnergyBalance(cards, counts, advice, swapSuggestions);
  
  // 4. Check trainer cards
  checkTrainerCards(cards, counts, advice, swapSuggestions);
  
  // 5. Check for evolution problems
  checkEvolutions(cards, advice, swapSuggestions);
  
  // Calculate score
  const score = calculateKidScore(advice);
  
  // Generate trade suggestions for duplicates
  const tradeSuggestions = generateTradeSuggestions(cards);
  
  return {
    deckScore: score,
    scoreEmoji: getScoreEmoji(score),
    overallMessage: getOverallMessage(score, counts.pokemon),
    advice: advice.sort((a, b) => {
      const order = { 'oops': 0, 'needs-help': 1, 'good': 2, 'great': 3 };
      return order[a.category] - order[b.category];
    }),
    funFact: getRandomFunFact(),
    swapSuggestions: swapSuggestions.length > 0 ? swapSuggestions : undefined,
    tradeSuggestions: tradeSuggestions.length > 0 ? tradeSuggestions : undefined
  };
}

/**
 * Count different types of cards
 */
function countCardTypes(cards: Array<DeckCard & { card: Card }>) {
  let pokemon = 0;
  let trainers = 0;
  let energy = 0;
  let basicPokemon = 0;
  
  cards.forEach(dc => {
    const quantity = dc.quantity;
    if (dc.card.supertype === 'POKEMON') {
      pokemon += quantity;
      if (!dc.card.evolvesFrom) {
        basicPokemon += quantity;
      }
    } else if (dc.card.supertype === 'TRAINER') {
      trainers += quantity;
    } else if (dc.card.supertype === 'ENERGY') {
      energy += quantity;
    }
  });
  
  return { pokemon, trainers, energy, basicPokemon };
}

/**
 * Check Pokemon balance
 */
function checkPokemonBalance(
  counts: ReturnType<typeof countCardTypes>,
  advice: KidFriendlyAdvice[],
  cards: Array<DeckCard & { card: Card }>,
  swapSuggestions: BasicDeckAnalysis['swapSuggestions']
) {
  const pokemonCards = cards.filter(dc => dc.card.supertype === 'POKEMON');
  
  // Check total Pokemon count
  if (counts.pokemon < 12) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Need More Pokemon Friends!',
      message: `You only have ${counts.pokemon} Pokemon. Most decks work better with 15-20 Pokemon!`,
      tip: 'Pokemon are your main fighters. Without enough Pokemon, you might not have anyone to battle with!',
      fixIt: 'Add more Pokemon to your deck, especially Basic Pokemon that don\'t evolve from anything.',
      cardsToAdd: [
        { name: 'Basic Pokemon like Pikachu or Charmander', why: 'You need them to start the game!' },
        { name: 'Pokemon that match your Energy types', why: 'So they can use their attacks!' }
      ]
    });
  } else if (counts.pokemon > 25) {
    // Find specific Pokemon to remove
    const toRemove: Array<{name: string, quantity: number, reason: string}> = [];
    const toAdd: Array<{name: string, quantity: number, why: string}> = [];
    
    // Track what we've already suggested to remove
    const alreadySuggested = new Set<string>();
    
    // Prioritize removing 4th copies
    pokemonCards.forEach(dc => {
      if (dc.quantity >= 4 && toRemove.length < 3 && !alreadySuggested.has(dc.card.name)) {
        toRemove.push({
          name: dc.card.name,
          quantity: 1,
          reason: `You have ${dc.quantity}, but 3 is usually enough!`
        });
        alreadySuggested.add(dc.card.name);
      }
    });
    
    // Remove weak Pokemon (but don't duplicate suggestions)
    const weakPokemon = pokemonCards.filter(dc => 
      dc.card.hp && parseInt(dc.card.hp) < 60 && !dc.card.evolvesFrom
    );
    weakPokemon.forEach(dc => {
      if (toRemove.length < 5 && !alreadySuggested.has(dc.card.name)) {
        const removeQty = Math.min(2, dc.quantity);
        toRemove.push({
          name: dc.card.name,
          quantity: removeQty,
          reason: 'This Pokemon has low HP and might get knocked out easily'
        });
        alreadySuggested.add(dc.card.name);
      }
    });
    
    // Add useful trainer cards with rarity info
    toAdd.push(
      { name: "Professor's Research", quantity: 4, why: "Draw 7 new cards!", rarity: "Common - Easy to find!" },
      { name: "Quick Ball", quantity: 4, why: "Find Basic Pokemon fast!", rarity: "Uncommon" },
      { name: "Switch", quantity: 3, why: "Help Pokemon escape from battle!", rarity: "Common - Easy to find!" }
    );
    
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Too Many Pokemon!',
      message: `You have ${counts.pokemon} Pokemon. That\'s a lot! Try using 15-20 Pokemon instead.`,
      tip: 'Too many Pokemon means not enough Trainer cards to help them battle!',
      fixIt: 'Take out some Pokemon and add Trainer cards that help you find Pokemon and draw cards.'
    });
    
    if (toRemove.length > 0) {
      swapSuggestions!.push({
        title: 'Pokemon Balance Fix',
        priority: 'high',
        remove: toRemove,
        add: toAdd
      });
    }
  } else {
    advice.push({
      category: 'good',
      icon: '👍',
      title: 'Good Pokemon Count!',
      message: `You have ${counts.pokemon} Pokemon. That\'s a great amount!`
    });
  }
  
  // Check Basic Pokemon
  if (counts.basicPokemon < 8) {
    advice.push({
      category: 'oops',
      icon: '❌',
      title: 'Need More Basic Pokemon!',
      message: 'You need at least 8-10 Basic Pokemon to start the game!',
      tip: 'Basic Pokemon are the ones that don\'t say "Evolves from" on them.',
      fixIt: 'Add more Basic Pokemon. Look for ones without "Stage 1" or "Stage 2" on the card!',
      cardsToAdd: [
        { name: 'Any Basic Pokemon (no "Evolves from" text)', why: 'You need them to start playing!' }
      ]
    });
  }
}

/**
 * Check energy balance
 */
function checkEnergyBalance(
  cards: Array<DeckCard & { card: Card }>,
  counts: ReturnType<typeof countCardTypes>,
  advice: KidFriendlyAdvice[],
  swapSuggestions: BasicDeckAnalysis['swapSuggestions']
) {
  // Check total energy
  if (counts.energy < 10) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Need More Energy!',
      message: `You only have ${counts.energy} Energy cards. Your Pokemon need energy to attack!`,
      tip: 'Most decks need 12-15 Energy cards to work well.',
      fixIt: 'Add more Basic Energy cards that match your Pokemon\'s types!'
    });
  } else if (counts.energy > 20) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Too Much Energy!',
      message: `You have ${counts.energy} Energy cards. That\'s too many!`,
      tip: 'Too much Energy means you\'ll draw Energy when you need Pokemon or Trainers.',
      fixIt: 'Try using 12-15 Energy cards instead.'
    });
  } else {
    advice.push({
      category: 'good',
      icon: '👍',
      title: 'Good Energy Amount!',
      message: `${counts.energy} Energy cards is perfect!`
    });
  }
  
  // Check energy types
  const energyTypeCount = new Map<string, number>();
  const pokemonTypes = new Set<string>();
  
  cards.forEach(dc => {
    if (dc.card.supertype === 'ENERGY' && dc.card.subtypes?.includes('Basic')) {
      const energyType = dc.card.name.replace(' Energy', '');
      energyTypeCount.set(energyType, (energyTypeCount.get(energyType) || 0) + dc.quantity);
    } else if (dc.card.supertype === 'POKEMON' && dc.card.types) {
      dc.card.types.forEach(type => pokemonTypes.add(type));
    }
  });
  
  if (energyTypeCount.size > 2) {
    // Sort energy types by count
    const sortedTypes = Array.from(energyTypeCount.entries()).sort((a, b) => b[1] - a[1]);
    const keepTypes = sortedTypes.slice(0, 2);
    const removeTypes = sortedTypes.slice(2);
    
    const toRemove = removeTypes.map(([type, count]) => ({
      name: `${type} Energy`,
      quantity: count,
      reason: 'Too many different Energy types makes it hard to attack'
    }));
    
    const toAdd = keepTypes.map(([type]) => ({
      name: `${type} Energy`,
      quantity: 3,
      why: `Focus on ${type} type Pokemon!`
    }));
    
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Too Many Energy Types!',
      message: `You\'re using ${energyTypeCount.size} different types of Energy. That makes it hard to attack!`,
      tip: 'Try to use only 1 or 2 types of Energy so your Pokemon can attack more easily.',
      fixIt: 'Pick your favorite Pokemon type and use mostly that Energy!'
    });
    
    swapSuggestions!.push({
      title: 'Energy Type Fix',
      priority: 'high',
      remove: toRemove,
      add: toAdd
    });
  }
}

/**
 * Check trainer cards
 */
function checkTrainerCards(
  cards: Array<DeckCard & { card: Card }>,
  counts: ReturnType<typeof countCardTypes>,
  advice: KidFriendlyAdvice[],
  swapSuggestions: BasicDeckAnalysis['swapSuggestions']
) {
  // Check total trainers
  if (counts.trainers < 20) {
    const toAdd: Array<{name: string, quantity: number, why: string, rarity?: string}> = [
      { name: "Professor's Research", quantity: 4, why: "Draw 7 cards - super powerful!", rarity: "Common - Easy to find!" },
      { name: "Poke Ball", quantity: 4, why: "Search your deck for Pokemon", rarity: "Common - Easy to find!" },
      { name: "Switch", quantity: 4, why: "Retreat Pokemon for free", rarity: "Common - Easy to find!" },
      { name: "Quick Ball", quantity: 4, why: "Find Basic Pokemon quickly", rarity: "Uncommon" },
      { name: "Ordinary Rod", quantity: 2, why: "Get Pokemon back from discard", rarity: "Uncommon" }
    ];
    
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Need More Trainer Cards!',
      message: 'Trainer cards help you find Pokemon and draw more cards!',
      tip: 'Good Trainer cards to add: Professor\'s Research, Poke Ball, and Switch!',
      fixIt: 'Add more Trainer cards to help your Pokemon battle better.'
    });
    
    // Only suggest swaps if we have too many Pokemon or Energy
    if (counts.pokemon > 20 || counts.energy > 15) {
      const toRemove: Array<{name: string, quantity: number, reason: string}> = [];
      
      if (counts.pokemon > 20) {
        toRemove.push({
          name: "Some Pokemon cards",
          quantity: 5,
          reason: "You have too many Pokemon"
        });
      } else if (counts.energy > 15) {
        toRemove.push({
          name: "Some Energy cards", 
          quantity: 3,
          reason: "You have plenty of Energy"
        });
      }
      
      swapSuggestions!.push({
        title: 'Add Trainer Cards',
        priority: 'medium',
        remove: toRemove,
        add: toAdd.slice(0, 3)
      });
    }
  } else if (counts.trainers > 30) {
    advice.push({
      category: 'good',
      icon: '👍',
      title: 'Lots of Trainers!',
      message: 'You have plenty of Trainer cards to help out!'
    });
  }
  
  // Check for important trainers
  const hasDrawCards = cards.some(dc => 
    dc.card.name.toLowerCase().includes('professor') ||
    dc.card.name.toLowerCase().includes('research') ||
    dc.card.name.toLowerCase().includes('hop')
  );
  
  if (!hasDrawCards) {
    advice.push({
      category: 'oops',
      icon: '❌',
      title: 'Missing Draw Power!',
      message: 'You don\'t have any cards that let you draw more cards!',
      tip: 'Drawing cards is super important to find what you need!',
      fixIt: 'Add Professor\'s Research or other cards that say "Draw"!',
      cardsToAdd: [
        { name: "Professor's Research", why: "Draw 7 cards every turn!" },
        { name: "Hop", why: "Draw 3 cards - good for beginners!" }
      ]
    });
  }
}

/**
 * Check evolution lines
 */
function checkEvolutions(
  cards: Array<DeckCard & { card: Card }>,
  advice: KidFriendlyAdvice[],
  swapSuggestions: BasicDeckAnalysis['swapSuggestions']
) {
  const evolutionProblems: string[] = [];
  const missingBasics: Array<{evolved: string, basic: string, quantity: number}> = [];
  
  // Check each evolution Pokemon
  cards.forEach(dc => {
    if (dc.card.evolvesFrom) {
      const hasBasic = cards.some(other => 
        other.card.name.toLowerCase() === dc.card.evolvesFrom!.toLowerCase()
      );
      
      if (!hasBasic) {
        evolutionProblems.push(
          `You have ${dc.card.name} but no ${dc.card.evolvesFrom} to evolve from!`
        );
        missingBasics.push({
          evolved: dc.card.name,
          basic: dc.card.evolvesFrom,
          quantity: Math.min(dc.quantity + 1, 4)
        });
      }
    }
  });
  
  if (evolutionProblems.length > 0) {
    advice.push({
      category: 'oops',
      icon: '❌',
      title: 'Missing Pokemon to Evolve!',
      message: 'Some of your Pokemon can\'t evolve because you\'re missing their Basic forms!',
      tip: evolutionProblems[0],
      fixIt: 'Add the Basic Pokemon that your evolved Pokemon need!'
    });
    
    if (missingBasics.length > 0) {
      const toAdd = missingBasics.map(missing => ({
        name: missing.basic,
        quantity: missing.quantity,
        why: `Needed to evolve into ${missing.evolved}`
      }));
      
      swapSuggestions!.push({
        title: 'Fix Evolution Lines',
        priority: 'high',
        remove: [],
        add: toAdd
      });
    }
  }
}

/**
 * Calculate kid-friendly score
 */
function calculateKidScore(advice: KidFriendlyAdvice[]): number {
  let score = 100;
  
  advice.forEach(item => {
    switch (item.category) {
      case 'oops':
        score -= 20;
        break;
      case 'needs-help':
        score -= 10;
        break;
      case 'good':
        score += 5;
        break;
      case 'great':
        score += 10;
        break;
    }
  });
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Get emoji for score
 */
function getScoreEmoji(score: number): string {
  if (score >= 90) return '🌟🌟🌟';
  if (score >= 75) return '⭐⭐⭐';
  if (score >= 60) return '⭐⭐';
  if (score >= 40) return '⭐';
  return '💫';
}

/**
 * Get overall message based on score
 */
function getOverallMessage(score: number, pokemonCount: number): string {
  if (score >= 90) {
    return 'Wow! Your deck looks amazing! You\'re ready to be a Pokemon Master!';
  } else if (score >= 75) {
    return 'Great job! Your deck is really good! Just a few small changes would make it even better!';
  } else if (score >= 60) {
    return 'Good start! Your deck has some great Pokemon! Let\'s make a few changes to help them battle better!';
  } else if (score >= 40) {
    return 'Nice Pokemon choices! Let\'s work together to make your deck stronger!';
  } else {
    return 'Every Pokemon Master started somewhere! Let\'s fix a few things to make your deck ready for battle!';
  }
}

/**
 * Get random fun fact
 */
function getRandomFunFact(): string {
  const facts = [
    '💡 Did you know? Pikachu\'s favorite food is ketchup!',
    '💡 Fun fact: There are over 1,000 different Pokemon!',
    '💡 Cool tip: Basic Pokemon are super important - you need one to start every game!',
    '💡 Did you know? The first Pokemon cards came out in 1996!',
    '💡 Pro tip: Drawing extra cards helps you find what you need faster!',
    '💡 Fun fact: Shiny Pokemon cards are extra sparkly and rare!',
    '💡 Remember: Energy cards are like food for your Pokemon\'s attacks!',
    '💡 Cool fact: Some Pokemon can evolve twice to become super strong!',
    '💡 Trainer tip: Having different types of Trainer cards makes your deck more fun!',
    '💡 Did you know? Championship players practice every day, just like Pokemon trainers!'
  ];
  
  return facts[Math.floor(Math.random() * facts.length)];
}

/**
 * Get simple card recommendations for kids
 */
export function getKidFriendlyRecommendations(
  analysis: BasicDeckAnalysis
): string[] {
  const recommendations: string[] = [];
  
  analysis.advice.forEach(advice => {
    if (advice.category === 'oops' || advice.category === 'needs-help') {
      if (advice.fixIt) {
        recommendations.push(advice.fixIt);
      }
    }
  });
  
  // Add some standard good cards for beginners
  if (recommendations.length < 3) {
    recommendations.push('Try adding Professor\'s Research - it lets you draw 7 new cards!');
    recommendations.push('Poke Ball helps you find Pokemon when you need them!');
    recommendations.push('Switch cards help your Pokemon escape from battle!');
  }
  
  return recommendations.slice(0, 5); // Max 5 recommendations
}

/**
 * Get detailed swap recommendations in kid-friendly format
 */
export function getDetailedSwapRecommendations(
  analysis: BasicDeckAnalysis,
  stepByStep: boolean = false
): string[] {
  const swaps: string[] = [];
  
  if (analysis.swapSuggestions) {
    // Sort by priority
    const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    const sortedSuggestions = [...analysis.swapSuggestions].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
    
    // In step-by-step mode, only show the highest priority
    const suggestionsToShow = stepByStep ? sortedSuggestions.slice(0, 1) : sortedSuggestions;
    
    if (stepByStep && sortedSuggestions.length > 1) {
      swaps.push('\n🎯 **Let\'s fix one thing at a time!**');
      swaps.push(`(${sortedSuggestions.length - 1} more fixes available after this one)\n`);
    }
    
    suggestionsToShow.forEach(suggestion => {
      const priorityEmoji = suggestion.priority === 'high' ? '🔴' : 
                           suggestion.priority === 'medium' ? '🟡' : '🟢';
      swaps.push(`\n📋 ${priorityEmoji} **${suggestion.title}**`);
      
      if (suggestion.remove.length > 0) {
        swaps.push('\n❌ Take out these cards:');
        suggestion.remove.forEach(card => {
          swaps.push(`   • ${card.quantity}x ${card.name} - ${card.reason}`);
        });
      }
      
      if (suggestion.add.length > 0) {
        swaps.push('\n✅ Add these cards instead:');
        suggestion.add.forEach(card => {
          let line = `   • ${card.quantity}x ${card.name} - ${card.why}`;
          if (card.rarity) {
            line += ` [${card.rarity}]`;
          }
          swaps.push(line);
        });
      }
    });
  }
  
  return swaps;
}

/**
 * Generate trade suggestions for duplicate cards
 */
function generateTradeSuggestions(
  cards: Array<DeckCard & { card: Card }>
): Array<{card: string, quantity: number, reason: string}> {
  const suggestions: Array<{card: string, quantity: number, reason: string}> = [];
  
  cards.forEach(dc => {
    if (dc.quantity > 4) {
      suggestions.push({
        card: dc.card.name,
        quantity: dc.quantity - 4,
        reason: 'You can only use 4 of the same card in a deck!'
      });
    } else if (dc.quantity === 4 && dc.card.supertype === 'POKEMON' && 
               dc.card.hp && parseInt(dc.card.hp) < 70) {
      suggestions.push({
        card: dc.card.name,
        quantity: 1,
        reason: 'Trade 1 for a stronger Pokemon!'
      });
    }
  });
  
  return suggestions;
}

/**
 * Get trade suggestions in kid-friendly format
 */
export function getKidFriendlyTradeSuggestions(
  analysis: BasicDeckAnalysis
): string[] {
  const trades: string[] = [];
  
  if (analysis.tradeSuggestions && analysis.tradeSuggestions.length > 0) {
    trades.push('\n🤝 **Cards You Could Trade With Friends:**');
    analysis.tradeSuggestions.forEach(suggestion => {
      trades.push(`   • ${suggestion.quantity}x ${suggestion.card} - ${suggestion.reason}`);
    });
    trades.push('\n💡 Trading tip: Look for cards that match your deck\'s type!');
  }
  
  return trades;
}