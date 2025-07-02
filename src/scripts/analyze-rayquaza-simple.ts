import { PrismaClient } from '@prisma/client';
import { SafeAnalyzer } from '../lib/analysis/safe-analyzer';

const prisma = new PrismaClient();

async function analyzeRayquazaDeck() {
  try {
    // First, find the Rayquaza deck
    const decks = await prisma.deck.findMany({
      where: {
        OR: [
          { name: { contains: 'Rayquaza', mode: 'insensitive' } },
          { description: { contains: 'Rayquaza', mode: 'insensitive' } }
        ]
      },
      include: {
        cards: {
          include: {
            card: true
          }
        }
      }
    });
    
    console.log('Found', decks.length, 'Rayquaza deck(s)\n');
    
    // Analyze each deck found
    for (const deck of decks) {
      console.log('========================================');
      console.log('DECK:', deck.name);
      console.log('Cards in deck:', deck.cards.length);
      console.log('========================================\n');
      
      // Show card breakdown
      console.log('CARD LIST:');
      const pokemon = deck.cards.filter(dc => dc.card.supertype === 'POKEMON');
      const trainers = deck.cards.filter(dc => dc.card.supertype === 'TRAINER');
      const energy = deck.cards.filter(dc => dc.card.supertype === 'ENERGY');
      
      console.log(`\nPokemon (${pokemon.length}):`);
      pokemon.forEach(dc => {
        console.log(`- ${dc.quantity}x ${dc.card.name}`);
      });
      
      console.log(`\nTrainers (${trainers.length}):`);
      trainers.forEach(dc => {
        console.log(`- ${dc.quantity}x ${dc.card.name}`);
      });
      
      console.log(`\nEnergy (${energy.length}):`);
      energy.forEach(dc => {
        console.log(`- ${dc.quantity}x ${dc.card.name}`);
      });
      
      // Only analyze if deck has 60 cards
      const totalCards = deck.cards.reduce((sum, dc) => sum + dc.quantity, 0);
      console.log(`\nTotal card count: ${totalCards}`);
      
      if (totalCards !== 60) {
        console.log('\n⚠️  WARNING: This deck has', totalCards, 'cards instead of 60!');
        console.log('The deck is incomplete and analysis may not be accurate.\n');
      }
      
      // Run the analysis
      console.log('\nRUNNING DECK ANALYSIS...\n');
      const analyzer = new SafeAnalyzer();
      const analysis = await analyzer.analyzeDeck(deck);
      
      // Simple output
      console.log('OVERALL SCORE:', analysis.scores.overall, '/ 100');
      console.log('\nKEY SCORES:');
      console.log('- Consistency:', analysis.scores.consistency);
      console.log('- Speed:', analysis.scores.speed);
      console.log('- Power:', analysis.scores.power);
      console.log('- Versatility:', analysis.scores.versatility);
      
      console.log('\nDECK ARCHETYPE:', analysis.archetype);
      
      console.log('\nANALYSIS SUMMARY:');
      console.log('- Mulligan chance:', (analysis.consistency.mulliganProbability * 100).toFixed(1) + '%');
      console.log('- Dead draw chance:', (analysis.consistency.deadDrawProbability * 100).toFixed(1) + '%');
      
      console.log('\nWARNINGS (' + analysis.warnings.length + '):');
      if (analysis.warnings.length === 0) {
        console.log('- None, deck structure looks good!');
      } else {
        analysis.warnings.forEach((w, i) => {
          console.log(`${i + 1}. ${w.message}`);
        });
      }
      
      console.log('\nRECOMMENDATIONS (' + analysis.recommendations.length + '):');
      analysis.recommendations.forEach((r, i) => {
        console.log(`${i + 1}. ${r.card || 'General'}: ${r.reason}`);
      });
      
      console.log('\n========================================\n');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeRayquazaDeck().catch(console.error);