/**
 * Meta Sync Service
 * 
 * Synchronizes tournament data from Limitless TCG with our meta context
 * to provide real-time competitive insights.
 */

import { limitlessScraper, type MetaDeck, type DeckList } from '@/lib/api/limitless-tcg-scraper';
import { prisma } from '@/lib/prisma';
import { MetaGameContext } from '@/lib/analysis/meta-context';
import { Format } from '@prisma/client';

export interface MetaSnapshot {
  date: Date;
  format: Format;
  topDecks: Array<{
    archetype: string;
    percentage: number;
    averagePlacement: number;
    sampleDecklists: string[];
    keyCards: string[];
  }>;
  tournamentCount: number;
  totalPlayers: number;
}

export class MetaSyncService {
  /**
   * Sync current meta data from Limitless TCG
   */
  async syncCurrentMeta(format: Format = 'STANDARD'): Promise<MetaSnapshot> {
    try {
      console.log(`Syncing ${format} meta data from Limitless TCG...`);
      
      // 1. Fetch current meta decks
      const metaDecks = await limitlessScraper.fetchMetaDecks(format);
      
      // 2. Fetch recent tournaments (last 30 days)
      const tournaments = await limitlessScraper.fetchTournaments({
        format,
        limit: 50
      });
      
      // 3. Analyze tournament results
      const deckStats = new Map<string, {
        count: number;
        placements: number[];
        deckListIds: string[];
      }>();
      
      let totalPlayers = 0;
      
      // Process each tournament
      for (const tournament of tournaments.slice(0, 10)) { // Limit to avoid rate limiting
        totalPlayers += tournament.playerCount;
        
        try {
          const { standings } = await limitlessScraper.fetchTournamentDetails(tournament.id);
          
          // Track deck performance
          for (const standing of standings) {
            if (!deckStats.has(standing.deckArchetype)) {
              deckStats.set(standing.deckArchetype, {
                count: 0,
                placements: [],
                deckListIds: []
              });
            }
            
            const stats = deckStats.get(standing.deckArchetype)!;
            stats.count++;
            stats.placements.push(standing.placement);
            if (standing.deckListId) {
              stats.deckListIds.push(standing.deckListId);
            }
          }
          
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error processing tournament ${tournament.id}:`, error);
        }
      }
      
      // 4. Calculate statistics
      const topDecks = Array.from(deckStats.entries())
        .map(([archetype, stats]) => {
          const averagePlacement = stats.placements.reduce((a, b) => a + b, 0) / stats.placements.length;
          const metaDeck = metaDecks.find(d => d.name.toLowerCase() === archetype.toLowerCase());
          
          return {
            archetype,
            percentage: metaDeck?.percentage || (stats.count / totalPlayers * 100),
            averagePlacement: Math.round(averagePlacement),
            sampleDecklists: stats.deckListIds.slice(0, 3),
            keyCards: metaDeck?.iconPokemon || []
          };
        })
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 15); // Top 15 decks
      
      const snapshot: MetaSnapshot = {
        date: new Date(),
        format,
        topDecks,
        tournamentCount: tournaments.length,
        totalPlayers
      };
      
      // 5. Update our meta context
      await this.updateMetaContext(snapshot);
      
      return snapshot;
      
    } catch (error) {
      console.error('Error syncing meta data:', error);
      throw error;
    }
  }

  /**
   * Update our static meta context with fresh data
   */
  private async updateMetaContext(snapshot: MetaSnapshot): Promise<void> {
    // This would update the CURRENT_STANDARD_META in meta-context.ts
    // For now, we'll store it in the database
    
    try {
      // Store meta snapshot
      await prisma.$executeRaw`
        INSERT INTO "MetaSnapshot" (date, format, data)
        VALUES (${snapshot.date}, ${snapshot.format}, ${JSON.stringify(snapshot)}::jsonb)
        ON CONFLICT (format) DO UPDATE
        SET date = EXCLUDED.date,
            data = EXCLUDED.data
      `;
      
      console.log(`Meta snapshot updated for ${snapshot.format}`);
    } catch (error) {
      console.error('Error storing meta snapshot:', error);
    }
  }

  /**
   * Fetch deck lists for a specific archetype
   */
  async fetchArchetypeDecklists(archetype: string, limit: number = 5): Promise<DeckList[]> {
    const decklists: DeckList[] = [];
    
    try {
      // Get recent tournaments
      const tournaments = await limitlessScraper.fetchTournaments({ limit: 20 });
      
      for (const tournament of tournaments) {
        const { standings } = await limitlessScraper.fetchTournamentDetails(tournament.id);
        
        // Find decks of this archetype
        const archetypeStandings = standings.filter(s => 
          s.deckArchetype.toLowerCase().includes(archetype.toLowerCase())
        );
        
        for (const standing of archetypeStandings.slice(0, limit - decklists.length)) {
          if (standing.deckListId) {
            try {
              const decklist = await limitlessScraper.fetchDeckList(standing.deckListId);
              decklists.push(decklist);
              
              if (decklists.length >= limit) break;
            } catch (error) {
              console.error(`Error fetching decklist ${standing.deckListId}:`, error);
            }
          }
        }
        
        if (decklists.length >= limit) break;
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error('Error fetching archetype decklists:', error);
    }
    
    return decklists;
  }

  /**
   * Analyze a deck against current tournament meta
   */
  async analyzeAgainstTournamentMeta(
    deckCards: Array<{ cardName: string; quantity: number }>,
    format: Format = 'STANDARD'
  ): Promise<{
    metaPosition: 'tier1' | 'tier2' | 'tier3' | 'rogue';
    similarArchetypes: Array<{ name: string; similarity: number }>;
    recommendations: string[];
  }> {
    try {
      // Get current meta
      const metaDecks = await limitlessScraper.fetchMetaDecks(format);
      
      // Compare deck to meta archetypes
      const similarities = metaDecks.map(metaDeck => {
        // Simple similarity based on key Pokemon
        const deckPokemonNames = deckCards
          .filter(c => c.cardName.includes('ex') || c.cardName.includes('V'))
          .map(c => c.cardName.toLowerCase());
        
        const matchingPokemon = metaDeck.iconPokemon.filter(pokemon => 
          deckPokemonNames.some(name => name.includes(pokemon.toLowerCase()))
        );
        
        return {
          name: metaDeck.name,
          similarity: matchingPokemon.length / Math.max(metaDeck.iconPokemon.length, 1)
        };
      });
      
      const topMatch = similarities.sort((a, b) => b.similarity - a.similarity)[0];
      const matchingMeta = metaDecks.find(d => d.name === topMatch?.name);
      
      // Determine tier based on meta percentage
      let metaPosition: 'tier1' | 'tier2' | 'tier3' | 'rogue' = 'rogue';
      if (matchingMeta) {
        if (matchingMeta.percentage >= 15) metaPosition = 'tier1';
        else if (matchingMeta.percentage >= 5) metaPosition = 'tier2';
        else if (matchingMeta.percentage >= 1) metaPosition = 'tier3';
      }
      
      // Generate recommendations
      const recommendations: string[] = [];
      if (metaPosition === 'rogue') {
        recommendations.push('Consider tech cards against top meta decks');
        recommendations.push(`Top meta: ${metaDecks.slice(0, 3).map(d => d.name).join(', ')}`);
      } else {
        recommendations.push(`Your deck aligns with ${topMatch.name} (${matchingMeta?.percentage}% of meta)`);
        recommendations.push('Consider studying top-placing lists of this archetype');
      }
      
      return {
        metaPosition,
        similarArchetypes: similarities.filter(s => s.similarity > 0.3),
        recommendations
      };
      
    } catch (error) {
      console.error('Error analyzing against tournament meta:', error);
      return {
        metaPosition: 'rogue',
        similarArchetypes: [],
        recommendations: ['Unable to fetch current tournament data']
      };
    }
  }
}

// Export singleton instance
export const metaSyncService = new MetaSyncService();