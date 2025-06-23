import { SubscriptionTier } from '@prisma/client';

export interface UserProfile {
  clerkUserId: string;
  username: string;
  email: string;
  avatar: string;
  preferences: UserPreferences;
  subscription: SubscriptionDetails;
  privacy: PrivacySettings;
  notifications: NotificationSettings;
  createdAt: Date;
  lastLogin: Date;
  isActive: boolean;
}

export interface UserPreferences {
  defaultFormat: 'standard' | 'expanded' | 'legacy';
  preferredCurrency: 'USD' | 'EUR' | 'GBP';
  deckBuildingMode: 'beginner' | 'advanced';
  collectionDisplay: 'grid' | 'list';
  priceAlerts: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
}

export interface SubscriptionDetails {
  tier: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
  features: SubscriptionFeatures;
  billing: BillingDetails;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface SubscriptionFeatures {
  maxDecks: number;
  advancedAnalysis: boolean;
  priceAlerts: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  exportFeatures: boolean;
  customBranding: boolean;
  teamFeatures: boolean;
  aiRecommendations: boolean;
  tournamentTools: boolean;
}

export interface BillingDetails {
  paymentMethod: 'card' | 'paypal' | 'bank_transfer' | null;
  lastFour?: string;
  billingEmail: string;
  billingAddress?: BillingAddress;
  invoices: Invoice[];
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  createdAt: Date;
  pdfUrl?: string;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  collectionVisibility: 'public' | 'friends' | 'private';
  deckSharingDefault: 'public' | 'unlisted' | 'private';
  showOnlineStatus: boolean;
  allowFriendRequests: boolean;
  allowTradeOffers: boolean;
  allowMessages: boolean;
  searchableProfile: boolean;
  shareActivityFeed: boolean;
  analyticsOptOut: boolean;
}

export interface NotificationSettings {
  email: EmailNotifications;
  push: PushNotifications;
  inApp: InAppNotifications;
  frequency: 'realtime' | 'daily' | 'weekly' | 'never';
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
  };
}

export interface EmailNotifications {
  priceAlerts: boolean;
  newSetReleases: boolean;
  deckSharing: boolean;
  securityAlerts: boolean;
  newsletter: boolean;
  accountUpdates: boolean;
  tradeOffers: boolean;
  friendRequests: boolean;
  tournamentReminders: boolean;
  systemMaintenance: boolean;
}

export interface PushNotifications {
  enabled: boolean;
  priceAlerts: boolean;
  tradeOffers: boolean;
  friendActivity: boolean;
  tournamentUpdates: boolean;
}

export interface InAppNotifications {
  showToasts: boolean;
  soundEnabled: boolean;
  desktopEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface UserRole {
  name: 'user' | 'premium_user' | 'pro_user' | 'moderator' | 'admin' | 'super_admin';
  permissions: Permission[];
  expiresAt?: Date;
}

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'manage')[];
  conditions?: Record<string, any>;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  twoFactorMethod: 'authenticator' | 'sms' | 'email' | null;
  loginAlerts: boolean;
  trustedDevices: TrustedDevice[];
  activeSessions: ActiveSession[];
  securityQuestions: SecurityQuestion[];
  backupCodes: string[];
}

export interface TrustedDevice {
  id: string;
  name: string;
  lastUsed: Date;
  browser: string;
  os: string;
  addedAt: Date;
}

export interface ActiveSession {
  id: string;
  device: string;
  location: string;
  ipAddress: string;
  startedAt: Date;
  lastActivity: Date;
  current: boolean;
}

export interface SecurityQuestion {
  id: string;
  question: string;
  answerHash: string;
}

export interface OnboardingProgress {
  completed: boolean;
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  skippedSteps: string[];
  preferences: Partial<UserPreferences>;
  importedCollection: boolean;
  createdFirstDeck: boolean;
  joinedCommunity: boolean;
  setupNotifications: boolean;
}

export interface AccountRecovery {
  email: string;
  phone?: string;
  securityQuestions: SecurityQuestion[];
  backupEmail?: string;
  recoveryMethods: RecoveryMethod[];
}

export interface RecoveryMethod {
  type: 'email' | 'phone' | 'authenticator' | 'backup_codes';
  verified: boolean;
  lastUsed?: Date;
  value?: string; // Masked value for display
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  userGroups: string[];
  conditions: Record<string, any>;
}

export interface UserFeatureAccess {
  userId: string;
  features: Record<string, boolean>;
  experiments: Record<string, string>; // experiment key -> variant
  overrides: Record<string, boolean>;
}