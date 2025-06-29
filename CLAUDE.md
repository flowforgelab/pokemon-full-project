# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pokemon TCG Deck Builder - A Next.js 14 application for building, analyzing, and managing Pokemon Trading Card Game decks. Features include AI-powered deck analysis, collection management with value tracking, drag-and-drop deck building, and real-time card pricing from the Pokemon TCG API.

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

# Data Import
npx tsx src/scripts/test-import.ts               # Test import (2 sets, 10 cards each)
npx tsx src/scripts/import-cards.ts              # Full import (all sets and cards)

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

### Request Flow
```
Client Request → Clerk Middleware → tRPC Router → Business Logic → Database
                                           ↓
                                     Cache Layer (Redis)
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
- Embedded sign-in pages (`/sign-in`, `/sign-up`) are ready but not used due to dev mode limitations
- Multiple test implementations exist for debugging:
  - `/clerk-debug` - Debug page with Clerk status
  - `/clerk-config` - Configuration testing
  - `/test-clerk`, `/test-signin` - Alternative test implementations
  - `/simple-signin`, `/basic-signin`, `/temp-signin` - Simplified approaches
  - `/hosted-signin`, `/manual-signin` - Different authentication methods
  - `/activate-clerk` - Clerk activation page
- SSO callback (`/sso-callback`) handles new user onboarding

**Production Plan**:
- Upgrade to Clerk production instance
- Switch from modal to embedded sign-in pages
- Enable full Clerk features including SSO providers
- Remove test authentication pages

tRPC procedure types:
- `publicProcedure`: No auth required
- `protectedProcedure`: Requires authentication
- `premiumProcedure`: Requires premium subscription
- `adminProcedure`: Requires admin role

### API Pattern Example

```typescript
// Protected API route pattern
import { protectedApiRoute } from '@/lib/auth/api-middleware';

export const GET = protectedApiRoute(
  async (req, context) => {
    // context.userId and context.userRole available
    return NextResponse.json({ data });
  },
  { requiredRole: 'premium_user', rateLimit: { requests: 100, window: 60 } }
);
```

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

// Responsive units in CSS
.card-grid {
  grid-template-columns: repeat(auto-fill, minmax(clamp(180px, 12rem, 220px), 1fr));
  gap: clamp(0.75rem, 2vw, 1.25rem);
}
```

### Next.js 15 Dynamic Routes
Dynamic route parameters must be awaited:
```typescript
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ... rest of component
}
```

## Pokemon TCG API Integration

The Pokemon TCG API provides both card data AND pricing:
- TCGPlayer prices (USD) in `apiCard.tcgplayer.prices`
- CardMarket prices (EUR) in `apiCard.cardmarket.prices`
- No separate pricing API needed - extract prices during card import/sync

Price extraction happens in `transformAndValidateCard()` which returns both card data and pricing data.

### Card Data Import Process
To populate the database with Pokemon cards:
1. Use the existing `card-import-service.ts` to fetch cards from Pokemon TCG API
2. The service handles pagination and rate limiting automatically
3. Cards are transformed and validated before database insertion
4. Prices are extracted during import if available
5. Import can be triggered via:
   - Admin API endpoint: `POST /api/admin/import-cards`
   - Background job: `cardSyncQueue` (requires Redis connection)
   - Direct service call in development

Example import commands:
```bash
# Test import - imports only 2 sets with 10 cards each
npx tsx src/scripts/test-import.ts

# Full import - imports all sets and cards (respect rate limits)
npx tsx src/scripts/import-cards.ts

# Or use the admin API endpoint
curl -X POST http://localhost:3000/api/admin/import-cards \
  -H "Content-Type: application/json" \
  -d '{"action": "import-sets"}'
```

Import script features:
- Batch processing (250 cards per request)
- Rate limiting (500ms delay between requests)
- Progress tracking with detailed logging
- Price data extraction from Pokemon TCG API
- Transaction-based imports for data integrity
- Configurable limits for testing

