'use client';

import React, { useState, useMemo } from 'react';
import { 
  WrenchScrewdriverIcon,
  SparklesIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ChevronRightIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline';
import { api } from '@/utils/api';
import type { DeckAnalysisResult, AnalysisWarning, Recommendation } from '@/lib/analysis/types';
import type { Deck, DeckCard, Card } from '@prisma/client';

interface DeckOptimizerProps {
  deck: Deck & { cards: (DeckCard & { card: Card })[] };
  analysis: DeckAnalysisResult;
  onDeckUpdate?: (updatedDeck: any) => void;
}

interface OptimizationStep {
  id: string;
  type: 'add' | 'remove' | 'replace';
  card?: string;
  targetCard?: string;
  quantity: number;
  reason: string;
  impact: string;
  applied: boolean;
}

export default function DeckOptimizer({ deck, analysis, onDeckUpdate }: DeckOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [appliedSteps, setAppliedSteps] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [optimizedDeck, setOptimizedDeck] = useState(deck);

  // Generate optimization steps from analysis
  const optimizationSteps = useMemo(() => {
    const steps: OptimizationStep[] = [];
    
    // Fix critical errors first
    analysis.warnings
      ?.filter(w => w.severity === 'error')
      .forEach((warning, idx) => {
        if (warning.category === 'Basic Pokemon') {
          steps.push({
            id: `error-${idx}`,
            type: 'add',
            card: 'Pidgey', // Example basic Pokemon
            quantity: 4,
            reason: warning.message,
            impact: 'Fixes deck legality',
            applied: false
          });
        } else if (warning.category === 'Deck Size') {
          const totalCards = deck.cards.reduce((sum, dc) => sum + dc.quantity, 0);
          if (totalCards < 60) {
            steps.push({
              id: `error-${idx}`,
              type: 'add',
              card: 'Professor\'s Research',
              quantity: 60 - totalCards,
              reason: warning.message,
              impact: 'Makes deck legal size',
              applied: false
            });
          }
        }
      });

    // Add high priority recommendations
    analysis.recommendations
      ?.filter(r => r.priority === 'high')
      .forEach((rec, idx) => {
        steps.push({
          id: `rec-high-${idx}`,
          type: rec.type as any,
          card: rec.card,
          targetCard: rec.targetCard,
          quantity: rec.quantity || 1,
          reason: rec.reason,
          impact: rec.impact || 'Improves deck performance',
          applied: false
        });
      });

    // Fix consistency issues
    if (analysis.consistency?.mulliganProbability > 0.15) {
      steps.push({
        id: 'consistency-1',
        type: 'add',
        card: 'Quick Ball',
        quantity: 4,
        reason: 'High mulligan probability detected',
        impact: 'Reduces mulligan chance',
        applied: false
      });
    }

    // Add draw support if needed
    if (analysis.consistency?.trainerDistribution?.drawPower < 8) {
      steps.push({
        id: 'draw-support-1',
        type: 'add',
        card: 'Professor\'s Research',
        quantity: 2,
        reason: 'Insufficient draw support',
        impact: 'Improves consistency',
        applied: false
      });
    }

    // Add energy search if needed
    const energyCount = deck.cards
      .filter(dc => dc.card.supertype === 'ENERGY')
      .reduce((sum, dc) => sum + dc.quantity, 0);
    
    if (energyCount > 10 && !deck.cards.some(dc => dc.card.name.includes('Energy Search'))) {
      steps.push({
        id: 'energy-search-1',
        type: 'add',
        card: 'Energy Search',
        quantity: 2,
        reason: 'No energy search with high energy count',
        impact: 'Improves energy consistency',
        applied: false
      });
    }

    return steps;
  }, [deck, analysis]);

  const applyStep = (step: OptimizationStep) => {
    const newDeck = { ...optimizedDeck };
    const newCards = [...newDeck.cards];

    switch (step.type) {
      case 'add':
        // Check if card already exists
        const existingCardIndex = newCards.findIndex(dc => dc.card.name === step.card);
        if (existingCardIndex >= 0) {
          newCards[existingCardIndex] = {
            ...newCards[existingCardIndex],
            quantity: newCards[existingCardIndex].quantity + step.quantity
          };
        } else {
          // Add placeholder for new card
          console.log(`Would add ${step.quantity}x ${step.card}`);
        }
        break;

      case 'remove':
        const removeIndex = newCards.findIndex(dc => dc.card.name === step.card);
        if (removeIndex >= 0) {
          newCards[removeIndex] = {
            ...newCards[removeIndex],
            quantity: Math.max(0, newCards[removeIndex].quantity - step.quantity)
          };
          if (newCards[removeIndex].quantity === 0) {
            newCards.splice(removeIndex, 1);
          }
        }
        break;

      case 'replace':
        const replaceIndex = newCards.findIndex(dc => dc.card.name === step.targetCard);
        if (replaceIndex >= 0) {
          console.log(`Would replace ${step.targetCard} with ${step.card}`);
        }
        break;
    }

    newDeck.cards = newCards;
    setOptimizedDeck(newDeck);
    setAppliedSteps(new Set([...appliedSteps, step.id]));
  };

  const undoStep = (step: OptimizationStep) => {
    // Implement undo logic
    setAppliedSteps(prev => {
      const newSet = new Set(prev);
      newSet.delete(step.id);
      return newSet;
    });
  };

  const autoOptimize = async () => {
    setIsOptimizing(true);
    
    for (let i = 0; i < optimizationSteps.length; i++) {
      const step = optimizationSteps[i];
      if (!appliedSteps.has(step.id)) {
        setCurrentStep(i);
        applyStep(step);
        await new Promise(resolve => setTimeout(resolve, 500)); // Animation delay
      }
    }
    
    setIsOptimizing(false);
  };

  const getScoreImprovement = () => {
    const appliedCount = appliedSteps.size;
    const totalSteps = optimizationSteps.length;
    if (totalSteps === 0) return 0;
    
    const improvement = (appliedCount / totalSteps) * 20; // Max 20 point improvement
    return Math.round(analysis.scores.overall + improvement);
  };

  const getHealthStatus = () => {
    const score = getScoreImprovement();
    if (score >= 80) return { color: 'text-green-600', bg: 'bg-green-100', status: 'Excellent' };
    if (score >= 60) return { color: 'text-yellow-600', bg: 'bg-yellow-100', status: 'Good' };
    return { color: 'text-red-600', bg: 'bg-red-100', status: 'Needs Work' };
  };

  const health = getHealthStatus();

  return (
    <div className="space-y-6">
      {/* Optimizer Header */}
      <div className={`rounded-lg p-6 ${health.bg} dark:${health.bg}/20`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <WrenchScrewdriverIcon className="h-6 w-6" />
              Deck Optimizer
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Automatically fix issues and improve your deck
            </p>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${health.color}`}>
              {getScoreImprovement()}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Optimized Score
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={autoOptimize}
            disabled={isOptimizing || appliedSteps.size === optimizationSteps.length}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SparklesIcon className="h-5 w-5" />
            {isOptimizing ? 'Optimizing...' : 'Auto-Optimize'}
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
          <button
            onClick={() => {
              setAppliedSteps(new Set());
              setOptimizedDeck(deck);
            }}
            disabled={appliedSteps.size === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Reset
          </button>
        </div>
      </div>

      {/* Optimization Steps */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Optimization Steps ({appliedSteps.size}/{optimizationSteps.length})
        </h4>
        
        <div className="space-y-3">
          {optimizationSteps.map((step, idx) => {
            const isApplied = appliedSteps.has(step.id);
            const isCurrent = idx === currentStep && isOptimizing;
            
            return (
              <div
                key={step.id}
                className={`p-4 rounded-lg border transition-all ${
                  isApplied 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
                    : isCurrent
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 animate-pulse'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {isApplied ? (
                        <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : isCurrent ? (
                        <ArrowPathIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                      )}
                      <span className={`font-medium ${
                        isApplied ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-white'
                      }`}>
                        {step.type === 'add' && `Add ${step.quantity}x ${step.card}`}
                        {step.type === 'remove' && `Remove ${step.quantity}x ${step.card}`}
                        {step.type === 'replace' && `Replace ${step.targetCard} with ${step.card}`}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 ml-7">
                      {step.reason}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 ml-7 mt-1">
                      Impact: {step.impact}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {!isApplied && !isOptimizing && (
                      <button
                        onClick={() => applyStep(step)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Apply
                      </button>
                    )}
                    {isApplied && !isOptimizing && (
                      <button
                        onClick={() => undoStep(step)}
                        className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {optimizationSteps.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <LightBulbIcon className="h-12 w-12 mx-auto mb-3" />
              <p>Your deck is already well-optimized!</p>
              <p className="text-sm mt-1">No critical issues found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Changes */}
      {showPreview && appliedSteps.size > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
            Preview Changes
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Before */}
            <div>
              <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Original Deck
              </h5>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Score:</span> {analysis.scores.overall}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Total Cards:</span> {
                    deck.cards.reduce((sum, dc) => sum + dc.quantity, 0)
                  }
                </p>
                <p className="text-sm">
                  <span className="font-medium">Issues:</span> {
                    analysis.warnings?.filter(w => w.severity === 'error').length || 0
                  } errors, {
                    analysis.warnings?.filter(w => w.severity === 'warning').length || 0
                  } warnings
                </p>
              </div>
            </div>

            {/* After */}
            <div>
              <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Optimized Deck
              </h5>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Score:</span>{' '}
                  <span className={health.color}>{getScoreImprovement()}</span>
                </p>
                <p className="text-sm">
                  <span className="font-medium">Total Cards:</span> {
                    optimizedDeck.cards.reduce((sum, dc) => sum + dc.quantity, 0)
                  }
                </p>
                <p className="text-sm">
                  <span className="font-medium">Improvements:</span>{' '}
                  <span className="text-green-600 dark:text-green-400">
                    {appliedSteps.size} changes applied
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Apply Changes Button */}
          {onDeckUpdate && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => onDeckUpdate(optimizedDeck)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckIcon className="h-5 w-5" />
                Apply All Changes to Deck
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}