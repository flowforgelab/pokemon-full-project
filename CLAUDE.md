# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pokemon TCG Deck Builder - A Next.js 14 application for building, analyzing, and managing Pokemon Trading Card Game decks. Features include AI-powered deck analysis, collection management with value tracking, drag-and-drop deck building, and real-time card pricing from the Pokemon TCG API.

## Essential Commands

```bash
# Development
npm run dev                                      # Start dev server (http://localhost:3000)
npm run build                                    # Production build
npm run lint                                     # Run ESLint
npm run type-check                               # TypeScript type checking

# Database Operations
npx dotenv -e .env.local -- prisma db push      # Apply schema changes to database
npx dotenv -e .env.local -- prisma migrate dev  # Create new migration
npx dotenv -e .env.local -- prisma studio       # Open Prisma Studio GUI
npx prisma generate                              # Regenerate Prisma client after schema changes
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Database**: PostgreSQL (Neon) + Prisma ORM
- **API**: tRPC for type-safe APIs
- **Auth**: Clerk with role-based access
- **Caching**: Redis (Vercel KV)
- **Jobs**: Bull/BullMQ for background processing
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
React hooks must be imported from performance utilities for client components:
```typescript
// ❌ Wrong
import { useState } from 'react';

// ✅ Correct
import { useState } from '@/lib/performance/client';
```

### Mobile-First Responsive Design
```typescript
// Component grid pattern
const gridClasses = viewMode === 'minimal' 
  ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'
  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
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

## Background Jobs

Jobs are processed using Bull/BullMQ with Redis:
- Card sync: Daily at 3 AM UTC
- Price updates: Automatic during card sync
- Set detection: Checks for new Pokemon sets
- Data cleanup: Monthly maintenance

## Environment Variables

### Required
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
- Some production environment variables

### Known Issues
- ESLint warnings converted to warnings for build
- TypeScript strict checks temporarily disabled for some files
- PDF/image export returns 501 (not implemented)

## Design System

The app uses a comprehensive design system (`/src/styles/design-tokens.ts`) with:
- Pokemon energy type colors
- Glass morphism effects
- Dark mode with system preference detection
- Mobile-first responsive design
- Touch-friendly interfaces (44px minimum targets)
- Framer Motion animations

## Deployment

Configured for Vercel deployment:
- `vercel.json` with function timeouts
- Automated cron jobs
- Build includes Prisma generation
- See `DEPLOYMENT.md` for detailed instructions