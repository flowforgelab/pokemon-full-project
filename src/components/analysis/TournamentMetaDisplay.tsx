/**
 * Component to display tournament meta information
 */

'use client';

import { useTournamentMeta } from '@/hooks/useTournamentMeta';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { TrendingUp, Trophy, AlertCircle } from 'lucide-react';

interface TournamentMetaDisplayProps {
  format?: 'STANDARD' | 'EXPANDED';
  className?: string;
}

export function TournamentMetaDisplay({ 
  format = 'STANDARD',
  className = '' 
}: TournamentMetaDisplayProps) {
  const { topDecks, isLoading, error, lastSync } = useTournamentMeta(format);

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <div className="p-6">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Error Loading Meta Data</span>
          </div>
          <p className="text-sm text-gray-500">
            Unable to load tournament data. Using cached information.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Tournament Meta
          </h3>
          {lastSync && (
            <span className="text-xs text-gray-500">
              Updated {new Date(lastSync).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {topDecks.slice(0, 8).map((deck, index) => {
            const tierColor = deck.tier === 'tier1' ? 'text-yellow-500' :
                            deck.tier === 'tier2' ? 'text-gray-400' :
                            'text-orange-600';
            
            const tierBg = deck.tier === 'tier1' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                          deck.tier === 'tier2' ? 'bg-gray-50 dark:bg-gray-800/50' :
                          'bg-orange-50 dark:bg-orange-900/20';

            return (
              <div
                key={deck.archetype}
                className={`flex items-center justify-between p-3 rounded-lg ${tierBg} transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${tierColor}`}>
                    #{index + 1}
                  </span>
                  <span className="font-medium">{deck.archetype}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-semibold">
                    {deck.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            Data from Limitless TCG tournament results
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Compact version for deck analysis pages
 */
export function TournamentMetaCompact({ 
  deckArchetype,
  metaPosition 
}: { 
  deckArchetype?: string;
  metaPosition?: 'tier1' | 'tier2' | 'tier3' | 'rogue';
}) {
  const { topDecks } = useTournamentMeta();
  
  const matchingDeck = topDecks.find(d => 
    d.archetype.toLowerCase() === deckArchetype?.toLowerCase()
  );

  const positionColor = metaPosition === 'tier1' ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                       metaPosition === 'tier2' ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' :
                       metaPosition === 'tier3' ? 'text-green-500 bg-green-50 dark:bg-green-900/20' :
                       'text-gray-500 bg-gray-50 dark:bg-gray-800/50';

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="flex-1">
        <div className="text-sm text-gray-500 mb-1">Tournament Meta Position</div>
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${positionColor}`}>
          <Trophy className="w-4 h-4" />
          {metaPosition === 'tier1' ? 'Tier 1 Deck' :
           metaPosition === 'tier2' ? 'Tier 2 Deck' :
           metaPosition === 'tier3' ? 'Tier 3 Deck' :
           'Rogue Deck'}
        </div>
      </div>
      {matchingDeck && (
        <div className="text-right">
          <div className="text-sm text-gray-500">Meta Share</div>
          <div className="text-2xl font-bold">{matchingDeck.percentage.toFixed(1)}%</div>
        </div>
      )}
    </div>
  );
}