/**
 * Card Synergy Graph System
 * 
 * Analyzes and visualizes synergies between cards in a deck
 * Creates a graph where nodes are cards and edges are synergy relationships
 */

import { Card, DeckCard } from '@prisma/client';

export interface SynergyNode {
  cardName: string;
  cardType: 'pokemon' | 'trainer' | 'energy';
  quantity: number;
  role: string; // e.g., "attacker", "support", "energy acceleration"
  importance: number; // 0-100, how critical this card is
}

export interface SynergyEdge {
  source: string; // Card name
  target: string; // Card name
  type: SynergyType;
  strength: number; // 0-100, how strong the synergy is
  description: string;
  bidirectional: boolean;
}

export enum SynergyType {
  ENABLES = 'enables', // Source enables target (e.g., Rare Candy → Stage 2)
  SEARCHES = 'searches', // Source searches for target
  ACCELERATES = 'accelerates', // Source accelerates target
  POWERS_UP = 'powers_up', // Source makes target stronger
  PROTECTS = 'protects', // Source protects target
  RECOVERS = 'recovers', // Source recovers target
  COMBOS = 'combos', // Cards work together for effect
  REQUIRES = 'requires' // Source requires target to function
}

export interface SynergyGraph {
  nodes: SynergyNode[];
  edges: SynergyEdge[];
  clusters: CardCluster[]; // Groups of highly synergistic cards
  coreEngine: string[]; // The main cards that make the deck work
  synergyScore: number; // 0-100, overall synergy rating
}

export interface CardCluster {
  name: string; // e.g., "Evolution Line", "Draw Engine"
  cards: string[];
  purpose: string;
  importance: number; // 0-100
}

/**
 * Build a synergy graph from deck cards
 */
export function buildSynergyGraph(
  cards: Array<DeckCard & { card: Card }>
): SynergyGraph {
  const nodes: SynergyNode[] = [];
  const edges: SynergyEdge[] = [];
  
  // Create nodes
  cards.forEach(deckCard => {
    const card = deckCard.card;
    const role = identifyCardRole(card);
    const importance = calculateCardImportance(card, cards);
    
    nodes.push({
      cardName: card.name,
      cardType: card.supertype.toLowerCase() as 'pokemon' | 'trainer' | 'energy',
      quantity: deckCard.quantity,
      role,
      importance
    });
  });
  
  // Detect synergies between all card pairs
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const synergies = detectSynergies(cards[i].card, cards[j].card, cards);
      edges.push(...synergies);
    }
  }
  
  // Identify clusters
  const clusters = identifyClusters(nodes, edges, cards);
  
  // Find core engine
  const coreEngine = identifyCoreEngine(nodes, edges, clusters);
  
  // Calculate overall synergy score
  const synergyScore = calculateSynergyScore(nodes, edges, clusters);
  
  return {
    nodes,
    edges,
    clusters,
    coreEngine,
    synergyScore
  };
}

/**
 * Identify the role of a card in the deck
 */
function identifyCardRole(card: Card): string {
  const name = card.name.toLowerCase();
  
  if (card.supertype === 'POKEMON') {
    if (card.hp && card.hp >= 200) return 'main attacker';
    if (card.abilities && card.abilities.length > 0) return 'ability support';
    if (card.evolvesFrom) return 'evolution';
    if (!card.evolvesFrom && card.attacks) return 'basic attacker';
    return 'pokemon';
  }
  
  if (card.supertype === 'TRAINER') {
    // Categorize trainers
    if (name.includes('professor') || name.includes('research') || name.includes('marnie')) {
      return 'draw support';
    }
    if (name.includes('ball') || name.includes('communication')) {
      return 'pokemon search';
    }
    if (name.includes('boss') || name.includes('guzma')) {
      return 'gust effect';
    }
    if (name.includes('switch') || name.includes('rope')) {
      return 'switch';
    }
    if (name.includes('stadium')) {
      return 'stadium';
    }
    if (name.includes('tool')) {
      return 'tool';
    }
    if (name.includes('candy')) {
      return 'evolution support';
    }
    return 'trainer';
  }
  
  if (card.supertype === 'ENERGY') {
    if (card.subtypes.includes('Special')) return 'special energy';
    return 'basic energy';
  }
  
  return 'unknown';
}

