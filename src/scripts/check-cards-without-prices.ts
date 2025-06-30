import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCardsWithoutPrices() {
  try {
    // Get all cards
    const allCards = await prisma.card.findMany({
      include: {
        prices: true,
        set: true,
      },
    });

    // Separate cards with and without prices
    const cardsWithPrices = allCards.filter(card => card.prices.length > 0);
    const cardsWithoutPrices = allCards.filter(card => card.prices.length === 0);

    console.log('\n📊 Card Pricing Statistics:');
    console.log(`Total cards: ${allCards.length}`);
    console.log(`Cards with prices: ${cardsWithPrices.length} (${((cardsWithPrices.length / allCards.length) * 100).toFixed(1)}%)`);
    console.log(`Cards without prices: ${cardsWithoutPrices.length} (${((cardsWithoutPrices.length / allCards.length) * 100).toFixed(1)}%)`);

    if (cardsWithoutPrices.length > 0) {
      console.log('\n❌ Cards without prices:');
      cardsWithoutPrices.forEach(card => {
        console.log(`  - ${card.name} (${card.id}) from ${card.set.name}`);
      });
    }

    // Show sample of cards with prices
    if (cardsWithPrices.length > 0) {
      console.log('\n✅ Sample cards with prices:');
      cardsWithPrices.slice(0, 5).forEach(card => {
        console.log(`  - ${card.name}: ${card.prices.length} price entries`);
        card.prices.slice(0, 3).forEach(price => {
          console.log(`    → ${price.source} ${price.priceType}: ${price.currency} ${price.price}`);
        });
      });
    }

  } catch (error) {
    console.error('Error checking cards:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCardsWithoutPrices();