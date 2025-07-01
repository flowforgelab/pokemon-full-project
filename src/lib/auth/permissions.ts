import { SubscriptionTier } from '@prisma/client';
import type { User } from '@prisma/client';

/**
 * Frontend permission checking utilities
 */

export type PermissionResource = 
  | 'deck' 
  | 'collection' 
  | 'trade' 
  | 'analysis' 
  | 'price_alert' 
  | 'api' 
  | 'team' 
  | 'tournament' 
  | 'public_content' 
  | 'user_content' 
  | 'report' 
  | '*';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'manage';

export interface PermissionCheck {
  resource: PermissionResource;
  action: PermissionAction;
  conditions?: Record<string, any>;
}

/**
 * Check if a user has permission to perform an action on a resource
 */
export function hasPermission(
  user: User | null,
  resource: PermissionResource,
  action: PermissionAction,
  conditions?: Record<string, any>
): boolean {
  if (!user) return false;
  
  // Super admins and admins have all permissions
  if (user.features?.includes('admin') || user.features?.includes('super_admin')) {
    return true;
  }
  
  // Moderators have specific permissions
  if (user.features?.includes('moderator')) {
    const moderatorPermissions: PermissionCheck[] = [
      { resource: 'deck', action: 'read' },
      { resource: 'deck', action: 'update' },
      { resource: 'deck', action: 'delete' },
      { resource: 'collection', action: 'read' },
      { resource: 'trade', action: 'read' },
      { resource: 'trade', action: 'update' },
      { resource: 'trade', action: 'delete' },
      { resource: 'user_content', action: 'read' },
      { resource: 'user_content', action: 'update' },
      { resource: 'user_content', action: 'delete' },
      { resource: 'report', action: 'read' },
      { resource: 'report', action: 'update' },
      { resource: 'public_content', action: 'read' },
      { resource: 'public_content', action: 'update' },
      { resource: 'public_content', action: 'delete' },
    ];
    
    if (moderatorPermissions.some(p => 
      p.resource === resource && 
      p.action === action
    )) {
      return true;
    }
  }
  
  // Check subscription-based permissions
  switch (user.subscriptionTier) {
    case SubscriptionTier.ULTIMATE:
    case SubscriptionTier.PREMIUM:
      // Pro users have extensive permissions
      const proPermissions: PermissionResource[] = [
        'deck', 'collection', 'trade', 'analysis', 
        'price_alert', 'api', 'team', 'tournament', 'public_content'
      ];
      if (proPermissions.includes(resource)) {
        return true;
      }
      break;
      
    case SubscriptionTier.BASIC:
      // Premium users have intermediate permissions
      const premiumPermissions: PermissionCheck[] = [
        { resource: 'deck', action: 'create' },
        { resource: 'deck', action: 'read' },
        { resource: 'deck', action: 'update' },
        { resource: 'deck', action: 'delete' },
        { resource: 'collection', action: 'create' },
        { resource: 'collection', action: 'read' },
        { resource: 'collection', action: 'update' },
        { resource: 'collection', action: 'delete' },
        { resource: 'trade', action: 'create' },
        { resource: 'trade', action: 'read' },
        { resource: 'trade', action: 'update' },
        { resource: 'trade', action: 'delete' },
        { resource: 'analysis', action: 'read' },
        { resource: 'analysis', action: 'create' },
        { resource: 'price_alert', action: 'create' },
        { resource: 'price_alert', action: 'read' },
        { resource: 'price_alert', action: 'update' },
        { resource: 'price_alert', action: 'delete' },
        { resource: 'public_content', action: 'read' },
      ];
      
      if (premiumPermissions.some(p => 
        p.resource === resource && 
        p.action === action
      )) {
        return true;
      }
      break;
      
    case SubscriptionTier.FREE:
    default:
      // Free users have basic permissions
      const freePermissions: PermissionCheck[] = [
        { resource: 'deck', action: 'create', conditions: { own: true } },
        { resource: 'deck', action: 'read', conditions: { own: true } },
        { resource: 'deck', action: 'update', conditions: { own: true } },
        { resource: 'deck', action: 'delete', conditions: { own: true } },
        { resource: 'collection', action: 'create', conditions: { own: true } },
        { resource: 'collection', action: 'read', conditions: { own: true } },
        { resource: 'collection', action: 'update', conditions: { own: true } },
        { resource: 'collection', action: 'delete', conditions: { own: true } },
        { resource: 'trade', action: 'create', conditions: { own: true } },
        { resource: 'trade', action: 'read', conditions: { own: true } },
        { resource: 'public_content', action: 'read' },
      ];
      
      const permission = freePermissions.find(p => 
        p.resource === resource && 
        p.action === action
      );
      
      if (permission) {
        // Check conditions
        if (permission.conditions) {
          // If permission has conditions, they must be met
          if (!conditions) return false;
          return Object.entries(permission.conditions).every(
            ([key, value]) => conditions[key] === value
          );
        }
        // No conditions required for this permission
        return true;
      }
      break;
  }
  
  return false;
}

