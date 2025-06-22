import { prisma } from '@/server/db/prisma';
import type { Prisma } from '@prisma/client';
import { searchCache } from '@/lib/api/cache';
import crypto from 'crypto';
import type {
  CollectionSearchFilters,
  CollectionSearchResult,
  SearchSuggestion,
  SearchFacets,
  CollectionCard,
} from './types';

export class CollectionSearchEngine {
  private readonly SEARCH_CACHE_TTL = 300; // 5 minutes
  private readonly MAX_SUGGESTIONS = 10;
  private readonly FACET_LIMIT = 20;

  /**
   * Perform advanced search on user's collection
   */
  async search(
    userId: string,
    filters: CollectionSearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<CollectionSearchResult> {
    const startTime = Date.now();
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(userId, filters, page, pageSize);
    
    // Check cache
    const cached = await searchCache.get<CollectionSearchResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Build search query
    const where = this.buildWhereClause(userId, filters);
    
    // Execute search with facets
    const [cards, totalCount, facets] = await Promise.all([
      this.executeSearch(where, page, pageSize, filters),
      this.getCount(where),
      this.calculateFacets(userId, where),
    ]);

    // Generate suggestions if text search
    const suggestions = filters.text 
      ? await this.generateSuggestions(userId, filters.text)
      : [];

    const result: CollectionSearchResult = {
      cards,
      totalCount,
      facets,
      suggestions,
      executionTime: Date.now() - startTime,
    };

    // Cache result
    await searchCache.set(cacheKey, result, this.SEARCH_CACHE_TTL);

    return result;
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(
    userId: string,
    filters: CollectionSearchFilters
  ): Prisma.UserCollectionWhereInput {
    const where: Prisma.UserCollectionWhereInput = {
      userId,
    };

    // Text search across multiple fields
    if (filters.text) {
      const searchTerms = this.parseSearchTerms(filters.text);
      where.OR = [
        {
          card: {
            name: {
              contains: searchTerms.join(' '),
              mode: 'insensitive',
            },
          },
        },
        {
          card: {
            flavorText: {
              contains: searchTerms.join(' '),
              mode: 'insensitive',
            },
          },
        },
        {
          card: {
            abilities: {
              path: '$[*].text',
              string_contains: searchTerms.join(' '),
            },
          },
        },
        {
          card: {
            attacks: {
              path: '$[*].text',
              string_contains: searchTerms.join(' '),
            },
          },
        },
        // Support for tag search
        {
          tags: {
            hasSome: searchTerms,
          },
        },
      ];
    }

    // Set filter
    if (filters.sets?.length) {
      where.card = {
        ...where.card,
        setId: { in: filters.sets },
      };
    }

    // Type filter
    if (filters.types?.length) {
      where.card = {
        ...where.card,
        supertype: { in: filters.types },
      };
    }

    // Rarity filter
    if (filters.rarities?.length) {
      where.card = {
        ...where.card,
        rarity: { in: filters.rarities },
      };
    }

    // Format filter
    if (filters.formats?.length) {
      where.card = {
        ...where.card,
        formats: {
          some: {
            formatId: { in: filters.formats },
          },
        },
      };
    }

    // Energy cost range
    if (filters.energyCost) {
      where.card = {
        ...where.card,
        convertedRetreatCost: {
          gte: filters.energyCost.min,
          lte: filters.energyCost.max,
        },
      };
    }

    // HP range
    if (filters.hp) {
      where.card = {
        ...where.card,
        hp: {
          gte: filters.hp.min.toString(),
          lte: filters.hp.max.toString(),
        },
      };
    }

    // Condition filter
    if (filters.conditions?.length) {
      where.condition = { in: filters.conditions };
    }

    // Quantity range
    if (filters.quantities) {
      where.quantity = {
        gte: filters.quantities.min,
        lte: filters.quantities.max,
      };
    }

    // Acquisition date range
    if (filters.acquisitionDate) {
      where.acquiredAt = {
        gte: filters.acquisitionDate.start,
        lte: filters.acquisitionDate.end,
      };
    }

    // Value range (requires join with price data)
    if (filters.value) {
      where.card = {
        ...where.card,
        prices: {
          some: {
            marketPrice: {
              gte: filters.value.min,
              lte: filters.value.max,
            },
          },
        },
      };
    }

    // Tradable filter
    if (filters.tradable !== undefined) {
      where.forTrade = filters.tradable;
    }

    // In deck filter
    if (filters.inDeck !== undefined) {
      if (filters.inDeck) {
        where.card = {
          ...where.card,
          deckCards: {
            some: {},
          },
        };
      } else {
        where.card = {
          ...where.card,
          deckCards: {
            none: {},
          },
        };
      }
    }

    // Tags filter
    if (filters.tags?.length) {
      where.tags = {
        hasSome: filters.tags,
      };
    }

    // Storage location filter
    if (filters.storageLocations?.length) {
      where.location = { in: filters.storageLocations };
    }

    // Owned filter
    if (filters.owned !== undefined) {
      if (filters.owned) {
        where.quantity = { gt: 0 };
      } else {
        where.quantity = 0;
      }
    }

    return where;
  }

  /**
   * Parse search terms with boolean operators
   */
  private parseSearchTerms(text: string): string[] {
    // Handle quoted phrases
    const quotedPhrases = text.match(/"([^"]+)"/g) || [];
    let remaining = text;
    
    quotedPhrases.forEach(phrase => {
      remaining = remaining.replace(phrase, '');
    });

    // Extract individual words
    const words = remaining
      .split(/\s+/)
      .filter(word => word.length > 0 && !['AND', 'OR', 'NOT'].includes(word));

    // Combine quoted phrases and words
    const terms = [
      ...quotedPhrases.map(p => p.replace(/"/g, '')),
      ...words,
    ];

    return terms;
  }

  /**
   * Execute search query
   */
  private async executeSearch(
    where: Prisma.UserCollectionWhereInput,
    page: number,
    pageSize: number,
    filters: CollectionSearchFilters
  ): Promise<CollectionCard[]> {
    const skip = (page - 1) * pageSize;

    // Determine sort order
    const orderBy = this.buildOrderBy(filters);

    const results = await prisma.userCollection.findMany({
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
      },
      orderBy,
      skip,
      take: pageSize,
    });

    return results as CollectionCard[];
  }

  /**
   * Build order by clause based on filters
   */
  private buildOrderBy(filters: CollectionSearchFilters): any {
    // Default sort by acquisition date
    let orderBy: any = { acquiredAt: 'desc' };

    // If searching by value, sort by price
    if (filters.value) {
      orderBy = {
        card: {
          prices: {
            _max: {
              marketPrice: 'desc',
            },
          },
        },
      };
    }

    // If text search, relevance is handled by PostgreSQL
    if (filters.text) {
      // Would need full-text search for true relevance sorting
      orderBy = { updatedAt: 'desc' };
    }

    return orderBy;
  }

  /**
   * Get total count for pagination
   */
  private async getCount(where: Prisma.UserCollectionWhereInput): Promise<number> {
    return await prisma.userCollection.count({ where });
  }

  /**
   * Calculate search facets
   */
  private async calculateFacets(
    userId: string,
    where: Prisma.UserCollectionWhereInput
  ): Promise<SearchFacets> {
    // Get base collection for facets (without current filters)
    const baseFacets = await prisma.userCollection.groupBy({
      by: ['cardId'],
      where: { userId },
      _count: true,
    });

    // Set facets
    const setFacets = await prisma.userCollection.findMany({
      where: { userId },
      include: {
        card: {
          include: { set: true },
        },
      },
      distinct: ['cardId'],
    });

    const setMap = new Map<string, number>();
    setFacets.forEach(item => {
      const setId = item.card.setId;
      setMap.set(setId, (setMap.get(setId) || 0) + 1);
    });

    const sets = Array.from(setMap.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, this.FACET_LIMIT);

    // Type facets
    const typeFacets = await prisma.card.groupBy({
      by: ['supertype'],
      where: {
        userCollections: {
          some: { userId },
        },
      },
      _count: true,
    });

    const types = typeFacets.map(t => ({
      value: t.supertype,
      count: t._count,
    }));

    // Rarity facets
    const rarityFacets = await prisma.card.groupBy({
      by: ['rarity'],
      where: {
        userCollections: {
          some: { userId },
        },
      },
      _count: true,
    });

    const rarities = rarityFacets.map(r => ({
      value: r.rarity,
      count: r._count,
    }));

    // Condition facets
    const conditionFacets = await prisma.userCollection.groupBy({
      by: ['condition'],
      where: { userId },
      _count: true,
    });

    const conditions = conditionFacets.map(c => ({
      value: c.condition,
      count: c._count,
    }));

    // Price range facets
    const priceRanges = [
      { range: '$0-$10', count: 0 },
      { range: '$10-$50', count: 0 },
      { range: '$50-$100', count: 0 },
      { range: '$100-$500', count: 0 },
      { range: '$500+', count: 0 },
    ];

    // Would need to query price data for accurate counts
    // This is a simplified version

    return {
      sets,
      types,
      rarities,
      conditions,
      priceRanges,
    };
  }

  /**
   * Generate search suggestions
   */
  private async generateSuggestions(
    userId: string,
    query: string
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    const lowerQuery = query.toLowerCase();

    // Card name suggestions
    const cardSuggestions = await prisma.card.findMany({
      where: {
        userCollections: {
          some: { userId },
        },
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: { userCollections: true },
        },
      },
      take: 5,
    });

    cardSuggestions.forEach(card => {
      suggestions.push({
        type: 'card',
        value: card.id,
        displayText: card.name,
        count: card._count.userCollections,
      });
    });

    // Set suggestions
    const setSuggestions = await prisma.set.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
        ],
        cards: {
          some: {
            userCollections: {
              some: { userId },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      take: 3,
    });

    setSuggestions.forEach(set => {
      suggestions.push({
        type: 'set',
        value: set.id,
        displayText: `${set.name} (${set.code})`,
      });
    });

    // Tag suggestions
    const userCollections = await prisma.userCollection.findMany({
      where: {
        userId,
        tags: {
          hasSome: [query],
        },
      },
      select: {
        tags: true,
      },
      distinct: ['tags'],
    });

    const tagMap = new Map<string, number>();
    userCollections.forEach(uc => {
      uc.tags.forEach(tag => {
        if (tag.toLowerCase().includes(lowerQuery)) {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        }
      });
    });

    Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([tag, count]) => {
        suggestions.push({
          type: 'tag',
          value: tag,
          displayText: tag,
          count,
        });
      });

    return suggestions.slice(0, this.MAX_SUGGESTIONS);
  }

