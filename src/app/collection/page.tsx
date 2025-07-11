'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import Link from 'next/link';
import CardDetailModal from '@/components/cards/CardDetailModal';
import PokemonCard from '@/components/cards/PokemonCard';
import DeckSelector from '@/components/decks/DeckSelector';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ViewColumnsIcon,
  Squares2X2Icon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import { Card as CardType } from '@/types/pokemon';

type ViewMode = 'grid' | 'list';

interface CollectionFilters {
  search?: string;
  set?: string;
  type?: string;
  rarity?: string;
  format?: string[];
  sortBy?: 'name' | 'value' | 'acquiredDate' | 'quantity' | 'set';
  sortOrder?: 'asc' | 'desc';
}

export default function CollectionPage() {
  const [view, setView] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState<CollectionFilters>({
    sortBy: 'acquiredDate',
    sortOrder: 'desc',
    format: []
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCardForDeck, setSelectedCardForDeck] = useState<CardType | null>(null);
  const [showDeckSelector, setShowDeckSelector] = useState(false);

  const { data: stats } = api.collection.getStatistics.useQuery();
  const { data: collection, isLoading, error } = api.collection.searchCards.useQuery({
    filters: {
      search: filters.search,
      sets: filters.set ? [filters.set] : undefined,
      supertype: filters.type as any,
      rarity: filters.rarity ? [filters.rarity as any] : undefined,
      format: filters.format && filters.format.length > 0 ? filters.format : undefined,
      isWishlist: false, // Explicitly filter for collection items, not wishlist
    },
    pagination: {
      page: 1,
      limit: 50,
    },
    sort: {
      field: filters.sortBy || 'name',
      direction: filters.sortOrder || 'asc',
    },
  });
  
  // Log any query errors or debug data
  if (error) {
    console.error('Collection query error:', error);
  }
  
  // Debug logging
  React.useEffect(() => {
    if (collection) {
      console.log('Collection data:', {
        totalCards: collection.total,
        pageData: collection.cards?.length || 0,
        firstCard: collection.cards?.[0],
      });
    }
  }, [collection]);

  const handleAddToDeck = (card: CardType) => {
    setSelectedCardForDeck(card);
    setShowDeckSelector(true);
  };

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Collection', href: '/collection' },
  ];

  return (
    <MainLayout title="My Collection" breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Collection Header with Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                My Collection
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                {stats?.summary?.total_cards || 0} cards • ${stats?.summary?.market_value?.toFixed(2) || '0.00'} value
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Link
                href="/collection/stats"
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChartBarIcon className="w-5 h-5" />
              </Link>
              <button
                onClick={() => {/* TODO: Export */}}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowUpTrayIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => {/* TODO: Import */}}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
              <Link
                href="/cards"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5" />
                Add Cards
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Sets</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.valueBySet?.length || 0}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Unique Cards</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.summary?.unique_cards || 0}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg. Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ${((stats?.summary?.market_value || 0) / (stats?.summary?.total_cards || 1)).toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Want List</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.summary?.wishlistCount || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search your collection..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>

            {/* View Toggle and Filter Button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setView('grid')}
                  className={`p-2 rounded ${
                    view === 'grid'
                      ? 'bg-white dark:bg-gray-600 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <Squares2X2Icon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-2 rounded ${
                    view === 'list'
                      ? 'bg-white dark:bg-gray-600 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <ViewColumnsIcon className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <FunnelIcon className="h-5 w-5" />
                Filters
              </button>
            </div>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <select
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={filters.set || ''}
                  onChange={(e) => setFilters({ ...filters, set: e.target.value })}
                >
                  <option value="">All Sets</option>
                  {/* TODO: Populate with actual sets */}
                </select>
                <select
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={filters.type || ''}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                >
                  <option value="">All Types</option>
                  <option value="POKEMON">Pokemon</option>
                  <option value="TRAINER">Trainer</option>
                  <option value="ENERGY">Energy</option>
                </select>
                <select
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={filters.rarity || ''}
                  onChange={(e) => setFilters({ ...filters, rarity: e.target.value })}
                >
                  <option value="">All Rarities</option>
                  <option value="COMMON">Common</option>
                  <option value="UNCOMMON">Uncommon</option>
                  <option value="RARE">Rare</option>
                  <option value="HOLO_RARE">Holo Rare</option>
                </select>
                <select
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={`${filters.sortBy || 'acquiredDate'}-${filters.sortOrder || 'desc'}`}
                  onChange={(e) => {
                    const [sortBy, sortOrder] = e.target.value.split('-') as [string, 'asc' | 'desc'];
                    setFilters({ ...filters, sortBy: sortBy as any, sortOrder });
                  }}
                >
                  <option value="acquiredDate-desc">Recently Added</option>
                  <option value="acquiredDate-asc">Oldest First</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="value-desc">Highest Value</option>
                  <option value="value-asc">Lowest Value</option>
                </select>
                <select
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={filters.format?.join(',') || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilters({ ...filters, format: value ? value.split(',') : [] });
                  }}
                >
                  <option value="">All Formats</option>
                  <option value="standard">Standard</option>
                  <option value="expanded">Expanded</option>
                  <option value="unlimited">Unlimited</option>
                  <option value="standard,expanded">Standard & Expanded</option>
                  <option value="expanded,unlimited">Expanded & Unlimited</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Collection Grid/List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : collection && collection.cards.length > 0 ? (
          view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {collection.cards.map((item) => (
                <PokemonCard
                  key={item.id}
                  card={item.card}
                  layout="grid"
                  viewMode="compact"
                  onClick={() => setSelectedCardId(item.cardId)}
                  onAddToDeck={handleAddToDeck}
                  showAddToDeck={true}
                  showCollectionIndicator={true}
                  collectionQuantity={item.quantity}
                  collectionQuantityFoil={item.quantityFoil || 0}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Card
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Set
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Rarity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {collection.cards.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => setSelectedCardId(item.cardId)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-8">
                            {item.card.imageUrlSmall && (
                              <img
                                className="h-10 w-8 rounded object-cover"
                                src={item.card.imageUrlSmall}
                                alt={item.card.name}
                              />
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {item.card.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {item.card.number}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.card.set.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.card.rarity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">
                        ${(item.card.prices?.[0]?.marketPrice ? Number(item.card.prices[0].marketPrice) : 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <RectangleStackIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No cards in your collection yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Start adding cards to track your collection and its value.
            </p>
            <Link
              href="/cards"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Your First Cards
            </Link>
          </div>
        )}
      </div>

      {/* Card Detail Modal */}
      {selectedCardId && (
        <CardDetailModal
          cardId={selectedCardId}
          isOpen={!!selectedCardId}
          onClose={() => setSelectedCardId(null)}
        />
      )}

      {/* Deck Selector Modal */}
      <DeckSelector
        isOpen={showDeckSelector}
        onClose={() => {
          setShowDeckSelector(false);
          setSelectedCardForDeck(null);
        }}
        card={selectedCardForDeck}
      />
    </MainLayout>
  );
}