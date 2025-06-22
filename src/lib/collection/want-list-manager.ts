import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { priceCache } from '@/lib/api/cache';
import type {
  WantListItem,
  PriceAlert,
  SetCompletion,
  Card,
} from './types';

// Validation schemas
const wantListItemSchema = z.object({
  cardId: z.string(),
  priority: z.number().min(1).max(10),
  maxPrice: z.number().min(0).optional(),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().max(500).optional(),
});

const priceAlertSchema = z.object({
  threshold: z.number().min(0),
  type: z.enum(['below', 'above']),
  enabled: z.boolean().default(true),
});

export class WantListManager {
  /**
   * Add card to want list
   */
  async addToWantList(
    userId: string,
    data: {
      cardId: string;
      priority?: number;
      maxPrice?: number;
      quantity?: number;
      notes?: string;
    }
  ): Promise<WantListItem> {
    const validated = wantListItemSchema.parse({
      ...data,
      priority: data.priority || 5,
      quantity: data.quantity || 1,
    });

    // Check if already in want list
    const existing = await prisma.wantList.findUnique({
      where: {
        userId_cardId: {
          userId,
          cardId: validated.cardId,
        },
      },
    });

    if (existing) {
      // Update existing
      return await prisma.wantList.update({
        where: { id: existing.id },
        data: {
          priority: validated.priority,
          maxPrice: validated.maxPrice,
          quantity: validated.quantity,
          notes: validated.notes,
          updatedAt: new Date(),
        },
        include: {
          card: {
            include: {
              set: true,
              prices: {
                orderBy: { updatedAt: 'desc' },
                take: 1,
              },
            },
          },
          priceAlerts: true,
        },
      });
    } else {
      // Create new
      return await prisma.wantList.create({
        data: {
          userId,
          ...validated,
          priceAlerts: [],
        },
        include: {
          card: {
            include: {
              set: true,
              prices: {
                orderBy: { updatedAt: 'desc' },
                take: 1,
              },
            },
          },
          priceAlerts: true,
        },
      });
    }
  }

  /**
   * Remove from want list
   */
  async removeFromWantList(
    userId: string,
    cardIds: string[]
  ): Promise<number> {
    const result = await prisma.wantList.deleteMany({
      where: {
        userId,
        cardId: { in: cardIds },
      },
    });

    return result.count;
  }

