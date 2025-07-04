# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

** Standard Workflow
1. First think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the [todo.md](http://todo.md/) file with a summary of the changes you made and any other relevant information.

## Project Overview

Pokemon TCG Deck Builder - A Next.js 14 application for building, analyzing, and managing Pokemon Trading Card Game decks. Features include AI-powered deck analysis, collection management with value tracking, drag-and-drop deck building, and real-time card pricing from the Pokemon TCG API.

**Current Status**: v1.0.16-MVP with 13,622 cards imported (71.19% of 19,136 total)

## Essential Commands

```bash
# Development
npm run dev                                      # Start dev server (http://localhost:3000)
npm run build                                    # Production build (includes BUILDING=true env var)
npm run lint                                     # Run ESLint
npm run type-check                               # TypeScript type checking
npm run format                                   # Format code with Prettier
npm run format:check                             # Check code formatting

# Database Operations (requires .env.local)
npx dotenv -e .env.local -- prisma db push      # Apply schema changes to database
npx dotenv -e .env.local -- prisma migrate dev  # Create new migration
npx dotenv -e .env.local -- prisma studio       # Open Prisma Studio GUI
npx prisma generate                              # Regenerate Prisma client after schema changes

# Card Data Import Scripts
npx tsx src/scripts/test-import.ts               # Test import (2 sets, 10 cards each)
npx tsx src/scripts/import-cards-simple.ts       # Full import with progress tracking
npx tsx src/scripts/auto-import.ts               # Smart auto-import (chooses full vs update)
npx tsx src/scripts/batch-import.ts              # Batch import optimized for Vercel
npx tsx src/scripts/smart-daily-import.ts        # Smart priority-based update (existing cards only)
npx tsx src/scripts/check-total-cards.ts         # Check import progress (19,136 total available)
npx tsx src/scripts/check-db.ts                  # Check database status
npx tsx src/scripts/fix-tcgplayer-search-urls.ts # Fix TCGPlayer URLs for existing cards
npx tsx src/scripts/test-search-performance.ts   # Test search query performance
npx tsx src/scripts/generate-icons.ts            # Generate PWA app icons
npx tsx src/scripts/generate-og-image.ts         # Generate Open Graph images

# Deployment
./deploy.sh                                      # Automated Vercel deployment

# Testing Components
npm run dev                                      # Then navigate to /design-system for component showcase
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Database**: PostgreSQL (Neon) + Prisma ORM
- **API**: tRPC for type-safe APIs
- **Auth**: Clerk with role-based access
- **Caching**: Redis (Vercel KV/Upstash REST API)
- **Jobs**: Bull/BullMQ for background processing (requires direct Redis connection)
- **Styling**: Tailwind CSS + custom design system
- **Monitoring**: Web Vitals and performance tracking
- **PWA**: Service Worker for offline support
- **Security**: CSP headers, XSS protection, input validation

### Request Flow
```
Client Request → Clerk Middleware → Security Middleware → tRPC Router → Business Logic → Database
                                                    ↓                              ↓
                                           Security Headers                Cache Layer (Redis)
                                                                                  ↓
                                                                     External APIs (Pokemon TCG)
```

### Authentication & Authorization

The app uses Clerk for authentication with a mapping system:
- Clerk's `userId` maps to database `User.clerkUserId`
- Role hierarchy: `user` → `premium_user` → `moderator` → `admin` → `senior_admin` → `super_admin`
- Subscription tiers: `FREE`, `BASIC`, `PREMIUM`, `ULTIMATE`

**Current Implementation (Development Mode)**:
- Using `SignInButton mode="modal"` for authentication
- Modal popup approach works in Clerk development mode
- Sign-in redirects to `/dashboard` after success
- SSO callback (`/sso-callback`) handles new user onboarding

tRPC procedure types:
- `publicProcedure`: No auth required
- `protectedProcedure`: Requires authentication
- `premiumProcedure`: Requires premium subscription
- `adminProcedure`: Requires admin role

### Database Schema

Key models and relationships:
- `User` → `Deck` (one-to-many)
- `User` → `UserCollection` → `Card` (many-to-many with metadata)
- `Card` → `CardPrice` → `PriceHistory` (pricing data chain)
- `Deck` → `DeckCard` → `Card` (deck composition)

Always use Prisma enums from `@prisma/client` for type safety:
```typescript
import { Rarity, Supertype, DeckCategory } from '@prisma/client';
```

## Security Implementation

### Input Validation
All forms use Zod schemas from `/lib/validations/index.ts`:
- **Authentication**: `signInSchema`, `signUpSchema`
- **Profile**: `profileFormSchema`, `preferencesFormSchema`, `privacySettingsSchema`
- **Contact**: `contactFormSchema`
- **Deck Building**: `createDeckSchema`, `saveDeckSchema`
- **Collection**: `addToCollectionSchema`, `bulkAddToCollectionSchema`
- **Trading**: `createTradeOfferSchema`
- **Search**: `searchSchema`

Use `sanitizeInput()` for user-generated content before storage/display.

### XSS Protection
- Security middleware adds CSP headers and other security headers
- No `innerHTML` usage - all DOM manipulation uses safe methods
- Image URLs validated against trusted domains
- XSS protection utilities in `/lib/security/xss-protection.ts`

### Content Security Policy
Applied via middleware with restrictions on:
- Script sources (self + Clerk domains)
- Image sources (self + trusted CDNs)
- Form actions (self only)
- Frame ancestors (none)

### User Permission System
Comprehensive permission checking system:
- **Middleware**: `requireResourcePermission`, `requireOwnership`, `requirePublicOrOwned`
- **Subscription Features**: `requireSubscriptionFeature`, `checkDeckLimit`, `checkCollectionLimit`
- **Bulk Operations**: `requireBulkOperationPermission` with tier-based limits
- **Rate Limiting**: `rateLimitBySubscription` with different limits per tier
- **Audit Logging**: `auditLog` middleware for sensitive operations
- **Frontend Components**: `<PermissionGate>` and `<FeatureGate>` for conditional rendering
- **Permission Utilities**: `hasPermission()`, `requiresUpgrade()`, `getUpgradeMessage()`

## Critical Patterns

### Client-Only Imports
**Important**: React hooks should be imported directly from 'react', NOT from performance utilities:
```typescript
// ✅ Correct
import { useState, useEffect } from 'react';

// ❌ Wrong - performance/client does not export React hooks
import { useState } from '@/lib/performance/client';
```

### Mobile-First Responsive Design
```typescript
// Component grid pattern
const gridClasses = viewMode === 'minimal' 
  ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'
  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';

// Responsive text sizing (uses CSS clamp)
<h1 className="text-responsive-3xl">Title</h1>  // Fluid from mobile to desktop

// Responsive utilities
import { useMediaQuery, useBreakpoint } from '@/hooks/useMediaQuery';
// Returns: { isMobile, isTablet, isDesktop, isLargeDesktop }
```

### Next.js 15 Dynamic Routes
Dynamic route parameters must be awaited:
```typescript
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ... rest of component
}
```

## Search System

The app has an advanced search system with multiple features:

### Search Endpoints
- `searchOptimized`: Relevance-based search with intelligent ranking
- `search`: Legacy search endpoint (still used in some places)

### Search Features
1. **Card name search**: Only searches card names, not set names
2. **Card number search**: Search by collector number (e.g., "172")
3. **Combined search**: Space-separated queries (e.g., "char 32" finds Charcadet #032)
4. **Relevance ranking**:
   - Exact match: 100 points
   - Name+number match: 92 points (for space-separated queries)
   - Prefix match: 90 points
   - Number exact: 95 points
   - Word boundary: 70 points
   - Contains: 50 points

### Search Behavior
- When searching, results are ALWAYS sorted by relevance (user sort is ignored)
- Sort dropdown shows "✓ Sorting by relevance when searching" and is disabled
- Single character searches only return prefix matches
- Filters (supertype, set, rarity) still work during search

## Pokemon TCG API Integration

The Pokemon TCG API provides both card data AND pricing:
- TCGPlayer prices (USD) in `apiCard.tcgplayer.prices`
- CardMarket prices (EUR) in `apiCard.cardmarket.prices`
- No separate pricing API needed - extract prices during card import/sync
- API Key provides 20,000 requests/day (vs 1,000 without)

Price extraction happens in `transformAndValidateCard()` which returns both card data and pricing data.

### Card Import System

**Current Progress**: 13,622 cards imported (71.19% of 19,136 total cards in API)

The project has multiple import scripts for different scenarios:

1. **Auto Import** (`auto-import.ts`) - RECOMMENDED:
   - Intelligently chooses between batch import and smart update
   - Switches to smart update when 100% cards are imported
   - Used by the daily cron job

2. **Batch Import** (`batch-import.ts`):
   - Optimized for Vercel's 5-minute function limit
   - Processes 3 sets on Vercel, 10 sets locally
   - Tracks progress and resumes from last position

3. **Simple Import** (`import-cards-simple.ts`):
   - Most reliable script for full imports
   - Fixed all Prisma relation errors
   - Handles TCGPlayer purchase URLs
   - Progress tracking with statistics

4. **Smart Daily Import** (`smart-daily-import.ts`):
   - Only updates EXISTING cards, doesn't import new ones
   - Priority-based updates (newer cards first)
   - Requires minimum 100 cards before running
   - Configurable update frequencies by card age

5. **Test Import** (`test-import.ts`):
   - Limited to 2 sets, 10 cards each
   - Good for testing configuration

Import features:
- Batch processing with configurable limits
- Rate limiting (500ms delay between requests)
- Progress tracking with detailed logging
- Price data extraction from Pokemon TCG API
- Transaction-based imports for data integrity
- TCGPlayer purchase link generation (search-based, not direct links)

### TCGPlayer URL Format
The API doesn't provide direct TCGPlayer product URLs. We generate search URLs:
```typescript
// Format: combine card name + set name in query with + instead of %20
const searchQuery = `${apiCard.name} ${apiCard.set.name}`.replace(/ /g, '+');
`https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${searchQuery}&view=grid`
```

## Background Jobs & Build Issues

### BullMQ Redis Requirements
- BullMQ requires direct Redis connections (incompatible with Upstash REST API)
- During build, use `queue-wrapper.ts` instead of `queue.ts` to prevent connection attempts
- The wrapper detects build environment via `BUILDING=true` env var

### Cron Jobs (Vercel)
Configured in `vercel.json`:
- `/api/cron/daily-import` - Daily at 5 AM UTC (runs auto-import)
- `/api/cron/sync-cards` - Daily at 3 AM UTC
- `/api/cron/cleanup` - Monthly on 1st at 4 AM UTC

Protected by `CRON_SECRET` environment variable.

## Environment Variables

### Required for Development
```env
DATABASE_URL                          # PostgreSQL connection
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY    # Clerk auth
CLERK_SECRET_KEY                     # Clerk auth
KV_REST_API_URL                      # Redis/Vercel KV
KV_REST_API_TOKEN                    # Redis/Vercel KV
```

### Optional but Recommended
```env
POKEMON_TCG_API_KEY                  # For 20k requests/day (vs 1k)
NEXT_PUBLIC_APP_URL                  # For sharing features
REDIS_URL                            # Direct Redis connection for BullMQ
CRON_SECRET                          # Protect cron endpoints
```

## Current Status (June 2025)

### Working Features
- Complete API layer with all routers
- Deck builder with drag-and-drop
- Collection management with value tracking
- AI-powered deck analysis and recommendations
- Card browser with modal detail view
- User profiles and subscription system
- Background job infrastructure
- Clerk authentication with modal sign-in
- Card data import (13,622 cards from 111 sets imported)
- Auto-import system that switches between full and smart updates
- Smart daily import system with priority tiers
- TCGPlayer search links for all cards
- Automated cron jobs for data updates
- USD pricing display (filtered from API data)
- PWA support with manifest.json and icons
- Comprehensive security (input validation, XSS protection, CSP headers)

### Recent Updates (June 30, 2025)
- Security & PWA Enhancements:
  - Implemented comprehensive input validation on all forms using Zod
  - Added XSS protection with security middleware and CSP headers
  - Created PWA manifest.json with all required app icons
  - Generated Open Graph and Twitter card images
  - Created logo.svg and logo-dark.svg
  - Added robots.txt and dynamic sitemap generation
  - Fixed unsafe innerHTML usage
  - Enhanced all forms with proper validation
- Advanced Search Enhancements:
  - Search now only searches card names, not set names
  - Added card number search capability
  - Space-separated name+number search ("char 32" finds Charcadet #032)
  - Relevance-first sorting during search with visual indicator
  - Fixed grid layout to 5 columns for perfect alignment
- Performance optimizations: Added database indexes for search (queries now ~0.2ms)
- Fixed SQL parameter ordering issues for complex search queries

### Not Implemented
- Trading UI (API exists, no frontend)
- Stripe payment processing (infrastructure ready)
- Test suite (no tests written)
- Direct Redis connection for BullMQ in production
- Collection export/import functionality (buttons exist, logic missing)
- Deck deletion and cloning (UI exists, functionality missing)
- Email/push notifications for price alerts
- User permission checks (last security item)

## Design System

The app uses a comprehensive design system (`/src/styles/design-tokens.ts`) with:
- Pokemon energy type colors
- Glass morphism effects
- Dark mode with system preference detection
- Mobile-first responsive design
- Touch-friendly interfaces (44px minimum targets)
- Framer Motion animations

### Standardized UI Components
```typescript
// Form components with consistent styling (44px min-height for accessibility)
import { Input, Select, Textarea, FormField } from '@/components/ui';

