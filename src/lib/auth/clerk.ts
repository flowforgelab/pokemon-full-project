import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/server/db';
import { SubscriptionTier } from '@prisma/client';
import { UserRole, Permission } from '@/types/auth';

export async function getAuth() {
  return auth();
}

export async function getUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('User not authenticated');
  }
  return userId;
}

export async function getDbUser(clerkUserId?: string) {
  const userId = clerkUserId || await getUserId();
  
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      collections: {
        select: { id: true },
        take: 1,
      },
      decks: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!user) {
    // Auto-create user on first access
    const clerkUserData = await currentUser();
    if (!clerkUserData) throw new Error('User not found in Clerk');

    return await prisma.user.create({
      data: {
        clerkUserId: userId,
        email: clerkUserData.emailAddresses[0]?.emailAddress || '',
        username: clerkUserData.username,
        displayName: `${clerkUserData.firstName || ''} ${clerkUserData.lastName || ''}`.trim() || clerkUserData.username,
        avatarUrl: clerkUserData.imageUrl,
        preferences: {
          theme: 'system',
          language: 'en',
          timezone: 'UTC',
          defaultFormat: 'standard',
          preferredCurrency: 'USD',
          deckBuildingMode: 'beginner',
          collectionDisplay: 'grid',
          priceAlerts: false,
        },
      },
    });
  }

  return user;
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      subscriptionTier: true,
      features: true,
    },
  });

  if (!user) {
    return {
      name: 'user',
      permissions: getPermissionsForRole('user'),
    };
  }

  // Map subscription tiers to roles
  const roleMap: Record<SubscriptionTier, UserRole['name']> = {
    [SubscriptionTier.FREE]: 'user',
    [SubscriptionTier.BASIC]: 'premium_user',
    [SubscriptionTier.PREMIUM]: 'pro_user',
    [SubscriptionTier.ULTIMATE]: 'pro_user',
  };

  // Check for admin/moderator flags in features array
  if (user.features.includes('admin')) {
    return {
      name: 'admin',
      permissions: getPermissionsForRole('admin'),
    };
  }

  if (user.features.includes('moderator')) {
    return {
      name: 'moderator',
      permissions: getPermissionsForRole('moderator'),
    };
  }

  return {
    name: roleMap[user.subscriptionTier],
    permissions: getPermissionsForRole(roleMap[user.subscriptionTier]),
  };
}

export function getPermissionsForRole(role: UserRole['name']): Permission[] {
  const permissions: Record<UserRole['name'], Permission[]> = {
    user: [
      { resource: 'deck', actions: ['create', 'read', 'update', 'delete'], conditions: { own: true } },
      { resource: 'collection', actions: ['create', 'read', 'update', 'delete'], conditions: { own: true } },
      { resource: 'trade', actions: ['create', 'read'], conditions: { own: true } },
      { resource: 'public_content', actions: ['read'] },
    ],
    premium_user: [
      { resource: 'deck', actions: ['create', 'read', 'update', 'delete'], conditions: { own: true } },
      { resource: 'collection', actions: ['create', 'read', 'update', 'delete'], conditions: { own: true } },
      { resource: 'trade', actions: ['create', 'read', 'update', 'delete'], conditions: { own: true } },
      { resource: 'analysis', actions: ['read', 'create'], conditions: { advanced: true } },
      { resource: 'price_alert', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'export', actions: ['create'] },
      { resource: 'public_content', actions: ['read'] },
    ],
    pro_user: [
      { resource: 'deck', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'collection', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'trade', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'analysis', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'price_alert', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'api', actions: ['read', 'create'] },
      { resource: 'team', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'tournament', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'public_content', actions: ['read', 'create'] },
    ],
    moderator: [
      { resource: 'deck', actions: ['read', 'update', 'delete'] },
      { resource: 'collection', actions: ['read'] },
      { resource: 'trade', actions: ['read', 'update', 'delete'] },
      { resource: 'user_content', actions: ['read', 'update', 'delete'] },
      { resource: 'report', actions: ['read', 'update'] },
      { resource: 'public_content', actions: ['read', 'update', 'delete'] },
    ],
    admin: [
      { resource: '*', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    ],
    super_admin: [
      { resource: '*', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    ],
  };

  return permissions[role] || permissions.user;
}

export async function checkPermission(
  userId: string,
  resource: string,
  action: string,
  conditions?: Record<string, any>
): Promise<boolean> {
  const role = await getUserRole(userId);
  
  for (const permission of role.permissions) {
    // Check wildcard permissions
    if (permission.resource === '*' && permission.actions.includes(action as any)) {
      return true;
    }
    
    // Check specific resource permissions
    if (permission.resource === resource && permission.actions.includes(action as any)) {
      // Check conditions if any
      if (permission.conditions && conditions) {
        const conditionsMet = Object.entries(permission.conditions).every(
          ([key, value]) => conditions[key] === value
        );
        return conditionsMet;
      }
      return true;
    }
  }
  
  return false;
}

export async function requirePermission(
  userId: string,
  resource: string,
  action: string,
  conditions?: Record<string, any>
) {
  const hasPermission = await checkPermission(userId, resource, action, conditions);
  
  if (!hasPermission) {
    throw new Error(`Insufficient permissions for ${action} on ${resource}`);
  }
}

export async function getSubscriptionFeatures(tier: SubscriptionTier) {
  const features = {
    [SubscriptionTier.FREE]: {
      maxDecks: 3,
      advancedAnalysis: false,
      priceAlerts: false,
      prioritySupport: false,
      apiAccess: false,
      exportFeatures: false,
      customBranding: false,
      teamFeatures: false,
      aiRecommendations: false,
      tournamentTools: false,
    },
    [SubscriptionTier.BASIC]: {
      maxDecks: 10,
      advancedAnalysis: true,
      priceAlerts: true,
      prioritySupport: false,
      apiAccess: false,
      exportFeatures: true,
      customBranding: false,
      teamFeatures: false,
      aiRecommendations: false,
      tournamentTools: false,
    },
    [SubscriptionTier.PREMIUM]: {
      maxDecks: 50,
      advancedAnalysis: true,
      priceAlerts: true,
      prioritySupport: true,
      apiAccess: true,
      exportFeatures: true,
      customBranding: true,
      teamFeatures: true,
      aiRecommendations: true,
      tournamentTools: false,
    },
    [SubscriptionTier.ULTIMATE]: {
      maxDecks: -1, // Unlimited
      advancedAnalysis: true,
      priceAlerts: true,
      prioritySupport: true,
      apiAccess: true,
      exportFeatures: true,
      customBranding: true,
      teamFeatures: true,
      aiRecommendations: true,
      tournamentTools: true,
    },
  };

  return features[tier];
}