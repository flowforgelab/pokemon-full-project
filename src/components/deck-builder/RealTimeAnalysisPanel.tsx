'use client';

import React, { useState } from 'react';
import {
  ChartBarIcon,
  SparklesIcon,
  ClockIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  PlayIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { DeckAnalysisResult } from '@/lib/analysis/types';
import type { Card } from '@prisma/client';

interface RealTimeAnalysisPanelProps {
  deckId?: string;
  totalCards: number;
  cards: { card: Card; count: number }[];
  format: string;
  analysis?: Partial<DeckAnalysisResult> | null;
  isAnalyzing?: boolean;
}

export default function RealTimeAnalysisPanel({
  deckId,
  totalCards,
  cards,
  format,
  analysis,
  isAnalyzing = false
}: RealTimeAnalysisPanelProps) {
  const [activeSection, setActiveSection] = useState<string | null>('validation');

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBadge = (score?: number) => {
    if (!score) return 'bg-gray-100 dark:bg-gray-700';
    if (score >= 80) return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
  };

  // Calculate deck value
  const deckValue = cards.reduce((total, { card, count }) => {
    const cardPrice = card.prices?.find(p => p.currency === 'USD')?.price || 0;
    return total + (Number(cardPrice) * count);
  }, 0);

  const sections = [
    { id: 'validation', name: 'Validation', icon: CheckCircleIcon },
    { id: 'scores', name: 'Scores', icon: ChartBarIcon },
    { id: 'consistency', name: 'Consistency', icon: ShieldCheckIcon },
    { id: 'speed', name: 'Speed', icon: ClockIcon },
    { id: 'suggestions', name: 'Suggestions', icon: SparklesIcon },
    { id: 'budget', name: 'Budget', icon: CurrencyDollarIcon },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Real-Time Analysis
        </h2>
        {deckId && (
          <Link
            href={`/decks/${deckId}/analyze`}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            Full Analysis
            <ChevronRightIcon className="h-3 w-3" />
          </Link>
        )}
      </div>

      {totalCards > 0 ? (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400">Cards</p>
              <p className={`text-lg font-bold ${totalCards === 60 ? 'text-green-600' : 'text-yellow-600'}`}>
                {totalCards}/60
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400">Value</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                ${deckValue.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                className={`
                  flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap
                  ${activeSection === section.id
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                <section.icon className="h-3 w-3" />
                {section.name}
              </button>
            ))}
          </div>

          {/* Validation Section */}
          {activeSection === 'validation' && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <InformationCircleIcon className="h-5 w-5" />
                Deck Validation
              </h3>
              <div className="space-y-1 text-sm">
                {totalCards !== 60 && (
                  <p className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    Deck must have exactly 60 cards ({60 - totalCards} {totalCards < 60 ? 'more' : 'less'} needed)
                  </p>
                )}
                {analysis?.warnings?.map((warning, index) => (
                  <p key={index} className="text-red-600 dark:text-red-400 flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    {warning.message}
                  </p>
                ))}
                {totalCards === 60 && (!analysis?.warnings || analysis.warnings.length === 0) && (
                  <p className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircleIcon className="h-4 w-4" />
                    Deck is valid for {format} format
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Scores Section */}
          {activeSection === 'scores' && analysis?.scores && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5" />
                Performance Scores
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Overall</span>
                  <span className={`text-lg font-bold ${getScoreColor(analysis?.scores?.overall)}`}>
                    {analysis?.scores?.overall || '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Consistency</span>
                  <span className={`font-medium ${getScoreColor(analysis?.scores?.consistency)}`}>
                    {analysis?.scores?.consistency || '--'}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Power</span>
                  <span className={`font-medium ${getScoreColor(analysis?.scores?.power)}`}>
                    {analysis?.scores?.power || '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Speed</span>
                  <span className={`font-medium ${getScoreColor(analysis?.scores?.speed)}`}>
                    {analysis?.scores?.speed || '--'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Consistency Section */}
          {activeSection === 'consistency' && analysis?.consistency && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5" />
                Consistency Analysis
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Mulligan Rate</span>
                  <span className={`font-medium ${
                    (analysis?.consistency?.mulliganProbability || 0) <= 15 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {analysis?.consistency?.mulliganProbability?.toFixed(1) || '--'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Energy Balance</span>
                  <span className={`font-medium ${
                    analysis.consistency.energyRatio?.isOptimal ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {analysis.consistency.energyRatio?.isOptimal ? 'Good' : 'Adjust'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Draw Power</span>
                  <span className="font-medium">
                    {analysis.consistency.trainerDistribution?.drawPower || 0} cards
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Speed Section */}
          {activeSection === 'speed' && analysis?.speed && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ClockIcon className="h-5 w-5" />
                Speed Metrics
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Setup Turn</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    Turn {analysis?.speed?.averageSetupTurn || '--'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Speed Rating</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {analysis?.speed?.overallSpeed || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Archetype</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {analysis.archetype?.primaryArchetype || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Suggestions Section */}
          {activeSection === 'suggestions' && (
            <div className="bg-blue-50 dark:bg-blue-900/50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <SparklesIcon className="h-5 w-5" />
                Quick Suggestions
              </h3>
              {analysis?.recommendations && analysis.recommendations.length > 0 ? (
                <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {analysis.recommendations.slice(0, 3).map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-blue-600 dark:text-blue-400">•</span>
                      <span>{rec.action}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {isAnalyzing ? 'Analyzing deck...' : 'Complete deck for suggestions'}
                </div>
              )}
            </div>
          )}

          {/* Budget Section */}
          {activeSection === 'budget' && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CurrencyDollarIcon className="h-5 w-5" />
                Budget Analysis
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Value</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      ${deckValue.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {deckValue < 50 ? 'Budget' : 
                     deckValue < 150 ? 'Standard' : 
                     deckValue < 300 ? 'Competitive' : 'Premium'} Tier
                  </div>
                </div>
                
                {/* Most Expensive Cards */}
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Most Expensive:
                  </p>
                  {cards
                    .filter(({ card }) => card.prices?.some(p => p.currency === 'USD'))
                    .sort((a, b) => {
                      const aPrice = Number(a.card.prices?.find(p => p.currency === 'USD')?.price || 0);
                      const bPrice = Number(b.card.prices?.find(p => p.currency === 'USD')?.price || 0);
                      return bPrice - aPrice;
                    })
                    .slice(0, 3)
                    .map(({ card, count }) => {
                      const price = Number(card.prices?.find(p => p.currency === 'USD')?.price || 0);
                      return (
                        <div key={card.id} className="flex justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                            {count}x {card.name}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ${(price * count).toFixed(2)}
                          </span>
                        </div>
                      );
                    })
                  }
                </div>

                <button className="w-full text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-md px-2 py-1 hover:bg-green-200 dark:hover:bg-green-900/30">
                  Find Budget Alternatives
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm">
              <PlayIcon className="h-4 w-4" />
              Test Opening Hands
            </button>
            
            {deckId && (
              <Link
                href={`/decks/${deckId}/analyze`}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <ArrowTrendingUpIcon className="h-4 w-4" />
                View Full Analysis
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8">
            <SparklesIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              Add cards to see real-time analysis
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Get instant feedback on consistency, speed, and strategy
            </p>
          </div>
        </div>
      )}
    </div>
  );
}