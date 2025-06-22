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

### Testing & Analysis
```bash
# Analyze a deck via API
curl -X GET http://localhost:3000/api/analysis/{deckId} \
  -H "Authorization: Bearer {clerk-token}"

# Compare two decks
curl -X POST http://localhost:3000/api/analysis/compare \
  -H "Content-Type: application/json" \
  -d '{"deckIdA": "...", "deckIdB": "...", "format": "standard"}'
```

## Architecture Overview

### Core Systems

1. **Authentication (Clerk)**
   - Middleware at `src/middleware.ts` protects routes
   - Client wrapper at `src/components/providers/clerk-provider.tsx` prevents SSR issues
   - User lookup: `clerkUserId` → `User.id` (UUID)

2. **Database (PostgreSQL + Prisma)**
   - Hosted on Neon with connection pooling
   - Comprehensive schema with 13+ models
   - JSON fields for flexible card data (attacks, abilities)
   - Full-text search enabled with PostgreSQL extensions

3. **API Layer (tRPC)**
   - Type-safe API with routers in `src/server/routers/`
   - Protected procedures require authentication
   - Context provides `userId` and `prisma` client

4. **External API Integration**
   - **Pokemon TCG API** (`src/lib/api/pokemon-tcg-client.ts`)
     - Rate limiting: 1000 requests/hour
     - Retry logic with exponential backoff
     - Batch operations support
   - **TCGPlayer API** (`src/lib/api/tcgplayer-client.ts`)
     - OAuth authentication with auto-refresh
     - Bulk price fetching (250 items max)
     - Price history tracking

5. **Caching & Jobs**
   - **Redis** (Vercel KV/Upstash) for caching
   - **Bull/BullMQ** for background jobs
   - Job processors in `src/lib/jobs/processors/`
   - Scheduled jobs: price updates, card sync, cleanup

6. **Deck Analysis Engine** (`src/lib/analysis/`)
   - **ConsistencyCalculator**: Energy ratios, mulligan probability
   - **SynergyAnalyzer**: Card interactions, combo detection
   - **MetaEvaluator**: Matchup predictions, tech recommendations
   - **SpeedAnalyzer**: Setup efficiency, prize race
   - **ArchetypeClassifier**: 9 deck archetype detection
   - **ScoringSystem**: Comprehensive deck scoring

### Key Design Patterns

1. **Enum Handling**
   ```typescript
   import { Rarity, Supertype } from '@prisma/client';
   // Use z.nativeEnum() in tRPC routers
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

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`
- `KV_REST_API_URL` & `KV_REST_API_TOKEN` - Redis

Optional but recommended:
- `POKEMON_TCG_API_KEY` - Higher rate limits
- `TCGPLAYER_API_PUBLIC_KEY` & `TCGPLAYER_API_PRIVATE_KEY` - Pricing data

### Common Development Tasks

1. **Add a new tRPC route**
   - Create router in `src/server/routers/`
   - Add to `appRouter` in `src/server/routers/_app.ts`
   - Use `protectedProcedure` for auth-required endpoints

2. **Add a new background job**
   - Create processor in `src/lib/jobs/processors/`
   - Add queue in `src/lib/jobs/queue.ts`
   - Register in job scheduler

3. **Modify database schema**
   - Edit `prisma/schema.prisma`
   - Run `npx dotenv -e .env.local -- prisma db push`
   - Update affected routers and types

4. **Add deck analysis feature**
   - Extend analyzer in `src/lib/analysis/`
   - Update types in `src/lib/analysis/types.ts`
   - Integrate in `DeckAnalyzer` class

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

3. **Database Queries**
   - Use indexes defined in schema
   - Batch operations when possible
   - Consider pagination for large results

### Troubleshooting

1. **Prisma Client Not Found**
   ```bash
   npx prisma generate
   npm run build
   ```

2. **Type Errors with Enums**
   - Import from `@prisma/client`
   - Use `z.nativeEnum()` in Zod schemas

3. **Rate Limit Errors**
   - Check rate limit status in monitoring
   - Implement retry logic
   - Use job queues for bulk operations

4. **Cache Issues**
   - Clear specific keys: `redis.del(key)`
   - Check TTL: `redis.ttl(key)`
   - Monitor hit/miss ratios

5. **Job Queue Problems**
   - Check queue status: `/api/health`
   - View failed jobs in queue stats
   - Manually retry: `queue.retry(jobId)`