/**
 * Calculate how important a card is to the deck
 */
function calculateCardImportance(
  card: Card,
  allCards: Array<DeckCard & { card: Card }>
): number {
  let importance = 50; // Base importance
  
  // High HP attackers are important
  if (card.supertype === 'POKEMON' && card.hp && card.hp >= 200) {
    importance += 20;
  }
  
  // Cards with abilities are important
  if (card.abilities && card.abilities.length > 0) {
    importance += 15;
  }
  
  // Draw supporters are critical
  if (card.name.toLowerCase().includes("professor's research")) {
    importance = 90;
  }
  
  // Search cards are very important
  if (card.name.toLowerCase().includes('quick ball')) {
    importance = 85;
  }
  
  // Evolution pieces
  if (card.evolvesFrom) {
    // Check if the basic is in the deck
    const hasBasic = allCards.some(dc => dc.card.name === card.evolvesFrom);
    if (hasBasic) importance += 10;
  }
  
  // Energy is fundamental
  if (card.supertype === 'ENERGY') {
    importance = Math.max(importance, 70);
  }
  
  return Math.min(100, importance);
}

/**
 * Detect synergies between two cards
 */
function detectSynergies(
  card1: Card,
  card2: Card,
  allCards: Array<DeckCard & { card: Card }>
): SynergyEdge[] {
  const synergies: SynergyEdge[] = [];
  const name1 = card1.name.toLowerCase();
  const name2 = card2.name.toLowerCase();
  
  // Evolution synergies
  if (card1.evolvesFrom === card2.name) {
    synergies.push({
      source: card2.name,
      target: card1.name,
      type: SynergyType.ENABLES,
      strength: 100,
      description: `${card2.name} evolves into ${card1.name}`,
      bidirectional: false
    });
  }
  
  // Rare Candy synergies
  if (name1.includes('rare candy') && card2.subtypes.includes('Stage 2')) {
    synergies.push({
      source: card1.name,
      target: card2.name,
      type: SynergyType.ACCELERATES,
      strength: 80,
      description: 'Rare Candy allows skipping Stage 1',
      bidirectional: false
    });
  }
  
  // Search synergies
  if (name1.includes('quick ball') && card2.supertype === 'POKEMON' && !card2.evolvesFrom) {
    synergies.push({
      source: card1.name,
      target: card2.name,
      type: SynergyType.SEARCHES,
      strength: 70,
      description: 'Quick Ball searches for Basic Pokemon',
      bidirectional: false
    });
  }
  
  if (name1.includes('ultra ball') && card2.supertype === 'POKEMON') {
    synergies.push({
      source: card1.name,
      target: card2.name,
      type: SynergyType.SEARCHES,
      strength: 60,
      description: 'Ultra Ball searches for any Pokemon',
      bidirectional: false
    });
  }
  
  // Energy acceleration synergies
  if (name1.includes('elesa') && card2.name.includes('Lightning Energy')) {
    synergies.push({
      source: card1.name,
      target: card2.name,
      type: SynergyType.ACCELERATES,
      strength: 75,
      description: "Elesa's Sparkle accelerates Lightning Energy",
      bidirectional: false
    });
  }
  
  // Type-specific synergies
  if (card1.supertype === 'POKEMON' && card2.supertype === 'ENERGY') {
    const pokemonTypes = card1.types || [];
    const energyType = card2.name.replace(' Energy', '');
    
    if (pokemonTypes.includes(energyType)) {
      synergies.push({
        source: card2.name,
        target: card1.name,
        type: SynergyType.POWERS_UP,
        strength: 50,
        description: `${card2.name} powers ${card1.name}'s attacks`,
        bidirectional: false
      });
    }
  }
  
  // Ability synergies
  if (card1.abilities && card1.abilities.length > 0) {
    card1.abilities.forEach(ability => {
      // Genesect V + Fusion Strike Pokemon
      if (ability.name === 'Fusion Strike System' && card2.subtypes.includes('Fusion Strike')) {
        synergies.push({
          source: card1.name,
          target: card2.name,
          type: SynergyType.POWERS_UP,
          strength: 85,
          description: 'Fusion Strike System draws cards for Fusion Strike Pokemon',
          bidirectional: true
        });
      }
      
      // Generic ability synergies
      if (ability.text?.includes('draw') && card2.supertype === 'POKEMON') {
        synergies.push({
          source: card1.name,
          target: card2.name,
          type: SynergyType.ENABLES,
          strength: 40,
          description: `${ability.name} helps set up ${card2.name}`,
          bidirectional: false
        });
      }
    });
  }
  
  // Stadium synergies
  if (card1.subtypes.includes('Stadium')) {
    // Path to the Peak vs V Pokemon
    if (name1.includes('path to the peak') && card2.subtypes.some(st => st === 'V')) {
      synergies.push({
        source: card1.name,
        target: card2.name,
        type: SynergyType.REQUIRES,
        strength: -50, // Negative synergy!
        description: 'Path to the Peak shuts down V abilities',
        bidirectional: false
      });
    }
  }
  
  return synergies;
}

