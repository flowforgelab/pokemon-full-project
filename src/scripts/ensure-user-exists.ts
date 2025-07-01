import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureUserExists() {
  const clerkUserId = 'user_2zBVzMNfGI9ntqrZBG2pKjKu1V1';
  const email = 'greg.lester@gmail.com';

  try {
    console.log('Checking if user exists with Clerk ID:', clerkUserId);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        clerkUserId: clerkUserId,
      },
    });

    if (existingUser) {
      console.log('User already exists:', {
        id: existingUser.id,
        email: existingUser.email,
        clerkUserId: existingUser.clerkUserId,
        createdAt: existingUser.createdAt,
      });
      return existingUser;
    }

    // User doesn't exist, create them
    console.log('User not found. Creating user...');
    
    const newUser = await prisma.user.create({
      data: {
        clerkUserId: clerkUserId,
        email: email,
        username: email.split('@')[0], // Extract username from email
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

    console.log('User created successfully:', {
      id: newUser.id,
      email: newUser.email,
      clerkUserId: newUser.clerkUserId,
      username: newUser.username,
      createdAt: newUser.createdAt,
    });

    // Verify the user was created
    const verifyUser = await prisma.user.findUnique({
      where: {
        clerkUserId: clerkUserId,
      },
      include: {
        decks: true,
        collections: true,
      },
    });

    console.log('\nUser verification:', {
      exists: !!verifyUser,
      deckCount: verifyUser?.decks.length || 0,
      collectionCount: verifyUser?.collections.length || 0,
    });

    return newUser;
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    
    // If it's a unique constraint error, the user might exist with a different Clerk ID
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      console.log('\nChecking if user exists with email:', email);
      
      const userByEmail = await prisma.user.findUnique({
        where: {
          email: email,
        },
      });

      if (userByEmail) {
        console.log('Found user with same email but different Clerk ID:', {
          id: userByEmail.id,
          email: userByEmail.email,
          clerkUserId: userByEmail.clerkUserId,
          createdAt: userByEmail.createdAt,
        });
        
        // Optionally update the Clerk ID if needed
        console.log('\nWould you like to update the Clerk ID for this user? This might be needed if the user re-authenticated.');
      }
    }
    
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
ensureUserExists()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });