'use client';

import { useEffect, useState } from 'react';

export default function ClerkDebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  
  useEffect(() => {
    // Collect debug information
    const info = {
      // Environment variables (safe to show publishable key)
      env: {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'NOT SET',
        hasSecretKey: !!process.env.CLERK_SECRET_KEY,
      },
      // Browser info
      browser: {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
        url: typeof window !== 'undefined' ? window.location.href : 'N/A',
        origin: typeof window !== 'undefined' ? window.location.origin : 'N/A',
      },
      // Clerk script
      clerkLoaded: typeof window !== 'undefined' && !!(window as any).Clerk,
    };
    
    setDebugInfo(info);
    
    // Check if Clerk is loaded
    if (typeof window !== 'undefined') {
      const checkClerk = setInterval(() => {
        if ((window as any).Clerk) {
          setDebugInfo(prev => ({ ...prev, clerkLoaded: true }));
          clearInterval(checkClerk);
        }
      }, 100);
      
      // Stop checking after 5 seconds
      setTimeout(() => clearInterval(checkClerk), 5000);
    }
  }, []);
  
  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Clerk Debug Information</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Configuration</h2>
          <pre className="text-sm bg-gray-100 p-4 rounded overflow-x-auto">
            {JSON.stringify(debugInfo.env, null, 2)}
          </pre>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Browser Information</h2>
          <pre className="text-sm bg-gray-100 p-4 rounded overflow-x-auto">
            {JSON.stringify(debugInfo.browser, null, 2)}
          </pre>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Clerk Status</h2>
          <p className={`text-lg ${debugInfo.clerkLoaded ? 'text-green-600' : 'text-red-600'}`}>
            Clerk Script Loaded: {debugInfo.clerkLoaded ? 'Yes' : 'No'}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Troubleshooting Steps</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Check browser console for errors (F12 → Console)</li>
            <li>Verify environment variables are set in Vercel</li>
            <li>Ensure the Clerk instance domain matches your keys</li>
            <li>Try clearing browser cache and cookies</li>
            <li>Check if any browser extensions are blocking scripts</li>
          </ol>
        </div>
        
        <div className="mt-8 text-center">
          <a href="/" className="text-blue-600 hover:underline mr-4">Back to Home</a>
          <a href="/sign-in" className="text-blue-600 hover:underline">Try Sign In</a>
        </div>
      </div>
    </div>
  );
}