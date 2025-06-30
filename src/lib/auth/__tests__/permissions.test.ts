import { hasPermission, getSubscriptionFeatures, requiresUpgrade, hasReachedDeckLimit } from '../permissions';
import { SubscriptionTier } from '@prisma/client';
import type { User } from '@prisma/client';

describe('Permission System', () => {
  describe('hasPermission', () => {
    it('should grant all permissions to admin users', () => {
      const adminUser = {
        id: '1',
        features: ['admin'],
        subscriptionTier: SubscriptionTier.FREE,
      } as User;

      expect(hasPermission(adminUser, 'deck', 'create')).toBe(true);
      expect(hasPermission(adminUser, 'collection', 'delete')).toBe(true);
      expect(hasPermission(adminUser, 'trade', 'manage')).toBe(true);
    });

    it('should grant specific permissions to moderators', () => {
      const moderatorUser = {
        id: '2',
        features: ['moderator'],
        subscriptionTier: SubscriptionTier.FREE,
      } as User;

      expect(hasPermission(moderatorUser, 'deck', 'read')).toBe(true);
      expect(hasPermission(moderatorUser, 'deck', 'delete')).toBe(true);
      expect(hasPermission(moderatorUser, 'deck', 'create')).toBe(false);
    });

    it('should restrict free users to their own resources', () => {
      const freeUser = {
        id: '3',
        features: [],
        subscriptionTier: SubscriptionTier.FREE,
      } as User;

      expect(hasPermission(freeUser, 'deck', 'create', { own: true })).toBe(true);
      expect(hasPermission(freeUser, 'deck', 'create', { own: false })).toBe(false);
      expect(hasPermission(freeUser, 'collection', 'read', { own: true })).toBe(true);
    });

    it('should grant premium permissions to basic tier users', () => {
      const basicUser = {
        id: '4',
        features: [],
        subscriptionTier: SubscriptionTier.BASIC,
      } as User;

      expect(hasPermission(basicUser, 'analysis', 'create')).toBe(true);
      expect(hasPermission(basicUser, 'price_alert', 'create')).toBe(true);
      expect(hasPermission(basicUser, 'api', 'read')).toBe(false); // API access is Premium+
    });

    it('should grant extensive permissions to premium/ultimate users', () => {
      const premiumUser = {
        id: '5',
        features: [],
        subscriptionTier: SubscriptionTier.PREMIUM,
      } as User;

      expect(hasPermission(premiumUser, 'api', 'read')).toBe(true);
      expect(hasPermission(premiumUser, 'team', 'create')).toBe(true);
      expect(hasPermission(premiumUser, 'tournament', 'create')).toBe(true);
    });

    it('should return false for null user', () => {
      expect(hasPermission(null, 'deck', 'create')).toBe(false);
    });
  });

  describe('getSubscriptionFeatures', () => {
    it('should return correct features for FREE tier', () => {
      const features = getSubscriptionFeatures(SubscriptionTier.FREE);
      
      expect(features.maxDecks).toBe(3);
      expect(features.maxCollectionSize).toBe(100);
      expect(features.advancedAnalysis).toBe(false);
      expect(features.priceAlerts).toBe(false);
      expect(features.bulkOperationLimit).toBe(10);
    });

    it('should return correct features for BASIC tier', () => {
      const features = getSubscriptionFeatures(SubscriptionTier.BASIC);
      
      expect(features.maxDecks).toBe(10);
      expect(features.maxCollectionSize).toBe(500);
      expect(features.advancedAnalysis).toBe(true);
      expect(features.priceAlerts).toBe(true);
      expect(features.bulkOperationLimit).toBe(25);
    });

    it('should return unlimited features for ULTIMATE tier', () => {
      const features = getSubscriptionFeatures(SubscriptionTier.ULTIMATE);
      
      expect(features.maxDecks).toBe(-1); // Unlimited
      expect(features.maxCollectionSize).toBe(-1); // Unlimited
      expect(features.advancedAnalysis).toBe(true);
      expect(features.tournamentTools).toBe(true);
      expect(features.bulkOperationLimit).toBe(500);
    });
  });

  describe('requiresUpgrade', () => {
    it('should return true for features not available in FREE tier', () => {
      const freeUser = {
        id: '1',
        features: [],
        subscriptionTier: SubscriptionTier.FREE,
      } as User;

      expect(requiresUpgrade(freeUser, 'advancedAnalysis')).toBe(true);
      expect(requiresUpgrade(freeUser, 'priceAlerts')).toBe(true);
      expect(requiresUpgrade(freeUser, 'apiAccess')).toBe(true);
    });

    it('should return false for features available in PREMIUM tier', () => {
      const premiumUser = {
        id: '2',
        features: [],
        subscriptionTier: SubscriptionTier.PREMIUM,
      } as User;

      expect(requiresUpgrade(premiumUser, 'advancedAnalysis')).toBe(false);
      expect(requiresUpgrade(premiumUser, 'apiAccess')).toBe(false);
      expect(requiresUpgrade(premiumUser, 'teamFeatures')).toBe(false);
    });

    it('should return true for null user', () => {
      expect(requiresUpgrade(null, 'advancedAnalysis')).toBe(true);
    });
  });

  describe('hasReachedDeckLimit', () => {
    it('should enforce deck limit for FREE tier', () => {
      const freeUser = {
        id: '1',
        features: [],
        subscriptionTier: SubscriptionTier.FREE,
      } as User;

      expect(hasReachedDeckLimit(freeUser, 2)).toBe(false);
      expect(hasReachedDeckLimit(freeUser, 3)).toBe(true);
      expect(hasReachedDeckLimit(freeUser, 4)).toBe(true);
    });

    it('should allow unlimited decks for ULTIMATE tier', () => {
      const ultimateUser = {
        id: '2',
        features: [],
        subscriptionTier: SubscriptionTier.ULTIMATE,
      } as User;

      expect(hasReachedDeckLimit(ultimateUser, 100)).toBe(false);
      expect(hasReachedDeckLimit(ultimateUser, 1000)).toBe(false);
    });

    it('should return true for null user', () => {
      expect(hasReachedDeckLimit(null, 1)).toBe(true);
    });
  });
});