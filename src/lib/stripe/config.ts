import Stripe from 'stripe';
import { SubscriptionTier } from '@prisma/client';

// Initialize Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

// Price IDs from Stripe Dashboard
export const STRIPE_PRICE_IDS = {
  [SubscriptionTier.BASIC]: {
    monthly: process.env.STRIPE_BASIC_MONTHLY_PRICE_ID!,
    yearly: process.env.STRIPE_BASIC_YEARLY_PRICE_ID!,
  },
  [SubscriptionTier.PREMIUM]: {
    monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID!,
    yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID!,
  },
  [SubscriptionTier.ULTIMATE]: {
    monthly: process.env.STRIPE_ULTIMATE_MONTHLY_PRICE_ID!,
    yearly: process.env.STRIPE_ULTIMATE_YEARLY_PRICE_ID!,
  },
};

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper to get price ID
export function getStripePriceId(tier: SubscriptionTier, period: 'monthly' | 'yearly'): string | null {
  if (tier === SubscriptionTier.FREE) return null;
  return STRIPE_PRICE_IDS[tier]?.[period] || null;
}

// Subscription metadata keys
export const SUBSCRIPTION_METADATA_KEYS = {
  userId: 'clerk_user_id',
  tier: 'subscription_tier',
} as const;