  /**
   * Generate cache key for search results
   */
  private generateCacheKey(
    userId: string,
    filters: CollectionSearchFilters,
    page: number,
    pageSize: number
  ): string {
    const filterString = JSON.stringify(filters);
    const hash = crypto.createHash('md5').update(filterString).digest('hex');
    return `collection:search:${userId}:${hash}:${page}:${pageSize}`;
  }

  /**
   * Perform fuzzy search for card names
   */
  async fuzzySearch(
    userId: string,
    query: string,
    limit = 10
  ): Promise<CollectionCard[]> {
    // This would ideally use a proper fuzzy search algorithm
    // For now, using simple LIKE queries
    const results = await prisma.userCollection.findMany({
      where: {
        userId,
        card: {
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              name: {
                startsWith: query,
                mode: 'insensitive',
              },
            },
          ],
        },
      },
      include: {
        card: true,
      },
      take: limit,
    });

    return results as CollectionCard[];
  }

  /**
   * Get search history for user
   */
  async getSearchHistory(userId: string, limit = 10): Promise<SavedSearch[]> {
    return await prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { lastUsed: 'desc' },
      take: limit,
    });
  }

  /**
   * Save a search for quick access
   */
  async saveSearch(
    userId: string,
    name: string,
    filters: CollectionSearchFilters
  ): Promise<SavedSearch> {
    return await prisma.savedSearch.create({
      data: {
        userId,
        name,
        filters: filters as any, // JSON field
        useCount: 0,
      },
    });
  }

  /**
   * Update search usage
   */
  async recordSearchUsage(searchId: string): Promise<void> {
    await prisma.savedSearch.update({
      where: { id: searchId },
      data: {
        lastUsed: new Date(),
        useCount: { increment: 1 },
      },
    });
  }
}