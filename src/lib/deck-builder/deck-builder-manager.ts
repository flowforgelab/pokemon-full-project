import { Card, Deck, Format } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { z } from 'zod';
import {
  DeckComposition,
  DeckSection,
  CardEntry,
  ValidationResult,
  ValidationRule,
  DeckStatistics,
  TestingSession,
  DeckSuggestion,
  BuildingPattern,
  DeckBuilderState,
  DeckExportFormat,
  DeckImportResult,
  DeckCollaborator,
  DeckVersion,
  AccessibilitySettings,
  CardSearchFilters,
} from './types';
import { CardSearchEngine } from './card-search-engine';
import { DeckValidator } from './deck-validator';
import { DeckStatisticsAnalyzer } from './deck-statistics-analyzer';
import { DeckTestingSimulator } from './deck-testing-simulator';
import { DragDropManager } from './drag-drop-manager';
import { SmartSuggestionEngine } from './smart-suggestion-engine';
import { CollaborationManager } from './collaboration-manager';
import crypto from 'crypto';

export class DeckBuilderManager {
  private searchEngine: CardSearchEngine;
  private validator: DeckValidator;
  private statisticsAnalyzer: DeckStatisticsAnalyzer;
  private testingSimulator: DeckTestingSimulator;
  private dragDropManager: DragDropManager;
  private suggestionEngine: SmartSuggestionEngine;
  private collaborationManager: CollaborationManager;

  constructor() {
    this.searchEngine = new CardSearchEngine();
    this.validator = new DeckValidator();
    this.statisticsAnalyzer = new DeckStatisticsAnalyzer();
    this.testingSimulator = new DeckTestingSimulator();
    this.dragDropManager = new DragDropManager();
    this.suggestionEngine = new SmartSuggestionEngine();
    this.collaborationManager = new CollaborationManager();
  }

