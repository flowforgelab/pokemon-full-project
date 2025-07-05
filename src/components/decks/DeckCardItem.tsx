'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { DeckCard } from '@/types/pokemon';
import { cn } from '@/lib/utils';
import { Plus, Minus, X } from 'lucide-react';
import { getCardFormat, getFormatBadgeColors } from '@/lib/utils/format-legality';

interface DeckCardItemProps {
  deckCard: DeckCard;
  onUpdateQuantity: (cardId: string, quantity: number) => void;
  onRemove: (cardId: string) => void;
  className?: string;
}

export const DeckCardItem: React.FC<DeckCardItemProps> = ({
  deckCard,
  onUpdateQuantity,
  onRemove,
  className,
}) => {
  const [imageError, setImageError] = useState(false);
  const { card } = deckCard;

  if (!card) {
    return null;
  }

  const handleQuantityChange = (delta: number) => {
    const newQuantity = deckCard.quantity + delta;
    if (newQuantity >= 0 && newQuantity <= 4) {
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
      onUpdateQuantity(deckCard.cardId, newQuantity);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 hover:bg-accent/5 transition-colors',
        className
      )}
    >
      <div className="relative w-12 h-16 shrink-0">
        {imageError ? (
          <div className="w-full h-full bg-muted rounded flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">No img</span>
          </div>
        ) : (
          <Image
            src={card.imageUrlSmall}
            alt={card.name}
            fill
            className="object-cover rounded"
            onError={() => setImageError(true)}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium truncate">{card.name}</h4>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground">
            {card.set?.name} • {card.number}
          </p>
          {/* Format legality badge */}
          {(() => {
            const format = getCardFormat(card);
            const colors = getFormatBadgeColors(format);
            if (format === 'Not Legal') return null;
            
            return (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded font-medium',
                colors.bg,
                colors.text,
                colors.darkBg,
                colors.darkText
              )}>
                {format}
              </span>
            );
          })()}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => handleQuantityChange(-1)}
          disabled={deckCard.quantity <= 1}
          className={cn(
            'min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center transition-colors',
            deckCard.quantity <= 1
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'hover:bg-accent active:scale-95'
          )}
          aria-label="Decrease quantity"
        >
          <Minus className="w-5 h-5" />
        </button>

        <div className="w-8 text-center font-medium text-sm">
          {deckCard.quantity}
        </div>

        <button
          onClick={() => handleQuantityChange(1)}
          disabled={deckCard.quantity >= 4}
          className={cn(
            'min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center transition-colors',
            deckCard.quantity >= 4
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'hover:bg-accent active:scale-95'
          )}
          aria-label="Increase quantity"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={() => onRemove(deckCard.cardId)}
          className="min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors ml-1"
          aria-label="Remove card"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};