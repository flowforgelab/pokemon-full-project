import { Card, Deck, Rarity, Supertype, CardCondition, Format } from '@prisma/client';

// Core deck building types
export interface DeckComposition {
  mainDeck: DeckSection;
  sideboard: DeckSection;
  totalCards: number;
  energyCount: number;
  trainerCount: number;
  pokemonCount: number;
  deckValidation: ValidationResult[];
  format?: Format;
  lastModified: Date;
  deckScore?: number;
}

export interface DeckSection {
  pokemon: CardEntry[];
  trainers: CardEntry[];
  energy: CardEntry[];
  totalCards: number;
}

export interface CardEntry {
  card: Card;
  quantity: number;
  isOwned: boolean;
  ownedQuantity: number;
  price: number;
  alternatives?: Card[];
  position?: number; // For drag-and-drop ordering
}

export interface ValidationResult {
  type: 'error' | 'warning' | 'info';
  message: string;
  cardId?: string;
  rule: ValidationRule;
  suggestion?: string;
}

export enum ValidationRule {
  DECK_SIZE = 'deck_size',
  CARD_LIMIT = 'card_limit',
  FORMAT_LEGALITY = 'format_legality',
  BANNED_CARD = 'banned_card',
  RESTRICTED_CARD = 'restricted_card',
  BASIC_POKEMON_MINIMUM = 'basic_pokemon_minimum',
  ENERGY_BALANCE = 'energy_balance',
  CONSISTENCY = 'consistency',
}

// Search and filtering types
export interface CardSearchFilters {
  text?: string;
  types?: Supertype[];
  sets?: string[];
  rarities?: Rarity[];
  energyCost?: number[];
  hp?: { min?: number; max?: number };
  formatLegality?: string;
  owned?: boolean;
  inCurrentDeck?: boolean;
}

export interface SearchSuggestion {
  type: 'card' | 'category' | 'combo';
  value: string;
  displayName: string;
  preview?: Card;
  relevance: number;
}

// Drag and drop types
export interface DragItem {
  type: 'card' | 'card-group';
  card: Card;
  quantity?: number;
  source: 'search' | 'main-deck' | 'sideboard';
  index?: number;
}

export interface DropZone {
  id: string;
  type: 'main-deck' | 'sideboard' | 'remove';
  accepts: ('card' | 'card-group')[];
  isActive: boolean;
  canDrop: boolean;
}

// Deck statistics types
export interface DeckStatistics {
  energyCurve: EnergyCurveData[];
  typeDistribution: TypeDistribution[];
  trainerBreakdown: TrainerBreakdown;
  pokemonRoles: PokemonRole[];
  rarityDistribution: RarityCount[];
  setDistribution: SetCount[];
  ownedVsNeeded: OwnershipStats;
  priceBreakdown: PriceStats;
  consistencyMetrics: ConsistencyMetrics;
  comparativeAnalysis?: ComparativeStats;
}

export interface EnergyCurveData {
  cost: number;
  count: number;
  percentage: number;
  cards: Card[];
}

export interface TypeDistribution {
  type: string;
  count: number;
  percentage: number;
}

export interface TrainerBreakdown {
  draw: number;
  search: number;
  disruption: number;
  utility: number;
  stadium: number;
  tool: number;
}

export interface PokemonRole {
  role: 'attacker' | 'support' | 'tech' | 'starter';
  count: number;
  cards: Card[];
}

export interface RarityCount {
  rarity: Rarity;
  count: number;
  percentage: number;
}

export interface SetCount {
  setId: string;
  setName: string;
  count: number;
  cards: Card[];
}

export interface OwnershipStats {
  owned: number;
  needed: number;
  ownedValue: number;
  neededValue: number;
  completionPercentage: number;
}

export interface PriceStats {
  totalValue: number;
  ownedValue: number;
  neededValue: number;
  byRarity: { rarity: Rarity; value: number }[];
  mostExpensive: CardEntry[];
  budgetAlternatives: { original: Card; alternatives: Card[] }[];
}

export interface ConsistencyMetrics {
  mulliganProbability: number;
  energyDrawProbability: number;
  keyCombosProbability: { combo: string; probability: number }[];
  setupSpeed: number;
  recoveryPotential: number;
  score: number;
}

export interface ComparativeStats {
  similarDecks: DeckComparison[];
  metaPosition: string;
  strengthsVsWeaknesses: { strengths: string[]; weaknesses: string[] };
  improvementSuggestions: string[];
}

export interface DeckComparison {
  deck: Deck;
  similarity: number;
  winRate?: number;
  popularityRank?: number;
}

// Deck testing types
export interface TestingSession {
  id: string;
  deckId: string;
  startTime: Date;
  hands: SimulatedHand[];
  statistics: TestingStatistics;
}

