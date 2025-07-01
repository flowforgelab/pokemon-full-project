'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Plus, Check, AlertCircle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/utils/api';
import { useToastNotification } from '@/hooks/useToastNotification';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { MobileModal } from '@/components/ui/MobileModal';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Card as CardType } from '@/types/pokemon';

interface DeckSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardType | null;
}

export const DeckSelector: React.FC<DeckSelectorProps> = ({
  isOpen,
  onClose,
  card,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const toast = useToastNotification();
  const utils = api.useUtils();

  // Fetch user's decks
  const { data: decksData, isLoading: isLoadingDecks } = api.deck.getUserDecks.useQuery({
    page: 1,
    pageSize: 50,
  });

  // Check which decks already contain this card
  const { data: deckCardsData } = api.deck.getCardInDecks.useQuery(
    { cardId: card?.id || '' },
    { enabled: !!card?.id }
  );

  // Add card to deck mutation
  const addCardToDeck = api.deck.addCard.useMutation({
    onSuccess: () => {
      toast.success('Card added to deck', `${card?.name} has been added to your deck`);
      utils.deck.getCardInDecks.invalidate({ cardId: card?.id });
      utils.deck.getUserDecks.invalidate();
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to add card', error.message);
    },
  });

  const handleAddToDeck = async (deckId: string) => {
    if (!card || isAdding) return;
    
    setIsAdding(true);
    setSelectedDeckId(deckId);
    
    try {
      await addCardToDeck.mutateAsync({
        deckId,
        cardId: card.id,
        quantity: 1,
      });
    } finally {
      setIsAdding(false);
      setSelectedDeckId(null);
    }
  };

  const filteredDecks = decksData?.decks?.filter((deck) =>
    deck.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getDeckCardCount = (deckId: string) => {
    const deckCard = deckCardsData?.find((dc) => dc.deckId === deckId);
    return deckCard?.quantity || 0;
  };

  const content = (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search decks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
            bg-white dark:bg-gray-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Deck List */}
      {isLoadingDecks ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredDecks.length === 0 ? (
        <div className="text-center py-8">
          <Layers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery ? 'No decks found matching your search' : 'You have no decks yet'}
          </p>
          <button
            onClick={() => window.location.href = '/deck-builder/create'}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create New Deck
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDecks.map((deck) => {
            const cardCount = getDeckCardCount(deck.id);
            const isMaxCopies = cardCount >= 4;
            const isBasicEnergy = card?.supertype === 'ENERGY' && 
              ['Grass Energy', 'Fire Energy', 'Water Energy', 'Lightning Energy',
               'Psychic Energy', 'Fighting Energy', 'Darkness Energy', 'Metal Energy', 'Fairy Energy'].includes(card.name || '');
            const canAdd = !isMaxCopies || isBasicEnergy;

            return (
              <motion.button
                key={deck.id}
                onClick={() => canAdd && handleAddToDeck(deck.id)}
                disabled={!canAdd || isAdding}
                className={cn(
                  'w-full p-4 rounded-lg border transition-all text-left',
                  'hover:shadow-md',
                  canAdd
                    ? 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400'
                    : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed',
                  'bg-white dark:bg-gray-800'
                )}
                whileHover={canAdd ? { scale: 1.02 } : {}}
                whileTap={canAdd ? { scale: 0.98 } : {}}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {deck.name}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <span>{deck._count?.cards || 0}/60 cards</span>
                      {deck.format && <span>{deck.format.name}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {cardCount > 0 && (
                      <div className={cn(
                        'px-3 py-1 rounded-full text-sm font-medium',
                        isMaxCopies && !isBasicEnergy
                          ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                          : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      )}>
                        {cardCount} {isBasicEnergy ? 'copies' : cardCount === 1 ? 'copy' : 'copies'}
                      </div>
                    )}

                    {selectedDeckId === deck.id && isAdding ? (
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                      </div>
                    ) : canAdd ? (
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Create New Deck Button */}
      <button
        onClick={() => window.location.href = '/deck-builder/create'}
        className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg
          hover:border-blue-500 dark:hover:border-blue-400 transition-colors
          flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400
          hover:text-blue-600 dark:hover:text-blue-400"
      >
        <Plus className="w-5 h-5" />
        Create New Deck
      </button>
    </div>
  );

  // Use BottomSheet for mobile, MobileModal for desktop
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={`Add ${card?.name || 'Card'} to Deck`}
        defaultSnapPoint={0.7}
        snapPoints={[0.5, 0.7, 0.9]}
      >
        {content}
      </BottomSheet>
    );
  }

  return (
    <MobileModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add ${card?.name || 'Card'} to Deck`}
      size="medium"
      position="center"
    >
      {content}
    </MobileModal>
  );
};

export default DeckSelector;