/**
 * Identify clusters of synergistic cards
 */
function identifyClusters(
  nodes: SynergyNode[],
  edges: SynergyEdge[],
  cards: Array<DeckCard & { card: Card }>
): CardCluster[] {
  const clusters: CardCluster[] = [];
  
  // Find evolution lines
  const evolutionLines = new Map<string, string[]>();
  cards.forEach(dc => {
    if (dc.card.evolvesFrom) {
      const baseName = getBasicOfLine(dc.card, cards);
      if (!evolutionLines.has(baseName)) {
        evolutionLines.set(baseName, []);
      }
      evolutionLines.get(baseName)!.push(dc.card.name);
    } else if (dc.card.supertype === 'POKEMON') {
      if (!evolutionLines.has(dc.card.name)) {
        evolutionLines.set(dc.card.name, [dc.card.name]);
      }
    }
  });
  
  evolutionLines.forEach((line, baseName) => {
    if (line.length > 1) {
      clusters.push({
        name: `${baseName} Evolution Line`,
        cards: line,
        purpose: 'Main attacker evolution line',
        importance: 80
      });
    }
  });
  
  // Find draw engine
  const drawCards = nodes
    .filter(n => n.role === 'draw support' || n.cardName.toLowerCase().includes('research'))
    .map(n => n.cardName);
  
  if (drawCards.length >= 2) {
    clusters.push({
      name: 'Draw Engine',
      cards: drawCards,
      purpose: 'Consistent card draw',
      importance: 90
    });
  }
  
  // Find search package
  const searchCards = nodes
    .filter(n => n.role === 'pokemon search')
    .map(n => n.cardName);
  
  if (searchCards.length >= 2) {
    clusters.push({
      name: 'Search Package',
      cards: searchCards,
      purpose: 'Find Pokemon consistently',
      importance: 85
    });
  }
  
  // Find energy package
  const energyCards = nodes
    .filter(n => n.cardType === 'energy')
    .map(n => n.cardName);
  
  const energyAccel = nodes
    .filter(n => n.role === 'energy acceleration')
    .map(n => n.cardName);
  
  if (energyCards.length > 0) {
    clusters.push({
      name: 'Energy System',
      cards: [...energyCards, ...energyAccel],
      purpose: 'Power attacks',
      importance: 75
    });
  }
  
  return clusters;
}

