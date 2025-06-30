'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, DeckCard } from '@/types/pokemon';
import { cn } from '@/lib/utils';
import { Search, X, Filter, Mic } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { CardDisplay } from '../cards/CardDisplay';
import { api } from '@/utils/api';

interface DeckSearchProps {
  onAddCard: (cardId: string, quantity?: number) => void;
  onClose: () => void;
  existingCards: DeckCard[];
  formatId: string;
  className?: string;
}

export const DeckSearch: React.FC<DeckSearchProps> = ({
  onAddCard,
  onClose,
  existingCards,
  formatId,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const [filters, setFilters] = useState({
    supertype: '',
    types: [] as string[],
    rarity: '',
    set: '',
  });
  const [page, setPage] = useState(1);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    setPage(1); // Reset page when search changes
  }, [debouncedQuery, filters]);

  // Use tRPC query for search
  const { data: searchResult, isLoading, error } = api.card.searchOptimized.useQuery({
    query: debouncedQuery,
    filters: {
      supertype: filters.supertype ? filters.supertype as any : undefined,
      types: filters.types.length > 0 ? filters.types : undefined,
      rarity: filters.rarity ? [filters.rarity.toUpperCase().replace(' ', '_') as any] : undefined,
      setId: filters.set || undefined,
    },
    pagination: {
      page,
      limit: 50,
    },
    sort: {
      field: 'name',
      direction: 'asc',
    },
  }, {
    enabled: !!debouncedQuery || Object.values(filters).some(v => v.length > 0),
    keepPreviousData: true,
  });

  const searchResults = searchResult?.cards || [];
  const hasMore = searchResult ? page < searchResult.totalPages : false;

  const handleVoiceSearch = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice search is not supported in your browser');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsVoiceSearching(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      setIsVoiceSearching(false);
    };

    recognition.onerror = () => {
      setIsVoiceSearching(false);
    };

    recognition.onend = () => {
      setIsVoiceSearching(false);
    };

    recognition.start();
  }, []);

  const handleCardSelect = useCallback((card: Card) => {
    onAddCard(card.id);
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [onAddCard]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage(p => p + 1);
    }
  }, [isLoading, hasMore]);

  const existingCardIds = existingCards.map(dc => dc.cardId);

  return (
    <div className={cn('fixed inset-0 z-50 bg-background', className)}>
      <div className="flex flex-col h-full">
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or number..."
                  className="w-full pl-10 pr-10 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {(searchQuery || isVoiceSearching) && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-accent transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                onClick={handleVoiceSearch}
                disabled={isVoiceSearching}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isVoiceSearching
                    ? 'bg-primary text-primary-foreground animate-pulse'
                    : 'hover:bg-accent'
                )}
                aria-label="Voice search"
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 -mb-2">
              <select
                value={filters.supertype}
                onChange={(e) => setFilters({ ...filters, supertype: e.target.value })}
                className="px-3 py-1.5 text-sm border rounded-md bg-background"
              >
                <option value="">All Types</option>
                <option value="POKEMON">Pokémon</option>
                <option value="TRAINER">Trainers</option>
                <option value="ENERGY">Energy</option>
              </select>

              <select
                value={filters.rarity}
                onChange={(e) => setFilters({ ...filters, rarity: e.target.value })}
                className="px-3 py-1.5 text-sm border rounded-md bg-background"
              >
                <option value="">All Rarities</option>
                <option value="COMMON">Common</option>
                <option value="UNCOMMON">Uncommon</option>
                <option value="RARE">Rare</option>
                <option value="RARE_HOLO">Rare Holo</option>
              </select>

              <button className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors flex items-center gap-1 whitespace-nowrap">
                <Filter className="w-3 h-3" />
                More Filters
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="text-red-500 mb-4">
                <X className="w-12 h-12" />
              </div>
              <p className="text-red-500 font-medium">Search Error</p>
              <p className="text-sm text-muted-foreground mt-1">Failed to load cards</p>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="p-4">
              <div className="mb-2 text-sm text-muted-foreground">
                Found {searchResult?.total || 0} cards
              </div>
              <CardDisplay
                cards={searchResults.map(card => ({
                  ...card,
                  isInDeck: existingCardIds.includes(card.id),
                }))}
                layout="grid"
                viewMode="compact"
                onCardSelect={handleCardSelect}
                onCardLongPress={handleCardSelect}
                isLoading={isLoading}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              {isLoading ? (
                <>
                  <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground">Searching cards...</p>
                </>
              ) : searchQuery || Object.values(filters).some(v => v.length > 0) ? (
                <>
                  <Search className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No cards found</p>
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting your search</p>
                </>
              ) : (
                <>
                  <Search className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Search for cards to add</p>
                  <p className="text-sm text-muted-foreground mt-1">Type a name or use filters</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};