'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, AlertCircle, Plus, Minus, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardSkeleton } from './CardSkeleton';
import { Card as CardType } from '@/types/pokemon';
import { api } from '@/utils/api';
import { useToastNotification } from '@/hooks/useToastNotification';

export interface PokemonCardProps {
  card: CardType;
  layout?: 'grid' | 'list' | 'compact';
  viewMode?: 'minimal' | 'compact' | 'detailed';
  isSelected?: boolean;
  selectionMode?: boolean;
  showHolographic?: boolean;
  onClick?: (card: CardType) => void;
  onLongPress?: (card: CardType) => void;
  onSelectionToggle?: (card: CardType) => void;
  className?: string;
  showCollectionToggle?: boolean;
  isInCollection?: boolean;
  onCollectionToggle?: (card: CardType, isInCollection: boolean) => void;
}

const PokemonCard: React.FC<PokemonCardProps> = ({
  card,
  layout = 'grid',
  viewMode = 'compact',
  isSelected = false,
  selectionMode = false,
  showHolographic = false,
  onClick,
  onLongPress,
  onSelectionToggle,
  className,
  showCollectionToggle = false,
  isInCollection = false,
  onCollectionToggle,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const [inCollection, setInCollection] = useState(isInCollection);
  const [isToggling, setIsToggling] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const longPressTimer = React.useRef<NodeJS.Timeout>();
  const toast = useToastNotification();

  // Collection mutations
  const addToCollection = api.collection.addCard.useMutation({
    onSuccess: () => {
      setInCollection(true);
      setIsToggling(false);
      toast.success('Added to collection', `${card.name} has been added to your collection`);
      onCollectionToggle?.(card, true);
    },
    onError: (error) => {
      setIsToggling(false);
      console.error('Failed to add card:', error);
      toast.error('Failed to add card', error.message || 'Please try again');
    },
  });

  const removeFromCollection = api.collection.removeCardByCardId.useMutation({
    onSuccess: () => {
      setInCollection(false);
      setIsToggling(false);
      toast.success('Removed from collection', `${card.name} has been removed from your collection`);
      onCollectionToggle?.(card, false);
    },
    onError: (error) => {
      setIsToggling(false);
      console.error('Failed to remove card:', error);
      toast.error('Failed to remove card', error.message || 'Please try again');
    },
  });

  const handleCollectionToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isToggling) return;

    setIsToggling(true);
    
    if (inCollection) {
      // Remove from collection
      removeFromCollection.mutate({
        cardId: card.id,
      });
    } else {
      // Add to collection
      addToCollection.mutate({
        cardId: card.id,
        quantity: 1,
        quantityFoil: 0,
        condition: 'NEAR_MINT',
        language: 'EN',
        isWishlist: false,
      });
    }
  }, [card, inCollection, isToggling, addToCollection, removeFromCollection]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!showHolographic || !shouldShowHolographic()) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePosition({ x, y });
  }, [showHolographic]);

  const shouldShowHolographic = () => {
    return showHolographic && (
      card.rarity === 'Rare Holo' ||
      card.rarity === 'Rare Ultra' ||
      card.rarity === 'Rare Holo V' ||
      card.rarity === 'Rare Holo VMAX' ||
      card.rarity === 'Rare Secret'
    );
  };

  const handleClick = useCallback(() => {
    if (selectionMode && onSelectionToggle) {
      onSelectionToggle(card);
    } else if (onClick) {
      onClick(card);
    }
  }, [card, onClick, onSelectionToggle, selectionMode]);

  const handleTouchStart = useCallback(() => {
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress(card);
      }, 500);
    }
  }, [card, onLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  // Layout-specific classes
  const layoutClasses = {
    grid: {
      container: 'relative group cursor-pointer transition-all duration-200',
      image: {
        minimal: 'aspect-[3/4]',
        compact: 'aspect-[3/4]',
        detailed: 'aspect-[3/4]',
      },
      content: 'p-2',
    },
    list: {
      container: 'flex items-center gap-3 p-3 hover:bg-accent/50 cursor-pointer transition-colors',
      image: {
        minimal: 'w-12 h-16',
        compact: 'w-16 h-20',
        detailed: 'w-20 h-28',
      },
      content: 'flex-1 min-w-0',
    },
    compact: {
      container: 'relative group cursor-pointer',
      image: {
        minimal: 'aspect-[3/4]',
        compact: 'aspect-[3/4]',
        detailed: 'aspect-[3/4]',
      },
      content: 'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2',
    },
  };

  const currentLayout = layoutClasses[layout];

  if (layout === 'list') {
    return (
      <motion.div
        className={cn(currentLayout.container, className)}
        onClick={handleClick}
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <div 
            className={cn(
              'w-5 h-5 border-2 rounded transition-colors',
              isSelected 
                ? 'bg-primary border-primary' 
                : 'border-gray-300 hover:border-primary'
            )}
          >
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
        )}

        {/* Card image */}
        <div className={cn('relative flex-shrink-0', currentLayout.image[viewMode])}>
          {isLoading && <CardSkeleton />}
          <Image
            src={card.imageUrl || card.imageUrlLarge || card.imageUrlSmall}
            alt={card.name}
            fill
            className={cn(
              'object-contain transition-opacity duration-300',
              isLoading ? 'opacity-0' : 'opacity-100',
              hasError && 'filter grayscale'
            )}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            sizes="(max-width: 768px) 80px, 100px"
          />
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <AlertCircle className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>

        {/* Card info */}
        <div className={currentLayout.content}>
          <h3 className="font-medium text-sm truncate">
            {card.name} {card.number && <span className="text-muted-foreground">#{card.number}</span>}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{card.set?.series}</span>
            <span>•</span>
            <span>{card.set?.name}</span>
            {viewMode === 'detailed' && (
              <>
                <span>•</span>
                <span>{card.rarity}</span>
                {card.types && (
                  <>
                    <span>•</span>
                    <span>{card.types.join('/')}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Collection Toggle Button for List Layout */}
        {showCollectionToggle && (
          <button
            onClick={handleCollectionToggle}
            disabled={isToggling}
            className={cn(
              'w-8 h-8 rounded-full flex-shrink-0 mr-2',
              'flex items-center justify-center transition-all',
              'bg-white dark:bg-gray-800 shadow hover:shadow-md',
              'border-2',
              inCollection 
                ? 'border-green-500 hover:border-green-600' 
                : 'border-gray-300 hover:border-blue-500',
              isToggling && 'opacity-50 cursor-not-allowed'
            )}
            title={inCollection ? 'Remove from collection' : 'Add to collection'}
          >
            {isToggling ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
            ) : inCollection ? (
              <Minus className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        )}

        {/* Chevron */}
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </motion.div>
    );
  }

  // Grid and compact layouts
  return (
    <motion.div
      className={cn(
        currentLayout.container,
        'rounded-lg overflow-hidden relative',
        selectionMode && isSelected && 'ring-2 ring-primary',
        className
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseMove={handleMouseMove}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={shouldShowHolographic() ? {
        background: `radial-gradient(circle at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, 
          rgba(255, 255, 255, 0.3) 0%, 
          rgba(255, 255, 255, 0.1) 40%, 
          transparent 100%)`,
      } : undefined}
    >
      {/* Selection indicator */}
      {selectionMode && (
        <div className={cn(
          'absolute top-2 right-2 z-10 w-6 h-6 rounded-full border-2 bg-white/90 transition-all',
          isSelected 
            ? 'bg-primary border-primary scale-110' 
            : 'border-gray-300 hover:border-primary'
        )}>
          {isSelected && <Check className="w-4 h-4 text-white" />}
        </div>
      )}

      {/* Card image */}
      <div className={cn('relative', currentLayout.image[viewMode])}>
        {isLoading && <CardSkeleton />}
        <Image
          src={card.imageUrl || card.imageUrlLarge || card.imageUrlSmall}
          alt={card.name}
          fill
          className={cn(
            'object-contain transition-all duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
            hasError && 'filter grayscale',
            shouldShowHolographic() && 'contrast-110 saturate-110'
          )}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          priority={viewMode === 'detailed'}
        />
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
        )}

        {/* Holographic overlay */}
        {shouldShowHolographic() && (
          <div 
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background: `linear-gradient(${mousePosition.x * 360}deg, 
                transparent, 
                rgba(255, 0, 255, 0.3), 
                rgba(0, 255, 255, 0.3), 
                rgba(255, 255, 0, 0.3), 
                transparent)`,
              mixBlendMode: 'screen',
            }}
          />
        )}
      </div>

      {/* Card details (for grid layout) */}
      {layout === 'grid' && viewMode !== 'minimal' && (
        <div className={cn(currentLayout.content, 'space-y-1')}>
          <h3 className="font-medium text-sm truncate">
            {card.name} {card.number && <span className="text-muted-foreground text-xs">#{card.number}</span>}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            {card.set?.series} • {card.set?.name}
          </p>
          {viewMode === 'detailed' && (
            <p className="text-xs text-muted-foreground">
              {card.rarity}
            </p>
          )}
        </div>
      )}

      {/* Compact layout overlay */}
      {layout === 'compact' && (
        <div className={currentLayout.content}>
          <h3 className="font-medium text-sm text-white truncate">
            {card.name} {card.number && <span className="text-white/70">#{card.number}</span>}
          </h3>
          {viewMode === 'detailed' && (
            <p className="text-xs text-white/80 truncate">
              {card.set?.series} • {card.set?.name} • {card.rarity}
            </p>
          )}
        </div>
      )}

      {/* Hover Overlay with Actions */}
      {layout === 'grid' && (
        <AnimatePresence mode="wait">
          {isHovering && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-auto"
              style={{ zIndex: 20 }}
            >
              {/* Action Buttons Container */}
              <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
                {/* Collection Button - Only show when signed in */}
                {showCollectionToggle && (
                  <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCollectionToggle(e);
                  }}
                  disabled={isToggling}
                  className={cn(
                    'w-full py-2 px-3 rounded-lg font-medium text-sm',
                    'flex items-center justify-center gap-2',
                    'transition-all transform hover:scale-105',
                    'backdrop-blur-sm',
                    inCollection 
                      ? 'bg-green-500/90 hover:bg-green-600/90 text-white' 
                      : 'bg-white/90 hover:bg-white text-gray-900',
                    isToggling && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isToggling ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  ) : inCollection ? (
                    <>
                      <Check className="w-4 h-4" />
                      In Collection
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add to Collection
                    </>
                  )}
                  </button>
                )}
                
                {/* View Details Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick();
                  }}
                  className="w-full py-2 px-3 rounded-lg font-medium text-sm
                    bg-gray-800/90 hover:bg-gray-900/90 text-white
                    flex items-center justify-center gap-2
                    transition-all transform hover:scale-105
                    backdrop-blur-sm"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
              </div>

              {/* Collection Status Badge */}
              {inCollection && (
                <div className="absolute top-2 right-2">
                  <div className="bg-green-500 text-white p-1.5 rounded-full shadow-lg">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
};

export default PokemonCard;