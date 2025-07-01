import { createInnerTRPCContext } from '@/server/trpc';
import { deckRouter } from '../deck';
import { DeckCategory } from '@prisma/client';
import { TRPCError } from '@trpc/server';

// Mock Prisma
const mockPrismaDeck = {
  create: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
};

const mockPrismaDeckCard = {
  createMany: jest.fn(),
  deleteMany: jest.fn(),
  findMany: jest.fn(),
};

const mockPrismaUser = {
  findUnique: jest.fn(),
};

jest.mock('@/server/db', () => ({
  prisma: {
    deck: mockPrismaDeck,
    deckCard: mockPrismaDeckCard,
    user: mockPrismaUser,
    $transaction: jest.fn((callback) => callback({
      deck: mockPrismaDeck,
      deckCard: mockPrismaDeckCard,
    })),
  },
}));

describe('Deck Router', () => {
  const mockUserId = 'user-123';
  const mockDeckId = 'deck-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a new deck for authenticated user', async () => {
      const mockDeck = {
        id: mockDeckId,
        name: 'Test Deck',
        formatId: 'standard',
        category: DeckCategory.CASUAL,
        userId: mockUserId,
      };

      mockPrismaDeck.create.mockResolvedValue(mockDeck);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = deckRouter.createCaller(ctx);

      const result = await caller.create({
        name: 'Test Deck',
        description: 'A test deck',
        formatId: 'standard',
        category: DeckCategory.CASUAL,
      });

      expect(result).toEqual(mockDeck);
      expect(mockPrismaDeck.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Deck',
          description: 'A test deck',
          formatId: 'standard',
          category: DeckCategory.CASUAL,
          userId: mockUserId,
        },
      });
    });

    it('throws error for unauthenticated user', async () => {
      const ctx = createInnerTRPCContext({ userId: null });
      const caller = deckRouter.createCaller(ctx);

      await expect(
        caller.create({
          name: 'Test Deck',
          description: 'A test deck',
          formatId: 'standard',
          category: DeckCategory.CASUAL,
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('getUserDecks', () => {
    it('returns user decks with pagination', async () => {
      const mockDecks = [
        { id: '1', name: 'Deck 1', cards: [] },
        { id: '2', name: 'Deck 2', cards: [] },
      ];

      mockPrismaDeck.findMany.mockResolvedValue(mockDecks);
      mockPrismaDeck.count.mockResolvedValue(10);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = deckRouter.createCaller(ctx);

      const result = await caller.getUserDecks({
        page: 1,
        limit: 2,
      });

      expect(result).toEqual({
        decks: mockDecks,
        total: 10,
        page: 1,
        totalPages: 5,
      });

      expect(mockPrismaDeck.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        include: {
          cards: {
            include: { card: true },
            orderBy: { position: 'asc' },
          },
          _count: { select: { likes: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 2,
      });
    });
  });

  describe('getById', () => {
    it('returns deck by id', async () => {
      const mockDeck = {
        id: mockDeckId,
        name: 'Test Deck',
        userId: mockUserId,
        user: { id: mockUserId, username: 'testuser' },
        cards: [],
        _count: { likes: 5 },
      };

      mockPrismaDeck.findUnique.mockResolvedValue(mockDeck);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = deckRouter.createCaller(ctx);

      const result = await caller.getById(mockDeckId);

      expect(result).toEqual({
        ...mockDeck,
        isOwner: true,
        isLiked: false,
      });
    });

    it('throws error when deck not found', async () => {
      mockPrismaDeck.findUnique.mockResolvedValue(null);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = deckRouter.createCaller(ctx);

      await expect(caller.getById('invalid-id')).rejects.toThrow('Deck not found');
    });
  });

  describe('update', () => {
    it('updates deck for owner', async () => {
      const mockDeck = {
        id: mockDeckId,
        userId: mockUserId,
        name: 'Updated Deck',
      };

      mockPrismaDeck.findUnique.mockResolvedValue({ id: mockDeckId, userId: mockUserId });
      mockPrismaDeck.update.mockResolvedValue(mockDeck);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = deckRouter.createCaller(ctx);

      const result = await caller.update({
        id: mockDeckId,
        name: 'Updated Deck',
      });

      expect(result).toEqual(mockDeck);
    });

    it('throws error when not deck owner', async () => {
      mockPrismaDeck.findUnique.mockResolvedValue({ id: mockDeckId, userId: 'other-user' });

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = deckRouter.createCaller(ctx);

      await expect(
        caller.update({
          id: mockDeckId,
          name: 'Updated Deck',
        })
      ).rejects.toThrow('You can only edit your own decks');
    });
  });

  describe('saveDeck', () => {
    it('saves deck with cards', async () => {
      const mockCards = [
        { cardId: 'card-1', count: 4 },
        { cardId: 'card-2', count: 2 },
      ];

      mockPrismaDeck.findUnique.mockResolvedValue({ id: mockDeckId, userId: mockUserId });
      mockPrismaDeck.update.mockResolvedValue({ id: mockDeckId });

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = deckRouter.createCaller(ctx);

      const result = await caller.saveDeck({
        deckId: mockDeckId,
        cards: mockCards,
      });

      expect(mockPrismaDeckCard.deleteMany).toHaveBeenCalledWith({
        where: { deckId: mockDeckId },
      });

      expect(mockPrismaDeckCard.createMany).toHaveBeenCalledWith({
        data: [
          { deckId: mockDeckId, cardId: 'card-1', count: 4, position: 0 },
          { deckId: mockDeckId, cardId: 'card-2', count: 2, position: 1 },
        ],
      });
    });
  });

  describe('delete', () => {
    it('deletes deck for owner', async () => {
      mockPrismaDeck.findUnique.mockResolvedValue({ id: mockDeckId, userId: mockUserId });
      mockPrismaDeck.delete.mockResolvedValue({ id: mockDeckId });

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = deckRouter.createCaller(ctx);

      const result = await caller.delete(mockDeckId);

      expect(result).toEqual({ success: true });
      expect(mockPrismaDeck.delete).toHaveBeenCalledWith({
        where: { id: mockDeckId },
      });
    });

    it('throws error when not deck owner', async () => {
      mockPrismaDeck.findUnique.mockResolvedValue({ id: mockDeckId, userId: 'other-user' });

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = deckRouter.createCaller(ctx);

      await expect(caller.delete(mockDeckId)).rejects.toThrow('You can only delete your own decks');
    });
  });
});