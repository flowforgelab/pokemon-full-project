import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function debugUserCreation() {
  const clerkUserId = 'user_2zBVzMNfGI9ntqrZBG2pKjKu1V1';
  const email = 'greg.lester@gmail.com';

  console.log('=== User Creation Debug Script ===\n');
  
  // Check database connection
  console.log('1. Testing database connection...');
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`   Total users in database: ${userCount}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return;
  }

  // Check for existing user by Clerk ID
  console.log('\n2. Checking for user by Clerk ID...');
  try {
    const userByClerkId = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        decks: { take: 5 },
        collections: { take: 5 },
      },
    });

    if (userByClerkId) {
      console.log('✅ User found by Clerk ID:', {
        id: userByClerkId.id,
        email: userByClerkId.email,
        username: userByClerkId.username,
        createdAt: userByClerkId.createdAt,
        deckCount: userByClerkId.decks.length,
        collectionCount: userByClerkId.collections.length,
      });
    } else {
      console.log('❌ No user found with Clerk ID:', clerkUserId);
    }
  } catch (error) {
    console.error('❌ Error checking user by Clerk ID:', error);
  }

  // Check for existing user by email
  console.log('\n3. Checking for user by email...');
  try {
    const userByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (userByEmail) {
      console.log('✅ User found by email:', {
        id: userByEmail.id,
        clerkUserId: userByEmail.clerkUserId,
        username: userByEmail.username,
        createdAt: userByEmail.createdAt,
      });
      
      if (userByEmail.clerkUserId !== clerkUserId) {
        console.log('⚠️  WARNING: User has different Clerk ID!');
        console.log(`   Expected: ${clerkUserId}`);
        console.log(`   Actual: ${userByEmail.clerkUserId}`);
      }
    } else {
      console.log('❌ No user found with email:', email);
    }
  } catch (error) {
    console.error('❌ Error checking user by email:', error);
  }

  // Check for any users with similar emails
  console.log('\n4. Checking for users with similar emails...');
  try {
    const similarUsers = await prisma.user.findMany({
      where: {
        email: {
          contains: 'greg.lester',
        },
      },
    });

    if (similarUsers.length > 0) {
      console.log(`Found ${similarUsers.length} user(s) with similar emails:`);
      similarUsers.forEach(user => {
        console.log(`   - ${user.email} (Clerk ID: ${user.clerkUserId})`);
      });
    } else {
      console.log('No users found with similar emails');
    }
  } catch (error) {
    console.error('❌ Error checking similar emails:', error);
  }

  // Attempt to create user if not exists
  console.log('\n5. Attempting to create user...');
  try {
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (existingUser) {
      console.log('⚠️  User already exists, skipping creation');
    } else {
      const newUser = await prisma.user.create({
        data: {
          clerkUserId,
          email,
          username: email.split('@')[0],
          displayName: 'Greg Lester',
          subscriptionTier: 'FREE',
          preferences: {
            theme: 'light',
            language: 'en',
            notifications: {
              email: true,
              priceAlerts: true,
              tradeOffers: true,
            },
          },
          features: [],
        },
      });

      console.log('✅ User created successfully:', {
        id: newUser.id,
        email: newUser.email,
        clerkUserId: newUser.clerkUserId,
        username: newUser.username,
      });
    }
  } catch (error) {
    console.error('❌ Error creating user:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        console.log('\n⚠️  Unique constraint violation detected');
        console.log('This usually means:');
        console.log('1. A user with this email already exists');
        console.log('2. A user with this username already exists');
        console.log('3. The Clerk ID is already associated with another user');
      }
    }
  }

  // Final verification
  console.log('\n6. Final verification...');
  try {
    const finalCheck = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        _count: {
          select: {
            decks: true,
            collections: true,
            wantList: true,
          },
        },
      },
    });

    if (finalCheck) {
      console.log('✅ User verified in database:', {
        id: finalCheck.id,
        email: finalCheck.email,
        stats: {
          decks: finalCheck._count.decks,
          collections: finalCheck._count.collections,
          wantList: finalCheck._count.wantList,
        },
      });
    } else {
      console.log('❌ User still not found after creation attempt');
    }
  } catch (error) {
    console.error('❌ Error in final verification:', error);
  }

  // Check recent deck creation attempts
  console.log('\n7. Checking recent decks...');
  try {
    const recentDecks = await prisma.deck.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        user: {
          select: {
            email: true,
            clerkUserId: true,
          },
        },
      },
    });

    if (recentDecks.length > 0) {
      console.log(`Found ${recentDecks.length} recent decks:`);
      recentDecks.forEach(deck => {
        console.log(`   - "${deck.name}" by ${deck.user.email} (${deck.createdAt.toISOString()})`);
      });
    } else {
      console.log('No decks found in the database');
    }
  } catch (error) {
    console.error('❌ Error checking recent decks:', error);
  }
}

// Run the debug script
debugUserCreation()
  .then(() => {
    console.log('\n=== Debug script completed ===');
  })
  .catch((error) => {
    console.error('\n=== Debug script failed ===');
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });