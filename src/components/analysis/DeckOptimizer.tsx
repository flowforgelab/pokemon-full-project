'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  WrenchScrewdriverIcon,
  SparklesIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CurrencyDollarIcon,
  HomeIcon,
  TrophyIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { api } from '@/utils/api';
import type { DeckAnalysisResult, AnalysisWarning, Recommendation } from '@/lib/analysis/types';
import type { Deck, DeckCard, Card } from '@prisma/client';
import { UnifiedOptimizer } from '@/lib/deck-optimization/unified-optimizer';
import type { UnifiedOptimizationResult, OptimizationRecommendation } from '@/lib/deck-optimization/unified-optimizer';

interface DeckOptimizerProps {
  deck: Deck & { cards: (DeckCard & { card: Card })[] };
  analysis: DeckAnalysisResult;
  onDeckUpdate?: (updatedDeck: any) => void;
}

interface OptimizationMode {
  id: 'power' | 'consistency' | 'speed' | 'budget';
  name: string;
  icon: any;
  description: string;
}

export default function DeckOptimizer({ deck, analysis, onDeckUpdate }: DeckOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [appliedSteps, setAppliedSteps] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [optimizedDeck, setOptimizedDeck] = useState(deck);
  const [selectedMode, setSelectedMode] = useState<'power' | 'consistency' | 'speed' | 'budget'>('consistency');
  const [budget, setBudget] = useState<number>(50);
  const [useCollection, setUseCollection] = useState(true);
  const [optimization, setOptimization] = useState<UnifiedOptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { data: session } = api.auth.getSession.useQuery();
  const userId = session?.user?.id;

  const optimizer = useMemo(() => new UnifiedOptimizer(), []);

  const modes: OptimizationMode[] = [
    {
      id: 'consistency',
      name: 'Consistency',
      icon: HomeIcon,
      description: 'Improve draw power and search'
    },
    {
      id: 'speed',
      name: 'Speed',
      icon: BoltIcon,
      description: 'Faster setup and energy'
    },
    {
      id: 'power',
      name: 'Power',
      icon: TrophyIcon,
      description: 'Maximum damage output'
    },
    {
      id: 'budget',
      name: 'Budget',
      icon: CurrencyDollarIcon,
      description: 'Cost-effective improvements'
    }
  ];

  // Run optimization when mode or settings change
  useEffect(() => {
    if (userId) {
      runOptimization();
    }
  }, [selectedMode, budget, useCollection, userId]);

  const runOptimization = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const result = await optimizer.optimizeDeck({
        deck,
        userId,
        options: {
          budget: selectedMode === 'budget' ? budget : undefined,
          useCollection,
          priorityMode: selectedMode,
          maxChanges: 15,
          maintainArchetype: true,
        }
      });
      
      setOptimization(result);
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert optimization recommendations to display format
  const optimizationSteps = useMemo(() => {
    if (!optimization) return [];
    
    return optimization.optimizations.map(opt => ({
      ...opt,
      applied: appliedSteps.has(opt.id),
    }));
  }, [optimization, appliedSteps]);

  const applyStep = (step: OptimizationRecommendation & { applied: boolean }) => {
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

  const undoStep = (step: OptimizationRecommendation & { applied: boolean }) => {
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
    if (!optimization) return analysis.scores.overall;
    
    // Use the estimated score from the optimization
    if (appliedSteps.size === 0) return analysis.scores.overall;
    
    // Calculate partial improvement based on applied steps
    const appliedImprovement = optimizationSteps
      .filter(step => step.applied)
      .reduce((sum, step) => sum + (step.scoreImprovement || 0), 0);
    
    return Math.min(100, Math.round(analysis.scores.overall + appliedImprovement));
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
      {/* Mode Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-4 gap-2">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedMode === mode.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className={`h-6 w-6 mx-auto mb-1 ${
                  selectedMode === mode.id ? 'text-blue-600' : 'text-gray-600 dark:text-gray-400'
                }`} />
                <p className={`text-sm font-medium ${
                  selectedMode === mode.id ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {mode.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {mode.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Options */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useCollection}
                onChange={(e) => setUseCollection(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Use my collection
              </span>
            </label>
            
            {selectedMode === 'budget' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Budget: $
                </label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                  min="0"
                  step="10"
                />
              </div>
            )}
          </div>
          
          <button
            onClick={runOptimization}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Analyzing...' : 'Re-analyze'}
          </button>
        </div>
      </div>

      {/* Optimizer Header */}
      <div className={`rounded-lg p-6 ${health.bg} dark:${health.bg}/20`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <WrenchScrewdriverIcon className="h-6 w-6" />
              Optimization Results
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {optimization?.summary.estimatedPlacements || 'Analyzing your deck...'}
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

      {/* Optimization Summary */}
      {optimization && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
              <h5 className="font-medium text-gray-900 dark:text-white">Critical Issues</h5>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {optimization.summary.criticalIssues}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Must fix for legality
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <HomeIcon className="h-5 w-5 text-blue-600" />
              <h5 className="font-medium text-gray-900 dark:text-white">From Collection</h5>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {optimization.summary.cardsFromCollection}/{optimization.summary.totalRecommendations}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cards you already own
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <CurrencyDollarIcon className="h-5 w-5 text-green-600" />
              <h5 className="font-medium text-gray-900 dark:text-white">Budget Needed</h5>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${optimization.summary.budgetRequired.toFixed(2)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              For missing cards
            </p>
          </div>
        </div>
      )}

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
                    <div className="flex items-center gap-3 ml-7 mt-2">
                      {step.inCollection && (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full">
                          <HomeIcon className="h-3 w-3 inline mr-1" />
                          In Collection
                        </span>
                      )}
                      {step.cost !== undefined && step.cost > 0 && (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                          ${step.cost.toFixed(2)}
                        </span>
                      )}
                      {step.tags && step.tags.map((tag, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
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

      {/* Upgrade Path */}
      {optimization && optimization.upgradePath.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
            Recommended Upgrade Path
          </h4>
          <div className="space-y-4">
            {optimization.upgradePath.map((tier) => (
              <div key={tier.tier} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-white">
                      Tier {tier.tier}: {tier.name}
                    </h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {tier.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      ${tier.budget.toFixed(2)}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      +{tier.estimatedScoreImprovement} score
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {tier.cards.map((card, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        {card.quantity}x {card.name}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        ${card.price.toFixed(2)}
                        {card.inCollection && (
                          <HomeIcon className="h-3 w-3 inline ml-1 text-green-600" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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