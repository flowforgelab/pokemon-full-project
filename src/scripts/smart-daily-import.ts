import { PrismaClient } from '@prisma/client';
import { PokemonTCGClient } from '../lib/api/pokemon-tcg-client';
import { transformAndValidateCard } from '../lib/api/transformers';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// Constants for API limits
const DAILY_API_LIMIT = process.env.POKEMON_TCG_API_KEY ? 20000 : 1000;
const MAX_CARDS_PER_RUN = process.env.POKEMON_TCG_API_KEY ? 20000 : 1000;

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

interface CardWithPriority {
  id: string;
  pokemonTcgIoId: string;
  priority: 'new' | 'recent' | 'standard' | 'expanded' | 'unlimited';
}

async function getCardsNeedingUpdate(): Promise<CardWithPriority[]> {
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
    select: { id: true, pokemonTcgIoId: true },
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
    select: { id: true, pokemonTcgIoId: true },
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
    select: { id: true, pokemonTcgIoId: true },
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
    select: { id: true, pokemonTcgIoId: true },
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
    select: { id: true, pokemonTcgIoId: true },
    orderBy: { updatedAt: 'asc' },
    take: 500, // Even smaller limit
  });

  // Combine all cards with their priorities
  const allCards: CardWithPriority[] = [
    ...newSetCards.map(c => ({ ...c, priority: 'new' as const })),
    ...recentSetCards.map(c => ({ ...c, priority: 'recent' as const })),
    ...standardCards.map(c => ({ ...c, priority: 'standard' as const })),
    ...expandedCards.map(c => ({ ...c, priority: 'expanded' as const })),
    ...unlimitedCards.map(c => ({ ...c, priority: 'unlimited' as const })),
  ];

  // Remove duplicates while preserving order (keep first occurrence)
  const seen = new Set<string>();
  const uniqueCards = allCards.filter(card => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });

  return uniqueCards;
}

async function importNewSets(client: PokemonTCGClient) {
  console.log('\n🔍 Checking for new sets to import...');
  
  const setsResult = await client.getAllSets();
  if (!setsResult.success) {
    console.error('Failed to fetch sets:', setsResult.error);
    return;
  }
  const apiSets = setsResult.data.data;
  const existingSets = await prisma.set.findMany({ select: { pokemonTcgIoId: true } });
  const existingSetIds = new Set(existingSets.map(s => s.pokemonTcgIoId));

  const newSets = apiSets.filter(set => !existingSetIds.has(set.id));
  
  if (newSets.length === 0) {
    console.log('No new sets found');
    return;
  }

  console.log(`Found ${newSets.length} new sets to import`);

  for (const set of newSets) {
    console.log(`\n📦 Importing new set: ${set.name} (${set.id})`);
    
    // Import the set
    await prisma.set.create({
      data: {
        pokemonTcgIoId: set.id,
        name: set.name,
        series: set.series,
        printedTotal: set.printedTotal,
        total: set.total,
        releaseDate: set.releaseDate,
        ptcgoCode: set.ptcgoCode || null,
        images: {
          symbol: set.images.symbol,
          logo: set.images.logo,
        },
      },
    });
  }
}