## Background Jobs & Build Issues

### BullMQ Redis Requirements
- BullMQ requires direct Redis connections (incompatible with Upstash REST API)
- During build, use `queue-wrapper.ts` instead of `queue.ts` to prevent connection attempts
- The wrapper detects build environment via `BUILDING=true` env var

### Job Processing
Jobs are processed using Bull/BullMQ with Redis:
- Card sync: Daily at 3 AM UTC
- Price updates: Automatic during card sync
- Set detection: Checks for new Pokemon sets
- Data cleanup: Monthly maintenance

## Environment Variables

### Required for Development
```env
DATABASE_URL                          # PostgreSQL connection
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY    # Clerk auth
CLERK_SECRET_KEY                     # Clerk auth
KV_REST_API_URL                      # Redis/Vercel KV
KV_REST_API_TOKEN                    # Redis/Vercel KV
```

### Optional
```env
POKEMON_TCG_API_KEY                  # For 20k requests/day (vs 1k)
NEXT_PUBLIC_APP_URL                  # For sharing features
REDIS_URL                            # Direct Redis connection for BullMQ
```

## Current Status & Limitations

### Working Features
- Complete API layer with all routers
- Deck builder with drag-and-drop
- Collection management with value tracking
- AI-powered deck analysis and recommendations
- Card browser with advanced search
- User profiles and subscription system
- Background job infrastructure
- Clerk authentication with modal sign-in (temporary solution for development mode)
- Performance monitoring dashboard (development only)
- PWA support with service worker
- Card data import scripts with rate limiting
- SSO callback flow with new user detection

### Not Implemented
- Trading UI (API exists, no frontend)
- Stripe payment processing (infrastructure ready)
- Test suite (no tests written)
- Direct Redis connection for BullMQ in production
- Collection export/import functionality (buttons exist, logic missing)
- Deck deletion and cloning (UI exists, functionality missing)
- Email/push notifications for price alerts
- Some admin management features
- User management routers (marked as TODO)

### Recent Updates (December 2024)
- **Authentication**: Implemented Clerk authentication with temporary modal sign-in approach
  - Currently using `SignInButton mode="modal"` due to Clerk development mode limitations
  - Will switch to integrated sign-in pages when moving to production with Clerk upgrade
  - Sign-in redirects to dashboard after successful authentication
  - Created multiple test pages for debugging Clerk integration issues
  - SSO callback implemented with new user onboarding flow
- **Database**: Connected to Neon PostgreSQL database, schema is ready
- **Environment**: All required environment variables configured in Vercel
- **Data Import**: Created scripts for importing Pokemon card data
  - Test import script for development (2 sets, 10 cards)
  - Full import script with rate limiting and progress tracking
  - Admin API endpoint for controlled imports
- **Performance**: Added performance monitoring dashboard for development
- **PWA**: Implemented service worker for offline support

### Build-Time Considerations
- Prisma client is generated during build via `postinstall` script
- BullMQ connections are mocked during build using `queue-wrapper.ts`
- Build command sets `BUILDING=true` to indicate build environment
- `.env.production` contains dummy values for build-time requirements

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

// Loading states
import { Skeleton, CardSkeleton, DeckCardSkeleton, TableRowSkeleton } from '@/components/ui';

// Responsive utilities
import { useMediaQuery, useBreakpoint } from '@/hooks/useMediaQuery';
// Returns: { isMobile, isTablet, isDesktop, isLargeDesktop }

// Touch-friendly components (all meet 44x44px minimum)
import { Toast } from '@/components/ui/Toast';
import { DeckCardItem } from '@/components/decks/DeckCardItem';
```

## Deployment

Configured for Vercel deployment:
- `vercel.json` with function timeouts
- Automated cron jobs
- Build includes Prisma generation
- See `DEPLOYMENT.md` for detailed instructions

### Vercel-Specific Requirements
1. Set all required environment variables in Vercel dashboard
2. Enable Vercel KV for Redis caching
3. BullMQ jobs won't work without direct Redis connection
4. Build process uses dummy environment variables from `.env.production`

## TODOs and Unimplemented Features

Based on code analysis, the following features need implementation:

### Collection Management
- Export collection functionality (`/app/(dashboard)/collection/page.tsx`)
- Import collection functionality
- Set filter dropdown needs actual set data

### Deck Management
- Delete deck functionality (`/components/decks/DeckList.tsx`)
- Clone deck functionality

### API Routers
- User management routers marked as TODO (`/server/api/routers/user.ts`)
- Admin router marked as TODO

### Notifications
- Email notifications for price updates
- Push notifications for set imports
- System monitoring alerts

### Admin Features
- Proper admin authentication check in import-cards route
- Admin management dashboard

## Scripts and Data Management

### Card Import Scripts
The project includes standalone scripts for importing Pokemon card data:

```typescript
// Test import - limited data for development
npx tsx src/scripts/test-import.ts
// Imports: 2 sets, 10 cards per set
// Shows progress, statistics, and sample data

// Full import - complete database population
npx tsx src/scripts/import-cards.ts
// Features:
// - Batch processing (250 cards per request)
// - Rate limiting (500ms between requests)
// - Progress tracking with statistics
// - Transaction-based for data integrity
// - Automatic price extraction
```

### Deployment Automation
Use the deployment script for Vercel:
```bash
./deploy.sh
# Checks environment variables
# Runs build
# Deploys to Vercel
```

## Performance Monitoring

Development includes a performance dashboard:
- Access via floating button (bottom-right corner)
- Shows Web Vitals (LCP, FID, CLS, etc.)
- Cache performance metrics
- API response times
- Memory usage statistics

## Common Gotchas

1. **Prisma Client Generation**: Always run `npx prisma generate` after schema changes
2. **Environment Variables**: Use `dotenv -e .env.local --` prefix for Prisma commands
3. **React Imports**: Import React hooks directly from 'react', not from performance utilities
4. **Dynamic Routes**: Always await params in Next.js 15
5. **CSS Imports**: Use relative paths in CSS files, not Next.js aliases (e.g., `../styles/animations.css`)
6. **Rate Limiting**: API routes use in-memory rate limiting (should use Redis in production)
7. **Price Data**: Extract from Pokemon TCG API response, not separate pricing API
8. **Color System**: All colors are in HSL format. Use `hexToHSL()` from `/lib/utils/color-conversion` when needed
9. **Animations**: All keyframe animations are in `/src/styles/animations.css` - do not duplicate in other files
10. **Responsive Design**: Use `useMediaQuery` hook from `/hooks/useMediaQuery` for responsive behavior
11. **Touch Targets**: Ensure all interactive elements are at least 44x44px for accessibility
12. **BullMQ Build**: Import from `queue-wrapper` instead of `queue` to prevent build errors
13. **Missing StarIcon**: Import from `@heroicons/react/24/outline`, not `lucide-react`
14. **Card Import**: Use test import first to verify configuration before full import
15. **Clerk Test Pages**: Multiple test pages exist in development - will be removed in production

## Project Status

- **Current Version**: v0.8.0 (per README.md)
- **Project Checklist Version**: 1.0.8-MVP (per PROJECT_CHECKLIST.md)
- **Status**: MVP ready, needs card data import and production Clerk upgrade
- **Deployment**: Automated via `deploy.sh` script to Vercel
- **Authentication**: Working with modal approach in development mode
- **Database**: Schema complete, awaiting card data import
- **Next Steps**:
  1. Run card import script to populate database
  2. Test all core functionality
  3. Upgrade to Clerk production instance
  4. Switch to embedded authentication pages
  5. Implement remaining TODO features
  6. Add test coverage