'use client';

import React, { useState } from 'react';
import { 
  LightBulbIcon, 
  ExclamationTriangleIcon,
  PlusCircleIcon,
  MinusCircleIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import type { Recommendation, AnalysisWarning } from '@/lib/analysis/types';

interface RecommendationPanelProps {
  recommendations: Recommendation[];
  warnings: AnalysisWarning[];
}

export default function RecommendationPanel({ recommendations, warnings }: RecommendationPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['high']));

  if (!recommendations && !warnings) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p>No recommendations available</p>
      </div>
    );
  }

  // Group recommendations by priority
  const groupedRecommendations = recommendations.reduce((groups, rec) => {
    const priority = rec.priority || 'medium';
    if (!groups[priority]) groups[priority] = [];
    groups[priority].push(rec);
    return groups;
  }, {} as Record<string, Recommendation[]>);

  const priorityConfig = {
    high: {
      label: 'High Priority',
      color: 'red',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-800 dark:text-red-200',
      icon: ExclamationTriangleIcon,
    },
    medium: {
      label: 'Medium Priority',
      color: 'yellow',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      textColor: 'text-yellow-800 dark:text-yellow-200',
      icon: LightBulbIcon,
    },
    low: {
      label: 'Low Priority',
      color: 'blue',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      textColor: 'text-blue-800 dark:text-blue-200',
      icon: InformationCircleIcon,
    },
  };

  const categoryIcons = {
    CONSISTENCY: CheckCircleIcon,
    SYNERGY: ArrowsRightLeftIcon,
    SPEED: ChevronUpIcon,
    POWER: LightBulbIcon,
    META: InformationCircleIcon,
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'add': return PlusCircleIcon;
      case 'remove': return MinusCircleIcon;
      case 'replace': return ArrowsRightLeftIcon;
      case 'adjust': return LightBulbIcon;
      default: return LightBulbIcon;
    }
  };

  const toggleCategory = (priority: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(priority)) {
      newExpanded.delete(priority);
    } else {
      newExpanded.add(priority);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Warnings Section */}
      {warnings.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-6">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            Deck Warnings
          </h3>
          <div className="space-y-3">
            {warnings.map((warning, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">
                    {warning.message}
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Severity: {warning.severity} | Category: {warning.category}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations by Priority */}
      {['high', 'medium', 'low'].map((priority) => {
        const recs = groupedRecommendations[priority];
        if (!recs || recs.length === 0) return null;

        const config = priorityConfig[priority as keyof typeof priorityConfig];
        const isExpanded = expandedCategories.has(priority);

        return (
          <div 
            key={priority}
            className={`rounded-lg border ${config.borderColor} ${config.bgColor} overflow-hidden`}
          >
            <button
              onClick={() => toggleCategory(priority)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <config.icon className={`h-5 w-5 ${config.textColor}`} />
                <h3 className={`text-lg font-semibold ${config.textColor}`}>
                  {config.label} ({recs.length})
                </h3>
              </div>
              {isExpanded ? (
                <ChevronUpIcon className={`h-5 w-5 ${config.textColor}`} />
              ) : (
                <ChevronDownIcon className={`h-5 w-5 ${config.textColor}`} />
              )}
            </button>

            {isExpanded && (
              <div className="px-6 pb-6 space-y-4">
                {recs.map((rec, idx) => {
                  const ActionIcon = getActionIcon(rec.type);

                  return (
                    <div 
                      key={idx}
                      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <ActionIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {rec.type === 'add' && `Add ${rec.quantity || 1}x ${rec.card}`}
                            {rec.type === 'remove' && `Remove ${rec.quantity || 1}x ${rec.card}`}
                            {rec.type === 'replace' && `Replace ${rec.targetCard} with ${rec.card}`}
                            {rec.type === 'adjust' && `Adjust ${rec.card} quantity to ${rec.quantity}`}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {rec.reason}
                          </p>
                          {rec.impact && (
                            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                              Impact: {rec.impact}
                            </p>
                          )}
                          {rec.alternativeOptions && rec.alternativeOptions.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Alternative Options:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {rec.alternativeOptions.map((card, cardIdx) => (
                                  <span 
                                    key={cardIdx}
                                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300"
                                  >
                                    {card}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Summary Stats */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">
          Recommendation Summary
        </h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {groupedRecommendations.high?.length || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">High Priority</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {groupedRecommendations.medium?.length || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Medium Priority</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {groupedRecommendations.low?.length || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Low Priority</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h4>
        <div className="space-y-3">
          <button className="w-full text-left px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Apply All High Priority Recommendations
              </span>
              <ChevronDownIcon className="h-4 w-4 text-blue-600" />
            </div>
          </button>
          <button className="w-full text-left px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Generate Budget-Friendly Alternatives
              </span>
              <ChevronDownIcon className="h-4 w-4 text-green-600" />
            </div>
          </button>
          <button className="w-full text-left px-4 py-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                View Alternative Deck Strategies
              </span>
              <ChevronDownIcon className="h-4 w-4 text-purple-600" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}