/**
 * Get the basic Pokemon of an evolution line
 */
function getBasicOfLine(
  card: Card,
  allCards: Array<DeckCard & { card: Card }>
): string {
  if (!card.evolvesFrom) return card.name;
  
  const prevEvo = allCards.find(dc => dc.card.name === card.evolvesFrom);
  if (prevEvo) {
    return getBasicOfLine(prevEvo.card, allCards);
  }
  
  return card.evolvesFrom; // Basic not in deck
}

/**
 * Identify the core engine cards
 */
function identifyCoreEngine(
  nodes: SynergyNode[],
  edges: SynergyEdge[],
  clusters: CardCluster[]
): string[] {
  const coreCards: string[] = [];
  
  // High importance cards
  const importantCards = nodes
    .filter(n => n.importance >= 80)
    .sort((a, b) => b.importance - a.importance)
    .map(n => n.cardName);
  
  coreCards.push(...importantCards.slice(0, 3));
  
  // Cards with many strong synergies
  const synergyCount = new Map<string, number>();
  edges.forEach(edge => {
    if (edge.strength >= 70) {
      synergyCount.set(edge.source, (synergyCount.get(edge.source) || 0) + 1);
      synergyCount.set(edge.target, (synergyCount.get(edge.target) || 0) + 1);
    }
  });
  
  const synergisticCards = Array.from(synergyCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([card]) => card);
  
  synergisticCards.forEach(card => {
    if (!coreCards.includes(card)) {
      coreCards.push(card);
    }
  });
  
  return coreCards.slice(0, 5); // Top 5 core cards
}

/**
 * Calculate overall synergy score
 */
function calculateSynergyScore(
  nodes: SynergyNode[],
  edges: SynergyEdge[],
  clusters: CardCluster[]
): number {
  let score = 50; // Base score
  
  // More edges = more synergy
  const strongEdges = edges.filter(e => e.strength >= 60).length;
  score += Math.min(20, strongEdges * 2);
  
  // Negative synergies hurt
  const negativeEdges = edges.filter(e => e.strength < 0).length;
  score -= negativeEdges * 5;
  
  // Complete clusters are good
  const completeEngines = clusters.filter(c => c.importance >= 80).length;
  score += completeEngines * 10;
  
  // High importance cards that work together
  const coreCardSynergies = edges.filter(e => {
    const sourceNode = nodes.find(n => n.cardName === e.source);
    const targetNode = nodes.find(n => n.cardName === e.target);
    return sourceNode?.importance >= 70 && targetNode?.importance >= 70 && e.strength >= 60;
  }).length;
  
  score += Math.min(15, coreCardSynergies * 3);
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Get synergy recommendations
 */
export function getSynergyRecommendations(graph: SynergyGraph): string[] {
  const recommendations: string[] = [];
  
  // Check for isolated high-importance cards
  const isolatedCards = graph.nodes.filter(node => {
    const hasEdges = graph.edges.some(e => 
      e.source === node.cardName || e.target === node.cardName
    );
    return node.importance >= 70 && !hasEdges;
  });
  
  if (isolatedCards.length > 0) {
    recommendations.push(`${isolatedCards[0].cardName} lacks synergy - consider support cards`);
  }
  
  // Check for incomplete evolution lines
  const evolutionClusters = graph.clusters.filter(c => c.name.includes('Evolution'));
  evolutionClusters.forEach(cluster => {
    if (cluster.cards.length === 2) {
      recommendations.push(`${cluster.name} is incomplete - add the missing stage`);
    }
  });
  
  // Check for missing search
  const hasSearch = graph.nodes.some(n => n.role === 'pokemon search');
  if (!hasSearch) {
    recommendations.push('No Pokemon search cards - add Quick Ball or Ultra Ball');
  }
  
  // Check synergy score
  if (graph.synergyScore < 50) {
    recommendations.push('Low overall synergy - cards work independently');
  }
  
  return recommendations;
}