'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { api } from '@/utils/api';

interface CardDetailModalProps {
  cardId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function CardDetailModal({ cardId, isOpen, onClose }: CardDetailModalProps) {
  const [imageError, setImageError] = useState(false);

  const { data: card, isLoading } = api.card.getById.useQuery(cardId, {
    enabled: isOpen && !!cardId,
  });

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const typeColors: Record<string, string> = {
    Colorless: 'bg-gray-200 text-gray-800',
    Darkness: 'bg-gray-800 text-white',
    Dragon: 'bg-yellow-600 text-white',
    Fairy: 'bg-pink-400 text-white',
    Fighting: 'bg-orange-600 text-white',
    Fire: 'bg-red-500 text-white',
    Grass: 'bg-green-500 text-white',
    Lightning: 'bg-yellow-400 text-gray-900',
    Metal: 'bg-gray-500 text-white',
    Psychic: 'bg-purple-500 text-white',
    Water: 'bg-blue-500 text-white',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-6xl">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-50 p-2 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>

          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : card ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 max-h-[90vh] overflow-y-auto">
              {/* Card Image */}
              <div className="lg:col-span-1 bg-gray-100 dark:bg-gray-900 p-6 lg:p-8">
                <div className="aspect-[3/4] relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg">
                  {card.imageUrlLarge && !imageError ? (
                    <img
                      src={card.imageUrlLarge}
                      alt={card.name}
                      className="w-full h-full object-contain"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      No Image Available
                    </div>
                  )}
                  
                  {/* Pokemon Type Badge - Top Left Corner */}
                  {card.types && card.types.length > 0 && (
                    <div className="absolute top-4 left-4 flex gap-1">
                      {card.types.map((type) => (
                        <span
                          key={type}
                          className={`px-2 py-1 rounded-md text-xs font-bold shadow-lg ${
                            typeColors[type] || 'bg-gray-200 text-gray-800'
                          }`}
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Quick Actions */}
                <div className="mt-6 space-y-3">
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                    <PlusIcon className="h-5 w-5" />
                    Add to Collection
                  </button>
                  <button className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    Add to Deck
                  </button>
                  {card.purchaseUrl && (
                    <a
                      href={card.purchaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      Buy This Card
                    </a>
                  )}
                </div>
              </div>

              {/* Card Details */}
              <div className="lg:col-span-2 p-6 lg:p-8 space-y-6">
                {/* Header with rarity - moved above to avoid close button overlap */}
                <div className="flex items-start justify-between pr-12">
                  <div className="flex-1">
                    {/* Basic Info */}
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {card.name}
                      </h2>
                      <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
                        {card.set.name} {card.set.releaseDate ? `(${new Date(card.set.releaseDate).getFullYear()})` : ''} • {card.number}/{card.set.printedTotal || card.set.total}
                      </p>
                    </div>
                  </div>
                  
                  {card.rarity && (
                    <span className="ml-4 px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium whitespace-nowrap">
                      {card.rarity}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Card Type</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {card.supertype}
                      </p>
                    </div>
                    
                    {card.hp && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">HP</p>
                        <p className="font-medium text-gray-900 dark:text-white">{card.hp}</p>
                      </div>
                    )}

                    {card.types && card.types.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
                        <div className="flex gap-2 mt-1">
                          {card.types.map((type) => (
                            <span
                              key={type}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                typeColors[type] || 'bg-gray-200 text-gray-800'
                              }`}
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {card.evolvesFrom && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Evolves From</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {card.evolvesFrom}
                        </p>
                      </div>
                    )}
                  </div>

                {/* Abilities */}
                {card.abilities && card.abilities.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                      Abilities
                    </h3>
                    <div className="space-y-3">
                      {card.abilities.map((ability, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                              {ability.type}
                            </span>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {ability.name}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{ability.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attacks */}
                {card.attacks && card.attacks.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                      Attacks
                    </h3>
                    <div className="space-y-3">
                      {card.attacks.map((attack, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {attack.cost.map((cost, i) => (
                                  <span
                                    key={i}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                      typeColors[cost] || 'bg-gray-200 text-gray-800'
                                    }`}
                                  >
                                    {cost[0]}
                                  </span>
                                ))}
                              </div>
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {attack.name}
                              </h4>
                            </div>
                            <span className="text-2xl font-bold text-gray-900 dark:text-white">
                              {attack.damage || '-'}
                            </span>
                          </div>
                          {attack.text && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{attack.text}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weaknesses & Resistances */}
                {(card.weaknesses?.length > 0 || card.resistances?.length > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    {card.weaknesses?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                          Weaknesses
                        </h4>
                        <div className="space-y-1">
                          {card.weaknesses.map((weakness, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                  typeColors[weakness.type] || 'bg-gray-200 text-gray-800'
                                }`}
                              >
                                {weakness.type[0]}
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {weakness.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {card.resistances?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                          Resistances
                        </h4>
                        <div className="space-y-1">
                          {card.resistances.map((resistance, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                  typeColors[resistance.type] || 'bg-gray-200 text-gray-800'
                                }`}
                              >
                                {resistance.type[0]}
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">
                                {resistance.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Price Information - Only show USD prices */}
                {card.prices && card.prices.filter(p => p.currency === 'USD').length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                      Market Prices (USD)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {card.prices
                        .filter(price => price.currency === 'USD')
                        .map((price, index) => (
                          <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {price.source} {price.priceType}
                            </p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                              ${parseFloat(price.price).toFixed(2)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                {card.flavorText && (
                  <div className="border-t dark:border-gray-700 pt-4">
                    <p className="italic text-sm text-gray-700 dark:text-gray-300">
                      "{card.flavorText}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">Card not found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}