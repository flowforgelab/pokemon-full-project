import { PrismaClient, Prisma } from '@prisma/client';
import { pokemonTCGClient } from '../lib/api/pokemon-tcg-client';
import { transformAndValidateCard } from '../lib/api/transformers';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// Constants for API limits
const DAILY_REQUEST_LIMIT = process.env.POKEMON_TCG_API_KEY ? 20000 : 1000; // With API key vs without
const CARDS_PER_REQUEST = 250; // Maximum allowed by API
const MAX_REQUESTS_PER_DAY = Math.floor(DAILY_REQUEST_LIMIT / CARDS_PER_REQUEST);
const RATE_LIMIT_DELAY = 500; // 500ms between requests to be safe

// Smart import priorities
const PRICE_UPDATE_THRESHOLDS = {
  NEW_SET_DAYS: 90, // Cards from sets released in last 90 days get highest priority
  RECENT_SET_DAYS: 180, // Cards from sets released in last 180 days get high priority
  STANDARD_LEGAL_PRIORITY: true, // Standard legal cards get priority
  UPDATE_FREQUENCY_DAYS: {
    NEW: 1, // Update newest cards daily
    RECENT: 3, // Update recent cards every 3 days
    STANDARD: 7, // Update standard cards weekly
    EXPANDED: 14, // Update expanded cards bi-weekly
    UNLIMITED: 30, // Update unlimited-only cards monthly
  },
};

interface ImportStats {
  totalCards: number;
  newCards: number;
  updatedCards: number;
  priceUpdates: number;
  errors: number;
  requestsUsed: number;
}

