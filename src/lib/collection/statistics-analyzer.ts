import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import { analysisCache } from '@/lib/api/cache';
import type {
  CollectionStats,
  CollectionValue,
  CollectionPerformance,
  SetCompletion,
  ValueChange,
  CollectionInsights,
  DuplicateRecommendation,
  PerformanceCard,
  MonthlyPerformance,
  AcquisitionData,
  CardCondition,
} from './types';

export class CollectionStatisticsAnalyzer {
  private readonly CACHE_TTL = 3600; // 1 hour

  /**
   * Get comprehensive collection statistics
   */
  async getCollectionStats(userId: string): Promise<CollectionStats> {
    const cacheKey = `collection:stats:${userId}`;
    const cached = await analysisCache.get<CollectionStats>(cacheKey);
    if (cached) return cached;

    const [
      byRarity,
      byType,
      bySet,
      byCondition,
      byFormat,
      valueDistribution,
      duplicateCount,
      tradableCount,
      acquisitionTimeline,
    ] = await Promise.all([
      this.getStatsByRarity(userId),
      this.getStatsByType(userId),
      this.getStatsBySet(userId),
      this.getStatsByCondition(userId),
      this.getStatsByFormat(userId),
      this.getValueDistribution(userId),
      this.getDuplicateCount(userId),
      this.getTradableCount(userId),
      this.getAcquisitionTimeline(userId),
    ]);

    const stats: CollectionStats = {
      byRarity,
      byType,
      bySet,
      byCondition,
      byFormat,
      valueDistribution,
      duplicateCount,
      tradableCount,
      acquisitionTimeline,
    };

    await analysisCache.set(cacheKey, stats, this.CACHE_TTL);
    return stats;
  }

  /**
   * Calculate total collection value with breakdowns
   */
  async calculateCollectionValue(userId: string): Promise<CollectionValue> {
    const cacheKey = `collection:value:${userId}`;
    const cached = await analysisCache.get<CollectionValue>(cacheKey);
    if (cached) return cached;

    // Get all collection items with current prices
    const collection = await prisma.userCollection.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    let totalValue = 0;
    const valueByCondition: Record<string, number> = {};
    const valueBySetMap = new Map<string, number>();
    const topCards: { card: any; value: number; quantity: number }[] = [];

    // Calculate values
    collection.forEach(item => {
      const price = item.card.prices[0]?.marketPrice || 0;
      const conditionMultiplier = this.getConditionMultiplier(item.condition);
      const itemValue = price * conditionMultiplier * item.quantity;

      totalValue += itemValue;

      // By condition
      valueByCondition[item.condition] = 
        (valueByCondition[item.condition] || 0) + itemValue;

      // By set
      const currentSetValue = valueBySetMap.get(item.card.setId) || 0;
      valueBySetMap.set(item.card.setId, currentSetValue + itemValue);

      // Track top value cards
      if (itemValue > 0) {
        topCards.push({
          card: item.card,
          value: price * conditionMultiplier,
          quantity: item.quantity,
        });
      }
    });

    // Convert set map to array
    const valueBySet = Array.from(valueBySetMap.entries()).map(([setId, value]) => ({
      setId,
      value,
    }));

    // Sort and limit top cards
    topCards.sort((a, b) => b.value - a.value);
    const topValueCards = topCards.slice(0, 20);

    // Get value history
    const valueHistory = await this.getValueHistory(userId);

    // Calculate insurance value (conservative estimate)
    const insuranceValue = totalValue * 0.7; // 70% of market value

    const value: CollectionValue = {
      totalValue,
      valueByCondition,
      valueBySet,
      valueHistory,
      topValueCards,
      insuranceValue,
    };

    await analysisCache.set(cacheKey, value, this.CACHE_TTL);
    return value;
  }

