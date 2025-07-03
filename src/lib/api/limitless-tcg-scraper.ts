/**
 * Limitless TCG Data Scraper
 * 
 * Since Limitless TCG doesn't provide a public API, this module
 * implements web scraping to extract tournament and deck data.
 * 
 * NOTE: This should be used responsibly with rate limiting and caching.
 * Consider reaching out to Limitless TCG for permission or partnership.
 */

import { z } from 'zod';
import { BaseApiClient } from './base-client';
import * as cheerio from 'cheerio';

// Data schemas
export const TournamentSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.date(),
  format: z.enum(['STANDARD', 'EXPANDED']),
  playerCount: z.number(),
  country: z.string().optional(),
  winner: z.object({
    name: z.string(),
    country: z.string(),
    deckId: z.string().optional()
  }).optional()
});

export const DeckListCardSchema = z.object({
  name: z.string(),
  setCode: z.string(),
  quantity: z.number(),
  category: z.enum(['pokemon', 'trainer', 'energy'])
});

export const DeckListSchema = z.object({
  id: z.string(),
  player: z.string(),
  tournament: z.string(),
  placement: z.number(),
  cards: z.array(DeckListCardSchema),
  archetype: z.string().optional()
});

export const MetaDeckSchema = z.object({
  name: z.string(),
  percentage: z.number(),
  iconPokemon: z.array(z.string()),
  sampleDeckId: z.string().optional()
});

export type Tournament = z.infer<typeof TournamentSchema>;
export type DeckList = z.infer<typeof DeckListSchema>;
export type MetaDeck = z.infer<typeof MetaDeckSchema>;

export class LimitlessTCGScraper extends BaseApiClient {
  constructor() {
    super({
      baseURL: 'https://limitlesstcg.com',
      headers: {
        'User-Agent': 'Pokemon-TCG-Deck-Builder/1.0 (Educational/Research)'
      },
      rateLimit: {
        maxRequests: 10,
        perMilliseconds: 60000 // 10 requests per minute
      }
    });
  }

  /**
   * Fetch current meta decks from homepage
   */
  async fetchMetaDecks(format: 'STANDARD' | 'EXPANDED' = 'STANDARD'): Promise<MetaDeck[]> {
    try {
      const html = await this.get('/');
      const $ = cheerio.load(html.data);
      
      const metaDecks: MetaDeck[] = [];
      
      // Parse top decks section
      $('.deck-tile').each((_, element) => {
        const $deck = $(element);
        const name = $deck.find('.deck-name').text().trim();
        const percentage = parseFloat($deck.find('.percentage').text().replace('%', ''));
        const iconPokemon = $deck.find('.pokemon-icon').map((_, icon) => 
          $(icon).attr('data-pokemon') || ''
        ).get();
        
        if (name && !isNaN(percentage)) {
          metaDecks.push({
            name,
            percentage,
            iconPokemon,
            sampleDeckId: $deck.attr('data-deck-id')
          });
        }
      });
      
      return metaDecks.sort((a, b) => b.percentage - a.percentage);
    } catch (error) {
      console.error('Error fetching meta decks:', error);
      throw error;
    }
  }

  /**
   * Fetch tournament list with pagination
   */
  async fetchTournaments(options: {
    page?: number;
    format?: 'STANDARD' | 'EXPANDED';
    type?: 'regional' | 'international' | 'special';
    limit?: number;
  } = {}): Promise<Tournament[]> {
    const params = new URLSearchParams({
      page: (options.page || 1).toString(),
      format: options.format || '',
      type: options.type || '',
      limit: (options.limit || 25).toString()
    });

    const html = await this.get(`/tournaments?${params}`);
    const $ = cheerio.load(html.data);
    
    const tournaments: Tournament[] = [];
    
    $('tr.tournament-row').each((_, row) => {
      const $row = $(row);
      const id = $row.attr('data-tournament-id') || '';
      const dateText = $row.find('.date').text().trim();
      const name = $row.find('.tournament-name').text().trim();
      const format = $row.find('.format').text().trim().toUpperCase() as 'STANDARD' | 'EXPANDED';
      const playerCount = parseInt($row.find('.players').text()) || 0;
      const winnerName = $row.find('.winner-name').text().trim();
      const winnerCountry = $row.find('.winner-country').attr('data-country') || '';
      
      if (id && name) {
        tournaments.push({
          id,
          name,
          date: new Date(dateText),
          format,
          playerCount,
          winner: winnerName ? {
            name: winnerName,
            country: winnerCountry
          } : undefined
        });
      }
    });
    
    return tournaments;
  }

