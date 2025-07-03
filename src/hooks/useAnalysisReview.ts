import { useState, useCallback } from 'react';
import { Card, DeckCard } from '@prisma/client';
import type { BasicDeckAnalysis } from '@/lib/analysis/basic-deck-analyzer';
import type { DeckAnalysis } from '@/lib/analysis/deck-analyzer';
import { 
  prepareDeckAnalysisPayload,
  type OpenAIReviewResponse,
  type OpenAIModelConfig
} from '@/lib/analysis/openai-analysis-reviewer';

export function useAnalysisReview() {
  const [review, setReview] = useState<OpenAIReviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestReview = useCallback(async (
    deckName: string,
    cards: Array<DeckCard & { card: Card }>,
    analysis: BasicDeckAnalysis | DeckAnalysis,
    analysisType: 'basic' | 'advanced' = 'basic',
    systemPrompt?: string,
    modelConfig?: Partial<OpenAIModelConfig>
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // Prepare the payload
      const payload = prepareDeckAnalysisPayload(
        deckName,
        cards,
        analysis,
        analysisType
      );

      // Call the API
      const response = await fetch('/api/analysis/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload,
          systemPrompt,
          modelConfig: modelConfig || { model: 'gpt-4.1-mini' }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get review');
      }

      const data = await response.json();
      setReview(data.review);
      
      return data.review;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error requesting analysis review:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearReview = useCallback(() => {
    setReview(null);
    setError(null);
  }, []);

  return {
    review,
    isLoading,
    error,
    requestReview,
    clearReview
  };
}