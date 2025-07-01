'use client';

import React, { useState } from 'react';
import { 
  ArrowTrendingUpIcon, 
  CurrencyDollarIcon,
  ChartBarIcon,
  RocketLaunchIcon,
  SparklesIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import type { Deck, DeckCard, Card } from '@prisma/client';

interface UpgradePathProps {
  deck: Deck & { cards: (DeckCard & { card: Card })[] } | null | undefined;
  currentValue: number;
  optimization: any;
}

interface UpgradeTier {
  name: string;
  budget: number;
  performanceGain: number;
  cards: {
    name: string;
    quantity: number;
    price: number;
    impact: string;
  }[];
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export default function UpgradePath({ 
  deck, 
  currentValue,
  optimization 
}: UpgradePathProps) {
  const [selectedTier, setSelectedTier] = useState<number>(0);

  if (!deck) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Loading deck...</p>
      </div>
    );
  }

  // Mock upgrade tiers (in real app, this would be calculated based on deck analysis)
  const upgradeTiers: UpgradeTier[] = [
    {
      name: "Essential Upgrades",
      budget: 25,
      performanceGain: 15,
      cards: [
        { name: "Professor's Research", quantity: 2, price: 5.00, impact: "Consistency +10%" },
        { name: "Quick Ball", quantity: 2, price: 6.00, impact: "Setup speed +15%" },
        { name: "Boss's Orders", quantity: 1, price: 5.00, impact: "Win rate +8%" }
      ],
      description: "Core consistency improvements that significantly enhance deck reliability",
      icon: CheckCircleIcon,
      color: "green"
    },
    {
      name: "Competitive Edge",
      budget: 75,
      performanceGain: 25,
      cards: [
        { name: "Path to the Peak", quantity: 2, price: 15.00, impact: "Meta counter +20%" },
        { name: "Irida", quantity: 2, price: 8.00, impact: "Water consistency +15%" },
        { name: "Cross Switcher", quantity: 2, price: 10.00, impact: "Flexibility +12%" },
        { name: "Training Court", quantity: 2, price: 4.00, impact: "Energy efficiency +10%" }
      ],
      description: "Strategic upgrades that improve matchups against popular decks",
      icon: ChartBarIcon,
      color: "blue"
    },
    {
      name: "Tournament Ready",
      budget: 150,
      performanceGain: 40,
      cards: [
        { name: "Radiant Greninja", quantity: 1, price: 25.00, impact: "Draw power +20%" },
        { name: "Lost City", quantity: 1, price: 15.00, impact: "Lost Box counter +25%" },
        { name: "Superior Energy Retrieval", quantity: 2, price: 12.00, impact: "Late game +15%" },
        { name: "Colress's Experiment", quantity: 3, price: 18.00, impact: "Setup consistency +18%" }
      ],
      description: "Premium cards that optimize performance for competitive play",
      icon: TrophyIcon,
      color: "purple"
    },
    {
      name: "Pro Circuit",
      budget: 300,
      performanceGain: 50,
      cards: [
        { name: "Computer Search ACE", quantity: 1, price: 80.00, impact: "Versatility +30%" },
        { name: "Tropical Beach", quantity: 2, price: 150.00, impact: "Setup alternative +25%" },
        { name: "Secret Rare Trainers", quantity: 4, price: 40.00, impact: "Bling factor +100%" }
      ],
      description: "Top-tier cards including ACE SPECs and premium versions",
      icon: RocketLaunchIcon,
      color: "yellow"
    }
  ];

  const selectedTierData = upgradeTiers[selectedTier];
  const Icon = selectedTierData.icon;

  const cumulativeBudget = upgradeTiers.slice(0, selectedTier + 1).reduce((sum, tier) => sum + tier.budget, 0);
  const cumulativePerformance = upgradeTiers.slice(0, selectedTier + 1).reduce((sum, tier) => sum + tier.performanceGain, 0);

  return (
    <div className="space-y-6">
      {/* Upgrade Path Overview */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Progressive Upgrade Path
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Structured improvements to maximize your investment
            </p>
          </div>
          <ArrowTrendingUpIcon className="h-12 w-12 text-purple-500" />
        </div>
      </div>

      {/* Tier Selection */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {upgradeTiers.map((tier, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedTier(idx)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedTier === idx
                ? `bg-${tier.color}-100 dark:bg-${tier.color}-900/20 text-${tier.color}-800 dark:text-${tier.color}-200`
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <tier.icon className="h-5 w-5" />
            {tier.name}
          </button>
        ))}
      </div>

      {/* Selected Tier Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <Icon className={`h-8 w-8 text-${selectedTierData.color}-600`} />
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedTierData.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedTierData.description}
                </p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${selectedTierData.budget}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              +{selectedTierData.performanceGain}% performance
            </p>
          </div>
        </div>

        {/* Upgrade Cards */}
        <div className="space-y-3 mt-6">
          {selectedTierData.cards.map((card, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <SparklesIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {card.quantity}x {card.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{card.impact}</p>
                </div>
              </div>
              <p className="font-medium text-gray-900 dark:text-white">
                ${card.price.toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Tier Summary */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tier Investment</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                ${selectedTierData.budget}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Performance Gain</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                +{selectedTierData.performanceGain}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cumulative Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Upgrade Progress Tracker
        </h4>

        <div className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Total Investment</span>
              <span className="font-medium text-gray-900 dark:text-white">
                ${cumulativeBudget} / ${upgradeTiers.reduce((sum, tier) => sum + tier.budget, 0)}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500"
                style={{ 
                  width: `${(cumulativeBudget / upgradeTiers.reduce((sum, tier) => sum + tier.budget, 0)) * 100}%` 
                }}
              />
            </div>
          </div>

          {/* Performance Impact */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Performance Improvement</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                +{cumulativePerformance}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${Math.min(cumulativePerformance, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Suggested Timeline
          </p>
          <div className="space-y-2">
            {upgradeTiers.map((tier, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  idx <= selectedTier ? 'bg-green-100 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  {idx <= selectedTier ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <ClockIcon className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    idx <= selectedTier ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {tier.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {idx === 0 ? 'Start here' : `After ${idx * 2}-${idx * 3} weeks`}
                  </p>
                </div>
                <span className={`text-sm font-medium ${
                  idx <= selectedTier ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                }`}>
                  ${tier.budget}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              Ready to upgrade?
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Start with {selectedTierData.name} for immediate improvements
            </p>
          </div>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
            View Shopping List
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}