  // Core deck building operations
  async createNewDeck(
    userId: string,
    name: string,
    format?: Format,
    template?: string
  ): Promise<{ deck: Deck; composition: DeckComposition }> {
    // Create deck in database
    const deck = await prisma.deck.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        name,
        formatId: format?.id,
        description: '',
        tags: [],
        isPublic: false,
        cards: {
          create: [],
        },
      },
    });

    // Initialize composition
    let composition: DeckComposition;
    
    if (template) {
      composition = await this.loadTemplate(template);
    } else {
      composition = this.createEmptyComposition();
    }

    return { deck, composition };
  }

  async loadDeck(deckId: string, userId: string): Promise<DeckComposition> {
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          include: {
            card: {
              include: {
                set: true,
                prices: {
                  orderBy: { updatedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        format: true,
      },
    });

    if (!deck) {
      throw new Error('Deck not found');
    }

    // Check permissions
    if (deck.userId !== userId && !deck.isPublic) {
      const hasAccess = await this.collaborationManager.hasAccess(deckId, userId);
      if (!hasAccess) {
        throw new Error('Unauthorized access to deck');
      }
    }

    return this.deckToComposition(deck);
  }

  async saveDeck(
    deckId: string,
    composition: DeckComposition,
    userId: string
  ): Promise<void> {
    // Validate ownership
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      select: { userId: true },
    });

    if (!deck || deck.userId !== userId) {
      const canEdit = await this.collaborationManager.canEdit(deckId, userId);
      if (!canEdit) {
        throw new Error('Unauthorized to save deck');
      }
    }

    // Convert composition to database format
    const cardEntries = this.compositionToCardEntries(composition);

    // Update deck
    await prisma.$transaction(async (tx) => {
      // Delete existing cards
      await tx.deckCard.deleteMany({
        where: { deckId },
      });

      // Add new cards
      await tx.deckCard.createMany({
        data: cardEntries.map(entry => ({
          deckId,
          cardId: entry.cardId,
          quantity: entry.quantity,
          category: entry.category,
        })),
      });

      // Update deck metadata
      await tx.deck.update({
        where: { id: deckId },
        data: {
          updatedAt: new Date(),
        },
      });

      // Create version history
      await this.collaborationManager.createVersion(deckId, userId, composition);
    });
  }

  // Card operations
  async addCard(
    composition: DeckComposition,
    card: Card,
    quantity: number = 1,
    section: 'main-deck' | 'sideboard' = 'main-deck'
  ): Promise<{ composition: DeckComposition; validation: ValidationResult[] }> {
    // Check if card can be added
    const canAdd = await this.validator.canAddCard(
      card,
      composition,
      quantity,
      composition.format
    );

    if (!canAdd.allowed) {
      return {
        composition,
        validation: [{
          type: 'error',
          message: canAdd.reason!,
          cardId: card.id,
          rule: ValidationRule.CARD_LIMIT,
        }],
      };
    }

    // Clone composition
    const newComposition = this.cloneComposition(composition);

    // Determine card category
    const category = this.getCardCategory(card);
    const targetSection = section === 'main-deck' ? newComposition.mainDeck : newComposition.sideboard;

    // Find existing entry or create new one
    const existingEntry = targetSection[category].find(e => e.card.id === card.id);
    
    if (existingEntry) {
      existingEntry.quantity += quantity;
    } else {
      // Get price info
      const price = await this.getCardPrice(card.id);
      
      targetSection[category].push({
        card,
        quantity,
        isOwned: false,
        ownedQuantity: 0,
        price,
        position: targetSection[category].length,
      });
    }

    // Update counts
    this.updateCounts(newComposition);

    // Validate
    const validation = await this.validator.validateDeck(newComposition, composition.format);

    return { composition: newComposition, validation };
  }

  async removeCard(
    composition: DeckComposition,
    cardId: string,
    quantity: number = 1,
    section: 'main-deck' | 'sideboard' = 'main-deck'
  ): Promise<{ composition: DeckComposition; validation: ValidationResult[] }> {
    const newComposition = this.cloneComposition(composition);
    const targetSection = section === 'main-deck' ? newComposition.mainDeck : newComposition.sideboard;

    // Find card in appropriate category
    for (const category of ['pokemon', 'trainers', 'energy'] as const) {
      const index = targetSection[category].findIndex(e => e.card.id === cardId);
      
      if (index !== -1) {
        const entry = targetSection[category][index];
        entry.quantity -= quantity;
        
        if (entry.quantity <= 0) {
          targetSection[category].splice(index, 1);
        }
        
        break;
      }
    }

    // Update counts
    this.updateCounts(newComposition);

    // Validate
    const validation = await this.validator.validateDeck(newComposition, composition.format);

    return { composition: newComposition, validation };
  }

  // Search operations
  async searchCards(
    filters: CardSearchFilters,
    page: number = 1,
    pageSize: number = 20,
    deckCardIds?: string[]
  ) {
    return this.searchEngine.search(filters, page, pageSize, deckCardIds);
  }

  async getSearchSuggestions(query: string) {
    return this.searchEngine.searchSuggestions(query);
  }

  async getRecentlyViewed(userId: string) {
    return this.searchEngine.getRecentlyViewed(userId);
  }

  async getPopularCards(format?: string) {
    return this.searchEngine.getPopularCards(format);
  }

  // Statistics and analysis
  async analyzeDeck(composition: DeckComposition, userId?: string): Promise<DeckStatistics> {
    return this.statisticsAnalyzer.analyzeDeck(composition, userId);
  }

  async testDeck(composition: DeckComposition, numberOfHands: number = 10): Promise<TestingSession> {
    return this.testingSimulator.simulateHands(composition, numberOfHands);
  }

  // Smart suggestions
  async getSuggestions(
    composition: DeckComposition,
    userId: string
  ): Promise<DeckSuggestion[]> {
    return this.suggestionEngine.generateSuggestions(composition, userId);
  }

  async learnFromFeedback(
    userId: string,
    suggestionId: string,
    accepted: boolean
  ): Promise<void> {
    await this.suggestionEngine.recordFeedback(userId, suggestionId, accepted);
  }

  // Import/Export
  async exportDeck(
    composition: DeckComposition,
    format: DeckExportFormat
  ): Promise<string | Buffer> {
    switch (format.format) {
      case 'text':
        return this.exportAsText(composition, format);
      case 'json':
        return JSON.stringify(composition, null, 2);
      case 'ptcgo':
        return this.exportAsPTCGO(composition);
      case 'pdf':
        return this.exportAsPDF(composition, format);
      case 'image':
        return this.exportAsImage(composition);
      default:
        throw new Error(`Unsupported export format: ${format.format}`);
    }
  }

  async importDeck(
    data: string,
    format: string,
    userId: string
  ): Promise<DeckImportResult> {
    switch (format) {
      case 'text':
        return this.importFromText(data);
      case 'json':
        return this.importFromJSON(data);
      case 'ptcgo':
        return this.importFromPTCGO(data);
      default:
        return {
          success: false,
          cards: [],
          errors: [`Unsupported import format: ${format}`],
          warnings: [],
          format,
        };
    }
  }

  // Collaboration
  async shareDecK(
    deckId: string,
    userId: string,
    targetUserId: string,
    role: 'editor' | 'viewer'
  ): Promise<void> {
    await this.collaborationManager.shareDecK(deckId, userId, targetUserId, role);
  }

  async getCollaborators(deckId: string): Promise<DeckCollaborator[]> {
    return this.collaborationManager.getCollaborators(deckId);
  }

  async getVersionHistory(deckId: string): Promise<DeckVersion[]> {
    return this.collaborationManager.getVersionHistory(deckId);
  }

  // Helper methods
  private createEmptyComposition(): DeckComposition {
    return {
      mainDeck: {
        pokemon: [],
        trainers: [],
        energy: [],
        totalCards: 0,
      },
      sideboard: {
        pokemon: [],
        trainers: [],
        energy: [],
        totalCards: 0,
      },
      totalCards: 0,
      energyCount: 0,
      trainerCount: 0,
      pokemonCount: 0,
      deckValidation: [],
      lastModified: new Date(),
    };
  }

  private async loadTemplate(templateId: string): Promise<DeckComposition> {
    // Load predefined templates
    const templates: Record<string, Partial<DeckComposition>> = {
      'basic-fire': {
        // Fire deck template
      },
      'basic-water': {
        // Water deck template
      },
      // Add more templates
    };

    const template = templates[templateId];
    if (!template) {
      return this.createEmptyComposition();
    }

    return {
      ...this.createEmptyComposition(),
      ...template,
    };
  }

  private deckToComposition(deck: any): DeckComposition {
    const composition = this.createEmptyComposition();
    
    deck.cards.forEach((deckCard: any) => {
      const card = deckCard.card;
      const category = this.getCardCategory(card);
      const entry: CardEntry = {
        card,
        quantity: deckCard.quantity,
        isOwned: false, // Would need to check collection
        ownedQuantity: 0,
        price: card.prices?.[0]?.marketPrice || 0,
      };

      if (deckCard.category === 'sideboard') {
        composition.sideboard[category].push(entry);
      } else {
        composition.mainDeck[category].push(entry);
      }
    });

    this.updateCounts(composition);
    composition.format = deck.format;

    return composition;
  }

  private compositionToCardEntries(composition: DeckComposition): Array<{
    cardId: string;
    quantity: number;
    category: string;
  }> {
    const entries: Array<any> = [];

    const addEntries = (section: DeckSection, category: string) => {
      ['pokemon', 'trainers', 'energy'].forEach(type => {
        section[type as keyof DeckSection].forEach((entry: CardEntry) => {
          entries.push({
            cardId: entry.card.id,
            quantity: entry.quantity,
            category,
          });
        });
      });
    };

    addEntries(composition.mainDeck, 'main');
    addEntries(composition.sideboard, 'sideboard');

    return entries;
  }

  private getCardCategory(card: Card): 'pokemon' | 'trainers' | 'energy' {
    switch (card.supertype) {
      case 'POKEMON':
        return 'pokemon';
      case 'TRAINER':
        return 'trainers';
      case 'ENERGY':
        return 'energy';
      default:
        return 'trainers'; // Default fallback
    }
  }

  private updateCounts(composition: DeckComposition): void {
    // Update main deck counts
    composition.mainDeck.totalCards = 
      composition.mainDeck.pokemon.reduce((sum, e) => sum + e.quantity, 0) +
      composition.mainDeck.trainers.reduce((sum, e) => sum + e.quantity, 0) +
      composition.mainDeck.energy.reduce((sum, e) => sum + e.quantity, 0);

    // Update total counts
    composition.totalCards = composition.mainDeck.totalCards;
    composition.pokemonCount = composition.mainDeck.pokemon.reduce((sum, e) => sum + e.quantity, 0);
    composition.trainerCount = composition.mainDeck.trainers.reduce((sum, e) => sum + e.quantity, 0);
    composition.energyCount = composition.mainDeck.energy.reduce((sum, e) => sum + e.quantity, 0);
  }

  private cloneComposition(composition: DeckComposition): DeckComposition {
    return JSON.parse(JSON.stringify(composition));
  }

  private async getCardPrice(cardId: string): Promise<number> {
    const price = await prisma.cardPrice.findFirst({
      where: { cardId },
      orderBy: { updatedAt: 'desc' },
    });

    return price?.marketPrice?.toNumber() || 0;
  }

  // Export implementations
  private exportAsText(composition: DeckComposition, options: DeckExportFormat): string {
    let output = `Pokemon TCG Deck List\n`;
    output += `Total Cards: ${composition.totalCards}\n\n`;

    // Pokemon section
    if (composition.pokemonCount > 0) {
      output += `Pokemon (${composition.pokemonCount})\n`;
      composition.mainDeck.pokemon.forEach(entry => {
        output += `${entry.quantity} ${entry.card.name} ${entry.card.set?.ptcgoCode || ''} ${entry.card.number}\n`;
      });
      output += '\n';
    }

    // Trainer section
    if (composition.trainerCount > 0) {
      output += `Trainers (${composition.trainerCount})\n`;
      composition.mainDeck.trainers.forEach(entry => {
        output += `${entry.quantity} ${entry.card.name}\n`;
      });
      output += '\n';
    }

    // Energy section
    if (composition.energyCount > 0) {
      output += `Energy (${composition.energyCount})\n`;
      composition.mainDeck.energy.forEach(entry => {
        output += `${entry.quantity} ${entry.card.name}\n`;
      });
    }

    return output;
  }

  private exportAsPTCGO(composition: DeckComposition): string {
    // PTCGO format is similar to text but with specific formatting
    return this.exportAsText(composition, { format: 'ptcgo', includeStats: false, includePrices: false, includeNotes: false });
  }

  private async exportAsPDF(composition: DeckComposition, options: DeckExportFormat): Promise<Buffer> {
    // Would need PDF generation library
    throw new Error('PDF export not yet implemented');
  }

  private async exportAsImage(composition: DeckComposition): Promise<Buffer> {
    // Would need image generation library
    throw new Error('Image export not yet implemented');
  }

  // Import implementations
  private async importFromText(text: string): Promise<DeckImportResult> {
    const lines = text.split('\n').filter(line => line.trim());
    const cards: CardEntry[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const line of lines) {
      // Skip section headers
      if (line.includes('Pokemon') || line.includes('Trainer') || line.includes('Energy')) {
        continue;
      }

      // Parse card line (e.g., "4 Charizard ex PAR 54")
      const match = line.match(/^(\d+)\s+(.+?)(?:\s+([A-Z]{3})\s+(\d+))?$/);
      if (match) {
        const [, quantityStr, cardName, setCode, number] = match;
        const quantity = parseInt(quantityStr);

        // Search for card
        const searchResults = await this.searchEngine.search({ text: cardName }, 1, 1);
        
        if (searchResults.cards.length > 0) {
          const card = searchResults.cards[0];
          cards.push({
            card,
            quantity,
            isOwned: false,
            ownedQuantity: 0,
            price: 0,
          });
        } else {
          errors.push(`Card not found: ${cardName}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      cards,
      errors,
      warnings,
      format: 'text',
    };
  }

  private importFromJSON(json: string): DeckImportResult {
    try {
      const data = JSON.parse(json);
      // Validate and import JSON structure
      return {
        success: true,
        cards: [],
        errors: [],
        warnings: [],
        format: 'json',
      };
    } catch (error) {
      return {
        success: false,
        cards: [],
        errors: ['Invalid JSON format'],
        warnings: [],
        format: 'json',
      };
    }
  }

  private async importFromPTCGO(text: string): Promise<DeckImportResult> {
    // PTCGO format is similar to text format
    return this.importFromText(text);
  }
}

// Export singleton instance
export const deckBuilderManager = new DeckBuilderManager();