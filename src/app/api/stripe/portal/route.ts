import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe/config';
import { prisma } from '@/server/db';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's Stripe customer ID
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { preferences: true },
    });

    const preferences = user?.preferences as any;
    const customerId = preferences?.stripe?.customerId;

    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing information found' },
        { status: 400 }
      );
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Customer portal creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
}