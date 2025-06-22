import { prisma } from '@/lib/db/prisma';
import { redis } from '@/lib/db/redis';

export class CollectionSearchIndexer {
  private readonly INDEX_PREFIX = 'search:index:';
  private readonly SUGGESTION_PREFIX = 'search:suggest:';

  /**
   * Index user's collection for fast search
   */
  async indexUserCollection(userId: string): Promise<void> {
    console.log(`Indexing collection for user ${userId}...`);

    // Get all user's collection items
    const collection = await prisma.userCollection.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            set: true,
          },
        },
      },
    });

    // Create search indexes
    const searchIndexes = new Map<string, Set<string>>();
    const suggestions = new Map<string, number>();

    for (const item of collection) {
      const cardId = item.cardId;
      const card = item.card;

      // Index by card name
      this.indexText(card.name, cardId, searchIndexes);
      this.addSuggestion(card.name, suggestions);

      // Index by set name
      this.indexText(card.set.name, cardId, searchIndexes);
      this.addSuggestion(card.set.name, suggestions);

      // Index by types
      card.types.forEach(type => {
        this.indexText(type, cardId, searchIndexes);
      });

      // Index by subtypes
      card.subtypes.forEach(subtype => {
        this.indexText(subtype, cardId, searchIndexes);
      });

      // Index by tags
      item.tags.forEach(tag => {
        this.indexText(tag, cardId, searchIndexes);
        this.addSuggestion(tag, suggestions);
      });

      // Index by artist
      if (card.artist) {
        this.indexText(card.artist, cardId, searchIndexes);
      }

      // Index by abilities
      if (card.abilities) {
        const abilities = card.abilities as any[];
        abilities.forEach(ability => {
          if (ability.name) {
            this.indexText(ability.name, cardId, searchIndexes);
          }
        });
      }
    }

    // Store indexes in Redis
    const pipeline = redis.pipeline();

    // Clear old indexes
    const oldKeys = await redis.keys(`${this.INDEX_PREFIX}${userId}:*`);
    oldKeys.forEach(key => pipeline.del(key));

    // Store new indexes
    for (const [term, cardIds] of searchIndexes) {
      const key = `${this.INDEX_PREFIX}${userId}:${term}`;
      pipeline.sadd(key, ...Array.from(cardIds));
      pipeline.expire(key, 86400); // 24 hours
    }

    // Store suggestions
    const suggestionKey = `${this.SUGGESTION_PREFIX}${userId}`;
    pipeline.del(suggestionKey);
    
    const sortedSuggestions = Array.from(suggestions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1000); // Keep top 1000 suggestions

    for (const [term, score] of sortedSuggestions) {
      pipeline.zadd(suggestionKey, score, term);
    }
    pipeline.expire(suggestionKey, 86400);

    await pipeline.exec();

    console.log(`Indexed ${collection.length} cards with ${searchIndexes.size} search terms`);
  }

  /**
   * Search indexed collection
   */
  async searchIndex(
    userId: string,
    query: string,
    limit = 50
  ): Promise<string[]> {
    const terms = this.tokenize(query);
    if (terms.length === 0) return [];

    // Get card IDs for each term
    const termResults: string[][] = [];
    
    for (const term of terms) {
      const key = `${this.INDEX_PREFIX}${userId}:${term}`;
      const cardIds = await redis.smembers(key);
      
      if (cardIds.length > 0) {
        termResults.push(cardIds);
      }
    }

    if (termResults.length === 0) return [];

    // Find intersection of all term results
    let results = new Set(termResults[0]);
    
    for (let i = 1; i < termResults.length; i++) {
      const termSet = new Set(termResults[i]);
      results = new Set([...results].filter(id => termSet.has(id)));
    }

    return Array.from(results).slice(0, limit);
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(
    userId: string,
    prefix: string,
    limit = 10
  ): Promise<string[]> {
    if (prefix.length < 2) return [];

    const key = `${this.SUGGESTION_PREFIX}${userId}`;
    const normalizedPrefix = prefix.toLowerCase();

    // Get all suggestions and filter by prefix
    const allSuggestions = await redis.zrevrange(key, 0, -1);
    
    const matches = allSuggestions
      .filter(s => s.toLowerCase().startsWith(normalizedPrefix))
      .slice(0, limit);

    return matches;
  }

  /**
   * Update index for specific cards
   */
  async updateCardIndex(
    userId: string,
    cardIds: string[]
  ): Promise<void> {
    // For simplicity, re-index entire collection
    // In production, would do incremental updates
    await this.indexUserCollection(userId);
  }

  /**
   * Clear user's search index
   */
  async clearIndex(userId: string): Promise<void> {
    const keys = await redis.keys(`${this.INDEX_PREFIX}${userId}:*`);
    const suggestionKey = `${this.SUGGESTION_PREFIX}${userId}`;
    
    if (keys.length > 0) {
      await redis.del(...keys, suggestionKey);
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(userId: string): Promise<{
    termCount: number;
    suggestionCount: number;
    memoryUsage: number;
  }> {
    const keys = await redis.keys(`${this.INDEX_PREFIX}${userId}:*`);
    const suggestionKey = `${this.SUGGESTION_PREFIX}${userId}`;
    const suggestionCount = await redis.zcard(suggestionKey);

    // Estimate memory usage (rough approximation)
    let memoryUsage = 0;
    for (const key of keys) {
      const size = await redis.memory('usage', key);
      memoryUsage += size || 0;
    }

    return {
      termCount: keys.length,
      suggestionCount,
      memoryUsage,
    };
  }

  // Private helper methods

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  private indexText(
    text: string,
    cardId: string,
    indexes: Map<string, Set<string>>
  ): void {
    const tokens = this.tokenize(text);
    
    for (const token of tokens) {
      // Skip very short tokens
      if (token.length < 2) continue;

      // Full token
      const existing = indexes.get(token) || new Set();
      existing.add(cardId);
      indexes.set(token, existing);

      // Prefixes for autocomplete
      for (let i = 2; i <= Math.min(token.length, 5); i++) {
        const prefix = token.substring(0, i);
        const prefixSet = indexes.get(prefix) || new Set();
        prefixSet.add(cardId);
        indexes.set(prefix, prefixSet);
      }
    }
  }

  private addSuggestion(
    text: string,
    suggestions: Map<string, number>
  ): void {
    const normalized = text.toLowerCase().trim();
    if (normalized.length >= 2) {
      suggestions.set(normalized, (suggestions.get(normalized) || 0) + 1);
    }
  }
}

// Background job to index collections
export async function indexAllCollections(): Promise<void> {
  const indexer = new CollectionSearchIndexer();
  
  // Get all users with collections
  const users = await prisma.user.findMany({
    where: {
      collections: {
        some: {},
      },
    },
    select: { id: true },
  });

  console.log(`Indexing collections for ${users.length} users...`);

  for (const user of users) {
    try {
      await indexer.indexUserCollection(user.id);
    } catch (error) {
      console.error(`Failed to index collection for user ${user.id}:`, error);
    }
  }

  console.log('Collection indexing complete');
}

// Job to clean up old indexes
export async function cleanupOldIndexes(): Promise<void> {
  const keys = await redis.keys('search:*');
  let cleaned = 0;

  for (const key of keys) {
    const ttl = await redis.ttl(key);
    // Remove keys without TTL or expired
    if (ttl === -1 || ttl === -2) {
      await redis.del(key);
      cleaned++;
    }
  }

  console.log(`Cleaned up ${cleaned} old search indexes`);
}