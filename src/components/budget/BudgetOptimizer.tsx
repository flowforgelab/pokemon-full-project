'use client';

import React, { useState } from 'react';
import { 
  CurrencyDollarIcon, 
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import type { Deck, DeckCard, Card } from '@prisma/client';

interface BudgetOptimizerProps {
  deck: Deck & { cards: (DeckCard & { card: Card })[] } | null | undefined;
  optimization: any;
  budget: number;
  currentValue: number;
  onApply: () => void;
}

export default function BudgetOptimizer({ 
  deck, 
  optimization, 
  budget, 
  currentValue,
  onApply 
}: BudgetOptimizerProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!deck) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Loading deck...</p>
      </div>
    );
  }

  if (!optimization) {
    return (
      <div className="text-center py-8">
        <InformationCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          Click "Optimize Deck" to start budget optimization
        </p>
      </div>
    );
  }

  const savings = currentValue - (optimization.totalCost || 0);
  const performanceRetained = optimization.performanceScore || 0;
  const changes = optimization.optimizedDeck?.changes || [];

  return (
    <div className="space-y-6">
      {/* Optimization Summary */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Optimization Complete
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Found optimal configuration within budget
            </p>
          </div>
          <div className="text-center">
            <CurrencyDollarIcon className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${savings.toFixed(2)}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">saved</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">New Cost</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${optimization.totalCost?.toFixed(2) || '0.00'}
              </p>
            </div>
            <ArrowTrendingDownIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-600 dark:bg-green-400"
                style={{ width: `${(optimization.totalCost / currentValue) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {((optimization.totalCost / currentValue) * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Performance</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {performanceRetained}%
              </p>
            </div>
            <div className={`h-8 w-8 ${performanceRetained >= 90 ? 'text-green-600' : performanceRetained >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
              <CheckCircleIcon />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {performanceRetained >= 90 ? 'Excellent' : performanceRetained >= 75 ? 'Good' : 'Acceptable'} performance retained
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Changes</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {changes.length}
              </p>
            </div>
            <ArrowsRightLeftIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Card substitutions made
          </p>
        </div>
      </div>

      {/* Optimization Strategy */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Optimization Strategy Used
        </h4>
        <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
            <span>Maintained core deck strategy and win conditions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
            <span>Prioritized essential Pokémon and key trainers</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
            <span>Found budget alternatives for expensive support cards</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
            <span>Optimized energy ratios for consistency</span>
          </li>
        </ul>
      </div>

      {/* Card Changes */}
      {changes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900 dark:text-white">
              Recommended Changes ({changes.length})
            </h4>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </button>
          </div>

          {showDetails ? (
            <div className="space-y-3">
              {changes.map((change: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ArrowsRightLeftIcon className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {change.action === 'replace' && `Replace ${change.oldCard} with ${change.newCard}`}
                        {change.action === 'remove' && `Remove ${change.card}`}
                        {change.action === 'add' && `Add ${change.card}`}
                        {change.action === 'adjust' && `Adjust ${change.card} quantity`}
                      </p>
                      {change.reason && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{change.reason}</p>
                      )}
                    </div>
                  </div>
                  {change.savings && (
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      -${change.savings.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {changes.slice(0, 6).map((change: any, idx: number) => (
                <div key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                  • {change.oldCard || change.card} → {change.newCard || 'Remove'}
                </div>
              ))}
              {changes.length > 6 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                  +{changes.length - 6} more changes...
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {optimization.warnings && optimization.warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            Optimization Notes
          </h4>
          <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
            {optimization.warnings.map((warning: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Apply Button */}
      <div className="flex justify-end">
        <button
          onClick={onApply}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
        >
          <CheckCircleIcon className="h-5 w-5" />
          Apply Optimization
        </button>
      </div>
    </div>
  );
}