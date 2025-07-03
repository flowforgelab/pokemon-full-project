/**
 * Hook for accessing tournament meta data
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api/client';
import type { MetaDeck } from '@/lib/api/limitless-tcg-scraper';

export interface TournamentMetaData {
  lastSync: Date | null;
  topDecks: Array<{
    archetype: string;
    percentage: number;
    tier: 'tier1' | 'tier2' | 'tier3';
  }>;
  isLoading: boolean;
  error: Error | null;
}

export function useTournamentMeta(format: 'STANDARD' | 'EXPANDED' = 'STANDARD'): TournamentMetaData {
  const [data, setData] = useState<TournamentMetaData>({
    lastSync: null,
    topDecks: [],
    isLoading: true,
    error: null
  });

  useEffect(() => {
    async function fetchMeta() {
      try {
        // For now, use static data until we implement the tRPC endpoint
        // TODO: Replace with actual tRPC call
        const mockData = {
          lastSync: new Date(),
          topDecks: [
            { archetype: 'Charizard ex', percentage: 18.5, tier: 'tier1' as const },
            { archetype: 'Gardevoir ex', percentage: 15.2, tier: 'tier1' as const },
            { archetype: 'Lost Box', percentage: 12.8, tier: 'tier1' as const },
            { archetype: 'Giratina VSTAR', percentage: 8.4, tier: 'tier2' as const },
            { archetype: 'Miraidon ex', percentage: 7.1, tier: 'tier2' as const },
            { archetype: 'Roaring Moon ex', percentage: 5.9, tier: 'tier2' as const },
            { archetype: 'Iron Hands ex', percentage: 4.2, tier: 'tier3' as const },
            { archetype: 'Snorlax Stall', percentage: 3.8, tier: 'tier3' as const }
          ]
        };

        setData({
          ...mockData,
          isLoading: false,
          error: null
        });
      } catch (error) {
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: error as Error
        }));
      }
    }

    fetchMeta();
  }, [format]);

  return data;
}

/**
 * Hook for analyzing a deck against tournament meta
 */
export function useDeckMetaAnalysis(
  deckCards: Array<{ cardName: string; quantity: number }> | null
) {
  const [analysis, setAnalysis] = useState<{
    metaPosition: 'tier1' | 'tier2' | 'tier3' | 'rogue' | null;
    similarArchetypes: Array<{ name: string; similarity: number }>;
    recommendations: string[];
    isLoading: boolean;
    error: Error | null;
  }>({
    metaPosition: null,
    similarArchetypes: [],
    recommendations: [],
    isLoading: false,
    error: null
  });

  useEffect(() => {
    if (!deckCards || deckCards.length === 0) return;

    async function analyzeDeck() {
      setAnalysis(prev => ({ ...prev, isLoading: true }));

      try {
        const response = await fetch('/api/analysis/sync-meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze',
            cards: deckCards
          })
        });

        if (!response.ok) throw new Error('Failed to analyze deck');

        const data = await response.json();
        setAnalysis({
          ...data.analysis,
          isLoading: false,
          error: null
        });
      } catch (error) {
        setAnalysis(prev => ({
          ...prev,
          isLoading: false,
          error: error as Error
        }));
      }
    }

    analyzeDeck();
  }, [deckCards]);

  return analysis;
}