  /**
   * Fetch detailed tournament results
   */
  async fetchTournamentDetails(tournamentId: string): Promise<{
    tournament: Tournament;
    standings: Array<{
      placement: number;
      player: string;
      country: string;
      deckArchetype: string;
      deckListId?: string;
    }>;
  }> {
    const html = await this.get(`/tournaments/${tournamentId}`);
    const $ = cheerio.load(html.data);
    
    // Parse tournament info
    const name = $('h1.tournament-name').text().trim();
    const dateText = $('.tournament-date').text().trim();
    const playerCount = parseInt($('.player-count').text()) || 0;
    const format = $('.tournament-format').text().trim().toUpperCase() as 'STANDARD' | 'EXPANDED';
    
    const tournament: Tournament = {
      id: tournamentId,
      name,
      date: new Date(dateText),
      format,
      playerCount
    };
    
    // Parse standings
    const standings: Array<{
      placement: number;
      player: string;
      country: string;
      deckArchetype: string;
      deckListId?: string;
    }> = [];
    
    $('tr.standing-row').each((_, row) => {
      const $row = $(row);
      const placement = parseInt($row.find('.placement').text()) || 0;
      const player = $row.find('.player-name').text().trim();
      const country = $row.find('.country-flag').attr('data-country') || '';
      const deckArchetype = $row.find('.deck-name').text().trim();
      const deckListId = $row.find('a.decklist-link').attr('href')?.match(/\/decks\/list\/(\d+)/)?.[1];
      
      if (placement && player) {
        standings.push({
          placement,
          player,
          country,
          deckArchetype,
          deckListId
        });
      }
    });
    
    return { tournament, standings };
  }

  /**
   * Fetch deck list details
   */
  async fetchDeckList(deckListId: string): Promise<DeckList> {
    const html = await this.get(`/decks/list/${deckListId}`);
    const $ = cheerio.load(html.data);
    
    // Parse metadata
    const player = $('.player-name').text().trim();
    const tournament = $('.tournament-name').text().trim();
    const placement = parseInt($('.placement').text().match(/\d+/)?.[0] || '0');
    
    // Parse cards
    const cards: DeckListCardSchema[] = [];
    
    // Pokemon
    $('.pokemon-section .card-row').each((_, row) => {
      const $row = $(row);
      const quantity = parseInt($row.find('.quantity').text()) || 0;
      const name = $row.find('.card-name').text().trim();
      const setCode = $row.find('.set-code').text().trim();
      
      if (name) {
        cards.push({
          name,
          setCode,
          quantity,
          category: 'pokemon'
        });
      }
    });
    
    // Trainers
    $('.trainer-section .card-row').each((_, row) => {
      const $row = $(row);
      const quantity = parseInt($row.find('.quantity').text()) || 0;
      const name = $row.find('.card-name').text().trim();
      const setCode = $row.find('.set-code').text().trim();
      
      if (name) {
        cards.push({
          name,
          setCode,
          quantity,
          category: 'trainer'
        });
      }
    });
    
    // Energy
    $('.energy-section .card-row').each((_, row) => {
      const $row = $(row);
      const quantity = parseInt($row.find('.quantity').text()) || 0;
      const name = $row.find('.card-name').text().trim();
      const setCode = $row.find('.set-code').text().trim();
      
      if (name) {
        cards.push({
          name,
          setCode,
          quantity,
          category: 'energy'
        });
      }
    });
    
    return {
      id: deckListId,
      player,
      tournament,
      placement,
      cards
    };
  }

  /**
   * Convert Limitless deck list to our deck format
   */
  async convertDeckListToCards(deckList: DeckList): Promise<Array<{
    cardName: string;
    setCode: string;
    quantity: number;
  }>> {
    // This would need to map Limitless set codes to our Pokemon TCG API set codes
    // For now, return a simple mapping
    return deckList.cards.map(card => ({
      cardName: card.name,
      setCode: card.setCode,
      quantity: card.quantity
    }));
  }
}

// Export singleton instance
export const limitlessScraper = new LimitlessTCGScraper();