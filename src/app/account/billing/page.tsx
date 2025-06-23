'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSubscription } from '@/lib/auth/hooks';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';
import { Loader2, CreditCard, FileText, AlertCircle } from 'lucide-react';

export default function BillingPage() {
  const searchParams = useSearchParams();
  const { data: subscription, isLoading } = useSubscription();
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams]);

  const openCustomerPortal = async () => {
    try {
      setIsLoadingPortal(true);
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error opening customer portal:', error);
      // You might want to show an error toast here
    } finally {
      setIsLoadingPortal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {showSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-green-900">Subscription activated!</h3>
            <p className="text-sm text-green-700">
              Your premium features are now available. Thank you for subscribing!
            </p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, payment methods, and billing history.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Current Subscription */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
          <SubscriptionCard />
        </div>

        {/* Quick Actions */}
        {subscription?.tier !== 'FREE' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                onClick={openCustomerPortal}
                disabled={isLoadingPortal}
                className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
              >
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <h3 className="font-medium">Payment Methods</h3>
                  <p className="text-sm text-muted-foreground">
                    Update your credit card or payment information
                  </p>
                </div>
              </button>

              <button
                onClick={openCustomerPortal}
                disabled={isLoadingPortal}
                className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent transition-colors text-left"
              >
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <h3 className="font-medium">Billing History</h3>
                  <p className="text-sm text-muted-foreground">
                    View past invoices and download receipts
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Usage & Limits */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Usage & Limits</h2>
          <div className="border rounded-lg p-6 space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Deck Slots</span>
                <span className="text-sm text-muted-foreground">
                  {subscription?.features.maxDecks === -1 
                    ? 'Unlimited' 
                    : `0 / ${subscription?.features.maxDecks || 3}`}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary rounded-full h-2" style={{ width: '0%' }} />
              </div>
            </div>

            {subscription?.features.apiAccess && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">API Requests</span>
                  <span className="text-sm text-muted-foreground">
                    0 / 10,000 this month
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary rounded-full h-2" style={{ width: '0%' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cancellation */}
        {subscription?.tier !== 'FREE' && (
          <div className="border border-destructive/20 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium mb-1">Cancel Subscription</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You can cancel your subscription at any time. You&apos;ll continue to have access 
                  to premium features until the end of your billing period.
                </p>
                <button
                  onClick={openCustomerPortal}
                  disabled={isLoadingPortal}
                  className="text-sm text-destructive hover:text-destructive/90 font-medium"
                >
                  Cancel Subscription
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State for Portal */}
        {isLoadingPortal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card p-6 rounded-lg shadow-lg text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="text-sm">Opening billing portal...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}