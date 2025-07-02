'use client';

import React, { useState } from 'react';
import { 
  PlusIcon, 
  MinusIcon, 
  ArrowsRightLeftIcon,
  SparklesIcon,
  InformationCircleIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { api } from '@/utils/api';
import Image from 'next/image';
import type { Recommendation, AnalysisWarning } from '@/lib/analysis/types';

interface CardRecommendationsProps {
  recommendations: Recommendation[];
  warnings: AnalysisWarning[];
  deckId: string;
  onApplyRecommendation?: (recommendation: Recommendation) => void;
}

// Popular staple cards for different categories
const STAPLE_CARDS = {
  draw: [
    { name: 'Professor\'s Research', reason: 'Draw 7 cards - essential draw support' },
    { name: 'Radiant Greninja', reason: 'Draw 2 cards when you discard an energy' },
    { name: 'Bibarel', reason: 'Draw until you have 5 cards in hand each turn' },
  ],
  search: [
    { name: 'Ultra Ball', reason: 'Search for any Pokemon' },
    { name: 'Quick Ball', reason: 'Search for Basic Pokemon' },
    { name: 'Nest Ball', reason: 'Search for Basic Pokemon and bench it' },
    { name: 'VIP Pass', reason: 'Search for 2 Basic Pokemon on first turn' },
  ],
  energy: [
    { name: 'Energy Search', reason: 'Search for a basic energy' },
    { name: 'Energy Retrieval', reason: 'Return 2 basic energy from discard' },
    { name: 'Energy Recovery', reason: 'Return 3 basic energy to deck' },
    { name: 'Twin Energy', reason: 'Provides 2 colorless for non-V/GX' },
  ],
  disruption: [
    { name: 'Lost City', reason: 'Send KO\'d Pokemon to Lost Zone' },
    { name: 'Path to the Peak', reason: 'Shut down Rule Box abilities' },
    { name: 'Judge', reason: 'Both players shuffle and draw 4' },
    { name: 'Iono', reason: 'Shuffle and draw cards equal to prizes' },
  ],
  utility: [
    { name: 'Switch', reason: 'Switch your Active Pokemon' },
    { name: 'Super Rod', reason: 'Return Pokemon and energy to deck' },
    { name: 'Ordinary Rod', reason: 'Return 2 Pokemon or basic energy' },
    { name: 'Boss\'s Orders', reason: 'Gust opponent\'s benched Pokemon' },
  ]
};

export default function CardRecommendations({ 
  recommendations, 
  warnings, 
  deckId,
  onApplyRecommendation 
}: CardRecommendationsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStaples, setShowStaples] = useState(false);

  // Fetch card data for recommendations
  const { data: cardSearchResults } = api.card.search.useQuery(
    { query: searchQuery, limit: 10 },
    { enabled: searchQuery.length > 2 }
  );

  // Group recommendations by type
  const groupedRecommendations = recommendations.reduce((acc, rec) => {
    const type = rec.type || 'general';
    if (!acc[type]) acc[type] = [];
    acc[type].push(rec);
    return acc;
  }, {} as Record<string, Recommendation[]>);

  // Extract improvement areas from warnings
  const improvementAreas = warnings
    .filter(w => w.suggestion)
    .map(w => ({
      category: w.category,
      issue: w.message,
      suggestion: w.suggestion || ''
    }));

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'add': return PlusIcon;
      case 'remove': return MinusIcon;
      case 'replace': return ArrowsRightLeftIcon;
      default: return SparklesIcon;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'add': return 'text-green-600 dark:text-green-400';
      case 'remove': return 'text-red-600 dark:text-red-400';
      case 'replace': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-purple-600 dark:text-purple-400';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Improvement Areas */}
      {improvementAreas.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <InformationCircleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            Areas for Improvement
          </h3>
          <div className="space-y-3">
            {improvementAreas.map((area, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <ChevronRightIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{area.category}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{area.issue}</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    → {area.suggestion}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specific Recommendations */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Specific Card Changes
        </h3>
        
        {Object.entries(groupedRecommendations).map(([type, recs]) => {
          const TypeIcon = getTypeIcon(type);
          return (
            <div key={type} className="mb-6 last:mb-0">
              <h4 className={`font-medium mb-3 flex items-center gap-2 ${getTypeColor(type)}`}>
                <TypeIcon className="h-5 w-5" />
                {type === 'add' ? 'Add Cards' : 
                 type === 'remove' ? 'Remove Cards' : 
                 type === 'replace' ? 'Replace Cards' : 'Adjust Cards'}
              </h4>
              <div className="space-y-3">
                {recs.map((rec, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium px-2 py-1 rounded ${getPriorityBadge(rec.priority)}`}>
                            {rec.priority}
                          </span>
                          {rec.card && (
                            <span className="font-medium text-gray-900 dark:text-white">
                              {rec.quantity ? `${rec.quantity}x ` : ''}{rec.card}
                            </span>
                          )}
                          {rec.targetCard && (
                            <>
                              <ArrowsRightLeftIcon className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-gray-900 dark:text-white">
                                {rec.targetCard}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {rec.reason}
                        </p>
                        {rec.impact && (
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                            Impact: {rec.impact}
                          </p>
                        )}
                      </div>
                      {onApplyRecommendation && (
                        <button
                          onClick={() => onApplyRecommendation(rec)}
                          className="ml-4 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                    {rec.alternativeOptions && rec.alternativeOptions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Alternative options:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {rec.alternativeOptions.map((alt, altIdx) => (
                            <span 
                              key={altIdx}
                              className="text-xs px-2 py-1 bg-white dark:bg-gray-600 rounded"
                            >
                              {alt}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {recommendations.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <SparklesIcon className="h-12 w-12 mx-auto mb-3" />
            <p>No specific recommendations at this time</p>
            <p className="text-sm mt-1">Your deck is well-balanced!</p>
          </div>
        )}
      </div>

      {/* Staple Cards Suggestions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Staple Card Suggestions
          </h3>
          <button
            onClick={() => setShowStaples(!showStaples)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showStaples ? 'Hide' : 'Show'} Staples
          </button>
        </div>

        {showStaples && (
          <div className="space-y-4">
            {Object.entries(STAPLE_CARDS).map(([category, cards]) => (
              <div key={category}>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
                  {category} Support
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {cards.map((card, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                    >
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {card.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {card.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          Search for Cards to Add
        </h3>
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search for cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>

        {cardSearchResults && cardSearchResults.cards.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {cardSearchResults.cards.map((card) => (
              <div 
                key={card.id}
                className="relative group cursor-pointer"
                onClick={() => {
                  if (onApplyRecommendation) {
                    onApplyRecommendation({
                      type: 'add',
                      priority: 'medium',
                      card: card.name,
                      quantity: 1,
                      reason: 'Manual addition',
                      impact: 'User selected card'
                    });
                  }
                }}
              >
                <div className="aspect-[2.5/3.5] relative rounded-lg overflow-hidden">
                  <Image
                    src={card.imageUrl}
                    alt={card.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-xs text-white font-medium truncate">{card.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}