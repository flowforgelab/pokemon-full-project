'use client';

import React from 'react';
import { 
  TrophyIcon, 
  ChevronUpIcon, 
  ChevronDownIcon,
  MinusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { XCircleIcon } from '@heroicons/react/24/outline';
import type { MetaGameAnalysis, MatchupAnalysis } from '@/lib/analysis/types';

interface MetaMatchupsProps {
  meta: MetaGameAnalysis;
  matchups: MatchupAnalysis[];
}

export default function MetaMatchups({ meta, matchups }: MetaMatchupsProps) {
  if (!meta || !matchups) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p>No meta matchup data available</p>
      </div>
    );
  }

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return 'text-green-600 dark:text-green-400';
    if (winRate >= 50) return 'text-blue-600 dark:text-blue-400';
    if (winRate >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getWinRateBg = (winRate: number) => {
    if (winRate >= 60) return 'bg-green-100 dark:bg-green-900/20';
    if (winRate >= 50) return 'bg-blue-100 dark:bg-blue-900/20';
    if (winRate >= 40) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const getMatchupIcon = (winRate: number) => {
    if (winRate >= 60) return ChevronUpIcon;
    if (winRate >= 40) return MinusIcon;
    return ChevronDownIcon;
  };

  const sortedMatchups = meta.popularMatchups ? [...meta.popularMatchups].sort((a, b) => b.winRate - a.winRate) : [];

  return (
    <div className="space-y-6">
      {/* Meta Position Overview */}
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Meta Game Position
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Performance against top competitive decks
            </p>
          </div>
          <div className="text-center">
            <TrophyIcon className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {meta.metaPosition.charAt(0).toUpperCase() + meta.metaPosition.slice(1)}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {meta.archetypeMatch || 'Unknown Archetype'}
            </p>
          </div>
        </div>
      </div>

      {/* Overall Meta Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Average Win Rate</p>
          <p className={`text-2xl font-bold mt-1 ${getWinRateColor(meta.popularMatchups?.reduce((acc, m) => acc + m.winRate, 0) / (meta.popularMatchups?.length || 1) || 50)}`}>
            {((meta.popularMatchups?.reduce((acc, m) => acc + m.winRate, 0) / (meta.popularMatchups?.length || 1)) || 50).toFixed(1)}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Favorable Matchups</p>
          <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
            {(meta.popularMatchups || []).filter(m => m.winRate >= 60).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Even Matchups</p>
          <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
            {(meta.popularMatchups || []).filter(m => m.winRate >= 40 && m.winRate < 60).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Unfavorable</p>
          <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
            {(meta.popularMatchups || []).filter(m => m.winRate < 40).length}
          </p>
        </div>
      </div>

      {/* Detailed Matchups */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Matchup Breakdown
        </h4>
        <div className="space-y-3">
          {sortedMatchups.map((matchup) => {
            const Icon = getMatchupIcon(matchup.winRate);
            return (
              <div 
                key={matchup.opponentArchetype}
                className={`rounded-lg p-4 ${getWinRateBg(matchup.winRate)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${getWinRateColor(matchup.winRate)}`} />
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white">
                        vs {matchup.opponentArchetype}
                      </h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {matchup.strategy}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getWinRateColor(matchup.winRate)}`}>
                      {matchup.winRate}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      win rate
                    </p>
                  </div>
                </div>
                
                {/* Key Factors */}
                <div className="mt-3 space-y-2">
                  {matchup.keyFactors.map((factor, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-gray-500 dark:text-gray-400 mt-0.5">•</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{factor}</span>
                    </div>
                  ))}
                </div>

                {/* Tech Cards - removed as not in data structure
                {false && matchup.techCards && matchup.techCards.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Recommended Tech Cards:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {matchup.techCards.map((card, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-1 text-xs bg-white dark:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300"
                        >
                          {card}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Counter Strategies */}
      {meta.counterStrategies && meta.counterStrategies.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
            Counter Strategies
          </h4>
          <div className="space-y-3">
            {meta.counterStrategies.map((strategy, idx) => (
              <div key={idx} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  Against {strategy.targetArchetype}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Effectiveness: {strategy.effectiveness}%
                </p>
                {strategy.cards && strategy.cards.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {strategy.cards.map((card, cardIdx) => (
                      <span 
                        key={cardIdx}
                        className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-800 rounded text-yellow-800 dark:text-yellow-200"
                      >
                        {card}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Format Legality */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Format Information
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-lg p-4 ${meta.formatEvaluation?.format === 'standard' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 dark:text-white">Standard</span>
              {meta.formatEvaluation?.format === 'standard' ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-gray-400" />
              )}
            </div>
            {meta.rotationImpact?.cardsRotating && meta.rotationImpact.cardsRotating.length > 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                {meta.rotationImpact.cardsRotating.length} cards rotating soon
              </p>
            )}
          </div>
          <div className={`rounded-lg p-4 ${meta.formatEvaluation?.format === 'expanded' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 dark:text-white">Expanded</span>
              {meta.formatEvaluation?.format === 'expanded' ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}