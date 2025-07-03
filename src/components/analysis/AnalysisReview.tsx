'use client';

import { useState } from 'react';
import { 
  BeakerIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import type { OpenAIReviewResponse } from '@/lib/analysis/openai-analysis-reviewer';

interface AnalysisReviewProps {
  review: OpenAIReviewResponse | null;
  isLoading: boolean;
  onRequestReview: () => void;
}

export function AnalysisReview({ review, isLoading, onRequestReview }: AnalysisReviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!review && !isLoading) {
    return (
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6">
        <div className="text-center">
          <BeakerIcon className="h-12 w-12 text-purple-600 dark:text-purple-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            AI Analysis Review Available
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Get an expert AI review of this analysis to ensure accuracy
          </p>
          <button
            onClick={onRequestReview}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center mx-auto"
          >
            <SparklesIcon className="h-5 w-5 mr-2" />
            Review Analysis with AI
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            AI is reviewing the analysis...
          </span>
        </div>
      </div>
    );
  }

  if (!review) return null;

  const scoreColor = 
    review.accuracyScore >= 80 ? 'text-green-600 dark:text-green-400' :
    review.accuracyScore >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
    'text-red-600 dark:text-red-400';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-purple-200 dark:border-purple-800">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BeakerIcon className="h-8 w-8 text-purple-600 dark:text-purple-400 mr-3" />
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                AI Analysis Review
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Expert evaluation of analysis accuracy
              </p>
            </div>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${scoreColor}`}>
              {review.accuracyScore}%
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Accuracy Score
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="p-6 bg-gray-50 dark:bg-gray-900/50">
        <p className="text-gray-700 dark:text-gray-300">
          {review.overallAssessment}
        </p>
      </div>

      {/* Expandable Details */}
      <div className="p-6">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
        >
          {isExpanded ? 'Hide' : 'Show'} Detailed Review
          <svg
            className={`ml-2 h-5 w-5 transform transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="mt-6 space-y-6">
            {/* Good Points */}
            {review.goodPoints.length > 0 && (
              <ReviewSection
                title="What the Analyzer Did Well"
                icon={CheckCircleIcon}
                iconColor="text-green-600 dark:text-green-400"
                items={review.goodPoints.map(point => ({ text: point }))}
              />
            )}

            {/* Missed Issues */}
            {review.missedIssues.length > 0 && (
              <ReviewSection
                title="Missed Issues"
                icon={XCircleIcon}
                iconColor="text-red-600 dark:text-red-400"
                items={review.missedIssues.map(issue => ({
                  text: issue.issue,
                  severity: issue.severity,
                  detail: issue.suggestion
                }))}
              />
            )}

            {/* Incorrect Recommendations */}
            {review.incorrectRecommendations.length > 0 && (
              <ReviewSection
                title="Incorrect Recommendations"
                icon={ExclamationTriangleIcon}
                iconColor="text-yellow-600 dark:text-yellow-400"
                items={review.incorrectRecommendations.map(rec => ({
                  text: rec.recommendation,
                  detail: `Why: ${rec.reason}. Better: ${rec.betterSuggestion}`
                }))}
              />
            )}

            {/* Improvements */}
            {review.suggestedImprovements.length > 0 && (
              <ReviewSection
                title="Suggested Improvements"
                icon={InformationCircleIcon}
                iconColor="text-blue-600 dark:text-blue-400"
                items={review.suggestedImprovements.map(imp => ({ text: imp }))}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ReviewSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  items: Array<{
    text: string;
    severity?: 'critical' | 'major' | 'minor';
    detail?: string;
  }>;
}

function ReviewSection({ title, icon: Icon, iconColor, items }: ReviewSectionProps) {
  return (
    <div>
      <div className="flex items-center mb-3">
        <Icon className={`h-6 w-6 ${iconColor} mr-2`} />
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h4>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <div className="flex items-start">
              {item.severity && (
                <span className={`
                  inline-block w-2 h-2 rounded-full mr-2 mt-1.5 flex-shrink-0
                  ${item.severity === 'critical' ? 'bg-red-500' :
                    item.severity === 'major' ? 'bg-yellow-500' : 'bg-green-500'}
                `} />
              )}
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-300">
                  {item.text}
                </p>
                {item.detail && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {item.detail}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}