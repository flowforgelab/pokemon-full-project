'use client';

import { useEffect } from 'react';
import { useClerk } from '@clerk/nextjs';
import Link from 'next/link';

export default function ActivateClerkPage() {
  const { openSignIn } = useClerk();
  
  const handleOpenSignIn = () => {
    try {
      openSignIn();
    } catch (error) {
      console.error('Error opening sign in:', error);
      alert('Could not open sign in. Check console for errors.');
    }
  };
  
  useEffect(() => {
    // Log Clerk state
    console.log('Clerk instance:', window.Clerk);
    console.log('Environment:', {
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });
  }, []);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">Activate Clerk Sign In</h1>
        
        <div className="space-y-4">
          <button
            onClick={handleOpenSignIn}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700"
          >
            Open Clerk Sign In Modal
          </button>
          
          <div className="text-sm text-gray-600">
            <p>If the button above doesn\'t work, your Clerk instance might need:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Domain verification in Clerk Dashboard</li>
              <li>Production instance activation</li>
              <li>Correct redirect URLs configured</li>
            </ul>
          </div>
          
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">Manual sign-in URLs:</p>
            <div className="space-y-2">
              <a 
                href="https://tolerant-bream-18.clerk.accounts.dev/sign-in"
                className="block text-blue-600 hover:underline text-sm"
              >
                → Direct sign-in page
              </a>
              <a 
                href="https://accounts.tolerant-bream-18.clerk.accounts.dev"
                className="block text-blue-600 hover:underline text-sm"
              >
                → Accounts portal
              </a>
            </div>
          </div>
          
          <Link
            href="/"
            className="block text-center text-gray-500 hover:underline"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}