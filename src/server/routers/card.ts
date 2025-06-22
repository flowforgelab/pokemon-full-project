import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '@/server/trpc';

export const cardRouter = createTRPCRouter({
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        filters: z
          .object({
            types: z.array(z.string()).optional(),
            supertype: z.string().optional(),
            subtypes: z.array(z.string()).optional(),
            set: z.string().optional(),
            rarity: z.string().optional(),
          })
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { query, page, pageSize, filters } = input;
      const skip = (page - 1) * pageSize;

      const where: Record<string, any> = {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { set: { contains: query, mode: 'insensitive' } },
        ],
      };

      if (filters) {
        if (filters.types?.length) {
          where.types = { hasSome: filters.types };
        }
        if (filters.supertype) {
          where.supertype = filters.supertype;
        }
        if (filters.subtypes?.length) {
          where.subtypes = { hasSome: filters.subtypes };
        }
        if (filters.set) {
          where.set = filters.set;
        }
        if (filters.rarity) {
          where.rarity = filters.rarity;
        }
      }

      const [cards, total] = await ctx.prisma.$transaction([
        ctx.prisma.card.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { name: 'asc' },
        }),
        ctx.prisma.card.count({ where }),
      ]);

      return {
        cards,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.card.findUnique({
        where: { id: input },
      });
    }),

  getByIds: publicProcedure
    .input(z.array(z.string()))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.card.findMany({
        where: { id: { in: input } },
      });
    }),

  getSets: publicProcedure.query(async ({ ctx }) => {
    const sets = await ctx.prisma.card.findMany({
      select: { set: true },
      distinct: ['set'],
      orderBy: { set: 'asc' },
    });
    return sets.map((s: { set: string }) => s.set);
  }),
});