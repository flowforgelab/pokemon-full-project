'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { Card } from '@/types/pokemon';
import { cn } from '@/lib/utils';
import { CardGrid } from './CardGrid';
import { CardList } from './CardList';
import { CardStack } from './CardStack';

export interface CardDisplayProps {
  cards: Card[];
  layout: 'grid' | 'list' | 'stack';
  viewMode: 'compact' | 'detailed' | 'minimal';
  onCardSelect: (card: Card) => void;
  onCardLongPress: (card: Card) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  selectionMode?: boolean;
  selectedCards?: string[];
  onSelectionChange?: (cardIds: string[]) => void;
  className?: string;
}

export const CardDisplay: React.FC<CardDisplayProps> = ({
  cards,
  layout = 'grid',
  viewMode = 'compact',
  onCardSelect,
  onCardLongPress,
  isLoading,
  hasMore,
  onLoadMore,
  selectionMode = false,
  selectedCards = [],
  onSelectionChange,
  className,
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const isIntersecting = useIntersectionObserver(loadMoreRef, {
    threshold: 0.1,
    rootMargin: '100px',
  });

  useEffect(() => {
    if (isIntersecting && hasMore && !isLoading && onLoadMore) {
      onLoadMore();
    }
  }, [isIntersecting, hasMore, isLoading, onLoadMore]);

  const handleTouchStart = useCallback((card: Card) => {
    setTouchStart(Date.now());
    const timer = setTimeout(() => {
      onCardLongPress(card);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
    setLongPressTimer(timer);
  }, [onCardLongPress]);

  const handleTouchEnd = useCallback((card: Card) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    const touchDuration = touchStart ? Date.now() - touchStart : 0;
    if (touchDuration < 500) {
      if (selectionMode && onSelectionChange) {
        const isSelected = selectedCards.includes(card.id);
        if (isSelected) {
          onSelectionChange(selectedCards.filter(id => id !== card.id));
        } else {
          onSelectionChange([...selectedCards, card.id]);
        }
      } else {
        onCardSelect(card);
      }
    }
    setTouchStart(null);
  }, [touchStart, longPressTimer, selectionMode, selectedCards, onSelectionChange, onCardSelect]);

  const handleCardInteraction = useCallback((card: Card, event: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in event) {
      if (event.type === 'touchstart') {
        handleTouchStart(card);
      } else if (event.type === 'touchend') {
        handleTouchEnd(card);
      }
    } else {
      if (selectionMode && onSelectionChange) {
        const isSelected = selectedCards.includes(card.id);
        if (isSelected) {
          onSelectionChange(selectedCards.filter(id => id !== card.id));
        } else {
          onSelectionChange([...selectedCards, card.id]);
        }
      } else {
        onCardSelect(card);
      }
    }
  }, [handleTouchStart, handleTouchEnd, selectionMode, selectedCards, onSelectionChange, onCardSelect]);

  const renderLayout = () => {
    const layoutProps = {
      cards,
      viewMode,
      onCardInteraction: handleCardInteraction,
      selectedCards,
      selectionMode,
    };

    switch (layout) {
      case 'grid':
        return <CardGrid {...layoutProps} />;
      case 'list':
        return <CardList {...layoutProps} />;
      case 'stack':
        return <CardStack {...layoutProps} />;
      default:
        return <CardGrid {...layoutProps} />;
    }
  };

  return (
    <div className={cn('relative', className)}>
      {renderLayout()}
      
      {(hasMore || isLoading) && (
        <div
          ref={loadMoreRef}
          className="flex justify-center items-center py-8"
        >
          {isLoading && (
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Loading more cards...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};