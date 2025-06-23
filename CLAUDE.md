# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
npm run dev                    # Start Next.js dev server on http://localhost:3000
npm run build                  # Build for production (runs prisma generate first)
npm run start                  # Start production server
npm run lint                   # Run ESLint
npm run type-check            # TypeScript type checking
npm run format                # Format code with Prettier
npm run format:check          # Check formatting without fixing
```

### Database Operations
```bash
# Local development with .env.local
npx dotenv -e .env.local -- prisma db push       # Push schema changes to database
npx dotenv -e .env.local -- prisma migrate dev   # Create new migration
npx dotenv -e .env.local -- prisma studio        # Open Prisma Studio GUI

# Migration management
npx prisma generate           # Generate Prisma client
npx prisma migrate deploy     # Deploy migrations in production
npx prisma migrate dev --name <migration-name>  # Create named migration
```

### Testing API Endpoints
```bash
# Get Clerk token from browser DevTools: localStorage.getItem('__clerk_db_jwt')

# Deck Analysis
curl -X GET http://localhost:3000/api/analysis/{deckId} \
  -H "Authorization: Bearer {clerk-token}"

# Collection Search
curl -X GET "http://localhost:3000/api/collection/search?text=charizard&types=POKEMON" \
  -H "Authorization: Bearer {clerk-token}"

# Create Deck
curl -X POST http://localhost:3000/api/deck-builder/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {clerk-token}" \
  -d '{"name": "My Fire Deck", "formatId": "standard"}'

# Test Deck Hands
curl -X GET http://localhost:3000/api/deck-builder/{deckId}/test?hands=10 \
  -H "Authorization: Bearer {clerk-token}"
```

## Architecture Overview

### Authentication Flow
1. Clerk middleware (`src/middleware.ts`) protects API routes
2. Routes extract `clerkUserId` from auth context
3. Database lookup: `clerkUserId` → `User.id` (UUID)
4. All API operations use internal `User.id`
5. Role-based access control (RBAC) with 6 levels: user, premium_user, pro_user, moderator, admin, super_admin
6. Stripe subscription integration for feature gating

### tRPC API Architecture
The application uses tRPC for type-safe API communication:

```typescript
// Client component
const { data } = api.card.search.useQuery({ query: "charizard" });

// Server router
export const cardRouter = createTRPCRouter({
  search: publicProcedure
    .input(searchSchema)
    .query(async ({ ctx, input }) => {
      // Implementation
    })
});
```

**Key tRPC Patterns:**
- `publicProcedure`: No auth required
- `protectedProcedure`: Requires authentication
- `premiumProcedure`: Requires premium subscription
- `adminProcedure`: Requires admin role

### Database Architecture
- **Neon PostgreSQL** with connection pooling
- **Prisma ORM** with type-safe queries
- **Key Relations**:
  - User → Decks (one-to-many)
  - User → UserCollection (one-to-many)
  - Deck → DeckCards → Cards (many-to-many with quantity)
  - Card → Set (many-to-one)
  - Card → Prices (one-to-many, ordered by date)

### API Architecture
```
Client Request → Clerk Auth → tRPC Router → Business Logic → Database
                                    ↓
                              Cache Layer (Redis)
                                    ↓
                              External APIs (if needed)
```

### Caching Strategy
- **Memory Cache**: LRU with 100MB limit, 5min TTL
- **Redis Cache**: Distributed cache with varied TTLs
- **Cache Keys**:
  - Cards: `card:{id}` (24hr)
  - Search: `search:{hash}` (1hr)
  - Prices: `price:{id}` (1hr)
  - Analysis: `analysis:{deckId}` (1hr)
  - Collection: `collection:dashboard:{userId}` (1hr)

### Background Job Processing
Jobs are processed using Bull/BullMQ with Redis:
1. **Price Updates**: Weekly full sync, daily top cards
2. **Card Sync**: Daily new cards, weekly full sync
3. **Collection Index**: On-demand after bulk updates
4. **Cleanup**: Monthly stale data removal

### Performance Optimization
- **Client/Server Split**: React hooks in `/lib/performance/client`
- **API Optimization**: Use `optimizeAPIRoute` wrapper
- **Database Indexes**: Custom indexes for frequent queries
- **Image CDN**: Automatic optimization with responsive images

## Mobile-First Component Architecture

### Component Organization
```
src/components/
├── cards/                 # Card display components
│   ├── CardDisplay.tsx   # Main container with layout switching
│   ├── CardGrid.tsx      # Responsive grid layout
│   ├── CardList.tsx      # Mobile-optimized list view
│   ├── CardStack.tsx     # Swipeable card stack
│   └── CardItem.tsx      # Individual card with lazy loading
├── decks/                # Deck building components
│   ├── DeckBuilder.tsx   # Main deck building interface
│   ├── DeckSection.tsx   # Collapsible card sections
│   ├── DeckSearch.tsx    # Mobile search with voice support
│   └── DeckStats.tsx     # Visual deck composition
└── ui/                   # Reusable UI components
    ├── MobileModal.tsx   # Mobile-optimized modals
    ├── BottomSheet.tsx   # Drag-to-dismiss sheets
    ├── Toast.tsx         # Swipeable notifications
    ├── Accordion.tsx     # Collapsible sections
    └── Tabs.tsx          # Touch-friendly tabs
