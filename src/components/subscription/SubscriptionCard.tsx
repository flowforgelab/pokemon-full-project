'use client';

import { useSubscription } from '@/lib/auth/hooks';
import { SubscriptionTier } from '@prisma/client';
import { Check, X, Zap, Crown, Star } from 'lucide-react';
import Link from 'next/link';

const tierInfo = {
  [SubscriptionTier.FREE]: {
    name: 'Free',
    icon: Star,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  },
  [SubscriptionTier.BASIC]: {
    name: 'Basic',
    icon: Zap,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  [SubscriptionTier.PREMIUM]: {
    name: 'Premium',
    icon: Crown,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  [SubscriptionTier.ULTIMATE]: {
    name: 'Ultimate',
    icon: Crown,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
};

export function SubscriptionCard() {
  const { data: subscription, isLoading } = useSubscription();

  if (isLoading || !subscription) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-muted rounded-lg" />
      </div>
    );
  }

  const tier = tierInfo[subscription.tier];
  const Icon = tier.icon;

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`p-2 rounded-md ${tier.bgColor}`}>
              <Icon className={`h-5 w-5 ${tier.color}`} />
            </div>
            <h3 className="text-lg font-semibold">{tier.name} Plan</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {subscription.status === 'active' ? 'Active' : 'Inactive'} subscription
          </p>
        </div>
        
        {subscription.tier !== SubscriptionTier.ULTIMATE && (
          <Link
            href="/pricing"
            className="text-sm text-primary hover:text-primary/90 font-medium"
          >
            Upgrade
          </Link>
        )}
      </div>

      {subscription.status === 'active' && subscription.currentPeriodEnd && (
        <div className="text-sm">
          <span className="text-muted-foreground">Renews on: </span>
          <span className="font-medium">
            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </span>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t">
        <h4 className="text-sm font-medium mb-3">Your Features</h4>
        <div className="grid gap-2">
          {Object.entries(subscription.features).map(([key, value]) => {
            if (key === 'maxDecks') {
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>
                    {value === -1 ? 'Unlimited' : value} Decks
                  </span>
                </div>
              );
            }
            
            const featureLabels: Record<string, string> = {
              advancedAnalysis: 'Advanced Deck Analysis',
              priceAlerts: 'Price Alerts',
              prioritySupport: 'Priority Support',
              apiAccess: 'API Access',
              exportFeatures: 'Export Features',
              customBranding: 'Custom Branding',
              teamFeatures: 'Team Features',
              aiRecommendations: 'AI Recommendations',
              tournamentTools: 'Tournament Tools',
            };

            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                {value ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={value ? '' : 'text-muted-foreground'}>
                  {featureLabels[key] || key}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Link
          href="/account/billing"
          className="flex-1 px-3 py-2 text-sm border border-input rounded-md hover:bg-accent text-center"
        >
          Manage Billing
        </Link>
        <Link
          href="/pricing"
          className="flex-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-center"
        >
          View All Plans
        </Link>
      </div>
    </div>
  );
}