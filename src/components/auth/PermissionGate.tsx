'use client';

import { type ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import { api } from '@/utils/api';
import { hasPermission, requiresUpgrade, getUpgradeMessage } from '@/lib/auth/permissions';
import type { PermissionResource, PermissionAction } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface PermissionGateProps {
  resource: PermissionResource;
  action: PermissionAction;
  conditions?: Record<string, any>;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  upgradeFeature?: string;
}

/**
 * Component that conditionally renders children based on permissions
 */
export function PermissionGate({
  resource,
  action,
  conditions,
  children,
  fallback,
  showUpgradePrompt = true,
  upgradeFeature,
}: PermissionGateProps) {
  const { isLoaded: clerkLoaded } = useUser();
  const { data: user, isLoading } = api.user.getCurrentUser.useQuery(undefined, {
    enabled: clerkLoaded,
  });
  
  // Show loading state
  if (!clerkLoaded || isLoading) {
    return <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-8 rounded" />;
  }
  
  // Check permission
  const hasAccess = hasPermission(user || null, resource, action, conditions);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // Show fallback or upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showUpgradePrompt && upgradeFeature) {
    const needsUpgrade = requiresUpgrade(user || null, upgradeFeature as any);
    
    if (needsUpgrade) {
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
            {getUpgradeMessage(upgradeFeature)}
          </p>
          <Link href="/pricing">
            <Button size="sm" variant="primary">
              Upgrade Now
            </Button>
          </Link>
        </div>
      );
    }
  }
  
  // Default: hide content if no access
  return null;
}

interface FeatureGateProps {
  feature: keyof ReturnType<typeof import('@/lib/auth/permissions').getSubscriptionFeatures>;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * Component that conditionally renders children based on subscription features
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: FeatureGateProps) {
  const { isLoaded: clerkLoaded } = useUser();
  const { data: user, isLoading } = api.user.getCurrentUser.useQuery(undefined, {
    enabled: clerkLoaded,
  });
  
  // Show loading state
  if (!clerkLoaded || isLoading) {
    return <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-8 rounded" />;
  }
  
  const needsUpgrade = requiresUpgrade(user || null, feature);
  
  if (!needsUpgrade) {
    return <>{children}</>;
  }
  
  // Show fallback or upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showUpgradePrompt) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
          {getUpgradeMessage(feature)}
        </p>
        <Link href="/pricing">
          <Button size="sm" variant="primary">
            Upgrade Now
          </Button>
        </Link>
      </div>
    );
  }
  
  // Default: hide content if no access
  return null;
}

/**
 * Hook to check permissions programmatically
 */
export function usePermission(
  resource: PermissionResource,
  action: PermissionAction,
  conditions?: Record<string, any>
) {
  const { isLoaded: clerkLoaded } = useUser();
  const { data: user, isLoading } = api.user.getCurrentUser.useQuery(undefined, {
    enabled: clerkLoaded,
  });
  
  return {
    hasPermission: hasPermission(user || null, resource, action, conditions),
    isLoading: !clerkLoaded || isLoading,
    user,
  };
}

/**
 * Hook to check feature availability
 */
export function useFeature(
  feature: keyof ReturnType<typeof import('@/lib/auth/permissions').getSubscriptionFeatures>
) {
  const { isLoaded: clerkLoaded } = useUser();
  const { data: user, isLoading } = api.user.getCurrentUser.useQuery(undefined, {
    enabled: clerkLoaded,
  });
  
  return {
    hasFeature: !requiresUpgrade(user || null, feature),
    isLoading: !clerkLoaded || isLoading,
    user,
  };
}