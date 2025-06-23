import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, premiumProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { TradeStatus, CardCondition, AcquisitionSource, StorageLocation } from '@prisma/client';
import { redis as kv } from '@/server/db/redis';

// Trade schemas
const tradeCardSchema = z.object({
  cardId: z.string(),
  quantity: z.number().min(1).max(10),
  condition: z.nativeEnum(CardCondition).default(CardCondition.NEAR_MINT),
  foil: z.boolean().default(false),
  notes: z.string().optional(),
});

const tradeOfferSchema = z.object({
  receiverId: z.string(),
  offeredCards: z.array(tradeCardSchema).min(1),
  requestedCards: z.array(tradeCardSchema).min(1),
  message: z.string().max(500).optional(),
  expiresIn: z.enum(['24hours', '3days', '1week', '1month']).default('1week'),
});

const tradeFilterSchema = z.object({
  status: z.nativeEnum(TradeStatus).optional(),
  direction: z.enum(['sent', 'received', 'all']).default('all'),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(50).default(20),
  sortBy: z.enum(['created', 'updated', 'expires']).default('created'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const tradeRouter = createTRPCRouter({
  // Create a new trade offer
  create: protectedProcedure
    .input(tradeOfferSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Verify receiver exists
      const receiver = await ctx.prisma.user.findUnique({
        where: { id: input.receiverId },
        select: { 
          id: true,
          preferences: true,
        }
      });

      if (!receiver) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Receiver not found',
        });
      }

      if (input.receiverId === user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot trade with yourself',
        });
      }

      // Check if receiver allows trade offers
      const receiverPrefs = receiver.preferences as any;
      if (receiverPrefs?.privacy?.allowMessages === false) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This user is not accepting trade offers',
        });
      }

      // Check if cards are available in user's collection
      const offeredCardIds = input.offeredCards.map(c => c.cardId);
      const userCollection = await ctx.prisma.userCollection.findMany({
        where: {
          userId: user.id,
          cardId: { in: offeredCardIds },
          forTrade: true,
        },
      });

      if (userCollection.length !== offeredCardIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Some offered cards are not available for trade',
        });
      }

      // Calculate expiration
      const expirations = {
        '24hours': 24 * 60 * 60 * 1000,
        '3days': 3 * 24 * 60 * 60 * 1000,
        '1week': 7 * 24 * 60 * 60 * 1000,
        '1month': 30 * 24 * 60 * 60 * 1000,
      };

      const expiresAt = new Date(Date.now() + expirations[input.expiresIn]);

      // Create trade offer
      const tradeOffer = await ctx.prisma.tradeOffer.create({
        data: {
          offererId: user.id,
          receiverId: input.receiverId,
          status: TradeStatus.PENDING,
          offeredCards: input.offeredCards,
          requestedCards: input.requestedCards,
          message: input.message,
          expiresAt,
        },
        include: {
          offerer: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            }
          },
          receiver: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            }
          }
        }
      });

      // Send notification if enabled
      if (receiverPrefs?.notifications?.tradeOffers) {
        // Queue notification job
        await kv.lpush('notifications:queue', {
          type: 'trade_offer',
          userId: receiver.id,
          data: {
            offerId: tradeOffer.id,
            offererName: tradeOffer.offerer.username,
          }
        });
      }

      return tradeOffer;
    }),

  // Get trade offers
  getUserTrades: protectedProcedure
    .input(tradeFilterSchema)
    .query(async ({ ctx, input }) => {
      const { status, direction, page, pageSize, sortBy, sortOrder } = input;
      const skip = (page - 1) * pageSize;

      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Build where clause
      const where: any = {};
      
      if (direction === 'sent') {
        where.offererId = user.id;
      } else if (direction === 'received') {
        where.receiverId = user.id;
      } else {
        where.OR = [
          { offererId: user.id },
          { receiverId: user.id }
        ];
      }

      if (status) {
        where.status = status;
      }

      // Build order by
      const orderBy: any = {};
      if (sortBy === 'created') orderBy.createdAt = sortOrder;
      else if (sortBy === 'updated') orderBy.updatedAt = sortOrder;
      else if (sortBy === 'expires') orderBy.expiresAt = sortOrder;

      const [trades, total] = await ctx.prisma.$transaction([
        ctx.prisma.tradeOffer.findMany({
          where,
          skip,
          take: pageSize,
          orderBy,
          include: {
            offerer: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              }
            },
            receiver: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              }
            },
            counterOffer: true,
          }
        }),
        ctx.prisma.tradeOffer.count({ where }),
      ]);

      // Enrich with card details
      const enrichedTrades = await Promise.all(
        trades.map(async (trade) => {
          const offeredCardIds = (trade.offeredCards as any[]).map(c => c.cardId);
          const requestedCardIds = (trade.requestedCards as any[]).map(c => c.cardId);
          
          const [offeredCards, requestedCards] = await Promise.all([
            ctx.prisma.card.findMany({
              where: { id: { in: offeredCardIds } },
              include: {
                set: true,
                prices: {
                  take: 1,
                  orderBy: { updatedAt: 'desc' }
                }
              }
            }),
            ctx.prisma.card.findMany({
              where: { id: { in: requestedCardIds } },
              include: {
                set: true,
                prices: {
                  take: 1,
                  orderBy: { updatedAt: 'desc' }
                }
              }
            })
          ]);

          return {
            ...trade,
            offeredCardsDetails: offeredCards,
            requestedCardsDetails: requestedCards,
            isExpired: trade.expiresAt && trade.expiresAt < new Date(),
          };
        })
      );

      return {
        trades: enrichedTrades,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  // Get single trade offer
  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const trade = await ctx.prisma.tradeOffer.findUnique({
        where: { id: input },
        include: {
          offerer: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              _count: {
                select: {
                  tradeOffers: { where: { status: TradeStatus.COMPLETED } },
                }
              }
            }
          },
          receiver: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              _count: {
                select: {
                  tradeRequests: { where: { status: TradeStatus.COMPLETED } },
                }
              }
            }
          },
          counterOffer: true,
          originalOffer: true,
        }
      });

      if (!trade) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trade offer not found',
        });
      }

      // Check permissions
      if (trade.offererId !== user.id && trade.receiverId !== user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You do not have permission to view this trade',
        });
      }

      // Enrich with card details
      const offeredCardIds = (trade.offeredCards as any[]).map(c => c.cardId);
      const requestedCardIds = (trade.requestedCards as any[]).map(c => c.cardId);
      
      const [offeredCards, requestedCards] = await Promise.all([
        ctx.prisma.card.findMany({
          where: { id: { in: offeredCardIds } },
          include: {
            set: true,
            prices: {
              take: 1,
              orderBy: { updatedAt: 'desc' }
            }
          }
        }),
        ctx.prisma.card.findMany({
          where: { id: { in: requestedCardIds } },
          include: {
            set: true,
            prices: {
              take: 1,
              orderBy: { updatedAt: 'desc' }
            }
          }
        })
      ]);

      return {
        ...trade,
        offeredCardsDetails: offeredCards,
        requestedCardsDetails: requestedCards,
        isExpired: trade.expiresAt && trade.expiresAt < new Date(),
      };
    }),

  // Update trade status
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(TradeStatus),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const trade = await ctx.prisma.tradeOffer.findUnique({
        where: { id: input.id },
        select: {
          offererId: true,
          receiverId: true,
          status: true,
          offeredCards: true,
          requestedCards: true,
          expiresAt: true,
        },
      });

      if (!trade) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Trade offer not found',
        });
      }

      const isOfferer = trade.offererId === user.id;
      const isReceiver = trade.receiverId === user.id;

      if (!isOfferer && !isReceiver) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You are not part of this trade',
        });
      }

      if (trade.status !== TradeStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This trade has already been resolved',
        });
      }

      // Check expiration
      if (trade.expiresAt && trade.expiresAt < new Date()) {
        await ctx.prisma.tradeOffer.update({
          where: { id: input.id },
          data: { status: TradeStatus.EXPIRED },
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This trade offer has expired',
        });
      }

      // Handle different status updates
      if (input.status === TradeStatus.CANCELLED && !isOfferer) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Only the offerer can cancel a trade',
        });
      }

      if ((input.status === TradeStatus.ACCEPTED || input.status === TradeStatus.REJECTED) && !isReceiver) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Only the receiver can accept or reject a trade',
        });
      }

      // If accepting, execute the trade
      if (input.status === TradeStatus.ACCEPTED) {
        const offeredCards = trade.offeredCards as any[];
        const requestedCards = trade.requestedCards as any[];

        // Verify both users have the cards
        for (const card of offeredCards) {
          const userCard = await ctx.prisma.userCollection.findFirst({
            where: {
              userId: trade.offererId,
              cardId: card.cardId,
              condition: card.condition,
              quantity: { gte: card.quantity },
            }
          });

          if (!userCard) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Offerer no longer has some of the offered cards',
            });
          }
        }

        for (const card of requestedCards) {
          const userCard = await ctx.prisma.userCollection.findFirst({
            where: {
              userId: trade.receiverId,
              cardId: card.cardId,
              condition: card.condition,
              quantity: { gte: card.quantity },
            }
          });

          if (!userCard) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'You no longer have some of the requested cards',
            });
          }
        }

        // Execute trade transaction
        await ctx.prisma.$transaction(async (tx) => {
          // Update trade status
          await tx.tradeOffer.update({
            where: { id: input.id },
            data: {
              status: TradeStatus.COMPLETED,
              completedAt: new Date(),
              message: input.message,
            }
          });

          // Transfer cards
          for (const card of offeredCards) {
            // Reduce offerer's collection
            await tx.userCollection.updateMany({
              where: {
                userId: trade.offererId,
                cardId: card.cardId,
                condition: card.condition,
              },
              data: {
                quantity: { decrement: card.quantity }
              }
            });

            // Add to receiver's collection
            const existing = await tx.userCollection.findFirst({
              where: {
                userId: trade.receiverId,
                cardId: card.cardId,
                condition: card.condition,
                location: StorageLocation.BINDER,
              }
            });

            if (existing) {
              await tx.userCollection.update({
                where: { id: existing.id },
                data: {
                  quantity: { increment: card.quantity }
                }
              });
            } else {
              await tx.userCollection.create({
                data: {
                  userId: trade.receiverId,
                  cardId: card.cardId,
                  quantity: card.quantity,
                  condition: card.condition,
                  source: AcquisitionSource.TRADE,
                  location: StorageLocation.BINDER,
                  notes: `Traded with user ${trade.offererId}`,
                }
              });
            }
          }

          // Transfer cards from receiver to offerer
          for (const card of requestedCards) {
            // Reduce receiver's collection
            await tx.userCollection.updateMany({
              where: {
                userId: trade.receiverId,
                cardId: card.cardId,
                condition: card.condition,
              },
              data: {
                quantity: { decrement: card.quantity }
              }
            });

            // Add to offerer's collection
            const existing = await tx.userCollection.findFirst({
              where: {
                userId: trade.offererId,
                cardId: card.cardId,
                condition: card.condition,
                location: StorageLocation.BINDER,
              }
            });

            if (existing) {
              await tx.userCollection.update({
                where: { id: existing.id },
                data: {
                  quantity: { increment: card.quantity }
                }
              });
            } else {
              await tx.userCollection.create({
                data: {
                  userId: trade.offererId,
                  cardId: card.cardId,
                  quantity: card.quantity,
                  condition: card.condition,
                  source: AcquisitionSource.TRADE,
                  location: StorageLocation.BINDER,
                  notes: `Traded with user ${trade.receiverId}`,
                }
              });
            }
          }

          // Update trading partner relationships
          await tx.tradingPartner.upsert({
            where: {
              userId_partnerId: {
                userId: trade.offererId,
                partnerId: trade.receiverId,
              }
            },
            create: {
              userId: trade.offererId,
              partnerId: trade.receiverId,
              totalTrades: 1,
              successfulTrades: 1,
              lastTradeDate: new Date(),
            },
            update: {
              totalTrades: { increment: 1 },
              successfulTrades: { increment: 1 },
              lastTradeDate: new Date(),
            }
          });

          await tx.tradingPartner.upsert({
            where: {
              userId_partnerId: {
                userId: trade.receiverId,
                partnerId: trade.offererId,
              }
            },
            create: {
              userId: trade.receiverId,
              partnerId: trade.offererId,
              totalTrades: 1,
              successfulTrades: 1,
              lastTradeDate: new Date(),
            },
            update: {
              totalTrades: { increment: 1 },
              successfulTrades: { increment: 1 },
              lastTradeDate: new Date(),
            }
          });
        });
      } else {
        // Just update the status
        await ctx.prisma.tradeOffer.update({
          where: { id: input.id },
          data: { 
            status: input.status,
            message: input.message,
          },
        });
      }

      return { success: true };
    }),

  // Create counter offer
  createCounterOffer: protectedProcedure
    .input(z.object({
      originalOfferId: z.string(),
      offeredCards: z.array(tradeCardSchema).min(1),
      requestedCards: z.array(tradeCardSchema).min(1),
      message: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const originalOffer = await ctx.prisma.tradeOffer.findUnique({
        where: { id: input.originalOfferId },
      });

      if (!originalOffer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Original trade offer not found',
        });
      }

      // Only receiver can counter
      if (originalOffer.receiverId !== user.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Only the receiver can create a counter offer',
        });
      }

      // Check if already has a counter offer
      if (originalOffer.counterOfferId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This trade already has a counter offer',
        });
      }

      // Create counter offer
      const counterOffer = await ctx.prisma.tradeOffer.create({
        data: {
          offererId: user.id,
          receiverId: originalOffer.offererId,
          status: TradeStatus.PENDING,
          offeredCards: input.offeredCards,
          requestedCards: input.requestedCards,
          message: input.message || `Counter offer to trade #${originalOffer.id}`,
          expiresAt: originalOffer.expiresAt,
        }
      });

      // Link counter offer to original
      await ctx.prisma.tradeOffer.update({
        where: { id: input.originalOfferId },
        data: {
          counterOfferId: counterOffer.id,
          status: TradeStatus.REJECTED,
        }
      });

      return counterOffer;
    }),

  // Get trading partners
  getTradingPartners: protectedProcedure
    .input(z.object({
      sortBy: z.enum(['recent', 'frequent', 'trust']).default('recent'),
    }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const orderBy: any = {};
      if (input.sortBy === 'recent') orderBy.lastTradeDate = 'desc';
      else if (input.sortBy === 'frequent') orderBy.totalTrades = 'desc';
      else if (input.sortBy === 'trust') orderBy.trustLevel = 'desc';

      const partners = await ctx.prisma.tradingPartner.findMany({
        where: { userId: user.id },
        orderBy,
        include: {
          partner: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              subscriptionTier: true,
            }
          }
        }
      });

      return partners;
    }),

  // Update partner trust level
  updatePartnerTrust: protectedProcedure
    .input(z.object({
      partnerId: z.string(),
      trustLevel: z.number().min(0).max(100),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const updated = await ctx.prisma.tradingPartner.update({
        where: {
          userId_partnerId: {
            userId: user.id,
            partnerId: input.partnerId,
          }
        },
        data: {
          trustLevel: input.trustLevel,
          notes: input.notes,
        }
      });

      return updated;
    }),

  // Get trade statistics
  getStatistics: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const [sent, received, partners] = await Promise.all([
        ctx.prisma.tradeOffer.groupBy({
          by: ['status'],
          where: { offererId: user.id },
          _count: true,
        }),
        ctx.prisma.tradeOffer.groupBy({
          by: ['status'],
          where: { receiverId: user.id },
          _count: true,
        }),
        ctx.prisma.tradingPartner.aggregate({
          where: { userId: user.id },
          _count: true,
          _sum: {
            totalTrades: true,
            successfulTrades: true,
          },
          _avg: {
            trustLevel: true,
          }
        })
      ]);

      return {
        sent: Object.fromEntries(
          sent.map(s => [s.status.toLowerCase(), s._count])
        ),
        received: Object.fromEntries(
          received.map(r => [r.status.toLowerCase(), r._count])
        ),
        partners: {
          total: partners._count,
          totalTrades: partners._sum.totalTrades || 0,
          successfulTrades: partners._sum.successfulTrades || 0,
          averageTrust: partners._avg.trustLevel || 0,
        }
      };
    }),

  // Search users for trading
  searchUsers: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { clerkUserId: ctx.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const users = await ctx.prisma.user.findMany({
        where: {
          AND: [
            { id: { not: user.id } },
            {
              OR: [
                { username: { contains: input.query, mode: 'insensitive' } },
                { displayName: { contains: input.query, mode: 'insensitive' } },
              ]
            }
          ]
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          subscriptionTier: true,
          _count: {
            select: {
              collections: true,
              decks: { where: { isPublic: true } },
            }
          }
        },
        take: input.limit,
      });

      // Check if users allow trading
      const usersWithTradeStatus = users.map(u => {
        const preferences = u as any;
        return {
          ...u,
          acceptingTrades: preferences.preferences?.privacy?.allowMessages !== false,
        };
      });

      return usersWithTradeStatus;
    }),
});