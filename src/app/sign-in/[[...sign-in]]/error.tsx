'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function SignInError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Sign-in error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h2>
        <p className="text-gray-600 mb-6">
          There was a problem loading the sign-in page. This might be due to:
        </p>
        <ul className="text-left text-sm text-gray-600 mb-6 space-y-2">
          <li>• Clerk configuration issues</li>
          <li>• Missing environment variables</li>
          <li>• Network connectivity problems</li>
          <li>• Browser extensions blocking scripts</li>
        </ul>
        
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
          
          <Link
            href="/clerk-debug"
            className="block w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
          >
            View Debug Info
          </Link>
          
          <Link
            href="/"
            className="block text-gray-500 hover:underline"
          >
            Back to Home
          </Link>
        </div>
        
        {error.digest && (
          <p className="mt-4 text-xs text-gray-400">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}