import { PrismaClient } from '@prisma/client';
import { pokemonTCGClient as client } from '../lib/api/pokemon-tcg-client';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function ensureUSDPrices() {
  console.log('💰 Checking and ensuring USD prices for all cards...\n');

  try {
    // Get all cards from database
    const cards = await prisma.card.findMany({
      include: {
        prices: {
          where: { currency: 'USD' }
        },
        set: true,
      },
    });

    console.log(`Total cards in database: ${cards.length}`);
    
    const cardsWithoutUSD = cards.filter(card => card.prices.length === 0);
    console.log(`Cards without USD prices: ${cardsWithoutUSD.length}`);

    if (cardsWithoutUSD.length === 0) {
      console.log('\n✅ All cards already have USD prices!');
      return;
    }

    console.log('\n🔄 Fetching prices for cards without USD prices...\n');

    for (const card of cardsWithoutUSD) {
      console.log(`\nFetching prices for: ${card.name} (${card.id})`);
      
      // Fetch the card from API to get latest price data
      const apiResult = await client.getCard(card.id);
      
      if (!apiResult.success) {
        console.log(`  ❌ Failed to fetch from API: ${apiResult.error}`);
        continue;
      }

      const apiCard = apiResult.data;
      
      // Check if API has TCGPlayer prices (USD)
      if (apiCard.tcgplayer?.prices) {
        console.log('  ✅ Found TCGPlayer prices!');
        
        const prices = apiCard.tcgplayer.prices;
        const priceEntries = [];
        
        // Extract normal prices
        if (prices.normal) {
          if (prices.normal.low) {
            priceEntries.push({
              cardId: card.id,
              source: 'TCGPLAYER',
              priceType: 'LOW',
              price: prices.normal.low,
              currency: 'USD',
            });
          }
          if (prices.normal.mid) {
            priceEntries.push({
              cardId: card.id,
              source: 'TCGPLAYER',
              priceType: 'MID',
              price: prices.normal.mid,
              currency: 'USD',
            });
          }
          if (prices.normal.high) {
            priceEntries.push({
              cardId: card.id,
              source: 'TCGPLAYER',
              priceType: 'HIGH',
              price: prices.normal.high,
              currency: 'USD',
            });
          }
          if (prices.normal.market) {
            priceEntries.push({
              cardId: card.id,
              source: 'TCGPLAYER',
              priceType: 'MARKET',
              price: prices.normal.market,
              currency: 'USD',
            });
          }
        }
        
        // Extract holofoil prices
        if (prices.holofoil) {
          if (prices.holofoil.low) {
            priceEntries.push({
              cardId: card.id,
              source: 'TCGPLAYER',
              priceType: 'FOIL_LOW',
              price: prices.holofoil.low,
              currency: 'USD',
            });
          }
          if (prices.holofoil.market) {
            priceEntries.push({
              cardId: card.id,
              source: 'TCGPLAYER',
              priceType: 'FOIL_MARKET',
              price: prices.holofoil.market,
              currency: 'USD',
            });
          }
          if (prices.holofoil.high) {
            priceEntries.push({
              cardId: card.id,
              source: 'TCGPLAYER',
              priceType: 'FOIL_HIGH',
              price: prices.holofoil.high,
              currency: 'USD',
            });
          }
        }
        
        if (priceEntries.length > 0) {
          // Insert prices into database
          await prisma.cardPrice.createMany({
            data: priceEntries,
            skipDuplicates: true,
          });
          
          console.log(`  💾 Saved ${priceEntries.length} USD prices`);
        } else {
          console.log('  ⚠️  No price values found in API response');
        }
      } else {
        console.log('  ❌ No TCGPlayer prices available from API');
      }
    }

    // Final check
    const finalCheck = await prisma.card.count({
      where: {
        prices: {
          none: {
            currency: 'USD'
          }
        }
      }
    });

    console.log(`\n📊 Final Status:`);
    console.log(`Cards without USD prices: ${finalCheck}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Additional function to show price coverage
async function showPriceCoverage() {
  console.log('\n\n📈 Price Coverage Analysis:\n');
  
  const coverage = await prisma.$queryRaw`
    SELECT 
      c.supertype,
      COUNT(DISTINCT c.id) as total_cards,
      COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN c.id END) as cards_with_prices,
      ROUND(COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN c.id END) * 100.0 / COUNT(DISTINCT c.id), 1) as coverage_percent
    FROM "Card" c
    LEFT JOIN "CardPrice" p ON c.id = p."cardId" AND p.currency = 'USD'
    GROUP BY c.supertype
    ORDER BY c.supertype;
  `;

  console.table(coverage);
}

async function main() {
  await ensureUSDPrices();
  await showPriceCoverage();
}

main().catch(console.error);