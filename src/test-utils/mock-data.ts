import { 
  Card, 
  Set, 
  User, 
  Deck, 
  DeckCard,
  Rarity, 
  Supertype, 
  DeckCategory, 
  SubscriptionTier, 
  UserRole 
} from '@prisma/client';

// Mock Set
export const mockSet: Set = {
  id: 'base1',
  name: 'Base',
  series: 'Base',
  printedTotal: 102,
  total: 102,
  ptcgoCode: 'BS',
  releaseDate: new Date('1999-01-09'),
  updatedAt: new Date('2023-01-01'),
  images: {
    symbol: 'https://images.pokemontcg.io/base1/symbol.png',
    logo: 'https://images.pokemontcg.io/base1/logo.png',
  },
  isLegalStandard: false,
  isLegalExpanded: false,
  isLegalUnlimited: true,
  createdAt: new Date('2023-01-01'),
};

// Mock Card
export const mockCard: Card = {
  id: 'base1-1',
  name: 'Alakazam',
  supertype: Supertype.POKEMON,
  subtypes: ['Stage 2'],
  level: '42',
  hp: '80',
  types: ['Psychic'],
  evolvesFrom: 'Kadabra',
  evolvesTo: [],
  rules: [],
  ancientTrait: null,
  abilities: [{
    name: 'Damage Swap',
    text: 'As often as you like during your turn (before your attack), you may move 1 damage counter from 1 of your Pokémon to another as long as you don\'t Knock Out that Pokémon. This power can\'t be used if Alakazam is Asleep, Confused, or Paralyzed.',
    type: 'Pokémon Power',
  }],
  attacks: [{
    name: 'Confuse Ray',
    cost: ['Psychic', 'Psychic', 'Psychic'],
    convertedEnergyCost: 3,
    damage: '30',
    text: 'Flip a coin. If heads, the Defending Pokémon is now Confused.',
  }],
  weaknesses: [{
    type: 'Psychic',
    value: '×2',
  }],
  resistances: [],
  retreatCost: ['Colorless', 'Colorless', 'Colorless'],
  convertedRetreatCost: 3,
  number: '1',
  artist: 'Ken Sugimori',
  rarity: Rarity.RARE_HOLO,
  flavorText: 'Its brain can outperform a supercomputer. Its intelligence quotient is said to be 5,000.',
  nationalPokedexNumbers: [65],
  isLegalStandard: false,
  isLegalExpanded: false,
  isLegalUnlimited: true,
  regulationMark: null,
  imageUrlSmall: 'https://images.pokemontcg.io/base1/1.png',
  imageUrlLarge: 'https://images.pokemontcg.io/base1/1_hires.png',
  purchaseUrl: 'https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=Alakazam+Base&view=grid',
  setId: 'base1',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
};

// Mock User
export const mockUser: User = {
  id: 'user-123',
  clerkUserId: 'clerk-123',
  username: 'testuser',
  displayName: 'Test User',
  bio: 'Test bio',
  avatarUrl: 'https://example.com/avatar.jpg',
  role: UserRole.USER,
  subscriptionTier: SubscriptionTier.FREE,
  subscriptionStartDate: null,
  subscriptionEndDate: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  subscriptionStatus: 'ACTIVE',
  onboardingCompleted: true,
  themePreference: 'system',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
};

// Mock Premium User
export const mockPremiumUser: User = {
  ...mockUser,
  id: 'premium-user-123',
  clerkUserId: 'clerk-premium-123',
  username: 'premiumuser',
  displayName: 'Premium User',
  role: UserRole.PREMIUM_USER,
  subscriptionTier: SubscriptionTier.PREMIUM,
  subscriptionStartDate: new Date('2023-01-01'),
  subscriptionEndDate: new Date('2024-01-01'),
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'sub_123',
};

// Mock Admin User
export const mockAdminUser: User = {
  ...mockUser,
  id: 'admin-user-123',
  clerkUserId: 'clerk-admin-123',
  username: 'adminuser',
  displayName: 'Admin User',
  role: UserRole.ADMIN,
  subscriptionTier: SubscriptionTier.ULTIMATE,
};

// Mock Deck
export const mockDeck: Deck = {
  id: 'deck-123',
  userId: 'user-123',
  name: 'Test Deck',
  description: 'A test deck for unit testing',
  formatId: 'standard',
  category: DeckCategory.META,
  tags: ['test', 'mock'],
  isPublic: false,
  likes: 0,
  views: 0,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
};

// Mock DeckCard
export const mockDeckCard: DeckCard = {
  id: 'deck-card-123',
  deckId: 'deck-123',
  cardId: 'base1-1',
  count: 4,
  isPrizeCard: false,
  position: 0,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
};

// Helper function to create multiple mock cards
export const createMockCards = (count: number): Card[] => {
  return Array.from({ length: count }, (_, i) => ({
    ...mockCard,
    id: `base1-${i + 1}`,
    name: `Card ${i + 1}`,
    number: `${i + 1}`,
  }));
};

// Helper function to create a deck with cards
export const createMockDeckWithCards = (cardCount: number = 60): {
  deck: Deck;
  cards: DeckCard[];
} => {
  const cards = Array.from({ length: cardCount }, (_, i) => ({
    ...mockDeckCard,
    id: `deck-card-${i}`,
    cardId: `base1-${Math.floor(i / 4) + 1}`,
    count: 1,
    position: i,
  }));

  return { deck: mockDeck, cards };
};