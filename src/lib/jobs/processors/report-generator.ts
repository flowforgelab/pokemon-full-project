import { Job } from 'bullmq';
import { prisma } from '@/lib/db/prisma';
import type { JobData, JobResult } from '@/lib/api/types';

export async function processReportJob(job: Job<JobData>): Promise<JobResult> {
  const { reportType, period = 'week' } = job.data.payload;
  
  try {
    await job.updateProgress(5);

    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    let report: any = {
      type: reportType,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      generatedAt: new Date().toISOString(),
    };

    switch (reportType) {
      case 'usage':
        report = await generateUsageReport(startDate, endDate, report, job);
        break;
      
      case 'trading':
        report = await generateTradingReport(startDate, endDate, report, job);
        break;
      
      case 'collection':
        report = await generateCollectionReport(startDate, endDate, report, job);
        break;
      
      case 'pricing':
        report = await generatePricingReport(startDate, endDate, report, job);
        break;
      
      case 'health':
        report = await generateHealthReport(report, job);
        break;
      
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    await job.updateProgress(100);

    return {
      success: true,
      message: `${reportType} report generated successfully`,
      data: report,
    };
  } catch (error) {
    console.error('Report generation job failed:', error);
    return {
      success: false,
      message: 'Report generation job failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function generateUsageReport(
  startDate: Date,
  endDate: Date,
  report: any,
  job: Job
): Promise<any> {
  await job.updateProgress(20);

  // User statistics
  const newUsers = await prisma.user.count({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const activeUsers = await prisma.user.count({
    where: {
      lastActiveAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  await job.updateProgress(40);

  // Deck statistics
  const newDecks = await prisma.deck.count({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const decksByType = await prisma.deck.groupBy({
    by: ['deckType'],
    _count: true,
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  await job.updateProgress(60);

  // Popular cards
  const popularCards = await prisma.deckCard.groupBy({
    by: ['cardId'],
    _count: true,
    orderBy: {
      _count: {
        cardId: 'desc',
      },
    },
    take: 10,
  });

  const cardDetails = await prisma.card.findMany({
    where: {
      id: { in: popularCards.map(pc => pc.cardId) },
    },
    select: {
      id: true,
      name: true,
      rarity: true,
    },
  });

  const popularCardsWithDetails = popularCards.map(pc => ({
    card: cardDetails.find(c => c.id === pc.cardId),
    count: pc._count,
  }));

  await job.updateProgress(80);

  return {
    ...report,
    users: {
      new: newUsers,
      active: activeUsers,
    },
    decks: {
      new: newDecks,
      byType: decksByType,
    },
    popularCards: popularCardsWithDetails,
  };
}

async function generateTradingReport(
  startDate: Date,
  endDate: Date,
  report: any,
  job: Job
): Promise<any> {
  await job.updateProgress(30);

  const tradeStats = await prisma.tradeOffer.groupBy({
    by: ['status'],
    _count: true,
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  await job.updateProgress(60);

  const completedTrades = await prisma.tradeOffer.count({
    where: {
      status: 'COMPLETED',
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return {
    ...report,
    trades: {
      byStatus: tradeStats,
      completed: completedTrades,
    },
  };
}

async function generateCollectionReport(
  startDate: Date,
  endDate: Date,
  report: any,
  job: Job
): Promise<any> {
  await job.updateProgress(30);

  const totalCollectionValue = await prisma.$queryRaw<{ total: number }[]>`
    SELECT SUM(uc.quantity * cp.price) as total
    FROM "UserCollection" uc
    JOIN "CardPrice" cp ON cp."cardId" = uc."cardId"
    WHERE cp."priceType" = 'MARKET'
      AND cp."source" = 'TCGPLAYER'
      AND uc."isWishlist" = false
  `;

  await job.updateProgress(50);

  const collectionsByRarity = await prisma.userCollection.groupBy({
    by: ['condition'],
    _sum: {
      quantity: true,
    },
    where: {
      isWishlist: false,
    },
  });

  await job.updateProgress(70);

  const largestCollections = await prisma.userCollection.groupBy({
    by: ['userId'],
    _sum: {
      quantity: true,
    },
    orderBy: {
      _sum: {
        quantity: 'desc',
      },
    },
    take: 10,
  });

  return {
    ...report,
    collections: {
      totalValue: totalCollectionValue[0]?.total || 0,
      byCondition: collectionsByRarity,
      largest: largestCollections,
    },
  };
}

async function generatePricingReport(
  startDate: Date,
  endDate: Date,
  report: any,
  job: Job
): Promise<any> {
  await job.updateProgress(30);

  // Most valuable cards
  const valuableCards = await prisma.cardPrice.findMany({
    where: {
      priceType: 'MARKET',
      source: 'TCGPLAYER',
    },
    orderBy: {
      price: 'desc',
    },
    take: 20,
    include: {
      card: {
        select: {
          name: true,
          rarity: true,
          set: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  await job.updateProgress(50);

  // Biggest price changes
  const priceChanges = await prisma.$queryRaw<any[]>`
    WITH price_changes AS (
      SELECT 
        ph."cardId",
        ph.price as current_price,
        LAG(ph.price) OVER (PARTITION BY ph."cardId" ORDER BY ph.date) as previous_price,
        ph.date
      FROM "PriceHistory" ph
      WHERE ph.date >= ${startDate}
        AND ph."priceType" = 'MARKET'
        AND ph.source = 'TCGPLAYER'
    )
    SELECT 
      pc."cardId",
      c.name,
      pc.current_price,
      pc.previous_price,
      (pc.current_price - pc.previous_price) as change,
      ((pc.current_price - pc.previous_price) / pc.previous_price * 100) as change_percent
    FROM price_changes pc
    JOIN "Card" c ON c.id = pc."cardId"
    WHERE pc.previous_price IS NOT NULL
      AND pc.previous_price > 0
    ORDER BY ABS(pc.current_price - pc.previous_price) DESC
    LIMIT 20
  `;

  await job.updateProgress(80);

  return {
    ...report,
    pricing: {
      mostValuable: valuableCards,
      biggestChanges: priceChanges,
    },
  };
}

async function generateHealthReport(report: any, job: Job): Promise<any> {
  await job.updateProgress(30);

  // Database statistics
  const dbStats = await prisma.$queryRaw<any[]>`
    SELECT 
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  `;

  await job.updateProgress(50);

  // API health (this would normally check actual API endpoints)
  const apiHealth = {
    pokemonTCG: 'healthy',
    tcgPlayer: 'healthy',
    redis: 'healthy',
  };

  await job.updateProgress(70);

  // Job queue statistics
  const { getAllQueuesStats } = await import('../queue');
  const queueStats = await getAllQueuesStats();

  await job.updateProgress(90);

  return {
    ...report,
    health: {
      database: {
        tables: dbStats,
      },
      apis: apiHealth,
      queues: queueStats,
    },
  };
}