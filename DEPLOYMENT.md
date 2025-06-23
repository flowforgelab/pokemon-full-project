# Deployment Guide for Pokemon TCG Deck Builder

This guide will walk you through deploying the Pokemon TCG Deck Builder to Vercel.

## Prerequisites

Before deploying, you'll need:

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Account**: Your code should be in a GitHub repository
3. **Neon PostgreSQL Database**: Sign up at [neon.tech](https://neon.tech)
4. **Clerk Authentication**: Sign up at [clerk.com](https://clerk.com)
5. **Vercel KV (Redis)**: Available in your Vercel dashboard
6. **Pokemon TCG API Key** (Optional): Get from [pokemontcg.io](https://pokemontcg.io)

## Step 1: Database Setup (Neon PostgreSQL)

1. Create a new project in Neon
2. Copy your connection string (it looks like: `postgresql://user:password@host/database?sslmode=require`)
3. Save this as your `DATABASE_URL`

## Step 2: Authentication Setup (Clerk)

1. Create a new application in Clerk
2. Choose your authentication methods (recommended: Email, Google, Discord)
3. Copy your keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
4. Set your URLs:
   ```
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
   ```

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure your project:
   - Framework Preset: Next.js
   - Root Directory: `./` (or your project directory)
   - Build Command: `npm run build`
   - Output Directory: `.next`

### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

## Step 4: Environment Variables

In your Vercel project settings, add these environment variables:

### Required Variables:

```env
# Database
DATABASE_URL="your-neon-postgresql-url"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"

# App URL (your Vercel domain)
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
```

### Setting up Vercel KV (Redis):

1. In your Vercel dashboard, go to the Storage tab
2. Create a new KV store
3. Copy the environment variables it provides:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
4. Add these to your project

### Optional: Pokemon TCG API Key

```env
# For higher rate limits (20,000 requests/day instead of 1,000)
POKEMON_TCG_API_KEY="your-api-key"
```

## Step 5: Initialize Database

After deployment, run the database migrations:

1. Install Vercel CLI if you haven't: `npm i -g vercel`
2. Link to your project: `vercel link`
3. Pull environment variables: `vercel env pull .env.local`
4. Run migrations:
   ```bash
   npx dotenv -e .env.local -- prisma db push
   ```

## Step 6: Import Pokemon Card Data

Once your app is deployed:

1. Visit your app at `https://your-app.vercel.app`
2. Sign in with an admin account
3. Navigate to the admin panel (you'll need to manually set your user role to 'admin' in the database)
4. Use the import functions to load Pokemon sets and cards

### Importing via API:

You can also trigger imports via API calls:

```bash
# Import a specific set
curl -X POST https://your-app.vercel.app/api/cards/import \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"setCode": "base1"}'

# Sync recent cards
curl -X POST https://your-app.vercel.app/api/cards/sync \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scope": "recent"}'
```

## Step 7: Configure Cron Jobs (Optional)

The app includes cron jobs for automated updates. These are configured in `vercel.json`:

- Daily card sync: 3 AM UTC
- Monthly cleanup: 4 AM UTC on the 1st

These will run automatically once deployed.

## Monitoring & Logs

- **Logs**: Available in your Vercel dashboard under the Functions tab
- **Database**: Monitor via your Neon dashboard
- **Redis**: Monitor via Vercel KV dashboard
- **API Usage**: Track Pokemon TCG API usage at pokemontcg.io

## Troubleshooting

### Build Errors

1. Check all environment variables are set correctly
2. Ensure `prisma generate` runs during build (it's in the build script)
3. Check logs in Vercel dashboard

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Ensure SSL mode is set: `?sslmode=require`
3. Check Neon dashboard for connection limits

### Authentication Issues

1. Verify Clerk keys are correct
2. Check redirect URLs match your domain
3. Ensure middleware.ts is properly configured

### Redis/KV Issues

1. Verify KV store is created in Vercel
2. Check environment variables are set
3. Monitor usage in Vercel dashboard

## Production Checklist

- [ ] All environment variables set
- [ ] Database migrations completed
- [ ] At least one admin user created
- [ ] Pokemon card data imported
- [ ] Authentication tested
- [ ] Redis/KV working
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active

## Performance Tips

1. **Pokemon TCG API Key**: Use it for 20x more API calls
2. **Edge Functions**: Deployed automatically to Vercel Edge Network
3. **Caching**: Redis caching is automatic with Vercel KV
4. **Images**: Pokemon card images are automatically optimized

## Support

- **Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **Neon**: [neon.tech/docs](https://neon.tech/docs)
- **Clerk**: [clerk.com/docs](https://clerk.com/docs)
- **Pokemon TCG API**: [docs.pokemontcg.io](https://docs.pokemontcg.io)