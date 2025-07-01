/**
 * Utility functions for card operations
 */

const BASIC_ENERGY_NAMES = [
  'Grass Energy',
  'Fire Energy',
  'Water Energy',
  'Lightning Energy',
  'Psychic Energy',
  'Fighting Energy',
  'Darkness Energy',
  'Metal Energy',
  'Fairy Energy',
];

/**
 * Check if a card is a basic energy card
 */
export function isBasicEnergy(card: { supertype: string; name: string }): boolean {
  return card.supertype === 'ENERGY' && BASIC_ENERGY_NAMES.includes(card.name);
}

/**
 * Get the maximum allowed quantity for a card in a deck
 */
export function getMaxCardQuantity(card: { supertype: string; name: string }): number {
  return isBasicEnergy(card) ? 999 : 4; // Effectively unlimited for basic energy
}