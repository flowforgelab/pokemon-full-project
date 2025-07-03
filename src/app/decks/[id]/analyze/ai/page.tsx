/**
 * AI Deck Analysis Page
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { AIAnalysisClient } from './ai-analysis-client';

export const metadata: Metadata = {
  title: 'AI Deck Analysis | Pokemon TCG Deck Builder',
  description: 'Get expert AI-powered analysis of your Pokemon TCG deck'
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AIAnalysisPage({ params }: PageProps) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    notFound();
  }

  // Get user subscription info
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { 
      id: true,
      subscriptionTier: true 
    }
  });

  if (!user || user.subscriptionTier === 'FREE') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">AI Analysis Requires Subscription</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Unlock AI-powered deck analysis with expert insights and recommendations
            by upgrading to a Basic subscription or higher.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            View Pricing Plans
          </a>
        </div>
      </div>
    );
  }

  // Get deck
  const deck = await prisma.deck.findFirst({
    where: { 
      id,
      userId: user.id
    },
    include: {
      cards: {
        include: {
          card: {
            include: {
              set: true
            }
          }
        }
      }
    }
  });

  if (!deck) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <AIAnalysisClient 
        deck={deck}
        userTier={user.subscriptionTier}
      />
    </div>
  );
}