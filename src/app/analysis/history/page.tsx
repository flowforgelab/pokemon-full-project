import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db/prisma';
import { AnalysisHistoryClient } from './analysis-history-client';

export default async function AnalysisHistoryPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true }
  });

  if (!user) {
    redirect('/sign-in');
  }

  // Get all analyses for the user
  const analyses = await prisma.analysis.findMany({
    where: {
      userId: user.id
    },
    include: {
      deck: {
        select: {
          id: true,
          name: true,
          formatId: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return (
    <div className="container mx-auto py-8">
      <AnalysisHistoryClient analyses={analyses} />
    </div>
  );
}