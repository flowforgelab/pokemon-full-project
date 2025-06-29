# Pokemon TCG Deck Builder

A comprehensive Next.js 14 application for building, analyzing, and managing Pokemon Trading Card Game decks with AI-powered recommendations.

## 🌟 Features

### Core Features
- **Deck Building**: Create and manage multiple decks with different formats (Standard, Expanded, Unlimited, GLC)
- **Card Database**: Search and browse Pokemon cards with advanced filtering
- **Collection Management**: Track your card collection with conditions and trade status
- **Trading System**: Create and manage trade offers with other users
- **Authentication**: Secure user authentication with Clerk
- **Real-time Updates**: Built with tRPC for type-safe API calls
- **Responsive Design**: Tailwind CSS with custom Pokemon TCG theme

### 🎮 Advanced Deck Builder Interface
- **Intuitive Card Search**: Real-time search with instant results and smart filtering
- **Drag-and-Drop**: Smooth drag-and-drop with multi-select and touch support
- **Live Validation**: Real-time deck validation with format legality checking
- **Visual Statistics**: Interactive charts for energy curves and type distribution
- **Deck Testing**: Simulate opening hands with probability calculations
- **Smart Suggestions**: AI-powered card recommendations based on deck composition
- **Collaboration**: Share decks with version history and commenting
- **Import/Export**: Support for text, JSON, and PTCGO formats
- **Mobile Optimized**: Touch gestures and responsive design for all devices
- **Accessibility**: Full keyboard navigation and screen reader support

### 🧠 AI-Powered Deck Analysis Engine
- **Consistency Calculator**: Energy ratios, mulligan probability, and setup analysis
- **Synergy Analyzer**: Card interaction detection and combo identification
- **Meta-Game Evaluator**: Matchup predictions and tech card recommendations
- **Speed Analyzer**: Setup efficiency and prize race calculations
- **Archetype Classifier**: ML-inspired classification for 9 deck archetypes
- **Performance Predictor**: Comprehensive scoring system with archetype-specific weights
- **Deck Comparison**: Head-to-head analysis and matchup predictions

### 🤖 AI Recommendation System
- **Smart Deck Building**: Generate complete decks from scratch based on:
  - Preferred archetypes (Aggro, Control, Combo, Midrange, etc.)
  - Budget constraints with upgrade paths
  - Owned card collection
  - Meta-game position
- **Deck Optimization**: Intelligent card replacements for existing decks
- **Collection Insights**: 
  - Find "almost complete" decks in your collection
  - Generate want lists with priority scoring
  - Trade suggestions for collection optimization
- **Budget Management**:
  - Build within price constraints
  - Identify hidden value cards
  - Create budget variants of expensive decks
- **Personalized Recommendations**: Learn from user feedback and preferences

### 📚 Advanced Collection Management
- **Smart Search & Organization**:
  - Full-text search with fuzzy matching
  - Multi-criteria filtering with boolean operators
  - Custom tags and folders for organization
  - Storage location tracking
  - Personal notes and ratings for cards
- **Collection Analytics**:
  - Real-time collection value tracking
  - Set completion percentage with missing cards
  - Spending and acquisition timeline
  - ROI and performance metrics
  - AI-powered collection insights
- **Quick Collection Entry**:
  - Bulk import from CSV, JSON, TCGDB
  - Barcode scanning support (future)
  - Set-based checklist entry
  - Recently released cards quick-add
  - Voice input support (future)
- **Want List & Trading**:
  - Priority-based want list (1-10 scale)
  - Price alerts for wanted cards
  - Trading partner matching
  - Fair trade validation
  - Want list sharing with friends
- **Value Management**:
  - Historical price tracking
  - Insurance documentation generation
  - Portfolio performance analysis
  - Price trend predictions
  - Trading opportunity alerts

### 📊 Data Integration
- **Pokemon TCG API**: Full card database with advanced search
- **Pricing Data**: Currently unavailable (TCGPlayer integration removed)
- **Background Jobs**: Automated price updates and data synchronization
- **Caching System**: Multi-level caching for optimal performance
- **Rate Limiting**: Intelligent API request management

## 🛠️ Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Authentication**: Clerk
- **Database**: PostgreSQL with Prisma ORM (Neon)
- **API**: tRPC for type-safe APIs
- **Caching**: Redis (Vercel KV/Upstash)
- **Job Queue**: Bull/BullMQ
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Redis server
- Clerk account for authentication
- Pokemon TCG API key (optional, for higher rate limits)

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/flowforgelab/pokemon-full-project.git
cd pokemon-tcg-deck-builder
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
# Database
DATABASE_URL="postgresql://..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# Redis (Vercel KV)
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."

