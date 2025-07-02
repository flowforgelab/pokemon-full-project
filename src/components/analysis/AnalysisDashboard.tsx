'use client';

import React from 'react';
import { DeckAnalysisResult } from '@/lib/analysis/types';
import { 
  Chart as ChartJS, 
  RadialLinearScale, 
  PointElement, 
  LineElement, 
  Filler, 
  Tooltip, 
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement
} from 'chart.js';
import { Radar, Bar, Doughnut } from 'react-chartjs-2';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  LightBulbIcon,
  SparklesIcon,
  TrophyIcon,
  ClockIcon,
  ShieldCheckIcon,
  BoltIcon,
  FireIcon
} from '@heroicons/react/24/outline';

// Register ChartJS components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement
);

interface AnalysisDashboardProps {
  analysis: DeckAnalysisResult;
  deckName: string;
}

export default function AnalysisDashboard({ analysis, deckName }: AnalysisDashboardProps) {
  // Overall health score with color
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 80) return CheckCircleIcon;
    if (score >= 60) return ExclamationTriangleIcon;
    return XCircleIcon;
  };

  const HealthIcon = getHealthIcon(analysis.scores.overall);

  // Radar chart data for key metrics
  const radarData = {
    labels: ['Consistency', 'Speed', 'Power', 'Versatility', 'Meta Relevance'],
    datasets: [
      {
        label: 'Deck Performance',
        data: [
          analysis.scores.consistency,
          analysis.scores.speed,
          analysis.scores.power,
          analysis.scores.versatility,
          analysis.scores.metaRelevance
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
      }
    ]
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.2)'
        },
        pointLabels: {
          font: {
            size: 12
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  };

  // Bar chart for deck composition
  const compositionData = {
    labels: ['Pokémon', 'Trainers', 'Energy'],
    datasets: [
      {
        label: 'Card Count',
        data: [
          analysis.deckInfo?.pokemonCount || 0,
          analysis.deckInfo?.trainerCount || 0,
          analysis.deckInfo?.energyCount || 0
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)'
        ],
        borderColor: [
          'rgba(239, 68, 68, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(34, 197, 94, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 40,
        grid: {
          color: 'rgba(156, 163, 175, 0.2)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  };

  // Doughnut chart for matchup overview
  const matchupData = {
    labels: ['Favorable', 'Even', 'Unfavorable'],
    datasets: [
      {
        data: [
          analysis.meta?.popularMatchups?.filter(m => m.winRate >= 60).length || 0,
          analysis.meta?.popularMatchups?.filter(m => m.winRate >= 40 && m.winRate < 60).length || 0,
          analysis.meta?.popularMatchups?.filter(m => m.winRate < 40).length || 0
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(239, 68, 68, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          font: {
            size: 12
          }
        }
      }
    }
  };

  // Count warnings by severity
  const errorCount = analysis.warnings?.filter(w => w.severity === 'error').length || 0;
  const warningCount = analysis.warnings?.filter(w => w.severity === 'warning').length || 0;
  const infoCount = analysis.warnings?.filter(w => w.severity === 'info').length || 0;

  return (
    <div className="space-y-6">
      {/* Overall Health Score */}
      <div className={`rounded-2xl p-8 ${getHealthBg(analysis.scores.overall)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {deckName} Analysis
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Overall deck health and performance metrics
            </p>
          </div>
          <div className="text-center">
            <HealthIcon className={`h-16 w-16 mx-auto mb-2 ${getHealthColor(analysis.scores.overall)}`} />
            <div className={`text-5xl font-bold ${getHealthColor(analysis.scores.overall)}`}>
              {analysis.scores.overall}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Overall Score
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Consistency */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <ShieldCheckIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <span className={`text-2xl font-bold ${getHealthColor(analysis.scores.consistency)}`}>
              {analysis.scores.consistency}%
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Consistency</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {analysis.consistency?.mulliganProbability ? 
              `${(analysis.consistency.mulliganProbability * 100).toFixed(1)}% mulligan rate` : 
              'Setup reliability'
            }
          </p>
        </div>

        {/* Speed */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <ClockIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
            <span className={`text-2xl font-bold ${getHealthColor(analysis.scores.speed)}`}>
              T{analysis.speed?.averageSetupTurn?.toFixed(1) || 'N/A'}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Speed</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {analysis.speed?.overallSpeed || 'Average'} setup speed
          </p>
        </div>

        {/* Power */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <BoltIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            <span className={`text-2xl font-bold ${getHealthColor(analysis.scores.power)}`}>
              {analysis.scores.power}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Power Level</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {analysis.speed?.prizeRaceSpeed?.damageOutput || 0} avg damage
          </p>
        </div>

        {/* Meta Position */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <TrophyIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <span className="text-2xl font-bold capitalize text-purple-600 dark:text-purple-400">
              {analysis.meta?.metaPosition || 'Unknown'}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Meta Position</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {analysis.archetype?.primaryArchetype || 'Unknown'} deck
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Radar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Performance Overview</h3>
          <div className="h-64">
            <Radar data={radarData} options={radarOptions} />
          </div>
        </div>

        {/* Deck Composition */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Deck Composition</h3>
          <div className="h-64">
            <Bar data={compositionData} options={barOptions} />
          </div>
        </div>

        {/* Matchup Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Matchup Overview</h3>
          <div className="h-64">
            <Doughnut data={matchupData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Issues and Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Issues Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
            Issues Found
          </h3>
          <div className="space-y-3">
            {errorCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-red-700 dark:text-red-300 font-medium">Critical Errors</span>
                <span className="text-red-600 dark:text-red-400 font-bold">{errorCount}</span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <span className="text-yellow-700 dark:text-yellow-300 font-medium">Warnings</span>
                <span className="text-yellow-600 dark:text-yellow-400 font-bold">{warningCount}</span>
              </div>
            )}
            {infoCount > 0 && (
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-blue-700 dark:text-blue-300 font-medium">Info</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{infoCount}</span>
              </div>
            )}
            {errorCount === 0 && warningCount === 0 && infoCount === 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-green-700 dark:text-green-300 font-medium">No issues found!</span>
              </div>
            )}
          </div>
        </div>

        {/* Top Recommendations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <LightBulbIcon className="h-5 w-5 text-blue-500" />
            Top Recommendations
          </h3>
          <div className="space-y-3">
            {analysis.recommendations?.slice(0, 3).map((rec, idx) => (
              <div key={idx} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    rec.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                    rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {rec.priority} priority
                  </span>
                  {rec.card && (
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {rec.card}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{rec.reason}</p>
              </div>
            ))}
            {(!analysis.recommendations || analysis.recommendations.length === 0) && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                <SparklesIcon className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No specific recommendations</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Archetype Info */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <FireIcon className="h-12 w-12 text-purple-600 dark:text-purple-400" />
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {analysis.archetype?.primaryArchetype || 'Unknown'} Archetype
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {analysis.archetype?.playstyle || 'Analyzing playstyle...'}
            </p>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Confidence: {analysis.archetype?.confidence || 0}%
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Skill Level: {analysis.performance?.learningCurve || 'intermediate'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}