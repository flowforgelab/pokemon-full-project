# 🚀 Deploy to Your Existing Vercel Project

Since you already have the Vercel project set up, here's how to deploy:

## Option 1: Deploy from Vercel Dashboard (Easiest)

1. Go to https://vercel.com/one-man-band/pokemon-full-project
2. Your project should automatically detect the new commits from GitHub
3. Click "Redeploy" or wait for automatic deployment

## Option 2: Deploy from CLI

1. First login to Vercel:
```bash
vercel login
```

2. Link to your existing project:
```bash
vercel link
```
- Choose "Link to existing project"
- Select "one-man-band" scope
- Select "pokemon-full-project"

3. Deploy to production:
```bash
vercel --prod
```

## 📝 Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

```
DATABASE_URL=postgres://neondb_owner:npg_hPc8etZLHy3E@ep-withered-shape-a4y0xvbt-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2VudHJhbC1iZW5nYWwtMTYuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_DdQK7vp4wt2FzpjQeNh0YCew8GknCRxUPhzvcIWDOl

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

POKEMON_TCG_API_KEY=254305f1-3dfe-4e05-879f-014f5c215396

KV_REST_API_URL=https://amused-rattler-51576.upstash.io
KV_REST_API_TOKEN=Acl4AAIjcDE5NGQ3MzVkYTQyZmM0MjYzOGUyMGI1MDU1MWNmYTUyMHAxMA

NEXT_PUBLIC_APP_URL=https://pokemon-full-project.vercel.app
```

## 🗄️ Database Migration

After deployment, run:
```bash
npx dotenv -e .env.local -- prisma db push
```

## ✅ All Done!

Your app should be live at: https://pokemon-full-project.vercel.app