import { prisma } from '@/lib/db/prisma';
import { priceCache, analysisCache } from '@/lib/api/cache';
import type {
  CollectionValue,
  ValueChange,
  ValueHistoryPoint,
  CollectionPerformance,
  PerformanceCard,
  MonthlyPerformance,
  TradeMatch,
  TradingPartner,
} from './types';

export class CollectionValueTracker {
  private readonly PRICE_CHANGE_THRESHOLD = 0.05; // 5% change threshold for alerts

  /**
   * Track collection value changes
   */
  async trackValueChanges(userId: string): Promise<{
    currentValue: CollectionValue;
    changes: ValueChange[];
    alerts: ValueChange[];
  }> {
    // Get current collection value
    const currentValue = await this.calculateCurrentValue(userId);

    // Get value changes
    const changes = await this.getRecentValueChanges(userId, 24); // 24 hour changes

    // Filter significant changes for alerts
    const alerts = changes.filter(change => 
      Math.abs(change.changePercentage) >= this.PRICE_CHANGE_THRESHOLD * 100
    );

    // Store snapshot for historical tracking
    await this.storeValueSnapshot(userId, currentValue.totalValue);

    return { currentValue, changes, alerts };
  }

  /**
   * Calculate current collection value
   */
  async calculateCurrentValue(userId: string): Promise<CollectionValue> {
    const cacheKey = `value:current:${userId}`;
    const cached = await priceCache.get<CollectionValue>(cacheKey);
    if (cached) return cached;

    const collection = await prisma.userCollection.findMany({
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

    let totalValue = 0;
    const valueByCondition: Record<string, number> = {};
    const valueBySetMap = new Map<string, number>();
    const topCards: { card: any; value: number; quantity: number }[] = [];

    collection.forEach(item => {
      const basePrice = item.card.prices[0]?.marketPrice || 0;
      const conditionMultiplier = this.getConditionMultiplier(item.condition);
      const cardValue = basePrice * conditionMultiplier;
      const totalCardValue = cardValue * item.quantity;

      totalValue += totalCardValue;

      // Track by condition
      valueByCondition[item.condition] = 
        (valueByCondition[item.condition] || 0) + totalCardValue;

      // Track by set
      const currentSetValue = valueBySetMap.get(item.card.setId) || 0;
      valueBySetMap.set(item.card.setId, currentSetValue + totalCardValue);

      // Track top value cards
      if (cardValue > 0) {
        topCards.push({
          card: item.card,
          value: cardValue,
          quantity: item.quantity,
        });
      }
    });

    // Convert maps to arrays
    const valueBySet = Array.from(valueBySetMap.entries())
      .map(([setId, value]) => ({ setId, value }))
      .sort((a, b) => b.value - a.value);

    // Get top 20 most valuable cards
    topCards.sort((a, b) => (b.value * b.quantity) - (a.value * a.quantity));
    const topValueCards = topCards.slice(0, 20);

    // Get historical data
    const valueHistory = await this.getValueHistory(userId, 90); // 90 days

    // Calculate insurance value (70% of market value)
    const insuranceValue = totalValue * 0.7;

    const result: CollectionValue = {
      totalValue,
      valueByCondition,
      valueBySet,
      valueHistory,
      topValueCards,
      insuranceValue,
    };

    await priceCache.set(cacheKey, result, 3600); // Cache for 1 hour
    return result;
  }

  /**
   * Get recent value changes
   */
  async getRecentValueChanges(
    userId: string,
    hours: number
  ): Promise<ValueChange[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    // Get collection with price history
    const collection = await prisma.userCollection.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            priceHistory: {
              where: {
                createdAt: { gte: since },
              },
              orderBy: { createdAt: 'asc' },
            },
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const changes: ValueChange[] = [];

    collection.forEach(item => {
      if (item.card.priceHistory.length > 0) {
        const oldPrice = item.card.priceHistory[0].marketPrice || 0;
        const currentPrice = item.card.prices[0]?.marketPrice || 0;
        const changeAmount = currentPrice - oldPrice;
        const changePercentage = oldPrice > 0 
          ? (changeAmount / oldPrice) * 100 
          : 0;

        if (Math.abs(changeAmount) > 0.01) {
          changes.push({
            cardId: item.card.id,
            cardName: item.card.name,
            previousValue: oldPrice,
            currentValue: currentPrice,
            changeAmount,
            changePercentage,
            timestamp: new Date(),
          });
        }
      }
    });

    return changes.sort((a, b) => 
      Math.abs(b.changePercentage) - Math.abs(a.changePercentage)
    );
  }

  /**
   * Analyze collection performance
   */
  async analyzePerformance(userId: string): Promise<CollectionPerformance> {
    const cacheKey = `performance:${userId}`;
    const cached = await analysisCache.get<CollectionPerformance>(cacheKey);
    if (cached) return cached;

    const collection = await prisma.userCollection.findMany({
      where: { 
        userId,
        purchasePrice: { gt: 0 }, // Only items with known purchase price
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
        const cardCurrent = item.card.prices[0]?.marketPrice || 0;
        const gain = (cardCurrent - item.purchasePrice) * item.quantity;
        const gainPercentage = (gain / invested) * 100;
        const holdingPeriod = Math.floor(
          (Date.now() - item.acquiredAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        performanceCards.push({
          card: item.card,
          purchasePrice: item.purchasePrice,
          currentValue: cardCurrent,
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

    // Sort by performance
    performanceCards.sort((a, b) => b.gainPercentage - a.gainPercentage);
    const bestPerformers = performanceCards.slice(0, 10);
    const worstPerformers = performanceCards.slice(-10).reverse();

    // Get monthly performance
    const monthlyPerformance = await this.calculateMonthlyPerformance(userId);

    const result: CollectionPerformance = {
      totalInvested,
      currentValue,
      unrealizedGain,
      unrealizedGainPercentage,
      bestPerformers,
      worstPerformers,
      monthlyPerformance,
    };

    await analysisCache.set(cacheKey, result, 3600);
    return result;
  }

  /**
   * Set price alerts for collection
   */
  async setPriceAlert(
    userId: string,
    cardId: string,
    threshold: number,
    type: 'increase' | 'decrease'
  ): Promise<void> {
    await prisma.priceAlert.create({
      data: {
        userId,
        cardId,
        threshold,
        type,
        enabled: true,
      },
    });
  }

  /**
   * Check all price alerts
   */
  async checkPriceAlerts(userId: string): Promise<{
    triggered: Array<{
      alert: any;
      card: any;
      currentPrice: number;
      previousPrice: number;
    }>;
  }> {
    const alerts = await prisma.priceAlert.findMany({
      where: {
        userId,
        enabled: true,
      },
      include: {
        card: {
          include: {
            prices: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
            priceHistory: {
              orderBy: { createdAt: 'desc' },
              take: 2,
            },
          },
        },
      },
    });

    const triggered = [];

    for (const alert of alerts) {
      const currentPrice = alert.card.prices[0]?.marketPrice || 0;
      const previousPrice = alert.card.priceHistory[1]?.marketPrice || currentPrice;

      const changePercentage = previousPrice > 0
        ? ((currentPrice - previousPrice) / previousPrice) * 100
        : 0;

      const shouldTrigger = alert.type === 'increase'
        ? changePercentage >= alert.threshold
        : changePercentage <= -alert.threshold;

      if (shouldTrigger) {
        triggered.push({
          alert,
          card: alert.card,
          currentPrice,
          previousPrice,
        });

        // Mark as triggered
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: { lastTriggered: new Date() },
        });
      }
    }

    return { triggered };
  }

  /**
   * Calculate ROI for specific cards
   */
  async calculateCardROI(
    userId: string,
    cardIds: string[]
  ): Promise<Map<string, {
    roi: number;
    annualizedReturn: number;
    holdingPeriod: number;
  }>> {
    const collection = await prisma.userCollection.findMany({
      where: {
        userId,
        cardId: { in: cardIds },
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

    const roiMap = new Map();

    collection.forEach(item => {
      const currentPrice = item.card.prices[0]?.marketPrice || 0;
      const roi = item.purchasePrice > 0
        ? ((currentPrice - item.purchasePrice) / item.purchasePrice) * 100
        : 0;

      const holdingDays = Math.floor(
        (Date.now() - item.acquiredAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      const annualizedReturn = holdingDays > 0
        ? (Math.pow(currentPrice / item.purchasePrice, 365 / holdingDays) - 1) * 100
        : 0;

      roiMap.set(item.cardId, {
        roi,
        annualizedReturn,
        holdingPeriod: holdingDays,
      });
    });

    return roiMap;
  }

  /**
   * Get value predictions based on historical trends
   */
  async predictFutureValue(
    userId: string,
    days: number
  ): Promise<{
    predictedValue: number;
    confidence: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  }> {
    const history = await this.getValueHistory(userId, 180); // 6 months

    if (history.length < 30) {
      return {
        predictedValue: 0,
        confidence: 0,
        trend: 'neutral',
      };
    }

    // Simple linear regression for prediction
    const n = history.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    history.forEach((point, index) => {
      sumX += index;
      sumY += point.totalValue;
      sumXY += index * point.totalValue;
      sumX2 += index * index;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict future value
    const futureIndex = n + days;
    const predictedValue = slope * futureIndex + intercept;

    // Calculate confidence based on R-squared
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;

    history.forEach((point, index) => {
      const predicted = slope * index + intercept;
      ssTotal += Math.pow(point.totalValue - yMean, 2);
      ssResidual += Math.pow(point.totalValue - predicted, 2);
    });

    const rSquared = 1 - (ssResidual / ssTotal);
    const confidence = Math.max(0, Math.min(100, rSquared * 100));

    // Determine trend
    const trend = slope > history[0].totalValue * 0.001 ? 'bullish' :
                  slope < -history[0].totalValue * 0.001 ? 'bearish' : 'neutral';

    return { predictedValue, confidence, trend };
  }

  /**
   * Find trading opportunities
   */
  async findTradingOpportunities(userId: string): Promise<TradeMatch[]> {
    // Get user's tradable cards
    const tradableCards = await prisma.userCollection.findMany({
      where: {
        userId,
        forTrade: true,
      },
      include: {
        card: true,
      },
    });

    // Get user's want list
    const wantList = await prisma.wantList.findMany({
      where: { userId },
      include: { card: true },
    });

    // Get trading partners
    const partners = await prisma.tradingPartner.findMany({
      where: { userId },
      include: {
        partner: true,
      },
    });

    const matches: TradeMatch[] = [];

    for (const partner of partners) {
      // Get partner's tradable cards that match our want list
      const partnerHas = await prisma.userCollection.findMany({
        where: {
          userId: partner.partnerId,
          forTrade: true,
          cardId: { in: wantList.map(w => w.cardId) },
        },
        include: { card: true },
      });

      // Get partner's want list that matches our tradable cards
      const partnerWants = await prisma.wantList.findMany({
        where: {
          userId: partner.partnerId,
          cardId: { in: tradableCards.map(t => t.cardId) },
        },
        include: { card: true },
      });

      if (partnerHas.length > 0 && partnerWants.length > 0) {
        // Calculate trade score and value balance
        const ourValue = await this.calculateCardsValue(
          partnerWants.map(w => w.cardId)
        );
        const theirValue = await this.calculateCardsValue(
          partnerHas.map(h => h.cardId)
        );

        const tradeScore = Math.min(
          100,
          (partnerHas.length + partnerWants.length) * 10
        );

        matches.push({
          partner: partner as TradingPartner,
          theyWant: tradableCards.filter(t => 
            partnerWants.some(w => w.cardId === t.cardId)
          ),
          youWant: wantList.filter(w => 
            partnerHas.some(h => h.cardId === w.cardId)
          ),
          tradeScore,
          valueBalance: ourValue - theirValue,
        });
      }
    }

    return matches.sort((a, b) => b.tradeScore - a.tradeScore);
  }

  /**
   * Generate insurance documentation
   */
  async generateInsuranceReport(userId: string): Promise<{
    report: string;
    totalValue: number;
    itemCount: number;
    highValueItems: any[];
  }> {
    const value = await this.calculateCurrentValue(userId);
    const collection = await prisma.userCollection.findMany({
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

    // Filter high-value items (over $50)
    const highValueItems = collection
      .map(item => ({
        card: item.card,
        quantity: item.quantity,
        condition: item.condition,
        value: (item.card.prices[0]?.marketPrice || 0) * 
          this.getConditionMultiplier(item.condition),
      }))
      .filter(item => item.value >= 50)
      .sort((a, b) => b.value - a.value);

    const report = this.generateInsuranceDocument({
      userId,
      date: new Date(),
      totalValue: value.insuranceValue,
      marketValue: value.totalValue,
      itemCount: collection.length,
      highValueItems,
      valueByCondition: value.valueByCondition,
    });

    return {
      report,
      totalValue: value.insuranceValue,
      itemCount: collection.length,
      highValueItems,
    };
  }

  // Private helper methods

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

  private async storeValueSnapshot(
    userId: string,
    totalValue: number
  ): Promise<void> {
    await prisma.collectionSnapshot.create({
      data: {
        userId,
        totalValue,
        cardCount: await prisma.userCollection.count({ where: { userId } }),
      },
    });
  }

  private async getValueHistory(
    userId: string,
    days: number
  ): Promise<ValueHistoryPoint[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await prisma.collectionSnapshot.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    });

    return snapshots.map(snapshot => ({
      date: snapshot.createdAt,
      totalValue: snapshot.totalValue,
      cardCount: snapshot.cardCount,
      averageCardValue: snapshot.cardCount > 0 
        ? snapshot.totalValue / snapshot.cardCount 
        : 0,
    }));
  }

  private async calculateMonthlyPerformance(
    userId: string
  ): Promise<MonthlyPerformance[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const acquisitions = await prisma.userCollection.findMany({
      where: {
        userId,
        acquiredAt: { gte: sixMonthsAgo },
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

    const monthlyData = new Map<string, MonthlyPerformance>();

    acquisitions.forEach(item => {
      const monthKey = item.acquiredAt.toISOString().slice(0, 7);
      const existing = monthlyData.get(monthKey) || {
        month: monthKey,
        cardsAdded: 0,
        spent: 0,
        valueChange: 0,
        endingValue: 0,
      };

      existing.cardsAdded += item.quantity;
      existing.spent += (item.purchasePrice || 0) * item.quantity;

      const currentValue = (item.card.prices[0]?.marketPrice || 0) * 
        this.getConditionMultiplier(item.condition) * item.quantity;
      const purchaseValue = (item.purchasePrice || 0) * item.quantity;

      existing.valueChange += currentValue - purchaseValue;
      existing.endingValue += currentValue;

      monthlyData.set(monthKey, existing);
    });

    return Array.from(monthlyData.values())
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private async calculateCardsValue(cardIds: string[]): Promise<number> {
    const prices = await prisma.cardPrice.findMany({
      where: {
        cardId: { in: cardIds },
      },
      orderBy: { updatedAt: 'desc' },
      distinct: ['cardId'],
    });

    return prices.reduce((sum, price) => sum + (price.marketPrice || 0), 0);
  }

  private generateInsuranceDocument(data: any): string {
    return `
POKEMON TRADING CARD COLLECTION INSURANCE DOCUMENTATION
=======================================================

Date: ${data.date.toLocaleDateString()}
Owner ID: ${data.userId}

COLLECTION SUMMARY
-----------------
Total Items: ${data.itemCount}
Market Value: $${data.marketValue.toFixed(2)}
Insurance Value (70%): $${data.totalValue.toFixed(2)}

VALUE BY CONDITION
------------------
${Object.entries(data.valueByCondition)
  .map(([condition, value]) => `${condition}: $${(value as number).toFixed(2)}`)
  .join('\n')}

HIGH VALUE ITEMS (Over $50)
---------------------------
${data.highValueItems.map((item: any) => 
  `- ${item.card.name} (${item.card.set.name})
  Quantity: ${item.quantity}
  Condition: ${item.condition}
  Value per card: $${item.value.toFixed(2)}
  Total value: $${(item.value * item.quantity).toFixed(2)}`
).join('\n\n')}

NOTES
-----
1. Values based on current market prices from TCGPlayer
2. Insurance value calculated at 70% of market value
3. Condition affects value according to standard grading scales
4. This document should be updated quarterly or after significant changes

Generated by Pokemon TCG Deck Builder
    `.trim();
  }
}