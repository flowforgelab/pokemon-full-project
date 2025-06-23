'use client';

import React, { memo, useState } from 'react';
import { Card } from '@/types/pokemon';
import { cn } from '@/lib/utils';
import { CardItem } from './CardItem';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CardStackProps {
  cards: Card[];
  viewMode: 'compact' | 'detailed' | 'minimal';
  onCardInteraction: (card: Card, event: React.MouseEvent | React.TouchEvent) => void;
  selectedCards: string[];
  selectionMode: boolean;
}

export const CardStack = memo<CardStackProps>(({
  cards,
  viewMode,
  onCardInteraction,
  selectedCards,
  selectionMode,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : cards.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < cards.length - 1 ? prev + 1 : 0));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrevious();
      }
    }
    
    setTouchStartX(null);
  };

  const getVisibleCards = () => {
    const visibleCount = viewMode === 'detailed' ? 1 : 3;
    const result = [];
    
    for (let i = 0; i < visibleCount; i++) {
      const index = (currentIndex + i) % cards.length;
      result.push({ card: cards[index], offset: i });
    }
    
    return result;
  };

  return (
    <div className="relative flex items-center justify-center min-h-[400px] px-4">
      <button
        onClick={handlePrevious}
        className="absolute left-0 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg hover:bg-background/90 transition-colors"
        aria-label="Previous card"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div
        className="relative flex items-center justify-center w-full max-w-lg"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {getVisibleCards().map(({ card, offset }) => (
          <div
            key={card.id}
            className={cn(
              'absolute transition-all duration-300 ease-out',
              offset === 0 && 'z-30',
              offset === 1 && 'z-20 scale-95 translate-x-8 opacity-80',
              offset === 2 && 'z-10 scale-90 translate-x-16 opacity-60'
            )}
            style={{
              transform: `translateX(${offset * 40}px) scale(${1 - offset * 0.05})`,
            }}
          >
            <CardItem
              card={card}
              viewMode={viewMode === 'detailed' ? 'detailed' : 'compact'}
              isSelected={selectedCards.includes(card.id)}
              selectionMode={selectionMode}
              onClick={(e) => offset === 0 && onCardInteraction(card, e)}
              onTouchStart={(e) => offset === 0 && onCardInteraction(card, e)}
              onTouchEnd={(e) => offset === 0 && onCardInteraction(card, e)}
              className={cn(
                'w-64 sm:w-72 md:w-80',
                offset !== 0 && 'pointer-events-none'
              )}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleNext}
        className="absolute right-0 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg hover:bg-background/90 transition-colors"
        aria-label="Next card"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {cards.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={cn(
              'w-2 h-2 rounded-full transition-all',
              index === currentIndex
                ? 'bg-primary w-6'
                : 'bg-muted-foreground/30'
            )}
            aria-label={`Go to card ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
});

CardStack.displayName = 'CardStack';