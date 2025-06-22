import { Card, Format, Supertype } from '@prisma/client';
import { 
  DeckComposition, 
  ValidationResult, 
  ValidationRule,
  CardEntry 
} from './types';
import { prisma } from '@/server/db/prisma';

export class DeckValidator {
  private readonly DECK_SIZE = 60;
  private readonly MAX_COPIES = 4;
  private readonly MIN_BASIC_POKEMON = 1;
  
  // Format-specific rules
  private readonly formatRules: Record<string, {
    bannedCards: Set<string>;
    restrictedCards: Map<string, number>; // cardId -> max copies
    requiredCards?: Set<string>;
    maxEnergyTypes?: number;
  }> = {
    standard: {
      bannedCards: new Set([]),
      restrictedCards: new Map([]),
    },
    expanded: {
      bannedCards: new Set([
        // Add banned cards for expanded format
      ]),
      restrictedCards: new Map([
        // Add restricted cards
      ]),
    },
    glc: {
      bannedCards: new Set([]),
      restrictedCards: new Map([]), // All non-basic energy restricted to 1
      maxEnergyTypes: 1,
    },
  };

  async validateDeck(
    deck: DeckComposition,
    format?: Format
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Combine all cards from main deck
    const allCards = [
      ...deck.mainDeck.pokemon,
      ...deck.mainDeck.trainers,
      ...deck.mainDeck.energy,
    ];

    // Basic validations
    results.push(...this.validateDeckSize(deck));
    results.push(...this.validateCardCopies(allCards));
    results.push(...this.validateBasicPokemon(deck.mainDeck.pokemon));
    
    // Format-specific validations
    if (format) {
      results.push(...await this.validateFormatLegality(allCards, format));
      results.push(...this.validateFormatRules(allCards, format.name));
    }
    
    // Gameplay validations
    results.push(...this.validateEnergyBalance(deck));
    results.push(...this.validateConsistency(deck));
    results.push(...this.validateStrategy(deck));
    
    // Sort results by severity
    return results.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      return severityOrder[a.type] - severityOrder[b.type];
    });
  }

  private validateDeckSize(deck: DeckComposition): ValidationResult[] {
    const results: ValidationResult[] = [];
    const totalCards = deck.totalCards;
    
    if (totalCards < this.DECK_SIZE) {
      results.push({
        type: 'error',
        message: `Deck has ${totalCards} cards. Must have exactly ${this.DECK_SIZE} cards.`,
        rule: ValidationRule.DECK_SIZE,
        suggestion: `Add ${this.DECK_SIZE - totalCards} more cards to complete your deck.`,
      });
    } else if (totalCards > this.DECK_SIZE) {
      results.push({
        type: 'error',
        message: `Deck has ${totalCards} cards. Must have exactly ${this.DECK_SIZE} cards.`,
        rule: ValidationRule.DECK_SIZE,
        suggestion: `Remove ${totalCards - this.DECK_SIZE} cards from your deck.`,
      });
    }
    
    return results;
  }

  private validateCardCopies(cards: CardEntry[]): ValidationResult[] {
    const results: ValidationResult[] = [];
    const cardCounts = new Map<string, { entry: CardEntry; total: number }>();
    
    // Count cards
    cards.forEach(entry => {
      const existing = cardCounts.get(entry.card.id);
      if (existing) {
        existing.total += entry.quantity;
      } else {
        cardCounts.set(entry.card.id, { entry, total: entry.quantity });
      }
    });
    
    // Check limits
    cardCounts.forEach(({ entry, total }, cardId) => {
      const card = entry.card;
      const isBasicEnergy = card.supertype === Supertype.ENERGY && 
                           card.subtypes?.includes('Basic');
      
      if (!isBasicEnergy && total > this.MAX_COPIES) {
        results.push({
          type: 'error',
          message: `${card.name}: ${total} copies (max ${this.MAX_COPIES} allowed)`,
          cardId,
          rule: ValidationRule.CARD_LIMIT,
          suggestion: `Remove ${total - this.MAX_COPIES} copies of ${card.name}.`,
        });
      }
    });
    
    return results;
  }

  private validateBasicPokemon(pokemon: CardEntry[]): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    const basicPokemon = pokemon.filter(entry => 
      entry.card.subtypes?.includes('Basic')
    );
    
    const totalBasics = basicPokemon.reduce((sum, entry) => sum + entry.quantity, 0);
    
    if (totalBasics < this.MIN_BASIC_POKEMON) {
      results.push({
        type: 'error',
        message: `Deck has ${totalBasics} Basic Pokémon. Must have at least ${this.MIN_BASIC_POKEMON}.`,
        rule: ValidationRule.BASIC_POKEMON_MINIMUM,
        suggestion: 'Add Basic Pokémon to avoid mulligans and ensure you can start the game.',
      });
    } else if (totalBasics < 8) {
      results.push({
        type: 'warning',
        message: `Only ${totalBasics} Basic Pokémon may lead to frequent mulligans.`,
        rule: ValidationRule.BASIC_POKEMON_MINIMUM,
        suggestion: 'Consider adding more Basic Pokémon for consistency (8-12 recommended).',
      });
    }
    
    return results;
  }

  private async validateFormatLegality(
    cards: CardEntry[],
    format: Format
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Get legal sets for format
    const legalSets = await prisma.set.findMany({
      where: {
        releaseDate: {
          gte: format.startDate,
          ...(format.endDate && { lte: format.endDate }),
        },
      },
      select: { id: true },
    });
    
    const legalSetIds = new Set(legalSets.map(s => s.id));
    
    // Check each card
    cards.forEach(entry => {
      const card = entry.card;
      
      // Check if card's set is legal
      if (!legalSetIds.has(card.setId)) {
        results.push({
          type: 'error',
          message: `${card.name} is not legal in ${format.name} format.`,
          cardId: card.id,
          rule: ValidationRule.FORMAT_LEGALITY,
          suggestion: `Remove ${card.name} or switch to a format where it's legal.`,
        });
      }
      
      // Check card-specific legality
      if (card.legalities && format.name in card.legalities) {
        const isLegal = card.legalities[format.name as keyof typeof card.legalities];
        if (!isLegal) {
          results.push({
            type: 'error',
            message: `${card.name} is specifically banned in ${format.name} format.`,
            cardId: card.id,
            rule: ValidationRule.BANNED_CARD,
            suggestion: `Remove ${card.name} from your deck.`,
          });
        }
      }
    });
    
    return results;
  }

  private validateFormatRules(
    cards: CardEntry[],
    formatName: string
  ): ValidationResult[] {
    const results: ValidationResult[] = [];
    const rules = this.formatRules[formatName.toLowerCase()];
    
    if (!rules) return results;
    
    cards.forEach(entry => {
      const card = entry.card;
      
      // Check banned cards
      if (rules.bannedCards.has(card.id)) {
        results.push({
          type: 'error',
          message: `${card.name} is banned in ${formatName} format.`,
          cardId: card.id,
          rule: ValidationRule.BANNED_CARD,
          suggestion: `Remove ${card.name} from your deck.`,
        });
      }
      
      // Check restricted cards
      const maxCopies = rules.restrictedCards.get(card.id);
      if (maxCopies !== undefined && entry.quantity > maxCopies) {
        results.push({
          type: 'error',
          message: `${card.name} is restricted to ${maxCopies} copies in ${formatName} format.`,
          cardId: card.id,
          rule: ValidationRule.RESTRICTED_CARD,
          suggestion: `Reduce ${card.name} to ${maxCopies} copies.`,
        });
      }
    });
    
    // GLC specific rules
    if (formatName.toLowerCase() === 'glc') {
      results.push(...this.validateGLCRules(cards));
    }
    
    return results;
  }

  private validateGLCRules(cards: CardEntry[]): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Check for single type (excluding colorless)
    const energyTypes = new Set<string>();
    cards.forEach(entry => {
      if (entry.card.types && entry.card.types.length > 0) {
        entry.card.types.forEach(type => {
          if (type !== 'Colorless') {
            energyTypes.add(type);
          }
        });
      }
    });
    
    if (energyTypes.size > 1) {
      results.push({
        type: 'error',
        message: `GLC decks must contain only one energy type. Found: ${Array.from(energyTypes).join(', ')}`,
        rule: ValidationRule.FORMAT_LEGALITY,
        suggestion: 'Remove cards of other types to comply with GLC rules.',
      });
    }
    
    // Check for singleton rule (except basic energy)
    const nonBasicCards = cards.filter(entry => 
      !(entry.card.supertype === Supertype.ENERGY && entry.card.subtypes?.includes('Basic'))
    );
    
    nonBasicCards.forEach(entry => {
      if (entry.quantity > 1) {
        results.push({
          type: 'error',
          message: `${entry.card.name}: ${entry.quantity} copies. GLC allows only 1 copy of non-basic energy cards.`,
          cardId: entry.card.id,
          rule: ValidationRule.CARD_LIMIT,
          suggestion: `Reduce ${entry.card.name} to 1 copy.`,
        });
      }
    });
    
    return results;
  }

  private validateEnergyBalance(deck: DeckComposition): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    const totalPokemon = deck.pokemonCount;
    const totalEnergy = deck.energyCount;
    const totalTrainers = deck.trainerCount;
    
    // Check energy ratio
    const energyRatio = totalEnergy / deck.totalCards;
    if (energyRatio < 0.15) {
      results.push({
        type: 'warning',
        message: `Low energy count (${totalEnergy}). Most decks need 15-20% energy.`,
        rule: ValidationRule.ENERGY_BALANCE,
        suggestion: 'Consider adding more energy cards to ensure consistent energy attachment.',
      });
    } else if (energyRatio > 0.35) {
      results.push({
        type: 'warning',
        message: `High energy count (${totalEnergy}). Most decks run 15-25% energy.`,
        rule: ValidationRule.ENERGY_BALANCE,
        suggestion: 'Consider replacing some energy with draw supporters or search cards.',
      });
    }
    
    // Check trainer balance
    const trainerRatio = totalTrainers / deck.totalCards;
    if (trainerRatio < 0.4) {
      results.push({
        type: 'warning',
        message: `Low trainer count (${totalTrainers}). Most competitive decks run 50-60% trainers.`,
        rule: ValidationRule.CONSISTENCY,
        suggestion: 'Add more trainer cards for better consistency and draw power.',
      });
    }
    
    return results;
  }

  private validateConsistency(deck: DeckComposition): ValidationResult[] {
    const results: ValidationResult[] = [];
    const trainers = deck.mainDeck.trainers;
    
    // Check for draw supporters
    const drawSupporters = trainers.filter(entry => 
      this.isDrawSupporter(entry.card)
    );
    const totalDrawSupporters = drawSupporters.reduce((sum, e) => sum + e.quantity, 0);
    
    if (totalDrawSupporters < 6) {
      results.push({
        type: 'warning',
        message: `Only ${totalDrawSupporters} draw supporters. Most decks need 6-10 for consistency.`,
        rule: ValidationRule.CONSISTENCY,
        suggestion: 'Add cards like Professor\'s Research, Marnie, or Cynthia for better draw power.',
      });
    }
    
    // Check for search cards
    const searchCards = trainers.filter(entry => 
      this.isSearchCard(entry.card)
    );
    const totalSearchCards = searchCards.reduce((sum, e) => sum + e.quantity, 0);
    
    if (totalSearchCards < 4) {
      results.push({
        type: 'info',
        message: `Consider adding search cards like Quick Ball or Ultra Ball for better consistency.`,
        rule: ValidationRule.CONSISTENCY,
        suggestion: 'Search cards help you find the Pokémon you need when you need them.',
      });
    }
    
    // Check for recovery options
    const recoveryCards = trainers.filter(entry => 
      this.isRecoveryCard(entry.card)
    );
    
    if (recoveryCards.length === 0) {
      results.push({
        type: 'info',
        message: 'No recovery cards found. Consider adding Ordinary Rod or Rescue Carrier.',
        rule: ValidationRule.CONSISTENCY,
        suggestion: 'Recovery cards help you reuse important resources late in the game.',
      });
    }
    
    return results;
  }

  private validateStrategy(deck: DeckComposition): ValidationResult[] {
    const results: ValidationResult[] = [];
    const pokemon = deck.mainDeck.pokemon;
    
    // Check for clear attackers
    const attackers = pokemon.filter(entry => 
      this.isPrimaryAttacker(entry.card)
    );
    
    if (attackers.length === 0) {
      results.push({
        type: 'warning',
        message: 'No clear primary attackers identified.',
        rule: ValidationRule.CONSISTENCY,
        suggestion: 'Ensure your deck has Pokémon that can consistently deal damage and take prizes.',
      });
    }
    
    // Check for support Pokémon
    const supporters = pokemon.filter(entry => 
      this.isSupportPokemon(entry.card)
    );
    
    // Check evolution lines
    const evolutionLines = this.checkEvolutionLines(pokemon);
    evolutionLines.forEach(issue => {
      results.push({
        type: 'warning',
        message: issue.message,
        cardId: issue.cardId,
        rule: ValidationRule.CONSISTENCY,
        suggestion: issue.suggestion,
      });
    });
    
    return results;
  }

  // Helper methods for card classification
  private isDrawSupporter(card: Card): boolean {
    const drawSupporters = [
      'Professor\'s Research',
      'Marnie',
      'Cynthia',
      'Hop',
      'Professor Juniper',
      'Professor Sycamore',
      'N',
      'Colress',
      'Lillie',
    ];
    
    return card.supertype === Supertype.TRAINER &&
           card.subtypes?.includes('Supporter') &&
           drawSupporters.some(name => card.name.includes(name));
  }

  private isSearchCard(card: Card): boolean {
    const searchCards = [
      'Quick Ball',
      'Ultra Ball',
      'Great Ball',
      'Level Ball',
      'Evolution Incense',
      'Nest Ball',
      'Timer Ball',
      'Heavy Ball',
      'Dive Ball',
    ];
    
    return card.supertype === Supertype.TRAINER &&
           searchCards.some(name => card.name.includes(name));
  }

  private isRecoveryCard(card: Card): boolean {
    const recoveryCards = [
      'Ordinary Rod',
      'Rescue Carrier',
      'Super Rod',
      'Pal Pad',
      'Energy Recycler',
      'Brock\'s Grit',
    ];
    
    return card.supertype === Supertype.TRAINER &&
           recoveryCards.some(name => card.name.includes(name));
  }

  private isPrimaryAttacker(card: Card): boolean {
    if (card.supertype !== Supertype.POKEMON) return false;
    
    // Check if it has attacks with decent damage
    if (card.attacks && card.attacks.length > 0) {
      const hasGoodAttack = (card.attacks as any[]).some(attack => {
        const damage = parseInt(attack.damage || '0');
        return damage >= 80; // Arbitrary threshold
      });
      
      return hasGoodAttack || card.subtypes?.some(st => 
        ['V', 'VMAX', 'VSTAR', 'ex', 'EX', 'GX'].includes(st)
      );
    }
    
    return false;
  }

  private isSupportPokemon(card: Card): boolean {
    if (card.supertype !== Supertype.POKEMON) return false;
    
    // Check for abilities
    if (card.abilities && card.abilities.length > 0) {
      return true;
    }
    
    // Known support Pokémon
    const supportPokemon = [
      'Bibarel',
      'Octillery',
      'Crobat V',
      'Dedenne-GX',
      'Jirachi',
      'Eldegoss V',
    ];
    
    return supportPokemon.some(name => card.name.includes(name));
  }

  private checkEvolutionLines(pokemon: CardEntry[]): Array<{
    message: string;
    cardId?: string;
    suggestion: string;
  }> {
    const issues: Array<{ message: string; cardId?: string; suggestion: string }> = [];
    const pokemonByName = new Map<string, CardEntry[]>();
    
    // Group Pokémon by name
    pokemon.forEach(entry => {
      const baseName = entry.card.name.replace(/ V$| VMAX$| VSTAR$| ex$| EX$| GX$/, '');
      const existing = pokemonByName.get(baseName) || [];
      existing.push(entry);
      pokemonByName.set(baseName, existing);
    });
    
    // Check each evolution line
    pokemonByName.forEach((entries, baseName) => {
      const basics = entries.filter(e => e.card.subtypes?.includes('Basic'));
      const stage1s = entries.filter(e => e.card.subtypes?.includes('Stage 1'));
      const stage2s = entries.filter(e => e.card.subtypes?.includes('Stage 2'));
      
      // Check ratios
      if (stage1s.length > 0 && basics.length === 0) {
        issues.push({
          message: `${baseName}: Stage 1 without Basic Pokémon`,
          cardId: stage1s[0].card.id,
          suggestion: `Add Basic ${baseName} to evolve into your Stage 1.`,
        });
      }
      
      if (stage2s.length > 0) {
        if (basics.length === 0) {
          issues.push({
            message: `${baseName}: Stage 2 without Basic Pokémon`,
            cardId: stage2s[0].card.id,
            suggestion: `Add Basic ${baseName} to support your evolution line.`,
          });
        }
        if (stage1s.length === 0) {
          issues.push({
            message: `${baseName}: Stage 2 without Stage 1 Pokémon`,
            cardId: stage2s[0].card.id,
            suggestion: `Add Stage 1 ${baseName} to complete your evolution line.`,
          });
        }
      }
      
      // Check quantities
      const totalBasics = basics.reduce((sum, e) => sum + e.quantity, 0);
      const totalStage1s = stage1s.reduce((sum, e) => sum + e.quantity, 0);
      const totalStage2s = stage2s.reduce((sum, e) => sum + e.quantity, 0);
      
      if (totalStage1s > totalBasics * 2) {
        issues.push({
          message: `${baseName}: Too many Stage 1 (${totalStage1s}) compared to Basic (${totalBasics})`,
          suggestion: `Consider reducing Stage 1 or adding more Basic ${baseName}.`,
        });
      }
      
      if (totalStage2s > totalStage1s) {
        issues.push({
          message: `${baseName}: More Stage 2 (${totalStage2s}) than Stage 1 (${totalStage1s})`,
          suggestion: `Add more Stage 1 ${baseName} or reduce Stage 2 count.`,
        });
      }
    });
    
    return issues;
  }

  // Real-time validation for individual cards
  async canAddCard(
    card: Card,
    currentDeck: DeckComposition,
    quantity: number,
    format?: Format
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check deck size
    if (currentDeck.totalCards + quantity > this.DECK_SIZE) {
      return {
        allowed: false,
        reason: `Adding ${quantity} cards would exceed the ${this.DECK_SIZE} card limit.`,
      };
    }
    
    // Check card copies
    const currentQuantity = this.getCardQuantity(card.id, currentDeck);
    const isBasicEnergy = card.supertype === Supertype.ENERGY && 
                         card.subtypes?.includes('Basic');
    
    if (!isBasicEnergy && currentQuantity + quantity > this.MAX_COPIES) {
      return {
        allowed: false,
        reason: `Cannot have more than ${this.MAX_COPIES} copies of ${card.name}.`,
      };
    }
    
    // Check format legality
    if (format) {
      const formatRules = this.formatRules[format.name.toLowerCase()];
      if (formatRules) {
        if (formatRules.bannedCards.has(card.id)) {
          return {
            allowed: false,
            reason: `${card.name} is banned in ${format.name} format.`,
          };
        }
        
        const maxAllowed = formatRules.restrictedCards.get(card.id);
        if (maxAllowed !== undefined && currentQuantity + quantity > maxAllowed) {
          return {
            allowed: false,
            reason: `${card.name} is restricted to ${maxAllowed} copies in ${format.name} format.`,
          };
        }
      }
    }
    
    return { allowed: true };
  }

  private getCardQuantity(cardId: string, deck: DeckComposition): number {
    const allCards = [
      ...deck.mainDeck.pokemon,
      ...deck.mainDeck.trainers,
      ...deck.mainDeck.energy,
    ];
    
    const entry = allCards.find(e => e.card.id === cardId);
    return entry?.quantity || 0;
  }
}