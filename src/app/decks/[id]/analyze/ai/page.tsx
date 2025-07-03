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

  // Get user subscription info (AI analysis is now free for all)
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { 
      id: true,
      subscriptionTier: true 
    }
  });

  // Create user if they don't exist
  const finalUser = user || await prisma.user.create({
    data: {
      clerkUserId: userId,
      subscriptionTier: 'FREE'
    }
  });

  // Get deck
  const deck = await prisma.deck.findFirst({
    where: { 
      id,
      userId: finalUser.id
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
        userTier={finalUser.subscriptionTier}
      />
    </div>
  );
}