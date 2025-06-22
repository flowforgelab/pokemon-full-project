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

# Without env file loading (if DATABASE_URL is in environment)
npx prisma generate           # Generate Prisma client
npx prisma migrate deploy     # Deploy migrations in production
```

### Package Management
```bash
npm install                   # Install dependencies
npm install <package>         # Add new dependency
npm install -D <package>      # Add new dev dependency
```

### Testing API Endpoints
```bash
# Analyze a deck
curl -X GET http://localhost:3000/api/analysis/{deckId} \
  -H "Authorization: Bearer {clerk-token}"

# Search collection
curl -X GET "http://localhost:3000/api/collection/search?text=charizard&types=POKEMON" \
  -H "Authorization: Bearer {clerk-token}"

# Get collection dashboard
curl -X GET http://localhost:3000/api/collection/dashboard \
  -H "Authorization: Bearer {clerk-token}"

# Quick add cards
curl -X POST http://localhost:3000/api/collection/quick-add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {clerk-token}" \
  -d '{"items": [{"cardName": "Charizard ex", "quantity": 1, "condition": "NEAR_MINT"}]}'

# Create new deck
curl -X POST http://localhost:3000/api/deck-builder/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {clerk-token}" \
  -d '{"name": "My Fire Deck", "formatId": "standard"}'

# Search cards for deck builder
curl -X POST http://localhost:3000/api/deck-builder/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {clerk-token}" \
  -d '{"text": "charizard", "types": ["POKEMON"], "page": 1}'
