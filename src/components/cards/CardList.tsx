'use client';

import React, { memo } from 'react';
import { Card } from '@/types/pokemon';
import { cn } from '@/lib/utils';
import { CardListItem } from './CardListItem';

interface CardListProps {
  cards: Card[];
  viewMode: 'compact' | 'detailed' | 'minimal';
  onCardInteraction: (card: Card, event: React.MouseEvent | React.TouchEvent) => void;
  selectedCards: string[];
  selectionMode: boolean;
}

export const CardList = memo<CardListProps>(({
  cards,
  viewMode,
  onCardInteraction,
  selectedCards,
  selectionMode,
}) => {
  return (
    <div className="flex flex-col space-y-2">
      {cards.map((card) => (
        <CardListItem
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

CardList.displayName = 'CardList';