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
  
  // 1.5 Check format legality and card limits
  checkFormatLegality(cards, advice);
  
  // 2. Check Pokemon balance
  checkPokemonBalance(counts, advice, cards, swapSuggestions);
  
  // 3. Check win conditions
  checkWinConditions(cards, advice);
  
  // 4. Check energy cards
  checkEnergyBalance(cards, counts, advice, swapSuggestions);
  
  // 5. Check trainer cards and consistency
  checkTrainerCards(cards, counts, advice, swapSuggestions);
  
  // 6. Check for evolution problems (ALL lines)
  checkEvolutions(cards, advice, swapSuggestions);
  
  // 7. Check for deck balance issues
  checkDeckBalance(cards, counts, advice);
  
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
 * Check format legality and card limits
 */
function checkFormatLegality(
  cards: Array<DeckCard & { card: Card }>,
  advice: KidFriendlyAdvice[]
) {
  // Check for cards with more than 4 copies (except basic energy)
  const cardCounts = new Map<string, number>();
  const illegalCards: string[] = [];
  
  cards.forEach(dc => {
    const cardName = dc.card.name;
    const isBasicEnergy = dc.card.supertype === 'ENERGY' && 
                          (!dc.card.subtypes || dc.card.subtypes.length === 0 || 
                           dc.card.subtypes.includes('Basic'));
    
    if (!isBasicEnergy) {
      if (dc.quantity > 4) {
        illegalCards.push(`${cardName} (you have ${dc.quantity}, max is 4)`);
      }
    }
    
    // Check for special energy limits
    if (dc.card.supertype === 'ENERGY' && dc.card.subtypes?.includes('Special')) {
      if (dc.quantity > 4) {
        illegalCards.push(`${cardName} Special Energy (you have ${dc.quantity}, max is 4)`);
      }
    }
  });
  
  if (illegalCards.length > 0) {
    advice.push({
      category: 'oops',
      icon: '❌',
      title: 'Too Many Copies!',
      message: 'You can only have 4 copies of any card (except Basic Energy)!',
      tip: illegalCards.join(', '),
      fixIt: 'Reduce these cards to 4 copies maximum.'
    });
  }
  
  // Check for banned cards in Standard format
  const bannedInStandard = ['Lugia VSTAR', 'Forest Seal Stone']; // Example banned cards
  const foundBanned = cards.filter(dc => 
    bannedInStandard.some(banned => dc.card.name.includes(banned))
  );
  
  if (foundBanned.length > 0) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Check Format Rules!',
      message: 'Some cards might not be allowed in Standard format tournaments.',
      tip: `Cards to check: ${foundBanned.map(dc => dc.card.name).join(', ')}`,
      fixIt: 'Make sure all your cards are legal for the format you want to play!'
    });
  }
}

/**
 * Calculate mulligan probability using hypergeometric distribution
 */