/**
 * Get subscription features for a user
 */
export function getSubscriptionFeatures(tier: SubscriptionTier) {
  return {
    [SubscriptionTier.FREE]: {
      maxDecks: 3,
      maxCollectionSize: 100,
      advancedAnalysis: false,
      priceAlerts: false,
      prioritySupport: false,
      apiAccess: false,
      exportFeatures: false,
      customBranding: false,
      teamFeatures: false,
      aiRecommendations: false,
      tournamentTools: false,
      bulkOperationLimit: 10,
    },
    [SubscriptionTier.BASIC]: {
      maxDecks: 10,
      maxCollectionSize: 500,
      advancedAnalysis: true,
      priceAlerts: true,
      prioritySupport: false,
      apiAccess: false,
      exportFeatures: true,
      customBranding: false,
      teamFeatures: false,
      aiRecommendations: false,
      tournamentTools: false,
      bulkOperationLimit: 25,
    },
    [SubscriptionTier.PREMIUM]: {
      maxDecks: 50,
      maxCollectionSize: 2000,
      advancedAnalysis: true,
      priceAlerts: true,
      prioritySupport: true,
      apiAccess: true,
      exportFeatures: true,
      customBranding: true,
      teamFeatures: true,
      aiRecommendations: true,
      tournamentTools: false,
      bulkOperationLimit: 100,
    },
    [SubscriptionTier.ULTIMATE]: {
      maxDecks: -1, // Unlimited
      maxCollectionSize: -1, // Unlimited
      advancedAnalysis: true,
      priceAlerts: true,
      prioritySupport: true,
      apiAccess: true,
      exportFeatures: true,
      customBranding: true,
      teamFeatures: true,
      aiRecommendations: true,
      tournamentTools: true,
      bulkOperationLimit: 500,
    },
  }[tier];
}

/**
 * Check if user can perform bulk operations
 */
export function canPerformBulkOperation(
  user: User | null,
  itemCount: number
): boolean {
  if (!user) return false;
  
  const features = getSubscriptionFeatures(user.subscriptionTier);
  return itemCount <= features.bulkOperationLimit;
}

/**
 * Check if user has reached deck limit
 */
export function hasReachedDeckLimit(
  user: User | null,
  currentDeckCount: number
): boolean {
  if (!user) return true;
  
  const features = getSubscriptionFeatures(user.subscriptionTier);
  if (features.maxDecks === -1) return false; // Unlimited
  
  return currentDeckCount >= features.maxDecks;
}

/**
 * Check if user has reached collection limit
 */
export function hasReachedCollectionLimit(
  user: User | null,
  currentCollectionSize: number
): boolean {
  if (!user) return true;
  
  const features = getSubscriptionFeatures(user.subscriptionTier);
  if (features.maxCollectionSize === -1) return false; // Unlimited
  
  return currentCollectionSize >= features.maxCollectionSize;
}

/**
 * Get user role display name
 */
export function getUserRoleDisplayName(user: User | null): string {
  if (!user) return 'Guest';
  
  if (user.features?.includes('super_admin')) return 'Super Admin';
  if (user.features?.includes('admin')) return 'Admin';
  if (user.features?.includes('moderator')) return 'Moderator';
  
  switch (user.subscriptionTier) {
    case SubscriptionTier.ULTIMATE:
      return 'Ultimate Member';
    case SubscriptionTier.PREMIUM:
      return 'Premium Member';
    case SubscriptionTier.BASIC:
      return 'Basic Member';
    case SubscriptionTier.FREE:
    default:
      return 'Free Member';
  }
}

/**
 * Check if user requires upgrade for a feature
 */
export function requiresUpgrade(
  user: User | null,
  feature: keyof ReturnType<typeof getSubscriptionFeatures>
): boolean {
  if (!user) return true;
  
  const features = getSubscriptionFeatures(user.subscriptionTier);
  const featureValue = features[feature];
  
  // If it's a boolean feature, check if it's false
  if (typeof featureValue === 'boolean') {
    return !featureValue;
  }
  
  // If it's a numeric limit, we can't determine without current usage
  return false;
}

/**
 * Get upgrade message for a feature
 */
export function getUpgradeMessage(feature: string): string {
  const messages: Record<string, string> = {
    advancedAnalysis: 'Upgrade to Basic or higher to access advanced deck analysis',
    priceAlerts: 'Upgrade to Basic or higher to set price alerts',
    apiAccess: 'Upgrade to Premium or higher to access the API',
    teamFeatures: 'Upgrade to Premium or higher to create teams',
    tournamentTools: 'Upgrade to Ultimate to access tournament tools',
    maxDecks: 'Upgrade your subscription to create more decks',
    maxCollectionSize: 'Upgrade your subscription to add more cards to your collection',
  };
  
  return messages[feature] || 'Upgrade your subscription to access this feature';
}