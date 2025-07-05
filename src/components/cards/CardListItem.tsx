'use client';

import React, { memo, useState } from 'react';
import Image from 'next/image';
import { Card } from '@/types/pokemon';
import { cn } from '@/lib/utils';
import { Check, ChevronRight } from 'lucide-react';
import { getCardFormat, getFormatBadgeColors } from '@/lib/utils/format-legality';

interface CardListItemProps {
  card: Card;
  viewMode: 'compact' | 'detailed' | 'minimal';
  isSelected: boolean;
  selectionMode: boolean;
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  className?: string;
}

export const CardListItem = memo<CardListItemProps>(({
  card,
  viewMode,
  isSelected,
  selectionMode,
  onClick,
  onTouchStart,
  onTouchEnd,
  className,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getImageSize = () => {
    switch (viewMode) {
      case 'minimal':
        return { width: 50, height: 70 };
      case 'compact':
        return { width: 60, height: 84 };
      case 'detailed':
        return { width: 80, height: 112 };
      default:
        return { width: 60, height: 84 };
    }
  };

  const { width, height } = getImageSize();

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card',
        'transition-all duration-200 cursor-pointer',
        'hover:bg-accent hover:border-accent-foreground/20',
        'active:scale-[0.98]',
        isSelected && 'border-primary bg-primary/5',
        className
      )}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="button"
      tabIndex={0}
      aria-label={`${card.name} card`}
      data-selected={isSelected}
    >
      {selectionMode && (
        <div
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
            isSelected
              ? 'bg-primary border-primary'
              : 'bg-background border-muted-foreground/30'
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      )}

      <div className="relative shrink-0" style={{ width, height }}>
        {imageError ? (
          <div className="w-full h-full bg-muted rounded flex items-center justify-center">
            <span className="text-xs text-muted-foreground">No img</span>
          </div>
        ) : (
          <Image
            src={card.imageUrlSmall || card.imageUrlLarge}
            alt={card.name}
            width={width}
            height={height}
            className={cn(
              'object-cover rounded transition-opacity duration-300',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm truncate">{card.name}</h3>
        {viewMode !== 'minimal' && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground truncate">
              {card.set?.name}
            </span>
            {card.number && (
              <span className="text-xs text-muted-foreground">
                #{card.number}
              </span>
            )}
            {/* Format legality badge */}
            {(() => {
              const format = getCardFormat(card);
              const colors = getFormatBadgeColors(format);
              if (format === 'Not Legal') return null;
              
              return (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded font-medium',
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
        )}
        {viewMode === 'detailed' && (
          <div className="flex items-center gap-3 mt-2">
            {card.types && (
              <div className="flex gap-1">
                {card.types.map((type) => (
                  <span
                    key={type}
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      `bg-${type.toLowerCase()}/10 text-${type.toLowerCase()}`
                    )}
                  >
                    {type}
                  </span>
                ))}
              </div>
            )}
            {card.rarity && (
              <span className="text-xs text-muted-foreground">
                {card.rarity}
              </span>
            )}
          </div>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </div>
  );
});

CardListItem.displayName = 'CardListItem';