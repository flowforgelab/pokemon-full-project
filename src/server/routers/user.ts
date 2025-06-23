import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure, adminProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { SubscriptionTier } from '@prisma/client';
import { kv } from '@/lib/cache/vercel-kv';

// User preferences schema
const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().optional(),
  notifications: z.object({
    email: z.boolean().default(true),
    push: z.boolean().default(false),
    priceAlerts: z.boolean().default(true),
    tradeOffers: z.boolean().default(true),
    deckShares: z.boolean().default(true),
    newsletterOptIn: z.boolean().default(false),
  }).optional(),
  privacy: z.object({
    showCollection: z.boolean().default(true),
    showDecks: z.boolean().default(true),
    showProfile: z.boolean().default(true),
    allowMessages: z.boolean().default(true),
  }).optional(),
  gameplay: z.object({
    preferredFormat: z.string().optional(),
    playstyle: z.enum(['aggressive', 'control', 'combo', 'midrange', 'flexible']).optional(),
    competitiveLevel: z.enum(['casual', 'local', 'regional', 'competitive']).optional(),
  }).optional(),
  display: z.object({
    cardImageSize: z.enum(['small', 'medium', 'large']).default('medium'),
    defaultView: z.enum(['grid', 'list', 'compact']).default('grid'),
    showPrices: z.boolean().default(true),
    currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']).default('USD'),
  }).optional(),
});

