import { prisma } from '@/server/db/prisma';
import { CollectionSearchEngine } from './search-engine';
import { CollectionStatisticsAnalyzer } from './statistics-analyzer';
import { QuickAddManager } from './quick-add-manager';
import { CollectionOrganizationManager } from './organization-manager';
import { WantListManager } from './want-list-manager';
import { CollectionValueTracker } from './value-tracker';
import { ImportExportManager } from './import-export-manager';
import { analysisCache, searchCache, recommendationCache } from '@/lib/api/cache';
import type {
  CollectionDashboard,
  CollectionSearchFilters,
  CollectionSearchResult,
  QuickAddItem,
  BulkAddResult,
  WantListItem,
  CollectionImportData,
  ImportResult,
  CollectionSharingConfig,
  SharedCollectionView,
} from './types';

export class CollectionManager {
  private searchEngine: CollectionSearchEngine;
  private statsAnalyzer: CollectionStatisticsAnalyzer;
  private quickAddManager: QuickAddManager;
  private organizationManager: CollectionOrganizationManager;
  private wantListManager: WantListManager;
  private valueTracker: CollectionValueTracker;
  private importExportManager: ImportExportManager;

  constructor() {
    this.searchEngine = new CollectionSearchEngine();
    this.statsAnalyzer = new CollectionStatisticsAnalyzer();
    this.quickAddManager = new QuickAddManager();
    this.organizationManager = new CollectionOrganizationManager();
    this.wantListManager = new WantListManager();
    this.valueTracker = new CollectionValueTracker();
    this.importExportManager = new ImportExportManager();
  }

  /**
   * Get comprehensive collection dashboard
   */
  async getCollectionDashboard(userId: string): Promise<CollectionDashboard> {
    const cacheKey = `dashboard:${userId}`;
    const cached = await analysisCache.get<CollectionDashboard>(cacheKey);
    if (cached) return cached;

    // Fetch all dashboard data in parallel
    const [
      stats,
      value,
      recentAdditions,
      valueChanges,
      setCompletion,
      insights,
      upcomingReleases,
    ] = await Promise.all([
      this.statsAnalyzer.getCollectionStats(userId),
      this.valueTracker.calculateCurrentValue(userId),
      this.getRecentAdditions(userId, 10),
      this.valueTracker.getRecentValueChanges(userId, 24),
      this.statsAnalyzer.getSetCompletion(userId),
      this.statsAnalyzer.getCollectionInsights(userId),
      this.getUpcomingReleases(),
    ]);

    // Get top cards by value
    const topCardsByValue = value.topValueCards.slice(0, 10);

    // Calculate unique cards count
    const uniqueCards = await prisma.userCollection.count({
      where: { userId },
      distinct: ['cardId'],
    });

    // Calculate 24h value change
    const yesterday = await this.getHistoricalValue(userId, 1);
    const valueChange24h = value.totalValue - yesterday;
    const valueChangePercentage = yesterday > 0 
      ? (valueChange24h / yesterday) * 100 
      : 0;

    const dashboard: CollectionDashboard = {
      totalCards: await prisma.userCollection.aggregate({
        where: { userId },
        _sum: { quantity: true },
      }).then(r => r._sum.quantity || 0),
      uniqueCards,
      totalValue: value.totalValue,
      valueChange24h,
      valueChangePercentage,
      recentAdditions,
      valueChanges: valueChanges.slice(0, 10),
      setCompletion: setCompletion.slice(0, 10),
      topCardsByValue,
      collectionStats: stats,
      upcomingReleases,
      insightsSummary: insights,
    };

    await analysisCache.set(cacheKey, dashboard, 300); // Cache for 5 minutes
    return dashboard;
  }

