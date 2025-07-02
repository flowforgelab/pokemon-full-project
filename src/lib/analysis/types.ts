import { Card, Deck, Supertype } from '@prisma/client';

// Core Analysis Types
export interface DeckAnalysisResult {
  deckId: string;
  timestamp: Date;
  consistency: ConsistencyAnalysis;
  synergy: SynergyAnalysis;
  meta: MetaGameAnalysis;
  speed: SpeedAnalysis;
  matchups: MatchupAnalysis[];
  archetype: ArchetypeClassification;
  performance: PerformancePrediction;
  scores: DeckScores;
  recommendations: Recommendation[];
  warnings: AnalysisWarning[];
  deckInfo?: DeckComposition;
}

export interface DeckComposition {
  totalCards: number;
  uniqueCards: number;
  quantityDistribution: Record<number, number>;
  cardsByQuantity: Array<{
    name: string;
    quantity: number;
    type: string;
  }>;
  energyBreakdown: {
    basic: number;
    special: number;
    total: number;
  };
}

// Consistency Analysis
export interface ConsistencyAnalysis {
  energyRatio: EnergyRatioAnalysis;
  trainerDistribution: TrainerDistribution;
  pokemonRatio: PokemonRatioAnalysis;
  deckCurve: DeckCurveAnalysis;
  mulliganProbability: number;
  setupProbabilities: SetupProbability[];
  deadDrawProbability: number;
  prizeCardImpact: PrizeCardImpact;
  overallConsistency: number; // 0-100
}

export interface EnergyRatioAnalysis {
  totalEnergy: number;
  basicEnergy: number;
  specialEnergy: number;
  energySearch: number;
  energyPercentage: number;
  recommendedRange: { min: number; max: number };
  isOptimal: boolean;
}

export interface TrainerDistribution {
  totalTrainers: number;
  drawPower: number;
  search: number;
  disruption: number;
  utility: number;
  stadiums: number;
  tools: number;
  supporters: number;
  items: number;
  balance: { [category: string]: boolean };
}

export interface PokemonRatioAnalysis {
  totalPokemon: number;
  basics: number;
  evolutions: number;
  attackers: number;
  support: number;
  evolutionLines: EvolutionLine[];
  pokemonBalance: boolean;
}

export interface EvolutionLine {
  basePokemon: string;
  stage1: string[];
  stage2: string[];
  completeness: number;
  consistency: number;
}

export interface DeckCurveAnalysis {
  averageEnergyCost: number;
  energyDistribution: Map<number, number>;
  peakEnergyCost: number;
  energyEfficiency: number;
  accelerationNeeded: boolean;
  curve: 'low' | 'balanced' | 'high';
}

export interface SetupProbability {
  turn: number;
  probability: number;
  keyCards: string[];
  scenario: string;
}

export interface PrizeCardImpact {
  keyCardVulnerability: number;
  averageImpact: number;
  criticalCards: string[];
  resilience: number;
}

// Synergy Analysis
export interface SynergyAnalysis {
  typeSynergy: TypeSynergy;
  abilityCombos: AbilityCombo[];
  trainerSynergy: TrainerSynergy[];
  energySynergy: EnergySynergy;
  evolutionSynergy: EvolutionSynergy;
  attackCombos: AttackCombo[];
  overallSynergy: number; // 0-100
  synergyGraph: SynergyNode[];
}

export interface TypeSynergy {
  weaknessCoverage: number;
  resistanceUtilization: number;
  typeBalance: boolean;
  vulnerabilities: string[];
}

export interface AbilityCombo {
  pokemon: string[];
  abilities: string[];
  synergyScore: number;
  description: string;
}

export interface TrainerSynergy {
  cards: string[];
  effect: string;
  synergyScore: number;
  frequency: number;
}

export interface EnergySynergy {
  accelerationMethods: string[];
  energyRecycling: string[];
  efficiency: number;
  consistency: number;
}

export interface EvolutionSynergy {
  supportCards: string[];
  evolutionSpeed: number;
  reliability: number;
}

export interface AttackCombo {
  setupPokemon: string;
  attackerPokemon: string;
  combo: string;
  damage: number;
  setupTurns: number;
}

export interface SynergyNode {
  cardId: string;
  cardName: string;
  connections: SynergyConnection[];
}

export interface SynergyConnection {
  targetId: string;
  strength: number;
  type: 'positive' | 'negative' | 'neutral';
  description: string;
}

// Meta-Game Analysis
export interface MetaGameAnalysis {
  archetypeMatch: string;
  metaPosition: 'tier1' | 'tier2' | 'tier3' | 'rogue';
  popularMatchups: PopularMatchup[];
  counterStrategies: CounterStrategy[];
  weaknesses: MetaWeakness[];
  formatEvaluation: FormatEvaluation;
  rotationImpact: RotationImpact;
  techRecommendations: TechCardRecommendation[];
}

export interface PopularMatchup {
  opponentArchetype: string;
  winRate: number;
  keyFactors: string[];
  strategy: string;
}

export interface CounterStrategy {
  targetArchetype: string;
  cards: string[];
  effectiveness: number;
}

