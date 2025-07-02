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
    
    console.log('Found', decks.length, 'Rayquaza deck(s)');
    
    if (decks.length === 0) {
      console.log('No Rayquaza deck found in database');
      console.log('You may need to create it first using the deck builder or import script');
      return;
    }
    
    // Analyze the first Rayquaza deck found
    const deck = decks[0];
    console.log('\n========================================');
    console.log('ANALYZING:', deck.name);
    console.log('Format:', deck.format);
    console.log('Cards:', deck.cards.length);
    console.log('========================================\n');
    
    // Create analyzer and run analysis
    const analyzer = new SafeAnalyzer();
    const analysis = await analyzer.analyzeDeck(deck);
    
    // Display the analysis results
    console.log('OVERALL SCORE:', analysis.scores.overall.toFixed(1), '/ 100');
    console.log('\nDETAILED SCORES:');
    console.log('- Consistency:', analysis.scores.consistency.toFixed(1));
    console.log('- Speed:', analysis.scores.speed.toFixed(1));
    console.log('- Versatility:', analysis.scores.versatility.toFixed(1));
    console.log('- Power:', analysis.scores.power.toFixed(1));
    console.log('- Meta Relevance:', analysis.scores.metaRelevance.toFixed(1));
    console.log('- Innovation:', analysis.scores.innovation.toFixed(1));
    console.log('- Difficulty:', analysis.scores.difficulty.toFixed(1));
    
    console.log('\nARCHETYPE:', analysis.archetype.type, '-', analysis.archetype.name);
    console.log('Description:', analysis.archetype.description);
    
    console.log('\nCONSISTENCY METRICS:');
    console.log('- Overall Consistency:', analysis.consistency.overallConsistency.toFixed(1) + '%');
    console.log('- Mulligan Probability:', (analysis.consistency.mulliganProbability * 100).toFixed(1) + '%');
    console.log('- Dead Draw Probability:', (analysis.consistency.deadDrawProbability * 100).toFixed(1) + '%');
    console.log('- Energy Ratio:', analysis.consistency.energyRatio.totalEnergy, 'energy cards');
    console.log('- Trainer Count:', analysis.consistency.trainerDistribution.totalTrainers, 'trainers');
    console.log('- Pokemon Count:', analysis.consistency.pokemonRatio.totalPokemon, 'Pokemon');
    
    console.log('\nSYNERGY ANALYSIS:');
    console.log('- Overall Synergy Score:', analysis.synergy.overallSynergy.toFixed(1));
    console.log('- Key Combos:', analysis.synergy.keyCombos.length);
    if (analysis.synergy.keyCombos.length > 0) {
      analysis.synergy.keyCombos.slice(0, 3).forEach(combo => {
        console.log(`  • ${combo.cards.join(' + ')}: ${combo.description}`);
      });
    }
    
    console.log('\nSPEED ANALYSIS:');
    console.log('- Setup Speed:', analysis.speed.setupSpeed.toFixed(1));
    console.log('- Average First Attack Turn:', analysis.speed.averageFirstAttack.toFixed(1));
    console.log('- Energy Acceleration Available:', analysis.speed.energyAccelerationAvailable ? 'Yes' : 'No');
    
    console.log('\nWARNINGS:');
    if (analysis.warnings.length === 0) {
      console.log('None - Deck is well constructed!');
    } else {
      analysis.warnings.forEach(w => console.log(`[${w.severity}]`, w.message));
    }
    
    console.log('\nRECOMMENDATIONS:');
    analysis.recommendations.forEach((r, i) => {
      console.log(`${i + 1}. ${r.description}`);
      if (r.cards && r.cards.length > 0) {
        console.log(`   Suggested cards: ${r.cards.join(', ')}`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeRayquazaDeck().catch(console.error);