```

## Architecture Overview

### Core Systems

1. **Authentication (Clerk)**
   - Middleware at `src/middleware.ts` protects routes
   - Client wrapper at `src/components/providers/clerk-provider.tsx` prevents SSR issues
   - User lookup: `clerkUserId` → `User.id` (UUID)

2. **Database (PostgreSQL + Prisma)**
   - Hosted on Neon with connection pooling
   - 25+ models including new collection management models
   - JSON fields for flexible card data (attacks, abilities)
   - Full-text search enabled with PostgreSQL extensions
   - Key models: User, Card, Set, Deck, UserCollection, WantList, CollectionTag

3. **API Layer**
   - **tRPC** routers in `src/server/routers/` for type-safe RPC
   - **REST API** endpoints in `src/app/api/` for collection management
   - Protected procedures require authentication
   - Context provides `userId` and `prisma` client

4. **External API Integration**
   - **Pokemon TCG API** (`src/lib/api/pokemon-tcg-client.ts`)
     - Rate limiting: 1000 requests/hour
     - Retry logic with exponential backoff using p-retry
     - Batch operations support
   - **TCGPlayer API** (`src/lib/api/tcgplayer-client.ts`)
     - OAuth authentication with auto-refresh
     - Bulk price fetching (250 items max)
     - Price history tracking

5. **Caching & Jobs**
   - **Redis** (Vercel KV/Upstash) for caching
   - **Bull/BullMQ** for background jobs
   - Job processors in `src/lib/jobs/processors/`
   - Scheduled jobs: price updates, card sync, collection indexing, cleanup

6. **Deck Analysis Engine** (`src/lib/analysis/`)
   - **ConsistencyCalculator**: Energy ratios, mulligan probability
   - **SynergyAnalyzer**: Card interactions, combo detection
   - **MetaEvaluator**: Matchup predictions, tech recommendations
   - **SpeedAnalyzer**: Setup efficiency, prize race
   - **ArchetypeClassifier**: 9 deck archetype detection
   - **ScoringSystem**: Comprehensive deck scoring

7. **AI Recommendation System** (`src/lib/recommendations/`)
   - **RecommendationEngine**: Main orchestrator with learning capabilities
   - **ArchetypeGenerator**: Builds decks from scratch using templates
   - **ReplacementOptimizer**: Intelligent card replacement suggestions
   - **BudgetBuilder**: Budget-aware deck building with upgrade paths
   - **CollectionBuilder**: Leverages user's owned cards
   - **SynergyCalculator**: Advanced synergy and combo detection
   - **MetaAnalyzer**: Real-time meta analysis and counter strategies

8. **Collection Management System** (`src/lib/collection/`)
   - **CollectionManager**: Main orchestrator for all collection features
   - **CollectionSearchEngine**: Advanced search with full-text and filtering
   - **CollectionStatisticsAnalyzer**: Analytics and insights generation
   - **QuickAddManager**: Bulk import and quick card addition
   - **CollectionOrganizationManager**: Tags, folders, and custom organization
   - **WantListManager**: Want list tracking with price alerts
   - **CollectionValueTracker**: Real-time value and performance tracking
   - **ImportExportManager**: Multi-format import/export (CSV, JSON, TCGDB)
   - **CollectionSearchIndexer**: Redis-based search indexing

9. **Deck Builder System** (`src/lib/deck-builder/`)
   - **DeckBuilderManager**: Main orchestrator for deck building operations
   - **CardSearchEngine**: Advanced card search with suggestions
   - **DragDropManager**: Drag-and-drop functionality with touch support
   - **DeckValidator**: Real-time deck validation and format checking
   - **DeckStatisticsAnalyzer**: Deck statistics and visualization
   - **DeckTestingSimulator**: Opening hand simulation and testing
   - **SmartSuggestionEngine**: AI-powered card recommendations
   - **CollaborationManager**: Deck sharing and version control

### Key Design Patterns

1. **Enum Handling**
   ```typescript
   import { Rarity, Supertype, CardCondition } from '@prisma/client';
   // Use z.nativeEnum() in Zod schemas
   z.object({ rarity: z.nativeEnum(Rarity) })
   ```

2. **User Authentication in Routers**
   ```typescript
   const user = await ctx.prisma.user.findUnique({
     where: { clerkUserId: ctx.userId }
   });
   ```

3. **Rate Limiting Pattern**
   ```typescript
   await pokemonTCGQueue.enqueue(
     () => apiCall(),
     userId,
     JobPriority.HIGH
   );
   ```

4. **Caching Pattern**
   ```typescript
   const cached = await cardCache.get(key);
   if (!cached) {
     const data = await fetchData();
     await cardCache.set(key, data, ttl);
   }
   ```

5. **Collection Search Pattern**
   ```typescript
   const manager = new CollectionManager();
   const results = await manager.searchCollection(
     userId,
     filters,
     page,
     pageSize
   );
   ```

6. **Error Handling Pattern**
   ```typescript
   try {
     const result = await operation();
     return NextResponse.json(result);
   } catch (error) {
     console.error('Operation failed:', error);
     return NextResponse.json(
       { error: 'Failed to perform operation' },
       { status: 500 }
     );
   }
   ```

### Data Flow

1. **Card Data Sync**
   - Pokemon TCG API → Transformer → Prisma → Database
   - Background jobs update data daily
   - Cache invalidation on updates

2. **Deck Analysis**
   - Deck → Analyzers → Scoring → Recommendations
   - Results cached for 1 hour
   - Comparison uses head-to-head simulation

3. **Price Updates**
   - TCGPlayer API → Price processor → Database
   - Weekly bulk updates via background jobs
   - Real-time updates for individual cards

4. **Collection Management Flow**
   - Cards → Collection → Search Index → Analytics → Insights
   - Real-time value tracking with price updates
   - Import/Export with multiple format support

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY` - Authentication
- `KV_REST_API_URL` & `KV_REST_API_TOKEN` - Redis/Vercel KV

Optional but recommended:
- `POKEMON_TCG_API_KEY` - Higher rate limits for Pokemon TCG API
- `TCGPLAYER_API_PUBLIC_KEY` & `TCGPLAYER_API_PRIVATE_KEY` - Pricing data
- `NEXT_PUBLIC_APP_URL` - Base URL for sharing features

