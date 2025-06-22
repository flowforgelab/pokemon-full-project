import { Card, Supertype, Rarity, Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { z } from 'zod';
import { redis } from '@/server/db/redis';
import { CardSearchFilters, SearchSuggestion } from './types';

export class CardSearchEngine {
  private readonly SEARCH_CACHE_TTL = 300; // 5 minutes
  private readonly SUGGESTION_CACHE_TTL = 3600; // 1 hour
  private readonly MAX_SUGGESTIONS = 10;
  private readonly DEBOUNCE_MS = 300;

  async search(
    filters: CardSearchFilters,
    page = 1,
    pageSize = 20,
    deckCardIds?: string[]
  ): Promise<{
    cards: Card[];
    totalCount: number;
    hasMore: boolean;
    suggestions: SearchSuggestion[];
  }> {
    const cacheKey = this.buildCacheKey(filters, page, pageSize);
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    // Build query
    const where = this.buildWhereClause(filters, deckCardIds);
    const orderBy = this.buildOrderBy(filters);

    // Execute search
    const [cards, totalCount] = await Promise.all([
      prisma.card.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          set: true,
          prices: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.card.count({ where }),
    ]);

    // Generate suggestions
    const suggestions = await this.generateSuggestions(filters, cards);

    const result = {
      cards,
      totalCount,
      hasMore: totalCount > page * pageSize,
      suggestions,
    };

    // Cache result
    await redis.setex(cacheKey, this.SEARCH_CACHE_TTL, JSON.stringify(result));

    return result;
  }

  async searchSuggestions(query: string): Promise<SearchSuggestion[]> {
    const cacheKey = `suggestions:${query.toLowerCase()}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    const suggestions: SearchSuggestion[] = [];

    // Card name suggestions
    const cards = await prisma.card.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 5,
      orderBy: {
        name: 'asc',
      },
    });

    cards.forEach(card => {
      suggestions.push({
        type: 'card',
        value: card.id,
        displayName: card.name,
        preview: card,
        relevance: this.calculateRelevance(card.name, query),
      });
    });

    // Category suggestions
    const categories = this.generateCategorySuggestions(query);
    suggestions.push(...categories);

    // Combo suggestions
    const combos = await this.generateComboSuggestions(query);
    suggestions.push(...combos);

    // Sort by relevance and limit
    const sortedSuggestions = suggestions
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, this.MAX_SUGGESTIONS);

    await redis.setex(cacheKey, this.SUGGESTION_CACHE_TTL, JSON.stringify(sortedSuggestions));

    return sortedSuggestions;
  }

  async getRecentlyViewed(userId: string, limit = 10): Promise<Card[]> {
    const cacheKey = `recent:${userId}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    // Get from database (would need a RecentlyViewed model)
    // For now, return empty array
    return [];
  }

  async getPopularCards(format?: string, limit = 10): Promise<Card[]> {
    const cacheKey = `popular:${format || 'all'}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached as string);
    }

    // Query popular cards based on deck usage
    const popularCards = await prisma.$queryRaw<Card[]>`
      SELECT c.*, COUNT(dc."cardId") as usage_count
      FROM "Card" c
      JOIN "DeckCard" dc ON c.id = dc."cardId"
      JOIN "Deck" d ON dc."deckId" = d.id
      WHERE d."formatId" = ${format || 'standard'}
      AND d."updatedAt" > NOW() - INTERVAL '30 days'
      GROUP BY c.id
      ORDER BY usage_count DESC
      LIMIT ${limit}
    `;

    await redis.setex(cacheKey, this.SUGGESTION_CACHE_TTL, JSON.stringify(popularCards));

    return popularCards;
  }

  private buildWhereClause(
    filters: CardSearchFilters,
    deckCardIds?: string[]
  ): Prisma.CardWhereInput {
    const where: Prisma.CardWhereInput = {};

    if (filters.text) {
      where.OR = [
        { name: { contains: filters.text, mode: 'insensitive' } },
        { flavorText: { contains: filters.text, mode: 'insensitive' } },
        { artistName: { contains: filters.text, mode: 'insensitive' } },
        { rules: { hasSome: [filters.text] } },
      ];
    }

    if (filters.types && filters.types.length > 0) {
      where.supertype = { in: filters.types };
    }

    if (filters.sets && filters.sets.length > 0) {
      where.setId = { in: filters.sets };
    }

    if (filters.rarities && filters.rarities.length > 0) {
      where.rarity = { in: filters.rarities };
    }

    if (filters.energyCost && filters.energyCost.length > 0) {
      where.convertedRetreatCost = { in: filters.energyCost };
    }

    if (filters.hp) {
      const hpWhere: any = {};
      if (filters.hp.min !== undefined) {
        hpWhere.gte = filters.hp.min;
      }
      if (filters.hp.max !== undefined) {
        hpWhere.lte = filters.hp.max;
      }
      where.hp = hpWhere;
    }

    if (filters.formatLegality) {
      where.legalities = {
        path: [filters.formatLegality],
        equals: true,
      };
    }

    if (filters.inCurrentDeck === false && deckCardIds) {
      where.id = { notIn: deckCardIds };
    }

    return where;
  }

  private buildOrderBy(filters: CardSearchFilters): Prisma.CardOrderByWithRelationInput[] {
    const orderBy: Prisma.CardOrderByWithRelationInput[] = [];

    // If searching by text, order by relevance (would need full-text search)
    if (filters.text) {
      orderBy.push({ name: 'asc' });
    } else {
      // Default ordering
      orderBy.push(
        { set: { releaseDate: 'desc' } },
        { number: 'asc' }
      );
    }

    return orderBy;
  }

  private buildCacheKey(
    filters: CardSearchFilters,
    page: number,
    pageSize: number
  ): string {
    const filterStr = JSON.stringify(filters);
    const hash = Buffer.from(filterStr).toString('base64');
    return `search:${hash}:${page}:${pageSize}`;
  }

  private calculateRelevance(text: string, query: string): number {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact match
    if (lowerText === lowerQuery) return 100;

    // Starts with query
    if (lowerText.startsWith(lowerQuery)) return 80;

    // Contains query
    if (lowerText.includes(lowerQuery)) return 60;

    // Fuzzy match (simple Levenshtein distance)
    const distance = this.levenshteinDistance(lowerText, lowerQuery);
    const maxLength = Math.max(lowerText.length, lowerQuery.length);
    const similarity = 1 - distance / maxLength;

    return Math.round(similarity * 40);
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private generateCategorySuggestions(query: string): SearchSuggestion[] {
    const categories = [
      { name: 'Trainer Cards', value: 'trainer', keywords: ['trainer', 'item', 'supporter', 'stadium'] },
      { name: 'Pokemon Cards', value: 'pokemon', keywords: ['pokemon', 'basic', 'stage', 'ex', 'v', 'vmax'] },
      { name: 'Energy Cards', value: 'energy', keywords: ['energy', 'basic', 'special'] },
      { name: 'Fire Types', value: 'fire', keywords: ['fire', 'flame', 'burn'] },
      { name: 'Water Types', value: 'water', keywords: ['water', 'aqua', 'rain'] },
      { name: 'Grass Types', value: 'grass', keywords: ['grass', 'leaf', 'forest'] },
      { name: 'Lightning Types', value: 'lightning', keywords: ['lightning', 'electric', 'thunder'] },
      { name: 'Psychic Types', value: 'psychic', keywords: ['psychic', 'ghost', 'mind'] },
      { name: 'Fighting Types', value: 'fighting', keywords: ['fighting', 'combat', 'martial'] },
    ];

    const suggestions: SearchSuggestion[] = [];
    const lowerQuery = query.toLowerCase();

    categories.forEach(category => {
      const matches = category.keywords.some(keyword => 
        keyword.includes(lowerQuery) || lowerQuery.includes(keyword)
      );

      if (matches) {
        suggestions.push({
          type: 'category',
          value: category.value,
          displayName: category.name,
          relevance: 50,
        });
      }
    });

    return suggestions;
  }

  private async generateComboSuggestions(query: string): Promise<SearchSuggestion[]> {
    // Would implement combo detection based on card synergies
    // For now, return common combos if they match the query
    const commonCombos = [
      { name: 'Arceus VSTAR + Bibarel', cards: ['arceus', 'bibarel'] },
      { name: 'Lugia VSTAR + Archeops', cards: ['lugia', 'archeops'] },
      { name: 'Lost Box Engine', cards: ['comfey', 'sableye', 'cross'] },
      { name: 'Mew VMAX + Genesect V', cards: ['mew', 'genesect'] },
      { name: 'Palkia VSTAR + Irida', cards: ['palkia', 'irida'] },
    ];

    const suggestions: SearchSuggestion[] = [];
    const lowerQuery = query.toLowerCase();

    commonCombos.forEach(combo => {
      const matches = combo.cards.some(card => 
        card.includes(lowerQuery) || lowerQuery.includes(card)
      );

      if (matches) {
        suggestions.push({
          type: 'combo',
          value: combo.cards.join(','),
          displayName: combo.name,
          relevance: 70,
        });
      }
    });

    return suggestions;
  }

  async trackCardView(userId: string, cardId: string): Promise<void> {
    const key = `recent:${userId}`;
    const recentIds = await redis.lrange(key, 0, -1);
    
    // Remove if already exists
    await redis.lrem(key, 0, cardId);
    
    // Add to front
    await redis.lpush(key, cardId);
    
    // Trim to limit
    await redis.ltrim(key, 0, 19); // Keep last 20
    
    // Set expiry
    await redis.expire(key, 86400); // 24 hours
  }

  async getCardsByIds(cardIds: string[]): Promise<Card[]> {
    if (cardIds.length === 0) return [];

    return prisma.card.findMany({
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

  async getOwnedCardQuantities(
    userId: string,
    cardIds: string[]
  ): Promise<Map<string, number>> {
    const ownedCards = await prisma.userCollection.findMany({
      where: {
        userId,
        cardId: { in: cardIds },
      },
      select: {
        cardId: true,
        quantity: true,
      },
    });

    const quantityMap = new Map<string, number>();
    ownedCards.forEach(oc => {
      quantityMap.set(oc.cardId, oc.quantity);
    });

    return quantityMap;
  }
}