'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { 
  ChartBarIcon, 
  LightBulbIcon, 
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
  ClockIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

// Import visualization components (to be created)
import ScoreRadar from '@/components/analysis/ScoreRadar';
import ConsistencyMetrics from '@/components/analysis/ConsistencyMetrics';
import SynergyNetwork from '@/components/analysis/SynergyNetwork';
import SpeedGauge from '@/components/analysis/SpeedGauge';
import MetaMatchups from '@/components/analysis/MetaMatchups';
import RecommendationPanel from '@/components/analysis/RecommendationPanel';
import AnalysisOverview from '@/components/analysis/AnalysisOverview';
import { SafeAnalysisWrapper } from '@/components/analysis/SafeAnalysisWrapper';

export default function DeckAnalyzePage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params?.id as string;
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch deck data
  const { data: deck, isLoading: deckLoading } = api.deck.getById.useQuery(deckId, {
    enabled: !!deckId,
  });

  // Fetch analysis data
  const { data: analysisResponse, isLoading: analysisLoading, refetch } = api.analysis.analyzeDeck.useQuery(
    { deckId },
    { 
      enabled: !!deckId,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );

  const analysis = analysisResponse?.analysis;

  const isLoading = deckLoading || analysisLoading;

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Decks', href: '/decks' },
    { label: deck?.name || 'Loading...', href: `/decks/${deckId}` },
    { label: 'Analysis', href: `/decks/${deckId}/analyze` },
  ];

  const tabs = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon },
    { id: 'consistency', name: 'Consistency', icon: ShieldCheckIcon },
    { id: 'synergy', name: 'Synergy', icon: SparklesIcon },
    { id: 'speed', name: 'Speed', icon: ClockIcon },
    { id: 'meta', name: 'Meta Position', icon: ArrowTrendingUpIcon },
    { id: 'recommendations', name: 'Recommendations', icon: LightBulbIcon },
  ];

  const exportAnalysis = () => {
    if (!analysis || !deck) return;

    const report = {
      deck: {
        name: deck.name,
        format: deck.formatId,
        cards: deck.cards.length,
      },
      analysis: {
        timestamp: analysis.timestamp,
        scores: analysis.scores,
        consistency: analysis.consistency,
        recommendations: analysis.recommendations,
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deck.name}-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!deckId) {
    return <div>Invalid deck ID</div>;
  }

  return (
    <MainLayout title="Deck Analysis" breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {deck?.name || 'Loading...'} - Analysis
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Comprehensive deck evaluation and optimization recommendations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => refetch()}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Refresh Analysis
              </button>
              <button
                onClick={exportAnalysis}
                disabled={!analysis}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export Report
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                      ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : analysis ? (
              <SafeAnalysisWrapper>
                <>
                  {activeTab === 'overview' && (
                    <AnalysisOverview analysis={analysis} deck={deck} />
                  )}
                  {activeTab === 'consistency' && (
                    <ConsistencyMetrics consistency={analysis.consistency} />
                  )}
                  {activeTab === 'synergy' && (
                    <SynergyNetwork synergy={analysis.synergy} cards={deck?.cards || []} />
                  )}
                  {activeTab === 'speed' && (
                    <SpeedGauge speed={analysis.speed} archetype={analysis.archetype} />
                  )}
                  {activeTab === 'meta' && (
                    <MetaMatchups meta={analysis.meta} matchups={analysis.matchups} />
                  )}
                  {activeTab === 'recommendations' && (
                    <RecommendationPanel 
                      recommendations={analysis.recommendations} 
                      warnings={analysis.warnings}
                    />
                  )}
                </>
              </SafeAnalysisWrapper>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                <ExclamationTriangleIcon className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">Analysis Failed</p>
                <p className="text-sm mt-1">Unable to analyze this deck. Please try again.</p>
              </div>
            )}
          </div>
        </div>

        {/* Analysis Summary Cards */}
        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Overall Score</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                    {analysis?.scores?.overall || 0}
                  </p>
                </div>
                <div className={`
                  p-3 rounded-full
                  ${(analysis?.scores?.overall || 0) >= 80 ? 'bg-green-100 dark:bg-green-900' : 
                    (analysis?.scores?.overall || 0) >= 60 ? 'bg-yellow-100 dark:bg-yellow-900' : 
                    'bg-red-100 dark:bg-red-900'}
                `}>
                  <ChartBarIcon className={`
                    h-6 w-6
                    ${(analysis?.scores?.overall || 0) >= 80 ? 'text-green-600 dark:text-green-400' : 
                      (analysis?.scores?.overall || 0) >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 
                      'text-red-600 dark:text-red-400'}
                  `} />
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {(analysis?.scores?.overall || 0) >= 80 ? 'Tournament Ready' : 
                 (analysis?.scores?.overall || 0) >= 60 ? 'Competitive' : 
                 'Needs Improvement'}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Consistency</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                    {analysis?.scores?.consistency || 0}%
                  </p>
                </div>
                <ShieldCheckIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {(analysis?.consistency?.mulliganProbability || 0).toFixed(1)}% mulligan rate
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Speed</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                    T{analysis?.speed?.averageSetupTurn || 0}
                  </p>
                </div>
                <ClockIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Average setup turn
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Archetype</p>
                  <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white capitalize">
                    {analysis?.archetype?.primaryArchetype || 'Unknown'}
                  </p>
                </div>
                <SparklesIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {analysis?.archetype?.confidence || 0}% confidence
              </p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}