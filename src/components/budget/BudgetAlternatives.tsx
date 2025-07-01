'use client';

import React, { useState } from 'react';
import { 
  ArrowsRightLeftIcon, 
  CurrencyDollarIcon,
  ChevronRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import type { Deck, DeckCard, Card } from '@prisma/client';

interface BudgetAlternativesProps {
  deck: Deck & { cards: (DeckCard & { card: Card })[] } | null | undefined;
  budget: number;
  optimization: any;
}

interface CardAlternative {
  originalCard: string;
  originalPrice: number;
  alternatives: {
    name: string;
    price: number;
    performanceLoss: number;
    reason: string;
    recommended?: boolean;
  }[];
}

export default function BudgetAlternatives({ 
  deck, 
  budget,
  optimization 
}: BudgetAlternativesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pokemon' | 'trainer' | 'energy'>('all');
  const [showOnlyRecommended, setShowOnlyRecommended] = useState(false);

  if (!deck) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Loading deck...</p>
      </div>
    );
  }

  // Mock data for alternatives (in real app, this would come from API)
  const mockAlternatives: CardAlternative[] = [
    {
      originalCard: "Professor's Research",
      originalPrice: 2.50,
      alternatives: [
        { name: "Hop", price: 0.25, performanceLoss: 15, reason: "Draw 3 instead of 7", recommended: true },
        { name: "Sonia", price: 0.50, performanceLoss: 20, reason: "Search specific cards instead" },
        { name: "Cynthia's Ambition", price: 0.75, performanceLoss: 10, reason: "Draw 4-6 cards" }
      ]
    },
    {
      originalCard: "Boss's Orders",
      originalPrice: 5.00,
      alternatives: [
        { name: "Escape Rope", price: 0.50, performanceLoss: 25, reason: "Both players switch", recommended: true },
        { name: "Cross Switcher", price: 1.00, performanceLoss: 30, reason: "Requires 2 cards" },
        { name: "Pokémon Catcher", price: 0.25, performanceLoss: 50, reason: "Coin flip required" }
      ]
    },
    {
      originalCard: "Quick Ball",
      originalPrice: 3.00,
      alternatives: [
        { name: "Poké Ball", price: 0.25, performanceLoss: 60, reason: "Coin flip chance" },
        { name: "Great Ball", price: 0.50, performanceLoss: 30, reason: "Look at top 7 cards", recommended: true },
        { name: "Ultra Ball", price: 1.50, performanceLoss: 5, reason: "Discard 2 cards cost" }
      ]
    }
  ];

  const filteredAlternatives = mockAlternatives.filter(alt => {
    if (searchQuery && !alt.originalCard.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (showOnlyRecommended && !alt.alternatives.some(a => a.recommended)) {
      return false;
    }
    return true;
  });

  const totalPotentialSavings = filteredAlternatives.reduce((total, alt) => {
    const cheapestAlternative = Math.min(...alt.alternatives.map(a => a.price));
    return total + (alt.originalPrice - cheapestAlternative);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyRecommended}
                onChange={(e) => setShowOnlyRecommended(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Recommended only</span>
            </label>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
            >
              <option value="all">All Types</option>
              <option value="pokemon">Pokémon</option>
              <option value="trainer">Trainers</option>
              <option value="energy">Energy</option>
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-900 dark:text-green-100">
              Potential Additional Savings
            </span>
          </div>
          <span className="text-lg font-bold text-green-600 dark:text-green-400">
            ${totalPotentialSavings.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Alternatives List */}
      <div className="space-y-4">
        {filteredAlternatives.length > 0 ? (
          filteredAlternatives.map((cardAlt, idx) => (
            <div 
              key={idx}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {cardAlt.originalCard}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Current price: ${cardAlt.originalPrice.toFixed(2)}
                  </p>
                </div>
                <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 text-xs font-medium rounded-full">
                  {cardAlt.alternatives.length} alternatives
                </span>
              </div>

              <div className="space-y-3">
                {cardAlt.alternatives.map((alt, altIdx) => (
                  <div 
                    key={altIdx}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      alt.recommended 
                        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' 
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <ArrowsRightLeftIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {alt.name}
                          </p>
                          {alt.recommended && (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <CheckCircleIcon className="h-3 w-3" />
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{alt.reason}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">
                        ${alt.price.toFixed(2)}
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Save ${(cardAlt.originalPrice - alt.price).toFixed(2)}
                      </p>
                      <p className={`text-xs ${
                        alt.performanceLoss <= 10 ? 'text-green-600' :
                        alt.performanceLoss <= 25 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        -{alt.performanceLoss}% performance
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <InformationCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No alternatives found matching your criteria
            </p>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Apply Recommended Alternatives
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Automatically replace cards with their recommended budget alternatives
            </p>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            Apply All
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">
          💡 Budget Alternative Tips
        </h4>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <li>• Consider performance impact vs savings for each alternative</li>
          <li>• Some alternatives may require adjusting your deck strategy</li>
          <li>• Test alternatives in practice matches before committing</li>
          <li>• Prioritize alternatives for multiple copies of expensive cards</li>
        </ul>
      </div>
    </div>
  );
}