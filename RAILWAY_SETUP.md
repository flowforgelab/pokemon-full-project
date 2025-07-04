# Railway Setup for AI Analysis Worker

This guide will help you deploy the AI analysis worker to Railway to process background jobs for your Pokemon TCG Deck Builder.

## Prerequisites
- Railway account (sign up at https://railway.app)
- GitHub account connected to Railway
- Your existing Vercel KV/Upstash Redis instance

## Step 1: Prepare Your Repository

1. The `railway.json` file has been created with the correct configuration
2. Commit and push these changes:
   ```bash
   git add railway.json RAILWAY_SETUP.md
   git commit -m "Add Railway configuration for AI worker"
   git push
   ```

## Step 2: Create Railway Project

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your `pokemon-tcg-deck-builder` repository
4. Railway will detect the `railway.json` configuration

## Step 3: Configure Environment Variables

In Railway dashboard, add these environment variables:

```env
# Required - Copy these from your Vercel project
DATABASE_URL=your_neon_postgres_url
REDIS_URL=your_upstash_redis_url
KV_REST_API_TOKEN=your_kv_token
OPENAI_API_KEY=your_openai_key

# Optional but recommended
NODE_ENV=production
```

**To get these values:**
1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Copy the values for each variable

## Step 4: Deploy

1. Railway will automatically deploy after you add the environment variables
2. Check the deployment logs to ensure the worker starts successfully
3. You should see:
   ```
   ✅ AI Analysis Worker started successfully
   Waiting for jobs...
   ```

## Step 5: Monitor Your Worker

### Railway Dashboard
- View logs in real-time
- Monitor resource usage (CPU, Memory)
- Set up alerts for failures

### Check Worker Status
In your Railway logs, you'll see:
- `✅ Job [id] completed successfully` - When analyses complete
- `❌ Job [id] failed: [error]` - If something goes wrong

## Step 6: Test the Integration

1. Go to your Vercel app
2. Navigate to a deck analysis page
3. Start an AI analysis
4. Check Railway logs - you should see the job being processed
5. The analysis should complete and show results

## Troubleshooting

### Worker Won't Start
- Check environment variables are set correctly
- Ensure `REDIS_URL` is the full Redis URL, not the REST API URL
- Check logs for specific error messages

### Jobs Not Processing
- Verify the worker is running (check Railway logs)
- Ensure both apps use the same Redis instance
- Check that `OPENAI_API_KEY` is valid

### Connection Issues
If you see Redis connection errors:
1. Make sure you're using the correct Redis URL format
2. Upstash provides both REST and direct Redis URLs - use the direct one
3. The URL should look like: `redis://default:password@host:port`

## Cost Estimation

Railway pricing (as of 2024):
- **Free tier**: $5 credit/month (usually enough for a worker)
- **Usage-based**: ~$0.01/hour for a small worker
- **Estimated cost**: $5-10/month for continuous operation

## Alternative: Run Worker Only When Needed

To save costs, you can:
1. Scale down to 0 when not in use
2. Use Railway's cron schedule to run periodically
3. Manually start/stop via Railway dashboard

## Monitoring and Alerts

Set up alerts in Railway:
1. Go to your service settings
2. Configure alerts for:
   - Deployment failures
   - High memory usage
   - Restarts

## Next Steps

After deployment:
1. Monitor the first few analyses to ensure stability
2. Set up error notifications (optional)
3. Consider adding a health check endpoint
4. Add the Railway deployment URL to your documentation

## Support

- Railway Discord: https://discord.gg/railway
- Railway Docs: https://docs.railway.app
- Your app logs: Check Railway dashboard for real-time logs