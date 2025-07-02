'use client';

import React from 'react';
import { 
  ChartBarIcon, 
  ShieldCheckIcon, 
  BoltIcon, 
  ClockIcon,
  TrophyIcon,
  AcademicCapIcon,
  SparklesIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';
import type { DeckAnalysisResult } from '@/lib/analysis/types';
import type { Deck, DeckCard, Card } from '@prisma/client';

interface AnalysisOverviewProps {
  analysis: DeckAnalysisResult;
  deck: Deck & { cards: (DeckCard & { card: Card })[] } | null | undefined;
}

export default function AnalysisOverview({ analysis, deck }: AnalysisOverviewProps) {
  if (!analysis || !analysis.scores) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p>No analysis data available</p>
      </div>
    );
  }

  const scores = analysis.scores;
  const performance = analysis.performance;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900';
    return 'bg-red-100 dark:bg-red-900';
  };

  const scoreMetrics = [
    {
      name: 'Overall Score',
      value: scores.overall,
      icon: ChartBarIcon,
      description: 'Comprehensive deck evaluation',
    },
    {
      name: 'Consistency',
      value: scores.consistency,
      icon: ShieldCheckIcon,
      description: 'Reliability and setup consistency',
    },
    {
      name: 'Power Level',
      value: scores.power,
      icon: BoltIcon,
      description: 'Damage output and win conditions',
    },
    {
      name: 'Speed',
      value: scores.speed,
      icon: ClockIcon,
      description: 'Setup and execution speed',
    },
    {
      name: 'Versatility',
      value: scores.versatility,
      icon: AcademicCapIcon,
      description: 'Adaptability to different matchups',
    },
    {
      name: 'Meta Relevance',
      value: scores.metaRelevance,
      icon: TrophyIcon,
      description: 'Performance against top decks',
    },
    {
      name: 'Innovation',
      value: scores.innovation,
      icon: SparklesIcon,
      description: 'Unique strategies and surprise factor',
    },
    {
      name: 'Difficulty',
      value: scores.difficulty,
      icon: BeakerIcon,
      description: 'Skill requirement to pilot effectively',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Score Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {scoreMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.name} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-5 w-5 text-gray-400" />
                <span className={`text-2xl font-bold ${getScoreColor(metric.value)}`}>
                  {metric.value}
                </span>
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white">{metric.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {metric.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Performance Prediction */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Performance Prediction
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Tournament Win Rate</p>
            <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">
              {(performance.tournamentWinRate * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Local Meta Win Rate</p>
            <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">
              {(performance.localMetaWinRate * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Online Win Rate</p>
            <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">
              {(performance.onlineWinRate * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Archetype Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Archetype Classification
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Primary: {analysis.archetype.primaryArchetype}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {analysis.archetype.confidence}% confidence
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${analysis.archetype.confidence}%` }}
              />
            </div>
          </div>
          
          {analysis.archetype.secondaryArchetypes.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Secondary Archetypes:
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.archetype.secondaryArchetypes.map((arch) => (
                  <span 
                    key={arch}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300"
                  >
                    {arch}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <p className="text-sm text-gray-600 dark:text-gray-400 italic">
            {analysis.archetype.description}
          </p>
        </div>
      </div>

      {/* Key Strengths and Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 p-6">
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-4">
            Key Strengths
          </h3>
          <ul className="space-y-2">
            {analysis.scores.breakdown.strengths.slice(0, 5).map((strength, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-6">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-4">
            Areas for Improvement
          </h3>
          <ul className="space-y-2">
            {analysis.scores.breakdown.weaknesses.slice(0, 5).map((weakness, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400 mt-0.5">•</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{weakness}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Deck Composition Summary */}
      {deck && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Deck Composition
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Pokémon</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {deck.cards.filter(c => c.card.supertype === 'POKEMON').reduce((sum, c) => sum + c.count, 0)}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Trainers</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {deck.cards.filter(c => c.card.supertype === 'TRAINER').reduce((sum, c) => sum + c.count, 0)}
              </p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Energy</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {deck.cards.filter(c => c.card.supertype === 'ENERGY').reduce((sum, c) => sum + c.count, 0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}