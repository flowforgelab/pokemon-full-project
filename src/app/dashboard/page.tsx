'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { DashboardStat } from '@/components/layout/DashboardStat';
import { api } from '@/utils/api';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import {
  CurrencyDollarIcon,
  RectangleStackIcon,
  SparklesIcon,
  TrophyIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  FireIcon,
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const { user } = useUser();
  const { data: stats } = api.user.getDashboardStats.useQuery();
  const { data: recentDecksData } = api.deck.getUserDecks.useQuery({ 
    page: 1,
    pageSize: 5 
  });
  const recentDecks = recentDecksData?.decks || [];
  const { data: recentActivity } = api.user.getRecentActivity.useQuery();
  const { data: recommendations } = api.recommendation.getQuickRecommendations.useQuery();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back, {user?.firstName || 'Trainer'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Here&apos;s what&apos;s happening with your Pokemon TCG collection and decks.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <DashboardStat
            title="Collection Value"
            value={`$${stats?.collectionValue?.toFixed(2) || '0.00'}`}
            change={stats?.collectionValueChange ? `${stats.collectionValueChange > 0 ? '+' : ''}${stats.collectionValueChange.toFixed(1)}%` : undefined}
            trend={stats?.collectionValueChange ? stats.collectionValueChange > 0 ? 'up' : 'down' : 'neutral'}
            icon={<CurrencyDollarIcon className="h-8 w-8" />}
          />
          <DashboardStat
            title="Total Cards"
            value={stats?.totalCards?.toLocaleString() || '0'}
            icon={<RectangleStackIcon className="h-8 w-8" />}
          />
          <DashboardStat
            title="Complete Decks"
            value={stats?.completeDecks || '0'}
            icon={<SparklesIcon className="h-8 w-8" />}
          />
          <DashboardStat
            title="Win Rate"
            value={`${stats?.winRate || 0}%`}
            icon={<TrophyIcon className="h-8 w-8" />}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Decks */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="p-6 border-b dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Recent Decks
                  </h2>
                  <Link
                    href="/decks"
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    View all
                  </Link>
                </div>
              </div>
              <div className="divide-y dark:divide-gray-700">
                {recentDecks && recentDecks.length > 0 ? (
                  recentDecks.map((deck) => (
                    <Link
                      key={deck.id}
                      href={`/decks/${deck.id}`}
                      className="block p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {deck.name}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {deck.format?.name || 'Standard'} • {deck._count?.cards || 0} cards
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {deck.wins || 0}W - {deck.losses || 0}L
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Updated {new Date(deck.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      No decks yet. Start building your first deck!
                    </p>
                    <Link
                      href="/deck-builder/create"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <PlusIcon className="h-5 w-5 mr-2" />
                      Create Deck
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h2>
              <div className="space-y-3">
                <Link
                  href="/deck-builder/create"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    <PlusIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">New Deck</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Start building</p>
                  </div>
                </Link>
                <Link
                  href="/collection/add"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                    <RectangleStackIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Add Cards</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">To collection</p>
                  </div>
                </Link>
                <Link
                  href="/decks"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                    <ArrowTrendingUpIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">View & Analyze</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Your decks</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recent Activity
              </h2>
              <div className="space-y-3">
                {recentActivity && recentActivity.length > 0 ? (
                  recentActivity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <ClockIcon className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 dark:text-white">
                          {activity.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No recent activity
                  </p>
                )}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recommended for You
              </h2>
              <div className="space-y-3">
                {recommendations && recommendations.length > 0 ? (
                  recommendations.slice(0, 3).map((card) => (
                    <Link
                      key={card.id}
                      href={`/cards/${card.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex-shrink-0 w-12 h-16 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                        {card.imageUrlSmall && (
                          <img
                            src={card.imageUrlSmall}
                            alt={card.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">
                          {card.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {card.set.name}
                        </p>
                      </div>
                      <FireIcon className="h-4 w-4 text-orange-500" />
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Build more decks to get personalized recommendations
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}