export const userRouter = createTRPCRouter({
  // Get current user with full profile
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { clerkUserId: ctx.userId },
      include: {
        _count: {
          select: {
            decks: true,
            collections: true,
            tradeOffers: true,
            tradeRequests: true,
          }
        }
      }
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return user;
  }),

  // Get public profile by username
  getPublicProfile: publicProcedure
    .input(z.object({
      username: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { username: input.username },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          createdAt: true,
          subscriptionTier: true,
          preferences: true,
          _count: {
            select: {
              decks: { where: { isPublic: true } },
              collections: true,
            }
          }
        }
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check privacy settings
      const preferences = user.preferences as any;
      if (!preferences?.privacy?.showProfile) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This profile is private',
        });
      }

      return user;
    }),

  // Create or update user (for Clerk webhook)
  createOrUpdateUser: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        username: z.string().optional(),
        displayName: z.string().optional(),
        avatarUrl: z.string().url().optional(),
        bio: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check username uniqueness if provided
      if (input.username) {
        const existing = await ctx.db.user.findUnique({
          where: { username: input.username },
          select: { clerkUserId: true }
        });
        
        if (existing && existing.clerkUserId !== ctx.userId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Username already taken',
          });
        }
      }

      return ctx.db.user.upsert({
        where: { clerkUserId: ctx.userId },
        create: {
          clerkUserId: ctx.userId,
          email: input.email,
          username: input.username,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          bio: input.bio,
          preferences: {
            notifications: {
              email: true,
              push: false,
              priceAlerts: true,
              tradeOffers: true,
              deckShares: true,
              newsletterOptIn: false,
            },
            privacy: {
              showCollection: true,
              showDecks: true,
              showProfile: true,
              allowMessages: true,
            },
            display: {
              cardImageSize: 'medium',
              defaultView: 'grid',
              showPrices: true,
              currency: 'USD',
            }
          }
        },
        update: {
          email: input.email,
          username: input.username,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          bio: input.bio,
        },
      });
    }),

  // Update profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/).optional(),
        displayName: z.string().max(50).optional(),
        avatarUrl: z.string().url().optional(),
        bio: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check username uniqueness if changing
      if (input.username) {
        const existing = await ctx.db.user.findFirst({
          where: { 
            username: input.username,
            NOT: { clerkUserId: ctx.userId }
          }
        });
        
        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Username already taken',
          });
        }
      }

      const updated = await ctx.db.user.update({
        where: { clerkUserId: ctx.userId },
        data: {
          ...input,
          updatedAt: new Date(),
        },
      });

      // Clear any cached profile data
      await kv.del(`user:profile:${ctx.userId}`);

      return updated;
    }),

  // Get user preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { clerkUserId: ctx.userId },
      select: { preferences: true }
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return user.preferences || {};
  }),

  // Update user preferences
  updatePreferences: protectedProcedure
    .input(userPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { preferences: true }
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Merge with existing preferences
      const currentPrefs = (user.preferences || {}) as any;
      const updatedPrefs = {
        ...currentPrefs,
        ...input,
        notifications: { ...currentPrefs.notifications, ...input.notifications },
        privacy: { ...currentPrefs.privacy, ...input.privacy },
        gameplay: { ...currentPrefs.gameplay, ...input.gameplay },
        display: { ...currentPrefs.display, ...input.display },
      };

      const updated = await ctx.db.user.update({
        where: { clerkUserId: ctx.userId },
        data: { preferences: updatedPrefs },
      });

      return updated.preferences;
    }),

  // Get user statistics
  getStatistics: protectedProcedure.query(async ({ ctx }) => {
    const [
      collectionStats,
      deckStats,
      tradeStats,
      activityStats
    ] = await Promise.all([
      // Collection statistics
      ctx.db.userCollection.aggregate({
        where: { 
          userId: ctx.userId,
          onWishlist: false 
        },
        _sum: {
          quantity: true,
          quantityFoil: true,
        },
        _count: {
          cardId: true,
        }
      }),
      
      // Deck statistics
      ctx.db.deck.aggregate({
        where: { userId: ctx.userId },
        _count: true,
        _sum: {
          wins: true,
          losses: true,
          draws: true,
        }
      }),
      
      // Trade statistics
      ctx.db.tradeOffer.groupBy({
        by: ['status'],
        where: {
          OR: [
            { offererId: ctx.userId },
            { receiverId: ctx.userId }
          ]
        },
        _count: true,
      }),
      
      // Recent activity
      ctx.db.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: {
          createdAt: true,
          lastActiveAt: true,
          _count: {
            select: {
              priceAlerts: { where: { isActive: true } },
              wantList: true,
            }
          }
        }
      })
    ]);

    return {
      collection: {
        totalCards: (collectionStats._sum.quantity || 0) + (collectionStats._sum.quantityFoil || 0),
        uniqueCards: collectionStats._count.cardId,
        regularCards: collectionStats._sum.quantity || 0,
        foilCards: collectionStats._sum.quantityFoil || 0,
      },
      decks: {
        total: deckStats._count,
        wins: deckStats._sum.wins || 0,
        losses: deckStats._sum.losses || 0,
        draws: deckStats._sum.draws || 0,
        winRate: deckStats._sum.wins && deckStats._sum.losses 
          ? (deckStats._sum.wins / (deckStats._sum.wins + deckStats._sum.losses)) * 100
          : 0,
      },
      trades: {
        total: tradeStats.reduce((sum, stat) => sum + stat._count, 0),
        byStatus: Object.fromEntries(
          tradeStats.map(stat => [stat.status.toLowerCase(), stat._count])
        ),
      },
      activity: {
        memberSince: activityStats?.createdAt,
        lastActive: activityStats?.lastActiveAt,
        activeAlerts: activityStats?._count.priceAlerts || 0,
        wantListItems: activityStats?._count.wantList || 0,
      }
    };
  }),

  // Delete account (soft delete)
  deleteAccount: protectedProcedure
    .input(z.object({
      confirmation: z.literal('DELETE MY ACCOUNT'),
    }))
    .mutation(async ({ ctx, input }) => {
      // This would typically trigger a deletion process
      // For now, we'll just mark the account as deleted
      await ctx.db.user.update({
        where: { clerkUserId: ctx.userId },
        data: {
          // In a real app, you might have a deletedAt field
          // For now, we'll just clear sensitive data
          email: `deleted_${ctx.userId}@deleted.com`,
          username: `deleted_${ctx.userId}`,
          displayName: 'Deleted User',
          avatarUrl: null,
          bio: null,
          preferences: {},
        }
      });

      return { success: true };
    }),

  // Check username availability
  checkUsername: publicProcedure
    .input(z.object({
      username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/),
    }))
    .query(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({
        where: { username: input.username },
        select: { id: true }
      });

      return { available: !existing };
    }),

  // Update subscription tier (admin only)
  updateSubscriptionTier: adminProcedure
    .input(z.object({
      userId: z.string(),
      tier: z.nativeEnum(SubscriptionTier),
      subscriptionEnd: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.user.update({
        where: { id: input.userId },
        data: {
          subscriptionTier: input.tier,
          subscriptionEnd: input.subscriptionEnd,
        }
      });

      return updated;
    }),

  // Update last active timestamp
  updateLastActive: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.user.update({
        where: { clerkUserId: ctx.userId },
        data: { lastActiveAt: new Date() },
      });

      return { success: true };
    }),
});