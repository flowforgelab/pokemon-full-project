/**
 * Basic Deck Analyzer for Kids (Ages 6-8)
 * 
 * Provides simple, friendly advice about Pokemon TCG decks
 * using language and concepts that young players can understand
 */

import { Card, DeckCard } from '@prisma/client';

export interface KidFriendlyAdvice {
  category: 'great' | 'good' | 'needs-help' | 'oops';
  icon: '🌟' | '👍' | '🤔' | '❌';
  title: string;
  message: string;
  tip?: string;
  fixIt?: string;
}

export interface BasicDeckAnalysis {
  deckScore: number; // 0-100
  scoreEmoji: string;
  overallMessage: string;
  advice: KidFriendlyAdvice[];
  funFact?: string;
}

/**
 * Analyze deck for kids with simple, encouraging feedback
 */
export function analyzeBasicDeck(cards: Array<DeckCard & { card: Card }>): BasicDeckAnalysis {
  const advice: KidFriendlyAdvice[] = [];
  
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
  checkPokemonBalance(counts, advice);
  
  // 3. Check energy cards
  checkEnergyBalance(cards, counts, advice);
  
  // 4. Check trainer cards
  checkTrainerCards(cards, counts, advice);
  
  // 5. Check for evolution problems
  checkEvolutions(cards, advice);
  
  // Calculate score
  const score = calculateKidScore(advice);
  
  return {
    deckScore: score,
    scoreEmoji: getScoreEmoji(score),
    overallMessage: getOverallMessage(score, counts.pokemon),
    advice: advice.sort((a, b) => {
      const order = { 'oops': 0, 'needs-help': 1, 'good': 2, 'great': 3 };
      return order[a.category] - order[b.category];
    }),
    funFact: getRandomFunFact()
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
  advice: KidFriendlyAdvice[]
) {
  // Check total Pokemon count
  if (counts.pokemon < 12) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Need More Pokemon Friends!',
      message: `You only have ${counts.pokemon} Pokemon. Most decks work better with 15-20 Pokemon!`,
      tip: 'Pokemon are your main fighters. Without enough Pokemon, you might not have anyone to battle with!',
      fixIt: 'Add more Pokemon to your deck, especially Basic Pokemon that don\'t evolve from anything.'
    });
  } else if (counts.pokemon > 25) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Too Many Pokemon!',
      message: `You have ${counts.pokemon} Pokemon. That\'s a lot! Try using 15-20 Pokemon instead.`,
      tip: 'Too many Pokemon means not enough Trainer cards to help them battle!',
      fixIt: 'Take out some Pokemon and add Trainer cards that help you find Pokemon and draw cards.'
    });
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
      fixIt: 'Add more Basic Pokemon. Look for ones without "Stage 1" or "Stage 2" on the card!'
    });
  }
}

/**
 * Check energy balance
 */
function checkEnergyBalance(
  cards: Array<DeckCard & { card: Card }>,
  counts: ReturnType<typeof countCardTypes>,
  advice: KidFriendlyAdvice[]
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
  const energyTypes = new Set<string>();
  const pokemonTypes = new Set<string>();
  
  cards.forEach(dc => {
    if (dc.card.supertype === 'ENERGY' && dc.card.subtypes?.includes('Basic')) {
      const name = dc.card.name.toLowerCase();
      ['fire', 'water', 'grass', 'lightning', 'psychic', 'fighting', 'darkness', 'metal'].forEach(type => {
        if (name.includes(type)) energyTypes.add(type);
      });
    } else if (dc.card.supertype === 'POKEMON' && dc.card.types) {
      dc.card.types.forEach(type => pokemonTypes.add(type.toLowerCase()));
    }
  });
  
  if (energyTypes.size > 2) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Too Many Energy Types!',
      message: `You\'re using ${energyTypes.size} different types of Energy. That makes it hard to attack!`,
      tip: 'Try to use only 1 or 2 types of Energy so your Pokemon can attack more easily.',
      fixIt: 'Pick your favorite Pokemon type and use mostly that Energy!'
    });
  }
}

/**
 * Check trainer cards
 */
function checkTrainerCards(
  cards: Array<DeckCard & { card: Card }>,
  counts: ReturnType<typeof countCardTypes>,
  advice: KidFriendlyAdvice[]
) {
  // Check total trainers
  if (counts.trainers < 20) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Need More Trainer Cards!',
      message: 'Trainer cards help you find Pokemon and draw more cards!',
      tip: 'Good Trainer cards to add: Professor\'s Research, Poke Ball, and Switch!',
      fixIt: 'Add more Trainer cards to help your Pokemon battle better.'
    });
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
      title: 'Need Cards That Let You Draw!',
      message: 'You need Trainer cards that say "Draw cards" on them!',
      tip: 'Professor\'s Research lets you draw 7 new cards!',
      fixIt: 'Add Professor\'s Research or other cards that let you draw.'
    });
  }
  
  const hasPokeBalls = cards.some(dc => 
    dc.card.name.toLowerCase().includes('ball') ||
    dc.card.name.toLowerCase().includes('nest') ||
    dc.card.name.toLowerCase().includes('net')
  );
  
  if (!hasPokeBalls) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Need Poke Balls!',
      message: 'Poke Ball cards help you find Pokemon in your deck!',
      fixIt: 'Add Poke Ball, Great Ball, or Quick Ball to find Pokemon easier.'
    });
  }
}

/**
 * Check evolution lines
 */
function checkEvolutions(
  cards: Array<DeckCard & { card: Card }>,
  advice: KidFriendlyAdvice[]
) {
  // Group Pokemon by evolution lines
  const evolutionProblems: string[] = [];
  
  cards.forEach(dc => {
    if (dc.card.supertype === 'POKEMON' && dc.card.evolvesFrom) {
      // This Pokemon evolves from something
      const evolvesFrom = dc.card.evolvesFrom;
      const hasBasic = cards.some(other => 
        other.card.name.toLowerCase().includes(evolvesFrom.toLowerCase())
      );
      
      if (!hasBasic) {
        evolutionProblems.push(`${dc.card.name} needs ${evolvesFrom} to evolve!`);
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