  /**
   * Get user's want list
   */
  async getWantList(
    userId: string,
    filters?: {
      priority?: number[];
      maxPrice?: number;
      sets?: string[];
    }
  ): Promise<WantListItem[]> {
    const where: any = { userId };

    if (filters?.priority?.length) {
      where.priority = { in: filters.priority };
    }

    if (filters?.maxPrice !== undefined) {
      where.OR = [
        { maxPrice: null },
        { maxPrice: { lte: filters.maxPrice } },
      ];
    }

    if (filters?.sets?.length) {
      where.card = {
        setId: { in: filters.sets },
      };
    }

    const items = await prisma.wantList.findMany({
      where,
      include: {
        card: {
          include: {
            set: true,
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
        priceAlerts: true,
      },
      orderBy: [
        { priority: 'desc' },
        { dateAdded: 'desc' },
      ],
    });

    return items;
  }

  /**
   * Set price alert for want list item
   */
  async setPriceAlert(
    userId: string,
    wantListItemId: string,
    alert: {
      threshold: number;
      type: 'below' | 'above';
      enabled?: boolean;
    }
  ): Promise<PriceAlert> {
    const validated = priceAlertSchema.parse(alert);

    // Verify ownership
    const wantListItem = await prisma.wantList.findFirst({
      where: { id: wantListItemId, userId },
    });

    if (!wantListItem) {
      throw new Error('Want list item not found');
    }

    // Create or update alert
    const alertId = `${wantListItemId}-${validated.type}-${validated.threshold}`;
    
    const existingAlerts = wantListItem.priceAlerts as PriceAlert[] || [];
    const newAlert: PriceAlert = {
      id: alertId,
      ...validated,
    };

    // Update alerts array
    const updatedAlerts = [
      ...existingAlerts.filter(a => a.id !== alertId),
      newAlert,
    ];

    await prisma.wantList.update({
      where: { id: wantListItemId },
      data: {
        priceAlerts: updatedAlerts as any,
      },
    });

    return newAlert;
  }

  /**
   * Check price alerts
   */
  async checkPriceAlerts(userId: string): Promise<{
    triggered: { item: WantListItem; alert: PriceAlert; currentPrice: number }[];
  }> {
    const wantList = await this.getWantList(userId);
    const triggered: { item: WantListItem; alert: PriceAlert; currentPrice: number }[] = [];

    for (const item of wantList) {
      const currentPrice = item.card.prices?.[0]?.marketPrice || 0;
      const alerts = (item.priceAlerts || []) as PriceAlert[];

      for (const alert of alerts) {
        if (!alert.enabled) continue;

        const shouldTrigger = alert.type === 'below'
          ? currentPrice <= alert.threshold
          : currentPrice >= alert.threshold;

        if (shouldTrigger) {
          triggered.push({ item, alert, currentPrice });

          // Update last triggered
          const updatedAlert = { ...alert, lastTriggered: new Date() };
          await this.updateAlert(item.id, updatedAlert);
        }
      }
    }

    return { triggered };
  }

  /**
   * Get want list suggestions based on collection
   */
  async getWantListSuggestions(
    userId: string,
    limit = 20
  ): Promise<Card[]> {
    // Get user's decks
    const decks = await prisma.deck.findMany({
      where: { userId },
      include: {
        cards: {
          include: {
            card: true,
          },
        },
      },
    });

    // Find cards used in decks but not owned
    const deckCardIds = new Set<string>();
    decks.forEach(deck => {
      deck.cards.forEach(dc => {
        deckCardIds.add(dc.cardId);
      });
    });

    // Get owned cards
    const owned = await prisma.userCollection.findMany({
      where: { userId },
      select: { cardId: true },
    });
    const ownedIds = new Set(owned.map(o => o.cardId));

    // Get current want list
    const wantList = await prisma.wantList.findMany({
      where: { userId },
      select: { cardId: true },
    });
    const wantListIds = new Set(wantList.map(w => w.cardId));

    // Find missing cards
    const missingIds = Array.from(deckCardIds).filter(
      id => !ownedIds.has(id) && !wantListIds.has(id)
    );

    if (missingIds.length === 0) {
      // No deck-based suggestions, get popular cards
      return await this.getPopularWantedCards(limit);
    }

    // Get card details
    const suggestions = await prisma.card.findMany({
      where: {
        id: { in: missingIds },
      },
      include: {
        set: true,
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      take: limit,
    });

    return suggestions;
  }

  /**
   * Get set completion want list
   */
  async getSetCompletionWantList(
    userId: string,
    setId: string
  ): Promise<Card[]> {
    // Get all cards in set
    const setCards = await prisma.card.findMany({
      where: { setId },
      include: {
        set: true,
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    // Get owned cards in this set
    const owned = await prisma.userCollection.findMany({
      where: {
        userId,
        card: { setId },
      },
      select: { cardId: true },
    });
    const ownedIds = new Set(owned.map(o => o.cardId));

    // Find missing cards
    const missing = setCards.filter(card => !ownedIds.has(card.id));

    // Sort by collector number
    missing.sort((a, b) => {
      const aNum = parseInt(a.collectorNumber) || 999;
      const bNum = parseInt(b.collectorNumber) || 999;
      return aNum - bNum;
    });

    return missing;
  }

  /**
   * Export want list
   */
  async exportWantList(
    userId: string,
    format: 'csv' | 'json' | 'text'
  ): Promise<string> {
    const wantList = await this.getWantList(userId);

    switch (format) {
      case 'csv':
        return this.exportToCSV(wantList);
      case 'json':
        return this.exportToJSON(wantList);
      case 'text':
        return this.exportToText(wantList);
      default:
        throw new Error('Invalid export format');
    }
  }

  /**
   * Share want list
   */
  async shareWantList(
    userId: string,
    options: {
      includeValues: boolean;
      includePriorities: boolean;
      expiresInDays?: number;
    }
  ): Promise<{ shareId: string; shareUrl: string }> {
    const shareId = this.generateShareId();
    const expiresAt = options.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    await prisma.sharedWantList.create({
      data: {
        id: shareId,
        userId,
        config: options as any,
        expiresAt,
      },
    });

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/want-list/shared/${shareId}`;

    return { shareId, shareUrl };
  }

  /**
   * Get want list value summary
   */
  async getWantListSummary(userId: string): Promise<{
    totalItems: number;
    totalCards: number;
    estimatedCost: number;
    priorityBreakdown: Record<number, number>;
    setBudget: number;
    budgetRemaining: number;
  }> {
    const wantList = await this.getWantList(userId);

    let totalCards = 0;
    let estimatedCost = 0;
    const priorityBreakdown: Record<number, number> = {};

    wantList.forEach(item => {
      totalCards += item.quantity;
      const price = item.card.prices?.[0]?.marketPrice || 0;
      estimatedCost += price * item.quantity;

      priorityBreakdown[item.priority] = 
        (priorityBreakdown[item.priority] || 0) + 1;
    });

    // Get user's want list budget
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const setBudget = (user?.preferences as any)?.wantListBudget || 0;
    const budgetRemaining = Math.max(0, setBudget - estimatedCost);

    return {
      totalItems: wantList.length,
      totalCards,
      estimatedCost,
      priorityBreakdown,
      setBudget,
      budgetRemaining,
    };
  }

  /**
   * Get alternative cards for want list items
   */
  async getAlternatives(
    cardId: string,
    maxPrice?: number
  ): Promise<Card[]> {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: {
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!card) return [];

    // Find similar cards (same Pokemon, different versions)
    const pokemonName = card.name.split(' ')[0]; // Simple extraction

    const alternatives = await prisma.card.findMany({
      where: {
        name: {
          contains: pokemonName,
          mode: 'insensitive',
        },
        id: { not: cardId },
        ...(maxPrice ? {
          prices: {
            some: {
              marketPrice: { lte: maxPrice },
            },
          },
        } : {}),
      },
      include: {
        set: true,
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      take: 10,
    });

    // Sort by price
    alternatives.sort((a, b) => {
      const aPrice = a.prices[0]?.marketPrice || 999999;
      const bPrice = b.prices[0]?.marketPrice || 999999;
      return aPrice - bPrice;
    });

    return alternatives;
  }

  // Private helper methods

  private async updateAlert(
    wantListItemId: string,
    alert: PriceAlert
  ): Promise<void> {
    const item = await prisma.wantList.findUnique({
      where: { id: wantListItemId },
    });

    if (!item) return;

    const alerts = (item.priceAlerts as PriceAlert[]) || [];
    const updatedAlerts = alerts.map(a => 
      a.id === alert.id ? alert : a
    );

    await prisma.wantList.update({
      where: { id: wantListItemId },
      data: {
        priceAlerts: updatedAlerts as any,
      },
    });
  }

  private async getPopularWantedCards(limit: number): Promise<Card[]> {
    // Get most wanted cards across all users
    const popular = await prisma.wantList.groupBy({
      by: ['cardId'],
      _count: true,
      orderBy: {
        _count: {
          cardId: 'desc',
        },
      },
      take: limit,
    });

    const cardIds = popular.map(p => p.cardId);

    return await prisma.card.findMany({
      where: {
        id: { in: cardIds },
      },
      include: {
        set: true,
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  private exportToCSV(wantList: WantListItem[]): string {
    const headers = ['Card Name', 'Set', 'Priority', 'Quantity', 'Current Price', 'Max Price', 'Notes'];
    const rows = wantList.map(item => [
      item.card.name,
      item.card.set.name,
      item.priority,
      item.quantity,
      item.card.prices?.[0]?.marketPrice || 'N/A',
      item.maxPrice || 'Any',
      item.notes || '',
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
  }

  private exportToJSON(wantList: WantListItem[]): string {
    const data = wantList.map(item => ({
      cardName: item.card.name,
      setName: item.card.set.name,
      setCode: item.card.set.code,
      priority: item.priority,
      quantity: item.quantity,
      currentPrice: item.card.prices?.[0]?.marketPrice,
      maxPrice: item.maxPrice,
      notes: item.notes,
    }));

    return JSON.stringify(data, null, 2);
  }

  private exportToText(wantList: WantListItem[]): string {
    const lines = ['Pokemon TCG Want List', '=' .repeat(50), ''];

    // Group by priority
    const byPriority = new Map<number, WantListItem[]>();
    wantList.forEach(item => {
      const items = byPriority.get(item.priority) || [];
      items.push(item);
      byPriority.set(item.priority, items);
    });

    // Sort priorities descending
    const priorities = Array.from(byPriority.keys()).sort((a, b) => b - a);

    priorities.forEach(priority => {
      lines.push(`Priority ${priority}:`);
      lines.push('-'.repeat(20));
      
      const items = byPriority.get(priority) || [];
      items.forEach(item => {
        const price = item.card.prices?.[0]?.marketPrice || 'N/A';
        lines.push(`${item.quantity}x ${item.card.name} (${item.card.set.code}) - $${price}`);
        if (item.notes) {
          lines.push(`   Notes: ${item.notes}`);
        }
      });
      
      lines.push('');
    });

    return lines.join('\n');
  }

  private generateShareId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}