  /**
   * Search collection with advanced filters
   */
  async searchCollection(
    userId: string,
    filters: CollectionSearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<CollectionSearchResult> {
    return await this.searchEngine.search(userId, filters, page, pageSize);
  }

  /**
   * Quick add cards to collection
   */
  async quickAddCards(
    userId: string,
    items: QuickAddItem[]
  ): Promise<BulkAddResult> {
    const result = await this.quickAddManager.bulkAddCards(userId, items);

    // Invalidate relevant caches
    await this.invalidateUserCaches(userId);

    return result;
  }

  /**
   * Manage want list
   */
  async getWantList(
    userId: string,
    filters?: any
  ): Promise<WantListItem[]> {
    return await this.wantListManager.getWantList(userId, filters);
  }

  async addToWantList(
    userId: string,
    cardId: string,
    data: any
  ): Promise<WantListItem> {
    const result = await this.wantListManager.addToWantList(userId, {
      cardId,
      ...data,
    });

    await this.invalidateUserCaches(userId);
    return result;
  }

  /**
   * Import collection data
   */
  async importCollection(
    userId: string,
    data: CollectionImportData
  ): Promise<ImportResult> {
    const result = await this.importExportManager.importCollection(userId, data);

    if (result.imported > 0 || result.updated > 0) {
      await this.invalidateUserCaches(userId);
    }

    return result;
  }

  /**
   * Export collection data
   */
  async exportCollection(
    userId: string,
    format: 'csv' | 'json' | 'pdf',
    options?: any
  ): Promise<{ content: string; filename: string }> {
    return await this.importExportManager.exportCollection(userId, format, options);
  }

  /**
   * Share collection
   */
  async shareCollection(
    userId: string,
    config: CollectionSharingConfig
  ): Promise<SharedCollectionView> {
    const shareId = this.generateShareId();
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/collection/shared/${shareId}`;
    const qrCode = await this.generateQRCode(shareUrl);

    const shared = await prisma.sharedCollection.create({
      data: {
        id: shareId,
        userId,
        config: config as any,
        shareUrl,
        qrCode,
        views: 0,
        expiresAt: config.expiresAt,
      },
    });

    return {
      id: shared.id,
      userId: shared.userId,
      config: shared.config as CollectionSharingConfig,
      shareUrl: shared.shareUrl,
      qrCode: shared.qrCode,
      views: shared.views,
      createdAt: shared.createdAt,
    };
  }

  /**
   * Get shared collection
   */
  async getSharedCollection(
    shareId: string
  ): Promise<{ collection: any; config: CollectionSharingConfig }> {
    const shared = await prisma.sharedCollection.findUnique({
      where: { id: shareId },
    });

    if (!shared) {
      throw new Error('Shared collection not found');
    }

    if (shared.expiresAt && shared.expiresAt < new Date()) {
      throw new Error('Shared collection has expired');
    }

    // Increment view count
    await prisma.sharedCollection.update({
      where: { id: shareId },
      data: { views: { increment: 1 } },
    });

    const config = shared.config as CollectionSharingConfig;

    // Get collection based on config
    const collection = await prisma.userCollection.findMany({
      where: { userId: shared.userId },
      include: {
        card: {
          include: {
            set: true,
            ...(config.showValues ? {
              prices: {
                orderBy: { updatedAt: 'desc' },
                take: 1,
              },
            } : {}),
          },
        },
      },
    });

    // Filter based on config
    const filteredCollection = collection.map(item => ({
      card: item.card,
      quantity: config.showQuantities ? item.quantity : undefined,
      condition: config.showConditions ? item.condition : undefined,
      notes: config.showNotes ? item.notes : undefined,
      tags: item.tags,
    }));

    return { collection: filteredCollection, config };
  }

  /**
   * Organization shortcuts
   */
  async applyTags(userId: string, collectionIds: string[], tags: string[]): Promise<number> {
    return await this.organizationManager.applyTags(userId, collectionIds, tags);
  }

  async createFolder(userId: string, data: any): Promise<any> {
    return await this.organizationManager.createFolder(userId, data);
  }

  async toggleFavorite(userId: string, collectionIds: string[]): Promise<number> {
    return await this.organizationManager.toggleFavorite(userId, collectionIds);
  }

  /**
   * Value tracking shortcuts
   */
  async trackValueChanges(userId: string): Promise<any> {
    return await this.valueTracker.trackValueChanges(userId);
  }

  async analyzePerformance(userId: string): Promise<any> {
    return await this.valueTracker.analyzePerformance(userId);
  }

  async generateInsuranceReport(userId: string): Promise<any> {
    return await this.valueTracker.generateInsuranceReport(userId);
  }

  /**
   * Mobile-specific methods
   */
  async getMobileOptimizedCollection(
    userId: string,
    page = 1,
    pageSize = 50
  ): Promise<{
    cards: any[];
    hasMore: boolean;
    totalCount: number;
  }> {
    const skip = (page - 1) * pageSize;

    const [cards, totalCount] = await Promise.all([
      prisma.userCollection.findMany({
        where: { userId },
        include: {
          card: {
            select: {
              id: true,
              name: true,
              imageUrlSmall: true,
              rarity: true,
              set: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        skip,
        take: pageSize,
        orderBy: { acquiredAt: 'desc' },
      }),
      prisma.userCollection.count({ where: { userId } }),
    ]);

    return {
      cards,
      hasMore: skip + pageSize < totalCount,
      totalCount,
    };
  }

  /**
   * Offline sync support
   */
  async getCollectionSyncData(
    userId: string,
    lastSyncDate?: Date
  ): Promise<{
    added: any[];
    updated: any[];
    deleted: string[];
    syncToken: string;
  }> {
    const where: any = { userId };
    if (lastSyncDate) {
      where.updatedAt = { gte: lastSyncDate };
    }

    const collection = await prisma.userCollection.findMany({
      where,
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

    // Generate sync token
    const syncToken = new Date().toISOString();

    // For simplicity, all items are considered updates
    // In production, track actual adds/updates/deletes
    return {
      added: lastSyncDate ? [] : collection,
      updated: lastSyncDate ? collection : [],
      deleted: [],
      syncToken,
    };
  }

  // Private helper methods

  private async getRecentAdditions(userId: string, limit: number): Promise<any[]> {
    return await prisma.userCollection.findMany({
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
      orderBy: { acquiredAt: 'desc' },
      take: limit,
    });
  }

  private async getUpcomingReleases(): Promise<any[]> {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingSets = await prisma.set.findMany({
      where: {
        releaseDate: {
          gte: new Date(),
          lte: thirtyDaysFromNow,
        },
      },
      orderBy: { releaseDate: 'asc' },
      take: 5,
    });

    // Get key cards for each set (would need more logic in production)
    return upcomingSets.map(set => ({
      id: set.id,
      name: set.name,
      releaseDate: set.releaseDate,
      totalCards: set.totalCards,
      keyCards: [], // Would fetch notable cards
    }));
  }

  private async getHistoricalValue(userId: string, daysAgo: number): Promise<number> {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    const snapshot = await prisma.collectionSnapshot.findFirst({
      where: {
        userId,
        createdAt: {
          gte: date,
          lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return snapshot?.totalValue || 0;
  }

  private async invalidateUserCaches(userId: string): Promise<void> {
    await Promise.all([
      analysisCache.deletePattern(`*${userId}*`),
      searchCache.deletePattern(`*${userId}*`),
      recommendationCache.deletePattern(`${userId}:*`),
    ]);
  }

  private generateShareId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private async generateQRCode(url: string): Promise<string> {
    // In production, use a QR code library
    // For now, return a placeholder
    return `qr-code-for-${url}`;
  }

  /**
   * Get collection insights with AI analysis
   */
  async getAIInsights(userId: string): Promise<{
    recommendations: string[];
    opportunities: string[];
    warnings: string[];
  }> {
    const [stats, performance, wantList] = await Promise.all([
      this.statsAnalyzer.getCollectionStats(userId),
      this.valueTracker.analyzePerformance(userId),
      this.wantListManager.getWantList(userId),
    ]);

    const recommendations: string[] = [];
    const opportunities: string[] = [];
    const warnings: string[] = [];

    // Analysis logic
    if (stats.duplicateCount > 50) {
      recommendations.push('Consider trading or selling excess duplicates to diversify your collection');
    }

    if (performance.unrealizedGainPercentage > 20) {
      opportunities.push('Your collection has gained significant value. Consider realizing some profits');
    }

    if (stats.valueDistribution[0].count > stats.valueDistribution.reduce((sum, v) => sum + v.count, 0) * 0.8) {
      warnings.push('Most of your collection consists of low-value cards. Consider quality over quantity');
    }

    return { recommendations, opportunities, warnings };
  }
}