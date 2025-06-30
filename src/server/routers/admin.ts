import { z } from 'zod';
import { createTRPCRouter, adminProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { SubscriptionTier } from '@prisma/client';
import { auditLog } from '@/server/api/middleware/permissions';

export const adminRouter = createTRPCRouter({
  /**
   * Get admin dashboard statistics
   */
  getDashboard: adminProcedure
    .query(async ({ ctx }) => {
      const [
        userStats,
        deckStats,
        collectionStats,
        tradeStats,
        revenueStats,
        systemHealth,
      ] = await ctx.prisma.$transaction([
        // User statistics
        ctx.prisma.user.groupBy({
          by: ['subscriptionTier'],
          _count: true,
        }),
        
        // Deck statistics
        ctx.prisma.deck.aggregate({
          _count: true,
          _avg: {
            consistencyScore: true,
            speedScore: true,
            synergyScore: true,
          },
        }),
        
        // Collection statistics
        ctx.prisma.userCollection.aggregate({
          _count: true,
          _sum: {
            quantity: true,
            quantityFoil: true,
          },
        }),
        
        // Trade statistics
        ctx.prisma.tradeOffer.groupBy({
          by: ['status'],
          _count: true,
        }),
        
        // Revenue statistics (mock for now)
        ctx.prisma.user.groupBy({
          by: ['subscriptionTier'],
          where: {
            subscriptionTier: {
              not: SubscriptionTier.FREE,
            },
          },
          _count: true,
        }),
        
        // System health
        ctx.prisma.$queryRaw`
          SELECT 
            (SELECT COUNT(*) FROM "User" WHERE "createdAt" > NOW() - INTERVAL '24 hours') as new_users_24h,
            (SELECT COUNT(*) FROM "Deck" WHERE "createdAt" > NOW() - INTERVAL '24 hours') as new_decks_24h,
            (SELECT COUNT(*) FROM "TradeOffer" WHERE "createdAt" > NOW() - INTERVAL '24 hours') as new_trades_24h,
            (SELECT COUNT(*) FROM "User" WHERE "lastActive" > NOW() - INTERVAL '24 hours') as active_users_24h
        `,
      ]);
      
      return {
        users: {
          total: userStats.reduce((sum, stat) => sum + stat._count, 0),
          byTier: userStats,
        },
        decks: deckStats,
        collections: collectionStats,
        trades: {
          total: tradeStats.reduce((sum, stat) => sum + stat._count, 0),
          byStatus: tradeStats,
        },
        revenue: {
          subscribedUsers: revenueStats.reduce((sum, stat) => sum + stat._count, 0),
          byTier: revenueStats,
        },
        systemHealth: systemHealth[0],
        timestamp: new Date(),
      };
    }),
  
  /**
   * Manage user accounts
   */
  updateUser: adminProcedure
    .use(auditLog('updateUser', 'user'))
    .input(z.object({
      userId: z.string(),
      updates: z.object({
        subscriptionTier: z.nativeEnum(SubscriptionTier).optional(),
        isActive: z.boolean().optional(),
        isBanned: z.boolean().optional(),
        banReason: z.string().optional(),
        features: z.array(z.string()).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId, updates } = input;
      
      // Verify user exists
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
      
      // Update user
      const updatedUser = await ctx.prisma.user.update({
        where: { id: userId },
        data: updates,
      });
      
      // If banning user, also deactivate their sessions
      if (updates.isBanned) {
        // In production, would invalidate Clerk sessions here
        await ctx.prisma.notification.create({
          data: {
            userId,
            type: 'ADMIN',
            title: 'Account Status Update',
            message: updates.banReason || 'Your account has been suspended',
            priority: 'HIGH',
            metadata: {
              action: 'ban',
              reason: updates.banReason,
            },
          },
        });
      }
      
      return updatedUser;
    }),
  
  /**
   * Manage feature flags
   */
  updateFeatureFlag: adminProcedure
    .use(auditLog('updateFeatureFlag', 'featureFlag'))
    .input(z.object({
      key: z.string(),
      enabled: z.boolean(),
      rolloutPercentage: z.number().min(0).max(100).optional(),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.featureFlag.upsert({
        where: { key: input.key },
        create: input,
        update: input,
      });
    }),
  
  /**
   * View audit logs
   */
  getAuditLogs: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(50),
      userId: z.string().optional(),
      action: z.string().optional(),
      resourceType: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, pageSize, userId, action, resourceType, startDate, endDate } = input;
      const skip = (page - 1) * pageSize;
      
      const where: any = {};
      
      if (userId) where.userId = userId;
      if (action) where.action = action;
      if (resourceType) where.resourceType = resourceType;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }
      
      const [logs, total] = await ctx.prisma.$transaction([
        ctx.prisma.auditLog.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        }),
        ctx.prisma.auditLog.count({ where }),
      ]);
      
      return {
        logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),
  
  /**
   * Send system-wide notification
   */
  sendNotification: adminProcedure
    .use(auditLog('sendNotification', 'notification'))
    .input(z.object({
      userIds: z.array(z.string()).optional(),
      subscriptionTiers: z.array(z.nativeEnum(SubscriptionTier)).optional(),
      title: z.string(),
      message: z.string(),
      type: z.enum(['SYSTEM', 'ADMIN', 'MAINTENANCE']),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
      metadata: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userIds, subscriptionTiers, ...notificationData } = input;
      
      let targetUserIds: string[] = [];
      
      if (userIds) {
        targetUserIds = userIds;
      } else if (subscriptionTiers) {
        const users = await ctx.prisma.user.findMany({
          where: {
            subscriptionTier: { in: subscriptionTiers },
          },
          select: { id: true },
        });
        targetUserIds = users.map(u => u.id);
      } else {
        // Send to all users
        const users = await ctx.prisma.user.findMany({
          select: { id: true },
        });
        targetUserIds = users.map(u => u.id);
      }
      
      // Create notifications for all target users
      const notifications = await ctx.prisma.notification.createMany({
        data: targetUserIds.map(userId => ({
          userId,
          ...notificationData,
        })),
      });
      
      return {
        sent: notifications.count,
        targetUsers: targetUserIds.length,
      };
    }),
  
  /**
   * Manage banned content
   */
  moderateContent: adminProcedure
    .use(auditLog('moderateContent', 'moderation'))
    .input(z.object({
      resourceType: z.enum(['deck', 'user', 'trade']),
      resourceId: z.string(),
      action: z.enum(['flag', 'remove', 'restore']),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { resourceType, resourceId, action, reason } = input;
      
      switch (resourceType) {
        case 'deck':
          if (action === 'remove') {
            await ctx.prisma.deck.update({
              where: { id: resourceId },
              data: { isPublic: false },
            });
          } else if (action === 'restore') {
            await ctx.prisma.deck.update({
              where: { id: resourceId },
              data: { isPublic: true },
            });
          }
          break;
          
        case 'trade':
          if (action === 'remove') {
            await ctx.prisma.tradeOffer.update({
              where: { id: resourceId },
              data: { status: 'CANCELLED' },
            });
          }
          break;
          
        case 'user':
          if (action === 'flag') {
            await ctx.prisma.user.update({
              where: { id: resourceId },
              data: {
                features: {
                  push: 'flagged',
                },
              },
            });
          }
          break;
      }
      
      // Record moderation action
      await ctx.prisma.adminAction.create({
        data: {
          adminId: ctx.user.id,
          action: `${action}_${resourceType}`,
          targetId: resourceId,
          reason,
          metadata: {
            resourceType,
            action,
            timestamp: new Date().toISOString(),
          },
        },
      });
      
      return { success: true };
    }),
});