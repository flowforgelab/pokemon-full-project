import { UserRole, Permission } from '@/types/auth';
import { SubscriptionTier } from '@prisma/client';

export class RBAC {
  private static instance: RBAC;
  private roleHierarchy: Map<string, number>;
  private rolePermissions: Map<string, Permission[]>;

  private constructor() {
    // Define role hierarchy (higher number = more privileges)
    this.roleHierarchy = new Map([
      ['user', 1],
      ['premium_user', 2],
      ['pro_user', 3],
      ['moderator', 4],
      ['admin', 5],
      ['super_admin', 6],
    ]);

    // Define permissions for each role
    this.rolePermissions = new Map([
      ['user', this.getUserPermissions()],
      ['premium_user', this.getPremiumUserPermissions()],
      ['pro_user', this.getProUserPermissions()],
      ['moderator', this.getModeratorPermissions()],
      ['admin', this.getAdminPermissions()],
      ['super_admin', this.getSuperAdminPermissions()],
    ]);
  }

  static getInstance(): RBAC {
    if (!RBAC.instance) {
      RBAC.instance = new RBAC();
    }
    return RBAC.instance;
  }

  hasRole(userRole: string, requiredRole: string): boolean {
    const userLevel = this.roleHierarchy.get(userRole) || 0;
    const requiredLevel = this.roleHierarchy.get(requiredRole) || Infinity;
    return userLevel >= requiredLevel;
  }

  hasPermission(
    userRole: string,
    resource: string,
    action: string,
    conditions?: Record<string, any>
  ): boolean {
    const permissions = this.rolePermissions.get(userRole) || [];
    
    return permissions.some(permission => {
      // Check wildcard permissions
      if (permission.resource === '*' && permission.actions.includes(action as any)) {
        return true;
      }
      
      // Check specific resource permissions
      if (permission.resource === resource && permission.actions.includes(action as any)) {
        // Check conditions if any
        if (permission.conditions && conditions) {
          return Object.entries(permission.conditions).every(
            ([key, value]) => conditions[key] === value
          );
        }
        return true;
      }
      
      return false;
    });
  }

  getRoleFromSubscription(tier: SubscriptionTier): string {
    const tierToRole: Record<SubscriptionTier, string> = {
      [SubscriptionTier.FREE]: 'user',
      [SubscriptionTier.BASIC]: 'premium_user',
      [SubscriptionTier.PREMIUM]: 'pro_user',
      [SubscriptionTier.ULTIMATE]: 'pro_user',
    };
    
    return tierToRole[tier] || 'user';
  }

  private getUserPermissions(): Permission[] {
    return [
      { resource: 'deck', actions: ['create', 'read', 'update', 'delete'], conditions: { own: true } },
      { resource: 'collection', actions: ['create', 'read', 'update', 'delete'], conditions: { own: true } },
      { resource: 'trade', actions: ['create', 'read'], conditions: { own: true } },
      { resource: 'public_content', actions: ['read'] },
      { resource: 'profile', actions: ['read', 'update'], conditions: { own: true } },
      { resource: 'comment', actions: ['create', 'read'], conditions: { own: true } },
    ];
  }

  private getPremiumUserPermissions(): Permission[] {
    return [
      ...this.getUserPermissions(),
      { resource: 'analysis', actions: ['read', 'create'], conditions: { advanced: true } },
      { resource: 'price_alert', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'export', actions: ['create'] },
      { resource: 'trade', actions: ['create', 'read', 'update', 'delete'], conditions: { own: true } },
    ];
  }

  private getProUserPermissions(): Permission[] {
    return [
      ...this.getPremiumUserPermissions(),
      { resource: 'api', actions: ['read', 'create'] },
      { resource: 'team', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'tournament', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'public_content', actions: ['read', 'create'] },
      { resource: 'analytics', actions: ['read'] },
    ];
  }

  private getModeratorPermissions(): Permission[] {
    return [
      { resource: 'deck', actions: ['read', 'update', 'delete'] },
      { resource: 'collection', actions: ['read'] },
      { resource: 'trade', actions: ['read', 'update', 'delete'] },
      { resource: 'user_content', actions: ['read', 'update', 'delete'] },
      { resource: 'report', actions: ['read', 'update'] },
      { resource: 'public_content', actions: ['read', 'update', 'delete'] },
      { resource: 'comment', actions: ['read', 'update', 'delete'] },
      { resource: 'ban', actions: ['create', 'read'] },
    ];
  }

  private getAdminPermissions(): Permission[] {
    return [
      { resource: '*', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'user', actions: ['manage'] },
      { resource: 'subscription', actions: ['manage'] },
      { resource: 'system', actions: ['read'] },
    ];
  }

  private getSuperAdminPermissions(): Permission[] {
    return [
      { resource: '*', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    ];
  }
}

// Export singleton instance
export const rbac = RBAC.getInstance();

// Helper functions
export function canAccess(
  userRole: string,
  resource: string,
  action: string,
  conditions?: Record<string, any>
): boolean {
  return rbac.hasPermission(userRole, resource, action, conditions);
}

export function hasRole(userRole: string, requiredRole: string): boolean {
  return rbac.hasRole(userRole, requiredRole);
}

export function requireRole(userRole: string, requiredRole: string): void {
  if (!hasRole(userRole, requiredRole)) {
    throw new Error(`Insufficient role. Required: ${requiredRole}, Current: ${userRole}`);
  }
}

export function requirePermission(
  userRole: string,
  resource: string,
  action: string,
  conditions?: Record<string, any>
): void {
  if (!canAccess(userRole, resource, action, conditions)) {
    throw new Error(`Insufficient permissions for ${action} on ${resource}`);
  }
}