'use client';

import React from 'react';
import { 
  ChartBarIcon, 
  CurrencyDollarIcon,
  TrophyIcon,
  SparklesIcon,
  DocumentTextIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusIcon
} from '@heroicons/react/24/outline';

interface OptimizationResultsProps {
  optimization: any;
  originalValue: number;
  budget: number;
}

export default function OptimizationResults({ 
  optimization, 
  originalValue, 
  budget 
}: OptimizationResultsProps) {
  if (!optimization) {
    return (
      <div className="text-center py-8">
        <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          No optimization results yet
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Configure your budget and run optimization first
        </p>
      </div>
    );
  }

  const savings = originalValue - (optimization.totalCost || 0);
  const savingsPercentage = (savings / originalValue) * 100;
  const budgetUtilization = ((optimization.totalCost || 0) / budget) * 100;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 75) return 'text-blue-600 dark:text-blue-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200';
    if (score >= 75) return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200';
    return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200';
  };

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Financial Impact
        </h3>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Savings</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              ${savings.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {savingsPercentage.toFixed(1)}% reduction
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Budget Used</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {budgetUtilization.toFixed(0)}%
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              ${optimization.totalCost?.toFixed(2)} of ${budget}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Original deck value</span>
            <span className="font-medium text-gray-900 dark:text-white">
              ${originalValue.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-600 dark:text-gray-400">Optimized deck value</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              ${optimization.totalCost?.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Performance Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ChartBarIcon className="h-5 w-5" />
          Performance Analysis
        </h4>

        <div className="space-y-4">
          {/* Overall Performance */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Overall Performance
              </span>
              <span className={`text-lg font-bold ${getScoreColor(optimization.performanceScore || 0)}`}>
                {optimization.performanceScore || 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
                  optimization.performanceScore >= 90 ? 'bg-green-600' :
                  optimization.performanceScore >= 75 ? 'bg-blue-600' :
                  optimization.performanceScore >= 60 ? 'bg-yellow-600' :
                  'bg-red-600'
                }`}
                style={{ width: `${optimization.performanceScore || 0}%` }}
              />
            </div>
          </div>

          {/* Detailed Scores */}
          {optimization.scores && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className={`rounded-lg p-3 ${getScoreBadge(optimization.scores.consistency || 0)}`}>
                <p className="text-sm font-medium">Consistency</p>
                <p className="text-2xl font-bold mt-1">{optimization.scores.consistency || 0}%</p>
              </div>
              <div className={`rounded-lg p-3 ${getScoreBadge(optimization.scores.power || 0)}`}>
                <p className="text-sm font-medium">Power</p>
                <p className="text-2xl font-bold mt-1">{optimization.scores.power || 0}</p>
              </div>
              <div className={`rounded-lg p-3 ${getScoreBadge(optimization.scores.speed || 0)}`}>
                <p className="text-sm font-medium">Speed</p>
                <p className="text-2xl font-bold mt-1">{optimization.scores.speed || 0}</p>
              </div>
              <div className={`rounded-lg p-3 ${getScoreBadge(optimization.scores.synergy || 0)}`}>
                <p className="text-sm font-medium">Synergy</p>
                <p className="text-2xl font-bold mt-1">{optimization.scores.synergy || 0}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trade-offs Analysis */}
      {optimization.tradeoffs && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5" />
            Optimization Trade-offs
          </h4>
          
          <div className="space-y-3">
            {optimization.tradeoffs.maintained && optimization.tradeoffs.maintained.length > 0 && (
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                  ✓ Maintained
                </p>
                <ul className="space-y-1">
                  {optimization.tradeoffs.maintained.map((item: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {optimization.tradeoffs.compromised && optimization.tradeoffs.compromised.length > 0 && (
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                  ⚠ Adjusted
                </p>
                <ul className="space-y-1">
                  {optimization.tradeoffs.compromised.map((item: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                      <MinusIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {optimization.tradeoffs.lost && optimization.tradeoffs.lost.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                  ✗ Removed
                </p>
                <ul className="space-y-1">
                  {optimization.tradeoffs.lost.map((item: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                      <XCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Value Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <TrophyIcon className="h-5 w-5" />
          Value Analysis
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Value Score</p>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {optimization.valueScore || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Performance per dollar
            </p>
          </div>

          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">ROI</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {((savings / budget) * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Return on investment
            </p>
          </div>
        </div>

        {optimization.recommendation && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
              Recommendation
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {optimization.recommendation}
            </p>
          </div>
        )}
      </div>

      {/* Next Steps */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <ArrowTrendingUpIcon className="h-5 w-5" />
          Next Steps
        </h4>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <li>• Review the specific card changes in the Budget Optimizer tab</li>
          <li>• Check card alternatives for additional savings options</li>
          <li>• Consider the upgrade path for future improvements</li>
          <li>• Apply the optimization to update your deck</li>
        </ul>
      </div>
    </div>
  );
}