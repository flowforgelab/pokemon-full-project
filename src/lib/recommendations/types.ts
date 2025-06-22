import type { Card, Deck, DeckCard, Rarity, Supertype, Format } from '@prisma/client';
import type { DeckArchetype } from '../analysis/types';

/**
 * Core types for the AI-powered deck recommendation system
 */

// ==================== ARCHETYPE TEMPLATES ====================
export interface ArchetypeTemplate {
  name: string;
  archetype: DeckArchetype;
  strategy: string;
  description: string;
  coreCards: CardRequirement[];
  supportCards: CardSuggestion[];
  energyRequirements: EnergyProfile;
  trainerPackage: TrainerSuite;
  techOptions: TechCard[];
  metaPosition: MetaRating;
  difficultyRating: number; // 1-10 scale
  budgetTier: BudgetTier;
}

export interface CardRequirement {
  cardId: string;
  cardName: string;
  minQuantity: number;
  maxQuantity: number;
  importance: number; // 1-10 scale
  alternatives: AlternativeCard[];
  role: CardRole;
  reasoning: string;
}

export interface AlternativeCard {
  cardId: string;
  cardName: string;
  performanceRatio: number; // 0-1 compared to primary
  priceDifference: number; // negative means cheaper
  synergyScore: number; // 0-1 with rest of deck
}

export interface CardSuggestion {
  cardId: string;
  cardName: string;
  quantity: number;
  priority: 'essential' | 'recommended' | 'optional';
  synergyCards: string[]; // IDs of cards this synergizes with
  role: CardRole;
}

export interface EnergyProfile {
  totalEnergy: number;
  basicEnergy: number;
  specialEnergy: number;
  typeDistribution: Record<string, number>; // type -> count
  curve: EnergyCurve;
}

export interface EnergyCurve {
  oneCost: number;
  twoCost: number;
  threePlusCost: number;
  averageCost: number;
}

export interface TrainerSuite {
  draw: TrainerCard[];
  search: TrainerCard[];
  recovery: TrainerCard[];
  disruption: TrainerCard[];
  stadiums: TrainerCard[];
  tools: TrainerCard[];
}

export interface TrainerCard {
  cardId: string;
  cardName: string;
  quantity: number;
  priority: 'core' | 'flex' | 'tech';
}

export interface TechCard {
  cardId: string;
  cardName: string;
  targetMatchups: string[]; // archetype names
  impactScore: number; // 1-10
  opportunityCost: number; // 1-10
}

export interface MetaRating {
  tier: number; // 1-4
  popularity: number; // 0-100%
  winRate: number; // 0-100%
  representation: number; // tournament %
  trend: 'rising' | 'stable' | 'falling';
}

export enum BudgetTier {
  BUDGET = 'budget', // < $50
  STANDARD = 'standard', // $50-150
  COMPETITIVE = 'competitive', // $150-300
  PREMIUM = 'premium' // $300+
}

export enum CardRole {
  MAIN_ATTACKER = 'main_attacker',
  SECONDARY_ATTACKER = 'secondary_attacker',
  SUPPORT = 'support',
  DRAW_ENGINE = 'draw_engine',
  ENERGY_ACCELERATION = 'energy_acceleration',
  DISRUPTION = 'disruption',
  RECOVERY = 'recovery',
  TECH = 'tech',
  CONSISTENCY = 'consistency'
}

// ==================== RECOMMENDATION TYPES ====================
export interface DeckRecommendation {
  id: string;
  type: RecommendationType;
  timestamp: Date;
  suggestedChanges: CardChange[];
  reasoning: string[];
  expectedImpact: ImpactAnalysis;
  alternativeOptions: AlternativeChange[];
  costAnalysis: CostBreakdown;
  difficultyRating: number; // 1-10
  metaRelevance: number; // 0-100
  confidence: number; // 0-100%
  variant?: DeckVariant;
}

