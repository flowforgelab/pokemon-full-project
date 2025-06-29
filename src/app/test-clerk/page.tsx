'use client';

import { useAuth, useClerk, SignIn } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export default function TestClerkPage() {
  const { isLoaded, userId, sessionId } = useAuth();
  const clerk = useClerk();
  const [clerkStatus, setClerkStatus] = useState<string>('Checking...');
  const [envVars, setEnvVars] = useState<Record<string, string>>({});

  useEffect(() => {
    // Check Clerk status
    if (!isLoaded) {
      setClerkStatus('Clerk is loading...');
    } else if (userId) {
      setClerkStatus(`Clerk loaded - User ID: ${userId}`);
    } else {
      setClerkStatus('Clerk loaded - No user signed in');
    }

    // Check environment variables
    const vars = {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'NOT SET',
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || 'NOT SET',
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || 'NOT SET',
    };
    setEnvVars(vars);

    // Log to console
    console.log('Clerk Test Page - Status:', {
      isLoaded,
      userId,
      sessionId,
      clerk: clerk ? 'Clerk instance exists' : 'No Clerk instance',
      envVars: vars
    });
  }, [isLoaded, userId, sessionId, clerk]);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Clerk Test Page</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Clerk Status</h2>
          <p className="text-gray-700">{clerkStatus}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
          <pre className="text-sm bg-gray-100 p-4 rounded overflow-x-auto">
            {JSON.stringify(envVars, null, 2)}
          </pre>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Clerk Instance</h2>
          <p className="text-gray-700">
            {clerk ? 'Clerk instance is available' : 'Clerk instance is NOT available'}
          </p>
          {clerk && (
            <div className="mt-2 text-sm text-gray-600">
              <p>Version: {clerk.version || 'Unknown'}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Sign In Component Test</h2>
          <p className="text-gray-600 mb-4">
            If Clerk is properly configured, you should see a sign-in form below:
          </p>
          <div className="border-2 border-dashed border-gray-300 p-4 rounded">
            <SignIn />
          </div>
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="text-blue-600 hover:underline">Back to Home</a>
        </div>
      </div>
    </div>
  );
}