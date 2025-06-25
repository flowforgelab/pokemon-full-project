'use client';

import { useState, useCallback, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { MobileDeckBuilder } from '@/components/decks/MobileDeckBuilder';
import { api } from '@/utils/api';
import { useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  ChartBarIcon,
  DocumentArrowDownIcon,
  PlayIcon,
  SparklesIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useDebounce } from '@/hooks/useDebounce';
import { useToastNotification } from '@/hooks/useToastNotification';
import { useBreakpoint } from '@/hooks/useMediaQuery';

interface DeckCard {
  id: string;
  cardId: string;
  card: any;
  quantity: number;
}

interface DeckSection {
  pokemon: DeckCard[];
  trainer: DeckCard[];
  energy: DeckCard[];
}

export default function DeckBuilderPage() {
  const router = useRouter();
  const toast = useToastNotification();
  const [deckName, setDeckName] = useState('');
  const [format, setFormat] = useState('standard');
  const [searchQuery, setSearchQuery] = useState('');
  const [deck, setDeck] = useState<DeckSection>({
    pokemon: [],
    trainer: [],
    energy: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  
  const { isMobile } = useBreakpoint();
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: searchResults, isLoading: searchLoading } = api.card.search.useQuery(
    {
      query: debouncedSearch,
      filters: { format },
      limit: 20,
    },
    {
      enabled: debouncedSearch.length > 0,
    }
  );

  const { data: analysis } = api.analysis.analyzeDeckComposition.useQuery({
    cards: [...deck.pokemon, ...deck.trainer, ...deck.energy],
  });

  const createDeckMutation = api.deck.create.useMutation({
    onSuccess: (data) => {
      router.push(`/decks/${data.id}`);
    },
  });

  const totalCards = deck.pokemon.reduce((sum, card) => sum + card.quantity, 0) +
    deck.trainer.reduce((sum, card) => sum + card.quantity, 0) +
    deck.energy.reduce((sum, card) => sum + card.quantity, 0);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;

    // Moving within the same section
    if (source.droppableId === destination.droppableId) {
      const section = source.droppableId as keyof DeckSection;
      const newCards = Array.from(deck[section]);
      const [removed] = newCards.splice(source.index, 1);
      newCards.splice(destination.index, 0, removed);

      setDeck({
        ...deck,
        [section]: newCards,
      });
    }
  };

  const addCardToDeck = (card: any) => {
    const section = card.supertype.toLowerCase() as keyof DeckSection;
    const existingCard = deck[section].find(c => c.cardId === card.id);

    if (existingCard) {
      // Increase quantity
      if (existingCard.quantity < 4 || card.supertype === 'Energy') {
        setDeck({
          ...deck,
          [section]: deck[section].map(c =>
            c.cardId === card.id
              ? { ...c, quantity: c.quantity + 1 }
              : c
          ),
        });
        toast.success(`Added ${card.name}`, `${existingCard.quantity + 1} copies in deck`);
      } else {
        toast.warning('Card limit reached', 'Maximum 4 copies allowed (except basic energy)');
      }
    } else {
      // Add new card
      setDeck({
        ...deck,
        [section]: [...deck[section], {
          id: `${card.id}-${Date.now()}`,
          cardId: card.id,
          card,
          quantity: 1,
        }],
      });
      toast.success(`Added ${card.name}`, 'Card added to deck');
    }
  };

  const updateCardQuantity = (section: keyof DeckSection, cardId: string, delta: number) => {
    setDeck({
      ...deck,
      [section]: deck[section].map(c => {
        if (c.cardId === cardId) {
          const newQuantity = c.quantity + delta;
          if (newQuantity <= 0) return null;
          if (newQuantity > 4 && c.card.supertype !== 'Energy') return c;
          return { ...c, quantity: newQuantity };
        }
        return c;
      }).filter(Boolean) as DeckCard[],
    });
  };

  const removeCard = (section: keyof DeckSection, cardId: string) => {
    setDeck({
      ...deck,
      [section]: deck[section].filter(c => c.cardId !== cardId),
    });
  };

  const saveDeck = async () => {
    if (!deckName) {
      toast.error('Deck name required', 'Please enter a name for your deck');
      return;
    }
    
    if (totalCards === 0) {
      toast.error('No cards in deck', 'Add some cards before saving');
      return;
    }

    if (totalCards !== 60) {
      toast.warning('Invalid deck size', `Deck must have exactly 60 cards (currently ${totalCards})`);
      return;
    }

    setIsSaving(true);
    try {
      const cards = [
        ...deck.pokemon.map(c => ({ cardId: c.cardId, quantity: c.quantity })),
        ...deck.trainer.map(c => ({ cardId: c.cardId, quantity: c.quantity })),
        ...deck.energy.map(c => ({ cardId: c.cardId, quantity: c.quantity })),
      ];

      await toast.promise(
        createDeckMutation.mutateAsync({
          name: deckName,
          format,
          cards,
        }),
        {
          loading: 'Saving deck...',
          success: 'Deck saved successfully!',
          error: 'Failed to save deck',
        }
      );
    } catch (error) {
      // Error already handled by toast.promise
    } finally {
      setIsSaving(false);
    }
  };

  // Mobile version
  if (isMobile) {
    return (
      <MobileDeckBuilder
        deck={deck}
        onAddCard={addCardToDeck}
        onRemoveCard={removeCard}
        onUpdateQuantity={updateCardQuantity}
        searchResults={searchResults?.cards}
        onSearch={setSearchQuery}
        isSearching={searchLoading}
      />
    );
  }

  // Desktop version
  return (
    <MainLayout title="Deck Builder" showSidebar={false}>
      <div className="flex h-[calc(100vh-8rem)]">
        {/* Left Panel - Card Search */}
        <div className="w-96 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Card Search
            </h2>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search cards..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus-ring"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {searchLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : searchResults && searchResults.cards.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {searchResults.cards.map((card) => (
                  <div
                    key={card.id}
                    className="group cursor-pointer"
                    onClick={() => addCardToDeck(card)}
                  >
                    <div className="aspect-[3/4] relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
                      {card.imageUrlSmall ? (
                        <img
                          src={card.imageUrlSmall}
                          alt={card.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                          No Image
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <PlusIcon className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <p className="text-xs font-medium text-gray-900 dark:text-white mt-1 truncate">
                      {card.name}
                    </p>
                  </div>
                ))}
              </div>
            ) : debouncedSearch ? (
              <p className="text-center text-gray-500 dark:text-gray-400">
                No cards found
              </p>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400">
                Search for cards to add to your deck
              </p>
            )}
          </div>
        </div>

        {/* Center Panel - Deck Builder */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
          {/* Deck Header */}
          <div className="p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="Deck Name"
                  className="text-xl font-semibold bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 focus-visible:outline-none focus-visible:border-blue-500 px-1"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                />
                <select
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus-ring"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="standard">Standard</option>
                  <option value="expanded">Expanded</option>
                  <option value="unlimited">Unlimited</option>
                  <option value="glc">GLC</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-medium ${totalCards === 60 ? 'text-green-600' : 'text-gray-600'}`}>
                  {totalCards}/60
                </span>
                <button
                  onClick={saveDeck}
                  disabled={!deckName || totalCards === 0 || isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 focus-ring transition-colors"
                >
                  <DocumentArrowDownIcon className="h-5 w-5" />
                  {isSaving ? 'Saving...' : 'Save Deck'}
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">
                  Pokémon: {deck.pokemon.reduce((sum, c) => sum + c.quantity, 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">
                  Trainers: {deck.trainer.reduce((sum, c) => sum + c.quantity, 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">
                  Energy: {deck.energy.reduce((sum, c) => sum + c.quantity, 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Deck Sections */}
          <div className="flex-1 overflow-y-auto p-4">
            <DragDropContext onDragEnd={handleDragEnd}>
              {/* Pokemon Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  Pokémon ({deck.pokemon.reduce((sum, c) => sum + c.quantity, 0)})
                </h3>
                <Droppable droppableId="pokemon">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2 min-h-[100px] bg-white dark:bg-gray-800 rounded-lg p-3"
                    >
                      {deck.pokemon.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                          Add Pokémon cards here
                        </p>
                      ) : (
                        deck.pokemon.map((deckCard, index) => (
                          <Draggable key={deckCard.id} draggableId={deckCard.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <img
                                    src={deckCard.card.imageUrlSmall}
                                    alt={deckCard.card.name}
                                    className="w-12 h-16 object-cover rounded"
                                  />
                                  <div>
                                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                                      {deckCard.card.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {deckCard.card.set.name}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateCardQuantity('pokemon', deckCard.cardId, -1)}
                                    className="p-1 text-gray-500 hover:text-gray-700"
                                  >
                                    <MinusIcon className="h-4 w-4" />
                                  </button>
                                  <span className="font-medium text-gray-900 dark:text-white w-8 text-center">
                                    {deckCard.quantity}
                                  </span>
                                  <button
                                    onClick={() => updateCardQuantity('pokemon', deckCard.cardId, 1)}
                                    className="p-1 text-gray-500 hover:text-gray-700"
                                  >
                                    <PlusIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => removeCard('pokemon', deckCard.cardId)}
                                    className="p-1 text-red-500 hover:text-red-700 ml-2"
                                  >
                                    <XMarkIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              {/* Trainer Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Trainers ({deck.trainer.reduce((sum, c) => sum + c.quantity, 0)})
                </h3>
                <Droppable droppableId="trainer">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2 min-h-[100px] bg-white dark:bg-gray-800 rounded-lg p-3"
                    >
                      {deck.trainer.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                          Add Trainer cards here
                        </p>
                      ) : (
                        deck.trainer.map((deckCard, index) => (
                          <Draggable key={deckCard.id} draggableId={deckCard.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <img
                                    src={deckCard.card.imageUrlSmall}
                                    alt={deckCard.card.name}
                                    className="w-12 h-16 object-cover rounded"
                                  />
                                  <div>
                                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                                      {deckCard.card.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {deckCard.card.set.name}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateCardQuantity('trainer', deckCard.cardId, -1)}
                                    className="p-1 text-gray-500 hover:text-gray-700"
                                  >
                                    <MinusIcon className="h-4 w-4" />
                                  </button>
                                  <span className="font-medium text-gray-900 dark:text-white w-8 text-center">
                                    {deckCard.quantity}
                                  </span>
                                  <button
                                    onClick={() => updateCardQuantity('trainer', deckCard.cardId, 1)}
                                    className="p-1 text-gray-500 hover:text-gray-700"
                                  >
                                    <PlusIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => removeCard('trainer', deckCard.cardId)}
                                    className="p-1 text-red-500 hover:text-red-700 ml-2"
                                  >
                                    <XMarkIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              {/* Energy Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  Energy ({deck.energy.reduce((sum, c) => sum + c.quantity, 0)})
                </h3>
                <Droppable droppableId="energy">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2 min-h-[100px] bg-white dark:bg-gray-800 rounded-lg p-3"
                    >
                      {deck.energy.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                          Add Energy cards here
                        </p>
                      ) : (
                        deck.energy.map((deckCard, index) => (
                          <Draggable key={deckCard.id} draggableId={deckCard.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <img
                                    src={deckCard.card.imageUrlSmall}
                                    alt={deckCard.card.name}
                                    className="w-12 h-16 object-cover rounded"
                                  />
                                  <div>
                                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                                      {deckCard.card.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {deckCard.card.set.name}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateCardQuantity('energy', deckCard.cardId, -1)}
                                    className="p-1 text-gray-500 hover:text-gray-700"
                                  >
                                    <MinusIcon className="h-4 w-4" />
                                  </button>
                                  <span className="font-medium text-gray-900 dark:text-white w-8 text-center">
                                    {deckCard.quantity}
                                  </span>
                                  <button
                                    onClick={() => updateCardQuantity('energy', deckCard.cardId, 1)}
                                    className="p-1 text-gray-500 hover:text-gray-700"
                                  >
                                    <PlusIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => removeCard('energy', deckCard.cardId)}
                                    className="p-1 text-red-500 hover:text-red-700 ml-2"
                                  >
                                    <XMarkIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </DragDropContext>
          </div>
        </div>

        {/* Right Panel - Analysis */}
        <div className="w-80 bg-white dark:bg-gray-800 border-l dark:border-gray-700 p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Deck Analysis
          </h2>

          {totalCards > 0 ? (
            <div className="space-y-4">
              {/* Validation */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <InformationCircleIcon className="h-5 w-5" />
                  Validation
                </h3>
                <div className="space-y-1 text-sm">
                  {totalCards !== 60 && (
                    <p className="text-yellow-600 dark:text-yellow-400">
                      • Deck must have exactly 60 cards
                    </p>
                  )}
                  {analysis?.validation?.errors?.map((error, index) => (
                    <p key={index} className="text-red-600 dark:text-red-400">
                      • {error}
                    </p>
                  ))}
                  {totalCards === 60 && (!analysis?.validation?.errors || analysis.validation.errors.length === 0) && (
                    <p className="text-green-600 dark:text-green-400">
                      ✓ Deck is valid for {format} format
                    </p>
                  )}
                </div>
              </div>

              {/* Consistency Score */}
              {analysis?.consistency && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <ChartBarIcon className="h-5 w-5" />
                    Consistency
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Score</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {analysis.consistency.score}%
                    </span>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              <div className="bg-blue-50 dark:bg-blue-900/50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <SparklesIcon className="h-5 w-5" />
                  Suggestions
                </h3>
                <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  <li>• Add more draw supporters</li>
                  <li>• Consider adding Professor's Research</li>
                  <li>• Balance your energy count</li>
                </ul>
              </div>

              {/* Test Hands */}
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                <PlayIcon className="h-5 w-5" />
                Test Opening Hands
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <SparklesIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                Add cards to see deck analysis
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}