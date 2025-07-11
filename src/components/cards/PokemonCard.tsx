'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, AlertCircle, Plus, Minus, Eye, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardSkeleton } from './CardSkeleton';
import { Card as CardType } from '@/types/pokemon';
import { api } from '@/utils/api';
import { useToastNotification } from '@/hooks/useToastNotification';
import { CollectionIndicator } from './CollectionIndicator';
import { getCardFormat, getFormatBadgeColors } from '@/lib/utils/format-legality';

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
  collectionQuantity?: number;
  collectionQuantityFoil?: number;
  onQuantityChange?: (quantity: number, quantityFoil: number) => void;
  showCollectionIndicator?: boolean;
  onAddToDeck?: (card: CardType) => void;
  showAddToDeck?: boolean;
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
  collectionQuantity = 0,
  collectionQuantityFoil = 0,
  onQuantityChange,
  showCollectionIndicator = false,
  onAddToDeck,
  showAddToDeck = false,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const [inCollection, setInCollection] = useState(isInCollection);
  const [isToggling, setIsToggling] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const longPressTimer = React.useRef<NodeJS.Timeout>();
  const touchTimer = React.useRef<NodeJS.Timeout>();
  const toast = useToastNotification();
  const utils = api.useUtils();
  
  // Handle client-side mounting
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync internal state when prop changes
  React.useEffect(() => {
    setInCollection(isInCollection);
  }, [isInCollection]);

  // Collection mutations
  const addToCollection = api.collection.addCard.useMutation({
    onSuccess: () => {
      setInCollection(true);
      setIsToggling(false);
      // Invalidate the collection check query to ensure fresh data
      utils.collection.checkCardsInCollection.invalidate();
      if (isMounted && toast) {
        try {
          toast.success('Added to collection', `${card.name} has been added to your collection`);
        } catch (e) {
          console.error('Toast error:', e);
        }
      }
      onCollectionToggle?.(card, true);
    },
    onError: (error) => {
      setIsToggling(false);
      console.error('Failed to add card:', error);
      
      // Safely extract error message
      let errorMessage = 'Please try again';
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if ('data' in error && error.data && typeof error.data === 'object' && 'message' in error.data) {
          errorMessage = String(error.data.message);
        }
      }
      
      if (isMounted && toast) {
        try {
          toast.error('Failed to add card', errorMessage);
        } catch (e) {
          console.error('Toast error:', e);
        }
      }
    },
  });

  const removeFromCollection = api.collection.removeCardByCardId.useMutation({
    onSuccess: () => {
      setInCollection(false);
      setIsToggling(false);
      // Invalidate the collection check query to ensure fresh data
      utils.collection.checkCardsInCollection.invalidate();
      if (isMounted && toast) {
        try {
          toast.success('Removed from collection', `${card.name} has been removed from your collection`);
        } catch (e) {
          console.error('Toast error:', e);
        }
      }
      onCollectionToggle?.(card, false);
    },
    onError: (error) => {
      setIsToggling(false);
      console.error('Failed to remove card:', error);
      
      // Safely extract error message
      let errorMessage = 'Please try again';
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if ('data' in error && error.data && typeof error.data === 'object' && 'message' in error.data) {
          errorMessage = String(error.data.message);
        }
      }
      
      if (isMounted && toast) {
        try {
          toast.error('Failed to remove card', errorMessage);
        } catch (e) {
          console.error('Toast error:', e);
        }
      }
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
    setIsTouching(true);
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress(card);
      }, 500);
    }
    // Show actions after a brief delay on touch
    if (showAddToDeck && layout === 'grid') {
      touchTimer.current = setTimeout(() => {
        setIsHovering(true);
      }, 200);
    }
  }, [card, onLongPress, showAddToDeck, layout]);

  const handleTouchEnd = useCallback(() => {
    setIsTouching(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
    }
    // Hide actions after a delay
    if (layout === 'grid') {
      setTimeout(() => {
        if (!isTouching) {
          setIsHovering(false);
        }
      }, 3000);
    }
  }, [layout, isTouching]);

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
          {/* Format legality badge */}
          {viewMode !== 'minimal' && (
            <div className="mt-1">
              {(() => {
                const format = getCardFormat(card);
                const colors = getFormatBadgeColors(format);
                if (format === 'Not Legal') return null;
                
                return (
                  <span className={cn(
                    'inline-block text-xs px-2 py-0.5 rounded font-medium',
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
        'rounded-lg relative',
        'shadow-md hover:shadow-xl transition-shadow duration-200',
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
      whileHover={{ 
        y: -4,
        transition: { duration: 0.2 }
      }}
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
      <div className={cn('relative rounded-lg overflow-hidden', currentLayout.image[viewMode])}>
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

      {/* Format legality badge (positioned absolutely for grid) */}
      {layout === 'grid' && viewMode !== 'minimal' && (
        <div className="absolute top-2 left-2 z-10">
          {(() => {
            const format = getCardFormat(card);
            const colors = getFormatBadgeColors(format);
            if (format === 'Not Legal') return null;
            
            return (
              <span className={cn(
                'inline-block text-xs px-2 py-0.5 rounded font-medium shadow-sm',
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

      {/* Collection Indicator for Grid Layout - Render first so hover doesn't block it */}
      {layout === 'grid' && showCollectionIndicator && (
        <CollectionIndicator
          cardId={card.id}
          cardName={card.name}
          inCollection={collectionQuantity > 0 || collectionQuantityFoil > 0}
          quantity={collectionQuantity}
          quantityFoil={collectionQuantityFoil}
          isBasicEnergy={card.supertype === 'ENERGY' && 
            ['Grass Energy', 'Fire Energy', 'Water Energy', 'Lightning Energy',
             'Psychic Energy', 'Fighting Energy', 'Darkness Energy', 'Metal Energy', 'Fairy Energy'].includes(card.name)}
          onQuantityChange={onQuantityChange}
          layout="grid"
        />
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
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none"
              style={{ zIndex: 10 }}
            >
              {/* Action Buttons Container */}
              <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-auto space-y-2">
                {/* Add to Deck Button */}
                {showAddToDeck && onAddToDeck && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToDeck(card);
                    }}
                    className="w-full py-2 px-3 rounded-lg font-medium text-sm
                      bg-blue-600/90 hover:bg-blue-700/90 text-white
                      flex items-center justify-center gap-2
                      transition-all transform hover:scale-105
                      backdrop-blur-sm"
                  >
                    <Layers className="w-4 h-4" />
                    Add to Deck
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

            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
};

export default PokemonCard;