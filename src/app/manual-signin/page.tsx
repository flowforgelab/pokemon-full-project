'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ManualSignInPage() {
  const [status, setStatus] = useState('');
  
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('This is a fallback page. Please check /clerk-debug for configuration issues.');
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Manual Sign In (Fallback)</h1>
        
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-6">
          <p className="text-sm text-yellow-800">
            This is a fallback sign-in page. The Clerk authentication system is not loading properly.
          </p>
        </div>
        
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="your@email.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="••••••••"
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Sign In (Disabled)
          </button>
        </form>
        
        {status && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {status}
          </div>
        )}
        
        <div className="mt-6 space-y-2 text-center">
          <Link href="/clerk-debug" className="block text-blue-600 hover:underline">
            → Check Clerk Debug Info
          </Link>
          <Link href="/" className="block text-gray-500 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}