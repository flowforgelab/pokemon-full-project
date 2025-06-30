'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { useDebounce } from '@/hooks/useDebounce';
import CardDetailModal from '@/components/cards/CardDetailModal';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type ViewMode = 'grid' | 'list';

interface CardFilters {
  search: string;
  types: string[];
  subtypes: string[];
  supertype: string;
  rarity: string[];
  set: string;
  hp: { min?: number; max?: number };
  retreatCost: { min?: number; max?: number };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export default function CardsPage() {
  const [view, setView] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CardFilters>({
    search: '',
    types: [],
    subtypes: [],
    supertype: '',
    rarity: [],
    set: '',
    hp: {},
    retreatCost: {},
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const debouncedSearch = useDebounce(filters.search, 500);

  const [page, setPage] = useState(1);

  const { data: searchResult, isLoading, error } = api.card.searchOptimized.useQuery({
    query: debouncedSearch,
    filters: {
      types: filters.types.length > 0 ? filters.types : undefined,
      subtypes: filters.subtypes.length > 0 ? filters.subtypes : undefined,
      supertype: filters.supertype ? filters.supertype as any : undefined,
      rarity: filters.rarity.length > 0 ? filters.rarity.map(r => r.toUpperCase().replace(' ', '_') as any) : undefined,
      setId: filters.set || undefined,
      hp: Object.keys(filters.hp).length > 0 ? filters.hp : undefined,
      retreatCost: Object.keys(filters.retreatCost).length > 0 ? filters.retreatCost : undefined,
    },
    pagination: {
      page,
      limit: 20,
    },
    sort: {
      field: filters.sortBy as any,
      direction: filters.sortOrder,
    },
  }, {
    keepPreviousData: true,
    staleTime: 30000, // Cache for 30 seconds
    retry: 1,
    onError: (err) => {
      console.error('Search query error:', err);
    },
  });

  const { data: sets } = api.card.getSets.useQuery();

  const allCards = searchResult?.cards || [];
  const totalPages = searchResult?.totalPages || 0;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.types, filters.subtypes, filters.supertype, filters.rarity, filters.set, filters.sortBy, filters.sortOrder]);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Cards', href: '/cards' },
  ];

  const pokemonTypes = [
    'Colorless', 'Darkness', 'Dragon', 'Fairy', 'Fighting', 
    'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water'
  ];

  const rarities = [
    'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Rare Ultra',
    'Rare Secret', 'Rare Rainbow', 'Rare Shining', 'Amazing Rare'
  ];

