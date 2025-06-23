#!/bin/bash

echo "🚀 Pokemon TCG Deck Builder - Deployment Script"
echo "=============================================="
echo ""

# Step 1: Login to Vercel (if needed)
echo "Step 1: Checking Vercel login..."
vercel whoami > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❗ You need to login to Vercel first"
    echo "Run: vercel login"
    echo "Then run this script again"
    exit 1
fi
echo "✅ Logged in to Vercel"

# Step 2: Deploy to Vercel
echo ""
echo "Step 2: Deploying to Vercel..."
echo "This will:"
echo "- Create a new project if needed"
echo "- Upload your code"
echo "- Build and deploy your app"
echo ""

# Deploy with production flag
vercel --prod

# Step 3: Set environment variables
echo ""
echo "Step 3: Setting environment variables..."
echo "Note: You'll need to add these in Vercel Dashboard:"
echo ""
echo "Required environment variables:"
echo "- DATABASE_URL (copy from .env.local)"
echo "- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
echo "- CLERK_SECRET_KEY"
echo "- KV_REST_API_URL"
echo "- KV_REST_API_TOKEN"
echo "- POKEMON_TCG_API_KEY"
echo ""
echo "To add them:"
echo "1. Go to your Vercel Dashboard"
echo "2. Select your project"
echo "3. Go to Settings → Environment Variables"
echo "4. Add each variable"
echo ""

# Step 4: Database setup
echo "Step 4: After deployment, run database migrations:"
echo "npx dotenv -e .env.local -- prisma db push"
echo ""

echo "🎉 Deployment script complete!"
echo "Your app should be live soon at the URL provided by Vercel!"