import battleArenaDecks from './battle-arena-decks.json';

export interface DeckTemplate {
  name: string;
  description: string;
  format: string;
  releaseDate: string;
  cards: DeckTemplateCard[];
  strategy?: {
    overview: string;
    keyCards: string[];
    gameplan: string;
  };
}

export interface DeckTemplateCard {
  name: string;
  set: string;
  number: string;
  quantity: number;
  category: 'pokemon' | 'trainer' | 'energy';
}

// Export all deck templates
export const deckTemplates: Record<string, DeckTemplate> = {
  ...battleArenaDecks,
};

// Helper function to get a specific deck template
export function getDeckTemplate(templateId: string): DeckTemplate | undefined {
  return deckTemplates[templateId];
}

// Helper function to get all deck template IDs
export function getAllDeckTemplateIds(): string[] {
  return Object.keys(deckTemplates);
}

// Helper function to format deck list as text
export function formatDeckListAsText(template: DeckTemplate): string {
  let output = `${template.name}\n`;
  output += `Total Cards: 60\n\n`;

  // Group cards by category
  const pokemon = template.cards.filter(c => c.category === 'pokemon');
  const trainers = template.cards.filter(c => c.category === 'trainer');
  const energy = template.cards.filter(c => c.category === 'energy');

  // Pokemon section
  if (pokemon.length > 0) {
    const pokemonCount = pokemon.reduce((sum, card) => sum + card.quantity, 0);
    output += `Pokemon (${pokemonCount})\n`;
    pokemon.forEach(card => {
      output += `${card.quantity} ${card.name} ${card.set} ${card.number}\n`;
    });
    output += '\n';
  }

  // Trainer section
  if (trainers.length > 0) {
    const trainerCount = trainers.reduce((sum, card) => sum + card.quantity, 0);
    output += `Trainers (${trainerCount})\n`;
    trainers.forEach(card => {
      output += `${card.quantity} ${card.name} ${card.set} ${card.number}\n`;
    });
    output += '\n';
  }

  // Energy section
  if (energy.length > 0) {
    const energyCount = energy.reduce((sum, card) => sum + card.quantity, 0);
    output += `Energy (${energyCount})\n`;
    energy.forEach(card => {
      output += `${card.quantity} ${card.name}\n`;
    });
  }

  return output;
}

// Helper function to format deck list for PTCGO import
export function formatDeckListForPTCGO(template: DeckTemplate): string {
  let output = '';

  // Group cards by category
  const pokemon = template.cards.filter(c => c.category === 'pokemon');
  const trainers = template.cards.filter(c => c.category === 'trainer');
  const energy = template.cards.filter(c => c.category === 'energy');

  // Format each card line
  const formatCard = (card: DeckTemplateCard) => {
    if (card.category === 'energy') {
      // Basic energy cards don't need set codes
      return `${card.quantity} ${card.name}`;
    }
    return `${card.quantity} ${card.name} ${card.set} ${card.number}`;
  };

  // Add all cards
  [...pokemon, ...trainers, ...energy].forEach(card => {
    output += formatCard(card) + '\n';
  });

  return output.trim();
}