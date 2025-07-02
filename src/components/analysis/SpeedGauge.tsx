'use client';

import React from 'react';
import { ClockIcon, BoltIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import type { SpeedAnalysis, ArchetypeClassification } from '@/lib/analysis/types';

interface SpeedGaugeProps {
  speed: SpeedAnalysis;
  archetype: ArchetypeClassification;
}

export default function SpeedGauge({ speed, archetype }: SpeedGaugeProps) {
  if (!speed) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p>No speed data available</p>
      </div>
    );
  }

  const getSpeedRating = (setupTurn: number) => {
    if (setupTurn <= 1.5) return 'Lightning Fast';
    if (setupTurn <= 2) return 'Very Fast';
    if (setupTurn <= 2.5) return 'Fast';
    if (setupTurn <= 3) return 'Average';
    if (setupTurn <= 3.5) return 'Slow';
    return 'Very Slow';
  };

  const getSpeedColor = (setupTurn: number) => {
    if (setupTurn <= 2) return 'text-green-600 dark:text-green-400';
    if (setupTurn <= 2.5) return 'text-yellow-600 dark:text-yellow-400';
    if (setupTurn <= 3) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Speed Overview */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Deck Speed Analysis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              How quickly your deck sets up and executes
            </p>
          </div>
          <div className="text-center">
            <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <div className={`text-3xl font-bold ${getSpeedColor(speed.averageSetupTurn)}`}>
              Turn {speed.averageSetupTurn}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {getSpeedRating(speed.averageSetupTurn)}
            </p>
          </div>
        </div>
      </div>

      {/* Key Speed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <BoltIcon className="h-5 w-5 text-yellow-500" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {speed.averageSetupTurn.toFixed(1)}
            </span>
          </div>
          <h4 className="font-medium text-gray-900 dark:text-white">First Attack</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Setup by turn {speed.averageSetupTurn.toFixed(1)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <ChartBarIcon className="h-5 w-5 text-blue-500" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(speed.energyAttachmentEfficiency)}%
            </span>
          </div>
          <h4 className="font-medium text-gray-900 dark:text-white">Energy Efficiency</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Attachment optimization
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <ClockIcon className="h-5 w-5 text-green-500" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {speed.lateGameSustainability}%
            </span>
          </div>
          <h4 className="font-medium text-gray-900 dark:text-white">Sustainability</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Late game performance
          </p>
        </div>
      </div>

      {/* Setup Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Setup Timeline
        </h4>
        <div className="space-y-4">
          {/* Temporary placeholder for setup breakdown */}
          {[
            { phase: 'Basic Setup', averageTurn: 1, requirements: ['Basic Pokemon', 'Energy'] },
            { phase: 'Evolution Ready', averageTurn: 2, requirements: ['Evolution cards', 'Search'] },
            { phase: 'Full Power', averageTurn: speed.averageSetupTurn, requirements: ['Main attacker', 'Multiple energy'] }
          ].map((phase, idx) => (
            <div key={idx}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {phase.phase}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Turn {phase.averageTurn}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${(phase.averageTurn / 5) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {phase.requirements.join(', ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Prize Race Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Prize Race Speed
        </h4>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Damage Output</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {speed.prizeRaceSpeed.damageOutput}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">per turn</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">KO Efficiency</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {speed.prizeRaceSpeed.ohkoCapability ? '90' : '50'}%
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">one-shot potential</p>
          </div>
        </div>
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Prize trading efficiency compared to {archetype.primaryArchetype} archetype average
          </p>
        </div>
      </div>

      {/* Acceleration Options */}
      {/* Energy Acceleration section temporarily disabled
      {speed.accelerationOptions && speed.accelerationOptions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
            Energy Acceleration
          </h4>
          <div className="space-y-3">
            {speed.accelerationOptions.map((option, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="font-medium text-gray-900 dark:text-white">
                  {option.method}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {option.energyPerTurn} energy/turn
                </span>
              </div>
            ))}
          </div>
        </div>
      )} */}
    </div>
  );
}