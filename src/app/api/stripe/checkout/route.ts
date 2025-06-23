import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { stripe, getStripePriceId, SUBSCRIPTION_METADATA_KEYS } from '@/lib/stripe/config';
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer';
import { SubscriptionTier } from '@prisma/client';
import { z } from 'zod';

const checkoutSchema = z.object({
  tier: z.nativeEnum(SubscriptionTier),
  period: z.enum(['monthly', 'yearly']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await currentUser();
    if (!user || !user.emailAddresses[0]?.emailAddress) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    const body = await request.json();
    const { tier, period, successUrl, cancelUrl } = checkoutSchema.parse(body);

    if (tier === SubscriptionTier.FREE) {
      return NextResponse.json({ error: 'Cannot checkout free tier' }, { status: 400 });
    }

    const priceId = getStripePriceId(tier, period);
    if (!priceId) {
      return NextResponse.json({ error: 'Invalid price configuration' }, { status: 400 });
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      userId,
      user.emailAddresses[0].emailAddress
    );

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          [SUBSCRIPTION_METADATA_KEYS.userId]: userId,
          [SUBSCRIPTION_METADATA_KEYS.tier]: tier,
        },
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
      },
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/account/billing?success=true`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: {
        [SUBSCRIPTION_METADATA_KEYS.userId]: userId,
        [SUBSCRIPTION_METADATA_KEYS.tier]: tier,
      },
    });

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Checkout session creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}