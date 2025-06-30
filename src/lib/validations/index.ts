import { z } from 'zod';

// ============================================
// Common validation patterns
// ============================================

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email address')
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  );

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, underscores, and hyphens'
  )
  .toLowerCase()
  .trim();

// ============================================
// Authentication schemas
// ============================================

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema.optional(),
});

// ============================================
// Profile schemas
// ============================================

export const profileFormSchema = z.object({
  username: usernameSchema,
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters')
    .trim(),
  bio: z
    .string()
    .max(500, 'Bio must be at most 500 characters')
    .optional(),
});

export const preferencesFormSchema = z.object({
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']),
  language: z.enum(['en', 'es', 'fr', 'de', 'it', 'ja']),
  timezone: z.string().min(1, 'Timezone is required'),
  theme: z.enum(['light', 'dark', 'system']),
  collectionDisplay: z.enum(['grid', 'list', 'compact']),
  deckBuildingMode: z.enum(['simple', 'advanced']),
  defaultFormat: z.enum(['standard', 'expanded', 'unlimited']),
  priceAlerts: z.boolean(),
});

export const privacySettingsSchema = z.object({
  profileVisibility: z.enum(['public', 'friends', 'private']),
  collectionVisibility: z.enum(['public', 'friends', 'private']),
  decksVisibility: z.enum(['public', 'friends', 'private']),
  showOnlineStatus: z.boolean(),
  allowFriendRequests: z.boolean(),
  allowMessages: z.boolean(),
  allowTradeOffers: z.boolean(),
  showInLeaderboards: z.boolean(),
  shareDataForAnalytics: z.boolean(),
});

// ============================================
// Contact form schema
// ============================================

export const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long')
    .trim(),
  email: emailSchema,
  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(200, 'Subject is too long')
    .trim(),
  category: z.enum(['general', 'bug', 'feature', 'support', 'business']),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message is too long')
    .trim(),
});

// ============================================
// Deck building schemas
// ============================================

export const deckNameSchema = z
  .string()
  .min(1, 'Deck name is required')
  .max(100, 'Deck name must be at most 100 characters')
  .trim();

export const createDeckSchema = z.object({
  name: deckNameSchema,
  format: z.enum(['standard', 'expanded', 'unlimited', 'glc']),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  isPublic: z.boolean().default(false),
});

export const deckCardSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  quantity: z
    .number()
    .int()
    .min(1, 'Quantity must be at least 1')
    .max(4, 'Maximum 4 copies allowed (except basic energy)'),
});

export const saveDeckSchema = z.object({
  name: deckNameSchema,
  format: z.enum(['standard', 'expanded', 'unlimited', 'glc']),
  description: z.string().max(500).optional(),
  isPublic: z.boolean(),
  cards: z
    .array(deckCardSchema)
    .min(60, 'Deck must have exactly 60 cards')
    .max(60, 'Deck must have exactly 60 cards'),
});

// ============================================
// Collection schemas
// ============================================

export const addToCollectionSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  quantity: z.number().int().min(1).max(999),
  condition: z.enum(['mint', 'near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged']),
  language: z.enum(['en', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'pt', 'ru', 'zh']).default('en'),
  isFirstEdition: z.boolean().default(false),
  isHolo: z.boolean().default(false),
  isReverse: z.boolean().default(false),
  purchasePrice: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export const bulkAddToCollectionSchema = z.object({
  cards: z.array(addToCollectionSchema).min(1).max(100),
});

// ============================================
// Trading schemas
// ============================================

export const createTradeOfferSchema = z.object({
  recipientId: z.string().min(1, 'Recipient is required'),
  message: z
    .string()
    .max(500, 'Message must be at most 500 characters')
    .optional(),
  offeredCards: z
    .array(z.object({
      cardId: z.string(),
      quantity: z.number().int().min(1),
    }))
    .min(1, 'Must offer at least one card'),
  requestedCards: z
    .array(z.object({
      cardId: z.string(),
      quantity: z.number().int().min(1),
    }))
    .min(1, 'Must request at least one card'),
});

// ============================================
// Search schemas
// ============================================

export const searchSchema = z.object({
  query: z.string().trim(),
  filters: z.object({
    supertype: z.enum(['pokemon', 'trainer', 'energy']).optional(),
    subtypes: z.array(z.string()).optional(),
    types: z.array(z.string()).optional(),
    rarity: z.string().optional(),
    set: z.string().optional(),
    format: z.enum(['standard', 'expanded', 'unlimited']).optional(),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
  }).optional(),
  sort: z.enum(['name', 'price', 'release', 'number']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// ============================================
// Want list schemas
// ============================================

export const addToWantListSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  quantity: z.number().int().min(1).max(99).default(1),
  priority: z.number().int().min(1).max(10).default(5),
  maxPrice: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

// ============================================
// Admin schemas
// ============================================

export const adminUserUpdateSchema = z.object({
  role: z.enum(['user', 'premium_user', 'moderator', 'admin', 'senior_admin', 'super_admin']).optional(),
  subscriptionTier: z.enum(['FREE', 'BASIC', 'PREMIUM', 'ULTIMATE']).optional(),
  isActive: z.boolean().optional(),
  isBanned: z.boolean().optional(),
  banReason: z.string().max(500).optional(),
});

// ============================================
// Utility functions
// ============================================

/**
 * Sanitize user input to prevent XSS attacks
 * Use this for any user-generated content that will be displayed
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers (onclick, onmouseover, etc.)
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove vbscript: protocol
    .replace(/vbscript:/gi, '')
    // Remove data: protocol that could execute scripts
    .replace(/data:text\/javascript/gi, '')
    .replace(/data:application\/javascript/gi, '')
    // Escape HTML entities
    .replace(/[<>]/g, (match) => {
      const escapeMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
      };
      return escapeMap[match] || match;
    })
    .trim();
}

/**
 * Validate and sanitize HTML content
 * Use this for rich text fields that allow some HTML
 */
export function sanitizeHtml(html: string): string {
  // In production, use a library like DOMPurify
  // For now, we'll strip all HTML tags
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Create a validated form handler
 */
export function createValidatedFormHandler<T extends z.ZodSchema>(
  schema: T,
  onValid: (data: z.infer<T>) => Promise<void> | void,
  onError?: (errors: z.ZodError) => void
) {
  return async (data: unknown) => {
    try {
      const validatedData = schema.parse(data);
      await onValid(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError && onError) {
        onError(error);
      } else {
        throw error;
      }
    }
  };
}