# External APIs (optional)
POKEMON_TCG_API_KEY="..."
# TCGPlayer API removed - pricing features currently unavailable
```

4. Set up the database:
```bash
npx prisma generate
npx dotenv -e .env.local -- prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   └── api/               # API routes
│       ├── analysis/      # Deck analysis endpoints
│       └── recommendations/ # AI recommendation endpoints
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── cards/            # Card-related components
│   ├── decks/            # Deck-related components
│   └── layout/           # Layout components
├── lib/                   # Core functionality
│   ├── auth/             # Authentication utilities
│   ├── db/               # Database utilities
│   ├── api/              # External API clients
│   │   ├── pokemon-tcg-client.ts
│   │   ├── rate-limiter.ts
│   │   └── cache.ts
│   ├── analysis/         # Deck analysis engine
│   │   ├── deck-analyzer.ts
│   │   ├── consistency-calculator.ts
│   │   ├── synergy-analyzer.ts
│   │   └── archetype-classifier.ts
│   ├── recommendations/  # AI recommendation system
│   │   ├── recommendation-engine.ts
│   │   ├── archetype-generator.ts
│   │   ├── budget-builder.ts
│   │   └── collection-builder.ts
│   ├── jobs/            # Background job processors
│   └── utils/           # General utilities
├── server/              # Backend code
│   ├── routers/         # tRPC API routes
│   └── middleware/      # Server middleware
├── types/               # TypeScript type definitions
├── hooks/               # Custom React hooks
└── prisma/              # Database schema
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler check
- `npm run format` - Format code with Prettier
- `npx prisma studio` - Open Prisma Studio for database management
- `npx prisma generate` - Generate Prisma client
- `npx prisma db push` - Push schema changes to database

## 🌐 API Endpoints

### Analysis Endpoints
- `GET /api/analysis/:deckId` - Analyze a single deck
- `POST /api/analysis/compare` - Compare two decks

### Recommendation Endpoints
- `GET /api/recommendations/personalized` - Get personalized recommendations
- `POST /api/recommendations/optimize` - Optimize an existing deck
- `POST /api/recommendations/build` - Build deck from scratch
- `POST /api/recommendations/collection` - Collection-based recommendations
- `POST /api/recommendations/feedback` - Submit recommendation feedback

### Deck Builder Endpoints
- `POST /api/deck-builder/create` - Create new deck
- `GET /api/deck-builder/:deckId` - Load deck composition
- `PUT /api/deck-builder/:deckId` - Save deck changes
- `DELETE /api/deck-builder/:deckId` - Delete deck
- `GET /api/deck-builder/:deckId/analyze` - Get deck statistics
- `POST /api/deck-builder/:deckId/test` - Test deck hands
- `GET /api/deck-builder/:deckId/suggestions` - Get smart suggestions
- `POST /api/deck-builder/:deckId/export` - Export deck
- `POST /api/deck-builder/import` - Import deck from text/JSON
- `POST /api/deck-builder/search` - Search cards with filters
- `GET /api/deck-builder/search/popular` - Get popular cards

### System Endpoints
- `GET /api/health` - System health check
- `GET /api/metrics` - Performance metrics

## 🔐 Authentication

Authentication is handled by Clerk. Protected routes require authentication and will redirect to sign-in page if not authenticated.

## 💾 Database Schema

The application uses PostgreSQL with Prisma ORM. Key models include:

- **User**: User profiles with preferences and subscription tiers
- **Card**: Complete Pokemon card data with all TCG attributes
- **Deck**: User-created decks with analysis results
- **Collection**: User card collections with conditions
- **TradeOffer**: Trade offers between users
- **CardPrice**: Current and historical pricing data
- **Format**: Game formats and rotation tracking
- **Matchup**: Win/loss tracking for deck matchups

## 🚢 Deployment

The application is optimized for Vercel deployment:

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy!

For other platforms:
1. Set up production environment variables
2. Build: `npm run build`
3. Set up PostgreSQL and Redis
4. Run migrations: `npx prisma migrate deploy`
5. Start: `npm start`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit with descriptive message
6. Push to your branch
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Pokemon TCG API for card data
- The Pokemon TCG community for inspiration

---

**Current Version**: v0.8.0

Built with ❤️ by the Pokemon TCG community# Trigger deployment
