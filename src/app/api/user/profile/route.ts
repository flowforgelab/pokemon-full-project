import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db';
import { getDbUser, getSubscriptionFeatures } from '@/lib/auth/clerk';
import { UserProfile } from '@/types/auth';
import { z } from 'zod';

const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  preferences: z.object({
    defaultFormat: z.enum(['standard', 'expanded', 'legacy']).optional(),
    preferredCurrency: z.enum(['USD', 'EUR', 'GBP']).optional(),
    deckBuildingMode: z.enum(['beginner', 'advanced']).optional(),
    collectionDisplay: z.enum(['grid', 'list']).optional(),
    priceAlerts: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z.string().optional(),
    timezone: z.string().optional(),
  }).optional(),
  privacy: z.object({
    profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
    collectionVisibility: z.enum(['public', 'friends', 'private']).optional(),
    deckSharingDefault: z.enum(['public', 'unlisted', 'private']).optional(),
    showOnlineStatus: z.boolean().optional(),
    allowFriendRequests: z.boolean().optional(),
    allowTradeOffers: z.boolean().optional(),
    allowMessages: z.boolean().optional(),
    searchableProfile: z.boolean().optional(),
    shareActivityFeed: z.boolean().optional(),
    analyticsOptOut: z.boolean().optional(),
  }).optional(),
  notifications: z.object({
    email: z.object({
      priceAlerts: z.boolean().optional(),
      newSetReleases: z.boolean().optional(),
      deckSharing: z.boolean().optional(),
      securityAlerts: z.boolean().optional(),
      newsletter: z.boolean().optional(),
      accountUpdates: z.boolean().optional(),
      tradeOffers: z.boolean().optional(),
      friendRequests: z.boolean().optional(),
      tournamentReminders: z.boolean().optional(),
      systemMaintenance: z.boolean().optional(),
    }).optional(),
    push: z.object({
      enabled: z.boolean().optional(),
      priceAlerts: z.boolean().optional(),
      tradeOffers: z.boolean().optional(),
      friendActivity: z.boolean().optional(),
      tournamentUpdates: z.boolean().optional(),
    }).optional(),
    inApp: z.object({
      showToasts: z.boolean().optional(),
      soundEnabled: z.boolean().optional(),
      desktopEnabled: z.boolean().optional(),
      vibrationEnabled: z.boolean().optional(),
    }).optional(),
    frequency: z.enum(['realtime', 'daily', 'weekly', 'never']).optional(),
    quietHours: z.object({
      enabled: z.boolean().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getDbUser(userId);
    const features = await getSubscriptionFeatures(user.subscriptionTier);

    // Get default preferences/privacy/notifications or use stored ones
    const defaultPreferences = {
      defaultFormat: 'standard',
      preferredCurrency: 'USD',
      deckBuildingMode: 'beginner',
      collectionDisplay: 'grid',
      priceAlerts: false,
      theme: 'system',
      language: 'en',
      timezone: 'UTC',
    };

    const defaultPrivacy = {
      profileVisibility: 'public',
      collectionVisibility: 'friends',
      deckSharingDefault: 'unlisted',
      showOnlineStatus: true,
      allowFriendRequests: true,
      allowTradeOffers: true,
      allowMessages: true,
      searchableProfile: true,
      shareActivityFeed: true,
      analyticsOptOut: false,
    };

    const defaultNotifications = {
      email: {
        priceAlerts: true,
        newSetReleases: true,
        deckSharing: true,
        securityAlerts: true,
        newsletter: false,
        accountUpdates: true,
        tradeOffers: true,
        friendRequests: true,
        tournamentReminders: true,
        systemMaintenance: true,
      },
      push: {
        enabled: false,
        priceAlerts: false,
        tradeOffers: true,
        friendActivity: false,
        tournamentUpdates: true,
      },
      inApp: {
        showToasts: true,
        soundEnabled: false,
        desktopEnabled: false,
        vibrationEnabled: true,
      },
      frequency: 'realtime',
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    };

    const preferences = user.preferences as any || {};
    
    const profile: UserProfile = {
      clerkUserId: user.clerkUserId,
      username: user.username || '',
      email: user.email,
      avatar: user.avatarUrl || '',
      preferences: {
        ...defaultPreferences,
        ...(preferences.preferences || {}),
      },
      subscription: {
        tier: user.subscriptionTier,
        status: user.subscriptionEnd && user.subscriptionEnd > new Date() ? 'active' : 'canceled',
        currentPeriodStart: user.createdAt,
        currentPeriodEnd: user.subscriptionEnd || new Date(),
        cancelAtPeriodEnd: false,
        trialEnd: null,
        features,
        billing: {
          paymentMethod: null,
          billingEmail: user.email,
          invoices: [],
        },
      },
      privacy: {
        ...defaultPrivacy,
        ...(preferences.privacy || {}),
      },
      notifications: {
        ...defaultNotifications,
        ...(preferences.notifications || {}),
      },
      createdAt: user.createdAt,
      lastLogin: user.lastActiveAt,
      isActive: true,
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    // Check username uniqueness if updating
    if (validatedData.username) {
      const existingUser = await prisma.user.findUnique({
        where: { username: validatedData.username },
      });
      
      if (existingUser && existingUser.clerkUserId !== userId) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 400 }
        );
      }
    }

    // Get current user preferences
    const currentUser = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { preferences: true },
    });

    const currentPreferences = currentUser?.preferences as any || {};

    // Merge preferences deeply
    const updatedPreferences = {
      ...currentPreferences,
      preferences: {
        ...currentPreferences.preferences,
        ...validatedData.preferences,
      },
      privacy: {
        ...currentPreferences.privacy,
        ...validatedData.privacy,
      },
      notifications: {
        ...currentPreferences.notifications,
        ...validatedData.notifications,
      },
    };

    // Update user
    const updatedUser = await prisma.user.update({
      where: { clerkUserId: userId },
      data: {
        ...(validatedData.username && { username: validatedData.username }),
        ...(validatedData.displayName && { displayName: validatedData.displayName }),
        ...(validatedData.bio !== undefined && { bio: validatedData.bio }),
        ...(validatedData.avatarUrl && { avatarUrl: validatedData.avatarUrl }),
        preferences: updatedPreferences,
        lastActiveAt: new Date(),
      },
    });

    // Return updated profile
    const features = await getSubscriptionFeatures(updatedUser.subscriptionTier);
    
    const profile: UserProfile = {
      clerkUserId: updatedUser.clerkUserId,
      username: updatedUser.username || '',
      email: updatedUser.email,
      avatar: updatedUser.avatarUrl || '',
      preferences: updatedPreferences.preferences || {},
      subscription: {
        tier: updatedUser.subscriptionTier,
        status: updatedUser.subscriptionEnd && updatedUser.subscriptionEnd > new Date() ? 'active' : 'canceled',
        currentPeriodStart: updatedUser.createdAt,
        currentPeriodEnd: updatedUser.subscriptionEnd || new Date(),
        cancelAtPeriodEnd: false,
        trialEnd: null,
        features,
        billing: {
          paymentMethod: null,
          billingEmail: updatedUser.email,
          invoices: [],
        },
      },
      privacy: updatedPreferences.privacy || {},
      notifications: updatedPreferences.notifications || {},
      createdAt: updatedUser.createdAt,
      lastLogin: updatedUser.lastActiveAt,
      isActive: true,
    };

    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}