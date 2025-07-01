'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { 
  CurrencyDollarIcon, 
  ChartBarIcon, 
  SparklesIcon,
  ArrowTrendingUpIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ChevronRightIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import BudgetOptimizer from '@/components/budget/BudgetOptimizer';
import OptimizationResults from '@/components/budget/OptimizationResults';
import BudgetAlternatives from '@/components/budget/BudgetAlternatives';
import UpgradePath from '@/components/budget/UpgradePath';

export default function DeckOptimizePage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params?.id as string;
  
  const [budget, setBudget] = useState(100);
  const [priorityMode, setPriorityMode] = useState<'power' | 'consistency' | 'speed'>('consistency');
  const [includeOwned, setIncludeOwned] = useState(true);
  const [activeTab, setActiveTab] = useState('optimizer');

  // Fetch deck data
  const { data: deck, isLoading: deckLoading } = api.deck.getById.useQuery(deckId, {
    enabled: !!deckId,
  });

  // Fetch optimization results
  const { 
    data: optimization, 
    isLoading: optimizing,
    refetch: optimizeDeck 
  } = api.budget.optimizeDeck.useQuery({
    deckId,
    budget,
    priorityMode,
    excludeOwned: !includeOwned,
  }, {
    enabled: !!deckId && !!deck,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Decks', href: '/decks' },
    { label: deck?.name || 'Loading...', href: `/decks/${deckId}` },
    { label: 'Budget Optimize', href: `/decks/${deckId}/optimize` },
  ];

  const tabs = [
    { id: 'optimizer', name: 'Budget Optimizer', icon: CurrencyDollarIcon },
    { id: 'alternatives', name: 'Card Alternatives', icon: ArrowsRightLeftIcon },
    { id: 'upgrade', name: 'Upgrade Path', icon: ArrowTrendingUpIcon },
    { id: 'results', name: 'Optimization Results', icon: ChartBarIcon },
  ];

  // Calculate current deck value
  const currentDeckValue = deck?.cards.reduce((total, dc) => {
    const cardPrice = dc.card.prices?.find(p => p.currency === 'USD')?.price || 0;
    return total + (Number(cardPrice) * dc.count);
  }, 0) || 0;

  const handleApplyOptimization = async () => {
    if (!optimization?.optimizedDeck) return;
    
    // Apply the optimized deck changes
    const result = await api.deck.applyOptimization.mutate({
      deckId,
      changes: optimization.optimizedDeck.changes,
    });

    if (result.success) {
      router.push(`/decks/${deckId}`);
    }
  };

  if (!deckId) {
    return <div>Invalid deck ID</div>;
  }

  return (
    <MainLayout title="Budget Optimization" breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Budget Deck Optimization
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Optimize {deck?.name} for maximum performance within your budget
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Current Deck Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${currentDeckValue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Budget Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="space-y-6">
            {/* Budget Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Budget Limit
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${budget}
                  </span>
                  {budget < currentDeckValue && (
                    <span className="text-sm text-red-600 dark:text-red-400">
                      (-${(currentDeckValue - budget).toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>$0</span>
                <span>$100</span>
                <span>$200</span>
                <span>$300</span>
                <span>$400</span>
                <span>$500</span>
              </div>
            </div>

            {/* Optimization Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Optimization Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['power', 'consistency', 'speed'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPriorityMode(mode as any)}
                      className={`
                        px-3 py-2 rounded-lg text-sm font-medium capitalize
                        ${priorityMode === mode
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }
                      `}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Options
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeOwned}
                    onChange={(e) => setIncludeOwned(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Include owned cards in budget
                  </span>
                </label>
              </div>
            </div>

            {/* Optimize Button */}
            <button
              onClick={() => optimizeDeck()}
              disabled={optimizing}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {optimizing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Optimizing...
                </>
              ) : (
                <>
                  <AdjustmentsHorizontalIcon className="h-5 w-5" />
                  Optimize Deck
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                      ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'optimizer' && (
              <BudgetOptimizer
                deck={deck}
                optimization={optimization}
                budget={budget}
                currentValue={currentDeckValue}
                onApply={handleApplyOptimization}
              />
            )}
            {activeTab === 'alternatives' && (
              <BudgetAlternatives
                deck={deck}
                budget={budget}
                optimization={optimization}
              />
            )}
            {activeTab === 'upgrade' && (
              <UpgradePath
                deck={deck}
                currentValue={currentDeckValue}
                optimization={optimization}
              />
            )}
            {activeTab === 'results' && (
              <OptimizationResults
                optimization={optimization}
                originalValue={currentDeckValue}
                budget={budget}
              />
            )}
          </div>
        </div>

        {/* Quick Stats */}
        {optimization && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Savings</p>
                  <p className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
                    ${(currentDeckValue - (optimization.totalCost || 0)).toFixed(2)}
                  </p>
                </div>
                <CurrencyDollarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Performance</p>
                  <p className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {optimization.performanceScore || 0}%
                  </p>
                </div>
                <ChartBarIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Changes</p>
                  <p className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {optimization.optimizedDeck?.changes.length || 0}
                  </p>
                </div>
                <ArrowsRightLeftIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Value/Perf</p>
                  <p className="mt-2 text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {optimization.valueScore || 0}
                  </p>
                </div>
                <SparklesIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}