async function getCardsNeedingUpdate(): Promise<string[]> {
  const now = new Date();
  
  // Priority 1: Brand new sets (released in last 90 days)
  const newSetCards = await prisma.card.findMany({
    where: {
      set: {
        releaseDate: {
          gte: new Date(now.getTime() - PRICE_UPDATE_THRESHOLDS.NEW_SET_DAYS * 24 * 60 * 60 * 1000),
        },
      },
      OR: [
        { updatedAt: { lt: new Date(now.getTime() - PRICE_UPDATE_THRESHOLDS.UPDATE_FREQUENCY_DAYS.NEW * 24 * 60 * 60 * 1000) } },
        { prices: { none: {} } }, // Cards with no prices at all
      ],
    },
    select: { id: true },
    orderBy: { set: { releaseDate: 'desc' } },
  });

  // Priority 2: Recent sets (released in last 180 days)
  const recentSetCards = await prisma.card.findMany({
    where: {
      set: {
        releaseDate: {
          gte: new Date(now.getTime() - PRICE_UPDATE_THRESHOLDS.RECENT_SET_DAYS * 24 * 60 * 60 * 1000),
          lt: new Date(now.getTime() - PRICE_UPDATE_THRESHOLDS.NEW_SET_DAYS * 24 * 60 * 60 * 1000),
        },
      },
      updatedAt: {
        lt: new Date(now.getTime() - PRICE_UPDATE_THRESHOLDS.UPDATE_FREQUENCY_DAYS.RECENT * 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true },
    orderBy: { set: { releaseDate: 'desc' } },
  });

  // Priority 3: Standard legal cards
  const standardCards = await prisma.card.findMany({
    where: {
      isLegalStandard: true,
      updatedAt: {
        lt: new Date(now.getTime() - PRICE_UPDATE_THRESHOLDS.UPDATE_FREQUENCY_DAYS.STANDARD * 24 * 60 * 60 * 1000),
      },
      NOT: {
        id: { in: [...newSetCards.map(c => c.id), ...recentSetCards.map(c => c.id)] },
      },
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' }, // Oldest updated first
  });

  // Priority 4: Expanded legal cards
  const expandedCards = await prisma.card.findMany({
    where: {
      isLegalExpanded: true,
      isLegalStandard: false,
      updatedAt: {
        lt: new Date(now.getTime() - PRICE_UPDATE_THRESHOLDS.UPDATE_FREQUENCY_DAYS.EXPANDED * 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: 1000, // Limit to prevent too many
  });

  // Priority 5: Unlimited only cards (vintage)
  const unlimitedCards = await prisma.card.findMany({
    where: {
      isLegalStandard: false,
      isLegalExpanded: false,
      updatedAt: {
        lt: new Date(now.getTime() - PRICE_UPDATE_THRESHOLDS.UPDATE_FREQUENCY_DAYS.UNLIMITED * 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: 500, // Even smaller limit
  });

  // Combine all card IDs in priority order
  const allCardIds = [
    ...newSetCards.map(c => c.id),
    ...recentSetCards.map(c => c.id),
    ...standardCards.map(c => c.id),
    ...expandedCards.map(c => c.id),
    ...unlimitedCards.map(c => c.id),
  ];

  // Remove duplicates while preserving order
  const uniqueCardIds = [...new Set(allCardIds)];

  console.log(`📊 Cards needing update by priority:`);
  console.log(`  - New sets (< ${PRICE_UPDATE_THRESHOLDS.NEW_SET_DAYS} days): ${newSetCards.length}`);
  console.log(`  - Recent sets (< ${PRICE_UPDATE_THRESHOLDS.RECENT_SET_DAYS} days): ${recentSetCards.length}`);
  console.log(`  - Standard legal: ${standardCards.length}`);
  console.log(`  - Expanded legal: ${expandedCards.length}`);
  console.log(`  - Unlimited only: ${unlimitedCards.length}`);
  console.log(`  - Total unique cards: ${uniqueCardIds.length}`);

  return uniqueCardIds;
}

async function importNewSets(): Promise<string[]> {
  console.log('\n🔍 Checking for new sets to import...');
  
  const setsResult = await pokemonTCGClient.getAllSets();
  if (!setsResult.success) {
    console.error('Failed to fetch sets:', setsResult.error);
    return [];
  }

  const apiSets = setsResult.data;
  const existingSets = await prisma.set.findMany({ select: { id: true } });
  const existingSetIds = new Set(existingSets.map(s => s.id));

  const newSets = apiSets.filter(set => !existingSetIds.has(set.id));
  
  if (newSets.length === 0) {
    console.log('No new sets found');
    return [];
  }

  console.log(`Found ${newSets.length} new sets to import`);
  const newCardIds: string[] = [];

  for (const set of newSets) {
    console.log(`\n📦 Importing new set: ${set.name} (${set.id})`);
    
    // Import the set
    await prisma.set.create({
      data: {
        id: set.id,
        code: set.id,
        name: set.name,
        series: set.series,
        printedTotal: set.printedTotal,
        total: set.total,
        releaseDate: new Date(set.releaseDate),
        updatedAt: new Date(set.updatedAt),
        logoUrl: set.images.logo,
        symbolUrl: set.images.symbol,
        ptcgoCode: set.ptcgoCode,
        isLegalStandard: set.legalities.standard === 'Legal',
        isLegalExpanded: set.legalities.expanded === 'Legal',
        isLegalUnlimited: set.legalities.unlimited === 'Legal',
      },
    });

    // Get all cards from this set
    const cardsResult = await pokemonTCGClient.getCardsBySet(set.id, { limit: 250 });
    if (cardsResult.success) {
      newCardIds.push(...cardsResult.data.map(card => card.id));
    }
  }

  return newCardIds;
}

async function updateCards(cardIds: string[], stats: ImportStats): Promise<void> {
  const batchSize = CARDS_PER_REQUEST;
  const maxCardsToUpdate = MAX_REQUESTS_PER_DAY * batchSize;
  const cardsToUpdate = cardIds.slice(0, maxCardsToUpdate);

  console.log(`\n🔄 Updating ${cardsToUpdate.length} cards (max: ${maxCardsToUpdate})`);

  for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
    const batch = cardsToUpdate.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`\n📦 Processing batch ${batchNumber}/${Math.ceil(cardsToUpdate.length / batchSize)} (${batch.length} cards)`);
    
    // Fetch cards from API
    const cardPromises = batch.map(id => pokemonTCGClient.getCard(id));
    const results = await Promise.all(cardPromises);
    
    stats.requestsUsed += batch.length; // Each card is a separate request in this approach
    
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const cardId = batch[j];
      
      if (!result.success) {
        console.error(`  ❌ Failed to fetch ${cardId}: ${result.error}`);
        stats.errors++;
        continue;
      }

      const apiCard = result.data;
      
      try {
        // Transform and validate the card
        const transformResult = await transformAndValidateCard(apiCard);
        
        if (!transformResult.isValid || !transformResult.data) {
          console.error(`  ❌ Invalid card data for ${cardId}:`, transformResult.errors);
          stats.errors++;
          continue;
        }

        // Check if card exists
        const existingCard = await prisma.card.findUnique({
          where: { id: cardId },
          select: { id: true },
        });

        if (existingCard) {
          // Update existing card
          await prisma.$transaction(async (tx) => {
            // Update card data
            await tx.card.update({
              where: { id: cardId },
              data: {
                ...transformResult.data,
                set: undefined, // Remove relation fields
                updatedAt: new Date(),
              },
            });

            // Delete old prices and insert new ones
            if (transformResult.prices && transformResult.prices.length > 0) {
              await tx.cardPrice.deleteMany({ where: { cardId } });
              await tx.cardPrice.createMany({ data: transformResult.prices });
              stats.priceUpdates += transformResult.prices.length;
            }
          });
          
          stats.updatedCards++;
          console.log(`  ✅ Updated ${apiCard.name} with ${transformResult.prices?.length || 0} prices`);
        } else {
          // Create new card
          await prisma.$transaction(async (tx) => {
            await tx.card.create({ data: transformResult.data });
            
            if (transformResult.prices && transformResult.prices.length > 0) {
              await tx.cardPrice.createMany({ data: transformResult.prices });
              stats.priceUpdates += transformResult.prices.length;
            }
          });
          
          stats.newCards++;
          console.log(`  ✅ Created ${apiCard.name} with ${transformResult.prices?.length || 0} prices`);
        }
        
        stats.totalCards++;
      } catch (error) {
        console.error(`  ❌ Error processing ${cardId}:`, error);
        stats.errors++;
      }
    }
    
    // Rate limiting
    if (i + batchSize < cardsToUpdate.length) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }
}

async function addPurchaseLinks(): Promise<void> {
  console.log('\n🔗 Ensuring purchase links for all cards...');
  
  // Update cards without purchase links
  const cardsWithoutLinks = await prisma.card.findMany({
    where: {
      OR: [
        { cardmarketId: null },
        { cardmarketId: '' },
      ],
    },
    select: { id: true, name: true, set: { select: { name: true } } },
  });

  if (cardsWithoutLinks.length > 0) {
    console.log(`Found ${cardsWithoutLinks.length} cards without purchase links`);
    
    // For now, we'll generate Pokemon TCG official links
    // Format: https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/detail-search/?cardName=CARDNAME&setName=SETNAME
    for (const card of cardsWithoutLinks) {
      const purchaseUrl = `https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/detail-search/?cardName=${encodeURIComponent(card.name)}&setName=${encodeURIComponent(card.set.name)}`;
      
      // Store in cardmarketId field temporarily (we'll add a proper purchaseUrl field later)
      // For now, we'll just log what we would do
      console.log(`  Would add link for ${card.name}: ${purchaseUrl}`);
    }
    
    console.log('\n💡 Note: To add affiliate links in the future:');
    console.log('  1. Add a purchaseUrl field to the Card model');
    console.log('  2. Store Pokemon.com direct links initially');
    console.log('  3. Update with affiliate links when available');
  } else {
    console.log('All cards have purchase links');
  }
}

async function runDailyImport(): Promise<void> {
  console.log('🚀 Starting smart daily card import...');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🔑 API Key: ${process.env.POKEMON_TCG_API_KEY ? 'Present' : 'Not found'}`);
  console.log(`📊 Daily limit: ${DAILY_REQUEST_LIMIT} requests`);
  console.log(`📦 Max cards to update: ${MAX_REQUESTS_PER_DAY * CARDS_PER_REQUEST}`);

  const stats: ImportStats = {
    totalCards: 0,
    newCards: 0,
    updatedCards: 0,
    priceUpdates: 0,
    errors: 0,
    requestsUsed: 0,
  };

  const startTime = Date.now();

  try {
    // Step 1: Check for and import new sets
    const newCardIds = await importNewSets();
    
    // Step 2: Get cards needing update (including new cards)
    const cardsNeedingUpdate = await getCardsNeedingUpdate();
    
    // Combine new cards with cards needing update (new cards first)
    const allCardIds = [...new Set([...newCardIds, ...cardsNeedingUpdate])];
    
    // Step 3: Update cards with smart batching
    await updateCards(allCardIds, stats);
    
    // Step 4: Add purchase links
    await addPurchaseLinks();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('\n✅ Daily import completed successfully!');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📊 Stats:`);
    console.log(`  - Total cards processed: ${stats.totalCards}`);
    console.log(`  - New cards added: ${stats.newCards}`);
    console.log(`  - Cards updated: ${stats.updatedCards}`);
    console.log(`  - Price updates: ${stats.priceUpdates}`);
    console.log(`  - Errors: ${stats.errors}`);
    console.log(`  - API requests used: ${stats.requestsUsed}/${DAILY_REQUEST_LIMIT}`);
    
    // Log to database for tracking
    await prisma.$executeRaw`
      INSERT INTO "ImportLog" (date, cards_processed, new_cards, updated_cards, price_updates, errors, requests_used, duration_seconds)
      VALUES (NOW(), ${stats.totalCards}, ${stats.newCards}, ${stats.updatedCards}, ${stats.priceUpdates}, ${stats.errors}, ${stats.requestsUsed}, ${duration})
    `.catch(() => {
      // Table might not exist yet, ignore error
    });
    
  } catch (error) {
    console.error('Fatal error during import:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  runDailyImport().catch(console.error);
}

export { runDailyImport };