'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ClerkConfigPage() {
  const [config, setConfig] = useState<any>({});
  
  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
    
    // Decode the domain from the publishable key
    let domain = '';
    try {
      const base64Part = publishableKey.replace('pk_test_', '').replace('$', '');
      domain = atob(base64Part);
    } catch (e) {
      console.error('Failed to decode:', e);
    }
    
    setConfig({
      publishableKey: publishableKey,
      domain: domain,
      signInUrl: `https://${domain}/sign-in`,
      signUpUrl: `https://${domain}/sign-up`,
      accountsPortalUrl: `https://accounts.${domain}`,
      dashboardUrl: `https://dashboard.clerk.com`,
    });
  }, []);
  
  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Clerk Configuration</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Detected Configuration</h2>
          <dl className="space-y-2">
            <div>
              <dt className="font-medium text-gray-600">Domain:</dt>
              <dd className="font-mono text-sm">{config.domain || 'Loading...'}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-600">Publishable Key:</dt>
              <dd className="font-mono text-xs break-all">{config.publishableKey || 'Not set'}</dd>
            </div>
          </dl>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Links</h2>
          <div className="space-y-2">
            <a 
              href={config.signInUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-blue-600 hover:underline"
            >
              → Direct Sign In URL
            </a>
            <a 
              href={config.signUpUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-blue-600 hover:underline"
            >
              → Direct Sign Up URL
            </a>
            <a 
              href={config.accountsPortalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-blue-600 hover:underline"
            >
              → Accounts Portal
            </a>
          </div>
        </div>
        
        <div className="bg-blue-50 p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Click the test links above to verify they work</li>
            <li>If they return 404, the Clerk instance might not exist</li>
            <li>Go to <a href="https://dashboard.clerk.com" className="text-blue-600 underline">Clerk Dashboard</a></li>
            <li>Create a new application or verify your existing one</li>
            <li>Copy the correct keys and update them in Vercel</li>
          </ol>
        </div>
        
        <div className="text-center">
          <Link href="/" className="text-gray-500 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}