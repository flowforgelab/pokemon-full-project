/**
 * Deck Coherence Validation System
 * 
 * Identifies fundamental deck construction errors and incoherent strategies
 */

import { Card, DeckCard } from '@prisma/client';

export interface CoherenceIssue {
  severity: 'critical' | 'major' | 'minor';
  category: 'strategy' | 'synergy' | 'energy' | 'typing' | 'format';
  title: string;
  description: string;
  impact: string;
  suggestions: string[];
}

export interface DeckCoherenceAnalysis {
  isCoherent: boolean;
  coherenceScore: number; // 0-100
  primaryStrategy: string | null;
  issues: CoherenceIssue[];
  recommendations: string[];
}

/**
 * Analyze deck coherence and identify fundamental issues
 */
export function analyzeDeckCoherence(
  cards: Array<DeckCard & { card: Card }>
): DeckCoherenceAnalysis {
  const issues: CoherenceIssue[] = [];
  
  // 1. Check for mixed energy types without rainbow support
  const energyTypeIssues = checkEnergyTypeCoherence(cards);
  issues.push(...energyTypeIssues);
  
  // 2. Check for conflicting strategies
  const strategyIssues = checkStrategyCoherence(cards);
  issues.push(...strategyIssues);
  
  // 3. Check for format legality issues
  const formatIssues = checkFormatLegality(cards);
  issues.push(...formatIssues);
  
  // 4. Check for evolution line coherence
  const evolutionIssues = checkEvolutionCoherence(cards);
  issues.push(...evolutionIssues);
  
  // 5. Check for attack cost vs energy coherence
  const costIssues = checkAttackCostCoherence(cards);
  issues.push(...costIssues);
  
  // Calculate coherence score
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const majorCount = issues.filter(i => i.severity === 'major').length;
  const minorCount = issues.filter(i => i.severity === 'minor').length;
  
  const coherenceScore = Math.max(0, 100 - (criticalCount * 30) - (majorCount * 15) - (minorCount * 5));
  
  // Determine primary strategy
  const primaryStrategy = identifyPrimaryStrategy(cards);
  
  return {
    isCoherent: criticalCount === 0 && majorCount <= 1,
    coherenceScore,
    primaryStrategy,
    issues,
    recommendations: generateCoherenceRecommendations(issues, cards)
  };
}

/**
 * Check energy type coherence
 */
function checkEnergyTypeCoherence(cards: Array<DeckCard & { card: Card }>): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];
  
  // Get energy types in deck
  const energyCards = cards.filter(dc => dc.card.supertype === 'ENERGY');
  const basicEnergyTypes = new Set<string>();
  
  energyCards.forEach(dc => {
    if (dc.card.subtypes?.includes('Basic')) {
      const name = dc.card.name.toLowerCase();
      ['lightning', 'fire', 'water', 'grass', 'psychic', 'fighting', 'darkness', 'metal'].forEach(type => {
        if (name.includes(type)) basicEnergyTypes.add(type);
      });
    }
  });
  
  // Get Pokemon types
  const pokemonTypes = new Set<string>();
  const pokemonCards = cards.filter(dc => dc.card.supertype === 'POKEMON');
  
  pokemonCards.forEach(dc => {
    dc.card.types?.forEach(type => pokemonTypes.add(type.toLowerCase()));
  });
  
  // Check for type mismatches
  const hasRainbowEnergy = energyCards.some(dc => 
    dc.card.name.toLowerCase().includes('rainbow') || 
    dc.card.name.toLowerCase().includes('aurora') ||
    dc.card.name.toLowerCase().includes('prism')
  );
  
  if (basicEnergyTypes.size > 2 && !hasRainbowEnergy) {
    issues.push({
      severity: 'major',
      category: 'energy',
      title: 'Too Many Energy Types',
      description: `Deck runs ${basicEnergyTypes.size} different basic energy types without rainbow energy`,
      impact: 'Will have severe consistency issues powering up attackers',
      suggestions: [
        'Focus on 1-2 energy types maximum',
        'Add rainbow/prism energy if running multiple types',
        'Choose Pokemon that share energy requirements'
      ]
    });
  }
  
  // Check if Pokemon types match energy types
  const unusedEnergyTypes: string[] = [];
  basicEnergyTypes.forEach(energyType => {
    const hasMatchingPokemon = pokemonCards.some(dc => {
      // Check if Pokemon uses this energy type
      return dc.card.attacks?.some(attack => 
        attack.cost?.some(cost => cost.toLowerCase().includes(energyType))
      );
    });
    
    if (!hasMatchingPokemon) {
      unusedEnergyTypes.push(energyType);
    }
  });
  
  if (unusedEnergyTypes.length > 0) {
    issues.push({
      severity: 'critical',
      category: 'energy',
      title: 'Unused Energy Types',
      description: `Deck includes ${unusedEnergyTypes.join(', ')} energy but no Pokemon use it`,
      impact: 'Dead cards that serve no purpose',
      suggestions: [
        'Remove unused energy types',
        'Add Pokemon that use these energy types',
        'Replace with useful trainer cards'
      ]
    });
  }
  
  return issues;
}