// Unified card component for Pokemon cards
import PokemonCard from '@/components/cards/PokemonCard';
// Supports: layout='grid'|'list'|'compact', viewMode='minimal'|'compact'|'detailed'

// Modal components
import CardDetailModal from '@/components/cards/CardDetailModal';
// Custom modal implementation (replaced Headless UI due to build issues)

// Loading states
import { Skeleton, CardSkeleton, DeckCardSkeleton, TableRowSkeleton } from '@/components/ui';

// Touch-friendly components (all meet 44x44px minimum)
import { Toast } from '@/components/ui/Toast';
import { DeckCardItem } from '@/components/decks/DeckCardItem';
```

## Common Gotchas

1. **Prisma Client Generation**: Always run `npx prisma generate` after schema changes
2. **Environment Variables**: Use `dotenv -e .env.local --` prefix for Prisma commands
3. **React Imports**: Import React hooks directly from 'react', not from performance utilities
4. **Dynamic Routes**: Always await params in Next.js 15
5. **CSS Imports**: Use relative paths in CSS files, not Next.js aliases
6. **Rate Limiting**: API routes use in-memory rate limiting (should use Redis in production)
7. **Price Data**: Extract from Pokemon TCG API response, not separate pricing API
8. **Color System**: All colors are in HSL format. Use `hexToHSL()` from `/lib/utils/color-conversion`
9. **Animations**: All keyframe animations are in `/src/styles/animations.css`
10. **Responsive Design**: Use `useMediaQuery` hook from `/hooks/useMediaQuery`
11. **Touch Targets**: Ensure all interactive elements are at least 44x44px
12. **BullMQ Build**: Import from `queue-wrapper` instead of `queue` to prevent build errors
13. **Card Import**: Use `auto-import.ts` for most reliable imports
14. **Modal vs Navigation**: Card details use modal popup, not separate page
15. **Purchase URLs**: All cards link to TCGPlayer search (not direct products)
16. **Import Progress**: Check with `check-total-cards.ts` - 19,136 cards available
17. **Cron Jobs**: Require `CRON_SECRET` environment variable for protection
18. **Form Validation**: All forms must use Zod schemas from `/lib/validations`
19. **XSS Prevention**: Use `sanitizeInput()` for all user-generated content
20. **Image URLs**: Validate against trusted domains using `sanitizeImageUrl()`

## Deployment

Configured for Vercel deployment:
- `vercel.json` with function timeouts and cron jobs
- Automated deployment via `./deploy.sh` script
- Build includes Prisma generation
- See `DEPLOYMENT.md` for detailed instructions

### Vercel-Specific Requirements
1. Set all required environment variables in Vercel dashboard
2. Add `CRON_SECRET` for protecting cron endpoints
3. Enable Vercel KV for Redis caching
4. BullMQ jobs won't work without direct Redis connection
5. Daily import runs automatically at 5 AM UTC

## Project Status

- **Current Version**: v0.8.0 (per README.md)
- **Project Checklist Version**: 1.0.16-MVP (updated)
- **Status**: MVP ready with complete security implementation and PWA support
- **Database**: 13,622 cards from 111 sets with 78,000+ prices
- **Import Progress**: 71.19% complete (13,622 of 19,136 cards)
- **Search Performance**: Optimized with database indexes (queries ~0.2ms)
- **Security**: Complete implementation with validation, XSS protection, CSP headers, and permission checks
- **Next Steps**:
  1. Set up unit tests framework
  2. Create integration tests for API routes
  3. Activate design tokens with generateCSSVariables()
  4. Replace hardcoded values with design tokens
  5. Consolidate energy colors to single source
  6. Create type-safe client hooks for tRPC

## MVP Priority List (9 Tasks Remaining)

### Completed for Launch (14 items done)
- ✅ 4/7 Visual/PWA Issues (manifest, icons, OG images, logo, robots.txt, sitemap)
- ✅ 3/3 Security items (input validation, XSS protection, user permission checks)

### Remaining Critical Items (9 items)
1. **Testing Foundation** (2 items):
   - Unit tests setup (currently no tests exist)
   - Integration tests for API routes

2. **Design System** (3 items):
   - Activate design tokens with generateCSSVariables()
   - Replace hardcoded values with design tokens
   - Consolidate energy colors to single source

### Important but Can Deploy Without (4 items)
- API documentation
- Type-safe client hooks for tRPC
- E2E and performance testing
- Contributing guidelines

### Search Optimization Details

**Database Indexes Created**:
- `idx_card_name_lower` - Case-insensitive name searches
- `idx_card_number` - Card number searches
- `idx_card_name_trgm` - Fuzzy/contains searches (uses pg_trgm)
- `idx_card_name_pattern` - LIKE pattern matching
- `idx_card_number_pattern` - Number pattern matching

**Search Performance Script**:
```bash
npx tsx src/scripts/test-search-performance.ts  # Test various search scenarios
```

## Quick Reference

### Check Import Progress
```bash
npx tsx src/scripts/check-total-cards.ts
```

### Run Manual Import
```bash
npx tsx src/scripts/auto-import.ts  # Recommended - chooses mode automatically
```

### Fix TCGPlayer URLs
```bash
npx tsx src/scripts/fix-tcgplayer-search-urls.ts
```

### Generate PWA Assets
```bash
npx tsx src/scripts/generate-icons.ts       # App icons
npx tsx src/scripts/generate-og-image.ts    # Social images
```

### Monitor Logs
```bash
tail -f import.log  # Watch import progress
```

### Test Search Performance
```bash
npx tsx src/scripts/test-search-performance.ts
```

### Run with Proper Environment
```bash
npx dotenv -e .env.local -- npm run dev     # Run with local env vars
```