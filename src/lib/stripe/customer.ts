import { stripe } from './config';
import { prisma } from '@/server/db';
import Stripe from 'stripe';

export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  // Check if user already has a Stripe customer ID
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { preferences: true },
  });

  const preferences = user?.preferences as any;
  const existingCustomerId = preferences?.stripe?.customerId;

  if (existingCustomerId) {
    try {
      // Verify the customer still exists in Stripe
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!customer.deleted) {
        return existingCustomerId;
      }
    } catch (error) {
      // Customer not found, create a new one
      console.error('Stripe customer not found:', error);
    }
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      clerkUserId: userId,
    },
  });

  // Save customer ID to user preferences
  await prisma.user.update({
    where: { clerkUserId: userId },
    data: {
      preferences: {
        ...(preferences || {}),
        stripe: {
          customerId: customer.id,
        },
      },
    },
  });

  return customer.id;
}

export async function updateStripeCustomer(
  customerId: string,
  updates: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> {
  return await stripe.customers.update(customerId, updates);
}

export async function getStripeCustomer(customerId: string): Promise<Stripe.Customer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return customer as Stripe.Customer;
  } catch (error) {
    console.error('Error retrieving Stripe customer:', error);
    return null;
  }
}

export async function getCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 100,
  });

  return subscriptions.data;
}

export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<Stripe.Subscription> {
  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  } else {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

export async function resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

export async function updateSubscription(
  subscriptionId: string,
  priceId: string,
  prorationBehavior: Stripe.SubscriptionUpdateParams.ProrationBehavior = 'create_prorations'
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  return await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: priceId,
      },
    ],
    proration_behavior: prorationBehavior,
  });
}