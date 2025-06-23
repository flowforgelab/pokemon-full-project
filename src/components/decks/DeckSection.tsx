'use client';

import React, { useState } from 'react';
import { DeckCard } from '@/types/pokemon';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { DeckCardItem } from './DeckCardItem';

interface DeckSectionProps {
  title: string;
  cards: DeckCard[];
  onUpdateQuantity: (cardId: string, quantity: number) => void;
  onRemoveCard: (cardId: string) => void;
  onClear?: () => void;
  accentColor: string;
  className?: string;
}

export const DeckSection: React.FC<DeckSectionProps> = ({
  title,
  cards,
  onUpdateQuantity,
  onRemoveCard,
  onClear,
  accentColor,
  className,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const totalCards = cards.reduce((sum, dc) => sum + dc.quantity, 0);

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-1 h-6 rounded-full', accentColor)} />
          <h3 className="font-medium">{title}</h3>
          <span className="text-sm text-muted-foreground">
            {totalCards} {totalCards === 1 ? 'card' : 'cards'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {onClear && cards.length > 0 && !isCollapsed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label={`Clear all ${title}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {!isCollapsed && (
        <div className="border-t">
          {cards.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">No {title.toLowerCase()} added yet</p>
              <p className="text-xs mt-1">Use the &quot;Add Cards&quot; button to search</p>
            </div>
          ) : (
            <div className="divide-y">
              {cards.map((deckCard) => (
                <DeckCardItem
                  key={deckCard.cardId}
                  deckCard={deckCard}
                  onUpdateQuantity={onUpdateQuantity}
                  onRemove={onRemoveCard}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};