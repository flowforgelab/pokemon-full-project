/**
 * Test script for Limitless TCG integration
 * 
 * Tests the web scraping and meta sync functionality
 */

import { limitlessScraper } from '../lib/api/limitless-tcg-scraper';
import { metaSyncService } from '../lib/services/meta-sync-service';

async function testLimitlessIntegration() {
  console.log('🔍 Testing Limitless TCG Integration\n');
  
  try {
    // Test 1: Fetch current meta decks
    console.log('1. Fetching current meta decks...');
    const metaDecks = await limitlessScraper.fetchMetaDecks('STANDARD');
    console.log(`Found ${metaDecks.length} meta decks:`);
    metaDecks.slice(0, 5).forEach(deck => {
      console.log(`  - ${deck.name}: ${deck.percentage}% of meta`);
    });
    
    // Test 2: Fetch recent tournaments
    console.log('\n2. Fetching recent tournaments...');
    const tournaments = await limitlessScraper.fetchTournaments({ limit: 5 });
    console.log(`Found ${tournaments.length} tournaments:`);
    tournaments.forEach(tournament => {
      console.log(`  - ${tournament.name} (${tournament.playerCount} players)`);
    });
    
    // Test 3: Get tournament details
    if (tournaments.length > 0) {
      console.log('\n3. Fetching tournament details...');
      const { tournament, standings } = await limitlessScraper.fetchTournamentDetails(tournaments[0].id);
      console.log(`Tournament: ${tournament.name}`);
      console.log(`Top 3 placings:`);
      standings.slice(0, 3).forEach(standing => {
        console.log(`  ${standing.placement}. ${standing.player} - ${standing.deckArchetype}`);
      });
    }
    
    // Test 4: Analyze a sample deck
    console.log('\n4. Testing meta analysis...');
    const sampleDeck = [
      { cardName: 'Charizard ex', quantity: 2 },
      { cardName: 'Charmander', quantity: 4 },
      { cardName: 'Charmeleon', quantity: 2 },
      { cardName: 'Rare Candy', quantity: 4 },
      { cardName: "Professor's Research", quantity: 4 }
    ];
    
    const analysis = await metaSyncService.analyzeAgainstTournamentMeta(sampleDeck);
    console.log('Deck analysis:');
    console.log(`  Meta position: ${analysis.metaPosition}`);
    console.log(`  Similar archetypes:`);
    analysis.similarArchetypes.forEach(arch => {
      console.log(`    - ${arch.name} (${Math.round(arch.similarity * 100)}% similar)`);
    });
    
  } catch (error) {
    console.error('Error during testing:', error);
    console.log('\nNote: If you see 404 errors, the HTML structure may have changed.');
    console.log('The scraper selectors would need to be updated to match the current site structure.');
  }
}

// Run the test
testLimitlessIntegration().catch(console.error);