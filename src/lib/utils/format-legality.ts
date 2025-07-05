/**
 * Utility functions for card format legality
 */

export type FormatLegality = 'Standard' | 'Expanded' | 'Unlimited' | 'Not Legal';

/**
 * Get the most restrictive format a card is legal in
 * Standard is most restrictive, followed by Expanded, then Unlimited
 */
export function getCardFormat(card: {
  isLegalStandard: boolean;
  isLegalExpanded: boolean;
  isLegalUnlimited: boolean;
}): FormatLegality {
  if (card.isLegalStandard) {
    return 'Standard';
  }
  if (card.isLegalExpanded) {
    return 'Expanded';
  }
  if (card.isLegalUnlimited) {
    return 'Unlimited';
  }
  return 'Not Legal';
}

/**
 * Get the color scheme for format badges
 */
export function getFormatBadgeColors(format: FormatLegality): {
  bg: string;
  text: string;
  darkBg: string;
  darkText: string;
} {
  switch (format) {
    case 'Standard':
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        darkBg: 'dark:bg-green-900',
        darkText: 'dark:text-green-200'
      };
    case 'Expanded':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        darkBg: 'dark:bg-blue-900',
        darkText: 'dark:text-blue-200'
      };
    case 'Unlimited':
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        darkBg: 'dark:bg-purple-900',
        darkText: 'dark:text-purple-200'
      };
    case 'Not Legal':
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        darkBg: 'dark:bg-gray-900',
        darkText: 'dark:text-gray-200'
      };
  }
}