'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HostedSignInPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Extract the Clerk frontend API from the publishable key
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('No publishable key found');
      return;
    }
    
    // The domain is encoded in the publishable key
    // pk_test_dG9sZXJhbnQtYnJlYW0tMTguY2xlcmsuYWNjb3VudHMuZGV2JA
    // Decodes to: tolerant-bream-18.clerk.accounts.dev
    const encodedDomain = publishableKey.replace('pk_test_', '').replace('$', '');
    let domain = '';
    
    try {
      domain = atob(encodedDomain);
    } catch (e) {
      console.error('Failed to decode domain:', e);
    }
    
    if (domain) {
      // Redirect to Clerk hosted sign-in
      window.location.href = `https://${domain}/sign-in?redirect_url=${encodeURIComponent(window.location.origin + '/dashboard')}`;
    }
  }, []);
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting to sign in...</h1>
        <p className="text-gray-600">If you are not redirected, <a href="/" className="text-blue-600 underline">click here</a></p>
      </div>
    </div>
  );
}