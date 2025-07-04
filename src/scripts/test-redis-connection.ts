import { createClient } from 'redis';
import Bull from 'bull';
import { Queue } from 'bullmq';

async function testRedisConnection() {
  console.log('Testing Redis connections...\n');

  // Test 1: Direct Redis connection using redis package
  console.log('1. Testing direct Redis connection...');
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  
  if (!redisUrl) {
    console.error('❌ No Redis URL found in environment variables');
    return;
  }

  console.log(`   Using URL: ${redisUrl.substring(0, 30)}...`);

  try {
    const client = createClient({
      url: redisUrl
    });

    client.on('error', (err) => console.error('Redis Client Error:', err));
    
    await client.connect();
    console.log('✅ Connected to Redis successfully');
    
    // Test basic operations
    await client.set('test:key', 'Hello Redis!');
    const value = await client.get('test:key');
    console.log(`✅ Set/Get test passed: ${value}`);
    
    await client.del('test:key');
    await client.disconnect();
  } catch (error) {
    console.error('❌ Direct Redis connection failed:', error);
  }

  // Test 2: Bull (legacy) connection
  console.log('\n2. Testing Bull (legacy) connection...');
  try {
    const queue = new Bull('test-queue', redisUrl);
    
    // Add a test job
    const job = await queue.add('test', { message: 'Hello Bull!' });
    console.log(`✅ Bull queue created, job added with ID: ${job.id}`);
    
    // Clean up
    await queue.close();
  } catch (error) {
    console.error('❌ Bull connection failed:', error);
  }

  // Test 3: BullMQ connection
  console.log('\n3. Testing BullMQ connection...');
  try {
    const url = new URL(redisUrl);
    const connection = {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || process.env.KV_REST_API_TOKEN,
      username: url.username || undefined,
    };

    console.log('   Connection config:', {
      host: connection.host,
      port: connection.port,
      hasPassword: !!connection.password,
      hasUsername: !!connection.username
    });

    const queue = new Queue('test-queue-mq', { connection });
    
    // Add a test job
    const job = await queue.add('test', { message: 'Hello BullMQ!' });
    console.log(`✅ BullMQ queue created, job added with ID: ${job.id}`);
    
    // Get queue info
    const waiting = await queue.getWaitingCount();
    console.log(`   Jobs waiting: ${waiting}`);
    
    // Clean up
    await queue.close();
  } catch (error) {
    console.error('❌ BullMQ connection failed:', error);
  }

  // Test 4: Check if we're using Upstash (REST API)
  console.log('\n4. Checking Redis provider...');
  if (redisUrl.includes('upstash.io')) {
    console.log('✅ Using Upstash Redis (supports REST API and Redis protocol)');
    console.log('   Note: BullMQ requires Redis protocol, not REST API');
  } else {
    console.log('   Using standard Redis instance');
  }

  console.log('\nTest complete!');
}

// Run the test
testRedisConnection().catch(console.error);