/**
 * Check strategy coherence
 */
function checkStrategyCoherence(cards: Array<DeckCard & { card: Card }>): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];
  
  // Identify potential strategies
  const hasVMAX = cards.some(dc => dc.card.subtypes?.includes('VMAX'));
  const hasVSTAR = cards.some(dc => dc.card.subtypes?.includes('VSTAR'));
  const hasEx = cards.some(dc => dc.card.name.toLowerCase().includes(' ex'));
  const hasSinglePrizers = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' && 
    !dc.card.subtypes?.some(st => ['V', 'VMAX', 'VSTAR', 'GX', 'EX'].includes(st)) &&
    !dc.card.name.toLowerCase().includes(' ex')
  ).length > 6;
  
  const hasStage2 = cards.some(dc => dc.card.subtypes?.includes('Stage 2'));
  const hasBasicOnlyAttackers = cards.filter(dc => 
    dc.card.supertype === 'POKEMON' && 
    !dc.card.evolvesFrom &&
    dc.card.attacks && dc.card.attacks.length > 0
  ).length > 4;
  
  // Check for conflicting strategies
  if ((hasVMAX || hasVSTAR || hasEx) && hasSinglePrizers) {
    const multiPrizers = cards.filter(dc => 
      dc.card.subtypes?.some(st => ['V', 'VMAX', 'VSTAR'].includes(st)) ||
      dc.card.name.toLowerCase().includes(' ex')
    );
    
    if (multiPrizers.length < 4) {
      issues.push({
        severity: 'major',
        category: 'strategy',
        title: 'Mixed Prize Strategy',
        description: 'Deck mixes multi-prize and single-prize attackers inefficiently',
        impact: 'Neither strategy is fully supported, reducing effectiveness',
        suggestions: [
          'Commit to either multi-prize or single-prize strategy',
          'If mixing, ensure clear roles for each',
          'Add more consistency for your chosen strategy'
        ]
      });
    }
  }
  
  // Check for setup conflicts
  if (hasStage2 && hasBasicOnlyAttackers && !hasRareCandy(cards)) {
    issues.push({
      severity: 'major',
      category: 'strategy',
      title: 'Conflicting Setup Requirements',
      description: 'Deck has both Stage 2 lines and Basic attackers without proper support',
      impact: 'Setup will be inconsistent and slow',
      suggestions: [
        'Add 4 Rare Candy for Stage 2 lines',
        'Choose either evolution or Basic strategy',
        'Add more evolution search cards'
      ]
    });
  }
  
  return issues;
}

/**
 * Check format legality
 */
function checkFormatLegality(cards: Array<DeckCard & { card: Card }>): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];
  
  // List of cards that are Expanded-only (rotated from Standard)
  const expandedOnlyCards = [
    'professor sycamore', 'n', 'lysandre', 'guzma', 'colress',
    'vs seeker', 'battle compressor', 'shaymin-ex', 'tapu lele-gx',
    'sky field', 'dimension valley', 'double colorless energy',
    'max elixir', 'trainers\' mail', 'ultra ball' // Ultra Ball rotated but came back
  ];
  
  const rotatedCards: string[] = [];
  
  cards.forEach(dc => {
    const cardName = dc.card.name.toLowerCase();
    if (expandedOnlyCards.some(expanded => cardName.includes(expanded))) {
      // Special case: Ultra Ball was reprinted
      if (cardName === 'ultra ball' && dc.card.setId?.includes('CRZ')) {
        return; // Crown Zenith reprint is legal
      }
      rotatedCards.push(dc.card.name);
    }
  });
  
  if (rotatedCards.length > 0) {
    issues.push({
      severity: 'critical',
      category: 'format',
      title: 'Format Legality Issue',
      description: `Deck contains Expanded-only cards: ${[...new Set(rotatedCards)].join(', ')}`,
      impact: 'Deck is not legal for Standard format play',
      suggestions: [
        'Replace with Standard-legal alternatives',
        'Professor Sycamore → Professor\'s Research',
        'N → Iono or Judge',
        'VS Seeker → Pal Pad or Super Rod'
      ]
    });
  }
  
  return issues;
}

/**
 * Check evolution line coherence
 */
