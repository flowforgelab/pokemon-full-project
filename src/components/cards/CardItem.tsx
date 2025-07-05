'use client';

import React, { memo, useState } from 'react';
import Image from 'next/image';
import { Card } from '@/types/pokemon';
import { cn } from '@/lib/utils';
import { Check, Zap } from 'lucide-react';
import { CardSkeleton } from './CardSkeleton';
import { getCardFormat, getFormatBadgeColors } from '@/lib/utils/format-legality';

interface CardItemProps {
  card: Card;
  viewMode: 'compact' | 'detailed' | 'minimal';
  isSelected: boolean;
  selectionMode: boolean;
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  className?: string;
}

export const CardItem = memo<CardItemProps>(({
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

  const getCardSize = () => {
    switch (viewMode) {
      case 'minimal':
        return 'aspect-[2.5/3.5] min-h-[120px]';
      case 'compact':
        return 'aspect-[2.5/3.5] min-h-[200px]';
      case 'detailed':
        return 'aspect-[2.5/3.5] min-h-[300px]';
      default:
        return 'aspect-[2.5/3.5] min-h-[200px]';
    }
  };

  const renderCardContent = () => {
    if (viewMode === 'minimal') {
      return (
        <div className="relative w-full h-full">
          {!imageLoaded && !imageError && <CardSkeleton />}
          {imageError ? (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          ) : (
            <Image
              src={card.imageUrlSmall || card.imageUrlLarge}
              alt={card.name}
              fill
              className={cn(
                'object-cover rounded-lg transition-opacity duration-300',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          )}
        </div>
      );
    }

    return (
      <div className="relative w-full h-full">
        {!imageLoaded && !imageError && <CardSkeleton />}
        {imageError ? (
          <div className="w-full h-full bg-muted flex flex-col items-center justify-center p-4">
            <span className="text-sm font-medium">{card.name}</span>
            <span className="text-xs text-muted-foreground mt-1">No image available</span>
          </div>
        ) : (
          <>
            <Image
              src={card.imageUrlSmall || card.imageUrlLarge}
              alt={card.name}
              fill
              className={cn(
                'object-cover rounded-lg transition-opacity duration-300',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            {viewMode === 'detailed' && imageLoaded && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 rounded-b-lg">
                <h3 className="text-white font-medium text-sm truncate">{card.name}</h3>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-white/80 text-xs">{card.set?.name}</span>
                  {card.rarity && (
                    <span className="text-white/80 text-xs flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {card.rarity}
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* Format legality badge */}
            {viewMode !== 'minimal' && imageLoaded && (
              <div className="absolute top-2 left-2">
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
          </>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'relative group cursor-pointer transition-all duration-200',
        'hover:scale-105 active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        isSelected && 'ring-2 ring-primary ring-offset-2',
        getCardSize(),
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
      {renderCardContent()}
      
      {selectionMode && (
        <div
          className={cn(
            'absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
            isSelected
              ? 'bg-primary border-primary'
              : 'bg-white/80 border-gray-300 group-hover:border-primary'
          )}
        >
          {isSelected && <Check className="w-4 h-4 text-white" />}
        </div>
      )}
    </div>
  );
});

CardItem.displayName = 'CardItem';