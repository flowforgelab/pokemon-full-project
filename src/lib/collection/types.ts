import type { Card, User, UserCollection, Rarity, Supertype, Format } from '@prisma/client';

export interface CollectionCard extends UserCollection {
  card: Card;
}

export interface CollectionDashboard {
  totalCards: number;
  uniqueCards: number;
  totalValue: number;
  valueChange24h: number;
  valueChangePercentage: number;
  recentAdditions: CollectionCard[];
  valueChanges: ValueChange[];
  setCompletion: SetCompletion[];
  topCardsByValue: CollectionCard[];
  collectionStats: CollectionStats;
  upcomingReleases: UpcomingSet[];
  insightsSummary: CollectionInsights;
}

export interface CollectionStats {
  byRarity: Record<Rarity, number>;
  byType: Record<Supertype, number>;
  bySet: SetDistribution[];
  byCondition: Record<CardCondition, number>;
  byFormat: Record<Format, number>;
  valueDistribution: ValueRange[];
  duplicateCount: number;
  tradableCount: number;
  acquisitionTimeline: AcquisitionData[];
}

export interface ValueChange {
  cardId: string;
  cardName: string;
  previousValue: number;
  currentValue: number;
  changeAmount: number;
  changePercentage: number;
  timestamp: Date;
}

export interface SetCompletion {
  setId: string;
  setName: string;
  totalCards: number;
  ownedCards: number;
  completionPercentage: number;
  missingCards: string[];
  estimatedCompletionCost: number;
}

export interface SetDistribution {
  setId: string;
  setName: string;
  count: number;
  value: number;
}

export interface ValueRange {
  label: string;
  min: number;
  max: number;
  count: number;
  totalValue: number;
}

export interface AcquisitionData {
  date: Date;
  cardsAdded: number;
  totalSpent: number;
  source: AcquisitionSource;
}

export interface UpcomingSet {
  id: string;
  name: string;
  releaseDate: Date;
  totalCards: number;
  keyCards: Card[];
}

export interface CollectionInsights {
  spendingTrend: 'increasing' | 'stable' | 'decreasing';
  topGrowthCards: Card[];
  undervaluedCards: Card[];
  duplicateOptimization: DuplicateRecommendation[];
  collectionHealth: number; // 0-100 score
  diversificationScore: number; // 0-100 score
  investmentROI: number; // percentage
}

export interface DuplicateRecommendation {
  card: Card;
  ownedQuantity: number;
  recommendedQuantity: number;
  potentialValue: number;
  reason: string;
}

export enum CardCondition {
  MINT = 'MINT',
  NEAR_MINT = 'NEAR_MINT',
  LIGHTLY_PLAYED = 'LIGHTLY_PLAYED',
  MODERATELY_PLAYED = 'MODERATELY_PLAYED',
  HEAVILY_PLAYED = 'HEAVILY_PLAYED',
  DAMAGED = 'DAMAGED'
}

export enum AcquisitionSource {
  PURCHASE = 'PURCHASE',
  TRADE = 'TRADE',
  GIFT = 'GIFT',
  PACK_OPENING = 'PACK_OPENING',
  TOURNAMENT_PRIZE = 'TOURNAMENT_PRIZE',
  OTHER = 'OTHER'
}

export enum StorageLocation {
  BINDER = 'BINDER',
  BOX = 'BOX',
  DECK = 'DECK',
  DISPLAY = 'DISPLAY',
  SAFE = 'SAFE',
  OTHER = 'OTHER'
}

export interface CollectionSearchFilters {
  text?: string;
  sets?: string[];
  types?: Supertype[];
  rarities?: Rarity[];
  formats?: Format[];
  energyCost?: { min: number; max: number };
  hp?: { min: number; max: number };
  owned?: boolean;
  conditions?: CardCondition[];
  quantities?: { min: number; max: number };
  acquisitionDate?: { start: Date; end: Date };
  value?: { min: number; max: number };
  tradable?: boolean;
  inDeck?: boolean;
  tags?: string[];
  storageLocations?: StorageLocation[];
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: CollectionSearchFilters;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
}

export interface SearchSuggestion {
  type: 'card' | 'set' | 'type' | 'ability' | 'tag';
  value: string;
  displayText: string;
  count?: number;
}

export interface WantListItem {
  id: string;
  userId: string;
  cardId: string;
  card: Card;
  priority: number; // 1-10
  maxPrice?: number;
  quantity: number;
  notes?: string;
  dateAdded: Date;
  priceAlerts: PriceAlert[];
}

export interface PriceAlert {
  id: string;
  threshold: number;
  type: 'below' | 'above';
  enabled: boolean;
  lastTriggered?: Date;
}

