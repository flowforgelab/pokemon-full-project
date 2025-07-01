import { createInnerTRPCContext } from '@/server/trpc';
import { userRouter } from '../user';
import { SubscriptionTier, UserRole, NotificationType, PrivacySetting } from '@prisma/client';

// Mock Prisma
const mockPrismaUser = {
  findUnique: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
};

const mockPrismaUserPreferences = {
  upsert: jest.fn(),
  findUnique: jest.fn(),
};

const mockPrismaNotificationPreferences = {
  upsert: jest.fn(),
};

const mockPrismaPrivacySettings = {
  upsert: jest.fn(),
};

jest.mock('@/server/db', () => ({
  prisma: {
    user: mockPrismaUser,
    userPreferences: mockPrismaUserPreferences,
    notificationPreferences: mockPrismaNotificationPreferences,
    privacySettings: mockPrismaPrivacySettings,
  },
}));

// Mock Clerk
jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: jest.fn(() => ({
    users: {
      updateUserMetadata: jest.fn(),
    },
  })),
}));

describe('User Router', () => {
  const mockUserId = 'user-123';
  const mockClerkUserId = 'clerk-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('returns user profile', async () => {
      const mockUser = {
        id: mockUserId,
        clerkUserId: mockClerkUserId,
        username: 'testuser',
        displayName: 'Test User',
        bio: 'Test bio',
        role: UserRole.USER,
        subscriptionTier: SubscriptionTier.FREE,
        preferences: null,
        _count: {
          decks: 5,
          collection: 100,
        },
      };

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = userRouter.createCaller(ctx);

      const result = await caller.getProfile();

      expect(result).toEqual(mockUser);
      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
        include: {
          preferences: true,
          _count: {
            select: {
              decks: true,
              collection: true,
            },
          },
        },
      });
    });

    it('throws error for unauthenticated user', async () => {
      const ctx = createInnerTRPCContext({ userId: null });
      const caller = userRouter.createCaller(ctx);

      await expect(caller.getProfile()).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('updateProfile', () => {
    it('updates user profile', async () => {
      const mockUser = {
        id: mockUserId,
        clerkUserId: mockClerkUserId,
        username: 'newusername',
        displayName: 'New Display Name',
        bio: 'Updated bio',
      };

      mockPrismaUser.findUnique.mockResolvedValue({ id: mockUserId, clerkUserId: mockClerkUserId });
      mockPrismaUser.update.mockResolvedValue(mockUser);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = userRouter.createCaller(ctx);

      const result = await caller.updateProfile({
        username: 'newusername',
        displayName: 'New Display Name',
        bio: 'Updated bio',
      });

      expect(result).toEqual(mockUser);
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          username: 'newusername',
          displayName: 'New Display Name',
          bio: 'Updated bio',
        },
      });
    });

    it('validates username format', async () => {
      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = userRouter.createCaller(ctx);

      await expect(
        caller.updateProfile({
          username: 'invalid username!',
        })
      ).rejects.toThrow();
    });
  });

  describe('updatePreferences', () => {
    it('creates or updates user preferences', async () => {
      const mockPreferences = {
        userId: mockUserId,
        theme: 'dark',
        cardLayout: 'grid',
        autoSave: true,
      };

      mockPrismaUserPreferences.upsert.mockResolvedValue(mockPreferences);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = userRouter.createCaller(ctx);

      const result = await caller.updatePreferences({
        theme: 'dark',
        cardLayout: 'grid',
        autoSave: true,
      });

      expect(result).toEqual(mockPreferences);
      expect(mockPrismaUserPreferences.upsert).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        update: {
          theme: 'dark',
          cardLayout: 'grid',
          autoSave: true,
        },
        create: {
          userId: mockUserId,
          theme: 'dark',
          cardLayout: 'grid',
          autoSave: true,
        },
      });
    });
  });

  describe('updateNotificationPreferences', () => {
    it('updates notification preferences', async () => {
      const mockPreferences = {
        userId: mockUserId,
        type: NotificationType.PRICE_ALERT,
        email: true,
        push: false,
        inApp: true,
      };

      mockPrismaNotificationPreferences.upsert.mockResolvedValue(mockPreferences);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = userRouter.createCaller(ctx);

      const result = await caller.updateNotificationPreferences({
        type: NotificationType.PRICE_ALERT,
        email: true,
        push: false,
        inApp: true,
      });

      expect(result).toEqual(mockPreferences);
    });
  });

  describe('updatePrivacySettings', () => {
    it('updates privacy settings', async () => {
      const mockSettings = {
        userId: mockUserId,
        profileVisibility: PrivacySetting.PUBLIC,
        showCollection: true,
        showDecks: true,
        showStats: false,
      };

      mockPrismaPrivacySettings.upsert.mockResolvedValue(mockSettings);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = userRouter.createCaller(ctx);

      const result = await caller.updatePrivacySettings({
        profileVisibility: PrivacySetting.PUBLIC,
        showCollection: true,
        showDecks: true,
        showStats: false,
      });

      expect(result).toEqual(mockSettings);
    });
  });

  describe('getPublicProfile', () => {
    it('returns public profile for public user', async () => {
      const mockUser = {
        id: 'public-user-123',
        username: 'publicuser',
        displayName: 'Public User',
        bio: 'Public bio',
        privacySettings: {
          profileVisibility: PrivacySetting.PUBLIC,
          showCollection: true,
          showDecks: true,
        },
        _count: {
          decks: 10,
          collection: 200,
        },
      };

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = userRouter.createCaller(ctx);

      const result = await caller.getPublicProfile({ username: 'publicuser' });

      expect(result).toBeDefined();
      expect(result.username).toBe('publicuser');
    });

    it('returns limited data for private profile', async () => {
      const mockUser = {
        id: 'private-user-123',
        username: 'privateuser',
        displayName: 'Private User',
        bio: 'Private bio',
        privacySettings: {
          profileVisibility: PrivacySetting.PRIVATE,
          showCollection: false,
          showDecks: false,
        },
        _count: {
          decks: 10,
          collection: 200,
        },
      };

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = userRouter.createCaller(ctx);

      const result = await caller.getPublicProfile({ username: 'privateuser' });

      expect(result._count).toBeUndefined();
      expect(result.bio).toBe('');
    });

    it('throws error when user not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const ctx = createInnerTRPCContext({ userId: mockUserId });
      const caller = userRouter.createCaller(ctx);

      await expect(
        caller.getPublicProfile({ username: 'nonexistent' })
      ).rejects.toThrow('User not found');
    });
  });
});