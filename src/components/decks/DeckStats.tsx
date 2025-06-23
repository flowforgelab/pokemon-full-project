'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DeckStatsProps {
  totalCards: number;
  pokemonCount: number;
  trainerCount: number;
  energyCount: number;
  className?: string;
}

export const DeckStats: React.FC<DeckStatsProps> = ({
  totalCards,
  pokemonCount,
  trainerCount,
  energyCount,
  className,
}) => {
  const getPercentage = (count: number) => {
    return totalCards > 0 ? Math.round((count / totalCards) * 100) : 0;
  };

  const isValidDeck = totalCards === 60;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Deck Progress</span>
        <span className={cn(
          'font-medium',
          isValidDeck ? 'text-green-600' : totalCards > 60 ? 'text-destructive' : 'text-muted-foreground'
        )}>
          {totalCards}/60
        </span>
      </div>

      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'absolute inset-y-0 left-0 transition-all duration-300',
            isValidDeck ? 'bg-green-600' : totalCards > 60 ? 'bg-destructive' : 'bg-primary'
          )}
          style={{ width: `${Math.min((totalCards / 60) * 100, 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="font-medium">Pokémon</span>
          </div>
          <div className="text-muted-foreground">
            {pokemonCount} ({getPercentage(pokemonCount)}%)
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span className="font-medium">Trainers</span>
          </div>
          <div className="text-muted-foreground">
            {trainerCount} ({getPercentage(trainerCount)}%)
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="font-medium">Energy</span>
          </div>
          <div className="text-muted-foreground">
            {energyCount} ({getPercentage(energyCount)}%)
          </div>
        </div>
      </div>
    </div>
  );
};