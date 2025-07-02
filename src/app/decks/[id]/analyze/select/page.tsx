'use client';

import { useParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { AnalysisSelector } from '@/components/analysis/AnalysisSelector';

export default function AnalysisSelectPage() {
  const params = useParams();
  const deckId = params?.id as string;

  // Fetch deck data
  const { data: deck } = api.deck.getById.useQuery(deckId, {
    enabled: !!deckId,
  });

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Decks', href: '/decks' },
    { label: deck?.name || 'Loading...', href: `/decks/${deckId}` },
    { label: 'Choose Analysis', href: `/decks/${deckId}/analyze/select` },
  ];

  if (!deckId) {
    return <div>Invalid deck ID</div>;
  }

  return (
    <MainLayout title="Choose Analysis Type" breadcrumbs={breadcrumbs}>
      <AnalysisSelector deckId={deckId} deckName={deck?.name || 'Your Deck'} />
    </MainLayout>
  );
}