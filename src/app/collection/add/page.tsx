'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AddToCollectionPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the cards page to browse and add cards
    router.replace('/cards');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-xl font-semibold">Redirecting to card browser...</h2>
        <p className="text-muted-foreground">Browse cards and add them to your collection</p>
      </div>
    </div>
  );
}