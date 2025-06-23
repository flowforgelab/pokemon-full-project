'use client';

import { ReactNode } from 'react';
import { useFeatureAccess, useSubscription } from '@/lib/auth/hooks';
import { Lock } from 'lucide-react';
import Link from 'next/link';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  minimumTier?: 'BASIC' | 'PREMIUM' | 'ULTIMATE';
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  minimumTier,
}: FeatureGateProps) {
  const hasAccess = useFeatureAccess(feature);
  const { data: subscription } = useSubscription();

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 rounded-lg" />
        <div className="relative z-20 p-8 text-center">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Premium Feature</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This feature requires a {minimumTier || 'premium'} subscription.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Upgrade Now
          </Link>
        </div>
        <div className="opacity-50 pointer-events-none select-none">
          {children}
        </div>
      </div>
    );
  }

  return null;
}

interface ConditionalFeatureProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ConditionalFeature({
  feature,
  children,
  fallback,
}: ConditionalFeatureProps) {
  const hasAccess = useFeatureAccess(feature);
  
  return hasAccess ? <>{children}</> : <>{fallback || null}</>;
}