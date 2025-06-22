import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import type {
  QuickAddItem,
  BulkAddResult,
  CardCondition,
  AcquisitionSource,
  StorageLocation,
  CollectionCard,
} from './types';

// Validation schemas
const quickAddItemSchema = z.object({
  cardName: z.string().min(1).max(200),
  setCode: z.string().optional(),
  quantity: z.number().int().min(1).max(999),
  condition: z.nativeEnum(CardCondition),
  purchasePrice: z.number().min(0).optional(),
  source: z.nativeEnum(AcquisitionSource),
  location: z.nativeEnum(StorageLocation),
  notes: z.string().max(500).optional(),
});

const bulkAddSchema = z.array(quickAddItemSchema).max(100);

export class QuickAddManager {
  /**
   * Add a single card to collection
   */
  async addSingleCard(
    userId: string,
    item: QuickAddItem
  ): Promise<CollectionCard> {
    // Validate input
    const validated = quickAddItemSchema.parse(item);

    // Find the card
    const card = await this.findCard(validated.cardName, validated.setCode);
    if (!card) {
      throw new Error(`Card not found: ${validated.cardName}`);
    }

    // Check if user already owns this card
    const existing = await prisma.userCollection.findUnique({
      where: {
        userId_cardId_condition_location: {
          userId,
          cardId: card.id,
          condition: validated.condition,
          location: validated.location,
        },
      },
    });

    if (existing) {
      // Update quantity
      const updated = await prisma.userCollection.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + validated.quantity,
          // Update purchase price if provided (weighted average)
          purchasePrice: validated.purchasePrice
            ? this.calculateWeightedAverage(
                existing.purchasePrice,
                existing.quantity,
                validated.purchasePrice,
                validated.quantity
              )
            : existing.purchasePrice,
          updatedAt: new Date(),
        },
        include: { card: true },
      });

      return updated as CollectionCard;
    } else {
      // Create new collection entry
      const created = await prisma.userCollection.create({
        data: {
          userId,
          cardId: card.id,
          quantity: validated.quantity,
          condition: validated.condition,
          purchasePrice: validated.purchasePrice || 0,
          source: validated.source,
          location: validated.location,
          notes: validated.notes,
          forTrade: false,
          onWishlist: false,
          tags: [],
          acquiredAt: new Date(),
        },
        include: { card: true },
      });

      return created as CollectionCard;
    }
  }

  /**
   * Bulk add multiple cards
   */
  async bulkAddCards(
    userId: string,
    items: QuickAddItem[]
  ): Promise<BulkAddResult> {
    // Validate all items
    const validated = bulkAddSchema.parse(items);

    const added: CollectionCard[] = [];
    const failed: { item: QuickAddItem; error: string }[] = [];

    // Process each item
    for (const item of validated) {
      try {
        const result = await this.addSingleCard(userId, item);
        added.push(result);
      } catch (error) {
        failed.push({
          item,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      added,
      failed,
      totalAdded: added.length,
      totalFailed: failed.length,
    };
  }

  /**
   * Add cards by set with checklist
   */
  async addBySet(
    userId: string,
    setId: string,
    selections: {
      cardId: string;
      quantity: number;
      condition: CardCondition;
      purchasePrice?: number;
    }[]
  ): Promise<BulkAddResult> {
    const added: CollectionCard[] = [];
    const failed: { item: any; error: string }[] = [];

    for (const selection of selections) {
      try {
        const card = await prisma.card.findUnique({
          where: { id: selection.cardId },
        });

        if (!card) {
          throw new Error('Card not found');
        }

        const item: QuickAddItem = {
          cardName: card.name,
          quantity: selection.quantity,
          condition: selection.condition,
          purchasePrice: selection.purchasePrice,
          source: AcquisitionSource.PURCHASE,
          location: StorageLocation.BINDER,
        };

        const result = await this.addSingleCard(userId, item);
        added.push(result);
      } catch (error) {
        failed.push({
          item: selection,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      added,
      failed,
      totalAdded: added.length,
      totalFailed: failed.length,
    };
  }

  /**
   * Quick add recently released cards
   */
  async getRecentlyReleasedCards(limit = 20): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSets = await prisma.set.findMany({
      where: {
        releaseDate: { gte: thirtyDaysAgo },
      },
      include: {
        cards: {
          take: limit,
          orderBy: { rarity: 'desc' },
          include: {
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { releaseDate: 'desc' },
    });

    return recentSets.flatMap(set => 
      set.cards.map(card => ({
        ...card,
        setName: set.name,
        setCode: set.code,
      }))
    );
  }

  /**
   * Get autocomplete suggestions for card names
   */
  async getCardSuggestions(
    query: string,
    limit = 10
  ): Promise<{ id: string; name: string; setName: string; setCode: string }[]> {
    if (query.length < 2) return [];

    const cards = await prisma.card.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      include: {
        set: {
          select: { name: true, code: true },
        },
      },
      take: limit,
      orderBy: [
        { rarity: 'desc' },
        { name: 'asc' },
      ],
    });

    return cards.map(card => ({
      id: card.id,
      name: card.name,
      setName: card.set.name,
      setCode: card.set.code,
    }));
  }

  /**
   * Import from barcode scan
   */
  async addByBarcode(
    userId: string,
    barcode: string,
    condition: CardCondition = CardCondition.NEAR_MINT,
    location: StorageLocation = StorageLocation.BINDER
  ): Promise<CollectionCard> {
    // Look up card by barcode (would need barcode field in database)
    // For now, this is a placeholder
    throw new Error('Barcode scanning not yet implemented');
  }

  /**
   * Add cards from a booster pack opening
   */
  async addPackOpening(
    userId: string,
    setId: string,
    cards: {
      cardId: string;
      isFoil: boolean;
    }[]
  ): Promise<BulkAddResult> {
    const items: QuickAddItem[] = cards.map(card => ({
      cardName: '', // Will be filled by addSingleCard
      quantity: 1,
      condition: CardCondition.MINT, // Pack fresh
      source: AcquisitionSource.PACK_OPENING,
      location: StorageLocation.BINDER,
      notes: card.isFoil ? 'Foil' : undefined,
    }));

    // Convert card IDs to names
    const cardDetails = await prisma.card.findMany({
      where: {
        id: { in: cards.map(c => c.cardId) },
      },
    });

    const cardMap = new Map(cardDetails.map(c => [c.id, c.name]));
    
    items.forEach((item, index) => {
      item.cardName = cardMap.get(cards[index].cardId) || '';
    });

    return this.bulkAddCards(userId, items);
  }

  /**
   * Quick update quantities for existing cards
   */
  async updateQuantities(
    userId: string,
    updates: {
      collectionId: string;
      newQuantity: number;
    }[]
  ): Promise<number> {
    let updated = 0;

    for (const update of updates) {
      try {
        await prisma.userCollection.update({
          where: {
            id: update.collectionId,
            userId, // Ensure user owns this collection item
          },
          data: {
            quantity: update.newQuantity,
            updatedAt: new Date(),
          },
        });
        updated++;
      } catch (error) {
        console.error(`Failed to update collection ${update.collectionId}:`, error);
      }
    }

    return updated;
  }

  /**
   * Get popular cards for quick add
   */
  async getPopularCards(format?: string, limit = 20): Promise<any[]> {
    // Get most collected cards
    const popularCards = await prisma.card.findMany({
      where: format ? {
        formats: {
          some: {
            format: {
              code: format,
            },
          },
        },
      } : undefined,
      include: {
        _count: {
          select: { userCollections: true },
        },
        set: {
          select: { name: true, code: true },
        },
        prices: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        userCollections: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return popularCards.map(card => ({
      ...card,
      popularity: card._count.userCollections,
      currentPrice: card.prices[0]?.marketPrice || 0,
    }));
  }

  /**
   * Voice input processing (future feature)
   */
  async processVoiceInput(
    userId: string,
    transcription: string
  ): Promise<QuickAddItem[]> {
    // Parse natural language input
    // Example: "Add 2 Charizard from Paldea Evolved in near mint condition"
    // This would require NLP processing
    
    // For now, return empty array
    return [];
  }

  // Private helper methods

  private async findCard(name: string, setCode?: string): Promise<any> {
    const where: any = {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    };

    if (setCode) {
      where.set = {
        code: {
          equals: setCode,
          mode: 'insensitive',
        },
      };
    }

    const cards = await prisma.card.findMany({
      where,
      include: { set: true },
      take: 1,
    });

    if (cards.length === 0) {
      // Try fuzzy match
      const fuzzyCards = await prisma.card.findMany({
        where: {
          name: {
            contains: name.split(' ')[0], // First word
            mode: 'insensitive',
          },
        },
        include: { set: true },
        take: 5,
      });

      // Find best match
      const exactMatch = fuzzyCards.find(c => 
        c.name.toLowerCase() === name.toLowerCase()
      );
      
      if (exactMatch) return exactMatch;

      // Return first result if any
      return fuzzyCards[0] || null;
    }

    return cards[0];
  }

  private calculateWeightedAverage(
    oldPrice: number,
    oldQuantity: number,
    newPrice: number,
    newQuantity: number
  ): number {
    const totalValue = (oldPrice * oldQuantity) + (newPrice * newQuantity);
    const totalQuantity = oldQuantity + newQuantity;
    return totalValue / totalQuantity;
  }

  /**
   * Validate and clean barcode data
   */
  private validateBarcode(barcode: string): string {
    // Remove any non-numeric characters
    return barcode.replace(/\D/g, '');
  }

  /**
   * Get import templates for common formats
   */
  async getImportTemplates(): Promise<{
    format: string;
    template: string;
    example: string;
  }[]> {
    return [
      {
        format: 'CSV',
        template: 'Card Name,Set Code,Quantity,Condition,Purchase Price,Location',
        example: 'Charizard ex,PAL,2,NEAR_MINT,250.00,BINDER',
      },
      {
        format: 'PTCGO',
        template: '* <quantity> <card name> <set code> <collector number>',
        example: '* 2 Charizard ex PAL 199',
      },
      {
        format: 'TCGPlayer',
        template: '<quantity>x <card name> [<set code>]',
        example: '2x Charizard ex [PAL]',
      },
    ];
  }
}