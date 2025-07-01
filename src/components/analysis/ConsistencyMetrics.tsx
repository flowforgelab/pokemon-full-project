'use client';

import React from 'react';
import { 
  HandRaisedIcon, 
  ChartBarIcon, 
  CubeIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import type { ConsistencyAnalysis } from '@/lib/analysis/types';

interface ConsistencyMetricsProps {
  consistency: ConsistencyAnalysis;
}

export default function ConsistencyMetrics({ consistency }: ConsistencyMetricsProps) {
  const getStatusIcon = (isOptimal: boolean) => {
    return isOptimal ? (
      <CheckCircleIcon className="h-5 w-5 text-green-500" />
    ) : (
      <XCircleIcon className="h-5 w-5 text-red-500" />
    );
  };

  const getPercentageColor = (value: number, threshold: number, inverse = false) => {
    if (inverse) {
      return value <= threshold ? 'text-green-600' : 'text-red-600';
    }
    return value >= threshold ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Overall Consistency Score */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Overall Consistency Score
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              How reliably your deck sets up and executes its strategy
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {consistency.overallConsistency}%
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {consistency.overallConsistency >= 75 ? 'Excellent' : 
               consistency.overallConsistency >= 60 ? 'Good' : 
               consistency.overallConsistency >= 45 ? 'Fair' : 'Poor'}
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Mulligan Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <HandRaisedIcon className="h-5 w-5 text-gray-400" />
            {getStatusIcon(consistency.mulliganProbability <= 15)}
          </div>
          <h4 className="font-medium text-gray-900 dark:text-white">Mulligan Rate</h4>
          <p className={`text-2xl font-bold mt-1 ${getPercentageColor(consistency.mulliganProbability, 15, true)}`}>
            {consistency.mulliganProbability.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {consistency.mulliganProbability <= 10 ? 'Excellent' : 
             consistency.mulliganProbability <= 15 ? 'Good' : 
             consistency.mulliganProbability <= 20 ? 'Average' : 'High'}
          </p>
        </div>

        {/* Dead Draw Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />
            {getStatusIcon(consistency.deadDrawProbability <= 20)}
          </div>
          <h4 className="font-medium text-gray-900 dark:text-white">Dead Draw Rate</h4>
          <p className={`text-2xl font-bold mt-1 ${getPercentageColor(consistency.deadDrawProbability, 20, true)}`}>
            {consistency.deadDrawProbability.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Chance of unplayable opening hand
          </p>
        </div>

        {/* Prize Resilience */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <CubeIcon className="h-5 w-5 text-gray-400" />
            {getStatusIcon(consistency.prizeCardImpact.resilience >= 70)}
          </div>
          <h4 className="font-medium text-gray-900 dark:text-white">Prize Resilience</h4>
          <p className={`text-2xl font-bold mt-1 ${getPercentageColor(consistency.prizeCardImpact.resilience, 70)}`}>
            {consistency.prizeCardImpact.resilience}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Strategy survives prized cards
          </p>
        </div>
      </div>

      {/* Energy Ratio Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BeakerIcon className="h-5 w-5" />
          Energy Configuration
        </h4>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Total Energy: {consistency.energyRatio.totalEnergy} cards ({consistency.energyRatio.energyPercentage.toFixed(1)}%)
              </span>
              {consistency.energyRatio.isOptimal ? (
                <span className="text-xs text-green-600 dark:text-green-400">Optimal</span>
              ) : (
                <span className="text-xs text-red-600 dark:text-red-400">
                  Recommended: {consistency.energyRatio.recommendedRange.min}-{consistency.energyRatio.recommendedRange.max}%
                </span>
              )}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${consistency.energyRatio.isOptimal ? 'bg-green-500' : 'bg-yellow-500'}`}
                style={{ width: `${Math.min(consistency.energyRatio.energyPercentage, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Basic Energy</span>
              <p className="font-medium text-gray-900 dark:text-white">{consistency.energyRatio.basicEnergy}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Special Energy</span>
              <p className="font-medium text-gray-900 dark:text-white">{consistency.energyRatio.specialEnergy}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Energy Search</span>
              <p className="font-medium text-gray-900 dark:text-white">{consistency.energyRatio.energySearch}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Probabilities */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ChartBarIcon className="h-5 w-5" />
          Setup Probabilities
        </h4>
        <div className="space-y-3">
          {consistency.setupProbabilities.map((setup) => (
            <div key={setup.turn}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Turn {setup.turn}: {setup.scenario}
                </span>
                <span className={`text-sm font-bold ${getPercentageColor(setup.probability, 70)}`}>
                  {setup.probability}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    setup.probability >= 80 ? 'bg-green-500' : 
                    setup.probability >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${setup.probability}%` }}
                />
              </div>
              {setup.keyCards.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Key cards: {setup.keyCards.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Trainer Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Trainer Balance
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {consistency.trainerDistribution.drawPower}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Draw Power</p>
            {consistency.trainerDistribution.balance.drawPower ? (
              <CheckCircleIcon className="h-4 w-4 text-green-500 mx-auto mt-1" />
            ) : (
              <XCircleIcon className="h-4 w-4 text-red-500 mx-auto mt-1" />
            )}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {consistency.trainerDistribution.search}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Search</p>
            {consistency.trainerDistribution.balance.search ? (
              <CheckCircleIcon className="h-4 w-4 text-green-500 mx-auto mt-1" />
            ) : (
              <XCircleIcon className="h-4 w-4 text-red-500 mx-auto mt-1" />
            )}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {consistency.trainerDistribution.disruption}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Disruption</p>
            {consistency.trainerDistribution.balance.disruption ? (
              <CheckCircleIcon className="h-4 w-4 text-green-500 mx-auto mt-1" />
            ) : (
              <XCircleIcon className="h-4 w-4 text-red-500 mx-auto mt-1" />
            )}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {consistency.trainerDistribution.utility}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Utility</p>
            {consistency.trainerDistribution.balance.utility ? (
              <CheckCircleIcon className="h-4 w-4 text-green-500 mx-auto mt-1" />
            ) : (
              <XCircleIcon className="h-4 w-4 text-red-500 mx-auto mt-1" />
            )}
          </div>
        </div>
      </div>

      {/* Pokemon Ratio */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Pokémon Composition
        </h4>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Total Pokémon</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {consistency.pokemonRatio.totalPokemon}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Basic Pokémon</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {consistency.pokemonRatio.basics}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Evolution Cards</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {consistency.pokemonRatio.evolutions}
              </p>
            </div>
          </div>
          {!consistency.pokemonRatio.pokemonBalance && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ Pokemon balance could be improved for better consistency
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}