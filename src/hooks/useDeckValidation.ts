import { useEffect, useState } from 'react';
import { DeckCard } from '@/types/pokemon';

interface ValidationMessage {
  id: string;
  message: string;
  type: 'error' | 'warning';
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

export function useDeckValidation(deck: DeckCard[], formatId: string): ValidationResult {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  });

  useEffect(() => {
    const errors: ValidationMessage[] = [];
    const warnings: ValidationMessage[] = [];

    // Calculate total cards
    const totalCards = deck.reduce((sum, dc) => sum + dc.quantity, 0);

    // Check deck size
    if (totalCards !== 60) {
      if (totalCards < 60) {
        errors.push({
          id: 'deck-size-under',
          message: `Deck has ${totalCards} cards. A valid deck must have exactly 60 cards.`,
          type: 'error',
        });
      } else {
        errors.push({
          id: 'deck-size-over',
          message: `Deck has ${totalCards} cards. Maximum allowed is 60 cards.`,
          type: 'error',
        });
      }
    }

    // Check card limits (max 4 of each card except basic energy)
    const cardCounts = new Map<string, number>();
    deck.forEach((dc) => {
      const currentCount = cardCounts.get(dc.cardId) || 0;
      cardCounts.set(dc.cardId, currentCount + dc.quantity);
    });

    cardCounts.forEach((count, cardId) => {
      const card = deck.find(dc => dc.cardId === cardId)?.card;
      if (card && count > 4 && card.supertype !== 'ENERGY') {
        errors.push({
          id: `card-limit-${cardId}`,
          message: `You have ${count} copies of ${card.name}. Maximum allowed is 4.`,
          type: 'error',
        });
      }
    });

    // Check for at least one basic Pokémon
    const hasBasicPokemon = deck.some(
      (dc) => dc.card?.supertype === 'POKEMON' && dc.card?.subtypes?.includes('Basic')
    );

    if (!hasBasicPokemon && deck.length > 0) {
      warnings.push({
        id: 'no-basic-pokemon',
        message: 'Deck has no Basic Pokémon. You need at least one to start the game.',
        type: 'warning',
      });
    }

    // Format-specific validation
    if (formatId === 'standard' || formatId === 'expanded') {
      deck.forEach((dc) => {
        if (dc.card) {
          const isLegal = formatId === 'standard' 
            ? dc.card.isLegalStandard 
            : dc.card.isLegalExpanded;
          
          if (!isLegal) {
            errors.push({
              id: `format-illegal-${dc.cardId}`,
              message: `${dc.card.name} is not legal in ${formatId} format.`,
              type: 'error',
            });
          }
        }
      });
    }

    // Check energy balance
    const energyCount = deck
      .filter(dc => dc.card?.supertype === 'ENERGY')
      .reduce((sum, dc) => sum + dc.quantity, 0);
    
    if (energyCount < 8 && deck.length > 0) {
      warnings.push({
        id: 'low-energy',
        message: `Deck has only ${energyCount} energy cards. Consider adding more for consistency.`,
        type: 'warning',
      });
    }

    setValidation({
      isValid: errors.length === 0,
      errors,
      warnings,
    });
  }, [deck, formatId]);

  return validation;
}