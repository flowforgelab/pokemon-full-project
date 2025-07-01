import { PrismaClient } from '@prisma/client';
import { deckBuilderManager } from '../lib/deck-builder/deck-builder-manager';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

const CLERK_USER_ID = 'user_2zBVzMNfGI9ntqrZBG2pKjKu1V1';
const USER_EMAIL = 'greg.lester@gmail.com';

async function testDeckCreation() {
  console.log('=== Testing Deck Creation ===\n');

  try {
    // Step 1: Ensure user exists
    console.log('1. Checking/Creating user...');
    let user = await prisma.user.findUnique({
      where: { clerkUserId: CLERK_USER_ID },
    });

    if (!user) {
      console.log('   Creating user...');
      user = await prisma.user.create({
        data: {
          clerkUserId: CLERK_USER_ID,
          email: USER_EMAIL,
          username: USER_EMAIL.split('@')[0],
          displayName: 'Greg Lester',
          subscriptionTier: 'FREE',
          preferences: {},
          features: [],
        },
      });
      console.log('   ✅ User created:', user.id);
    } else {
      console.log('   ✅ User exists:', user.id);
    }

    // Step 2: Check available formats
    console.log('\n2. Checking available formats...');
    const formats = await prisma.format.findMany({
      where: { isActive: true },
    });
    console.log(`   Found ${formats.length} active formats:`);
    formats.forEach(f => console.log(`   - ${f.name} (${f.id})`));

    // Step 3: Test deck creation
    console.log('\n3. Testing deck creation...');
    
    // Try with deckBuilderManager
    try {
      const { deck, composition } = await deckBuilderManager.createNewDeck(
        user.id,
        'Test Deck from Script',
        formats[0], // Use first available format
        undefined // No template
      );

      console.log('   ✅ Deck created successfully!');
      console.log('   Deck ID:', deck.id);
      console.log('   Deck Name:', deck.name);
      console.log('   Composition:', composition);
    } catch (managerError) {
      console.error('   ❌ Manager failed:', managerError);
      
      // Try direct Prisma creation
      console.log('\n   Trying direct Prisma creation...');
      const directDeck = await prisma.deck.create({
        data: {
          userId: user.id,
          name: 'Test Deck Direct',
          formatId: formats[0]?.id,
          deckType: 'CONSTRUCTED',
          isPublic: false,
          isComplete: false,
          tags: [],
          pokemonCount: 0,
          trainerCount: 0,
          energyCount: 0,
          isLegal: true,
        },
      });
      
      console.log('   ✅ Direct deck created:', directDeck.id);
    }

    // Step 4: Verify decks
    console.log('\n4. Verifying user decks...');
    const userDecks = await prisma.deck.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`   Found ${userDecks.length} decks:`);
    userDecks.forEach(d => {
      console.log(`   - ${d.name} (${d.id}) created at ${d.createdAt}`);
    });

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDeckCreation()
  .then(() => {
    console.log('\n✨ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test error:', error);
    process.exit(1);
  });