```

### Mobile Design Patterns
- **Touch Targets**: Minimum 44px for all interactive elements
- **Gesture Support**: Swipe, long press, pinch-to-zoom
- **Responsive Breakpoints**: Mobile-first with 5 breakpoints (xs, sm, md, lg, xl)
- **Performance**: Lazy loading, virtualization, intersection observer
- **Accessibility**: ARIA labels, keyboard navigation, focus management

## Key Patterns

### Error Handling
```typescript
try {
  const result = await operation();
  return NextResponse.json(result);
} catch (error) {
  console.error('Operation failed:', error);
  
  if (error instanceof SomeKnownError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
  
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

### Prisma Enum Usage
```typescript
import { Rarity, Supertype } from '@prisma/client';

// In Zod schemas
const schema = z.object({
  rarity: z.nativeEnum(Rarity),
  supertype: z.nativeEnum(Supertype)
});
```

### Rate-Limited API Calls
```typescript
await pokemonTCGQueue.enqueue(
  async () => {
    const result = await apiClient.cards.list({ q: 'name:charizard' });
    return result;
  },
  userId,
  JobPriority.HIGH
);
```

### Protected API Routes
```typescript
import { protectedApiRoute } from '@/lib/auth/api-middleware';

export const GET = protectedApiRoute(
  async (req, context) => {
    // context.userId and context.userRole available
    return NextResponse.json({ data });
  },
  {
    requiredRole: 'premium_user',
    requiredPermission: {
      resource: 'deck',
      action: 'create'
    },
    rateLimit: { requests: 100, window: 60 }
  }
);
```

### Mobile Component Patterns
```typescript
// Touch gesture handling
const handleTouchStart = (e: React.TouchEvent) => {
  setTouchStart(e.touches[0].clientX);
};

// Responsive image loading
<Image
  src={card.imageUrlSmall}
  alt={card.name}
  fill
  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
  className="object-cover"
/>

// Mobile-first breakpoints
const getGridColumns = () => {
  switch (viewMode) {
    case 'minimal':
      return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6';
    case 'compact':
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
    default:
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
  }
};
```

## Common Tasks

### Adding New API Endpoint
1. Create router method in appropriate `src/server/routers/{feature}.ts`
2. Use appropriate procedure type (public, protected, premium, admin)
3. Define input validation with Zod schema
4. Implement business logic with proper error handling
5. Update `src/server/routers/_app.ts` if new router

### Database Schema Changes
1. Edit `prisma/schema.prisma`
2. Create migration: `npx dotenv -e .env.local -- prisma migrate dev --name descriptive-name`
3. Update affected TypeScript types
4. Update API routes and business logic
5. Consider adding indexes for new queries

### Adding Background Job
1. Create processor in `src/lib/jobs/processors/{name}-processor.ts`
2. Add queue definition in `src/lib/jobs/queue.ts`
3. Register in scheduler if recurring
4. Add monitoring in `src/lib/jobs/monitoring.ts`

### Creating Mobile Components
1. Start with mobile-first responsive design
2. Implement touch gesture handlers
3. Add appropriate loading states (skeleton screens)
4. Ensure minimum touch target size (44px)
5. Test on actual mobile devices
6. Add haptic feedback for interactions
7. Implement proper focus management

## Environment Variables

### Required for Development
```env
DATABASE_URL              # PostgreSQL connection
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
KV_REST_API_URL          # Redis (Vercel KV)
KV_REST_API_TOKEN
```

### Optional Features
```env
POKEMON_TCG_API_KEY      # Higher rate limits
TCGPLAYER_API_PUBLIC_KEY # Price data
TCGPLAYER_API_PRIVATE_KEY
NEXT_PUBLIC_APP_URL      # For sharing features
```

### Stripe Integration
```env
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
# Price IDs for each subscription tier
STRIPE_BASIC_MONTHLY_PRICE_ID
STRIPE_BASIC_YEARLY_PRICE_ID
STRIPE_PREMIUM_MONTHLY_PRICE_ID
STRIPE_PREMIUM_YEARLY_PRICE_ID
STRIPE_ULTIMATE_MONTHLY_PRICE_ID
STRIPE_ULTIMATE_YEARLY_PRICE_ID
```

## Authentication & Subscription System

### User Roles & Permissions
- **Roles**: user, premium_user, pro_user, moderator, admin, super_admin
- **Subscription Tiers**: FREE, BASIC ($4.99), PREMIUM ($9.99), ULTIMATE ($19.99)
- **Feature Gating**: Use `<FeatureGate feature="feature-name">` component
- **Permission Check**: `canAccess(role, resource, action)`

### Stripe Webhook Handling
Webhooks are handled at `/api/stripe/webhook`:
- `checkout.session.completed` - Activates subscription
- `customer.subscription.updated/deleted` - Updates user tier
- `invoice.payment_succeeded/failed` - Payment tracking

## Troubleshooting

### Build Errors
- **React hooks in server code**: Import from `/lib/performance/client` for client-only code
- **Prisma client missing**: Run `npx prisma generate`
- **Type errors with enums**: Import from `@prisma/client`, use `z.nativeEnum()`
- **Next.js 15 dynamic routes**: Ensure params are awaited in dynamic routes

### Runtime Issues
- **Rate limits**: Check queue status, implement backoff
- **Cache misses**: Verify Redis connection, check TTLs
- **Slow queries**: Check database indexes, use query analysis
- **Memory issues**: Monitor cache size, implement cleanup
- **Auth issues**: Check Clerk middleware, verify environment variables
- **Subscription issues**: Verify Stripe webhook configuration

### Mobile Development Issues
- **Touch not working**: Check touch event handlers and gesture zones
- **Layout breaking**: Verify responsive breakpoints and container queries
- **Performance issues**: Check image sizes, implement virtualization
- **Modal focus**: Ensure proper focus trap implementation

## Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # REST endpoints
│   ├── sign-in/          # Custom auth pages
│   ├── sign-up/          
│   ├── pricing/          # Subscription tiers
│   └── account/          # User management
├── components/            # React components
│   ├── auth/             # Auth components
│   ├── cards/            # Card display components
│   ├── decks/            # Deck building components
│   ├── profile/          # User profile forms
│   ├── subscription/     # Subscription UI
│   └── ui/               # Reusable UI components
├── lib/                   # Business logic
│   ├── analysis/         # Deck analysis engine
│   ├── auth/             # Auth utilities & RBAC
│   ├── collection/       # Collection management
│   ├── deck-builder/     # Deck builder system
│   ├── stripe/           # Stripe integration
│   ├── performance/      # Performance utilities
│   │   ├── client/      # Client-only code
│   │   └── *.ts         # Server-safe code
│   └── recommendations/  # AI system
├── server/               # tRPC backend
│   ├── routers/         # API routes
│   └── trpc.ts          # tRPC setup
├── types/                # TypeScript types
│   ├── index.ts         # General types
│   ├── pokemon.ts       # Pokemon card types
│   └── auth.ts          # Auth & user types
└── hooks/                # Custom React hooks
    ├── useDebounce.ts
    ├── useIntersectionObserver.ts
    ├── useFocusTrap.ts
    └── useBodyScrollLock.ts
```

## API Routers Overview

### Card Router (`/server/routers/card.ts`)
- `search`: Advanced search with 15+ filters
- `getById`: Get card with full details
- `getBulk`: Batch card retrieval
- `getSets`: Get all sets with filters
- `getBySet`: Cards by set with completion
- `getSimilar`: Find similar cards
- `getPopular`: Trending cards by timeframe
- `validateForDeck`: Format legality check
- `getPriceHistory`: Historical pricing

### Collection Router (`/server/routers/collection.ts`)
- `getDashboard`: Comprehensive stats
- `searchCards`: Advanced collection search
- `addCard`: Add to collection
- `bulkAddCards`: Batch add up to 100
- `updateCard`: Modify collection entry
- `getStatistics`: Value and growth metrics
- `getWantList`: Priority-based wishlist
- `importCollection`: CSV/JSON import
- `exportCollection`: Multiple formats
- `createSnapshot`: Save collection state (premium)

### Analysis Router (`/server/routers/analysis.ts`)
- `analyzeDeck`: Single deck analysis
- `compareDecks`: Head-to-head comparison
- `getDeckStats`: Performance over time
- `scheduleAnalysis`: Automated analysis (premium)
- `getRecommendations`: Card/strategy suggestions
- `exportAnalysis`: Generate reports

### Pricing Router (`/server/routers/pricing.ts`)
- `getCurrentPrice`: Real-time pricing
- `getPriceHistory`: Historical data
- `getMarketTrends`: Market movers
- `createPriceAlert`: Set price alerts
- `getPortfolioValue`: Collection value tracking
- `refreshPrices`: Manual update (premium)