function checkEvolutionCoherence(cards: Array<DeckCard & { card: Card }>): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];
  
  // Find evolution lines
  const evolutionLines = new Map<string, { basics: number; stage1s: number; stage2s: number }>();
  
  cards.forEach(dc => {
    if (dc.card.supertype === 'POKEMON') {
      let lineName = '';
      
      if (dc.card.subtypes?.includes('Stage 2') && dc.card.evolvesFrom) {
        // For Stage 2, track by the basic form name
        lineName = getBasicFormName(dc.card.name);
      } else if (dc.card.subtypes?.includes('Stage 1') && dc.card.evolvesFrom) {
        lineName = dc.card.evolvesFrom;
      } else if (!dc.card.evolvesFrom && hasEvolution(cards, dc.card.name)) {
        lineName = dc.card.name;
      }
      
      if (lineName) {
        if (!evolutionLines.has(lineName)) {
          evolutionLines.set(lineName, { basics: 0, stage1s: 0, stage2s: 0 });
        }
        
        const line = evolutionLines.get(lineName)!;
        if (dc.card.subtypes?.includes('Stage 2')) {
          line.stage2s += dc.quantity;
        } else if (dc.card.subtypes?.includes('Stage 1')) {
          line.stage1s += dc.quantity;
        } else {
          line.basics += dc.quantity;
        }
      }
    }
  });
  
  // Check each evolution line
  evolutionLines.forEach((line, lineName) => {
    // Stage 2 line checks
    if (line.stage2s > 0) {
      if (line.basics === 0) {
        issues.push({
          severity: 'critical',
          category: 'synergy',
          title: `No Basic Pokemon for ${lineName} Line`,
          description: `Have ${line.stage2s} Stage 2 but no Basic Pokemon`,
          impact: 'Cannot play Stage 2 Pokemon without the Basic',
          suggestions: [
            `Add at least ${line.stage2s + 1} ${lineName}`,
            'Remove the Stage 2 Pokemon',
            'Add Pokemon search cards'
          ]
        });
      } else if (line.stage1s === 0 && !hasRareCandy(cards)) {
        issues.push({
          severity: 'critical',
          category: 'synergy',
          title: `Missing Stage 1 for ${lineName} Line`,
          description: `Have Stage 2 but no Stage 1 and no Rare Candy`,
          impact: 'Cannot evolve to Stage 2',
          suggestions: [
            'Add 4 Rare Candy',
            `Add Stage 1 evolution`,
            'Remove the Stage 2 Pokemon'
          ]
        });
      }
    }
    
    // Stage 1 line checks
    if (line.stage1s > 0 && line.basics === 0) {
      issues.push({
        severity: 'critical',
        category: 'synergy',
        title: `No Basic Pokemon for Stage 1`,
        description: `Have ${line.stage1s} Stage 1 but no Basic to evolve from`,
        impact: 'Cannot play Stage 1 Pokemon',
        suggestions: [
          `Add Basic Pokemon that evolve into this Stage 1`,
          'Remove the Stage 1 Pokemon'
        ]
      });
    }
  });
  
  return issues;
}

/**
 * Check attack cost coherence
 */
function checkAttackCostCoherence(cards: Array<DeckCard & { card: Card }>): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];
  
  // Get energy types in deck
  const availableEnergy = new Set<string>();
  cards.filter(dc => dc.card.supertype === 'ENERGY').forEach(dc => {
    if (dc.card.subtypes?.includes('Special')) {
      // Special energy can provide various types
      if (dc.card.name.toLowerCase().includes('twin') || 
          dc.card.name.toLowerCase().includes('double')) {
        availableEnergy.add('colorless');
      }
    } else {
      // Extract energy type from name
      const name = dc.card.name.toLowerCase();
      ['lightning', 'fire', 'water', 'grass', 'psychic', 'fighting', 'darkness', 'metal'].forEach(type => {
        if (name.includes(type)) availableEnergy.add(type);
      });
    }
  });
  
  // Check each Pokemon's attack costs
  const unmatchedPokemon: string[] = [];
  
  cards.filter(dc => dc.card.supertype === 'POKEMON' && dc.card.attacks?.length).forEach(dc => {
    const canPowerUp = dc.card.attacks!.some(attack => {
      if (!attack.cost || attack.cost.length === 0) return true; // Free attacks
      
      return attack.cost.every(cost => {
        const costType = cost.toLowerCase();
        if (costType === 'colorless') return true; // Any energy works
        return availableEnergy.has(costType);
      });
    });
    
    if (!canPowerUp) {
      unmatchedPokemon.push(dc.card.name);
    }
  });
  
  if (unmatchedPokemon.length > 0) {
    issues.push({
      severity: 'critical',
      category: 'energy',
      title: 'Pokemon Cannot Attack',
      description: `These Pokemon have no matching energy: ${unmatchedPokemon.join(', ')}`,
      impact: 'Pokemon are unplayable without proper energy',
      suggestions: [
        'Add energy types that match attack costs',
        'Replace Pokemon with ones that match your energy',
        'Add Rainbow or Aurora Energy for flexibility'
      ]
    });
  }
  
  return issues;
}

