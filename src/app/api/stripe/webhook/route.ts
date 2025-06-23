import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, STRIPE_WEBHOOK_SECRET, SUBSCRIPTION_METADATA_KEYS } from '@/lib/stripe/config';
import { prisma } from '@/server/db';
import { SubscriptionTier } from '@prisma/client';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.[SUBSCRIPTION_METADATA_KEYS.userId];
  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  
  await updateUserSubscription(userId, subscription);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata[SUBSCRIPTION_METADATA_KEYS.userId];
  if (!userId) return;

  await updateUserSubscription(userId, subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata[SUBSCRIPTION_METADATA_KEYS.userId];
  if (!userId) return;

  await prisma.user.update({
    where: { clerkUserId: userId },
    data: {
      subscriptionTier: SubscriptionTier.FREE,
      subscriptionEnd: null,
    },
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Log successful payment
  console.log(`Payment succeeded for invoice ${invoice.id}`);
  
  // You can add additional logic here like sending confirmation emails
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscription = invoice.subscription;
  if (!subscription) return;

  const subscriptionData = await stripe.subscriptions.retrieve(subscription as string);
  const userId = subscriptionData.metadata[SUBSCRIPTION_METADATA_KEYS.userId];
  
  if (!userId) return;

  // You can implement logic to notify the user about payment failure
  console.error(`Payment failed for user ${userId}, invoice ${invoice.id}`);
}

async function updateUserSubscription(userId: string, subscription: Stripe.Subscription) {
  const tier = subscription.metadata[SUBSCRIPTION_METADATA_KEYS.tier] as SubscriptionTier;
  
  if (!tier) {
    console.error('No tier in subscription metadata');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { preferences: true },
  });

  const preferences = user?.preferences as any || {};

  await prisma.user.update({
    where: { clerkUserId: userId },
    data: {
      subscriptionTier: tier,
      subscriptionEnd: new Date(subscription.current_period_end * 1000),
      preferences: {
        ...preferences,
        stripe: {
          ...(preferences.stripe || {}),
          subscriptionId: subscription.id,
          customerId: subscription.customer as string,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      },
    },
  });
}