import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDbUser, getSubscriptionFeatures } from '@/lib/auth/clerk';
import { SubscriptionDetails } from '@/types/auth';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getDbUser(userId);
    const features = await getSubscriptionFeatures(user.subscriptionTier);

    // Get stripe subscription details if available
    const stripeDetails = user.preferences as any;
    const stripeCustomerId = stripeDetails?.stripe?.customerId;
    const stripeSubscriptionId = stripeDetails?.stripe?.subscriptionId;

    const subscription: SubscriptionDetails = {
      tier: user.subscriptionTier,
      status: determineSubscriptionStatus(user),
      currentPeriodStart: user.createdAt,
      currentPeriodEnd: user.subscriptionEnd || getDefaultPeriodEnd(user.createdAt),
      cancelAtPeriodEnd: false,
      trialEnd: null,
      features,
      billing: {
        paymentMethod: null,
        billingEmail: user.email,
        invoices: [],
      },
      stripeCustomerId,
      stripeSubscriptionId,
    };

    return NextResponse.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription details' },
      { status: 500 }
    );
  }
}

function determineSubscriptionStatus(user: any): SubscriptionDetails['status'] {
  if (user.subscriptionTier === 'FREE') {
    return 'active';
  }

  if (!user.subscriptionEnd) {
    return 'canceled';
  }

  const now = new Date();
  if (user.subscriptionEnd > now) {
    return 'active';
  }

  return 'canceled';
}

function getDefaultPeriodEnd(startDate: Date): Date {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  return endDate;
}