'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { cn } from '@/lib/utils';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface MobileDeckBuilderProps {
  deck: any;
  onAddCard: (card: any) => void;
  onRemoveCard: (cardId: string, section: string) => void;
  onUpdateQuantity: (cardId: string, section: string, delta: number) => void;
  searchResults?: any[];
  onSearch: (query: string) => void;
  isSearching?: boolean;
}

export const MobileDeckBuilder: React.FC<MobileDeckBuilderProps> = ({
  deck,
  onAddCard,
  onRemoveCard,
  onUpdateQuantity,
  searchResults,
  onSearch,
  isSearching,
}) => {
  const [activeTab, setActiveTab] = useState<'deck' | 'search' | 'stats'>('deck');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);

  const totalCards = 
    deck.pokemon.reduce((sum: number, card: any) => sum + card.quantity, 0) +
    deck.trainer.reduce((sum: number, card: any) => sum + card.quantity, 0) +
    deck.energy.reduce((sum: number, card: any) => sum + card.quantity, 0);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch(query);
  };

  const handleAddCard = (card: any) => {
    onAddCard(card);
    setSelectedCard(null);
    // Show success animation
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Deck Builder</h1>
          <div className="flex items-center gap-3">
            <span className={cn(
              'text-sm font-medium',
              totalCards === 60 ? 'text-green-600' : 'text-gray-600'
            )}>
              {totalCards}/60
            </span>
            <button className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
              <ChartBarIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="flex">
          {[
            { id: 'deck', label: 'Deck', icon: Squares2X2Icon },
            { id: 'search', label: 'Search', icon: MagnifyingGlassIcon },
            { id: 'stats', label: 'Stats', icon: ChartBarIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                if (tab.id === 'search') setIsSearchSheetOpen(true);
              }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'deck' && (
            <motion.div
              key="deck"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-4 space-y-4"
            >
              {/* Pokemon Section */}
              <DeckSection
                title="Pokémon"
                cards={deck.pokemon}
                color="red"
                onUpdateQuantity={(cardId, delta) => onUpdateQuantity(cardId, 'pokemon', delta)}
                onRemoveCard={(cardId) => onRemoveCard(cardId, 'pokemon')}
              />

              {/* Trainer Section */}
              <DeckSection
                title="Trainers"
                cards={deck.trainer}
                color="blue"
                onUpdateQuantity={(cardId, delta) => onUpdateQuantity(cardId, 'trainer', delta)}
                onRemoveCard={(cardId) => onRemoveCard(cardId, 'trainer')}
              />

              {/* Energy Section */}
              <DeckSection
                title="Energy"
                cards={deck.energy}
                color="yellow"
                onUpdateQuantity={(cardId, delta) => onUpdateQuantity(cardId, 'energy', delta)}
                onRemoveCard={(cardId) => onRemoveCard(cardId, 'energy')}
              />
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-4">
                <h3 className="font-semibold">Deck Analysis</h3>
                {/* Add deck analysis content */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsSearchSheetOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-10"
      >
        <PlusIcon className="w-6 h-6" />
      </motion.button>

      {/* Search Bottom Sheet */}
      <BottomSheet
        isOpen={isSearchSheetOpen}
        onClose={() => setIsSearchSheetOpen(false)}
        title="Add Cards"
        defaultSnapPoint={0.9}
      >
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg"
            />
          </div>

          {/* Search Results */}
          <div className="grid grid-cols-3 gap-3">
            {searchResults?.map((card) => (
              <motion.div
                key={card.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAddCard(card)}
                className="aspect-[3/4] relative rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700"
              >
                {card.imageUrlSmall && (
                  <img
                    src={card.imageUrlSmall}
                    alt={card.name}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-white text-xs font-medium truncate">
                      {card.name}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

// Deck Section Component
interface DeckSectionProps {
  title: string;
  cards: any[];
  color: string;
  onUpdateQuantity: (cardId: string, delta: number) => void;
  onRemoveCard: (cardId: string) => void;
}

const DeckSection: React.FC<DeckSectionProps> = ({
  title,
  cards,
  color,
  onUpdateQuantity,
  onRemoveCard,
}) => {
  const count = cards.reduce((sum, card) => sum + card.quantity, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      <div className={cn(
        'px-4 py-2 flex items-center justify-between',
        color === 'red' && 'bg-red-500',
        color === 'blue' && 'bg-blue-500',
        color === 'yellow' && 'bg-yellow-500'
      )}>
        <h3 className="text-white font-medium">{title}</h3>
        <span className="text-white text-sm">{count}</span>
      </div>
      
      <div className="divide-y dark:divide-gray-700">
        {cards.length === 0 ? (
          <p className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            No {title.toLowerCase()} added yet
          </p>
        ) : (
          cards.map((card) => (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-3 p-3"
            >
              <img
                src={card.card.imageUrlSmall}
                alt={card.card.name}
                className="w-12 h-16 object-cover rounded"
              />
              <div className="flex-1">
                <p className="font-medium text-sm">{card.card.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {card.card.set.name}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onUpdateQuantity(card.cardId, -1)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <MinusIcon className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-medium">
                  {card.quantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity(card.cardId, 1)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onRemoveCard(card.cardId)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ml-1"
                >
                  <XMarkIcon className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};