'use client';

import { useState } from 'react';
import { 
  BeakerIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon 
} from '@heroicons/react/24/outline';
import type { BasicDeckAnalysis } from '@/lib/analysis/basic-deck-analyzer';
import type { DeckAnalysisResult } from '@/lib/analysis/types';
import type { DeckCard, Card } from '@prisma/client';

interface AnalysisReviewButtonProps {
  deckName: string;
  deckCards: Array<DeckCard & { card: Card }>;
  analysis: BasicDeckAnalysis | DeckAnalysisResult;
  analysisType: 'basic' | 'advanced';
}

export function AnalysisReviewButton({ 
  deckName, 
  deckCards, 
  analysis, 
  analysisType 
}: AnalysisReviewButtonProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReview = async () => {
    setIsReviewing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/analysis/feedback-loop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dryRun: true,
          options: {
            testSingleDeck: {
              name: deckName,
              cards: deckCards,
              analysis,
              analysisType
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get review');
      }

      const result = await response.json();
      setReviewResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="mt-6">
      {/* Review Button */}
      {!reviewResult && (
        <div className="flex justify-center">
          <button
            onClick={handleReview}
            disabled={isReviewing}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReviewing ? (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                Getting AI Review...
              </>
            ) : (
              <>
                <BeakerIcon className="h-5 w-5 mr-2" />
                Get AI Review of This Analysis
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-red-600 dark:text-red-400">
            <ExclamationTriangleIcon className="h-5 w-5 inline mr-2" />
            {error}
          </p>
        </div>
      )}

      {/* Review Results */}
      {reviewResult && (
        <div className="mt-6 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              🤖 AI Analysis Review
            </h3>
            
            {/* Accuracy Score */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700 dark:text-gray-300">Analyzer Accuracy</span>
                <span className="text-2xl font-bold text-blue-600">
                  {reviewResult.summary?.accuracyBefore || 'N/A'}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full"
                  style={{ width: `${reviewResult.summary?.accuracyBefore || 0}%` }}
                />
              </div>
            </div>

            {/* Improvements Found */}
            {reviewResult.improvements?.applied?.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Suggested Improvements:
                </h4>
                <ul className="space-y-2">
                  {reviewResult.improvements.applied.map((imp: any, idx: number) => (
                    <li key={idx} className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-700 dark:text-gray-300">{imp.description}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          File: {imp.file} • Priority: {imp.priority}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Critical Issues */}
            {reviewResult.summary?.criticalMisses > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Issues the Analyzer Missed:
                </h4>
                <p className="text-yellow-600 dark:text-yellow-400">
                  <ExclamationTriangleIcon className="h-5 w-5 inline mr-2" />
                  {reviewResult.summary.criticalMisses} critical issues not detected
                </p>
              </div>
            )}

            {/* Cost Info */}
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p>Review cost: {reviewResult.summary?.estimatedCost || '$0.00'}</p>
              <p>Execution time: {reviewResult.summary?.executionTime || 'N/A'}</p>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setReviewResult(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Close
              </button>
              {reviewResult.improvements?.pending?.length > 0 && (
                <button
                  onClick={() => alert('This would apply the improvements in a real implementation')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Apply Improvements
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}