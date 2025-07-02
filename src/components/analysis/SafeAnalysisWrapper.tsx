'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary for analysis components
 */
export class SafeAnalysisWrapper extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Analysis component error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analysis Temporarily Unavailable</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
              We're having trouble analyzing this deck right now. Please try refreshing the page or come back later.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for safe data access with fallbacks
 */
export function useSafeAnalysisData<T>(
  data: T | null | undefined,
  fallback: T
): T {
  return data ?? fallback;
}

/**
 * Safe score display component
 */
export function SafeScoreDisplay({ 
  score, 
  label,
  fallbackScore = 0 
}: { 
  score: number | null | undefined;
  label: string;
  fallbackScore?: number;
}) {
  const safeScore = score ?? fallbackScore;
  
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold">{safeScore}</span>
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
    </div>
  );
}

/**
 * Safe analysis data provider
 */
export function withSafeAnalysis<T extends Record<string, any>>(
  Component: React.ComponentType<T>
) {
  return function SafeAnalysisComponent(props: T) {
    // Ensure all required analysis props have safe defaults
    const safeProps = {
      ...props,
      analysis: props.analysis || {
        scores: {
          overall: 0,
          consistency: 0,
          power: 0,
          speed: 0,
          versatility: 0,
          metaRelevance: 0,
          innovation: 0,
          difficulty: 0,
          breakdown: {
            strengths: [],
            weaknesses: [],
            coreStrategy: 'Unable to determine strategy',
            winConditions: []
          }
        },
        consistency: {
          overallConsistency: 0,
          mulliganProbability: 0,
          energyRatio: {
            energyPercentage: 0,
            isOptimal: false
          },
          trainerDistribution: {
            balance: {
              draw: false,
              search: false,
              supporters: false,
              items: false,
              hasStadium: false
            }
          }
        },
        synergy: {
          overallSynergy: 0
        },
        speed: {
          overallSpeed: 'medium'
        },
        archetype: {
          primaryArchetype: 'midrange',
          confidence: 0,
          characteristics: [],
          playstyle: 'Unable to determine playstyle'
        },
        recommendations: [],
        warnings: []
      }
    };

    return (
      <SafeAnalysisWrapper>
        <Component {...safeProps} />
      </SafeAnalysisWrapper>
    );
  };
}