/**
 * Helper functions
 */
function hasRareCandy(cards: Array<DeckCard & { card: Card }>): boolean {
  return cards.some(dc => dc.card.name.toLowerCase().includes('rare candy'));
}

function hasEvolution(cards: Array<DeckCard & { card: Card }>, basicName: string): boolean {
  return cards.some(dc => 
    dc.card.evolvesFrom?.toLowerCase() === basicName.toLowerCase()
  );
}

function getBasicFormName(pokemonName: string): string {
  // Simple heuristic - could be improved with a proper evolution database
  const name = pokemonName.toLowerCase();
  
  // Remove common suffixes
  const suffixes = [' vmax', ' vstar', ' v', ' ex', ' gx', '-ex', '-gx'];
  let baseName = name;
  suffixes.forEach(suffix => {
    if (baseName.endsWith(suffix)) {
      baseName = baseName.slice(0, -suffix.length);
    }
  });
  
  // Common evolution lines
  const evolutionMap: Record<string, string> = {
    'magnezone': 'magnemite',
    'magneton': 'magnemite',
    'charizard': 'charmander',
    'charmeleon': 'charmander',
    'blastoise': 'squirtle',
    'wartortle': 'squirtle',
    'venusaur': 'bulbasaur',
    'ivysaur': 'bulbasaur',
    'gardevoir': 'ralts',
    'kirlia': 'ralts',
    'baxcalibur': 'frigibax',
    'arctibax': 'frigibax'
  };
  
  return evolutionMap[baseName] || baseName;
}

/**
 * Identify primary deck strategy
 */
function identifyPrimaryStrategy(cards: Array<DeckCard & { card: Card }>): string | null {
  const pokemonCards = cards.filter(dc => dc.card.supertype === 'POKEMON');
  
  // Look for key Pokemon that define strategies
  const keyPokemon = pokemonCards.map(dc => dc.card.name.toLowerCase()).join(' ');
  
  if (keyPokemon.includes('charizard ex') && keyPokemon.includes('pidgeot ex')) {
    return 'Charizard ex Control';
  } else if (keyPokemon.includes('lugia vstar') && keyPokemon.includes('archeops')) {
    return 'Lugia VSTAR Turbo';
  } else if (keyPokemon.includes('gardevoir ex')) {
    return 'Gardevoir ex Psychic Embrace';
  } else if (keyPokemon.includes('lost box') || (keyPokemon.includes('comfey') && keyPokemon.includes('sableye'))) {
    return 'Lost Box Toolbox';
  } else if (keyPokemon.includes('miraidon ex')) {
    return 'Miraidon ex Lightning Acceleration';
  } else if (keyPokemon.includes('chien-pao ex') && keyPokemon.includes('baxcalibur')) {
    return 'Chien-Pao ex Water Box';
  }
  
  // Check for generic strategies
  const hasVMAX = pokemonCards.some(dc => dc.card.subtypes?.includes('VMAX'));
  const hasVSTAR = pokemonCards.some(dc => dc.card.subtypes?.includes('VSTAR'));
  const hasEx = pokemonCards.some(dc => dc.card.name.toLowerCase().includes(' ex'));
  
  if (hasVMAX) return 'VMAX Strategy';
  if (hasVSTAR) return 'VSTAR Strategy';
  if (hasEx) return 'Pokemon ex Strategy';
  
  const avgHP = pokemonCards.reduce((sum, dc) => sum + (dc.card.hp || 0), 0) / pokemonCards.length;
  if (avgHP < 100) return 'Single Prize Aggro';
  
  return null;
}

/**
 * Generate recommendations based on coherence issues
 */
function generateCoherenceRecommendations(
  issues: CoherenceIssue[],
  cards: Array<DeckCard & { card: Card }>
): string[] {
  const recommendations: string[] = [];
  
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    recommendations.push('⚠️ Fix critical issues before anything else:');
    criticalIssues.forEach(issue => {
      recommendations.push(`- ${issue.title}: ${issue.suggestions[0]}`);
    });
  }
  
  // General recommendations based on patterns
  if (issues.some(i => i.category === 'energy')) {
    recommendations.push('Consider streamlining your energy types to 1-2 maximum');
  }
  
  if (issues.some(i => i.category === 'strategy')) {
    recommendations.push('Pick a clear win condition and build around it');
  }
  
  if (issues.some(i => i.category === 'format')) {
    recommendations.push('Use the TCGPlayer database to verify card legality');
  }
  
  return recommendations;
}