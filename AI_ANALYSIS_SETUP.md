# AI Analysis Setup Guide

## Overview
The AI Deck Analysis system uses Redis and BullMQ to process analyses in the background, preventing timeouts for long-running GPT-4 analyses.

## Prerequisites
1. Redis instance (Upstash via Vercel KV is already configured)
2. OpenAI API key (already in .env.local)
3. Node.js and npm

## Setup Steps

### 1. Verify Redis Connection
```bash
npm run test:redis
```

You should see:
- ✅ Connected to Redis successfully
- ✅ Using Upstash Redis

### 2. Start the AI Analysis Worker

**Option A: Run in a separate terminal (Recommended)**
```bash
npm run worker:ai
```

This starts a dedicated worker that processes AI analysis jobs. Keep this terminal running while using the app.

**Option B: Run all workers**
```bash
npm run worker:all
```

This starts all background job workers including AI analysis.

### 3. Start the Development Server
In another terminal:
```bash
npm run dev
```

### 4. Use AI Analysis
1. Navigate to a deck's analyze page
2. Select "AI Expert Analysis"
3. Configure options and click "Start AI Analysis"
4. The analysis will be queued and processed by the worker
5. Results appear automatically when complete

## How It Works

1. **User Request**: When you start an analysis, it creates a job in Redis
2. **Worker Processing**: The worker picks up the job and calls OpenAI
3. **Status Updates**: The UI polls for status updates every 2 seconds
4. **Result Display**: Once complete, results are saved and displayed

## Troubleshooting

### Analysis Stuck on "Queued"
- Make sure the worker is running (`npm run worker:ai`)
- Check worker terminal for error messages
- Verify Redis connection with `npm run test:redis`

### Worker Won't Start
- Check Redis URL in .env.local
- Ensure all dependencies are installed: `npm install`
- Try the Redis test script first

### Analysis Fails
- Check OpenAI API key is set correctly
- Look at worker terminal for specific error messages
- Verify the deck has cards in it

## Development vs Production

**Development**: 
- Run worker manually with `npm run worker:ai`
- Uses Upstash Redis from Vercel KV

**Production (Vercel)**:
- Worker needs to be deployed separately or use Vercel Functions
- Same Redis instance works in production
- Consider using QStash for serverless job processing

## Monitoring

View analysis history at: `/analysis/history`

Check Redis queue status in worker terminal output.

## Architecture

```
User → API Route → Redis Queue → Worker → OpenAI → Database → UI
         ↓                                              ↑
         └──────────── Status Polling ─────────────────┘
```

## Common Issues & Solutions

1. **"Redis not configured"**
   - Ensure REDIS_URL or KV_URL is in .env.local
   - Run `npm run test:redis` to verify

2. **Analysis never completes**
   - Worker isn't running - start with `npm run worker:ai`
   - OpenAI API key missing or invalid
   - Check worker terminal for errors

3. **Page refresh loses progress**
   - The system now handles this - it will resume checking
   - Check `/analysis/history` to see all analyses

4. **Timeout errors**
   - This system prevents timeouts by using background processing
   - If you still see timeouts, the worker might not be running