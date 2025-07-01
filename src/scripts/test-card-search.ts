import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function testCardSearch() {
  try {
    console.log('Testing card search...\n');
    
    // 1. Check total card count
    const totalCards = await prisma.card.count();
    console.log(`Total cards in database: ${totalCards}`);
    
    if (totalCards === 0) {
      console.log('\n❌ No cards found in database! Please run the import scripts.');
      return;
    }
    
    // 2. Test basic search without filters
    const basicSearch = await prisma.card.findMany({
      take: 5,
      include: {
        set: true,
        prices: {
          take: 1,
        },
      },
    });
    console.log(`\nBasic search returned ${basicSearch.length} cards`);
    console.log('Sample card:', basicSearch[0]?.name, basicSearch[0]?.number);
    
    // 3. Test search with supertype filter
    const pokemonCards = await prisma.card.findMany({
      where: { supertype: 'POKEMON' },
      take: 5,
    });
    console.log(`\nPokemon cards found: ${pokemonCards.length}`);
    
    // 4. Test search with name filter
    const namedCards = await prisma.card.findMany({
      where: {
        name: {
          contains: 'Pikachu',
          mode: 'insensitive',
        },
      },
      take: 5,
    });
    console.log(`\nCards with 'Pikachu' in name: ${namedCards.length}`);
    
    // 5. Test user collection
    const users = await prisma.user.findMany({ take: 1 });
    if (users.length > 0) {
      const user = users[0];
      console.log(`\nTesting for user: ${user.username || user.email}`);
      
      const userCollection = await prisma.userCollection.count({
        where: { userId: user.id },
      });
      console.log(`Cards in user collection: ${userCollection}`);
      
      // Test owned cards filter
      const ownedCards = await prisma.card.findMany({
        where: {
          userCollections: {
            some: { userId: user.id },
          },
        },
        take: 5,
      });
      console.log(`Owned cards found: ${ownedCards.length}`);
    }
    
    // 6. Test standard/expanded legality
    const standardCards = await prisma.card.count({
      where: { isLegalStandard: true },
    });
    const expandedCards = await prisma.card.count({
      where: { isLegalExpanded: true },
    });
    console.log(`\nStandard legal cards: ${standardCards}`);
    console.log(`Expanded legal cards: ${expandedCards}`);
    
    // 7. Test raw SQL query like searchOptimized does
    const rawQuery = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "Card" c
      INNER JOIN "Set" s ON c."setId" = s.id
    `;
    console.log(`\nRaw SQL query result:`, rawQuery);
    
  } catch (error) {
    console.error('Error testing search:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCardSearch();