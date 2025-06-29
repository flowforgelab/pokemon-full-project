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

### Not Implemented
- Trading UI (API exists, no frontend)
- Stripe payment processing (infrastructure ready)
- Test suite (no tests written)
- Direct Redis connection for BullMQ in production

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