### Common Development Tasks

1. **Add a new API endpoint**
   - Create route handler in `src/app/api/[feature]/route.ts`
   - Use Clerk auth() for authentication
   - Add proper error handling and validation
   - Update CLAUDE.md with endpoint examples

2. **Add a new background job**
   - Create processor in `src/lib/jobs/processors/`
   - Add queue in `src/lib/jobs/queue.ts`
   - Register in job scheduler if recurring
   - Add to queue stats monitoring

3. **Modify database schema**
   - Edit `prisma/schema.prisma`
   - Run `npx dotenv -e .env.local -- prisma db push`
   - Update affected routers and types
   - Consider adding indexes for performance

4. **Add collection feature**
   - Extend managers in `src/lib/collection/`
   - Update types in `src/lib/collection/types.ts`
   - Add API endpoints in `src/app/api/collection/`
   - Update search indexes if affecting searchable data

5. **Add deck builder feature**
   - Extend managers in `src/lib/deck-builder/`
   - Update types in `src/lib/deck-builder/types.ts`
   - Add API endpoints in `src/app/api/deck-builder/`
   - Update validation rules if needed

### Performance Considerations

1. **API Rate Limits**
   - Pokemon TCG: 1000/hour (tracked per user)
   - TCGPlayer: 1000/hour (global)
   - Use queuing system for bulk operations

2. **Caching Strategy**
   - Cards: 24 hour TTL
   - Prices: 1 hour TTL
   - Search results: 1 hour TTL
   - Analysis results: 1 hour TTL
   - Recommendations: 1 hour TTL
   - Meta data: 24 hour TTL
   - Collection search: 5 minute TTL

3. **Database Queries**
   - Use indexes defined in schema
   - Batch operations when possible
   - Consider pagination for large results
   - Use includes wisely to avoid N+1 queries

### Troubleshooting

1. **Prisma Client Not Found**
   ```bash
   npx prisma generate
   npm run build
   ```

2. **Type Errors with Enums**
   - Import from `@prisma/client`
   - Use `z.nativeEnum()` in Zod schemas
   - Check enum values match database

3. **Rate Limit Errors**
   - Check rate limit status in monitoring
   - Implement retry logic with backoff
   - Use job queues for bulk operations

4. **Cache Issues**
   - Clear specific keys: `redis.del(key)`
   - Check TTL: `redis.ttl(key)`
   - Monitor hit/miss ratios
   - Use cache invalidation patterns

5. **Collection Search Issues**
   - Rebuild search index: `collectionIndexQueue.add(...)`
   - Check Redis connection for indexes
   - Verify search filters are valid
   - Monitor index size and performance

6. **Import/Export Issues**
   - Validate file format before processing
   - Check field mappings for CSV imports
   - Handle large files with streaming
   - Provide clear error messages for failed rows

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   └── api/               # REST API endpoints
│       ├── analysis/      # Deck analysis
│       ├── collection/    # Collection management
│       ├── deck-builder/  # Deck builder operations
│       └── recommendations/ # AI recommendations
├── lib/                   # Core business logic
│   ├── api/              # External API clients
│   ├── analysis/         # Deck analysis engine
│   ├── collection/       # Collection management
│   ├── deck-builder/     # Deck builder system
│   ├── recommendations/  # AI recommendation system
│   └── jobs/            # Background job processors
├── server/              # tRPC backend
│   └── routers/         # tRPC routers
└── types/               # TypeScript types
```

### Key Dependencies

- **Next.js 15.3.4** - React framework
- **Prisma 6.10.1** - Database ORM
- **tRPC 11.4.2** - Type-safe API
- **Clerk** - Authentication
- **Bull/BullMQ** - Job queues
- **Zod** - Schema validation
- **p-retry** - Retry logic
- **papaparse** - CSV parsing