import { createInnerTRPCContext } from '@/server/trpc';
import { cardRouter } from '../card';

// Simple mock for prisma
const mockPrismaCard = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
};

const mockPrismaSet = {
  findMany: jest.fn(),
};

jest.mock('@/server/db', () => ({
  prisma: {
    card: mockPrismaCard,
    set: mockPrismaSet,
  },
}));

// Mock Redis
jest.mock('@/server/db/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
  getCardCache: jest.fn(),
}));

// Mock queue
jest.mock('@/lib/jobs/queue-wrapper', () => ({
  pokemonTCGQueue: {
    add: jest.fn(),
  },
}));

describe('Card Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getById', () => {
    it('returns a card by ID', async () => {
      const mockCard = {
        id: 'base1-1',
        name: 'Alakazam',
        set: { id: 'base1', name: 'Base' },
        prices: [],
      };

      mockPrismaCard.findUnique.mockResolvedValue(mockCard);

      const ctx = createInnerTRPCContext({ userId: null });
      const caller = cardRouter.createCaller(ctx);
      const result = await caller.getById('base1-1');

      expect(result).toEqual(mockCard);
      expect(mockPrismaCard.findUnique).toHaveBeenCalledWith({
        where: { id: 'base1-1' },
        include: {
          set: true,
          prices: {
            where: { currency: 'USD' },
            orderBy: { updatedAt: 'desc' },
            take: 10,
          },
        },
      });
    });

    it('throws error when card not found', async () => {
      mockPrismaCard.findUnique.mockResolvedValue(null);

      const ctx = createInnerTRPCContext({ userId: null });
      const caller = cardRouter.createCaller(ctx);
      
      await expect(caller.getById('invalid-id')).rejects.toThrow('Card not found');
    });
  });

  describe('getSets', () => {
    it('returns all sets', async () => {
      const mockSets = [
        { id: 'set1', name: 'Set 1', releaseDate: new Date('2023-01-01') },
        { id: 'set2', name: 'Set 2', releaseDate: new Date('2023-06-01') },
      ];
      
      mockPrismaSet.findMany.mockResolvedValue(mockSets);

      const ctx = createInnerTRPCContext({ userId: null });
      const caller = cardRouter.createCaller(ctx);
      const result = await caller.getSets({});

      expect(result).toHaveLength(2);
      expect(mockPrismaSet.findMany).toHaveBeenCalled();
    });
  });
});