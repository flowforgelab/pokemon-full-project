import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import type {
  CollectionTag,
  CollectionFolder,
  CardNote,
  CollectionView,
  StorageLocation,
  CollectionCard,
} from './types';

// Validation schemas
const tagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), // Hex color
});

const folderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false),
});

const noteSchema = z.object({
  note: z.string().max(1000),
  rating: z.number().min(1).max(5).optional(),
  memories: z.string().max(2000).optional(),
});

export class CollectionOrganizationManager {
  /**
   * Create a new tag
   */
  async createTag(
    userId: string,
    data: { name: string; color: string }
  ): Promise<CollectionTag> {
    const validated = tagSchema.parse(data);

    // Check if tag already exists
    const existing = await prisma.collectionTag.findFirst({
      where: {
        userId,
        name: validated.name,
      },
    });

    if (existing) {
      throw new Error('Tag already exists');
    }

    return await prisma.collectionTag.create({
      data: {
        userId,
        ...validated,
        cardCount: 0,
      },
    });
  }

  /**
   * Get all tags for user
   */
  async getUserTags(userId: string): Promise<CollectionTag[]> {
    const tags = await prisma.collectionTag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });

    // Update card counts
    for (const tag of tags) {
      const count = await prisma.userCollection.count({
        where: {
          userId,
          tags: { has: tag.name },
        },
      });
      tag.cardCount = count;
    }

    return tags;
  }

  /**
   * Apply tags to cards
   */
  async applyTags(
    userId: string,
    collectionIds: string[],
    tagNames: string[]
  ): Promise<number> {
    // Verify tags exist
    const tags = await prisma.collectionTag.findMany({
      where: {
        userId,
        name: { in: tagNames },
      },
    });

    if (tags.length !== tagNames.length) {
      throw new Error('Some tags do not exist');
    }

    // Update collections
    const result = await prisma.userCollection.updateMany({
      where: {
        id: { in: collectionIds },
        userId,
      },
      data: {
        tags: {
          push: tagNames,
        },
        updatedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Remove tags from cards
   */
  async removeTags(
    userId: string,
    collectionIds: string[],
    tagNames: string[]
  ): Promise<number> {
    // Get current tags for each collection
    const collections = await prisma.userCollection.findMany({
      where: {
        id: { in: collectionIds },
        userId,
      },
      select: { id: true, tags: true },
    });

    let updated = 0;
    for (const collection of collections) {
      const newTags = collection.tags.filter(tag => !tagNames.includes(tag));
      
      await prisma.userCollection.update({
        where: { id: collection.id },
        data: {
          tags: newTags,
          updatedAt: new Date(),
        },
      });
      updated++;
    }

    return updated;
  }

  /**
   * Create a collection folder
   */
  async createFolder(
    userId: string,
    data: { name: string; description?: string; isPublic?: boolean }
  ): Promise<CollectionFolder> {
    const validated = folderSchema.parse(data);

    return await prisma.collectionFolder.create({
      data: {
        userId,
        ...validated,
        cardIds: [],
      },
    });
  }

  /**
   * Add cards to folder
   */
  async addToFolder(
    userId: string,
    folderId: string,
    cardIds: string[]
  ): Promise<CollectionFolder> {
    const folder = await prisma.collectionFolder.findFirst({
      where: { id: folderId, userId },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Verify user owns these cards
    const ownedCards = await prisma.userCollection.findMany({
      where: {
        userId,
        cardId: { in: cardIds },
      },
      select: { cardId: true },
    });

    const ownedCardIds = ownedCards.map(c => c.cardId);
    const newCardIds = [...new Set([...folder.cardIds, ...ownedCardIds])];

    return await prisma.collectionFolder.update({
      where: { id: folderId },
      data: {
        cardIds: newCardIds,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Remove cards from folder
   */
  async removeFromFolder(
    userId: string,
    folderId: string,
    cardIds: string[]
  ): Promise<CollectionFolder> {
    const folder = await prisma.collectionFolder.findFirst({
      where: { id: folderId, userId },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    const newCardIds = folder.cardIds.filter(id => !cardIds.includes(id));

    return await prisma.collectionFolder.update({
      where: { id: folderId },
      data: {
        cardIds: newCardIds,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get user's folders
   */
  async getUserFolders(userId: string): Promise<CollectionFolder[]> {
    return await prisma.collectionFolder.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Add or update card notes
   */
  async setCardNote(
    userId: string,
    cardId: string,
    data: { note: string; rating?: number; memories?: string }
  ): Promise<CardNote> {
    const validated = noteSchema.parse(data);

    // Check if user owns this card
    const owned = await prisma.userCollection.findFirst({
      where: { userId, cardId },
    });

    if (!owned) {
      throw new Error('Card not in collection');
    }

    return await prisma.cardNote.upsert({
      where: {
        cardId_userId: { cardId, userId },
      },
      create: {
        cardId,
        userId,
        ...validated,
      },
      update: {
        ...validated,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get card notes
   */
  async getCardNote(userId: string, cardId: string): Promise<CardNote | null> {
    return await prisma.cardNote.findUnique({
      where: {
        cardId_userId: { cardId, userId },
      },
    });
  }

  /**
   * Mark cards as favorites
   */
  async toggleFavorite(
    userId: string,
    collectionIds: string[]
  ): Promise<number> {
    // Toggle favorite status using a special tag
    const favoriteTag = await this.createTag(userId, {
      name: '⭐ Favorite',
      color: '#FFD700',
    }).catch(() => null);

    if (!favoriteTag) {
      // Tag already exists, get it
      const existing = await prisma.collectionTag.findFirst({
        where: { userId, name: '⭐ Favorite' },
      });
      if (!existing) throw new Error('Could not create favorite tag');
    }

    // Check current status
    const collections = await prisma.userCollection.findMany({
      where: {
        id: { in: collectionIds },
        userId,
      },
      select: { id: true, tags: true },
    });

    let toggled = 0;
    for (const collection of collections) {
      const isFavorite = collection.tags.includes('⭐ Favorite');
      
      if (isFavorite) {
        await this.removeTags(userId, [collection.id], ['⭐ Favorite']);
      } else {
        await this.applyTags(userId, [collection.id], ['⭐ Favorite']);
      }
      toggled++;
    }

    return toggled;
  }

  /**
   * Update storage location
   */
  async updateStorageLocation(
    userId: string,
    collectionIds: string[],
    location: StorageLocation
  ): Promise<number> {
    const result = await prisma.userCollection.updateMany({
      where: {
        id: { in: collectionIds },
        userId,
      },
      data: {
        location,
        updatedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Get cards by storage location
   */
  async getCardsByLocation(
    userId: string,
    location: StorageLocation
  ): Promise<CollectionCard[]> {
    const cards = await prisma.userCollection.findMany({
      where: {
        userId,
        location,
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
      },
      orderBy: [
        { card: { name: 'asc' } },
        { condition: 'asc' },
      ],
    });

    return cards as CollectionCard[];
  }

  /**
   * Create custom collection view
   */
  async saveCollectionView(
    userId: string,
    name: string,
    view: CollectionView
  ): Promise<string> {
    const viewData = await prisma.savedView.create({
      data: {
        userId,
        name,
        viewConfig: view as any, // JSON field
      },
    });

    return viewData.id;
  }

  /**
   * Get saved collection views
   */
  async getSavedViews(userId: string): Promise<{ id: string; name: string; view: CollectionView }[]> {
    const views = await prisma.savedView.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return views.map(v => ({
      id: v.id,
      name: v.name,
      view: v.viewConfig as CollectionView,
    }));
  }

  /**
   * Sort collection by various criteria
   */
  async sortCollection(
    collection: CollectionCard[],
    sortBy: string,
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<CollectionCard[]> {
    const sorted = [...collection];

    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => {
          const result = a.card.name.localeCompare(b.card.name);
          return sortOrder === 'asc' ? result : -result;
        });
        break;

      case 'value':
        sorted.sort((a, b) => {
          const aValue = a.card.prices?.[0]?.marketPrice || 0;
          const bValue = b.card.prices?.[0]?.marketPrice || 0;
          const result = aValue - bValue;
          return sortOrder === 'asc' ? result : -result;
        });
        break;

      case 'rarity':
        const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Rare Holo', 
          'Rare Ultra', 'Rare Secret', 'Rare Rainbow', 'Amazing Rare'];
        sorted.sort((a, b) => {
          const aIndex = rarityOrder.indexOf(a.card.rarity);
          const bIndex = rarityOrder.indexOf(b.card.rarity);
          const result = aIndex - bIndex;
          return sortOrder === 'asc' ? result : -result;
        });
        break;

      case 'dateAcquired':
        sorted.sort((a, b) => {
          const result = a.acquiredAt.getTime() - b.acquiredAt.getTime();
          return sortOrder === 'asc' ? result : -result;
        });
        break;

      case 'set':
        sorted.sort((a, b) => {
          const result = a.card.set.releaseDate.getTime() - b.card.set.releaseDate.getTime();
          return sortOrder === 'asc' ? result : -result;
        });
        break;

      case 'quantity':
        sorted.sort((a, b) => {
          const result = a.quantity - b.quantity;
          return sortOrder === 'asc' ? result : -result;
        });
        break;

      case 'condition':
        const conditionOrder = ['DAMAGED', 'HEAVILY_PLAYED', 'MODERATELY_PLAYED', 
          'LIGHTLY_PLAYED', 'NEAR_MINT', 'MINT'];
        sorted.sort((a, b) => {
          const aIndex = conditionOrder.indexOf(a.condition);
          const bIndex = conditionOrder.indexOf(b.condition);
          const result = aIndex - bIndex;
          return sortOrder === 'asc' ? result : -result;
        });
        break;
    }

    return sorted;
  }

  /**
   * Group collection by criteria
   */
  groupCollection(
    collection: CollectionCard[],
    groupBy: string
  ): Map<string, CollectionCard[]> {
    const groups = new Map<string, CollectionCard[]>();

    collection.forEach(item => {
      let key: string;

      switch (groupBy) {
        case 'set':
          key = item.card.set.name;
          break;
        case 'type':
          key = item.card.supertype;
          break;
        case 'rarity':
          key = item.card.rarity;
          break;
        case 'condition':
          key = item.condition;
          break;
        case 'location':
          key = item.location;
          break;
        default:
          key = 'Other';
      }

      const group = groups.get(key) || [];
      group.push(item);
      groups.set(key, group);
    });

    return groups;
  }

  /**
   * Get collection organization summary
   */
  async getOrganizationSummary(userId: string): Promise<{
    totalTags: number;
    totalFolders: number;
    totalNotes: number;
    favoriteCount: number;
    locationBreakdown: Record<StorageLocation, number>;
  }> {
    const [tags, folders, notes, favorites, locations] = await Promise.all([
      prisma.collectionTag.count({ where: { userId } }),
      prisma.collectionFolder.count({ where: { userId } }),
      prisma.cardNote.count({ where: { userId } }),
      prisma.userCollection.count({
        where: {
          userId,
          tags: { has: '⭐ Favorite' },
        },
      }),
      prisma.userCollection.groupBy({
        by: ['location'],
        where: { userId },
        _count: true,
      }),
    ]);

    const locationBreakdown: Record<string, number> = {};
    locations.forEach(loc => {
      locationBreakdown[loc.location] = loc._count;
    });

    return {
      totalTags: tags,
      totalFolders: folders,
      totalNotes: notes,
      favoriteCount: favorites,
      locationBreakdown: locationBreakdown as Record<StorageLocation, number>,
    };
  }
}