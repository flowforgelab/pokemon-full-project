'use client';

import { useParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { api } from '@/utils/api';
import Link from 'next/link';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params?.id as string;
  const [imageError, setImageError] = useState(false);

  const { data: card, isLoading, error } = api.card.getById.useQuery(cardId, {
    enabled: !!cardId,
  });

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Cards', href: '/cards' },
    { label: card?.name || 'Loading...', href: `/cards/${cardId}` },
  ];

  if (isLoading) {
    return (
      <MainLayout title="Loading..." breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </MainLayout>
    );
  }

  if (error || !card) {
    return (
      <MainLayout title="Card Not Found" breadcrumbs={breadcrumbs}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Card not found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            The card you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href="/cards"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Cards
          </Link>
        </div>
      </MainLayout>
    );
  }

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
    <MainLayout title={card.name} breadcrumbs={breadcrumbs}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Card Image */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 sticky top-20">
            <div className="aspect-[3/4] relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
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
            </div>
          </div>
        </div>

        {/* Card Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {card.name}
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
                  {card.set.name} • {card.number}/{card.set.printedTotal || card.set.total}
                </p>
              </div>
              {card.rarity && (
                <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium">
                  {card.rarity}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Abilities */}
          {card.abilities && card.abilities.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Abilities
              </h2>
              <div className="space-y-4">
                {card.abilities.map((ability, index) => (
                  <div key={index}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        {ability.type}
                      </span>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {ability.name}
                      </h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">{ability.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attacks */}
          {card.attacks && card.attacks.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Attacks
              </h2>
              <div className="space-y-4">
                {card.attacks.map((attack, index) => (
                  <div key={index} className="border-b dark:border-gray-700 pb-4 last:border-0 last:pb-0">
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
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {attack.name}
                        </h3>
                      </div>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {attack.damage || '-'}
                      </span>
                    </div>
                    {attack.text && (
                      <p className="text-gray-600 dark:text-gray-400">{attack.text}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weaknesses & Resistances */}
          {(card.weaknesses?.length > 0 || card.resistances?.length > 0) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-2 gap-6">
                {card.weaknesses?.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                      Weaknesses
                    </h3>
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
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                      Resistances
                    </h3>
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
            </div>
          )}

          {/* Additional Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Additional Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {card.artist && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Artist</p>
                  <p className="font-medium text-gray-900 dark:text-white">{card.artist}</p>
                </div>
              )}
              
              {card.retreatCost && card.retreatCost.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Retreat Cost</p>
                  <div className="flex gap-1 mt-1">
                    {card.retreatCost.map((cost, i) => (
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
                </div>
              )}

              {card.regulationMark && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Regulation Mark</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {card.regulationMark}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Legality</p>
                <div className="flex gap-2 mt-1">
                  {card.isLegalStandard && (
                    <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                      Standard
                    </span>
                  )}
                  {card.isLegalExpanded && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                      Expanded
                    </span>
                  )}
                  {card.isLegalUnlimited && (
                    <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                      Unlimited
                    </span>
                  )}
                </div>
              </div>
            </div>

            {card.flavorText && (
              <div className="mt-4 pt-4 border-t dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Flavor Text</p>
                <p className="italic text-gray-700 dark:text-gray-300">"{card.flavorText}"</p>
              </div>
            )}

            {card.rules && card.rules.length > 0 && (
              <div className="mt-4 pt-4 border-t dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Rules</p>
                <ul className="space-y-1">
                  {card.rules.map((rule, index) => (
                    <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                      • {rule}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Price Information */}
          {card.prices && card.prices.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Market Prices
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {card.prices.map((price, index) => (
                  <div key={index} className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {price.source} {price.priceType}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {price.currency === 'USD' ? '$' : '€'}
                      {parseFloat(price.price).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}