export enum RecommendationType {
  BUILD_FROM_SCRATCH = 'build_from_scratch',
  OPTIMIZE_EXISTING = 'optimize_existing',
  BUDGET_BUILD = 'budget_build',
  COLLECTION_BUILD = 'collection_build',
  META_ADAPTATION = 'meta_adaptation',
  UPGRADE_PATH = 'upgrade_path'
}

export interface CardChange {
  action: 'add' | 'remove' | 'replace';
  card: Card;
  currentCard?: Card; // for replacements
  quantity: number;
  reasoning: string;
  impact: number; // -100 to 100
  synergyChanges: SynergyChange[];
  alternatives?: Card[];
}

export interface SynergyChange {
  affectedCard: string;
  previousSynergy: number;
  newSynergy: number;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface AlternativeChange {
  changes: CardChange[];
  totalImpact: number;
  totalCost: number;
  reasoning: string;
  tradeoffs: string[];
}

export interface ImpactAnalysis {
  overallImprovement: number; // -100 to 100
  consistencyChange: number;
  powerChange: number;
  speedChange: number;
  versatilityChange: number;
  metaRelevanceChange: number;
  specificMatchupChanges: MatchupChange[];
}

export interface MatchupChange {
  archetype: DeckArchetype;
  previousWinRate: number;
  newWinRate: number;
  reasoning: string;
}

export interface CostBreakdown {
  totalCost: number;
  addedCost: number;
  removedValue: number;
  netCost: number;
  costPerCard: CardCost[];
  budgetFriendlyAlternatives: boolean;
}

export interface CardCost {
  card: Card;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  marketTrend: 'rising' | 'stable' | 'falling';
}

// ==================== DECK VARIANTS ====================
export interface DeckVariant {
  name: string;
  type: VariantType;
  description: string;
  changes: CardChange[];
  targetAudience: string;
  pros: string[];
  cons: string[];
  estimatedCost: number;
  difficultyRating: number;
}

export enum VariantType {
  BUDGET = 'budget',
  COMPETITIVE = 'competitive',
  BEGINNER = 'beginner',
  META = 'meta',
  EXPERIMENTAL = 'experimental',
  COLLECTION = 'collection'
}

// ==================== BUILDER CONFIGURATION ====================
export interface BuilderConfig {
  userId: string;
  preferences: BuilderPreferences;
  constraints: BuilderConstraints;
  goals: BuilderGoals;
}

export interface BuilderPreferences {
  favoriteArchetypes: DeckArchetype[];
  avoidArchetypes: DeckArchetype[];
  playstylePreference: 'aggressive' | 'defensive' | 'balanced' | 'combo';
  complexityPreference: 'simple' | 'moderate' | 'complex';
  budgetFlexibility: number; // 0-1 scale
}

export interface BuilderConstraints {
  maxBudget?: number;
  ownedCards?: string[]; // card IDs
  format: Format;
  mustIncludeCards?: string[];
  mustExcludeCards?: string[];
  maxRarity?: Rarity;
  onlyOwnedCards?: boolean;
}

export interface BuilderGoals {
  targetTier: number; // 1-4
  targetMatchups?: DeckArchetype[];
  tournamentPrep?: boolean;
  learningFocus?: boolean;
  innovationDesired?: boolean;
}

// ==================== SYNERGY SYSTEM ====================
export interface SynergyMatrix {
  cardPairs: Map<string, Map<string, SynergyScore>>;
  combos: ComboChain[];
  antiSynergies: AntiSynergy[];
  overallCoherence: number;
}

export interface SynergyScore {
  card1Id: string;
  card2Id: string;
  score: number; // -1 to 1
  type: SynergyType;
  description: string;
  comboRating?: number; // 1-10 for combo potential
}

export enum SynergyType {
  ABILITY = 'ability',
  TYPE = 'type',
  ENERGY = 'energy',
  STRATEGY = 'strategy',
  SEARCH = 'search',
  COMBO = 'combo'
}

export interface ComboChain {
  cards: string[]; // ordered card IDs
  comboType: 'setup' | 'damage' | 'lock' | 'mill' | 'other';
  reliability: number; // 0-1
  impact: number; // 1-10
  description: string;
}

export interface AntiSynergy {
  card1Id: string;
  card2Id: string;
  severity: number; // 1-10
  reasoning: string;
  canCoexist: boolean;
}

// ==================== META INTEGRATION ====================
export interface MetaSnapshot {
  date: Date;
  format: Format;
  topDecks: MetaDeck[];
  emergingDecks: MetaDeck[];
  decliningDecks: MetaDeck[];
  techCards: MetaTech[];
  overallTrends: string[];
}

export interface MetaDeck {
  archetype: DeckArchetype;
  name: string;
  playRate: number; // percentage
  winRate: number; // percentage
  sampleSize: number;
  keyCards: string[];
  weaknesses: DeckArchetype[];
  counters: string[]; // tech card IDs
}

export interface MetaTech {
  cardId: string;
  targets: DeckArchetype[];
  effectiveness: number; // 1-10
  adoptionRate: number; // percentage
  versatility: number; // 1-10
}

// ==================== MACHINE LEARNING TYPES ====================
export interface RecommendationFeedback {
  recommendationId: string;
  userId: string;
  accepted: boolean;
  implemented: CardChange[];
  performanceAfter?: PerformanceMetrics;
  userRating?: number; // 1-5
  comments?: string;
}

export interface PerformanceMetrics {
  winRate: number;
  consistency: number;
  enjoyment: number; // 1-10
  easeOfPlay: number; // 1-10
  matchupsPlayed: MatchupResult[];
}

export interface MatchupResult {
  opponent: DeckArchetype;
  wins: number;
  losses: number;
  notes?: string;
}

export interface LearningPattern {
  pattern: 'card_preference' | 'archetype_success' | 'budget_sensitivity' | 'complexity_preference';
  userId: string;
  data: any; // pattern-specific data
  confidence: number;
  lastUpdated: Date;
}

// ==================== OPTIMIZATION TYPES ====================
export interface OptimizationRequest {
  deck?: Deck & { cards: (DeckCard & { card: Card })[] };
  config: BuilderConfig;
  optimizationGoal: OptimizationGoal;
  acceptableChanges: number; // max number of cards to change
}

export enum OptimizationGoal {
  MAXIMIZE_WIN_RATE = 'maximize_win_rate',
  MINIMIZE_COST = 'minimize_cost',
  IMPROVE_CONSISTENCY = 'improve_consistency',
  COUNTER_META = 'counter_meta',
  BALANCE_ALL = 'balance_all'
}

export interface OptimizationResult {
  originalDeck?: Deck;
  optimizedDeck: Card[];
  changes: CardChange[];
  improvements: ImpactAnalysis;
  cost: CostBreakdown;
  alternatives: DeckVariant[];
  explanation: string[];
}

// ==================== BATCH OPERATIONS ====================
export interface BatchOptimizationRequest {
  decks: (Deck & { cards: (DeckCard & { card: Card })[] })[];
  sharedConfig: BuilderConfig;
  maintainDiversity: boolean;
  sharedCardPool?: boolean; // optimize considering all decks share cards
}

export interface BatchOptimizationResult {
  optimizedDecks: OptimizationResult[];
  sharedCards: string[]; // cards used across multiple decks
  totalCost: number;
  collectionEfficiency: number; // 0-1 scale
}

// ==================== RECOMMENDATION FILTERING ====================
export interface RecommendationFilter {
  priceRange?: { min: number; max: number };
  ownedCardRequirement?: number; // percentage
  formatRestriction?: Format;
  strategyPreferences?: DeckArchetype[];
  complexityLimit?: number; // 1-10
  metaTierRequirement?: number; // 1-4
  excludeCards?: string[];
  includeCards?: string[];
}

// ==================== EXPORT TYPES ====================
export interface RecommendationExport {
  recommendation: DeckRecommendation;
  deck: Card[];
  format: 'json' | 'text' | 'ptcgo' | 'limitless';
  includeAnalysis: boolean;
  includeAlternatives: boolean;
  includePricing: boolean;
}