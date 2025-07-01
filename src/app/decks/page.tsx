'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import Link from 'next/link';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  SparklesIcon,
  TrophyIcon,
  ClockIcon,
  UserGroupIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  PencilIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

type TabType = 'my-decks' | 'discover' | 'templates';

interface DeckFilters {
  search?: string;
  format?: string;
  archetype?: string;
  sortBy?: 'name' | 'updated' | 'winRate' | 'popularity';
}

export default function DecksPage() {
  const [activeTab, setActiveTab] = useState<TabType>('my-decks');
  const [filters, setFilters] = useState<DeckFilters>({
    sortBy: 'updated'
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data: myDecksData, isLoading: myDecksLoading } = api.deck.getUserDecks.useQuery({
    page: 1,
    pageSize: 50,
  });
  const myDecks = myDecksData?.decks || [];
  
  const { data: publicDecksData, isLoading: publicDecksLoading } = api.deck.getPublicDecks.useQuery({
    page: 1,
    pageSize: 50,
    search: activeTab === 'discover' ? filters.search : undefined,
  });
  const publicDecks = publicDecksData?.decks || [];
  
  // Templates not implemented yet, using empty array
  const templates: any[] = [];
  const templatesLoading = false;

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Decks', href: '/decks' },
  ];

  const isLoading = 
    (activeTab === 'my-decks' && myDecksLoading) ||
    (activeTab === 'discover' && publicDecksLoading) ||
    (activeTab === 'templates' && templatesLoading);

  return (
    <MainLayout title="Deck Management" breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Deck Management
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Build, analyze, and share your Pokemon TCG decks
            </p>
          </div>
          
          <Link
            href="/deck-builder/create"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            New Deck
          </Link>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <div className="border-b dark:border-gray-700">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('my-decks')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'my-decks'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                My Decks
                {myDecks && (
                  <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                    {myDecks.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('discover')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'discover'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Discover
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'templates'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Templates
              </button>
            </nav>
          </div>

          {/* Search and Filters */}
          {(activeTab === 'my-decks' || activeTab === 'discover') && (
            <div className="p-6 border-b dark:border-gray-700">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder={`Search ${activeTab === 'my-decks' ? 'your' : ''} decks...`}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={filters.search || ''}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    />
                  </div>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <FunnelIcon className="h-5 w-5" />
                  Filters
                </button>
              </div>

              {showFilters && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={filters.format || ''}
                    onChange={(e) => setFilters({ ...filters, format: e.target.value })}
                  >
                    <option value="">All Formats</option>
                    <option value="standard">Standard</option>
                    <option value="expanded">Expanded</option>
                    <option value="unlimited">Unlimited</option>
                    <option value="glc">GLC</option>
                  </select>
                  <select
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={filters.archetype || ''}
                    onChange={(e) => setFilters({ ...filters, archetype: e.target.value })}
                  >
                    <option value="">All Archetypes</option>
                    <option value="aggro">Aggro</option>
                    <option value="control">Control</option>
                    <option value="combo">Combo</option>
                    <option value="midrange">Midrange</option>
                  </select>
                  <select
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={filters.sortBy}
                    onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
                  >
                    <option value="updated">Recently Updated</option>
                    <option value="name">Name</option>
                    <option value="winRate">Win Rate</option>
                    <option value="popularity">Popularity</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* My Decks Tab */}
                {activeTab === 'my-decks' && (
                  <div>
                    {myDecks && myDecks.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myDecks.map((deck) => (
                          <DeckCard key={deck.id} deck={deck} showActions />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <SparklesIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No decks yet
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                          Create your first deck to start building and analyzing.
                        </p>
                        <Link
                          href="/deck-builder/create"
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <PlusIcon className="h-5 w-5 mr-2" />
                          Create Your First Deck
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Discover Tab */}
                {activeTab === 'discover' && (
                  <div>
                    {publicDecks && publicDecks.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {publicDecks.map((deck) => (
                          <DeckCard key={deck.id} deck={deck} showCreator />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No public decks found
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          Be the first to share a deck with the community!
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Templates Tab */}
                {activeTab === 'templates' && (
                  <div>
                    {templates && templates.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map((template) => (
                          <TemplateCard key={template.id} template={template} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <DocumentDuplicateIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No templates available
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                          Check back later for deck templates.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function DeckCard({ deck, showActions, showCreator }: { deck: any; showActions?: boolean; showCreator?: boolean }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {deck.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {deck.format?.name || 'Standard'} • {deck._count?.cards || 0} cards
          </p>
        </div>
        {deck.isPublic && (
          <UserGroupIcon className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {showCreator && deck.user && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          by {deck.user.name}
        </p>
      )}

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Win Rate</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {deck.winRate || 0}%
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Games</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {(deck.wins || 0) + (deck.losses || 0)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Updated</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {new Date(deck.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/decks/${deck.id}`}
          className="flex-1 text-center px-3 py-2 bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
        >
          View
        </Link>
        {showActions && (
          <>
            <Link
              href={`/deck-builder/${deck.id}`}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <PencilIcon className="h-5 w-5" />
            </Link>
            <Link
              href={`/decks/${deck.id}/analyze`}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ChartBarIcon className="h-5 w-5" />
            </Link>
            <button
              onClick={() => {/* TODO: Delete deck */}}
              className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </>
        )}
        {!showActions && (
          <button
            onClick={() => {/* TODO: Clone deck */}}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <DocumentDuplicateIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: any }) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
          <TrophyIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {template.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {template.archetype} • {template.format}
          </p>
        </div>
      </div>
      
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        {template.description}
      </p>

      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
        <span className="flex items-center gap-1">
          <ClockIcon className="h-4 w-4" />
          {template.difficulty}
        </span>
        <span className="flex items-center gap-1">
          <SparklesIcon className="h-4 w-4" />
          {template.tier}
        </span>
      </div>

      <Link
        href={`/deck-builder/create?template=${template.id}`}
        className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Use Template
      </Link>
    </div>
  );
}