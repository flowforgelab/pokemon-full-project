'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TempSignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('Authentication is temporarily disabled. Please check back later or contact support.');
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Sign In</h1>
        
        <div className="bg-amber-50 border border-amber-200 p-4 rounded mb-6">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> We are experiencing technical difficulties with our authentication system. 
            We apologize for the inconvenience.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-gray-400 text-white py-2 px-4 rounded-md cursor-not-allowed"
            disabled
          >
            Sign In (Temporarily Disabled)
          </button>
        </form>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}
        
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Need help? <a href="mailto:support@example.com" className="text-blue-600 hover:underline">Contact Support</a>
          </p>
          <Link href="/" className="block text-gray-500 hover:underline">
            Back to Home
          </Link>
        </div>
        
        <div className="mt-6 pt-6 border-t">
          <div className="text-center">
            <Link 
              href="/clerk-config" 
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              View Clerk Configuration →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}