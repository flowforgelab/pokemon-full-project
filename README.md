# Pokemon TCG Deck Builder

A comprehensive Next.js 14 application for building, analyzing, and managing Pokemon Trading Card Game decks.

## Features

- **Deck Building**: Create and manage multiple decks with different formats (Standard, Expanded, Unlimited, GLC)
- **Card Database**: Search and browse Pokemon cards with advanced filtering
- **Collection Management**: Track your card collection with conditions and trade status
- **Trading System**: Create and manage trade offers with other users
- **Authentication**: Secure user authentication with Clerk
- **Real-time Updates**: Built with tRPC for type-safe API calls
- **Responsive Design**: Tailwind CSS with custom Pokemon TCG theme

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Authentication**: Clerk
- **Database**: PostgreSQL with Prisma ORM
- **API**: tRPC for type-safe APIs
- **Styling**: Tailwind CSS
- **State Management**: React Query
- **Job Queue**: Bull/BullMQ with Redis

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Redis server
- Clerk account for authentication
- Pokemon TCG API key (optional)
- TCGPlayer API keys (optional)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
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

Edit `.env.local` with your actual credentials:
- Database connection string
- Clerk authentication keys
- API keys for Pokemon TCG and TCGPlayer (if available)
- Redis connection URL

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── ui/                # Base UI components
│   ├── cards/             # Card-related components
│   ├── decks/             # Deck-related components
│   └── layout/            # Layout components
├── lib/                   # Utility functions
│   ├── auth/              # Authentication utilities
│   ├── db/                # Database utilities
│   ├── api/               # External API clients
│   ├── algorithms/        # Deck analysis algorithms
│   └── utils/             # General utilities
├── server/                # Backend code
│   ├── routers/           # tRPC API routes
│   └── middleware/        # Server middleware
├── types/                 # TypeScript type definitions
├── hooks/                 # Custom React hooks
└── prisma/                # Database schema
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler check
- `npx prisma studio` - Open Prisma Studio for database management
- `npx prisma generate` - Generate Prisma client
- `npx prisma db push` - Push schema changes to database

## API Routes

The application uses tRPC for type-safe API calls. Main routers include:

- **User Router**: User profile management
- **Card Router**: Card search and retrieval
- **Deck Router**: Deck CRUD operations
- **Collection Router**: Collection management
- **Trade Router**: Trading system operations

## Authentication

Authentication is handled by Clerk. Protected routes require authentication and will redirect to sign-in page if not authenticated.

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key models include:

- **User**: User profiles linked to Clerk authentication
- **Card**: Pokemon card data
- **Deck**: User-created decks
- **Collection**: User card collections
- **TradeOffer**: Trade offers between users

## Deployment

The application can be deployed to any platform that supports Next.js:

1. Set up production environment variables
2. Build the application: `npm run build`
3. Set up PostgreSQL and Redis in production
4. Run database migrations: `npx prisma migrate deploy`
5. Start the application: `npm start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.
