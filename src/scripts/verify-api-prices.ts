import { pokemonTCGClient as client } from '../lib/api/pokemon-tcg-client';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

async function verifyApiPrices() {
  console.log('🔍 Checking Pokemon TCG API price availability...\n');

  try {
    // Get a few sets to check
    const setsResult = await client.getAllSets();
    if (!setsResult.success) {
      console.error('Failed to fetch sets:', setsResult.error);
      return;
    }
    const recentSets = setsResult.data
      .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
      .slice(0, 3);

    console.log(`Checking ${recentSets.length} recent sets:\n`);

    for (const set of recentSets) {
      console.log(`\n📦 Set: ${set.name} (${set.id})`);
      console.log(`Released: ${set.releaseDate}`);
      
      // Get a sample of cards from this set
      const cardsResult = await client.getCardsBySet(set.id, { limit: 10 });
      if (!cardsResult.success) {
        console.log(`  ⚠️  Failed to fetch cards for this set`);
        continue;
      }
      const cards = cardsResult.data;
      
      let cardsWithTcgPrices = 0;
      let cardsWithCardMarketPrices = 0;
      let cardsWithoutAnyPrices = 0;
      
      console.log(`\nChecking ${cards.length} sample cards:`);
      
      for (const card of cards) {
        const hasTcgPlayer = !!card.tcgplayer?.prices;
        const hasCardMarket = !!card.cardmarket?.prices;
        
        if (hasTcgPlayer) cardsWithTcgPrices++;
        if (hasCardMarket) cardsWithCardMarketPrices++;
        if (!hasTcgPlayer && !hasCardMarket) {
          cardsWithoutAnyPrices++;
          console.log(`  ❌ ${card.name} (${card.number}) - No prices available`);
        }
        
        // Show detailed price info for first card with prices
        if (hasTcgPlayer && cardsWithTcgPrices === 1) {
          console.log(`\n  💰 Example TCGPlayer prices for ${card.name}:`);
          const prices = card.tcgplayer.prices;
          if (prices.normal) {
            console.log(`     Normal: $${prices.normal.low} - $${prices.normal.high} (Market: $${prices.normal.market || 'N/A'})`);
          }
          if (prices.holofoil) {
            console.log(`     Holofoil: $${prices.holofoil.low} - $${prices.holofoil.high} (Market: $${prices.holofoil.market || 'N/A'})`);
          }
          if (prices.reverseHolofoil) {
            console.log(`     Reverse Holo: $${prices.reverseHolofoil.low} - $${prices.reverseHolofoil.high} (Market: $${prices.reverseHolofoil.market || 'N/A'})`);
          }
        }
      }
      
      console.log(`\n  📊 Price availability in this set:`);
      console.log(`     TCGPlayer (USD): ${cardsWithTcgPrices}/${cards.length} cards (${(cardsWithTcgPrices/cards.length*100).toFixed(0)}%)`);
      console.log(`     CardMarket (EUR): ${cardsWithCardMarketPrices}/${cards.length} cards (${(cardsWithCardMarketPrices/cards.length*100).toFixed(0)}%)`);
      console.log(`     No prices: ${cardsWithoutAnyPrices}/${cards.length} cards`);
    }

    console.log('\n\n📌 Summary:');
    console.log('- Not all cards have prices in the Pokemon TCG API');
    console.log('- TCGPlayer prices (USD) are more common for recent sets');
    console.log('- Some cards (promos, special editions) may never have prices');
    console.log('- Older sets tend to have fewer cards with price data');
    
  } catch (error) {
    console.error('Error checking API prices:', error);
  }
}

// Also check a specific card that might not have prices
async function checkSpecificCards() {
  console.log('\n\n🎯 Checking specific card types that often lack prices:\n');
  
  // Check energy cards (often don't have prices)
  const energyCardsResult = await client.searchCards({ 
    query: 'supertype:Energy', 
    limit: 5 
  });
  
  if (!energyCardsResult.success) {
    console.log('Failed to fetch energy cards');
    return;
  }
  
  console.log('Basic Energy Cards:');
  for (const card of energyCardsResult.data.cards) {
    const hasPrices = !!card.tcgplayer?.prices || !!card.cardmarket?.prices;
    console.log(`  ${hasPrices ? '✅' : '❌'} ${card.name} from ${card.set.name}`);
  }
  
  // Check promo cards
  const promoCardsResult = await client.searchCards({ 
    query: 'rarity:Promo', 
    limit: 5 
  });
  
  if (!promoCardsResult.success) {
    console.log('Failed to fetch promo cards');
    return;
  }
  
  console.log('\nPromo Cards:');
  for (const card of promoCardsResult.data.cards) {
    const hasPrices = !!card.tcgplayer?.prices || !!card.cardmarket?.prices;
    console.log(`  ${hasPrices ? '✅' : '❌'} ${card.name} from ${card.set.name}`);
  }
}

async function main() {
  await verifyApiPrices();
  await checkSpecificCards();
}

main().catch(console.error);