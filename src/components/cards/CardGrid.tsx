'use client';

import React, { memo } from 'react';
import { Card } from '@/types/pokemon';
import { cn } from '@/lib/utils';
import { CardItem } from './CardItem';

interface CardGridProps {
  cards: Card[];
  viewMode: 'compact' | 'detailed' | 'minimal';
  onCardInteraction: (card: Card, event: React.MouseEvent | React.TouchEvent) => void;
  selectedCards: string[];
  selectionMode: boolean;
}

export const CardGrid = memo<CardGridProps>(({
  cards,
  viewMode,
  onCardInteraction,
  selectedCards,
  selectionMode,
}) => {
  const getGridColumns = () => {
    switch (viewMode) {
      case 'minimal':
        return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8';
      case 'compact':
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
      case 'detailed':
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
      default:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
    }
  };

  return (
    <div
      className={cn(
        'grid gap-3 sm:gap-4 md:gap-5',
        getGridColumns(),
        'auto-rows-fr'
      )}
    >
      {cards.map((card) => (
        <CardItem
          key={card.id}
          card={card}
          viewMode={viewMode}
          isSelected={selectedCards.includes(card.id)}
          selectionMode={selectionMode}
          onClick={(e) => onCardInteraction(card, e)}
          onTouchStart={(e) => onCardInteraction(card, e)}
          onTouchEnd={(e) => onCardInteraction(card, e)}
        />
      ))}
    </div>
  );
});

CardGrid.displayName = 'CardGrid';