export interface SimulatedHand {
  cards: Card[];
  mulligan: boolean;
  turnDraws: Card[][];
  prizes: Card[];
  analysis: HandAnalysis;
}

export interface HandAnalysis {
  hasBasicPokemon: boolean;
  energyCount: number;
  setupPotential: number;
  idealTurn1Play?: string;
  problems: string[];
}

export interface TestingStatistics {
  totalHands: number;
  mulliganRate: number;
  averageSetupTurn: number;
  energyDroughtRate: number;
  deadDrawRate: number;
  comboSuccessRate: { [combo: string]: number };
}

// Mobile-specific types
export interface TouchGesture {
  type: 'tap' | 'double-tap' | 'long-press' | 'swipe' | 'pinch';
  target: string;
  action: () => void;
}

export interface MobileMenuOption {
  label: string;
  icon: string;
  action: () => void;
  requiresConfirmation?: boolean;
}

// Collaboration types
export interface DeckCollaborator {
  userId: string;
  username: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer';
  lastActive: Date;
  contributions: number;
}

export interface DeckComment {
  id: string;
  userId: string;
  username: string;
  cardId?: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface DeckVersion {
  id: string;
  versionNumber: number;
  changes: DeckChange[];
  author: string;
  timestamp: Date;
  message?: string;
}

export interface DeckChange {
  type: 'add' | 'remove' | 'modify';
  cardId: string;
  oldQuantity?: number;
  newQuantity?: number;
}

// Smart suggestions types
export interface DeckSuggestion {
  type: 'card' | 'strategy' | 'fix';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  cards?: Card[];
  impact: string;
  implementation?: string[];
}

export interface BuildingPattern {
  userId: string;
  preferences: {
    favoriteTypes: string[];
    budgetRange: { min: number; max: number };
    preferredArchetypes: string[];
    avoidedCards: string[];
  };
  history: {
    recentDecks: string[];
    commonIncludes: { cardId: string; frequency: number }[];
    successfulDecks: string[];
  };
}

// Tutorial types
export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for highlighting
  action?: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  showSkip: boolean;
  requiresAction: boolean;
}

export interface TutorialProgress {
  userId: string;
  completedSteps: string[];
  currentStep?: string;
  skipped: boolean;
  completedAt?: Date;
}

// Accessibility types
export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  keyboardShortcuts: boolean;
  screenReaderOptimized: boolean;
  colorBlindMode?: 'protanopia' | 'deuteranopia' | 'tritanopia';
}

// Performance types
export interface PerformanceMetrics {
  searchLatency: number;
  renderTime: number;
  interactionDelay: number;
  memoryUsage: number;
  cachedImages: number;
}

// Integration types
export interface DeckExportFormat {
  format: 'text' | 'json' | 'ptcgo' | 'pdf' | 'image';
  includeStats: boolean;
  includePrices: boolean;
  includeNotes: boolean;
}

export interface DeckImportResult {
  success: boolean;
  cards: CardEntry[];
  errors: string[];
  warnings: string[];
  format: string;
}

// Error handling types
export interface DeckBuilderError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
  action?: () => void;
}

// State management types
export interface DeckBuilderState {
  deck: DeckComposition;
  filters: CardSearchFilters;
  searchResults: Card[];
  selectedCard?: Card;
  draggedItem?: DragItem;
  validationResults: ValidationResult[];
  statistics?: DeckStatistics;
  testingSession?: TestingSession;
  collaborators: DeckCollaborator[];
  suggestions: DeckSuggestion[];
  isLoading: boolean;
  isSaving: boolean;
  error?: DeckBuilderError;
  undoStack: DeckComposition[];
  redoStack: DeckComposition[];
}

// Component props types
export interface DeckBuilderProps {
  deckId?: string;
  format?: Format;
  template?: string;
  onSave: (deck: DeckComposition) => Promise<void>;
  onCancel: () => void;
  collaborators?: DeckCollaborator[];
  readOnly?: boolean;
  showPrices?: boolean;
  showOwned?: boolean;
}

export interface CardSearchProps {
  filters: CardSearchFilters;
  onFiltersChange: (filters: CardSearchFilters) => void;
  onCardSelect: (card: Card) => void;
  onDragStart?: (item: DragItem) => void;
  showOwned?: boolean;
}

export interface DeckSectionProps {
  section: DeckSection;
  type: 'main-deck' | 'sideboard';
  onCardAdd: (card: Card, quantity: number) => void;
  onCardRemove: (card: Card, quantity: number) => void;
  onCardDrop: (item: DragItem, index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  validation?: ValidationResult[];
  readOnly?: boolean;
}