function calculateMulliganRate(basicPokemonCount: number): number {
  if (basicPokemonCount === 0) return 100;
  
  // Hypergeometric: probability of drawing 0 basics in 7 cards
  // P(X=0) = C(basics,0) * C(non-basics,7) / C(60,7)
  const nonBasics = 60 - basicPokemonCount;
  
  // Calculate combinations
  function combinations(n: number, k: number): number {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    
    let result = 1;
    for (let i = 0; i < k; i++) {
      result *= (n - i) / (i + 1);
    }
    return result;
  }
  
  const mulliganProb = combinations(nonBasics, 7) / combinations(60, 7);
  return mulliganProb * 100;
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
    
    // Group Pokemon by name to suggest specific replacements
    const pokemonByName = new Map<string, typeof pokemonCards[0]>();
    pokemonCards.forEach(dc => pokemonByName.set(dc.card.name, dc));
    
    // Prioritize removing 4th copies with specific replacement suggestions
    pokemonCards.forEach(dc => {
      if (dc.quantity >= 4 && toRemove.length < 3 && !alreadySuggested.has(dc.card.name)) {
        toRemove.push({
          name: dc.card.name,
          quantity: 1,
          reason: `You have ${dc.quantity}, but 3 is usually enough! Replace with a Trainer card.`
        });
        alreadySuggested.add(dc.card.name);
      }
    });
    
    // Remove weak Pokemon with specific suggestions
    const weakPokemon = pokemonCards.filter(dc => 
      dc.card.hp && parseInt(dc.card.hp) < 60 && !dc.card.evolvesFrom
    );
    
    // Sort weak Pokemon by quantity (remove extras first)
    weakPokemon.sort((a, b) => b.quantity - a.quantity);
    
    weakPokemon.forEach(dc => {
      if (toRemove.length < 5 && !alreadySuggested.has(dc.card.name)) {
        const removeQty = dc.quantity > 2 ? Math.min(2, dc.quantity - 1) : 1;
        toRemove.push({
          name: dc.card.name,
          quantity: removeQty,
          reason: `Low HP (${dc.card.hp}). Replace ${removeQty} with stronger Basic Pokemon or Trainers.`
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
  
  // Check Basic Pokemon and calculate mulligan rate
  const mulliganRate = calculateMulliganRate(counts.basicPokemon);
  
  if (counts.basicPokemon < 8) {
    advice.push({
      category: 'oops',
      icon: '❌',
      title: 'Need More Basic Pokemon!',
      message: `You only have ${counts.basicPokemon} Basic Pokemon! This gives you a ${mulliganRate.toFixed(1)}% chance of no Pokemon in your starting hand!`,
      tip: 'Basic Pokemon are the ones that don\'t say "Evolves from" on them.',
      fixIt: 'Add more Basic Pokemon. Look for ones without "Stage 1" or "Stage 2" on the card!',
      cardsToAdd: [
        { name: 'Any Basic Pokemon (no "Evolves from" text)', why: 'You need them to start playing!' }
      ]
    });
  } else if (counts.basicPokemon >= 8 && counts.basicPokemon < 12) {
    advice.push({
      category: 'good',
      icon: '👍',
      title: 'Decent Basic Pokemon Count',
      message: `You have ${counts.basicPokemon} Basic Pokemon. Your mulligan rate is ${mulliganRate.toFixed(1)}%`,
      tip: 'Having 12+ Basic Pokemon would make your starts even better!'
    });
  } else {
    advice.push({
      category: 'great',
      icon: '🌟',
      title: 'Great Basic Pokemon Count!',
      message: `You have ${counts.basicPokemon} Basic Pokemon. Only ${mulliganRate.toFixed(1)}% chance of mulligan!`
    });
  }
}

/**
 * Check win conditions - do we have Pokemon that can attack?
 */
function checkWinConditions(
  cards: Array<DeckCard & { card: Card }>,
  advice: KidFriendlyAdvice[]
) {
  const pokemonCards = cards.filter(dc => dc.card.supertype === 'POKEMON');
  
  // Find Pokemon with attacks
  const attackers = pokemonCards.filter(dc => 
    dc.card.attacks && dc.card.attacks.length > 0
  );
  
  // Count total attacker cards
  const totalAttackers = attackers.reduce((sum, dc) => sum + dc.quantity, 0);
  
  if (totalAttackers === 0) {
    advice.push({
      category: 'oops',
      icon: '❌',
      title: 'No Pokemon Can Attack!',
      message: 'None of your Pokemon have attacks! You need Pokemon that can battle!',
      fixIt: 'Add Pokemon with attack moves listed on the card.',
      cardsToAdd: [
        { name: 'Any Pokemon with attacks', why: 'To knock out opponent\'s Pokemon!' }
      ]
    });
  } else if (totalAttackers < 6) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Need More Attackers!',
      message: `Only ${totalAttackers} of your Pokemon cards can attack. You need more!`,
      tip: 'Having multiple attackers gives you options during battle.',
      fixIt: 'Add more Pokemon with strong attacks.'
    });
  } else {
    // Check if attacks are strong enough
    const strongAttackers = attackers.filter(dc => {
      const hasStrongAttack = dc.card.attacks?.some(attack => {
        const damage = parseInt(attack.damage || '0');
        return damage >= 60; // Can 2-3 hit KO most Pokemon
      });
      return hasStrongAttack;
    });
    
    const totalStrongAttackers = strongAttackers.reduce((sum, dc) => sum + dc.quantity, 0);
    
    if (totalStrongAttackers < 4) {
      advice.push({
        category: 'needs-help',
        icon: '🤔',
        title: 'Attacks Need More Power!',
        message: 'Your Pokemon\'s attacks might be too weak to win battles quickly.',
        tip: 'Look for Pokemon with attacks that do 60+ damage.',
        fixIt: 'Add Pokemon with stronger attacks or evolution cards to power up.'
      });
    } else {
      advice.push({
        category: 'good',
        icon: '👍',
        title: 'Good Attackers!',
        message: 'Your deck has Pokemon that can battle well!'
      });
    }
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
  // Count specific trainer types for consistency
  let drawSupporters = 0;
  let searchCards = 0;
  let energyAccel = 0;
  
  const trainerCards = cards.filter(dc => dc.card.supertype === 'TRAINER');
  
  trainerCards.forEach(dc => {
    const cardName = dc.card.name.toLowerCase();
    const cardText = (dc.card.rules?.join(' ') || '').toLowerCase();
    
    // Count draw supporters
    if (cardName.includes('professor') || cardName.includes('research') || 
        cardName.includes('cynthia') || cardName.includes('marnie') ||
        cardText.includes('draw')) {
      drawSupporters += dc.quantity;
    }
    
    // Count search cards
    if (cardName.includes('ball') || cardName.includes('search') ||
        cardText.includes('search your deck')) {
      searchCards += dc.quantity;
    }
    
    // Count energy acceleration
    if (cardText.includes('attach') && cardText.includes('energy')) {
      energyAccel += dc.quantity;
    }
  });
  
  // Check draw consistency
  if (drawSupporters < 6) {
    advice.push({
      category: 'oops',
      icon: '❌',
      title: 'Need Draw Power!',
      message: `You only have ${drawSupporters} cards that help you draw. You need at least 6-8!`,
      tip: 'Without draw cards, you\'ll run out of options quickly!',
      fixIt: 'Add Professor\'s Research, Marnie, or other draw supporters.',
      cardsToAdd: [
        { name: "Professor's Research", why: 'Draw 7 cards - the best!' },
        { name: 'Marnie', why: 'Draw 5 and disrupt opponent!' }
      ]
    });
  }
  
  // Check search consistency
  if (searchCards < 4) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Need Pokemon Search!',
      message: `You only have ${searchCards} cards to find Pokemon. Add more!`,
      tip: 'Search cards help you find the Pokemon you need when you need them.',
      fixIt: 'Add Quick Ball, Ultra Ball, or Pokemon Communication.'
    });
  }
  
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
        // Be specific about which Pokemon to remove
        const excessPokemon = Math.min(5, counts.pokemon - 18);
        toRemove.push({
          name: "Excess Pokemon (choose weakest ones)",
          quantity: excessPokemon,
          reason: `You have ${counts.pokemon} Pokemon. Remove ${excessPokemon} to make room for Trainers.`
        });
      } else if (counts.energy > 15) {
        // Be specific about energy removal
        const excessEnergy = Math.min(3, counts.energy - 13);
        toRemove.push({
          name: "Basic Energy cards", 
          quantity: excessEnergy,
          reason: `You have ${counts.energy} Energy. ${13}-15 is usually enough.`
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
  const drawSupporterNames = ['professor', 'research', 'hop', 'cynthia', 'lillie', 'marnie', 
                              'erika', 'bianca', 'shauna', 'tierno', 'sonia', 'bruno'];
  const hasDrawCards = cards.some(dc => {
    const cardName = dc.card.name.toLowerCase();
    return drawSupporterNames.some(supporter => cardName.includes(supporter)) ||
           (dc.card.rules && dc.card.rules.some(rule => 
             rule.toLowerCase().includes('draw') && 
             (rule.toLowerCase().includes('card') || rule.toLowerCase().includes('hand'))
           ));
  });
  
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
  const evolutionLineIssues: Array<{stage2: string, stage1: string, stage2Qty: number, stage1Qty: number}> = [];
  
  // Map to track all evolution lines comprehensively
  const pokemonByName = new Map<string, DeckCard & { card: Card }>();
  cards.forEach(dc => {
    if (dc.card.supertype === 'POKEMON') {
      pokemonByName.set(dc.card.name.toLowerCase(), dc);
    }
  });
  
  // Check EVERY evolution Pokemon
  const evolutionLines = new Map<string, {
    basic?: DeckCard & { card: Card },
    stage1?: DeckCard & { card: Card },
    stage2?: DeckCard & { card: Card },
    lineType: 'single' | 'double'
  }>();
  
  // First pass: identify all evolution Pokemon
  cards.forEach(dc => {
    if (dc.card.supertype !== 'POKEMON') return;
    
    if (dc.card.subtypes?.includes('Stage 2')) {
      // This is a Stage 2, trace back to Basic
      const stage1Name = dc.card.evolvesFrom?.toLowerCase();
      if (stage1Name) {
        const stage1 = pokemonByName.get(stage1Name);
        const basicName = stage1?.card.evolvesFrom?.toLowerCase();
        const basic = basicName ? pokemonByName.get(basicName) : undefined;
        
        const lineKey = basic?.card.name || stage1?.card.name || dc.card.name;
        if (!evolutionLines.has(lineKey)) {
          evolutionLines.set(lineKey, { lineType: 'double' });
        }
        const line = evolutionLines.get(lineKey)!;
        line.stage2 = dc;
        if (stage1) line.stage1 = stage1;
        if (basic) line.basic = basic;
      }
    } else if (dc.card.subtypes?.includes('Stage 1')) {
      // This is a Stage 1
      const basicName = dc.card.evolvesFrom?.toLowerCase();
      if (basicName) {
        const basic = pokemonByName.get(basicName);
        
        // Check if this Stage 1 evolves into a Stage 2
        const evolvesIntoStage2 = Array.from(pokemonByName.values()).some(
          p => p.card.evolvesFrom?.toLowerCase() === dc.card.name.toLowerCase() && 
               p.card.subtypes?.includes('Stage 2')
        );
        
        const lineKey = basic?.card.name || dc.card.name;
        if (!evolutionLines.has(lineKey)) {
          evolutionLines.set(lineKey, { lineType: evolvesIntoStage2 ? 'double' : 'single' });
        }
        const line = evolutionLines.get(lineKey)!;
        line.stage1 = dc;
        if (basic) line.basic = basic;
      }
    }
  });
  
  // Check each evolution line for problems
  let lineNumber = 0;
  evolutionLines.forEach((line, lineKey) => {
    lineNumber++;
    const linePrefix = evolutionLines.size > 1 ? `Evolution Line ${lineNumber}: ` : '';
    
    // Check for missing basics
    if (line.stage1 && !line.basic) {
      evolutionProblems.push(
        `${linePrefix}You have ${line.stage1.card.name} but no ${line.stage1.card.evolvesFrom} to evolve from!`
      );
      missingBasics.push({
        evolved: line.stage1.card.name,
        basic: line.stage1.card.evolvesFrom!,
        quantity: Math.min(line.stage1.quantity + 1, 4)
      });
    }
    
    if (line.stage2 && !line.stage1) {
      evolutionProblems.push(
        `${linePrefix}You have ${line.stage2.card.name} but no ${line.stage2.card.evolvesFrom} to evolve from!`
      );
    }
    
    // Check ratios
    if (line.lineType === 'double' && line.basic && line.stage1 && line.stage2) {
      const basicQty = line.basic.quantity;
      const stage1Qty = line.stage1.quantity;
      const stage2Qty = line.stage2.quantity;
      
      if (stage2Qty > stage1Qty) {
        evolutionLineIssues.push({
          stage2: line.stage2.card.name,
          stage1: line.stage1.card.name,
          stage2Qty: stage2Qty,
          stage1Qty: stage1Qty
        });
      }
      
      if (stage1Qty > basicQty) {
        evolutionProblems.push(
          `${linePrefix}You have ${stage1Qty} ${line.stage1.card.name} but only ${basicQty} ${line.basic.card.name}!`
        );
      }
    } else if (line.lineType === 'single' && line.basic && line.stage1) {
      if (line.stage1.quantity > line.basic.quantity) {
        evolutionProblems.push(
          `${linePrefix}You have ${line.stage1.quantity} ${line.stage1.card.name} but only ${line.basic.quantity} ${line.basic.card.name}!`
        );
      }
    }
  });
  
  // Check each evolution Pokemon for missing basics
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
  
  // Report evolution ratio problems first
  if (evolutionLineIssues.length > 0) {
    const issue = evolutionLineIssues[0];
    advice.push({
      category: 'oops',
      icon: '❌',
      title: 'Evolution Line Imbalanced!',
      message: `You have ${issue.stage2Qty} ${issue.stage2} but only ${issue.stage1Qty} ${issue.stage1}!`,
      tip: 'You need enough Stage 1 Pokemon to evolve into your Stage 2s!',
      fixIt: `Add more ${issue.stage1} or remove some ${issue.stage2}.`
    });
    
    swapSuggestions!.push({
      title: 'Fix Evolution Ratio',
      priority: 'high',
      remove: [{name: issue.stage2, quantity: 1, reason: `You have ${issue.stage2Qty} but only ${issue.stage1Qty} ${issue.stage1}`}],
      add: [{name: issue.stage1, quantity: 1, why: 'Balance your evolution line'}]
    });
  }
  
  // Then report missing basics
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
  
  // Count issues by category
  let oopsCount = 0;
  let needsHelpCount = 0;
  let goodCount = 0;
  
  advice.forEach(item => {
    switch (item.category) {
      case 'oops':
        oopsCount++;
        score -= 15; // Reduced from 20
        break;
      case 'needs-help':
        needsHelpCount++;
        score -= 8; // Reduced from 10
        break;
      case 'good':
        goodCount++;
        score += 3; // Reduced from 5
        break;
      case 'great':
        score += 5; // Reduced from 10
        break;
    }
  });
  
  // Additional penalties for multiple issues
  if (oopsCount >= 2) score -= 10;
  if (needsHelpCount >= 3) score -= 10;
  
  // Cap bonuses from 'good' categories
  const maxGoodBonus = 15;
  const currentGoodBonus = goodCount * 3;
  if (currentGoodBonus > maxGoodBonus) {
    score = score - currentGoodBonus + maxGoodBonus;
  }
  
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
 * Check deck balance and common issues
 */
function checkDeckBalance(
  cards: Array<DeckCard & { card: Card }>,
  counts: ReturnType<typeof countCardTypes>,
  advice: KidFriendlyAdvice[]
) {
  // Check for switch cards
  const hasSwitchCards = cards.some(dc => {
    const cardName = dc.card.name.toLowerCase();
    return cardName.includes('switch') || cardName.includes('guzma') || 
           cardName.includes('tate') || cardName.includes('escape rope');
  });
  
  if (!hasSwitchCards) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Missing Switch Cards!',
      message: 'You need ways to switch your Pokemon when they get stuck!',
      tip: 'If your Active Pokemon gets hurt or can\'t retreat, you\'re stuck!',
      fixIt: 'Add Switch or similar cards to help Pokemon escape.',
      cardsToAdd: [
        { name: 'Switch', why: 'Free retreat for any Pokemon!' },
        { name: 'Escape Rope', why: 'Both players switch - tactical play!' }
      ]
    });
  }
  
  // Check for search cards
  const hasSearchCards = cards.some(dc => {
    const cardName = dc.card.name.toLowerCase();
    return cardName.includes('ball') || cardName.includes('treasure') || 
           cardName.includes('communication') || cardName.includes('fan club');
  });
  
  if (!hasSearchCards) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Need Pokemon Search Cards!',
      message: 'You need ways to find the Pokemon you want!',
      tip: 'Without search cards, you might not draw the Pokemon you need.',
      fixIt: 'Add Poke Ball, Quick Ball, or similar cards.',
      cardsToAdd: [
        { name: 'Quick Ball', why: 'Find any Basic Pokemon fast!' },
        { name: 'Poke Ball', why: 'Search for any Pokemon!' }
      ]
    });
  }
  
  // Check for excessive legendary/rare Pokemon
  const specialPokemon = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' && 
    (dc.card.subtypes?.includes('GX') || dc.card.subtypes?.includes('EX') || 
     dc.card.subtypes?.includes('V') || dc.card.subtypes?.includes('VMAX') ||
     dc.card.subtypes?.includes('Prism Star'))
  );
  const rareCount = specialPokemon.reduce((sum, dc) => sum + dc.quantity, 0);
  
  if (rareCount > 6) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Too Many Special Pokemon!',
      message: `You have ${rareCount} GX/EX/V/Prism Star Pokemon. That\'s a lot!`,
      tip: 'When these get knocked out, your opponent takes 2 or 3 prizes instead of 1!',
      fixIt: 'Mix in some regular Pokemon that only give up 1 prize.',
      cardsToRemove: specialPokemon.slice(0, 2).map(dc => ({
        name: dc.card.name,
        reason: 'Gives up multiple prizes'
      })),
      cardsToAdd: [
        { name: 'Regular Pokemon (1 prize)', why: 'Harder for opponent to win!' }
      ]
    });
  }
  
  // Check for energy acceleration
  const hasEnergyAccel = cards.some(dc => {
    const cardName = dc.card.name.toLowerCase();
    return cardName.includes('patch') || cardName.includes('welder') || 
           cardName.includes('melony') || cardName.includes('elesa') ||
           (dc.card.abilities && dc.card.abilities.some(a => 
             a.text?.toLowerCase().includes('attach') && 
             a.text?.toLowerCase().includes('energy')
           ));
  });
  
  const maxAttackCost = Math.max(...cards
    .filter(dc => dc.card.attacks)
    .map(dc => dc.card.attacks?.reduce((max, attack) => 
      Math.max(max, attack.cost?.length || 0), 0) || 0
    ));
  
  if (maxAttackCost >= 3 && !hasEnergyAccel) {
    advice.push({
      category: 'needs-help',
      icon: '🤔',
      title: 'Slow Energy Setup!',
      message: 'Your Pokemon need 3+ Energy to attack but you can only attach 1 per turn!',
      tip: 'Energy acceleration helps power up big attacks faster.',
      fixIt: 'Add cards that attach extra Energy or search for Energy.',
      cardsToAdd: [
        { name: 'Twin Energy (counts as 2!)', why: 'Powers up attacks faster!' },
        { name: 'Energy Search', why: 'Find the Energy you need!' }
      ]
    });
  }
}

/**
 * Generate trade suggestions for duplicate cards
 */
function generateTradeSuggestions(
  cards: Array<DeckCard & { card: Card }>
): Array<{card: string, quantity: number, reason: string}> {
  const suggestions: Array<{card: string, quantity: number, reason: string}> = [];
  
  cards.forEach(dc => {
    // Basic energy can have unlimited copies
    const isBasicEnergy = dc.card.supertype === 'ENERGY' && 
                         dc.card.subtypes?.includes('Basic');
    
    if (!isBasicEnergy && dc.quantity > 4) {
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