  /**
   * Analyze collection performance
   */
  async analyzePerformance(userId: string): Promise<CollectionPerformance> {
    const cacheKey = `collection:performance:${userId}`;
    const cached = await analysisCache.get<CollectionPerformance>(cacheKey);
    if (cached) return cached;

    // Get collection with purchase prices
    const collection = await prisma.userCollection.findMany({
      where: { 
        userId,
        purchasePrice: { gt: 0 },
      },
      include: {
        card: {
          include: {
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    let totalInvested = 0;
    let currentValue = 0;
    const performanceCards: PerformanceCard[] = [];

    collection.forEach(item => {
      const invested = item.purchasePrice * item.quantity;
      const current = (item.card.prices[0]?.marketPrice || 0) * 
        this.getConditionMultiplier(item.condition) * item.quantity;
      
      totalInvested += invested;
      currentValue += current;

      if (item.purchasePrice > 0) {
        const gain = current - invested;
        const gainPercentage = (gain / invested) * 100;
        const holdingPeriod = Math.floor(
          (Date.now() - item.acquiredAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        performanceCards.push({
          card: item.card,
          purchasePrice: item.purchasePrice,
          currentValue: item.card.prices[0]?.marketPrice || 0,
          gain,
          gainPercentage,
          holdingPeriod,
        });
      }
    });

    const unrealizedGain = currentValue - totalInvested;
    const unrealizedGainPercentage = totalInvested > 0 
      ? (unrealizedGain / totalInvested) * 100 
      : 0;

    // Sort performance cards
    performanceCards.sort((a, b) => b.gainPercentage - a.gainPercentage);
    const bestPerformers = performanceCards.slice(0, 10);
    const worstPerformers = performanceCards.slice(-10).reverse();

    // Get monthly performance
    const monthlyPerformance = await this.getMonthlyPerformance(userId);

    const performance: CollectionPerformance = {
      totalInvested,
      currentValue,
      unrealizedGain,
      unrealizedGainPercentage,
      bestPerformers,
      worstPerformers,
      monthlyPerformance,
    };

    await analysisCache.set(cacheKey, performance, this.CACHE_TTL);
    return performance;
  }

  /**
   * Get collection insights and recommendations
   */
  async getCollectionInsights(userId: string): Promise<CollectionInsights> {
    const [
      spendingData,
      valueData,
      collection,
      performance,
    ] = await Promise.all([
      this.getSpendingTrend(userId),
      this.calculateCollectionValue(userId),
      this.getFullCollection(userId),
      this.analyzePerformance(userId),
    ]);

    // Analyze spending trend
    const spendingTrend = this.analyzeSpendingTrend(spendingData);

    // Find top growth cards
    const topGrowthCards = performance.bestPerformers
      .slice(0, 5)
      .map(p => p.card);

    // Find undervalued cards (cards with low prices compared to similar cards)
    const undervaluedCards = await this.findUndervaluedCards(userId);

    // Get duplicate optimization recommendations
    const duplicateOptimization = await this.getDuplicateRecommendations(userId);

    // Calculate collection health score (0-100)
    const collectionHealth = this.calculateCollectionHealth({
      diversification: collection.length,
      avgCardValue: valueData.totalValue / Math.max(collection.length, 1),
      duplicateRatio: duplicateOptimization.length / Math.max(collection.length, 1),
      tradableRatio: collection.filter(c => c.forTrade).length / Math.max(collection.length, 1),
    });

    // Calculate diversification score
    const diversificationScore = await this.calculateDiversificationScore(userId);

    // Calculate investment ROI
    const investmentROI = performance.unrealizedGainPercentage;

    return {
      spendingTrend,
      topGrowthCards,
      undervaluedCards,
      duplicateOptimization,
      collectionHealth,
      diversificationScore,
      investmentROI,
    };
  }

  /**
   * Get set completion statistics
   */
  async getSetCompletion(userId: string): Promise<SetCompletion[]> {
    const sets = await prisma.set.findMany({
      include: {
        cards: {
          include: {
            userCollections: {
              where: { userId },
            },
          },
        },
      },
    });

    const completions: SetCompletion[] = [];

    for (const set of sets) {
      const totalCards = set.totalCards;
      const ownedCards = new Set(
        set.cards
          .filter(card => card.userCollections.length > 0)
          .map(card => card.id)
      ).size;

      const missingCards = set.cards
        .filter(card => card.userCollections.length === 0)
        .map(card => card.id);

      // Estimate completion cost
      const missingCardPrices = await prisma.cardPrice.findMany({
        where: {
          cardId: { in: missingCards },
        },
        orderBy: { updatedAt: 'desc' },
        distinct: ['cardId'],
      });

      const estimatedCompletionCost = missingCardPrices.reduce(
        (sum, price) => sum + (price.marketPrice || 0),
        0
      );

      completions.push({
        setId: set.id,
        setName: set.name,
        totalCards,
        ownedCards,
        completionPercentage: (ownedCards / totalCards) * 100,
        missingCards,
        estimatedCompletionCost,
      });
    }

    return completions.sort((a, b) => b.completionPercentage - a.completionPercentage);
  }

  /**
   * Track value changes over time
   */
  async getValueChanges(userId: string, days = 7): Promise<ValueChange[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get collection with price history
    const collection = await prisma.userCollection.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            prices: {
              where: {
                updatedAt: { gte: startDate },
              },
              orderBy: { updatedAt: 'asc' },
            },
          },
        },
      },
    });

    const changes: ValueChange[] = [];

    collection.forEach(item => {
      if (item.card.prices.length >= 2) {
        const oldPrice = item.card.prices[0].marketPrice || 0;
        const currentPrice = item.card.prices[item.card.prices.length - 1].marketPrice || 0;
        const changeAmount = currentPrice - oldPrice;
        const changePercentage = oldPrice > 0 ? (changeAmount / oldPrice) * 100 : 0;

        if (Math.abs(changeAmount) > 0.01) {
          changes.push({
            cardId: item.card.id,
            cardName: item.card.name,
            previousValue: oldPrice,
            currentValue: currentPrice,
            changeAmount,
            changePercentage,
            timestamp: item.card.prices[item.card.prices.length - 1].updatedAt,
          });
        }
      }
    });

    return changes.sort((a, b) => Math.abs(b.changePercentage) - Math.abs(a.changePercentage));
  }

  // Private helper methods

  private async getStatsByRarity(userId: string): Promise<Record<string, number>> {
    const results = await prisma.userCollection.groupBy({
      by: ['cardId'],
      where: { userId },
      _sum: { quantity: true },
    });

    const cardRarities = await prisma.card.findMany({
      where: {
        id: { in: results.map(r => r.cardId) },
      },
      select: { id: true, rarity: true },
    });

    const rarityMap = new Map(cardRarities.map(c => [c.id, c.rarity]));
    const stats: Record<string, number> = {};

    results.forEach(result => {
      const rarity = rarityMap.get(result.cardId);
      if (rarity) {
        stats[rarity] = (stats[rarity] || 0) + (result._sum.quantity || 0);
      }
    });

    return stats;
  }

  private async getStatsByType(userId: string): Promise<Record<string, number>> {
    const results = await prisma.userCollection.groupBy({
      by: ['cardId'],
      where: { userId },
      _sum: { quantity: true },
    });

    const cardTypes = await prisma.card.findMany({
      where: {
        id: { in: results.map(r => r.cardId) },
      },
      select: { id: true, supertype: true },
    });

    const typeMap = new Map(cardTypes.map(c => [c.id, c.supertype]));
    const stats: Record<string, number> = {};

    results.forEach(result => {
      const type = typeMap.get(result.cardId);
      if (type) {
        stats[type] = (stats[type] || 0) + (result._sum.quantity || 0);
      }
    });

    return stats;
  }

  private async getStatsBySet(userId: string): Promise<any[]> {
    const results = await prisma.userCollection.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            set: true,
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const setMap = new Map<string, { count: number; value: number; name: string }>();

    results.forEach(item => {
      const setId = item.card.setId;
      const current = setMap.get(setId) || { count: 0, value: 0, name: item.card.set.name };
      const price = item.card.prices[0]?.marketPrice || 0;
      const itemValue = price * this.getConditionMultiplier(item.condition) * item.quantity;

      current.count += item.quantity;
      current.value += itemValue;
      setMap.set(setId, current);
    });

    return Array.from(setMap.entries()).map(([setId, data]) => ({
      setId,
      setName: data.name,
      count: data.count,
      value: data.value,
    }));
  }

  private async getStatsByCondition(userId: string): Promise<Record<CardCondition, number>> {
    const results = await prisma.userCollection.groupBy({
      by: ['condition'],
      where: { userId },
      _sum: { quantity: true },
    });

    const stats: Record<string, number> = {};
    results.forEach(result => {
      stats[result.condition] = result._sum.quantity || 0;
    });

    return stats as Record<CardCondition, number>;
  }

  private async getStatsByFormat(userId: string): Promise<Record<string, number>> {
    // This would require joining with format data
    // Simplified version for now
    return {
      Standard: 0,
      Expanded: 0,
      Unlimited: 0,
    };
  }

  private async getValueDistribution(userId: string): Promise<any[]> {
    const ranges = [
      { label: '$0-$1', min: 0, max: 1 },
      { label: '$1-$5', min: 1, max: 5 },
      { label: '$5-$20', min: 5, max: 20 },
      { label: '$20-$50', min: 20, max: 50 },
      { label: '$50-$100', min: 50, max: 100 },
      { label: '$100-$500', min: 100, max: 500 },
      { label: '$500+', min: 500, max: 999999 },
    ];

    const collection = await prisma.userCollection.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const distribution = ranges.map(range => ({
      ...range,
      count: 0,
      totalValue: 0,
    }));

    collection.forEach(item => {
      const price = item.card.prices[0]?.marketPrice || 0;
      const value = price * this.getConditionMultiplier(item.condition);

      const rangeIndex = distribution.findIndex(
        r => value >= r.min && value < r.max
      );

      if (rangeIndex !== -1) {
        distribution[rangeIndex].count += item.quantity;
        distribution[rangeIndex].totalValue += value * item.quantity;
      }
    });

    return distribution;
  }

  private async getDuplicateCount(userId: string): Promise<number> {
    const duplicates = await prisma.userCollection.findMany({
      where: {
        userId,
        quantity: { gt: 1 },
      },
    });

    return duplicates.reduce((sum, item) => sum + (item.quantity - 1), 0);
  }

  private async getTradableCount(userId: string): Promise<number> {
    const result = await prisma.userCollection.aggregate({
      where: {
        userId,
        forTrade: true,
      },
      _sum: { quantity: true },
    });

    return result._sum.quantity || 0;
  }

  private async getAcquisitionTimeline(userId: string): Promise<AcquisitionData[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const acquisitions = await prisma.userCollection.findMany({
      where: {
        userId,
        acquiredAt: { gte: thirtyDaysAgo },
      },
      select: {
        acquiredAt: true,
        quantity: true,
        purchasePrice: true,
        source: true,
      },
    });

    // Group by date
    const timeline = new Map<string, AcquisitionData>();

    acquisitions.forEach(item => {
      const dateKey = item.acquiredAt.toISOString().split('T')[0];
      const existing = timeline.get(dateKey) || {
        date: new Date(dateKey),
        cardsAdded: 0,
        totalSpent: 0,
        source: item.source,
      };

      existing.cardsAdded += item.quantity;
      existing.totalSpent += (item.purchasePrice || 0) * item.quantity;

      timeline.set(dateKey, existing);
    });

    return Array.from(timeline.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private getConditionMultiplier(condition: string): number {
    const multipliers: Record<string, number> = {
      MINT: 1.0,
      NEAR_MINT: 0.95,
      LIGHTLY_PLAYED: 0.85,
      MODERATELY_PLAYED: 0.70,
      HEAVILY_PLAYED: 0.50,
      DAMAGED: 0.30,
    };

    return multipliers[condition] || 0.5;
  }

  private async getValueHistory(userId: string): Promise<any[]> {
    // This would ideally track historical values
    // For now, returning empty array
    return [];
  }

  private async getSpendingTrend(userId: string): Promise<any[]> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const spending = await prisma.userCollection.findMany({
      where: {
        userId,
        acquiredAt: { gte: ninetyDaysAgo },
        purchasePrice: { gt: 0 },
      },
      select: {
        acquiredAt: true,
        purchasePrice: true,
        quantity: true,
      },
    });

    return spending;
  }

  private analyzeSpendingTrend(spendingData: any[]): 'increasing' | 'stable' | 'decreasing' {
    if (spendingData.length < 10) return 'stable';

    // Simple trend analysis
    const firstHalf = spendingData.slice(0, Math.floor(spendingData.length / 2));
    const secondHalf = spendingData.slice(Math.floor(spendingData.length / 2));

    const firstHalfTotal = firstHalf.reduce((sum, item) => 
      sum + (item.purchasePrice * item.quantity), 0
    );
    const secondHalfTotal = secondHalf.reduce((sum, item) => 
      sum + (item.purchasePrice * item.quantity), 0
    );

    const change = (secondHalfTotal - firstHalfTotal) / Math.max(firstHalfTotal, 1);

    if (change > 0.2) return 'increasing';
    if (change < -0.2) return 'decreasing';
    return 'stable';
  }

  private async findUndervaluedCards(userId: string): Promise<any[]> {
    // This would use market analysis to find undervalued cards
    // Simplified version for now
    return [];
  }

  private async getDuplicateRecommendations(userId: string): Promise<DuplicateRecommendation[]> {
    const duplicates = await prisma.userCollection.findMany({
      where: {
        userId,
        quantity: { gt: 4 }, // More than 4 is likely excessive
      },
      include: {
        card: {
          include: {
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return duplicates.map(item => ({
      card: item.card,
      ownedQuantity: item.quantity,
      recommendedQuantity: 4, // Keep playset
      potentialValue: (item.quantity - 4) * (item.card.prices[0]?.marketPrice || 0),
      reason: 'Keeping more than a playset (4) is usually unnecessary unless for trading',
    }));
  }

  private calculateCollectionHealth(metrics: {
    diversification: number;
    avgCardValue: number;
    duplicateRatio: number;
    tradableRatio: number;
  }): number {
    let score = 50; // Base score

    // Diversification bonus (up to +20)
    if (metrics.diversification > 100) score += 10;
    if (metrics.diversification > 500) score += 10;

    // Value distribution bonus (up to +15)
    if (metrics.avgCardValue > 5 && metrics.avgCardValue < 50) score += 15;
    else if (metrics.avgCardValue >= 50) score += 10;

    // Duplicate management bonus (up to +10)
    if (metrics.duplicateRatio < 0.2) score += 10;
    else if (metrics.duplicateRatio < 0.3) score += 5;

    // Trading activity bonus (up to +5)
    if (metrics.tradableRatio > 0.1) score += 5;

    return Math.min(100, score);
  }

  private async calculateDiversificationScore(userId: string): Promise<number> {
    const stats = await this.getCollectionStats(userId);
    
    let score = 50; // Base score

    // Set diversity
    const setCount = stats.bySet.length;
    if (setCount > 10) score += 15;
    else if (setCount > 5) score += 10;

    // Type diversity
    const typeCount = Object.keys(stats.byType).length;
    if (typeCount >= 3) score += 15;

    // Rarity diversity
    const rarityCount = Object.keys(stats.byRarity).length;
    if (rarityCount >= 5) score += 10;

    // Value distribution diversity
    const activeRanges = stats.valueDistribution.filter(r => r.count > 0).length;
    if (activeRanges >= 4) score += 10;

    return Math.min(100, score);
  }

  private async getFullCollection(userId: string): Promise<any[]> {
    return await prisma.userCollection.findMany({
      where: { userId },
      include: { card: true },
    });
  }

  private async getMonthlyPerformance(userId: string): Promise<MonthlyPerformance[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const acquisitions = await prisma.userCollection.findMany({
      where: {
        userId,
        acquiredAt: { gte: sixMonthsAgo },
      },
      select: {
        acquiredAt: true,
        quantity: true,
        purchasePrice: true,
        card: {
          include: {
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    // Group by month
    const monthlyData = new Map<string, MonthlyPerformance>();

    acquisitions.forEach(item => {
      const month = item.acquiredAt.toISOString().slice(0, 7); // YYYY-MM
      const existing = monthlyData.get(month) || {
        month,
        cardsAdded: 0,
        spent: 0,
        valueChange: 0,
        endingValue: 0,
      };

      existing.cardsAdded += item.quantity;
      existing.spent += (item.purchasePrice || 0) * item.quantity;
      
      const currentValue = (item.card.prices[0]?.marketPrice || 0) * item.quantity;
      const purchaseValue = (item.purchasePrice || 0) * item.quantity;
      existing.valueChange += currentValue - purchaseValue;
      existing.endingValue += currentValue;

      monthlyData.set(month, existing);
    });

    return Array.from(monthlyData.values()).sort((a, b) => a.month.localeCompare(b.month));
  }
}