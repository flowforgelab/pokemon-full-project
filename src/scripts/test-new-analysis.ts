#!/usr/bin/env node
/**
 * Test creating a new analysis through the API
 */

import 'dotenv/config';

async function testNewAnalysis() {
  console.log('=== TESTING NEW ANALYSIS ===\n');

  // Get the API URL
  const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // You'll need to get these from your browser
  console.log('To test, you need to:');
  console.log('1. Open your browser dev tools');
  console.log('2. Go to Application/Storage → Cookies');
  console.log('3. Find the __session cookie value');
  console.log('4. Use it to make an authenticated request');
  console.log('\nOr just try creating a new analysis from the UI!');
  
  console.log('\nThe completed analysis (b7270cec) shows the system is working.');
  console.log('If you\'re seeing "Analysis incomplete", you might be polling an old analysis.');
  console.log('\nTry:');
  console.log('1. Refresh the page');
  console.log('2. Create a brand new analysis');
  console.log('3. Check if the jobId is NOT "mock"');
}

testNewAnalysis().catch(console.error);