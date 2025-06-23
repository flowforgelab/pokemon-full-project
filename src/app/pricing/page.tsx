'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Check, X, Zap, Crown, Star } from 'lucide-react';
import { SubscriptionTier } from '@prisma/client';

const tiers = [
  {
    id: SubscriptionTier.FREE,
    name: 'Free',
    price: 0,
    period: 'forever',
    description: 'Perfect for casual players getting started',
    icon: Star,
    color: 'border-slate-200',
    buttonColor: 'bg-slate-900 hover:bg-slate-800',
    features: {
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
    highlights: [
      'Basic deck building',
      'Collection tracking',
      'Card search',
      'Community features',
    ],
  },
  {
    id: SubscriptionTier.BASIC,
    name: 'Basic',
    price: 4.99,
    period: 'month',
    description: 'For dedicated trainers building competitive decks',
    icon: Zap,
    color: 'border-blue-200',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
    popular: false,
    features: {
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
    highlights: [
      'Everything in Free',
      '10 deck slots',
      'Advanced deck analysis',
      'Price alerts',
      'Export features',
    ],
  },
  {
    id: SubscriptionTier.PREMIUM,
    name: 'Premium',
    price: 9.99,
    period: 'month',
    description: 'For serious players and content creators',
    icon: Crown,
    color: 'border-purple-200',
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
    popular: true,
    features: {
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
    highlights: [
      'Everything in Basic',
      '50 deck slots',
      'AI deck recommendations',
      'Team collaboration',
      'API access',
      'Priority support',
    ],
  },
  {
    id: SubscriptionTier.ULTIMATE,
    name: 'Ultimate',
    price: 19.99,
    period: 'month',
    description: 'For professionals and tournament organizers',
    icon: Crown,
    color: 'border-yellow-200',
    buttonColor: 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700',
    features: {
      maxDecks: -1,
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
    highlights: [
      'Everything in Premium',
      'Unlimited deck slots',
      'Tournament tools',
      'Custom branding',
      'Dedicated support',
      'Early access features',
    ],
  },
];

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleSubscribe = (tierId: SubscriptionTier) => {
    if (!isSignedIn) {
      router.push('/sign-up');
      return;
    }

    // Navigate to checkout with tier
    router.push(`/checkout?tier=${tierId}&period=${billingPeriod}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Start free and upgrade as you grow. All plans include core features with no hidden fees.
          </p>
          
          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                billingPeriod === 'yearly'
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yearly
              <span className="ml-2 text-xs text-green-600 font-semibold">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const price = billingPeriod === 'yearly' && tier.price > 0 
              ? (tier.price * 12 * 0.8).toFixed(2) 
              : tier.price;
            const period = billingPeriod === 'yearly' && tier.price > 0 
              ? 'year' 
              : tier.period;

            return (
              <div
                key={tier.id}
                className={`relative bg-card border-2 ${tier.color} rounded-lg p-6 flex flex-col ${
                  tier.popular ? 'scale-105 shadow-xl' : ''
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold">{tier.name}</h3>
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {tier.description}
                  </p>
                  
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      ${price === 0 ? '0' : price}
                    </span>
                    {price !== 0 && (
                      <span className="text-muted-foreground">/{period}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mb-6 flex-1">
                  {tier.highlights.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleSubscribe(tier.id)}
                  className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors ${
                    tier.buttonColor
                  }`}
                >
                  {tier.price === 0 ? 'Get Started' : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison */}
        <div className="mt-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Compare Features</h2>
          
          <div className="bg-card rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-4">Feature</th>
                  {tiers.map((tier) => (
                    <th key={tier.id} className="text-center p-4 font-medium">
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="p-4 font-medium">Deck Slots</td>
                  {tiers.map((tier) => (
                    <td key={tier.id} className="text-center p-4">
                      {tier.features.maxDecks === -1 ? 'Unlimited' : tier.features.maxDecks}
                    </td>
                  ))}
                </tr>
                {Object.entries(tiers[0].features).map(([key, _]) => {
                  if (key === 'maxDecks') return null;
                  
                  const featureLabels: Record<string, string> = {
                    advancedAnalysis: 'Advanced Analysis',
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
                    <tr key={key}>
                      <td className="p-4 font-medium">{featureLabels[key]}</td>
                      {tiers.map((tier) => (
                        <td key={tier.id} className="text-center p-4">
                          {tier.features[key as keyof typeof tier.features] ? (
                            <Check className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          
          <div className="space-y-4">
            {[
              {
                q: 'Can I change my plan anytime?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, debit cards, and PayPal through our secure payment processor, Stripe.',
              },
              {
                q: 'Is there a free trial?',
                a: 'You can start with our Free plan and upgrade anytime. Premium features have a 7-day money-back guarantee.',
              },
              {
                q: 'Can I cancel my subscription?',
                a: 'Yes, you can cancel anytime. You\'ll continue to have access until the end of your billing period.',
              },
            ].map((faq, index) => (
              <div key={index} className="bg-card border rounded-lg p-6">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}