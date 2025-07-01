#!/usr/bin/env node

/**
 * Quick script to ensure the user exists in the database.
 * This is likely why deck creation is failing - the user record doesn't exist
 * even though they're authenticated with Clerk.
 * 
 * Run with: npx tsx src/scripts/quick-user-fix.ts
 * Or: npm run script:ensure-user
 */

import { PrismaClient, SubscriptionTier } from '@prisma/client';

const prisma = new PrismaClient();

const USER_DATA = {
  clerkUserId: 'user_2zBVzMNfGI9ntqrZBG2pKjKu1V1',
  email: 'greg.lester@gmail.com',
  username: 'greg.lester',
  displayName: 'Greg Lester',
};

async function main() {
  console.log('🔍 Checking for user:', USER_DATA.clerkUserId);

  try {
    // First, check if user exists
    let user = await prisma.user.findUnique({
      where: { clerkUserId: USER_DATA.clerkUserId },
    });

    if (user) {
      console.log('✅ User already exists!');
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Created:', user.createdAt);
      return user;
    }

    // Check if email is already taken
    const emailUser = await prisma.user.findUnique({
      where: { email: USER_DATA.email },
    });

    if (emailUser) {
      console.log('⚠️  Email already exists with different Clerk ID');
      console.log('   Current Clerk ID:', emailUser.clerkUserId);
      console.log('   Expected Clerk ID:', USER_DATA.clerkUserId);
      
      // Update the Clerk ID
      console.log('🔄 Updating Clerk ID...');
      user = await prisma.user.update({
        where: { email: USER_DATA.email },
        data: { clerkUserId: USER_DATA.clerkUserId },
      });
      console.log('✅ Updated successfully!');
      return user;
    }

    // Create new user
    console.log('👤 Creating new user...');
    user = await prisma.user.create({
      data: {
        clerkUserId: USER_DATA.clerkUserId,
        email: USER_DATA.email,
        username: USER_DATA.username,
        displayName: USER_DATA.displayName,
        subscriptionTier: SubscriptionTier.FREE,
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

    console.log('✅ User created successfully!');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Username:', user.username);

    return user;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute
main()
  .then(() => {
    console.log('\n✨ Done! You should now be able to create decks.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error.message);
    process.exit(1);
  });