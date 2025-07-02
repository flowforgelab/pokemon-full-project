'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import Link from 'next/link';
import Image from 'next/image';
import { 
  PencilIcon, 
  ChartBarIcon, 
  TrashIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  UserGroupIcon,
  CalendarIcon,
  TrophyIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { DeckStats } from '@/components/decks/DeckStats';
import { useState } from 'react';
import { Supertype } from '@prisma/client';

interface Props {
  params: Promise<{ id: string }>;
}

export default function DeckDetailPage({ params }: Props) {
  const router = useRouter();
  const { id: deckId } = use(params);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Fetch deck data
  const { data: deck, isLoading, error } = api.deck.getById.useQuery(deckId, {
    enabled: !!deckId,
  });

  // Delete mutation
  const deleteMutation = api.deck.delete.useMutation({
    onSuccess: () => {
      router.push('/decks');
    },
  });

  // Share mutation
  const shareMutation = api.deck.share.useMutation({
    onSuccess: (data) => {
      setShareUrl(data.shareUrl);
      setShowShareModal(true);
    },
  });

  // Duplicate mutation
  const duplicateMutation = api.deck.duplicate.useMutation({
    onSuccess: (data) => {
      router.push(`/deck-builder/${data.id}`);
    },
  });

  // Export query
  const exportDeck = async (format: 'ptcgo' | 'ptcgl' | 'text' | 'json') => {
    const response = await api.deck.export.useQuery({ deckId, format });
    // Handle export download
  };

  if (!deckId) {
    return <div>Invalid deck ID</div>;
  }

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Decks', href: '/decks' },
    { label: deck?.name || 'Loading...', href: `/decks/${deckId}` },
  ];

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this deck? This action cannot be undone.')) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(deckId);
    } catch (error) {
      console.error('Failed to delete deck:', error);
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    try {
      await shareMutation.mutateAsync({ deckId, expiresIn: '1week' });
    } catch (error) {
      console.error('Failed to share deck:', error);
    }
  };

  const handleDuplicate = async () => {
    try {
      await duplicateMutation.mutateAsync({ deckId });
    } catch (error) {
      console.error('Failed to duplicate deck:', error);
    }
  };

  // Group cards by type
  const groupedCards = deck?.cards.reduce((acc, deckCard) => {
    const card = deckCard.card;
    if (!card) return acc;
    
    const type = card.supertype;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(deckCard);
    return acc;
  }, {} as Record<string, typeof deck.cards>);

  // Calculate statistics
  const totalCards = deck?.cards.reduce((sum, card) => sum + card.quantity, 0) || 0;
  const pokemonCount = groupedCards?.POKEMON?.reduce((sum, card) => sum + card.quantity, 0) || 0;
  const trainerCount = groupedCards?.TRAINER?.reduce((sum, card) => sum + card.quantity, 0) || 0;
  const energyCount = groupedCards?.ENERGY?.reduce((sum, card) => sum + card.quantity, 0) || 0;

  const winRate = deck && (deck.wins || 0) + (deck.losses || 0) > 0
    ? Math.round(((deck.wins || 0) / ((deck.wins || 0) + (deck.losses || 0))) * 100)
    : 0;

  if (isLoading) {
    return (
      <MainLayout title="Loading..." breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (error || !deck) {
    return (
      <MainLayout title="Error" breadcrumbs={breadcrumbs}>
        <div className="text-center py-12">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Deck not found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            The deck you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Link
            href="/decks"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Decks
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={deck.name} breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-start gap-4">
                {deck.coverCardId && (
                  <div className="w-24 h-32 relative rounded-lg overflow-hidden shadow-md flex-shrink-0">
                    <Image
                      src={deck.cards.find(c => c.card?.id === deck.coverCardId)?.card?.imageUrlSmall || ''}
                      alt={deck.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {deck.name}
                  </h1>
                  {deck.description && (
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      {deck.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <UserGroupIcon className="h-4 w-4" />
                      {deck.isPublic ? 'Public' : 'Private'}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-4 w-4" />
                      Updated {new Date(deck.updatedAt).toLocaleDateString()}
                    </span>
                    {deck.format && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md">
                        {deck.format.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/deck-builder/${deck.id}`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PencilIcon className="h-5 w-5 mr-2" />
                Edit
              </Link>
              <Link
                href={`/decks/${deck.id}/analyze/select`}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <ChartBarIcon className="h-5 w-5 mr-2" />
                Analyze
              </Link>
              <button
                onClick={handleShare}
                disabled={shareMutation.isPending}
                className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ShareIcon className="h-5 w-5 mr-2" />
                Share
              </button>
              <button
                onClick={handleDuplicate}
                disabled={duplicateMutation.isPending}
                className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
                Duplicate
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <TrashIcon className="h-5 w-5 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Deck Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Deck Statistics
            </h2>
            <DeckStats
              totalCards={totalCards}
              pokemonCount={pokemonCount}
              trainerCount={trainerCount}
              energyCount={energyCount}
            />
          </div>

          {/* Performance Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Performance
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Win Rate</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {winRate}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{deck.wins || 0}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Wins</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{deck.losses || 0}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Losses</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{deck.draws || 0}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Draws</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Link
                href={`/decks/${deck.id}/optimize`}
                className="block w-full text-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-colors"
              >
                Optimize Deck
              </Link>
              <button
                onClick={() => exportDeck('ptcgo')}
                className="block w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ArrowDownTrayIcon className="h-5 w-5 inline mr-2" />
                Export Deck
              </button>
            </div>
          </div>
        </div>

        {/* Card List Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Deck List
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pokemon Cards */}
            {groupedCards?.POKEMON && groupedCards.POKEMON.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  Pokémon ({pokemonCount})
                </h3>
                <div className="space-y-2">
                  {groupedCards.POKEMON.map((deckCard) => (
                    <CardListItem key={deckCard.id} deckCard={deckCard} />
                  ))}
                </div>
              </div>
            )}

            {/* Trainer Cards */}
            {groupedCards?.TRAINER && groupedCards.TRAINER.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Trainers ({trainerCount})
                </h3>
                <div className="space-y-2">
                  {groupedCards.TRAINER.map((deckCard) => (
                    <CardListItem key={deckCard.id} deckCard={deckCard} />
                  ))}
                </div>
              </div>
            )}

            {/* Energy Cards */}
            {groupedCards?.ENERGY && groupedCards.ENERGY.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  Energy ({energyCount})
                </h3>
                <div className="space-y-2">
                  {groupedCards.ENERGY.map((deckCard) => (
                    <CardListItem key={deckCard.id} deckCard={deckCard} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Share Your Deck
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Your deck has been shared! Use the link below:
            </p>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-4">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="w-full bg-transparent text-sm text-gray-700 dark:text-gray-300"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Copy Link
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

function CardListItem({ deckCard }: { deckCard: any }) {
  const card = deckCard.card;
  if (!card) return null;

  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
      <div className="flex items-center gap-3">
        {card.imageUrlSmall && (
          <div className="w-10 h-14 relative rounded overflow-hidden">
            <Image
              src={card.imageUrlSmall}
              alt={card.name}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {card.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {card.set?.name} • {card.number}
          </p>
        </div>
      </div>
      <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
        ×{deckCard.quantity}
      </span>
    </div>
  );
}