async function updateCards(cards: CardWithPriority[], client: PokemonTCGClient) {
  // Limit the number of cards to update
  const cardsToUpdate = cards.slice(0, MAX_CARDS_PER_RUN);
  
  console.log(`\n🔄 Updating ${cardsToUpdate.length} cards (max: ${MAX_CARDS_PER_RUN})`);
  
  let updated = 0;
  let errors = 0;
  let priceUpdates = 0;
  
  // Process in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
    const batch = cardsToUpdate.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardsToUpdate.length / batchSize)}`);
    
    await prisma.$transaction(async (tx) => {
      for (const card of batch) {
        try {
          // Fetch updated card data from API
          const cardResult = await client.getCardById(card.pokemonTcgIoId);
          if (!cardResult.success) {
            console.error(`  ❌ Failed to fetch card: ${cardResult.error}`);
            errors++;
            continue;
          }
          const apiCard = cardResult.data.data;
          
          if (!apiCard) {
            console.error(`  ❌ Card not found: ${card.pokemonTcgIoId}`);
            errors++;
            continue;
          }
          
          // Get the set
          const set = await tx.set.findUnique({
            where: { pokemonTcgIoId: apiCard.set.id },
          });
          
          if (!set) {
            console.error(`  ❌ Set not found for card: ${apiCard.set.id}`);
            errors++;
            continue;
          }
          
          // Transform and validate
          const transformResult = transformAndValidateCard(apiCard, set.id);
          const { prices, ...cardData } = transformResult;
          
          // Update the card
          await tx.card.update({
            where: { id: card.id },
            data: {
              ...cardData,
              updatedAt: new Date(),
            },
          });
          
          // Update prices
          if (prices && prices.length > 0) {
            await tx.cardPrice.deleteMany({
              where: { cardId: card.id },
            });
            
            const validPrices = prices.filter(p => p.source !== undefined);
            if (validPrices.length > 0) {
              await tx.cardPrice.createMany({
                data: validPrices.map(p => ({ ...p, cardId: card.id })),
              });
              priceUpdates += validPrices.length;
            }
          }
          
          updated++;
          console.log(`  ✅ Updated ${apiCard.name} (${card.priority} priority)`);
        } catch (error) {
          console.error(`  ❌ Error updating card ${card.pokemonTcgIoId}:`, error);
          errors++;
        }
      }
    });
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return { updated, errors, priceUpdates };
}

async function addPurchaseLinks(): Promise<void> {
  console.log('\n🔗 Ensuring purchase links for all cards...');
  
  // Update cards without purchase links
  const cardsWithoutLinks = await prisma.card.findMany({
    where: {
      purchaseUrl: null,
    },
    select: { id: true, name: true, set: { select: { name: true } } },
    take: 20, // Limit to avoid too much output
  });

  if (cardsWithoutLinks.length > 0) {
    console.log(`Found ${cardsWithoutLinks.length} cards without purchase links`);
    
    // For now, we'll generate Pokemon TCG official links
    // Format: https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/detail-search/?cardName=CARDNAME&setName=SETNAME
    for (const card of cardsWithoutLinks) {
      const purchaseUrl = `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(card.name)}&view=grid&ProductTypeName=Cards&set=${encodeURIComponent(card.set.name)}`;
      
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

export async function runDailyImport() {
  console.log('🚀 Starting smart daily card import...');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🔑 API Key: ${process.env.POKEMON_TCG_API_KEY ? 'Present' : 'Not configured'}`);
  console.log(`📊 Daily limit: ${DAILY_API_LIMIT} requests`);
  console.log(`📦 Max cards to update: ${MAX_CARDS_PER_RUN}`);

  const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);

  try {
    // Check if initial import has been done
    const totalCards = await prisma.card.count();
    if (totalCards < 100) {
      console.log('\n⚠️  Database has only ' + totalCards + ' cards.');
      console.log('📌 Please run the full import first:');
      console.log('   npx tsx src/scripts/import-all-cards.ts\n');
      return;
    }

    // 1. Check for new sets first
    console.log('\n🔍 Checking for new sets to import...');
    await importNewSets(client);

    // 2. Get cards needing update by priority
    const cardsToUpdate = await getCardsNeedingUpdate();
    console.log(`\n📊 Cards needing update by priority:`);
    console.log(`  - New sets (< ${PRICE_UPDATE_THRESHOLDS.NEW_SET_DAYS} days): ${cardsToUpdate.filter(c => c.priority === 'new').length}`);
    console.log(`  - Recent sets (< ${PRICE_UPDATE_THRESHOLDS.RECENT_SET_DAYS} days): ${cardsToUpdate.filter(c => c.priority === 'recent').length}`);
    console.log(`  - Standard legal: ${cardsToUpdate.filter(c => c.priority === 'standard').length}`);
    console.log(`  - Expanded legal: ${cardsToUpdate.filter(c => c.priority === 'expanded').length}`);
    console.log(`  - Unlimited only: ${cardsToUpdate.filter(c => c.priority === 'unlimited').length}`);
    console.log(`  - Total unique cards: ${cardsToUpdate.length}`);

    const startTime = Date.now();
    
    // 3. Update cards
    const { updated, errors, priceUpdates } = await updateCards(cardsToUpdate, client);
    
    // 4. Add purchase links
    await addPurchaseLinks();
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('\n✅ Daily import completed successfully!');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📊 Stats:`);
    console.log(`  - Total cards processed: ${updated + errors}`);
    console.log(`  - New cards added: 0`);
    console.log(`  - Cards updated: ${updated}`);
    console.log(`  - Price updates: ${priceUpdates}`);
    console.log(`  - Errors: ${errors}`);
    console.log(`  - API requests used: ${updated + errors}/${DAILY_API_LIMIT}`);
    
  } catch (error) {
    console.error('Fatal error during import:', error);
  } finally {
    await prisma.$disconnect();
  }
}