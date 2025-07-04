# Redis Setup Guide for Pokemon TCG Deck Builder

This guide provides comprehensive instructions for setting up Redis to enable background job processing for the Pokemon TCG Deck Builder application.

## Table of Contents
- [Overview](#overview)
- [Local Development Setup](#local-development-setup)
- [Cloud Redis Options](#cloud-redis-options)
- [Environment Configuration](#environment-configuration)
- [Testing Your Setup](#testing-your-setup)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

## Overview

The Pokemon TCG Deck Builder uses Redis with BullMQ for:
- AI deck analysis job processing
- Price update scheduling
- Card data synchronization
- Background report generation
- Collection indexing

## Local Development Setup

### Option 1: Docker (Recommended)

1. **Using Docker Compose** (Easiest):
   ```bash
   # Start Redis and Redis Commander
   docker-compose up -d
   
   # Verify Redis is running
   docker-compose ps
   ```

2. **Using Docker directly**:
   ```bash
   docker run -d \
     --name pokemon-redis \
     -p 6379:6379 \
     redis:7-alpine
   ```

3. **Access Redis Commander** (optional GUI):
   - Open http://localhost:8081 in your browser
   - View and manage your Redis data visually

### Option 2: Homebrew (macOS)

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### Option 3: Direct Installation

Follow the official Redis installation guide:
- Ubuntu/Debian: `sudo apt-get install redis-server`
- Windows: Use WSL2 or Redis Windows port
- Other: https://redis.io/docs/getting-started/

## Cloud Redis Options

### Option 1: Upstash Redis (Recommended for Vercel)

1. **Create Account**: https://upstash.com
2. **Create Database**:
   - Choose region closest to your deployment
   - Enable "Eviction" for automatic memory management
   - Copy the "Redis URL" (not REST API URL)

3. **Connection String Format**:
   ```
   redis://default:YOUR_PASSWORD@YOUR_ENDPOINT.upstash.io:PORT
   ```

### Option 2: Redis Cloud

1. **Sign up**: https://redis.com/try-free/
2. **Create Database**:
   - Free tier: 30MB storage
   - Choose cloud provider and region
   - Copy connection details

### Option 3: Vercel KV (Limited Support)

**Important**: Vercel KV uses Upstash's REST API, which is **not directly compatible** with BullMQ. You need a standard Redis connection.

If you're using Vercel KV:
1. Get the Upstash Redis URL (not the KV REST API URL)
2. Or use a different Redis provider for BullMQ jobs

## Environment Configuration

1. **Copy the example environment file**:
   ```bash
   cp .env.local.example .env.local
   ```

2. **Configure Redis URL**:
   ```env
   # For local development
   REDIS_URL=redis://localhost:6379
   
   # For Upstash
   REDIS_URL=redis://default:YOUR_PASSWORD@YOUR_ENDPOINT.upstash.io:PORT
   
   # For Redis Cloud
   REDIS_URL=redis://default:YOUR_PASSWORD@YOUR_ENDPOINT.redis.com:PORT
   ```

3. **Additional Required Variables**:
   ```env
   # For AI Analysis
   OPENAI_API_KEY=sk-...
   
   # Your database
   DATABASE_URL=postgresql://...
   
   # Clerk authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

## Testing Your Setup

### 1. Test Redis Connection

```bash
npm run redis:test
```

This will:
- Check environment variables
- Test ioredis connection (used by BullMQ)
- Test basic Redis operations
- Verify Upstash REST API (if configured)

### 2. Test AI Analysis Job

```bash
npm run test:ai-job
```

This will:
- Create a test deck
- Submit an AI analysis job
- Monitor job progress
- Display results

### 3. Check Redis Health

Visit: http://localhost:3000/api/health/redis

### 4. Monitor Job Queues

Visit: http://localhost:3000/admin/jobs

## Troubleshooting

### Common Issues

1. **"Redis not configured" error**:
   - Ensure `REDIS_URL` is set in `.env.local`
   - Check Redis is running: `docker-compose ps`

2. **"Connection refused" error**:
   - Verify Redis is running on the correct port
   - Check firewall settings
   - Try `redis-cli ping` to test connection

3. **"Authentication failed" error**:
   - Double-check your Redis password
   - Ensure URL encoding for special characters

4. **Vercel KV not working with BullMQ**:
   - Vercel KV REST API is not compatible with BullMQ
   - Use Upstash Redis URL (not REST API URL)
   - Or use a different Redis provider

### Debug Commands

```bash
# Check if Redis is running
redis-cli ping

# Monitor Redis commands in real-time
redis-cli monitor

# Check Redis info
redis-cli info

# Test connection with Node.js
node -e "require('ioredis').createClient().ping().then(() => console.log('Connected!'))"
```

## Production Deployment

### Vercel Deployment

1. **Set Environment Variables**:
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add `REDIS_URL` with your cloud Redis URL
   - Add other required variables

2. **Recommended Providers**:
   - Upstash Redis (best Vercel integration)
   - Redis Cloud (reliable, free tier available)

3. **Important Notes**:
   - Don't use Vercel KV for BullMQ jobs
   - Ensure Redis provider supports persistent connections
   - Consider Redis memory limits for your usage

### Other Platforms

1. **Railway/Render**:
   - Can use their managed Redis addons
   - Or connect to external Redis provider

2. **AWS/GCP/Azure**:
   - Use managed Redis services (ElastiCache, Memorystore, Azure Cache)
   - Or deploy Redis on VM with proper security

## Security Best Practices

1. **Use strong passwords** for Redis authentication
2. **Enable SSL/TLS** for cloud Redis connections
3. **Restrict IP access** in production
4. **Monitor Redis memory usage** to prevent OOM
5. **Set up proper backup** for critical data

## Additional Resources

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/docs/)
- [Upstash Documentation](https://docs.upstash.com/)
- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)

## Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Run the test scripts to diagnose problems
3. Check Redis logs: `docker-compose logs redis`
4. Review the job monitoring dashboard at `/admin/jobs`