export interface MetaWeakness {
  weakness: string;
  severity: 'low' | 'medium' | 'high';
  commonExploits: string[];
}

export interface FormatEvaluation {
  format: 'standard' | 'expanded';
  viability: number;
  legalityIssues: string[];
  formatSpecificStrengths: string[];
}

export interface RotationImpact {
  cardsRotating: string[];
  impactScore: number;
  replacementSuggestions: { [cardId: string]: string[] };
}

export interface TechCardRecommendation {
  card: string;
  reason: string;
  matchupImprovements: string[];
  slot: number; // How many to include
}

// Speed Analysis
export interface SpeedAnalysis {
  averageSetupTurn: number;
  energyAttachmentEfficiency: number;
  drawPowerRating: number;
  searchEffectiveness: number;
  firstTurnAdvantage: number;
  prizeRaceSpeed: PrizeRaceAnalysis;
  recoverySpeed: number;
  lateGameSustainability: number;
  overallSpeed: 'slow' | 'medium' | 'fast' | 'turbo';
}

export interface PrizeRaceAnalysis {
  averagePrizesPerTurn: number;
  damageOutput: number;
  ohkoCapability: boolean;
  twoHitKoReliability: number;
  comebackPotential: number;
}

// Matchup Analysis
export interface MatchupAnalysis {
  opponentDeck: string;
  winRate: number;
  typeAdvantage: number;
  speedComparison: 'slower' | 'even' | 'faster';
  prizeTradeFavorability: number;
  keyCards: string[];
  strategy: string;
  techOptions: string[];
}

// Archetype Classification
export interface ArchetypeClassification {
  primaryArchetype: DeckArchetype;
  secondaryArchetype?: DeckArchetype;
  confidence: number;
  characteristics: string[];
  playstyle: string;
}

export enum DeckArchetype {
  AGGRO = 'aggro',
  CONTROL = 'control',
  COMBO = 'combo',
  MIDRANGE = 'midrange',
  MILL = 'mill',
  STALL = 'stall',
  TOOLBOX = 'toolbox',
  TURBO = 'turbo',
  SPREAD = 'spread'
}

// Performance Prediction
export interface PerformancePrediction {
  tournamentPerformance: number; // 0-100
  consistencyRating: number; // 1-10
  powerLevel: number; // 1-10
  metaViability: number; // 1-10
  skillCeiling: number; // 1-10
  budgetEfficiency: number; // power per dollar
  futureProofing: number; // 0-100
  learningCurve: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

// Deck Scores
export interface DeckScores {
  overall: number; // 0-100
  consistency: number; // 0-100
  power: number; // 0-100
  speed: number; // 0-100
  versatility: number; // 0-100
  metaRelevance: number; // 0-100
  innovation: number; // 0-100
  difficulty: number; // 0-100
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  strengths: string[];
  weaknesses: string[];
  coreStrategy: string;
  winConditions: string[];
}

// Recommendations
export interface Recommendation {
  type: 'add' | 'remove' | 'replace' | 'adjust';
  priority: 'high' | 'medium' | 'low';
  card?: string;
  targetCard?: string;
  quantity?: number;
  reason: string;
  impact: string;
  alternativeOptions?: string[];
}

export interface AnalysisWarning {
  severity: 'info' | 'warning' | 'error';
  category: string;
  message: string;
  affectedCards?: string[];
  suggestion?: string;
}

// Simulation Types
export interface SimulationConfig {
  iterations: number;
  includeMulligans: boolean;
  trackPrizes: boolean;
  specificScenarios?: SimulationScenario[];
}

export interface SimulationScenario {
  name: string;
  requiredCards: string[];
  turnLimit: number;
  successCondition: (state: GameState) => boolean;
}

export interface SimulationResult {
  scenario: string;
  successRate: number;
  averageTurns: number;
  consistency: number;
  details: SimulationDetail[];
}

export interface SimulationDetail {
  iteration: number;
  success: boolean;
  turns: number;
  keyMoments: string[];
}

export interface GameState {
  turn: number;
  hand: string[];
  bench: string[];
  active: string | null;
  prizes: number;
  energy: number;
  discarded: string[];
}

// Card categorization for analysis
export interface CardCategory {
  id: string;
  name: string;
  supertype: Supertype;
  category: 'energy' | 'draw' | 'search' | 'attacker' | 'support' | 'disruption' | 'utility' | 'stadium' | 'tool';
  subcategory?: string;
  energyCost?: number;
  damage?: number;
  hp?: number;
}

// Analysis configuration
export interface AnalysisConfig {
  format: 'standard' | 'expanded';
  includeRotation: boolean;
  metaDecks?: string[]; // IDs of meta decks to compare against
  customWeights?: AnalysisWeights;
  simulationIterations?: number;
}

export interface AnalysisWeights {
  consistency: number;
  power: number;
  speed: number;
  synergy: number;
  meta: number;
}

// Cache types for performance
export interface AnalysisCache {
  deckId: string;
  analysisResult: DeckAnalysisResult;
  timestamp: Date;
  version: string;
}