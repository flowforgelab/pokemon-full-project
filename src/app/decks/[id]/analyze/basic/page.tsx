'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import { analyzeBasicDeck, getKidFriendlyRecommendations } from '@/lib/analysis/basic-deck-analyzer';
import type { BasicDeckAnalysis, KidFriendlyAdvice } from '@/lib/analysis/basic-deck-analyzer';
import { 
  SparklesIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  QuestionMarkCircleIcon,
  XCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

export default function BasicDeckAnalyzePage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params?.id as string;
  const [analysis, setAnalysis] = useState<BasicDeckAnalysis | null>(null);

  // Fetch deck data
  const { data: deck, isLoading: deckLoading } = api.deck.getById.useQuery(deckId, {
    enabled: !!deckId,
  });

  // Perform basic analysis when deck loads
  useEffect(() => {
    if (deck && deck.cards) {
      const basicAnalysis = analyzeBasicDeck(deck.cards);
      setAnalysis(basicAnalysis);
    }
  }, [deck]);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Decks', href: '/decks' },
    { label: deck?.name || 'Loading...', href: `/decks/${deckId}` },
    { label: 'Basic Helper', href: `/decks/${deckId}/analyze/basic` },
  ];

  const getIconForCategory = (category: KidFriendlyAdvice['category']) => {
    switch (category) {
      case 'great':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'good':
        return <CheckCircleIcon className="h-6 w-6 text-blue-500" />;
      case 'needs-help':
        return <QuestionMarkCircleIcon className="h-6 w-6 text-yellow-500" />;
      case 'oops':
        return <XCircleIcon className="h-6 w-6 text-red-500" />;
    }
  };

  const getCategoryColor = (category: KidFriendlyAdvice['category']) => {
    switch (category) {
      case 'great':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'good':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'needs-help':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'oops':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    }
  };

  if (!deckId) {
    return <div>Invalid deck ID</div>;
  }

  return (
    <MainLayout title="Deck Helper" breadcrumbs={breadcrumbs}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push(`/decks/${deckId}`)}
              className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Deck
            </button>
            <button
              onClick={() => router.push(`/decks/${deckId}/analyze`)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              Try Advanced Analysis →
            </button>
          </div>

          <div className="text-center">
            <SparklesIcon className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {deck?.name || 'Your Deck'} - Helper
            </h1>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
              Let's make your deck awesome! 🌟
            </p>
          </div>
        </div>

        {/* Loading State */}
        {deckLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && !deckLoading && (
          <>
            {/* Score Card */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 text-white">
              <div className="text-center">
                <div className="text-6xl mb-2">{analysis.scoreEmoji}</div>
                <h2 className="text-2xl font-bold mb-2">
                  Your Deck Score: {analysis.deckScore}/100
                </h2>
                <p className="text-lg opacity-90">
                  {analysis.overallMessage}
                </p>
              </div>
            </div>

            {/* Advice Cards */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <LightBulbIcon className="h-8 w-8 mr-2 text-yellow-500" />
                Things We Found:
              </h2>

              {analysis.advice.map((advice, index) => (
                <div
                  key={index}
                  className={`rounded-lg border-2 p-6 ${getCategoryColor(advice.category)}`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-4">
                      {getIconForCategory(advice.category)}
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {advice.icon} {advice.title}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300 mb-2">
                        {advice.message}
                      </p>
                      {advice.tip && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic mb-2">
                          💡 {advice.tip}
                        </p>
                      )}
                      {advice.fixIt && (
                        <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            How to fix it: {advice.fixIt}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {analysis && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  🎯 Top Things To Do:
                </h2>
                <div className="space-y-2">
                  {getKidFriendlyRecommendations(analysis).map((rec, index) => (
                    <div key={index} className="flex items-start">
                      <span className="text-blue-600 dark:text-blue-400 mr-2">
                        {index + 1}.
                      </span>
                      <p className="text-gray-700 dark:text-gray-300">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fun Fact */}
            {analysis.funFact && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-6 text-center">
                <p className="text-lg text-purple-800 dark:text-purple-200">
                  {analysis.funFact}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => router.push(`/deck-builder/${deckId}`)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <SparklesIcon className="h-5 w-5 mr-2" />
                Fix My Deck!
              </button>
              <button
                onClick={() => window.print()}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Print This Page
              </button>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}