'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { DeckCard } from '@/types/pokemon';
import { cn } from '@/lib/utils';
import { DeckSection } from './DeckSection';
import { DeckStats } from './DeckStats';
import { DeckSearch } from './DeckSearch';
import { DeckValidation } from './DeckValidation';
import { useDeckValidation } from '@/hooks/useDeckValidation';
import { useDebounce } from '@/hooks/useDebounce';

export interface DeckBuilderProps {
  initialDeck?: DeckCard[];
  formatId: string;
  onSave: (deck: DeckCard[]) => Promise<void>;
  onCancel?: () => void;
  autoSave?: boolean;
  className?: string;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({
  initialDeck = [],
  formatId,
  onSave,
  onCancel,
  autoSave = true,
  className,
}) => {
  const [deck, setDeck] = useState<DeckCard[]>(initialDeck);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const debouncedDeck = useDebounce(deck, 2000);
  const validation = useDeckValidation(deck, formatId);

  const pokemonCards = deck.filter(dc => dc.card?.supertype === 'POKEMON');
  const trainerCards = deck.filter(dc => dc.card?.supertype === 'TRAINER');
  const energyCards = deck.filter(dc => dc.card?.supertype === 'ENERGY');

  const totalCards = deck.reduce((sum, dc) => sum + dc.quantity, 0);

  useEffect(() => {
    if (autoSave && debouncedDeck.length > 0 && !isSaving) {
      handleAutoSave();
    }
  }, [debouncedDeck]);

  const handleAutoSave = async () => {
    setIsSaving(true);
    try {
      await onSave(debouncedDeck);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCard = useCallback((cardId: string, quantity: number = 1) => {
    setDeck((prev) => {
      const existing = prev.find((dc) => dc.cardId === cardId);
      if (existing) {
        return prev.map((dc) =>
          dc.cardId === cardId
            ? { ...dc, quantity: Math.min(dc.quantity + quantity, 4) }
            : dc
        );
      }
      return [...prev, { cardId, quantity }];
    });
  }, []);

  const handleRemoveCard = useCallback((cardId: string, quantity: number = 1) => {
    setDeck((prev) => {
      return prev
        .map((dc) =>
          dc.cardId === cardId
            ? { ...dc, quantity: Math.max(0, dc.quantity - quantity) }
            : dc
        )
        .filter((dc) => dc.quantity > 0);
    });
  }, []);

  const handleUpdateQuantity = useCallback((cardId: string, quantity: number) => {
    setDeck((prev) => {
      if (quantity <= 0) {
        return prev.filter((dc) => dc.cardId !== cardId);
      }
      return prev.map((dc) =>
        dc.cardId === cardId ? { ...dc, quantity: Math.min(quantity, 4) } : dc
      );
    });
  }, []);

  const handleClearSection = useCallback((supertype: 'POKEMON' | 'TRAINER' | 'ENERGY') => {
    setDeck((prev) => prev.filter((dc) => dc.card?.supertype !== supertype));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(deck);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="sticky top-0 z-20 bg-background border-b">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Deck Builder</h2>
              <p className="text-sm text-muted-foreground">
                {totalCards}/60 cards
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastSaved && (
                <span className="text-xs text-muted-foreground">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Add Cards
              </button>
            </div>
          </div>
          
          <DeckStats
            totalCards={totalCards}
            pokemonCount={pokemonCards.reduce((sum, dc) => sum + dc.quantity, 0)}
            trainerCount={trainerCards.reduce((sum, dc) => sum + dc.quantity, 0)}
            energyCount={energyCards.reduce((sum, dc) => sum + dc.quantity, 0)}
          />
          
          {validation.errors.length > 0 && (
            <DeckValidation errors={validation.errors} warnings={validation.warnings} />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          <DeckSection
            title="Pokémon"
            cards={pokemonCards}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveCard={handleRemoveCard}
            onClear={() => handleClearSection('POKEMON')}
            accentColor="bg-red-500"
          />
          
          <DeckSection
            title="Trainers"
            cards={trainerCards}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveCard={handleRemoveCard}
            onClear={() => handleClearSection('TRAINER')}
            accentColor="bg-blue-500"
          />
          
          <DeckSection
            title="Energy"
            cards={energyCards}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveCard={handleRemoveCard}
            onClear={() => handleClearSection('ENERGY')}
            accentColor="bg-yellow-500"
          />
        </div>
      </div>

      <div className="sticky bottom-0 bg-background border-t p-4">
        <div className="flex gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-input rounded-lg text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || validation.errors.length > 0}
            className={cn(
              'flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              validation.errors.length > 0
                ? 'bg-destructive/20 text-destructive cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {isSaving ? 'Saving...' : 'Save Deck'}
          </button>
        </div>
      </div>

      {isSearchOpen && (
        <DeckSearch
          onAddCard={handleAddCard}
          onClose={() => setIsSearchOpen(false)}
          existingCards={deck}
          formatId={formatId}
        />
      )}
    </div>
  );
};