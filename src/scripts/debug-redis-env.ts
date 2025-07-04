#!/usr/bin/env node
/**
 * Debug Redis environment variables
 * Run this to check what Redis URLs are available
 */

console.log('=== Redis Environment Debug ===\n');

console.log('Environment Variables:');
console.log('- REDIS_URL:', process.env.REDIS_URL ? '✓ Set' : '✗ Not set');
console.log('- KV_URL:', process.env.KV_URL ? '✓ Set' : '✗ Not set');
console.log('- KV_REST_API_URL:', process.env.KV_REST_API_URL ? '✓ Set' : '✗ Not set');
console.log('- KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? '✓ Set' : '✗ Not set');

console.log('\nURL Analysis:');

if (process.env.REDIS_URL) {
  console.log('\nREDIS_URL:');
  console.log('- Value:', process.env.REDIS_URL.substring(0, 30) + '...');
  console.log('- Starts with redis://:', process.env.REDIS_URL.startsWith('redis://') ? '✓ Yes' : '✗ No');
}

if (process.env.KV_URL) {
  console.log('\nKV_URL:');
  console.log('- Value:', process.env.KV_URL.substring(0, 30) + '...');
  console.log('- Starts with https://:', process.env.KV_URL.startsWith('https://') ? '✓ Yes' : '✗ No');
  console.log('- Starts with redis://:', process.env.KV_URL.startsWith('redis://') ? '✓ Yes' : '✗ No');
}

if (process.env.KV_REST_API_URL) {
  console.log('\nKV_REST_API_URL:');
  console.log('- Value:', process.env.KV_REST_API_URL.substring(0, 30) + '...');
  console.log('- Starts with https://:', process.env.KV_REST_API_URL.startsWith('https://') ? '✓ Yes' : '✗ No');
}

console.log('\n=== What to do ===');
console.log('1. BullMQ requires a direct Redis URL (redis://...)');
console.log('2. REST API URLs (https://...) will NOT work');
console.log('3. Make sure REDIS_URL is set in both Vercel and Railway');
console.log('4. In Vercel KV dashboard, look for the "Redis URL" (not REST URL)');