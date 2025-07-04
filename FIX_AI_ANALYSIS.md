# Fix AI Analysis - Action Plan

## The Issue
The AI analysis is stuck because BullMQ requires both the API (Vercel) and Worker (Railway) to use the same direct Redis connection with SSL support.

## Solution Steps

### 1. Verify Redis URL in Vercel

Go to your Vercel project dashboard:
1. Settings → Environment Variables
2. **Make sure you have REDIS_URL set** (not just KV_URL)
3. The value should start with `rediss://` (with double 's' for SSL)

If REDIS_URL is missing:
- Copy the value from your local `.env.local` 
- Add it as a new environment variable in Vercel
- Redeploy your Vercel app

### 2. Update Railway Environment Variables

In Railway, verify these are set:
- `REDIS_URL` - Same value as in Vercel (rediss://...)
- `DATABASE_URL` - Your PostgreSQL connection
- `KV_REST_API_TOKEN` - For auth fallback
- `OPENAI_API_KEY` - Your OpenAI key

### 3. Deploy the SSL Fix

The code has been updated to support SSL Redis connections:

```bash
git add .
git commit -m "Fix Redis SSL connection for BullMQ

- Add TLS support for rediss:// URLs in queue.ts
- Add TLS support in ai-analysis-worker.ts
- Add debug scripts for troubleshooting"
git push
```

### 4. Wait for Deployments
- Vercel will auto-deploy
- Railway will auto-deploy
- Wait for both to complete

### 5. Test the Connection

Run locally to verify your Redis setup:
```bash
npm run test:redis
```

### 6. Test AI Analysis Again

1. Go to your Vercel app
2. Navigate to a deck analysis page
3. Start an AI analysis
4. Check Railway logs - you should now see activity

## What Changed

1. **SSL Support**: Added `tls: {}` to connection config for `rediss://` URLs
2. **Consistent URLs**: Both Vercel and Railway now use the same Redis connection
3. **Debug Tools**: Added scripts to help troubleshoot connection issues

## Troubleshooting

If it's still not working:

1. **Check Vercel Logs**:
   - Functions tab → Check for Redis connection errors
   - Make sure jobs are being created

2. **Check Railway Logs**:
   - Should show "Waiting for jobs..."
   - No connection errors

3. **Run Debug Script**:
   ```bash
   npx dotenv -e .env.local -- npx tsx src/scripts/test-queue-connection.ts
   ```

4. **Common Issues**:
   - Missing REDIS_URL in Vercel (most common)
   - Firewall blocking Redis connection
   - Wrong Redis URL format

## Expected Flow

1. User starts analysis → Job created in Redis
2. Railway worker sees job → Processes with OpenAI
3. Results saved to database → UI shows results

The key fix is ensuring both environments use the same SSL Redis connection!