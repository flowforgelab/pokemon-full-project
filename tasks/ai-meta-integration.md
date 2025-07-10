# AI Meta Data Integration Plan

## Overview
Enhance AI deck analysis by injecting current tournament meta data to supplement GPT-4's knowledge cutoff (Dec 2024).

## Phase 1: Database Schema

### New Tables
```prisma
model TournamentResult {
  id          String   @id @default(cuid())
  date        DateTime
  tournament  String
  format      Format
  playerCount Int
  topDecks    Json     // Array of deck objects with placement
  metaSnapshot Json    // Card usage percentages
  source      String   // "limitless-tcg", "manual", etc.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([date, format])
}

model MetaCard {
  id           String   @id @default(cuid())
  cardId       String
  card         Card     @relation(fields: [cardId], references: [id])
  format       Format
  usagePercent Float    // Percentage in top decks
  avgCopies    Float    // Average copies per deck
  trending     Boolean  @default(false)
  weeklyChange Float    @default(0)
  lastSeen     DateTime
  updatedAt    DateTime @updatedAt
  
  @@unique([cardId, format])
  @@index([format, usagePercent])
}

model DeckArchetype {
  id           String   @id @default(cuid())
  name         String
  format       Format
  keyCards     String[] // Array of card IDs
  description  String?
  metaShare    Float    // Percentage of meta
  avgPlacement Float
  lastUpdated  DateTime
  
  @@unique([name, format])
}
```

## Phase 2: Meta Context Structure

### Context Template
```typescript
interface MetaContext {
  date: string;
  format: Format;
  topDecks: {
    rank: number;
    name: string;
    metaShare: number;
    keyCards: string[];
    recentWins: number;
  }[];
  trendingCards: {
    name: string;
    set: string;
    usage: number;
    weeklyChange: number;
    description?: string; // For new cards
  }[];
  recentChanges: {
    bans: string[];
    restrictions: string[];
    rotations: string[];
    newReleases: string[];
  };
  techChoices: {
    card: string;
    targets: string[]; // What it counters
    usage: number;
  }[];
}
```

## Phase 3: Integration Points

### 1. Meta Fetching Service
```typescript
// /src/lib/analysis/meta-context-service.ts
class MetaContextService {
  async getMetaContext(format: Format): Promise<MetaContext> {
    // Check cache first
    const cached = await cache.get(`meta:${format}`);
    if (cached) return cached;
    
    // Fetch from database
    const [results, cards, archetypes] = await Promise.all([
      this.getRecentTournaments(format),
      this.getTrendingCards(format),
      this.getTopArchetypes(format)
    ]);
    
    const context = this.buildMetaContext(results, cards, archetypes);
    
    // Cache for 24 hours
    await cache.set(`meta:${format}`, context, 86400);
    
    return context;
  }
}
```

### 2. AI Prompt Enhancement
```typescript
// In ai-deck-analyzer.ts
async prepareDeckForAI(deck: Deck): Promise<string> {
  const baseContext = this.formatDeckData(deck);
  
  // Inject meta context
  const metaContext = await this.metaContextService.getMetaContext(deck.format);
  const metaString = this.formatMetaContext(metaContext);
  
  return `${baseContext}\n\n${metaString}`;
}

formatMetaContext(meta: MetaContext): string {
  return `
## Current Meta Context (${meta.date})

### Top Performing Decks:
${meta.topDecks.map((d, i) => 
  `${i + 1}. ${d.name} (${d.metaShare}% of meta)`
).join('\n')}

### Trending Cards:
${meta.trendingCards.map(c => 
  `- ${c.name}: ${c.usage}% usage (${c.weeklyChange > 0 ? '+' : ''}${c.weeklyChange}% this week)`
).join('\n')}

### Recent Format Changes:
${meta.recentChanges.newReleases.length > 0 ? 
  `New Sets: ${meta.recentChanges.newReleases.join(', ')}` : ''}

Note: Consider these current meta trends when making recommendations.
`;
}
```

## Phase 4: Background Jobs

### 1. Tournament Sync Job
```typescript
// Run daily at 6 AM UTC
async syncTournamentData() {
  const scraper = new LimitlessTCGScraper();
  const results = await scraper.scrapeRecentTournaments(7); // Last 7 days
  
  for (const tournament of results) {
    await prisma.tournamentResult.upsert({
      where: { id: tournament.id },
      update: tournament,
      create: tournament,
    });
  }
  
  // Update meta cards and archetypes
  await this.updateMetaStatistics();
}
```

### 2. New Card Detection
```typescript
async detectNewCards(decklists: Decklist[]) {
  const allCardNames = new Set();
  
  for (const deck of decklists) {
    deck.cards.forEach(c => allCardNames.add(c.name));
  }
  
  const knownCards = await prisma.card.findMany({
    where: { name: { in: Array.from(allCardNames) } },
    select: { name: true }
  });
  
  const knownNames = new Set(knownCards.map(c => c.name));
  const newCards = Array.from(allCardNames).filter(n => !knownNames.has(n));
  
  if (newCards.length > 0) {
    console.log('New cards detected:', newCards);
    // Flag for manual review or auto-fetch from API
  }
}
```

## Phase 5: Caching Strategy

### Cache Layers
1. **Meta Context**: 24 hours
2. **Tournament Results**: 7 days
3. **Card Trends**: 6 hours
4. **Analysis Results**: 1 hour (with meta version key)

### Cache Invalidation
- On new tournament data import
- On manual meta update
- Weekly full refresh

## Implementation Order
1. Create database migrations
2. Build meta context service
3. Update AI analyzer to use meta context
4. Create sync job for tournaments
5. Add monitoring and alerts
6. Test with recent tournaments

## Success Metrics
- AI mentions current meta decks
- Recommendations include post-Dec 2024 cards
- Analysis reflects recent tournament trends
- No increase in analysis latency (< 100ms added)