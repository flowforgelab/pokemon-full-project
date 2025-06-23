'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

export default function SSOCallbackPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      // Check if this is a new user
      const isNewUser = localStorage.getItem('clerk_new_user') === 'true';
      
      if (isNewUser) {
        localStorage.removeItem('clerk_new_user');
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    } else {
      // If not signed in, redirect to sign-in
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-xl font-semibold">Completing sign in...</h2>
        <p className="text-muted-foreground">Please wait while we redirect you.</p>
      </div>
    </div>
  );
}