export interface CollectionValue {
  totalValue: number;
  valueByCondition: Record<CardCondition, number>;
  valueBySet: { setId: string; value: number }[];
  valueHistory: ValueHistoryPoint[];
  topValueCards: { card: Card; value: number; quantity: number }[];
  insuranceValue: number; // Conservative estimate for insurance
}

export interface ValueHistoryPoint {
  date: Date;
  totalValue: number;
  cardCount: number;
  averageCardValue: number;
}

export interface TradeBinderConfig {
  includeConditions: CardCondition[];
  minValue?: number;
  maxValue?: number;
  includeSets?: string[];
  excludeSets?: string[];
  sortBy: 'value' | 'name' | 'set' | 'rarity';
  groupBy?: 'set' | 'type' | 'rarity';
  includeWantList: boolean;
  privacyLevel: 'public' | 'friends' | 'private';
}

export interface CollectionImportData {
  format: 'csv' | 'json' | 'tcgdb' | 'deckbox' | 'other';
  data: string | File;
  mappings?: FieldMapping[];
  options: ImportOptions;
}

export interface FieldMapping {
  sourceField: string;
  targetField: keyof CollectionCard;
  transform?: (value: any) => any;
}

export interface ImportOptions {
  updateExisting: boolean;
  skipDuplicates: boolean;
  validatePrices: boolean;
  dryRun: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
  preview?: CollectionCard[];
}

export interface ImportError {
  row: number;
  field: string;
  value: any;
  error: string;
}

export interface CollectionBackup {
  id: string;
  userId: string;
  createdAt: Date;
  cardCount: number;
  totalValue: number;
  format: 'json' | 'csv';
  compressed: boolean;
  size: number;
  downloadUrl?: string;
}

export interface QuickAddItem {
  cardName: string;
  setCode?: string;
  quantity: number;
  condition: CardCondition;
  purchasePrice?: number;
  source: AcquisitionSource;
  location: StorageLocation;
  notes?: string;
}

export interface BulkAddResult {
  added: CollectionCard[];
  failed: { item: QuickAddItem; error: string }[];
  totalAdded: number;
  totalFailed: number;
}

export interface CollectionTag {
  id: string;
  userId: string;
  name: string;
  color: string;
  cardCount: number;
  createdAt: Date;
}

export interface CollectionFolder {
  id: string;
  userId: string;
  name: string;
  description?: string;
  cardIds: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CardNote {
  cardId: string;
  userId: string;
  note: string;
  rating?: number; // 1-5 stars
  memories?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionView {
  type: 'grid' | 'list' | 'gallery' | 'stats' | 'checklist' | 'binder' | 'timeline' | 'value';
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  groupBy?: string;
  filters: CollectionSearchFilters;
  itemsPerPage: number;
}

export interface TradingPartner {
  id: string;
  userId: string;
  partnerId: string;
  partner: User;
  trustLevel: number; // 0-100
  totalTrades: number;
  successfulTrades: number;
  notes?: string;
  lastTradeDate?: Date;
}

export interface TradeMatch {
  partner: TradingPartner;
  theyWant: CollectionCard[];
  youWant: WantListItem[];
  tradeScore: number; // Match quality 0-100
  valueBalance: number; // Positive = in your favor
}

export interface CollectionSearchResult {
  cards: CollectionCard[];
  totalCount: number;
  facets: SearchFacets;
  suggestions: SearchSuggestion[];
  executionTime: number;
}

export interface SearchFacets {
  sets: { value: string; count: number }[];
  types: { value: Supertype; count: number }[];
  rarities: { value: Rarity; count: number }[];
  conditions: { value: CardCondition; count: number }[];
  priceRanges: { range: string; count: number }[];
}

export interface CollectionPerformance {
  totalInvested: number;
  currentValue: number;
  unrealizedGain: number;
  unrealizedGainPercentage: number;
  bestPerformers: PerformanceCard[];
  worstPerformers: PerformanceCard[];
  monthlyPerformance: MonthlyPerformance[];
}

export interface PerformanceCard {
  card: Card;
  purchasePrice: number;
  currentValue: number;
  gain: number;
  gainPercentage: number;
  holdingPeriod: number; // days
}

export interface MonthlyPerformance {
  month: string;
  cardsAdded: number;
  spent: number;
  valueChange: number;
  endingValue: number;
}

export interface CollectionSharingConfig {
  visibility: 'public' | 'unlisted' | 'private';
  showValues: boolean;
  showQuantities: boolean;
  showConditions: boolean;
  showNotes: boolean;
  allowComments: boolean;
  requireAuth: boolean;
  expiresAt?: Date;
}

export interface SharedCollectionView {
  id: string;
  userId: string;
  config: CollectionSharingConfig;
  shareUrl: string;
  qrCode: string;
  views: number;
  createdAt: Date;
}