  return (
    <MainLayout title="Card Browser" breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Search Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Pokemon Card Database
          </h1>
          
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search cards by name, text, or ability..."
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
                {isLoading && filters.search && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
            </div>

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
                  <ListBulletIcon className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <FunnelIcon className="h-5 w-5" />
                Filters
                {(filters.types.length > 0 || filters.rarity.length > 0 || filters.set || filters.supertype) && (
                  <span className="ml-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {filters.types.length + filters.rarity.length + (filters.set ? 1 : 0) + (filters.supertype ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active Filters */}
          {(filters.types.length > 0 || filters.rarity.length > 0 || filters.set || filters.supertype) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {filters.supertype && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                  {filters.supertype === 'POKEMON' ? 'Pokémon' : filters.supertype === 'TRAINER' ? 'Trainer' : 'Energy'}
                  <button
                    onClick={() => setFilters({ ...filters, supertype: '' })}
                    className="hover:text-blue-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </span>
              )}
              {filters.types.map((type) => (
                <span key={type} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                  {type}
                  <button
                    onClick={() => setFilters({ ...filters, types: filters.types.filter(t => t !== type) })}
                    className="hover:text-blue-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </span>
              ))}
              {filters.rarity.map((rarity) => (
                <span key={rarity} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm">
                  {rarity}
                  <button
                    onClick={() => setFilters({ ...filters, rarity: filters.rarity.filter(r => r !== rarity) })}
                    className="hover:text-purple-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </span>
              ))}
              {filters.set && sets && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                  {sets.find(s => s.id === filters.set)?.name}
                  <button
                    onClick={() => setFilters({ ...filters, set: '' })}
                    className="hover:text-green-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </span>
              )}
              <button
                onClick={() => setFilters({
                  ...filters,
                  types: [],
                  rarity: [],
                  set: '',
                  supertype: '',
                })}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-6">
          {/* Filters Sidebar */}
          {showFilters && (
            <div className="w-64 flex-shrink-0">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-6 sticky top-20">
                {/* Card Type */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">Card Type</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Pokémon', value: 'POKEMON' },
                      { label: 'Trainer', value: 'TRAINER' },
                      { label: 'Energy', value: 'ENERGY' }
                    ].map((type) => (
                      <label key={type.value} className="flex items-center">
                        <input
                          type="radio"
                          name="supertype"
                          value={type.value}
                          checked={filters.supertype === type.value}
                          onChange={(e) => setFilters({ ...filters, supertype: e.target.value })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Pokemon Types */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">Pokémon Type</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pokemonTypes.map((type) => (
                      <label key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.types.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters({ ...filters, types: [...filters.types, type] });
                            } else {
                              setFilters({ ...filters, types: filters.types.filter(t => t !== type) });
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Rarity */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">Rarity</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rarities.map((rarity) => (
                      <label key={rarity} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.rarity.includes(rarity)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters({ ...filters, rarity: [...filters.rarity, rarity] });
                            } else {
                              setFilters({ ...filters, rarity: filters.rarity.filter(r => r !== rarity) });
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{rarity}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Set */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">Set</h3>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    value={filters.set}
                    onChange={(e) => setFilters({ ...filters, set: e.target.value })}
                  >
                    <option value="">All Sets</option>
                    {sets?.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">Sort By</h3>
                  {debouncedSearch && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                      ✓ Sorting by relevance when searching
                    </p>
                  )}
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    value={`${filters.sortBy}-${filters.sortOrder}`}
                    onChange={(e) => {
                      const [sortBy, sortOrder] = e.target.value.split('-');
                      setFilters({ ...filters, sortBy, sortOrder: sortOrder as 'asc' | 'desc' });
                    }}
                    disabled={!!debouncedSearch}
                  >
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="number-asc">Number (Low-High)</option>
                    <option value="number-desc">Number (High-Low)</option>
                    <option value="releaseDate-desc">Newest First</option>
                    <option value="releaseDate-asc">Oldest First</option>
                    <option value="price-asc">Price (Low-High)</option>
                    <option value="price-desc">Price (High-Low)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="flex-1">
            {error ? (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-8 text-center">
                <p className="text-red-800 dark:text-red-200 font-medium">Error loading cards</p>
                <p className="text-red-600 dark:text-red-300 text-sm mt-2">{error.message}</p>
              </div>
            ) : isLoading ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
                <p className="text-center text-gray-500 dark:text-gray-400">
                  {filters.search ? `Searching for "${filters.search}"...` : 'Loading cards...'}
                </p>
              </div>
            ) : allCards.length > 0 ? (
              <>
                {view === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {allCards.map((card) => (
                      <div
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        className="group bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-lg transition-all cursor-pointer"
                      >
                        <div className="aspect-[3/4] relative overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-700">
                          {card.imageUrlLarge ? (
                            <img
                              src={card.imageUrlLarge}
                              alt={card.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              No Image
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {card.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {card.set.name} • {card.number}
                          </p>
                        </div>
                      </div>
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
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Set
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Rarity
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                        {allCards.map((card) => (
                          <tr
                            key={card.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => setSelectedCardId(card.id)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-12 w-10">
                                  {card.imageUrlSmall && (
                                    <img
                                      className="h-12 w-10 rounded object-cover"
                                      src={card.imageUrlSmall}
                                      alt={card.name}
                                    />
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {card.name}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {card.number}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {card.supertype}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {card.set.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {card.rarity || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
                <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No cards found
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Detail Modal */}
      {selectedCardId && (
        <CardDetailModal
          cardId={selectedCardId}
          isOpen={!!selectedCardId}
          onClose={() => setSelectedCardId(null)}
        />
      )}
    </MainLayout>
  );
}